import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { ProviderIcon, MarkdownEditor, MonacoEditor } from '@nimbalyst/runtime';
import { useHistory } from '../../hooks/useHistory';
import { DiffPreviewEditor, type DiffNavigationState } from './DiffPreviewEditor';
import { TextDiffViewer, type TextDiffNavigationState } from './TextDiffViewer';
import { MonacoDiffViewer } from './MonacoDiffViewer';
import { ImageDiffViewer } from './ImageDiffViewer';
import { createReadOnlyEditorHost } from './createReadOnlyEditorHost';
import { getFileType, type EditorType } from '../../utils/fileTypeDetector';
import { getFileName } from '../../utils/pathUtils';
import { getRelativeTimeString } from '../../utils/dateFormatting';
import { nimAssetUrl } from '../../utils/assetUrl';

interface HistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string | null;
  onRestore?: (content: string) => void;
  theme?: string;
  workspacePath?: string;
  onOpenSessionInChat?: (sessionId: string) => void;
}

type VersionSelection = {
  snapshotId: string; // Composite ID: timestamp-hash-index
  timestamp: string; // Stored separately for loadSnapshot calls
  label: 'A' | 'B';
};

// Helper function to generate unique snapshot ID
const getSnapshotId = (snapshot: { timestamp: string; baseMarkdownHash: string }, index: number) => {
  return `${snapshot.timestamp}-${snapshot.baseMarkdownHash}-${index}`;
};

const backdropClass =
  'history-dialog-overlay agent-elements-history-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] p-[var(--an-spacing-xxl)]';
const dialogClass =
  'history-dialog agent-elements-history-dialog agent-elements-tool-card flex h-[min(80vh,800px)] w-[min(90vw,1200px)] max-w-[1200px] flex-col overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)] @container/history-dialog';
const headerClass =
  'history-dialog-header agent-elements-history-header flex min-h-[60px] items-center justify-between gap-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]';
const titleClass = 'history-dialog-title flex min-w-0 flex-1 flex-col gap-[var(--an-spacing-xxs)]';
const controlsClass = 'history-dialog-header-right flex shrink-0 items-center gap-[var(--an-spacing-sm)]';
const toggleGroupClass =
  'view-mode-toggle agent-elements-history-toggle flex gap-[var(--an-spacing-xxs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xxs)]';
const toggleButtonBaseClass =
  'view-mode-button cursor-pointer rounded-[calc(var(--an-input-border-radius)_-_4px)] border border-transparent px-3 py-1 text-[11px] font-medium transition-[background-color,border-color,color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-1';
const toggleButtonActiveClass =
  'active border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-send-button-color)]';
const toggleButtonIdleClass =
  'text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]';
const closeButtonClass =
  'history-dialog-close agent-elements-history-close inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';
const contentClass = 'history-dialog-content flex min-h-0 flex-1 overflow-hidden';
const listPanelClass =
  'history-list agent-elements-history-list-panel flex w-[min(34vw,350px)] min-w-[280px] flex-col border-r border-[var(--an-border-color)] bg-[var(--an-background-secondary)] @max-[760px]/history-dialog:w-[300px]';
const listHeaderClass =
  'history-list-header flex min-h-11 items-center justify-between gap-[var(--an-spacing-sm)] border-b border-[var(--an-border-color)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-xs font-medium text-[var(--an-foreground-muted)]';
const iconButtonClass =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent text-[var(--an-foreground-muted)] transition-[background-color,border-color,color,opacity] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';
const historyItemsClass = 'history-items nim-scrollbar flex-1 overflow-y-auto p-[var(--an-spacing-xs)]';
const historyItemBaseClass =
  'history-item agent-elements-history-snapshot-item group mb-1 cursor-pointer rounded-[var(--an-small-border-radius)] border border-transparent transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-[-2px]';
const historyItemSelectedClass =
  'selected border-[color-mix(in_srgb,var(--an-primary-color)_22%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_8%,var(--an-background))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--an-primary-color)_12%,transparent)]';
const snapshotIconBaseClass =
  'history-item-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--an-small-border-radius)] border';
const sessionLinkBaseClass =
  'history-item-session-link flex max-w-full cursor-pointer items-center gap-[var(--an-spacing-xxs)] overflow-hidden text-[11px] text-[var(--an-primary-color)] no-underline transition-[color] duration-150 ease-out hover:text-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))]';
const deleteButtonClass =
  'history-item-delete inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-small-border-radius)] border border-transparent bg-transparent text-[var(--an-foreground-muted)] opacity-0 transition-[background-color,border-color,color,opacity] duration-150 ease-out group-hover:opacity-70 hover:border-[color-mix(in_srgb,var(--an-diff-removed-text)_24%,var(--an-border-color))] hover:bg-[color-mix(in_srgb,var(--an-diff-removed-text)_8%,var(--an-background))] hover:text-[var(--an-diff-removed-text)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';
const previewPanelClass =
  'history-preview agent-elements-history-preview-panel relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--an-background)]';
const previewHeaderClass =
  'history-preview-header agent-elements-history-preview-header flex min-h-[48px] items-center justify-between gap-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-sm)]';
const previewHeaderLeftClass = 'history-preview-header-left flex min-w-0 flex-1 flex-wrap items-center gap-[var(--an-spacing-sm)] overflow-hidden';
const diffLabelClass =
  'diff-version-label rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2 py-0.5 text-[11px] font-medium';
const diffNavButtonClass =
  'diff-nav-button inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color,opacity] duration-150 ease-out hover:not-disabled:bg-[var(--an-background-tertiary)] hover:not-disabled:text-[var(--an-foreground)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';
const primaryButtonClass =
  'history-restore-button agent-elements-history-button inline-flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] whitespace-nowrap rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--an-send-button-color)] transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out hover:not-disabled:border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))] hover:not-disabled:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';
const previewContentClass =
  'history-preview-content nim-scrollbar flex-1 overflow-auto bg-[var(--an-background)]';
const emptyStateClass =
  'history-preview-empty flex flex-1 items-center justify-center px-[var(--an-spacing-xxl)] text-center text-sm text-[var(--an-foreground-muted)]';
const loadingOverlayClass =
  'history-preview-loading absolute inset-0 z-10 flex flex-col items-center justify-center gap-[var(--an-spacing-lg)] bg-[var(--an-background)] text-sm text-[var(--an-foreground-muted)]';
const loadingSpinnerClass =
  'history-preview-loading-spinner h-8 w-8 rounded-full border-2 border-[var(--an-border-color)] border-t-[var(--an-primary-color)] motion-safe:animate-spin';

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

export function HistoryDialog({ isOpen, onClose, filePath, onRestore, theme = 'light', workspacePath, onOpenSessionInChat }: HistoryDialogProps) {
  const posthog = usePostHog();
  const { snapshots, loading, refreshSnapshots, loadSnapshot, deleteSnapshot } = useHistory(filePath);
  const [selectedVersions, setSelectedVersions] = useState<VersionSelection[]>([]);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [richView, setRichView] = useState(true);
  const [viewMode, setViewMode] = useState<'changes' | 'version'>('changes');
  const [compactView, setCompactView] = useState(true);
  const [versionAContent, setVersionAContent] = useState<string>('');
  const [versionBContent, setVersionBContent] = useState<string>('');
  const [versionAMeta, setVersionAMeta] = useState<{ type: string; timestamp: string } | null>(null);
  const [versionBMeta, setVersionBMeta] = useState<{ type: string; timestamp: string } | null>(null);
  const [navigationState, setNavigationState] = useState<DiffNavigationState | TextDiffNavigationState | null>(null);
  const [sessionInfo, setSessionInfo] = useState<Record<string, { title: string; provider: string }>>({});

  // Detect file type
  const fileType: EditorType = useMemo(() => {
    return filePath ? getFileType(filePath) : 'markdown';
  }, [filePath]);

  const displayedSnapshots = useMemo(() => {
    if (!compactView || snapshots.length === 0) {
      return snapshots;
    }

    const importantTypes = ['manual', 'external-change', 'ai-diff', 'pre-apply', 'pre-edit'];
    const minorTypes = ['auto-save', 'auto', 'incremental-approval'];
    const timeGroupInterval = 5 * 60 * 1000; // 5 minutes in milliseconds

    const result = [];
    const grouped: { [key: number]: typeof snapshots } = {};

    // Group minor snapshots by time interval
    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      const isFirst = i === snapshots.length - 1; // oldest (last in array)
      const isLast = i === 0; // newest (first in array)
      const isImportant = importantTypes.includes(snapshot.type);

      if (isFirst || isLast || isImportant) {
        result.push(snapshot);
      } else if (minorTypes.includes(snapshot.type)) {
        const timestamp = new Date(snapshot.timestamp).getTime();
        const groupKey = Math.floor(timestamp / timeGroupInterval);

        if (!grouped[groupKey]) {
          grouped[groupKey] = [];
        }
        grouped[groupKey].push(snapshot);
      } else {
        // Unknown types, include them
        result.push(snapshot);
      }
    }

    // Add one representative from each time group (the newest one)
    Object.values(grouped).forEach((group) => {
      if (group.length > 0) {
        result.push(group[0]); // First item is newest in the group
      }
    });

    // Sort by timestamp (newest first)
    return result.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [snapshots, compactView]);

  useEffect(() => {
    if (isOpen && filePath) {
      refreshSnapshots();
      // Track file history dialog opened
      posthog?.capture('file_history_opened', {
        fileType,
      });
    }
  }, [isOpen, filePath, refreshSnapshots, posthog, fileType]);

  // Fetch session info for AI edit snapshots
  useEffect(() => {
    if (!isOpen || !workspacePath || snapshots.length === 0) return;

    const fetchSessionInfo = async () => {
      // Collect unique session IDs from snapshots
      const sessionIds = new Set<string>();
      for (const snapshot of snapshots) {
        const sessionId = snapshot.metadata?.sessionId;
        if (sessionId) {
          sessionIds.add(sessionId);
        }
      }

      if (sessionIds.size === 0) return;

      try {
        // Fetch lightweight session list (just metadata, no messages)
        const sessions = await window.electronAPI?.ai?.getSessionList?.(workspacePath);
        if (sessions) {
          const info: Record<string, { title: string; provider: string }> = {};
          for (const session of sessions) {
            if (sessionIds.has(session.id)) {
              info[session.id] = {
                title: session.title || 'Untitled Session',
                provider: session.provider || 'claude'
              };
            }
          }
          if (Object.keys(info).length > 0) {
            setSessionInfo(info);
          }
        }
      } catch (error) {
        console.error('[HistoryDialog] Failed to fetch session info:', error);
      }
    };

    fetchSessionInfo();
  }, [isOpen, workspacePath, snapshots]);

  useEffect(() => {
    // Reset selection when dialog opens/closes
    if (!isOpen) {
      setSelectedVersions([]);
      setPreviewContent('');
      setDiffMode(false);
      setRichView(true);
      setViewMode('changes');
      setVersionAContent('');
      setVersionBContent('');
      setVersionAMeta(null);
      setVersionBMeta(null);
    }
  }, [isOpen]);

  useEffect(() => {
    // Handle Escape key to close dialog
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

  // Reload preview when view mode changes
  useEffect(() => {
    if (selectedVersions.length !== 1) return;

    const selection = selectedVersions[0];
    const idParts = selection.snapshotId.split('-');
    const selectedIndex = parseInt(idParts[idParts.length - 1]);
    const previousSnapshot = displayedSnapshots[selectedIndex + 1];

    const reloadPreview = async () => {
      if (viewMode === 'changes' && previousSnapshot) {
        await loadDiffMode(previousSnapshot.timestamp, selection.timestamp);
      } else {
        // Version mode or no previous - just show content
        setDiffMode(false);
        setLoadingPreview(true);
        try {
          const content = await loadSnapshot(selection.timestamp);
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

    reloadPreview();
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSnapshotSelect = async (snapshotId: string, timestamp: string, clickedIndex: number, isCommandClick: boolean) => {
    // Check if this version is already selected
    const existingIndex = selectedVersions.findIndex(v => v.snapshotId === snapshotId);

    if (existingIndex >= 0) {
      // Deselect this version
      const newSelections = selectedVersions.filter(v => v.snapshotId !== snapshotId);
      setSelectedVersions(newSelections);
      setDiffMode(false);

      // If we still have one selection, load based on view mode
      if (newSelections.length === 1) {
        const remainingSelection = newSelections[0];
        // Parse the index from the snapshotId (last segment after final dash)
        const idParts = remainingSelection.snapshotId.split('-');
        const remainingIndex = parseInt(idParts[idParts.length - 1]);
        const previousSnapshot = displayedSnapshots[remainingIndex + 1];

        if (viewMode === 'changes' && previousSnapshot) {
          await loadDiffMode(previousSnapshot.timestamp, remainingSelection.timestamp);
        } else {
          // Version mode or no previous - just show content
          setLoadingPreview(true);
          try {
            const content = await loadSnapshot(remainingSelection.timestamp);
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
      } else {
        setPreviewContent('');
      }
      return;
    }

    // Command-click: add to selection for manual diff (only in changes mode)
    if (isCommandClick && viewMode === 'changes') {
      if (selectedVersions.length < 2) {
        const label: 'A' | 'B' = selectedVersions.length === 0 ? 'A' : 'B';
        const newSelections = [...selectedVersions, { snapshotId, timestamp, label }];
        setSelectedVersions(newSelections);

        if (newSelections.length === 2) {
          // Two selections - load both and enter diff mode
          await loadDiffMode(newSelections[0].timestamp, newSelections[1].timestamp);
        }
      }
      return;
    }

    // Regular click: reset to single selection
    setSelectedVersions([{ snapshotId, timestamp, label: 'A' }]);

    if (viewMode === 'changes') {
      // Changes mode: show diff with previous version
      const previousSnapshot = displayedSnapshots[clickedIndex + 1];
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
    } else {
      // Version mode: just show the content
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
      // Determine which is older (A should be older)
      const indexOlder = snapshots.findIndex(s => s.timestamp === olderTimestamp);
      const indexNewer = snapshots.findIndex(s => s.timestamp === newerTimestamp);

      let actualOlderTimestamp = olderTimestamp;
      let actualNewerTimestamp = newerTimestamp;

      // In the snapshots list, newer versions come first (index 0 is newest)
      // So higher index means older
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

      if (contentA != null && contentB != null && snapshotA && snapshotB) {
        setVersionAContent(contentA);
        setVersionBContent(contentB);
        setVersionAMeta({ type: snapshotA.type, timestamp: snapshotA.timestamp });
        setVersionBMeta({ type: snapshotB.type, timestamp: snapshotB.timestamp });
        // Set preview content to the newer version for restore functionality
        setPreviewContent(contentB);
        setDiffMode(true);
      } else {
        console.warn('[HistoryDialog] Diff load skipped: missing content or metadata', {
          hasContentA: contentA != null,
          hasContentB: contentB != null,
          hasSnapshotA: !!snapshotA,
          hasSnapshotB: !!snapshotB,
        });
      }
    } catch (error) {
      console.error('Failed to load snapshots for diff:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRestore = () => {
    console.log('[HistoryDialog] handleRestore called', {
      hasPreviewContent: !!previewContent,
      hasOnRestore: !!onRestore,
      contentLength: previewContent?.length
    });
    if (previewContent && onRestore) {
      // Track file history restore
      posthog?.capture('file_history_restored', {
        fileType,
      });
      onRestore(previewContent);
      onClose();
    } else {
      console.error('[HistoryDialog] Cannot restore:', {
        previewContent: previewContent ? 'exists' : 'missing',
        onRestore: onRestore ? 'exists' : 'missing'
      });
    }
  };

  const handleDelete = async (snapshotId: string, timestamp: string) => {
    if (window.confirm('Are you sure you want to delete this snapshot?')) {
      await deleteSnapshot(timestamp);
      // Remove from selections if selected
      const newSelections = selectedVersions.filter(v => v.snapshotId !== snapshotId);
      if (newSelections.length !== selectedVersions.length) {
        setSelectedVersions(newSelections);
        setPreviewContent('');
        setDiffMode(false);
      }
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }

    // Show full date
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

  // Navigation handlers
  const handleNavigatePrevious = useCallback(() => {
    if (richView) {
      (window as any).__richDiffNavigatePrevious?.();
    } else {
      (window as any).__textDiffNavigatePrevious?.();
    }
  }, [richView]);

  const handleNavigateNext = useCallback(() => {
    if (richView) {
      (window as any).__richDiffNavigateNext?.();
    } else {
      (window as any).__textDiffNavigateNext?.();
    }
  }, [richView]);

  const handleNavigationStateChange = useCallback((state: DiffNavigationState | TextDiffNavigationState) => {
    setNavigationState(state);
  }, []);

  if (!isOpen) return null;

  const getSnapshotIconBgClass = (type: string) => {
    switch (type) {
      case 'auto-save':
      case 'auto':
        return 'border-[color-mix(in_srgb,var(--an-primary-color)_18%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_9%,var(--an-background))] text-[var(--an-primary-color)]';
      case 'manual':
      case 'incremental-approval':
        return 'border-[color-mix(in_srgb,var(--an-success-color)_18%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_9%,var(--an-background))] text-[var(--an-success-color)]';
      case 'external-change':
        return 'border-[color-mix(in_srgb,var(--an-warning-color)_18%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_9%,var(--an-background))] text-[var(--an-warning-color)]';
      case 'ai-diff':
      case 'pre-apply':
      case 'pre-edit':
      default:
        return 'border-[color-mix(in_srgb,var(--an-primary-color)_18%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_9%,var(--an-background))] text-[var(--an-primary-color)]';
    }
  };

  return (
    <div
      className={backdropClass}
      onClick={onClose}
      data-testid="agent-elements-history-backdrop"
      data-agent-elements-shell="history-backdrop"
    >
      <div
        className={dialogClass}
        onClick={(e) => e.stopPropagation()}
        data-testid="agent-elements-history-dialog"
        data-component="HistoryDialog"
        data-agent-elements-shell="history-dialog"
      >
        <div
          className={headerClass}
          data-testid="agent-elements-history-header"
          data-agent-elements-shell="history-header"
        >
          <div className={titleClass}>
            <h2 className="m-0 truncate text-base font-semibold text-[var(--an-foreground)]">{filePath ? getFileName(filePath) : 'Document History'}</h2>
            {filePath && <span className="history-dialog-path truncate text-[11px] text-[var(--an-foreground-subtle)]">{filePath}</span>}
          </div>
          <div className={controlsClass}>
            {fileType === 'markdown' && (
              <div
                className={`view-variant-toggle ${toggleGroupClass}`}
                data-testid="agent-elements-history-rich-toggle"
                data-agent-elements-shell="history-rich-toggle"
              >
                <button
                  className={`${toggleButtonBaseClass} ${richView ? toggleButtonActiveClass : toggleButtonIdleClass}`}
                  onClick={() => setRichView(true)}
                  title="Rendered view"
                  type="button"
                >
                  Rich
                </button>
                <button
                  className={`${toggleButtonBaseClass} ${!richView ? toggleButtonActiveClass : toggleButtonIdleClass}`}
                  onClick={() => setRichView(false)}
                  title="Raw source"
                  type="button"
                >
                  Raw
                </button>
              </div>
            )}
            <div
              className={toggleGroupClass}
              data-testid="agent-elements-history-view-toggle"
              data-agent-elements-shell="history-view-toggle"
            >
              <button
                className={`${toggleButtonBaseClass} ${viewMode === 'changes' ? toggleButtonActiveClass : toggleButtonIdleClass}`}
                onClick={() => setViewMode('changes')}
                title="Show diff with previous version"
                type="button"
              >
                Diff
              </button>
              <button
                className={`${toggleButtonBaseClass} ${viewMode === 'version' ? toggleButtonActiveClass : toggleButtonIdleClass}`}
                onClick={() => setViewMode('version')}
                title="View full content"
                type="button"
              >
                Full
              </button>
            </div>
            <button className={closeButtonClass} onClick={onClose} type="button" aria-label="Close document history">
              <DecorativeMaterialSymbol icon="close" className="text-xl" />
            </button>
          </div>
        </div>

        <div className={contentClass}>
          <div
            className={listPanelClass}
            data-testid="agent-elements-history-list-panel"
            data-agent-elements-shell="history-list-panel"
          >
            <div className={listHeaderClass}>
              <div className="history-list-header-left flex items-center gap-[var(--an-spacing-sm)]">
                <h3 className="m-0 text-xs font-medium text-[var(--an-foreground-muted)]">Snapshots ({displayedSnapshots.length}{compactView && snapshots.length !== displayedSnapshots.length ? ` of ${snapshots.length}` : ''})</h3>
                {loading && <span className="history-loading text-xs text-[var(--an-foreground-subtle)]">Loading...</span>}
              </div>
              {snapshots.length > 5 && (
                <button
                  className={`history-compact-toggle ${iconButtonClass}`}
                  onClick={() => setCompactView(!compactView)}
                  title={compactView ? 'Show all versions' : 'Hide minor auto-saves'}
                  type="button"
                  aria-label={compactView ? 'Show all versions' : 'Hide minor auto-saves'}
                >
                  <DecorativeMaterialSymbol icon={compactView ? 'unfold_more' : 'unfold_less'} className="text-lg" />
                </button>
              )}
            </div>

            {displayedSnapshots.length === 0 ? (
              <div className="history-empty px-[var(--an-spacing-xl)] py-10 text-center text-sm text-[var(--an-foreground-muted)]">
                No history available for this document
              </div>
            ) : (
              <div className={historyItemsClass}>
                {displayedSnapshots.map((snapshot, index) => {
                  const snapshotId = getSnapshotId(snapshot, index);
                  const isSelected = selectedVersions.some(v => v.snapshotId === snapshotId);
                  const sessionId = snapshot.metadata?.sessionId;
                  const session = sessionId ? sessionInfo[sessionId] : null;
                  const isAIEdit = ['pre-edit', 'ai-diff', 'ai-edit', 'incremental-approval'].includes(snapshot.type);
                  const relativeTime = getRelativeTimeString(new Date(snapshot.timestamp).getTime());

                  const handleSessionClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (sessionId && onOpenSessionInChat) {
                      onOpenSessionInChat(sessionId);
                      onClose();
                    }
                  };

                  return (
                  <div
                    key={snapshotId}
                    data-testid={`history-item-${index}`}
                    data-agent-elements-shell="history-snapshot-item"
                    data-snapshot-id={snapshotId}
                    data-snapshot-type={snapshot.type}
                    data-selected={isSelected}
                    className={`${historyItemBaseClass} ${isSelected ? historyItemSelectedClass : ''}`}
                    onClick={(e) => handleSnapshotSelect(snapshotId, snapshot.timestamp, index, e.metaKey || e.ctrlKey)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleSnapshotSelect(snapshotId, snapshot.timestamp, index, event.metaKey || event.ctrlKey);
                      }
                    }}
                  >
                    <div className="history-item-content flex items-center justify-between px-[var(--an-spacing-sm)] py-[var(--an-spacing-sm)]">
                      <div className="history-item-main flex min-w-0 flex-1 items-center gap-[var(--an-spacing-sm)]">
                        <div className={`${snapshotIconBaseClass} ${getSnapshotIconBgClass(snapshot.type)}`}>
                          <DecorativeMaterialSymbol icon={getSnapshotIcon(snapshot.type)} className="text-base" />
                        </div>
                        <div className="history-item-info flex min-w-0 flex-1 flex-col gap-[var(--an-spacing-xxs)]">
                          <div className="history-item-type-row flex items-center justify-between gap-[var(--an-spacing-sm)]">
                            <span className="history-item-type truncate text-xs font-medium capitalize text-[var(--an-foreground)]">{snapshot.type.replace('-', ' ')}</span>
                            <span className="history-item-time shrink-0 whitespace-nowrap text-[11px] text-[var(--an-foreground-subtle)]">{relativeTime}</span>
                          </div>
                          {isAIEdit && session && (
                            <button
                              type="button"
                              className={sessionLinkBaseClass}
                              title="Open AI session in chat"
                              onClick={handleSessionClick}
                            >
                              <ProviderIcon provider={session.provider} size={11} />
                              <span className="history-item-session-name overflow-hidden text-ellipsis whitespace-nowrap">{session.title}</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="history-item-actions flex shrink-0 items-center gap-[var(--an-spacing-sm)]">
                        <button
                          className={deleteButtonClass}
                          data-testid={`history-item-delete-${index}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(snapshotId, snapshot.timestamp);
                          }}
                          title="Delete snapshot"
                          type="button"
                          aria-label="Delete snapshot"
                        >
                          <DecorativeMaterialSymbol icon="delete" className="text-base" />
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className={previewPanelClass}
            data-testid="agent-elements-history-preview-panel"
            data-agent-elements-shell="history-preview-panel"
          >
            <div
              className={previewHeaderClass}
              data-testid={diffMode ? 'agent-elements-history-diff-header' : 'agent-elements-history-preview-header'}
              data-agent-elements-shell={diffMode ? 'history-diff-header' : 'history-preview-header'}
            >
              <div className={previewHeaderLeftClass}>
                <h3 className="m-0 text-xs font-medium text-[var(--an-foreground-muted)]">{diffMode ? 'Diff Preview' : 'Preview'}</h3>
                {diffMode && versionAMeta && versionBMeta && (
                  <div className="diff-version-labels flex items-center gap-[var(--an-spacing-sm)] text-[11px] text-[var(--an-foreground-muted)]">
                    <span className={`${diffLabelClass} diff-version-old text-[var(--an-diff-removed-text)]`}>
                      {formatVersionLabel(versionAMeta.type, versionAMeta.timestamp)}
                    </span>
                    <span className="diff-version-separator font-semibold text-[var(--an-foreground-subtle)]">vs</span>
                    <span className={`${diffLabelClass} diff-version-new text-[var(--an-success-color)]`}>
                      {formatVersionLabel(versionBMeta.type, versionBMeta.timestamp)}
                    </span>
                  </div>
                )}
                {diffMode && fileType === 'markdown' && (
                  <>
                    {navigationState && navigationState.totalGroups > 0 && (
                      <div className="diff-navigation-controls flex items-center gap-[var(--an-spacing-sm)]">
                        <button
                          className={diffNavButtonClass}
                          onClick={handleNavigatePrevious}
                          disabled={!navigationState.canGoPrevious}
                          title="Previous change"
                          type="button"
                          aria-label="Previous change"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M6 9L3 6L6 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <span className="diff-change-counter min-w-[50px] text-center text-[11px] font-medium text-[var(--an-foreground-muted)]">
                          {navigationState.currentIndex + 1} / {navigationState.totalGroups}
                        </span>
                        <button
                          className={diffNavButtonClass}
                          onClick={handleNavigateNext}
                          disabled={!navigationState.canGoNext}
                          title="Next change"
                          type="button"
                          aria-label="Next change"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M6 3L9 6L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        {!richView && 'addedLines' in navigationState && (
                          <div className="diff-stats flex items-center gap-[var(--an-spacing-xs)] border-l border-[var(--an-border-color)] pl-[var(--an-spacing-sm)]">
                            <span className="diff-stat diff-stat-added rounded-[var(--an-small-border-radius)] bg-[color-mix(in_srgb,var(--an-success-color)_8%,var(--an-background))] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--an-success-color)]">+{navigationState.addedLines}</span>
                            <span className="diff-stat diff-stat-removed rounded-[var(--an-small-border-radius)] bg-[color-mix(in_srgb,var(--an-diff-removed-text)_8%,var(--an-background))] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--an-diff-removed-text)]">-{navigationState.removedLines}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {selectedVersions.length === 1 && (
                <button
                  className={primaryButtonClass}
                  onClick={handleRestore}
                  disabled={!previewContent}
                  type="button"
                >
                  Restore This Version
                </button>
              )}
            </div>

            {diffMode ? (
              <div className={`${previewContentClass} [&:has(.diff-preview-editor)]:p-0`}>
                {fileType === 'markdown' ? (
                  // Markdown files: use rich or text diff
                  richView ? (
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
                ) : fileType === 'image' ? (
                  // Image files: use image diff viewer
                  <ImageDiffViewer
                    key={`${versionAMeta?.timestamp}-${versionBMeta?.timestamp}`}
                    oldImagePath={filePath || ''}
                    newImagePath={filePath || ''}
                    filePath={filePath || ''}
                  />
                ) : (
                  // Code files: use Monaco diff viewer
                  <MonacoDiffViewer
                    key={`${versionAMeta?.timestamp}-${versionBMeta?.timestamp}`}
                    oldContent={versionAContent}
                    newContent={versionBContent}
                    filePath={filePath || ''}
                    theme={theme}
                  />
                )}
              </div>
            ) : selectedVersions.length === 1 ? (
              <div className={`${previewContentClass} [&:has(.monaco-editor)]:overflow-hidden [&:has(.nimbalyst-editor-root)]:overflow-hidden`}>
                {fileType === 'image' ? (
                  <div className="image-preview flex h-full w-full items-center justify-center bg-[var(--an-background-secondary)] p-[var(--an-spacing-xl)] [&_img]:max-h-full [&_img]:max-w-full [&_img]:object-contain">
                    <img src={nimAssetUrl(filePath || '')} alt="Preview" />
                  </div>
                ) : fileType === 'markdown' && richView ? (
                  <div className="markdown-preview h-full">
                    <MarkdownEditor
                      key={selectedVersions[0]?.timestamp}
                      host={createReadOnlyEditorHost({
                        filePath: filePath || '',
                        fileName: getFileName(filePath || ''),
                        theme: theme || 'light',
                        content: previewContent,
                      })}
                      config={{
                        theme: theme,
                      }}
                    />
                  </div>
                ) : (
                  <MonacoEditor
                    key={selectedVersions[0]?.timestamp}
                    host={createReadOnlyEditorHost({
                      filePath: filePath || '',
                      fileName: getFileName(filePath || ''),
                      theme: theme || 'light',
                      content: previewContent,
                    })}
                    fileName={getFileName(filePath || '')}
                    config={{
                      theme: theme,
                      isActive: true,
                    }}
                  />
                )}
              </div>
            ) : (
              <div className={emptyStateClass}>
                {viewMode === 'changes'
                  ? 'Select a snapshot to see diff, or Cmd+Click two to compare'
                  : 'Select a snapshot to view'}
              </div>
            )}

            {loadingPreview && (richView || !diffMode) && (
              <div className={loadingOverlayClass}>
                <div className={loadingSpinnerClass} />
                <div className="history-preview-loading-text text-sm text-[var(--an-foreground-muted)]">
                  {selectedVersions.length === 2 ? 'Loading diff...' : 'Loading preview...'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
