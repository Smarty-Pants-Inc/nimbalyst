// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  syncStatusUpdate: null as null | {
    connected: boolean;
    syncing: boolean;
    error: string | null;
  },
  floatingOptions: [] as Array<{
    placement?: string;
    offsetPx?: number;
    constrainHeight?: boolean;
  }>,
}));

vi.mock('jotai', () => ({
  useAtomValue: () => mockState.syncStatusUpdate,
}));

vi.mock('../../../store/atoms/syncStatus', () => ({
  syncStatusUpdateAtom: { key: 'syncStatusUpdateAtom' },
}));

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
    useFloatingMenu: (options: {
      placement?: string;
      offsetPx?: number;
      constrainHeight?: boolean;
    } = {}) => {
      mockState.floatingOptions.push(options);
      const [isOpen, setIsOpen] = ReactModule.useState(false);
      return {
        isOpen,
        setIsOpen,
        refs: {
          setReference: vi.fn(),
          setFloating: vi.fn(),
        },
        floatingStyles: { position: 'fixed', left: 8, top: 8 },
        getReferenceProps: () => ({}),
        getFloatingProps: () => ({}),
      };
    },
  };
});

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
    }) =>
      ReactModule.createElement('span', {
        'data-icon': icon,
        'data-size': size,
        className,
      }),
  };
});

import { SyncStatusButton } from '../SyncStatusButton';

const sourcePath = resolve(__dirname, '../SyncStatusButton.tsx');
const legacyVisualTokenPattern =
  /\b(?:bg|text|border|hover:bg|hover:text|hover:border)-nim(?:-[\w-]+)?\b|var\(--nim-|rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b|rounded-md|rounded-lg|rounded-xl|tracking-\[/;

function installElectronApi(statusOverrides: Partial<{
  appConfigured: boolean;
  projectEnabled: boolean;
  connected: boolean;
  syncing: boolean;
  error: string | null;
  userEmail: string | null;
}> = {}) {
  const baseStatus = {
    appConfigured: true,
    projectEnabled: true,
    connected: true,
    syncing: false,
    error: null,
    stats: {
      sessionCount: 12,
      lastSyncedAt: Date.now() - 120_000,
    },
    docSyncStats: {
      projectCount: 1,
      fileCount: 27,
      connected: true,
    },
    userEmail: 'paul@example.com',
    ...statusOverrides,
  };

  const invoke = vi.fn(async (channel: string) => {
    if (channel === 'sync:get-status') {
      return baseStatus;
    }
    if (channel === 'sync:toggle-project') {
      return undefined;
    }
    if (channel === 'sync:subscribe-status') {
      return undefined;
    }
    return undefined;
  });

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke },
  });

  return { invoke, baseStatus };
}

describe('SyncStatusButton Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.syncStatusUpdate = null;
    mockState.floatingOptions = [];
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders a sync status gutter shell with Floating UI menu behavior and preserves sync actions', async () => {
    const { invoke } = installElectronApi();
    const onOpenSettings = vi.fn();

    render(<SyncStatusButton workspacePath="/workspace/app" onOpenSettings={onOpenSettings} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('sync:get-status', '/workspace/app');
    });
    expect(invoke).toHaveBeenCalledWith('sync:subscribe-status');

    const root = screen.getByTestId('agent-elements-sync-status-button');
    expect(root).toHaveClass('sync-status-button-container', 'agent-elements-sync-status-button');
    expect(root).toHaveAttribute('data-component', 'SyncStatusButton');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'sync-status-button');
    expect(root).toHaveAttribute('data-sync-status', 'connected');
    expect(root).toHaveAttribute('data-project-enabled', 'true');

    const button = screen.getByTestId('gutter-sync-button');
    expect(button).toHaveClass('nav-button', 'agent-elements-sync-status-trigger');
    expect(button).toHaveAttribute('data-agent-elements-shell', 'sync-status-trigger');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-label', 'Sync connected');

    const indicator = screen.getByTestId('agent-elements-sync-status-indicator');
    expect(indicator).toHaveClass('sync-indicator', 'agent-elements-sync-status-indicator');
    expect(indicator).toHaveAttribute('data-sync-status', 'connected');

    fireEvent.click(button);

    const menu = screen.getByTestId('agent-elements-sync-status-menu');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(menu).toHaveClass('sync-menu', 'agent-elements-sync-status-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'sync-status-menu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-popover');
    expect(menu).toHaveAttribute('data-sync-status', 'connected');
    expect(menu).toHaveAttribute('data-project-enabled', 'true');
    expect(mockState.floatingOptions.at(-1)).toMatchObject({
      placement: 'right-end',
      offsetPx: 8,
      constrainHeight: true,
    });

    expect(screen.getByTestId('agent-elements-sync-status-badge')).toHaveTextContent('Connected');
    expect(screen.getByText('paul@example.com')).toBeInTheDocument();
    expect(within(screen.getByTestId('agent-elements-sync-status-stat-sessions')).getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Document Sync')).toBeInTheDocument();
    expect(screen.getByText('27')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /Disable sync for this project/i }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('sync:toggle-project', '/workspace/app', false);
    });
    expect(invoke).toHaveBeenCalledWith('sync:get-status', '/workspace/app');

    fireEvent.click(screen.getByRole('menuitem', { name: /Sync settings/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('agent-elements-sync-status-menu')).not.toBeInTheDocument();
  });

  it('preserves app-configured gating, disabled, error, syncing, and incremental update states', async () => {
    const { invoke } = installElectronApi({ appConfigured: false });
    const gatedRender = render(<SyncStatusButton workspacePath="/workspace/app" />);

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('sync:get-status', '/workspace/app'));
    expect(screen.queryByTestId('agent-elements-sync-status-button')).not.toBeInTheDocument();
    gatedRender.unmount();

    installElectronApi({ projectEnabled: false, connected: false });
    const disabledRender = render(<SyncStatusButton workspacePath="/workspace/app" />);
    const disabledButton = await screen.findByTestId('agent-elements-sync-status-button');
    expect(disabledButton).toHaveAttribute('data-sync-status', 'disabled');
    expect(screen.getByTestId('gutter-sync-button')).toHaveAttribute(
      'aria-label',
      'Sync disabled for this project'
    );
    disabledRender.unmount();

    installElectronApi({ connected: false, error: 'Token expired' });
    const errorRender = render(<SyncStatusButton workspacePath="/workspace/app" />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-elements-sync-status-button')).toHaveAttribute('data-sync-status', 'error');
    });
    expect(screen.getByTestId('gutter-sync-button')).toHaveAttribute('aria-label', 'Sync error');
    errorRender.unmount();

    installElectronApi({ connected: true, syncing: false, error: null });
    const updateRender = render(<SyncStatusButton workspacePath="/workspace/app" />);
    await screen.findByTestId('agent-elements-sync-status-button');
    mockState.syncStatusUpdate = {
      connected: false,
      syncing: true,
      error: null,
    };
    updateRender.rerender(<SyncStatusButton workspacePath="/workspace/app" />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-elements-sync-status-button')).toHaveAttribute('data-sync-status', 'syncing');
    });
    expect(screen.getByTestId('gutter-sync-button')).toHaveAttribute('aria-label', 'Syncing...');
  });

  it('keeps the source on Agent Elements-compatible Floating UI primitives instead of legacy absolute menu chrome', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('useFloatingMenu');
    expect(source).toContain('FloatingPortal');
    expect(source).toContain('agent-elements-sync-status-button');
    expect(source).toContain('data-agent-elements-shell="sync-status-button"');
    expect(source).toContain('data-agent-elements-shell="sync-status-menu"');
    expect(source).toContain('data-agent-elements-card-width="floating-popover"');
    expect(source).toContain('px-[var(--agent-elements-card-inline-padding)]');
    expect(source).toContain('py-[var(--agent-elements-card-block-padding)]');
    expect(source).toContain('agent-elements-sync-status-stat');
    expect(source).toContain('--an-tool-background');
    expect(source).toContain('--an-foreground-muted');

    expect(source).not.toContain('left-[calc(100%+8px)]');
    expect(source).not.toContain('useRef');
    expect(source).not.toContain('document.addEventListener');
    expect(source).not.toContain('rounded-lg');
    expect(source).not.toContain('rounded-md');
    expect(source).not.toContain('transition-all');
    expect(source).not.toContain('active:scale');
    expect(source).not.toMatch(/rgba\(|#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/--nim-(text|bg|border)/);
    expect(source).not.toMatch(legacyVisualTokenPattern);
  });
});
