// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => {
  const aiProviderSettings = {
    providers: {
      'claude-code': { enabled: true, testStatus: 'success' },
      'openai-codex': { enabled: true, testStatus: 'success' },
      'smarty-server': { enabled: true, testStatus: 'error' },
      opencode: { enabled: false, testStatus: 'idle' },
      claude: { enabled: false, testStatus: 'idle' },
      openai: { enabled: false, testStatus: 'idle' },
      lmstudio: { enabled: false, testStatus: 'idle' },
    },
    apiKeys: {},
    availableModels: {},
  };

  return {
    tokens: {
      aiProviderSettingsAtom: 'aiProviderSettingsAtom',
      setAIProviderSettingsAtom: 'setAIProviderSettingsAtom',
      setProviderConfigAtom: 'setProviderConfigAtom',
      setApiKeyAtom: 'setApiKeyAtom',
      setAvailableModelsAtom: 'setAvailableModelsAtom',
      pushNavigationEntryAtom: 'pushNavigationEntryAtom',
      isRestoringNavigationAtom: 'isRestoringNavigationAtom',
    },
    aiProviderSettings,
    pushNavigationEntry: vi.fn(),
    updateAIProviderSettings: vi.fn(),
    updateProviderConfig: vi.fn(),
    updateApiKey: vi.fn(),
    updateAvailableModels: vi.fn(),
  };
});

vi.mock('jotai', () => ({
  useAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.aiProviderSettingsAtom) {
      return [mockState.aiProviderSettings, mockState.updateAIProviderSettings];
    }
    if (atom === mockState.tokens.setAIProviderSettingsAtom) {
      return [null, mockState.updateAIProviderSettings];
    }
    if (atom === mockState.tokens.setProviderConfigAtom) {
      return [null, mockState.updateProviderConfig];
    }
    if (atom === mockState.tokens.setApiKeyAtom) {
      return [null, mockState.updateApiKey];
    }
    if (atom === mockState.tokens.setAvailableModelsAtom) {
      return [null, mockState.updateAvailableModels];
    }
    return [null, vi.fn()];
  }),
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.isRestoringNavigationAtom) return false;
    return null;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.pushNavigationEntryAtom) return mockState.pushNavigationEntry;
    return vi.fn();
  }),
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size, className }: { icon: string; size?: number; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
    getProviderIcon: (provider: string) =>
      ReactModule.createElement('span', { 'data-provider-icon': provider }),
  };
});

vi.mock('@nimbalyst/runtime/store', () => ({
  store: {
    get: () => mockState.aiProviderSettings,
  },
}));

vi.mock('@nimbalyst/runtime/ai/server/utils/modelConfigUtils', () => ({
  omitModelsField: (config: Record<string, unknown>) => {
    const { models: _models, ...rest } = config;
    return rest;
  },
}));

vi.mock('../../../hooks/useAlphaFeature', () => ({
  useAlphaFeatures: () => ({ collaboration: true }),
}));

vi.mock('../../../store', () => ({
  pushNavigationEntryAtom: mockState.tokens.pushNavigationEntryAtom,
  isRestoringNavigationAtom: mockState.tokens.isRestoringNavigationAtom,
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  aiProviderSettingsAtom: mockState.tokens.aiProviderSettingsAtom,
  setAIProviderSettingsAtom: mockState.tokens.setAIProviderSettingsAtom,
  setProviderConfigAtom: mockState.tokens.setProviderConfigAtom,
  setApiKeyAtom: mockState.tokens.setApiKeyAtom,
  setAvailableModelsAtom: mockState.tokens.setAvailableModelsAtom,
  flushPendingAIProviderPersist: vi.fn(),
}));

vi.mock('../../../walkthroughs', () => ({ walkthroughs: {} }));

vi.mock('../../GlobalSettings/panels/ClaudePanel', () => ({ ClaudePanel: () => 'panel-claude' }));
vi.mock('../../GlobalSettings/panels/ClaudeCodePanel', () => ({ ClaudeCodePanel: () => 'panel-claude-code' }));
vi.mock('../../GlobalSettings/panels/OpenAIPanel', () => ({ OpenAIPanel: () => 'panel-openai' }));
vi.mock('../../GlobalSettings/panels/OpenAICodexPanel', () => ({ OpenAICodexPanel: () => 'panel-openai-codex' }));
vi.mock('../../GlobalSettings/panels/SmartyServerPanel', () => ({ SmartyServerPanel: () => 'panel-smarty-server' }));
vi.mock('../../GlobalSettings/panels/OpenCodePanel', () => ({ OpenCodePanel: () => 'panel-opencode' }));
vi.mock('../../GlobalSettings/panels/CopilotCLIPanel', () => ({ CopilotCLIPanel: () => 'panel-copilot-cli' }));
vi.mock('../../GlobalSettings/panels/LMStudioPanel', () => ({ LMStudioPanel: () => 'panel-lmstudio' }));
vi.mock('../../GlobalSettings/panels/AdvancedPanel', () => ({ AdvancedPanel: () => 'panel-advanced' }));
vi.mock('../AgentFeaturesPanel', () => ({ AgentFeaturesPanel: () => 'panel-agent-features' }));
vi.mock('../../GlobalSettings/panels/BetaFeaturesPanel', () => ({ BetaFeaturesPanel: () => 'panel-beta-features' }));
vi.mock('../../GlobalSettings/panels/NotificationsPanel', () => ({ NotificationsPanel: () => 'panel-notifications' }));
vi.mock('../VoiceModePanel', () => ({ VoiceModePanel: () => 'panel-voice-mode' }));
vi.mock('../../GlobalSettings/panels/MCPServersPanel', () => ({ MCPServersPanel: () => 'panel-mcp-servers' }));
vi.mock('../../GlobalSettings/panels/ClaudeCodePluginsPanel', () => ({ ClaudeCodePluginsPanel: () => 'panel-claude-plugins' }));
vi.mock('../../GlobalSettings/panels/SyncPanel', () => ({ SyncPanel: () => 'panel-sync' }));
vi.mock('../../GlobalSettings/panels/SharedLinksPanel', () => ({ SharedLinksPanel: () => 'panel-shared-links' }));
vi.mock('../panels/ProjectPermissionsPanel', () => ({ ProjectPermissionsPanel: () => 'panel-agent-permissions' }));
vi.mock('../panels/ProviderOverrideWrapper', () => ({
  ProviderOverrideWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="provider-override-wrapper">{children}</div>
  ),
}));
vi.mock('../panels/InstalledExtensionsPanel', () => ({ InstalledExtensionsPanel: () => 'panel-installed-extensions' }));
vi.mock('../panels/ThemesPanel', () => ({ ThemesPanel: () => 'panel-themes' }));
vi.mock('../panels/TeamPanel', () => ({ TeamPanel: () => 'panel-team' }));
vi.mock('../panels/TrackerConfigPanel', () => ({ TrackerConfigPanel: () => 'panel-tracker-config' }));
vi.mock('../panels/ExtensionMarketplacePanel', () => ({ ExtensionMarketplacePanel: () => 'panel-marketplace' }));

import { SettingsSidebar } from '../SettingsSidebar';
import { SettingsView } from '../SettingsView';

const settingsViewSourcePath = resolve(__dirname, '../SettingsView.tsx');
const settingsSidebarSourcePath = resolve(__dirname, '../SettingsSidebar.tsx');

describe('Settings Agent Elements shell', () => {
  beforeEach(() => {
    mockState.pushNavigationEntry.mockClear();
    mockState.updateAIProviderSettings.mockClear();
    (window as any).electronAPI = {
      aiGetAllModels: vi.fn().mockResolvedValue({ success: true, grouped: {} }),
      aiClearModelCache: vi.fn().mockResolvedValue(undefined),
      aiTestConnection: vi.fn().mockResolvedValue({ success: true }),
      invoke: vi.fn().mockResolvedValue({ mcpServers: { local: {} } }),
    };
  });

  it('renders the Settings sidebar with Agent Elements markers while preserving groups and provider status', () => {
    const onSelectCategory = vi.fn();

    render(
      <SettingsSidebar
        selectedCategory="openai-codex"
        onSelectCategory={onSelectCategory}
        providerStatus={{
          'openai-codex': { enabled: true, testStatus: 'success' },
          'smarty-server': { enabled: true, testStatus: 'error' },
        }}
        scope="user"
      />,
    );

    const sidebar = screen.getByTestId('agent-elements-settings-sidebar');
    expect(sidebar).toHaveAttribute('data-agent-elements-shell', 'settings-sidebar');
    expect(sidebar).toHaveClass('agent-elements-settings-sidebar');
    expect(screen.getByTestId('agent-elements-settings-sidebar-content')).toHaveClass('agent-elements-settings-sidebar-content');
    expect(screen.getByTestId('agent-elements-settings-group-agent-providers')).toHaveAttribute('data-settings-group', 'Agent Providers');
    expect(screen.queryByTestId('agent-elements-settings-group-project')).not.toBeInTheDocument();

    const codexItem = screen.getByTestId('agent-elements-settings-item-openai-codex');
    expect(codexItem).toHaveAttribute('data-settings-category', 'openai-codex');
    expect(codexItem).toHaveAttribute('data-selected', 'true');
    expect(codexItem.querySelector('.agent-elements-status-dot')).toHaveAttribute('data-tone', 'success');

    const smartyServerItem = screen.getByTestId('agent-elements-settings-item-smarty-server');
    expect(smartyServerItem.querySelector('.agent-elements-status-dot')).toHaveAttribute('data-tone', 'error');
    fireEvent.click(smartyServerItem);
    expect(onSelectCategory).toHaveBeenCalledWith('smarty-server');
  });

  it('preserves Settings shell scope behavior and panel rendering under Agent Elements markers', async () => {
    render(
      <SettingsView
        workspacePath="/workspace"
        workspaceName="Demo Workspace"
        onClose={() => {}}
        initialScope="project"
        initialCategory="agent-permissions"
      />,
    );

    expect(screen.getByTestId('agent-elements-settings-view')).toHaveAttribute('data-component', 'SettingsView');
    expect(screen.getByTestId('agent-elements-settings-header')).toHaveClass('agent-elements-settings-header');
    expect(screen.getByTestId('agent-elements-settings-scope-tabs')).toHaveAttribute('data-agent-elements-shell', 'settings-scope-tabs');
    expect(screen.getByTestId('agent-elements-settings-body')).toHaveClass('agent-elements-settings-body');
    expect(screen.getByTestId('agent-elements-settings-main')).toHaveClass('agent-elements-settings-main');
    expect(screen.getByTestId('agent-elements-settings-panel-container')).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByText('panel-agent-permissions')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('agent-elements-settings-scope-user'));

    await waitFor(() => expect(screen.getByText('panel-smarty-server')).toBeInTheDocument());
    expect(screen.getByTestId('agent-elements-settings-scope-user')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByText('These settings apply to all projects')).toBeInTheDocument();
    expect(mockState.pushNavigationEntry).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'settings',
      settings: expect.objectContaining({ category: 'smarty-server', scope: 'user' }),
    }));
  });

  it('renders the workspace MCP indicator with Agent Elements chrome while preserving project-server count copy', async () => {
    render(
      <SettingsView
        workspacePath="/workspace"
        workspaceName="Demo Workspace"
        onClose={() => {}}
        initialScope="user"
        initialCategory="mcp-servers"
      />,
    );

    const indicator = await screen.findByTestId('agent-elements-settings-project-indicator');
    expect(indicator).toHaveAttribute('data-agent-elements-shell', 'settings-project-indicator');
    expect(indicator).toHaveClass('agent-elements-settings-project-indicator', 'agent-elements-status-pill');
    expect(indicator).toHaveTextContent('There is 1 additional MCP server configured just for this project.');
    expect(screen.getByText('Switch to the Project tab above to view or edit project-specific MCP servers.')).toBeInTheDocument();
  });

  it('keeps the SettingsView shell on Agent Elements theme aliases instead of legacy visual tokens', () => {
    const source = readFileSync(settingsViewSourcePath, 'utf8');

    expect(source).toContain('agent-elements-settings-view');
    expect(source).toContain('agent-elements-settings-project-indicator');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-primary-color');
    expect(source).not.toMatch(/--nim-/);
    expect(source).not.toMatch(/rgba\(/);
    expect(source).not.toContain('text-white');
    expect(source).not.toContain('rounded-lg');
    expect(source).not.toContain('shadow-sm');
  });

  it('keeps the SettingsSidebar shell on Agent Elements aliases instead of legacy visual tokens', () => {
    const source = readFileSync(settingsSidebarSourcePath, 'utf8');

    expect(source).toContain('agent-elements-settings-sidebar');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-foreground-muted');
    expect(source).toContain('--an-success-color');
    expect(source).toContain('--an-error-color');
    expect(source).toContain('--an-warning-color');
    expect(source).not.toMatch(/--nim-/);
    expect(source).not.toMatch(/rgba\(|#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toContain('text-white');
    expect(source).not.toContain('rounded-lg');
    expect(source).not.toContain('shadow-lg');
    expect(source).not.toContain('tracking-wider');
  });
});
