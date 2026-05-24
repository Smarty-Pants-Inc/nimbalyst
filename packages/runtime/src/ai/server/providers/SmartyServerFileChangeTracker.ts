import type { StreamChunk } from '../types';
import type { ProtocolEvent } from '../protocols/ProtocolInterface';
import {
  approvedFileActionKey,
  buildFileChangeToolChunk,
  fileChangeKey,
  isFailedToolResult,
  readTextFileOrNull,
  type PendingFileChange,
} from './SmartyServerFileEvents';
import {
  isSmartyFileWriteTool,
} from './SmartyServerLangGraphApprovals';
import {
  resolveToolFilePath,
} from './SmartyServerPathPolicy';

interface FileChangeChunksResult {
  handled: boolean;
  chunks: StreamChunk[];
}

export class SmartyServerFileChangeTracker {
  private readonly pendingFileChanges = new Map<string, PendingFileChange>();
  private readonly syntheticApprovedFileChanges = new Map<string, PendingFileChange>();

  clearSession(sessionId: string): void {
    this.deleteSessionEntries(this.pendingFileChanges, sessionId);
    this.deleteSessionEntries(this.syntheticApprovedFileChanges, sessionId);
  }

  private deleteSessionEntries<T>(entries: Map<string, T>, sessionId: string): void {
    const sessionPrefix = `${sessionId}:`;
    for (const key of entries.keys()) {
      if (key.startsWith(sessionPrefix)) {
        entries.delete(key);
      }
    }
  }

  clearAll(): void {
    this.pendingFileChanges.clear();
    this.syntheticApprovedFileChanges.clear();
  }

  async flushSyntheticApprovedFileChangeChunks(sessionId: string | undefined): Promise<StreamChunk[]> {
    if (!sessionId) return [];

    const chunks: StreamChunk[] = [];
    const sessionPrefix = `${sessionId}:`;
    for (const [key, pending] of Array.from(this.syntheticApprovedFileChanges.entries())) {
      if (!key.startsWith(sessionPrefix)) continue;
      this.syntheticApprovedFileChanges.delete(key);

      const afterContent = await readTextFileOrNull(pending.path);
      if (afterContent === null || afterContent === pending.beforeContent) {
        continue;
      }

      chunks.push({
        type: 'post_edit_snapshot',
        postEditSnapshot: {
          toolUseId: pending.toolUseId,
          entries: [{
            path: pending.path,
            content: afterContent,
            kind: pending.kind,
          }],
        },
      });
      chunks.push(buildFileChangeToolChunk(pending.toolUseId, pending.path, pending.kind, {
        success: true,
        result: 'approved file action observed on disk',
      }));
    }
    return chunks;
  }

  async buildChunksForEvent(
    event: ProtocolEvent,
    sessionId: string | undefined,
    workspacePath: string,
  ): Promise<FileChangeChunksResult> {
    if (!sessionId) return { handled: false, chunks: [] };

    if (event.type === 'tool_call' && event.toolCall && isSmartyFileWriteTool(event.toolCall.name)) {
      return this.handleToolCall(event, sessionId, workspacePath);
    }

    if (event.type === 'tool_result' && event.toolResult && isSmartyFileWriteTool(event.toolResult.name)) {
      return this.handleToolResult(event, sessionId);
    }

    return { handled: false, chunks: [] };
  }

  private async handleToolCall(
    event: ProtocolEvent,
    sessionId: string,
    workspacePath: string,
  ): Promise<FileChangeChunksResult> {
    const toolCall = event.toolCall;
    if (!toolCall) return { handled: false, chunks: [] };

    const filePath = resolveToolFilePath(toolCall.arguments, workspacePath);
    const toolUseId = toolCall.id ?? `smarty-file-${Date.now()}`;
    const syntheticApprovedFileAction = event.metadata?.smartyApprovedFileAction === true;
    if (!filePath) return { handled: false, chunks: [] };

    const beforeContent = await readTextFileOrNull(filePath);
    const kind = beforeContent === null ? 'add' : 'update';
    const syntheticKey = approvedFileActionKey(sessionId, toolCall.name, filePath);
    if (!syntheticApprovedFileAction) {
      const syntheticPending = this.syntheticApprovedFileChanges.get(syntheticKey);
      if (syntheticPending) {
        this.pendingFileChanges.set(fileChangeKey(sessionId, toolUseId), syntheticPending);
        this.syntheticApprovedFileChanges.delete(syntheticKey);
        return { handled: true, chunks: [] };
      }
      this.pendingFileChanges.set(fileChangeKey(sessionId, toolUseId), {
        toolUseId,
        path: filePath,
        kind,
        beforeContent: beforeContent ?? '',
      });
    } else {
      this.syntheticApprovedFileChanges.set(syntheticKey, {
        toolUseId,
        path: filePath,
        kind,
        beforeContent: beforeContent ?? '',
      });
    }

    return {
      handled: true,
      chunks: [
        {
          type: 'pre_edit_snapshot',
          preEditSnapshot: {
            toolUseId,
            authoritative: true,
            entries: [{
              path: filePath,
              content: beforeContent ?? '',
              kind,
            }],
          },
        },
        buildFileChangeToolChunk(toolUseId, filePath, kind),
      ],
    };
  }

  private async handleToolResult(
    event: ProtocolEvent,
    sessionId: string,
  ): Promise<FileChangeChunksResult> {
    const toolUseId = event.toolResult?.id;
    if (!toolUseId) return { handled: false, chunks: [] };
    const pending = this.pendingFileChanges.get(fileChangeKey(sessionId, toolUseId));
    if (!pending) return { handled: false, chunks: [] };
    this.pendingFileChanges.delete(fileChangeKey(sessionId, toolUseId));

    const failed = isFailedToolResult(event.toolResult?.result);
    if (failed) {
      return {
        handled: true,
        chunks: [
          buildFileChangeToolChunk(toolUseId, pending.path, pending.kind, {
            success: false,
            result: event.toolResult?.result,
          }),
        ],
      };
    }

    const afterContent = await readTextFileOrNull(pending.path);
    const outputToolUseId = pending.toolUseId || toolUseId;
    return {
      handled: true,
      chunks: [
        ...(afterContent === null
          ? []
          : [{
              type: 'post_edit_snapshot' as const,
              postEditSnapshot: {
                toolUseId: outputToolUseId,
                entries: [{
                  path: pending.path,
                  content: afterContent,
                  kind: pending.kind,
                }],
              },
            }]),
        buildFileChangeToolChunk(outputToolUseId, pending.path, pending.kind, {
          success: true,
          result: event.toolResult?.result,
        }),
      ],
    };
  }
}
