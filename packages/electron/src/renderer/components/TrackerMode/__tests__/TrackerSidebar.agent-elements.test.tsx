// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackerSidebar } from '../TrackerSidebar';
import type { TrackerFilterChip } from '../../../store/atoms/trackers';

const trackerSidebarSourcePath = resolve(__dirname, '../TrackerSidebar.tsx');

const mockState = vi.hoisted(() => ({
  counts: new Map<string, number>([
    ['bug', 7],
    ['task', 3],
  ]),
  trackerItemCountByTypeAtom: vi.fn((type: string) => `tracker-count:${type}`),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom.startsWith('tracker-count:')) {
      return mockState.counts.get(atom.replace('tracker-count:', '')) ?? 0;
    }
    return 0;
  }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const React = await import('react');
  return {
    MaterialSymbol: ({ icon, className, size }: { icon: string; className?: string; size?: number }) =>
      React.createElement('span', { className, 'data-icon': icon, 'data-size': size }, icon),
  };
});

vi.mock('@nimbalyst/runtime/plugins/TrackerPlugin', () => ({
  trackerItemCountByTypeAtom: mockState.trackerItemCountByTypeAtom,
}));

vi.mock('../../WorkspaceSummaryHeader', async () => {
  const React = await import('react');
  return {
    WorkspaceSummaryHeader: ({
      workspacePath,
      workspaceName,
      actions,
    }: {
      workspacePath: string;
      workspaceName?: string;
      actions?: React.ReactNode;
    }) => (
      <div data-testid="workspace-summary-header" data-path={workspacePath} data-name={workspaceName}>
        {actions}
      </div>
    ),
  };
});

vi.mock('../../common/AlphaBadge', async () => {
  const React = await import('react');
  return {
    AlphaBadge: ({ className }: { className?: string }) =>
      React.createElement('span', { className, 'data-testid': 'alpha-badge' }, 'alpha'),
  };
});

const trackerTypes = [
  {
    type: 'bug',
    displayNamePlural: 'Bugs',
    icon: 'bug_report',
    color: 'var(--nim-error)',
  },
  {
    type: 'task',
    displayNamePlural: 'Tasks',
    icon: 'task_alt',
    color: 'var(--nim-info)',
  },
] as any[];

interface RenderSidebarOptions {
  selectedType?: string | 'all';
  activeFilters?: TrackerFilterChip[];
  viewMode?: 'table' | 'kanban';
}

function renderSidebar({
  selectedType = 'all',
  activeFilters = ['mine', 'high-priority'] as TrackerFilterChip[],
  viewMode = 'table',
}: RenderSidebarOptions = {}) {
  const onSelectType = vi.fn();
  const onToggleFilter = vi.fn();
  const onViewModeChange = vi.fn();

  render(
    <TrackerSidebar
      workspacePath="/work/current"
      workspaceName="current"
      trackerTypes={trackerTypes}
      selectedType={selectedType}
      activeFilters={activeFilters}
      viewMode={viewMode}
      onSelectType={onSelectType}
      onToggleFilter={onToggleFilter}
      onViewModeChange={onViewModeChange}
    />,
  );

  return { onSelectType, onToggleFilter, onViewModeChange };
}

describe('TrackerSidebar Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Agent Elements sidebar markers while preserving view-mode and filter callbacks', () => {
    const { onToggleFilter, onViewModeChange } = renderSidebar();

    const sidebar = screen.getByTestId('tracker-sidebar');
    expect(sidebar).toHaveClass('tracker-sidebar', 'agent-elements-tracker-sidebar');
    expect(sidebar).toHaveAttribute('data-component', 'TrackerSidebar');
    expect(sidebar).toHaveAttribute('data-agent-elements-shell', 'tracker-sidebar');

    expect(screen.getByTestId('agent-elements-tracker-sidebar-header')).toHaveTextContent('Trackers');
    expect(screen.getByTestId('agent-elements-tracker-sidebar-view-toggle')).toHaveAttribute(
      'data-agent-elements-shell',
      'tracker-sidebar-view-toggle',
    );

    fireEvent.click(screen.getByTestId('tracker-view-mode-kanban'));
    expect(onViewModeChange).toHaveBeenCalledWith('kanban');
    fireEvent.click(screen.getByTestId('tracker-view-mode-table'));
    expect(onViewModeChange).toHaveBeenCalledWith('table');

    fireEvent.click(screen.getByTestId('tracker-filter-unassigned'));
    expect(onToggleFilter).toHaveBeenCalledWith('unassigned');

    fireEvent.click(screen.getByTestId('agent-elements-tracker-clear-filters'));
    expect(onToggleFilter).toHaveBeenCalledWith('mine');
    expect(onToggleFilter).toHaveBeenCalledWith('high-priority');
  });

  it('preserves tracker type selection and per-type counts inside Agent Elements rows', () => {
    const { onSelectType } = renderSidebar({ selectedType: 'bug', activeFilters: [], viewMode: 'kanban' });

    fireEvent.click(screen.getByTestId('agent-elements-tracker-type-all'));
    expect(onSelectType).toHaveBeenCalledWith('all');

    const trackerButtons = screen.getAllByTestId('tracker-type-button');
    expect(trackerButtons).toHaveLength(2);
    expect(trackerButtons[0]).toHaveClass('agent-elements-tracker-type-row');
    expect(trackerButtons[0]).toHaveAttribute('data-tracker-type', 'bug');
    expect(within(trackerButtons[0]).getByTestId('agent-elements-tracker-type-count')).toHaveTextContent('7');
    expect(within(trackerButtons[1]).getByTestId('agent-elements-tracker-type-count')).toHaveTextContent('3');

    fireEvent.click(trackerButtons[1]);
    expect(onSelectType).toHaveBeenCalledWith('task');
  });

  it('keeps TrackerSidebar source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(trackerSidebarSourcePath, 'utf8');

    expect(source).toContain('agent-elements-tracker-sidebar');
    expect(source).toContain('agent-elements-tracker-filter-chip');
    expect(source).toContain('agent-elements-tracker-type-row');
    expect(source).toContain('data-agent-elements-shell="tracker-sidebar"');

    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/bg-white|text-white|bg-black|hover:scale|tracking-/);
    expect(source).not.toMatch(/--nim-accent|--nim-surface|text-nim-fg|<svg/);
  });
});
