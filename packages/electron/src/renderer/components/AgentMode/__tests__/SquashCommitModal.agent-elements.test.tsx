// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SquashCommitModal } from '../SquashCommitModal';

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

const sourcePath = resolve(__dirname, '../SquashCommitModal.tsx');

function renderModal(overrides: Partial<React.ComponentProps<typeof SquashCommitModal>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const result = render(
    <SquashCommitModal
      isOpen
      commitCount={3}
      warningMessage="Some commits exist on other branches."
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onConfirm, onCancel, ...result };
}

describe('SquashCommitModal Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
  });

  it('renders Agent Elements squash dialog chrome while preserving warning, focus, trimmed submit, and actions', () => {
    const { onConfirm, onCancel } = renderModal();

    const overlay = screen.getByTestId('agent-elements-squash-commit-overlay');
    expect(overlay).toHaveClass('squash-commit-modal-overlay', 'agent-elements-agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-agent-elements-shell', 'agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-component', 'SquashCommitModal');

    const dialog = screen.getByTestId('agent-elements-squash-commit-dialog');
    expect(dialog).toHaveClass('squash-commit-modal', 'agent-elements-squash-commit-dialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'squash-commit-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { name: 'Squash 3 Commits' })).toBeInTheDocument();

    const warning = screen.getByTestId('agent-elements-squash-commit-warning');
    expect(warning).toHaveTextContent('Some commits exist on other branches.');

    const textarea = within(dialog).getByRole('textbox', { name: 'Commit Message' });
    expect(textarea).toHaveClass('squash-commit-modal-textarea', 'agent-elements-squash-commit-textarea');
    expect(textarea).toHaveFocus();
    expect(screen.getByTestId('agent-elements-squash-commit-hint')).toHaveTextContent('Press Cmd+Enter to submit');

    const confirmButton = within(dialog).getByRole('button', { name: 'Squash Commits' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(textarea, { target: { value: '  Squashed agent polish  ' } });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith('Squashed agent polish');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    within(dialog).getAllByText(/^(close|warning)$/).forEach((icon) => {
      expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
    });
  });

  it('preserves optional closed/warning/checking branches and keyboard behavior', () => {
    const closed = renderModal({ isOpen: false });
    expect(screen.queryByTestId('agent-elements-squash-commit-dialog')).not.toBeInTheDocument();
    closed.unmount();

    const { onConfirm, onCancel } = renderModal({
      warningMessage: undefined,
      isChecking: true,
    });

    const dialog = screen.getByTestId('agent-elements-squash-commit-dialog');
    expect(screen.queryByTestId('agent-elements-squash-commit-warning')).not.toBeInTheDocument();
    const textarea = within(dialog).getByRole('textbox', { name: 'Commit Message' });
    fireEvent.change(textarea, { target: { value: 'ready to squash' } });
    expect(within(dialog).getByRole('button', { name: 'Checking...' })).toBeDisabled();

    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(onConfirm).toHaveBeenCalledWith('ready to squash');

    fireEvent.click(dialog);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('agent-elements-squash-commit-overlay'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('keeps SquashCommitModal source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-squash-commit-dialog');
    expect(source).toContain('data-agent-elements-shell="squash-commit-dialog"');
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toMatch(/nim-overlay|nim-modal|nim-btn-|nim-input/);
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale|backdrop-blur/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
