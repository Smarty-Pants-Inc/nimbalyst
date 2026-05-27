// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MergeConfirmDialog } from '../MergeConfirmDialog';

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

vi.mock('../../../utils/pathUtils', () => ({
  getWorktreeNameFromPath: vi.fn((path: string, fallback: string) => {
    if (path.includes('feature-agent-elements')) return 'feature-agent-elements';
    if (path.includes('workspace-main')) return 'workspace-main';
    return fallback;
  }),
}));

const sourcePath = resolve(__dirname, '../MergeConfirmDialog.tsx');

function renderDialog(overrides: Partial<React.ComponentProps<typeof MergeConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const result = render(
    <MergeConfirmDialog
      worktreePath="/workspace/.worktrees/feature-agent-elements"
      workspacePath="/workspace-main"
      hasUncommittedChanges
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onConfirm, onCancel, ...result };
}

describe('MergeConfirmDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Agent Elements modal chrome while preserving merge confirmation copy and actions', () => {
    const { onConfirm, onCancel } = renderDialog();

    const overlay = screen.getByTestId('agent-elements-merge-confirm-overlay');
    expect(overlay).toHaveClass('merge-confirm-dialog-overlay', 'agent-elements-agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-agent-elements-shell', 'agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-component', 'MergeConfirmDialog');

    const dialog = screen.getByTestId('agent-elements-merge-confirm-dialog');
    expect(dialog).toHaveClass('merge-confirm-dialog', 'agent-elements-merge-confirm-dialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'merge-confirm-dialog');
    expect(dialog).toHaveFocus();
    expect(within(dialog).getByRole('heading', { name: 'Merge to Main' })).toBeInTheDocument();
    expect(within(dialog).getAllByText('feature-agent-elements')).toHaveLength(2);
    expect(within(dialog).getByText('main (workspace-main)')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-merge-confirm-info-banner')).toHaveTextContent(
      'Your uncommitted changes will be preserved.',
    );

    fireEvent.click(within(dialog).getByRole('button', { name: /^Merge$/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('preserves overlay cancel, dialog click stop-propagation, Escape cancel, and optional warning behavior', () => {
    const { onCancel } = renderDialog({ hasUncommittedChanges: false });

    expect(screen.queryByTestId('agent-elements-merge-confirm-info-banner')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('agent-elements-merge-confirm-dialog'));
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('agent-elements-merge-confirm-overlay'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('keeps MergeConfirmDialog source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-merge-confirm-dialog');
    expect(source).toContain('data-agent-elements-shell="merge-confirm-dialog"');
    expect(source).not.toMatch(/nim-overlay|nim-modal|nim-btn-|nim-input/);
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale|backdrop-blur/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
