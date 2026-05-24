import { describe, expect, it } from 'vitest';
import { buildPlanImplementationPrompt } from '../pathUtils';

describe('buildPlanImplementationPrompt', () => {
  it('uses a fully qualified path for regular sessions', () => {
    const prompt = buildPlanImplementationPrompt({
      planFilePath: 'plans/feature-plan.md',
      basePath: '/Users/jordan/project',
    });

    expect(prompt).toBe(
      'Fully implement the following plan: /Users/jordan/project/plans/feature-plan.md'
    );
  });

  it('uses a fully qualified path for worktree sessions', () => {
    const prompt = buildPlanImplementationPrompt({
      planFilePath: 'plans/feature-plan.md',
      basePath: '/Users/jordan/project/.worktrees/feature-branch',
    });

    expect(prompt).toBe(
      'Fully implement the following plan: /Users/jordan/project/.worktrees/feature-branch/plans/feature-plan.md'
    );
  });

  it('double-quotes resolved plan paths that contain whitespace', () => {
    const prompt = buildPlanImplementationPrompt({
      planFilePath: 'plans/feature plan.md',
      basePath: '/Users/jordan/project',
    });

    expect(prompt).toBe(
      'Fully implement the following plan: "/Users/jordan/project/plans/feature plan.md"'
    );
  });

  it('escapes embedded quotes and backslashes inside quoted plan paths', () => {
    const prompt = buildPlanImplementationPrompt({
      planFilePath: 'plans/feature "draft"\\notes.md',
      basePath: '/Users/jordan/project',
    });

    expect(prompt).toBe(
      'Fully implement the following plan: "/Users/jordan/project/plans/feature \\"draft\\"\\\\notes.md"'
    );
  });

  it('does not quote simple resolved plan paths', () => {
    const prompt = buildPlanImplementationPrompt({
      planFilePath: 'plans/feature-plan.md',
      basePath: '/Users/jordan/project',
    });

    expect(prompt).toBe(
      'Fully implement the following plan: /Users/jordan/project/plans/feature-plan.md'
    );
  });

  it('falls back to the generic prompt when no path is available', () => {
    const prompt = buildPlanImplementationPrompt({});

    expect(prompt).toBe(
      'Fully implement the approved plan.'
    );
  });
});
