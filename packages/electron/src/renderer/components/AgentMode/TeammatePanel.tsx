/**
 * TeammatePanel - Collapsible panel showing teammates and SDK-native sub-agent tasks.
 *
 * Two sections:
 * - "Teammates" for real team members (from currentTeammates metadata)
 * - "Sub-agents" for SDK-native tasks (from currentTasks metadata, driven by
 *   task_started/task_progress/task_notification events)
 *
 * Each section is independently collapsible. Sections only render when they have entries.
 * Collapse state is persisted at the project level.
 *
 * Clicking a teammate item scrolls the transcript to its spawn point via scrollToTeammateAtom.
 */

import React, { useCallback, useMemo, useState, useEffect, useId } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import {
  teammatePanelCollapsedAtom, toggleTeammatePanelCollapsedAtom,
  agentPanelCollapsedAtom, toggleAgentPanelCollapsedAtom,
  sessionTeammatesAtom, scrollToTeammateAtom,
  sessionTasksAtom, type TaskInfo,
} from '../../store/atoms/agentMode';

export interface TeammateInfo {
  name: string;
  agentId: string;
  teamName: string;
  agentType: string;
  status: 'running' | 'completed' | 'errored' | 'idle';
  model?: string;
  startedAt?: number;
  lastActiveAt?: number;
  toolCallCount?: number;
}

interface TeammatePanelProps {
  /** The session ID to get teammates from */
  sessionId: string;
}

const panelClass = [
  'teammate-panel',
  'agent-elements-teammate-panel',
  'flex shrink-0 flex-col border-t border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] text-[var(--an-foreground)] [container-type:inline-size]',
].join(' ');

const sectionClass = [
  'agent-elements-teammate-section',
  'flex flex-col',
].join(' ');

const sectionHeaderClass = [
  'agent-elements-teammate-section-header',
  'flex min-h-[34px] w-full cursor-pointer items-center gap-[var(--an-spacing-sm)]',
  'border border-transparent bg-transparent px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)]',
  'text-left text-[var(--an-foreground-muted)] outline-none',
  'transition-[background-color,border-color,color] duration-150 ease-out',
  'hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const sectionContentClass = [
  'agent-elements-teammate-section-content',
  'nim-scrollbar max-h-[200px] overflow-y-auto px-[var(--an-spacing-lg)]',
  'pb-[var(--an-spacing-md)] pt-[var(--an-spacing-xs)]',
].join(' ');

const itemClass = [
  'flex w-full items-start gap-[var(--an-spacing-sm)]',
  'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-transparent',
  'bg-transparent px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-left text-xs outline-none',
  'transition-[background-color,border-color,color,opacity] duration-150 ease-out',
  'data-[active=true]:border-[color-mix(in_srgb,var(--agent-panel-accent)_18%,var(--an-border-color))]',
  'data-[active=true]:bg-[color-mix(in_srgb,var(--agent-panel-accent)_10%,var(--an-background-tertiary))]',
  'data-[done=true]:opacity-70',
].join(' ');

const clickableItemClass = [
  itemClass,
  'cursor-pointer hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]',
].join(' ');

function getStatusTone(status: string | undefined): string {
  if (!status) return 'neutral';
  if (status === 'running') return 'running';
  if (status === 'idle') return 'neutral';
  if (status === 'completed') return 'success';
  if (status === 'failed' || status === 'stopped' || status === 'errored') return 'error';
  return 'neutral';
}

function getStatusIcon(status: string | undefined): string {
  if (status === 'running') return 'progress_activity';
  if (status === 'completed') return 'check_circle';
  if (status === 'failed' || status === 'stopped' || status === 'errored') return 'error';
  if (status === 'idle') return 'radio_button_unchecked';
  return 'circle';
}

function getStatusAccent(status: string | undefined): string {
  if (status === 'completed') return 'var(--an-diff-added-text)';
  if (status === 'failed' || status === 'stopped' || status === 'errored') return 'var(--an-diff-removed-text)';
  if (status === 'running') return 'var(--an-primary-color)';
  return 'var(--an-foreground-muted)';
}

export const TeammatePanel: React.FC<TeammatePanelProps> = React.memo(({
  sessionId,
}) => {
  const isTeammatesCollapsed = useAtomValue(teammatePanelCollapsedAtom);
  const toggleTeammatesCollapsed = useSetAtom(toggleTeammatePanelCollapsedAtom);
  const isTasksCollapsed = useAtomValue(agentPanelCollapsedAtom);
  const toggleTasksCollapsed = useSetAtom(toggleAgentPanelCollapsedAtom);
  const allEntries = useAtomValue(sessionTeammatesAtom(sessionId));
  const tasks = useAtomValue(sessionTasksAtom(sessionId));
  const setScrollTarget = useSetAtom(scrollToTeammateAtom);

  const handleToggleTeammates = useCallback(() => {
    toggleTeammatesCollapsed();
  }, [toggleTeammatesCollapsed]);

  const handleToggleTasks = useCallback(() => {
    toggleTasksCollapsed();
  }, [toggleTasksCollapsed]);

  const handleTeammateClick = useCallback((agentId: string) => {
    setScrollTarget({ sessionId, agentId });
  }, [sessionId, setScrollTarget]);

  // Filter out _background/_subagent entries from teammates -- those are dead
  // after switching to SDK-native sub-agents. Only real team members remain.
  const teammates = useMemo(() => {
    return allEntries.filter(e => e.teamName !== '_background' && e.teamName !== '_subagent');
  }, [allEntries]);

  if (teammates.length === 0 && tasks.length === 0) {
    return null;
  }

  return (
    <section
      className={panelClass}
      data-agent-elements-shell="teammate-panel"
      data-component="TeammatePanel"
      data-session-id={sessionId}
      data-task-count={tasks.length}
      data-teammate-count={teammates.length}
      data-testid="agent-elements-teammate-panel"
    >
      {teammates.length > 0 && (
        <TeammateSection
          entries={teammates}
          isCollapsed={isTeammatesCollapsed}
          onToggle={handleToggleTeammates}
          onTeammateClick={handleTeammateClick}
        />
      )}
      {tasks.length > 0 && (
        <TaskSection
          tasks={tasks}
          isCollapsed={isTasksCollapsed}
          onToggle={handleToggleTasks}
          className={teammates.length > 0 ? 'border-t border-[var(--an-border-color)]' : undefined}
        />
      )}
    </section>
  );
});

TeammatePanel.displayName = 'TeammatePanel';

// ─── Teammate Section (real team members) ─────────────────────────────────

interface TeammateSectionProps {
  entries: TeammateInfo[];
  isCollapsed: boolean;
  onToggle: () => void;
  onTeammateClick: (agentId: string) => void;
}

const TeammateSection: React.FC<TeammateSectionProps> = React.memo(({
  entries,
  isCollapsed,
  onToggle,
  onTeammateClick,
}) => {
  const runningCount = entries.filter(t => t.status === 'running' || t.status === 'idle').length;
  const contentId = useId();

  return (
    <section
      className={sectionClass}
      data-agent-elements-shell="teammate-section"
      data-testid="agent-elements-teammate-section"
    >
      <button
        aria-controls={contentId}
        aria-expanded={!isCollapsed}
        className={sectionHeaderClass}
        onClick={onToggle}
        data-testid="agent-elements-teammate-section-toggle"
        type="button"
      >
        <MaterialSymbol
          icon={isCollapsed ? 'chevron_right' : 'expand_more'}
          size={16}
          className="shrink-0"
        />
        <MaterialSymbol icon="group" size={16} className="shrink-0" />
        <span className="min-w-0 flex-1 text-xs font-medium leading-none text-[var(--an-foreground)]">Teammates</span>
        <span className="agent-elements-status-pill ml-auto font-mono" data-tone="running">
          {runningCount}/{entries.length}
        </span>
      </button>

      {!isCollapsed && (
        <div className={sectionContentClass} id={contentId}>
          <div className="agent-elements-teammate-list flex flex-col gap-[var(--an-spacing-xxs)]">
            {entries.map((entry) => (
              <TeammateItem key={entry.agentId} teammate={entry} onClick={onTeammateClick} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

TeammateSection.displayName = 'TeammateSection';

// ─── Task Section (SDK-native sub-agents) ─────────────────────────────────

interface TaskSectionProps {
  tasks: TaskInfo[];
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

const TaskSection: React.FC<TaskSectionProps> = React.memo(({
  tasks,
  isCollapsed,
  onToggle,
  className,
}) => {
  const runningCount = tasks.filter(t => t.status === 'running').length;
  const contentId = useId();

  return (
    <section
      className={[sectionClass, className].filter(Boolean).join(' ')}
      data-agent-elements-shell="task-section"
      data-testid="agent-elements-task-section"
    >
      <button
        aria-controls={contentId}
        aria-expanded={!isCollapsed}
        className={sectionHeaderClass}
        onClick={onToggle}
        data-testid="agent-elements-task-section-toggle"
        type="button"
      >
        <MaterialSymbol
          icon={isCollapsed ? 'chevron_right' : 'expand_more'}
          size={16}
          className="shrink-0"
        />
        <MaterialSymbol icon="swap_horiz" size={16} className="shrink-0" />
        <span className="min-w-0 flex-1 text-xs font-medium leading-none text-[var(--an-foreground)]">Sub-agents</span>
        <span className="agent-elements-status-pill ml-auto font-mono" data-tone="running">
          {runningCount}/{tasks.length}
        </span>
      </button>

      {!isCollapsed && (
        <div className={sectionContentClass} id={contentId}>
          <div className="agent-elements-task-list flex flex-col gap-[var(--an-spacing-xxs)]">
            {tasks.map((task) => (
              <TaskItem key={task.taskId} task={task} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

TaskSection.displayName = 'TaskSection';

// ─── Elapsed time formatting ──────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ─── Live clock hook ──────────────────────────────────────────────────────

/** Ticks every second so relative times stay fresh. Returns current epoch ms. */
function useNow(enabled: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

// ─── TaskItem ─────────────────────────────────────────────────────────────

interface TaskItemProps {
  task: TaskInfo;
}

const TaskItem: React.FC<TaskItemProps> = React.memo(({ task }) => {
  const isRunning = task.status === 'running';
  const now = useNow(isRunning);
  const isDone = task.status === 'completed' || task.status === 'failed' || task.status === 'stopped';

  // Build stats line
  const stats: string[] = [];
  if (task.durationMs > 0) {
    stats.push(formatElapsed(task.durationMs));
  } else if (isRunning && task.startedAt) {
    stats.push(formatElapsed(now - task.startedAt));
  }
  if (task.toolCount > 0) {
    stats.push(`${task.toolCount} tool${task.toolCount !== 1 ? 's' : ''}`);
  }
  if (task.lastToolName && isRunning) {
    stats.push(task.lastToolName);
  }

  return (
    <div
      className={`task-item agent-elements-task-item ${itemClass}`}
      data-active={isRunning}
      data-agent-elements-shell="task-item"
      data-done={isDone}
      data-status={task.status}
      data-task-id={task.taskId}
      data-testid="agent-elements-task-item"
      data-tone={getStatusTone(task.status)}
      style={{ '--agent-panel-accent': getStatusAccent(task.status) } as React.CSSProperties}
    >
      <div className="agent-elements-task-item-icon mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[var(--agent-panel-accent)]">
        <MaterialSymbol
          icon={getStatusIcon(task.status)}
          size={14}
          className={isRunning ? 'animate-spin' : undefined}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`break-words leading-snug ${isDone ? 'text-[var(--an-foreground-muted)]' : 'text-[var(--an-foreground)]'}`}>
          {task.description}
        </div>
        {stats.length > 0 && (
          <div className="truncate font-mono text-[10px] text-[var(--an-foreground-muted)]">
            {stats.join(' \u00B7 ')}
          </div>
        )}
      </div>
    </div>
  );
});

TaskItem.displayName = 'TaskItem';

// ─── TeammateItem ─────────────────────────────────────────────────────────

interface TeammateItemProps {
  teammate: TeammateInfo;
  onClick: (agentId: string) => void;
}

const TeammateItem: React.FC<TeammateItemProps> = React.memo(({ teammate, onClick }) => {
  const isActive = teammate.status === 'running' || teammate.status === 'idle';
  const now = useNow(isActive);

  const handleClick = useCallback(() => {
    onClick(teammate.agentId);
  }, [onClick, teammate.agentId]);

  // Build stats line
  const stats: string[] = [];
  if (teammate.startedAt) {
    stats.push(formatElapsed(now - teammate.startedAt));
  }
  // Only show "last active" when idle - when running, elapsed time is sufficient
  if (teammate.status === 'idle' && teammate.lastActiveAt) {
    stats.push(formatAgo(now - teammate.lastActiveAt));
  }
  if (typeof teammate.toolCallCount === 'number' && teammate.toolCallCount > 0) {
    stats.push(`${teammate.toolCallCount} tool${teammate.toolCallCount !== 1 ? 's' : ''}`);
  }

  return (
    <button
      className={`teammate-item agent-elements-teammate-item ${clickableItemClass}`}
      data-active={isActive}
      data-agent-elements-shell="teammate-item"
      data-agent-id={teammate.agentId}
      data-done={teammate.status === 'completed' || teammate.status === 'errored'}
      data-status={teammate.status}
      data-testid={`agent-elements-teammate-item-${teammate.agentId}`}
      data-tone={getStatusTone(teammate.status)}
      onClick={handleClick}
      style={{ '--agent-panel-accent': getStatusAccent(teammate.status) } as React.CSSProperties}
      type="button"
    >
      <div className="teammate-item-icon mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[var(--agent-panel-accent)]">
        <MaterialSymbol
          icon={getStatusIcon(teammate.status)}
          size={14}
          className={teammate.status === 'running' ? 'animate-spin' : undefined}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`teammate-item-name break-words leading-snug ${
          teammate.status === 'completed'
            ? 'line-through text-[var(--an-foreground-muted)]'
            : 'text-[var(--an-foreground)]'
        }`}>
          {teammate.name}
        </div>
        <div className="truncate text-[10px] text-[var(--an-foreground-muted)]">
          {teammate.agentType}{teammate.status === 'idle' ? ' (idle)' : ''}
        </div>
        {stats.length > 0 && (
          <div className="truncate font-mono text-[10px] text-[var(--an-foreground-muted)]">
            {stats.join(' \u00B7 ')}
          </div>
        )}
      </div>
    </button>
  );
});

TeammateItem.displayName = 'TeammateItem';
