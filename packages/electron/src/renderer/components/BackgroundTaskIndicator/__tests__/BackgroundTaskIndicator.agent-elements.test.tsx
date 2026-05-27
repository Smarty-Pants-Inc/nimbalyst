// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundTaskIndicator } from '../BackgroundTaskIndicator';

const sourcePath = resolve(__dirname, '../BackgroundTaskIndicator.tsx');

const mockState = vi.hoisted(() => ({
  atoms: {
    backgroundTaskCountAtom: 'backgroundTaskCountAtom',
    backgroundTaskHasErrorAtom: 'backgroundTaskHasErrorAtom',
    backgroundTasksByCategoryAtom: 'backgroundTasksByCategoryAtom',
    backgroundTaskSyncStatusAtom: 'backgroundTaskSyncStatusAtom',
    syncStatusUpdateAtom: 'syncStatusUpdateAtom',
  },
  setSyncStatus: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.atoms.backgroundTaskCountAtom) {
      return 2;
    }
    if (atom === mockState.atoms.backgroundTaskHasErrorAtom) {
      return true;
    }
    if (atom === mockState.atoms.backgroundTasksByCategoryAtom) {
      return {
        aiSessions: [
          {
            id: 'ai-session:session-1',
            category: 'ai-session',
            label: 'Review branch',
            detail: 'AI session is running',
            status: 'running',
            startedAt: Date.now() - 65_000,
            sessionId: 'session-1',
            provider: 'claude-code',
          },
        ],
        sync: [
          {
            id: 'sync:status',
            category: 'sync',
            label: 'Sync',
            detail: 'Token expired',
            status: 'error',
            startedAt: Date.now() - 30_000,
          },
        ],
      };
    }
    if (atom === mockState.atoms.backgroundTaskSyncStatusAtom) {
      return {
        appConfigured: true,
        projectEnabled: true,
        connected: false,
        syncing: false,
        error: 'Token expired',
        stats: { sessionCount: 4, lastSyncedAt: Date.now() - 120_000 },
        lastUpdatedAt: Date.now() - 30_000,
      };
    }
    if (atom === mockState.atoms.syncStatusUpdateAtom) {
      return null;
    }
    return undefined;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.atoms.backgroundTaskSyncStatusAtom) {
      return mockState.setSyncStatus;
    }
    return vi.fn();
  }),
}));

vi.mock('../../../store/atoms/backgroundTasks', () => ({
  backgroundTaskCountAtom: mockState.atoms.backgroundTaskCountAtom,
  backgroundTaskHasErrorAtom: mockState.atoms.backgroundTaskHasErrorAtom,
  backgroundTasksByCategoryAtom: mockState.atoms.backgroundTasksByCategoryAtom,
  backgroundTaskSyncStatusAtom: mockState.atoms.backgroundTaskSyncStatusAtom,
}));

vi.mock('../../../store/atoms/syncStatus', () => ({
  syncStatusUpdateAtom: mockState.atoms.syncStatusUpdateAtom,
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
    ProviderIcon: ({ provider, size }: { provider: string; size?: number }) =>
      ReactModule.createElement('span', { 'data-provider': provider, 'data-size': size }),
  };
});

vi.mock('../../../help', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    HelpTooltip: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

vi.mock('../../../hooks/useFloatingMenu', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    FloatingPortal: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useFloatingMenu: () => {
      const [isOpen, setIsOpen] = ReactModule.useState(false);
      return {
        isOpen,
        setIsOpen,
        refs: {
          setReference: vi.fn(),
          setFloating: vi.fn(),
        },
        floatingStyles: {},
        getReferenceProps: () => ({}),
        getFloatingProps: () => ({}),
      };
    },
  };
});

function installElectronApi() {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === 'sync:get-status') {
      return {
        appConfigured: true,
        projectEnabled: true,
        connected: false,
        syncing: false,
        error: 'Token expired',
        stats: { sessionCount: 4, lastSyncedAt: Date.now() - 120_000 },
        lastUpdatedAt: Date.now(),
      };
    }
    return undefined;
  });

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke },
  });

  Object.defineProperty(window, 'IS_DEV_MODE', {
    configurable: true,
    value: true,
  });

  return { invoke };
}

describe('BackgroundTaskIndicator Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installElectronApi();
  });

  it('renders the dev-mode task popover with Agent Elements shell markers while preserving task actions', async () => {
    const onOpenSession = vi.fn();
    render(<BackgroundTaskIndicator workspacePath="/workspace/app" onOpenSession={onOpenSession} />);

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('sync:get-status', '/workspace/app');
    });
    expect(window.electronAPI.invoke).toHaveBeenCalledWith('sync:subscribe-status');

    const button = screen.getByTestId('gutter-background-tasks-button');
    expect(button).toHaveClass(
      'nav-button',
      'agent-elements-background-task-button'
    );
    expect(button).toHaveAttribute('data-component', 'BackgroundTaskIndicator');
    expect(button).toHaveAttribute('data-agent-elements-shell', 'background-task-button');
    expect(button).toHaveAttribute('aria-label', 'Background tasks have an error');

    fireEvent.click(button);

    const popover = screen.getByTestId('background-tasks-popover');
    expect(popover).toHaveClass(
      'agent-elements-background-tasks-popover',
      'agent-elements-tool-card'
    );
    expect(popover).toHaveAttribute('data-agent-elements-shell', 'background-tasks-popover');
    expect(popover).toHaveAttribute('data-agent-elements-card-padding', 'sectioned-symmetric');
    expect(popover).toHaveAttribute('data-agent-elements-card-width', 'floating-popover');

    const aiRow = screen.getByTestId('agent-elements-background-task-row-ai-session-session-1');
    expect(aiRow).toHaveAttribute('data-agent-elements-shell', 'background-task-row');
    expect(aiRow).toHaveAttribute('data-task-status', 'running');
    expect(within(aiRow).getByText('Review branch')).toBeInTheDocument();

    const syncRow = screen.getByTestId('agent-elements-background-task-row-sync-status');
    expect(syncRow).toHaveAttribute('data-task-status', 'error');
    expect(within(syncRow).getByText('Token expired')).toBeInTheDocument();

    fireEvent.click(within(aiRow).getByRole('button', { name: /view/i }));
    expect(onOpenSession).toHaveBeenCalledWith('session-1');
  });

  it('keeps the background task indicator on Agent Elements-compatible source rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-background-task-button');
    expect(source).toContain('data-agent-elements-shell="background-tasks-popover"');
    expect(source).toContain('data-agent-elements-card-width="floating-popover"');
    expect(source).toContain('data-agent-elements-card-padding="sectioned-symmetric"');
    expect(source).toContain('agent-elements-background-task-row');
    expect(source).toContain('agent-elements-status-pill');
    expect(source).toContain('FloatingPortal');
    expect(source).toContain('--an-error-color');
    expect(source).toContain('--an-info-color');
    expect(source).toContain('--an-success-color');
    expect(source).toContain('--an-foreground');

    expect(source).not.toMatch(/rgba\(|#[0-9a-fA-F]{3,8}\b|text-white|rounded-md|rounded-lg/);
    expect(source).not.toMatch(/active:scale|tracking-\[|uppercase|shadow-lg/);
    expect(source).not.toMatch(/var\(--nim-|--nim-primary-hover|--nim-text|--nim-error|--nim-info|--nim-success/);
  });
});
