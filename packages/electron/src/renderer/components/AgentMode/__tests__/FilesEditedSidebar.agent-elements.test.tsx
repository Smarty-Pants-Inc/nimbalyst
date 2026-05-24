import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => {
  const tokens = {
    diffTreeGroupByDirectoryAtom: 'diffTreeGroupByDirectoryAtom',
    setDiffTreeGroupByDirectoryAtom: 'setDiffTreeGroupByDirectoryAtom',
    agentFileScopeModeAtom: 'agentFileScopeModeAtom',
    setAgentFileScopeModeAtom: 'setAgentFileScopeModeAtom',
    hasExternalEditorAtom: 'hasExternalEditorAtom',
    externalEditorNameAtom: 'externalEditorNameAtom',
    openInExternalEditorAtom: 'openInExternalEditorAtom',
    revealInFinderAtom: 'revealInFinderAtom',
    copyFilePathAtom: 'copyFilePathAtom',
    diffPeekSizeAtom: 'diffPeekSizeAtom',
    setDiffPeekSizeAtom: 'setDiffPeekSizeAtom',
    setWorkstreamStagedFilesAtom: 'setWorkstreamStagedFilesAtom',
  };

  return {
    tokens,
    atomValues: new Map<string, any>(),
    setAtomFns: new Map<string, any>(),
    defaultSetAtom: vi.fn(),
    runtimeSidebarProps: [] as any[],
    registerSessionWorkspace: vi.fn(),
    registerWorktreePath: vi.fn(),
    loadInitialSessionFileState: vi.fn(),
  };
});

vi.mock('jotai', () => ({
  useAtom: vi.fn((atom: string) => [
    mockState.atomValues.get(atom),
    mockState.setAtomFns.get(atom) ?? mockState.defaultSetAtom,
  ]),
  useAtomValue: vi.fn((atom: string) => mockState.atomValues.get(atom)),
  useSetAtom: vi.fn((atom: string) => mockState.setAtomFns.get(atom) ?? mockState.defaultSetAtom),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    FileEditsSidebar: vi.fn((props: any) => {
      mockState.runtimeSidebarProps.push(props);
      return ReactModule.createElement(
        'div',
        {
          'data-testid': 'runtime-file-edits-sidebar',
          'data-scope-mode': props.scopeMode,
        },
        ReactModule.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'runtime-select-file',
            onClick: () => props.onSelectionChange('/workspace/src/app.ts', true),
          },
          'select file',
        ),
      );
    }),
    MaterialSymbol: ({ icon, className }: { icon: string; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, className }),
  };
});

vi.mock('../../../utils/pathUtils', () => ({
  getWorktreeNameFromPath: (path: string) => path.split('/').pop() ?? path,
}));

vi.mock('../../../store/atoms/projectState', () => ({
  diffTreeGroupByDirectoryAtom: mockState.tokens.diffTreeGroupByDirectoryAtom,
  setDiffTreeGroupByDirectoryAtom: mockState.tokens.setDiffTreeGroupByDirectoryAtom,
  agentFileScopeModeAtom: mockState.tokens.agentFileScopeModeAtom,
  setAgentFileScopeModeAtom: mockState.tokens.setAgentFileScopeModeAtom,
}));

vi.mock('../../../store/atoms/sessions', () => ({
  workstreamSessionsAtom: (workstreamId: string) => `workstreamSessions:${workstreamId}`,
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  hasExternalEditorAtom: mockState.tokens.hasExternalEditorAtom,
  externalEditorNameAtom: mockState.tokens.externalEditorNameAtom,
  openInExternalEditorAtom: mockState.tokens.openInExternalEditorAtom,
  revealInFinderAtom: mockState.tokens.revealInFinderAtom,
  copyFilePathAtom: mockState.tokens.copyFilePathAtom,
}));

vi.mock('../../../store/atoms/diffPeekSizeAtoms', () => ({
  diffPeekSizeAtom: mockState.tokens.diffPeekSizeAtom,
  setDiffPeekSizeAtom: mockState.tokens.setDiffPeekSizeAtom,
}));

vi.mock('../../../store/atoms/workstreamState', () => ({
  workstreamStagedFilesAtom: (workstreamId: string) => `workstreamStagedFiles:${workstreamId}`,
  setWorkstreamStagedFilesAtom: mockState.tokens.setWorkstreamStagedFilesAtom,
}));

vi.mock('../../../store/atoms/sessionFiles', () => ({
  workstreamSessionScopeKey: (workstreamId: string, activeSessionId: string | null | undefined) =>
    `workstreamSessionScope:${workstreamId}:${activeSessionId ?? 'none'}`,
  workstreamFileEditsAtom: (workstreamId: string) => `workstreamFileEdits:${workstreamId}`,
  workstreamFileEditsWithActiveSessionAtom: (scopeKey: string) => `workstreamFileEditsWithActiveSession:${scopeKey}`,
  workstreamGitStatusAtom: (workstreamId: string) => `workstreamGitStatus:${workstreamId}`,
  workstreamGitStatusWithActiveSessionAtom: (scopeKey: string) => `workstreamGitStatusWithActiveSession:${scopeKey}`,
  workstreamPendingReviewFilesAtom: (workstreamId: string) => `workstreamPendingReviewFiles:${workstreamId}`,
  workstreamPendingReviewFilesWithActiveSessionAtom: (scopeKey: string) => `workstreamPendingReviewFilesWithActiveSession:${scopeKey}`,
  workspaceUncommittedFilesAtom: (workspacePath: string) => `workspaceUncommittedFiles:${workspacePath}`,
  worktreeChangedFilesAtom: (worktreeId: string) => `worktreeChangedFiles:${worktreeId}`,
}));

vi.mock('../../../store/listeners/fileStateListeners', () => ({
  registerSessionWorkspace: mockState.registerSessionWorkspace,
  registerWorktreePath: mockState.registerWorktreePath,
  loadInitialSessionFileState: mockState.loadInitialSessionFileState,
}));

vi.mock('../FilesScopeDropdown', () => ({
  FilesScopeDropdown: (props: any) => (
    <button
      type="button"
      data-testid="files-scope-dropdown"
      data-file-scope-mode={props.fileScopeMode}
      onClick={() => props.onFileScopeModeChange('session-files')}
    >
      Files scope
    </button>
  ),
}));

vi.mock('../GitOperationsPanel', () => ({
  GitOperationsPanel: (props: any) => (
    <div data-testid="git-operations-panel" data-edited-count={props.editedFiles.length} />
  ),
}));

vi.mock('../TodoPanel', () => ({
  TodoPanel: ({ sessionId }: { sessionId: string }) => <div data-testid="todo-panel">{sessionId}</div>,
}));

vi.mock('../TeammatePanel', () => ({
  TeammatePanel: ({ sessionId }: { sessionId: string }) => <div data-testid="teammate-panel">{sessionId}</div>,
}));

vi.mock('../TrackerPanel', () => ({
  TrackerPanel: ({ workstreamId }: { workstreamId: string }) => <div data-testid="tracker-panel">{workstreamId}</div>,
}));

import { FilesEditedSidebar } from '../FilesEditedSidebar';

const setDiffTreeGroupByDirectory = vi.fn();
const setFileScopeMode = vi.fn();
const setWorkstreamStagedFiles = vi.fn();
const copyFilePath = vi.fn();
const revealInFinder = vi.fn();
const openInExternalEditor = vi.fn();
const setDiffPeekSize = vi.fn();

function seedDefaultAtoms() {
  mockState.atomValues.clear();
  mockState.setAtomFns.clear();
  mockState.runtimeSidebarProps.length = 0;
  mockState.defaultSetAtom.mockClear();
  mockState.registerSessionWorkspace.mockClear();
  mockState.registerWorktreePath.mockClear();
  mockState.loadInitialSessionFileState.mockClear();
  setDiffTreeGroupByDirectory.mockClear();
  setFileScopeMode.mockClear();
  setWorkstreamStagedFiles.mockClear();
  copyFilePath.mockClear();
  revealInFinder.mockClear();
  openInExternalEditor.mockClear();
  setDiffPeekSize.mockClear();

  mockState.atomValues.set(mockState.tokens.diffTreeGroupByDirectoryAtom, true);
  mockState.atomValues.set(mockState.tokens.agentFileScopeModeAtom, 'current-changes');
  mockState.atomValues.set(mockState.tokens.hasExternalEditorAtom, true);
  mockState.atomValues.set(mockState.tokens.externalEditorNameAtom, 'Cursor');
  mockState.atomValues.set(mockState.tokens.diffPeekSizeAtom, { width: 420, height: 260 });
  mockState.atomValues.set('workstreamSessions:workstream-1', ['workstream-1', 'child-a', 'child-b']);
  const activeScopeKey = 'workstreamSessionScope:workstream-1:child-a';
  mockState.atomValues.set(`workstreamFileEditsWithActiveSession:${activeScopeKey}`, [
    {
      filePath: '/workspace/src/app.ts',
      linkType: 'edited',
      operation: 'edit',
      timestamp: '2026-05-23T22:48:44.000Z',
      sessionId: 'child-a',
    },
    {
      filePath: '/workspace/src/committed.ts',
      linkType: 'edited',
      operation: 'edit',
      timestamp: '2026-05-23T22:47:44.000Z',
      sessionId: 'child-b',
    },
  ]);
  mockState.atomValues.set(`workstreamGitStatusWithActiveSession:${activeScopeKey}`, {
    'src/app.ts': { status: 'modified' },
    'src/committed.ts': { status: 'unchanged' },
  });
  mockState.atomValues.set(`workstreamPendingReviewFilesWithActiveSession:${activeScopeKey}`, new Set(['/workspace/src/app.ts']));
  mockState.atomValues.set('workspaceUncommittedFiles:/workspace', ['/workspace/src/app.ts']);
  mockState.atomValues.set('worktreeChangedFiles:__no_worktree__', []);
  mockState.atomValues.set('workstreamStagedFiles:workstream-1', []);

  mockState.setAtomFns.set(mockState.tokens.setDiffTreeGroupByDirectoryAtom, setDiffTreeGroupByDirectory);
  mockState.setAtomFns.set(mockState.tokens.setAgentFileScopeModeAtom, setFileScopeMode);
  mockState.setAtomFns.set(mockState.tokens.setWorkstreamStagedFilesAtom, setWorkstreamStagedFiles);
  mockState.setAtomFns.set(mockState.tokens.copyFilePathAtom, copyFilePath);
  mockState.setAtomFns.set(mockState.tokens.revealInFinderAtom, revealInFinder);
  mockState.setAtomFns.set(mockState.tokens.openInExternalEditorAtom, openInExternalEditor);
  mockState.setAtomFns.set(mockState.tokens.setDiffPeekSizeAtom, setDiffPeekSize);
}

describe('AgentMode FilesEditedSidebar Agent Elements shell', () => {
  beforeEach(() => {
    seedDefaultAtoms();
    (window as any).electronAPI = {
      invoke: vi.fn().mockResolvedValue({
        unifiedDiff: 'diff --git a/src/app.ts b/src/app.ts\n+const ok = true;\n',
        isBinary: false,
        source: 'session',
      }),
      history: {
        clearPendingForSession: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    vi.clearAllMocks();
  });

  it('renders the Electron Files Edited shell while preserving runtime props and regular-session callbacks', async () => {
    const onFileClick = vi.fn();

    render(
      <FilesEditedSidebar
        workstreamId="workstream-1"
        activeSessionId="child-a"
        workspacePath="/workspace"
        onFileClick={onFileClick}
        isGitRepo
      />,
    );

    const shell = screen.getByTestId('agent-elements-agent-mode-files-edited-sidebar');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'agent-mode-files-edited');
    expect(shell).toHaveAttribute('data-component', 'FilesEditedSidebar');
    expect(shell).toHaveClass('agent-elements-files-edited-agent-mode');
    expect(screen.getByTestId('agent-elements-files-edited-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'files-edited-header',
    );
    expect(screen.getByTestId('agent-elements-files-edited-content')).toHaveAttribute(
      'data-agent-elements-shell',
      'files-edited-content',
    );

    expect(mockState.registerSessionWorkspace).toHaveBeenCalledWith('workstream-1', '/workspace');
    expect(mockState.loadInitialSessionFileState).toHaveBeenCalledWith('workstream-1', '/workspace');
    expect(mockState.loadInitialSessionFileState).toHaveBeenCalledWith('child-a', '/workspace');
    expect(mockState.loadInitialSessionFileState).toHaveBeenCalledWith('child-b', '/workspace');

    const runtimeProps = mockState.runtimeSidebarProps.at(-1);
    expect(runtimeProps.fileEdits.map((edit: any) => edit.filePath)).toEqual(['/workspace/src/app.ts']);
    expect(runtimeProps.pendingReviewFiles.has('/workspace/src/app.ts')).toBe(true);
    expect(runtimeProps.groupByDirectory).toBe(true);
    expect(runtimeProps.externalEditorName).toBe('Cursor');
    expect(runtimeProps.showCheckboxes).toBe(true);
    expect(runtimeProps.scopeMode).toBe('current-changes');
    expect(runtimeProps.diffPeekWidth).toBe(420);
    expect(runtimeProps.diffPeekHeight).toBe(260);

    fireEvent.click(screen.getByTestId('runtime-select-file'));
    expect(setWorkstreamStagedFiles).toHaveBeenCalledWith({
      workstreamId: 'workstream-1',
      files: ['/workspace/src/app.ts'],
    });

    const diff = await runtimeProps.onGetDiff('/workspace/src/app.ts');
    expect(diff).toEqual({
      unifiedDiff: 'diff --git a/src/app.ts b/src/app.ts\n+const ok = true;\n',
      isBinary: false,
    });
    expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
      'session:file-diff',
      '/workspace',
      'child-a',
      '/workspace/src/app.ts',
    );
  });

  it('keeps the pending-review Keep All action visible and clears every workstream session', async () => {
    render(
      <FilesEditedSidebar
        workstreamId="workstream-1"
        activeSessionId="child-a"
        workspacePath="/workspace"
        onFileClick={() => {}}
        isGitRepo={false}
      />,
    );

    const banner = screen.getByTestId('agent-elements-files-edited-review-banner');
    expect(banner).toHaveAttribute('data-agent-elements-shell', 'files-edited-review-banner');
    expect(banner).toHaveClass('agent-elements-edit-approval');
    expect(screen.getByTestId('agent-elements-files-edited-review-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: /keep all/i }));

    await waitFor(() => {
      expect((window as any).electronAPI.history.clearPendingForSession).toHaveBeenCalledWith(
        '/workspace',
        'workstream-1',
      );
      expect((window as any).electronAPI.history.clearPendingForSession).toHaveBeenCalledWith(
        '/workspace',
        'child-a',
      );
      expect((window as any).electronAPI.history.clearPendingForSession).toHaveBeenCalledWith(
        '/workspace',
        'child-b',
      );
    });
  });

  it('preserves worktree staging callbacks while applying the Agent Elements shell', async () => {
    mockState.atomValues.set(mockState.tokens.agentFileScopeModeAtom, 'all-changes');
    mockState.atomValues.set('workspaceUncommittedFiles:/worktree', []);
    mockState.atomValues.set('worktreeChangedFiles:wt-1', [
      { path: 'src/worktree.ts', status: 'modified', staged: false },
    ]);
    mockState.atomValues.set('workstreamFileEditsWithActiveSession:workstreamSessionScope:workstream-1:child-a', []);
    mockState.atomValues.set('workstreamGitStatusWithActiveSession:workstreamSessionScope:workstream-1:child-a', {});

    render(
      <FilesEditedSidebar
        workstreamId="workstream-1"
        activeSessionId="child-a"
        workspacePath="/workspace"
        worktreeId="wt-1"
        worktreePath="/worktree"
        onFileClick={() => {}}
        isGitRepo
      />,
    );

    expect(screen.getByTestId('agent-elements-agent-mode-files-edited-sidebar')).toHaveAttribute(
      'data-agent-elements-shell',
      'agent-mode-files-edited',
    );
    expect(mockState.registerWorktreePath).toHaveBeenCalledWith('wt-1', '/worktree');

    const runtimeProps = mockState.runtimeSidebarProps.at(-1);
    expect(runtimeProps.fileEdits.map((edit: any) => edit.filePath)).toEqual(['/worktree/src/worktree.ts']);

    runtimeProps.onSelectionChange('/worktree/src/worktree.ts', true);

    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
        'worktree:stage-file',
        '/worktree',
        'src/worktree.ts',
        true,
      );
    });
  });
});
