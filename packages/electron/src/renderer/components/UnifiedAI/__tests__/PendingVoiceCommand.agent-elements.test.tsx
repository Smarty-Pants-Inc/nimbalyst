// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pendingVoiceCommandAtom, type PendingVoiceCommand as PendingVoiceCommandState } from '../../../store/atoms/voiceModeState';
import { PendingVoiceCommand } from '../PendingVoiceCommand';

const sourcePath = resolve(__dirname, '../PendingVoiceCommand.tsx');

function pendingCommand(overrides: Partial<PendingVoiceCommandState> = {}): PendingVoiceCommandState {
  return {
    id: 'voice-command-1',
    prompt: 'Summarize the current workspace',
    sessionId: 'session-a',
    createdAt: Date.now(),
    delayMs: 5000,
    workspacePath: '/workspace/project',
    codingAgentPrompt: { prepend: 'Use concise mode' },
    ...overrides,
  };
}

function renderPendingVoiceCommand(
  command: PendingVoiceCommandState | null = pendingCommand(),
  props: Partial<React.ComponentProps<typeof PendingVoiceCommand>> = {},
) {
  const store = createStore();
  store.set(pendingVoiceCommandAtom, command);
  const onSubmit = vi.fn();

  render(
    <Provider store={store}>
      <PendingVoiceCommand
        sessionId="session-a"
        onSubmit={onSubmit}
        {...props}
      />
    </Provider>,
  );

  return { store, onSubmit };
}

describe('UnifiedAI PendingVoiceCommand Agent Elements shell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T12:00:00Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders matching pending voice commands in Agent Elements chrome and preserves submit payloads', () => {
    const command = pendingCommand();
    const { onSubmit, store } = renderPendingVoiceCommand(command);

    const shell = screen.getByTestId('agent-elements-pending-voice-command');
    expect(shell).toHaveClass('pending-voice-command', 'agent-elements-pending-voice-command');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'pending-voice-command');
    expect(shell).toHaveAttribute('data-component', 'UnifiedAIPendingVoiceCommand');
    expect(shell).toHaveAttribute('data-session-id', 'session-a');

    expect(screen.getByTestId('agent-elements-pending-voice-command-header')).toHaveTextContent('Voice Command');
    expect(screen.getByTestId('agent-elements-pending-voice-command-body')).toContainElement(screen.getByPlaceholderText('Voice command...'));
    expect(screen.getByTestId('agent-elements-pending-voice-command-footer')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-pending-voice-command-countdown')).toHaveTextContent('Sending in');

    fireEvent.click(screen.getByRole('button', { name: /send now/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      command.prompt,
      'session-a',
      '/workspace/project',
      { prepend: 'Use concise mode' },
    );
    expect(store.get(pendingVoiceCommandAtom)).toBeNull();
  });

  it('keeps session filtering, editing pause, Enter submit, and Escape cancel behavior', () => {
    const mismatched = renderPendingVoiceCommand(pendingCommand({ sessionId: 'session-b' }));
    expect(screen.queryByTestId('agent-elements-pending-voice-command')).not.toBeInTheDocument();
    expect(mismatched.onSubmit).not.toHaveBeenCalled();
    cleanup();

    const command = pendingCommand({ id: 'voice-command-2' });
    const { onSubmit, store } = renderPendingVoiceCommand(command);
    const textarea = screen.getByPlaceholderText('Voice command...');

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByTestId('agent-elements-pending-voice-command-countdown')).toHaveTextContent('Paused - editing');

    fireEvent.change(textarea, { target: { value: 'Use the selected files' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith(
      'Use the selected files',
      'session-a',
      '/workspace/project',
      { prepend: 'Use concise mode' },
    );

    act(() => {
      store.set(pendingVoiceCommandAtom, pendingCommand({ id: 'voice-command-3' }));
    });
    fireEvent.keyDown(screen.getByPlaceholderText('Voice command...'), { key: 'Escape' });
    expect(store.get(pendingVoiceCommandAtom)).toBeNull();
  });

  it('auto-submits when the countdown reaches zero', () => {
    const command = pendingCommand({ id: 'voice-command-4', delayMs: 300 });
    const { onSubmit } = renderPendingVoiceCommand(command);

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      command.prompt,
      'session-a',
      '/workspace/project',
      { prepend: 'Use concise mode' },
    );
  });

  it('keeps PendingVoiceCommand source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-pending-voice-command');
    expect(source).toContain('data-agent-elements-shell');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b/);
    expect(source).not.toMatch(/text-white|uppercase|tracking-|hover:shadow|active:scale|transition-all/);
    expect(source).not.toMatch(/shadow-\[/);
  });
});
