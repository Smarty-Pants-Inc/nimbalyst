// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtensionDevIndicator } from '../ExtensionDevIndicator';

const sourcePath = resolve(__dirname, '../ExtensionDevIndicator.tsx');
const consoleSourcePath = resolve(__dirname, '../ExtensionErrorConsole.tsx');
const legacyVisualTokenPattern =
  /\b(?:bg|text|border|hover:bg|hover:text|hover:border)-nim(?:-[\w-]+)?\b|var\(--nim-|rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b|rounded-md|rounded-lg|rounded-xl|tracking-\[/;

vi.mock('jotai', async () => {
  const actual = await vi.importActual<typeof import('jotai')>('jotai');
  return {
    ...actual,
    useAtomValue: vi.fn(() => true),
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
    useFloatingMenu: (options: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) => ({
      isOpen: options.open ?? false,
      setIsOpen: options.onOpenChange ?? vi.fn(),
      refs: {
        setReference: vi.fn(),
        setFloating: vi.fn(),
      },
      floatingStyles: {},
      getReferenceProps: () => ({}),
      getFloatingProps: () => ({}),
    }),
  };
});

function installElectronApi() {
  const getLogs = vi.fn().mockResolvedValue({
    logs: [
      {
        timestamp: Date.now(),
        level: 'error',
        source: 'renderer',
        extensionId: 'demo-extension',
        message: 'Render failed',
      },
    ],
    stats: {
      totalEntries: 1,
      byLevel: { error: 1, warn: 0, info: 0, debug: 0 },
    },
  });
  const getProcessInfo = vi.fn().mockResolvedValue({
    startTime: Date.now() - 120_000,
  });
  const clearLogs = vi.fn().mockResolvedValue(undefined);
  const listInstalled = vi.fn().mockResolvedValue([
    {
      id: 'demo-extension',
      path: '/repo/packages/extensions/demo',
      manifest: { name: 'Demo Extension' },
      name: 'Demo Extension',
      enabled: true,
    },
  ]);
  const devReload = vi.fn().mockResolvedValue({ success: true });
  const invoke = vi.fn().mockResolvedValue(undefined);

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      invoke,
      extensionDevTools: {
        getLogs,
        getProcessInfo,
        clearLogs,
      },
      extensions: {
        listInstalled,
        devReload,
      },
    },
  });

  return { getLogs, getProcessInfo, clearLogs, listInstalled, devReload, invoke };
}

describe('ExtensionDevIndicator Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installElectronApi();
  });

  it('renders the dev indicator and menus with Agent Elements shell markers while preserving actions', async () => {
    const onOpenSettings = vi.fn();
    render(<ExtensionDevIndicator onOpenSettings={onOpenSettings} />);

    const button = screen.getByTestId('agent-elements-extension-dev-button');
    expect(button).toHaveClass('extension-dev-indicator', 'agent-elements-extension-dev-button');
    expect(button).toHaveAttribute('data-agent-elements-shell', 'extension-dev-button');

    fireEvent.click(button);

    const menu = await screen.findByTestId('agent-elements-extension-dev-menu');
    expect(menu).toHaveClass('extension-dev-menu', 'agent-elements-extension-dev-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'extension-dev-menu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');

    expect(screen.getByTestId('agent-elements-extension-dev-status')).toHaveTextContent(
      'Development tools active'
    );
    expect(screen.getByTestId('agent-elements-extension-dev-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'extension-dev-actions'
    );

    fireEvent.click(screen.getByTestId('agent-elements-extension-dev-rebuild-trigger'));
    const rebuildMenu = screen.getByTestId('agent-elements-extension-dev-rebuild-menu');
    expect(rebuildMenu).toHaveAttribute('data-agent-elements-shell', 'extension-dev-rebuild-menu');
    expect(rebuildMenu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(rebuildMenu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');

    fireEvent.click(screen.getByRole('menuitem', { name: /extension settings/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps the extension-dev menu on Agent Elements-compatible source rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('useFloatingMenu');
    expect(source).toContain('FloatingPortal');
    expect(source).toContain('agent-elements-extension-dev-menu');
    expect(source).toContain('data-agent-elements-shell="extension-dev-menu"');
    expect(source).toContain('data-agent-elements-card-padding="symmetric-inline"');
    expect(source).toContain('data-agent-elements-card-width="floating-menu"');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('agent-elements-extension-dev-rebuild-menu');
    expect(source).toContain('data-agent-elements-shell="extension-dev-rebuild-menu"');
    expect(source).toContain('--an-tool-background');
    expect(source).toContain('--an-foreground-muted');

    expect(source).not.toMatch(/active:scale|bg-purple|text-white|rounded-lg|backdrop.*blur|rgba\(/);
    expect(source).not.toMatch(/submenu\\.style|left = parentRect|style=\\{\\{[^}]*left|style=\\{\\{[^}]*top/);
    expect(source).not.toMatch(legacyVisualTokenPattern);
  });

  it('opens the log console with Agent Elements modal and log-row markers', async () => {
    render(<ExtensionDevIndicator />);

    fireEvent.click(screen.getByTestId('agent-elements-extension-dev-button'));
    fireEvent.click(await screen.findByRole('menuitem', { name: /view logs/i }));

    const consoleDialog = await screen.findByTestId('agent-elements-extension-error-console');
    expect(consoleDialog).toHaveClass(
      'extension-error-console',
      'agent-elements-extension-error-console',
      'agent-elements-tool-card'
    );
    expect(consoleDialog).toHaveAttribute('data-agent-elements-shell', 'extension-error-console');
    expect(screen.getByTestId('agent-elements-extension-error-console-toolbar')).toHaveAttribute(
      'data-agent-elements-shell',
      'extension-error-console-toolbar'
    );
    expect(await screen.findByTestId('agent-elements-extension-log-entry')).toHaveAttribute(
      'data-agent-elements-shell',
      'extension-log-entry'
    );
    expect(screen.getByTestId('agent-elements-extension-log-badge')).toHaveTextContent(
      'demo-extension'
    );
  });

  it('keeps the extension log console on Agent Elements-compatible source rules', () => {
    const source = readFileSync(consoleSourcePath, 'utf8');

    expect(source).toContain('agent-elements-extension-error-console');
    expect(source).toContain('data-agent-elements-shell="extension-error-console"');
    expect(source).toContain('agent-elements-extension-log-entry');
    expect(source).toContain('data-agent-elements-shell="extension-log-entry"');
    expect(source).toContain('--an-tool-background');
    expect(source).toContain('--an-foreground-muted');

    expect(source).not.toMatch(/#000|#fff|#ffffff|bg-white|text-white|bg-black/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|backdrop.*blur|rgba\(/);
    expect(source).not.toMatch(/text-\\[#a855f7\\]|#a855f7|#c084fc/);
    expect(source).not.toMatch(legacyVisualTokenPattern);
  });
});
