// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopilotCLIPanel } from '../CopilotCLIPanel';

const baseProps = () => ({
  config: {
    enabled: true,
  },
  apiKeys: {},
  availableModels: [],
  loading: false,
  onToggle: vi.fn(),
  onApiKeyChange: vi.fn(),
  onModelToggle: vi.fn(),
  onSelectAllModels: vi.fn(),
  onTestConnection: vi.fn().mockResolvedValue(undefined),
  onConfigChange: vi.fn(),
});

describe('CopilotCLIPanel Agent Elements shell', () => {
  beforeEach(() => {
    let checkCount = 0;
    (window as any).electronAPI = {
      invoke: vi.fn((channel: string, providerId: string) => {
        if (channel === 'cli:checkInstallation' && providerId === 'copilot-cli') {
          checkCount += 1;
          return Promise.resolve(
            checkCount === 1
              ? { installed: false }
              : { installed: true, version: '1.2.3' },
          );
        }
        if (channel === 'cli:install' && providerId === 'copilot-cli') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve(undefined);
      }),
    };
  });

  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it('renders Agent Elements markers while preserving CLI install, enable, and auth guidance behavior', async () => {
    const props = baseProps();
    render(<CopilotCLIPanel {...props} />);

    const panel = await screen.findByTestId('agent-elements-copilot-cli-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'copilot-cli-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-copilot-cli-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-copilot-cli-cli-section')).toHaveAttribute('data-section', 'cli-installation');
    expect(screen.getByTestId('agent-elements-copilot-cli-install-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-copilot-cli-install-command')).toHaveTextContent('npm install -g @github/copilot');
    expect(screen.getByTestId('agent-elements-copilot-cli-enable-toggle')).toHaveClass('provider-enable');
    expect(screen.getByTestId('agent-elements-copilot-cli-auth-section')).toHaveAttribute('data-section', 'authentication');
    expect(screen.getByTestId('agent-elements-copilot-cli-auth-card')).toHaveClass('agent-elements-tool-card');

    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('cli:checkInstallation', 'copilot-cli');
    });

    fireEvent.click(screen.getByTestId('agent-elements-copilot-cli-install-button'));
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('cli:install', 'copilot-cli', {});
      expect(screen.getByTestId('agent-elements-copilot-cli-installed')).toHaveTextContent('Installed (1.2.3)');
    });

    const enableInput = screen
      .getByTestId('agent-elements-copilot-cli-enable-toggle')
      .querySelector('input[type="checkbox"]');
    expect(enableInput).toBeInstanceOf(HTMLInputElement);
    fireEvent.click(enableInput as HTMLInputElement);
    expect(props.onToggle).toHaveBeenCalledWith(false);
  });
});
