import { TranscriptMigrationRepository } from '../../../storage/repositories/TranscriptMigrationRepository';
import { safeJSONSerialize } from '../../../utils/serialization';
import type { ProtocolEvent } from '../protocols/ProtocolInterface';
import type { StreamChunk } from '../types';
import { AgentProtocolTranscriptAdapter } from './agentProtocol/AgentProtocolTranscriptAdapter';
import { extractRawEventRunIdentity } from './SmartyServerFileEvents';
import { isRecord } from './SmartyServerProviderUtils';

type LogAgentMessage = (
  sessionId: string,
  direction: 'input' | 'output',
  content: string,
  options?: {
    metadata?: Record<string, unknown>;
    hidden?: boolean;
    searchable?: boolean;
  },
) => Promise<void>;

export function buildTranscriptChunksForEvent(
  event: ProtocolEvent,
  transcriptAdapter: AgentProtocolTranscriptAdapter,
): StreamChunk[] {
  const chunks: StreamChunk[] = [];
  for (const item of transcriptAdapter.processEvent(event)) {
    switch (item.kind) {
      case 'text':
        chunks.push({ type: 'text', content: item.text });
        break;
      case 'tool_call':
        chunks.push({ type: 'tool_call', toolCall: item.toolCall });
        break;
      case 'tool_result':
        chunks.push({
          type: 'tool_call',
          toolCall: {
            id: item.toolResult.id,
            name: item.toolResult.name,
            result: item.toolResult.result,
          },
        });
        break;
      case 'complete':
        chunks.push({
          type: 'complete',
          content: item.event.content,
          isComplete: true,
          usage: item.event.usage,
          ...(item.event.contextFillTokens !== undefined ? { contextFillTokens: item.event.contextFillTokens } : {}),
          ...(item.event.contextWindow !== undefined ? { contextWindow: item.event.contextWindow } : {}),
        });
        break;
      case 'error':
        chunks.push({ type: 'error', error: item.message });
        break;
      case 'raw_event':
      case 'reasoning':
      case 'planning_mode':
      case 'unknown':
        break;
    }
  }
  return chunks;
}

export async function storeSmartyServerRawEvent(
  sessionId: string,
  event: ProtocolEvent,
  logAgentMessageBestEffort: LogAgentMessage,
  providerName: string,
): Promise<void> {
  const rawEvent = (event.metadata as { rawEvent?: unknown } | undefined)?.rawEvent;
  if (!rawEvent) return;

  const { content } = safeJSONSerialize(rawEvent);
  const eventType = isRecord(rawEvent) && typeof rawEvent.event === 'string'
    ? rawEvent.event
    : 'unknown';

  await logAgentMessageBestEffort(sessionId, 'output', content, {
    metadata: {
      eventType,
      smartyServerProvider: true,
      ...extractRawEventRunIdentity(event.metadata),
    },
    hidden: true,
    searchable: false,
  });

  await processSmartyServerTranscriptMessages(sessionId, providerName);
}

export async function processSmartyServerTranscriptMessages(
  sessionId: string,
  providerName: string,
): Promise<void> {
  try {
    if (TranscriptMigrationRepository.hasService()) {
      await TranscriptMigrationRepository.getService().processNewMessages(
        sessionId,
        providerName,
      );
    }
  } catch {
    // Best effort -- the next ensureUpToDate call catches up.
  }
}
