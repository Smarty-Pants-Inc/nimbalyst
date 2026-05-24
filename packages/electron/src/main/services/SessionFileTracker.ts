/**
 * Session File Tracker
 * Automatically tracks file interactions during AI sessions
 *
 * This service ensures that files modified by agents are:
 * 1. Tracked in the session_files database
 * 2. Have file watchers attached for change detection
 * 3. Have their tracker items/metadata refreshed in the document service
 */

import * as path from 'path';
import { existsSync } from 'fs';
import { BrowserWindow } from 'electron';
import { SessionFilesRepository } from '@nimbalyst/runtime';
import type { FileLinkType, EditedFileMetadata, ReadFileMetadata, ReferencedFileMetadata } from '@nimbalyst/runtime/ai/server/types';
import { logger } from '../utils/logger';
import { startFileWatcher } from '../file/FileWatcher';
import { addGitignoreBypass } from '../file/WorkspaceEventBus';
import { documentServices } from '../window/WindowManager';
import { extractFilePath } from './ai/tools/extractFilePath';

/**
 * Extract file mentions from user messages
 * Matches patterns like @filename.ext or @path/to/file.ext
 */
function extractFileMentions(message: string): string[] {
  // Match @filename.ext or @path/to/file.ext
  const regex = /@([^\s@]+\.[a-zA-Z0-9]+|[^\s@]+\/[^\s@]*)/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(message)) !== null) {
    const filePath = match[1];
    if (filePath && !matches.includes(filePath)) {
      matches.push(filePath);
    }
  }

  return matches;
}

/**
 * Determine link type based on tool name
 */
function getLinkTypeForTool(toolName: string): FileLinkType | null {
  const editTools = [
    'Write', 'Edit', 'NotebookEdit', 'writeFile', 'editFile', 'write_file', 'edit_file', 'applyDiff', 'streamContent', 'Bash', 'file_change',
    // Codex ACP: kind:'edit'/'delete'/'move' tool calls map to 'ApplyPatch' in
    // CodexACPProtocol.deriveToolName; the path is forwarded from ACP locations[].
    'ApplyPatch',
    // OpenCode tool names (short names from real SDK: edit, write, patch, shell)
    'file_write', 'file_edit', 'file_create', 'shell', 'patch',
    'edit', 'write', 'create',
  ];
  const readTools = [
    'Read', 'Glob', 'Grep', 'readFile', 'read_file', 'searchFiles', 'listFiles', 'list_files', 'getDocumentContent',
    // OpenCode tool names (short names from real SDK: read, list, search)
    'file_read', 'file_list', 'file_search',
    'read', 'list', 'search',
  ];

  if (editTools.includes(toolName)) {
    return 'edited';
  }
  if (readTools.includes(toolName)) {
    return 'read';
  }

  return null;
}

const LANGGRAPH_VIRTUAL_WORKSPACE_TOOLS = new Set([
  'write_file',
  'edit_file',
  'read_file',
  'list_files',
]);

const FILE_CHANGE_VIRTUAL_WORKSPACE_TOOLS = new Set([
  'file_change',
]);

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

function resolveVirtualWorkspacePath(workspaceRoot: string, virtualPath: string): string | null {
  const candidate = path.resolve(workspaceRoot, virtualWorkspaceRelativePath(virtualPath));
  return isPathInside(workspaceRoot, candidate) ? candidate : null;
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

function isKnownVirtualWorkspaceCandidate(virtualPath: string): boolean {
  if (!path.isAbsolute(virtualPath)) return false;
  if (isVirtualWorkspacePath(virtualPath) || isKnownLangGraphVirtualPath(virtualPath)) {
    return true;
  }
  const firstSegment = virtualWorkspaceRelativePath(virtualPath).split(/[\\/]/)[0];
  return Boolean(firstSegment) && !REAL_ABSOLUTE_PATH_FIRST_SEGMENTS.has(firstSegment.toLowerCase());
}

function resolveKnownVirtualWorkspacePath(workspaceRoot: string, virtualPath: string): string | null {
  if (!isKnownVirtualWorkspaceCandidate(virtualPath)) return null;
  return resolveVirtualWorkspacePath(workspaceRoot, virtualPath);
}

function normalizeToolFilePath(workspaceId: string, filePath: string, toolName: string): string | null {
  const workspaceRoot = path.resolve(workspaceId);
  if (!path.isAbsolute(filePath)) {
    return path.resolve(workspaceRoot, filePath);
  }

  const hostPath = path.resolve(filePath);
  if (isPathInside(workspaceRoot, hostPath)) {
    return hostPath;
  }

  if (FILE_CHANGE_VIRTUAL_WORKSPACE_TOOLS.has(toolName)) {
    const virtualPath = resolveKnownVirtualWorkspacePath(workspaceRoot, filePath);
    if (virtualPath) {
      return virtualPath;
    }
    return isKnownVirtualWorkspaceCandidate(filePath) ? null : hostPath;
  }

  // LangGraph/DeepAgents file tools report paths in their virtual workspace
  // namespace, where "/README.md" means "<workspace>/README.md". Convert those
  // before persisting session-file rows; git/diff surfaces only understand host
  // paths under the opened repository.
  if (LANGGRAPH_VIRTUAL_WORKSPACE_TOOLS.has(toolName)) {
    return resolveVirtualWorkspacePath(workspaceRoot, filePath);
  }

  return hostPath;
}

// extractFilePathFromArgs has been replaced by the shared extractFilePath utility
// in packages/electron/src/main/services/ai/tools/extractFilePath.ts

/**
 * Codex `apply_patch` carries per-file change descriptors under
 * `args.changes: { [path]: { type: 'add'|'update'|'delete'|'move' } }`.
 * Returns the type for a given path, or null if args don't match the shape.
 */
function extractApplyPatchEntryType(args: any, filePath: string | null): string | null {
  if (!filePath) return null;
  const changes = args?.changes;
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null;
  const entry = (changes as Record<string, unknown>)[filePath];
  if (!entry || typeof entry !== 'object') return null;
  const type = (entry as { type?: unknown }).type;
  return typeof type === 'string' ? type : null;
}

/**
 * Extract metadata for edited files
 */
function extractEditMetadata(toolName: string, args: any, result: any, filePath?: string): EditedFileMetadata {
  const metadata: EditedFileMetadata = {
    toolName
  };

  // Determine operation type
  if (toolName === 'Write' || toolName === 'writeFile' || toolName === 'write_file' || toolName === 'file_write' || toolName === 'file_create') {
    metadata.operation = 'create';
  } else if (toolName === 'ApplyPatch') {
    // Codex apply_patch tells us add/update/delete per-file in args.changes.
    // Without that, default to 'edit' (the most common case).
    const patchType = extractApplyPatchEntryType(args, filePath ?? null);
    if (patchType === 'add') {
      metadata.operation = 'create';
    } else if (patchType === 'delete') {
      metadata.operation = 'delete';
    } else {
      metadata.operation = 'edit';
    }
  } else if (toolName === 'Edit' || toolName === 'editFile' || toolName === 'edit_file' || toolName === 'applyDiff' || toolName === 'file_edit' || toolName === 'patch') {
    metadata.operation = 'edit';
  } else if (toolName === 'Bash' || toolName === 'shell') {
    // For Bash/shell, store the command for reference
    metadata.operation = 'bash';
    if (args?.command) {
      metadata.bashCommand = args.command.slice(0, 200); // Store first 200 chars
    }
  } else if (toolName === 'file_change') {
    // Honor the per-change `kind` field so new-file creations and deletes
    // route to the correct renderer branch (NewFilePreview vs DiffViewer).
    // Codex's FileChangeItem carries `changes: [{ path, kind: 'add'|'update'|'delete' }]`.
    const changes = Array.isArray(args?.changes) ? args.changes : null;
    const matchingChange = changes && filePath
      ? changes.find((c: any) => c?.path === filePath) ?? changes[0]
      : changes?.[0];
    const kind = typeof matchingChange?.kind === 'string' ? matchingChange.kind : null;
    if (kind === 'add' || kind === 'create' || kind === 'new') {
      metadata.operation = 'create';
    } else if (kind === 'delete') {
      metadata.operation = 'delete';
    } else {
      metadata.operation = 'edit';
    }
  }

  // Try to extract line counts from result
  if (result && typeof result === 'object') {
    if (typeof result.linesAdded === 'number') {
      metadata.linesAdded = result.linesAdded;
    }
    if (typeof result.linesRemoved === 'number') {
      metadata.linesRemoved = result.linesRemoved;
    }
  }

  return metadata;
}

/**
 * Extract metadata for read files
 */
function extractReadMetadata(toolName: string, args: any, result: any): ReadFileMetadata {
  const metadata: ReadFileMetadata = {
    toolName
  };

  // Check if it was a partial read
  if (args) {
    metadata.wasPartial = !!(args.limit || args.offset);
  }

  // Try to extract bytes read from result
  if (result && typeof result === 'string') {
    metadata.bytesRead = Buffer.byteLength(result, 'utf8');
  }

  return metadata;
}

export class SessionFileTracker {
  private enabled = true;

  /**
   * Tracks files recently tracked as edited, keyed by
   * "sessionId:filePath:toolUseId".
   * Prevents duplicate session_files entries for the same tool invocation,
   * while allowing successive edits to the same file from different tool calls.
   */
  private recentEdits = new Map<string, number>();
  private readonly editDedupeMs = 5_000;
  private dedupeCounter = 0;

  private makeEditDedupeKey(sessionId: string, filePath: string, toolUseId?: string): string {
    // Use a monotonic counter when toolUseId is missing to avoid collisions
    // between distinct tool calls that both lack an ID.
    const id = toolUseId || `anon-${++this.dedupeCounter}`;
    return `${sessionId}:${filePath}:${id}`;
  }

  /**
   * Track a tool execution and create appropriate file links.
   * For edited files, also ensures a file watcher is attached to detect
   * subsequent changes (including changes from concurrent AI sessions or
   * external editors).
   *
   * @param sessionId - The AI session ID
   * @param workspaceId - The workspace path
   * @param toolName - Name of the tool that was executed
   * @param args - Tool arguments (used to extract file path)
   * @param result - Tool execution result
   * @param window - Optional BrowserWindow to attach file watchers for edited files
   */
  async trackToolExecution(
    sessionId: string,
    workspaceId: string,
    toolName: string,
    args: any,
    result: any,
    toolUseId?: string,
    window?: BrowserWindow | null
  ): Promise<void> {
    // console.log('[SessionFileTracker] trackToolExecution called:', { sessionId, workspaceId, toolName, enabled: this.enabled });

    if (!this.enabled) {
      // console.log('[SessionFileTracker] Tracking disabled, returning');
      return;
    }

    try {
      const linkType = getLinkTypeForTool(toolName);
      // console.log('[SessionFileTracker] Link type for tool:', { toolName, linkType });

      if (!linkType) {
        // Tool doesn't interact with files
        // console.log('[SessionFileTracker] Tool does not interact with files');
        return;
      }

      // Special handling for Codex file_change events - extract all affected files
      if (toolName === 'file_change') {
        const changes = args?.changes;
        if (!Array.isArray(changes) || changes.length === 0) {
          logger.main.debug('[SessionFileTracker] No changes found in file_change args');
          return;
        }
        let bypassCount = 0;
        for (const change of changes) {
          if (!change || typeof change.path !== 'string' || !change.path.trim()) continue;
          const changePath = normalizeToolFilePath(workspaceId, change.path, toolName);
          if (!changePath) {
            logger.main.warn(`[SessionFileTracker] Skipping ${toolName} path outside workspace: ${change.path}`);
            continue;
          }
          // Cap bypass additions at 10 per file_change tool call
          if (bypassCount < 10) {
            addGitignoreBypass(workspaceId, changePath);
            bypassCount++;
          }
          const normalizedArgs = {
            ...args,
            changes: [{
              ...change,
              path: changePath,
            }],
          };
          await this.trackSingleFile(sessionId, workspaceId, changePath, linkType, toolName, normalizedArgs, result, toolUseId, window);
        }
        return;
      }

      // Codex ACP apply_patch carries every affected file in `args.changes`,
      // an object keyed by absolute path (e.g. `{ "/abs/path.tsx": { type, unified_diff } }`).
      // mergeLocationPath only injects the first location into args.path, so
      // single-file extraction below would miss the rest of a multi-file patch.
      if (toolName === 'ApplyPatch' && args?.changes && typeof args.changes === 'object' && !Array.isArray(args.changes)) {
        const changeEntries = Object.entries(args.changes as Record<string, unknown>);
        if (changeEntries.length > 0) {
          let bypassCount = 0;
          for (const [changeFilePath, entry] of changeEntries) {
            if (!changeFilePath || typeof changeFilePath !== 'string' || !changeFilePath.trim()) continue;
            if (!entry || typeof entry !== 'object') continue;
            const changePath = changeFilePath.startsWith('/')
              ? changeFilePath
              : path.resolve(workspaceId, changeFilePath);
            if (bypassCount < 10) {
              addGitignoreBypass(workspaceId, changePath);
              bypassCount++;
            }
            await this.trackSingleFile(sessionId, workspaceId, changePath, linkType, toolName, args, result, toolUseId, window);
          }
          return;
        }
      }

      // Bash/shell commands are intentionally not parsed for file operations.
      // Watcher-based attribution is responsible for detecting and attributing
      // file edits caused by shell commands.
      if (toolName === 'Bash' || toolName === 'shell') {
        const rawCommand = args?.command;
        if (!rawCommand || typeof rawCommand !== 'string') {
          logger.main.debug('[SessionFileTracker] No command found in Bash args');
        }
        logger.main.debug('[SessionFileTracker] Skipping Bash file link extraction (watcher attribution only)');
        return;
      }

      // For non-Bash tools, extract single file path from args
      const filePath = extractFilePath(args);
      // console.log('[SessionFileTracker] Extracted file path:', { toolName, filePath, args });

      if (!filePath) {
        logger.main.debug(`[SessionFileTracker] No file path found in ${toolName} args`);
        // console.log('[SessionFileTracker] No file path found in args');
        return;
      }

      await this.trackSingleFile(sessionId, workspaceId, filePath, linkType, toolName, args, result, toolUseId, window);
    } catch (error) {
      logger.main.error('[SessionFileTracker] Failed to track tool execution:', error);
      console.error('[SessionFileTracker] Error details:', error);
      // Don't throw - tracking failures shouldn't break AI operations
    }
  }

  /**
   * Track a single file link
   * Extracted as a separate method to handle both single-file and multi-file tracking
   */
  private async trackSingleFile(
    sessionId: string,
    workspaceId: string,
    filePath: string,
    linkType: FileLinkType,
    toolName: string,
    args: any,
    result: any,
    toolUseId?: string,
    window?: BrowserWindow | null
  ): Promise<void> {
    // Normalize to absolute so we never persist a mix of absolute and
    // workspace-relative paths for the same file. The Edit/Write tools commonly
    // pass relative paths while watcher- and ApplyPatch-driven tracking pass
    // absolute paths; an inconsistent mix produces duplicate rows in the
    // FilesEditedSidebar tree.
    const normalizedFilePath = normalizeToolFilePath(workspaceId, filePath, toolName);
    if (!normalizedFilePath) {
      logger.main.warn(`[SessionFileTracker] Skipping ${toolName} path outside workspace: ${filePath}`);
      return;
    }
    filePath = normalizedFilePath;

    try {
      // Dedup: skip if this file+session was already tracked as edited recently.
      // This prevents duplicate session_files entries when tool events
      // for the same file arrive in quick succession.
      if (linkType === 'edited') {
        const dedupeKey = this.makeEditDedupeKey(sessionId, filePath, toolUseId);
        const trackedAt = this.recentEdits.get(dedupeKey);
        if (trackedAt != null) {
          const ageMs = Date.now() - trackedAt;
          if (ageMs <= this.editDedupeMs) {
            return; // already tracked recently, skip duplicate
          }
          this.recentEdits.delete(dedupeKey);
        }
      }

      // Register gitignore bypass for edited files so watcher events fire
      if (linkType === 'edited') {
        addGitignoreBypass(workspaceId, filePath);
      }

      // Prepare metadata based on link type
      let metadata: any = {};
      if (linkType === 'edited') {
        metadata = extractEditMetadata(toolName, args, result, filePath);
        if (toolUseId) {
          metadata.toolUseId = toolUseId;
        }

        // Ensure file watcher is attached for edited files
        // This is critical for detecting subsequent changes, even for files
        // beyond the 5000 file limit in the file tree
        if (window && !window.isDestroyed()) {
          try {
            await startFileWatcher(window, filePath);
          } catch (watchError) {
            // Log but don't fail - file watcher is not critical for tracking
            console.error(`[SessionFileTracker] Failed to start file watcher for ${filePath}:`, watchError);
          }
        } else {
          console.warn(`[SessionFileTracker] Cannot start file watcher - no valid window for: ${filePath}`);
        }

        // Refresh tracker items/metadata for the edited file
        // This ensures plan frontmatter and inline trackers (#bug, #task, etc.)
        // are immediately visible in the tracker UI
        const documentService = documentServices.get(workspaceId);
        if (documentService) {
          try {
            await documentService.refreshFileMetadata(filePath);
          } catch (refreshError) {
            // Log but don't fail - metadata refresh is not critical for tracking
            console.error(`[SessionFileTracker] Failed to refresh metadata for ${filePath}:`, refreshError);
          }
        } else {
          console.warn(`[SessionFileTracker] No document service found for workspace: ${workspaceId}`);
        }
      } else if (linkType === 'read') {
        metadata = extractReadMetadata(toolName, args, result);
      }

      // Add file link to database
      const addedLink = await SessionFilesRepository.addFileLink({
        sessionId,
        workspaceId,
        filePath,
        linkType,
        timestamp: Date.now(),
        metadata
      });

      // Record this file as recently tracked so subsequent calls from either
      // trackToolExecution paths don't create duplicates.
      if (linkType === 'edited') {
        const dedupeKey = this.makeEditDedupeKey(sessionId, filePath, toolUseId);
        this.recentEdits.set(dedupeKey, Date.now());
      }

      logger.main.debug(`[SessionFileTracker] Tracked ${linkType} link: ${filePath}`);
    } catch (error) {
      logger.main.error('[SessionFileTracker] Failed to track tool execution:', error);
      console.error('[SessionFileTracker] Error details:', error);
      // Don't throw - tracking failures shouldn't break AI operations
    }
  }

  /**
   * Track file references from user messages
   */
  async trackUserMessage(
    sessionId: string,
    workspaceId: string,
    messageContent: string,
    messageIndex: number
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const mentions = extractFileMentions(messageContent);

      for (const filePath of mentions) {
        // Resolve to absolute path if relative
        const resolvedPath = filePath.startsWith('/')
          ? filePath
          : `${workspaceId}/${filePath}`;

        // Only track if file exists
        if (!existsSync(resolvedPath)) {
          logger.main.debug(`[SessionFileTracker] Skipping non-existent @mention: ${filePath}`);
          continue;
        }

        const metadata: ReferencedFileMetadata = {
          mentionContext: messageContent.substring(0, 200), // Store first 200 chars for context
          messageIndex
        };

        await SessionFilesRepository.addFileLink({
          sessionId,
          workspaceId,
          filePath: resolvedPath,
          linkType: 'referenced',
          timestamp: Date.now(),
          metadata
        });

        logger.main.debug(`[SessionFileTracker] Tracked referenced file: ${resolvedPath}`);
      }
    } catch (error) {
      logger.main.error('[SessionFileTracker] Failed to track user message:', error);
      // Don't throw - tracking failures shouldn't break AI operations
    }
  }

  /**
   * Enable or disable file tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.main.info(`[SessionFileTracker] File tracking ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if tracking is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const sessionFileTracker = new SessionFileTracker();
