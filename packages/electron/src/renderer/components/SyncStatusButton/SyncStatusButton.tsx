import React, { useState, useEffect, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { HelpTooltip } from '../../help';
import { FloatingPortal, useFloatingMenu } from '../../hooks/useFloatingMenu';
import { syncStatusUpdateAtom } from '../../store/atoms/syncStatus';

export interface SyncConfig {
  enabled: boolean;
  serverUrl: string;
  userId: string;
  authToken: string;
  enabledProjects?: string[];
}

export interface SyncStats {
  sessionCount: number;
  lastSyncedAt: number | null;
}

export interface DocSyncStats {
  projectCount: number;
  fileCount: number;
  connected: boolean;
}

export interface SyncStatus {
  appConfigured: boolean;       // Is sync configured at the app level?
  projectEnabled: boolean;      // Is current project enabled for sync?
  connected: boolean;           // Is the connection active?
  syncing: boolean;             // Is a sync in progress?
  error: string | null;
  stats: SyncStats;
  docSyncStats?: DocSyncStats;  // Document file sync stats
  userEmail?: string | null;    // Logged in user's email
}

interface SyncStatusButtonProps {
  workspacePath?: string;
  onOpenSettings?: () => void;
}

const floatingPopoverCardGutters =
  '[--agent-elements-card-block-padding:var(--an-spacing-xs)] [--agent-elements-card-inline-padding:var(--an-spacing-xs)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';

export const SyncStatusButton: React.FC<SyncStatusButtonProps> = ({ workspacePath, onOpenSettings }) => {
  const menu = useFloatingMenu({ placement: 'right-end', offsetPx: 8, constrainHeight: true });
  const [status, setStatus] = useState<SyncStatus>({
    appConfigured: false,
    projectEnabled: false,
    connected: false,
    syncing: false,
    error: null,
    stats: {
      sessionCount: 0,
      lastSyncedAt: null,
    },
  });

  // Fetch sync status (called once on mount and when workspace changes)
  const fetchStatus = useCallback(async () => {
    try {
      const result = await window.electronAPI.invoke('sync:get-status', workspacePath);
      if (result) {
        setStatus(result);
      }
    } catch (error) {
      console.error('[SyncStatusButton] Failed to fetch sync status:', error);
    }
  }, [workspacePath]);

  // Initial fetch and subscribe to status changes (no polling).
  // The IPC subscription lives in store/listeners/syncListeners.ts; we just
  // ensure the main process is broadcasting and rely on syncStatusUpdateAtom.
  useEffect(() => {
    fetchStatus();
    window.electronAPI.invoke('sync:subscribe-status');
  }, [fetchStatus]);

  // Apply incremental status updates broadcast via IPC.
  const syncStatusUpdate = useAtomValue(syncStatusUpdateAtom);
  useEffect(() => {
    if (!syncStatusUpdate) return;
    setStatus(prev => ({
      ...prev,
      connected: syncStatusUpdate.connected,
      syncing: syncStatusUpdate.syncing,
      error: syncStatusUpdate.error,
    }));
  }, [syncStatusUpdate]);

  // Don't render if sync is not configured at all
  if (!status.appConfigured) {
    return null;
  }

  const handleToggleProjectSync = async () => {
    try {
      await window.electronAPI.invoke('sync:toggle-project', workspacePath, !status.projectEnabled);
      await fetchStatus();
    } catch (error) {
      console.error('[SyncStatusButton] Failed to toggle project sync:', error);
    }
  };

  const handleOpenSettings = () => {
    menu.setIsOpen(false);
    if (onOpenSettings) {
      onOpenSettings();
    }
  };

  const getStatusIcon = (): string => {
    if (!status.projectEnabled) {
      return 'cloud_off';
    }
    if (status.error) {
      return 'cloud_off';
    }
    if (status.syncing) {
      return 'cloud_sync';
    }
    if (status.connected) {
      return 'cloud_done';
    }
    return 'cloud_off';
  };

  const getStatusClass = (): string => {
    if (!status.projectEnabled) {
      return 'disabled';
    }
    if (status.error) {
      return 'error';
    }
    if (status.syncing) {
      return 'syncing';
    }
    if (status.connected) {
      return 'connected';
    }
    return 'disconnected';
  };

  const getButtonColorClass = (): string => {
    const statusClass = getStatusClass();
    if (statusClass === 'error') {
      return 'text-[var(--an-diff-removed-text)]';
    }
    if (statusClass === 'syncing') {
      return 'text-[var(--an-primary-color)]';
    }
    if (statusClass === 'disconnected') {
      return 'text-[var(--an-warning-color)]';
    }
    if (statusClass === 'disabled') {
      return 'text-[var(--an-foreground-subtle)] opacity-70';
    }
    return 'text-[var(--an-foreground-muted)]';
  };

  const getIndicatorColorClass = (): string => {
    const statusClass = getStatusClass();
    switch (statusClass) {
      case 'connected':
        return 'bg-[var(--an-success-color)]';
      case 'syncing':
        return 'bg-[var(--an-primary-color)] animate-pulse';
      case 'disconnected':
        return 'bg-[var(--an-warning-color)]';
      case 'error':
        return 'bg-[var(--an-diff-removed-text)]';
      case 'disabled':
        return 'bg-[var(--an-foreground-subtle)]';
      default:
        return '';
    }
  };

  const getBadgeColorClass = (): string => {
    const statusClass = getStatusClass();
    switch (statusClass) {
      case 'connected':
        return 'border-[color-mix(in_srgb,var(--an-success-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_10%,var(--an-background))] text-[var(--an-success-color)]';
      case 'syncing':
        return 'border-[color-mix(in_srgb,var(--an-primary-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] text-[var(--an-primary-color)]';
      case 'disconnected':
        return 'border-[color-mix(in_srgb,var(--an-warning-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_10%,var(--an-background))] text-[var(--an-warning-color)]';
      case 'error':
        return 'border-[color-mix(in_srgb,var(--an-diff-removed-text)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-diff-removed-text)_10%,var(--an-background))] text-[var(--an-diff-removed-text)]';
      case 'disabled':
        return 'border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground-subtle)]';
      default:
        return '';
    }
  };

  const getDocSyncStatusClass = (): string => {
    if (status.docSyncStats?.connected) {
      return 'text-[var(--an-success-color)]';
    }
    return 'text-[var(--an-foreground-subtle)]';
  };

  const getStatusLabel = (): string => {
    if (!status.projectEnabled) {
      return 'Sync disabled for this project';
    }
    if (status.error) {
      return 'Sync error';
    }
    if (status.syncing) {
      return 'Syncing...';
    }
    if (status.connected) {
      return 'Sync connected';
    }
    return 'Sync disconnected';
  };

  const formatLastSync = (): string => {
    if (!status.stats.lastSyncedAt) {
      return 'Never';
    }
    const date = new Date(status.stats.lastSyncedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    return `${diffDays}d ago`;
  };

  const statusClass = getStatusClass();
  const projectEnabled = status.projectEnabled ? 'true' : 'false';

  return (
    <div
      className="sync-status-button-container agent-elements-sync-status-button relative"
      data-testid="agent-elements-sync-status-button"
      data-component="SyncStatusButton"
      data-agent-elements-shell="sync-status-button"
      data-sync-status={statusClass}
      data-project-enabled={projectEnabled}
    >
      <HelpTooltip testId="gutter-sync-button" placement="right">
        <button
          ref={menu.refs.setReference as React.RefCallback<HTMLButtonElement>}
          {...menu.getReferenceProps()}
          type="button"
          className={`sync-status-button nav-button agent-elements-sync-status-trigger relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--an-tool-border-radius)] border border-transparent bg-transparent p-0 transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)] ${statusClass} ${getButtonColorClass()}`}
          onClick={() => menu.setIsOpen(!menu.isOpen)}
          aria-label={getStatusLabel()}
          aria-expanded={menu.isOpen}
          aria-haspopup="menu"
          data-testid="gutter-sync-button"
          data-component="SyncStatusButtonTrigger"
          data-agent-elements-shell="sync-status-trigger"
          data-sync-status={statusClass}
          data-project-enabled={projectEnabled}
        >
          <MaterialSymbol icon={getStatusIcon()} size={20} />
          <span
            className={`sync-indicator agent-elements-sync-status-indicator absolute bottom-1 right-1 h-2 w-2 rounded-[999px] border-2 border-[var(--an-background)] ${statusClass} ${getIndicatorColorClass()}`}
            data-testid="agent-elements-sync-status-indicator"
            data-agent-elements-shell="sync-status-indicator"
            data-sync-status={statusClass}
          />
        </button>
      </HelpTooltip>

      {menu.isOpen && (
        <FloatingPortal>
          <div
            ref={menu.refs.setFloating as React.RefCallback<HTMLDivElement>}
            style={menu.floatingStyles}
            {...menu.getFloatingProps()}
            className={`sync-menu agent-elements-sync-status-menu agent-elements-tool-card z-[1000] min-w-[280px] max-w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-tool-background)] text-[var(--an-foreground)] shadow-[0_16px_48px_color-mix(in_srgb,var(--an-foreground)_12%,transparent)] ${floatingPopoverCardGutters}`}
            role="menu"
            aria-label="Session sync"
            data-testid="agent-elements-sync-status-menu"
            data-component="SyncStatusButtonMenu"
            data-agent-elements-shell="sync-status-menu"
            data-agent-elements-card-padding="symmetric-inline"
            data-agent-elements-card-width="floating-popover"
            data-sync-status={statusClass}
            data-project-enabled={projectEnabled}
          >
            <div
              className="sync-menu-header agent-elements-sync-status-menu-header flex items-center justify-between gap-3 px-3 pb-2 pt-3"
              data-agent-elements-shell="sync-status-menu-header"
            >
              <span className="sync-menu-title text-[13px] font-semibold leading-5 text-[var(--an-foreground)]">
                Session Sync
              </span>
              <span
                className={`sync-status-badge agent-elements-sync-status-badge agent-elements-status-pill rounded-[999px] border px-2 py-0.5 text-[11px] font-medium leading-4 ${getBadgeColorClass()}`}
                data-testid="agent-elements-sync-status-badge"
                data-agent-elements-shell="sync-status-badge"
                data-sync-status={statusClass}
              >
                {status.projectEnabled ? (status.connected ? 'Connected' : 'Disconnected') : 'Disabled'}
              </span>
            </div>

            {status.userEmail && (
              <div
                className="sync-menu-user agent-elements-sync-status-user mx-2 flex items-center gap-2 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-3 py-2 text-xs text-[var(--an-foreground-muted)]"
                data-agent-elements-shell="sync-status-user"
              >
                <MaterialSymbol icon="account_circle" size={16} />
                <span className="min-w-0 truncate select-text">{status.userEmail}</span>
              </div>
            )}

            {status.error && (
              <div
                className="sync-menu-error agent-elements-sync-status-error mx-2 mt-2 flex items-center gap-2 rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-diff-removed-text)_26%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-diff-removed-text)_8%,var(--an-background))] px-3 py-2 text-xs text-[var(--an-diff-removed-text)]"
                data-agent-elements-shell="sync-status-error"
              >
                <MaterialSymbol icon="error" size={16} />
                <span className="select-text">{status.error}</span>
              </div>
            )}

            <div
              className="sync-menu-stats agent-elements-sync-status-stats px-3 py-3"
              data-agent-elements-shell="sync-status-stats"
            >
              <div
                className="sync-stat agent-elements-sync-status-stat flex items-center justify-between gap-6 py-1"
                data-testid="agent-elements-sync-status-stat-sessions"
                data-agent-elements-shell="sync-status-stat"
              >
                <span className="sync-stat-label text-xs text-[var(--an-foreground-muted)]">Sessions synced</span>
                <span className="sync-stat-value text-xs font-medium text-[var(--an-foreground)]">
                  {status.stats.sessionCount}
                </span>
              </div>
              <div
                className="sync-stat agent-elements-sync-status-stat flex items-center justify-between gap-6 py-1"
                data-testid="agent-elements-sync-status-stat-last-sync"
                data-agent-elements-shell="sync-status-stat"
              >
                <span className="sync-stat-label text-xs text-[var(--an-foreground-muted)]">Last sync</span>
                <span className="sync-stat-value text-xs font-medium text-[var(--an-foreground)]">
                  {formatLastSync()}
                </span>
              </div>
            </div>

            {status.docSyncStats && status.docSyncStats.fileCount > 0 && (
              <>
                <div className="sync-menu-divider mx-2 h-px bg-[var(--an-border-color)]" />
                <div
                  className="agent-elements-sync-status-docs px-3 py-3"
                  data-agent-elements-shell="sync-status-docs"
                >
                  <div className="mb-2 flex items-center gap-1.5">
                    <MaterialSymbol icon="description" size={14} className="text-[var(--an-foreground-muted)]" />
                    <span className="text-[11px] font-medium text-[var(--an-foreground-muted)]">Document Sync</span>
                  </div>
                  <div
                    className="sync-stat agent-elements-sync-status-stat flex items-center justify-between gap-6 py-1"
                    data-agent-elements-shell="sync-status-stat"
                  >
                    <span className="sync-stat-label text-xs text-[var(--an-foreground-muted)]">Files tracked</span>
                    <span className="sync-stat-value text-xs font-medium text-[var(--an-foreground)]">
                      {status.docSyncStats.fileCount}
                    </span>
                  </div>
                  <div
                    className="sync-stat agent-elements-sync-status-stat flex items-center justify-between gap-6 py-1"
                    data-agent-elements-shell="sync-status-stat"
                  >
                    <span className="sync-stat-label text-xs text-[var(--an-foreground-muted)]">Status</span>
                    <span className={`sync-stat-value text-xs font-medium ${getDocSyncStatusClass()}`}>
                      {status.docSyncStats.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="sync-menu-divider mx-2 h-px bg-[var(--an-border-color)]" />

            <div
              className="sync-menu-actions agent-elements-sync-status-actions p-1.5"
              data-agent-elements-shell="sync-status-actions"
            >
              <button
                type="button"
                className="sync-menu-action agent-elements-sync-status-action flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--an-tool-border-radius)] border border-transparent bg-transparent px-2.5 py-2 text-left text-[13px] text-[var(--an-foreground)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
                onClick={handleToggleProjectSync}
                role="menuitem"
              >
                <span className="text-[var(--an-foreground-muted)]">
                  <MaterialSymbol icon={status.projectEnabled ? 'toggle_on' : 'toggle_off'} size={18} />
                </span>
                <span>{status.projectEnabled ? 'Disable sync for this project' : 'Enable sync for this project'}</span>
              </button>
              <button
                type="button"
                className="sync-menu-action agent-elements-sync-status-action flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--an-tool-border-radius)] border border-transparent bg-transparent px-2.5 py-2 text-left text-[13px] text-[var(--an-foreground)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
                onClick={handleOpenSettings}
                role="menuitem"
              >
                <span className="text-[var(--an-foreground-muted)]">
                  <MaterialSymbol icon="settings" size={18} />
                </span>
                <span>Sync settings</span>
              </button>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
};
