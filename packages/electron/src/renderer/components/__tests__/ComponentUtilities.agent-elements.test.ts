import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentsCssPath = join(process.cwd(), 'packages/electron/src/renderer/styles/components.css');

function selectorBlock(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, 's'));
  if (!match?.groups?.body) {
    throw new Error(`Missing CSS block for ${selector}`);
  }
  return match.groups.body;
}

describe('shared component utilities Agent Elements token bridge', () => {
  it('keeps modal chrome on shared Agent Elements gutters and aliases', () => {
    const css = readFileSync(componentsCssPath, 'utf8');

    for (const selector of ['.nim-overlay', '.nim-modal', '.nim-modal-header', '.nim-modal-body', '.nim-modal-footer']) {
      const block = selectorBlock(css, selector);
      expect(block).toMatch(/--an-/);
      expect(block).not.toMatch(/rgba\(|(?:color|background):\s*(?:white|black)\b|var\(--nim-/);
    }

    expect(selectorBlock(css, '.nim-modal-header')).toContain(
      'padding: var(--agent-elements-card-block-padding, var(--an-spacing-xl)) var(--agent-elements-card-inline-padding, var(--an-spacing-xl));',
    );
    expect(selectorBlock(css, '.nim-modal-body')).toContain(
      'padding: var(--agent-elements-card-block-padding, var(--an-spacing-xl)) var(--agent-elements-card-inline-padding, var(--an-spacing-xl));',
    );
    expect(selectorBlock(css, '.nim-modal-footer')).toContain(
      'padding: var(--agent-elements-card-block-padding, var(--an-spacing-xl)) var(--agent-elements-card-inline-padding, var(--an-spacing-xl));',
    );
  });

  it('keeps shared buttons, inputs, badges, panels, focus rings, and toggles off legacy visual tokens', () => {
    const css = readFileSync(componentsCssPath, 'utf8');
    const remediatedSelectors = [
      '.nim-btn',
      '.nim-btn-primary',
      '.nim-btn-secondary',
      '.nim-btn-ghost',
      '.nim-btn-danger',
      '.nim-btn-icon',
      '.nim-input',
      '.nim-badge',
      '.nim-badge-primary',
      '.nim-badge-success',
      '.nim-badge-warning',
      '.nim-badge-error',
      '.nim-badge-muted',
      '.nim-panel',
      '.nim-panel-header',
      '.nim-panel-body',
      '.nim-section-label',
      '.nim-focus-ring:focus',
      '.nim-focus-ring:focus-visible',
      '.toggle-switch-slider',
      '.toggle-switch-slider::before',
      '.toggle-switch input:checked + .toggle-switch-slider',
    ];

    for (const selector of remediatedSelectors) {
      const block = selectorBlock(css, selector);
      expect(block).not.toMatch(/rgba\(|(?:color|background):\s*(?:white|black)\b|var\(--nim-(?:text|primary|primary-hover|bg|border|error|warning|success)/);
      expect(block).not.toMatch(/transition:\s*all/);
    }
  });
});
