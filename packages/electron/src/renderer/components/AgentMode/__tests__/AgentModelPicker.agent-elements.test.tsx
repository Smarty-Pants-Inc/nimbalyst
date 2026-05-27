// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AgentModelPicker, type AgentModelOption } from '../AgentModelPicker';

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
      ...props
    }: {
      icon: string;
      size?: number;
      className?: string;
    } & React.HTMLAttributes<HTMLSpanElement>) => (
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className, ...props }, icon)
    ),
  };
});

const sourcePath = resolve(__dirname, '../AgentModelPicker.tsx');

const models: AgentModelOption[] = [
  { id: 'smarty-server:smarty_coding_agent', name: 'Smarty Coding Agent', provider: 'smarty-server' },
  { id: 'openai-codex:codex-high', name: 'Codex High', provider: 'openai-codex' },
];

function renderAgentModelPicker(
  props: Partial<React.ComponentProps<typeof AgentModelPicker>> = {},
) {
  const onModelChange = vi.fn();
  render(
    <AgentModelPicker
      models={models}
      selectedModel="smarty-server:smarty_coding_agent"
      onModelChange={onModelChange}
      {...props}
    />,
  );

  return { onModelChange };
}

describe('AgentMode AgentModelPicker Agent Elements shell', () => {
  it('renders grouped agent models inside Agent Elements form chrome', () => {
    const { onModelChange } = renderAgentModelPicker();

    const root = screen.getByTestId('agent-elements-agent-model-picker');
    expect(root).toHaveClass('merge-conflict-dialog-model', 'agent-elements-agent-model-picker');
    expect(root).toHaveAttribute('data-component', 'AgentModelPicker');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'agent-model-picker');
    expect(root).toHaveAttribute('data-model-count', '2');

    expect(screen.getByTestId('agent-elements-agent-model-picker-label')).toHaveTextContent('Model');
    const decorativeIcon = screen.getByText('memory');
    expect(decorativeIcon.closest('[aria-hidden="true"]')).not.toBeNull();

    const select = screen.getByTestId('agent-elements-agent-model-picker-select');
    expect(select).toHaveClass('agent-elements-agent-model-picker-select');
    expect(select).toHaveValue('smarty-server:smarty_coding_agent');
    expect(select).toBeEnabled();

    const smartyGroup = within(select).getByRole('group', { name: 'Smarty Server' });
    expect(within(smartyGroup).getByRole('option', { name: 'Smarty Coding Agent' })).toHaveValue(
      'smarty-server:smarty_coding_agent',
    );
    expect(within(select).getByRole('group', { name: 'OpenAI Codex' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'openai-codex:codex-high' } });
    expect(onModelChange).toHaveBeenCalledWith('openai-codex:codex-high');
  });

  it('preserves loading and unavailable disabled states', () => {
    renderAgentModelPicker({
      models: [],
      selectedModel: '',
      isLoading: true,
    });

    let select = screen.getByTestId('agent-elements-agent-model-picker-select');
    expect(select).toBeEnabled();
    expect(within(select).getByRole('option', { name: 'Loading models...' })).toHaveValue('');

    renderAgentModelPicker({
      models: [],
      selectedModel: '',
      isLoading: false,
    });

    select = screen.getAllByTestId('agent-elements-agent-model-picker-select')[1];
    expect(select).toBeDisabled();
    expect(within(select).getByRole('option', { name: 'No agent models available' })).toHaveValue('');
  });

  it('keeps AgentModelPicker source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-agent-model-picker');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-lg|rounded-xl|shadow-lg|tracking-wide/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
  });
});
