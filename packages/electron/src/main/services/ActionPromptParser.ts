/**
 * Parser for ai-actions.md files.
 *
 * The file is a flat list of `## Heading` actions; the body is everything
 * between the heading and the next `## ` heading or end of file. The body is
 * preserved verbatim (with `\n` between lines) so users can include slash
 * commands, code fences, and multi-line natural language exactly as written.
 */

export interface ActionPrompt {
  /** kebab-case slug derived from the heading, used as a stable id */
  id: string;
  /** original heading text, trimmed */
  label: string;
  /** trimmed body content (verbatim, with original line breaks preserved) */
  body: string;
}

export interface ActionPromptParseDiagnostic {
  level: 'warning';
  code: 'duplicate-heading' | 'empty-body';
  label: string;
  message: string;
}

export interface ActionPromptParseResult {
  actions: ActionPrompt[];
  diagnostics: ActionPromptParseDiagnostic[];
}

const COMBINING_DIACRITICAL_MARKS = /[̀-ͯ]/g;

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_DIACRITICAL_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'action';
}

/**
 * Parse the content of an ai-actions.md file into a list of actions.
 *
 * Splits on lines that begin with `## ` (exactly two `#` followed by a space).
 * Headings are detected line-by-line; lines inside fenced code blocks are
 * ignored so that `## ` literals inside code fences don't open new actions.
 */
export function parseActionPromptsFile(content: string): ActionPromptParseResult {
  const actions: ActionPrompt[] = [];
  const diagnostics: ActionPromptParseDiagnostic[] = [];
  const seenIds = new Set<string>();

  if (!content || !content.trim()) {
    return { actions, diagnostics };
  }

  const lines = content.split(/\r?\n/);
  let currentLabel: string | null = null;
  let currentBody: string[] = [];
  let inFencedCode = false;

  const flush = () => {
    if (currentLabel === null) return;
    const label = currentLabel.trim();
    const body = currentBody.join('\n').trim();
    if (!label) return;
    const id = slugify(label);
    if (seenIds.has(id)) {
      diagnostics.push({
        level: 'warning',
        code: 'duplicate-heading',
        label,
        message: `Duplicate action heading "${label}" — only the first occurrence is used.`,
      });
      return;
    }
    if (!body) {
      diagnostics.push({
        level: 'warning',
        code: 'empty-body',
        label,
        message: `Action "${label}" has no body and will be skipped.`,
      });
      return;
    }
    seenIds.add(id);
    actions.push({ id, label, body });
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFencedCode = !inFencedCode;
    }

    const headingMatch = !inFencedCode && /^##\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      flush();
      currentLabel = headingMatch[1];
      currentBody = [];
      continue;
    }

    if (currentLabel !== null) {
      currentBody.push(line);
    }
  }

  flush();

  return { actions, diagnostics };
}

/** Default content seeded into ai-actions.md when the user creates the file. */
export const DEFAULT_ACTION_PROMPTS_TEMPLATE = `# AI Action Prompts

This file lists reusable prompts that show up in the **Actions** dropdown in the AI composer.
Each \`## Heading\` is one action; everything beneath it (until the next \`##\`) is the prompt that gets inserted into the draft when you pick the action.

## Review Changed Files
/review changed files in this session and call out regression risk in the affected modules.

## Plan Implementation
Look at the active issue (linked above) and the open editor.

Produce a structured plan that:
- breaks the work into 3-5 phases
- identifies the files I'll need to touch
- flags any cross-cutting concerns I should think about before writing code

When you're done, ask me which phase to start with.

## Draft Release Notes
/release-notes from merged work since the last tag, formatted as a user-facing changelog.

## Inspect Current Editor
Read the file that's currently open and tell me what you'd change. Be specific:
- 3 concrete improvements
- 1 thing that's already good and shouldn't change
`;
