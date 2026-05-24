/**
 * Smarty Server Agent Provider
 *
 * Connects Nimbalyst to the local-first LangGraph/DeepAgents `smarty-server`.
 * Nimbalyst owns sessions, prompts, raw-message logging, and transcript
 * projection. `smarty-server` owns execution, LangGraph threads/runs, tools,
 * approvals, evidence, and inference routing.
 */

import { BaseAgentProvider } from './BaseAgentProvider';
import { buildUserMessageAddition } from './documentContextUtils';
import {
  AIModel,
  AIProviderType,
  ChatAttachment,
  DocumentContext,
  ProviderCapabilities,
  ProviderConfig,
  StreamChunk,
} from '../types';
import { DEFAULT_MODELS } from '../../modelConstants';
import { AgentProtocolTranscriptAdapter } from './agentProtocol/AgentProtocolTranscriptAdapter';
import { SmartyServerProtocol, type LangGraphReviewDecision } from '../protocols/SmartyServerProtocol';
import type { ProtocolEvent, ProtocolSession } from '../protocols/ProtocolInterface';
import { ToolPermissionService, type RejectedPermissionRequest } from '../permissions/ToolPermissionService';
import { SmartyServerFileChangeTracker } from './SmartyServerFileChangeTracker';
import { recoverPersistedApprovedFileAction } from './SmartyServerPersistedApprovals';
import { requestSingleLangGraphActionApproval } from './SmartyServerPermissionApprovalRequest';
import { buildSmartyServerSessionOptions } from './SmartyServerSessionOptions';
import {
  buildTranscriptChunksForEvent,
  processSmartyServerTranscriptMessages,
  storeSmartyServerRawEvent,
} from './SmartyServerTranscriptBridge';
import type {
  PermissionDecision,
  PermissionPatternChecker,
  PermissionPatternSaver,
  SecurityLogger,
  TrustChecker,
} from './ProviderPermissionMixin';
import {
  isApprovalGatedSmartyTool,
  isFailedValidationToolResult,
  shouldContinueAfterApprovedInterruptResume,
  shouldContinueAfterStalledApprovalGatedTask,
} from './SmartyServerContinuationPolicy';
import {
  buildApprovedFileActionToolEvents,
  extractLangGraphActionRequests,
  isSmartyFileWriteTool,
  type ApprovedLangGraphFileAction,
  type LangGraphActionRequest,
  type LangGraphApprovalResult,
  type PendingInterruptedApproval,
} from './SmartyServerLangGraphApprovals';
import {
  createAbortIndependentSession,
  getInterruptedApprovalsForRequests,
  getRejectedPermissionRequestId,
  getRejectedPermissionSessionId,
  isLocalCancellationMessage,
} from './SmartyServerProviderSession';

interface SmartyServerProviderDeps {
  protocol?: SmartyServerProtocol;
  permissionService?: ToolPermissionService;
}

interface ResumeInterruptedPermissionOptions {
  workspacePath: string;
  permissionsPath?: string;
}

const MAX_APPROVED_INTERRUPT_CONTINUATIONS = 4;
const APPROVED_INTERRUPT_CONTINUATION_PROMPT = [
  'Continue the approved Smarty Code task from the completed tool results.',
  'Do not repeat tools that already succeeded.',
  'If the approved tool or resumed turn was only inspection/progress, advance to the next required approval-gated action now.',
  'For TDD or validation work, trigger the focused failing test, source/test edit, or validation command rather than stopping after read-only context.',
  'Keep working until the original user request is complete or genuinely blocked.',
].join(' ');
const MAX_STALLED_ACTION_CONTINUATIONS = 2;
const STALLED_ACTION_CONTINUATION_PROMPT = [
  'Your previous turn ended after read-only/progress work without triggering the Smarty Code permission UI.',
  'The user asked for approval-gated coding work, so continue now by making the next required approval-gated tool call.',
  'Prefer execute for the focused failing test or validation command when the task asks for TDD/validation; otherwise call write_file or edit_file for the next required source/test edit.',
  'Do not repeat completed read-only inspection, do not ask for approval in natural language, and do not stop until the permission UI is triggered or the task is genuinely impossible.',
].join(' ');

export class SmartyServerProvider extends BaseAgentProvider {
  static readonly DEFAULT_MODEL = DEFAULT_MODELS['smarty-server'];

  private readonly protocol: SmartyServerProtocol;
  private readonly permissionService: ToolPermissionService;
  private readonly fileChangeTracker = new SmartyServerFileChangeTracker();
  private readonly persistedPermissionResultIds = new Set<string>();
  private readonly pendingInterruptedApprovals = new Map<string, PendingInterruptedApproval>();
  private activeProtocolSession: ProtocolSession | null = null;
  private activeSessionId: string | undefined;

  constructor(deps?: SmartyServerProviderDeps) {
    super();
    this.protocol = deps?.protocol ?? new SmartyServerProtocol();
    this.permissionService = deps?.permissionService ?? new ToolPermissionService({
      trustChecker: SmartyServerProvider.trustChecker ?? (() => ({ trusted: true, mode: 'ask' })),
      patternSaver: SmartyServerProvider.permissionPatternSaver ?? (async () => {}),
      patternChecker: SmartyServerProvider.permissionPatternChecker ?? (async () => false),
      securityLogger: SmartyServerProvider.securityLogger ?? undefined,
      emit: this.emit.bind(this),
    });
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
  }

  getProviderName(): string {
    return 'smarty-server';
  }

  static setTrustChecker(checker: TrustChecker | null): void {
    BaseAgentProvider.setTrustChecker(checker);
  }

  static setPermissionPatternSaver(saver: PermissionPatternSaver | null): void {
    BaseAgentProvider.setPermissionPatternSaver(saver);
  }

  static setPermissionPatternChecker(checker: PermissionPatternChecker | null): void {
    BaseAgentProvider.setPermissionPatternChecker(checker);
  }

  static setSecurityLogger(logger: SecurityLogger | null): void {
    BaseAgentProvider.setSecurityLogger(logger);
  }

  getDisplayName(): string {
    return 'Smarty Server';
  }

  getDescription(): string {
    return 'Local-first LangGraph/DeepAgents coding agent runtime';
  }

  getProviderSessionData(sessionId: string): any {
    const { providerSessionId } = this.sessions.getProviderSessionData(sessionId);
    return {
      providerSessionId,
      langGraphThreadId: providerSessionId,
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      mcpSupport: true,
      edits: true,
      resumeSession: true,
      supportsFileTools: true,
    };
  }

  static async getModels(): Promise<AIModel[]> {
    return [{
      id: SmartyServerProvider.DEFAULT_MODEL,
      name: 'Smarty Coding Agent',
      provider: 'smarty-server' as AIProviderType,
    }];
  }

  static getDefaultModel(): string {
    return SmartyServerProvider.DEFAULT_MODEL;
  }

  async *sendMessage(
    message: string,
    documentContext?: DocumentContext,
    sessionId?: string,
    _messages?: any[],
    workspacePath?: string,
    attachments?: ChatAttachment[],
  ): AsyncIterableIterator<StreamChunk> {
    if (!workspacePath) {
      yield { type: 'error', error: '[SmartyServerProvider] workspacePath is required but was not provided' };
      return;
    }

    const { userMessageAddition, messageWithContext } = buildUserMessageAddition(message, documentContext);
    const permissionsPath = documentContext?.permissionsPath || workspacePath;

    if (sessionId && userMessageAddition) {
      this.emit('promptAdditions', {
        sessionId,
        systemPromptAddition: null,
        userMessageAddition,
        attachments: [],
        timestamp: Date.now(),
      });
    }

    if (sessionId) {
      await this.logAgentMessageBestEffort(sessionId, 'input', messageWithContext, {
        metadata: {
          mode: documentContext?.mode ?? 'agent',
          attachments,
        },
      });
    }

    const abortController = new AbortController();
    this.abortController = abortController;

    const existingThreadId = this.sessions.getSessionId(sessionId || '');
    const sessionOptions = buildSmartyServerSessionOptions(this.config, workspacePath, abortController.signal);

    let protocolSession: ProtocolSession | null = null;

    try {
      protocolSession = existingThreadId
        ? await this.protocol.resumeSession(existingThreadId, sessionOptions)
        : await this.protocol.createSession(sessionOptions);
      this.activeProtocolSession = protocolSession;
      this.activeSessionId = sessionId;

      if (sessionId && protocolSession.id) {
        this.sessions.captureSessionId(sessionId, protocolSession.id);
      }

      const transcriptAdapter = new AgentProtocolTranscriptAdapter(null, sessionId ?? '');
      transcriptAdapter.userMessage(
        messageWithContext,
        documentContext?.mode === 'planning' ? 'planning' : 'agent',
        attachments as any,
      );

      let eventStream: AsyncIterable<ProtocolEvent> = this.protocol.sendMessage(protocolSession, {
        content: messageWithContext,
        attachments,
        sessionId,
        mode: documentContext?.mode ?? 'agent',
      });

      let stalledActionContinuationCount = 0;
      let handledAnyInterrupt = false;
      for (;;) {
        let interrupted = false;
        let sawToolActivity = false;
        let sawApprovalGatedToolActivity = false;
        let assistantText = '';
        let pendingComplete: ProtocolEvent | null = null;
        for await (const event of eventStream) {
          if (abortController.signal.aborted) {
            throw new Error('Operation cancelled');
          }

          if (sessionId && event.type === 'raw_event') {
            await storeSmartyServerRawEvent(
              sessionId,
              event,
              this.logAgentMessageBestEffort.bind(this),
              this.getProviderName(),
            );
          }

          if (event.type === 'interrupt') {
            handledAnyInterrupt = true;
            if (!sessionId) {
              yield { type: 'error', error: 'Smarty Server interrupt requires a Nimbalyst session ID' };
              return;
            }
            const approval = await this.requestLangGraphInterruptApproval(
              protocolSession,
              sessionId,
              workspacePath,
              permissionsPath,
              event,
              abortController.signal,
            );
            for (const approvedEvent of buildApprovedFileActionToolEvents(approval.approvedFileActions)) {
              const fileChangeChunks = await this.fileChangeTracker.buildChunksForEvent(
                approvedEvent,
                sessionId,
                workspacePath,
              );
              if (fileChangeChunks.handled) {
                for (const chunk of fileChangeChunks.chunks) {
                  yield chunk;
                }
              }
            }
            eventStream = this.resumeInterruptedSessionWithContinuation(protocolSession, approval.decisions, sessionId);
            interrupted = true;
            break;
          }

          if (event.type === 'complete') {
            pendingComplete = event;
            continue;
          }

          if (event.type === 'tool_call' || event.type === 'tool_result') {
            sawToolActivity = true;
            const toolName = event.type === 'tool_call'
              ? event.toolCall?.name
              : event.toolResult?.name;
            if (isApprovalGatedSmartyTool(toolName)) {
              sawApprovalGatedToolActivity = true;
            }
          }
          if (event.type === 'text' && event.content) {
            assistantText += event.content;
          }

          const fileChangeChunks = await this.fileChangeTracker.buildChunksForEvent(
            event,
            sessionId,
            workspacePath,
          );
          if (fileChangeChunks.handled) {
            for (const chunk of fileChangeChunks.chunks) {
              yield chunk;
            }
            continue;
          }

          for (const chunk of buildTranscriptChunksForEvent(event, transcriptAdapter)) {
            yield chunk;
          }
        }
        if (interrupted) continue;

        const shouldContinueStalledAction = stalledActionContinuationCount < MAX_STALLED_ACTION_CONTINUATIONS
          && !handledAnyInterrupt
          && shouldContinueAfterStalledApprovalGatedTask(messageWithContext, assistantText, {
            sawToolActivity,
            sawApprovalGatedToolActivity,
          });
        if (shouldContinueStalledAction) {
          stalledActionContinuationCount += 1;
          eventStream = this.protocol.sendMessage(protocolSession, {
            content: STALLED_ACTION_CONTINUATION_PROMPT,
            sessionId,
            mode: documentContext?.mode ?? 'agent',
          });
          continue;
        }

        for (const chunk of await this.fileChangeTracker.flushSyntheticApprovedFileChangeChunks(sessionId)) {
          yield chunk;
        }

        if (pendingComplete) {
          yield {
            type: 'complete',
            content: pendingComplete.content,
            isComplete: true,
            usage: pendingComplete.usage,
            ...(pendingComplete.contextFillTokens !== undefined
              ? { contextFillTokens: pendingComplete.contextFillTokens }
              : {}),
            ...(pendingComplete.contextWindow !== undefined
              ? { contextWindow: pendingComplete.contextWindow }
              : {}),
          };
        }
        break;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAbort = abortController.signal.aborted || isLocalCancellationMessage(errorMessage);
      if (!isAbort) {
        yield { type: 'error', error: errorMessage };
      }
    } finally {
      if (protocolSession && this.activeProtocolSession?.id === protocolSession.id) {
        this.activeProtocolSession = null;
        this.activeSessionId = undefined;
      }
      if (this.abortController === abortController) {
        this.abortController = null;
      }
      if (sessionId) {
        this.fileChangeTracker.clearSession(sessionId);
      }
    }
  }

  override async resolveToolPermission(
    requestId: string,
    response: PermissionDecision,
    sessionId?: string,
    respondedBy: 'desktop' | 'mobile' = 'desktop',
    resumeOptions?: ResumeInterruptedPermissionOptions,
  ): Promise<StreamChunk[]> {
    const pendingInterruptedApproval = this.pendingInterruptedApprovals.get(requestId);
    const resolvedLivePermission = this.permissionService.resolvePermission(requestId, response);
    if (sessionId) {
      this.persistedPermissionResultIds.add(requestId);
      await this.logAgentMessageBestEffort(
        sessionId,
        'output',
        this.createPermissionResultMessage(requestId, response, respondedBy),
      );
      await processSmartyServerTranscriptMessages(sessionId, this.getProviderName());
    }

    if (
      resolvedLivePermission &&
      response.decision === 'allow' &&
      sessionId &&
      resumeOptions?.workspacePath &&
      pendingInterruptedApproval?.fileAction
    ) {
      const resumeChunks: StreamChunk[] = [];
      for (const approvedEvent of buildApprovedFileActionToolEvents([pendingInterruptedApproval.fileAction])) {
        const fileChangeChunks = await this.fileChangeTracker.buildChunksForEvent(
          approvedEvent,
          sessionId,
          resumeOptions.workspacePath,
        );
        if (fileChangeChunks.handled) {
          resumeChunks.push(...fileChangeChunks.chunks);
        }
      }
      return resumeChunks;
    }

    if (!resolvedLivePermission && sessionId && resumeOptions?.workspacePath) {
      return this.resumeInterruptedPermission({
        requestId,
        response,
        sessionId,
        respondedBy,
        workspacePath: resumeOptions.workspacePath,
        permissionsPath: resumeOptions.permissionsPath,
      });
    }
    return [];
  }

  override rejectToolPermission(requestId: string, error: Error, sessionId?: string): void {
    this.permissionService.rejectPermission(requestId, error);
    if (sessionId) {
      void this.persistPermissionCancellationOnce(sessionId, requestId)
        .then(() => processSmartyServerTranscriptMessages(sessionId, this.getProviderName()));
    }
  }

  override abort(): void {
    const rejectedRequests = this.permissionService.rejectAllPending(new Error('Request aborted'));
    this.persistPermissionCancellations(this.activeSessionId, rejectedRequests);
    const rejectedInterruptedApprovals = getInterruptedApprovalsForRequests(
      rejectedRequests,
      this.pendingInterruptedApprovals,
    );
    void this.rejectInterruptedApprovals(rejectedInterruptedApprovals);
    if (this.activeProtocolSession && rejectedInterruptedApprovals.length === 0) {
      this.protocol.abortSession(this.activeProtocolSession);
    }
    super.abort();
  }

  override async interruptCurrentTurn(): Promise<{ method: 'interrupt' | 'abort' }> {
    const activeProtocolSession = this.activeProtocolSession;
    const rejectedRequests = this.permissionService.rejectAllPending(new Error('Request interrupted'));
    this.persistPermissionCancellations(this.activeSessionId, rejectedRequests);

    let method: 'interrupt' | 'abort' = 'abort';
    const rejectedInterruptedApprovals = getInterruptedApprovalsForRequests(
      rejectedRequests,
      this.pendingInterruptedApprovals,
    );
    if (rejectedInterruptedApprovals.length > 0) {
      await this.rejectInterruptedApprovals(rejectedInterruptedApprovals);
      method = 'interrupt';
    } else if (activeProtocolSession) {
      try {
        const result = await this.protocol.cancelSessionRuns(activeProtocolSession, {
          wait: false,
          action: 'interrupt',
        });
        method = result.requested ? 'interrupt' : 'abort';
      } catch {
        method = 'abort';
      }
    }

    super.abort();
    return { method };
  }

  async interruptSession(
    sessionId: string,
    options: { workspacePath: string },
  ): Promise<{ method: 'interrupt' | 'abort' }> {
    const threadId = this.sessions.getSessionId(sessionId);
    if (!threadId) {
      return this.interruptCurrentTurn();
    }

    try {
      const protocolSession = await this.protocol.resumeSession(
        threadId,
        buildSmartyServerSessionOptions(this.config, options.workspacePath, undefined),
      );
      const result = await this.protocol.cancelSessionRuns(protocolSession, {
        wait: false,
        action: 'interrupt',
      });
      super.abort();
      return { method: result.requested ? 'interrupt' : 'abort' };
    } catch {
      super.abort();
      return { method: 'abort' };
    }
  }

  override destroy(): void {
    this.abortForLifecycleDestroy();
    this.permissionService.clearSessionCache();
    this.destroyProviderState();
  }

  private abortForLifecycleDestroy(): void {
    this.permissionService.rejectAllPending(new Error('Request aborted'));
    this.pendingInterruptedApprovals.clear();
    this.fileChangeTracker.clearAll();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.permissions.rejectAllPendingPermissions();
    this.activeProtocolSession = null;
    this.activeSessionId = undefined;
  }

  async resumeInterruptedPermission(options: {
    requestId: string;
    response: PermissionDecision;
    sessionId: string;
    respondedBy?: 'desktop' | 'mobile';
    workspacePath: string;
    permissionsPath?: string;
  }): Promise<StreamChunk[]> {
    const threadId = this.sessions.getSessionId(options.sessionId);
    if (!threadId) {
      throw new Error('Cannot resume Smarty Server approval without a persisted LangGraph thread ID');
    }

    const protocolSession = await this.protocol.resumeSession(
      threadId,
      buildSmartyServerSessionOptions(this.config, options.workspacePath, undefined),
    );
    if (protocolSession.id) {
      this.sessions.captureSessionId(options.sessionId, protocolSession.id);
    }

    const decisions: LangGraphReviewDecision[] = [{
      type: options.response.decision === 'allow' ? 'approve' : 'reject',
    }];
    const transcriptAdapter = new AgentProtocolTranscriptAdapter(null, options.sessionId);
    const resumeChunks: StreamChunk[] = [];
    const abortController = new AbortController();
    this.abortController = abortController;

    try {
      const persistedApprovedFileAction = options.response.decision === 'allow'
        ? await recoverPersistedApprovedFileAction(options.sessionId, options.requestId)
        : null;
      if (persistedApprovedFileAction) {
        for (const approvedEvent of buildApprovedFileActionToolEvents([persistedApprovedFileAction])) {
          const fileChangeChunks = await this.fileChangeTracker.buildChunksForEvent(
            approvedEvent,
            options.sessionId,
            options.workspacePath,
          );
          if (fileChangeChunks.handled) {
            resumeChunks.push(...fileChangeChunks.chunks);
          }
        }
      }

      for await (const event of this.resumeInterruptedPermissionEvents(
        protocolSession,
        decisions,
        options.sessionId,
        options.workspacePath,
        options.permissionsPath || options.workspacePath,
        abortController.signal,
      )) {
        if (event.type === 'raw_event') {
          await storeSmartyServerRawEvent(
            options.sessionId,
            event,
            this.logAgentMessageBestEffort.bind(this),
            this.getProviderName(),
          );
        }
        const fileChangeChunks = await this.fileChangeTracker.buildChunksForEvent(
          event,
          options.sessionId,
          options.workspacePath,
        );
        if (fileChangeChunks.handled) {
          resumeChunks.push(...fileChangeChunks.chunks);
          continue;
        }
        resumeChunks.push(...buildTranscriptChunksForEvent(event, transcriptAdapter));
      }
      resumeChunks.push(...await this.fileChangeTracker.flushSyntheticApprovedFileChangeChunks(options.sessionId));
      return resumeChunks;
    } catch (error) {
      await this.logAgentMessageBestEffort(
        options.sessionId,
        'output',
        JSON.stringify({
          event: 'error',
          data: {
            message: error instanceof Error ? error.message : String(error),
          },
        }),
        {
          metadata: {
            eventType: 'error',
            smartyServerProvider: true,
          },
        },
      );
      await processSmartyServerTranscriptMessages(options.sessionId, this.getProviderName());
      throw error;
    } finally {
      if (this.abortController === abortController) {
        this.abortController = null;
      }
      this.fileChangeTracker.clearSession(options.sessionId);
    }
  }

  private async *resumeInterruptedSessionWithContinuation(
    protocolSession: ProtocolSession,
    decisions: LangGraphReviewDecision[],
    sessionId: string,
  ): AsyncIterable<ProtocolEvent> {
    const canAutoContinue = decisions.every((decision) => decision.type === 'approve');
    let continuationCount = 0;
    let stream = this.protocol.resumeInterruptedSession(protocolSession, decisions, { sessionId });
    let lastPendingComplete: ProtocolEvent | null = null;

    for (;;) {
      let sawToolActivity = false;
      let sawApprovalGatedToolActivity = false;
      let sawFailedValidationToolResult = false;
      let sawAssistantText = false;
      let assistantText = '';
      let sawInterrupt = false;
      let pendingComplete: ProtocolEvent | null = null;
      const toolCallsById = new Map<string, { name: string | undefined; arguments: Record<string, unknown> | undefined }>();

      for await (const event of stream) {
        if (event.type === 'complete') {
          pendingComplete = event;
          continue;
        }
        if (event.type === 'tool_call' || event.type === 'tool_result') {
          sawToolActivity = true;
          const toolName = event.type === 'tool_call'
            ? event.toolCall?.name
            : event.toolResult?.name;
          if (isApprovalGatedSmartyTool(toolName)) {
            sawApprovalGatedToolActivity = true;
          }
          if (event.type === 'tool_call') {
            const id = event.toolCall?.id;
            if (id) {
              toolCallsById.set(id, {
                name: event.toolCall?.name,
                arguments: event.toolCall?.arguments,
              });
            }
          } else if (event.type === 'tool_result') {
            const relatedToolCall = event.toolResult?.id ? toolCallsById.get(event.toolResult.id) : undefined;
            if (isFailedValidationToolResult(
              event.toolResult?.name,
              event.toolResult?.result,
              relatedToolCall?.arguments,
            )) {
              sawFailedValidationToolResult = true;
            }
          }
        }
        if (event.type === 'text' && (event.content ?? '').trim()) {
          sawAssistantText = true;
          assistantText += event.content;
        }
        if (event.type === 'interrupt') {
          sawInterrupt = true;
        }
        yield event;
        if (sawInterrupt) {
          return;
        }
      }

      const shouldContinueApprovedResume = canAutoContinue
        && continuationCount < MAX_APPROVED_INTERRUPT_CONTINUATIONS;
      if (!shouldContinueApprovedResume || !shouldContinueAfterApprovedInterruptResume(assistantText, {
        sawToolActivity,
        sawApprovalGatedToolActivity,
        sawFailedValidationToolResult,
        sawAssistantText,
      })) {
        const completionEvent = pendingComplete ?? lastPendingComplete;
        if (completionEvent) {
          yield completionEvent;
        }
        return;
      }

      lastPendingComplete = pendingComplete ?? lastPendingComplete;
      continuationCount += 1;
      stream = this.protocol.sendMessage(protocolSession, {
        content: APPROVED_INTERRUPT_CONTINUATION_PROMPT,
        sessionId,
        mode: 'agent',
      });
    }
  }

  private async *resumeInterruptedPermissionEvents(
    protocolSession: ProtocolSession,
    decisions: LangGraphReviewDecision[],
    sessionId: string,
    workspacePath: string,
    permissionsPath: string,
    signal: AbortSignal,
  ): AsyncIterable<ProtocolEvent> {
    let stream = this.resumeInterruptedSessionWithContinuation(protocolSession, decisions, sessionId);

    for (;;) {
      let interrupted = false;
      for await (const event of stream) {
        if (signal.aborted) {
          throw new Error('Operation cancelled');
        }
        if (event.type === 'interrupt') {
          const approval = await this.requestLangGraphInterruptApproval(
            protocolSession,
            sessionId,
            workspacePath,
            permissionsPath,
            event,
            signal,
          );
          for (const approvedEvent of buildApprovedFileActionToolEvents(approval.approvedFileActions)) {
            yield approvedEvent;
          }
          stream = this.resumeInterruptedSessionWithContinuation(protocolSession, approval.decisions, sessionId);
          interrupted = true;
          break;
        }
        yield event;
      }
      if (!interrupted) return;
    }
  }

  private async requestLangGraphInterruptApproval(
    protocolSession: ProtocolSession,
    sessionId: string,
    workspacePath: string,
    permissionsPath: string,
    event: ProtocolEvent,
    signal: AbortSignal,
  ): Promise<LangGraphApprovalResult> {
    const interruptValue = event.interrupt?.value;
    const actions = extractLangGraphActionRequests(interruptValue);
    if (actions.length === 0) {
      throw new Error('Smarty Server interrupt did not include action requests');
    }

    const decisions: LangGraphReviewDecision[] = [];
    const approvedFileActions: ApprovedLangGraphFileAction[] = [];
    for (const [index, action] of actions.entries()) {
      const requestId = `langgraph-${event.interrupt?.id ?? Date.now()}-${index}`;
      const response = await requestSingleLangGraphActionApproval({
        sessionId,
        workspacePath,
        permissionsPath,
        requestId,
        action,
        signal,
        protocolSession,
        permissionService: this.permissionService,
        pendingInterruptedApprovals: this.pendingInterruptedApprovals,
        logAgentMessage: this.logAgentMessageBestEffort.bind(this),
        providerName: this.getProviderName(),
      });
      await this.persistPermissionResultOnce(sessionId, requestId, response);
      await processSmartyServerTranscriptMessages(sessionId, this.getProviderName());
      const reviewDecision = response.decision === 'allow' ? 'approve' : 'reject';
      if (!action.allowedDecisions.includes(reviewDecision)) {
        throw new Error(
          `Smarty Server interrupt does not allow ${reviewDecision} for ${action.name}. Allowed: ${action.allowedDecisions.join(', ')}`,
        );
      }
      decisions.push({ type: reviewDecision });
      if (reviewDecision === 'approve' && isSmartyFileWriteTool(action.name)) {
        approvedFileActions.push({ requestId, action });
      }
    }
    return { decisions, approvedFileActions };
  }

  private async persistPermissionResultOnce(
    sessionId: string,
    requestId: string,
    response: PermissionDecision,
  ): Promise<void> {
    if (this.persistedPermissionResultIds.has(requestId)) return;
    this.persistedPermissionResultIds.add(requestId);
    await this.logAgentMessageBestEffort(
      sessionId,
      'output',
      this.createPermissionResultMessage(requestId, response, 'desktop'),
    );
  }

  private persistPermissionCancellations(
    defaultSessionId: string | undefined,
    requests: RejectedPermissionRequest[],
  ): void {
    if (requests.length === 0) return;
    const bySession = new Map<string, string[]>();
    for (const request of requests) {
      const requestId = getRejectedPermissionRequestId(request);
      if (!requestId) continue;
      const sessionId = defaultSessionId || getRejectedPermissionSessionId(request);
      if (!sessionId) continue;
      bySession.set(sessionId, [...(bySession.get(sessionId) ?? []), requestId]);
    }
    for (const [sessionId, requestIds] of bySession) {
      void (async () => {
        for (const requestId of requestIds) {
          await this.persistPermissionCancellationOnce(sessionId, requestId);
        }
        await processSmartyServerTranscriptMessages(sessionId, this.getProviderName());
      })();
    }
  }

  private async persistPermissionCancellationOnce(
    sessionId: string,
    requestId: string,
  ): Promise<void> {
    if (this.persistedPermissionResultIds.has(requestId)) return;
    this.persistedPermissionResultIds.add(requestId);
    await this.logAgentMessageBestEffort(
      sessionId,
      'output',
      this.createPermissionCancellationMessage(requestId),
    );
  }

  private async rejectInterruptedApprovals(
    approvals: PendingInterruptedApproval[],
  ): Promise<void> {
    for (const approval of approvals) {
      const resumeSession = createAbortIndependentSession(approval.protocolSession);
      try {
        for await (const event of this.protocol.resumeInterruptedSession(
          resumeSession,
          [{ type: 'reject' }],
          { sessionId: approval.sessionId },
        )) {
          if (event.type === 'raw_event') {
            await storeSmartyServerRawEvent(
              approval.sessionId,
              event,
              this.logAgentMessageBestEffort.bind(this),
              this.getProviderName(),
            );
          }
        }
        await processSmartyServerTranscriptMessages(approval.sessionId, this.getProviderName());
      } catch (error) {
        await this.logAgentMessageBestEffort(
          approval.sessionId,
          'output',
          JSON.stringify({
            event: 'error',
            data: {
              message: error instanceof Error ? error.message : String(error),
            },
          }),
          {
            metadata: {
              eventType: 'error',
              smartyServerProvider: true,
              langGraphInterruptedApprovalReject: true,
            },
          },
        );
        await processSmartyServerTranscriptMessages(approval.sessionId, this.getProviderName());
      }
    }
  }

}
