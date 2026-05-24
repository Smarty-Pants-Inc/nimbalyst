// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserMenuPopover } from '../UserMenuPopover';

const mockState = vi.hoisted(() => ({
  authState: null as null | {
    isAuthenticated: boolean;
    user: {
      user_id: string;
      emails?: Array<{ email: string }>;
      name?: { first_name?: string };
    } | null;
  },
  useAlphaFeature: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === 'stytch-auth') return mockState.authState;
    return null;
  }),
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
  };
});

vi.mock('../../../hooks/useAlphaFeature', () => ({
  useAlphaFeature: (feature: string) => mockState.useAlphaFeature(feature),
}));

vi.mock('../../../store/atoms/stytchAuth', () => ({
  stytchAuthAtom: 'stytch-auth',
}));

vi.mock('../../common/AlphaBadge', () => ({
  AlphaBadge: () => <span data-testid="agent-elements-user-menu-alpha-badge">Alpha</span>,
}));

const sourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../UserMenuPopover.tsx'
);

describe('UserMenuPopover Agent Elements shell', () => {
  let anchorEl: HTMLButtonElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.useAlphaFeature.mockReturnValue(true);
    mockState.authState = {
      isAuthenticated: true,
      user: {
        user_id: 'user-1',
        emails: [{ email: 'paul@example.com' }],
        name: { first_name: 'Paul' },
      },
    };

    anchorEl = document.createElement('button');
    document.body.appendChild(anchorEl);
  });

  it('renders Agent Elements menu chrome while preserving settings navigation and auth identity', async () => {
    const onNavigateSettings = vi.fn();
    const onClose = vi.fn();

    const { unmount } = render(
      <UserMenuPopover
        onNavigateSettings={onNavigateSettings}
        onClose={onClose}
        isProjectConnected
        anchorEl={anchorEl}
      />
    );

    const menu = screen.getByTestId('user-menu-popover');
    expect(menu).toHaveClass('user-menu-popover', 'agent-elements-user-menu-popover', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-component', 'UserMenuPopover');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'user-menu-popover');
    expect(menu.className).not.toMatch(/rounded-lg|shadow-lg|bg-nim|border-nim|text-white/);

    const userSettings = screen.getByTestId('user-menu-user-settings');
    expect(userSettings).toHaveClass('agent-elements-user-menu-item');
    expect(userSettings).toHaveAttribute('data-agent-elements-shell', 'user-menu-item');
    expect(userSettings).toHaveAttribute('data-menu-action', 'user-settings');
    expect(userSettings).toHaveAttribute('role', 'menuitem');

    const teamSettings = screen.getByTestId('user-menu-team-settings');
    expect(teamSettings).toHaveAttribute('data-menu-action', 'team-settings');
    expect(within(teamSettings).getByTestId('agent-elements-user-menu-alpha-badge')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('paul@example.com')).toBeInTheDocument();
    });

    const identity = screen.getByTestId('user-menu-identity');
    expect(identity).toHaveClass('agent-elements-user-menu-identity');
    expect(identity).toHaveAttribute('data-agent-elements-shell', 'user-menu-identity');
    expect(identity).toHaveAttribute('data-signed-in', 'true');
    expect(within(identity).getByText('Signed in')).toBeInTheDocument();
    expect(within(identity).getByText('P')).toHaveAttribute('data-agent-elements-shell', 'user-menu-avatar-initial');

    fireEvent.click(screen.getByTestId('user-menu-project-settings'));
    expect(onNavigateSettings).toHaveBeenCalledWith('project');
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(teamSettings);
    expect(onNavigateSettings).toHaveBeenCalledWith('project', 'team');

    fireEvent.click(identity);
    expect(onNavigateSettings).toHaveBeenCalledWith('user', 'sync');

    unmount();
  });

  it('keeps the source constrained to Agent Elements-compatible menu styling', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('MaterialSymbol');
    expect(source).toContain('agent-elements-user-menu-popover');
    expect(source).toContain('data-agent-elements-shell="user-menu-popover"');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/text-white|uppercase|tracking-|hover:shadow|active:scale|transition-all/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/shadow-lg|shadow-xl|backdrop.*blur|<svg|<path/);
  });
});
