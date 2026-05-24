import React, { useCallback, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol, ProviderIcon } from '@nimbalyst/runtime';
import { HelpTooltip } from '../../help';
import { FloatingPortal, useFloatingMenu } from '../../hooks/useFloatingMenu';
import {
  backgroundTaskCountAtom,
  backgroundTaskHasErrorAtom,
  backgroundTasksByCategoryAtom,
  backgroundTaskSyncStatusAtom,
  type BackgroundTask,
  type BackgroundTaskSyncState,
} from '../../store/atoms/backgroundTasks';
import { syncStatusUpdateAtom } from '../../store/atoms/syncStatus';

interface BackgroundTaskIndicatorProps {
  workspacePath?: string;
  onOpenSession?: (sessionId: string) => void;
}

function formatDuration(startedAt?: number, now: number = Date.now()): string {
  if (!startedAt) {
    return '';
  }

  const diffMs = Math.max(0, now - startedAt);
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes % 60}m`;
  }

  if (diffMinutes > 0) {
    return `${diffMinutes}m`;
  }

  return `${Math.max(1, diffSeconds)}s`;
}

function formatLastSync(lastSyncedAt: number | null): string {
  if (!lastSyncedAt) {
    return 'Never';
  }

  return formatDuration(lastSyncedAt);
}

function getTaskIcon(task: BackgroundTask): string {
  if (task.status === 'error') {
    return 'cloud_off';
  }

  if (task.status === 'running') {
    return 'sync';
  }

  if (task.status === 'connected') {
    return 'cloud_done';
  }

  return 'cloud';
}

const SessionRunningIndicator: React.FC = () => (
  <div
    className="session-list-item-status processing agent-elements-background-task-running flex h-5 w-5 items-center justify-center text-[var(--an-primary-color)] opacity-80"
    data-agent-elements-shell="background-task-running"
    title="Processing..."
  >
    <MaterialSymbol icon="progress_activity" size={14} className="animate-spin" />
  </div>
);

function getTaskStatusLabel(task: BackgroundTask): string {
  switch (task.status) {
    case 'running':
      return 'Running';
    case 'connected':
      return 'Connected';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
}

function getTaskStatusClasses(task: BackgroundTask): string {
  switch (task.status) {
    case 'running':
      return 'border-[color-mix(in_srgb,var(--nim-info)_26%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-info)_10%,var(--an-background))] text-[var(--nim-info)]';
    case 'connected':
      return 'border-[color-mix(in_srgb,var(--nim-success)_26%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-success)_10%,var(--an-background))] text-[var(--nim-success)]';
    case 'error':
      return 'border-[color-mix(in_srgb,var(--nim-error)_26%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-error)_10%,var(--an-background))] text-[var(--nim-error)]';
    default:
      return 'border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground-muted)]';
  }
}

function getTaskIconClasses(task: BackgroundTask): string {
  switch (task.status) {
    case 'running':
      return 'border-[color-mix(in_srgb,var(--nim-info)_22%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-info)_8%,var(--an-background))] text-[var(--nim-info)]';
    case 'connected':
      return 'border-[color-mix(in_srgb,var(--nim-success)_22%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-success)_8%,var(--an-background))] text-[var(--nim-success)]';
    case 'error':
      return 'border-[color-mix(in_srgb,var(--nim-error)_22%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-error)_8%,var(--an-background))] text-[var(--nim-error)]';
    default:
      return 'border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground-muted)]';
  }
}

function getTaskDomId(task: BackgroundTask): string {
  return task.id.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const TaskRow: React.FC<{
  task: BackgroundTask;
  now: number;
  onOpenSession?: (sessionId: string) => void;
}> = ({ task, now, onOpenSession }) => {
  const canOpenSession = Boolean(task.sessionId && onOpenSession);
  const taskDomId = getTaskDomId(task);

  return (
    <div
      className="agent-elements-background-task-row flex items-start gap-3 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-3 py-2 text-[var(--an-foreground)]"
      data-agent-elements-shell="background-task-row"
      data-task-category={task.category}
      data-task-status={task.status}
      data-testid={`agent-elements-background-task-row-${taskDomId}`}
    >
      <div className={`agent-elements-background-task-icon mt-0.5 flex h-7 w-7 items-center justify-center rounded-[var(--an-tool-border-radius)] border ${getTaskIconClasses(task)}`}>
        {task.category === 'ai-session' ? (
          <ProviderIcon provider={task.provider || 'claude-code'} size={16} />
        ) : (
          <MaterialSymbol icon={getTaskIcon(task)} size={16} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="agent-elements-background-task-label truncate text-[13px] font-medium leading-5 text-[var(--an-foreground)] select-text">{task.label}</div>
            <div className="agent-elements-background-task-detail mt-0.5 text-[11px] leading-4 text-[var(--an-foreground-muted)] select-text">{task.detail}</div>
          </div>
          {task.category === 'ai-session' && task.status === 'running' ? (
            <SessionRunningIndicator />
          ) : (
            <span className={`agent-elements-status-pill agent-elements-background-task-status shrink-0 rounded-[999px] border px-2 py-0.5 text-[10px] font-medium leading-4 ${getTaskStatusClasses(task)}`}>
              {getTaskStatusLabel(task)}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="agent-elements-background-task-duration text-[10px] leading-4 text-[var(--an-foreground-subtle)]">
            {task.startedAt ? `Active ${formatDuration(task.startedAt, now)}` : 'Standing by'}
          </span>
          {canOpenSession && task.sessionId ? (
            <button
              type="button"
              className="agent-elements-background-task-action rounded-[var(--an-tool-border-radius)] border border-transparent px-2 py-0.5 text-[11px] font-medium text-[var(--an-primary-color)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--nim-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
              onClick={() => {
                if (task.sessionId) {
                  onOpenSession?.(task.sessionId);
                }
              }}
            >
              View
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div
    className="agent-elements-background-task-empty rounded-[var(--an-tool-border-radius)] border border-dashed border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-3 py-2 text-[12px] leading-5 text-[var(--an-foreground-muted)]"
    data-agent-elements-shell="background-task-empty"
  >
    {label}
  </div>
);

export const BackgroundTaskIndicator: React.FC<BackgroundTaskIndicatorProps> = ({
  workspacePath,
  onOpenSession,
}) => {
  const isDevMode = import.meta.env.DEV || window.IS_DEV_MODE;
  const activeTaskCount = useAtomValue(backgroundTaskCountAtom);
  const hasError = useAtomValue(backgroundTaskHasErrorAtom);
  const tasksByCategory = useAtomValue(backgroundTasksByCategoryAtom);
  const syncStatus = useAtomValue(backgroundTaskSyncStatusAtom);
  const setSyncStatus = useSetAtom(backgroundTaskSyncStatusAtom);
  const [now, setNow] = React.useState(Date.now());
  const menu = useFloatingMenu({
    placement: 'right-end',
  });

  const fetchSyncStatus = useCallback(async () => {
    try {
      const result = await window.electronAPI.invoke('sync:get-status', workspacePath);
      const nextState: BackgroundTaskSyncState = {
        appConfigured: Boolean(result?.appConfigured),
        projectEnabled: Boolean(result?.projectEnabled),
        connected: Boolean(result?.connected),
        syncing: Boolean(result?.syncing),
        error: result?.error ?? null,
        stats: result?.stats ?? { sessionCount: 0, lastSyncedAt: null },
        docSyncStats: result?.docSyncStats,
        userEmail: result?.userEmail ?? null,
        lastUpdatedAt: Date.now(),
      };
      setSyncStatus(nextState);
    } catch (error) {
      console.error('[BackgroundTaskIndicator] Failed to fetch sync status:', error);
      setSyncStatus((prev) => ({
        ...prev,
        error: prev.error ?? 'Failed to fetch sync status',
        lastUpdatedAt: Date.now(),
      }));
    }
  }, [setSyncStatus, workspacePath]);

  useEffect(() => {
    if (!isDevMode) {
      return;
    }

    fetchSyncStatus();
    window.electronAPI.invoke('sync:subscribe-status').catch(() => undefined);
  }, [fetchSyncStatus, isDevMode]);

  // Apply incremental sync status updates from the central listener
  // (store/listeners/syncListeners.ts).
  const syncStatusUpdate = useAtomValue(syncStatusUpdateAtom);
  useEffect(() => {
    if (!isDevMode || !syncStatusUpdate) return;
    setSyncStatus((prev) => ({
      ...prev,
      connected: syncStatusUpdate.connected,
      syncing: syncStatusUpdate.syncing,
      error: syncStatusUpdate.error,
      lastUpdatedAt: Date.now(),
    }));
  }, [syncStatusUpdate, isDevMode, setSyncStatus]);

  useEffect(() => {
    if (!menu.isOpen) {
      return;
    }

    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [menu.isOpen]);

  if (!isDevMode) {
    return null;
  }

  const syncTask = tasksByCategory.sync[0];
  const buttonIcon = hasError ? 'error' : activeTaskCount > 0 ? 'progress_activity' : 'check_circle';
  const buttonLabel = hasError
    ? 'Background tasks have an error'
    : activeTaskCount > 0
      ? `${activeTaskCount} background task${activeTaskCount === 1 ? '' : 's'} running`
      : 'No active background tasks';

  return (
    <div
      className="background-task-indicator agent-elements-background-task-indicator relative"
      data-component="BackgroundTaskIndicator"
      data-agent-elements-shell="background-task-indicator"
    >
      <HelpTooltip testId="gutter-background-tasks-button" placement="right">
        <button
          ref={menu.refs.setReference}
          {...menu.getReferenceProps()}
          type="button"
          className={`nav-button agent-elements-background-task-button relative flex h-9 w-9 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-transparent bg-transparent p-0 transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)] ${hasError ? 'text-[var(--nim-error)]' : 'text-[var(--an-foreground-muted)]'}`}
          onClick={() => menu.setIsOpen(!menu.isOpen)}
          aria-label={buttonLabel}
          aria-expanded={menu.isOpen}
          aria-haspopup="menu"
          data-component="BackgroundTaskIndicator"
          data-agent-elements-shell="background-task-button"
          data-testid="gutter-background-tasks-button"
        >
          <MaterialSymbol
            icon={buttonIcon}
            size={20}
          />
          {activeTaskCount > 0 ? (
            <span
              className="agent-elements-background-task-count absolute -right-0.5 -top-0.5 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-[999px] bg-[var(--an-primary-color)] px-1 text-[10px] font-semibold text-[var(--an-background)]"
              data-agent-elements-shell="background-task-count"
            >
              {activeTaskCount > 9 ? '9+' : activeTaskCount}
            </span>
          ) : null}
          {hasError ? (
            <span
              className="agent-elements-background-task-error-dot absolute right-1 top-1 h-2.5 w-2.5 rounded-[999px] border border-[var(--an-background)] bg-[var(--nim-error)]"
              data-agent-elements-shell="background-task-error-dot"
            />
          ) : null}
        </button>
      </HelpTooltip>

      {menu.isOpen ? (
        <FloatingPortal>
          <div
            ref={menu.refs.setFloating}
            style={menu.floatingStyles}
            {...menu.getFloatingProps()}
            className="background-tasks-popover agent-elements-background-tasks-popover agent-elements-tool-card z-50 max-h-[min(480px,calc(100vh-24px))] w-80 overflow-y-auto rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--nim-text)_18%,transparent)]"
            data-component="BackgroundTaskIndicatorPopover"
            data-agent-elements-shell="background-tasks-popover"
            data-testid="background-tasks-popover"
          >
            <div className="agent-elements-background-tasks-header flex items-center justify-between border-b border-[var(--an-border-color)] px-4 py-3">
              <div>
                <div className="text-[14px] font-semibold leading-5 text-[var(--an-foreground)]">Background Tasks</div>
                <div className="mt-0.5 text-[11px] leading-4 text-[var(--an-foreground-muted)]">
                  Dev mode only. {activeTaskCount > 0 ? `${activeTaskCount} active` : 'No active work'}.
                </div>
              </div>
              <button
                type="button"
                className="agent-elements-background-tasks-close rounded-[var(--an-tool-border-radius)] border border-transparent p-1 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
                onClick={() => menu.setIsOpen(false)}
                aria-label="Close background tasks"
              >
                <MaterialSymbol icon="close" size={14} />
              </button>
            </div>

            <div className="agent-elements-background-tasks-sections space-y-4 px-4 py-3">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="m-0 text-[12px] font-semibold leading-5 text-[var(--an-foreground-muted)]">
                    AI Sessions
                  </h3>
                  <span className="agent-elements-status-pill rounded-[999px] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-2 py-0.5 text-[10px] font-medium leading-4 text-[var(--an-foreground-subtle)]">
                    {tasksByCategory.aiSessions.length} running
                  </span>
                </div>
                <div className="space-y-2">
                  {tasksByCategory.aiSessions.length > 0 ? (
                    tasksByCategory.aiSessions.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        now={now}
                        onOpenSession={(sessionId) => {
                          onOpenSession?.(sessionId);
                          menu.setIsOpen(false);
                        }}
                      />
                    ))
                  ) : (
                    <EmptyState label="No AI sessions are currently running." />
                  )}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="m-0 text-[12px] font-semibold leading-5 text-[var(--an-foreground-muted)]">
                    Sync
                  </h3>
                  <span className="text-[11px] leading-4 text-[var(--an-foreground-subtle)]">
                    Last sync {formatLastSync(syncStatus.stats.lastSyncedAt)}
                  </span>
                </div>
                <div className="space-y-2">
                  {syncTask ? (
                    <TaskRow task={syncTask} now={now} />
                  ) : (
                    <EmptyState label="Sync status is unavailable." />
                  )}
                </div>
              </section>
            </div>
          </div>
        </FloatingPortal>
      ) : null}
    </div>
  );
};
