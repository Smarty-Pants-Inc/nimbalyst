// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
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
