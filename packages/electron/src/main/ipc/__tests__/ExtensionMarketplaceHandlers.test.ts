import { beforeEach, describe, expect, it, vi } from 'vitest';

const netFetchMock = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [],
  },
  net: {
    fetch: netFetchMock,
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    main: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

vi.mock('../../utils/store', () => ({
  getMarketplaceInstalls: vi.fn(() => ({})),
  getMarketplaceInstall: vi.fn(),
  addMarketplaceInstall: vi.fn(),
  removeMarketplaceInstall: vi.fn(),
  updateMarketplaceInstall: vi.fn(),
}));

vi.mock('../ExtensionHandlers', () => ({
  getUserExtensionsDirectory: vi.fn(async () => '/tmp/nimbalyst-test-extensions'),
  initializeExtensionFileTypes: vi.fn(),
}));

describe('ExtensionMarketplaceHandlers registry loading', () => {
  beforeEach(() => {
    vi.resetModules();
    netFetchMock.mockReset();
  });

  it('uses the bundled registry without contacting Nimbalyst-hosted marketplace services', async () => {
    const { fetchRegistry } = await import('../ExtensionMarketplaceHandlers');

    const registry = await fetchRegistry();

    expect(netFetchMock).not.toHaveBeenCalled();
    expect(registry.extensions.length).toBeGreaterThan(0);
    expect(registry.extensions.every((extension) => extension.downloadUrl === '')).toBe(true);
    expect(registry.extensions.every((extension) => extension.screenshots.length === 0)).toBe(true);
  });
});
