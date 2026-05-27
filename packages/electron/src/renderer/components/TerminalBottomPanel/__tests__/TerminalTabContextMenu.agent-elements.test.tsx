// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TerminalTabContextMenu } from '../TerminalTabContextMenu';

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

describe('TerminalTabContextMenu Agent Elements shell', () => {
  it('keeps terminal tab menu card intent and gutters explicit in source', () => {
    const source = readFileSync(resolve(__dirname, '../TerminalTabContextMenu.tsx'), 'utf8');

    expect(source).toContain('data-agent-elements-card-padding="symmetric-inline"');
    expect(source).toContain('data-agent-elements-card-width="floating-menu"');
    expect(source).toContain('px-[var(--agent-elements-card-inline-padding)]');
    expect(source).toContain('py-[var(--agent-elements-card-block-padding)]');
    expect(source).not.toMatch(/agent-elements-terminal-tab-menu[^\n"]*\bp-1\b/);
    expect(source).not.toMatch(/rounded-\[(?:8|10)px\]/);
    expect(source).not.toMatch(/var\(--nim-[^)]+\)/);
  });

  it('renders an Agent Elements tab menu shell while preserving enabled and disabled tab actions', () => {
    const onClose = vi.fn();
    const onCloseTab = vi.fn();
    const onCloseOthers = vi.fn();
    const onCloseAll = vi.fn();
    const onCloseToRight = vi.fn();

    render(
      <TerminalTabContextMenu
        x={48}
        y={96}
        terminalId="term-2"
        terminalCount={2}
        terminalIndex={1}
        onClose={onClose}
        onCloseTab={onCloseTab}
        onCloseOthers={onCloseOthers}
        onCloseAll={onCloseAll}
        onCloseToRight={onCloseToRight}
      />
    );

    const menu = screen.getByTestId('terminal-tab-context-menu');
    expect(menu).toHaveClass('terminal-tab-context-menu', 'agent-elements-terminal-tab-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-component', 'TerminalTabContextMenu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'terminal-tab-context-menu');
    expect(menu).toHaveAttribute('data-agent-elements-testid', 'agent-elements-terminal-tab-menu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');
    expect(menu).toHaveAttribute('data-terminal-id', 'term-2');
    expect(menu.className).not.toMatch(/rounded-md|rgba|shadow-\[0_4px_12px|--nim-bg|--nim-border|--nim-text/);

    const close = screen.getByTestId('agent-elements-terminal-menu-close');
    expect(close.tagName).toBe('BUTTON');
    expect(close).toHaveClass('terminal-tab-context-menu-item', 'agent-elements-terminal-tab-menu-item');
    expect(close).toHaveAttribute('data-terminal-action', 'close');
    expect(close.className).not.toMatch(/rounded-md|rgba|--nim-bg|--nim-text|--nim-border/);
    expect(within(close).getByText('Close')).toHaveAttribute('data-command', 'close');

    const closeRight = screen.getByTestId('agent-elements-terminal-menu-close-right');
    expect(closeRight.tagName).toBe('BUTTON');
    expect(closeRight).toBeDisabled();
    expect(closeRight).toHaveAttribute('aria-disabled', 'true');
    expect(closeRight).toHaveAttribute('data-terminal-action', 'close-right');

    fireEvent.click(closeRight);
    expect(onCloseToRight).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('agent-elements-terminal-menu-close-others'));
    expect(onCloseOthers).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(close);
    expect(onCloseTab).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('agent-elements-terminal-menu-close-all'));
    expect(onCloseAll).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
