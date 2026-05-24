import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getAIProviderOverridesMock } = vi.hoisted(() => ({
  getAIProviderOverridesMock: vi.fn(),
}));

vi.mock('../store', async () => {
  const actual = await vi.importActual<typeof import('../store')>('../store');
  return {
    ...actual,
    getAIProviderOverrides: getAIProviderOverridesMock,
  };
});

import { getEffectiveApiKey, getEnabledProviders, mergeAISettings, GlobalAISettings } from '../aiSettingsMerge';
import { normalizeAIProviderOverrides } from '../store';

const baseGlobal: GlobalAISettings = {
  defaultProvider: 'claude-code',
  apiKeys: {},
  providerSettings: {},
  showToolCalls: false,
  aiDebugLogging: false,
  showPromptAdditions: false,
  customClaudeCodePath: '/usr/local/bin/claude-global',
};

describe('mergeAISettings -- customClaudeCodePath', () => {
  beforeEach(() => {
    getAIProviderOverridesMock.mockReset();
  });

  it('inherits the global path when no project override is set', () => {
    getAIProviderOverridesMock.mockReturnValue(undefined);

    const effective = mergeAISettings(baseGlobal, '/workspace/a');

    expect(effective.customClaudeCodePath).toBe('/usr/local/bin/claude-global');
    expect(effective.overrides.customClaudeCodePath).toBe(false);
  });

  it('uses the project override when set, marking it as overridden', () => {
    getAIProviderOverridesMock.mockReturnValue({
      customClaudeCodePath: '/opt/project/claude',
    });

    const effective = mergeAISettings(baseGlobal, '/workspace/a');

    expect(effective.customClaudeCodePath).toBe('/opt/project/claude');
    expect(effective.overrides.customClaudeCodePath).toBe(true);
  });

  it('treats an empty-string override as an explicit override (use bundled SDK)', () => {
    getAIProviderOverridesMock.mockReturnValue({
      customClaudeCodePath: '',
    });

    const effective = mergeAISettings(baseGlobal, '/workspace/a');

    expect(effective.customClaudeCodePath).toBe('');
    expect(effective.overrides.customClaudeCodePath).toBe(true);
  });

  it('returns the global path unchanged when no workspace path is provided', () => {
    const effective = mergeAISettings(baseGlobal, undefined);

    expect(effective.customClaudeCodePath).toBe('/usr/local/bin/claude-global');
    expect(effective.overrides.customClaudeCodePath).toBe(false);
    expect(getAIProviderOverridesMock).not.toHaveBeenCalled();
  });

  it('inherits the parent project override when the workspace path is a worktree', () => {
    getAIProviderOverridesMock.mockImplementation((workspacePath: string) => {
      if (workspacePath === '/workspace/project') {
        return { customClaudeCodePath: '/opt/project/claude' };
      }
      return undefined;
    });

    const effective = mergeAISettings(baseGlobal, '/workspace/project_worktrees/swift-falcon');

    expect(effective.customClaudeCodePath).toBe('/opt/project/claude');
    expect(effective.overrides.customClaudeCodePath).toBe(true);
  });
});

describe('normalizeAIProviderOverrides', () => {
  it('collapses to undefined when only an empty codex provider is present', () => {
    const result = normalizeAIProviderOverrides({
      providers: { 'openai-codex': {} },
    });

    expect(result).toBeUndefined();
  });

  it('drops an empty codex entry while preserving other override fields', () => {
    const result = normalizeAIProviderOverrides({
      providers: { 'openai-codex': {} },
      customClaudeCodePath: '/opt/project/claude',
    });

    expect(result).toEqual({ customClaudeCodePath: '/opt/project/claude' });
    expect(result && 'providers' in result).toBe(false);
  });

  it('strips own-but-undefined customClaudeCodePath so an otherwise-empty override collapses', () => {
    const input: Record<string, unknown> = {
      providers: { 'openai-codex': {} },
      customClaudeCodePath: undefined,
    };

    const result = normalizeAIProviderOverrides(input as any);

    expect(result).toBeUndefined();
  });

  it('drops retired DeepAgents ACP provider overrides and stale default provider', () => {
    const result = normalizeAIProviderOverrides({
      defaultProvider: 'deepagents-acp',
      providers: {
        'deepagents-acp': { enabled: true, apiKey: 'retired-token' },
        'claude-code': { enabled: true },
      },
    });

    expect(result).toEqual({
      providers: {
        'claude-code': { enabled: true },
      },
    });
  });
});

describe('mergeAISettings -- retired providers', () => {
  beforeEach(() => {
    getAIProviderOverridesMock.mockReset();
  });

  it('strips retired provider settings and falls back from a stale default provider', () => {
    getAIProviderOverridesMock.mockReturnValue(undefined);

    const effective = mergeAISettings({
      ...baseGlobal,
      defaultProvider: 'deepagents-acp',
      apiKeys: { 'deepagents-acp': 'retired-token' },
      providerSettings: {
        'deepagents-acp': { enabled: true },
        'claude-code': { enabled: true },
      },
    }, undefined);

    expect(effective.defaultProvider).toBe('smarty-server');
    expect(effective.apiKeys).toEqual({});
    expect(effective.providerSettings).toEqual({
      'claude-code': { enabled: true },
    });
    expect(getEnabledProviders(effective)).toEqual(['claude-code']);
    expect(getEffectiveApiKey(effective, 'deepagents-acp')).toBeUndefined();
  });

  it('ignores a stale project default provider instead of overriding the global default', () => {
    getAIProviderOverridesMock.mockReturnValue({
      defaultProvider: 'deepagents-acp',
      providers: {
        'deepagents-acp': { enabled: true, apiKey: 'retired-token' },
      },
    });

    const effective = mergeAISettings({
      ...baseGlobal,
      defaultProvider: 'openai',
      apiKeys: {
        openai: 'active-token',
        'deepagents-acp': 'retired-token',
        deepagents_cli_proxy_base_url: 'http://127.0.0.1:8317/v1',
      },
      providerSettings: {
        openai: { enabled: true },
      },
    }, '/workspace/a');

    expect(effective.defaultProvider).toBe('openai');
    expect(effective.overrides.defaultProvider).toBe(false);
    expect(effective.apiKeys).toEqual({ openai: 'active-token' });
    expect(effective.providerSettings).toEqual({
      openai: { enabled: true },
    });
  });
});

describe('mergeAISettings -- smarty-server', () => {
  beforeEach(() => {
    getAIProviderOverridesMock.mockReset();
  });

  it('preserves smarty-server provider settings and explicit API key', () => {
    getAIProviderOverridesMock.mockReturnValue(undefined);

    const effective = mergeAISettings({
      ...baseGlobal,
      defaultProvider: 'smarty-server',
      apiKeys: {
        'smarty-server': 'explicit-local-token',
      },
      providerSettings: {
        'smarty-server': {
          enabled: true,
          baseUrl: 'http://127.0.0.1:8788',
          defaultModel: 'smarty-server:smarty_coding_agent',
        },
      },
    }, undefined);

    expect(effective.defaultProvider).toBe('smarty-server');
    expect(effective.providerSettings['smarty-server']).toEqual({
      enabled: true,
      baseUrl: 'http://127.0.0.1:8788',
      defaultModel: 'smarty-server:smarty_coding_agent',
    });
    expect(getEnabledProviders(effective)).toEqual(['smarty-server']);
    expect(getEffectiveApiKey(effective, 'smarty-server')).toBe('explicit-local-token');
  });

  it('removes stale models from smarty-server dynamic provider settings', () => {
    getAIProviderOverridesMock.mockReturnValue(undefined);

    const effective = mergeAISettings({
      ...baseGlobal,
      providerSettings: {
        'smarty-server': {
          enabled: true,
          models: ['smarty-server:stale'],
          defaultModel: 'smarty-server:smarty_coding_agent',
        },
      },
    }, undefined);

    expect(effective.providerSettings['smarty-server']).toEqual({
      enabled: true,
      defaultModel: 'smarty-server:smarty_coding_agent',
    });
  });

  it('keeps a project smarty-server override and marks override fields', () => {
    getAIProviderOverridesMock.mockReturnValue({
      defaultProvider: 'smarty-server',
      providers: {
        'smarty-server': {
          enabled: true,
          apiKey: 'project-token',
          defaultModel: 'smarty-server:custom_agent',
          baseUrl: 'http://127.0.0.1:9797',
        },
      },
    });

    const effective = mergeAISettings({
      ...baseGlobal,
      defaultProvider: 'claude-code',
      providerSettings: {
        'smarty-server': {
          enabled: false,
          baseUrl: 'http://127.0.0.1:8788',
          defaultModel: 'smarty-server:smarty_coding_agent',
        },
      },
    }, '/workspace/a');

    expect(effective.defaultProvider).toBe('smarty-server');
    expect(effective.apiKeys['smarty-server_project']).toBe('project-token');
    expect(effective.providerSettings['smarty-server']).toEqual({
      enabled: true,
      baseUrl: 'http://127.0.0.1:9797',
      defaultModel: 'smarty-server:custom_agent',
      apiKey: 'project-token',
    });
    expect(effective.overrides.defaultProvider).toBe(true);
    expect(effective.overrides.providers['smarty-server']).toEqual({
      enabled: true,
      defaultModel: true,
      apiKey: true,
      baseUrl: true,
    });
  });
});
