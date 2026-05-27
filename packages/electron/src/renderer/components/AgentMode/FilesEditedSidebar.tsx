/**
 * FilesEditedSidebar - Shows files edited by AI in the current workstream.
 *
 * Uses the FileEditsSidebar component from runtime with all its features:
 * - Smart folder collapse
 * - Git status indicators
 * - Pending review indicators
 * - Group by directory toggle
 * - Expand/collapse all controls
 *
 * Fetches file edits from the database for ALL sessions in the workstream.
 * Optionally allows filtering by a specific child session.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getWorktreeNameFromPath } from '../../utils/pathUtils';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { FileEditsSidebar as FileEditsSidebarComponent, MaterialSymbol } from '@nimbalyst/runtime';
import type { FileEditSummary } from '@nimbalyst/runtime';
import {
  diffTreeGroupByDirectoryAtom,
  setDiffTreeGroupByDirectoryAtom,
  agentFileScopeModeAtom,
  setAgentFileScopeModeAtom,
  type AgentFileScopeMode,
} from '../../store/atoms/projectState';
import { workstreamSessionsAtom } from '../../store/atoms/sessions';
import {
  hasExternalEditorAtom,
  externalEditorNameAtom,
  openInExternalEditorAtom,
  revealInFinderAtom,
  copyFilePathAtom,
} from '../../store/atoms/appSettings';
import { diffPeekSizeAtom, setDiffPeekSizeAtom } from '../../store/atoms/diffPeekSizeAtoms';
import {
  workstreamStagedFilesAtom,
  setWorkstreamStagedFilesAtom,
} from '../../store/atoms/workstreamState';
import {
  workstreamFileEditsWithActiveSessionAtom,
  workstreamGitStatusWithActiveSessionAtom,
  workstreamPendingReviewFilesWithActiveSessionAtom,
  workspaceUncommittedFilesAtom,
  worktreeChangedFilesAtom,
  workstreamSessionScopeKey,
  type FileEditWithSession,
} from '../../store/atoms/sessionFiles';
import { registerSessionWorkspace, registerWorktreePath, loadInitialSessionFileState } from '../../store/listeners/fileStateListeners';
import { isPathInWorkspace } from '../../../shared/pathUtils';
import { FilesScopeDropdown } from './FilesScopeDropdown';
import { GitOperationsPanel } from './GitOperationsPanel';
import { TodoPanel } from './TodoPanel';
import { TeammatePanel } from './TeammatePanel';
import { TrackerPanel } from './TrackerPanel';

interface FilesEditedSidebarProps {
  /** The workstream ID (parent session ID) - files from all child sessions will be shown */
  workstreamId: string;
  /** The currently active session ID within the workstream - used for AI commit requests */
  activeSessionId: string | null;
  workspacePath: string;
  onFileClick: (filePath: string) => void;
  /** Callback to open file in Files mode (switches to Files mode and opens the file) */
  onOpenInFilesMode?: (filePath: string) => void;
  width?: number;
  /** The worktree ID if this is a worktree session */
  worktreeId?: string | null;
  /** The worktree path if this is a worktree session */
  worktreePath?: string | null;
  /** Callback when worktree is archived */
  onWorktreeArchived?: () => void;
  /** Whether the workspace is a git repository */
  isGitRepo?: boolean;
}

interface GitDiscardChangesResult {
  success: boolean;
  discarded?: Array<{ filePath: string; absolutePath: string; kind?: 'tracked' | 'untracked' }>;
  skipped?: Array<{ filePath: string; absolutePath: string; reason?: string }>;
  errors?: Array<{ filePath: string; absolutePath: string; error?: string }>;
  error?: string;
}

const DecorativeMaterialSymbol: React.FC<React.ComponentProps<typeof MaterialSymbol>> = (props) => (
  <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
    <MaterialSymbol {...props} />
  </span>
);

export const FilesEditedSidebar: React.FC<FilesEditedSidebarProps> = React.memo(({
  workstreamId,
  activeSessionId,
  workspacePath,
  onFileClick,
  onOpenInFilesMode,
  width = 256,
  worktreeId,
  worktreePath,
  onWorktreeArchived,
  isGitRepo = false,
}) => {
  const effectiveWorkspacePath = worktreePath || workspacePath;
  // Get all session IDs in this workstream (must be declared before useEffects that use it)
  const workstreamSessions = useAtomValue(workstreamSessionsAtom(workstreamId));
  const scopedFileSessionIds = useMemo(() => {
    const sessionIds = new Set<string>(workstreamSessions);
    if (sessionIds.size === 0) {
      sessionIds.add(workstreamId);
    }
    if (activeSessionId) {
      sessionIds.add(activeSessionId);
    }
    return Array.from(sessionIds);
  }, [activeSessionId, workstreamId, workstreamSessions]);
  const sessionIdsForFileState = useMemo(() => {
    const sessionIds = new Set<string>([workstreamId]);
    scopedFileSessionIds.forEach(sessionId => sessionIds.add(sessionId));
    return Array.from(sessionIds);
  }, [workstreamId, scopedFileSessionIds]);
  const hasMultipleSessions = scopedFileSessionIds.length > 1;

  // Read all file/git data from atoms (NO local state, NO IPC subscriptions)
  // Use workstream atoms which combine ALL data from all child sessions
  // The filtering logic will filter down to specific sessions based on user selection
  const workstreamFileScopeKey = useMemo(
    () => workstreamSessionScopeKey(workstreamId, activeSessionId),
    [workstreamId, activeSessionId],
  );
  const allFileEdits = useAtomValue(workstreamFileEditsWithActiveSessionAtom(workstreamFileScopeKey));
  const sessionFilesGitStatus = useAtomValue(workstreamGitStatusWithActiveSessionAtom(workstreamFileScopeKey));
  const pendingReviewFiles = useAtomValue(workstreamPendingReviewFilesWithActiveSessionAtom(workstreamFileScopeKey));
  // For worktrees, use worktreePath; otherwise use main workspacePath
  const uncommittedFilesPath = worktreePath || workspacePath;
  const allUncommittedFiles = useAtomValue(workspaceUncommittedFilesAtom(uncommittedFilesPath));
  // Always call the hook unconditionally with a stable key, use empty array if no worktreeId
  const worktreeChangedFilesKey = worktreeId || '__no_worktree__';
  const worktreeChangedFilesRaw = useAtomValue(worktreeChangedFilesAtom(worktreeChangedFilesKey));
  const worktreeChangedFiles = worktreeId ? worktreeChangedFilesRaw : [];

  // UI state (keep in local state - this is fine)
  const [filterToCurrentSession, setFilterToCurrentSession] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [revertStatus, setRevertStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isWorkspaceCommittableFile = useCallback(
    (filePath: string) => isPathInWorkspace(filePath, effectiveWorkspacePath),
    [effectiveWorkspacePath]
  );

  const workspaceScopedFileEdits = useMemo(
    () => allFileEdits.filter((edit) => isWorkspaceCommittableFile(edit.filePath)),
    [allFileEdits, isWorkspaceCommittableFile]
  );

  // Register this session/worktree with central listener for state updates
  useEffect(() => {
    registerSessionWorkspace(workstreamId, effectiveWorkspacePath);
    if (worktreeId && worktreePath) {
      registerWorktreePath(worktreeId, worktreePath);
    }
  }, [workstreamId, effectiveWorkspacePath, worktreeId, worktreePath]);

  // Lazy load file state for all child sessions in the workstream
  useEffect(() => {
    // Debug logging - uncomment if needed
    // console.log('[FilesEditedSidebar] Loading file state for workstream', workstreamId, 'with', workstreamSessions.length, 'child sessions');

    sessionIdsForFileState.forEach(sessionId => {
      loadInitialSessionFileState(sessionId, effectiveWorkspacePath);
    });
  }, [workstreamId, effectiveWorkspacePath, sessionIdsForFileState]);

  // Group by directory state from Jotai
  const [groupByDirectory] = useAtom(diffTreeGroupByDirectoryAtom);
  const setDiffTreeGroupByDirectory = useSetAtom(setDiffTreeGroupByDirectoryAtom);

  // Staged files - used for checkbox state (per-workstream)
  // Checkboxes are always shown in the new unified design
  const stagedFilesArr = useAtomValue(workstreamStagedFilesAtom(workstreamId));
  const stagedFiles = useMemo(
    () => new Set(stagedFilesArr.filter((filePath) => isPathInWorkspace(filePath, effectiveWorkspacePath))),
    [stagedFilesArr, effectiveWorkspacePath]
  );
  const setStagedFilesAction = useSetAtom(setWorkstreamStagedFilesAtom);

  useEffect(() => {
    if (worktreeId) {
      return;
    }

    const sanitized = stagedFilesArr.filter((filePath) => isPathInWorkspace(filePath, effectiveWorkspacePath));
    if (sanitized.length !== stagedFilesArr.length) {
      setStagedFilesAction({ workstreamId, files: sanitized });
    }
  }, [effectiveWorkspacePath, stagedFilesArr, setStagedFilesAction, workstreamId, worktreeId]);

  // File scope mode for filtering what files to show (workspace-level setting)
  const fileScopeMode = useAtomValue(agentFileScopeModeAtom);
  const setFileScopeModeAction = useSetAtom(setAgentFileScopeModeAtom);

  // File action atoms
  const hasExternalEditor = useAtomValue(hasExternalEditorAtom);
  const externalEditorName = useAtomValue(externalEditorNameAtom);
  const openInExternalEditor = useSetAtom(openInExternalEditorAtom);
  const revealInFinder = useSetAtom(revealInFinderAtom);
  const copyFilePath = useSetAtom(copyFilePathAtom);

  // Diff peek popover (shared persisted size with the git extension and commit widget)
  const diffPeekSize = useAtomValue(diffPeekSizeAtom);
  const setDiffPeekSize = useSetAtom(setDiffPeekSizeAtom);
  const handleGetDiff = useCallback(async (filePath: string) => {
    const gitWorkspacePath = worktreePath || workspacePath;
    if (!gitWorkspacePath) return null;
    // Prefer session-aware diff (pre-edit baseline vs ai-edit snapshot) when an
    // active session has touched this file. Falls back to git's working-tree
    // diff when no session baseline exists. Without this, gitignored or
    // untracked files always render as fully-added (all green) because
    // git:file-diff synthesizes against /dev/null. See NIM-586.
    if (activeSessionId) {
      try {
        const sessionDiff = await window.electronAPI.invoke(
          'session:file-diff',
          gitWorkspacePath,
          activeSessionId,
          filePath,
        ) as { unifiedDiff: string; isBinary: boolean; source: string };
        if (sessionDiff?.unifiedDiff && sessionDiff.unifiedDiff.trim().length > 0) {
          return { unifiedDiff: sessionDiff.unifiedDiff, isBinary: sessionDiff.isBinary };
        }
      } catch {
        // Fall through to git diff on any session-diff failure.
      }
    }
    return await window.electronAPI.invoke(
      'git:file-diff',
      gitWorkspacePath,
      { path: filePath, group: 'working' as const }
    ) as { unifiedDiff: string; isBinary: boolean };
  }, [activeSessionId, worktreePath, workspacePath]);

  const setGroupByDirectory = useCallback((value: boolean) => {
    if (effectiveWorkspacePath) {
      setDiffTreeGroupByDirectory({ groupByDirectory: value, workspacePath: effectiveWorkspacePath });
    }
  }, [effectiveWorkspacePath, setDiffTreeGroupByDirectory]);

  const setFileScopeMode = useCallback((mode: AgentFileScopeMode) => {
    setFileScopeModeAction({ fileScopeMode: mode, workspacePath: effectiveWorkspacePath });
  }, [effectiveWorkspacePath, setFileScopeModeAction]);

  // Helper to check if a file has uncommitted git changes
  const isFileUncommitted = useCallback((filePath: string): boolean => {
    const effectiveWorkspacePath = worktreePath || workspacePath;
    let relativePath = filePath;
    if (filePath.startsWith(effectiveWorkspacePath)) {
      relativePath = filePath.slice(effectiveWorkspacePath.length + 1);
    }
    const status = sessionFilesGitStatus[relativePath];
    // File has uncommitted changes if it has a status and status is not 'unchanged'
    return status !== undefined && status.status !== 'unchanged';
  }, [sessionFilesGitStatus, workspacePath, worktreePath]);

  // Calculate total session files count (deduplicated by filepath)
  const totalSessionFilesCount = useMemo(() => {
    if (!allFileEdits.length) return 0;

    // Deduplicate by filePath (most recent edit wins)
    const fileMap = new Map<string, FileEditWithSession>();
    for (const edit of allFileEdits) {
      const existing = fileMap.get(edit.filePath);
      if (!existing || new Date(edit.timestamp) > new Date(existing.timestamp)) {
        fileMap.set(edit.filePath, edit);
      }
    }
    return fileMap.size;
  }, [allFileEdits]);

  // Filter file edits based on session scope and file scope mode
  const fileEdits = useMemo(() => {
    // First, filter by session scope
    let filtered: FileEditWithSession[];
    if (filterToCurrentSession && activeSessionId) {
      // Filter to current session only
      filtered = allFileEdits.filter(edit => edit.sessionId === activeSessionId);
    } else {
      // Show all files from workstream, deduplicated by filePath (most recent edit wins)
      const fileMap = new Map<string, FileEditWithSession>();
      for (const edit of allFileEdits) {
        const existing = fileMap.get(edit.filePath);
        if (!existing || new Date(edit.timestamp) > new Date(existing.timestamp)) {
          fileMap.set(edit.filePath, edit);
        }
      }
      filtered = Array.from(fileMap.values());
    }

    // Then, filter by file scope mode
    switch (fileScopeMode) {
      case 'current-changes':
        // Only show files that have uncommitted changes
        return filtered.filter(edit => isWorkspaceCommittableFile(edit.filePath) && isFileUncommitted(edit.filePath));

      case 'session-files':
        // Show all files from session(s)
        return filtered;

      case 'all-changes': {
        // Merge uncommitted session files with all other uncommitted files
        // For worktrees, use worktree changed files; for regular sessions, use workspace uncommitted files
        const uncommittedFiltered = filtered.filter(
          edit => isWorkspaceCommittableFile(edit.filePath) && isFileUncommitted(edit.filePath)
        );
        const sessionFilePaths = new Set(uncommittedFiltered.map(f => f.filePath));
        let additionalFiles: FileEditWithSession[];

        if (worktreeId && worktreePath) {
          // For worktrees: add worktree changed files that aren't already in session files
          // Note: worktreeChangedFiles may be empty, that's OK - we just show session files
          additionalFiles = worktreeChangedFiles
            .map(f => `${worktreePath}/${f.path}`) // Convert relative to absolute
            .filter(filePath => !sessionFilePaths.has(filePath))
            .map(filePath => ({
              filePath,
              linkType: 'edited' as const,
              timestamp: new Date().toISOString(),
              sessionId: '', // Not from a session
            }));
        } else {
          // For regular sessions: add uncommitted files from workspace that aren't in session files
          additionalFiles = allUncommittedFiles
            .filter(filePath => !sessionFilePaths.has(filePath))
            .map(filePath => ({
              filePath,
              linkType: 'edited' as const,
              timestamp: new Date().toISOString(),
              sessionId: '', // Not from a session
            }));
        }
        return [...uncommittedFiltered, ...additionalFiles];
      }

      default:
        return filtered;
    }
  }, [allFileEdits, filterToCurrentSession, activeSessionId, fileScopeMode, isWorkspaceCommittableFile, isFileUncommitted, allUncommittedFiles, worktreeId, worktreePath, worktreeChangedFiles]);

  const sessionOwnedUncommittedFiles = useMemo(() => {
    const seen = new Set<string>();
    const files: string[] = [];
    for (const edit of fileEdits) {
      if (!edit.sessionId || !isFileUncommitted(edit.filePath)) {
        continue;
      }
      if (!seen.has(edit.filePath)) {
        seen.add(edit.filePath);
        files.push(edit.filePath);
      }
    }
    return files;
  }, [fileEdits, isFileUncommitted]);

  // Memoize editedFiles array for GitOperationsPanel to prevent unnecessary re-renders
  const editedFilePaths = useMemo(() => {
    if (worktreeId) {
      // For worktrees, include worktree changed files
      return [...fileEdits.map((f) => f.filePath), ...worktreeChangedFiles.map(f => f.path)];
    }
    return fileEdits
      .map((f) => f.filePath)
      .filter((filePath) => isWorkspaceCommittableFile(filePath));
  }, [fileEdits, isWorkspaceCommittableFile, worktreeId, worktreeChangedFiles]);

  // Helper to convert absolute path to relative path for worktree comparisons
  const toRelativePath = useCallback((absolutePath: string) => {
    if (worktreePath && absolutePath.startsWith(worktreePath)) {
      return absolutePath.slice(worktreePath.length + 1);
    }
    return absolutePath;
  }, [worktreePath]);

  // For worktrees: compute the set of staged files from worktreeChangedFiles
  // Convert relative paths to absolute for matching with fileEdits
  const worktreeStagedFiles = useMemo(() => {
    if (!worktreeId || !worktreePath) return new Set<string>();
    // Return absolute paths so they match the selectedFiles expected by FileEditsSidebarComponent
    return new Set(worktreeChangedFiles.filter(f => f.staged).map(f => `${worktreePath}/${f.path}`));
  }, [worktreeId, worktreePath, worktreeChangedFiles]);

  const selectedSessionOwnedUncommittedFiles = useMemo(() => {
    return sessionOwnedUncommittedFiles.filter(filePath => stagedFiles.has(filePath) || worktreeStagedFiles.has(filePath));
  }, [sessionOwnedUncommittedFiles, stagedFiles, worktreeStagedFiles]);


  // Handle worktree file staging toggle
  const handleWorktreeToggleStaged = useCallback(async (filePath: string) => {
    if (!worktreePath || !worktreeId) {
      return;
    }

    try {
      // Convert to relative path if absolute
      const relativePath = toRelativePath(filePath);
      const file = worktreeChangedFiles.find(f => f.path === relativePath);
      if (!file) {
        // File not in worktreeChangedFiles (e.g., from "All Uncommitted Files"), stage it directly
        await window.electronAPI.invoke('worktree:stage-file', worktreePath, relativePath, true);
        return;
      }

      const newStaged = !file.staged;
      await window.electronAPI.invoke('worktree:stage-file', worktreePath, relativePath, newStaged);

      // Refresh worktree state from backend - the atom will be updated by the IPC call
      // which triggers a git:status-changed event, handled by central listener
    } catch (error) {
      console.error('[FilesEditedSidebar] Failed to toggle worktree file staging:', error);
    }
  }, [worktreePath, worktreeId, worktreeChangedFiles, toRelativePath]);

  // Handle worktree stage all / unstage all
  const handleWorktreeToggleAllStaged = useCallback(async (stage: boolean) => {
    if (!worktreePath || !worktreeId) return;

    try {
      await window.electronAPI.invoke('worktree:stage-all', worktreePath, stage);

      // Worktree state will be updated by the git:status-changed event from central listener
    } catch (error) {
      console.error('[FilesEditedSidebar] Failed to toggle all worktree file staging:', error);
    }
  }, [worktreePath, worktreeId]);

  // Handle file selection change (checkbox toggle)
  // For worktrees, this stages/unstages the file in git
  // For regular sessions, this updates the workstream staged files state
  const handleSelectionChange = useCallback((filePath: string, selected: boolean) => {
    if (worktreeId && worktreePath) {
      // For worktrees, use git staging
      handleWorktreeToggleStaged(filePath);
    } else {
      // For regular sessions, use workstream state
      const newFiles = selected
        ? [...stagedFilesArr, filePath]
        : stagedFilesArr.filter(f => f !== filePath);
      setStagedFilesAction({ workstreamId, files: newFiles });
    }
  }, [worktreeId, worktreePath, stagedFilesArr, setStagedFilesAction, workstreamId, handleWorktreeToggleStaged]);

  // Handle select all files
  const handleSelectAll = useCallback((selected: boolean) => {
    if (worktreeId && worktreePath) {
      // For worktrees, stage/unstage all files
      handleWorktreeToggleAllStaged(selected);
    } else {
      // For regular sessions, use workstream state
      if (selected) {
        setStagedFilesAction({ workstreamId, files: editedFilePaths });
      } else {
        setStagedFilesAction({ workstreamId, files: [] });
      }
    }
  }, [worktreeId, worktreePath, editedFilePaths, setStagedFilesAction, workstreamId, handleWorktreeToggleAllStaged]);

  // Handle bulk selection change (for folder checkboxes)
  const handleBulkSelectionChange = useCallback(async (filePaths: string[], selected: boolean) => {
    if (worktreeId && worktreePath) {
      // For worktrees, stage/unstage each file individually
      for (const filePath of filePaths) {
        const relativePath = toRelativePath(filePath);
        const file = worktreeChangedFiles.find(f => f.path === relativePath);
        if (file && file.staged !== selected) {
          await window.electronAPI.invoke('worktree:stage-file', worktreePath, relativePath, selected);
        }
      }
      // Worktree state will be updated by the git:status-changed event from central listener
    } else {
      // For regular sessions, use workstream state
      const currentSet = new Set(stagedFilesArr);
      if (selected) {
        filePaths.forEach(fp => currentSet.add(fp));
      } else {
        filePaths.forEach(fp => currentSet.delete(fp));
      }
      setStagedFilesAction({ workstreamId, files: Array.from(currentSet) });
    }
  }, [worktreeId, worktreePath, worktreeChangedFiles, stagedFilesArr, setStagedFilesAction, workstreamId, toRelativePath]);

  // NOTE: Git status pruning of committed files is now handled by central listener in fileStateListeners.ts

  // NOTE: File edits are now loaded and updated by central listener in fileStateListeners.ts

  // NOTE: Git status is now loaded and updated by central listener in fileStateListeners.ts

  // NOTE: Uncommitted files are now loaded and updated by central listener in fileStateListeners.ts

  // NOTE: Worktree changed files are now loaded and updated by central listener in fileStateListeners.ts

  // NOTE: Session file updates are now handled by central listener in fileStateListeners.ts

  // NOTE: Pending review files are now loaded and updated by central listener in fileStateListeners.ts

  // NOTE: Pending review file updates are now handled by central listener in fileStateListeners.ts

  // Handle "Keep All" button click - clear pending for all sessions in workstream
  const handleKeepAll = useCallback(async () => {
    if (!workspacePath || isClearing || sessionIdsForFileState.length === 0) return;

    setIsClearing(true);
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        // Clear pending for all sessions in the workstream
        await Promise.all(
          sessionIdsForFileState.map(async (sessionId) => {
            await (window as any).electronAPI.history.clearPendingForSession(workspacePath, sessionId);
          })
        );
        // Pending files state will be updated via the event listener
      }
    } catch (error) {
      console.error('[FilesEditedSidebar] Failed to clear pending for workstream:', error);
    } finally {
      setIsClearing(false);
    }
  }, [workspacePath, sessionIdsForFileState, isClearing]);

  const handleRevertSelected = useCallback(async () => {
    const gitWorkspacePath = worktreePath || workspacePath;
    if (!gitWorkspacePath || selectedSessionOwnedUncommittedFiles.length === 0 || isReverting) {
      return;
    }

    const confirmed = window.confirm(
      [
        `Revert ${selectedSessionOwnedUncommittedFiles.length} selected agent-owned file${selectedSessionOwnedUncommittedFiles.length === 1 ? '' : 's'}?`,
        'Tracked changes will be restored from git. Untracked files will be removed.',
      ].join('\n\n')
    );
    if (!confirmed) {
      return;
    }

    setIsReverting(true);
    setRevertStatus(null);
    try {
      const result = await window.electronAPI.invoke(
        'git:discard-changes',
        gitWorkspacePath,
        selectedSessionOwnedUncommittedFiles,
      ) as GitDiscardChangesResult;

      if (result.success) {
        const discardedFiles = new Set((result.discarded ?? []).map(file => file.absolutePath));
        if (!worktreeId && discardedFiles.size > 0) {
          setStagedFilesAction({
            workstreamId,
            files: stagedFilesArr.filter(file => !discardedFiles.has(file)),
          });
        }
        const discardedCount = result.discarded?.length ?? 0;
        const skippedCount = result.skipped?.length ?? 0;
        setRevertStatus({
          type: 'success',
          message: skippedCount > 0
            ? `Reverted ${discardedCount}; skipped ${skippedCount} unchanged.`
            : `Reverted ${discardedCount} file${discardedCount === 1 ? '' : 's'}.`,
        });
      } else {
        const firstError = result.error || result.errors?.[0]?.error || 'Unknown git discard failure';
        setRevertStatus({
          type: 'error',
          message: `Revert failed: ${firstError}`,
        });
      }
    } catch (error) {
      console.error('[FilesEditedSidebar] Failed to revert selected files:', error);
      setRevertStatus({
        type: 'error',
        message: `Revert failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsReverting(false);
    }
  }, [
    isReverting,
    selectedSessionOwnedUncommittedFiles,
    setStagedFilesAction,
    stagedFilesArr,
    workstreamId,
    workspacePath,
    worktreeId,
    worktreePath,
  ]);

  // Context menu handlers
  const handleOpenInFiles = useCallback((filePath: string) => {
    // Navigate to the file in Files mode (main editor)
    if (onOpenInFilesMode) {
      onOpenInFilesMode(filePath);
    } else {
      // Fallback to opening in agent mode if no Files mode handler provided
      onFileClick(filePath);
    }
  }, [onOpenInFilesMode, onFileClick]);

  const handleViewDiff = useCallback(async (filePath: string) => {
    // Open diff view for the file
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        await window.electronAPI.invoke('file:open-diff', filePath, workspacePath);
      } catch (error) {
        console.error('[FilesEditedSidebar] Failed to open diff:', error);
      }
    }
  }, [workspacePath]);

  const handleCopyPath = useCallback((filePath: string) => {
    copyFilePath(filePath);
  }, [copyFilePath]);

  const handleRevealInFinder = useCallback((filePath: string) => {
    revealInFinder(filePath);
  }, [revealInFinder]);

  const handleOpenInExternalEditor = useCallback((filePath: string) => {
    openInExternalEditor(filePath);
  }, [openInExternalEditor]);

  const handleShowSessionFiles = useCallback(() => {
    // Switch to session-files mode
    setFileScopeMode('session-files');
  }, [setFileScopeMode]);

  const handleShowAllUncommitted = useCallback(() => {
    // Switch to all-changes mode
    setFileScopeMode('all-changes');
  }, [setFileScopeMode]);

  return (
    <div
      className="files-edited-sidebar agent-elements-files-edited-agent-mode agent-elements-edit-panel flex h-full shrink-0 flex-col bg-[var(--an-tool-background)] text-[var(--an-tool-color)]"
      data-agent-elements-shell="agent-mode-files-edited"
      data-component="FilesEditedSidebar"
      data-testid="agent-elements-agent-mode-files-edited-sidebar"
      style={{ width }}
    >
      {/* Header with scope dropdown and controls */}
      <div
        className="files-edited-sidebar__header agent-elements-files-edited-header flex shrink-0 items-center gap-2 border-b border-[var(--an-border-color)] bg-[var(--an-tool-background)] px-3 py-2"
        data-agent-elements-shell="files-edited-header"
        data-testid="agent-elements-files-edited-header"
      >
        <FilesScopeDropdown
          fileScopeMode={fileScopeMode}
          onFileScopeModeChange={setFileScopeMode}
          hasMultipleSessions={hasMultipleSessions}
          activeSessionId={activeSessionId}
          filterToCurrentSession={filterToCurrentSession}
          onFilterToCurrentSessionChange={setFilterToCurrentSession}
          groupByDirectory={groupByDirectory}
          onGroupByDirectoryChange={setGroupByDirectory}
          isWorktree={!!worktreeId}
          workstreamSessionCount={scopedFileSessionIds.length}
          worktreeName={worktreePath ? getWorktreeNameFromPath(worktreePath) : undefined}
        />
        {/* Spacer to push controls to the right */}
        <div className="flex-1" />
        {/* Expand/Collapse controls */}
        <div
          className="files-edited-sidebar__controls agent-elements-files-edited-controls flex gap-1 shrink-0"
          data-agent-elements-shell="files-edited-controls"
        >
          <button
            onClick={handleRevertSelected}
            disabled={isReverting || selectedSessionOwnedUncommittedFiles.length === 0}
            data-testid="files-edited-revert-selected"
            className="files-edited-sidebar__control-btn flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--an-radius-xs)] border-none bg-transparent text-[var(--an-tool-color-muted)] transition-colors hover:enabled:bg-[var(--an-background-tertiary)] hover:enabled:text-[var(--an-diff-removed-text)] disabled:cursor-default disabled:text-[var(--an-foreground-subtle)] disabled:opacity-50"
            title={
              selectedSessionOwnedUncommittedFiles.length > 0
                ? `Revert ${selectedSessionOwnedUncommittedFiles.length} selected agent-owned file${selectedSessionOwnedUncommittedFiles.length === 1 ? '' : 's'}`
                : 'Select agent-owned uncommitted files to revert'
            }
          >
            <DecorativeMaterialSymbol icon={isReverting ? 'progress_activity' : 'undo'} size={16} />
          </button>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('file-edits-sidebar:expand-all'));
            }}
            disabled={!groupByDirectory}
            className="files-edited-sidebar__control-btn agent-elements-files-edited-control flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--an-radius-xs)] border-none bg-transparent text-[var(--an-tool-color-muted)] transition-colors hover:enabled:bg-[var(--an-background-tertiary)] hover:enabled:text-[var(--an-tool-color)] disabled:cursor-default disabled:text-[var(--an-foreground-subtle)] disabled:opacity-50"
            title="Expand all"
          >
            <DecorativeMaterialSymbol icon="unfold_more" size={16} />
          </button>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('file-edits-sidebar:collapse-all'));
            }}
            disabled={!groupByDirectory}
            className="files-edited-sidebar__control-btn agent-elements-files-edited-control flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--an-radius-xs)] border-none bg-transparent text-[var(--an-tool-color-muted)] transition-colors hover:enabled:bg-[var(--an-background-tertiary)] hover:enabled:text-[var(--an-tool-color)] disabled:cursor-default disabled:text-[var(--an-foreground-subtle)] disabled:opacity-50"
            title="Collapse all"
          >
            <DecorativeMaterialSymbol icon="unfold_less" size={16} />
          </button>
        </div>
      </div>

      {/* Keep All button - show when there are pending files (only in non-git repos) */}
      {!isGitRepo && pendingReviewFiles.size > 0 && (
        <div
          className="files-edited-sidebar__keep-all-banner agent-elements-files-edited-review-banner agent-elements-edit-approval flex shrink-0 items-center justify-between border-b border-[color-mix(in_srgb,var(--an-warning-color)_30%,transparent)] bg-[color-mix(in_srgb,var(--an-warning-color)_10%,var(--an-background))] px-3 py-2"
          data-agent-elements-shell="files-edited-review-banner"
          data-testid="agent-elements-files-edited-review-banner"
        >
          <div className="files-edited-sidebar__keep-all-info flex items-center gap-2">
            <DecorativeMaterialSymbol icon="rate_review" size={16} className="files-edited-sidebar__keep-all-icon text-[var(--an-warning-color)]" />
            <span className="files-edited-sidebar__keep-all-text text-xs font-medium text-[var(--an-warning-color)]">
              <span
                className="files-edited-sidebar__keep-all-count agent-elements-status-pill font-semibold"
                data-testid="agent-elements-files-edited-review-count"
                data-tone="warning"
              >
                {pendingReviewFiles.size}
              </span>
              {' '}file{pendingReviewFiles.size !== 1 ? 's' : ''} pending review
            </span>
          </div>
          <button
            className="files-edited-sidebar__keep-all-btn agent-elements-files-edited-keep-all flex cursor-pointer items-center gap-1 rounded-[var(--an-radius-sm)] border border-[var(--an-warning-color)] bg-transparent px-2.5 py-1 font-inherit text-[11px] font-medium text-[var(--an-warning-color)] transition-colors hover:enabled:bg-[color-mix(in_srgb,var(--an-warning-color)_15%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleKeepAll}
            disabled={isClearing}
            title="Accept all pending AI changes"
          >
            <DecorativeMaterialSymbol icon="check_circle" size={14} />
            {isClearing ? 'Keeping...' : 'Keep All'}
          </button>
        </div>
      )}

      {revertStatus && (
        <div
          data-testid="files-edited-revert-status"
          className={`files-edited-sidebar__revert-status px-3 py-2 border-b text-[11px] shrink-0 ${
            revertStatus.type === 'success'
              ? 'bg-[color-mix(in_srgb,var(--an-success-color)_10%,var(--an-background))] border-[color-mix(in_srgb,var(--an-success-color)_30%,transparent)] text-[var(--an-success-color)]'
              : 'bg-[color-mix(in_srgb,var(--an-diff-removed-text)_10%,var(--an-background))] border-[color-mix(in_srgb,var(--an-diff-removed-text)_30%,transparent)] text-[var(--an-diff-removed-text)]'
          }`}
        >
          {revertStatus.message}
        </div>
      )}

      {/* Files Content */}
      <div
        className="files-edited-sidebar__content agent-elements-files-edited-content flex-1 overflow-hidden flex flex-col"
        data-agent-elements-shell="files-edited-content"
        data-testid="agent-elements-files-edited-content"
      >
        <div className="flex-1 overflow-auto">
          <FileEditsSidebarComponent
            fileEdits={fileEdits}
            onFileClick={onFileClick}
            workspacePath={worktreePath || workspacePath}
            pendingReviewFiles={pendingReviewFiles}
            groupByDirectory={groupByDirectory}
            onGroupByDirectoryChange={setGroupByDirectory}
            hideControls
            onOpenInFiles={handleOpenInFiles}
            onCopyPath={handleCopyPath}
            onRevealInFinder={handleRevealInFinder}
            onOpenInExternalEditor={hasExternalEditor ? handleOpenInExternalEditor : undefined}
            externalEditorName={externalEditorName}
            showCheckboxes={true}
            selectedFiles={worktreeId ? worktreeStagedFiles : stagedFiles}
            onSelectionChange={handleSelectionChange}
            isFileSelectable={isWorkspaceCommittableFile}
            onSelectAll={handleSelectAll}
            onBulkSelectionChange={handleBulkSelectionChange}
            totalSessionFilesCount={totalSessionFilesCount}
            onShowSessionFiles={handleShowSessionFiles}
            totalUncommittedCount={worktreeId ? worktreeChangedFiles.length : allUncommittedFiles.length}
            onShowAllUncommitted={handleShowAllUncommitted}
            scopeMode={fileScopeMode}
            onGetDiff={isGitRepo ? handleGetDiff : undefined}
            diffPeekWidth={diffPeekSize?.width}
            diffPeekHeight={diffPeekSize?.height}
            onDiffPeekResize={setDiffPeekSize}
          />
        </div>
      </div>

      {/* Git Operations Panel */}
      <GitOperationsPanel
        workspacePath={workspacePath}
        workstreamId={workstreamId}
        sessionId={activeSessionId || workstreamId}
        editedFiles={editedFilePaths}
        worktreeId={worktreeId}
        worktreePath={worktreePath}
        onWorktreeArchived={onWorktreeArchived}
        onFileClick={onFileClick}
      />

      {/* Todo Panel - shows agent's current tasks */}
      {activeSessionId && (
        <TodoPanel sessionId={activeSessionId} />
      )}

      {/* Teammate Panel - shows agent's current teammates */}
      {activeSessionId && (
        <TeammatePanel sessionId={activeSessionId} />
      )}

      {/* Tracker Panel - shows tracker items linked by the agent */}
      <TrackerPanel workstreamId={workstreamId} />
    </div>
  );
});

FilesEditedSidebar.displayName = 'FilesEditedSidebar';
