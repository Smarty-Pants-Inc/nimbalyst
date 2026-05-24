import { describe, expect, it } from 'vitest';
import { formatWorkspaceLocalModeStatus, getWorkspaceRuntimeHealth } from '../WorkspaceSummaryHeader';

describe('formatWorkspaceLocalModeStatus', () => {
  it('distinguishes local-only, non-local-only, and unknown runtime health states', () => {
    expect(formatWorkspaceLocalModeStatus({ localMode: { localOnly: true } })).toBe('local-only');
    expect(formatWorkspaceLocalModeStatus({ localMode: { localOnly: false } })).toBe('not-local-only');
    expect(formatWorkspaceLocalModeStatus({})).toBe('unknown');
    expect(formatWorkspaceLocalModeStatus(undefined)).toBe('unknown');
  });
});

describe('getWorkspaceRuntimeHealth', () => {
  it('uses the last successful runtime health snapshot after settings resume strips live health', () => {
    expect(getWorkspaceRuntimeHealth({
      enabled: true,
      lastSuccessfulRuntimeHealth: {
        localMode: { localOnly: true },
        cliProxy: { reachable: true },
        modelBackend: { selectedModel: 'gpt-5.5' },
      },
    })).toEqual({
      localMode: { localOnly: true },
      cliProxy: { reachable: true },
      modelBackend: { selectedModel: 'gpt-5.5' },
    });
  });

  it('does not show stale last-successful health while an explicit live test is failing', () => {
    expect(getWorkspaceRuntimeHealth({
      enabled: true,
      testStatus: 'error',
      lastSuccessfulRuntimeHealth: {
        localMode: { localOnly: true },
        cliProxy: { reachable: true },
        modelBackend: { selectedModel: 'gpt-5.5' },
      },
    })).toBeUndefined();
  });

  it('does not show stale last-successful health when Smarty Server is disabled', () => {
    expect(getWorkspaceRuntimeHealth({
      enabled: false,
      lastSuccessfulRuntimeHealth: {
        localMode: { localOnly: true },
        cliProxy: { reachable: true },
      },
    })).toBeUndefined();
  });
});
