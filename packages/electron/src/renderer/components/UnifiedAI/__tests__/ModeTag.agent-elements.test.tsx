// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ModeTag } from '../ModeTag';

vi.mock('../../../help', () => ({
  HelpTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const sourcePath = resolve(__dirname, '../ModeTag.tsx');

describe('UnifiedAI ModeTag Agent Elements shell', () => {
  it('renders the current mode with Agent Elements-compatible metadata and preserves toggling', () => {
    const onModeChange = vi.fn();

    render(<ModeTag mode="planning" onModeChange={onModeChange} />);

    const button = screen.getByTestId('plan-mode-toggle');
    expect(button).toHaveTextContent('Plan');
    expect(button).toHaveClass('mode-tag', 'agent-elements-mode-tag', 'agent-elements-status-pill');
    expect(button).toHaveAttribute('data-agent-elements-shell', 'mode-tag');
    expect(button).toHaveAttribute('data-component', 'UnifiedAIModeTag');
    expect(button).toHaveAttribute('data-mode', 'planning');
    expect(button).toHaveAttribute('data-tone', 'warning');
    expect(button).toHaveAttribute(
      'aria-label',
      'Plan mode: Creates plan documents (click to enable full agent mode)',
    );

    fireEvent.click(button);
    expect(onModeChange).toHaveBeenCalledWith('agent');
  });

  it('renders agent mode as the alternate mode and preserves reverse toggling', () => {
    const onModeChange = vi.fn();

    render(<ModeTag mode="agent" onModeChange={onModeChange} />);

    const button = screen.getByTestId('plan-mode-toggle');
    expect(button).toHaveTextContent('Agent');
    expect(button).toHaveAttribute('data-mode', 'agent');
    expect(button).toHaveAttribute('data-tone', 'success');
    expect(button).toHaveAttribute(
      'aria-label',
      'Agent mode: Full tool access (click to switch to plan mode)',
    );

    fireEvent.click(button);
    expect(onModeChange).toHaveBeenCalledWith('planning');
  });

  it('keeps ModeTag source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-mode-tag');
    expect(source).not.toMatch(/rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/bg-blue|text-blue|dark:bg-blue|dark:text-blue/);
    expect(source).not.toMatch(/bg-orange|text-orange|dark:bg-orange|dark:text-orange/);
    expect(source).not.toMatch(/tracking-|uppercase|hover:-translate|hover:shadow|active:translate/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
  });
});
