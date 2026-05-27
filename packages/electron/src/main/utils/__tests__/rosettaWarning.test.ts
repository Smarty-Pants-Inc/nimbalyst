import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execSyncMock, storeValues } = vi.hoisted(() => ({
  execSyncMock: vi.fn(),
  storeValues: new Map<string, unknown>(),
}));

vi.mock('child_process', () => ({
  execSync: execSyncMock,
}));

vi.mock('electron-store', () => ({
  default: class MockStore {
    path = '/tmp/nimbalyst-test-app-settings.json';

    get(key: string, fallback?: unknown) {
      return storeValues.has(key) ? storeValues.get(key) : fallback;
    }

    set(key: string, value: unknown) {
      storeValues.set(key, value);
    }

    delete(key: string) {
      storeValues.delete(key);
    }
  },
}));

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
const originalArch = Object.getOwnPropertyDescriptor(process, 'arch');

function setProcessPlatformArch(platform: NodeJS.Platform, arch: NodeJS.Architecture) {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  });
  Object.defineProperty(process, 'arch', {
    configurable: true,
    value: arch,
  });
}

async function shouldShowRosettaWarning() {
  vi.resetModules();
  const module = await import('../store');
  return module.shouldShowRosettaWarning();
}

describe('shouldShowRosettaWarning', () => {
  beforeEach(() => {
    storeValues.clear();
    execSyncMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    if (originalArch) {
      Object.defineProperty(process, 'arch', originalArch);
    }
  });

  it('does not show the Intel warning when the Electron process is native arm64', async () => {
    setProcessPlatformArch('darwin', 'arm64');
    execSyncMock.mockReturnValue('1\n');

    await expect(shouldShowRosettaWarning()).resolves.toBe(false);
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it('shows the warning for translated x64 macOS builds', async () => {
    setProcessPlatformArch('darwin', 'x64');
    execSyncMock.mockReturnValue('1\n');

    await expect(shouldShowRosettaWarning()).resolves.toBe(true);
    expect(execSyncMock).toHaveBeenCalledWith('sysctl -n sysctl.proc_translated', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  });

  it('does not show the warning for native x64 macOS builds', async () => {
    setProcessPlatformArch('darwin', 'x64');
    execSyncMock.mockReturnValue('0\n');

    await expect(shouldShowRosettaWarning()).resolves.toBe(false);
  });

  it('does not show the warning after the user dismisses it', async () => {
    setProcessPlatformArch('darwin', 'x64');
    storeValues.set('rosettaWarningDismissed', true);

    await expect(shouldShowRosettaWarning()).resolves.toBe(false);
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it('does not show the warning outside macOS', async () => {
    setProcessPlatformArch('linux', 'x64');

    await expect(shouldShowRosettaWarning()).resolves.toBe(false);
    expect(execSyncMock).not.toHaveBeenCalled();
  });
});
