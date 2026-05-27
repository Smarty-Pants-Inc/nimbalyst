// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonacoDiffApprovalBar } from '../MonacoDiffApprovalBar';

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
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }, icon),
  };
});

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../MonacoDiffApprovalBar.tsx');

describe('MonacoDiffApprovalBar Agent Elements shell', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-25T01:45:00Z').getTime());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Monaco diff review controls with Agent Elements chrome while preserving callbacks', () => {
    const onAcceptAll = vi.fn();
    const onRejectAll = vi.fn();
    const onGoToSession = vi.fn();

    render(
      <MonacoDiffApprovalBar
        fileName="app.ts"
        sessionInfo={{
          sessionId: 'session-1',
          sessionTitle: 'Implement edit review',
          editedAt: Date.now() - 60_000,
        }}
        onAcceptAll={onAcceptAll}
        onRejectAll={onRejectAll}
        onGoToSession={onGoToSession}
      />,
    );

    const root = screen.getByTestId('agent-elements-monaco-diff-approval-bar');
    expect(root).toHaveClass('monaco-diff-approval-bar', 'agent-elements-monaco-diff-approval-bar', 'agent-elements-tool-card');
    expect(root).toHaveAttribute('data-component', 'MonacoDiffApprovalBar');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'monaco-diff-approval-bar');
    expect(root.className).not.toMatch(/rgba|text-white|bg-white|bg-black|rounded-md|scale-/);

    const session = screen.getByTestId('agent-elements-monaco-diff-approval-session');
    expect(session).toHaveAttribute('data-agent-elements-shell', 'monaco-diff-approval-session');
    expect(session).toHaveTextContent('Implement edit review');
    expect(session).toHaveTextContent('edited app.ts');
    expect(session).toHaveTextContent('1 minute ago');

    const goto = screen.getByTestId('agent-elements-monaco-diff-approval-goto');
    expect(goto.tagName).toBe('BUTTON');
    expect(goto).toHaveAccessibleName('Go to Session');
    fireEvent.click(goto);
    expect(onGoToSession).toHaveBeenCalledWith('session-1');

    const rejectAll = screen.getByTestId('diff-revert-all-button');
    const acceptAll = screen.getByTestId('diff-keep-all-button');
    for (const button of [rejectAll, acceptAll]) {
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveClass('agent-elements-monaco-diff-approval-button');
      expect(button.className).not.toMatch(/text-white|rounded-md|scale-/);
    }

    fireEvent.click(rejectAll);
    fireEvent.click(acceptAll);
    expect(onRejectAll).toHaveBeenCalledTimes(1);
    expect(onAcceptAll).toHaveBeenCalledTimes(1);
  });

  it('renders the fallback label without a session action and keeps accept errors contained', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onAcceptAll = vi.fn(() => {
      throw new Error('accept failed');
    });
    const onRejectAll = vi.fn();

    render(
      <MonacoDiffApprovalBar
        fileName="plain.ts"
        onAcceptAll={onAcceptAll}
        onRejectAll={onRejectAll}
      />,
    );

    const label = screen.getByTestId('agent-elements-monaco-diff-approval-label');
    expect(label).toHaveTextContent('AI changes to plain.ts');
    expect(screen.queryByTestId('agent-elements-monaco-diff-approval-goto')).not.toBeInTheDocument();

    const acceptAll = screen.getByTestId('diff-keep-all-button');
    expect(() => fireEvent.click(acceptAll)).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      '[MonacoDiffApprovalBar] Error calling onAcceptAll:',
      expect.any(Error),
    );

    const actions = screen.getByTestId('agent-elements-monaco-diff-approval-actions');
    expect(within(actions).getByTestId('diff-revert-all-button')).toBeInTheDocument();
  });

  it('keeps the source constrained to Agent Elements-compatible diff review styling', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-monaco-diff-approval-bar');
    expect(source).toContain('data-agent-elements-shell="monaco-diff-approval-bar"');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-input-border-radius');
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-/);
    expect(source).not.toMatch(/text-white|bg-white|bg-black|rounded-md|rounded-lg|rounded-xl|tracking-|active:scale|transition-all/);
    expect(source).not.toMatch(/rgba\(|#[0-9a-fA-F]{3,8}\b|<MaterialSymbol[^>]*aria-hidden/);
  });
});
