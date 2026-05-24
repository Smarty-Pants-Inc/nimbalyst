// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => {
  const voiceModeSettings = {
    enabled: true,
    voice: 'alloy',
    turnDetection: {
      mode: 'server_vad',
      vadThreshold: 0.5,
      silenceDuration: 500,
      interruptible: true,
    },
    voiceAgentPrompt: { prepend: '', append: '' },
    codingAgentPrompt: { prepend: '', append: '' },
    submitDelayMs: 3000,
    listenWindowMs: 15000,
  };

  return {
    tokens: {
      voiceModeSettingsAtom: 'voiceModeSettingsAtom',
      setVoiceModeSettingsAtom: 'setVoiceModeSettingsAtom',
      apiKeysAtom: 'apiKeysAtom',
      setApiKeyAtom: 'setApiKeyAtom',
      defaultAgentModelAtom: 'defaultAgentModelAtom',
      voiceModePreviewAudioAtom: 'voiceModePreviewAudioAtom',
      addSessionFullAtom: 'addSessionFullAtom',
      setSelectedWorkstreamAtom: 'setSelectedWorkstreamAtom',
      setWindowModeAtom: 'setWindowModeAtom',
      navigateToSettingsAtom: 'navigateToSettingsAtom',
    },
    voiceModeSettings,
    apiKeys: { openai: 'sk-test' },
    defaultAgentModel: 'smarty-server:smarty_coding_agent',
    updateVoiceModeSettings: vi.fn(),
    setApiKey: vi.fn(),
    addSession: vi.fn(),
    setSelectedWorkstream: vi.fn(),
    setWindowMode: vi.fn(),
    navigateToSettings: vi.fn(),
    confirm: vi.fn(),
  };
});

vi.mock('jotai', () => ({
  useAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.voiceModeSettingsAtom) {
      return [mockState.voiceModeSettings, mockState.updateVoiceModeSettings];
    }
    if (atom === mockState.tokens.setVoiceModeSettingsAtom) {
      return [null, mockState.updateVoiceModeSettings];
    }
    if (atom === mockState.tokens.setApiKeyAtom) {
      return [null, mockState.setApiKey];
    }
    return [null, vi.fn()];
  }),
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.apiKeysAtom) return mockState.apiKeys;
    if (atom === mockState.tokens.defaultAgentModelAtom) return mockState.defaultAgentModel;
    if (atom === mockState.tokens.voiceModePreviewAudioAtom) return null;
    return null;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.addSessionFullAtom) return mockState.addSession;
    if (atom === mockState.tokens.setSelectedWorkstreamAtom) return mockState.setSelectedWorkstream;
    if (atom === mockState.tokens.setWindowModeAtom) return mockState.setWindowMode;
    if (atom === mockState.tokens.navigateToSettingsAtom) return mockState.navigateToSettings;
    return vi.fn();
  }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size, className }: { icon: string; size?: number; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

vi.mock('@nimbalyst/runtime/ai/server/types', () => ({
  ModelIdentifier: {
    tryParse: vi.fn(() => ({ provider: 'smarty-server' })),
  },
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  voiceModeSettingsAtom: mockState.tokens.voiceModeSettingsAtom,
  setVoiceModeSettingsAtom: mockState.tokens.setVoiceModeSettingsAtom,
  apiKeysAtom: mockState.tokens.apiKeysAtom,
  setApiKeyAtom: mockState.tokens.setApiKeyAtom,
  defaultAgentModelAtom: mockState.tokens.defaultAgentModelAtom,
}));

vi.mock('../../../store/atoms/voiceModeState', () => ({
  voiceModePreviewAudioAtom: mockState.tokens.voiceModePreviewAudioAtom,
}));

vi.mock('../../../store', () => ({
  addSessionFullAtom: mockState.tokens.addSessionFullAtom,
  setSelectedWorkstreamAtom: mockState.tokens.setSelectedWorkstreamAtom,
  setWindowModeAtom: mockState.tokens.setWindowModeAtom,
  navigateToSettingsAtom: mockState.tokens.navigateToSettingsAtom,
}));

vi.mock('../../../contexts/DialogContext', () => ({
  useDialog: () => ({ confirm: mockState.confirm }),
}));

import { VoiceModePanel } from '../VoiceModePanel';

describe('VoiceModePanel Agent Elements shell', () => {
  beforeEach(() => {
    mockState.updateVoiceModeSettings.mockClear();
    mockState.setApiKey.mockClear();
    mockState.addSession.mockClear();
    mockState.setSelectedWorkstream.mockClear();
    mockState.setWindowMode.mockClear();
    mockState.navigateToSettings.mockClear();
    mockState.confirm.mockReset();
    mockState.confirm.mockResolvedValue(true);
    mockState.apiKeys.openai = 'sk-test';
    mockState.defaultAgentModel = 'smarty-server:smarty_coding_agent';

    (window as any).electronAPI = {
      invoke: vi.fn((channel: string) => {
        if (channel === 'voice-mode:get-mic-status') {
          return Promise.resolve({ status: 'denied', platform: 'darwin' });
        }
        if (channel === 'file:exists') return Promise.resolve(true);
        if (channel === 'voice-mode:preview-voice') return Promise.resolve({ success: true });
        if (channel === 'sessions:create') {
          return Promise.resolve({ success: true, id: 'voice-summary-session' });
        }
        return Promise.resolve(undefined);
      }),
    };
  });

  it('renders Agent Elements markers while preserving voice setting IPC behavior', async () => {
    render(<VoiceModePanel workspacePath="/workspace/app" />);

    const panel = await screen.findByTestId('agent-elements-voice-mode-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'voice-mode-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(panel).toHaveClass('agent-elements-voice-mode-panel');
    expect(screen.getByTestId('agent-elements-voice-mode-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-voice-mode-enable-section')).toHaveAttribute('data-section', 'enable');
    expect(screen.getByTestId('agent-elements-voice-mode-mic-warning')).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByTestId('voice-mode-mic-permission-warning')).toHaveAttribute('data-agent-elements-shell', 'voice-mode-mic-warning');
    expect(screen.getByTestId('agent-elements-voice-mode-voice-section')).toHaveAttribute('data-section', 'voice');
    expect(screen.getByTestId('agent-elements-voice-mode-turn-section')).toHaveAttribute('data-section', 'turn-detection');
    expect(screen.getByTestId('agent-elements-voice-mode-summary-section')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-voice-mode-prompts-section')).toHaveAttribute('data-section', 'prompts');

    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'sk-next' } });
    expect(mockState.setApiKey).toHaveBeenCalledWith({ keyName: 'openai', value: 'sk-next' });

    fireEvent.click(screen.getByLabelText(/Show Voice Mode Button/));
    expect(mockState.updateVoiceModeSettings).toHaveBeenCalledWith({ enabled: false });

    fireEvent.change(screen.getByTestId('voice-mode-voice-select'), { target: { value: 'coral' } });
    expect(mockState.updateVoiceModeSettings).toHaveBeenCalledWith({ voice: 'coral' });

    fireEvent.click(screen.getByTestId('voice-mode-preview-button'));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('voice-mode:preview-voice', 'alloy'));

    fireEvent.click(screen.getByTestId('voice-mode-open-mic-settings'));
    expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('voice-mode:open-mic-settings');

    fireEvent.click(screen.getByTestId('voice-mode-summary-view'));
    expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('workspace:open-file', {
      workspacePath: '/workspace/app',
      filePath: '/workspace/app/nimbalyst-local/voice-project-summary.md',
    });
  });

  it('preserves summary generation and settings navigation inside Agent Elements shells', async () => {
    (window as any).electronAPI.invoke = vi.fn((channel: string) => {
      if (channel === 'voice-mode:get-mic-status') {
        return Promise.resolve({ status: 'granted', platform: 'darwin' });
      }
      if (channel === 'file:exists') return Promise.resolve(false);
      if (channel === 'voice-mode:preview-voice') return Promise.resolve({ success: true });
      if (channel === 'sessions:create') {
        return Promise.resolve({ success: true, id: 'voice-summary-session' });
      }
      return Promise.resolve(undefined);
    });

    render(<VoiceModePanel workspacePath="/workspace/app" />);

    const generateButton = await screen.findByTestId('voice-mode-summary-generate');
    expect(screen.getByTestId('agent-elements-voice-mode-summary-section')).toHaveAttribute('data-agent-elements-shell', 'voice-mode-summary-card');

    fireEvent.click(generateButton);

    await waitFor(() => expect(mockState.confirm).toHaveBeenCalled());
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('sessions:create', expect.objectContaining({
      session: expect.objectContaining({
        id: expect.any(String),
        provider: 'smarty-server',
        model: 'smarty-server:smarty_coding_agent',
        title: 'Voice mode: project summary',
      }),
      workspaceId: '/workspace/app',
    })));
    expect(mockState.addSession).toHaveBeenCalledWith(expect.objectContaining({
      id: 'voice-summary-session',
      provider: 'smarty-server',
      model: 'smarty-server:smarty_coding_agent',
      workspaceId: '/workspace/app',
    }));
    expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
      'ai:sendMessage',
      expect.stringContaining('voice-friendly project summary'),
      undefined,
      'voice-summary-session',
      '/workspace/app',
    );
    expect(mockState.setWindowMode).toHaveBeenCalledWith('agent');
    expect(mockState.setSelectedWorkstream).toHaveBeenCalledWith({
      workspacePath: '/workspace/app',
      selection: { type: 'session', id: 'voice-summary-session' },
    });

    mockState.defaultAgentModel = '';
    render(<VoiceModePanel workspacePath="/workspace/app" />);

    const noAgent = await screen.findByTestId('voice-mode-summary-no-agent');
    fireEvent.click(noAgent.querySelector('button')!);
    expect(mockState.navigateToSettings).toHaveBeenCalledWith({ category: 'claude-code' });
  });
});
