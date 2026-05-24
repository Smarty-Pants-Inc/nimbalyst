// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RosettaWarning } from '../RosettaWarning/RosettaWarning';
import { WindowsClaudeCodeWarning } from '../WindowsClaudeCodeWarning/WindowsClaudeCodeWarning';

const electronSend = vi.fn();

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
    }) =>
      ReactModule.createElement('span', {
        'data-icon': icon,
        'data-size': size,
        className,
      }),
  };
});

describe('platform warning Agent Elements shells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        send: electronSend,
      },
    });
  });

  it('renders a Rosetta Agent Elements warning shell while preserving actions', () => {
    const onClose = vi.fn();
    const onDismiss = vi.fn();
    const onDownload = vi.fn();

    const { rerender } = render(
      <RosettaWarning
        isOpen={false}
        onClose={onClose}
        onDismiss={onDismiss}
        onDownload={onDownload}
      />
    );

    expect(screen.queryByTestId('agent-elements-rosetta-warning')).not.toBeInTheDocument();

    rerender(
      <RosettaWarning
        isOpen={true}
        onClose={onClose}
        onDismiss={onDismiss}
        onDownload={onDownload}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-rosetta-warning-backdrop');
    expect(backdrop).toHaveClass('nim-overlay', 'agent-elements-rosetta-warning-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'platform-warning-backdrop');

    const dialog = screen.getByTestId('agent-elements-rosetta-warning');
    expect(dialog).toHaveClass('agent-elements-rosetta-warning', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'RosettaWarning');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'platform-warning');

    expect(screen.getByTestId('agent-elements-rosetta-warning-header')).toHaveTextContent(
      'Running via Rosetta Translation'
    );
    expect(screen.getByTestId('agent-elements-rosetta-warning-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'platform-warning-actions'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download Apple Silicon Build' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: "Don't Show Again" }));
    expect(electronSend).toHaveBeenCalledWith('dismiss-rosetta-warning');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders a Windows Claude Code Agent Elements warning shell while preserving actions', () => {
    const onClose = vi.fn();
    const onDismiss = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <WindowsClaudeCodeWarning
        isOpen={true}
        onClose={onClose}
        onDismiss={onDismiss}
        onOpenSettings={onOpenSettings}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-windows-claude-code-warning-backdrop');
    expect(backdrop).toHaveClass(
      'windows-warning-overlay',
      'agent-elements-windows-claude-code-warning-backdrop'
    );
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'platform-warning-backdrop');

    const dialog = screen.getByTestId('agent-elements-windows-claude-code-warning');
    expect(dialog).toHaveClass(
      'windows-warning',
      'agent-elements-windows-claude-code-warning',
      'agent-elements-tool-card'
    );
    expect(dialog).toHaveAttribute('data-component', 'WindowsClaudeCodeWarning');

    expect(screen.getByTestId('agent-elements-windows-claude-code-warning-header')).toHaveTextContent(
      'Claude Code Installation Required'
    );

    fireEvent.click(screen.getByRole('button', { name: 'View Installation Instructions' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Remind Me Later' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: "Don't Show Again" }));
    expect(electronSend).toHaveBeenCalledWith('dismiss-claude-code-windows-warning');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
