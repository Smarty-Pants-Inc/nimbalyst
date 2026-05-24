// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomEditorAIEditedBar } from '../CustomEditorAIEditedBar';
import { UnifiedDiffHeader } from '../UnifiedDiffHeader';

const posthogCapture = vi.fn();

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({
    capture: posthogCapture,
  }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
    }: {
      icon: string;
      size?: number;
      className?: string;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
    ProviderIcon: ({
      provider,
      size,
      className,
    }: {
      provider: string;
      size?: number;
      className?: string;
    }) => ReactModule.createElement('span', { 'data-provider-icon': provider, 'data-size': size, className }),
  };
});

describe('UnifiedDiffHeader Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Agent Elements diff-review chrome while preserving navigation and review behavior', () => {
    const onAcceptAll = vi.fn();
    const onRejectAll = vi.fn();
    const onAcceptCurrent = vi.fn();
    const onRejectCurrent = vi.fn();
    const onNavigatePrevious = vi.fn();
    const onNavigateNext = vi.fn();
    const onGoToSession = vi.fn();

    render(
      <UnifiedDiffHeader
        filePath="/workspace/src/app.ts"
        fileName="app.ts"
        editorType="monaco"
        sessionInfo={{
          sessionId: 'session-1',
          sessionTitle: 'Implement diff review',
          provider: 'smarty-server',
          editedAt: Date.now() - 60_000,
        }}
        onGoToSession={onGoToSession}
        capabilities={{
          onAcceptAll,
          onRejectAll,
          changeGroups: {
            count: 3,
            currentIndex: 1,
            onNavigatePrevious,
            onNavigateNext,
            onAcceptCurrent,
            onRejectCurrent,
          },
        }}
      />
    );

    const root = screen.getByTestId('agent-elements-unified-diff-header');
    expect(root).toHaveClass('unified-diff-header', 'agent-elements-unified-diff-header', 'agent-elements-tool-card');
    expect(root).toHaveAttribute('data-component', 'UnifiedDiffHeader');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'unified-diff-header');
    expect(root.className).not.toMatch(/rgba|text-white|bg-white|bg-black|rounded-md|scale-/);

    const sessionLink = screen.getByTestId('agent-elements-unified-diff-header-session-link');
    expect(sessionLink.tagName).toBe('BUTTON');
    expect(sessionLink).toHaveClass('agent-elements-unified-diff-header-session-link');
    expect(within(sessionLink).getByText('Implement diff review')).toBeInTheDocument();
    expect(within(sessionLink).getByText((_content, element) => element?.getAttribute('data-provider-icon') === 'smarty-server')).toBeInTheDocument();

    fireEvent.click(sessionLink);
    expect(onGoToSession).toHaveBeenCalledWith('session-1');

    const previous = screen.getByTestId('agent-elements-unified-diff-header-previous');
    const next = screen.getByTestId('agent-elements-unified-diff-header-next');
    expect(previous).toHaveClass('agent-elements-unified-diff-header-icon-button');
    expect(next).toHaveClass('agent-elements-unified-diff-header-icon-button');
    fireEvent.click(previous);
    fireEvent.click(next);
    expect(onNavigatePrevious).toHaveBeenCalledTimes(1);
    expect(onNavigateNext).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('agent-elements-unified-diff-header-counter')).toHaveTextContent('2 of 3');

    const revertCurrent = screen.getByTestId('agent-elements-unified-diff-header-revert-current');
    const keepCurrent = screen.getByTestId('agent-elements-unified-diff-header-keep-current');
    const revertAll = screen.getByTestId('diff-revert-all');
    const keepAll = screen.getByTestId('diff-keep-all');

    for (const button of [revertCurrent, keepCurrent, revertAll, keepAll]) {
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveClass('agent-elements-unified-diff-header-button');
      expect(button.className).not.toMatch(/text-white|rounded-md|scale-/);
    }

    fireEvent.click(revertCurrent);
    fireEvent.click(keepCurrent);
    fireEvent.click(revertAll);
    fireEvent.click(keepAll);

    expect(onRejectCurrent).toHaveBeenCalledTimes(1);
    expect(onAcceptCurrent).toHaveBeenCalledTimes(1);
    expect(onRejectAll).toHaveBeenCalledTimes(1);
    expect(onAcceptAll).toHaveBeenCalledTimes(1);
    expect(posthogCapture).toHaveBeenCalledWith('ai_diff_rejected', {
      rejectType: 'partial',
      editorType: 'monaco',
    });
    expect(posthogCapture).toHaveBeenCalledWith('ai_diff_accepted', {
      acceptType: 'all',
      editorType: 'monaco',
    });
  });

  it('renders the custom-editor AI edited fallback with Agent Elements chrome and preserved actions', () => {
    const onGoToSession = vi.fn();
    const onViewHistory = vi.fn();

    render(
      <CustomEditorAIEditedBar
        fileName="diagram.excalidraw"
        sessionInfo={{
          sessionId: 'session-2',
          sessionTitle: 'Update diagram',
          editedAt: Date.now() - 3_600_000,
        }}
        onGoToSession={onGoToSession}
        onViewHistory={onViewHistory}
      />
    );

    const root = screen.getByTestId('agent-elements-custom-editor-ai-edited-bar');
    expect(root).toHaveClass('unified-diff-header', 'agent-elements-custom-editor-ai-edited-bar', 'agent-elements-tool-card');
    expect(root).toHaveAttribute('data-component', 'CustomEditorAIEditedBar');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'custom-editor-ai-edited-bar');
    expect(root.className).not.toMatch(/rgba|text-white|bg-white|bg-black|rounded-md|scale-/);

    const sessionButton = screen.getByTestId('agent-elements-custom-editor-ai-session');
    expect(sessionButton.tagName).toBe('BUTTON');
    fireEvent.click(sessionButton);
    expect(onGoToSession).toHaveBeenCalledWith('session-2');

    const historyButton = screen.getByTestId('agent-elements-custom-editor-ai-view-history');
    expect(historyButton).toHaveClass('agent-elements-unified-diff-header-button');
    expect(historyButton.className).not.toMatch(/text-white|rounded-md|scale-/);
    fireEvent.click(historyButton);
    expect(onViewHistory).toHaveBeenCalledTimes(1);
  });
});
