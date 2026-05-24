// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  tokens: {
    usageIndicatorEnabledAtom: 'claudeUsageIndicatorEnabledAtom',
    setUsageIndicatorEnabledAtom: 'setClaudeUsageIndicatorEnabledAtom',
  },
  usageIndicatorEnabled: true,
  setUsageIndicatorEnabled: vi.fn(),
  capture: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.usageIndicatorEnabledAtom) return mockState.usageIndicatorEnabled;
    return null;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.setUsageIndicatorEnabledAtom) return mockState.setUsageIndicatorEnabled;
    return vi.fn();
  }),
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockState.capture }),
}));

vi.mock('../../../../store/atoms/claudeUsageAtoms', () => ({
  claudeUsageIndicatorEnabledAtom: mockState.tokens.usageIndicatorEnabledAtom,
  setClaudeUsageIndicatorEnabledAtom: mockState.tokens.setUsageIndicatorEnabledAtom,
}));

import { ClaudeCodePanel } from '../ClaudeCodePanel';

const mockElectronAPI = () => ({
  claudeCode: {
    getEnv: vi.fn().mockResolvedValue({ EXISTING_FLAG: '1' }),
    setEnv: vi.fn().mockResolvedValue(undefined),
  },
  invoke: vi.fn((channel: string) => {
    if (channel === 'claude-code:check-login') {
      return Promise.resolve({
        isLoggedIn: false,
        hasOAuthToken: false,
        isExpired: true,
      });
    }
    if (channel === 'ai:getProjectSettings') {
      return Promise.resolve({ success: true, overrides: {} });
    }
    return Promise.resolve(undefined);
  }),
  aiGetSettings: vi.fn().mockResolvedValue({
    customClaudeCodePath: '/opt/claude-wrapper',
    planTrackingEnabled: true,
  }),
  aiSaveSettings: vi.fn().mockResolvedValue(undefined),
  openFileDialog: vi.fn().mockResolvedValue({
    canceled: false,
    filePaths: ['/usr/local/bin/custom-claude'],
  }),
  cliCheckClaudeCodeWindowsInstallation: vi.fn().mockResolvedValue({
    isPlatformWindows: false,
    claudeCodeVersion: '1.2.3',
  }),
});

const baseProps = () => ({
  config: {
    enabled: true,
    authMethod: 'api-key',
    testStatus: 'error' as const,
    testMessage: 'Invalid Claude Agent API key',
  },
  apiKeys: {
    'claude-code': 'sk-ant-existing',
  },
  availableModels: [],
  loading: false,
  onToggle: vi.fn(),
  onApiKeyChange: vi.fn(),
  onModelToggle: vi.fn(),
  onSelectAllModels: vi.fn(),
  onTestConnection: vi.fn().mockResolvedValue(undefined),
  onConfigChange: vi.fn(),
});

describe('ClaudeCodePanel Agent Elements shell', () => {
  beforeEach(() => {
    mockState.usageIndicatorEnabled = true;
    mockState.setUsageIndicatorEnabled.mockClear();
    mockState.capture.mockClear();
    (window as any).electronAPI = mockElectronAPI();
  });

  it('renders Agent Elements markers while preserving Claude Agent auth, usage, path, and env behavior', async () => {
    const props = baseProps();
    render(<ClaudeCodePanel {...props} />);

    const panel = await screen.findByTestId('agent-elements-claude-code-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'claude-code-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-claude-code-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-claude-code-enable-toggle')).toHaveClass('provider-enable');
    expect(screen.getByTestId('agent-elements-claude-code-usage-toggle')).toHaveClass('provider-enable');
    expect(screen.getByTestId('agent-elements-claude-code-path-section')).toHaveAttribute('data-section', 'custom-installation');
    expect(screen.getByTestId('agent-elements-claude-code-sdk-section')).toHaveAttribute('data-section', 'agent-sdk');
    expect(screen.getByTestId('agent-elements-claude-code-auth-section')).toHaveAttribute('data-section', 'authentication');
    expect(screen.getByTestId('agent-elements-claude-code-auth-methods')).toHaveAttribute('data-agent-elements-shell', 'claude-code-auth-methods');
    expect(screen.getByTestId('agent-elements-claude-code-api-key-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-claude-code-permissions-section')).toHaveAttribute('data-section', 'tool-permissions');
    expect(screen.getByTestId('agent-elements-claude-code-env-section')).toHaveAttribute('data-section', 'environment-variables');
    expect(await screen.findByTestId('agent-elements-claude-code-env-row-EXISTING_FLAG')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-claude-code-add-env-row')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-claude-code-test-error')).toHaveTextContent('Invalid Claude Agent API key');

    fireEvent.click(within(screen.getByTestId('agent-elements-claude-code-enable-toggle')).getByRole('checkbox', { hidden: true }));
    expect(props.onToggle).toHaveBeenCalledWith(false);

    fireEvent.click(within(screen.getByTestId('agent-elements-claude-code-usage-toggle')).getByRole('checkbox', { hidden: true }));
    expect(mockState.setUsageIndicatorEnabled).toHaveBeenCalledWith(false);

    const pathInput = await screen.findByTestId('agent-elements-claude-code-path-input');
    fireEvent.change(pathInput, { target: { value: '/tmp/claude-wrapper' } });
    fireEvent.blur(pathInput);
    await waitFor(() => {
      expect((window as any).electronAPI.aiSaveSettings).toHaveBeenCalledWith({
        customClaudeCodePath: '/tmp/claude-wrapper',
      });
    });

    fireEvent.click(screen.getByTestId('agent-elements-claude-code-path-browse'));
    await waitFor(() => {
      expect((window as any).electronAPI.openFileDialog).toHaveBeenCalledWith({
        title: 'Select Claude Code Executable',
        buttonLabel: 'Select',
      });
    });

    fireEvent.click(screen.getByTestId('agent-elements-claude-code-auth-method-login'));
    expect(props.onConfigChange).toHaveBeenCalledWith({ authMethod: 'login' });

    fireEvent.click(screen.getByTestId('agent-elements-claude-code-auth-method-api-key'));
    fireEvent.change(screen.getByTestId('agent-elements-claude-code-api-key-input'), {
      target: { value: 'sk-ant-updated' },
    });
    expect(props.onApiKeyChange).toHaveBeenCalledWith('claude-code', 'sk-ant-updated');

    fireEvent.click(screen.getByTestId('agent-elements-claude-code-test-button'));
    expect(props.onTestConnection).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByTestId('agent-elements-claude-code-new-env-key'), {
      target: { value: 'new_flag' },
    });
    fireEvent.change(screen.getByTestId('agent-elements-claude-code-new-env-value'), {
      target: { value: 'enabled' },
    });
    fireEvent.click(screen.getByTestId('agent-elements-claude-code-add-env-button'));
    await waitFor(() => {
      expect((window as any).electronAPI.claudeCode.setEnv).toHaveBeenCalledWith({
        EXISTING_FLAG: '1',
        NEW_FLAG: 'enabled',
      });
    });
  });
});
