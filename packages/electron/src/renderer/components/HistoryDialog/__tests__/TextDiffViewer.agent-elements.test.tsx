// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TextDiffViewer, type TextDiffNavigationState } from '../TextDiffViewer';

const sourcePath = resolve(__dirname, '../TextDiffViewer.tsx');

const oldText = ['alpha', 'beta', 'shared', 'omega'].join('\n');
const newText = ['alpha', 'bravo', 'shared', 'appended', 'omega'].join('\n');

function renderViewer(onNavigationStateChange = vi.fn()) {
  render(
    <TextDiffViewer
      oldText={oldText}
      newText={newText}
      onNavigationStateChange={onNavigationStateChange}
      onNavigatePrevious={() => undefined}
      onNavigateNext={() => undefined}
    />
  );
  return { onNavigationStateChange };
}

describe('TextDiffViewer Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders side-by-side text history with Agent Elements chrome while preserving diff line content', async () => {
    const { onNavigationStateChange } = renderViewer();

    const root = screen.getByTestId('agent-elements-text-diff-viewer');
    expect(root).toHaveClass('text-diff-viewer', 'agent-elements-text-diff-viewer');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'text-diff-viewer');
    expect(root).toHaveAttribute('data-component', 'TextDiffViewer');

    const panels = screen.getByTestId('agent-elements-text-diff-panels');
    expect(panels).toHaveAttribute('data-agent-elements-shell', 'text-diff-panels');

    const oldPanel = screen.getByTestId('agent-elements-text-diff-panel-old');
    const newPanel = screen.getByTestId('agent-elements-text-diff-panel-new');
    expect(oldPanel).toHaveClass('text-diff-panel', 'text-diff-old', 'agent-elements-text-diff-panel-old');
    expect(newPanel).toHaveClass('text-diff-panel', 'text-diff-new', 'agent-elements-text-diff-panel-new');
    expect(within(oldPanel).getByText('Old Version')).toBeInTheDocument();
    expect(within(newPanel).getByText('New Version')).toBeInTheDocument();

    expect(within(oldPanel).getByText('beta')).toHaveClass('text-diff-line-content', 'agent-elements-text-diff-line-content');
    expect(within(newPanel).getByText('bravo')).toHaveClass('text-diff-line-content', 'agent-elements-text-diff-line-content');
    expect(within(newPanel).getByText('appended')).toHaveClass('select-text');

    await waitFor(() => {
      expect(onNavigationStateChange).toHaveBeenCalledWith(
        expect.objectContaining<TextDiffNavigationState>({
          currentIndex: 0,
          totalGroups: 2,
          canGoPrevious: false,
          canGoNext: true,
          addedLines: 2,
          removedLines: 1,
        })
      );
    });
  });

  it('preserves click and parent-triggered navigation semantics', async () => {
    const { onNavigationStateChange } = renderViewer();

    await waitFor(() => {
      expect(onNavigationStateChange).toHaveBeenCalledWith(expect.objectContaining({ currentIndex: 0 }));
    });

    fireEvent.click(screen.getByText('appended'));

    await waitFor(() => {
      expect(onNavigationStateChange).toHaveBeenCalledWith(expect.objectContaining({ currentIndex: 1 }));
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    act(() => {
      (window as unknown as { __textDiffNavigatePrevious: () => void }).__textDiffNavigatePrevious();
    });

    await waitFor(() => {
      expect(onNavigationStateChange).toHaveBeenCalledWith(expect.objectContaining({ currentIndex: 0 }));
    });
  });

  it('removes legacy text diff chrome in favor of Agent Elements tokenized rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-text-diff-viewer');
    expect(source).toContain('data-agent-elements-shell="text-diff-viewer"');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-diff-added-bg');
    expect(source).toContain('--an-diff-removed-bg');
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-/);
    expect(source).not.toMatch(/bg-(red|green)-|text-(red|green)-|dark:bg-(red|green)-|dark:text-(red|green)-/);
    expect(source).not.toMatch(/uppercase|tracking-\[|tracking-wide|border-l\s|border-l-/);
  });
});
