import type { ProtocolSession } from '../protocols/ProtocolInterface';
import { ToolPermissionService } from '../permissions/ToolPermissionService';
import type { PermissionDecision } from './ProviderPermissionMixin';
import { processSmartyServerTranscriptMessages } from './SmartyServerTranscriptBridge';
import {
  isSmartyFileWriteTool,
  isWriteLikeLangGraphTool,
  normalizeLangGraphPermissionPattern,
  type LangGraphActionRequest,
  type PendingInterruptedApproval,
} from './SmartyServerLangGraphApprovals';
import { classifyLangGraphActionPaths } from './SmartyServerPathPolicy';
import { stringifyForDisplay } from './SmartyServerProviderUtils';

interface RequestSingleLangGraphActionApprovalOptions {
  action: LangGraphActionRequest;
  logAgentMessage: (
    sessionId: string,
    role: 'input' | 'output',
    content: string,
    options?: { metadata?: Record<string, unknown> },
  ) => Promise<void>;
  pendingInterruptedApprovals: Map<string, PendingInterruptedApproval>;
  permissionsPath: string;
  permissionService: ToolPermissionService;
  protocolSession: ProtocolSession;
  providerName: string;
  requestId: string;
  sessionId: string;
  signal: AbortSignal;
  workspacePath: string;
}

export async function requestSingleLangGraphActionApproval({
  action,
  logAgentMessage,
  pendingInterruptedApprovals,
  permissionsPath,
  permissionService,
  protocolSession,
  providerName,
  requestId,
  sessionId,
  signal,
  workspacePath,
}: RequestSingleLangGraphActionApprovalOptions): Promise<PermissionDecision> {
  const toolName = action.name || 'unknown_tool';
  const pathScope = classifyLangGraphActionPaths(action.args, workspacePath);
  const pattern = normalizeLangGraphPermissionPattern(toolName, pathScope, action.args);
  const warnings = [
    'Smarty Server paused before running this LangGraph tool.',
    ...pathScope.warnings,
  ];
  const isWriteLike = isWriteLikeLangGraphTool(toolName);

  await logAgentMessage(
    sessionId,
    'output',
    JSON.stringify({
      type: 'nimbalyst_tool_use',
      id: requestId,
      name: 'ToolPermission',
      input: {
        requestId,
        toolName,
        rawCommand: stringifyForDisplay(action.args),
        pattern,
        patternDisplayName: pattern,
        isDestructive: isWriteLike,
        referencedPaths: pathScope.referencedPaths,
        outsidePaths: pathScope.outsidePaths,
        sensitivePaths: pathScope.sensitivePaths,
        warnings,
        workspacePath,
        permissionsPath,
        langGraphActionIndex: action.index,
        allowedDecisions: action.allowedDecisions,
        description: action.description,
        args: action.args,
      },
    }),
  );
  await processSmartyServerTranscriptMessages(sessionId, providerName);

  pendingInterruptedApprovals.set(requestId, {
    requestId,
    sessionId,
    protocolSession,
    ...(isSmartyFileWriteTool(toolName) ? { fileAction: { requestId, action } } : {}),
  });

  try {
    return await permissionService.requestToolPermission({
      requestId,
      sessionId,
      workspacePath,
      permissionsPath,
      toolName,
      toolInput: action.args,
      pattern,
      patternDisplayName: pattern,
      toolDescription: action.description || toolName,
      isDestructive: isWriteLike,
      warnings,
      referencedPaths: pathScope.referencedPaths,
      outsidePaths: pathScope.outsidePaths,
      sensitivePaths: pathScope.sensitivePaths,
      signal,
    });
  } finally {
    pendingInterruptedApprovals.delete(requestId);
  }
}
