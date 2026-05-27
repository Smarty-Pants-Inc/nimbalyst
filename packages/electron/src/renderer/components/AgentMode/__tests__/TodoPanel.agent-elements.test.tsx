// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoPanel } from '../TodoPanel';

const mockState = vi.hoisted(() => {
  const tokens = {
    sessionStoreAtom: (sessionId: string) => `sessionStore:${sessionId}`,
    todoPanelCollapsedAtom: 'todoPanelCollapsedAtom',
    toggleTodoPanelCollapsedAtom: 'toggleTodoPanelCollapsedAtom',
  };

  return {
    tokens,
    atomValues: new Map<string, any>(),
    setAtomFns: new Map<string, any>(),
    defaultSetAtom: vi.fn(),
    toggleCollapsed: vi.fn(),
  };
});

vi.mock('jotai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jotai')>();

  return {
    ...actual,
    useAtomValue: vi.fn((atom: string) => mockState.atomValues.get(atom)),
    useSetAtom: vi.fn((atom: string) => mockState.setAtomFns.get(atom) ?? mockState.defaultSetAtom),
  };
});

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, className }: { icon: string; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, className }),
  };
});

vi.mock('../../../store', () => ({
  sessionStoreAtom: mockState.tokens.sessionStoreAtom,
}));

vi.mock('../../../store/atoms/agentMode', () => ({
  todoPanelCollapsedAtom: mockState.tokens.todoPanelCollapsedAtom,
  toggleTodoPanelCollapsedAtom: mockState.tokens.toggleTodoPanelCollapsedAtom,
}));

const todoPanelSourcePath = resolve(__dirname, '../TodoPanel.tsx');

function seedTodoPanel({
  sessionId = 'session-1',
  collapsed = false,
  todos = [
    { status: 'pending', content: 'Read the rider', activeForm: 'Reading rider' },
    { status: 'in_progress', content: 'Implement todo shell', activeForm: 'Implementing todo shell' },
    { status: 'completed', content: 'Pin Agent Elements source', activeForm: 'Pinned source' },
  ],
}: {
  sessionId?: string;
  collapsed?: boolean;
  todos?: Array<{ status: 'pending' | 'in_progress' | 'completed'; content: string; activeForm: string }>;
} = {}) {
  mockState.atomValues.clear();
  mockState.setAtomFns.clear();
  mockState.defaultSetAtom.mockClear();
  mockState.toggleCollapsed.mockClear();

  mockState.atomValues.set(mockState.tokens.todoPanelCollapsedAtom, collapsed);
  mockState.atomValues.set(mockState.tokens.sessionStoreAtom(sessionId), {
    metadata: {
      currentTodos: todos,
    },
  });
  mockState.setAtomFns.set(mockState.tokens.toggleTodoPanelCollapsedAtom, mockState.toggleCollapsed);
}

describe('AgentMode TodoPanel Agent Elements shell', () => {
  beforeEach(() => {
    seedTodoPanel();
  });

  it('does not render when the session has no current todos', () => {
    seedTodoPanel({ sessionId: 'session-empty', todos: [] });

    const { container } = render(<TodoPanel sessionId="session-empty" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('wraps active session todos in Agent Elements chrome while preserving status semantics', () => {
    render(<TodoPanel sessionId="session-1" />);

    const shell = screen.getByTestId('agent-elements-agent-mode-todo-panel');
    expect(shell).toHaveClass('todo-panel', 'agent-elements-agent-mode-todo-panel');
    expect(shell).toHaveAttribute('data-component', 'AgentModeTodoPanel');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'agent-mode-todo-panel');
    expect(shell).toHaveAttribute('data-session-id', 'session-1');

    const header = screen.getByTestId('agent-elements-agent-mode-todo-header');
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('agent-elements-agent-mode-todo-count')).toHaveTextContent('1/3');

    const content = screen.getByTestId('agent-elements-agent-mode-todo-content');
    expect(content).toBeVisible();

    const list = screen.getByTestId('agent-elements-agent-mode-todo-items');
    expect(list).toHaveAttribute('data-component', 'AgentTodoList');
    expect(list).toHaveAttribute('data-todo-streaming', 'true');

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

  it('preserves collapse behavior and keeps task progress visible in the header', () => {
    seedTodoPanel({ collapsed: true });

    render(<TodoPanel sessionId="session-1" />);

    const header = screen.getByTestId('agent-elements-agent-mode-todo-header');
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('agent-elements-agent-mode-todo-count')).toHaveTextContent('1/3');
    expect(screen.queryByTestId('agent-elements-agent-mode-todo-content')).not.toBeInTheDocument();

    fireEvent.click(header);

    expect(mockState.toggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('keeps TodoPanel source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(todoPanelSourcePath, 'utf8');

    expect(source).toContain('AgentTodoList');
    expect(source).toContain('agent-elements-agent-mode-todo-panel');
    expect(source).not.toMatch(/○|●|animate-spin|text-\[#4ade80\]/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/bg-\[var\(--nim-bg-secondary\)\]|--nim-accent|--nim-surface|<svg/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
  });
});
