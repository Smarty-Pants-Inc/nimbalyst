// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MergeConflictDialog } from '../MergeConflictDialog';

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
    }: {
      icon: string;
      size?: number;
      className?: string;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }, icon),
  };
});

const sourcePath = resolve(__dirname, '../MergeConflictDialog.tsx');

function renderDialog(overrides: Partial<React.ComponentProps<typeof MergeConflictDialog>> = {}) {
  const onCancel = vi.fn();
  const onModelChange = vi.fn();
  const onResolveWithAgent = vi.fn();
  const result = render(
    <MergeConflictDialog
      workspacePath="/Users/paul/project-main"
      conflictedFiles={['src/App.tsx', 'packages/runtime/src/index.ts']}
      agentModels={[
        { id: 'smarty-server:gpt-5.5', name: 'GPT-5.5', provider: 'smarty-server' },
        { id: 'openai-codex:gpt-5.4', name: 'GPT-5.4', provider: 'openai-codex' },
      ]}
      selectedModel="smarty-server:gpt-5.5"
      isLoadingModels={false}
      onModelChange={onModelChange}
      onResolveWithAgent={onResolveWithAgent}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onCancel, onModelChange, onResolveWithAgent, ...result };
}

describe('MergeConflictDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Agent Elements merge-conflict chrome while preserving file, model, path, and action behavior', () => {
    const { onCancel, onModelChange, onResolveWithAgent } = renderDialog();

    const overlay = screen.getByTestId('agent-elements-merge-conflict-overlay');
    expect(overlay).toHaveClass('merge-conflict-dialog-overlay', 'agent-elements-agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-agent-elements-shell', 'agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-component', 'MergeConflictDialog');

    const dialog = screen.getByTestId('agent-elements-merge-conflict-dialog');
    expect(dialog).toHaveClass('merge-conflict-dialog', 'agent-elements-merge-conflict-dialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'merge-conflict-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    expect(within(dialog).getByRole('heading', { name: 'Merge Conflict Detected' })).toBeInTheDocument();

    expect(screen.getByTestId('agent-elements-merge-conflict-files')).toHaveTextContent('src/App.tsx');
    expect(screen.getByTestId('agent-elements-merge-conflict-files')).toHaveTextContent('packages/runtime/src/index.ts');
    expect(screen.getByTestId('agent-elements-merge-conflict-info')).toHaveTextContent('resolve these conflicts');
    expect(screen.getByTestId('agent-elements-merge-conflict-suggestion')).toHaveTextContent('AI agent can help');
    expect(screen.getByTestId('agent-elements-merge-conflict-manual')).toHaveTextContent('/Users/paul/project-main');

    const modelSelect = screen.getByTestId('agent-elements-agent-model-picker-select');
    fireEvent.change(modelSelect, { target: { value: 'openai-codex:gpt-5.4' } });
    expect(onModelChange).toHaveBeenCalledWith('openai-codex:gpt-5.4');

    fireEvent.click(within(dialog).getByRole('button', { name: /Resolve with Agent/ }));
    expect(onResolveWithAgent).toHaveBeenCalledWith('smarty-server:gpt-5.5');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    within(dialog).getAllByText(/^(warning|description|error|info|smart_toy|terminal)$/).forEach((icon) => {
      expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
    });
  });

  it('preserves overlay click, Escape cancel, dialog click stop-propagation, and disabled resolve branch', () => {
    const { onCancel, onResolveWithAgent } = renderDialog({ resolveDisabled: true });

    const dialog = screen.getByTestId('agent-elements-merge-conflict-dialog');
    const resolveButton = within(dialog).getByRole('button', { name: /Resolve with Agent/ });
    expect(resolveButton).toBeDisabled();

    fireEvent.click(resolveButton);
    expect(onResolveWithAgent).not.toHaveBeenCalled();

    fireEvent.click(dialog);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('agent-elements-merge-conflict-overlay'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('keeps MergeConflictDialog source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-merge-conflict-dialog');
    expect(source).toContain('data-agent-elements-shell="merge-conflict-dialog"');
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toMatch(/nim-overlay|nim-modal|nim-btn-|nim-input/);
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale|backdrop-blur/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
