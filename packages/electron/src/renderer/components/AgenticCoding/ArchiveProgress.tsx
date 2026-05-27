import React, { useState, useEffect, useCallback } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface ArchiveTask {
  worktreeId: string;
  worktreeName: string;
  status: 'queued' | 'pending' | 'removing-worktree' | 'completed' | 'failed';
  startTime: Date;
  error?: string;
}

interface ArchiveProgressProps {
  /** Called when a worktree is fully archived (for refreshing the list) */
  onWorktreeArchived?: (worktreeId: string) => void;
}

const rootClass =
  'archive-progress agent-elements-archive-progress shrink-0 border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground)]';

const headerClass =
  'archive-progress-header agent-elements-archive-progress-header flex min-h-10 w-full cursor-pointer items-center gap-[var(--an-spacing-sm)] border-0 bg-transparent px-[var(--agent-elements-card-inline-padding)] py-[var(--an-spacing-sm)] text-left text-[13px] font-medium text-[var(--an-foreground)] transition-[background-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] focus:ring-inset';

const warningClass =
  'archive-progress-warning agent-elements-archive-progress-warning mx-[var(--agent-elements-card-inline-padding)] mb-[var(--an-spacing-sm)] flex items-start gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-warning-color)_30%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_9%,var(--an-background))] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';

const tasksClass =
  'archive-progress-tasks agent-elements-archive-progress-tasks flex flex-col gap-[var(--an-spacing-xs)] px-[var(--agent-elements-card-inline-padding)] pb-[var(--agent-elements-card-inline-padding)]';

const taskClass =
  'archive-task agent-elements-archive-task agent-elements-tool-card flex-row items-start gap-[var(--an-spacing-sm)] [--agent-elements-card-block-padding:var(--an-spacing-sm)] [--agent-elements-card-inline-padding:var(--an-spacing-md)]';

/**
 * Displays archive progress at the bottom of the session history sidebar.
 * Shows queued, in-progress, completed, and failed archive tasks.
 * Collapsed by default to save space, expandable to see details.
 * Auto-hides when there are no tasks.
 */
export const ArchiveProgress: React.FC<ArchiveProgressProps> = ({ onWorktreeArchived }) => {
  const [tasks, setTasks] = useState<ArchiveTask[]>([]);
  const [notifiedWorktrees, setNotifiedWorktrees] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  // Load initial tasks and subscribe to progress updates
  useEffect(() => {
    // Guard against archive API not being available (e.g., during hot reload before preload rebuilds)
    if (!window.electronAPI?.archive) {
      return;
    }

    // Get initial tasks
    window.electronAPI.archive.getTasks().then((result: { success: boolean; tasks: ArchiveTask[] }) => {
      if (result.success) {
        setTasks(result.tasks);
      }
    });

    // Subscribe to progress updates
    const unsubscribe = window.electronAPI.archive.onProgress((newTasks: ArchiveTask[]) => {
      setTasks(newTasks);

      // Notify parent when tasks complete (only once per worktree)
      if (onWorktreeArchived) {
        newTasks.forEach((task) => {
          if (task.status === 'completed' && !notifiedWorktrees.has(task.worktreeId)) {
            setNotifiedWorktrees((prev) => new Set(prev).add(task.worktreeId));
            onWorktreeArchived(task.worktreeId);
          }
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onWorktreeArchived, notifiedWorktrees]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Don't render anything if there are no tasks
  if (tasks.length === 0) {
    return null;
  }

  const getStatusIcon = (status: ArchiveTask['status']) => {
    switch (status) {
      case 'queued':
        return (
          <MaterialSymbol
            icon="schedule"
            className="archive-task-icon archive-task-icon--queued mt-0.5 shrink-0 text-lg text-[var(--an-foreground-subtle)]"
          />
        );
      case 'pending':
      case 'removing-worktree':
        return (
          <MaterialSymbol
            icon="progress_activity"
            className="archive-task-icon archive-task-icon--active mt-0.5 shrink-0 animate-spin text-lg text-[var(--an-primary-color)]"
          />
        );
      case 'completed':
        return (
          <MaterialSymbol
            icon="check_circle"
            className="archive-task-icon archive-task-icon--completed mt-0.5 shrink-0 text-lg text-[var(--an-success-color)]"
          />
        );
      case 'failed':
        return (
          <MaterialSymbol
            icon="error"
            className="archive-task-icon archive-task-icon--failed mt-0.5 shrink-0 text-lg text-[var(--an-error-color)]"
          />
        );
    }
  };

  const getStatusText = (status: ArchiveTask['status']) => {
    switch (status) {
      case 'queued':
        return 'Queued';
      case 'pending':
        return 'Starting...';
      case 'removing-worktree':
        return 'Removing worktree (this may take a while)...';
      case 'completed':
        return 'Archived';
      case 'failed':
        return 'Failed';
    }
  };

  // Count active tasks (queued, pending, or removing)
  const activeTasks = tasks.filter(
    (t) => t.status === 'queued' || t.status === 'pending' || t.status === 'removing-worktree'
  );
  const activeCount = activeTasks.length;

  return (
    <div
      className={rootClass}
      data-component="ArchiveProgress"
      data-agent-elements-shell="archive-progress"
      data-testid="agent-elements-archive-progress"
    >
      <button
        className={headerClass}
        onClick={handleToggleExpand}
        type="button"
        aria-expanded={isExpanded}
        data-agent-elements-shell="archive-progress-header"
        data-testid="agent-elements-archive-progress-header"
      >
        <MaterialSymbol
          icon="archive"
          className="archive-progress-header-icon shrink-0 text-lg text-[var(--an-foreground-muted)]"
        />
        <span className="archive-progress-header-text min-w-0 flex-1 truncate text-left">Archive Tasks</span>
        {activeCount > 0 && (
          <span className="archive-progress-header-count shrink-0 text-[13px] font-medium text-[var(--an-primary-color)]">
            {activeCount} active
          </span>
        )}
        <MaterialSymbol
          icon="expand_more"
          className={`archive-progress-header-chevron shrink-0 text-lg text-[var(--an-foreground-muted)] transition-transform duration-200 ease-out ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      {isExpanded && (
        <div className="archive-progress-content flex flex-col">
          {activeTasks.length > 0 && (
            <div
              className={warningClass}
              data-agent-elements-shell="archive-progress-warning"
              data-testid="agent-elements-archive-progress-warning"
            >
              <MaterialSymbol
                icon="warning"
                className="archive-progress-warning-icon mt-px shrink-0 text-base text-[var(--an-warning-color)]"
              />
              <span className="archive-progress-warning-text select-text text-[11px] leading-[1.4] text-[var(--an-foreground-muted)]">
                Worktree removal can take several minutes for large repositories
              </span>
            </div>
          )}
          <div className={tasksClass} data-agent-elements-shell="archive-progress-tasks">
            {tasks.map((task) => (
              <div
                key={task.worktreeId}
                className={`${taskClass} ${task.status === 'completed' ? 'opacity-60' : ''}`}
                data-agent-elements-shell="archive-task"
                data-archive-status={task.status}
                data-testid={`agent-elements-archive-task-${task.worktreeId}`}
              >
                {getStatusIcon(task.status)}
                <div className="archive-task-content flex min-w-0 flex-1 flex-col gap-[var(--an-spacing-xxs)]">
                  <div className="archive-task-name overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-[var(--an-foreground)]">
                    {task.worktreeName}
                  </div>
                  <div className="archive-task-path overflow-hidden text-ellipsis whitespace-nowrap font-[var(--an-mono-font)] text-[11px] text-[var(--an-foreground-subtle)]">
                    {task.worktreeId}
                  </div>
                  <div
                    className={`archive-task-status mt-0.5 text-xs ${task.status === 'failed' ? 'text-[var(--an-error-color)]' : 'text-[var(--an-foreground-muted)]'}`}
                  >
                    {task.error || getStatusText(task.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
