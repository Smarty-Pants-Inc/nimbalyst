import { describe, expect, it } from 'vitest';
import { stripTransientProviderFields } from '../modelConfigUtils';

describe('modelConfigUtils', () => {
  it('strips transient Smarty Server runtime health fields before persistence', () => {
    const sanitized = stripTransientProviderFields({
      'smarty-server': {
        enabled: true,
        baseUrl: 'http://127.0.0.1:8788',
        defaultModel: 'smarty-server:smarty_coding_agent',
        testStatus: 'success',
        testMessage: 'Connected',
        runtimeHealth: { ready: true },
        runtimeHealthCheckedAt: '2026-05-22T00:00:00.000Z',
        runtimeHealthRecovery: 'Restart smarty-server only.',
        runtimeHealthWarnings: ['LangSmith Engine not configured'],
        lastSuccessfulRuntimeHealth: {
          runtime: 'ready',
          cliProxy: { reachable: true },
          modelBackend: { selectedModel: 'gpt-5.5' },
        },
        lastSuccessfulRuntimeHealthCheckedAt: '2026-05-22T00:00:00.000Z',
      },
    });

    expect(sanitized).toEqual({
      'smarty-server': {
        enabled: true,
        baseUrl: 'http://127.0.0.1:8788',
        defaultModel: 'smarty-server:smarty_coding_agent',
        lastSuccessfulRuntimeHealth: {
          runtime: 'ready',
          cliProxy: { reachable: true },
          modelBackend: { selectedModel: 'gpt-5.5' },
        },
        lastSuccessfulRuntimeHealthCheckedAt: '2026-05-22T00:00:00.000Z',
      },
    });
  });
});
