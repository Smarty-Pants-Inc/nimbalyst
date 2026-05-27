// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchiveProgress } from '../ArchiveProgress';

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      className,
    }: {
      icon: string;
      className?: string;
    }) => ReactModule.createElement('span', { className, 'data-icon': icon }, icon),
  };
});

type ArchiveTask = {
  worktreeId: string;
  worktreeName: string;
  status: 'queued' | 'pending' | 'removing-worktree' | 'completed' | 'failed';
  startTime: Date;
  error?: string;
};

const archiveProgressSourcePath = resolve(__dirname, '../ArchiveProgress.tsx');

let progressHandler: ((tasks: ArchiveTask[]) => void) | null;
let unsubscribe: ReturnType<typeof vi.fn>;

const initialTasks: ArchiveTask[] = [
  {
    worktreeId: 'worktree-active',
    worktreeName: 'Agent Elements polish',
    status: 'removing-worktree',
    startTime: new Date('2026-05-26T15:15:00Z'),
  },
  {
    worktreeId: 'worktree-failed',
    worktreeName: 'Failed archive',
    status: 'failed',
    startTime: new Date('2026-05-26T15:16:00Z'),
    error: 'Permission denied',
  },
];

function installArchiveApi(tasks: ArchiveTask[] = initialTasks) {
  progressHandler = null;
  unsubscribe = vi.fn();

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      archive: {
        getTasks: vi.fn().mockResolvedValue({ success: true, tasks }),
        onProgress: vi.fn((handler: (nextTasks: ArchiveTask[]) => void) => {
          progressHandler = handler;
          return unsubscribe;
        }),
      },
    },
  });
}

describe('ArchiveProgress Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installArchiveApi();
  });

  it('renders an Agent Elements archive progress shell while preserving expand and task states', async () => {
    render(<ArchiveProgress />);

    const root = await screen.findByTestId('agent-elements-archive-progress');
    expect(root).toHaveClass('archive-progress', 'agent-elements-archive-progress');
    expect(root).toHaveAttribute('data-component', 'ArchiveProgress');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'archive-progress');

    const header = screen.getByTestId('agent-elements-archive-progress-header');
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(header).toHaveTextContent('1 active');

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');

    const warning = screen.getByTestId('agent-elements-archive-progress-warning');
    expect(warning).toHaveAttribute('data-agent-elements-shell', 'archive-progress-warning');
    expect(warning.className).toContain('--agent-elements-card-inline-padding');
    expect(warning).not.toHaveClass('border-l-[3px]');

    const activeTask = screen.getByTestId('agent-elements-archive-task-worktree-active');
    expect(activeTask).toHaveClass('archive-task', 'agent-elements-archive-task', 'agent-elements-tool-card');
    expect(activeTask).toHaveAttribute('data-archive-status', 'removing-worktree');
    expect(within(activeTask).getByText('Removing worktree (this may take a while)...')).toBeInTheDocument();

    const failedTask = screen.getByTestId('agent-elements-archive-task-worktree-failed');
    expect(failedTask).toHaveAttribute('data-archive-status', 'failed');
    expect(within(failedTask).getByText('Permission denied')).toBeInTheDocument();
  });

  it('preserves progress subscription, completion notification, and cleanup behavior', async () => {
    const onWorktreeArchived = vi.fn();
    const { unmount } = render(<ArchiveProgress onWorktreeArchived={onWorktreeArchived} />);

    await screen.findByTestId('agent-elements-archive-progress');
    expect(window.electronAPI.archive.getTasks).toHaveBeenCalledTimes(1);
    expect(window.electronAPI.archive.onProgress).toHaveBeenCalledTimes(1);
    expect(progressHandler).toBeTypeOf('function');

    await act(async () => {
      progressHandler?.([
        {
          worktreeId: 'worktree-active',
          worktreeName: 'Agent Elements polish',
          status: 'completed',
          startTime: new Date('2026-05-26T15:15:00Z'),
        },
      ]);
    });

    await waitFor(() => {
      expect(onWorktreeArchived).toHaveBeenCalledWith('worktree-active');
    });

    await act(async () => {
      progressHandler?.([
        {
          worktreeId: 'worktree-active',
          worktreeName: 'Agent Elements polish',
          status: 'completed',
          startTime: new Date('2026-05-26T15:15:00Z'),
        },
      ]);
    });

    expect(onWorktreeArchived).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('does not render when the archive API is unavailable or when there are no tasks', async () => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {},
    });
    const unavailable = render(<ArchiveProgress />);
    expect(unavailable.queryByTestId('agent-elements-archive-progress')).not.toBeInTheDocument();
    unavailable.unmount();

    installArchiveApi([]);
    const empty = render(<ArchiveProgress />);
    await waitFor(() => {
      expect(window.electronAPI.archive.getTasks).toHaveBeenCalled();
    });
    expect(empty.queryByTestId('agent-elements-archive-progress')).not.toBeInTheDocument();
  });

  it('keeps ArchiveProgress source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(archiveProgressSourcePath, 'utf8');

    expect(source).toContain('agent-elements-archive-progress');
    expect(source).toContain('agent-elements-archive-task');
    expect(source).toContain('data-agent-elements-shell="archive-progress"');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--an-warning-color');
    expect(source).not.toMatch(/var\(--nim-[^)]+\)|bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|transition-all/);
    expect(source).not.toMatch(/rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b|text-white|bg-white|bg-black/);
    expect(source).not.toMatch(/border-l-\[[23456789]px\]|border-left:\s*[23456789]px/);
  });
});
