// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  permissionsAtom: 'workspacePermissionsAtom',
  setPermissionsState: vi.fn(),
  loadWorkspacePermissions: vi.fn(),
  posthog: {
    capture: vi.fn(),
  },
  permissions: {
    trustedAt: 1_779_000_000_000,
    permissionMode: 'ask',
    allowedPatterns: [
      {
        pattern: 'Bash(npm test:*)',
        displayName: 'npm test commands',
        source: 'user',
        addedAt: 1_779_000_000_000,
      },
    ],
    additionalDirectories: [
      {
        path: '/Users/paul/side-project',
        addedAt: 1_779_000_000_000,
        recursive: false,
      },
    ],
    allowedUrlPatterns: [
      {
        pattern: '*.github.com',
        description: 'GitHub documentation',
        addedAt: 1_779_000_000_000,
      },
    ],
    loading: false,
    error: null,
  },
}));

vi.mock('jotai', () => ({
  useAtom: vi.fn(() => [mockState.permissions, mockState.setPermissionsState]),
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => mockState.posthog,
}));

vi.mock('../../../../store/atoms/appSettings', () => ({
  workspacePermissionsAtomFamily: vi.fn(() => mockState.permissionsAtom),
  loadWorkspacePermissions: mockState.loadWorkspacePermissions,
}));

import { ProjectPermissionsPanel } from '../ProjectPermissionsPanel';

const sourcePath = resolve(__dirname, '../ProjectPermissionsPanel.tsx');

describe('ProjectPermissionsPanel Agent Elements shell', () => {
  beforeEach(() => {
    mockState.setPermissionsState.mockClear();
    mockState.loadWorkspacePermissions.mockReset();
    mockState.loadWorkspacePermissions.mockResolvedValue(mockState.permissions);
    mockState.posthog.capture.mockClear();

    (window as any).electronAPI = {
      invoke: vi.fn((channel: string) => {
        if (channel === 'dialog:openDirectory') {
          return Promise.resolve({ filePaths: ['/Users/paul/shared-assets'] });
        }
        return Promise.resolve({ success: true });
      }),
    };
  });

  it('renders Agent Elements markers while preserving permission IPC and local form behavior', async () => {
    render(<ProjectPermissionsPanel workspacePath="/workspace/app" workspaceName="App" />);

    const panel = await screen.findByTestId('agent-elements-project-permissions-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'project-permissions-panel');
    expect(panel).toHaveAttribute('data-workspace-bound', 'true');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-project-permissions-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-project-permissions-trust-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-project-permissions-mode-section')).toHaveAttribute('data-agent-elements-shell', 'project-permissions-section');
    expect(screen.getByTestId('agent-elements-project-permissions-directories-section')).toHaveAttribute('data-permission-section', 'directories');
    expect(screen.getByTestId('agent-elements-project-permissions-urls-section')).toHaveAttribute('data-permission-section', 'urls');
    expect(screen.getByTestId('agent-elements-project-permissions-patterns-section')).toHaveAttribute('data-permission-section', 'patterns');
    expect(screen.getByTestId('agent-elements-project-permissions-footer')).toHaveAttribute('data-agent-elements-shell', 'project-permissions-footer');

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Trust' }));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('permissions:revokeWorkspaceTrust', '/workspace/app'));

    const allowEditsOption = screen.getByText('Allow Edits').closest('label');
    expect(allowEditsOption).toHaveAttribute('data-permission-mode', 'allow-all');
    fireEvent.click(allowEditsOption!);
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('permissions:setPermissionMode', '/workspace/app', 'allow-all'));

    fireEvent.click(screen.getByRole('button', { name: /Add Directory/ }));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('dialog:openDirectory', {
      title: 'Select Additional Directory',
      buttonLabel: 'Add Directory',
    }));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
      'permissions:addAdditionalDirectory',
      '/workspace/app',
      '/Users/paul/shared-assets',
      false
    ));

    const urlSection = screen.getByTestId('agent-elements-project-permissions-urls-section');
    fireEvent.click(within(urlSection).getByRole('button', { name: /Add URL Pattern/ }));
    expect(screen.getByTestId('agent-elements-project-permissions-url-form')).toHaveClass('agent-elements-tool-card');
    fireEvent.change(screen.getByPlaceholderText('URL pattern (e.g., *.github.com)'), {
      target: { value: '*.openai.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Description (optional)'), {
      target: { value: 'OpenAI docs' },
    });
    fireEvent.click(within(screen.getByTestId('agent-elements-project-permissions-url-form')).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
      'permissions:addAllowedUrlPattern',
      '/workspace/app',
      '*.openai.com',
      'OpenAI docs'
    ));

    fireEvent.click(within(urlSection).getByRole('button', { name: /Allow All Domains/ }));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('permissions:allowAllUrls', '/workspace/app'));

    fireEvent.click(within(screen.getByTestId('agent-elements-project-permissions-patterns-section')).getByTitle('Remove pattern'));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
      'permissions:removePattern',
      '/workspace/app',
      'Bash(npm test:*)'
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Defaults' }));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('permissions:resetToDefaults', '/workspace/app'));
    expect(mockState.posthog.capture).toHaveBeenCalledWith('agent_permissions_opened', expect.objectContaining({
      permissionMode: 'ask',
    }));
  });

  it('keeps project permissions cards on shared Agent Elements gutters and full settings width', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('project-permissions-panel agent-elements-settings-panel flex h-full w-full flex-col');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).not.toMatch(/agent-elements-tool-card[^`'"]*\b(?:p-|p-\[|px-|px-\[|py-|py-\[|max-w-)/);
    expect(source).not.toMatch(/--nim-|bg-nim|border-nim|text-nim|text-white|rgba\(/);
    expect(source).not.toMatch(/rounded-lg|rounded-md|tracking-wide|shadow-lg/);
  });
});
