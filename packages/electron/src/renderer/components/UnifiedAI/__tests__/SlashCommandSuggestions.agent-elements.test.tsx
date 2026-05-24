// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlashCommandSuggestions } from '../SlashCommandSuggestions';

const capture = vi.fn();
const sourcePath = resolve(__dirname, '../SlashCommandSuggestions.tsx');

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture }),
}));

function command(name: string, description = `Run ${name}`) {
  const [pluginNamespace, commandName] = name.split(':');
  return {
    extensionId: `ext-${pluginNamespace}`,
    extensionName: `${pluginNamespace} extension`,
    pluginName: `${pluginNamespace} plugin`,
    pluginNamespace,
    commandName,
    description,
  };
}

function installExtensionCommands(commands: ReturnType<typeof command>[]) {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      extensions: {
        getClaudePluginCommands: vi.fn().mockResolvedValue(commands),
      },
    },
  });
}

function renderSuggestions(
  commands = [command('planner:create'), command('tests:run')],
  onCommandSelect = vi.fn()
) {
  installExtensionCommands(commands);
  render(
    <SlashCommandSuggestions
      provider="claude-code"
      hasMessages={false}
      workspacePath="/workspace/project"
      onCommandSelect={onCommandSelect}
    />
  );
  return { onCommandSelect };
}

describe('UnifiedAI SlashCommandSuggestions Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders extension slash commands as Agent Elements suggestion chips and preserves selection analytics', async () => {
    const { onCommandSelect } = renderSuggestions();

    const root = await screen.findByTestId('agent-elements-slash-command-suggestions');
    expect(root).toHaveClass('slash-command-suggestions', 'agent-elements-slash-command-suggestions');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'slash-command-suggestions');
    expect(root).toHaveAttribute('data-component', 'UnifiedAISlashCommandSuggestions');

    const commandChip = screen.getByText('planner:create').closest('button');
    expect(commandChip).toHaveClass('slash-command-pill', 'agent-elements-slash-command-chip');
    expect(commandChip).toHaveAttribute('data-agent-elements-shell', 'slash-command-chip');
    expect(commandChip).toHaveAttribute('data-command-name', 'planner:create');

    const tooltip = within(commandChip!.parentElement!).getByRole('tooltip');
    expect(tooltip).toHaveClass('agent-elements-slash-command-tooltip');
    expect(tooltip).toHaveTextContent('Run planner:create');

    fireEvent.click(commandChip!);

    expect(onCommandSelect).toHaveBeenCalledWith('/planner:create ');
    expect(capture).toHaveBeenCalledWith('slash_command_suggestion_clicked', {
      commandName: 'planner:create',
      extensionId: 'ext-planner',
      commandType: 'extension',
    });
  });

  it('preserves collapsed random command limit and expands to all commands', async () => {
    renderSuggestions([
      command('one:a'),
      command('two:b'),
      command('three:c'),
      command('four:d'),
      command('five:e'),
    ]);

    const root = await screen.findByTestId('agent-elements-slash-command-suggestions');
    expect(within(root).getAllByTestId('agent-elements-slash-command-chip')).toHaveLength(3);

    const expand = within(root).getByTestId('agent-elements-slash-command-expand');
    expect(expand).toHaveClass('agent-elements-slash-command-expand');
    expect(expand).toHaveTextContent('+2');

    fireEvent.click(expand);

    await waitFor(() => {
      expect(within(root).getAllByTestId('agent-elements-slash-command-chip')).toHaveLength(5);
    });
    expect(within(root).queryByTestId('agent-elements-slash-command-expand')).not.toBeInTheDocument();
  });

  it('keeps SlashCommandSuggestions source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-slash-command-suggestions');
    expect(source).toContain('agent-elements-slash-command-chip');
    expect(source).toContain('data-agent-elements-shell');
    expect(source).not.toMatch(/bg-nim|text-nim|bg-\[var\(--nim|text-\[var\(--nim|var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b/);
    expect(source).not.toMatch(/text-white|uppercase|tracking-|hover:shadow|active:scale|transition-all/);
    expect(source).not.toMatch(/shadow-\[/);
  });
});
