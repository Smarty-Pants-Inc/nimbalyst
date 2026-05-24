import { describe, expect, it } from 'vitest';

import { resolveSuperLoopSessionRoute } from '../superLoopRouting';

describe('resolveSuperLoopSessionRoute', () => {
  it('falls back to smarty-server for clean Super Loop iterations', () => {
    expect(resolveSuperLoopSessionRoute()).toEqual({
      provider: 'smarty-server',
      model: 'smarty-server:smarty_coding_agent',
    });
  });

  it('does not infer Claude Code for unprefixed fallback model ids', () => {
    expect(resolveSuperLoopSessionRoute('custom_agent')).toEqual({
      provider: 'smarty-server',
      model: 'custom_agent',
    });
  });
});
