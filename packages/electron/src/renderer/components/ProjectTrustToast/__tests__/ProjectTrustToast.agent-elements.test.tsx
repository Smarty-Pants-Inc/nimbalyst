// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  permissionsVersion: 0,
  posthog: {
    capture: vi.fn(),
  },
}));

vi.mock('jotai', () => ({
  atom: (initialValue: unknown) => ({ initialValue }),
  useAtomValue: () => mockState.permissionsVersion,
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => mockState.posthog,
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
    }) =>
      ReactModule.createElement('span', {
        'data-icon': icon,
        'data-size': size,
        className,
      }),
  };
});

import { ProjectTrustToast } from '../ProjectTrustToast';

const sourcePath = resolve(__dirname, '../ProjectTrustToast.tsx');

function installElectronApi(permissionMode: 'ask' | 'allow-all' | 'bypass-all' | null = null) {
  const invoke = vi.fn((channel: string) => {
    if (channel === 'permissions:getWorkspacePermissions') {
      return Promise.resolve({ permissionMode, trustedAt: permissionMode ? 1_779_000_000_000 : null });
    }
    return Promise.resolve({ success: true });
  });

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke },
  });

  return { invoke };
}

describe('ProjectTrustToast Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.permissionsVersion = 0;
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders an Agent Elements permission shell while preserving mode selection and save behavior', async () => {
    const { invoke } = installElectronApi(null);
    const onDismiss = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <ProjectTrustToast
        workspacePath="/workspace/acme"
        onDismiss={onDismiss}
        onOpenSettings={onOpenSettings}
      />
    );

    const backdrop = await screen.findByTestId('agent-elements-project-trust-toast-backdrop');
    expect(backdrop).toHaveClass('project-trust-toast-overlay', 'agent-elements-project-trust-toast-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'project-trust-toast-backdrop');

    const toast = screen.getByTestId('agent-elements-project-trust-toast');
    expect(toast).toHaveClass('project-trust-toast', 'agent-elements-project-trust-toast', 'agent-elements-tool-card');
    expect(toast).toHaveAttribute('data-component', 'ProjectTrustToast');
    expect(toast).toHaveAttribute('data-agent-elements-shell', 'project-trust-toast');
    expect(toast).toHaveAttribute('data-permission-mode', 'allow-all');

    expect(screen.getByTestId('agent-elements-project-trust-toast-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'project-trust-toast-header'
    );
    expect(screen.getByTestId('agent-elements-project-trust-toast-warning')).toHaveAttribute(
      'data-agent-elements-shell',
      'project-trust-toast-warning'
    );
    expect(screen.getByTestId('agent-elements-project-trust-toast-mode-toggle')).toHaveAttribute(
      'data-agent-elements-shell',
      'project-trust-toast-mode-toggle'
    );
    expect(screen.getByTestId('agent-elements-project-trust-toast-mode-details')).toHaveAttribute(
      'data-selected-mode',
      'allow-all'
    );
    expect(screen.getByTestId('agent-elements-project-trust-toast-footer')).toHaveAttribute(
      'data-agent-elements-shell',
      'project-trust-toast-footer'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Allow All' }));
    expect(screen.getByTestId('agent-elements-project-trust-toast')).toHaveAttribute(
      'data-permission-mode',
      'bypass-all'
    );
    expect(screen.getByTestId('agent-elements-project-trust-toast-mode-details')).toHaveAttribute(
      'data-selected-mode',
      'bypass-all'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith(
      'permissions:setPermissionMode',
      '/workspace/acme',
      'bypass-all'
    ));
    expect(mockState.posthog.capture).toHaveBeenCalledWith('trust_dialog_saved', {
      permissionMode: 'bypass-all',
      isChangingMode: false,
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).not.toHaveBeenCalled();
  });

  it('preserves settings, dismiss, and revoke-trust behavior in change mode', async () => {
    const { invoke } = installElectronApi('ask');
    const onDismiss = vi.fn();
    const onOpenSettings = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { rerender } = render(
      <ProjectTrustToast
        workspacePath="/workspace/acme"
        forceShow
        onDismiss={onDismiss}
        onOpenSettings={onOpenSettings}
      />
    );

    await screen.findByTestId('agent-elements-project-trust-toast');
    await waitFor(() => expect(screen.getByTestId('agent-elements-project-trust-toast')).toHaveAttribute(
      'data-permission-mode',
      'ask'
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Advanced settings' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    rerender(
      <ProjectTrustToast
        workspacePath="/workspace/acme"
        forceShow={false}
        onDismiss={onDismiss}
        onOpenSettings={onOpenSettings}
      />
    );
    rerender(
      <ProjectTrustToast
        workspacePath="/workspace/acme"
        forceShow
        onDismiss={onDismiss}
        onOpenSettings={onOpenSettings}
      />
    );

    await screen.findByTestId('agent-elements-project-trust-toast');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(2);

    rerender(
      <ProjectTrustToast
        workspacePath="/workspace/acme"
        forceShow={false}
        onDismiss={onDismiss}
        onOpenSettings={onOpenSettings}
      />
    );
    rerender(
      <ProjectTrustToast
        workspacePath="/workspace/acme"
        forceShow
        onDismiss={onDismiss}
        onOpenSettings={onOpenSettings}
      />
    );

    await screen.findByTestId('agent-elements-project-trust-toast');
    fireEvent.click(screen.getByRole('button', { name: "Don't Trust" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith(
      'permissions:revokeWorkspaceTrust',
      '/workspace/acme'
    ));
    expect(mockState.posthog.capture).toHaveBeenCalledWith('permission_setting_changed', {
      action: 'revoke_trust',
      source: 'trust_toast',
    });
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  it('keeps the source on Agent Elements-compatible primitives instead of old bespoke toast chrome', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-project-trust-toast');
    expect(source).toContain('data-agent-elements-shell="project-trust-toast"');
    expect(source).toContain('data-agent-elements-shell="project-trust-toast-mode-option"');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toContain('<svg');
    expect(source).not.toContain('#f59e0b');
    expect(source).not.toContain('rgba(');
    expect(source).not.toContain('text-white');
    expect(source).not.toContain('rounded-xl');
    expect(source).not.toContain('rounded-lg');
    expect(source).not.toContain('rounded-md');
    expect(source).not.toContain('shadow-[0_16px_48px');
    expect(source).not.toContain('hover:brightness');
    expect(source).not.toMatch(/var\(--nim-|--nim-primary-hover|--nim-warning|--nim-text/);
  });
});
