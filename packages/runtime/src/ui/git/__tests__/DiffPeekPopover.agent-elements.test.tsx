// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiffPeekPopover } from '../DiffPeekPopover';
import { UnifiedDiffView, diffStats } from '../UnifiedDiffView';

let floatingOpenChange: ((open: boolean) => void) | null = null;

vi.mock('@floating-ui/react', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    FloatingPortal: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    autoUpdate: vi.fn(),
    flip: vi.fn(() => ({})),
    offset: vi.fn(() => ({})),
    shift: vi.fn(() => ({})),
    useDismiss: vi.fn(() => ({})),
    useRole: vi.fn(() => ({})),
    useFloating: vi.fn((options: { onOpenChange?: (open: boolean) => void }) => {
      floatingOpenChange = options.onOpenChange ?? null;
      return {
        context: {},
        floatingStyles: { position: 'absolute' },
        refs: {
          floating: { current: null },
          setFloating: vi.fn(),
        },
      };
    }),
    useInteractions: vi.fn(() => ({
      getFloatingProps: (props: React.HTMLAttributes<HTMLElement> = {}) => ({
        ...props,
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          props.onKeyDown?.(event);
          if (event.key === 'Escape') floatingOpenChange?.(false);
        },
      }),
    })),
  };
});

const sourceDir = dirname(fileURLToPath(import.meta.url));
const diffPeekSourcePath = resolve(sourceDir, '../DiffPeekPopover.tsx');
const unifiedDiffViewSourcePath = resolve(sourceDir, '../UnifiedDiffView.tsx');

const sampleDiff = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 111..222 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -3,3 +3,4 @@',
  ' const keep = true;',
  '-const oldValue = 1;',
  '+const newValue = 2;',
  '+const added = true;',
  ' export { keep };',
].join('\n');

describe('DiffPeekPopover Agent Elements shell', () => {
  beforeEach(() => {
    floatingOpenChange = null;
    vi.clearAllMocks();
  });

  it('renders Agent Elements popover chrome while preserving keyboard and open actions', () => {
    const onClose = vi.fn();
    const onPin = vi.fn();
    const onOpenInEditor = vi.fn();

    render(
      <DiffPeekPopover
        anchorRect={new DOMRect(10, 12, 32, 18)}
        filePath="/workspace/src/app.ts"
        mode="peek"
        diff={sampleDiff}
        isBinary={false}
        loading={false}
        error={null}
        onClose={onClose}
        onPin={onPin}
        onOpenInEditor={onOpenInEditor}
      />,
    );

    const root = screen.getByTestId('agent-elements-diff-peek-popover');
    expect(root).toHaveClass('diff-peek-popover', 'agent-elements-diff-peek-popover', 'agent-elements-tool-card');
    expect(root).toHaveAttribute('data-component', 'DiffPeekPopover');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'diff-peek-popover');
    expect(root).toHaveAttribute('data-agent-elements-card-padding', 'sectioned-symmetric');
    expect(root).toHaveAttribute('data-agent-elements-card-width', 'floating-popover');
    expect(root).toHaveAttribute('data-popover-mode', 'peek');
    expect(root.className).toContain('--agent-elements-card-inline-padding');
    expect(root.className).toContain('--agent-elements-card-block-padding');

    const header = screen.getByTestId('agent-elements-diff-peek-header');
    expect(header).toHaveAttribute('data-agent-elements-shell', 'diff-peek-header');
    expect(within(header).getByText('/workspace/src/')).toBeInTheDocument();
    expect(within(header).getByText('app.ts')).toBeInTheDocument();

    const stats = screen.getByTestId('agent-elements-diff-peek-stats');
    expect(stats).toHaveTextContent('+2');
    expect(stats).toHaveTextContent('−1');
    expect(screen.getByTestId('agent-elements-diff-peek-mode')).toHaveTextContent('Peeking');

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onPin).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('agent-elements-diff-peek-open-editor'));
    expect(onOpenInEditor).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(root, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('agent-elements-diff-peek-footer')).toHaveTextContent('Esc');
    expect(screen.getByTestId('agent-elements-diff-peek-footer')).toHaveTextContent('Enter');
  });

  it('renders unified diff lines with stable semantics and preserves stats', () => {
    render(<UnifiedDiffView diff={sampleDiff} />);

    const root = screen.getByTestId('agent-elements-unified-diff-view');
    expect(root).toHaveClass('unified-diff-view', 'agent-elements-unified-diff-view');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'unified-diff-view');

    const hunk = screen.getByTestId('agent-elements-unified-diff-line-0');
    expect(hunk).toHaveAttribute('data-line-kind', 'hunk');
    expect(hunk).toHaveTextContent('@@ -3,3 +3,4 @@');

    const context = screen.getByTestId('agent-elements-unified-diff-line-1');
    expect(context).toHaveAttribute('data-line-kind', 'ctx');
    expect(within(context).getByTestId('agent-elements-unified-diff-old-line')).toHaveTextContent('3');
    expect(within(context).getByTestId('agent-elements-unified-diff-new-line')).toHaveTextContent('3');
    expect(within(context).getByTestId('agent-elements-unified-diff-sign').textContent).toBe(' ');

    const deleted = screen.getByTestId('agent-elements-unified-diff-line-2');
    expect(deleted).toHaveAttribute('data-line-kind', 'del');
    expect(within(deleted).getByTestId('agent-elements-unified-diff-old-line')).toHaveTextContent('4');
    expect(within(deleted).getByTestId('agent-elements-unified-diff-new-line')).toBeEmptyDOMElement();
    expect(within(deleted).getByTestId('agent-elements-unified-diff-sign')).toHaveTextContent('−');
    expect(within(deleted).getByTestId('agent-elements-unified-diff-code')).toHaveTextContent('const oldValue = 1;');

    const added = screen.getByTestId('agent-elements-unified-diff-line-3');
    expect(added).toHaveAttribute('data-line-kind', 'add');
    expect(within(added).getByTestId('agent-elements-unified-diff-old-line')).toBeEmptyDOMElement();
    expect(within(added).getByTestId('agent-elements-unified-diff-new-line')).toHaveTextContent('4');
    expect(within(added).getByTestId('agent-elements-unified-diff-sign')).toHaveTextContent('+');
    expect(within(added).getByTestId('agent-elements-unified-diff-code')).toHaveTextContent('const newValue = 2;');

    expect(diffStats(sampleDiff)).toEqual({ added: 2, removed: 1 });
  });

  it('renders loading, error, binary, and empty states with Agent Elements markers', () => {
    const { rerender } = render(<UnifiedDiffView diff="" loading />);

    expect(screen.getByTestId('agent-elements-unified-diff-placeholder')).toHaveAttribute('data-state', 'loading');
    expect(screen.getByTestId('agent-elements-unified-diff-placeholder')).toHaveTextContent('Loading diff...');

    rerender(<UnifiedDiffView diff="" error="Diff failed" />);
    expect(screen.getByTestId('agent-elements-unified-diff-placeholder')).toHaveAttribute('data-state', 'error');
    expect(screen.getByTestId('agent-elements-unified-diff-placeholder')).toHaveTextContent('Diff failed');

    rerender(<UnifiedDiffView diff="" isBinary />);
    expect(screen.getByTestId('agent-elements-unified-diff-placeholder')).toHaveAttribute('data-state', 'binary');
    expect(screen.getByTestId('agent-elements-unified-diff-placeholder')).toHaveTextContent('Binary file');

    rerender(<UnifiedDiffView diff="" />);
    expect(screen.getByTestId('agent-elements-unified-diff-placeholder')).toHaveAttribute('data-state', 'empty');
    expect(screen.getByTestId('agent-elements-unified-diff-placeholder')).toHaveTextContent('No textual changes');
  });

  it('keeps diff peek source constrained to Agent Elements-compatible styling', () => {
    const combinedSource = [
      readFileSync(diffPeekSourcePath, 'utf8'),
      readFileSync(unifiedDiffViewSourcePath, 'utf8'),
    ].join('\n');

    expect(combinedSource).toContain('agent-elements-diff-peek-popover');
    expect(combinedSource).toContain('agent-elements-unified-diff-view');
    expect(combinedSource).toContain('data-agent-elements-card-padding="sectioned-symmetric"');
    expect(combinedSource).toContain('data-agent-elements-card-width="floating-popover"');
    expect(combinedSource).toContain('--agent-elements-card-inline-padding');
    expect(combinedSource).toContain('--agent-elements-card-block-padding');
    expect(combinedSource).toContain('--an-tool-background');
    expect(combinedSource).toContain('--an-diff-added-bg');
    expect(combinedSource).toContain('--an-diff-removed-bg');
    expect(combinedSource).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(combinedSource).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-/);
    expect(combinedSource).not.toMatch(/rounded-lg|rounded-xl|tracking-|uppercase|transition-all|text-white|bg-black|bg-white/);
    expect(combinedSource).not.toMatch(/rgba\(|#[0-9a-fA-F]{3,8}\b/);
  });
});
