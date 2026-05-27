// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  tokens: {
    syncConfigAtom: 'syncConfigAtom',
    setSyncConfigAtom: 'setSyncConfigAtom',
    releaseChannelAtom: 'releaseChannelAtom',
    advancedSettingsAtom: 'advancedSettingsAtom',
    setAdvancedSettingsAtom: 'setAdvancedSettingsAtom',
  },
  syncConfig: {
    enabled: false,
    enabledProjects: [],
    docSyncEnabledProjects: [],
    idleTimeoutMinutes: 5,
    environment: 'production',
    serverUrl: '',
  },
  advancedSettings: {
    alphaFeatures: {
      collaboration: false,
    },
  },
  setSyncConfig: vi.fn(),
  updateSyncConfig: vi.fn(),
  updateAdvancedSettings: vi.fn(),
  capture: vi.fn(),
  peopleSet: vi.fn(),
  posthog: {} as { capture: ReturnType<typeof vi.fn>; people: { set: ReturnType<typeof vi.fn> } },
}));

mockState.posthog = {
  capture: mockState.capture,
  people: { set: mockState.peopleSet },
};

vi.mock('jotai', () => ({
  atom: vi.fn((initialValue?: unknown) => ({ initialValue })),
  createStore: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    sub: vi.fn(() => vi.fn()),
  })),
  useAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.syncConfigAtom) return [mockState.syncConfig, mockState.setSyncConfig];
    if (atom === mockState.tokens.setSyncConfigAtom) return [null, mockState.updateSyncConfig];
    if (atom === mockState.tokens.advancedSettingsAtom) return [mockState.advancedSettings, vi.fn()];
    if (atom === mockState.tokens.setAdvancedSettingsAtom) return [null, mockState.updateAdvancedSettings];
    return [null, vi.fn()];
  }),
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.releaseChannelAtom) return 'alpha';
    return null;
  }),
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => mockState.posthog,
}));

vi.mock('@nimbalyst/runtime', async () => {
  const React = await import('react');
  return {
    MaterialSymbol: ({ icon, className }: { icon: string; className?: string }) =>
      React.createElement('span', { className, 'data-material-icon': icon }, icon),
  };
});

vi.mock('../../../../store/atoms/appSettings', () => ({
  syncConfigAtom: mockState.tokens.syncConfigAtom,
  setSyncConfigAtom: mockState.tokens.setSyncConfigAtom,
  releaseChannelAtom: mockState.tokens.releaseChannelAtom,
  advancedSettingsAtom: mockState.tokens.advancedSettingsAtom,
  setAdvancedSettingsAtom: mockState.tokens.setAdvancedSettingsAtom,
}));

vi.mock('../QRPairingModal', () => ({
  QRPairingModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="mock-qr-pairing-modal">QR pairing</div> : null,
}));

vi.mock('../../common/AlphaBadge', () => ({
  AlphaBadge: () => <span data-testid="mock-alpha-badge">Alpha</span>,
}));

import { SyncPanel } from '../SyncPanel';

const sourcePath = resolve(__dirname, '../SyncPanel.tsx');

describe('SyncPanel Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.syncConfig.enabled = false;
    mockState.syncConfig.enabledProjects = [];
    mockState.syncConfig.docSyncEnabledProjects = [];
    mockState.syncConfig.idleTimeoutMinutes = 5;
    mockState.syncConfig.environment = 'production';
    mockState.syncConfig.serverUrl = '';
    mockState.advancedSettings.alphaFeatures.collaboration = false;

    (window as any).electronAPI = {
      invoke: vi.fn((channel: string, ...args: any[]) => {
        if (channel === 'get-recent-workspaces') {
          return Promise.resolve([
            { path: '/work/smarty-code', name: 'smarty-code' },
            { path: '/work/nimbalyst', name: 'nimbalyst' },
          ]);
        }
        if (channel === 'sync:toggle-project') {
          expect(args).toEqual(['/work/smarty-code', true]);
          return Promise.resolve({ success: true });
        }
        if (channel === 'sync:set-config') {
          return Promise.resolve({ success: true });
        }
        if (channel === 'sync:set-prevent-sleep') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve(undefined);
      }),
      openExternal: vi.fn(),
      stytch: {
        getAuthState: vi.fn().mockResolvedValue({ isAuthenticated: false, user: null }),
        refreshSession: vi.fn().mockResolvedValue(undefined),
        subscribeAuthState: vi.fn(),
        onAuthStateChange: vi.fn(() => vi.fn()),
        getAccounts: vi.fn().mockResolvedValue([]),
        signInWithGoogle: vi.fn().mockResolvedValue({ success: true }),
        sendMagicLink: vi.fn().mockResolvedValue({ success: true }),
        signOut: vi.fn().mockResolvedValue(undefined),
        addAccount: vi.fn().mockResolvedValue(undefined),
        removeAccount: vi.fn().mockResolvedValue(undefined),
        switchEnvironment: vi.fn().mockResolvedValue(undefined),
        deleteAccount: vi.fn().mockResolvedValue({ success: true }),
      },
    };
  });

  it('renders Agent Elements markers while preserving collaboration, auth, and project sync behavior', async () => {
    render(<SyncPanel />);

    const panel = await screen.findByTestId('agent-elements-sync-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'sync-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-sync-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-sync-collaboration-section')).toHaveAttribute('data-section', 'team-collaboration');
    expect(screen.getByTestId('agent-elements-sync-account-section')).toHaveAttribute('data-section', 'account');
    expect(screen.getByTestId('agent-elements-sync-auth-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-sync-projects-section')).toHaveAttribute('data-section', 'mobile-projects');
    expect(screen.getByTestId('agent-elements-sync-devices-section')).toHaveAttribute('data-section', 'paired-devices');
    expect(screen.getByTestId('agent-elements-sync-encryption-card')).toHaveClass('agent-elements-tool-card');

    const collaborationSection = screen.getByTestId('agent-elements-sync-collaboration-section');
    const collaborationToggle = collaborationSection.querySelector('input[type="checkbox"]');
    expect(collaborationToggle).toBeInstanceOf(HTMLInputElement);
    fireEvent.click(collaborationToggle as HTMLInputElement);
    expect(mockState.updateAdvancedSettings).toHaveBeenCalledWith({
      alphaFeatures: {
        collaboration: true,
      },
    });
    expect(mockState.capture).toHaveBeenCalledWith('alpha_feature_toggled', {
      feature_tag: 'collaboration',
      enabled: true,
      source: 'sync_panel',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign In or Create Account' }));
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
      target: { value: 'paul@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));
    await waitFor(() => {
      expect((window as any).electronAPI.stytch.sendMagicLink).toHaveBeenCalledWith('paul@example.com');
    });
    expect(mockState.capture).toHaveBeenCalledWith('sync_sign_in_started', { method: 'magic_link' });

    fireEvent.click(screen.getByTestId('agent-elements-sync-add-project-empty'));
    const projectsSection = screen.getByTestId('agent-elements-sync-projects-section');
    await within(projectsSection).findByText('smarty-code');
    fireEvent.click(within(projectsSection).getByText('smarty-code'));
    expect(mockState.setSyncConfig).toHaveBeenCalledWith({
      ...mockState.syncConfig,
      enabledProjects: ['/work/smarty-code'],
      enabled: true,
    });
    expect(mockState.capture).toHaveBeenCalledWith('sync_enabled', { projectCount: 1 });
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
        'sync:toggle-project',
        '/work/smarty-code',
        true,
      );
    });
  });

  it('keeps sync settings cards on shared Agent Elements gutters and full settings width', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('sync-panel agent-elements-settings-panel agent-elements-sync-panel flex w-full flex-col');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).not.toMatch(/agent-elements-tool-card[^`'"]*\b(?:p-|p-\[|px-|px-\[|py-|py-\[|pl-|pl-\[|pr-|pr-\[|rounded-lg|rounded-md)/);
  });
});
