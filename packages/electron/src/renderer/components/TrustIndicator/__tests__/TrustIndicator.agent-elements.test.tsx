// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  permissionsVersion: 0,
  permissions: {
    trustedAt: 1_779_000_000_000 as number | undefined,
    permissionMode: 'ask' as 'ask' | 'allow-all' | 'bypass-all' | null,
    loading: false,
  },
  setPermissionsState: vi.fn(),
  loadWorkspacePermissions: vi.fn(),
}));

vi.mock('jotai', () => ({
  atom: (initialValue: unknown) => ({ initialValue }),
  useAtom: () => [mockState.permissions, mockState.setPermissionsState],
  useAtomValue: () => mockState.permissionsVersion,
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  workspacePermissionsAtomFamily: (workspacePath: string) => ({ workspacePath }),
  loadWorkspacePermissions: (...args: unknown[]) => mockState.loadWorkspacePermissions(...args),
}));

vi.mock('../../../store/atoms/permissions', () => ({
  permissionsChangedVersionAtom: { key: 'permissionsChangedVersionAtom' },
}));

vi.mock('../../../help', () => ({
  HelpTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../hooks/useFloatingMenu', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    FloatingPortal: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useFloatingMenu: (options: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) => {
      const [internalOpen, setInternalOpen] = ReactModule.useState(false);
      const isControlled = options.open !== undefined;
      const isOpen = isControlled ? options.open : internalOpen;
      const setIsOpen = options.onOpenChange ?? setInternalOpen;
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

import { TrustIndicator } from '../TrustIndicator';

const sourcePath = resolve(__dirname, '../TrustIndicator.tsx');
const LEGACY_VISUAL_TOKEN_PATTERN =
  /\b(?:bg|text|border|hover:bg|hover:text|hover:border)-nim(?:-[\w-]+)?\b|var\(--nim-|rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b|rounded-md|rounded-lg|rounded-xl|tracking-\[/;

describe('TrustIndicator Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.permissionsVersion = 0;
    mockState.permissions = {
      trustedAt: 1_779_000_000_000,
      permissionMode: 'ask',
      loading: false,
    };
    mockState.loadWorkspacePermissions.mockResolvedValue(mockState.permissions);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders an Agent Elements gutter permission shell with Floating UI menu behavior', async () => {
    const onOpenSettings = vi.fn();
    const onChangeMode = vi.fn();

    render(
      <TrustIndicator
        workspacePath="/workspace/acme"
        onOpenSettings={onOpenSettings}
        onChangeMode={onChangeMode}
      />
    );

    await waitFor(() => expect(mockState.loadWorkspacePermissions).toHaveBeenCalledWith('/workspace/acme'));

    const root = screen.getByTestId('agent-elements-trust-indicator');
    expect(root).toHaveClass('trust-indicator-container', 'agent-elements-trust-indicator');
    expect(root).toHaveAttribute('data-component', 'TrustIndicator');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'trust-indicator');
    expect(root).toHaveAttribute('data-trust-status', 'trusted');
    expect(root).toHaveAttribute('data-permission-mode', 'ask');

    const button = screen.getByTestId('gutter-permissions-button');
    expect(button).toHaveAttribute('data-agent-elements-shell', 'trust-indicator-button');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('agent-elements-trust-indicator-status-dot')).toHaveAttribute(
      'data-agent-elements-shell',
      'trust-indicator-status-dot'
    );

    fireEvent.click(button);

    const menu = screen.getByTestId('agent-elements-trust-indicator-menu');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(menu).toHaveClass('trust-menu', 'agent-elements-trust-indicator-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'trust-indicator-menu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-popover');
    expect(menu).toHaveAttribute('data-trust-status', 'trusted');
    expect(menu).toHaveAttribute('data-permission-mode', 'ask');

    const currentMode = screen.getByTestId('agent-elements-trust-indicator-current-mode');
    expect(currentMode).toHaveAttribute('data-agent-elements-shell', 'trust-indicator-current-mode');
    expect(currentMode).toHaveAttribute('data-trust-status', 'trusted');
    expect(currentMode).toHaveTextContent('Ask');
    expect(currentMode).toHaveTextContent('Agent asks before running commands');

    fireEvent.click(screen.getByRole('menuitem', { name: /Change permission mode/i }));
    expect(onChangeMode).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('agent-elements-trust-indicator-menu')).not.toBeInTheDocument();

    fireEvent.click(button);
    fireEvent.click(screen.getByRole('menuitem', { name: /Permission settings/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('preserves untrusted, allow edits, bypass, loading, and no-workspace states', async () => {
    const onOpenSettings = vi.fn();

    const { rerender } = render(
      <TrustIndicator workspacePath="/workspace/acme" onOpenSettings={onOpenSettings} />
    );
    await screen.findByTestId('agent-elements-trust-indicator');

    mockState.permissions = { trustedAt: undefined, permissionMode: null, loading: false };
    rerender(<TrustIndicator workspacePath="/workspace/acme" onOpenSettings={onOpenSettings} />);
    expect(screen.getByTestId('agent-elements-trust-indicator')).toHaveAttribute('data-trust-status', 'untrusted');
    expect(screen.getByTestId('gutter-permissions-button')).toHaveAttribute(
      'aria-label',
      'Workspace not trusted for agent'
    );

    mockState.permissions = { trustedAt: 1_779_000_000_000, permissionMode: 'allow-all', loading: false };
    rerender(<TrustIndicator workspacePath="/workspace/acme" onOpenSettings={onOpenSettings} />);
    expect(screen.getByTestId('agent-elements-trust-indicator')).toHaveAttribute('data-permission-mode', 'allow-all');
    expect(screen.getByTestId('gutter-permissions-button')).toHaveAttribute('aria-label', 'Allow Edits mode');

    mockState.permissions = { trustedAt: 1_779_000_000_000, permissionMode: 'bypass-all', loading: false };
    rerender(<TrustIndicator workspacePath="/workspace/acme" onOpenSettings={onOpenSettings} />);
    expect(screen.getByTestId('agent-elements-trust-indicator')).toHaveAttribute('data-trust-status', 'bypass-all');
    expect(screen.getByTestId('gutter-permissions-button')).toHaveAttribute('aria-label', 'Allow All mode');

    mockState.permissions = { trustedAt: undefined, permissionMode: null, loading: true };
    rerender(<TrustIndicator workspacePath="/workspace/acme" onOpenSettings={onOpenSettings} />);
    expect(screen.getByTestId('agent-elements-trust-indicator')).toHaveAttribute('data-trust-status', 'loading');
    expect(screen.getByTestId('gutter-permissions-button')).toHaveAttribute(
      'aria-label',
      'Loading trust status...'
    );

    rerender(<TrustIndicator workspacePath={null} onOpenSettings={onOpenSettings} />);
    expect(screen.queryByTestId('agent-elements-trust-indicator')).not.toBeInTheDocument();
  });

  it('keeps the source on Agent Elements-compatible Floating UI primitives instead of legacy absolute menu chrome', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('useFloatingMenu');
    expect(source).toContain('FloatingPortal');
    expect(source).toContain('agent-elements-trust-indicator');
    expect(source).toContain('--an-tool-background');
    expect(source).toContain('--an-foreground-muted');
    expect(source).toContain('data-agent-elements-shell="trust-indicator"');
    expect(source).toContain('data-agent-elements-shell="trust-indicator-menu"');
    expect(source).toContain('data-agent-elements-card-width="floating-popover"');
    expect(source).toContain('px-[var(--agent-elements-card-inline-padding)]');
    expect(source).toContain('py-[var(--agent-elements-card-block-padding)]');
    expect(source).toContain('data-agent-elements-shell="trust-indicator-current-mode"');
    expect(source).not.toContain('left-[calc(100%+8px)]');
    expect(source).not.toContain('@keyframes trust-menu-appear');
    expect(source).not.toContain('rounded-lg');
    expect(source).not.toContain('rounded-md');
    expect(source).not.toContain('transition-all');
    expect(source).not.toContain('active:scale');
    expect(source).not.toContain('rgba(');
    expect(source).not.toMatch(LEGACY_VISUAL_TOKEN_PATTERN);
  });
});
