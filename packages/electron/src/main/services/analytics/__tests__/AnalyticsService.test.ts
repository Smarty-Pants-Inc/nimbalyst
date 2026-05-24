import { beforeEach, describe, expect, it, vi } from 'vitest';

const postHogConstructor = vi.hoisted(() => vi.fn());
const isAnalyticsEnabledMock = vi.hoisted(() => vi.fn());
const setAnalyticsEnabledMock = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.0.0-test',
  },
}));

vi.mock('electron-store', () => ({
  default: class MockStore {
    get(key: string, fallback?: unknown) {
      if (key === 'analyticsId') return 'nimbalyst_test';
      if (key === 'analyticsEnabled') return fallback;
      return fallback;
    }

    set = vi.fn();
  },
}));

vi.mock('posthog-node', () => ({
  PostHog: postHogConstructor,
}));

vi.mock('../../../utils/store', () => ({
  isAnalyticsEnabled: isAnalyticsEnabledMock,
  setAnalyticsEnabled: setAnalyticsEnabledMock,
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    analytics: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/gitUtils', () => ({
  isGitAvailable: () => true,
}));

function mockPostHogClient() {
  return {
    capture: vi.fn(),
    optIn: vi.fn(),
    optOut: vi.fn(),
    shutdown: vi.fn(),
  };
}

async function loadAnalyticsService() {
  vi.resetModules();
  const module = await import('../AnalyticsService');
  return module.AnalyticsService.getInstance();
}

describe('AnalyticsService security defaults', () => {
  beforeEach(() => {
    postHogConstructor.mockReset();
    postHogConstructor.mockImplementation(mockPostHogClient);
    isAnalyticsEnabledMock.mockReset();
    setAnalyticsEnabledMock.mockReset();
    delete process.env.PLAYWRIGHT;
    delete process.env.PLAYWRIGHT_TEST;
    delete process.env.OFFICIAL_BUILD;
  });

  it('does not initialize PostHog when analytics is disabled', async () => {
    isAnalyticsEnabledMock.mockReturnValue(false);

    const service = await loadAnalyticsService();

    expect(service.allowedToSendAnalytics()).toBe(false);
    expect(postHogConstructor).not.toHaveBeenCalled();
  });

  it('fails closed when analytics settings cannot be read', async () => {
    process.env.OFFICIAL_BUILD = 'true';
    isAnalyticsEnabledMock.mockImplementation(() => {
      throw new Error('store unavailable');
    });

    const service = await loadAnalyticsService();

    expect(service.allowedToSendAnalytics()).toBe(false);
    expect(postHogConstructor).not.toHaveBeenCalled();
  });

  it('does not initialize PostHog for unofficial builds even when analytics is enabled', async () => {
    isAnalyticsEnabledMock.mockReturnValue(true);

    const service = await loadAnalyticsService();

    expect(service.allowedToSendAnalytics()).toBe(false);
    expect(postHogConstructor).not.toHaveBeenCalled();
  });

  it('initializes PostHog only after explicit opt-in', async () => {
    process.env.OFFICIAL_BUILD = 'true';
    isAnalyticsEnabledMock.mockReturnValue(false);
    const service = await loadAnalyticsService();

    await service.optIn();

    expect(setAnalyticsEnabledMock).toHaveBeenCalledWith(true);
    expect(postHogConstructor).toHaveBeenCalledTimes(2);
  });
});
