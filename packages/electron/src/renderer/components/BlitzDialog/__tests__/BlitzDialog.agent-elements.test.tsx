// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlitzDialog } from '../BlitzDialog';

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
    getProviderIcon: (provider: string) => ReactModule.createElement('span', { 'data-provider': provider }, provider),
  };
});

vi.mock('../../../utils/modelUtils', () => ({
  getClaudeCodeModelLabel: (modelId: string) => modelId === 'claude-code:opus' ? 'Claude Opus' : modelId,
}));

const sourcePath = resolve(__dirname, '../BlitzDialog.tsx');

function renderDialog(props: Partial<React.ComponentProps<typeof BlitzDialog>> = {}) {
  const onClose = vi.fn();
  const onCreated = vi.fn();

  const result = render(
    <BlitzDialog
      isOpen
      onClose={onClose}
      onCreated={onCreated}
      workspacePath="/workspace/project"
      {...props}
    />,
  );

  return { onClose, onCreated, ...result };
}

describe('BlitzDialog Agent Elements shell', () => {
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
              { id: 'openai-codex:gpt-5.1-codex', name: 'GPT-5.1 Codex', provider: 'openai-codex' },
            ],
            openai: [
              { id: 'openai:gpt-5.1', name: 'GPT-5.1', provider: 'openai' },
            ],
          },
        })),
        invoke: vi.fn(async () => ({ success: true, blitzId: 'blitz-1' })),
      },
    });
  });

  it('renders Agent Elements blitz dialog chrome while preserving model filtering and create payload', async () => {
    const { onClose, onCreated } = renderDialog();

    const overlay = screen.getByTestId('agent-elements-blitz-overlay');
    expect(overlay).toHaveClass('nim-overlay', 'agent-elements-blitz-overlay');
    expect(overlay).toHaveAttribute('data-component', 'BlitzDialogBackdrop');
    expect(overlay).toHaveAttribute('data-agent-elements-shell', 'blitz-overlay');

    const dialog = screen.getByTestId('agent-elements-blitz-dialog');
    expect(dialog).toHaveClass('nim-modal', 'agent-elements-blitz-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'BlitzDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'blitz-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.className).toContain('!p-0');
    expect(dialog.className).toContain('!gap-0');
    expect(dialog.className).toContain('--agent-elements-card-inline-padding');
    expect(dialog.className).toContain('--agent-elements-card-block-padding');

    expect(screen.getByTestId('agent-elements-blitz-prompt-field')).toHaveAttribute(
      'data-agent-elements-shell',
      'blitz-prompt-field',
    );
    expect(screen.getByTestId('agent-elements-blitz-models-field')).toHaveAttribute(
      'data-agent-elements-shell',
      'blitz-models-field',
    );
    expect(screen.getByTestId('agent-elements-blitz-analysis-field')).toHaveAttribute(
      'data-agent-elements-shell',
      'blitz-analysis-field',
    );

    await waitFor(() => {
      expect(window.electronAPI.aiGetModels).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByText('Claude Opus')).toHaveLength(2);
    expect(screen.getAllByText('GPT-5.1 Codex')).toHaveLength(2);
    expect(screen.queryByText('GPT-5.1')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('agent-elements-blitz-prompt-input'), {
      target: { value: 'Build a beautiful agent transcript' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Start Blitz/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('blitz:create', {
        workspacePath: '/workspace/project',
        prompt: 'Build a beautiful agent transcript',
        modelConfig: [
          {
            provider: 'claude-code',
            model: 'claude-code:opus',
            count: 1,
          },
        ],
        analysisModel: 'claude-code:opus',
      });
    });
    expect(onCreated).toHaveBeenCalledWith({ success: true, blitzId: 'blitz-1' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('preserves overlay and Escape close behavior', async () => {
    const { onClose } = renderDialog();

    await waitFor(() => {
      expect(window.electronAPI.aiGetModels).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByTestId('agent-elements-blitz-dialog'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('agent-elements-blitz-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps BlitzDialog source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-blitz-dialog');
    expect(source).toContain('data-agent-elements-shell="blitz-dialog"');
    expect(source).toContain('!p-0');
    expect(source).toContain('!gap-0');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).toContain('px-[var(--agent-elements-card-inline-padding)]');
    expect(source).toContain('py-[var(--agent-elements-card-block-padding)]');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|var\(--nim-/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|tracking-wide|active:scale|backdrop-blur/);
    expect(source).not.toMatch(/text-white|rgba\(|bg-black|bg-white|<svg|<\/svg>|blur-2xl/);
    expect(source).not.toMatch(/agent-elements-blitz-(?:header|body)[^`'"]*\bp[xy]?-\[var\(--an-spacing-xxl/);
  });
});
