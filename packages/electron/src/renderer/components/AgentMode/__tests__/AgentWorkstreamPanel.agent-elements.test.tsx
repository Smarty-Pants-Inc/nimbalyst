// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentWorkstreamPanel, type AgentWorkstreamPanelRef } from '../AgentWorkstreamPanel';

const mockState = vi.hoisted(() => {
  const tokens = {
    workstreamSessionsAtom: (workstreamId: string) => `workstreamSessions:${workstreamId}`,
    workstreamTitleAtom: (workstreamId: string) => `workstreamTitle:${workstreamId}`,
    workstreamProcessingAtom: (workstreamId: string) => `workstreamProcessing:${workstreamId}`,
    workstreamTagsAtom: (workstreamId: string) => `workstreamTags:${workstreamId}`,
    sessionArchivedAtom: (sessionId: string) => `sessionArchived:${sessionId}`,
    sessionStoreAtom: (sessionId: string) => `sessionStore:${sessionId}`,
    sessionRegistryAtom: 'sessionRegistryAtom',
    sessionParentIdDerivedAtom: (sessionId: string) => `sessionParentId:${sessionId}`,
    sessionWorktreeIdAtom: (sessionId: string) => `sessionWorktreeId:${sessionId}`,
    loadSessionChildrenAtom: 'loadSessionChildrenAtom',
    loadSessionDataAtom: 'loadSessionDataAtom',
    updateSessionStoreAtom: 'updateSessionStoreAtom',
    setActiveSessionInWorkstreamAtom: 'setActiveSessionInWorkstreamAtom',
    workstreamStateAtom: (workstreamId: string) => `workstreamState:${workstreamId}`,
    workstreamActiveChildAtom: (workstreamId: string) => `workstreamActiveChild:${workstreamId}`,
    workstreamLayoutModeAtom: (workstreamId: string) => `workstreamLayoutMode:${workstreamId}`,
    workstreamSplitRatioAtom: (workstreamId: string) => `workstreamSplitRatio:${workstreamId}`,
    workstreamFilesSidebarVisibleAtom: (workstreamId: string) => `workstreamFilesSidebarVisible:${workstreamId}`,
    workstreamHasOpenFilesAtom: (workstreamId: string) => `workstreamHasOpenFiles:${workstreamId}`,
    setWorkstreamLayoutModeAtom: 'setWorkstreamLayoutModeAtom',
    setWorkstreamSplitRatioAtom: 'setWorkstreamSplitRatioAtom',
    toggleWorkstreamFilesSidebarAtom: 'toggleWorkstreamFilesSidebarAtom',
    workstreamStatesLoadedAtom: 'workstreamStatesLoadedAtom',
    workstreamWorktreePathAtom: (workstreamId: string) => `workstreamWorktreePath:${workstreamId}`,
    filesEditedWidthAtom: 'filesEditedWidthAtom',
    setFilesEditedWidthAtom: 'setFilesEditedWidthAtom',
    terminalListAtom: 'terminalListAtom',
    sessionKanbanTagsAtom: 'sessionKanbanTagsAtom',
    setSessionTagsAtom: 'setSessionTagsAtom',
  };

  return {
    tokens,
    atomValues: new Map<string, any>(),
    setAtomFns: new Map<string, any>(),
    defaultSetAtom: vi.fn(),
    setSessionArchived: vi.fn(),
    loadSessionData: vi.fn(),
    loadSessionChildren: vi.fn(),
    updateSessionStore: vi.fn(),
    setActiveSession: vi.fn(),
    setWorkstreamState: vi.fn(),
    setLayoutMode: vi.fn(),
    setSplitRatio: vi.fn(),
    toggleSidebar: vi.fn(),
    setSidebarWidth: vi.fn(),
    setSessionTags: vi.fn(),
    loadWorkstreamState: vi.fn(),
    setActiveTerminal: vi.fn(),
    searchReplaceToggle: vi.fn(),
    showArchiveDialog: vi.fn(),
    closeArchiveDialog: vi.fn(),
    confirmArchive: vi.fn(),
    editorTabsProps: [] as any[],
    sessionTabsProps: [] as any[],
    filesEditedSidebarProps: [] as any[],
    layoutControlsProps: [] as any[],
    editorOpenFile: vi.fn(),
    editorCloseActiveTab: vi.fn(),
    editorGetActiveFilePath: vi.fn(() => '/workspace/src/App.tsx'),
    editorGetActiveTab: vi.fn(() => ({
      filePath: '/workspace/src/App.tsx',
      content: 'export const app = true;',
    })),
  };
});

vi.mock('jotai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jotai')>();

  return {
    ...actual,
    useAtom: vi.fn((atom: string) => [
      mockState.atomValues.get(atom),
      mockState.setAtomFns.get(atom) ?? mockState.defaultSetAtom,
    ]),
    useAtomValue: vi.fn((atom: string) => mockState.atomValues.get(atom)),
    useSetAtom: vi.fn((atom: string) => mockState.setAtomFns.get(atom) ?? mockState.defaultSetAtom),
  };
});

vi.mock('@floating-ui/react', () => ({
  useFloating: () => ({
    refs: {
      setReference: vi.fn(),
      setFloating: vi.fn(),
    },
    floatingStyles: {},
    context: {},
  }),
  offset: vi.fn(),
  flip: vi.fn(),
  shift: vi.fn(),
  FloatingPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useClick: vi.fn(() => ({})),
  useDismiss: vi.fn(() => ({})),
  useRole: vi.fn(() => ({})),
  useInteractions: vi.fn(() => ({
    getReferenceProps: () => ({}),
    getFloatingProps: () => ({}),
  })),
}));

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
    SearchReplaceStateManager: {
      toggle: mockState.searchReplaceToggle,
    },
  };
});

vi.mock('../../utils/pathUtils', () => ({
  getWorktreeNameFromPath: (path: string, fallback = 'workspace') => path.split('/').filter(Boolean).pop() ?? fallback,
}));

vi.mock('../../../store', () => ({
  workstreamSessionsAtom: mockState.tokens.workstreamSessionsAtom,
  workstreamTitleAtom: mockState.tokens.workstreamTitleAtom,
  workstreamProcessingAtom: mockState.tokens.workstreamProcessingAtom,
  workstreamTagsAtom: mockState.tokens.workstreamTagsAtom,
  sessionArchivedAtom: mockState.tokens.sessionArchivedAtom,
  sessionStoreAtom: mockState.tokens.sessionStoreAtom,
  sessionRegistryAtom: mockState.tokens.sessionRegistryAtom,
  sessionParentIdDerivedAtom: mockState.tokens.sessionParentIdDerivedAtom,
  sessionWorktreeIdAtom: mockState.tokens.sessionWorktreeIdAtom,
  loadSessionChildrenAtom: mockState.tokens.loadSessionChildrenAtom,
  loadSessionDataAtom: mockState.tokens.loadSessionDataAtom,
  updateSessionStoreAtom: mockState.tokens.updateSessionStoreAtom,
  setActiveSessionInWorkstreamAtom: mockState.tokens.setActiveSessionInWorkstreamAtom,
}));

vi.mock('../../../store/atoms/workstreamState', () => ({
  workstreamStateAtom: mockState.tokens.workstreamStateAtom,
  workstreamActiveChildAtom: mockState.tokens.workstreamActiveChildAtom,
  workstreamLayoutModeAtom: mockState.tokens.workstreamLayoutModeAtom,
  workstreamSplitRatioAtom: mockState.tokens.workstreamSplitRatioAtom,
  workstreamFilesSidebarVisibleAtom: mockState.tokens.workstreamFilesSidebarVisibleAtom,
  workstreamHasOpenFilesAtom: mockState.tokens.workstreamHasOpenFilesAtom,
  setWorkstreamLayoutModeAtom: mockState.tokens.setWorkstreamLayoutModeAtom,
  setWorkstreamSplitRatioAtom: mockState.tokens.setWorkstreamSplitRatioAtom,
  toggleWorkstreamFilesSidebarAtom: mockState.tokens.toggleWorkstreamFilesSidebarAtom,
  loadWorkstreamState: mockState.loadWorkstreamState,
  workstreamStatesLoadedAtom: mockState.tokens.workstreamStatesLoadedAtom,
  workstreamWorktreePathAtom: mockState.tokens.workstreamWorktreePathAtom,
}));

vi.mock('../../../store/atoms/agentMode', () => ({
  filesEditedWidthAtom: mockState.tokens.filesEditedWidthAtom,
  setFilesEditedWidthAtom: mockState.tokens.setFilesEditedWidthAtom,
}));

vi.mock('../../../store/atoms/terminals', () => ({
  terminalListAtom: mockState.tokens.terminalListAtom,
  setActiveTerminal: mockState.setActiveTerminal,
  loadTerminals: vi.fn(),
}));

vi.mock('../../../store/atoms/sessionKanban', () => ({
  sessionKanbanTagsAtom: mockState.tokens.sessionKanbanTagsAtom,
  setSessionTagsAtom: mockState.tokens.setSessionTagsAtom,
}));

vi.mock('../../../hooks/useArchiveWorktreeDialog', () => ({
  useArchiveWorktreeDialog: () => ({
    dialogState: null,
    showDialog: mockState.showArchiveDialog,
    closeDialog: mockState.closeArchiveDialog,
    confirmArchive: mockState.confirmArchive,
  }),
}));

vi.mock('../../../hooks/useDocumentContext', () => ({
  detectFileType: (filePath: string) => filePath.endsWith('.mockup') ? 'mockup' : 'code',
}));

vi.mock('../../UnifiedAI/TextSelectionIndicator', () => ({
  getTextSelection: vi.fn(() => null),
}));

vi.mock('../WorkstreamEditorTabs', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    WorkstreamEditorTabs: ReactModule.forwardRef((props: any, ref) => {
      mockState.editorTabsProps.push(props);
      ReactModule.useImperativeHandle(ref, () => ({
        openFile: mockState.editorOpenFile,
        hasTabs: () => true,
        getActiveFilePath: mockState.editorGetActiveFilePath,
        closeActiveTab: mockState.editorCloseActiveTab,
        getActiveTab: mockState.editorGetActiveTab,
      }));

      return (
        <div
          data-testid="mock-workstream-editor-tabs"
          data-workstream-id={props.workstreamId}
          data-base-path={props.basePath}
        >
          <div className="monaco-editor">
            <div className="inputarea">
              <textarea aria-label="mock monaco input" />
            </div>
          </div>
        </div>
      );
    }),
  };
});

vi.mock('../WorkstreamSessionTabs', () => ({
  WorkstreamSessionTabs: (props: any) => {
    mockState.sessionTabsProps.push(props);
    return (
      <div
        data-testid="mock-workstream-session-tabs"
        data-active-session-id={props.activeSessionId ?? ''}
        data-collapse-transcript={String(props.collapseTranscript)}
      >
        <button
          type="button"
          data-testid="mock-session-file-click"
          onClick={() => props.onFileClick?.('/workspace/src/App.tsx')}
        >
          Open file
        </button>
      </div>
    );
  },
}));

vi.mock('../FilesEditedSidebar', () => ({
  FilesEditedSidebar: (props: any) => {
    mockState.filesEditedSidebarProps.push(props);
    return (
      <aside
        data-testid="mock-files-edited-sidebar"
        data-workstream-id={props.workstreamId}
        data-active-session-id={props.activeSessionId ?? ''}
        data-width={String(props.width)}
      />
    );
  },
}));

vi.mock('../../UnifiedAI/LayoutControls', () => ({
  LayoutControls: (props: any) => {
    mockState.layoutControlsProps.push(props);
    return (
      <button type="button" data-testid="mock-layout-controls" onClick={() => props.onModeChange?.('editor')}>
        {props.mode}
      </button>
    );
  },
}));

vi.mock('../ArchiveWorktreeDialog', () => ({
  ArchiveWorktreeDialog: () => <div data-testid="mock-archive-worktree-dialog" />,
}));

const sourcePath = resolve(__dirname, '../AgentWorkstreamPanel.tsx');

function seedAgentWorkstreamPanel({
  layoutMode = 'split',
  sidebarVisible = true,
  activeSessionId = 'session-a',
  hasOpenFiles = true,
  worktreeId = 'worktree-1',
  worktreePath = '/workspace/.worktrees/feature',
}: {
  layoutMode?: 'transcript' | 'split' | 'editor';
  sidebarVisible?: boolean;
  activeSessionId?: string | null;
  hasOpenFiles?: boolean;
  worktreeId?: string | null;
  worktreePath?: string | null;
} = {}) {
  mockState.atomValues.clear();
  mockState.setAtomFns.clear();
  mockState.defaultSetAtom.mockClear();
  mockState.setSessionArchived.mockClear();
  mockState.loadSessionData.mockClear();
  mockState.loadSessionChildren.mockClear();
  mockState.updateSessionStore.mockClear();
  mockState.setActiveSession.mockClear();
  mockState.setWorkstreamState.mockClear();
  mockState.setLayoutMode.mockClear();
  mockState.setSplitRatio.mockClear();
  mockState.toggleSidebar.mockClear();
  mockState.setSidebarWidth.mockClear();
  mockState.setSessionTags.mockClear();
  mockState.loadWorkstreamState.mockClear();
  mockState.setActiveTerminal.mockClear();
  mockState.searchReplaceToggle.mockClear();
  mockState.editorTabsProps.length = 0;
  mockState.sessionTabsProps.length = 0;
  mockState.filesEditedSidebarProps.length = 0;
  mockState.layoutControlsProps.length = 0;
  mockState.editorOpenFile.mockClear();
  mockState.editorCloseActiveTab.mockClear();
  mockState.editorGetActiveFilePath.mockClear();
  mockState.editorGetActiveFilePath.mockReturnValue('/workspace/src/App.tsx');
  mockState.editorGetActiveTab.mockClear();
  mockState.editorGetActiveTab.mockReturnValue({
    filePath: '/workspace/src/App.tsx',
    content: 'export const app = true;',
  });
  mockState.showArchiveDialog.mockClear();
  mockState.closeArchiveDialog.mockClear();
  mockState.confirmArchive.mockClear();

  mockState.atomValues.set(mockState.tokens.workstreamSessionsAtom('workstream-1'), ['session-a', 'session-b']);
  mockState.atomValues.set(mockState.tokens.workstreamActiveChildAtom('workstream-1'), activeSessionId);
  mockState.atomValues.set(mockState.tokens.workstreamWorktreePathAtom('workstream-1'), worktreePath);
  mockState.atomValues.set(mockState.tokens.workstreamLayoutModeAtom('workstream-1'), layoutMode);
  mockState.atomValues.set(mockState.tokens.workstreamFilesSidebarVisibleAtom('workstream-1'), sidebarVisible);
  mockState.atomValues.set(mockState.tokens.workstreamSplitRatioAtom('workstream-1'), 0.42);
  mockState.atomValues.set(mockState.tokens.workstreamHasOpenFilesAtom('workstream-1'), hasOpenFiles);
  mockState.atomValues.set(mockState.tokens.filesEditedWidthAtom, 320);
  mockState.atomValues.set(mockState.tokens.sessionStoreAtom('workstream-1'), {
    title: 'Build agent UX',
    provider: 'openai-codex',
  });
  mockState.atomValues.set(mockState.tokens.workstreamTitleAtom('workstream-1'), 'Build agent UX');
  mockState.atomValues.set(mockState.tokens.workstreamProcessingAtom('workstream-1'), false);
  mockState.atomValues.set(mockState.tokens.workstreamTagsAtom('workstream-1'), []);
  mockState.atomValues.set(mockState.tokens.sessionArchivedAtom('workstream-1'), false);
  mockState.atomValues.set(mockState.tokens.sessionRegistryAtom, new Map([
    ['workstream-1', { tags: [], parentSessionId: null }],
  ]));
  mockState.atomValues.set(mockState.tokens.sessionParentIdDerivedAtom('workstream-1'), null);
  mockState.atomValues.set(mockState.tokens.sessionWorktreeIdAtom('workstream-1'), worktreeId);
  mockState.atomValues.set(mockState.tokens.workstreamStatesLoadedAtom, true);
  mockState.atomValues.set(mockState.tokens.terminalListAtom, []);
  mockState.atomValues.set(mockState.tokens.sessionKanbanTagsAtom, []);

  mockState.setAtomFns.set(mockState.tokens.sessionArchivedAtom('workstream-1'), mockState.setSessionArchived);
  mockState.setAtomFns.set(mockState.tokens.loadSessionDataAtom, mockState.loadSessionData);
  mockState.setAtomFns.set(mockState.tokens.loadSessionChildrenAtom, mockState.loadSessionChildren);
  mockState.setAtomFns.set(mockState.tokens.updateSessionStoreAtom, mockState.updateSessionStore);
  mockState.setAtomFns.set(mockState.tokens.setActiveSessionInWorkstreamAtom, mockState.setActiveSession);
  mockState.setAtomFns.set(mockState.tokens.workstreamStateAtom('workstream-1'), mockState.setWorkstreamState);
  mockState.setAtomFns.set(mockState.tokens.setWorkstreamLayoutModeAtom, mockState.setLayoutMode);
  mockState.setAtomFns.set(mockState.tokens.setWorkstreamSplitRatioAtom, mockState.setSplitRatio);
  mockState.setAtomFns.set(mockState.tokens.toggleWorkstreamFilesSidebarAtom, mockState.toggleSidebar);
  mockState.setAtomFns.set(mockState.tokens.setFilesEditedWidthAtom, mockState.setSidebarWidth);
  mockState.setAtomFns.set(mockState.tokens.setSessionTagsAtom, mockState.setSessionTags);

  class ResizeObserverMock {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);

  (window as any).electronAPI = {
    invoke: vi.fn().mockResolvedValue({ success: true }),
    terminal: {
      create: vi.fn().mockResolvedValue({ success: true, terminalId: 'terminal-1' }),
      setActive: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof AgentWorkstreamPanel>> = {}) {
  const ref = React.createRef<AgentWorkstreamPanelRef>();
  const onFileOpen = vi.fn().mockResolvedValue(undefined);
  const onAddSessionToWorktree = vi.fn().mockResolvedValue(undefined);
  const onCreateWorktreeSession = vi.fn().mockResolvedValue('session-c');
  const onWorktreeArchived = vi.fn();
  const onSwitchToAgentMode = vi.fn();
  const onOpenSessionInChat = vi.fn();

  const result = render(
    <AgentWorkstreamPanel
      ref={ref}
      workspacePath="/workspace"
      workstreamId="workstream-1"
      workstreamType="worktree"
      onFileOpen={onFileOpen}
      onAddSessionToWorktree={onAddSessionToWorktree}
      onCreateWorktreeSession={onCreateWorktreeSession}
      onWorktreeArchived={onWorktreeArchived}
      isGitRepo
      onSwitchToAgentMode={onSwitchToAgentMode}
      onOpenSessionInChat={onOpenSessionInChat}
      {...overrides}
    />,
  );

  return {
    ref,
    onFileOpen,
    onAddSessionToWorktree,
    onCreateWorktreeSession,
    onWorktreeArchived,
    onSwitchToAgentMode,
    onOpenSessionInChat,
    ...result,
  };
}

describe('AgentWorkstreamPanel Agent Elements shell', () => {
  beforeEach(() => {
    seedAgentWorkstreamPanel();
  });

  it('wraps the workstream, header, split areas, and files sidebar in Agent Elements chrome while preserving child props', () => {
    const { onFileOpen, onAddSessionToWorktree, onCreateWorktreeSession, onWorktreeArchived, onSwitchToAgentMode, onOpenSessionInChat } = renderPanel();

    const root = screen.getByTestId('agent-elements-agent-workstream-panel');
    expect(root).toHaveClass('agent-workstream-panel', 'agent-elements-agent-workstream-panel');
    expect(root.className).toContain('bg-[var(--an-background)]');
    expect(root.className).toContain('text-[var(--an-foreground)]');
    expect(root).toHaveAttribute('data-component', 'AgentWorkstreamPanel');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'agent-workstream-panel');
    expect(root).toHaveAttribute('data-workstream-id', 'workstream-1');
    expect(root).toHaveAttribute('data-workstream-type', 'worktree');
    expect(root).toHaveAttribute('data-workspace-path', '/workspace');
    expect(root).toHaveAttribute('data-layout-mode', 'split');
    expect(root).toHaveAttribute('data-sidebar-visible', 'true');
    expect(root).toHaveAttribute('data-active-session-id', 'session-a');
    expect(root).toHaveAttribute('data-worktree-id', 'worktree-1');
    expect(root).toHaveAttribute('data-worktree-path', '/workspace/.worktrees/feature');

    expect(screen.getByTestId('agent-elements-agent-workstream-main')).toHaveAttribute(
      'data-agent-elements-shell',
      'agent-workstream-main',
    );
    const header = screen.getByTestId('workstream-execution-context');
    expect(header).toHaveClass('workstream-header', 'agent-elements-workstream-header');
    expect(header).toHaveAttribute(
      'data-agent-elements-shell',
      'workstream-header',
    );
    expect(header).toHaveAttribute('data-worktree-path', '/workspace/.worktrees/feature');
    expect(screen.getByText('Build agent UX')).toBeInTheDocument();
    expect(screen.getByText('worktree feature')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-agent-workstream-content')).toHaveAttribute(
      'data-agent-elements-shell',
      'agent-workstream-content',
    );

    const editorArea = screen.getByTestId('agent-elements-agent-workstream-editor-area');
    expect(editorArea).toHaveAttribute('data-agent-elements-shell', 'agent-workstream-editor-area');
    expect(editorArea).toHaveAttribute('data-layout-mode', 'split');
    expect(editorArea).toHaveStyle({ height: '42%' });
    expect(screen.getByTestId('agent-elements-agent-workstream-vertical-resizer')).toHaveAttribute(
      'data-agent-elements-shell',
      'agent-workstream-vertical-resizer',
    );

    const sessionArea = screen.getByTestId('agent-elements-agent-workstream-session-area');
    expect(sessionArea).toHaveAttribute('data-agent-elements-shell', 'agent-workstream-session-area');
    expect(sessionArea).toHaveAttribute('data-collapse-transcript', 'false');
    expect(screen.getByTestId('agent-elements-agent-workstream-sidebar-resizer')).toHaveAttribute(
      'data-agent-elements-shell',
      'agent-workstream-sidebar-resizer',
    );

    expect(mockState.layoutControlsProps[0]).toMatchObject({
      mode: 'split',
      hasTabs: true,
    });
    expect(mockState.editorTabsProps[0]).toMatchObject({
      workstreamId: 'workstream-1',
      workspacePath: '/workspace',
      basePath: '/workspace/.worktrees/feature',
      isActive: true,
      onSwitchToAgentMode,
      onOpenSessionInChat,
    });
    expect(mockState.sessionTabsProps[0]).toMatchObject({
      workspacePath: '/workspace',
      workstreamId: 'workstream-1',
      sessions: ['session-a', 'session-b'],
      activeSessionId: 'session-a',
      worktreeId: 'worktree-1',
      onAddSessionToWorktree,
      onCreateWorktreeSession,
      collapseTranscript: false,
    });
    expect(mockState.filesEditedSidebarProps[0]).toMatchObject({
      workstreamId: 'workstream-1',
      activeSessionId: 'session-a',
      workspacePath: '/workspace',
      onOpenInFilesMode: onFileOpen,
      width: 320,
      worktreeId: 'worktree-1',
      worktreePath: '/workspace/.worktrees/feature',
      onWorktreeArchived,
      isGitRepo: true,
    });
  });

  it('preserves file-click routing from transcript mode by switching to split mode before editor tabs mount', () => {
    seedAgentWorkstreamPanel({
      layoutMode: 'transcript',
      hasOpenFiles: false,
      sidebarVisible: false,
      worktreeId: null,
      worktreePath: null,
    });
    renderPanel({ workstreamType: 'session' });

    expect(screen.queryByTestId('mock-workstream-editor-tabs')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mock-session-file-click'));

    expect(mockState.editorOpenFile).not.toHaveBeenCalled();
    expect(mockState.setLayoutMode).toHaveBeenCalledWith({
      workstreamId: 'workstream-1',
      mode: 'split',
    });
  });

  it('preserves editor-focused close/find routing through the styled editor area', () => {
    const { ref } = renderPanel();
    const editorArea = screen.getByTestId('agent-elements-agent-workstream-editor-area');
    const textarea = screen.getByLabelText('mock monaco input');
    const keydownSpy = vi.fn();
    textarea.addEventListener('keydown', keydownSpy);

    fireEvent.mouseDown(editorArea);
    window.dispatchEvent(new CustomEvent('menu:find'));
    expect(keydownSpy).toHaveBeenCalledTimes(1);

    ref.current?.closeActiveTab();
    expect(mockState.editorCloseActiveTab).toHaveBeenCalledTimes(1);
  });

  it('keeps AgentWorkstreamPanel source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-agent-workstream-panel');
    expect(source).toContain('data-agent-elements-shell="agent-workstream-panel"');
    expect(source).not.toContain('\0');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(|backdrop-blur/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
