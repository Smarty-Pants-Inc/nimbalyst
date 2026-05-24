// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TodoList } from '../TodoList';

const todoListSourcePath = resolve(__dirname, '../TodoList.tsx');

describe('UnifiedAI TodoList Agent Elements shell', () => {
  it('does not render an empty floating todo list', () => {
    const { container } = render(<TodoList todos={[]} sessionId="session-empty" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('wraps todos in Agent Elements chrome while preserving status text and active form display', () => {
    render(
      <TodoList
        sessionId="session-1"
        todos={[
          { status: 'pending', content: 'Read the rider', activeForm: 'Reading rider' },
          { status: 'in_progress', content: 'Implement todo shell', activeForm: 'Implementing todo shell' },
          { status: 'completed', content: 'Pin Agent Elements source', activeForm: 'Pinned source' },
        ]}
      />,
    );

    const shell = screen.getByTestId('agent-elements-floating-todo-list');
    expect(shell).toHaveClass('todo-list', 'agent-elements-floating-todo-list');
    expect(shell).toHaveAttribute('data-component', 'UnifiedAITodoList');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'floating-todo-list');
    expect(shell).toHaveAttribute('data-session-id', 'session-1');

    expect(screen.getByTestId('agent-elements-floating-todo-count')).toHaveTextContent('1/3');

    const items = screen.getAllByTestId('agent-elements-todo-item');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute('data-todo-status', 'pending');
    expect(items[1]).toHaveAttribute('data-todo-status', 'in_progress');
    expect(items[2]).toHaveAttribute('data-todo-status', 'completed');

    expect(screen.getByText('Read the rider')).toBeInTheDocument();
    expect(screen.getByText('Implementing todo shell')).toBeInTheDocument();
    expect(screen.queryByText('Implement todo shell')).not.toBeInTheDocument();
    expect(screen.getByText('Pin Agent Elements source')).toBeInTheDocument();
  });

  it('keeps TodoList source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(todoListSourcePath, 'utf8');

    expect(source).toContain('agent-elements-floating-todo-list');
    expect(source).toContain('AgentTodoList');
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/bg-white|text-white|bg-black|hover:scale|tracking-/);
    expect(source).not.toMatch(/--nim-accent|--nim-surface|text-nim-fg|<svg/);
  });
});
