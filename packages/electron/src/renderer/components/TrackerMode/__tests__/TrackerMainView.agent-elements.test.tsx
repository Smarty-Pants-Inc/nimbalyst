// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackerMainView } from '../TrackerMainView';

const sourcePath = resolve(__dirname, '../TrackerMainView.tsx');

const mockState = vi.hoisted(() => {
  const tokens = {
    trackerModeLayoutAtom: 'trackerModeLayoutAtom',
    setTrackerModeLayoutAtom: 'setTrackerModeLayoutAtom',
    trackerItemsMapAtom: 'trackerItemsMapAtom',
    activeTeamOrgIdAtom: 'activeTeamOrgIdAtom',
    setSelectedWorkstreamAtom: 'setSelectedWorkstreamAtom',
    sessionRegistryAtom: 'sessionRegistryAtom',
    refreshSessionListAtom: 'refreshSessionListAtom',
    workstreamStateAtom: 'workstreamStateAtom',
    setWindowModeAtom: 'setWindowModeAtom',
    defaultAgentModelAtom: 'defaultAgentModelAtom',
  };

  return {
    tokens,
    layout: {
      selectedItemId: null as string | null,
      detailPanelWidth: 420,
      typeColumnConfigs: {},
    },
    activeItems: [
      {
        id: 'task-1',
        primaryType: 'task',
        typeTags: ['task'],
        source: 'native',
        fields: { title: 'Polish tracker toolbar', status: 'todo', priority: 'medium' },
        system: { documentPath: null, lastIndexed: '2026-05-26T00:00:00Z' },
      },
    ],
    archivedItems: [] as unknown[],
    trackerItemsMap: new Map<string, any>(),
    sessionRegistry: new Map<string, any>(),
    setModeLayout: vi.fn(),
    setSelectedWorkstream: vi.fn(),
    setWindowMode: vi.fn(),
    refreshSessionList: vi.fn().mockResolvedValue(undefined),
    defaultSetAtom: vi.fn(),
    initSessionList: vi.fn(),
    bulkImportTrackerItems: vi.fn().mockResolvedValue({ success: true, imported: 2, skipped: 1, errors: [] }),
    createTrackerItem: vi.fn().mockResolvedValue({ success: true, item: { id: 'task-created' } }),
  };
});

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.trackerModeLayoutAtom) return mockState.layout;
    if (atom === 'tracker-items:task') return mockState.activeItems;
    if (atom === 'archived-tracker-items:task') return mockState.archivedItems;
    if (atom === mockState.tokens.activeTeamOrgIdAtom) return 'org_123';
    if (atom === mockState.tokens.sessionRegistryAtom) return mockState.sessionRegistry;
    if (atom === mockState.tokens.defaultAgentModelAtom) return 'smarty-server/gpt-5';
    return undefined;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.setTrackerModeLayoutAtom) return mockState.setModeLayout;
    if (atom === mockState.tokens.setSelectedWorkstreamAtom) return mockState.setSelectedWorkstream;
    if (atom === mockState.tokens.refreshSessionListAtom) return mockState.refreshSessionList;
    if (atom === mockState.tokens.setWindowModeAtom) return mockState.setWindowMode;
    return mockState.defaultSetAtom;
  }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
      style,
    }: {
      icon: string;
      size?: number;
      className?: string;
      style?: React.CSSProperties;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className, style }, icon),
  };
});

vi.mock('@nimbalyst/runtime/ai/server/types', () => ({
  ModelIdentifier: {
    tryParse: vi.fn(() => ({ provider: 'smarty-server' })),
  },
}));

vi.mock('@nimbalyst/runtime/ai/modelConstants', () => ({
  DEFAULT_MODELS: {
    'smarty-server': 'smarty-server/gpt-5',
  },
}));

vi.mock('@nimbalyst/runtime/plugins/TrackerPlugin', async () => {
  return {
    TrackerTable: ({ searchQuery, onNewItem, onItemSelect, overrideItems }: any) => (
      <div
        data-testid="mock-tracker-table"
        data-search-query={searchQuery}
        data-item-count={overrideItems.length}
      >
        <button type="button" data-testid="mock-table-new-bug" onClick={() => onNewItem('bug')} />
        <button type="button" data-testid="mock-table-select-task" onClick={() => onItemSelect('task-1')} />
      </div>
    ),
    TrackerTableGrid: ({ searchQuery }: any) => (
      <div data-testid="mock-tracker-table-grid" data-search-query={searchQuery} />
    ),
    trackerItemsByTypeAtom: (type: string) => `tracker-items:${type}`,
    archivedTrackerItemsAtom: (type: string) => `archived-tracker-items:${type}`,
    getDefaultColumnConfig: () => ({
      visibleColumns: ['type', 'key', 'title', 'status'],
    }),
  };
});

vi.mock('@nimbalyst/runtime/plugins/TrackerPlugin/trackerRecordAccessors', () => ({
  getRecordTitle: (record: any) => record.fields?.title ?? record.id,
  getRecordPriority: (record: any) => record.fields?.priority ?? '',
  getRecordStatus: (record: any) => record.fields?.status ?? '',
  getRecordFieldStr: (record: any, field: string) => String(record.fields?.[field] ?? ''),
  getFieldByRole: () => undefined,
  isMyRecord: () => true,
}));

vi.mock('@nimbalyst/runtime/plugins/TrackerPlugin/trackerDataAtoms', () => ({
  trackerItemsMapAtom: mockState.tokens.trackerItemsMapAtom,
}));

vi.mock('../../../store/atoms/trackers', () => ({
  trackerModeLayoutAtom: mockState.tokens.trackerModeLayoutAtom,
  setTrackerModeLayoutAtom: mockState.tokens.setTrackerModeLayoutAtom,
}));

vi.mock('../../../store/atoms/collabDocuments', () => ({
  activeTeamOrgIdAtom: mockState.tokens.activeTeamOrgIdAtom,
  buildTrackerDeepLink: (itemId: string, orgId: string) => `nimbalyst://tracker/${orgId}/${itemId}`,
}));

vi.mock('../../../store/atoms/sessions', () => ({
  setSelectedWorkstreamAtom: mockState.tokens.setSelectedWorkstreamAtom,
  sessionRegistryAtom: mockState.tokens.sessionRegistryAtom,
  refreshSessionListAtom: mockState.tokens.refreshSessionListAtom,
  initSessionList: mockState.initSessionList,
}));

vi.mock('../../../store/atoms/workstreamState', () => ({
  workstreamStateAtom: () => mockState.tokens.workstreamStateAtom,
}));

vi.mock('../../../store/atoms/windowMode', () => ({
  setWindowModeAtom: mockState.tokens.setWindowModeAtom,
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  defaultAgentModelAtom: mockState.tokens.defaultAgentModelAtom,
}));

vi.mock('../../../store', () => ({
  store: {
    get: vi.fn((atom: string) => {
      if (atom === mockState.tokens.sessionRegistryAtom) return mockState.sessionRegistry;
      if (atom === mockState.tokens.trackerItemsMapAtom) return mockState.trackerItemsMap;
      if (atom === mockState.tokens.workstreamStateAtom) return { type: 'session' };
      return undefined;
    }),
  },
}));

vi.mock('../../../services/ErrorNotificationService', () => ({
  errorNotificationService: {
    showInfo: vi.fn(),
    showError: vi.fn(),
  },
}));

vi.mock('../../../hooks/useTrackerBodyPrewarm', () => ({
  useTrackerBodyPrewarm: vi.fn(),
}));

vi.mock('../KanbanBoard', () => ({
  KanbanBoard: ({ searchQuery }: any) => (
    <div data-testid="mock-kanban-board" data-search-query={searchQuery} />
  ),
}));

vi.mock('../TrackerItemDetail', () => ({
  TrackerItemDetail: ({ itemId, onClose }: any) => (
    <div data-testid="mock-tracker-item-detail" data-item-id={itemId}>
      <button type="button" data-testid="mock-detail-close" onClick={onClose} />
    </div>
  ),
}));

vi.mock('../TrackerSyncRejectionBanner', () => ({
  TrackerSyncRejectionBanner: ({ workspacePath }: any) => (
    <div data-testid="mock-tracker-sync-rejection-banner" data-workspace-path={workspacePath} />
  ),
}));

const trackerTypes = [
  {
    type: 'task',
    displayName: 'Task',
    displayNamePlural: 'Tasks',
    icon: 'task_alt',
    color: 'var(--an-primary-color)',
    idPrefix: 'TASK',
    creatable: true,
    roles: { workflowStatus: 'status' },
    sync: { mode: 'local' },
    fields: [{ name: 'status', default: 'todo' }],
  },
  {
    type: 'automation',
    displayName: 'Automation',
    displayNamePlural: 'Automations',
    icon: 'smart_toy',
    color: 'var(--an-warning-color)',
    creatable: false,
    roles: { workflowStatus: 'status' },
    fields: [],
  },
] as any[];

function renderMainView(overrides: Partial<React.ComponentProps<typeof TrackerMainView>> = {}) {
  render(
    <TrackerMainView
      filterType="task"
      activeFilters={[]}
      viewMode="list"
      onViewModeChange={vi.fn()}
      onSwitchToFilesMode={vi.fn()}
      workspacePath="/work/current"
      trackerTypes={trackerTypes}
      {...overrides}
    />,
  );
}

describe('TrackerMainView Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.layout = {
      selectedItemId: null,
      detailPanelWidth: 420,
      typeColumnConfigs: {},
    };
    mockState.activeItems = [
      {
        id: 'task-1',
        primaryType: 'task',
        typeTags: ['task'],
        source: 'native',
        fields: { title: 'Polish tracker toolbar', status: 'todo', priority: 'medium' },
        system: { documentPath: null, lastIndexed: '2026-05-26T00:00:00Z' },
      },
    ];
    mockState.trackerItemsMap.clear();
    mockState.sessionRegistry.clear();
    mockState.bulkImportTrackerItems.mockResolvedValue({ success: true, imported: 2, skipped: 1, errors: [] });
    mockState.createTrackerItem.mockResolvedValue({ success: true, item: { id: 'task-created' } });
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: vi.fn().mockResolvedValue({ success: false }),
        documentService: {
          bulkImportTrackerItems: mockState.bulkImportTrackerItems,
          createTrackerItem: mockState.createTrackerItem,
          archiveTrackerItem: vi.fn().mockResolvedValue({ success: true }),
          deleteTrackerItem: vi.fn().mockResolvedValue({ success: true }),
        },
        aiCreateSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
      },
    });
  });

  it('wraps toolbar/search/import controls in Agent Elements chrome while preserving callbacks', async () => {
    renderMainView();

    const root = screen.getByTestId('agent-elements-tracker-main-view');
    expect(root).toHaveClass('tracker-main-view', 'agent-elements-tracker-main-view');
    expect(root).toHaveAttribute('data-component', 'TrackerMainView');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'tracker-main-view');

    const toolbar = screen.getByTestId('agent-elements-tracker-toolbar');
    expect(toolbar).toHaveAttribute('data-agent-elements-shell', 'tracker-toolbar');
    expect(screen.getByTestId('agent-elements-tracker-toolbar-title')).toHaveTextContent('Tasks');

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'toolbar' } });
    expect(screen.getByTestId('mock-tracker-table')).toHaveAttribute('data-search-query', 'toolbar');

    fireEvent.click(screen.getByTestId('agent-elements-tracker-search-clear'));
    expect(screen.getByTestId('mock-tracker-table')).toHaveAttribute('data-search-query', '');

    fireEvent.click(screen.getByTestId('agent-elements-tracker-import-button'));
    const importMenu = screen.getByTestId('agent-elements-tracker-import-menu');
    expect(importMenu).toHaveAttribute('data-agent-elements-shell', 'tracker-import-menu');
    fireEvent.click(within(importMenu).getByText('Import from plans/'));

    await waitFor(() => {
      expect(mockState.bulkImportTrackerItems).toHaveBeenCalledWith({
        directory: 'plans',
        skipDuplicates: true,
        recursive: true,
      });
    });
    expect(screen.getByTestId('agent-elements-tracker-import-status')).toHaveTextContent('2 imported, 1 skipped');
  });

  it('uses the Agent Elements quick-add shell while preserving create payloads', async () => {
    renderMainView();

    fireEvent.click(screen.getByTestId('tracker-toolbar-new-button'));

    const quickAdd = screen.getByTestId('agent-elements-tracker-quick-add');
    expect(quickAdd).toHaveClass('agent-elements-tracker-quick-add');
    expect(quickAdd).toHaveAttribute('data-agent-elements-shell', 'tracker-quick-add');
    expect(screen.getByTestId('tracker-quick-add-input')).toHaveFocus();

    fireEvent.change(screen.getByTestId('tracker-quick-add-input'), { target: { value: 'Fix card gutters' } });
    fireEvent.change(screen.getByTestId('agent-elements-tracker-quick-add-priority'), { target: { value: 'high' } });
    fireEvent.click(screen.getByTestId('agent-elements-tracker-quick-add-submit'));

    await waitFor(() => {
      expect(mockState.createTrackerItem).toHaveBeenCalledWith(expect.objectContaining({
        type: 'task',
        title: 'Fix card gutters',
        status: 'todo',
        priority: 'high',
        workspace: '/work/current',
        syncMode: 'local',
      }));
    });
    expect(mockState.setModeLayout).toHaveBeenCalledWith({ selectedItemId: 'task-created' });
  });

  it('keeps TrackerMainView source on Agent Elements-compatible toolbar rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-tracker-main-view');
    expect(source).toContain('agent-elements-tracker-toolbar');
    expect(source).toContain('agent-elements-tracker-quick-add');
    expect(source).toContain('data-agent-elements-shell="tracker-main-view"');
    expect(source).not.toContain('tracker-toolbar flex items-center gap-2 px-3 py-2 border-b border-nim bg-nim');
    expect(source).not.toContain('bg-nim border border-nim rounded-md shadow-lg');
    expect(source).not.toContain('bg-nim-secondary border-b border-nim shadow-sm');
    expect(source).not.toContain('text-white bg-[var(--nim-primary)] rounded');
  });
});
