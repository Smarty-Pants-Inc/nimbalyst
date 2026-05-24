// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackerMode } from '../TrackerMode';

const trackerModeSourcePath = resolve(__dirname, '../TrackerMode.tsx');

const mockState = vi.hoisted(() => ({
  layout: {
    selectedType: 'bug',
    activeFilters: ['mine'],
    viewMode: 'table',
    sidebarWidth: 244,
  },
  setModeLayout: vi.fn(),
  trackerTypes: [
    { type: 'bug', displayNamePlural: 'Bugs', icon: 'bug_report', color: 'var(--nim-error)' },
    { type: 'task', displayNamePlural: 'Tasks', icon: 'task_alt', color: 'var(--nim-info)' },
  ],
  registryListeners: [] as Array<() => void>,
  unsubscribeRegistry: vi.fn(),
  loadBuiltinTrackers: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn(() => mockState.layout),
  useSetAtom: vi.fn(() => mockState.setModeLayout),
}));

vi.mock('@nimbalyst/runtime', () => ({
  // Type-only imports are erased; this mock keeps runtime resolution stable.
}));

vi.mock('@nimbalyst/runtime/plugins/TrackerPlugin/models', () => ({
  globalRegistry: {
    getAll: vi.fn(() => mockState.trackerTypes),
    onChange: vi.fn((callback: () => void) => {
      mockState.registryListeners.push(callback);
      return mockState.unsubscribeRegistry;
    }),
  },
  loadBuiltinTrackers: mockState.loadBuiltinTrackers,
}));

vi.mock('../../../store/atoms/trackers', () => ({
  trackerModeLayoutAtom: 'tracker-mode-layout',
  setTrackerModeLayoutAtom: 'set-tracker-mode-layout',
}));

vi.mock('../TrackerSidebar', async () => {
  const React = await import('react');
  return {
    TrackerSidebar: ({
      workspacePath,
      workspaceName,
      trackerTypes,
      selectedType,
      activeFilters,
      viewMode,
      onSelectType,
      onToggleFilter,
      onViewModeChange,
    }: any) => (
      <div
        data-testid="mock-tracker-sidebar"
        data-workspace-path={workspacePath}
        data-workspace-name={workspaceName}
        data-tracker-types={trackerTypes.length}
        data-selected-type={selectedType}
        data-active-filters={activeFilters.join(',')}
        data-view-mode={viewMode}
      >
        <button type="button" data-testid="mock-select-task" onClick={() => onSelectType('task')} />
        <button type="button" data-testid="mock-toggle-unassigned" onClick={() => onToggleFilter('unassigned')} />
        <button type="button" data-testid="mock-view-kanban" onClick={() => onViewModeChange('kanban')} />
      </div>
    ),
  };
});

vi.mock('../TrackerMainView', async () => {
  const React = await import('react');
  return {
    TrackerMainView: ({ filterType, activeFilters, viewMode, workspacePath, trackerTypes }: any) => (
      <div
        data-testid="mock-tracker-main-view"
        data-filter-type={filterType}
        data-active-filters={activeFilters.join(',')}
        data-view-mode={viewMode}
        data-workspace-path={workspacePath}
        data-tracker-types={trackerTypes.length}
      />
    ),
  };
});

vi.mock('../../AgenticCoding/ResizablePanel', async () => {
  const React = await import('react');
  return {
    ResizablePanel: ({ leftPanel, rightPanel, leftWidth, minWidth, maxWidth, onWidthChange }: any) => (
      <div
        data-testid="mock-resizable-panel"
        data-left-width={leftWidth}
        data-min-width={minWidth}
        data-max-width={maxWidth}
      >
        <button type="button" data-testid="mock-resize-sidebar" onClick={() => onWidthChange(312)} />
        {leftPanel}
        {rightPanel}
      </div>
    ),
  };
});

describe('TrackerMode Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.registryListeners.length = 0;
    mockState.layout = {
      selectedType: 'bug',
      activeFilters: ['mine'],
      viewMode: 'table',
      sidebarWidth: 244,
    };
  });

  it('wraps the tracker layout in Agent Elements chrome while preserving layout props', () => {
    render(
      <TrackerMode
        workspacePath="/work/current"
        workspaceName="current"
        isActive
        onSwitchToFilesMode={vi.fn()}
      />,
    );

    const root = screen.getByTestId('agent-elements-tracker-mode');
    expect(root).toHaveClass('tracker-mode', 'agent-elements-tracker-mode');
    expect(root).toHaveAttribute('data-component', 'TrackerMode');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'tracker-mode');
    expect(root).toHaveAttribute('data-active', 'true');

    expect(screen.getByTestId('mock-resizable-panel')).toHaveAttribute('data-left-width', '244');
    expect(screen.getByTestId('mock-resizable-panel')).toHaveAttribute('data-min-width', '160');
    expect(screen.getByTestId('mock-resizable-panel')).toHaveAttribute('data-max-width', '350');

    expect(screen.getByTestId('mock-tracker-sidebar')).toHaveAttribute('data-workspace-path', '/work/current');
    expect(screen.getByTestId('mock-tracker-sidebar')).toHaveAttribute('data-workspace-name', 'current');
    expect(screen.getByTestId('mock-tracker-sidebar')).toHaveAttribute('data-selected-type', 'bug');
    expect(screen.getByTestId('mock-tracker-sidebar')).toHaveAttribute('data-active-filters', 'mine');
    expect(screen.getByTestId('mock-tracker-sidebar')).toHaveAttribute('data-view-mode', 'table');
    expect(screen.getByTestId('mock-tracker-sidebar')).toHaveAttribute('data-tracker-types', '2');

    expect(screen.getByTestId('mock-tracker-main-view')).toHaveAttribute('data-filter-type', 'bug');
    expect(screen.getByTestId('mock-tracker-main-view')).toHaveAttribute('data-active-filters', 'mine');
    expect(screen.getByTestId('mock-tracker-main-view')).toHaveAttribute('data-view-mode', 'table');
    expect(screen.getByTestId('mock-tracker-main-view')).toHaveAttribute('data-workspace-path', '/work/current');
    expect(screen.getByTestId('mock-tracker-main-view')).toHaveAttribute('data-tracker-types', '2');
  });

  it('preserves tracker layout mutation callbacks inside the Agent Elements shell', () => {
    render(<TrackerMode workspacePath="/work/current" workspaceName="current" isActive />);

    fireEvent.click(screen.getByTestId('mock-select-task'));
    expect(mockState.setModeLayout).toHaveBeenCalledWith({ selectedType: 'task', selectedItemId: null });

    fireEvent.click(screen.getByTestId('mock-toggle-unassigned'));
    expect(mockState.setModeLayout).toHaveBeenCalledWith({ activeFilters: ['unassigned'] });

    fireEvent.click(screen.getByTestId('mock-view-kanban'));
    expect(mockState.setModeLayout).toHaveBeenCalledWith({ viewMode: 'kanban' });

    fireEvent.click(screen.getByTestId('mock-resize-sidebar'));
    expect(mockState.setModeLayout).toHaveBeenCalledWith({ sidebarWidth: 312 });
  });

  it('keeps TrackerMode source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(trackerModeSourcePath, 'utf8');

    expect(source).toContain('agent-elements-tracker-mode');
    expect(source).toContain('data-agent-elements-shell="tracker-mode"');
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/bg-white|text-white|bg-black|hover:scale|tracking-/);
    expect(source).not.toMatch(/--nim-accent|--nim-surface|text-nim-fg|<svg/);
  });
});
