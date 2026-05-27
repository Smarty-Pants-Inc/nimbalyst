// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../ConfirmDialog';

const sourcePath = resolve(__dirname, '../ConfirmDialog.tsx');

describe('ConfirmDialog Agent Elements shell', () => {
  it('renders an Agent Elements confirmation shell while preserving callbacks and legacy selectors', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete tracker"
        message="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        destructive={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-confirm-dialog-backdrop');
    expect(backdrop).toHaveClass('confirm-dialog-overlay', 'agent-elements-confirm-dialog-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'confirm-dialog-backdrop');

    const dialog = screen.getByTestId('agent-elements-confirm-dialog');
    expect(dialog).toHaveClass('confirm-dialog', 'agent-elements-confirm-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'ConfirmDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'confirm-dialog');
    expect(dialog.className).toContain('!p-0');
    expect(dialog.className).toContain('!gap-0');
    expect(dialog.className).toContain('--agent-elements-card-inline-padding');
    expect(dialog.className).toContain('--agent-elements-card-block-padding');

    expect(screen.getByTestId('agent-elements-confirm-dialog-header')).toHaveTextContent('Delete tracker');
    expect(screen.getByTestId('agent-elements-confirm-dialog-message')).toHaveTextContent(
      'This cannot be undone.'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    expect(confirmButton).toHaveClass('confirm-dialog-button-confirm', 'nim-btn-danger');
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('preserves closed rendering and overlay cancellation in the Agent Elements shell', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <ConfirmDialog
        isOpen={false}
        title="Archive worktree"
        message="Archive this worktree?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.queryByTestId('agent-elements-confirm-dialog')).not.toBeInTheDocument();

    rerender(
      <ConfirmDialog
        isOpen={true}
        title="Archive worktree"
        message="Archive this worktree?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole('button', { name: 'OK' })).toHaveClass(
      'confirm-dialog-button-confirm',
      'nim-btn-primary'
    );

    fireEvent.click(screen.getByTestId('agent-elements-confirm-dialog-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps ConfirmDialog visual chrome on Agent Elements aliases', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('--an-error-color');
    expect(source).toContain('--an-button-primary-text');
    expect(source).toContain('--an-send-button-color');
    expect(source).toContain('!p-0');
    expect(source).toContain('!gap-0');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).toContain('px-[var(--agent-elements-card-inline-padding)]');
    expect(source).toContain('py-[var(--agent-elements-card-block-padding)]');
    expect(source).not.toMatch(/var\(--nim-/);
    expect(source).not.toMatch(/color-mix\(in_srgb,var\(--nim-/);
    expect(source).not.toMatch(/agent-elements-confirm-dialog-header[^`'"]*\bp-\[var\(--an-spacing/);
  });
});
