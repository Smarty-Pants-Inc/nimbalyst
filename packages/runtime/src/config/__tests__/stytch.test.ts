import { afterEach, describe, expect, it } from 'vitest';

import { getStytchConfig, STYTCH_CONFIG } from '../stytch';

describe('getStytchConfig', () => {
  afterEach(() => {
    delete process.env.STYTCH_PROJECT_ID;
    delete process.env.STYTCH_PUBLIC_TOKEN;
  });

  it('does not inherit ambient Stytch environment variables', () => {
    process.env.STYTCH_PROJECT_ID = 'project-live-ambient';
    process.env.STYTCH_PUBLIC_TOKEN = 'public-token-live-ambient';

    expect(getStytchConfig()).toEqual(STYTCH_CONFIG.live);
  });
});
