// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryPromptIndicator,
  MemorySaveButton,
  getMemoryContent,
  shouldActivateMemoryMode,
} from '../interactivePrompts/MemoryPrompt';

vi.mock('@nimbalyst/runtime', () => ({
  MaterialSymbol: ({
    icon,
    size,
    className,
  }: {
    icon: string;
    size?: number;
    className?: string;
  }) => (
    <span
      aria-hidden="true"
      className={className}
      data-icon={icon}
      data-size={size}
    />
  ),
}));

const sourcePath = resolve(__dirname, '../interactivePrompts/MemoryPrompt.tsx');

describe('UnifiedAI MemoryPrompt Agent Elements shell', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: vi.fn(async (channel: string) => {
          if (channel === 'memory:get-path') {
            return { filePath: '/workspace/project/CLAUDE.md' };
          }
          return {};
        }),
      },
    });
  });

  it('renders the memory prompt indicator with Agent Elements chrome and preserves target/open behavior', async () => {
    const onTargetChange = vi.fn();

    render(
      <MemoryPromptIndicator
        target="project"
        onTargetChange={onTargetChange}
        workspacePath="/workspace/project"
      />,
    );

    const shell = screen.getByTestId('agent-elements-memory-prompt');
    expect(shell).toHaveClass('memory-prompt-indicator', 'agent-elements-memory-prompt');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'memory-prompt');
    expect(shell).toHaveAttribute('data-component', 'UnifiedAIMemoryPromptIndicator');
    expect(shell).toHaveAttribute('data-memory-target', 'project');

    expect(screen.getByTestId('agent-elements-memory-prompt-status')).toHaveTextContent('Adding to memory');
    expect(screen.getByTestId('agent-elements-memory-prompt-target')).toHaveTextContent('Project Memory');
    expect(screen.getByTestId('agent-elements-memory-prompt-shortcuts')).toHaveTextContent('Enter');

    fireEvent.click(screen.getByRole('button', { name: /switch memory target/i }));
    expect(onTargetChange).toHaveBeenCalledWith('user');

    fireEvent.click(screen.getByRole('button', { name: /open memory file/i }));
    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenNthCalledWith(1, 'memory:get-path', {
        target: 'project',
        workspacePath: '/workspace/project',
      });
      expect(window.electronAPI.invoke).toHaveBeenNthCalledWith(2, 'workspace:open-file', {
        workspacePath: '/workspace/project',
        filePath: '/workspace/project/CLAUDE.md',
      });
    });
  });

  it('renders the save button as an Agent Elements action while preserving save and disabled behavior', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <MemorySaveButton
        onSave={onSave}
        disabled={false}
      />,
    );

    const saveButton = screen.getByRole('button', { name: /save to memory/i });
    expect(saveButton).toHaveClass('memory-save-button', 'agent-elements-memory-save-button');
    expect(saveButton).toHaveAttribute('data-agent-elements-shell', 'memory-save-button');
    expect(saveButton).toHaveAttribute('data-component', 'UnifiedAIMemorySaveButton');
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);

    rerender(
      <MemorySaveButton
        onSave={onSave}
        disabled={false}
        isSaving
      />,
    );
    expect(screen.getByRole('button', { name: /saving memory/i })).toBeDisabled();
    expect(screen.getByTestId('agent-elements-memory-save-spinner')).toBeInTheDocument();
  });

  it('preserves memory trigger and content helpers', () => {
    expect(shouldActivateMemoryMode('# remember this', 'claude-code')).toBe(true);
    expect(shouldActivateMemoryMode('# remember this', 'openai')).toBe(false);
    expect(getMemoryContent('   # remember this')).toBe('remember this');
    expect(getMemoryContent('normal prompt')).toBe('normal prompt');
  });

  it('keeps MemoryPrompt source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-memory-prompt');
    expect(source).toContain('data-agent-elements-shell');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b/);
    expect(source).not.toMatch(/text-white|uppercase|tracking-|hover:shadow|active:scale|transition-all/);
    expect(source).not.toMatch(/<svg|<path|&middot;|&uarr;|&darr;/);
  });
});
