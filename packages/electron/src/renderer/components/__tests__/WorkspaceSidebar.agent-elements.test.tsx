// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSidebar } from '../WorkspaceSidebar';

const workspaceSidebarSourcePath = resolve(
  process.cwd(),
  'packages/electron/src/renderer/components/WorkspaceSidebar.tsx'
);

const mockState = vi.hoisted(() => ({
  rawFileTree: [] as Array<{ name: string; path: string; type: 'file' | 'directory'; children?: unknown[] }>,
  fileTreeLoaded: false,
  sessionFileEdits: [] as unknown[],
  electronInvoke: vi.fn(),
  createFile: vi.fn(),
  createFolder: vi.fn(),
  copyFile: vi.fn(),
  moveFile: vi.fn(),
  getPathForFile: vi.fn(),
  getExtensionContributions: vi.fn(() => []),
  extensionSubscribe: vi.fn(() => vi.fn()),
  tabsSnapshot: {
    activeTabId: null,
    tabs: new Map(),
  },
}));

vi.mock('jotai', async importOriginal => {
  const actual = await importOriginal<typeof import('jotai')>();
  return {
    ...actual,
    useAtomValue: vi.fn((atom: unknown) => {
    if (atom === 'raw-file-tree') return mockState.rawFileTree;
    if (atom === 'file-tree-loaded') return mockState.fileTreeLoaded;
    if (atom === 'session-file-edits') return mockState.sessionFileEdits;
    return undefined;
    }),
  };
});

vi.mock('../../store', () => ({
  rawFileTreeAtom: 'raw-file-tree',
  fileTreeLoadedAtom: 'file-tree-loaded',
  gitStatusMapAtom: 'git-status-map',
  revealRequestAtom: 'reveal-request',
  store: {
    get: vi.fn((atom: unknown) => {
      if (atom === 'raw-file-tree') return mockState.rawFileTree;
      if (atom === 'reveal-request') return null;
      return undefined;
    }),
    set: vi.fn(),
    sub: vi.fn(() => vi.fn()),
  },
}));

vi.mock('../../store/atoms/sessionFiles', () => ({
  sessionFileEditsAtom: () => 'session-file-edits',
}));

vi.mock('../../contexts/TabsContext', () => ({
  useTabsActions: () => ({
    subscribe: vi.fn(() => vi.fn()),
    getSnapshot: () => mockState.tabsSnapshot,
  }),
}));

vi.mock('@nimbalyst/runtime', () => ({
  getExtensionLoader: () => ({
    getNewFileMenuContributions: mockState.getExtensionContributions,
    subscribe: mockState.extensionSubscribe,
  }),
}));

vi.mock('../WorkspaceSummaryHeader', () => ({
  WorkspaceSummaryHeader: ({
    workspacePath,
    workspaceName,
    actions,
    actionsClassName,
  }: {
    workspacePath: string;
    workspaceName?: string;
    actions?: React.ReactNode;
    actionsClassName?: string;
  }) => (
    <header data-testid="workspace-summary-header" data-path={workspacePath} data-name={workspaceName}>
      <div data-testid="workspace-summary-actions" className={actionsClassName}>
        {actions}
      </div>
    </header>
  ),
}));

vi.mock('../FlatFileTree', () => ({
  FlatFileTree: ({
    items,
    onFileSelect,
  }: {
    items: Array<{ path: string; name: string }>;
    onFileSelect: (filePath: string) => void;
  }) => (
    <div data-testid="flat-file-tree" data-item-count={items.length}>
      {items.map(item => (
        <button key={item.path} type="button" onClick={() => onFileSelect(item.path)}>
          {item.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../FileTreeFilterMenu', () => ({
  FileTreeFilterMenu: ({
    currentFilter,
    onFilterChange,
    onClose,
  }: {
    currentFilter: string;
    onFilterChange: (filter: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="file-tree-filter-menu" data-current-filter={currentFilter}>
      <button type="button" onClick={() => onFilterChange('markdown')}>Markdown</button>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../NewFileMenu', () => ({
  contributionToExtensionFileType: vi.fn(() => ({
    extension: '.example',
    displayName: 'Example',
    defaultContent: '',
  })),
  NewFileMenu: ({ onSelect, onClose }: { onSelect: (type: string) => void; onClose: () => void }) => (
    <div data-testid="new-file-menu">
      <button type="button" onClick={() => onSelect('markdown')}>Markdown</button>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../InputModal', () => ({
  InputModal: ({
    isOpen,
    title,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    title: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
  }) => isOpen ? (
    <div data-testid={`input-modal-${title}`}>
      <button type="button" onClick={() => onConfirm('new-item')}>Confirm</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  ) : null,
}));

vi.mock('../NewFileDialog', () => ({
  NewFileDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="new-file-dialog" /> : null,
}));

vi.mock('../PlansPanel/PlansPanel', () => ({
  PlansPanel: () => <div data-testid="plans-panel" />,
}));

function installElectronApi(workspaceState: Record<string, unknown> = {}) {
  mockState.electronInvoke.mockImplementation((channel: string) => {
    if (channel === 'workspace:get-state') return Promise.resolve(workspaceState);
    if (channel === 'git:is-repo') return Promise.resolve({ success: true, isRepo: false });
    if (channel === 'git:is-worktree') return Promise.resolve({ success: true, isWorktree: false });
    if (channel === 'git:get-all-file-statuses') return Promise.resolve({ success: true, statuses: {} });
    return Promise.resolve({ success: true });
  });

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      invoke: mockState.electronInvoke,
      createFile: mockState.createFile,
      createFolder: mockState.createFolder,
      copyFile: mockState.copyFile,
      moveFile: mockState.moveFile,
      getPathForFile: mockState.getPathForFile,
      git: {
        onStatusChanged: vi.fn(() => vi.fn()),
      },
    },
  });
}

function renderWorkspaceSidebar(props: Partial<React.ComponentProps<typeof WorkspaceSidebar>> = {}) {
  return render(
    <WorkspaceSidebar
      workspaceName="Smarty Code"
      workspacePath="/workspace/smarty-code"
      currentFilePath={null}
      currentView="files"
      onFileSelect={vi.fn()}
      onCloseWorkspace={vi.fn()}
      onOpenQuickSearch={vi.fn()}
      {...props}
    />
  );
}

describe('WorkspaceSidebar Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.rawFileTree = [];
    mockState.fileTreeLoaded = false;
    mockState.sessionFileEdits = [];
    mockState.createFile.mockResolvedValue({ success: true });
    mockState.createFolder.mockResolvedValue({ success: true });
    mockState.copyFile.mockResolvedValue({ success: true });
    mockState.moveFile.mockResolvedValue({ success: true });
    installElectronApi();
  });

  it('renders the workspace file sidebar with Agent Elements shell markers while preserving header actions', async () => {
    const onOpenQuickSearch = vi.fn();
    renderWorkspaceSidebar({ onOpenQuickSearch });

    await waitFor(() => {
      expect(mockState.electronInvoke).toHaveBeenCalledWith('workspace:get-state', '/workspace/smarty-code');
    });

    const sidebar = screen.getByTestId('agent-elements-workspace-sidebar');
    expect(sidebar).toHaveClass('workspace-sidebar', 'agent-elements-workspace-sidebar');
    expect(sidebar).toHaveAttribute('data-component', 'WorkspaceSidebar');
    expect(sidebar).toHaveAttribute('data-agent-elements-shell', 'workspace-sidebar');

    expect(screen.getByTestId('agent-elements-workspace-sidebar-section')).toHaveAttribute(
      'data-agent-elements-shell',
      'workspace-sidebar-section'
    );
    expect(screen.getByTestId('agent-elements-workspace-sidebar-tree')).toHaveAttribute(
      'data-agent-elements-shell',
      'workspace-sidebar-tree'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search files' }));
    expect(onOpenQuickSearch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
    expect(screen.getByTestId('input-modal-New Folder')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filter files' }));
    expect(screen.getByTestId('file-tree-filter-menu')).toBeInTheDocument();
  });

  it('renders Agent Elements loading and filtered-empty states without losing filter recovery', async () => {
    mockState.fileTreeLoaded = false;
    installElectronApi({ fileTreeFilter: 'markdown' });
    const { rerender } = renderWorkspaceSidebar();

    expect(screen.getByTestId('agent-elements-workspace-sidebar-loading')).toHaveAttribute(
      'data-agent-elements-state',
      'loading'
    );

    mockState.fileTreeLoaded = true;
    rerender(
      <WorkspaceSidebar
        workspaceName="Smarty Code"
        workspacePath="/workspace/smarty-code"
        currentFilePath={null}
        currentView="files"
        onFileSelect={vi.fn()}
        onCloseWorkspace={vi.fn()}
      />
    );

    const emptyState = await screen.findByTestId('agent-elements-workspace-sidebar-empty');
    expect(emptyState).toHaveClass('file-tree-empty-state', 'agent-elements-workspace-sidebar-empty');
    expect(emptyState).toHaveAttribute('data-agent-elements-state', 'empty-filtered');
    expect(within(emptyState).getByText('No Markdown Files')).toBeInTheDocument();

    fireEvent.click(within(emptyState).getByRole('button', { name: 'Clear Filter' }));
    await waitFor(() => {
      expect(screen.getByTestId('flat-file-tree')).toHaveAttribute('data-item-count', '0');
    });
  });

  it('keeps source styling constrained to Agent Elements-compatible sidebar chrome', () => {
    const source = readFileSync(workspaceSidebarSourcePath, 'utf8');

    expect(source).toContain('agent-elements-workspace-sidebar');
    expect(source).toContain('data-agent-elements-shell="workspace-sidebar"');
    expect(source).toContain('data-agent-elements-shell="workspace-sidebar-tree"');
    expect(source).not.toMatch(/--nim-accent-subtle|nim-section-label|nim-btn-primary/);
    expect(source).not.toMatch(/transition-all|duration-200|hover:-translate-y-px|bg-gradient-to-b/);
    expect(source).not.toMatch(/bg-white|text-white|shadow-(lg|xl|2xl)|rounded-2xl/);
  });
});
