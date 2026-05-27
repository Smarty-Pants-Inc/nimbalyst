// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchiveWorktreeDialog } from '../ArchiveWorktreeDialog';

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
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }, icon),
  };
});

const sourcePath = resolve(__dirname, '../ArchiveWorktreeDialog.tsx');

function renderDialog(overrides: Partial<React.ComponentProps<typeof ArchiveWorktreeDialog>> = {}) {
  const onArchive = vi.fn();
  const onKeep = vi.fn();
  const result = render(
    <ArchiveWorktreeDialog
      worktreeName="feature-agent-elements"
      onArchive={onArchive}
      onKeep={onKeep}
      contextMessage="Merge successful."
      hasUncommittedChanges
      uncommittedFileCount={2}
      hasUnmergedChanges
      unmergedCommitCount={1}
      {...overrides}
    />,
  );

  return { onArchive, onKeep, ...result };
}

describe('ArchiveWorktreeDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders singular Agent Elements archive dialog chrome while preserving copy, warnings, and actions', () => {
    const { onArchive, onKeep } = renderDialog();

    const overlay = screen.getByTestId('agent-elements-archive-worktree-overlay');
    expect(overlay).toHaveClass('archive-worktree-dialog-overlay', 'agent-elements-agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-agent-elements-shell', 'agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-component', 'ArchiveWorktreeDialog');

    const dialog = screen.getByTestId('agent-elements-archive-worktree-dialog');
    expect(dialog).toHaveClass('archive-worktree-dialog', 'agent-elements-archive-worktree-dialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'archive-worktree-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    expect(within(dialog).getByRole('heading', { name: 'Archive Worktree' })).toBeInTheDocument();
    expect(within(dialog).getByText('feature-agent-elements')).toBeInTheDocument();
    expect(within(dialog).getByText(/Merge successful/)).toBeInTheDocument();

    const warnings = screen.getAllByTestId('agent-elements-archive-worktree-warning');
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toHaveTextContent('Uncommitted changes will be lost');
    expect(warnings[0]).toHaveTextContent('2 files');
    expect(warnings[1]).toHaveTextContent('Unmerged commits will be lost');
    expect(warnings[1]).toHaveTextContent("This branch has 1 commit that hasn't been merged");

    expect(screen.getByTestId('agent-elements-archive-worktree-info')).toHaveTextContent(
      'remove the worktree from disk',
    );

    within(dialog).getAllByText(/^(archive|warning)$/).forEach((icon) => {
      expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep Worktree' }));
    expect(onKeep).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: /^Archive$/ }));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('renders bulk archive copy and count-aware warnings without changing callback behavior', () => {
    const { onArchive, onKeep } = renderDialog({
      worktreeName: undefined,
      worktreeCount: 3,
      contextMessage: undefined,
      uncommittedFileCount: 5,
      uncommittedWorktreeCount: 2,
      unmergedCommitCount: 4,
      unmergedWorktreeCount: 1,
    });

    const dialog = screen.getByTestId('agent-elements-archive-worktree-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Archive 3 Worktrees' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Are you sure you want to archive 3 worktrees?');
    expect(screen.getAllByTestId('agent-elements-archive-worktree-warning')[0]).toHaveTextContent(
      '2 worktrees have uncommitted changes (5 files total)',
    );
    expect(screen.getAllByTestId('agent-elements-archive-worktree-warning')[1]).toHaveTextContent(
      '1 worktree has unmerged commits (4 commits total)',
    );
    expect(screen.getByTestId('agent-elements-archive-worktree-info')).toHaveTextContent(
      'remove all worktrees from disk',
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onKeep).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: /Archive All/ }));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('preserves overlay keep, dialog click stop-propagation, Escape keep, and optional warning branches', () => {
    const { onKeep } = renderDialog({
      hasUncommittedChanges: false,
      hasUnmergedChanges: false,
    });

    expect(screen.queryByTestId('agent-elements-archive-worktree-warning')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('agent-elements-archive-worktree-dialog'));
    expect(onKeep).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('agent-elements-archive-worktree-overlay'));
    expect(onKeep).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onKeep).toHaveBeenCalledTimes(2);
  });

  it('keeps ArchiveWorktreeDialog source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-archive-worktree-dialog');
    expect(source).toContain('data-agent-elements-shell="archive-worktree-dialog"');
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toMatch(/nim-overlay|nim-modal|nim-btn-|nim-input/);
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale|backdrop-blur/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
