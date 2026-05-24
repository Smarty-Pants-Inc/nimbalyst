// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptQuickOpen } from '../PromptQuickOpen';

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    ProviderIcon: ({
      provider,
      size,
      className,
    }: {
      provider: string;
      size?: number;
      className?: string;
    }) => ReactModule.createElement('span', { 'data-provider': provider, 'data-size': size, className }),
  };
});

const prompts = [
  {
    id: 'prompt-1',
    sessionId: 'session-1',
    content: JSON.stringify({ prompt: 'Fix auth bug' }),
    createdAt: 1700000000000,
    sessionTitle: 'Auth session',
    provider: 'openai',
    parentSessionId: 'workstream-1',
  },
  {
    id: 'prompt-2',
    sessionId: 'session-2',
    content: 'Write release notes',
    createdAt: 1700000100000,
    sessionTitle: 'Release session',
    provider: 'claude',
  },
];

describe('PromptQuickOpen Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        ai: {
          listUserPrompts: vi.fn().mockResolvedValue({ success: true, prompts }),
        },
      },
    });
  });

  it('renders an Agent Elements prompt palette shell while preserving Enter selection behavior', async () => {
    const onClose = vi.fn();
    const onSessionSelect = vi.fn();

    render(
      <PromptQuickOpen
        isOpen={true}
        onClose={onClose}
        workspacePath="/workspace/app"
        onSessionSelect={onSessionSelect}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-prompt-quick-open-backdrop');
    expect(backdrop).toHaveClass('prompt-quick-open-backdrop', 'agent-elements-prompt-quick-open-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'prompt-quick-open-backdrop');

    const modal = screen.getByTestId('agent-elements-prompt-quick-open');
    expect(modal).toHaveClass('prompt-quick-open-modal', 'agent-elements-prompt-quick-open', 'agent-elements-tool-card');
    expect(modal).toHaveAttribute('data-component', 'PromptQuickOpen');
    expect(modal).toHaveAttribute('data-agent-elements-shell', 'prompt-quick-open');

    expect(screen.getByTestId('agent-elements-prompt-quick-open-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'prompt-quick-open-header'
    );
    expect(screen.getByTestId('agent-elements-prompt-quick-open-input')).toHaveAttribute(
      'data-agent-elements-shell',
      'prompt-quick-open-input'
    );

    await screen.findByText('Fix auth bug');
    expect(window.electronAPI.ai.listUserPrompts).toHaveBeenCalledWith('/workspace/app');

    const firstItem = screen.getByTestId('agent-elements-prompt-quick-open-item-0');
    expect(firstItem).toHaveClass('prompt-quick-open-item', 'agent-elements-prompt-quick-open-item', 'selected');
    expect(firstItem).toHaveAttribute('data-agent-elements-shell', 'prompt-quick-open-result');
    expect(firstItem).toHaveAttribute('data-selected', 'true');
    expect(firstItem.className).not.toContain('border-l-[#007aff]');
    expect(within(firstItem).getByTestId('agent-elements-prompt-quick-open-item-text-0')).toHaveTextContent('Fix auth bug');
    expect(within(firstItem).getByText('In Workstream')).toHaveClass('agent-elements-status-pill');
    expect(screen.getByTestId('agent-elements-prompt-quick-open-footer')).toHaveAttribute(
      'data-agent-elements-shell',
      'prompt-quick-open-footer'
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSessionSelect).toHaveBeenCalledWith('session-1', 1700000000000);
    expect(onClose).toHaveBeenCalled();
  });

  it('preserves loading, extracted prompt filtering, and prompt copy behavior inside the Agent Elements shell', async () => {
    let resolvePrompts: (value: { success: boolean; prompts: typeof prompts }) => void = () => {};
    window.electronAPI.ai.listUserPrompts = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolvePrompts = resolve;
      })
    );

    render(
      <PromptQuickOpen
        isOpen={true}
        onClose={vi.fn()}
        workspacePath="/workspace/app"
        onSessionSelect={vi.fn()}
      />
    );

    expect(screen.getByTestId('agent-elements-prompt-quick-open-empty')).toHaveTextContent('Loading');

    await act(async () => {
      resolvePrompts({ success: true, prompts });
    });

    await screen.findByText('Write release notes');
    const input = screen.getByTestId('agent-elements-prompt-quick-open-input');
    fireEvent.change(input, { target: { value: 'auth' } });

    expect(screen.getByText('Fix auth bug')).toBeInTheDocument();
    expect(screen.queryByText('Write release notes')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Fix auth bug');
    });
    expect(screen.getByTestId('agent-elements-prompt-quick-open-copied-toast')).toHaveTextContent('Copied to clipboard');
  });
});
