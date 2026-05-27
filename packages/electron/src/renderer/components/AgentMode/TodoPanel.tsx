/**
 * TodoPanel - Collapsible panel showing the agent's current task list.
 *
 * Displays todos from the active session's metadata (currentTodos).
 * Shows task progress with status indicators (pending, in progress, completed).
 * Collapse state is persisted at the project level.
 */

import React, { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { AgentTodoList, type AgentTodoItem } from '@nimbalyst/runtime/ui';
import { sessionStoreAtom } from '../../store';
import { todoPanelCollapsedAtom, toggleTodoPanelCollapsedAtom } from '../../store/atoms/agentMode';

export interface Todo {
  status: 'pending' | 'in_progress' | 'completed';
  content: string;
  activeForm: string;
}

interface TodoPanelProps {
  /** The session ID to get todos from */
  sessionId: string;
}

export const TodoPanel: React.FC<TodoPanelProps> = React.memo(({
  sessionId,
}) => {
  const isCollapsed = useAtomValue(todoPanelCollapsedAtom);
  const toggleCollapsed = useSetAtom(toggleTodoPanelCollapsedAtom);
  const sessionData = useAtomValue(sessionStoreAtom(sessionId));

  // Must call all hooks before any early return
  const handleToggle = useCallback(() => {
    toggleCollapsed();
  }, [toggleCollapsed]);

  // Extract todos from session metadata
  const rawTodos = sessionData?.metadata?.currentTodos;
  const todos: Todo[] = Array.isArray(rawTodos) ? rawTodos : [];

  // Don't render if no todos
  if (todos.length === 0) {
    return null;
  }

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const totalCount = todos.length;
  const isStreaming = todos.some((todo) => todo.status === 'in_progress');
  const contentId = `todo-panel-content-${sessionId}`;
  const items: AgentTodoItem[] = todos.map((todo, index) => ({
    id: `${sessionId}-${index}`,
    status: todo.status,
    content: todo.content,
    activeForm: todo.activeForm,
  }));

  return (
    <section
      className="todo-panel agent-elements-agent-mode-todo-panel flex shrink-0 flex-col border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground)] [container-type:inline-size]"
      data-agent-elements-shell="agent-mode-todo-panel"
      data-component="AgentModeTodoPanel"
      data-session-id={sessionId}
      data-testid="agent-elements-agent-mode-todo-panel"
    >
      <button
        aria-controls={contentId}
        aria-expanded={!isCollapsed}
        className="todo-panel-header agent-elements-agent-mode-todo-header flex min-h-[34px] w-full cursor-pointer items-center gap-[var(--an-spacing-sm)] border-none bg-transparent px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-left text-[var(--an-foreground-muted)] outline-none transition-[background-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
        data-testid="agent-elements-agent-mode-todo-header"
        onClick={handleToggle}
        type="button"
      >
        <MaterialSymbol
          icon={isCollapsed ? 'chevron_right' : 'expand_more'}
          size={16}
          className="shrink-0"
        />
        <MaterialSymbol
          icon="checklist"
          size={16}
          className="shrink-0"
        />
        <span className="todo-panel-title min-w-0 flex-1 text-xs font-medium leading-none text-[var(--an-foreground)]">
          Tasks
        </span>
        <span
          className="todo-panel-count agent-elements-status-pill ml-auto font-mono"
          data-testid="agent-elements-agent-mode-todo-count"
          data-tone={isStreaming ? 'running' : 'neutral'}
        >
          {completedCount}/{totalCount}
        </span>
      </button>

      {!isCollapsed && (
        <div
          className="todo-panel-content agent-elements-agent-mode-todo-content nim-scrollbar max-h-[200px] overflow-y-auto px-[var(--an-spacing-lg)] pb-[var(--an-spacing-md)] pt-[var(--an-spacing-xs)]"
          data-testid="agent-elements-agent-mode-todo-content"
          id={contentId}
        >
          <AgentTodoList
            className="agent-elements-agent-mode-todo-items"
            data-testid="agent-elements-agent-mode-todo-items"
            isStreaming={isStreaming}
            items={items}
          />
        </div>
      )}
    </section>
  );
});

TodoPanel.displayName = 'TodoPanel';
