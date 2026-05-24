// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenCodePanel } from '../OpenCodePanel';

const baseProps = () => ({
  config: {
    enabled: true,
    testStatus: 'idle' as const,
  },
  apiKeys: {
    opencode: 'test-key',
  },
  availableModels: [],
  loading: false,
  onToggle: vi.fn(),
  onApiKeyChange: vi.fn(),
  onModelToggle: vi.fn(),
  onSelectAllModels: vi.fn(),
  onTestConnection: vi.fn().mockResolvedValue(undefined),
  onConfigChange: vi.fn(),
});

describe('OpenCodePanel Agent Elements shell', () => {
  beforeEach(() => {
    let checkCount = 0;
    (window as any).electronAPI = {
      invoke: vi.fn((channel: string, ...args: any[]) => {
        if (channel === 'cli:checkInstallation' && args[0] === 'opencode') {
          checkCount += 1;
          return Promise.resolve(
            checkCount === 1
              ? { installed: false }
              : { installed: true, version: '0.9.0' },
          );
        }
        if (channel === 'cli:install' && args[0] === 'opencode') {
          return Promise.resolve({ success: true });
        }
        if (channel === 'opencode-config:read') {
          return Promise.resolve({
            success: true,
            config: {
              model: '',
              provider: {},
              autoupdate: true,
            },
          });
        }
        if (channel === 'opencode-config:merge') {
          return Promise.resolve({
            success: true,
            config: {
              ...args[0],
              provider: {},
            },
          });
        }
        if (channel === 'opencode-config:upsert-lmstudio') {
          return Promise.resolve({
            success: true,
            modelIds: ['local-model'],
            config: {
              model: 'lmstudio/local-model',
              provider: {
                lmstudio: {
                  name: 'LM Studio (local)',
                  options: { baseURL: `${args[0].baseUrl}/v1` },
                  models: {
                    'local-model': { name: 'Local Model' },
                  },
                },
              },
            },
          });
        }
        if (channel === 'opencode-config:remove-lmstudio') {
          return Promise.resolve({
            success: true,
            config: {
              model: '',
              provider: {},
            },
          });
        }
        return Promise.resolve(undefined);
      }),
    };
  });

  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it('renders Agent Elements markers while preserving CLI, config, LM Studio, and API behavior', async () => {
    const props = baseProps();
    render(<OpenCodePanel {...props} />);

    const panel = await screen.findByTestId('agent-elements-opencode-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'opencode-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-opencode-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-opencode-cli-section')).toHaveAttribute('data-section', 'cli-installation');
    expect(screen.getByTestId('agent-elements-opencode-install-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-opencode-enable-toggle')).toHaveClass('provider-enable');
    expect(screen.getByTestId('agent-elements-opencode-model-section')).toHaveAttribute('data-section', 'default-model');
    expect(screen.getByTestId('agent-elements-opencode-lmstudio-section')).toHaveAttribute('data-section', 'lmstudio-integration');
    expect(screen.getByTestId('agent-elements-opencode-lmstudio-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-opencode-updates-section')).toHaveAttribute('data-section', 'updates');
    expect(screen.getByTestId('agent-elements-opencode-api-section')).toHaveAttribute('data-section', 'api-configuration');

    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('cli:checkInstallation', 'opencode');
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('opencode-config:read');
    });

    fireEvent.click(screen.getByTestId('agent-elements-opencode-install-button'));
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('cli:install', 'opencode', {});
      expect(screen.getByTestId('agent-elements-opencode-installed')).toHaveTextContent('Installed (0.9.0)');
    });

    fireEvent.change(screen.getByTestId('opencode-model-select'), {
      target: { value: '' },
    });
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('opencode-config:merge', { model: null });
    });

    fireEvent.change(screen.getByTestId('opencode-lmstudio-base-url'), {
      target: { value: 'http://127.0.0.1:4321' },
    });
    fireEvent.click(screen.getByTestId('opencode-lmstudio-connect'));
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('opencode-config:upsert-lmstudio', {
        baseUrl: 'http://127.0.0.1:4321',
        modelIds: [],
        autoDiscoverModels: true,
        displayName: 'LM Studio (local)',
      });
      expect(screen.getByTestId('agent-elements-opencode-lmstudio-message')).toHaveTextContent('Configured 1 model from LM Studio.');
    });

    const enableInput = screen
      .getByTestId('agent-elements-opencode-enable-toggle')
      .querySelector('input[type="checkbox"]');
    expect(enableInput).toBeInstanceOf(HTMLInputElement);
    fireEvent.click(enableInput as HTMLInputElement);
    expect(props.onToggle).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByPlaceholderText('API key (optional)'), {
      target: { value: 'new-key' },
    });
    expect(props.onApiKeyChange).toHaveBeenCalledWith('opencode', 'new-key');

    fireEvent.click(screen.getByText('Test'));
    expect(props.onTestConnection).toHaveBeenCalled();
  });
});
