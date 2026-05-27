// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkstreamEditorTabs, type WorkstreamEditorTabsRef } from '../WorkstreamEditorTabs';

const mockState = vi.hoisted(() => {
  const tokens = {
    setSessionTabCountAtom: 'setSessionTabCountAtom',
    workstreamStateAtom: (workstreamId: string) => `workstreamState:${workstreamId}`,
    workstreamStatesLoadedAtom: 'workstreamStatesLoadedAtom',
    fileDeletedAtomFamily: (filePath: string) => `fileDeleted:${filePath}`,
  };

  return {
    tokens,
    atomValues: new Map<string, any>(),
    setAtomFns: new Map<string, any>(),
    defaultSetAtom: vi.fn(),
    setTabCount: vi.fn(),
    setWorkstreamState: vi.fn(),
    storeGet: vi.fn(),
    storeSub: vi.fn(() => vi.fn()),
    tabs: [] as Array<{ id: string; filePath: string }>,
    activeTabId: null as string | null,
    tabsActions: {
      addTab: vi.fn(),
      removeTab: vi.fn(),
      switchTab: vi.fn(),
      findTabByPath: vi.fn(),
      getTabState: vi.fn(),
    },
    tabManagerProps: [] as any[],
    tabContentProps: [] as any[],
  };
});

vi.mock('jotai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jotai')>();

  return {
    ...actual,
    useAtomValue: vi.fn((atom: string) => mockState.atomValues.get(atom)),
    useSetAtom: vi.fn((atom: string) => mockState.setAtomFns.get(atom) ?? mockState.defaultSetAtom),
  };
});

vi.mock('@nimbalyst/runtime/store', () => ({
  store: {
    get: mockState.storeGet,
    sub: mockState.storeSub,
  },
}));

vi.mock('../../../contexts/TabsContext', () => ({
  TabsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs-provider">{children}</div>
  ),
  useTabs: () => ({
    tabs: mockState.tabs,
    activeTabId: mockState.activeTabId,
  }),
  useTabsActions: () => mockState.tabsActions,
}));

vi.mock('../../TabManager/TabManager', () => ({
  TabManager: (props: any) => {
    mockState.tabManagerProps.push(props);
    return (
      <div data-testid="mock-tab-manager" data-active={String(props.isActive)}>
        <button type="button" data-testid="mock-close-tab" onClick={() => props.onTabClose('tab-1')}>
          Close tab
        </button>
        {props.children}
      </div>
    );
  },
}));

vi.mock('../../TabContent/TabContent', () => ({
  TabContent: (props: any) => {
    mockState.tabContentProps.push(props);
    return <div data-testid="mock-tab-content" data-workspace-id={props.workspaceId} />;
  },
}));

vi.mock('../../../store', () => ({
  setSessionTabCountAtom: mockState.tokens.setSessionTabCountAtom,
}));

vi.mock('../../../store/atoms/workstreamState', () => ({
  workstreamStateAtom: mockState.tokens.workstreamStateAtom,
  workstreamStatesLoadedAtom: mockState.tokens.workstreamStatesLoadedAtom,
}));

vi.mock('../../../store/atoms/fileWatch', () => ({
  fileDeletedAtomFamily: mockState.tokens.fileDeletedAtomFamily,
}));

const sourcePath = resolve(__dirname, '../WorkstreamEditorTabs.tsx');

function seedWorkstreamEditorTabs() {
  mockState.atomValues.clear();
  mockState.setAtomFns.clear();
  mockState.defaultSetAtom.mockClear();
  mockState.setTabCount.mockClear();
  mockState.setWorkstreamState.mockClear();
  mockState.storeGet.mockReset();
  mockState.storeSub.mockClear();
  mockState.tabsActions.addTab.mockClear();
  mockState.tabsActions.removeTab.mockClear();
  mockState.tabsActions.switchTab.mockClear();
  mockState.tabsActions.findTabByPath.mockReset();
  mockState.tabsActions.getTabState.mockReset();
  mockState.tabManagerProps.length = 0;
  mockState.tabContentProps.length = 0;

  mockState.tabs = [
    { id: 'tab-1', filePath: '/workspace/src/App.tsx' },
    { id: 'tab-2', filePath: '/workspace/src/runtime.ts' },
  ];
  mockState.activeTabId = 'tab-1';

  mockState.atomValues.set(mockState.tokens.workstreamStatesLoadedAtom, false);
  mockState.atomValues.set(mockState.tokens.workstreamStateAtom('workstream-1'), {
    openFilePaths: [],
    activeFilePath: null,
  });
  mockState.setAtomFns.set(mockState.tokens.setSessionTabCountAtom, mockState.setTabCount);
  mockState.setAtomFns.set(mockState.tokens.workstreamStateAtom('workstream-1'), mockState.setWorkstreamState);
  mockState.storeGet.mockReturnValue(false);
  mockState.tabsActions.findTabByPath.mockImplementation((filePath: string) => (
    mockState.tabs.find((tab) => tab.filePath === filePath) ?? null
  ));
  mockState.tabsActions.getTabState.mockImplementation((tabId: string) => {
    const tab = mockState.tabs.find((candidate) => candidate.id === tabId);
    return tab ? { ...tab, content: `content for ${tab.filePath}` } : null;
  });
}

function renderEditorTabs(overrides: Partial<React.ComponentProps<typeof WorkstreamEditorTabs>> = {}) {
  const ref = React.createRef<WorkstreamEditorTabsRef>();
  const onSwitchToAgentMode = vi.fn();
  const onOpenSessionInChat = vi.fn();
  const result = render(
    <WorkstreamEditorTabs
      ref={ref}
      workstreamId="workstream-1"
      workspacePath="/workspace"
      basePath="/workspace/.worktrees/feature"
      isActive
      onSwitchToAgentMode={onSwitchToAgentMode}
      onOpenSessionInChat={onOpenSessionInChat}
      {...overrides}
    />,
  );

  return { ref, onSwitchToAgentMode, onOpenSessionInChat, ...result };
}

describe('AgentMode WorkstreamEditorTabs Agent Elements shell', () => {
  beforeEach(() => {
    seedWorkstreamEditorTabs();
  });

  it('preserves null rendering when the workstream has no open editor tabs', () => {
    mockState.tabs = [];
    mockState.activeTabId = null;
    const { container } = renderEditorTabs();

    expect(container.querySelector('[data-testid="agent-elements-workstream-editor-tabs"]')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-tab-manager')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-tab-content')).not.toBeInTheDocument();
  });

  it('wraps tab manager and tab content in Agent Elements chrome while preserving props', () => {
    const { onSwitchToAgentMode, onOpenSessionInChat } = renderEditorTabs({ isActive: false });

    const root = screen.getByTestId('agent-elements-workstream-editor-tabs');
    expect(root).toHaveClass('workstream-editor-tabs', 'agent-elements-workstream-editor-tabs');
    expect(root).toHaveAttribute('data-component', 'WorkstreamEditorTabs');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'workstream-editor-tabs');
    expect(root).toHaveAttribute('data-workstream-id', 'workstream-1');
    expect(root).toHaveAttribute('data-active-tab-id', 'tab-1');
    expect(root).toHaveAttribute('data-tab-count', '2');
    expect(root).toHaveAttribute('data-active', 'false');

    expect(screen.getByTestId('agent-elements-workstream-editor-tabs-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'workstream-editor-tabs-header',
    );
    expect(screen.getByTestId('agent-elements-workstream-editor-tabs-content')).toHaveAttribute(
      'data-agent-elements-shell',
      'workstream-editor-tabs-content',
    );
    expect(screen.getByTestId('mock-tab-content')).toHaveAttribute('data-workspace-id', '/workspace/.worktrees/feature');

    expect(mockState.tabManagerProps[0]).toMatchObject({
      hideTabBar: false,
      isActive: false,
    });
    expect(mockState.tabContentProps[0]).toMatchObject({
      workspaceId: '/workspace/.worktrees/feature',
      onSwitchToAgentMode,
      onOpenSessionInChat,
    });

    fireEvent.click(screen.getByTestId('mock-close-tab'));
    expect(mockState.tabsActions.removeTab).toHaveBeenCalledWith('tab-1');
  });

  it('preserves imperative tab actions inside the styled shell', () => {
    const { ref } = renderEditorTabs();

    expect(ref.current?.hasTabs()).toBe(true);
    expect(ref.current?.getActiveFilePath()).toBe('/workspace/src/App.tsx');
    expect(ref.current?.getActiveTab()).toEqual({
      filePath: '/workspace/src/App.tsx',
      content: 'content for /workspace/src/App.tsx',
    });

    ref.current?.openFile('/workspace/src/App.tsx');
    expect(mockState.tabsActions.switchTab).toHaveBeenCalledWith('tab-1');

    ref.current?.openFile('/workspace/src/new-file.ts');
    expect(mockState.tabsActions.addTab).toHaveBeenCalledWith('/workspace/src/new-file.ts');

    ref.current?.closeActiveTab();
    expect(mockState.tabsActions.removeTab).toHaveBeenCalledWith('tab-1');
  });

  it('keeps WorkstreamEditorTabs source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-workstream-editor-tabs');
    expect(source).toContain('data-agent-elements-shell="workstream-editor-tabs"');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/border-t-\[3px\]|rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
