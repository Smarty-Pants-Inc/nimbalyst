// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadGitStateDialog } from '../BadGitStateDialog';

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

const sourcePath = resolve(__dirname, '../BadGitStateDialog.tsx');

function renderDialog(overrides: Partial<React.ComponentProps<typeof BadGitStateDialog>> = {}) {
  const onCancel = vi.fn();
  const onModelChange = vi.fn();
  const onResolveWithAgent = vi.fn();
  const result = render(
    <BadGitStateDialog
      worktreePath="/Users/paul/project-main-agent-fix"
      errorMessage="Cannot rebase because the worktree has unresolved merge state."
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

describe('BadGitStateDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Agent Elements bad-git-state chrome while preserving error, files, model, path, and action behavior', () => {
    const { onCancel, onModelChange, onResolveWithAgent } = renderDialog();

    const overlay = screen.getByTestId('agent-elements-bad-git-state-overlay');
    expect(overlay).toHaveClass('merge-conflict-dialog-overlay', 'agent-elements-agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-agent-elements-shell', 'agent-mode-dialog-overlay');
    expect(overlay).toHaveAttribute('data-component', 'BadGitStateDialog');

    const dialog = screen.getByTestId('agent-elements-bad-git-state-dialog');
    expect(dialog).toHaveClass('merge-conflict-dialog', 'agent-elements-bad-git-state-dialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'bad-git-state-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    expect(within(dialog).getByRole('heading', { name: 'Git Operation Failed' })).toBeInTheDocument();

    expect(screen.getByTestId('agent-elements-bad-git-state-error')).toHaveTextContent('unresolved merge state');
    expect(screen.getByTestId('agent-elements-bad-git-state-files')).toHaveTextContent('src/App.tsx');
    expect(screen.getByTestId('agent-elements-bad-git-state-files')).toHaveTextContent('packages/runtime/src/index.ts');
    expect(screen.getByTestId('agent-elements-bad-git-state-suggestion')).toHaveTextContent('AI agent can help');
    expect(screen.getByTestId('agent-elements-bad-git-state-manual')).toHaveTextContent('/Users/paul/project-main-agent-fix');

    const modelSelect = screen.getByTestId('agent-elements-agent-model-picker-select');
    fireEvent.change(modelSelect, { target: { value: 'openai-codex:gpt-5.4' } });
    expect(onModelChange).toHaveBeenCalledWith('openai-codex:gpt-5.4');

    fireEvent.click(within(dialog).getByRole('button', { name: /Resolve with Agent/ }));
    expect(onResolveWithAgent).toHaveBeenCalledWith('smarty-server:gpt-5.5');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    within(dialog).getAllByText(/^(warning|error|description|smart_toy|terminal)$/).forEach((icon) => {
      expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
    });
  });

  it('preserves no-file branch, overlay click, Escape cancel, dialog click stop-propagation, and disabled resolve branch', () => {
    const { onCancel, onResolveWithAgent } = renderDialog({ conflictedFiles: [], resolveDisabled: true });

    const dialog = screen.getByTestId('agent-elements-bad-git-state-dialog');
    expect(screen.queryByTestId('agent-elements-bad-git-state-files')).not.toBeInTheDocument();

    const resolveButton = within(dialog).getByRole('button', { name: /Resolve with Agent/ });
    expect(resolveButton).toBeDisabled();

    fireEvent.click(resolveButton);
    expect(onResolveWithAgent).not.toHaveBeenCalled();

    fireEvent.click(dialog);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('agent-elements-bad-git-state-overlay'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('keeps BadGitStateDialog source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-bad-git-state-dialog');
    expect(source).toContain('data-agent-elements-shell="bad-git-state-dialog"');
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toMatch(/nim-overlay|nim-modal|nim-btn-|nim-input/);
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale|backdrop-blur/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
