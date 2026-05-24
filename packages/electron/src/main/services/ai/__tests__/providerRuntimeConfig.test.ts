import { describe, expect, it, vi } from 'vitest';

vi.mock('@nimbalyst/runtime/ai/server', async () => ({
  normalizeLoopbackHttpUrl: (
    await vi.importActual<typeof import('@nimbalyst/runtime/ai/server/utils/loopbackHttpUrl')>(
      '@nimbalyst/runtime/ai/server/utils/loopbackHttpUrl',
    )
  ).normalizeLoopbackHttpUrl,
  ModelRegistry: {
    getDefaultModel: vi.fn(async () => 'smarty-server:smarty_coding_agent'),
  },
}));

vi.mock('../aiServiceUtils', () => ({
  extractModelForProvider: (fullModel: string) => {
    const colon = fullModel.indexOf(':');
    return colon >= 0 ? fullModel.slice(colon + 1) : fullModel;
  },
}));

import { buildProviderRuntimeConfig } from '../providerRuntimeConfig';

describe('buildProviderRuntimeConfig', () => {
  it('preserves the configured smarty-server assistant for resumed provider sends', async () => {
    const config = await buildProviderRuntimeConfig({
      session: {
        id: 'session-1',
        provider: 'smarty-server',
        model: 'smarty-server:custom_agent',
        messages: [],
        createdAt: 0,
        updatedAt: 0,
      },
      apiKey: 'explicit-token',
      providerSettings: {
        baseUrl: 'http://127.0.0.1:9999',
        defaultModel: 'smarty-server:ignored_default',
      },
    });

    expect(config).toMatchObject({
      apiKey: 'explicit-token',
      model: 'custom_agent',
      baseUrl: 'http://127.0.0.1:9999',
    });
  });

  it('rejects non-loopback smarty-server base URLs before runtime metadata leaves the app', async () => {
    await expect(buildProviderRuntimeConfig({
      session: {
        id: 'session-remote',
        provider: 'smarty-server',
        model: 'smarty-server:custom_agent',
        messages: [],
        createdAt: 0,
        updatedAt: 0,
      },
      apiKey: 'explicit-token',
      providerSettings: {
        baseUrl: 'https://smarty-server.example.com',
      },
    })).rejects.toThrow(/loopback/i);
  });

  it('allows loopback localhost smarty-server base URLs and normalizes trailing slashes', async () => {
    const config = await buildProviderRuntimeConfig({
      session: {
        id: 'session-localhost',
        provider: 'smarty-server',
        model: 'smarty-server:custom_agent',
        messages: [],
        createdAt: 0,
        updatedAt: 0,
      },
      providerSettings: {
        baseUrl: ' http://localhost:8791/// ',
      },
    });

    expect(config.baseUrl).toBe('http://localhost:8791');
  });
});
