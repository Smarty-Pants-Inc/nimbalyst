import crypto from 'crypto';
import type { ProtocolEvent, ProtocolSession } from '../protocols/ProtocolInterface';
import type { LangGraphReviewDecision } from '../protocols/SmartyServerProtocol';
import type { LangGraphActionPathScope } from './SmartyServerPathPolicy';
import { isRecord, stringifyForDisplay } from './SmartyServerProviderUtils';

export interface ApprovedLangGraphFileAction {
  requestId: string;
  action: LangGraphActionRequest;
}

export interface LangGraphApprovalResult {
  decisions: LangGraphReviewDecision[];
  approvedFileActions: ApprovedLangGraphFileAction[];
}

export interface PendingInterruptedApproval {
  requestId: string;
  sessionId: string;
  protocolSession: ProtocolSession;
  fileAction?: ApprovedLangGraphFileAction;
}

export interface LangGraphActionRequest {
  name: string;
  args: Record<string, unknown>;
  description?: string;
  index: number;
  allowedDecisions: LangGraphReviewDecision['type'][];
}

export function extractLangGraphActionRequests(value: unknown): LangGraphActionRequest[] {
  if (!isRecord(value) || !Array.isArray(value.action_requests)) return [];
  const reviewConfigs = Array.isArray(value.review_configs)
    ? value.review_configs.filter(isRecord)
    : [];
  return value.action_requests
    .filter(isRecord)
    .map((action, index) => {
      const name = typeof action.name === 'string' ? action.name : 'unknown_tool';
      return {
        name,
        args: isRecord(action.args) ? action.args : {},
        description: typeof action.description === 'string' ? action.description : undefined,
        index,
        allowedDecisions: extractAllowedReviewDecisions(reviewConfigs[index], name),
      };
    });
}

export function parsePersistedToolPermissionAction(
  content: string,
  requestId: string,
): LangGraphActionRequest | null {
  const message = parseJSONRecord(content);
  if (!message || message.type !== 'nimbalyst_tool_use' || message.name !== 'ToolPermission') {
    return null;
  }

  const input = isRecord(message.input) ? message.input : null;
  if (!input) return null;

  const loggedRequestId = typeof input.requestId === 'string'
    ? input.requestId
    : (typeof message.id === 'string' ? message.id : undefined);
  if (loggedRequestId !== requestId) return null;

  const name = typeof input.toolName === 'string' ? input.toolName : '';
  if (!isSmartyFileWriteTool(name)) return null;

  return {
    name,
    args: isRecord(input.args) ? input.args : {},
    description: typeof input.description === 'string' ? input.description : undefined,
    index: numericField(input.langGraphActionIndex) ?? 0,
    allowedDecisions: extractLoggedAllowedReviewDecisions(input.allowedDecisions),
  };
}

export function normalizeLangGraphPermissionPattern(
  toolName: string,
  pathScope?: Pick<LangGraphActionPathScope, 'permissionPathKeys'>,
  args?: Record<string, unknown>,
): string {
  if (toolName === 'write_file' || toolName === 'edit_file') {
    const verb = toolName === 'write_file' ? 'Write' : 'Edit';
    const fileScope = pathScope?.permissionPathKeys.length
      ? pathScope.permissionPathKeys.join(',')
      : 'unknown-path';
    return `${verb}(${fileScope})`;
  }
  if (toolName === 'execute') {
    const command = typeof args?.command === 'string'
      ? args.command
      : stringifyForDisplay(args ?? {});
    const commandHash = crypto.createHash('sha256').update(command).digest('hex').slice(0, 16);
    return `Execute(command:${commandHash})`;
  }
  return `LangGraph(${toolName})`;
}

export function isWriteLikeLangGraphTool(toolName: string): boolean {
  return toolName === 'write_file' || toolName === 'edit_file' || toolName === 'execute';
}

export function isSmartyFileWriteTool(toolName: string): boolean {
  return toolName === 'write_file' || toolName === 'edit_file';
}

export function buildApprovedFileActionToolEvents(actions: ApprovedLangGraphFileAction[]): ProtocolEvent[] {
  return actions.map(({ requestId, action }) => ({
    type: 'tool_call',
    toolCall: {
      id: requestId,
      name: action.name,
      arguments: action.args,
    },
    metadata: {
      smartyApprovedFileAction: true,
    },
  }));
}

function parseJSONRecord(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractLoggedAllowedReviewDecisions(raw: unknown): LangGraphReviewDecision['type'][] {
  if (!Array.isArray(raw)) return ['approve', 'reject'];
  const allowed = raw.filter(isLangGraphReviewDecisionType);
  return allowed.length > 0 ? allowed : ['approve', 'reject'];
}

function extractAllowedReviewDecisions(
  reviewConfig: Record<string, unknown> | undefined,
  actionName: string,
): LangGraphReviewDecision['type'][] {
  if (
    reviewConfig &&
    typeof reviewConfig.action_name === 'string' &&
    reviewConfig.action_name !== actionName
  ) {
    return ['approve', 'reject'];
  }

  const raw = reviewConfig?.allowed_decisions;
  if (!Array.isArray(raw)) return ['approve', 'reject'];
  const allowed = raw.filter(isLangGraphReviewDecisionType);
  return allowed.length > 0 ? allowed : ['approve', 'reject'];
}

function isLangGraphReviewDecisionType(value: unknown): value is LangGraphReviewDecision['type'] {
  return value === 'approve' || value === 'edit' || value === 'reject' || value === 'respond';
}

function numericField(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}
