// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockElectronAPI = vi.hoisted(() => ({
  aiGetSettings: vi.fn(),
  aiGetAllModels: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size, className }: { icon: string; size?: number; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
    getProviderIcon: (providerId: string, options?: { size?: number }) =>
      ReactModule.createElement('span', {
        'data-provider-icon': providerId,
        'data-size': options?.size,
      }),
  };
});

import { ProjectAIProvidersPanel } from '../ProjectAIProvidersPanel';

describe('ProjectAIProvidersPanel Agent Elements shell', () => {
  beforeEach(() => {
    mockElectronAPI.aiGetSettings.mockReset();
    mockElectronAPI.aiGetSettings.mockResolvedValue({
      providerSettings: {
        openai: {
          enabled: true,
          models: ['gpt-4o'],
        },
        lmstudio: {
          enabled: false,
          models: [],
        },
      },
      apiKeys: {
        openai: 'configured-global-key',
      },
    });

    mockElectronAPI.aiGetAllModels.mockReset();
    mockElectronAPI.aiGetAllModels.mockResolvedValue({
      success: true,
      grouped: {
        openai: [
          { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
          { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai' },
        ],
      },
    });

    mockElectronAPI.invoke.mockReset();
    mockElectronAPI.invoke.mockImplementation((channel: string) => {
      if (channel === 'ai:getProjectSettings') {
        return Promise.resolve({
          success: true,
          overrides: {
            providers: {
              openai: {
                enabled: false,
                models: ['gpt-4o-mini'],
                apiKey: 'project-key',
              },
            },
          },
        });
      }

      if (channel === 'ai:getProjectTrackerAutomation') {
        return Promise.resolve({
          success: true,
          override: {
            enabled: true,
          },
        });
      }

      if (channel === 'ai:saveProjectSettings' || channel === 'ai:saveProjectTrackerAutomation') {
        return Promise.resolve({ success: true });
      }

      return Promise.resolve({ success: true });
    });

    (window as any).electronAPI = mockElectronAPI;
  });

  it('renders Agent Elements provider rows while preserving project override and tracker save behavior', async () => {
    render(<ProjectAIProvidersPanel workspacePath="/workspace/app" workspaceName="App" />);

    const panel = await screen.findByTestId('agent-elements-project-ai-providers-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'project-ai-providers-panel');
    expect(panel).toHaveAttribute('data-workspace-bound', 'true');
    expect(panel).toHaveClass('agent-elements-settings-panel');

    expect(screen.getByTestId('agent-elements-project-ai-providers-header')).toHaveClass(
      'agent-elements-settings-panel-header'
    );
    expect(screen.getByTestId('agent-elements-project-ai-providers-list')).toHaveAttribute(
      'data-agent-elements-shell',
      'project-ai-providers-list'
    );

    const openAIProvider = screen.getByTestId('agent-elements-project-ai-provider-openai');
    expect(openAIProvider).toHaveClass('agent-elements-tool-card');
    expect(openAIProvider).toHaveAttribute('data-provider-id', 'openai');
    expect(openAIProvider).toHaveAttribute('data-override-active', 'true');
    expect(openAIProvider).toHaveAttribute('data-effective-enabled', 'false');

    fireEvent.click(screen.getByTestId('agent-elements-project-ai-provider-header-openai'));

    const content = await screen.findByTestId('agent-elements-project-ai-provider-content-openai');
    expect(content).toHaveClass('agent-elements-tool-card-bordered');
    expect(screen.getByLabelText('Project override for OpenAI')).toBeChecked();
    expect(screen.getByLabelText('Enable OpenAI for this project')).not.toBeChecked();

    fireEvent.change(screen.getByTestId('agent-elements-project-ai-provider-api-key-openai'), {
      target: { value: 'project-key-updated' },
    });

    fireEvent.click(within(content).getByLabelText('GPT-4o'));

    const trackerSection = screen.getByTestId('agent-elements-project-ai-tracker-automation');
    fireEvent.change(within(trackerSection).getByRole('combobox'), {
      target: { value: 'disable' },
    });

    const footer = screen.getByTestId('agent-elements-project-ai-providers-footer');
    expect(footer).toHaveAttribute('data-agent-elements-shell', 'project-ai-providers-footer');
    const saveButton = within(footer).getByRole('button', { name: 'Save Changes' });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('ai:saveProjectSettings', '/workspace/app', {
        providers: {
          openai: {
            enabled: false,
            models: ['gpt-4o-mini', 'gpt-4o'],
            apiKey: 'project-key-updated',
          },
        },
      });
    });
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith(
      'ai:saveProjectTrackerAutomation',
      '/workspace/app',
      { enabled: false }
    );
  });
});
