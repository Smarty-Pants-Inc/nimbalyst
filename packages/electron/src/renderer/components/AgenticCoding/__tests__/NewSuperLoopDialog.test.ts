import { describe, expect, it } from 'vitest';

import {
  getSuperLoopAgentModels,
  SUPER_LOOP_DEFAULT_MODEL,
} from '../NewSuperLoopDialog';

describe('NewSuperLoopDialog defaults', () => {
  it('defaults clean Super Loops to smarty-server', () => {
    expect(SUPER_LOOP_DEFAULT_MODEL).toBe('smarty-server:smarty_coding_agent');
  });

  it('does not select Claude or Codex models from clean model lists', () => {
    const models = getSuperLoopAgentModels({
      'claude-code': [{ id: 'claude-code:opus-1m', name: 'Claude Opus', provider: 'claude-code' }],
      'openai-codex': [{ id: 'openai-codex:gpt-5.4', name: 'Codex', provider: 'openai-codex' }],
      'smarty-server': [{ id: 'smarty-server:smarty_coding_agent', name: 'Smarty Coding Agent', provider: 'smarty-server' }],
    });

    expect(models).toEqual([
      { id: 'smarty-server:smarty_coding_agent', name: 'Smarty Coding Agent', provider: 'smarty-server' },
    ]);
  });
});
