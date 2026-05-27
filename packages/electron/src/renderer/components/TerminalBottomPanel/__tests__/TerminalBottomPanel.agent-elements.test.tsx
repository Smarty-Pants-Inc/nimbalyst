// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminalBottomPanel } from '../TerminalBottomPanel';

const testDir = dirname(fileURLToPath(import.meta.url));
const sourcePaths = [
  join(testDir, '../TerminalBottomPanel.tsx'),
  join(testDir, '../TerminalTab.tsx'),
];

const mockState = vi.hoisted(() => {
  const terminals = [
    {
      id: 'term-1',
      title: 'Terminal 1',
      shellName: 'zsh',
      shellPath: '/bin/zsh',
      cwd: '/workspace/demo',
      worktreeId: 'wt-1',
      worktreeName: 'feature/ui',
      createdAt: 1,
      lastActiveAt: 2,
    },
    {
      id: 'term-2',
      title: 'Terminal 2',
      shellName: 'bash',
      shellPath: '/bin/bash',
      cwd: '/workspace/demo/packages/electron',
      createdAt: 3,
      lastActiveAt: 4,
    },
  ];

  return {
    tokens: {
      terminalListAtom: 'terminalListAtom',
      activeTerminalIdAtom: 'activeTerminalIdAtom',
      terminalPanelVisibleAtom: 'terminalPanelVisibleAtom',
      terminalPanelHeightAtom: 'terminalPanelHeightAtom',
      terminalPanelHydratedAtom: 'terminalPanelHydratedAtom',
      closeTerminalPanelAtom: 'closeTerminalPanelAtom',
    },
    terminals,
    visible: true,
    height: 320,
    hydrated: true,
    activeTerminalId: 'term-1' as string | undefined,
    selectedWorkstream: { id: 'workstream-1', type: 'worktree' },
    sessionWorktreeId: 'wt-1',
    closePanel: vi.fn(),
    loadTerminals: vi.fn().mockResolvedValue(undefined),
    setActiveTerminal: vi.fn(),
    removeTerminalFromList: vi.fn(),
    initTerminalListeners: vi.fn(() => vi.fn()),
    setTerminalCommandRunning: vi.fn(),
    posthogCapture: vi.fn(),
  };
});

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.terminalListAtom) return mockState.terminals;
    if (atom === mockState.tokens.activeTerminalIdAtom) return mockState.activeTerminalId;
    if (atom === mockState.tokens.terminalPanelVisibleAtom) return mockState.visible;
    if (atom === mockState.tokens.terminalPanelHeightAtom) return mockState.height;
    if (atom === mockState.tokens.terminalPanelHydratedAtom) return mockState.hydrated;
    if (atom === 'selectedWorkstreamAtom:/workspace/demo') return mockState.selectedWorkstream;
    if (atom === 'sessionWorktreeIdAtom:workstream-1') return mockState.sessionWorktreeId;
    if (atom === 'terminalCommandRunningAtom:term-2') return true;
    return false;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.closeTerminalPanelAtom) return mockState.closePanel;
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
      title,
    }: {
      icon: string;
      size?: number;
      className?: string;
      title?: string;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className, title }),
  };
});

vi.mock('@nimbalyst/runtime/store', () => ({
  store: {
    get: vi.fn((atom: string) => {
      if (atom === mockState.tokens.activeTerminalIdAtom) return mockState.activeTerminalId;
      return undefined;
    }),
    set: vi.fn(),
  },
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockState.posthogCapture }),
}));

vi.mock('../../../store/atoms/terminals', () => ({
  terminalListAtom: mockState.tokens.terminalListAtom,
  activeTerminalIdAtom: mockState.tokens.activeTerminalIdAtom,
  terminalPanelVisibleAtom: mockState.tokens.terminalPanelVisibleAtom,
  terminalPanelHeightAtom: mockState.tokens.terminalPanelHeightAtom,
  terminalPanelHydratedAtom: mockState.tokens.terminalPanelHydratedAtom,
  closeTerminalPanelAtom: mockState.tokens.closeTerminalPanelAtom,
  loadTerminals: mockState.loadTerminals,
  setActiveTerminal: mockState.setActiveTerminal,
  removeTerminalFromList: mockState.removeTerminalFromList,
  initTerminalListeners: mockState.initTerminalListeners,
  setTerminalCommandRunning: mockState.setTerminalCommandRunning,
  terminalCommandRunningAtom: (terminalId: string) => `terminalCommandRunningAtom:${terminalId}`,
}));

vi.mock('../../../store/atoms/sessions', () => ({
  selectedWorkstreamAtom: (workspacePath: string) => `selectedWorkstreamAtom:${workspacePath}`,
  sessionWorktreeIdAtom: (workstreamId: string) => `sessionWorktreeIdAtom:${workstreamId}`,
}));

vi.mock('../../Terminal/TerminalPanel', () => ({
  TerminalPanel: ({
    terminalId,
    workspacePath,
    isActive,
  }: {
    terminalId: string;
    workspacePath: string;
    isActive: boolean;
  }) => (
    <div
      data-testid={`mock-terminal-panel-${terminalId}`}
      data-workspace-path={workspacePath}
      data-active={String(isActive)}
    />
  ),
}));

describe('TerminalBottomPanel Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.visible = true;
    mockState.height = 320;
    mockState.hydrated = true;
    mockState.activeTerminalId = 'term-1';
    mockState.terminals.splice(0, mockState.terminals.length, {
      id: 'term-1',
      title: 'Terminal 1',
      shellName: 'zsh',
      shellPath: '/bin/zsh',
      cwd: '/workspace/demo',
      worktreeId: 'wt-1',
      worktreeName: 'feature/ui',
      createdAt: 1,
      lastActiveAt: 2,
    }, {
      id: 'term-2',
      title: 'Terminal 2',
      shellName: 'bash',
      shellPath: '/bin/bash',
      cwd: '/workspace/demo/packages/electron',
      createdAt: 3,
      lastActiveAt: 4,
    });

    (window as any).electronAPI = {
      terminal: {
        create: vi.fn().mockResolvedValue({ success: true, instance: mockState.terminals[0] }),
        delete: vi.fn().mockResolvedValue(undefined),
        setActive: vi.fn().mockResolvedValue(undefined),
        setPanelVisible: vi.fn().mockResolvedValue(undefined),
        setPanelHeight: vi.fn().mockResolvedValue(undefined),
        onCommandRunning: vi.fn(() => vi.fn()),
      },
    };
  });

  it('renders a compact Agent Elements terminal shell while preserving tab, create, and close-panel behavior', async () => {
    render(<TerminalBottomPanel workspacePath="/workspace/demo" minHeight={120} maxHeight={420} />);

    const root = screen.getByTestId('agent-elements-terminal-bottom-panel');
    expect(root).toHaveClass('terminal-bottom-panel-container', 'agent-elements-terminal-bottom-panel');
    expect(root).toHaveAttribute('data-component', 'TerminalBottomPanel');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'terminal-bottom-panel');
    expect(root).toHaveStyle({ height: '320px', display: 'flex' });

    expect(screen.getByTestId('agent-elements-terminal-resize-handle')).toHaveAttribute('data-agent-elements-shell', 'terminal-resize-handle');
    expect(screen.getByTestId('agent-elements-terminal-header')).toHaveClass('agent-elements-terminal-header');
    expect(screen.getByTestId('agent-elements-terminal-tabs')).toHaveClass('agent-elements-terminal-tabs');

    const firstTab = screen.getByTestId('agent-elements-terminal-tab-term-1');
    expect(firstTab).toHaveClass('terminal-tab', 'agent-elements-terminal-tab');
    expect(firstTab).toHaveAttribute('data-terminal-id', 'term-1');
    expect(firstTab).toHaveAttribute('data-active', 'true');
    expect(firstTab).toHaveAttribute('data-worktree-active', 'true');
    expect(firstTab).toHaveAttribute('data-agent-elements-shell', 'terminal-tab');

    const secondTab = screen.getByTestId('agent-elements-terminal-tab-term-2');
    expect(secondTab).toHaveAttribute('data-active', 'false');
    expect(secondTab).toHaveAttribute('data-worktree-active', 'false');
    expect(within(secondTab).getByTestId('agent-elements-terminal-command-running-term-2')).toHaveAttribute('data-state', 'running');

    fireEvent.click(secondTab);
    expect(mockState.setActiveTerminal).toHaveBeenCalledWith('term-2');
    await waitFor(() => {
      expect(window.electronAPI.terminal.setActive).toHaveBeenCalledWith('/workspace/demo', 'term-2');
    });

    fireEvent.click(screen.getByTestId('agent-elements-terminal-new-tab'));
    await waitFor(() => {
      expect(window.electronAPI.terminal.create).toHaveBeenCalledWith('/workspace/demo', {
        cwd: '/workspace/demo',
        title: 'Terminal 3',
        source: 'panel',
      });
    });
    expect(mockState.loadTerminals).toHaveBeenCalledWith('/workspace/demo');

    fireEvent.click(screen.getByTestId('agent-elements-terminal-close-panel'));
    expect(mockState.closePanel).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('mock-terminal-panel-term-1')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('mock-terminal-panel-term-2')).toHaveAttribute('data-active', 'false');
    expect(mockState.initTerminalListeners).toHaveBeenCalledWith('/workspace/demo');
    expect(window.electronAPI.terminal.setPanelVisible).toHaveBeenCalledWith('/workspace/demo', true);
  });

  it('preserves empty-state terminal creation under Agent Elements markers', async () => {
    mockState.terminals.splice(0, mockState.terminals.length);
    mockState.activeTerminalId = undefined;

    render(<TerminalBottomPanel workspacePath="/workspace/demo" />);

    const empty = screen.getByTestId('agent-elements-terminal-empty');
    expect(empty).toHaveClass('agent-elements-terminal-empty', 'agent-elements-tool-card');
    expect(empty).toHaveAttribute('data-agent-elements-shell', 'terminal-empty-state');

    fireEvent.click(screen.getByTestId('agent-elements-terminal-empty-new-tab'));

    await waitFor(() => {
      expect(window.electronAPI.terminal.create).toHaveBeenCalledWith('/workspace/demo', {
        cwd: '/workspace/demo',
        title: 'Terminal 1',
        source: 'panel',
      });
    });
  });

  it('renders the Agent Elements tab context menu while preserving close actions', async () => {
    render(<TerminalBottomPanel workspacePath="/workspace/demo" />);

    fireEvent.contextMenu(screen.getByTestId('agent-elements-terminal-tab-term-1'), {
      clientX: 120,
      clientY: 80,
    });

    const menu = await screen.findByTestId('terminal-tab-context-menu');
    expect(menu).toHaveClass('agent-elements-terminal-tab-menu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'terminal-tab-context-menu');
    expect(menu).toHaveAttribute('data-agent-elements-testid', 'agent-elements-terminal-tab-menu');
    expect(menu).toHaveAttribute('data-terminal-id', 'term-1');

    fireEvent.click(within(menu).getByTestId('agent-elements-terminal-menu-close-others'));

    await waitFor(() => {
      expect(mockState.removeTerminalFromList).toHaveBeenCalledWith('term-2');
      expect(window.electronAPI.terminal.delete).toHaveBeenCalledWith('/workspace/demo', 'term-2');
      expect(window.electronAPI.terminal.setActive).toHaveBeenCalledWith('/workspace/demo', 'term-1');
    });
  });

  it('keeps terminal panel and tab chrome on Agent Elements aliases instead of legacy visual utilities', () => {
    const source = sourcePaths.map((sourcePath) => readFileSync(sourcePath, 'utf8')).join('\n');

    expect(source).toContain('agent-elements-terminal-bottom-panel');
    expect(source).toContain('agent-elements-terminal-tab');
    expect(source).toMatch(/--an-(background|foreground|border|primary|tool|radius|spacing)/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/hover:bg-\[var\(--nim|hover:text-\[var\(--nim/);
    expect(source).not.toMatch(/--nim-/);
    expect(source).not.toMatch(/rounded-md|bg-yellow-400|(?:^|\s)rounded(?:\s|")/);
  });
});
