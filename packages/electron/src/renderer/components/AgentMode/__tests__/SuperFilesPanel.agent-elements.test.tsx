// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuperFilesPanel } from '../SuperFilesPanel';

const mockState = vi.hoisted(() => {
  const tokens = {
    superProgressAtom: (loopId: string) => `superProgress:${loopId}`,
    setSuperProgressAtom: 'setSuperProgressAtom',
  };

  return {
    tokens,
    atomValues: new Map<string, any>(),
    setAtomFns: new Map<string, any>(),
    defaultSetAtom: vi.fn(),
    setProgress: vi.fn(),
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

vi.mock('../../../store/atoms/superLoop', () => ({
  superProgressAtom: mockState.tokens.superProgressAtom,
  setSuperProgressAtom: mockState.tokens.setSuperProgressAtom,
}));

const sourcePath = resolve(__dirname, '../SuperFilesPanel.tsx');

const loop = {
  id: 'loop-1',
  worktreeId: 'worktree-1',
  taskDescription: 'Make the agent panel beautiful',
  title: 'Agent UX polish',
  status: 'running',
  currentIteration: 2,
  maxIterations: 5,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const progress = {
  phase: 'building',
  status: 'running',
  completionSignal: false,
  currentIteration: 3,
  blockers: ['Approval proof is still pending'],
  learnings: [
    { iteration: 1, summary: 'Rider is authoritative', filesChanged: ['docs/rider.md'] },
    { iteration: 2, summary: 'Agent Elements source is pinned', filesChanged: ['docs/source.md'] },
    { iteration: 3, summary: 'Super files should not look like raw JSON', filesChanged: ['SuperFilesPanel.tsx'] },
    { iteration: 4, summary: 'Debug payload belongs behind disclosure', filesChanged: ['SuperFilesPanel.tsx'] },
  ],
};

function seedSuperFilesPanel({ cachedProgress = progress }: { cachedProgress?: any } = {}) {
  mockState.atomValues.clear();
  mockState.setAtomFns.clear();
  mockState.defaultSetAtom.mockClear();
  mockState.setProgress.mockClear();
  mockState.atomValues.set(mockState.tokens.superProgressAtom(loop.id), cachedProgress);
  mockState.setAtomFns.set(mockState.tokens.setSuperProgressAtom, mockState.setProgress);
}

function setElectronInvoke(handler: (channel: string, ...args: any[]) => Promise<any>) {
  (window as any).electronAPI = {
    invoke: vi.fn(handler),
  };
}

describe('AgentMode SuperFilesPanel Agent Elements shell', () => {
  beforeEach(() => {
    seedSuperFilesPanel();
    setElectronInvoke(async (channel: string) => {
      if (channel === 'super-loop:get-by-worktree') {
        return { success: true, loop };
      }
      if (channel === 'super-loop:get-progress') {
        return { success: true, progress };
      }
      throw new Error(`unexpected channel ${channel}`);
    });
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    vi.clearAllMocks();
  });

  it('does not render while loading or when no super loop exists for the worktree', async () => {
    setElectronInvoke(async () => ({ success: true, loop: null }));

    const { container } = render(
      <SuperFilesPanel worktreeId="worktree-1" worktreePath="/workspace" onFileClick={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('super-loop:get-by-worktree', 'worktree-1');
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('wraps loop progress in Agent Elements chrome while preserving cached progress semantics', async () => {
    render(
      <SuperFilesPanel worktreeId="worktree-1" worktreePath="/workspace" onFileClick={vi.fn()} />,
    );

    const panel = await screen.findByTestId('agent-elements-super-files-panel');
    expect(panel).toHaveClass('super-files-panel', 'agent-elements-super-files-panel');
    expect(panel).toHaveAttribute('data-component', 'SuperFilesPanel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'super-files-panel');
    expect(panel).toHaveAttribute('data-loop-id', 'loop-1');
    expect(panel).toHaveAttribute('data-worktree-id', 'worktree-1');
    expect(panel).toHaveAttribute('data-phase', 'building');
    expect(panel).toHaveAttribute('data-blocker-count', '1');

    const header = screen.getByTestId('agent-elements-super-files-header');
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('agent-elements-super-files-phase')).toHaveClass('agent-elements-status-pill');
    expect(screen.getByTestId('agent-elements-super-files-iteration')).toHaveTextContent('3/5');

    const content = screen.getByTestId('agent-elements-super-files-content');
    expect(content).toHaveAttribute('data-agent-elements-shell', 'super-files-content');
    expect(within(content).getByText('Approval proof is still pending')).toBeInTheDocument();
    const recentList = screen.getByTestId('agent-elements-super-files-recent-list');
    expect(within(recentList).getByText('Debug payload belongs behind disclosure')).toBeInTheDocument();
    expect(within(recentList).getByText('Super files should not look like raw JSON')).toBeInTheDocument();
    expect(within(recentList).queryByText('Rider is authoritative')).not.toBeInTheDocument();

    expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('super-loop:get-by-worktree', 'worktree-1');
    expect((window as any).electronAPI.invoke).not.toHaveBeenCalledWith('super-loop:get-progress', 'loop-1');
  });

  it('preserves collapse, progress fetch, and .superloop file click behavior', async () => {
    seedSuperFilesPanel({ cachedProgress: null });
    const onFileClick = vi.fn();

    render(
      <SuperFilesPanel worktreeId="worktree-1" worktreePath="/workspace" onFileClick={onFileClick} />,
    );

    const header = await screen.findByTestId('agent-elements-super-files-header');

    await waitFor(() => {
      expect(mockState.setProgress).toHaveBeenCalledWith({ loopId: 'loop-1', progress });
    });

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('agent-elements-super-files-content')).not.toBeInTheDocument();

    fireEvent.click(header);
    fireEvent.click(screen.getByTestId('agent-elements-super-file-link-progress-json'));

    expect(onFileClick).toHaveBeenCalledWith('/workspace/.superloop/progress.json');
  });

  it('keeps SuperFilesPanel source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-super-files-panel');
    expect(source).toContain('data-agent-elements-shell="super-files-panel"');
    expect(source).toContain('agent-elements-status-pill');
    expect(source).toContain('Debug payload');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
