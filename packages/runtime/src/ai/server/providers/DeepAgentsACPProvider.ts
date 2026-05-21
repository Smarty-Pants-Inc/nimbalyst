/**
 * DeepAgentsACPProvider
 *
 * DeepAgents agent provider that uses ACP (Agent Client Protocol) over stdio.
 * ACP exposes native pre/post file-edit hooks, so this provider can:
 *   - capture pre-edit baselines for accurate diff rendering
 *   - attribute edits to the producing session deterministically
 *   - emit exact unified diffs in the live transcript
 *
 * See wrapper orientation: docs/deepagents-acp.md
 */

import path from 'path';
import { BaseAgentProvider } from './BaseAgentProvider';
import { buildUserMessageAddition } from './documentContextUtils';
import { buildClaudeCodeSystemPrompt, buildMetaAgentSystemPrompt } from '../../prompt';
import { DEFAULT_MODELS } from '../../modelConstants';
import { AIToolCall, AIToolResult } from '../../types';
import {
  ProviderConfig,
  DocumentContext,
  StreamChunk,
  ProviderCapabilities,
  AIModel,
  AIProviderType,
  ModelIdentifier,
  ChatAttachment,
} from '../types';
import { DeepAgentsACPProtocol, type ACPToolPermissionRequest } from '../protocols/DeepAgentsACPProtocol';
import { ProtocolEvent, ProtocolSession } from '../protocols/ProtocolInterface';
import { ToolPermissionService } from '../permissions/ToolPermissionService';
import { PermissionMode, TrustChecker, PermissionPatternSaver, PermissionPatternChecker, SecurityLogger } from './ProviderPermissionMixin';
import { McpConfigService } from '../services/McpConfigService';
import { MCPServerConfig } from '../../../types/MCPServerConfig';
import { safeJSONSerialize } from '../../../utils/serialization';
import { AgentProtocolTranscriptAdapter } from './agentProtocol/AgentProtocolTranscriptAdapter';
import { TranscriptMigrationRepository } from '../../../storage/repositories/TranscriptMigrationRepository';

interface DeepAgentsACPProviderDeps {
  protocol?: DeepAgentsACPProtocol;
  permissionService?: ToolPermissionService;
}

export class DeepAgentsACPProvider extends BaseAgentProvider {
  static readonly DEFAULT_MODEL = DEFAULT_MODELS['deepagents-acp'];
  private static readonly FALLBACK_MODELS: ReadonlyArray<{
    id: string;
    name: string;
    contextWindow: number;
    maxTokens: number;
  }> = [
    { id: 'openai/gpt-5.5', name: 'GPT-5.5', contextWindow: 400000, maxTokens: 128000 },
    { id: 'openai/gpt-5.4', name: 'GPT-5.4', contextWindow: 400000, maxTokens: 128000 },
    { id: 'openai/gpt-5.2', name: 'GPT-5.2', contextWindow: 128000, maxTokens: 128000 },
    { id: 'openai/claude-opus-4-7', name: 'Claude Opus 4.7', contextWindow: 1000000, maxTokens: 8192 },
    { id: 'openai/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 200000, maxTokens: 8192 },
  ];

  private readonly protocol: DeepAgentsACPProtocol;
  private readonly permissionService: ToolPermissionService;
  private readonly mcpConfigService: McpConfigService;

  private _initData: {
    model: string;
    mcpServerCount: number;
    isResumedSession: boolean;
    permissionMode: string | null;
  } | null = null;

  // Static MCP/env injection points (mirror DeepAgentsProvider so the
  // electron main process can wire both providers from a single setup path).
  private static mcpServerPort: number | null = null;
  private static sessionNamingServerPort: number | null = null;
  private static extensionDevServerPort: number | null = null;
  private static superLoopProgressServerPort: number | null = null;
  private static sessionContextServerPort: number | null = null;
  private static metaAgentServerPort: number | null = null;
  private static settingsServerPort: number | null = null;
  private static settingsAgentToolsDisabledLoader: (() => boolean) | null = null;
  // Per-launch bearer token for the internal Nimbalyst MCP HTTP servers (Issue #146)
  private static mcpAuthToken: string | null = null;
  private static mcpConfigLoader: ((workspacePath?: string) => Promise<Record<string, MCPServerConfig>>) | null = null;
  private static claudeSettingsEnvLoader: (() => Promise<Record<string, string>>) | null = null;
  private static shellEnvironmentLoader: (() => Record<string, string> | null) | null = null;
  private static enhancedPathLoader: (() => string) | null = null;

  // Optional callbacks routed into the protocol for pre/post-edit hooks.
  // The Electron main process (MessageStreamingHandler) sets these so the
  // protocol can capture pre-edit local-history baselines via HistoryManager
  // and create turn-end snapshots.
  private static onBeforeFileWrite: ((filePath: string, sessionId: string | undefined) => Promise<void>) | null = null;
  private static onTurnFilesEdited: ((filePaths: Set<string>, sessionId: string | undefined) => Promise<void>) | null = null;

  constructor(config?: { apiKey?: string; baseUrl?: string }, deps?: DeepAgentsACPProviderDeps) {
    super();
    const apiKey = config?.apiKey || '';

    if (deps?.permissionService) {
      this.permissionService = deps.permissionService;
    } else {
      if (!BaseAgentProvider.trustChecker) {
        throw new Error('[DeepAgentsACPProvider] trustChecker must be set via setTrustChecker() before creating provider instances');
      }
      if (!BaseAgentProvider.permissionPatternSaver) {
        throw new Error('[DeepAgentsACPProvider] permissionPatternSaver must be set via setPermissionPatternSaver() before creating provider instances');
      }
      if (!BaseAgentProvider.permissionPatternChecker) {
        throw new Error('[DeepAgentsACPProvider] permissionPatternChecker must be set via setPermissionPatternChecker() before creating provider instances');
      }
      this.permissionService = new ToolPermissionService({
        trustChecker: BaseAgentProvider.trustChecker as TrustChecker,
        patternSaver: BaseAgentProvider.permissionPatternSaver as PermissionPatternSaver,
        patternChecker: BaseAgentProvider.permissionPatternChecker as PermissionPatternChecker,
        securityLogger: BaseAgentProvider.securityLogger ?? undefined,
        emit: this.emit.bind(this),
      });
    }

    if (deps?.protocol) {
      this.protocol = deps.protocol;
    } else {
      this.protocol = new DeepAgentsACPProtocol(apiKey, {
        baseUrl: config?.baseUrl,
        onBeforeFileWrite: DeepAgentsACPProvider.onBeforeFileWrite ?? undefined,
        onTurnFilesEdited: DeepAgentsACPProvider.onTurnFilesEdited ?? undefined,
        onPermissionRequest: (request) => this.requestACPToolPermission(request),
      });
    }

    this.mcpConfigService = new McpConfigService({
      mcpServerPort: DeepAgentsACPProvider.mcpServerPort,
      sessionNamingServerPort: DeepAgentsACPProvider.sessionNamingServerPort,
      extensionDevServerPort: DeepAgentsACPProvider.extensionDevServerPort,
      superLoopProgressServerPort: null,
      sessionContextServerPort: DeepAgentsACPProvider.sessionContextServerPort,
      metaAgentServerPort: DeepAgentsACPProvider.metaAgentServerPort,
      settingsServerPort: DeepAgentsACPProvider.settingsServerPort,
      settingsAgentToolsDisabledLoader: DeepAgentsACPProvider.settingsAgentToolsDisabledLoader,
      mcpAuthToken: DeepAgentsACPProvider.mcpAuthToken,
      mcpConfigLoader: DeepAgentsACPProvider.mcpConfigLoader,
      extensionPluginsLoader: null,
      claudeSettingsEnvLoader: DeepAgentsACPProvider.claudeSettingsEnvLoader,
      shellEnvironmentLoader: DeepAgentsACPProvider.shellEnvironmentLoader,
    });
  }

  getProviderName(): string {
    return 'deepagents-acp';
  }

  getName(): string {
    return 'deepagents-acp';
  }

  getDisplayName(): string {
    return 'DeepAgents';
  }

  getDescription(): string {
    return 'DeepAgents agent over the Agent Client Protocol with native file-edit hooks';
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

  getProviderSessionData(sessionId: string): any {
    const { providerSessionId } = this.sessions.getProviderSessionData(sessionId);
    return {
      providerSessionId,
      deepagentsAcpSessionId: providerSessionId,
    };
  }

  getInitData(): typeof this._initData {
    return this._initData;
  }

  // ---- Static injection setters --------------------------------------------

  public static setTrustChecker(checker: TrustChecker | null): void {
    BaseAgentProvider.setTrustChecker(checker);
  }
  public static setPermissionPatternSaver(saver: PermissionPatternSaver | null): void {
    BaseAgentProvider.setPermissionPatternSaver(saver);
  }
  public static setPermissionPatternChecker(checker: PermissionPatternChecker | null): void {
    BaseAgentProvider.setPermissionPatternChecker(checker);
  }
  public static setSecurityLogger(logger: SecurityLogger | null): void {
    BaseAgentProvider.setSecurityLogger(logger);
  }
  public static setMcpServerPort(port: number | null): void {
    DeepAgentsACPProvider.mcpServerPort = port;
  }
  public static setSessionNamingServerPort(port: number | null): void {
    DeepAgentsACPProvider.sessionNamingServerPort = port;
  }
  public static setExtensionDevServerPort(port: number | null): void {
    DeepAgentsACPProvider.extensionDevServerPort = port;
  }
  public static setSuperLoopProgressServerPort(port: number | null): void {
    DeepAgentsACPProvider.superLoopProgressServerPort = port;
  }
  public static setSessionContextServerPort(port: number | null): void {
    DeepAgentsACPProvider.sessionContextServerPort = port;
  }
  public static setMetaAgentServerPort(port: number | null): void {
    DeepAgentsACPProvider.metaAgentServerPort = port;
  }
  public static setSettingsServerPort(port: number | null): void {
    DeepAgentsACPProvider.settingsServerPort = port;
  }
  public static setSettingsAgentToolsDisabledLoader(loader: (() => boolean) | null): void {
    DeepAgentsACPProvider.settingsAgentToolsDisabledLoader = loader;
  }
  public static setMcpAuthToken(token: string | null): void {
    DeepAgentsACPProvider.mcpAuthToken = token;
  }
  public static setMCPConfigLoader(loader: ((workspacePath?: string) => Promise<Record<string, MCPServerConfig>>) | null): void {
    DeepAgentsACPProvider.mcpConfigLoader = loader;
  }
  public static setClaudeSettingsEnvLoader(loader: (() => Promise<Record<string, string>>) | null): void {
    DeepAgentsACPProvider.claudeSettingsEnvLoader = loader;
  }
  public static setShellEnvironmentLoader(loader: (() => Record<string, string> | null) | null): void {
    DeepAgentsACPProvider.shellEnvironmentLoader = loader;
  }
  public static setEnhancedPathLoader(loader: (() => string) | null): void {
    DeepAgentsACPProvider.enhancedPathLoader = loader;
  }
  public static setOnBeforeFileWrite(handler: ((filePath: string, sessionId: string | undefined) => Promise<void>) | null): void {
    DeepAgentsACPProvider.onBeforeFileWrite = handler;
  }
  public static setOnTurnFilesEdited(handler: ((filePaths: Set<string>, sessionId: string | undefined) => Promise<void>) | null): void {
    DeepAgentsACPProvider.onTurnFilesEdited = handler;
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    const apiKey = config.apiKey || '';
    if (typeof (this.protocol as Partial<DeepAgentsACPProtocol>).setApiKey === 'function') {
      this.protocol.setApiKey(apiKey);
    }
    if (typeof (this.protocol as Partial<DeepAgentsACPProtocol>).setBaseUrl === 'function') {
      this.protocol.setBaseUrl(config.baseUrl || '');
    }
  }

  static getDefaultModel(): string {
    return DeepAgentsACPProvider.DEFAULT_MODEL;
  }

  static async getModels(apiKey?: string, baseUrl?: string): Promise<AIModel[]> {
    const discovered = await DeepAgentsACPProvider.getModelsFromOpenAICompatibleEndpoint(apiKey, baseUrl);
    const sourceModels = discovered.length > 0 ? discovered : DeepAgentsACPProvider.FALLBACK_MODELS;
    return sourceModels.map((model) => ({
      id: ModelIdentifier.create('deepagents-acp', model.id).combined,
      name: model.name,
      provider: 'deepagents-acp' as AIProviderType,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    }));
  }

  private static async getModelsFromOpenAICompatibleEndpoint(
    apiKey?: string,
    baseUrl?: string,
  ): Promise<Array<{ id: string; name: string; contextWindow: number; maxTokens: number }>> {
    const endpoint = baseUrl?.trim();
    if (!endpoint) {
      return [];
    }

    try {
      const response = await fetch(`${endpoint.replace(/\/$/, '')}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      });
      if (!response.ok) {
        return [];
      }
      const body = await response.json() as { data?: Array<{ id?: unknown }> };
      const ids = (body.data ?? [])
        .map((entry) => typeof entry.id === 'string' ? entry.id : '')
        .filter(Boolean);
      return ids.map((id) => ({
        id: `openai/${id}`,
        name: DeepAgentsACPProvider.formatModelName(id),
        contextWindow: id.includes('claude-opus-4-7') ? 1000000 : 400000,
        maxTokens: id.includes('claude-') ? 8192 : 128000,
      }));
    } catch {
      return [];
    }
  }

  private static formatModelName(id: string): string {
    if (id.startsWith('gpt-')) {
      return id.toUpperCase().replace(/-/g, ' ');
    }
    if (id.startsWith('claude-')) {
      return id
        .replace(/^claude-/, 'Claude ')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
    return id;
  }

  static getFallbackModelsForTest(): AIModel[] {
    return DeepAgentsACPProvider.FALLBACK_MODELS.map((model) => ({
      id: ModelIdentifier.create('deepagents-acp', model.id).combined,
      name: model.name,
      provider: 'deepagents-acp' as AIProviderType,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    }));
  }

  async handleToolCall(
    toolCall: AIToolCall,
    _options?: { sessionId?: string; workingDirectory?: string }
  ): Promise<AIToolResult> {
    if (!toolCall.name) {
      return { success: false, error: 'Tool name is required' };
    }
    try {
      const result = await this.executeToolCall(toolCall.name, toolCall.arguments ?? {});
      return { success: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      return {
        success: false,
        error: message,
        result: (error as any)?.toolResult,
      };
    }
  }

  async cancelStream(_sessionId?: string): Promise<void> {
    this.abort();
  }

  async *sendMessage(
    message: string,
    documentContext?: DocumentContext,
    sessionId?: string,
    _messages?: any[],
    workspacePath?: string,
    attachments?: ChatAttachment[]
  ): AsyncIterableIterator<StreamChunk> {
    if (!workspacePath) {
      yield { type: 'error', error: '[DeepAgentsACPProvider] workspacePath is required but was not provided' };
      return;
    }

    const agentRole = await this.getAgentRole(sessionId);
    const isMetaAgent = agentRole === 'meta-agent';
    const systemPrompt = this.buildSystemPrompt(documentContext, isMetaAgent);
    const { userMessageAddition, messageWithContext } = buildUserMessageAddition(message, documentContext);
    const unsupportedAttachmentHints = attachments?.filter(
      (attachment) => attachment.type !== 'image' && attachment.type !== 'document'
    );
    const messageWithAttachmentHints = this.appendAttachmentHints(messageWithContext, unsupportedAttachmentHints);

    if (sessionId && (systemPrompt || userMessageAddition || (attachments?.length ?? 0) > 0)) {
      const attachmentSummaries =
        attachments?.map((attachment) => ({
          type: attachment.type,
          filename: attachment.filename || (attachment.filepath ? path.basename(attachment.filepath) : 'unknown'),
          mimeType: attachment.mimeType,
          filepath: attachment.filepath,
        })) ?? [];
      this.emit('promptAdditions', {
        sessionId,
        systemPromptAddition: systemPrompt || null,
        userMessageAddition,
        attachments: attachmentSummaries,
        timestamp: Date.now(),
      });
    }

    if (sessionId) {
      const metadataToLog: Record<string, unknown> = {};
      if (attachments && attachments.length > 0) {
        metadataToLog.attachments = attachments;
      }
      if (documentContext?.mode) {
        metadataToLog.mode = documentContext.mode;
      }
      await this.logAgentMessageBestEffort(
        sessionId,
        'input',
        messageWithAttachmentHints,
        Object.keys(metadataToLog).length > 0 ? { metadata: metadataToLog } : undefined,
      );
    }

    const permissionsPath = documentContext?.permissionsPath || workspacePath;
    const mcpConfigWorkspacePath = documentContext?.mcpConfigWorkspacePath || workspacePath;
    const abortController = new AbortController();
    this.abortController = abortController;

    let fullText = '';

    try {
      const permissionDecision = await this.requestDeepAgentsTurnPermission(
        sessionId,
        workspacePath,
        permissionsPath,
        abortController.signal
      );

      if (permissionDecision.decision !== 'allow') {
        yield {
          type: 'error',
          error: permissionDecision.reason || 'DeepAgents turn denied',
        };
        return;
      }

      const existingSessionId = this.sessions.getSessionId(sessionId || '');
      const mcpServers = await this.mcpConfigService.getMcpServersConfig({
        sessionId,
        workspacePath: mcpConfigWorkspacePath,
        profile: isMetaAgent ? 'meta-agent' : 'standard',
      });

      const resolvedModel = await this.getConfiguredModel();

      const sessionOptions = {
        workspacePath,
        model: resolvedModel,
        ...(permissionDecision.permissionMode ? { permissionMode: permissionDecision.permissionMode } : {}),
        mcpServers,
        ...(isMetaAgent ? {
          allowedTools: BaseAgentProvider.META_AGENT_ALLOWED_TOOLS,
        } : {}),
        raw: {
          systemPrompt,
          abortSignal: abortController.signal,
        },
      };

      const isResumedSession = !!existingSessionId;
      const session = isResumedSession
        ? await this.protocol.resumeSession(existingSessionId, sessionOptions)
        : await this.protocol.createSession(sessionOptions);

      this._initData = {
        model: resolvedModel,
        mcpServerCount: Object.keys(mcpServers).length,
        isResumedSession,
        permissionMode: permissionDecision.permissionMode ?? null,
      };

      const transcriptAdapter = new AgentProtocolTranscriptAdapter(null, sessionId ?? '');

      transcriptAdapter.userMessage(
        messageWithAttachmentHints,
        documentContext?.mode === 'planning' ? 'planning' : 'agent',
        attachments as any,
      );

      for await (const event of this.protocol.sendMessage(session, {
        content: messageWithAttachmentHints,
        attachments,
        sessionId,
        mode: documentContext?.mode || 'agent',
        // System prompt rides in via raw_event handling rather than in the
        // first user turn body so canonical events stay clean.
        ...({ systemPrompt } as Record<string, unknown>),
      } as any)) {
        if (abortController.signal.aborted) {
          throw new Error('Operation cancelled');
        }

        if (sessionId) {
          try {
            await this.storeRawEventIfPresent(event, sessionId);
          } catch {
            // DB unavailable during tests
          }
          // Drive the transcript transformer incrementally so canonical events
          // appear in the UI while the ACP session is still streaming -- not
          // only after a session reload triggers ensureUpToDate. Without this,
          // each agent_message_chunk raw event sits unprocessed until the
          // throttled DB reload catches up, so the user sees no live updates.
          await this.processTranscriptMessages(sessionId);
        }

        for (const item of transcriptAdapter.processEvent(event)) {
          switch (item.kind) {
            case 'text':
              fullText += item.text;
              yield { type: 'text', content: item.text };
              break;
            case 'tool_call':
              yield { type: 'tool_call', toolCall: item.toolCall };
              break;
            case 'complete':
              yield {
                type: 'complete',
                content: item.event.content,
                isComplete: true,
                usage: item.event.usage,
                ...(item.event.contextFillTokens !== undefined ? { contextFillTokens: item.event.contextFillTokens } : {}),
                ...(item.event.contextWindow !== undefined ? { contextWindow: item.event.contextWindow } : {}),
              };
              break;
            case 'error':
              yield { type: 'error', error: item.message };
              break;
            case 'raw_event':
            case 'reasoning':
            case 'unknown':
              break;
          }
        }
      }

      if (sessionId && session.id) {
        if (session.id !== existingSessionId) {
          if (isResumedSession) {
            throw new Error(
              `[DEEPAGENTS-ACP] Session resume mismatch: requested resume of "${existingSessionId}" but protocol returned session "${session.id}".`
            );
          }
          this.sessions.captureSessionId(sessionId, session.id);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAbort = abortController.signal.aborted || /abort|cancel/i.test(errorMessage);
      if (!isAbort) {
        yield { type: 'error', error: errorMessage };
      }
    } finally {
      if (this.abortController === abortController) {
        this.abortController = null;
      }
    }
  }

  private async requestACPToolPermission(
    request: ACPToolPermissionRequest
  ): Promise<{ decision: 'allow' | 'deny'; scope: 'once' | 'session' | 'always' | 'always-all' }> {
    const sessionId = request.nimbalystSessionId;
    const workspacePath = request.workspacePath;
    if (!sessionId || !workspacePath) {
      return { decision: 'deny', scope: 'once' };
    }

    const toolInput = request.toolInput ?? {};
    const targetPath = this.extractPermissionPath(request);
    const pattern = this.buildPermissionPattern(request.toolName, toolInput, targetPath);
    const decision = await this.permissionService.requestToolPermission({
      requestId: request.requestId,
      sessionId,
      workspacePath,
      permissionsPath: workspacePath,
      toolName: request.toolName,
      toolInput,
      pattern,
      patternDisplayName: request.toolTitle || request.toolName,
      toolDescription: request.toolTitle || request.toolName,
      isDestructive: this.isDestructivePermissionRequest(request.toolName),
      warnings: [],
      signal: request.signal ?? new AbortController().signal,
    });

    return {
      decision: decision.decision,
      scope: decision.scope,
    };
  }

  private buildPermissionPattern(toolName: string, toolInput: unknown, targetPath?: string): string {
    if (toolName === 'Bash' && toolInput && typeof toolInput === 'object') {
      const command = (toolInput as Record<string, unknown>).command;
      if (typeof command === 'string' && command.trim()) {
        return `Bash(${command.trim()})`;
      }
    }
    if (targetPath) {
      return `${toolName}(${targetPath})`;
    }
    return toolName;
  }

  private extractPermissionPath(request: ACPToolPermissionRequest): string | undefined {
    const rawInput = request.toolInput;
    if (rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)) {
      const record = rawInput as Record<string, unknown>;
      for (const key of ['path', 'file_path', 'filePath']) {
        const value = record[key];
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
      }
    }

    const location = request.toolCall.locations?.find((entry) =>
      typeof entry?.path === 'string' && entry.path.trim().length > 0
    );
    return typeof location?.path === 'string' ? location.path : undefined;
  }

  private isDestructivePermissionRequest(toolName: string): boolean {
    return ['Write', 'Edit', 'ApplyPatch', 'Bash'].includes(toolName);
  }

  resolveToolPermission(
    requestId: string,
    response: { decision: 'allow' | 'deny'; scope: 'once' | 'session' | 'always' | 'always-all' },
    sessionId?: string,
    respondedBy: 'desktop' | 'mobile' = 'desktop'
  ): void {
    this.permissionService.resolvePermission(requestId, response);

    if (sessionId) {
      void this.logAgentMessageBestEffort(
        sessionId,
        'output',
        this.createPermissionResultMessage(requestId, response, respondedBy)
      );
    }
  }

  abort(): void {
    this.permissionService.rejectAllPending();
    super.abort();
  }

  cleanupSession(sessionId: string): void {
    this.sessions.deleteSession(sessionId);
  }

  destroy(): void {
    this.permissionService.clearSessionCache();
    this.protocol.destroy();
    super.destroy();
  }

  protected buildSystemPrompt(documentContext?: DocumentContext, isMetaAgent: boolean = false): string {
    if (isMetaAgent) {
      return buildMetaAgentSystemPrompt('codex', 'default', {
        provider: 'deepagents-acp',
        model: this.config?.model ?? undefined,
      });
    }

    const hasSessionNaming = DeepAgentsACPProvider.sessionNamingServerPort !== null;
    const worktreePath = documentContext?.worktreePath;
    const isVoiceMode = (documentContext as any)?.isVoiceMode;
    const voiceModeCodingAgentPrompt = (documentContext as any)?.voiceModeCodingAgentPrompt;

    return buildClaudeCodeSystemPrompt({
      hasSessionNaming,
      toolReferenceStyle: 'codex',
      worktreePath,
      isVoiceMode,
      voiceModeCodingAgentPrompt,
      enableAgentTeams: false,
    });
  }

  private async getConfiguredModel(): Promise<string> {
    const configured = this.config?.model || DeepAgentsACPProvider.DEFAULT_MODEL;
    const parsed = ModelIdentifier.tryParse(configured);
    const resolved = parsed
      ? parsed.model
      : configured
          .replace(/^deepagents-acp:/, '')
          .replace(/^deepagents:/, '');
    const normalized = resolved.toLowerCase();
    if (!normalized || normalized === 'default' || normalized === 'cli') {
      return 'openai:gpt-5.4';
    }
    if (/^[a-z0-9_-]+:/i.test(resolved)) {
      return resolved;
    }
    if (resolved.includes('/')) {
      const [provider, ...modelParts] = resolved.split('/');
      return `${provider}:${modelParts.join('/')}`;
    }
    return `openai:${resolved}`;
  }

  private appendAttachmentHints(message: string, attachments?: ChatAttachment[]): string {
    if (!attachments || attachments.length === 0) {
      return message;
    }
    const attachmentList = attachments
      .map((attachment) => {
        const displayName =
          attachment.filename ||
          (attachment.filepath ? path.basename(attachment.filepath) : attachment.id || 'attachment');
        return `- ${displayName}${attachment.filepath ? ` (${attachment.filepath})` : ''}`;
      })
      .join('\n');

    return `${message}\n\nAttached files:\n${attachmentList}`;
  }

  /**
   * Permission gate before initiating a turn. Mirrors DeepAgentsProvider --
   * ACP supports per-tool callbacks but we still gate the whole turn at trust
   * level so ACP behaves consistently with the SDK provider.
   */
  private async requestDeepAgentsTurnPermission(
    _sessionId: string | undefined,
    workspacePath: string,
    permissionsPath: string,
    _signal: AbortSignal
  ): Promise<{ decision: 'allow' | 'deny'; reason?: string; permissionMode?: PermissionMode }> {
    const pathForTrust = permissionsPath || workspacePath;

    if (pathForTrust && BaseAgentProvider.trustChecker) {
      const trustStatus = BaseAgentProvider.trustChecker(pathForTrust);

      if (!trustStatus.trusted) {
        this.logSecurity('[DeepAgentsACPProvider] Workspace not trusted, denying DeepAgents ACP turn', {
          workspacePath: pathForTrust,
        });
        return {
          decision: 'deny',
          reason: 'Workspace is not trusted. Please trust this workspace to use DeepAgents.',
        };
      }

      // ACP supports tool-level permission callbacks, so unlike the SDK
      // provider we can run in "ask" mode: the protocol fires
      // requestPermission for risky operations and we route them through
      // ToolPermissionService.
      return { decision: 'allow', permissionMode: trustStatus.mode };
    }

    return { decision: 'allow' };
  }

  /**
   * Persist raw ACP protocol events to ai_agent_messages so the
   * DeepAgentsACPRawParser can reconstruct the canonical transcript.
   */
  private async storeRawEventIfPresent(event: ProtocolEvent, sessionId: string): Promise<void> {
    if (event.type !== 'raw_event' || !event.metadata?.rawEvent) {
      return;
    }

    const { content } = safeJSONSerialize(event.metadata.rawEvent);
    const rawEventType = this.getRawEventType(event.metadata.rawEvent);

    await this.logAgentMessage(
      sessionId,
      this.getProviderName(),
      'output',
      content,
      {
        eventType: rawEventType,
        deepagentsAcpProvider: true,
      },
      false,
      undefined,
      false,
    );
  }

  private getRawEventType(rawEvent: unknown): string {
    if (rawEvent && typeof rawEvent === 'object') {
      const eventType = (rawEvent as Record<string, unknown>).type;
      if (typeof eventType === 'string' && eventType.trim().length > 0) {
        return eventType;
      }
    }
    return 'unknown';
  }

  private async processTranscriptMessages(sessionId: string): Promise<void> {
    try {
      if (TranscriptMigrationRepository.hasService()) {
        await TranscriptMigrationRepository.getService().processNewMessages(
          sessionId,
          this.getProviderName(),
        );
      }
    } catch {
      // Best effort -- the next call (or end-of-turn ensureUpToDate) catches up.
    }
  }
}
