// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  tokens: {
    providersAtom: 'providersAtom',
    setWindowModeAtom: 'setWindowModeAtom',
    navigateToSettingsAtom: 'navigateToSettingsAtom',
  },
  providers: {},
  setWindowMode: vi.fn(),
  navigateToSettings: vi.fn(),
  agentProviders: new Set(['claude-code', 'openai-codex-acp', 'smarty-server', 'opencode', 'copilot-cli']),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.providersAtom) return mockState.providers;
    return null;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.setWindowModeAtom) return mockState.setWindowMode;
    if (atom === mockState.tokens.navigateToSettingsAtom) return mockState.navigateToSettings;
    return vi.fn();
  }),
}));

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
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
    getProviderIcon: (provider: string, { size }: { size?: number } = {}) =>
      ReactModule.createElement('span', { 'data-provider-icon': provider, 'data-size': size }),
  };
});

vi.mock('@nimbalyst/runtime/ai/server/types', () => ({
  CLAUDE_CODE_VARIANTS: ['sonnet'],
  ModelIdentifier: {
    tryParse: (modelId: string) => {
      const [provider, model = 'sonnet'] = modelId.split(':');
      return {
        provider,
        model,
        baseVariant: model.replace(/-.*/, '') || 'sonnet',
        isExtendedContext: false,
      };
    },
  },
  isAgentProvider: (provider: string) => mockState.agentProviders.has(provider),
  shouldBlockStartedSessionProviderSwitch: (
    currentProvider: string | null | undefined,
    targetProvider: string,
    sessionHasMessages?: boolean
  ) => Boolean(sessionHasMessages && currentProvider && targetProvider !== currentProvider),
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  providersAtom: mockState.tokens.providersAtom,
}));

vi.mock('../../../store/atoms/windowMode', () => ({
  setWindowModeAtom: mockState.tokens.setWindowModeAtom,
}));

vi.mock('../../../store/atoms/settingsNavigation', () => ({
  navigateToSettingsAtom: mockState.tokens.navigateToSettingsAtom,
}));

vi.mock('../../../hooks/useFloatingMenu', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    FloatingPortal: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useFloatingMenu: () => {
      const [isOpen, setIsOpen] = ReactModule.useState(false);
      return {
        isOpen,
        setIsOpen,
        refs: {
          setReference: vi.fn(),
          setFloating: vi.fn(),
        },
        floatingStyles: {},
        getReferenceProps: () => ({}),
        getFloatingProps: () => ({}),
      };
    },
  };
});

import { ModelSelector } from '../ModelSelector';

const sourcePath = resolve(__dirname, '../ModelSelector.tsx');

const groupedModels = {
  'claude-code': [
    { id: 'claude-code:sonnet', name: 'Claude Sonnet', provider: 'claude-code' },
  ],
  'smarty-server': [
    { id: 'smarty-server:smarty_coding_agent', name: 'Smarty Coding Agent', provider: 'smarty-server' },
  ],
  openai: [
    { id: 'openai:gpt-4.1', name: 'GPT-4.1', provider: 'openai' },
  ],
};

function renderModelSelector(props: Partial<React.ComponentProps<typeof ModelSelector>> = {}) {
  const onModelChange = vi.fn();
  render(
    <ModelSelector
      currentModel="claude-code:sonnet"
      currentProvider="claude-code"
      onModelChange={onModelChange}
      {...props}
    />
  );
  return { onModelChange };
}

describe('UnifiedAI ModelSelector Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(window, {
      electronAPI: {
        aiGetModels: vi.fn().mockResolvedValue({ success: true, grouped: groupedModels }),
      },
    });
  });

  it('renders Agent Elements model-picker chrome and preserves model selection', async () => {
    const { onModelChange } = renderModelSelector();

    const root = screen.getByTestId('agent-elements-model-selector');
    expect(root).toHaveClass('model-selector', 'agent-elements-model-selector');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'model-selector');
    expect(root).toHaveAttribute('data-component', 'UnifiedAIModelSelector');

    const trigger = screen.getByTestId('model-picker');
    expect(trigger).toHaveClass('agent-elements-model-selector-trigger', 'agent-elements-status-pill');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-label', 'Current model: Claude Agent · Sonnet 4.6');

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(window.electronAPI.aiGetModels).toHaveBeenCalledTimes(1);
    });

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByTestId('agent-elements-model-selector-menu');
    expect(menu).toHaveClass('model-selector-dropdown', 'agent-elements-model-selector-menu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'model-selector-menu');
    expect(menu).toHaveAttribute('data-model-group-count', '3');
    expect(within(menu).getByText('Agents')).toBeInTheDocument();
    expect(within(menu).getByText('Chat with open document')).toBeInTheDocument();

    const current = within(menu).getByRole('menuitemradio', { name: 'Claude Sonnet' });
    expect(current).toHaveAttribute('aria-checked', 'true');
    expect(current).toHaveAttribute('data-provider', 'claude-code');
    expect(current).toHaveAttribute('data-model-id', 'claude-code:sonnet');

    const next = within(menu).getByRole('menuitemradio', { name: 'GPT-4.1' });
    fireEvent.click(next);

    expect(onModelChange).toHaveBeenCalledWith('openai:gpt-4.1');
    expect(screen.queryByTestId('agent-elements-model-selector-menu')).not.toBeInTheDocument();
  });

  it('preserves provider-switch lockout and configure navigation', async () => {
    const { onModelChange } = renderModelSelector({ sessionHasMessages: true });

    fireEvent.click(screen.getByTestId('model-picker'));
    await waitFor(() => {
      expect(window.electronAPI.aiGetModels).toHaveBeenCalledTimes(1);
    });

    const menu = screen.getByTestId('agent-elements-model-selector-menu');
    expect(within(menu).getByText('Start a new session to use chat models')).toBeInTheDocument();

    const disabledChatModel = within(menu).getByRole('menuitemradio', { name: 'GPT-4.1' });
    expect(disabledChatModel).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(disabledChatModel);
    expect(onModelChange).not.toHaveBeenCalled();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Configure models' }));

    expect(mockState.navigateToSettings).toHaveBeenCalledWith({
      category: 'claude-code',
      scope: 'user',
    });
    expect(mockState.setWindowMode).toHaveBeenCalledWith('settings');
  });

  it('keeps ModelSelector source on Floating UI and Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('useFloatingMenu');
    expect(source).toContain('FloatingPortal');
    expect(source).toContain('agent-elements-model-selector');
    expect(source).not.toContain('createPortal');
    expect(source).not.toContain('getBoundingClientRect');
    expect(source).not.toContain('dropdownPos');
    expect(source).not.toContain('window.innerHeight');
    expect(source).not.toMatch(/bg-nim|text-nim|bg-\[var\(--nim|text-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b/);
    expect(source).not.toMatch(/uppercase|tracking-|hover:shadow|active:scale|transition-all/);
    expect(source).not.toMatch(/shadow-\[/);
  });
});
