// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockWorkspaceSettings {
  overrides: {
    providers?: Record<string, { enabled?: boolean }>;
  };
  loading: boolean;
}

const mockState = vi.hoisted(() => ({
  settings: {
    overrides: {
      providers: {
        'smarty-server': {
          enabled: false,
        },
      },
    },
    loading: false,
  } as MockWorkspaceSettings,
  setSettings: vi.fn(),
  loadWorkspaceAISettings: vi.fn(),
  saveWorkspaceAISettings: vi.fn(),
  onOverrideChange: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtom: vi.fn(() => [mockState.settings, mockState.setSettings]),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size, className }: { icon: string; size?: number; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

vi.mock('../../../../store/atoms/appSettings', () => ({
  workspaceAISettingsAtomFamily: vi.fn((workspacePath: string) => `workspace-settings:${workspacePath}`),
  loadWorkspaceAISettings: mockState.loadWorkspaceAISettings,
  saveWorkspaceAISettings: mockState.saveWorkspaceAISettings,
}));

import { ProviderOverrideWrapper } from '../ProviderOverrideWrapper';

const renderWrapper = (props: Partial<React.ComponentProps<typeof ProviderOverrideWrapper>> = {}) => {
  return render(
    <ProviderOverrideWrapper
      providerId="smarty-server"
      providerName="Smarty Server"
      workspacePath="/workspace/demo"
      workspaceName="Demo Workspace"
      globalEnabled={true}
      onOverrideChange={mockState.onOverrideChange}
      {...props}
    >
      <div data-testid="provider-panel-child">Provider settings child</div>
    </ProviderOverrideWrapper>
  );
};

describe('ProviderOverrideWrapper Agent Elements shell', () => {
  beforeEach(() => {
    mockState.settings = {
      overrides: {
        providers: {
          'smarty-server': {
            enabled: false,
          },
        },
      },
      loading: false,
    };
    mockState.setSettings.mockClear();
    mockState.loadWorkspaceAISettings.mockReset();
    mockState.loadWorkspaceAISettings.mockResolvedValue(mockState.settings);
    mockState.saveWorkspaceAISettings.mockReset();
    mockState.saveWorkspaceAISettings.mockResolvedValue(undefined);
    mockState.onOverrideChange.mockClear();
  });

  it('renders Agent Elements markers while preserving active project override content', async () => {
    renderWrapper();

    const wrapper = await screen.findByTestId('agent-elements-provider-override-wrapper');
    expect(wrapper).toHaveAttribute('data-agent-elements-shell', 'provider-override-wrapper');
    expect(wrapper).toHaveAttribute('data-provider-id', 'smarty-server');
    expect(wrapper).toHaveAttribute('data-override-active', 'true');
    expect(wrapper).toHaveClass('agent-elements-settings-panel');

    const banner = screen.getByTestId('agent-elements-provider-override-banner');
    expect(banner).toHaveAttribute('data-agent-elements-shell', 'provider-override-banner');
    expect(banner).toHaveAttribute('data-state', 'overriding');
    expect(banner).toHaveClass('agent-elements-tool-card');
    expect(banner).toHaveClass('!flex-row');

    expect(screen.getByTestId('agent-elements-provider-override-status')).toHaveTextContent('Project override active');
    expect(screen.getByTestId('agent-elements-provider-override-content')).toContainElement(screen.getByTestId('provider-panel-child'));

    const input = screen.getByLabelText('Project override for Smarty Server');
    expect(input).toBeChecked();
    expect(mockState.loadWorkspaceAISettings).toHaveBeenCalledWith('/workspace/demo');
  });

  it('preserves override save behavior when enabling a project override', async () => {
    mockState.settings = {
      overrides: {},
      loading: false,
    };
    mockState.loadWorkspaceAISettings.mockResolvedValue(mockState.settings);

    renderWrapper({ globalEnabled: false });

    const wrapper = await screen.findByTestId('agent-elements-provider-override-wrapper');
    expect(wrapper).toHaveAttribute('data-override-active', 'false');
    expect(screen.getByTestId('agent-elements-provider-override-hint')).toHaveTextContent(
      'Enable override to customize Smarty Server settings'
    );

    fireEvent.click(screen.getByLabelText('Project override for Smarty Server'));

    await waitFor(() => {
      expect(mockState.saveWorkspaceAISettings).toHaveBeenCalledWith('/workspace/demo', {
        providers: {
          'smarty-server': {
            enabled: false,
          },
        },
      });
    });
    expect(mockState.setSettings).toHaveBeenCalledWith({
      ...mockState.settings,
      overrides: {
        providers: {
          'smarty-server': {
            enabled: false,
          },
        },
      },
    });
    expect(mockState.onOverrideChange).toHaveBeenCalledTimes(1);
  });
});
