import { describe, expect, it } from 'vitest';
import { parseActionPromptsFile } from '../ActionPromptParser';

describe('parseActionPromptsFile', () => {
  it('parses two simple actions with verbatim multi-line bodies', () => {
    const content = `# AI Action Prompts

## Review Changed Files
/review changed files in this session and call out regression risk.

## Plan Implementation
Look at the active issue.

Produce a structured plan that:
- breaks the work into phases
- identifies the files
`;
    const { actions, diagnostics } = parseActionPromptsFile(content);

    expect(diagnostics).toEqual([]);
    expect(actions).toHaveLength(2);

    expect(actions[0]).toEqual({
      id: 'review-changed-files',
      label: 'Review Changed Files',
      body: '/review changed files in this session and call out regression risk.',
    });

    expect(actions[1].id).toBe('plan-implementation');
    expect(actions[1].label).toBe('Plan Implementation');
    expect(actions[1].body).toBe(
      'Look at the active issue.\n\nProduce a structured plan that:\n- breaks the work into phases\n- identifies the files'
    );
  });

  it('returns empty result for empty or whitespace-only content', () => {
    expect(parseActionPromptsFile('')).toEqual({ actions: [], diagnostics: [] });
    expect(parseActionPromptsFile('   \n\n\t\n')).toEqual({ actions: [], diagnostics: [] });
  });

  it('ignores content above the first ## heading', () => {
    const content = `# Title

Some preamble text that should be ignored.

## First Action
The body of the first action.
`;
    const { actions, diagnostics } = parseActionPromptsFile(content);
    expect(diagnostics).toEqual([]);
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe('First Action');
    expect(actions[0].body).toBe('The body of the first action.');
  });

  it('treats ### as part of the body, not a new action', () => {
    const content = `## Outer Action
Intro text.
### A subheading inside the body
More body text.
`;
    const { actions } = parseActionPromptsFile(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].body).toContain('### A subheading inside the body');
    expect(actions[0].body).toContain('More body text.');
  });

  it('emits a duplicate-heading diagnostic and keeps only the first occurrence', () => {
    const content = `## Same Action
First body.

## Same Action
Second body that should be dropped.
`;
    const { actions, diagnostics } = parseActionPromptsFile(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].body).toBe('First body.');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('duplicate-heading');
    expect(diagnostics[0].label).toBe('Same Action');
  });

  it('emits an empty-body diagnostic for headings with no content', () => {
    const content = `## Empty Action

## Real Action
A real body.
`;
    const { actions, diagnostics } = parseActionPromptsFile(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe('Real Action');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('empty-body');
    expect(diagnostics[0].label).toBe('Empty Action');
  });

  it('does not split on a ## inside a fenced code block', () => {
    const content = `## Code Example
Here is a fenced block:
\`\`\`md
## Not a heading
text
\`\`\`
After the block.
`;
    const { actions } = parseActionPromptsFile(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].body).toContain('## Not a heading');
    expect(actions[0].body).toContain('After the block.');
  });

  it('handles CRLF line endings', () => {
    const content = '## CRLF Action\r\nBody line 1\r\nBody line 2\r\n';
    const { actions } = parseActionPromptsFile(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].body).toBe('Body line 1\nBody line 2');
  });

  it('slugifies headings into stable kebab-case ids', () => {
    const content = `## Hello, World!
body
## É — Café & Crème
body
`;
    const { actions } = parseActionPromptsFile(content);
    expect(actions).toHaveLength(2);
    expect(actions[0].id).toBe('hello-world');
    expect(actions[1].id).toBe('e-cafe-creme');
  });
});
