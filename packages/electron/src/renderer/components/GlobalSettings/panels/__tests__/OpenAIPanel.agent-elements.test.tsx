// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAIPanel } from '../OpenAIPanel';

const sourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/OpenAIPanel.tsx',
);
const chromeSourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/providerPanelChrome.ts',
);
const legacyVisualChromePattern =
  /bg-nim|text-nim|border-nim|bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-|rgba\(|#[0-9a-fA-F]{3,8}\b|rounded-lg|transition-all/;

const baseProps = () => ({
  config: {
    enabled: true,
    models: ['gpt-4o'],
    testStatus: 'error' as const,
    testMessage: 'Invalid OpenAI API key',
  },
  apiKeys: {
    openai: 'sk-existing',
  },
  availableModels: [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai' },
  ],
  loading: false,
  onToggle: vi.fn(),
  onApiKeyChange: vi.fn(),
  onModelToggle: vi.fn(),
  onSelectAllModels: vi.fn(),
  onTestConnection: vi.fn().mockResolvedValue(undefined),
  onConfigChange: vi.fn(),
});

describe('OpenAIPanel Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Agent Elements markers while preserving API key, test, enable, and model behavior', () => {
    const props = baseProps();
    render(<OpenAIPanel {...props} />);

    const panel = screen.getByTestId('agent-elements-openai-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'openai-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-openai-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-openai-enable-toggle')).toHaveClass('provider-enable');
    expect(screen.getByTestId('agent-elements-openai-api-section')).toHaveAttribute('data-section', 'api-configuration');
    expect(screen.getByTestId('agent-elements-openai-api-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-openai-models-section')).toHaveAttribute('data-section', 'available-models');
    expect(screen.getByTestId('agent-elements-openai-model-actions')).toHaveAttribute('data-agent-elements-shell', 'openai-model-actions');
    expect(screen.getByTestId('agent-elements-openai-model-row-gpt-4o')).toHaveAttribute('data-model-id', 'gpt-4o');
    expect(screen.getByTestId('agent-elements-openai-model-row-gpt-4o-mini')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-openai-test-error')).toHaveTextContent('Invalid OpenAI API key');

    const enableInput = screen
      .getByTestId('agent-elements-openai-enable-toggle')
      .querySelector('input[type="checkbox"]');
    expect(enableInput).toBeInstanceOf(HTMLInputElement);
    fireEvent.click(enableInput as HTMLInputElement);
    expect(props.onToggle).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByTestId('agent-elements-openai-api-key-input'), {
      target: { value: 'sk-updated' },
    });
    expect(props.onApiKeyChange).toHaveBeenCalledWith('openai', 'sk-updated');

    fireEvent.click(screen.getByTestId('agent-elements-openai-test-button'));
    expect(props.onTestConnection).toHaveBeenCalledTimes(1);

    const actions = screen.getByTestId('agent-elements-openai-model-actions');
    fireEvent.click(within(actions).getByRole('button', { name: 'Select All' }));
    expect(props.onSelectAllModels).toHaveBeenCalledWith(true);

    fireEvent.click(within(actions).getByRole('button', { name: 'Deselect All' }));
    expect(props.onSelectAllModels).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByLabelText('GPT-4o mini'));
    expect(props.onModelToggle).toHaveBeenCalledWith('gpt-4o-mini', true);
  });

  it('keeps provider chrome on Agent Elements aliases instead of legacy visual tokens', () => {
    const panelSource = readFileSync(sourcePath, 'utf8');
    const chromeSource = readFileSync(chromeSourcePath, 'utf8');
    const source = `${panelSource}\n${chromeSource}`;

    expect(panelSource).toContain('createProviderPanelChrome');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-foreground');
    expect(source).toContain('--an-input-background');
    expect(source).toContain('--an-primary-color');
    expect(source).toContain('--an-success-color');
    expect(source).toContain('--an-error-color');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).not.toMatch(legacyVisualChromePattern);
  });
});
