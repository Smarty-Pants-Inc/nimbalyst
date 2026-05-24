// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LMStudioPanel } from '../LMStudioPanel';

const baseProps = () => ({
  config: {
    enabled: true,
    baseUrl: 'http://127.0.0.1:8234',
    models: ['qwen2.5-coder-7b'],
    testStatus: 'error' as const,
    testMessage: 'LM Studio server is unavailable',
  },
  apiKeys: {},
  availableModels: [
    { id: 'qwen2.5-coder-7b', name: 'Qwen2.5 Coder 7B', provider: 'lmstudio' },
    { id: 'lmstudio/deepseek-r1:8b', name: 'DeepSeek R1 8B', provider: 'lmstudio' },
  ],
  loading: false,
  onToggle: vi.fn(),
  onApiKeyChange: vi.fn(),
  onModelToggle: vi.fn(),
  onSelectAllModels: vi.fn(),
  onTestConnection: vi.fn().mockResolvedValue(undefined),
  onConfigChange: vi.fn(),
});

describe('LMStudioPanel Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Agent Elements markers while preserving base URL, test, refresh, enable, and model behavior', () => {
    const props = baseProps();
    render(<LMStudioPanel {...props} />);

    const panel = screen.getByTestId('agent-elements-lmstudio-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'lmstudio-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-lmstudio-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-lmstudio-enable-toggle')).toHaveClass('provider-enable');
    expect(screen.getByTestId('agent-elements-lmstudio-server-section')).toHaveAttribute('data-section', 'server-configuration');
    expect(screen.getByTestId('agent-elements-lmstudio-server-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-lmstudio-models-section')).toHaveAttribute('data-section', 'available-models');
    expect(screen.getByTestId('agent-elements-lmstudio-model-actions')).toHaveAttribute('data-agent-elements-shell', 'lmstudio-model-actions');
    expect(screen.getByTestId('agent-elements-lmstudio-model-row-qwen2-5-coder-7b')).toHaveAttribute('data-model-id', 'qwen2.5-coder-7b');
    expect(screen.getByTestId('agent-elements-lmstudio-model-row-lmstudio-deepseek-r1-8b')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-lmstudio-test-error')).toHaveTextContent('LM Studio server is unavailable');

    const enableInput = screen
      .getByTestId('agent-elements-lmstudio-enable-toggle')
      .querySelector('input[type="checkbox"]');
    expect(enableInput).toBeInstanceOf(HTMLInputElement);
    fireEvent.click(enableInput as HTMLInputElement);
    expect(props.onToggle).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByTestId('agent-elements-lmstudio-base-url-input'), {
      target: { value: 'http://localhost:1234' },
    });
    expect(props.onConfigChange).toHaveBeenCalledWith({ baseUrl: 'http://localhost:1234' });

    fireEvent.click(screen.getByTestId('agent-elements-lmstudio-test-button'));
    expect(props.onTestConnection).toHaveBeenCalledTimes(1);

    const actions = screen.getByTestId('agent-elements-lmstudio-model-actions');
    fireEvent.click(within(actions).getByRole('button', { name: 'Select All' }));
    expect(props.onSelectAllModels).toHaveBeenCalledWith(true);

    fireEvent.click(within(actions).getByRole('button', { name: 'Deselect All' }));
    expect(props.onSelectAllModels).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByLabelText('DeepSeek R1 8B'));
    expect(props.onModelToggle).toHaveBeenCalledWith('lmstudio/deepseek-r1:8b', true);

    fireEvent.click(screen.getByTestId('agent-elements-lmstudio-refresh-button'));
    expect(props.onTestConnection).toHaveBeenCalledTimes(2);
  });

  it('renders Agent Elements loading and empty states while preserving refresh disablement', () => {
    const loadingProps = {
      ...baseProps(),
      availableModels: [],
      loading: true,
    };
    const { rerender } = render(<LMStudioPanel {...loadingProps} />);

    expect(screen.getByTestId('agent-elements-lmstudio-models-loading')).toHaveTextContent('Loading models from LM Studio...');
    expect(screen.getByTestId('agent-elements-lmstudio-refresh-button')).toBeDisabled();

    const emptyProps = {
      ...baseProps(),
      availableModels: [],
      loading: false,
    };
    rerender(<LMStudioPanel {...emptyProps} />);

    expect(screen.getByTestId('agent-elements-lmstudio-models-empty')).toHaveTextContent(
      'No models found. Make sure LM Studio is running with a loaded model.',
    );
  });
});
