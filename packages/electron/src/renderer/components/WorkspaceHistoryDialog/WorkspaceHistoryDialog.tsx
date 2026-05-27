import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useHistory } from '../../hooks/useHistory';
import { DiffPreviewEditor, type DiffNavigationState } from '../HistoryDialog/DiffPreviewEditor';
import { TextDiffViewer, type TextDiffNavigationState } from '../HistoryDialog/TextDiffViewer';
import { MonacoDiffViewer } from '../HistoryDialog/MonacoDiffViewer';
import { getFileType, type EditorType } from '../../utils/fileTypeDetector';
import { getFileName } from '../../utils/pathUtils';
import { WorkspaceHistoryFileTree } from './WorkspaceHistoryFileTree';

interface WorkspaceFile {
  path: string;
  latestTimestamp: number;
  snapshotCount: number;
  exists: boolean;
}

interface WorkspaceHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  onFileRestored?: () => void;
  theme?: string;
}

const backdropClass =
  'workspace-history-dialog-overlay agent-elements-workspace-history-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] p-[var(--an-spacing-xxl)]';
const dialogClass =
  'workspace-history-dialog agent-elements-workspace-history-dialog agent-elements-tool-card flex h-[min(80vh,800px)] w-[min(90vw,1200px)] flex-col overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)] @container/workspace-history';
const headerClass =
  'workspace-history-dialog-header agent-elements-workspace-history-header flex items-center justify-between gap-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]';
const titleClass = 'workspace-history-dialog-title flex min-w-0 items-center gap-[var(--an-spacing-md)]';
const titleIconClass =
  'agent-elements-workspace-history-header-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]';
const closeButtonClass =
  'workspace-history-dialog-close agent-elements-workspace-history-close inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';
const contentClass = 'workspace-history-dialog-content flex min-h-0 flex-1 overflow-hidden';
const filePanelClass =
  'workspace-history-file-panel agent-elements-workspace-history-file-panel flex w-[min(36vw,350px)] min-w-[260px] flex-col border-r border-[var(--an-border-color)] bg-[var(--an-background-secondary)] @max-[760px]/workspace-history:w-[300px]';
const panelHeaderClass =
  'workspace-history-file-panel-header agent-elements-workspace-history-file-panel-header flex min-h-11 items-center justify-between gap-[var(--an-spacing-sm)] border-b border-[var(--an-border-color)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-xs font-medium text-[var(--an-foreground-muted)]';
const previewPanelClass =
  'workspace-history-preview-panel agent-elements-workspace-history-preview-panel flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--an-background)]';
const previewHeaderClass =
  'workspace-history-preview-header agent-elements-workspace-history-preview-header flex min-h-[48px] items-center justify-between gap-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-sm)]';
const previewHeaderLeftClass =
  'workspace-history-preview-header-left flex min-w-0 flex-1 items-center gap-[var(--an-spacing-sm)]';
const actionsClass = 'workspace-history-header-buttons flex shrink-0 items-center gap-[var(--an-spacing-sm)]';
const buttonBaseClass =
  'agent-elements-workspace-history-button inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] whitespace-nowrap rounded-[var(--an-input-border-radius)] border px-3.5 py-1.5 text-xs font-medium transition-[background-color,border-color,color,opacity] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';
const primaryButtonClass =
  `${buttonBaseClass} border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-send-button-color)] hover:border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]`;
const snapshotListClass =
  'workspace-history-snapshot-list nim-scrollbar max-h-[200px] overflow-y-auto border-b border-[var(--an-border-color)] bg-[var(--an-background)]';
const snapshotItemBaseClass =
  'workspace-history-snapshot-item agent-elements-workspace-history-snapshot-item flex cursor-pointer items-center gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-sm)] last:border-b-0 transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-[-2px]';
const snapshotItemSelectedClass =
  'selected border-[color-mix(in_srgb,var(--an-primary-color)_22%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_8%,var(--an-background))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--an-primary-color)_12%,transparent)]';
const snapshotIconBaseClass =
  'workspace-history-snapshot-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--an-small-border-radius)] border';
const previewAreaClass =
  'workspace-history-preview-area nim-scrollbar flex flex-1 flex-col overflow-auto bg-[var(--an-background)]';
const diffHeaderClass =
  'workspace-history-diff-header agent-elements-workspace-history-diff-header flex flex-wrap items-center gap-[var(--an-spacing-sm)] border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-sm)]';
const diffLabelClass =
  'workspace-history-diff-label rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2 py-0.5 text-[11px] font-medium';
const diffModeToggleClass =
  'workspace-history-diff-mode-toggle agent-elements-workspace-history-diff-mode-toggle ml-auto flex gap-[var(--an-spacing-xxs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-xxs)]';
const diffModeButtonBaseClass =
  'workspace-history-diff-mode-button cursor-pointer rounded-[calc(var(--an-input-border-radius)_-_4px)] border border-transparent px-3 py-1 text-[11px] font-medium transition-[background-color,border-color,color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-1';
const diffModeButtonActiveClass =
  'active border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-send-button-color)]';
const diffModeButtonIdleClass =
  'text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]';
const loadingClass =
  'workspace-history-preview-loading flex flex-1 flex-col items-center justify-center gap-[var(--an-spacing-lg)] p-10 text-[13px] text-[var(--an-foreground-muted)]';
const loadingSpinnerClass =
  'workspace-history-preview-loading-spinner h-6 w-6 rounded-full border-2 border-[var(--an-border-color)] border-t-[var(--an-primary-color)] motion-safe:animate-spin';
const emptyStateClass =
  'workspace-history-no-file-selected agent-elements-workspace-history-empty-preview flex flex-1 flex-col items-center justify-center gap-[var(--an-spacing-md)] px-[var(--an-spacing-xxl)] text-center text-[var(--an-foreground-subtle)]';

function DecorativeMaterialSymbol({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className ?? ''}`}>
      {icon}
    </span>
  );
}

export function WorkspaceHistoryDialog({
  isOpen,
  onClose,
  workspacePath,
  onFileRestored,
  theme = 'light'
}: WorkspaceHistoryDialogProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedDeletedFiles, setSelectedDeletedFiles] = useState<Set<string>>(new Set());
  const [isRestoring, setIsRestoring] = useState(false);

  // History for selected file
  const { snapshots, loading: snapshotsLoading, refreshSnapshots, loadSnapshot, deleteSnapshot } = useHistory(selectedFilePath);

  // Snapshot selection state
  const [selectedSnapshotTimestamp, setSelectedSnapshotTimestamp] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<'rich' | 'text'>('rich');
  const [versionAContent, setVersionAContent] = useState<string>('');
  const [versionBContent, setVersionBContent] = useState<string>('');
  const [versionAMeta, setVersionAMeta] = useState<{ type: string; timestamp: string } | null>(null);
  const [versionBMeta, setVersionBMeta] = useState<{ type: string; timestamp: string } | null>(null);
  const [navigationState, setNavigationState] = useState<DiffNavigationState | TextDiffNavigationState | null>(null);

  const fileType: EditorType = useMemo(() => {
    return selectedFilePath ? getFileType(selectedFilePath) : 'markdown';
  }, [selectedFilePath]);

  // Load workspace files on open
  useEffect(() => {
    if (isOpen && workspacePath) {
      loadWorkspaceFiles();
    }
  }, [isOpen, workspacePath]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setFiles([]);
      setSelectedFilePath(null);
      setSelectedDeletedFiles(new Set());
      setSelectedSnapshotTimestamp(null);
      setPreviewContent('');
      setDiffMode(false);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Load snapshots when file is selected
  useEffect(() => {
    if (selectedFilePath) {
      refreshSnapshots();
      setSelectedSnapshotTimestamp(null);
      setPreviewContent('');
      setDiffMode(false);
    }
  }, [selectedFilePath, refreshSnapshots]);

  const loadWorkspaceFiles = async () => {
    setLoading(true);
    try {
      // Get all files with history
      const filesWithHistory = await window.electronAPI.invoke('history:list-workspace-files', workspacePath);

      if (filesWithHistory.length === 0) {
        setFiles([]);
        setLoading(false);
        return;
      }

      // Check which files exist
      const filePaths = filesWithHistory.map((f: any) => f.path);
      const existsMap = await window.electronAPI.invoke('history:check-files-exist', filePaths);

      // Combine data
      const filesWithExistence: WorkspaceFile[] = filesWithHistory.map((f: any) => ({
        path: f.path,
        latestTimestamp: f.latestTimestamp,
        snapshotCount: f.snapshotCount,
        exists: existsMap[f.path] ?? false
      }));

      setFiles(filesWithExistence);
    } catch (error) {
      console.error('[WorkspaceHistoryDialog] Failed to load workspace files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFilePath(filePath);
  };

  const handleDeletedFileToggle = (filePath: string, checked: boolean) => {
    setSelectedDeletedFiles(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(filePath);
      } else {
        next.delete(filePath);
      }
      return next;
    });
  };

  const handleSnapshotSelect = async (timestamp: string, index: number) => {
    setSelectedSnapshotTimestamp(timestamp);

    const previousSnapshot = snapshots[index + 1];

    if (previousSnapshot) {
      await loadDiffMode(previousSnapshot.timestamp, timestamp);
    } else {
      // No previous version - just show the content
      setDiffMode(false);
      setLoadingPreview(true);
      try {
        const content = await loadSnapshot(timestamp);
        if (content) {
          setPreviewContent(content);
        }
      } catch (error) {
        console.error('Failed to load snapshot:', error);
        setPreviewContent('Failed to load snapshot');
      } finally {
        setLoadingPreview(false);
      }
    }
  };

  const loadDiffMode = async (olderTimestamp: string, newerTimestamp: string) => {
    setLoadingPreview(true);
    try {
      const indexOlder = snapshots.findIndex(s => s.timestamp === olderTimestamp);
      const indexNewer = snapshots.findIndex(s => s.timestamp === newerTimestamp);

      let actualOlderTimestamp = olderTimestamp;
      let actualNewerTimestamp = newerTimestamp;

      if (indexOlder < indexNewer) {
        actualOlderTimestamp = newerTimestamp;
        actualNewerTimestamp = olderTimestamp;
      }

      const snapshotA = snapshots.find(s => s.timestamp === actualOlderTimestamp);
      const snapshotB = snapshots.find(s => s.timestamp === actualNewerTimestamp);

      const [contentA, contentB] = await Promise.all([
        loadSnapshot(actualOlderTimestamp),
        loadSnapshot(actualNewerTimestamp),
      ]);

      if (contentA && contentB && snapshotA && snapshotB) {
        setVersionAContent(contentA);
        setVersionBContent(contentB);
        setVersionAMeta({ type: snapshotA.type, timestamp: snapshotA.timestamp });
        setVersionBMeta({ type: snapshotB.type, timestamp: snapshotB.timestamp });
        setPreviewContent(contentB);
        setDiffMode(true);
        setLoadingPreview(false);
      }
    } catch (error) {
      console.error('Failed to load snapshots for diff:', error);
      setLoadingPreview(false);
    }
  };

  const handleRestoreVersion = async () => {
    if (!selectedFilePath || !selectedSnapshotTimestamp) return;

    const selectedFile = files.find(f => f.path === selectedFilePath);
    const isDeleted = selectedFile && !selectedFile.exists;

    if (isDeleted) {
      const confirmed = window.confirm(
        'This file has been deleted. Restoring will recreate the file on disk. Continue?'
      );
      if (!confirmed) return;
    }

    setIsRestoring(true);
    try {
      const result = await window.electronAPI.invoke(
        'history:restore-deleted-file',
        selectedFilePath,
        selectedSnapshotTimestamp
      );

      if (result.success) {
        // Refresh file list to update exists status
        await loadWorkspaceFiles();
        onFileRestored?.();
      } else {
        alert(`Failed to restore file: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Failed to restore file:', error);
      alert(`Failed to restore file: ${error.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleBatchRestore = async () => {
    if (selectedDeletedFiles.size === 0) return;

    const count = selectedDeletedFiles.size;
    const confirmed = window.confirm(
      `Restore ${count} deleted file${count > 1 ? 's' : ''} to their most recent versions?`
    );
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const filePaths = Array.from(selectedDeletedFiles);
      const results = await window.electronAPI.invoke('history:batch-restore-deleted-files', filePaths);

      const successful = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success);

      if (failed.length > 0) {
        const failedNames = failed.map((r: any) => getFileName(r.path)).join(', ');
        alert(`Restored ${successful} file${successful !== 1 ? 's' : ''}. Failed: ${failedNames}`);
      }

      // Clear selection and refresh
      setSelectedDeletedFiles(new Set());
      await loadWorkspaceFiles();
      onFileRestored?.();
    } catch (error: any) {
      console.error('Failed to batch restore:', error);
      alert(`Failed to restore files: ${error.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }

    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatVersionLabel = (type: string, timestamp: string) => {
    const typeLabel = type === 'ai-diff' ? 'AI Edit'
      : type === 'pre-apply' ? 'Pre-edit'
      : type === 'pre-edit' ? 'AI Session Start'
      : type === 'incremental-approval' ? 'Partial Review'
      : type === 'manual' ? 'Manual Save'
      : type === 'auto-save' ? 'Auto-save'
      : type === 'external-change' ? 'External Change'
      : type;

    const timeLabel = formatTimestamp(timestamp);
    return `${typeLabel} ${timeLabel}`;
  };

  const getSnapshotIcon = (type: string) => {
    switch (type) {
      case 'auto-save':
        return 'save';
      case 'manual':
        return 'push_pin';
      case 'ai-diff':
        return 'smart_toy';
      case 'pre-apply':
        return 'bolt';
      case 'pre-edit':
        return 'flag';
      case 'incremental-approval':
        return 'task_alt';
      case 'external-change':
        return 'sync_alt';
      case 'auto':
        return 'schedule';
      default:
        return 'description';
    }
  };

  const handleNavigationStateChange = useCallback((state: DiffNavigationState | TextDiffNavigationState) => {
    setNavigationState(state);
  }, []);

  const deletedFilesCount = files.filter(f => !f.exists).length;
  const selectedFile = files.find(f => f.path === selectedFilePath);
  const isSelectedFileDeleted = selectedFile && !selectedFile.exists;

  if (!isOpen) return null;

  const getSnapshotIconBgClass = (type: string) => {
    switch (type) {
      case 'auto-save':
      case 'auto':
        return 'border-[color-mix(in_srgb,var(--an-primary-color)_18%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_9%,var(--an-background))] text-[var(--an-primary-color)]';
      case 'manual':
        return 'border-[color-mix(in_srgb,var(--an-success-color)_18%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_9%,var(--an-background))] text-[var(--an-success-color)]';
      case 'ai-diff':
      case 'pre-apply':
      case 'pre-edit':
        return 'border-[color-mix(in_srgb,var(--an-primary-color)_18%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_9%,var(--an-background))] text-[var(--an-primary-color)]';
      case 'external-change':
        return 'border-[color-mix(in_srgb,var(--an-warning-color)_18%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_9%,var(--an-background))] text-[var(--an-warning-color)]';
      case 'incremental-approval':
        return 'border-[color-mix(in_srgb,var(--an-success-color)_18%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_9%,var(--an-background))] text-[var(--an-success-color)]';
      default:
        return 'border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)]';
    }
  };

  return (
    <div
      className={backdropClass}
      onClick={onClose}
      data-testid="agent-elements-workspace-history-backdrop"
      data-agent-elements-shell="workspace-history-backdrop"
    >
      <div
        className={dialogClass}
        onClick={(e) => e.stopPropagation()}
        data-testid="agent-elements-workspace-history-dialog"
        data-component="WorkspaceHistoryDialog"
        data-agent-elements-shell="workspace-history-dialog"
      >
        <div
          className={headerClass}
          data-testid="agent-elements-workspace-history-header"
          data-agent-elements-shell="workspace-history-header"
        >
          <div className={titleClass}>
            <DecorativeMaterialSymbol icon="history" className={`${titleIconClass} text-lg`} />
            <h2 className="m-0 truncate text-base font-semibold text-[var(--an-foreground)]">Folder History</h2>
          </div>
          <button className={closeButtonClass} onClick={onClose} type="button" aria-label="Close folder history">
            <DecorativeMaterialSymbol icon="close" className="text-xl" />
          </button>
        </div>

        <div className={contentClass}>
          <div
            className={filePanelClass}
            data-testid="agent-elements-workspace-history-file-panel"
            data-agent-elements-shell="workspace-history-file-panel"
          >
            <div className={panelHeaderClass}>
              <span>Files with History ({files.length} files{deletedFilesCount > 0 ? `, ${deletedFilesCount} deleted` : ''})</span>
              {loading && <span className="workspace-history-loading text-[11px] font-normal text-[var(--an-foreground-subtle)]">Loading...</span>}
            </div>
            <WorkspaceHistoryFileTree
              files={files}
              workspacePath={workspacePath}
              selectedFilePath={selectedFilePath}
              selectedDeletedFiles={selectedDeletedFiles}
              onFileSelect={handleFileSelect}
              onDeletedFileToggle={handleDeletedFileToggle}
            />
          </div>

          <div
            className={previewPanelClass}
            data-testid="agent-elements-workspace-history-preview-panel"
            data-agent-elements-shell="workspace-history-preview-panel"
          >
            <div className={previewHeaderClass}>
              <div className={previewHeaderLeftClass}>
                {selectedFilePath ? (
                  <>
                    <DecorativeMaterialSymbol icon="description" className="shrink-0 text-lg text-[var(--an-foreground-muted)]" />
                    <span className="workspace-history-selected-file overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-[var(--an-foreground)]">
                      {selectedFilePath.replace(workspacePath + '/', '')}
                    </span>
                    <span className="workspace-history-snapshot-count shrink-0 text-xs text-[var(--an-foreground-subtle)]">
                      ({snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''})
                    </span>
                  </>
                ) : (
                  <span className="workspace-history-no-selection text-[13px] text-[var(--an-foreground-muted)]">Select a file to view history</span>
                )}
              </div>
              <div className={actionsClass}>
                {selectedDeletedFiles.size > 0 && (
                  <button
                    className={`workspace-history-restore-selected-button ${primaryButtonClass}`}
                    onClick={handleBatchRestore}
                    disabled={isRestoring}
                    type="button"
                  >
                    <DecorativeMaterialSymbol icon="restore" className="text-base" />
                    Restore Selected ({selectedDeletedFiles.size})
                  </button>
                )}
                {selectedFilePath && selectedSnapshotTimestamp && (
                  <button
                    className={`workspace-history-restore-button ${primaryButtonClass}`}
                    onClick={handleRestoreVersion}
                    disabled={isRestoring || !previewContent}
                    type="button"
                  >
                    <DecorativeMaterialSymbol icon="restore" className="text-base" />
                    {isSelectedFileDeleted ? 'Restore File' : 'Restore This Version'}
                  </button>
                )}
              </div>
            </div>

            {selectedFilePath ? (
              <div className="workspace-history-preview-content-wrapper flex-1 flex flex-col overflow-hidden">
                <div className={snapshotListClass}>
                  {snapshotsLoading ? (
                    <div className="workspace-history-snapshots-loading p-5 text-center text-[13px] text-[var(--an-foreground-muted)]">Loading snapshots...</div>
                  ) : snapshots.length === 0 ? (
                    <div className="workspace-history-no-snapshots p-5 text-center text-[13px] text-[var(--an-foreground-muted)]">No snapshots available</div>
                  ) : (
                    snapshots.map((snapshot, index) => (
                      <div
                        key={`${snapshot.timestamp}-${index}`}
                        className={`${snapshotItemBaseClass} ${selectedSnapshotTimestamp === snapshot.timestamp ? snapshotItemSelectedClass : ''}`}
                        onClick={() => handleSnapshotSelect(snapshot.timestamp, index)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            void handleSnapshotSelect(snapshot.timestamp, index);
                          }
                        }}
                        data-agent-elements-shell="workspace-history-snapshot-item"
                        data-selected={selectedSnapshotTimestamp === snapshot.timestamp ? 'true' : 'false'}
                      >
                        <div className={`${snapshotIconBaseClass} ${getSnapshotIconBgClass(snapshot.type)}`}>
                          <DecorativeMaterialSymbol icon={getSnapshotIcon(snapshot.type)} className="text-base" />
                        </div>
                        <div className="workspace-history-snapshot-info flex-1 min-w-0">
                          <span className="workspace-history-snapshot-type block text-xs font-medium capitalize text-[var(--an-foreground)]">{snapshot.type.replace('-', ' ')}</span>
                          <span className="workspace-history-snapshot-time block text-[11px] text-[var(--an-foreground-subtle)]">{formatTimestamp(snapshot.timestamp)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className={previewAreaClass}>
                  {diffMode && versionAMeta && versionBMeta && (
                    <div
                      className={diffHeaderClass}
                      data-testid="agent-elements-workspace-history-diff-header"
                      data-agent-elements-shell="workspace-history-diff-header"
                    >
                      <span className={`${diffLabelClass} old text-[var(--an-diff-removed-text)]`}>
                        {formatVersionLabel(versionAMeta.type, versionAMeta.timestamp)}
                      </span>
                      <span className="workspace-history-diff-separator text-[11px] font-semibold text-[var(--an-foreground-subtle)]">vs</span>
                      <span className={`${diffLabelClass} new text-[var(--an-success-color)]`}>
                        {formatVersionLabel(versionBMeta.type, versionBMeta.timestamp)}
                      </span>
                      {fileType === 'markdown' && (
                        <div
                          className={diffModeToggleClass}
                          data-testid="agent-elements-workspace-history-diff-mode-toggle"
                          data-agent-elements-shell="workspace-history-diff-mode-toggle"
                        >
                          <button
                            className={`${diffModeButtonBaseClass} ${diffViewMode === 'rich' ? diffModeButtonActiveClass : diffModeButtonIdleClass}`}
                            onClick={() => setDiffViewMode('rich')}
                            type="button"
                          >
                            Rich
                          </button>
                          <button
                            className={`${diffModeButtonBaseClass} ${diffViewMode === 'text' ? diffModeButtonActiveClass : diffModeButtonIdleClass}`}
                            onClick={() => setDiffViewMode('text')}
                            type="button"
                          >
                            Text
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {loadingPreview ? (
                    <div className={loadingClass}>
                      <div className={loadingSpinnerClass} />
                      Loading preview...
                    </div>
                  ) : diffMode ? (
                    <div className="workspace-history-diff-content flex-1 overflow-auto nim-scrollbar">
                      {fileType === 'markdown' ? (
                        diffViewMode === 'rich' ? (
                          <DiffPreviewEditor
                            key={`${versionAMeta?.timestamp}-${versionBMeta?.timestamp}`}
                            oldMarkdown={versionAContent}
                            newMarkdown={versionBContent}
                            onNavigationStateChange={handleNavigationStateChange}
                            onNavigatePrevious={() => {}}
                            onNavigateNext={() => {}}
                            theme={theme}
                          />
                        ) : (
                          <TextDiffViewer
                            key={`${versionAMeta?.timestamp}-${versionBMeta?.timestamp}`}
                            oldText={versionAContent}
                            newText={versionBContent}
                            onNavigationStateChange={handleNavigationStateChange}
                            onNavigatePrevious={() => {}}
                            onNavigateNext={() => {}}
                          />
                        )
                      ) : (
                        <MonacoDiffViewer
                          key={`${versionAMeta?.timestamp}-${versionBMeta?.timestamp}`}
                          oldContent={versionAContent}
                          newContent={versionBContent}
                          filePath={selectedFilePath || ''}
                          theme={theme}
                        />
                      )}
                    </div>
                  ) : selectedSnapshotTimestamp ? (
                    <pre className="workspace-history-preview-text m-0 whitespace-pre-wrap break-words p-[var(--an-spacing-xxl)] font-mono text-[13px] leading-relaxed text-[var(--an-foreground)]">{previewContent}</pre>
                  ) : (
                    <div className="workspace-history-preview-empty flex flex-1 items-center justify-center text-[13px] text-[var(--an-foreground-muted)]">
                      Select a snapshot to preview
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={emptyStateClass}
                data-testid="agent-elements-workspace-history-empty-preview"
                data-agent-elements-shell="workspace-history-empty-preview"
              >
                <DecorativeMaterialSymbol icon="folder_open" className="text-5xl opacity-40" />
                <p className="m-0 text-sm">Select a file from the tree to view its history</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
