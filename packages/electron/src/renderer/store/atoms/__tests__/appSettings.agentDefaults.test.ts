import { createStore } from 'jotai';
import { describe, expect, it, vi } from 'vitest';

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    identify: vi.fn(),
    init: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}));

import { defaultAgentModelAtom } from '../appSettings';

describe('agent mode defaults', () => {
  it('starts new clean profiles on smarty-server', () => {
    const store = createStore();

    expect(store.get(defaultAgentModelAtom)).toBe('smarty-server:smarty_coding_agent');
  });
});
