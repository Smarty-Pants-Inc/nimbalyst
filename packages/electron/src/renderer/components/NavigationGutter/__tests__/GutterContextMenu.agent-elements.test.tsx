// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GutterContextMenu } from '../GutterContextMenu';

const mockState = vi.hoisted(() => ({
  tokens: {
    hiddenGutterButtonsAtom: 'hiddenGutterButtonsAtom',
    toggleGutterButtonHiddenAtom: 'toggleGutterButtonHiddenAtom',
    showAllGutterButtonsAtom: 'showAllGutterButtonsAtom',
  },
  hiddenButtons: [] as string[],
  toggleHidden: vi.fn(),
  showAll: vi.fn(),
}));

const sourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/NavigationGutter/GutterContextMenu.tsx',
);

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.hiddenGutterButtonsAtom) {
      return mockState.hiddenButtons;
    }
    return undefined;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.toggleGutterButtonHiddenAtom) {
      return mockState.toggleHidden;
    }
    if (atom === mockState.tokens.showAllGutterButtonsAtom) {
      return mockState.showAll;
    }
    return vi.fn();
  }),
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
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

vi.mock('../../../store/atoms/projectState', () => ({
  hiddenGutterButtonsAtom: mockState.tokens.hiddenGutterButtonsAtom,
  toggleGutterButtonHiddenAtom: mockState.tokens.toggleGutterButtonHiddenAtom,
  showAllGutterButtonsAtom: mockState.tokens.showAllGutterButtonsAtom,
}));

describe('GutterContextMenu Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.hiddenButtons = [];
  });

  it('renders an Agent Elements hide action while preserving the existing menu selector and toggle payload', () => {
    const onClose = vi.fn();

    render(
      <GutterContextMenu
        x={24}
        y={48}
        targetButton="voice-mode"
        workspacePath="/workspace/app"
        onClose={onClose}
      />
    );

    const menu = screen.getByTestId('gutter-context-menu');
    expect(menu).toHaveClass('gutter-context-menu', 'agent-elements-gutter-context-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-component', 'GutterContextMenu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'gutter-context-menu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');
    expect(menu.className).not.toMatch(/backdrop.*blur|rounded-md|rgba\(/);

    const source = fs.readFileSync(sourcePath, 'utf8');
    expect(source).toContain('data-agent-elements-card-padding="symmetric-inline"');
    expect(source).toContain('data-agent-elements-card-width="floating-menu"');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).not.toMatch(/\b(?:bg|text|border|hover:bg|hover:text|hover:border)-nim(?:-[\w-]+)?\b|var\(--nim-/);

    const hideItem = screen.getByTestId('agent-elements-gutter-context-menu-hide-voice-mode');
    expect(hideItem).toHaveClass('agent-elements-gutter-context-menu-item');
    expect(hideItem).toHaveAttribute('data-gutter-action', 'hide');
    expect(hideItem).toHaveAttribute('data-gutter-button', 'voice-mode');
    expect(within(hideItem).getByText('Hide Voice Mode')).toBeInTheDocument();

    fireEvent.click(hideItem);

    expect(mockState.toggleHidden).toHaveBeenCalledWith({
      buttonId: 'voice-mode',
      workspacePath: '/workspace/app',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders hidden buttons in order and preserves restore and show-all behavior', () => {
    mockState.hiddenButtons = ['sync-status', 'feedback'];
    const onClose = vi.fn();

    render(
      <GutterContextMenu
        x={24}
        y={48}
        targetButton="voice-mode"
        workspacePath="/workspace/app"
        onClose={onClose}
      />
    );

    const items = screen.getAllByTestId(/agent-elements-gutter-context-menu-(hide|show|show-all)/);
    expect(items.map((item) => item.textContent)).toEqual([
      'Hide Voice Mode',
      'Show Sync Status',
      'Show Feedback',
      'Show All',
    ]);

    const showSync = screen.getByTestId('agent-elements-gutter-context-menu-show-sync-status');
    fireEvent.click(showSync);
    expect(mockState.toggleHidden).toHaveBeenCalledWith({
      buttonId: 'sync-status',
      workspacePath: '/workspace/app',
    });

    const showAll = screen.getByTestId('agent-elements-gutter-context-menu-show-all');
    expect(showAll).toHaveAttribute('data-gutter-action', 'show-all');
    fireEvent.click(showAll);
    expect(mockState.showAll).toHaveBeenCalledWith('/workspace/app');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps the empty state inside the Agent Elements menu shell', () => {
    render(
      <GutterContextMenu
        x={24}
        y={48}
        workspacePath="/workspace/app"
        onClose={vi.fn()}
      />
    );

    const menu = screen.getByTestId('gutter-context-menu');
    const empty = screen.getByTestId('agent-elements-gutter-context-menu-empty');
    expect(empty).toHaveClass('agent-elements-gutter-context-menu-empty');
    expect(empty).toHaveAttribute('data-agent-elements-shell', 'gutter-context-menu-empty');
    expect(within(menu).getByText('Right-click buttons to hide them')).toBeInTheDocument();
  });
});
