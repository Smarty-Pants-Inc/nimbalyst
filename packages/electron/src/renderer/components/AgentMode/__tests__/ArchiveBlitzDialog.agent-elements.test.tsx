// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchiveBlitzDialog } from '../ArchiveBlitzDialog';

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

const sourcePath = resolve(__dirname, '../ArchiveBlitzDialog.tsx');

function renderDialog() {
  const onArchiveBlitz = vi.fn();
  const onArchiveWorktreeOnly = vi.fn();
  const onKeep = vi.fn();
  const result = render(
    <ArchiveBlitzDialog
      blitzName="Launch Prep"
      worktreeName="feature-agent-elements"
      onArchiveBlitz={onArchiveBlitz}
      onArchiveWorktreeOnly={onArchiveWorktreeOnly}
      onKeep={onKeep}
    />,
  );

  return { onArchiveBlitz, onArchiveWorktreeOnly, onKeep, ...result };
}

describe('ArchiveBlitzDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Agent Elements archive dialog chrome while preserving copy and actions', () => {
    const { onArchiveBlitz, onArchiveWorktreeOnly, onKeep } = renderDialog();

    const overlay = screen.getByTestId('agent-elements-archive-blitz-overlay');
    expect(overlay).toHaveClass('archive-worktree-dialog-overlay', 'agent-elements-agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-agent-elements-shell', 'agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-component', 'ArchiveBlitzDialog');

    const dialog = screen.getByTestId('agent-elements-archive-blitz-dialog');
    expect(dialog).toHaveClass('archive-worktree-dialog', 'agent-elements-archive-blitz-dialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'archive-blitz-dialog');
    expect(dialog).toHaveFocus();
    expect(within(dialog).getByRole('heading', { name: 'Merge Successful' })).toBeInTheDocument();
    expect(within(dialog).getByText('feature-agent-elements')).toBeInTheDocument();
    expect(within(dialog).getByText('Launch Prep')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-archive-blitz-success')).toHaveTextContent(
      'have been merged successfully',
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep All' }));
    expect(onKeep).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: /Archive Worktree Only/ }));
    expect(onArchiveWorktreeOnly).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: /Archive Blitz/ }));
    expect(onArchiveBlitz).toHaveBeenCalledTimes(1);
  });

  it('preserves overlay keep, dialog click stop-propagation, and Escape keep behavior', () => {
    const { onKeep } = renderDialog();

    fireEvent.click(screen.getByTestId('agent-elements-archive-blitz-dialog'));
    expect(onKeep).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('agent-elements-archive-blitz-overlay'));
    expect(onKeep).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onKeep).toHaveBeenCalledTimes(2);
  });

  it('keeps ArchiveBlitzDialog source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-archive-blitz-dialog');
    expect(source).toContain('data-agent-elements-shell="archive-blitz-dialog"');
    expect(source).not.toMatch(/nim-overlay|nim-modal|nim-btn-|nim-input/);
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale|backdrop-blur/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
