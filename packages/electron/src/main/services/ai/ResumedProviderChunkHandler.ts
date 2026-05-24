import { BrowserWindow } from 'electron';
import * as path from 'path';
import type { SessionManager } from '@nimbalyst/runtime/ai/server';
import { getSessionStateManager } from '@nimbalyst/runtime/ai/server/SessionStateManager';
import type { SessionData, StreamChunk } from '@nimbalyst/runtime/ai/server/types';
import type { HooklessAgentFileWatcher } from './HooklessAgentFileWatcher';
import { safeSend } from './aiServiceUtils';
import { historyManager } from '../../HistoryManager';
import { addGitignoreBypass } from '../../file/WorkspaceEventBus';
import { logger } from '../../utils/logger';
import { codexEditWindowRegistry } from '../CodexEditWindowRegistry';
import { sessionFileTracker } from '../SessionFileTracker';
import { toolCallMatcher, unwrapShellCommand } from '../ToolCallMatcher';

interface ResumedProviderChunkService {
  sessionManager: SessionManager;
  hooklessWatcher: HooklessAgentFileWatcher;
  inferWorktreePathFromFilePath(workspacePath: string, filePath: string): string | null;
  inferWorktreePathFromCommand(command: string | undefined, workspacePath: string): string | null;
  adoptWorktreeForSession(
    session: SessionData,
    worktreePath: string,
    event: Electron.IpcMainInvokeEvent,
  ): Promise<void>;
}

const REAL_ABSOLUTE_PATH_FIRST_SEGMENTS = new Set([
  'applications',
  'bin',
  'dev',
  'etc',
  'home',
  'library',
  'opt',
  'private',
  'proc',
  'sbin',
  'system',
  'tmp',
  'users',
  'usr',
  'var',
  'volumes',
]);

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function virtualWorkspaceRelativePath(virtualPath: string): string {
  const normalized = virtualPath.replace(/^[/\\]+/, '');
  if (normalized === 'workspace') {
    return '';
  }
  if (normalized.startsWith('workspace/') || normalized.startsWith('workspace\\')) {
    return normalized.slice('workspace'.length + 1);
  }
  return normalized;
}

function isVirtualWorkspacePath(virtualPath: string): boolean {
  const normalized = virtualPath.replace(/^[/\\]+/, '');
  return normalized === 'workspace'
    || normalized.startsWith('workspace/')
    || normalized.startsWith('workspace\\');
}

function isKnownLangGraphVirtualPath(virtualPath: string): boolean {
  const normalized = virtualPath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
  return normalized === 'tmp/runtime' || normalized.startsWith('tmp/runtime/');
}

function resolveSnapshotFilePath(workspacePath: string, rawPath: string): string | null {
  const workspaceRoot = path.resolve(workspacePath);
  if (!path.isAbsolute(rawPath)) {
    const candidate = path.resolve(workspaceRoot, rawPath);
    return isPathInside(workspaceRoot, candidate) ? candidate : null;
  }

  const hostPath = path.resolve(rawPath);
  if (isPathInside(workspaceRoot, hostPath)) {
    return hostPath;
  }

  const virtualCandidate = path.resolve(workspaceRoot, virtualWorkspaceRelativePath(rawPath));
  if (!isPathInside(workspaceRoot, virtualCandidate)) {
    return null;
  }
  if (isVirtualWorkspacePath(rawPath) || isKnownLangGraphVirtualPath(rawPath)) {
    return virtualCandidate;
  }

  const firstSegment = virtualWorkspaceRelativePath(rawPath).split(/[\\/]/)[0];
  if (!firstSegment) return null;
  if (REAL_ABSOLUTE_PATH_FIRST_SEGMENTS.has(firstSegment.toLowerCase())) {
    return hostPath;
  }
  return virtualCandidate;
}

function isDuplicateHistoryTagError(error: unknown): boolean {
  const errorStr = String(error).toLowerCase();
  return errorStr.includes('unique')
    || errorStr.includes('duplicate')
    || errorStr.includes('already exists');
}

export async function handleResumedProviderChunks({
  chunks,
  event,
  sessionId,
  svc,
  workspacePath,
}: {
  chunks: StreamChunk[];
  event: Electron.IpcMainInvokeEvent;
  sessionId: string;
  svc: ResumedProviderChunkService;
  workspacePath: string;
}): Promise<void> {
  if (chunks.length === 0) return;

  const session = await svc.sessionManager.loadSession(sessionId, workspacePath);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  let effectiveWorkspacePath = session.worktreePath || workspacePath;
  const stateManager = getSessionStateManager();
  await stateManager.startSession({
    sessionId: session.id,
    workspacePath: session.workspacePath || effectiveWorkspacePath,
  });

  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  let fullResponse = '';
  let lastTextSection = '';
  let prevTextSection = '';
  let sawComplete = false;
  let sawError = false;

  for (const chunk of chunks) {
    switch (chunk.type) {
      case 'text': {
        const chunkContent = chunk.content || '';
        fullResponse += chunkContent;
        lastTextSection += chunkContent;
        await stateManager.updateActivity({
          sessionId: session.id,
          isStreaming: true,
        });
        safeSend(event, 'ai:streamResponse', {
          sessionId: session.id,
          partial: fullResponse,
          isComplete: false,
        });
        break;
      }

      case 'pre_edit_snapshot': {
        if (!chunk.preEditSnapshot) break;
        const { toolUseId, entries, authoritative } = chunk.preEditSnapshot;

        for (const entry of entries) {
          if (!entry?.path) continue;
          const absPath = resolveSnapshotFilePath(effectiveWorkspacePath, entry.path);
          if (!absPath) continue;
          const inferredWorktreePath = svc.inferWorktreePathFromFilePath(workspacePath, absPath);
          if (inferredWorktreePath) {
            await svc.adoptWorktreeForSession(session, inferredWorktreePath, event);
            effectiveWorkspacePath = session.worktreePath || effectiveWorkspacePath;
            break;
          }
        }

        const watcherEntryForBaseline = authoritative
          ? null
          : svc.hooklessWatcher.getEntry(session.id);
        for (const entry of entries) {
          if (!entry?.path) continue;
          const absPath = resolveSnapshotFilePath(effectiveWorkspacePath, entry.path);
          if (!absPath) continue;
          addGitignoreBypass(effectiveWorkspacePath, absPath);
          const tagId = `ai-edit-pending-${session.id}-${toolUseId}`;

          let baselineContent = entry.content ?? '';
          const isAddKind = entry.kind === 'add' || entry.kind === 'create' || entry.kind === 'new';
          if (!authoritative && !isAddKind && watcherEntryForBaseline) {
            try {
              const cached = await watcherEntryForBaseline.cache.getBeforeState(absPath);
              if (typeof cached === 'string') {
                baselineContent = cached;
              }
            } catch {
              // Cache miss / cache error -- fall through to provider content.
            }
          }

          try {
            await historyManager.createTag(
              effectiveWorkspacePath,
              absPath,
              tagId,
              baselineContent,
              session.id,
              toolUseId,
              { replaceSpeculative: true },
            );
          } catch (preEditError) {
            if (!isDuplicateHistoryTagError(preEditError)) {
              logger.ai.error('[AIService] resumed pre_edit_snapshot tag write failed', preEditError);
            }
          }

          try {
            await sessionFileTracker.trackToolExecution(
              session.id,
              effectiveWorkspacePath,
              'file_change',
              { changes: [{ path: absPath, kind: entry.kind ?? 'update' }] },
              undefined,
              toolUseId,
              senderWindow,
            );
          } catch (trackingError) {
            logger.ai.error('[AIService] resumed pre_edit_snapshot session-file tracking failed', trackingError);
          }
        }
        safeSend(event, 'session-files:updated', session.id);
        break;
      }

      case 'post_edit_snapshot': {
        if (!chunk.postEditSnapshot) break;
        const { toolUseId, entries } = chunk.postEditSnapshot;
        for (const entry of entries) {
          if (!entry?.path) continue;
          const absPath = resolveSnapshotFilePath(effectiveWorkspacePath, entry.path);
          if (!absPath) continue;
          try {
            await historyManager.createSnapshot(
              absPath,
              entry.content,
              'ai-edit',
              `AI edit (session: ${session.id})`,
              { sessionId: session.id, toolUseId },
            );
          } catch (postEditError) {
            logger.ai.error('[AIService] resumed post_edit_snapshot ai-edit write failed', postEditError);
          }
        }
        safeSend(event, 'session-files:updated', session.id);
        break;
      }

      case 'tool_call': {
        if (!chunk.toolCall || !effectiveWorkspacePath) break;
        if (lastTextSection.trim()) prevTextSection = lastTextSection.trim();
        lastTextSection = '';

        let trackToolName = chunk.toolCall.name;
        let trackArgs = chunk.toolCall.arguments;
        if (trackToolName === 'command_execution' && typeof trackArgs?.command === 'string') {
          trackToolName = 'Bash';
        } else if (/^\/(?:bin|usr\/bin)\//.test(trackToolName) || /\/(?:bash|zsh|sh)\b/.test(trackToolName) || /(?:powershell|pwsh|cmd)(?:\.exe)?\b/i.test(trackToolName)) {
          trackArgs = { command: unwrapShellCommand(trackToolName) };
          trackToolName = 'Bash';
        }

        if (trackToolName === 'Bash' && typeof trackArgs?.command === 'string') {
          const inferredWorktreePath = svc.inferWorktreePathFromCommand(trackArgs.command, workspacePath);
          if (inferredWorktreePath) {
            await svc.adoptWorktreeForSession(session, inferredWorktreePath, event);
            effectiveWorkspacePath = session.worktreePath || effectiveWorkspacePath;
          }
        }

        const chunkToolUseId =
          typeof (chunk.toolCall as any)?.toolUseId === 'string'
            ? ((chunk.toolCall as any).toolUseId as string)
            : (typeof chunk.toolCall.id === 'string' ? chunk.toolCall.id : undefined);

        try {
          await sessionFileTracker.trackToolExecution(
            session.id,
            effectiveWorkspacePath,
            trackToolName,
            trackArgs,
            chunk.toolCall.result,
            chunkToolUseId,
            senderWindow,
          );
          safeSend(event, 'session-files:updated', session.id);
        } catch (trackError) {
          logger.ai.error('[AIService] Failed to track resumed tool call:', trackError);
        }
        break;
      }

      case 'error': {
        sawError = true;
        safeSend(event, 'ai:error', {
          sessionId: session.id,
          message: chunk.error || 'Unknown error',
          isAuthError: chunk.isAuthError || false,
          isBedrockToolError: chunk.isBedrockToolError || false,
          isServerError: chunk.isServerError || false,
          isCodexAuthRequired: chunk.isCodexAuthRequired || false,
        });
        await stateManager.updateActivity({
          sessionId: session.id,
          status: 'error',
        });
        break;
      }

      case 'complete':
        sawComplete = true;
        break;

      case 'tool_error':
      case 'stream_edit_start':
      case 'stream_edit_content':
      case 'stream_edit_end':
        break;
    }
  }

  if (fullResponse.trim()) {
    await svc.sessionManager.addMessage({
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now(),
    }, session.id);
  }

  safeSend(event, 'ai:message-logged', {
    sessionId: session.id,
    direction: 'output',
    workspacePath: effectiveWorkspacePath,
  });

  if (effectiveWorkspacePath) {
    try {
      const matched = await toolCallMatcher.matchSession(session.id);
      if (matched > 0) {
        safeSend(event, 'session-files:updated', session.id);
      }
    } catch (matchError) {
      logger.main.error(`[AIService] Resumed tool call matching failed for session ${session.id}:`, matchError);
    }
  }

  if (sawError) {
    await stateManager.endSession(session.id);
    await svc.hooklessWatcher.stopForSession(session.id);
    codexEditWindowRegistry.clearSession(session.id);
    return;
  }

  if (sawComplete) {
    safeSend(event, 'ai:streamResponse', {
      sessionId: session.id,
      content: fullResponse,
      lastTextSection: lastTextSection.trim() || prevTextSection,
      isComplete: true,
      autoContextPending: false,
    });
    await stateManager.endSession(session.id);
    svc.hooklessWatcher.scheduleStop(session.id, 500);
  }
}
