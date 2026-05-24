import type { RejectedPermissionRequest } from '../permissions/ToolPermissionService';
import type { ProtocolSession } from '../protocols/ProtocolInterface';
import { isRecord } from './SmartyServerProviderUtils';
import type { PendingInterruptedApproval } from './SmartyServerLangGraphApprovals';

export function isLocalCancellationMessage(message: string): boolean {
  return /^(Request aborted|Request cancelled|Request canceled|Request interrupted|Operation cancelled)$/i.test(message);
}

export function getRejectedPermissionRequestId(request: RejectedPermissionRequest): string | undefined {
  if ('requestId' in request && typeof request.requestId === 'string') return request.requestId;
  if ('id' in request && typeof request.id === 'string') return request.id;
  return undefined;
}

export function getRejectedPermissionSessionId(request: RejectedPermissionRequest): string | undefined {
  return typeof request.sessionId === 'string' ? request.sessionId : undefined;
}

export function createAbortIndependentSession(session: ProtocolSession): ProtocolSession {
  if (!isRecord(session.raw)) {
    return session;
  }

  return {
    ...session,
    raw: {
      ...session.raw,
      abortSignal: undefined,
    },
  };
}

export function getInterruptedApprovalsForRequests(
  requests: RejectedPermissionRequest[],
  pendingInterruptedApprovals: Map<string, PendingInterruptedApproval>,
): PendingInterruptedApproval[] {
  const approvals: PendingInterruptedApproval[] = [];
  const seen = new Set<string>();
  for (const request of requests) {
    const requestId = getRejectedPermissionRequestId(request);
    if (!requestId || seen.has(requestId)) continue;
    seen.add(requestId);
    const approval = pendingInterruptedApprovals.get(requestId);
    if (approval) approvals.push(approval);
  }
  return approvals;
}
