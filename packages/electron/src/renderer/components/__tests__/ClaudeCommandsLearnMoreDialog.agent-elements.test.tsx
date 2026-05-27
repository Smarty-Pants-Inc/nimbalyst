// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClaudeCommandsLearnMoreDialog } from '../ClaudeCommandsLearnMoreDialog';

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
      ...rest
    }: {
      icon: string;
      size?: number;
      className?: string;
      [key: string]: unknown;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className, ...rest }, icon),
  };
});

const sourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../ClaudeCommandsLearnMoreDialog.tsx'
);

describe('ClaudeCommandsLearnMoreDialog Agent Elements shell', () => {
  it('renders an Agent Elements learn-more dialog while preserving close actions', () => {
    const onClose = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <ClaudeCommandsLearnMoreDialog
        isOpen={true}
        onClose={onClose}
        onOpenSettings={onOpenSettings}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-claude-commands-backdrop');
    expect(backdrop).toHaveClass(
      'claude-commands-learn-more-overlay',
      'agent-elements-claude-commands-backdrop'
    );
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'claude-commands-backdrop');

    const dialog = screen.getByTestId('agent-elements-claude-commands-dialog');
    expect(dialog).toHaveClass(
      'claude-commands-learn-more-dialog',
      'agent-elements-claude-commands-dialog',
      'agent-elements-tool-card'
    );
    expect(dialog).toHaveAttribute('data-component', 'ClaudeCommandsLearnMoreDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'claude-commands-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    expect(screen.getByTestId('agent-elements-claude-commands-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'claude-commands-header'
    );
    expect(screen.getByTestId('agent-elements-claude-commands-content')).toHaveAttribute(
      'data-agent-elements-shell',
      'claude-commands-content'
    );
    expect(screen.getByTestId('agent-elements-claude-commands-folder')).toHaveClass(
      'claude-commands-folder-structure',
      'agent-elements-claude-commands-folder'
    );
    expect(screen.getAllByTestId('agent-elements-claude-commands-item')).toHaveLength(6);
    expect(screen.getByTestId('agent-elements-claude-commands-footer')).toHaveAttribute(
      'data-agent-elements-shell',
      'claude-commands-footer'
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Got it' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('preserves closed rendering and Project Settings handoff behavior', () => {
    const onClose = vi.fn();
    const onOpenSettings = vi.fn();
    const { rerender } = render(
      <ClaudeCommandsLearnMoreDialog
        isOpen={false}
        onClose={onClose}
        onOpenSettings={onOpenSettings}
      />
    );

    expect(screen.queryByTestId('agent-elements-claude-commands-dialog')).not.toBeInTheDocument();

    rerender(
      <ClaudeCommandsLearnMoreDialog
        isOpen={true}
        onClose={onClose}
        onOpenSettings={onOpenSettings}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Project Settings' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps ClaudeCommandsLearnMoreDialog source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-claude-commands-dialog');
    expect(source).toContain('data-agent-elements-shell="claude-commands-dialog"');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/nim-overlay|nim-modal|nim-btn-|bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-lg|rounded-xl|shadow-\[|backdrop-blur|text-white|tracking-wide/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(|rgb\(/);
    expect(source).not.toMatch(/&times;|<svg|<\/svg>/);
  });
});
