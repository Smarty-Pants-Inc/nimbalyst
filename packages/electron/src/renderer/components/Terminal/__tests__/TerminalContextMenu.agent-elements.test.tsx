// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TerminalContextMenu } from '../TerminalContextMenu';

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

describe('TerminalContextMenu Agent Elements shell', () => {
  it('keeps terminal context menu card intent and gutters explicit in source', () => {
    const source = readFileSync(resolve(__dirname, '../TerminalContextMenu.tsx'), 'utf8');

    expect(source).toContain('data-agent-elements-card-padding="symmetric-inline"');
    expect(source).toContain('data-agent-elements-card-width="floating-menu"');
    expect(source).toContain('px-[var(--agent-elements-card-inline-padding)]');
    expect(source).toContain('py-[var(--agent-elements-card-block-padding)]');
    expect(source).not.toMatch(/agent-elements-terminal-context-menu[^\n"]*\bp-1\b/);
    expect(source).not.toMatch(/rounded-\[(?:8|10)px\]/);
    expect(source).not.toMatch(/var\(--nim-[^)]+\)/);
  });

  it('renders an Agent Elements floating menu shell while preserving clear and close behavior', () => {
    const onClear = vi.fn();
    const onClose = vi.fn();

    render(
      <TerminalContextMenu
        x={32}
        y={64}
        onClear={onClear}
        onClose={onClose}
      />
    );

    const menu = screen.getByTestId('terminal-context-menu');
    expect(menu).toHaveClass('terminal-context-menu', 'agent-elements-terminal-context-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-component', 'TerminalContextMenu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'terminal-context-menu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');
    expect(menu.className).not.toMatch(/backdrop.*blur|rounded-md|rgba|shadow-\[0_4px_12px/);

    const clearItem = screen.getByTestId('agent-elements-terminal-context-menu-clear');
    expect(clearItem.tagName).toBe('BUTTON');
    expect(clearItem).toHaveClass('terminal-context-menu-item', 'agent-elements-terminal-context-menu-item');
    expect(clearItem).toHaveAttribute('data-agent-elements-shell', 'terminal-context-menu-item');
    expect(clearItem.className).not.toMatch(/text-white|bg-white|bg-black|active:scale|hover:scale|rounded-md|rounded-lg|rounded-xl|rgba|--nim-bg|--nim-text|--nim-border|backdrop-blur/);
    expect(within(clearItem).getByText('Clear')).toBeInTheDocument();
    expect(within(clearItem).getByText('Clear')).toHaveClass('agent-elements-terminal-context-menu-label');
    expect(within(clearItem).getByText('Clear')).toHaveAttribute('data-command', 'clear');

    fireEvent.click(clearItem);

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
