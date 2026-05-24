// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudePanel } from '../ClaudePanel';

const baseProps = () => ({
  config: {
    enabled: true,
    models: ['claude-3-5-sonnet-latest'],
    testStatus: 'error' as const,
    testMessage: 'Invalid Anthropic API key',
  },
  apiKeys: {
    anthropic: 'sk-ant-existing',
  },
  availableModels: [
    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic' },
  ],
  loading: false,
  onToggle: vi.fn(),
  onApiKeyChange: vi.fn(),
  onModelToggle: vi.fn(),
  onSelectAllModels: vi.fn(),
  onTestConnection: vi.fn().mockResolvedValue(undefined),
  onConfigChange: vi.fn(),
});

describe('ClaudePanel Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Agent Elements markers while preserving API key, test, enable, and model behavior', () => {
    const props = baseProps();
    render(<ClaudePanel {...props} />);

    const panel = screen.getByTestId('agent-elements-claude-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'claude-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-claude-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-claude-enable-toggle')).toHaveClass('provider-enable');
    expect(screen.getByTestId('agent-elements-claude-api-section')).toHaveAttribute('data-section', 'api-configuration');
    expect(screen.getByTestId('agent-elements-claude-api-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-claude-models-section')).toHaveAttribute('data-section', 'available-models');
    expect(screen.getByTestId('agent-elements-claude-model-actions')).toHaveAttribute('data-agent-elements-shell', 'claude-model-actions');
    expect(screen.getByTestId('agent-elements-claude-model-row-claude-3-5-sonnet-latest')).toHaveAttribute('data-model-id', 'claude-3-5-sonnet-latest');
    expect(screen.getByTestId('agent-elements-claude-model-row-claude-3-haiku-20240307')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-claude-test-error')).toHaveTextContent('Invalid Anthropic API key');

    const enableInput = screen
      .getByTestId('agent-elements-claude-enable-toggle')
      .querySelector('input[type="checkbox"]');
    expect(enableInput).toBeInstanceOf(HTMLInputElement);
    fireEvent.click(enableInput as HTMLInputElement);
    expect(props.onToggle).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByTestId('agent-elements-claude-api-key-input'), {
      target: { value: 'sk-ant-updated' },
    });
    expect(props.onApiKeyChange).toHaveBeenCalledWith('anthropic', 'sk-ant-updated');

    fireEvent.click(screen.getByTestId('agent-elements-claude-test-button'));
    expect(props.onTestConnection).toHaveBeenCalledTimes(1);

    const actions = screen.getByTestId('agent-elements-claude-model-actions');
    fireEvent.click(within(actions).getByRole('button', { name: 'Select All' }));
    expect(props.onSelectAllModels).toHaveBeenCalledWith(true);

    fireEvent.click(within(actions).getByRole('button', { name: 'Deselect All' }));
    expect(props.onSelectAllModels).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByLabelText('Claude 3 Haiku'));
    expect(props.onModelToggle).toHaveBeenCalledWith('claude-3-haiku-20240307', true);
  });
});
