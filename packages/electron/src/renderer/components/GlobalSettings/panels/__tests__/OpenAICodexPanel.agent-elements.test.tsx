// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAICodexPanel } from '../OpenAICodexPanel';

const sourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/OpenAICodexPanel.tsx',
);
const chromeSourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/providerPanelChrome.ts',
);
const legacyVisualChromePattern =
  /bg-nim|text-nim|border-nim|bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-|rgba\(|#[0-9a-fA-F]{3,8}\b|bg-white|rounded-lg|transition-all/;

const mockState = vi.hoisted(() => ({
  tokens: {
    usageIndicatorEnabledAtom: 'usageIndicatorEnabledAtom',
    setUsageIndicatorEnabledAtom: 'setUsageIndicatorEnabledAtom',
    acpConfigAtom: 'acpConfigAtom',
    setProviderConfigAtom: 'setProviderConfigAtom',
  },
  usageIndicatorEnabled: true,
  acpConfig: { enabled: true },
  setUsageIndicatorEnabled: vi.fn(),
  setProviderConfig: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.usageIndicatorEnabledAtom) return mockState.usageIndicatorEnabled;
    if (atom === mockState.tokens.acpConfigAtom) return mockState.acpConfig;
    return null;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.setUsageIndicatorEnabledAtom) return mockState.setUsageIndicatorEnabled;
    if (atom === mockState.tokens.setProviderConfigAtom) return mockState.setProviderConfig;
    return vi.fn();
  }),
}));

vi.mock('../../../../store/atoms/codexUsageAtoms', () => ({
  codexUsageIndicatorEnabledAtom: mockState.tokens.usageIndicatorEnabledAtom,
  setCodexUsageIndicatorEnabledAtom: mockState.tokens.setUsageIndicatorEnabledAtom,
}));

vi.mock('../../../../store/atoms/appSettings', () => ({
  getProviderConfigAtom: vi.fn((providerId: string) => {
    expect(providerId).toBe('openai-codex-acp');
    return mockState.tokens.acpConfigAtom;
  }),
  setProviderConfigAtom: mockState.tokens.setProviderConfigAtom,
}));

const baseProps = () => ({
  config: {
    enabled: true,
    testStatus: 'idle' as const,
  },
  apiKeys: {},
  availableModels: [],
  loading: false,
  onToggle: vi.fn(),
  onApiKeyChange: vi.fn(),
  onModelToggle: vi.fn(),
  onSelectAllModels: vi.fn(),
  onTestConnection: vi.fn().mockResolvedValue(undefined),
  onConfigChange: vi.fn(),
});

describe('OpenAICodexPanel Agent Elements shell', () => {
  beforeEach(() => {
    mockState.usageIndicatorEnabled = true;
    mockState.acpConfig = { enabled: true };
    mockState.setUsageIndicatorEnabled.mockClear();
    mockState.setProviderConfig.mockClear();
    (window as any).electronAPI = {
      invoke: vi.fn((channel: string, ...args: any[]) => {
        if (channel === 'openai-codex:check-login') {
          return Promise.resolve({
            installed: true,
            isLoggedIn: false,
            authMode: null,
            email: null,
            planType: null,
            message: 'Sign in required',
          });
        }
        if (channel === 'openai-codex:login-chatgpt') {
          return Promise.resolve({ success: true });
        }
        if (channel === 'openai-codex:login-apikey') {
          expect(args[0]).toBe('sk-test-codex');
          return Promise.resolve({ success: true });
        }
        if (channel === 'openai-codex:logout') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve(undefined);
      }),
      on: vi.fn(() => vi.fn()),
    };
  });

  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it('renders Agent Elements markers while preserving Codex auth, usage, and ACP behavior', async () => {
    const props = baseProps();
    render(<OpenAICodexPanel {...props} />);

    const panel = await screen.findByTestId('agent-elements-openai-codex-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'openai-codex-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-openai-codex-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-openai-codex-enable-toggle')).toHaveClass('provider-enable');
    expect(screen.getByTestId('agent-elements-openai-codex-usage-toggle')).toHaveClass('provider-enable');
    expect(screen.getByTestId('agent-elements-openai-codex-acp-section')).toHaveAttribute('data-section', 'legacy-acp-transport');
    expect(screen.getByTestId('codex-auth-section')).toHaveAttribute('data-section', 'sign-in');
    expect(screen.getByTestId('codex-auth-section')).toHaveAttribute('data-agent-elements-shell', 'openai-codex-auth-section');

    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('openai-codex:check-login');
      expect((window as any).electronAPI.on).toHaveBeenCalledWith('openai-codex:auth-updated', expect.any(Function));
    });

    fireEvent.click(within(screen.getByTestId('agent-elements-openai-codex-enable-toggle')).getByRole('checkbox', { hidden: true }));
    expect(props.onToggle).toHaveBeenCalledWith(false);

    fireEvent.click(within(screen.getByTestId('agent-elements-openai-codex-usage-toggle')).getByRole('checkbox', { hidden: true }));
    expect(mockState.setUsageIndicatorEnabled).toHaveBeenCalledWith(false);

    fireEvent.click(within(screen.getByTestId('agent-elements-openai-codex-acp-section')).getByRole('checkbox', { hidden: true }));
    expect(mockState.setProviderConfig).toHaveBeenCalledWith({
      providerId: 'openai-codex-acp',
      config: { enabled: false },
    });

    expect(screen.getByTestId('agent-elements-openai-codex-chatgpt-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-openai-codex-chatgpt-card')).toHaveAttribute('data-agent-elements-shell', 'openai-codex-chatgpt-card');
    fireEvent.click(screen.getByTestId('codex-login-chatgpt'));
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('openai-codex:login-chatgpt');
    });

    fireEvent.click(screen.getByTestId('codex-auth-method-apikey'));
    expect(screen.getByTestId('agent-elements-openai-codex-apikey-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-openai-codex-apikey-card')).toHaveAttribute('data-agent-elements-shell', 'openai-codex-apikey-card');
    fireEvent.change(screen.getByTestId('codex-apikey-input'), {
      target: { value: 'sk-test-codex' },
    });
    fireEvent.click(screen.getByTestId('codex-login-apikey'));
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('openai-codex:login-apikey', 'sk-test-codex');
    });
  });

  it('keeps OpenAI Codex chrome on Agent Elements aliases instead of legacy visual tokens', () => {
    const panelSource = readFileSync(sourcePath, 'utf8');
    const chromeSource = readFileSync(chromeSourcePath, 'utf8');
    const source = `${panelSource}\n${chromeSource}`;

    expect(panelSource).toContain('createProviderPanelChrome');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-background-tertiary');
    expect(source).toContain('--an-primary-color');
    expect(source).toContain('--an-send-button-color');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).not.toMatch(legacyVisualChromePattern);
  });
});
