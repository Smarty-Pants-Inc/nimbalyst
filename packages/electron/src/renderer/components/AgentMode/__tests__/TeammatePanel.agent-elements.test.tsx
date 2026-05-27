// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeammatePanel } from '../TeammatePanel';

const mockState = vi.hoisted(() => {
  const tokens = {
    teammatePanelCollapsedAtom: 'teammatePanelCollapsedAtom',
    toggleTeammatePanelCollapsedAtom: 'toggleTeammatePanelCollapsedAtom',
    agentPanelCollapsedAtom: 'agentPanelCollapsedAtom',
    toggleAgentPanelCollapsedAtom: 'toggleAgentPanelCollapsedAtom',
    scrollToTeammateAtom: 'scrollToTeammateAtom',
  };

  return {
    tokens,
    atomValues: new Map<string, any>(),
    setAtomFns: new Map<string, any>(),
    defaultSetAtom: vi.fn(),
    toggleTeammatesCollapsed: vi.fn(),
    toggleTasksCollapsed: vi.fn(),
    scrollToTeammate: vi.fn(),
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
    MaterialSymbol: ({
      icon,
      size,
      className,
    }: {
      icon: string;
      size?: number;
      className?: string;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

vi.mock('../../../store/atoms/agentMode', () => ({
  teammatePanelCollapsedAtom: mockState.tokens.teammatePanelCollapsedAtom,
  toggleTeammatePanelCollapsedAtom: mockState.tokens.toggleTeammatePanelCollapsedAtom,
  agentPanelCollapsedAtom: mockState.tokens.agentPanelCollapsedAtom,
  toggleAgentPanelCollapsedAtom: mockState.tokens.toggleAgentPanelCollapsedAtom,
  sessionTeammatesAtom: (sessionId: string) => `sessionTeammates:${sessionId}`,
  scrollToTeammateAtom: mockState.tokens.scrollToTeammateAtom,
  sessionTasksAtom: (sessionId: string) => `sessionTasks:${sessionId}`,
}));

const sourcePath = resolve(__dirname, '../TeammatePanel.tsx');

function seedTeammatePanel({
  teammatesCollapsed = false,
  tasksCollapsed = false,
  teammates = [
    {
      name: 'Review Agent',
      agentId: 'agent-1',
      teamName: 'review',
      agentType: 'reviewer',
      status: 'running',
      startedAt: Date.now() - 2000,
      toolCallCount: 2,
    },
    {
      name: 'Background Worker',
      agentId: 'agent-background',
      teamName: '_background',
      agentType: 'worker',
      status: 'running',
    },
  ],
  tasks = [
    {
      taskId: 'task-1',
      description: 'Audit transcript events',
      status: 'running',
      startedAt: Date.now() - 3000,
      durationMs: 0,
      toolCount: 1,
      lastToolName: 'rg',
    },
    {
      taskId: 'task-2',
      description: 'Summarize findings',
      status: 'completed',
      durationMs: 5000,
      toolCount: 0,
    },
  ],
}: {
  teammatesCollapsed?: boolean;
  tasksCollapsed?: boolean;
  teammates?: any[];
  tasks?: any[];
} = {}) {
  mockState.atomValues.clear();
  mockState.setAtomFns.clear();
  mockState.defaultSetAtom.mockClear();
  mockState.toggleTeammatesCollapsed.mockClear();
  mockState.toggleTasksCollapsed.mockClear();
  mockState.scrollToTeammate.mockClear();

  mockState.atomValues.set(mockState.tokens.teammatePanelCollapsedAtom, teammatesCollapsed);
  mockState.atomValues.set(mockState.tokens.agentPanelCollapsedAtom, tasksCollapsed);
  mockState.atomValues.set('sessionTeammates:session-1', teammates);
  mockState.atomValues.set('sessionTasks:session-1', tasks);

  mockState.setAtomFns.set(mockState.tokens.toggleTeammatePanelCollapsedAtom, mockState.toggleTeammatesCollapsed);
  mockState.setAtomFns.set(mockState.tokens.toggleAgentPanelCollapsedAtom, mockState.toggleTasksCollapsed);
  mockState.setAtomFns.set(mockState.tokens.scrollToTeammateAtom, mockState.scrollToTeammate);
}

describe('AgentMode TeammatePanel Agent Elements shell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T21:10:00Z'));
    seedTeammatePanel();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render when there are no visible teammates or tasks', () => {
    seedTeammatePanel({ teammates: [{ teamName: '_subagent', agentId: 'hidden' }], tasks: [] });

    const { container } = render(<TeammatePanel sessionId="session-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('wraps teammates and sub-agent tasks in Agent Elements chrome while preserving filtering', () => {
    render(<TeammatePanel sessionId="session-1" />);

    const panel = screen.getByTestId('agent-elements-teammate-panel');
    expect(panel).toHaveClass('teammate-panel', 'agent-elements-teammate-panel');
    expect(panel).toHaveAttribute('data-component', 'TeammatePanel');
    expect(panel).toHaveAttribute('data-session-id', 'session-1');
    expect(panel).toHaveAttribute('data-teammate-count', '1');
    expect(panel).toHaveAttribute('data-task-count', '2');

    const teammateSection = screen.getByTestId('agent-elements-teammate-section');
    expect(teammateSection).toHaveAttribute('data-agent-elements-shell', 'teammate-section');
    expect(within(teammateSection).getByText('Teammates')).toBeInTheDocument();
    expect(within(teammateSection).getByText('1/1')).toHaveClass('agent-elements-status-pill');
    expect(within(teammateSection).getByText('Review Agent')).toBeInTheDocument();
    expect(screen.queryByText('Background Worker')).not.toBeInTheDocument();

    const taskSection = screen.getByTestId('agent-elements-task-section');
    expect(taskSection).toHaveAttribute('data-agent-elements-shell', 'task-section');
    expect(within(taskSection).getByText('Sub-agents')).toBeInTheDocument();
    expect(within(taskSection).getByText('1/2')).toHaveClass('agent-elements-status-pill');
    expect(within(taskSection).getByText('Audit transcript events')).toBeInTheDocument();
    expect(within(taskSection).getByText('Summarize findings')).toBeInTheDocument();

    const teammateRow = screen.getByTestId('agent-elements-teammate-item-agent-1');
    expect(teammateRow).toHaveAttribute('data-status', 'running');
    expect(teammateRow).toHaveAttribute('data-agent-id', 'agent-1');

    const taskRows = screen.getAllByTestId('agent-elements-task-item');
    expect(taskRows).toHaveLength(2);
    expect(taskRows[0]).toHaveAttribute('data-task-id', 'task-1');
    expect(taskRows[0]).toHaveAttribute('data-status', 'running');
  });

  it('preserves collapse toggles and teammate scroll targeting', () => {
    seedTeammatePanel({ teammatesCollapsed: true, tasksCollapsed: true });

    render(<TeammatePanel sessionId="session-1" />);

    const teammateHeader = screen.getByTestId('agent-elements-teammate-section-toggle');
    const taskHeader = screen.getByTestId('agent-elements-task-section-toggle');
    expect(teammateHeader).toHaveAttribute('aria-expanded', 'false');
    expect(taskHeader).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Review Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit transcript events')).not.toBeInTheDocument();

    fireEvent.click(teammateHeader);
    fireEvent.click(taskHeader);

    expect(mockState.toggleTeammatesCollapsed).toHaveBeenCalledTimes(1);
    expect(mockState.toggleTasksCollapsed).toHaveBeenCalledTimes(1);

    seedTeammatePanel();
    render(<TeammatePanel sessionId="session-1" />);
    fireEvent.click(screen.getByTestId('agent-elements-teammate-item-agent-1'));

    expect(mockState.scrollToTeammate).toHaveBeenCalledWith({ sessionId: 'session-1', agentId: 'agent-1' });
  });

  it('keeps TeammatePanel source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-teammate-panel');
    expect(source).toContain('data-agent-elements-shell="teammate-panel"');
    expect(source).toContain('agent-elements-status-pill');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/&#x25|<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
