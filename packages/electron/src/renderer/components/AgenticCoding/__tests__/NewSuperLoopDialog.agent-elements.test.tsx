// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Provider, createStore } from 'jotai';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewSuperLoopDialog } from '../NewSuperLoopDialog';
import { newSuperLoopDialogOpenAtom } from '../../../store/atoms/superLoop';

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
      ...rest
    }: {
      icon: string;
      size?: number;
      className?: string;
      [key: string]: unknown;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className, ...rest }, icon),
  };
});

const sourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../NewSuperLoopDialog.tsx'
);

function renderOpenDialog(
  props: Partial<React.ComponentProps<typeof NewSuperLoopDialog>> = {}
) {
  const store = createStore();
  store.set(newSuperLoopDialogOpenAtom, true);
  const onSuperLoopCreated = vi.fn();

  const result = render(
    <Provider store={store}>
      <NewSuperLoopDialog
        workspacePath="/workspace/project"
        onSuperLoopCreated={onSuperLoopCreated}
        {...props}
      />
    </Provider>
  );

  return { store, onSuperLoopCreated, ...result };
}

describe('NewSuperLoopDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        aiGetModels: vi.fn(async () => ({
          success: true,
          grouped: {
            'claude-code': [
              { id: 'claude-code:opus', name: 'Claude Opus', provider: 'claude-code' },
            ],
            'openai-codex': [
              { id: 'openai-codex:gpt-5.4', name: 'Codex', provider: 'openai-codex' },
            ],
            'smarty-server': [
              {
                id: 'smarty-server:smarty_coding_agent',
                name: 'Smarty Coding Agent',
                provider: 'smarty-server',
              },
              {
                id: 'smarty-server:review_agent',
                name: 'Smarty Review Agent',
                provider: 'smarty-server',
              },
            ],
          },
        })),
        invoke: vi.fn(async () => ({
          success: true,
          loop: {
            id: 'loop-1',
            workspacePath: '/workspace/project',
            worktreeId: 'worktree-1',
            status: 'running',
            taskDescription: 'Audit the runtime shell',
            maxIterations: 100,
            currentIteration: 0,
            modelId: 'smarty-server:review_agent',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          worktree: { id: 'worktree-1' },
        })),
      },
    });
  });

  it('renders the Agent Elements dialog shell while preserving model filtering, iteration clamping, and create IPC', async () => {
    const { onSuperLoopCreated } = renderOpenDialog();

    const backdrop = screen.getByTestId('agent-elements-new-super-loop-backdrop');
    expect(backdrop).toHaveClass('new-super-loop-dialog-overlay', 'agent-elements-new-super-loop-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'new-super-loop-backdrop');

    const dialog = screen.getByTestId('agent-elements-new-super-loop-dialog');
    expect(dialog).toHaveClass('new-super-loop-dialog', 'agent-elements-new-super-loop-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'NewSuperLoopDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'new-super-loop-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    expect(screen.getByTestId('agent-elements-new-super-loop-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'new-super-loop-header'
    );
    expect(screen.getByTestId('agent-elements-new-super-loop-description')).toHaveClass(
      'agent-elements-new-super-loop-description'
    );
    expect(screen.getByTestId('agent-elements-new-super-loop-task-field')).toHaveAttribute(
      'data-agent-elements-shell',
      'new-super-loop-task-field'
    );
    expect(screen.getByTestId('agent-elements-new-super-loop-model-field')).toHaveAttribute(
      'data-agent-elements-shell',
      'new-super-loop-model-field'
    );
    expect(screen.getByTestId('agent-elements-new-super-loop-iterations-field')).toHaveAttribute(
      'data-agent-elements-shell',
      'new-super-loop-iterations-field'
    );
    expect(screen.getByTestId('agent-elements-new-super-loop-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'new-super-loop-actions'
    );

    await waitFor(() => {
      expect(window.electronAPI.aiGetModels).toHaveBeenCalledTimes(1);
    });

    const modelSelect = screen.getByTestId('agent-elements-new-super-loop-model-select') as HTMLSelectElement;
    expect(modelSelect).toHaveAttribute('data-agent-elements-shell', 'new-super-loop-model-select');
    const optionLabels = Array.from(modelSelect.options).map((option) => option.textContent);
    expect(optionLabels).toEqual(['Smarty Coding Agent', 'Smarty Review Agent']);
    expect(optionLabels).not.toContain('Claude Opus');
    expect(optionLabels).not.toContain('Codex');

    fireEvent.change(modelSelect, {
      target: { value: 'smarty-server:review_agent' },
    });
    fireEvent.change(screen.getByTestId('agent-elements-new-super-loop-task-input'), {
      target: { value: 'Audit the runtime shell' },
    });
    const iterationsInput = screen.getByTestId('agent-elements-new-super-loop-iterations-input') as HTMLInputElement;
    fireEvent.change(iterationsInput, { target: { value: '999' } });
    expect(iterationsInput.value).toBe('100');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create & Start' }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(
        'super-loop:create',
        '/workspace/project',
        'Audit the runtime shell',
        {
          maxIterations: 100,
          modelId: 'smarty-server:review_agent',
        }
      );
    });
    expect(onSuperLoopCreated).toHaveBeenCalledWith('loop-1', 'worktree-1');
  });

  it('preserves required task validation and disables close controls while creating', async () => {
    let finishCreate: ((value: unknown) => void) | undefined;
    const invoke = vi.fn(() => new Promise((resolve) => {
      finishCreate = resolve;
    }));
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        aiGetModels: vi.fn(async () => ({ success: true, grouped: {} })),
        invoke,
      },
    });

    const { store } = renderOpenDialog();
    const dialog = screen.getByTestId('agent-elements-new-super-loop-dialog');

    fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
    const error = await screen.findByTestId('agent-elements-new-super-loop-error');
    expect(error).toHaveClass('agent-elements-new-super-loop-error');
    expect(error).toHaveTextContent('Task description is required');
    expect(invoke).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('agent-elements-new-super-loop-task-input'), {
      target: { value: 'Run the long loop' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create & Start' }));

    const closeButton = within(dialog).getByRole('button', { name: 'Close' });
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Creating...' })).toBeDisabled();
    });
    expect(closeButton).toBeDisabled();

    fireEvent.click(closeButton);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(store.get(newSuperLoopDialogOpenAtom)).toBe(true);

    finishCreate?.({
      success: false,
      error: 'Loop failed',
    });
    await screen.findByText('Loop failed');
  });

  it('keeps NewSuperLoopDialog source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-new-super-loop-dialog');
    expect(source).toContain('data-agent-elements-shell="new-super-loop-dialog"');
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toMatch(/bg-black\/50|bg-nim|text-nim|border-nim|focus:ring-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-xl|tracking-wide|text-white/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(|rgb\(/);
    expect(source).not.toMatch(/<svg|<\/svg>/);
  });
});
