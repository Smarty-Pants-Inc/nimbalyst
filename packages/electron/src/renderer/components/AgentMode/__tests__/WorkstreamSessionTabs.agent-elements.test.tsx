// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkstreamSessionTabs } from '../WorkstreamSessionTabs';

const mockState = vi.hoisted(() => {
  const tokens = {
    sessionArchivedAtom: (sessionId: string) => `sessionArchived:${sessionId}`,
    sessionTitleAtom: (sessionId: string) => `sessionTitle:${sessionId}`,
    sessionProviderAtom: (sessionId: string) => `sessionProvider:${sessionId}`,
    sessionProcessingAtom: (sessionId: string) => `sessionProcessing:${sessionId}`,
    sessionUnreadAtom: (sessionId: string) => `sessionUnread:${sessionId}`,
    sessionRegistryAtom: 'sessionRegistryAtom',
    createChildSessionAtom: 'createChildSessionAtom',
    convertToWorkstreamAtom: 'convertToWorkstreamAtom',
    defaultAgentModelAtom: 'defaultAgentModelAtom',
    workstreamHasChildrenAtom: (workstreamId: string) => `workstreamHasChildren:${workstreamId}`,
  };

  return {
    tokens,
    atomValues: new Map<string, any>(),
    setAtomFns: new Map<string, any>(),
    defaultSetAtom: vi.fn(),
    createChildSession: vi.fn(),
    convertToWorkstream: vi.fn(),
    agentSessionPanelProps: [] as any[],
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
    ProviderIcon: ({
      provider,
      size,
      className,
    }: {
      provider: string;
      size?: number;
      className?: string;
    }) => ReactModule.createElement('span', { 'data-provider': provider, 'data-size': size, className }),
  };
});

vi.mock('@nimbalyst/runtime/store', () => ({
  store: {
    get: vi.fn((atom: string) => mockState.atomValues.get(atom)),
  },
}));

vi.mock('../../../store/atoms/sessions', () => ({
  sessionArchivedAtom: mockState.tokens.sessionArchivedAtom,
  sessionRegistryAtom: mockState.tokens.sessionRegistryAtom,
  convertToWorkstreamAtom: mockState.tokens.convertToWorkstreamAtom,
}));

vi.mock('../../../store', () => ({
  sessionTitleAtom: mockState.tokens.sessionTitleAtom,
  sessionProviderAtom: mockState.tokens.sessionProviderAtom,
  sessionProcessingAtom: mockState.tokens.sessionProcessingAtom,
  sessionUnreadAtom: mockState.tokens.sessionUnreadAtom,
  createChildSessionAtom: mockState.tokens.createChildSessionAtom,
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  defaultAgentModelAtom: mockState.tokens.defaultAgentModelAtom,
}));

vi.mock('../../../store/atoms/workstreamState', () => ({
  workstreamHasChildrenAtom: mockState.tokens.workstreamHasChildrenAtom,
}));

vi.mock('../AgentSessionPanel', () => ({
  AgentSessionPanel: (props: any) => {
    mockState.agentSessionPanelProps.push(props);
    return <div data-testid="agent-session-panel" data-session-id={props.sessionId} />;
  },
}));

vi.mock('../../AgenticCoding/SessionContextMenu', () => ({
  SessionContextMenu: (props: any) => (
    <div data-testid="session-context-menu" data-session-id={props.sessionId}>
      <button type="button" data-testid="session-context-menu-rename" onClick={props.onRename}>
        Rename
      </button>
      <button type="button" data-testid="session-context-menu-close" onClick={props.onClose}>
        Close
      </button>
    </div>
  ),
}));

const sourcePath = resolve(__dirname, '../WorkstreamSessionTabs.tsx');

function seedWorkstreamSessionTabs({
  hasChildren = true,
  sessionRegistry = new Map<string, any>([
    ['workstream-1', { parentSessionId: null }],
  ]),
}: {
  hasChildren?: boolean;
  sessionRegistry?: Map<string, any>;
} = {}) {
  mockState.atomValues.clear();
  mockState.setAtomFns.clear();
  mockState.defaultSetAtom.mockClear();
  mockState.createChildSession.mockClear();
  mockState.convertToWorkstream.mockClear();
  mockState.agentSessionPanelProps.length = 0;

  mockState.atomValues.set(mockState.tokens.sessionRegistryAtom, sessionRegistry);
  mockState.atomValues.set(mockState.tokens.defaultAgentModelAtom, 'openai-codex:gpt-5.5');
  mockState.atomValues.set(mockState.tokens.workstreamHasChildrenAtom('workstream-1'), hasChildren);
  mockState.atomValues.set(mockState.tokens.sessionTitleAtom('session-a'), 'Build transcript chrome');
  mockState.atomValues.set(mockState.tokens.sessionProviderAtom('session-a'), 'openai-codex');
  mockState.atomValues.set(mockState.tokens.sessionProcessingAtom('session-a'), true);
  mockState.atomValues.set(mockState.tokens.sessionUnreadAtom('session-a'), false);
  mockState.atomValues.set(mockState.tokens.sessionArchivedAtom('session-a'), false);
  mockState.atomValues.set(mockState.tokens.sessionTitleAtom('session-b'), 'Review event matrix');
  mockState.atomValues.set(mockState.tokens.sessionProviderAtom('session-b'), 'claude-code');
  mockState.atomValues.set(mockState.tokens.sessionProcessingAtom('session-b'), false);
  mockState.atomValues.set(mockState.tokens.sessionUnreadAtom('session-b'), true);
  mockState.atomValues.set(mockState.tokens.sessionArchivedAtom('session-b'), true);

  mockState.setAtomFns.set(mockState.tokens.createChildSessionAtom, mockState.createChildSession);
  mockState.setAtomFns.set(mockState.tokens.convertToWorkstreamAtom, mockState.convertToWorkstream);
}

function renderTabs(overrides: Partial<React.ComponentProps<typeof WorkstreamSessionTabs>> = {}) {
  return render(
    <WorkstreamSessionTabs
      workspacePath="/workspace"
      workstreamId="workstream-1"
      sessions={['session-a', 'session-b']}
      activeSessionId="session-a"
      onSessionSelect={vi.fn()}
      {...overrides}
    />,
  );
}

describe('AgentMode WorkstreamSessionTabs Agent Elements shell', () => {
  beforeEach(() => {
    seedWorkstreamSessionTabs();
  });

  it('renders an Agent Elements empty/loading shell when no active session is selected', () => {
    const { container } = renderTabs({ activeSessionId: null });

    const empty = screen.getByTestId('agent-elements-workstream-session-tabs-empty');
    expect(empty).toHaveClass('workstream-session-tabs-empty', 'agent-elements-workstream-session-tabs-empty');
    expect(empty).toHaveAttribute('data-component', 'WorkstreamSessionTabs');
    expect(empty).toHaveAttribute('data-agent-elements-shell', 'workstream-session-tabs-empty');
    expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="agent-session-panel"]')).not.toBeInTheDocument();
  });

  it('wraps the session tab bar in Agent Elements chrome while preserving active, unread, processing, and panel props', () => {
    const onSessionSelect = vi.fn();
    renderTabs({ onSessionSelect, collapseTranscript: true, onFileClick: vi.fn() });

    const root = screen.getByTestId('agent-elements-workstream-session-tabs');
    expect(root).toHaveClass('workstream-session-tabs', 'agent-elements-workstream-session-tabs');
    expect(root).toHaveAttribute('data-component', 'WorkstreamSessionTabs');
    expect(root).toHaveAttribute('data-active-session-id', 'session-a');
    expect(root).toHaveAttribute('data-session-count', '2');

    const tabBar = screen.getByTestId('agent-elements-workstream-session-tab-bar');
    expect(tabBar).toHaveAttribute('data-agent-elements-shell', 'workstream-session-tab-bar');

    const activeTab = screen.getByTestId('agent-elements-session-tab-session-a');
    expect(activeTab).toHaveAttribute('data-active', 'true');
    expect(activeTab).toHaveAttribute('data-processing', 'true');
    expect(within(activeTab).getByText('Build transcript chrome')).toBeInTheDocument();
    expect(within(activeTab).getByTestId('agent-elements-session-tab-processing-dot')).toBeInTheDocument();

    const unreadTab = screen.getByTestId('agent-elements-session-tab-session-b');
    expect(unreadTab).toHaveAttribute('data-unread', 'true');
    expect(unreadTab).toHaveAttribute('data-archived', 'true');
    expect(within(unreadTab).getByText('Review event matrix')).toBeInTheDocument();
    expect(within(unreadTab).getByTestId('agent-elements-session-tab-unread-dot')).toBeInTheDocument();

    fireEvent.click(unreadTab);
    expect(onSessionSelect).toHaveBeenCalledWith('session-b');

    expect(screen.getByTestId('agent-elements-workstream-session-tabs-content')).toHaveAttribute(
      'data-agent-elements-shell',
      'workstream-session-tabs-content',
    );
    expect(mockState.agentSessionPanelProps[0]).toMatchObject({
      sessionId: 'session-a',
      workspacePath: '/workspace',
      collapseTranscript: true,
    });
  });

  it('preserves new-session routing for workstreams, single sessions, and worktrees', async () => {
    renderTabs();

    fireEvent.click(screen.getByTestId('agent-elements-new-session-tab-button'));
    expect(mockState.createChildSession).toHaveBeenCalledWith({
      parentSessionId: 'workstream-1',
      workspacePath: '/workspace',
      model: 'openai-codex:gpt-5.5',
    });

    seedWorkstreamSessionTabs({ hasChildren: false });
    renderTabs();
    fireEvent.click(screen.getAllByTestId('agent-elements-new-session-tab-button')[1]);
    expect(mockState.convertToWorkstream).toHaveBeenCalledWith({
      sessionId: 'workstream-1',
      workspacePath: '/workspace',
      model: 'openai-codex:gpt-5.5',
    });

    const onAddSessionToWorktree = vi.fn().mockResolvedValue(undefined);
    seedWorkstreamSessionTabs();
    renderTabs({ worktreeId: 'worktree-1', onAddSessionToWorktree });
    fireEvent.click(screen.getAllByTestId('agent-elements-new-session-tab-button')[2]);
    expect(onAddSessionToWorktree).toHaveBeenCalledWith('worktree-1');
  });

  it('preserves context-menu rename behavior inside the styled tab', () => {
    const onSessionRename = vi.fn();
    renderTabs({ onSessionRename });

    fireEvent.contextMenu(screen.getByTestId('agent-elements-session-tab-session-a'));
    fireEvent.click(screen.getByTestId('session-context-menu-rename'));

    const renameInput = screen.getByTestId('agent-elements-session-tab-rename-input');
    expect(renameInput).toHaveValue('Build transcript chrome');
    fireEvent.change(renameInput, { target: { value: 'Renamed session' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });

    expect(onSessionRename).toHaveBeenCalledWith('session-a', 'Renamed session');
  });

  it('keeps WorkstreamSessionTabs source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-workstream-session-tabs');
    expect(source).toContain('data-agent-elements-shell="workstream-session-tabs"');
    expect(source).toContain('agent-elements-session-tab');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/border-t-\[3px\]|rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
