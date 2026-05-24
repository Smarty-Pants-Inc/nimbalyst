import React from 'react';
import { AgentTodoList, type AgentTodoItem } from '@nimbalyst/runtime/ui';

export interface Todo {
  status: 'pending' | 'in_progress' | 'completed';
  content: string;
  activeForm: string;
}

export interface TodoListProps {
  todos: Todo[];
  sessionId: string;
}

export function TodoList({ todos, sessionId }: TodoListProps) {
  if (!todos || todos.length === 0) {
    return null;
  }

  const completedCount = todos.filter((todo) => todo.status === 'completed').length;
  const isStreaming = todos.some((todo) => todo.status === 'in_progress');
  const items: AgentTodoItem[] = todos.map((todo, index) => ({
    id: `${sessionId}-${index}`,
    status: todo.status,
    content: todo.status === 'in_progress' ? todo.activeForm : todo.content,
  }));

  return (
    <div
      className="todo-list agent-elements-floating-todo-list fixed bottom-4 right-4 z-[1000] w-80 max-w-[calc(100vw-32px)] overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground)] shadow-lg"
      data-agent-elements-shell="floating-todo-list"
      data-component="UnifiedAITodoList"
      data-session-id={sessionId}
      data-testid="agent-elements-floating-todo-list"
    >
      <div className="todo-list-header flex items-center justify-between border-b border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)]">
        <span className="todo-list-title text-xs font-medium leading-snug text-[var(--an-foreground-muted)]">
          Tasks
        </span>
        <span
          className="todo-list-count agent-elements-status-pill font-mono"
          data-testid="agent-elements-floating-todo-count"
          data-tone={isStreaming ? 'running' : 'neutral'}
        >
          {completedCount}/{todos.length}
        </span>
      </div>
      <div className="todo-list-items nim-scrollbar max-h-[300px] overflow-y-auto p-[var(--an-spacing-md)]">
        <AgentTodoList
          data-testid="agent-elements-floating-todo-items"
          isStreaming={isStreaming}
          items={items}
        />
      </div>
    </div>
  );
}
