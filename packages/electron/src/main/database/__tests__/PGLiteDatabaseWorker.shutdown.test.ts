import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/analytics/AnalyticsService', () => ({
  AnalyticsService: {
    getInstance: () => ({
      sendEvent: vi.fn(),
    }),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    main: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

import { isUnexpectedWorkerExit } from '../PGLiteDatabaseWorker';

describe('PGLiteDatabaseWorker shutdown logging', () => {
  it('does not classify nonzero worker termination during close as unexpected', () => {
    expect(isUnexpectedWorkerExit(1, true)).toBe(false);
  });

  it('classifies nonzero worker exit outside close as unexpected', () => {
    expect(isUnexpectedWorkerExit(1, false)).toBe(true);
  });

  it('does not classify clean worker exit as unexpected', () => {
    expect(isUnexpectedWorkerExit(0, false)).toBe(false);
  });
});
