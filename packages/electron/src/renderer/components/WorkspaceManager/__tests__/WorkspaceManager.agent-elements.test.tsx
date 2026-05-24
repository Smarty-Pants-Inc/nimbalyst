// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceManager } from '../WorkspaceManager';

vi.mock('../../../hooks/useFloatingMenu', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');

  return {
    FloatingPortal: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    virtualElement: (x: number, y: number) => ({
      getBoundingClientRect: () => ({
        x,
        y,
        top: y,
        right: x,
        bottom: y,
        left: x,
        width: 0,
        height: 0,
      }),
    }),
    useFloatingMenu: (options: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) => ({
      isOpen: options.open ?? false,
      setIsOpen: options.onOpenChange ?? vi.fn(),
      refs: {
        setReference: vi.fn(),
        setFloating: vi.fn(),
        setPositionReference: vi.fn(),
      },
      floatingStyles: { position: 'fixed', left: 12, top: 24 },
      getReferenceProps: () => ({}),
      getFloatingProps: () => ({ role: 'menu' }),
      context: {},
    }),
  };
});

const workspaceManagerSourcePath = resolve(
  process.cwd(),
  'packages/electron/src/renderer/components/WorkspaceManager/WorkspaceManager.tsx'
);

const recentWorkspaces = [
  {
    path: '/workspace/smarty-code',
    name: 'Smarty Code',
    lastOpened: Date.now(),
    markdownCount: 42,
    exists: true,
  },
  {
    path: '/workspace/daily-driver',
    name: 'Daily Driver',
    lastOpened: Date.now() - 86_400_000,
    markdownCount: 8,
    exists: true,
  },
];

const workspaceStats = {
  fileCount: 120,
  markdownCount: 42,
  totalSize: 1024 * 1024 * 3,
  recentFiles: ['README.md', 'docs/plan.md'],
};

function installWorkspaceApi(workspaces = recentWorkspaces) {
  const api = {
    workspaceManager: {
      getRecentWorkspaces: vi.fn().mockResolvedValue(workspaces),
      getWorkspaceStats: vi.fn().mockResolvedValue(workspaceStats),
      openWorkspace: vi.fn().mockResolvedValue(undefined),
      openFolderDialog: vi.fn().mockResolvedValue({ success: true, path: '/workspace/new' }),
      createWorkspaceDialog: vi.fn().mockResolvedValue({ success: true, path: '/workspace/created' }),
      removeRecent: vi.fn().mockResolvedValue(undefined),
    },
    projectMigration: {
      canMove: vi.fn().mockResolvedValue({ canMove: true }),
      move: vi.fn().mockResolvedValue({ success: true, newPath: '/workspace/new/smarty-code' }),
      rename: vi.fn().mockResolvedValue({ success: true, newPath: '/workspace/smarty-code-renamed' }),
    },
  };

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: api,
  });

  return api;
}

describe('WorkspaceManager Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it('renders a branded Agent Elements workspace-picker shell for the empty recent-project state', async () => {
    const api = installWorkspaceApi([]);

    render(<WorkspaceManager />);

    await waitFor(() => {
      expect(api.workspaceManager.getRecentWorkspaces).toHaveBeenCalled();
    });

    const shell = screen.getByTestId('agent-elements-workspace-manager');
    expect(shell).toHaveClass('workspace-manager', 'agent-elements-workspace-manager');
    expect(shell).toHaveAttribute('data-component', 'WorkspaceManager');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'workspace-manager');

    expect(screen.getByTestId('agent-elements-workspace-manager-sidebar')).toHaveAttribute(
      'data-agent-elements-shell',
      'workspace-manager-sidebar'
    );
    expect(screen.getByTestId('agent-elements-workspace-manager-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'workspace-manager-header'
    );

    const welcome = screen.getByTestId('agent-elements-workspace-manager-welcome');
    expect(welcome).toHaveClass('workspace-manager-welcome', 'agent-elements-workspace-manager-welcome');
    expect(welcome).toHaveAttribute('data-agent-elements-shell', 'workspace-manager-welcome');
    expect(screen.getByRole('heading', { level: 1, name: 'Smarty Code' })).toBeInTheDocument();
    expect(screen.getByText('No recent projects')).toBeInTheDocument();
  });

  it('preserves project selection, stats loading, open, and context-menu actions inside the Agent Elements shell', async () => {
    const api = installWorkspaceApi();

    render(<WorkspaceManager />);

    const workspaceList = await screen.findByTestId('agent-elements-workspace-manager-list');
    const smartyRow = within(workspaceList).getByText('Smarty Code').closest('.workspace-item');
    expect(smartyRow).toBeTruthy();
    expect(smartyRow).toHaveClass('agent-elements-workspace-manager-item');
    expect(smartyRow).toHaveAttribute('data-agent-elements-shell', 'workspace-manager-item');

    fireEvent.click(smartyRow!);

    await waitFor(() => {
      expect(api.workspaceManager.getWorkspaceStats).toHaveBeenCalledWith('/workspace/smarty-code');
    });

    expect(smartyRow).toHaveAttribute('data-selected', 'true');
    const details = await screen.findByTestId('agent-elements-workspace-manager-details');
    expect(details).toHaveAttribute('data-agent-elements-shell', 'workspace-manager-details');
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Project' }));
    expect(api.workspaceManager.openWorkspace).toHaveBeenCalledWith('/workspace/smarty-code');

    fireEvent.contextMenu(smartyRow!);
    const menu = screen.getByTestId('agent-elements-workspace-manager-context-menu');
    expect(menu).toHaveClass('agent-elements-workspace-manager-context-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'workspace-manager-context-menu');

    fireEvent.click(within(menu).getByRole('menuitem', { name: /Remove from Recent/i }));
    await waitFor(() => {
      expect(api.workspaceManager.removeRecent).toHaveBeenCalledWith('/workspace/smarty-code');
    });
  });

  it('uses Floating UI and avoids rejected legacy first-screen styling', () => {
    const source = readFileSync(workspaceManagerSourcePath, 'utf8');

    expect(source).toContain('useFloatingMenu');
    expect(source).toContain('FloatingPortal');
    expect(source).toContain('virtualElement');
    expect(source).not.toMatch(/bg-gradient-to-br|radial-gradient|backdrop-blur|rounded-2xl/);
    expect(source).not.toMatch(/shadow-(lg|xl|2xl)|rgba\(|bg-black\/|text-white|bg-white/);
    expect(source).not.toMatch(/nim-btn-primary|nim-btn-secondary|nim-input/);
  });
});
