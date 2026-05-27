// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TabBar } from '../TabManager/TabBar';
import type { Tab } from '../TabManager/TabManager';

const openHistoryDialog = vi.fn();

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size }: { icon: string; size?: number }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size }),
  };
});

vi.mock('jotai', async () => {
  const actual = await vi.importActual<typeof import('jotai')>('jotai');
  return {
    ...actual,
    useSetAtom: () => openHistoryDialog,
  };
});

vi.mock('../../hooks/useTabState', () => ({
  useTabDirty: () => false,
  useTabHasCollabUnsyncedChanges: () => false,
  useTabHasUnacceptedChanges: () => false,
}));

vi.mock('../CommonFileActions', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    CommonFileActions: ({
      menuItemClass,
      separatorClass,
      onClose,
      useButtons,
    }: {
      menuItemClass: string;
      separatorClass: string;
      onClose: () => void;
      useButtons?: boolean;
    }) => ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.createElement('div', {
        className: separatorClass,
        'data-testid': 'mock-tab-common-file-actions-separator',
      }),
      ReactModule.createElement(
        useButtons ? 'button' : 'div',
        {
          type: useButtons ? 'button' : undefined,
          role: useButtons ? 'menuitem' : undefined,
          className: menuItemClass,
          'data-testid': 'mock-tab-common-file-action',
          'data-use-buttons': String(Boolean(useButtons)),
          onClick: onClose,
        },
        'Open in Default App'
      )
    ),
  };
});

const tabs: Tab[] = [
  {
    id: 'tab-1',
    filePath: '/workspace/src/app.tsx',
    fileName: 'app.tsx',
    content: '',
    isDirty: false,
    isPinned: false,
  },
  {
    id: 'tab-2',
    filePath: '/workspace/README.md',
    fileName: 'README.md',
    content: '',
    isDirty: false,
    isPinned: true,
  },
];

function renderTabBar(overrides: Partial<React.ComponentProps<typeof TabBar>> = {}) {
  const props: React.ComponentProps<typeof TabBar> = {
    tabs,
    activeTabId: 'tab-1',
    onTabSelect: vi.fn(),
    onTabClose: vi.fn(),
    onNewTab: vi.fn(),
    onTogglePin: vi.fn(),
    onTabReorder: vi.fn(),
    onReopenLastClosed: vi.fn(),
    hasClosedTabs: true,
    onToggleAIChat: vi.fn(),
    isAIChatCollapsed: true,
    ...overrides,
  };

  const view = render(<TabBar {...props} />);
  return { ...view, props };
}

describe('TabBar Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders the tab context menu with Agent Elements shell and button semantics while preserving actions', () => {
    const { container, props } = renderTabBar();

    const firstTab = container.querySelector('[data-tab-id="tab-1"]');
    expect(firstTab).toBeInTheDocument();

    fireEvent.contextMenu(firstTab!, { clientX: 48, clientY: 96 });

    const menu = screen.getByTestId('agent-elements-tab-context-menu');
    expect(menu).toHaveClass('tab-context-menu', 'agent-elements-tab-context-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-component', 'TabBarContextMenu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'tab-context-menu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');
    expect(menu.className).toContain('--agent-elements-card-inline-padding');
    expect(menu.className).toContain('--agent-elements-card-block-padding');
    expect(menu.className).not.toMatch(/backdrop.*blur|text-white|bg-white|bg-black|scale-/);

    const pinAction = screen.getByTestId('agent-elements-tab-context-menu-pin');
    expect(pinAction.tagName).toBe('BUTTON');
    expect(pinAction).toHaveAttribute('type', 'button');
    expect(pinAction).toHaveAttribute('role', 'menuitem');
    expect(pinAction).toHaveAttribute('data-tab-context-action', 'pin');
    expect(within(pinAction).getByText('Pin Tab')).toBeInTheDocument();

    const commonAction = screen.getByTestId('mock-tab-common-file-action');
    expect(commonAction.tagName).toBe('BUTTON');
    expect(commonAction).toHaveAttribute('data-use-buttons', 'true');
    expect(commonAction).toHaveClass('agent-elements-tab-context-menu-item');

    fireEvent.click(pinAction);
    expect(props.onTogglePin).toHaveBeenCalledWith('tab-1');
  });

  it('renders the overflow tab menu with Agent Elements rows while preserving close-all behavior', () => {
    const { props } = renderTabBar();

    fireEvent.click(screen.getByTitle('Tab menu'));

    const menu = screen.getByTestId('agent-elements-tab-menu');
    expect(menu).toHaveClass('tab-menu-dropdown', 'agent-elements-tab-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-component', 'TabBarOverflowMenu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'tab-menu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');
    expect(menu.className).toContain('--agent-elements-card-inline-padding');
    expect(menu.className).toContain('--agent-elements-card-block-padding');
    expect(menu.className).not.toMatch(/backdrop.*blur|text-white|bg-white|bg-black|scale-/);

    const closeAll = screen.getByTestId('agent-elements-tab-menu-close-all');
    expect(closeAll.tagName).toBe('BUTTON');
    expect(closeAll).toHaveAttribute('type', 'button');
    expect(closeAll).toHaveAttribute('role', 'menuitem');
    expect(closeAll).toHaveClass('agent-elements-tab-menu-item');

    const activeTabItem = screen.getByTestId('agent-elements-tab-menu-item-tab-1');
    expect(activeTabItem).toHaveClass('active', 'agent-elements-tab-menu-item');
    expect(activeTabItem.className).not.toMatch(/text-white/);

    fireEvent.click(closeAll);
    expect(props.onTabClose).toHaveBeenCalledTimes(1);
    expect(props.onTabClose).toHaveBeenCalledWith('tab-1');
  });

  it('keeps the AI chat toggle compact without decorative scale motion', () => {
    const { props } = renderTabBar();

    const toggle = screen.getByTestId('ai-sidebar-toggle');
    expect(toggle).toHaveClass('agent-elements-tab-ai-toggle');
    expect(toggle.className).not.toMatch(/scale-/);

    fireEvent.click(toggle);
    expect(props.onToggleAIChat).toHaveBeenCalledTimes(1);
  });

  it('keeps tab floating menu chrome on Agent Elements aliases instead of legacy one-off gutters', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'packages/electron/src/renderer/components/TabManager/TabBar.tsx'),
      'utf8',
    );

    expect(source).toContain('data-agent-elements-card-width="floating-menu"');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).not.toMatch(/(?:tabMenuShellClasses|contextMenuShellClasses)\s*=\s*[^;]*(?:border-nim|bg-nim|text-nim|var\(--nim-|p-1|rounded-\[10px\])/s);
    expect(source).not.toMatch(/(?:tabMenuItemClasses|contextMenuItemClasses)\s*=\s*[^;]*(?:text-nim|hover:bg-nim|var\(--nim-)/s);
  });
});
