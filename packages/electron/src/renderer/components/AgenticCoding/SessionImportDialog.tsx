import React, { useCallback, useEffect, useState } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { getRelativeTimeString } from '../../utils/dateFormatting';
import { getFileName } from '../../utils/pathUtils';
import type { TokenUsageCategory } from '@nimbalyst/runtime/ai/server/types';

interface SessionToImport {
  sessionId: string;
  workspacePath: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    categories?: TokenUsageCategory[];
  };
  syncStatus: 'new' | 'up-to-date' | 'needs-update';
  selected: boolean;
}

interface SessionsByWorkspace {
  [workspacePath: string]: SessionToImport[];
}

interface SessionImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (sessionIds: string[]) => Promise<void>;
  currentWorkspacePath: string;
  filterByWorkspace?: boolean; // If true, only show sessions for current workspace
}

const secondaryButtonClass =
  'rounded-[var(--an-message-radius-inner)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-3 py-1.5 text-[13px] font-medium text-[var(--an-foreground)] outline-none transition-[background-color,border-color,color,opacity] duration-150 ease-out hover:enabled:border-[var(--an-primary-color)] hover:enabled:bg-[var(--an-background-tertiary)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';

const primaryButtonClass =
  'rounded-[var(--an-message-radius-inner)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-3 py-1.5 text-[13px] font-medium text-[var(--an-send-button-color)] outline-none transition-[background-color,border-color,opacity] duration-150 ease-out hover:enabled:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';

const iconButtonClass =
  'flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--an-message-radius-inner)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] outline-none transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]';

const checkboxClass =
  'h-3.5 w-3.5 cursor-pointer accent-[var(--an-primary-color)]';

function getSyncStatusMeta(status: SessionToImport['syncStatus']) {
  if (status === 'new') {
    return {
      label: 'New',
      tone: 'success',
      className: 'border-[color-mix(in_srgb,var(--an-success-color)_26%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_10%,var(--an-background))] text-[var(--an-success-color)]',
    };
  }

  if (status === 'needs-update') {
    return {
      label: 'Has Updates',
      tone: 'warning',
      className: 'border-[color-mix(in_srgb,var(--an-warning-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_9%,var(--an-background))] text-[var(--an-warning-color)]',
    };
  }

  return {
    label: 'In Sync',
    tone: 'muted',
    className: 'border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground-subtle)]',
  };
}

export const SessionImportDialog: React.FC<SessionImportDialogProps> = ({
  isOpen,
  onClose,
  onImport,
  currentWorkspacePath,
  filterByWorkspace = true  // Default to filtering by current workspace
}) => {
  const [sessions, setSessions] = useState<SessionToImport[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeNotice, setScopeNotice] = useState<string | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Load sessions when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    setScopeNotice(null);

    try {
      const scanSessions = async (workspacePath?: string) => {
        return window.electronAPI.invoke('claude-code:scan-sessions', { workspacePath });
      };

      // Prefer the current workspace for performance, but do not fail closed if
      // Claude stored the sessions under a sibling worktree, nested package
      // workspace, or a differently-resolved path.
      let result = await scanSessions(filterByWorkspace ? currentWorkspacePath : undefined);

      if (
        filterByWorkspace &&
        result.success &&
        Array.isArray(result.sessions) &&
        result.sessions.length === 0
      ) {
        result = await scanSessions();
        if (result.success && Array.isArray(result.sessions) && result.sessions.length > 0) {
          setScopeNotice('No sessions matched this exact workspace path. Showing all Claude Agent sessions instead.');
        }
      }

      if (result.success && Array.isArray(result.sessions)) {
        // Auto-select new and needs-update sessions
        const sessionsWithSelection = result.sessions.map((s: any) => ({
          ...s,
          selected: s.syncStatus === 'new' || s.syncStatus === 'needs-update',
        }));
        setSessions(sessionsWithSelection);

        const workspacePaths: string[] = Array.from(
          new Set(
            sessionsWithSelection.map((session: SessionToImport) => session.workspacePath)
          )
        );
        const initialExpanded = new Set<string>();
        if (workspacePaths.includes(currentWorkspacePath)) {
          initialExpanded.add(currentWorkspacePath);
        } else if (workspacePaths.length > 0) {
          initialExpanded.add(workspacePaths[0]);
        }
        setExpandedWorkspaces(initialExpanded);
      } else {
        setError(result.error || 'Failed to load sessions');
      }
    } catch (err) {
      console.error('[SessionImportDialog] Failed to load sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspacePath, filterByWorkspace]);

  const handleImport = async () => {
    const selectedSessionIds = sessions
      .filter(s => s.selected)
      .map(s => s.sessionId);

    if (selectedSessionIds.length === 0) {
      return;
    }

    setImporting(true);
    setError(null);

    try {
      await onImport(selectedSessionIds);
      onClose();
    } catch (err) {
      console.error('[SessionImportDialog] Failed to import sessions:', err);
      setError('Failed to import sessions');
    } finally {
      setImporting(false);
    }
  };

  const toggleSession = (sessionId: string) => {
    setSessions(prev =>
      prev.map(s => (s.sessionId === sessionId ? { ...s, selected: !s.selected } : s))
    );
  };

  const toggleWorkspace = (workspacePath: string) => {
    const workspaceSessions = sessions.filter(s => s.workspacePath === workspacePath);
    const allSelected = workspaceSessions.every(s => s.selected);

    setSessions(prev =>
      prev.map(s =>
        s.workspacePath === workspacePath ? { ...s, selected: !allSelected } : s
      )
    );
  };

  const toggleExpandWorkspace = (workspacePath: string) => {
    setExpandedWorkspaces(prev => {
      const next = new Set(prev);
      if (next.has(workspacePath)) {
        next.delete(workspacePath);
      } else {
        next.add(workspacePath);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSessions(prev => prev.map(s => ({ ...s, selected: true })));
  };

  const deselectAll = () => {
    setSessions(prev => prev.map(s => ({ ...s, selected: false })));
  };

  // Filter sessions by search query
  const filteredSessions = sessions.filter(session => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return session.title.toLowerCase().includes(query);
  });

  // Group sessions by workspace and sort by updatedAt (most recent first)
  const sessionsByWorkspace: SessionsByWorkspace = filteredSessions.reduce((acc, session) => {
    if (!acc[session.workspacePath]) {
      acc[session.workspacePath] = [];
    }
    acc[session.workspacePath].push(session);
    return acc;
  }, {} as SessionsByWorkspace);

  // Sort sessions within each workspace by updatedAt (most recent first)
  Object.keys(sessionsByWorkspace).forEach(workspace => {
    sessionsByWorkspace[workspace].sort((a, b) => b.updatedAt - a.updatedAt);
  });

  const workspacePaths = Object.keys(sessionsByWorkspace).sort();

  // Count stats
  const totalSessions = sessions.length;
  const newSessions = sessions.filter(s => s.syncStatus === 'new').length;
  const needsUpdate = sessions.filter(s => s.syncStatus === 'needs-update').length;
  const inSync = sessions.filter(s => s.syncStatus === 'up-to-date').length;
  const selectedCount = sessions.filter(s => s.selected).length;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="session-import-dialog-overlay nim-overlay agent-elements-session-import-backdrop"
      data-agent-elements-shell="session-import-backdrop"
      data-testid="agent-elements-session-import-backdrop"
      onClick={onClose}
    >
      <div
        className="session-import-dialog agent-elements-session-import-dialog agent-elements-tool-card flex w-[90%] max-w-[900px] max-h-[85vh] flex-col overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)]"
        data-component="SessionImportDialog"
        data-agent-elements-shell="session-import-dialog"
        data-testid="agent-elements-session-import-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="session-import-dialog-header agent-elements-session-import-header flex items-center justify-between gap-[var(--an-spacing-xl)] border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]"
          data-agent-elements-shell="session-import-header"
          data-testid="agent-elements-session-import-header"
        >
          <div className="min-w-0">
            <h2 className="m-0 text-base font-semibold leading-tight text-[var(--an-foreground)]">Import Claude Agent Sessions</h2>
          </div>
          <button
            className={`session-import-dialog-close agent-elements-session-import-close ${iconButtonClass}`}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <span aria-hidden="true" className="flex items-center">
              <MaterialSymbol icon="close" size={16} />
            </span>
          </button>
        </div>

        {loading ? (
          <div
            className="session-import-dialog-loading agent-elements-session-import-loading flex items-center justify-center gap-[var(--an-spacing-sm)] px-[var(--an-spacing-xxl)] py-10 text-center text-sm text-[var(--an-foreground-muted)]"
            data-agent-elements-shell="session-import-loading"
            data-testid="agent-elements-session-import-loading"
          >
            <MaterialSymbol icon="progress_activity" size={16} className="animate-spin" />
            <p>Scanning ~/.claude/projects/...</p>
          </div>
        ) : error ? (
          <div
            className="session-import-dialog-error agent-elements-session-import-error px-[var(--an-spacing-xxl)] py-10 text-center text-sm text-[var(--an-foreground-muted)]"
            data-agent-elements-shell="session-import-error"
            data-testid="agent-elements-session-import-error"
          >
            <p>{error}</p>
            <button
              className={`session-import-retry-button agent-elements-session-import-retry mt-3 ${primaryButtonClass}`}
              onClick={loadSessions}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div
              className="session-import-dialog-stats agent-elements-session-import-stats grid grid-cols-4 gap-[var(--an-spacing-sm)] border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]"
              data-agent-elements-shell="session-import-stats"
              data-testid="agent-elements-session-import-stats"
            >
              <div className="session-import-stat agent-elements-session-import-stat flex flex-col gap-[var(--an-spacing-xxs)] rounded-[var(--an-message-radius-inner)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)]" data-testid="agent-elements-session-import-stat">
                <span className="session-import-stat-value text-lg font-semibold leading-none text-[var(--an-foreground)]">{totalSessions}</span>
                <span className="session-import-stat-label text-[11px] font-medium leading-4 text-[var(--an-foreground-subtle)]">Total</span>
              </div>
              <div className="session-import-stat agent-elements-session-import-stat flex flex-col gap-[var(--an-spacing-xxs)] rounded-[var(--an-message-radius-inner)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)]" data-testid="agent-elements-session-import-stat">
                <span className="session-import-stat-value text-lg font-semibold leading-none text-[var(--an-foreground)]">{newSessions}</span>
                <span className="session-import-stat-label text-[11px] font-medium leading-4 text-[var(--an-foreground-subtle)]">New</span>
              </div>
              <div className="session-import-stat agent-elements-session-import-stat flex flex-col gap-[var(--an-spacing-xxs)] rounded-[var(--an-message-radius-inner)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)]" data-testid="agent-elements-session-import-stat">
                <span className="session-import-stat-value text-lg font-semibold leading-none text-[var(--an-foreground)]">{needsUpdate}</span>
                <span className="session-import-stat-label text-[11px] font-medium leading-4 text-[var(--an-foreground-subtle)]">Updates</span>
              </div>
              <div className="session-import-stat agent-elements-session-import-stat flex flex-col gap-[var(--an-spacing-xxs)] rounded-[var(--an-message-radius-inner)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)]" data-testid="agent-elements-session-import-stat">
                <span className="session-import-stat-value text-lg font-semibold leading-none text-[var(--an-foreground)]">{inSync}</span>
                <span className="session-import-stat-label text-[11px] font-medium leading-4 text-[var(--an-foreground-subtle)]">In Sync</span>
              </div>
            </div>

            <div
              className="session-import-dialog-search agent-elements-session-import-search border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]"
              data-agent-elements-shell="session-import-search"
              data-testid="agent-elements-session-import-search"
            >
              <input
                type="text"
                className="session-import-search-input agent-elements-session-import-search-input h-9 w-full rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-3 text-sm text-[var(--an-input-color)] outline-none transition-[border-color,background-color] duration-150 ease-out placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-focus-ring)]"
                placeholder="Search sessions by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {scopeNotice && (
              <div
                className="session-import-scope-notice agent-elements-session-import-scope-notice border-b border-[color-mix(in_srgb,var(--an-primary-color)_22%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_8%,var(--an-background))] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-md)] text-[13px] leading-5 text-[var(--an-foreground-muted)]"
                data-agent-elements-shell="session-import-scope-notice"
              >
                {scopeNotice}
              </div>
            )}

            <div
              className="session-import-dialog-actions agent-elements-session-import-actions flex gap-[var(--an-spacing-sm)] border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]"
              data-agent-elements-shell="session-import-actions"
              data-testid="agent-elements-session-import-actions"
            >
              <button
                onClick={selectAll}
                className={`session-import-action-button agent-elements-session-import-action ${secondaryButtonClass}`}
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className={`session-import-action-button agent-elements-session-import-action ${secondaryButtonClass}`}
              >
                Deselect All
              </button>
            </div>

            <div
              className="session-import-dialog-content agent-elements-session-import-content nim-scrollbar flex-1 overflow-y-auto bg-[var(--an-background)] py-[var(--an-spacing-sm)]"
              data-agent-elements-shell="session-import-content"
              data-testid="agent-elements-session-import-content"
            >
              {workspacePaths.length === 0 ? (
                <div
                  className="session-import-empty agent-elements-session-import-empty px-[var(--an-spacing-xxl)] py-10 text-center text-sm text-[var(--an-foreground-muted)]"
                  data-agent-elements-shell="session-import-empty"
                  data-testid="agent-elements-session-import-empty"
                >
                  <p>No Claude Agent sessions found</p>
                  <p className="session-import-empty-hint mt-2 text-[13px] text-[var(--an-foreground-subtle)]">
                    Sessions from the CLI will appear here
                  </p>
                </div>
              ) : (
                workspacePaths.map((workspacePath, workspaceIndex) => {
                  const workspaceSessions = sessionsByWorkspace[workspacePath];
                  const isExpanded = expandedWorkspaces.has(workspacePath);
                  const workspaceName = getFileName(workspacePath) || workspacePath;
                  const allSelected = workspaceSessions.every(s => s.selected);
                  const someSelected = workspaceSessions.some(s => s.selected);

                  return (
                    <div
                      key={workspacePath}
                      className="session-import-workspace-group agent-elements-session-import-workspace m-0"
                      data-agent-elements-shell="session-import-workspace"
                      data-testid={`agent-elements-session-import-workspace-${workspaceIndex}`}
                    >
                      <div
                        className="session-import-workspace-header agent-elements-session-import-workspace-header flex items-center gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-md)] transition-[background-color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)]"
                        data-agent-elements-shell="session-import-workspace-header"
                        data-testid="agent-elements-session-import-workspace-header"
                      >
                        <button
                          className={`session-import-workspace-toggle agent-elements-session-import-workspace-toggle ${iconButtonClass} h-6 w-6`}
                          onClick={() => toggleExpandWorkspace(workspacePath)}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} sessions in ${workspaceName}`}
                          aria-expanded={isExpanded}
                        >
                          <span
                            aria-hidden="true"
                            className="flex items-center transition-transform duration-150 ease-out"
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                          >
                            <MaterialSymbol icon="chevron_right" size={16} />
                          </span>
                        </button>
                        <input
                          className={`session-import-workspace-checkbox agent-elements-session-import-checkbox ${checkboxClass}`}
                          type="checkbox"
                          checked={allSelected}
                          ref={input => {
                            if (input) {
                              input.indeterminate = someSelected && !allSelected;
                            }
                          }}
                          onChange={() => toggleWorkspace(workspacePath)}
                          aria-label={`Select all sessions in ${workspaceName}`}
                        />
                        <span className="session-import-workspace-name agent-elements-session-import-workspace-name min-w-0 flex-1 truncate text-sm font-medium text-[var(--an-foreground)]">{workspaceName}</span>
                        <span className="session-import-workspace-count agent-elements-status-pill shrink-0 text-xs text-[var(--an-foreground-muted)]">
                          ({workspaceSessions.length})
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="session-import-session-list agent-elements-session-import-session-list p-0" data-agent-elements-shell="session-import-session-list">
                          {workspaceSessions.map(session => {
                            const statusMeta = getSyncStatusMeta(session.syncStatus);

                            return (
                              <div
                                key={session.sessionId}
                                data-id={session.sessionId}
                                className="session-import-session-item agent-elements-session-import-session flex items-start gap-[var(--an-spacing-md)] border-t border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)] transition-[background-color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)]"
                                data-agent-elements-shell="session-import-session"
                                data-testid={`agent-elements-session-import-session-${session.sessionId}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={session.selected}
                                  onChange={() => toggleSession(session.sessionId)}
                                  aria-label={`Select ${session.title}`}
                                  className={`mt-0.5 ${checkboxClass}`}
                                />
                                <div className="session-import-session-info min-w-0 flex-1">
                                  <div className="session-import-session-title mb-1 truncate text-sm font-medium text-[var(--an-foreground)]">{session.title}</div>
                                  <div className="session-import-session-meta flex flex-wrap items-center gap-x-[var(--an-spacing-sm)] gap-y-[var(--an-spacing-xs)] text-xs text-[var(--an-foreground-muted)]">
                                    <span>{getRelativeTimeString(session.updatedAt)}</span>
                                    <span aria-hidden="true" className="text-[var(--an-foreground-subtle)]">/</span>
                                    <span>{session.messageCount} messages</span>
                                    <span aria-hidden="true" className="text-[var(--an-foreground-subtle)]">/</span>
                                    <span>{session.tokenUsage.totalTokens.toLocaleString()} tokens</span>
                                    <span
                                      className={`session-import-status-badge agent-elements-status-pill shrink-0 border px-1.5 py-0.5 text-[11px] font-medium ${statusMeta.className}`}
                                      data-tone={statusMeta.tone}
                                    >
                                      {statusMeta.label}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div
              className="session-import-dialog-footer agent-elements-session-import-footer flex justify-end gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]"
              data-agent-elements-shell="session-import-footer"
              data-testid="agent-elements-session-import-footer"
            >
              <button
                className={`session-import-button-secondary agent-elements-session-import-secondary ${secondaryButtonClass}`}
                onClick={onClose}
                disabled={importing}
              >
                Cancel
              </button>
              <button
                className={`session-import-button-primary agent-elements-session-import-primary ${primaryButtonClass}`}
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
              >
                {importing ? 'Importing...' : `Import ${selectedCount} Session${selectedCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
