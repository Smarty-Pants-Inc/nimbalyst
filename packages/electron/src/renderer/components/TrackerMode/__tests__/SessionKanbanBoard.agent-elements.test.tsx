// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionKanbanBoard } from '../SessionKanbanBoard';

const sourcePath = resolve(__dirname, '../SessionKanbanBoard.tsx');

const mockState = vi.hoisted(() => {
  const tokens = {
    sessionsByPhaseAtom: 'sessionsByPhaseAtom',
    sessionKanbanFilterAtom: 'sessionKanbanFilterAtom',
    sessionKanbanTotalCountAtom: 'sessionKanbanTotalCountAtom',
    sessionKanbanTagsAtom: 'sessionKanbanTagsAtom',
    setSessionPhaseAtom: 'setSessionPhaseAtom',
    childRunStatesAtom: 'childRunStatesAtom',
    sessionProcessingAtom: 'sessionProcessingAtom',
    sessionHasPendingInteractivePromptAtom: 'sessionHasPendingInteractivePromptAtom',
    sessionUnreadAtom: 'sessionUnreadAtom',
    updateSessionStoreAtom: 'updateSessionStoreAtom',
    workstreamUnreadAtom: 'workstreamUnreadAtom',
    removeSessionFullAtom: 'removeSessionFullAtom',
    sessionRegistryAtom: 'sessionRegistryAtom',
    sessionListWorkspaceAtom: 'sessionListWorkspaceAtom',
    transcriptEventSignalAtom: 'transcriptEventSignalAtom',
  };

  const session = {
    id: 'session-1',
    title: 'Polish agent cards',
    provider: 'smarty-server',
    updatedAt: Date.now(),
    createdAt: Date.now(),
    tags: ['ux', 'preview'],
    uncommittedCount: 2,
    phase: 'planning',
    childCount: 0,
    isArchived: false,
  };

  const grouped = new Map<string, any[]>([
    ['unphased', []],
    ['backlog', []],
    ['planning', [session]],
    ['implementing', []],
    ['validating', []],
    ['complete', []],
  ]);

  return {
    tokens,
    session,
    grouped,
    registry: new Map([[session.id, session]]),
    filter: { search: '', tags: ['ux'], showComplete: true },
    setFilter: vi.fn(),
    setPhase: vi.fn(),
    updateSessionStore: vi.fn(),
    removeSession: vi.fn(),
    posthogCapture: vi.fn(),
    onSessionOpen: vi.fn(),
  };
});

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.sessionsByPhaseAtom) return mockState.grouped;
    if (atom === mockState.tokens.sessionKanbanFilterAtom) return mockState.filter;
    if (atom === mockState.tokens.sessionKanbanTotalCountAtom) return 1;
    if (atom === mockState.tokens.sessionKanbanTagsAtom) return [{ name: 'ux', count: 1 }, { name: 'review', count: 1 }];
    if (atom === mockState.tokens.sessionRegistryAtom) return mockState.registry;
    if (atom === mockState.tokens.sessionListWorkspaceAtom) return '/work/current';
    if (atom === `${mockState.tokens.childRunStatesAtom}:session-1`) {
      return { running: 0, waiting: 0, review: 0, idle: 0, done: 0, total: 0 };
    }
    if (atom === `${mockState.tokens.sessionProcessingAtom}:session-1`) return false;
    if (atom === `${mockState.tokens.sessionHasPendingInteractivePromptAtom}:session-1`) return false;
    if (atom === `${mockState.tokens.sessionUnreadAtom}:session-1`) return false;
    if (atom === `${mockState.tokens.workstreamUnreadAtom}:session-1`) return false;
    if (atom === `${mockState.tokens.transcriptEventSignalAtom}:session-1`) return 0;
    return undefined;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.sessionKanbanFilterAtom) return mockState.setFilter;
    if (atom === mockState.tokens.setSessionPhaseAtom) return mockState.setPhase;
    if (atom === mockState.tokens.updateSessionStoreAtom) return mockState.updateSessionStore;
    if (atom === mockState.tokens.removeSessionFullAtom) return mockState.removeSession;
    return vi.fn();
  }),
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockState.posthogCapture }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size, className, fill }: any) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, 'data-fill': fill ? 'true' : 'false', className }, icon),
    ProviderIcon: ({ provider, size }: any) =>
      ReactModule.createElement('span', { 'data-provider': provider, 'data-size': size }, provider),
  };
});

vi.mock('@nimbalyst/runtime/ui/AgentTranscript/components/RichTranscriptView', () => ({
  RichTranscriptView: ({ sessionId, settings, messages }: any) => (
    <div
      data-testid="mock-rich-transcript-view"
      data-session-id={sessionId}
      data-show-tool-calls={String(settings?.showToolCalls)}
      data-collapse-tools={String(settings?.collapseTools)}
      data-message-count={String(messages?.length ?? 0)}
    />
  ),
}));

vi.mock('../../AgenticCoding/SessionContextMenu', () => ({
  SessionContextMenu: ({ sessionId }: any) => <div data-testid="mock-session-context-menu" data-session-id={sessionId} />,
}));

vi.mock('../../AgentMode/ArchiveWorktreeDialog', () => ({
  ArchiveWorktreeDialog: () => <div data-testid="mock-archive-worktree-dialog" />,
}));

vi.mock('../../../hooks/useArchiveWorktreeDialog', () => ({
  useArchiveWorktreeDialog: () => ({
    dialogState: null,
    showDialog: vi.fn(),
    closeDialog: vi.fn(),
    confirmArchive: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useFloatingMenu', () => ({
  FloatingPortal: ({ children }: any) => <>{children}</>,
  virtualElement: (x: number, y: number) => ({ getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 }) }),
  useFloatingMenu: () => ({
    refs: { setFloating: vi.fn() },
    floatingStyles: {},
    getFloatingProps: () => ({}),
  }),
}));

vi.mock('../../../store/atoms/sessionKanban', () => ({
  sessionsByPhaseAtom: mockState.tokens.sessionsByPhaseAtom,
  sessionKanbanFilterAtom: mockState.tokens.sessionKanbanFilterAtom,
  sessionKanbanTotalCountAtom: mockState.tokens.sessionKanbanTotalCountAtom,
  sessionKanbanTagsAtom: mockState.tokens.sessionKanbanTagsAtom,
  setSessionPhaseAtom: mockState.tokens.setSessionPhaseAtom,
  childRunStatesAtom: (sessionId: string) => `${mockState.tokens.childRunStatesAtom}:${sessionId}`,
  getCardType: (meta: any) => {
    if (meta?.worktreeId) return 'worktree';
    if (meta?.sessionType === 'workstream' || meta?.childCount > 0) return 'workstream';
    return 'session';
  },
  SESSION_PHASE_COLUMNS: [
    { value: 'backlog', label: 'Backlog', color: 'var(--an-foreground-subtle)' },
    { value: 'planning', label: 'Planning', color: 'var(--an-primary-color)' },
    { value: 'implementing', label: 'Implementing', color: 'var(--an-warning-color)' },
    { value: 'validating', label: 'Validating', color: 'var(--an-info-color)' },
    { value: 'complete', label: 'Complete', color: 'var(--an-success-color)' },
  ],
}));

vi.mock('../../../store/atoms/sessions', () => ({
  sessionProcessingAtom: (sessionId: string) => `${mockState.tokens.sessionProcessingAtom}:${sessionId}`,
  sessionHasPendingInteractivePromptAtom: (sessionId: string) => `${mockState.tokens.sessionHasPendingInteractivePromptAtom}:${sessionId}`,
  sessionUnreadAtom: (sessionId: string) => `${mockState.tokens.sessionUnreadAtom}:${sessionId}`,
  updateSessionStoreAtom: mockState.tokens.updateSessionStoreAtom,
  workstreamUnreadAtom: (sessionId: string) => `${mockState.tokens.workstreamUnreadAtom}:${sessionId}`,
  removeSessionFullAtom: mockState.tokens.removeSessionFullAtom,
  sessionRegistryAtom: mockState.tokens.sessionRegistryAtom,
  sessionListWorkspaceAtom: mockState.tokens.sessionListWorkspaceAtom,
}));

vi.mock('../../../store/atoms/sessionTranscript', () => ({
  transcriptEventSignalAtom: (sessionId: string) => `${mockState.tokens.transcriptEventSignalAtom}:${sessionId}`,
}));

describe('SessionKanbanBoard Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).electronAPI = {
      ai: {
        getTailMessages: vi.fn().mockResolvedValue([
          {
            id: 1,
            sequence: 1,
            createdAt: new Date('2026-05-28T05:00:00Z'),
            type: 'assistant_message',
            subagentId: null,
            text: 'Recent useful assistant response',
            attachments: [],
          },
        ]),
      },
    };
  });

  it('renders kanban board cards with Agent Elements chrome and preserves session open behavior', () => {
    render(<SessionKanbanBoard onSessionOpen={mockState.onSessionOpen} />);

    const board = screen.getByTestId('session-kanban-board');
    expect(board).toHaveClass('agent-elements-session-kanban-board');
    expect(board).toHaveAttribute('data-agent-elements-shell', 'session-kanban-board');

    const toolbar = screen.getByTestId('kanban-toolbar');
    expect(toolbar).toHaveClass('agent-elements-session-kanban-toolbar');
    expect(toolbar).toHaveAttribute('data-agent-elements-shell', 'session-kanban-toolbar');

    const column = screen.getAllByTestId('session-kanban-column').find((el) => el.getAttribute('data-phase') === 'planning');
    expect(column).toHaveClass('agent-elements-session-kanban-column');
    expect(column).toHaveAttribute('data-agent-elements-shell', 'session-kanban-column');

    const card = screen.getByTestId('session-kanban-card');
    expect(card).toHaveClass('agent-elements-session-kanban-card', 'agent-elements-tool-card');
    expect(card).toHaveAttribute('data-agent-elements-card-width', 'column-fill');
    expect(card).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(card.className).toContain('--agent-elements-card-inline-padding');
    expect(card.className).toContain('--agent-elements-card-block-padding');
    expect(card.className).not.toMatch(/\b(?:p-|px-|py-|pl-|pr-)/);
    expect(card).not.toHaveStyle({ borderLeftWidth: '3px' });

    fireEvent.doubleClick(card);
    expect(mockState.onSessionOpen).toHaveBeenCalledWith('session-1');
  });

  it('keeps SessionKanbanBoard source on Agent Elements card rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-session-kanban-card');
    expect(source).toContain('data-agent-elements-card-width="column-fill"');
    expect(source).toContain('data-agent-elements-card-padding="symmetric-inline"');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).toContain('agent-elements-session-kanban-toolbar');
    expect(source).not.toMatch(/agent-elements-session-kanban-card[^`'"]*\b(?:p-|px-|py-|pl-|pr-)/);
    expect(source).not.toMatch(/data-agent-elements-card-width="full"/);
    expect(source).not.toMatch(/borderLeftWidth:\s*['"](?:2|3|4)px['"]/);
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba\(/);
    expect(source).not.toMatch(/<svg|text-white|bg-white|bg-black|tracking-wide|transition-all/);
  });

  it('keeps transcript peek on normal-use projection settings without raw tool-call leakage', async () => {
    render(<SessionKanbanBoard onSessionOpen={mockState.onSessionOpen} />);

    fireEvent.click(screen.getByTestId('session-kanban-peek'));

    const transcript = await screen.findByTestId('mock-rich-transcript-view');
    await waitFor(() => expect(transcript).toHaveAttribute('data-message-count', '1'));
    expect(transcript).toHaveAttribute('data-session-id', 'session-1');
    expect(transcript).toHaveAttribute('data-show-tool-calls', 'false');
    expect(transcript).toHaveAttribute('data-collapse-tools', 'true');
    expect((window as any).electronAPI.ai.getTailMessages).toHaveBeenCalledWith('session-1', 100);

    const source = readFileSync(sourcePath, 'utf8');
    expect(source).toMatch(/const PEEK_SETTINGS[\s\S]*showToolCalls:\s*false/);
  });
});
