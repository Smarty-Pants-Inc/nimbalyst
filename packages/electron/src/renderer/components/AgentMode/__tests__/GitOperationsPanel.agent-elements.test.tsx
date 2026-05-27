// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => {
  const tokens = {
    gitStatusAtom: 'gitStatusAtom',
    gitCommitsAtom: 'gitCommitsAtom',
    isCommittingAtom: 'isCommittingAtom',
    worktreeRefreshCounterAtom: (worktreeId: string) => `worktreeRefreshCounter:${worktreeId}`,
    workstreamStagedFilesAtom: (workstreamId: string) => `workstreamStagedFiles:${workstreamId}`,
    workstreamCommitMessageAtom: (workstreamId: string) => `workstreamCommitMessage:${workstreamId}`,
    workstreamChildrenAtom: (workstreamId: string) => `workstreamChildren:${workstreamId}`,
    worktreeChangedFilesAtom: (worktreeId: string) => `worktreeChangedFiles:${worktreeId}`,
    setWorkstreamStagedFilesAtom: 'setWorkstreamStagedFilesAtom',
    setWorkstreamCommitMessageAtom: 'setWorkstreamCommitMessageAtom',
    clearWorkstreamGitStateAtom: 'clearWorkstreamGitStateAtom',
    defaultAgentModelAtom: 'defaultAgentModelAtom',
  };

  return {
    tokens,
    atomValues: new Map<string, any>(),
    setAtomFns: new Map<string, any>(),
    defaultSetAtom: vi.fn(),
    refreshWorktreeChangedFiles: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => mockState.atomValues.get(atom)),
  useSetAtom: vi.fn((atom: string) => mockState.setAtomFns.get(atom) ?? mockState.defaultSetAtom),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
      ...props
    }: {
      icon: string;
      size?: number;
      className?: string;
    } & React.HTMLAttributes<HTMLSpanElement>) => (
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className, ...props }, icon)
    ),
  };
});

vi.mock('@nimbalyst/runtime/ai/server/types', () => ({
  ModelIdentifier: {
    tryParse: vi.fn((modelId: string) => ({
      provider: modelId.split(':')[0],
    })),
  },
}));

vi.mock('../../../help', () => ({
  HelpTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../store/atoms/gitOperations', () => ({
  gitStatusAtom: mockState.tokens.gitStatusAtom,
  gitCommitsAtom: mockState.tokens.gitCommitsAtom,
  isCommittingAtom: mockState.tokens.isCommittingAtom,
  worktreeRefreshCounterAtom: mockState.tokens.worktreeRefreshCounterAtom,
}));

vi.mock('../../../store/atoms/workstreamState', () => ({
  workstreamStagedFilesAtom: mockState.tokens.workstreamStagedFilesAtom,
  workstreamCommitMessageAtom: mockState.tokens.workstreamCommitMessageAtom,
  workstreamChildrenAtom: mockState.tokens.workstreamChildrenAtom,
  setWorkstreamStagedFilesAtom: mockState.tokens.setWorkstreamStagedFilesAtom,
  setWorkstreamCommitMessageAtom: mockState.tokens.setWorkstreamCommitMessageAtom,
  clearWorkstreamGitStateAtom: mockState.tokens.clearWorkstreamGitStateAtom,
}));

vi.mock('../../../store/atoms/sessionFiles', () => ({
  worktreeChangedFilesAtom: mockState.tokens.worktreeChangedFilesAtom,
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  defaultAgentModelAtom: mockState.tokens.defaultAgentModelAtom,
}));

vi.mock('../../../store/listeners/fileStateListeners', () => ({
  refreshWorktreeChangedFiles: mockState.refreshWorktreeChangedFiles,
}));

vi.mock('../SuperFilesPanel', () => ({
  SuperFilesPanel: ({ worktreeId }: { worktreeId: string }) => (
    <section data-testid="agent-elements-super-files-panel">{worktreeId}</section>
  ),
}));

import { GitOperationsPanel } from '../GitOperationsPanel';

const sourcePath = resolve(__dirname, '../GitOperationsPanel.tsx');
const setGitStatus = vi.fn();
const setGitCommits = vi.fn();
const setIsCommitting = vi.fn();
const setWorkstreamStagedFiles = vi.fn();
const setWorkstreamCommitMessage = vi.fn();
const clearWorkstreamGitState = vi.fn();
const unsubscribeGitStatus = vi.fn();
const unsubscribeCommitDetected = vi.fn();
let electronInvoke: ReturnType<typeof vi.fn>;

function seedAtoms({
  worktreeId,
}: {
  worktreeId?: string;
} = {}) {
  mockState.atomValues.clear();
  mockState.setAtomFns.clear();
  mockState.defaultSetAtom.mockClear();
  mockState.refreshWorktreeChangedFiles.mockClear();
  setGitStatus.mockClear();
  setGitCommits.mockClear();
  setIsCommitting.mockClear();
  setWorkstreamStagedFiles.mockClear();
  setWorkstreamCommitMessage.mockClear();
  clearWorkstreamGitState.mockClear();

  mockState.atomValues.set(mockState.tokens.gitStatusAtom, {
    branch: 'main',
    ahead: 2,
    behind: 1,
    hasUncommitted: true,
  });
  mockState.atomValues.set(mockState.tokens.gitCommitsAtom, [
    {
      hash: 'abcdef1234567890',
      message: 'Ship current workspace',
      author: 'Paul',
      date: '2026-05-24T20:10:00.000Z',
    },
  ]);
  mockState.atomValues.set(mockState.tokens.isCommittingAtom, false);
  mockState.atomValues.set(mockState.tokens.workstreamStagedFilesAtom('workstream-1'), ['src/app.ts']);
  mockState.atomValues.set(mockState.tokens.workstreamCommitMessageAtom('workstream-1'), 'Ship agent UX');
  mockState.atomValues.set(mockState.tokens.workstreamChildrenAtom('workstream-1'), ['workstream-1', 'child-a']);
  mockState.atomValues.set(mockState.tokens.defaultAgentModelAtom, 'openai-codex:gpt-5.5');
  mockState.atomValues.set(mockState.tokens.worktreeRefreshCounterAtom(worktreeId ?? ''), 0);
  mockState.atomValues.set(mockState.tokens.worktreeChangedFilesAtom(worktreeId ?? '__no_worktree__'), worktreeId ? [
    { path: 'src/worktree.ts', status: 'modified', staged: true },
    { path: 'src/untracked.ts', status: 'added', staged: false },
  ] : []);

  mockState.setAtomFns.set(mockState.tokens.gitStatusAtom, setGitStatus);
  mockState.setAtomFns.set(mockState.tokens.gitCommitsAtom, setGitCommits);
  mockState.setAtomFns.set(mockState.tokens.isCommittingAtom, setIsCommitting);
  mockState.setAtomFns.set(mockState.tokens.setWorkstreamStagedFilesAtom, setWorkstreamStagedFiles);
  mockState.setAtomFns.set(mockState.tokens.setWorkstreamCommitMessageAtom, setWorkstreamCommitMessage);
  mockState.setAtomFns.set(mockState.tokens.clearWorkstreamGitStateAtom, clearWorkstreamGitState);
}

function installElectronApi() {
  electronInvoke = vi.fn(async (channel: string) => {
    if (channel === 'git:status') {
      return { branch: 'main', ahead: 2, behind: 1, hasUncommitted: true };
    }
    if (channel === 'git:log') {
      return [
        {
          hash: 'abcdef1234567890',
          message: 'Ship current workspace',
          author: 'Paul',
          date: '2026-05-24T20:10:00.000Z',
        },
      ];
    }
    if (channel === 'git:commit') {
      return { success: true, commitHash: 'abc1234' };
    }
    if (channel === 'worktree:get-commits') {
      return {
        success: true,
        commits: [
          {
            hash: '1111111111111111',
            shortHash: '1111111',
            message: 'First worktree commit',
            author: 'Paul',
            date: '2026-05-24T20:00:00.000Z',
            files: ['src/worktree.ts'],
          },
          {
            hash: '2222222222222222',
            shortHash: '2222222',
            message: 'Second worktree commit',
            author: 'Paul',
            date: '2026-05-24T20:05:00.000Z',
            files: ['src/worktree.ts'],
            hasEquivalentOnBase: true,
          },
        ],
      };
    }
    if (channel === 'worktree:get-repo-current-branch') {
      return { success: true, branch: 'main' };
    }
    return { success: true };
  });

  (window as any).electronAPI = {
    invoke: electronInvoke,
    git: {
      onStatusChanged: vi.fn(() => unsubscribeGitStatus),
      onCommitDetected: vi.fn(() => unsubscribeCommitDetected),
    },
    worktreeGetStatus: vi.fn().mockResolvedValue({
      success: true,
      status: {
        commitsBehind: 2,
        isMerged: false,
        uniqueCommitsAhead: 1,
        hasUncommittedChanges: true,
      },
    }),
    worktreeGetByPath: vi.fn().mockResolvedValue({
      success: true,
      worktree: { name: 'feature-agent', displayName: 'feature-agent' },
    }),
    worktreeRebase: vi.fn().mockResolvedValue({ success: true }),
    worktreeArchive: vi.fn().mockResolvedValue({ success: true }),
    aiGetModels: vi.fn().mockResolvedValue({ success: true, grouped: {} }),
    aiCreateSession: vi.fn().mockResolvedValue({ id: 'session-new' }),
    aiLoadSession: vi.fn().mockResolvedValue({ id: 'session-new' }),
  };
}

function installIntersectionObserver() {
  const MockIntersectionObserver = vi.fn(function (
    this: { observe: () => void; disconnect: () => void },
    callback: IntersectionObserverCallback,
  ) {
    this.observe = () => {
      callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    };
    this.disconnect = vi.fn();
  });

  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof GitOperationsPanel>> = {}) {
  render(
    <GitOperationsPanel
      workspacePath="/workspace"
      workstreamId="workstream-1"
      sessionId="session-1"
      editedFiles={['src/app.ts']}
      {...overrides}
    />,
  );
}

describe('AgentMode GitOperationsPanel Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installElectronApi();
    installIntersectionObserver();
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    delete (globalThis as any).IntersectionObserver;
  });

  it('renders workspace git controls in Agent Elements chrome while preserving manual commit behavior', async () => {
    seedAtoms();
    renderPanel();

    const root = screen.getByTestId('agent-elements-git-operations-panel');
    expect(root).toHaveClass('git-operations-panel', 'agent-elements-git-operations-panel');
    expect(root).toHaveAttribute('data-component', 'GitOperationsPanel');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'git-operations-panel');
    expect(root).toHaveAttribute('data-mode', 'workspace');
    expect(root).toHaveTextContent('main');
    expect(root).toHaveTextContent('↑2');
    expect(root).toHaveTextContent('↓1');

    const headerToggle = screen.getByTestId('agent-elements-git-operations-header-toggle');
    expect(headerToggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(headerToggle).getAllByText(/^(expand_more|account_tree)$/)).toHaveLength(2);

    const modeToggle = screen.getByTestId('git-commit-mode-toggle');
    expect(modeToggle).toHaveClass('agent-elements-git-operations-mode-toggle');
    expect(modeToggle).toHaveAttribute('data-agent-elements-shell', 'git-operations-mode-toggle');
    const smartMode = screen.getByTestId('git-operations-smart-mode');
    expect(smartMode).toHaveClass('agent-elements-git-operations-smart-mode');
    expect(smartMode).toHaveAttribute('data-agent-elements-shell', 'git-operations-smart-mode');
    expect(smartMode).toHaveTextContent('Commit with AI');

    within(root).getAllByText(/^(expand_more|account_tree|auto_awesome)$/).forEach((icon) => {
      expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    await waitFor(() => expect(electronInvoke).toHaveBeenCalledWith('git:log', '/workspace', 10));
    electronInvoke.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Manual commit message' }));
    const manualMode = screen.getByTestId('git-operations-manual-mode');
    expect(manualMode).toHaveClass('agent-elements-git-operations-manual-mode');
    expect(manualMode).toHaveAttribute('data-agent-elements-shell', 'git-operations-manual-mode');
    expect(screen.getByDisplayValue('Ship agent UX')).toHaveClass('agent-elements-git-operations-textarea');

    fireEvent.click(screen.getByRole('button', { name: 'Commit (1)' }));
    await waitFor(() => {
      expect(electronInvoke).toHaveBeenCalledWith('git:commit', '/workspace', 'Ship agent UX', ['src/app.ts']);
    });
  });

  it('renders worktree commit, rebase, merge, commit-list, and refresh controls in Agent Elements chrome', async () => {
    seedAtoms({ worktreeId: 'wt-1' });
    renderPanel({
      worktreeId: 'wt-1',
      worktreePath: '/workspace/.worktrees/feature-agent',
      onFileClick: vi.fn(),
    });

    const root = screen.getByTestId('agent-elements-git-operations-panel');
    expect(root).toHaveAttribute('data-mode', 'worktree');

    await waitFor(() => expect(root).toHaveTextContent('worktree/feature-agent'));
    expect(screen.getByTestId('agent-elements-git-operations-worktree-section')).toHaveTextContent('Commit & Sync');
    expect(screen.getByTestId('agent-elements-git-operations-worktree-status')).toHaveTextContent('2 commits behind main');
    expect(screen.getByTestId('agent-elements-git-operations-worktree-commit')).toHaveTextContent('Commit (1)');
    expect(screen.getByTestId('agent-elements-git-operations-worktree-rebase')).toHaveTextContent('Rebase (2)');
    expect(screen.getByTestId('agent-elements-git-operations-worktree-merge')).toHaveTextContent('Merge to main');

    await waitFor(() => expect(screen.getByTestId('agent-elements-git-operations-worktree-commits')).toHaveTextContent('First worktree commit'));
    expect(screen.getByTestId('agent-elements-git-operations-worktree-commits')).toHaveTextContent('1 unique / 2 total');
    expect(screen.getByTestId('agent-elements-super-files-panel')).toHaveTextContent('wt-1');
    expect(screen.getByRole('checkbox', { name: 'Select commit 1111111: First worktree commit for squashing' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Select commit 2222222: Second worktree commit for squashing' })).toBeEnabled();

    fireEvent.click(screen.getByTestId('agent-elements-git-operations-refresh'));
    await waitFor(() => {
      expect(mockState.refreshWorktreeChangedFiles).toHaveBeenCalledWith('wt-1', '/workspace/.worktrees/feature-agent');
    });

    within(root).getAllByText(/^(expand_more|account_tree|refresh|warning|check|sync|merge)$/).forEach((icon) => {
      expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
    });
  });

  it('keeps GitOperationsPanel source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-git-operations-panel');
    expect(source).toContain('data-agent-elements-shell="git-operations-panel"');
    expect(source).toContain('data-testid="agent-elements-git-operations-panel"');
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/bg-gradient|text-white|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale|backdrop-blur/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
  });
});
