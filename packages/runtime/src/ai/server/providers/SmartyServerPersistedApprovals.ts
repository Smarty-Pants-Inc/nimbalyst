import { AgentMessagesRepository } from '../../../storage/repositories/AgentMessagesRepository';
import {
  parsePersistedToolPermissionAction,
  type ApprovedLangGraphFileAction,
} from './SmartyServerLangGraphApprovals';

const PERSISTED_PERMISSION_SCAN_PAGE_SIZE = 500;
const PERSISTED_PERMISSION_SCAN_MAX_ROWS = 50_000;

export async function recoverPersistedApprovedFileAction(
  sessionId: string,
  requestId: string,
): Promise<ApprovedLangGraphFileAction | null> {
  for (
    let offset = 0;
    offset < PERSISTED_PERMISSION_SCAN_MAX_ROWS;
    offset += PERSISTED_PERMISSION_SCAN_PAGE_SIZE
  ) {
    let messages: Awaited<ReturnType<typeof AgentMessagesRepository.list>>;
    try {
      messages = await AgentMessagesRepository.list(sessionId, {
        limit: PERSISTED_PERMISSION_SCAN_PAGE_SIZE,
        offset,
        includeHidden: true,
      });
    } catch {
      return null;
    }

    for (const message of messages) {
      const action = parsePersistedToolPermissionAction(message.content, requestId);
      if (action) {
        return { requestId, action };
      }
    }

    if (messages.length < PERSISTED_PERMISSION_SCAN_PAGE_SIZE) {
      break;
    }
  }
  return null;
}
