// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentMode } from '../AgentMode';

const mockState = vi.hoisted(() => {
  const tokens = {
    defaultAgentModelAtom: 'defaultAgentModelAtom',
    worktreesFeatureAvailableAtom: 'worktreesFeatureAvailableAtom',
    alphaFeatureEnabledAtom: (feature: string) => `alphaFeatureEnabled:${feature}`,
    selectedWorkstreamAtom: (workspacePath: string) => `selectedWorkstream:${workspacePath}`,
    sessionHistoryWidthAtom: 'sessionHistoryWidthAtom',
    sessionHistoryCollapsedAtom: 'sessionHistoryCollapsedAtom',
    collapsedGroupsAtom: 'collapsedGroupsAtom',
    sortOrderAtom: 'sortOrderAtom',
    requestOpenSessionAtom: 'requestOpenSessionAtom',
    trayNewSessionRequestAtom: 'trayNewSessionRequestAtom',
    viewModeAtom: 'viewModeAtom',
    isRestoringNavigationAtom: 'isRestoringNavigationAtom',
    fetchSessionSharesAtom: 'fetchSessionSharesAtom',
    blitzAnalysisCreatedAtom: 'blitzAnalysisCreatedAtom',
    activeSessionIdAtom: 'activeSessionIdAtom',
    sessionAgentRoleAtom: (sessionId: string) => `sessionAgentRole:${sessionId}`,
    workstreamActiveChildAtom: (workstreamId: string) => `workstreamActiveChild:${workstreamId}`,
    workstreamStateAtom: (workstreamId: string) => `workstreamState:${workstreamId}`,
    setSelectedWorkstreamAtom: 'setSelectedWorkstreamAtom',
    addSessionFullAtom: 'addSessionFullAtom',
    setSessionHistoryWidthAtom: 'setSessionHistoryWidthAtom',
    setCollapsedGroupsAtom: 'setCollapsedGroupsAtom',
    setSortOrderAtom: 'setSortOrderAtom',
    setActiveSessionInWorkstreamAtom: 'setActiveSessionInWorkstreamAtom',
    loadSessionChildrenAtom: 'loadSessionChildrenAtom',
    loadSessionDataAtom: 'loadSessionDataAtom',
    updateSessionStoreAtom: 'updateSessionStoreAtom',
    refreshSessionListAtom: 'refreshSessionListAtom',
    removeSessionFullAtom: 'removeSessionFullAtom',
    setSessionDraftInputAtom: 'setSessionDraftInputAtom',
    setViewModeAtom: 'setViewModeAtom',
    setWorktreeActiveSessionAtom: 'setWorktreeActiveSessionAtom',
  };

  return {
    tokens,
    atomValues: new Map<unknown, any>(),
    setAtomFns: new Map<unknown, any>(),
    defaultSetAtom: vi.fn(),
    addSession: vi.fn(),
    setSelectedWorkstream: vi.fn(),
    agentWorkstreamPanelProps: [] as any[],
    sessionHistoryProps: [] as any[],
    resizablePanelProps: [] as any[],
    kanbanProps: [] as any[],
    metaAgentModeProps: [] as any[],
    invoked: [] as Array<[string, ...any[]]>,
  };
});

vi.mock('jotai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jotai')>();
  return {
    ...actual,
    useAtomValue: vi.fn((atom: unknown) => mockState.atomValues.get(atom) ?? null),
    useSetAtom: vi.fn((atom: unknown) => mockState.setAtomFns.get(atom) ?? mockState.defaultSetAtom),
  };
});

vi.mock('@nimbalyst/runtime/ai/server/types', () => ({
  ModelIdentifier: {
    tryParse: vi.fn((model: string | undefined | null) => {
      if (!model) return null;
      const [provider] = model.split(':');
      return { provider };
    }),
  },
}));

vi.mock('../AgentWorkstreamPanel', () => ({
  AgentWorkstreamPanel: React.forwardRef((props: any, ref) => {
    mockState.agentWorkstreamPanelProps.push(props);
    React.useImperativeHandle(ref, () => ({ closeActiveTab: vi.fn() }));
    return (
      <div
        data-testid="mock-agent-workstream-panel"
        data-workstream-id={props.workstreamId}
        data-workstream-type={props.workstreamType}
      />
    );
  }),
}));

vi.mock('../AgenticCoding/ResizablePanel', () => ({
  ResizablePanel: (props: any) => {
    mockState.resizablePanelProps.push(props);
    return (
      <div
        data-testid="mock-resizable-panel"
        data-left-width={props.leftWidth}
        data-collapsed={String(props.collapsed)}
      >
        <div data-testid="mock-left-panel">{props.leftPanel}</div>
        <div data-testid="mock-right-panel">{props.rightPanel}</div>
      </div>
    );
  },
}));

vi.mock('../../AgenticCoding/ResizablePanel', () => ({
  ResizablePanel: (props: any) => {
    mockState.resizablePanelProps.push(props);
    return (
      <div
        data-testid="mock-resizable-panel"
        data-left-width={props.leftWidth}
        data-collapsed={String(props.collapsed)}
      >
        <div data-testid="mock-left-panel">{props.leftPanel}</div>
        <div data-testid="mock-right-panel">{props.rightPanel}</div>
      </div>
    );
  },
}));

vi.mock('../../AgenticCoding/SessionHistory', () => ({
  SessionHistory: (props: any) => {
    mockState.sessionHistoryProps.push(props);
    return (
      <div data-testid="mock-session-history" data-active-session-id={props.activeSessionId ?? ''}>
        <button type="button" data-testid="mock-session-history-new" onClick={() => props.onNewSession?.()}>
          New
        </button>
      </div>
    );
  },
}));

vi.mock('../../TrackerMode/SessionKanbanBoard', () => ({
  SessionKanbanBoard: (props: any) => {
    mockState.kanbanProps.push(props);
    return <div data-testid="mock-session-kanban" />;
  },
}));

vi.mock('../../MetaAgentMode/MetaAgentMode', () => ({
  MetaAgentMode: (props: any) => {
    mockState.metaAgentModeProps.push(props);
    return <div data-testid="mock-meta-agent-mode" data-session-id={props.sessionId} />;
  },
}));

vi.mock('../../BlitzDialog/BlitzDialog', () => ({
  BlitzDialog: (props: any) => (
    <div data-testid="mock-blitz-dialog" data-open={String(props.isOpen)} data-workspace-path={props.workspacePath} />
  ),
}));

vi.mock('../../../hooks/useSuperLoop', () => ({
  useSuperLoopInit: vi.fn(),
}));

vi.mock('../../../services/ErrorNotificationService', () => ({
  errorNotificationService: {
    showError: vi.fn(),
  },
}));

vi.mock('../../../store/listeners/fileStateListeners', () => ({ initFileStateListeners: vi.fn(() => vi.fn()) }));
vi.mock('../../../store/listeners/fileTreeListeners', () => ({ initFileTreeListeners: vi.fn(() => vi.fn()) }));
vi.mock('../../../store/listeners/sessionListListeners', () => ({ initSessionListListeners: vi.fn(() => vi.fn()) }));
vi.mock('../../../store/listeners/sessionTranscriptListeners', () => ({ initSessionTranscriptListeners: vi.fn(() => vi.fn()) }));
vi.mock('../../../store/listeners/trayListeners', () => ({
  initTrayListeners: vi.fn(() => vi.fn()),
  trayNewSessionRequestAtom: mockState.tokens.trayNewSessionRequestAtom,
}));
vi.mock('../../../store/listeners/deepLinkListeners', () => ({ initDeepLinkListeners: vi.fn(() => vi.fn()) }));
vi.mock('../../../store/sessionStateListeners', () => ({
  initSessionStateListeners: vi.fn(() => vi.fn()),
  updateSessionStateListenerWorkspace: vi.fn(),
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  defaultAgentModelAtom: mockState.tokens.defaultAgentModelAtom,
  worktreesFeatureAvailableAtom: mockState.tokens.worktreesFeatureAvailableAtom,
  alphaFeatureEnabledAtom: mockState.tokens.alphaFeatureEnabledAtom,
}));

vi.mock('../../../store/atoms/blitz', () => ({
  blitzAnalysisCreatedAtom: mockState.tokens.blitzAnalysisCreatedAtom,
}));

vi.mock('../../../store/atoms/workstreamState', () => ({
  workstreamStateAtom: mockState.tokens.workstreamStateAtom,
  workstreamActiveChildAtom: mockState.tokens.workstreamActiveChildAtom,
  workstreamLayoutModeAtom: 'workstreamLayoutModeAtom',
  workstreamSplitRatioAtom: 'workstreamSplitRatioAtom',
  workstreamFilesSidebarVisibleAtom: 'workstreamFilesSidebarVisibleAtom',
  workstreamHasOpenFilesAtom: 'workstreamHasOpenFilesAtom',
  setWorkstreamLayoutModeAtom: 'setWorkstreamLayoutModeAtom',
  setWorkstreamSplitRatioAtom: 'setWorkstreamSplitRatioAtom',
  toggleWorkstreamFilesSidebarAtom: 'toggleWorkstreamFilesSidebarAtom',
  loadWorkstreamState: vi.fn(),
  workstreamStatesLoadedAtom: 'workstreamStatesLoadedAtom',
  workstreamWorktreePathAtom: 'workstreamWorktreePathAtom',
  initWorkstreamState: vi.fn(),
  loadWorkstreamStates: vi.fn(),
  setWorkstreamActiveChildAtom: 'setWorkstreamActiveChildAtom',
  setWorktreeActiveSessionAtom: mockState.tokens.setWorktreeActiveSessionAtom,
}));

vi.mock('../../../store/atoms/terminals', () => ({
  terminalListAtom: 'terminalListAtom',
  setActiveTerminal: vi.fn(),
  loadTerminals: vi.fn(),
}));

vi.mock('../../../store/atoms/sessionKanban', () => ({
  sessionKanbanTagsAtom: 'sessionKanbanTagsAtom',
  setSessionTagsAtom: 'setSessionTagsAtom',
}));

vi.mock('../../../store/atoms/agentMode', () => ({
  requestOpenSessionAtom: mockState.tokens.requestOpenSessionAtom,
  filesEditedWidthAtom: 'filesEditedWidthAtom',
  setFilesEditedWidthAtom: 'setFilesEditedWidthAtom',
}));

vi.mock('../../../store', () => ({
  selectedWorkstreamAtom: mockState.tokens.selectedWorkstreamAtom,
  setSelectedWorkstreamAtom: mockState.tokens.setSelectedWorkstreamAtom,
  sessionHistoryWidthAtom: mockState.tokens.sessionHistoryWidthAtom,
  sessionHistoryCollapsedAtom: mockState.tokens.sessionHistoryCollapsedAtom,
  collapsedGroupsAtom: mockState.tokens.collapsedGroupsAtom,
  sortOrderAtom: mockState.tokens.sortOrderAtom,
  setSessionHistoryWidthAtom: mockState.tokens.setSessionHistoryWidthAtom,
  setCollapsedGroupsAtom: mockState.tokens.setCollapsedGroupsAtom,
  setSortOrderAtom: mockState.tokens.setSortOrderAtom,
  initSessionList: vi.fn(),
  initAgentModeLayout: vi.fn(),
  initSessionEditors: vi.fn(),
  addSessionFullAtom: mockState.tokens.addSessionFullAtom,
  setActiveSessionInWorkstreamAtom: mockState.tokens.setActiveSessionInWorkstreamAtom,
  loadSessionChildrenAtom: mockState.tokens.loadSessionChildrenAtom,
  loadSessionDataAtom: mockState.tokens.loadSessionDataAtom,
  updateSessionStoreAtom: mockState.tokens.updateSessionStoreAtom,
  sessionAgentRoleAtom: mockState.tokens.sessionAgentRoleAtom,
  sessionRegistryAtom: 'sessionRegistryAtom',
  sessionStoreAtom: 'sessionStoreAtom',
  pushNavigationEntryAtom: 'pushNavigationEntryAtom',
  isRestoringNavigationAtom: mockState.tokens.isRestoringNavigationAtom,
  markSessionReadAtom: 'markSessionReadAtom',
  activeSessionIdAtom: mockState.tokens.activeSessionIdAtom,
  setSessionDraftInputAtom: mockState.tokens.setSessionDraftInputAtom,
  viewModeAtom: mockState.tokens.viewModeAtom,
  setViewModeAtom: mockState.tokens.setViewModeAtom,
  registerWorkstreamSelectedHook: vi.fn(),
  refreshSessionListAtom: mockState.tokens.refreshSessionListAtom,
  removeSessionFullAtom: mockState.tokens.removeSessionFullAtom,
  fetchSessionSharesAtom: mockState.tokens.fetchSessionSharesAtom,
  store: {
    get: vi.fn((atom: unknown) => mockState.atomValues.get(atom)),
    set: vi.fn(),
  },
}));

const sourcePath = resolve(__dirname, '../AgentMode.tsx');

function seedAgentMode({
  selectedWorkstream = null,
  viewMode = 'list',
  selectedAgentRole = 'standard',
}: {
  selectedWorkstream?: { id: string; type: 'session' | 'workstream' | 'worktree' } | null;
  viewMode?: 'list' | 'kanban';
  selectedAgentRole?: 'standard' | 'meta-agent';
} = {}) {
  mockState.atomValues.clear();
  mockState.setAtomFns.clear();
  mockState.defaultSetAtom.mockClear();
  mockState.addSession.mockClear();
  mockState.setSelectedWorkstream.mockClear();
  mockState.agentWorkstreamPanelProps.length = 0;
  mockState.sessionHistoryProps.length = 0;
  mockState.resizablePanelProps.length = 0;
  mockState.kanbanProps.length = 0;
  mockState.metaAgentModeProps.length = 0;
  mockState.invoked.length = 0;

  mockState.atomValues.set(mockState.tokens.defaultAgentModelAtom, 'smarty-server:smarty_coding_agent');
  mockState.atomValues.set(mockState.tokens.worktreesFeatureAvailableAtom, true);
  mockState.atomValues.set(mockState.tokens.alphaFeatureEnabledAtom('blitz'), false);
  mockState.atomValues.set(mockState.tokens.selectedWorkstreamAtom('/workspace'), selectedWorkstream);
  mockState.atomValues.set(mockState.tokens.sessionHistoryWidthAtom, 320);
  mockState.atomValues.set(mockState.tokens.sessionHistoryCollapsedAtom, false);
  mockState.atomValues.set(mockState.tokens.collapsedGroupsAtom, new Set<string>());
  mockState.atomValues.set(mockState.tokens.sortOrderAtom, 'updated');
  mockState.atomValues.set(mockState.tokens.trayNewSessionRequestAtom, false);
  mockState.atomValues.set(mockState.tokens.requestOpenSessionAtom, null);
  mockState.atomValues.set(mockState.tokens.viewModeAtom, viewMode);
  mockState.atomValues.set(mockState.tokens.isRestoringNavigationAtom, false);
  mockState.atomValues.set(mockState.tokens.blitzAnalysisCreatedAtom, null);
  if (selectedWorkstream) {
    mockState.atomValues.set(mockState.tokens.workstreamActiveChildAtom(selectedWorkstream.id), null);
    mockState.atomValues.set(mockState.tokens.sessionAgentRoleAtom(selectedWorkstream.id), selectedAgentRole);
  }

  mockState.setAtomFns.set(mockState.tokens.addSessionFullAtom, mockState.addSession);
  mockState.setAtomFns.set(mockState.tokens.setSelectedWorkstreamAtom, mockState.setSelectedWorkstream);
}

function renderAgentMode(
  props: Partial<React.ComponentProps<typeof AgentMode>> = {},
) {
  return render(
    <AgentMode
      workspacePath="/workspace"
      workspaceName="Workspace"
      isActive
      onFileOpen={vi.fn()}
      onReady={vi.fn()}
      {...props}
    />,
  );
}

describe('AgentMode root Agent Elements shell', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'session-new') });
    (window as any).electronAPI = {
      invoke: vi.fn((channel: string, ...args: any[]) => {
        mockState.invoked.push([channel, ...args]);
        if (channel === 'git:is-repo') return new Promise(() => undefined);
        if (channel === 'sessions:create') return Promise.resolve({ success: true, id: 'session-new' });
        return Promise.resolve({ success: true });
      }),
    };
    seedAgentMode();
  });

  it('wraps the top-level agent mode and empty state in Agent Elements shell chrome', () => {
    const { container } = renderAgentMode();

    const root = screen.getByTestId('agent-elements-agent-mode');
    expect(container.firstElementChild).toBe(root);
    expect(root).toHaveClass('agent-mode', 'agent-elements-agent-mode');
    expect(root).toHaveAttribute('data-component', 'AgentMode');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'agent-mode');
    expect(root).toHaveAttribute('data-workspace-path', '/workspace');
    expect(root).toHaveAttribute('data-active', 'true');
    expect(root).toHaveAttribute('data-view-mode', 'list');

    const empty = screen.getByTestId('agent-elements-agent-mode-empty');
    expect(empty).toHaveClass('agent-mode-empty', 'agent-elements-agent-mode-empty');
    expect(empty).toHaveAttribute('data-agent-elements-shell', 'agent-mode-empty');
    expect(screen.getByRole('button', { name: 'New Session' })).toHaveClass(
      'agent-mode-new-button',
      'agent-elements-agent-mode-new-session',
    );

    expect(screen.getByTestId('mock-session-history')).toBeInTheDocument();
    expect(screen.getByTestId('mock-resizable-panel')).toHaveAttribute('data-left-width', '320');
  });

  it('preserves selected workstream and meta-agent routing through the styled root', () => {
    seedAgentMode({
      selectedWorkstream: { id: 'session-1', type: 'worktree' },
      selectedAgentRole: 'standard',
    });
    renderAgentMode();

    expect(screen.getByTestId('mock-agent-workstream-panel')).toHaveAttribute('data-workstream-id', 'session-1');
    expect(screen.getByTestId('mock-agent-workstream-panel')).toHaveAttribute('data-workstream-type', 'worktree');
    expect(mockState.agentWorkstreamPanelProps[0]).toMatchObject({
      workspacePath: '/workspace',
      workstreamId: 'session-1',
      workstreamType: 'worktree',
      isGitRepo: false,
    });

    seedAgentMode({
      selectedWorkstream: { id: 'meta-session', type: 'session' },
      selectedAgentRole: 'meta-agent',
    });
    renderAgentMode();

    expect(screen.getByTestId('mock-meta-agent-mode')).toHaveAttribute('data-session-id', 'meta-session');
  });

  it('preserves kanban routing and new-session creation from the Agent Elements empty state', async () => {
    seedAgentMode({ viewMode: 'kanban' });
    const { unmount } = renderAgentMode();

    const root = screen.getByTestId('agent-elements-agent-mode');
    expect(root).toHaveAttribute('data-view-mode', 'kanban');
    expect(screen.getByTestId('mock-session-kanban')).toBeInTheDocument();
    unmount();

    seedAgentMode();
    renderAgentMode();
    fireEvent.click(screen.getByRole('button', { name: 'New Session' }));
    await vi.waitFor(() => {
      expect(mockState.invoked.some(([channel]) => channel === 'sessions:create')).toBe(true);
    });
    expect(mockState.addSession).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-new',
      title: 'New Session',
      provider: 'smarty-server',
      model: 'smarty-server:smarty_coding_agent',
      workspaceId: '/workspace',
    }));
    expect(mockState.setSelectedWorkstream).toHaveBeenCalledWith({
      workspacePath: '/workspace',
      selection: { type: 'session', id: 'session-new' },
    });
  });

  it('keeps AgentMode source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-agent-mode');
    expect(source).toContain('data-agent-elements-shell="agent-mode"');
    expect(source).toContain('agent-elements-agent-mode-empty');
    expect(source).toContain('var(--an-background)');
    expect(source).toContain('var(--an-foreground)');
    expect(source).toContain('var(--an-spacing-md)');
    expect(source).toContain('var(--an-radius-sm)');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
