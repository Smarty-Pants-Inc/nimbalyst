// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyboardShortcutsDialog } from '../KeyboardShortcutsDialog';

const commandRegistryState = vi.hoisted(() => ({
  keybindings: [
    {
      commandId: 'com.nimbalyst.git.git-log.toggle',
      extensionId: 'com.nimbalyst.git',
      key: 'ctrl+shift+g',
      commandTitle: 'Toggle Git Log',
    },
  ],
  subscribe: vi.fn(() => vi.fn()),
}));

vi.mock('../../../extensions/commands/ExtensionCommandRegistry', () => ({
  getRegisteredKeybindings: () => commandRegistryState.keybindings,
  subscribeToCommandRegistry: commandRegistryState.subscribe,
}));

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
    getExtensionLoader: () => ({
      getExtension: (extensionId: string) =>
        extensionId === 'com.nimbalyst.git'
          ? { manifest: { name: 'Git Tools' } }
          : undefined,
    }),
  };
});

const sourcePath = resolve(__dirname, '../KeyboardShortcutsDialog.tsx');

describe('KeyboardShortcutsDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an Agent Elements shortcuts shell while preserving close paths and legacy selectors', () => {
    const onClose = vi.fn();

    render(<KeyboardShortcutsDialog isOpen={true} onClose={onClose} />);

    const backdrop = screen.getByTestId('agent-elements-keyboard-shortcuts-dialog-backdrop');
    expect(backdrop).toHaveClass(
      'keyboard-shortcuts-dialog-overlay',
      'agent-elements-keyboard-shortcuts-dialog-backdrop'
    );
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'keyboard-shortcuts-dialog-backdrop');

    const dialog = screen.getByTestId('agent-elements-keyboard-shortcuts-dialog');
    expect(dialog).toHaveClass(
      'keyboard-shortcuts-dialog',
      'agent-elements-keyboard-shortcuts-dialog',
      'agent-elements-tool-card'
    );
    expect(dialog).toHaveAttribute('data-component', 'KeyboardShortcutsDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'keyboard-shortcuts-dialog');

    expect(screen.getByTestId('agent-elements-keyboard-shortcuts-dialog-header')).toHaveTextContent(
      'Keyboard Shortcuts'
    );
    expect(screen.getByTestId('agent-elements-keyboard-shortcuts-dialog-tabs')).toHaveAttribute(
      'data-agent-elements-shell',
      'keyboard-shortcuts-dialog-tabs'
    );
    expect(screen.getByText('New File / New Session')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-keyboard-shortcuts-dialog-footer')).toHaveTextContent('Esc');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('agent-elements-keyboard-shortcuts-dialog-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('agent-elements-keyboard-shortcuts-dialog-close'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('preserves tab switching and extension keybinding display inside the Agent Elements shell', () => {
    const onClose = vi.fn();

    const { rerender } = render(<KeyboardShortcutsDialog isOpen={false} onClose={onClose} />);
    expect(screen.queryByTestId('agent-elements-keyboard-shortcuts-dialog')).not.toBeInTheDocument();

    rerender(<KeyboardShortcutsDialog isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Editor Formatting' }));
    expect(screen.getByText('Text Formatting')).toBeInTheDocument();
    expect(screen.getByText('Bold')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Extensions' }));
    expect(commandRegistryState.subscribe).toHaveBeenCalled();
    expect(screen.getByText('Git Tools')).toBeInTheDocument();
    expect(screen.getByText('Toggle Git Log')).toBeInTheDocument();

    const extensionGroup = screen.getByTestId('agent-elements-keyboard-shortcuts-group-Git Tools');
    expect(extensionGroup).toHaveClass(
      'keyboard-shortcuts-group',
      'agent-elements-keyboard-shortcuts-group'
    );
    expect(within(extensionGroup).getByTestId('agent-elements-keyboard-shortcut-key')).toHaveTextContent(
      /G$/
    );
  });

  it('keeps KeyboardShortcutsDialog visual chrome on Agent Elements aliases', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('--an-foreground');
    expect(source).toContain('--an-background-tertiary');
    expect(source).not.toMatch(/var\(--nim-/);
    expect(source).not.toMatch(/color-mix\(in_srgb,var\(--nim-/);
  });
});
