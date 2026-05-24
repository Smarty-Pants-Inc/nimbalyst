// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceModeButton } from '../VoiceModeButton';

const sourcePath = resolve(__dirname, '../VoiceModeButton.tsx');

const { atomValues, runtimeStoreSet, openSettingsCommandAtom } = vi.hoisted(() => ({
  atomValues: new Map<string, unknown>(),
  runtimeStoreSet: vi.fn(),
  openSettingsCommandAtom: { key: 'openSettingsCommand' },
}));

vi.mock('jotai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jotai')>();
  return {
    ...actual,
    useAtomValue: vi.fn((atom: { key?: string }) => atomValues.get(atom?.key ?? '')),
  };
});

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      fill,
      className,
    }: {
      icon: string;
      size?: number;
      fill?: boolean;
      className?: string;
    }) => ReactModule.createElement('span', {
      'data-icon': icon,
      'data-size': size,
      'data-fill': fill ? 'true' : 'false',
      className,
    }),
  };
});

vi.mock('@nimbalyst/runtime/store', () => ({
  store: {
    get: vi.fn(() => 'listening'),
    set: runtimeStoreSet,
  },
}));

vi.mock('../../../store', () => ({
  openSettingsCommandAtom,
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  voiceModeEnabledAtom: { key: 'voiceModeEnabled' },
}));

vi.mock('../../../store/atoms/sessions', () => ({
  activeSessionIdAtom: { key: 'activeSessionId' },
}));

vi.mock('../../../store/atoms/voiceModeState', () => ({
  voiceTokenUsageAtom: { key: 'voiceTokenUsage' },
  voiceListenStateAtom: { key: 'voiceListenState' },
  voiceErrorAtom: { key: 'voiceError' },
  registerVoiceAudioCallback: vi.fn(),
  registerVoiceInterruptCallback: vi.fn(),
  registerVoiceSubmitPromptCallback: vi.fn(),
  registerVoiceAgentTaskCompleteCallback: vi.fn(),
  registerVoiceStoppedCallback: vi.fn(),
  registerVoiceResponseDoneCallback: vi.fn(),
  registerVoiceAudioActiveQuery: vi.fn(),
}));

vi.mock('../../../store/listeners/voiceModeListeners', () => ({
  setVoiceActiveSession: vi.fn(),
  clearVoiceActiveSession: vi.fn(),
  persistAndClearVoiceSession: vi.fn(),
  onLinkedSessionChanged: vi.fn(),
  wakeVoiceListening: vi.fn(),
  notifyVoiceAudioPlaybackDrained: vi.fn(),
}));

vi.mock('../../../utils/audioCapture', () => ({
  AudioCapture: vi.fn().mockImplementation(() => ({
    start: vi.fn(async () => undefined),
    stop: vi.fn(),
  })),
}));

vi.mock('../../../utils/audioPlayback', () => ({
  AudioPlayback: vi.fn().mockImplementation(() => ({
    setOnDrained: vi.fn(),
    play: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    isPlaybackActive: vi.fn(() => false),
  })),
}));

vi.mock('../../../help', () => ({
  HelpTooltip: ({ children, extraContent }: { children: React.ReactNode; extraContent?: React.ReactNode }) => (
    <div data-testid="mock-help-tooltip">
      {children}
      {extraContent ? <div data-testid="mock-help-extra">{extraContent}</div> : null}
    </div>
  ),
}));

describe('UnifiedAI VoiceModeButton Agent Elements shell', () => {
  beforeEach(() => {
    atomValues.clear();
    atomValues.set('voiceModeEnabled', true);
    atomValues.set('activeSessionId', 'session-a');
    atomValues.set('voiceListenState', 'off');
    atomValues.set('voiceError', null);
    atomValues.set('voiceTokenUsage', null);
    runtimeStoreSet.mockClear();

    (window as any).electronAPI = {
      invoke: vi.fn(async (channel: string) => {
        if (channel === 'voice-mode:test-connection') {
          return { success: false, message: 'Missing API key in settings' };
        }
        return { success: true };
      }),
      send: vi.fn(),
    };
  });

  it('renders inactive and disabled states in Agent Elements voice toggle chrome', () => {
    atomValues.set('activeSessionId', null);

    render(<VoiceModeButton workspacePath="/workspace/project" />);

    const shell = screen.getByTestId('agent-elements-voice-mode-button');
    expect(shell).toHaveClass('voice-mode-button', 'agent-elements-voice-mode-button');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'voice-mode-button');
    expect(shell).toHaveAttribute('data-component', 'UnifiedAIVoiceModeButton');
    expect(shell).toHaveAttribute('data-voice-state', 'disabled');
    expect(shell).toHaveAttribute('data-listen-state', 'off');

    const button = screen.getByTestId('voice-mode-toggle');
    expect(button).toHaveClass('agent-elements-voice-mode-toggle');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-label', 'Voice Mode (no active session)');
    expect(screen.getByText('', { selector: '[data-icon="mic_off"]' })).toBeInTheDocument();
  });

  it('preserves failed connection settings action inside the Agent Elements error shell', async () => {
    render(<VoiceModeButton workspacePath="/workspace/project" />);

    fireEvent.click(screen.getByTestId('voice-mode-toggle'));

    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
        'voice-mode:test-connection',
        '/workspace/project',
        'session-a',
      );
    });

    const error = await screen.findByTestId('agent-elements-voice-mode-error');
    expect(error).toHaveClass('voice-mode-error-popover', 'agent-elements-voice-mode-error');
    expect(error).toHaveAttribute('data-agent-elements-shell', 'voice-mode-error');
    expect(error).toHaveTextContent('Missing API key in settings');

    fireEvent.click(screen.getByTestId('voice-mode-error-open-settings'));
    expect(runtimeStoreSet).toHaveBeenCalledWith(
      openSettingsCommandAtom,
      expect.objectContaining({ category: 'voice-mode', scope: 'user' }),
    );
  });

  it('keeps VoiceModeButton source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-voice-mode-button');
    expect(source).toContain('data-agent-elements-shell');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b/);
    expect(source).not.toMatch(/text-white|uppercase|tracking-|hover:shadow|active:scale|transition-all/);
    expect(source).not.toMatch(/shadow-\[/);
  });
});
