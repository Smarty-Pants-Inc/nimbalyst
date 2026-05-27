import React, { useState, useEffect } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface Snapshot {
  timestamp: string;
  type: 'auto-save' | 'manual' | 'ai-diff' | 'pre-apply' | 'external-change' | 'ai-edit';
  size: number;
  baseMarkdownHash: string;
  metadata?: any;
}

const windowShellClass =
  'history-window agent-elements-history-window flex h-screen flex-col overflow-hidden bg-[var(--an-background)] font-sans text-[var(--an-foreground)]';
const centeredStateClass =
  `${windowShellClass} items-center justify-center gap-[var(--an-spacing-md)] text-[var(--an-foreground-muted)]`;
const headerClass =
  'history-header agent-elements-history-window-header border-b border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]';
const panelTitleClass =
  'm-0 text-xs font-medium uppercase text-[var(--an-foreground-muted)]';
const snapshotItemBaseClass =
  'snapshot-item agent-elements-history-window-snapshot group relative flex cursor-pointer items-center gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)] px-[var(--an-spacing-xl)] py-[var(--an-spacing-md)] transition-[background-color,border-color,box-shadow] duration-150 ease-out last:border-b-0 hover:bg-[var(--an-background-tertiary)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-[-2px]';
const snapshotItemSelectedClass =
  'selected border-[color-mix(in_srgb,var(--an-primary-color)_22%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_8%,var(--an-background))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--an-primary-color)_12%,transparent)]';
const snapshotIconBaseClass =
  'snapshot-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--an-small-border-radius)] border';
const snapshotIconSelectedClass =
  'border-[color-mix(in_srgb,var(--an-primary-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] text-[var(--an-primary-color)]';
const snapshotIconIdleClass =
  'border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)]';
const snapshotBadgeBaseClass =
  'snapshot-type inline-flex items-center rounded-[var(--an-small-border-radius)] border px-1.5 py-0.5 text-[11px] font-medium';
const snapshotBadgeSelectedClass =
  'border-[color-mix(in_srgb,var(--an-primary-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_9%,var(--an-background))] text-[var(--an-primary-color)]';
const snapshotBadgeIdleClass =
  'border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)]';
const iconButtonClass =
  'snapshot-delete absolute right-[var(--an-spacing-sm)] top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-subtle)] opacity-0 transition-[background-color,border-color,color,opacity] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--an-error-color)_26%,var(--an-border-color))] hover:bg-[var(--an-diff-removed-bg)] hover:text-[var(--an-error-color)] focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--an-focus-ring)] group-hover:opacity-100';
const primaryButtonClass =
  'btn-restore agent-elements-history-window-restore inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] whitespace-nowrap rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-3.5 py-1.5 text-xs font-medium text-[var(--an-send-button-color)] transition-[background-color,border-color,color,opacity] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';

export function HistoryWindow() {
  const [filePath, setFilePath] = useState<string>('');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get file path from URL params
        const params = new URLSearchParams(window.location.search);
        const path = params.get('filePath');

        if (!path) {
          throw new Error('No file path provided');
        }

        setFilePath(path);

        // Load snapshots
        const snapshotList = await window.electronAPI.history.listSnapshots(path);
        setSnapshots(snapshotList);

        // Select the most recent snapshot by default
        if (snapshotList.length > 0) {
          setSelectedSnapshot(snapshotList[0]);
          loadSnapshot(path, snapshotList[0].timestamp);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  const loadSnapshot = async (path: string, timestamp: string) => {
    try {
      const content = await window.electronAPI.history.loadSnapshot(path, timestamp);
      setPreviewContent(content);
    } catch (err) {
      console.error('Failed to load snapshot:', err);
      setPreviewContent('Failed to load snapshot content');
    }
  };

  const handleSnapshotSelect = (snapshot: Snapshot) => {
    setSelectedSnapshot(snapshot);
    loadSnapshot(filePath, snapshot.timestamp);
  };

  const handleRestore = async () => {
    if (!selectedSnapshot || !previewContent) return;

    const confirmed = window.confirm(
      `Are you sure you want to restore this version from ${formatDate(selectedSnapshot.timestamp)}? This will replace the current file content.`
    );

    if (confirmed) {
      try {
        // Send the content back to the main window via IPC
        // The main window will handle actually updating the editor content
        if (window.electronAPI.sendToMainWindow) {
          await window.electronAPI.sendToMainWindow('restore-from-history', {
            filePath,
            content: previewContent,
            timestamp: selectedSnapshot.timestamp
          });
        }
        window.close();
      } catch (err) {
        alert('Failed to restore snapshot');
      }
    }
  };

  const handleDelete = async (snapshot: Snapshot) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this snapshot from ${formatDate(snapshot.timestamp)}?`
    );

    if (confirmed) {
      try {
        await window.electronAPI.history.deleteSnapshot(filePath, snapshot.timestamp);

        // Reload snapshots
        const snapshotList = await window.electronAPI.history.listSnapshots(filePath);
        setSnapshots(snapshotList);

        // Clear selection if deleted snapshot was selected
        if (selectedSnapshot?.timestamp === snapshot.timestamp) {
          setSelectedSnapshot(null);
          setPreviewContent('');
        }
      } catch (err) {
        alert('Failed to delete snapshot');
      }
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'auto-save':
        return 'save';
      case 'manual':
        return 'bookmark';
      case 'ai-diff':
        return 'smart_toy';
      case 'ai-edit':
        return 'auto_awesome';
      case 'pre-apply':
        return 'backup';
      case 'external-change':
        return 'sync_alt';
      default:
        return 'history';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'auto-save':
        return 'Auto-save';
      case 'manual':
        return 'Manual';
      case 'ai-diff':
        return 'AI Diff';
      case 'ai-edit':
        return 'AI Edit';
      case 'pre-apply':
        return 'Pre-apply';
      case 'external-change':
        return 'External Change';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div
        className={centeredStateClass}
        data-testid="agent-elements-history-window"
        data-component="HistoryWindow"
        data-agent-elements-shell="history-window"
      >
        <span className="agent-elements-history-window-loading-spinner h-6 w-6 rounded-[999px] border-2 border-[var(--an-border-color)] border-t-[var(--an-primary-color)] motion-safe:animate-spin" />
        <p className="m-0 text-sm">Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${centeredStateClass} text-[var(--an-error-color)]`}
        data-testid="agent-elements-history-window"
        data-component="HistoryWindow"
        data-agent-elements-shell="history-window"
      >
        <MaterialSymbol icon="error" size={32} />
        <p className="m-0 select-text text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div
      className={windowShellClass}
      data-testid="agent-elements-history-window"
      data-component="HistoryWindow"
      data-agent-elements-shell="history-window"
    >
      <div className={headerClass} data-agent-elements-shell="history-window-header">
        <h1 className="m-0 text-base font-medium leading-snug text-[var(--an-foreground)]">File History</h1>
        <p className="file-path m-0 mt-1 select-text truncate font-mono text-xs text-[var(--an-foreground-muted)]">{filePath}</p>
      </div>

      <div className="history-content flex flex-1 overflow-hidden">
        <div className="snapshots-list agent-elements-history-window-snapshot-panel flex w-80 flex-col border-r border-[var(--an-border-color)] bg-[var(--an-background-secondary)]">
          <div className="snapshots-header flex min-h-11 items-center border-b border-[var(--an-border-color)] px-[var(--an-spacing-xl)] py-[var(--an-spacing-sm)]">
            <h2 className={panelTitleClass}>Snapshots ({snapshots.length})</h2>
          </div>

          {snapshots.length === 0 ? (
            <div className="no-snapshots agent-elements-history-window-empty flex flex-1 flex-col items-center justify-center gap-[var(--an-spacing-md)] p-10 text-[var(--an-foreground-subtle)]">
              <MaterialSymbol icon="history_toggle_off" size={32} />
              <p className="m-0 text-sm">No snapshots available</p>
            </div>
          ) : (
            <div
              className="snapshots agent-elements-history-window-snapshots nim-scrollbar flex-1 overflow-y-auto bg-[var(--an-background)]"
              data-testid="agent-elements-history-window-snapshots"
              data-agent-elements-shell="history-window-snapshots"
            >
              {snapshots.map((snapshot) => {
                const isSelected = selectedSnapshot?.timestamp === snapshot.timestamp;

                return (
                  <div
                    key={snapshot.timestamp}
                    className={`${snapshotItemBaseClass} ${isSelected ? snapshotItemSelectedClass : ''}`}
                    data-testid={`agent-elements-history-window-snapshot-${snapshot.timestamp}`}
                    data-agent-elements-shell="history-window-snapshot"
                    data-snapshot-selected={isSelected ? 'true' : 'false'}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select snapshot from ${formatDate(snapshot.timestamp)}`}
                    onClick={() => handleSnapshotSelect(snapshot)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSnapshotSelect(snapshot);
                      }
                    }}
                  >
                    <div className={`${snapshotIconBaseClass} ${isSelected ? snapshotIconSelectedClass : snapshotIconIdleClass}`}>
                      <MaterialSymbol icon={getTypeIcon(snapshot.type)} size={18} />
                    </div>
                    <div className="snapshot-info min-w-0 flex-1 pr-7">
                      <div className="snapshot-date mb-1 truncate text-sm font-medium text-[var(--an-foreground)]">{formatDate(snapshot.timestamp)}</div>
                      <div className="snapshot-meta flex min-w-0 items-center gap-[var(--an-spacing-sm)] text-xs text-[var(--an-foreground-muted)]">
                        <span className={`${snapshotBadgeBaseClass} ${isSelected ? snapshotBadgeSelectedClass : snapshotBadgeIdleClass}`}>
                          {getTypeLabel(snapshot.type)}
                        </span>
                        <span className="snapshot-size whitespace-nowrap">{formatSize(snapshot.size)}</span>
                      </div>
                    </div>
                    <button
                      className={iconButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(snapshot);
                      }}
                      title="Delete snapshot"
                      aria-label={`Delete snapshot from ${formatDate(snapshot.timestamp)}`}
                    >
                      <MaterialSymbol icon="delete" size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="snapshot-preview agent-elements-history-window-preview flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--an-background)]">
          <div className="preview-header flex min-h-11 items-center justify-between gap-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xl)] py-[var(--an-spacing-sm)]">
            <h2 className={panelTitleClass}>Preview</h2>
            {selectedSnapshot && (
              <div className="preview-actions flex gap-[var(--an-spacing-sm)]">
                <button className={primaryButtonClass} onClick={handleRestore}>
                  <MaterialSymbol icon="restore" size={16} />
                  Restore This Version
                </button>
              </div>
            )}
          </div>

          {selectedSnapshot ? (
            <div className="preview-content agent-elements-history-window-preview-content nim-scrollbar flex-1 overflow-auto bg-[var(--an-background)] p-[var(--an-spacing-xl)]">
              <pre
                className="m-0 select-text whitespace-pre-wrap break-words rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-code-background)] p-[var(--an-spacing-xl)] font-mono text-xs leading-relaxed text-[var(--an-code-foreground)]"
                data-testid="agent-elements-history-window-preview-content"
                data-agent-elements-shell="history-window-preview-content"
              >
                {previewContent}
              </pre>
            </div>
          ) : (
            <div className="no-preview agent-elements-history-window-no-preview flex flex-1 flex-col items-center justify-center gap-[var(--an-spacing-md)] text-[var(--an-foreground-subtle)]">
              <MaterialSymbol icon="preview_off" size={32} />
              <p className="m-0 text-sm">Select a snapshot to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
