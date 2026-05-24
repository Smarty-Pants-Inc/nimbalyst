// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRail } from '../ProjectRail';

const mockState = vi.hoisted(() => ({
  tokens: {
    multiProjectModeAtom: 'multiProjectModeAtom',
    openProjectsAtom: 'openProjectsAtom',
    activeWorkspacePathAtom: 'activeWorkspacePathAtom',
    isOpenProjectsAtCapAtom: 'isOpenProjectsAtCapAtom',
    addOpenProjectAtom: 'addOpenProjectAtom',
    closeOpenProjectAtom: 'closeOpenProjectAtom',
    globalSessionActivityAtom: 'globalSessionActivityAtom',
    projectActivitySummaryAtom: 'projectActivitySummaryAtom',
  },
  openProjects: [
    { path: '/workspace/app', name: 'App', openedAt: 1 },
    { path: '/workspace/api', name: 'Api Server', openedAt: 2 },
  ],
  activePath: '/workspace/app' as string | null,
  multiProjectMode: true,
  atCap: false,
  activity: new Map<string, { streaming: Set<string>; unread: Set<string> }>(),
  activitySummary: new Map<string, { processing: number; unread: number }>(),
  setActivePath: vi.fn(),
  addProject: vi.fn(),
  closeProject: vi.fn(),
  electronInvoke: vi.fn(),
  alert: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.multiProjectModeAtom) return mockState.multiProjectMode;
    if (atom === mockState.tokens.openProjectsAtom) return mockState.openProjects;
    if (atom === mockState.tokens.isOpenProjectsAtCapAtom) return mockState.atCap;
    if (atom === mockState.tokens.globalSessionActivityAtom) return mockState.activity;
    if (atom === mockState.tokens.projectActivitySummaryAtom) return mockState.activitySummary;
    return undefined;
  }),
  useAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.activeWorkspacePathAtom) {
      return [mockState.activePath, mockState.setActivePath];
    }
    return [undefined, vi.fn()];
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.addOpenProjectAtom) return mockState.addProject;
    if (atom === mockState.tokens.closeOpenProjectAtom) return mockState.closeProject;
    return vi.fn();
  }),
}));

vi.mock('../../store/atoms/openProjects', () => ({
  multiProjectModeAtom: mockState.tokens.multiProjectModeAtom,
  openProjectsAtom: mockState.tokens.openProjectsAtom,
  activeWorkspacePathAtom: mockState.tokens.activeWorkspacePathAtom,
  isOpenProjectsAtCapAtom: mockState.tokens.isOpenProjectsAtCapAtom,
  addOpenProjectAtom: mockState.tokens.addOpenProjectAtom,
  closeOpenProjectAtom: mockState.tokens.closeOpenProjectAtom,
}));

vi.mock('../../store/atoms/sessionActivity', () => ({
  globalSessionActivityAtom: mockState.tokens.globalSessionActivityAtom,
  projectActivitySummaryAtom: mockState.tokens.projectActivitySummaryAtom,
}));

describe('ProjectRail Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.openProjects.splice(
      0,
      mockState.openProjects.length,
      { path: '/workspace/app', name: 'App', openedAt: 1 },
      { path: '/workspace/api', name: 'Api Server', openedAt: 2 }
    );
    mockState.activePath = '/workspace/app';
    mockState.multiProjectMode = true;
    mockState.atCap = false;
    mockState.activity = new Map();
    mockState.activitySummary = new Map([
      ['/workspace/app', { processing: 0, unread: 0 }],
      ['/workspace/api', { processing: 2, unread: 1 }],
    ]);
    mockState.electronInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'settings:get-recent-projects') {
        return [
          { path: '/workspace/app', name: 'App' },
          { path: '/workspace/cli-tools', name: 'CLI Tools' },
        ];
      }
      if (channel === 'workspace:register-additional') return { success: true };
      return undefined;
    });

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { invoke: mockState.electronInvoke },
    });
    vi.spyOn(window, 'alert').mockImplementation(mockState.alert);
    vi.spyOn(window, 'confirm').mockImplementation(mockState.confirm);
  });

  it('renders compact Agent Elements rail chrome while preserving project activation and add-menu behavior', async () => {
    render(<ProjectRail />);

    const root = screen.getByTestId('project-rail');
    expect(root).toHaveClass('project-rail', 'agent-elements-project-rail');
    expect(root).toHaveAttribute('data-component', 'ProjectRail');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'project-rail');

    const items = screen.getAllByTestId('project-rail-item');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveClass('project-rail-item', 'agent-elements-project-rail-item', 'is-active');
    expect(items[0]).toHaveAttribute('data-component', 'ProjectRailIcon');
    expect(items[0]).toHaveAttribute('data-agent-elements-shell', 'project-rail-item');
    expect(items[0]).toHaveAttribute('data-active', 'true');
    expect(items[0]).toHaveAttribute('data-processing-count', '0');
    expect(items[0]).toHaveAttribute('data-unread-count', '0');

    expect(items[1]).toHaveAttribute('data-active', 'false');
    expect(items[1]).toHaveAttribute('data-processing-count', '2');
    expect(items[1]).toHaveAttribute('data-unread-count', '1');
    expect(within(items[1]).getByTestId('agent-elements-project-rail-badge--workspace-api')).toHaveAttribute(
      'data-tone',
      'running'
    );

    fireEvent.click(screen.getByTestId('agent-elements-project-rail-activate--workspace-api'));
    expect(mockState.setActivePath).toHaveBeenCalledWith('/workspace/api');

    const addButton = screen.getByTestId('project-rail-add');
    expect(addButton).toHaveClass('project-rail-add', 'agent-elements-project-rail-add');
    expect(addButton).toHaveAttribute('data-agent-elements-shell', 'project-rail-add');
    fireEvent.click(addButton);

    const addMenu = await screen.findByTestId('project-rail-add-menu');
    expect(addMenu).toHaveClass('project-rail-context-menu', 'agent-elements-project-rail-menu', 'agent-elements-tool-card');
    expect(addMenu).toHaveAttribute('data-agent-elements-shell', 'project-rail-add-menu');

    fireEvent.click(screen.getByText('CLI Tools'));
    await waitFor(() => {
      expect(mockState.electronInvoke).toHaveBeenCalledWith('workspace:register-additional', {
        workspacePath: '/workspace/cli-tools',
      });
    });
    expect(mockState.addProject).toHaveBeenCalledWith({
      path: '/workspace/cli-tools',
      name: 'cli-tools',
      openedAt: expect.any(Number),
    });
  });

  it('keeps the context menu and close confirmation behavior under the Agent Elements shell', async () => {
    mockState.activity = new Map([
      ['/workspace/api', { streaming: new Set(['session-1']), unread: new Set() }],
    ]);
    mockState.confirm.mockReturnValueOnce(false);

    render(<ProjectRail />);

    const apiItem = screen.getAllByTestId('project-rail-item')[1];
    fireEvent.contextMenu(apiItem);

    const contextMenu = await screen.findByTestId('project-rail-context-menu');
    expect(contextMenu).toHaveClass('project-rail-context-menu', 'agent-elements-project-rail-menu', 'agent-elements-tool-card');
    expect(contextMenu).toHaveAttribute('data-agent-elements-shell', 'project-rail-context-menu');

    fireEvent.click(screen.getByText('Open in new window'));
    await waitFor(() => {
      expect(mockState.electronInvoke).toHaveBeenCalledWith('workspace-manager:open-workspace', '/workspace/api');
    });

    fireEvent.click(screen.getByTestId('agent-elements-project-rail-close--workspace-api'));
    expect(mockState.confirm).toHaveBeenCalledWith(
      'Api Server has 1 streaming session. Close anyway? Sessions will be paused.'
    );
    expect(mockState.closeProject).not.toHaveBeenCalled();
    expect(mockState.electronInvoke).not.toHaveBeenCalledWith('workspace:unregister-additional', {
      workspacePath: '/workspace/api',
    });
  });
});
