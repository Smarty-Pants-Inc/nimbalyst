// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { LayoutControls } from '../LayoutControls';

vi.mock('../../../help', () => ({
  HelpTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const sourcePath = resolve(__dirname, '../LayoutControls.tsx');

describe('UnifiedAI LayoutControls Agent Elements shell', () => {
  it('renders layout controls with Agent Elements chrome and preserves mode changes', () => {
    const onModeChange = vi.fn();

    render(<LayoutControls mode="split" hasTabs onModeChange={onModeChange} />);

    const root = screen.getByTestId('layout-controls');
    expect(root).toHaveClass('layout-controls', 'agent-elements-layout-controls');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'layout-controls');
    expect(root).toHaveAttribute('data-component', 'UnifiedAILayoutControls');
    expect(root).toHaveAttribute('data-layout-mode', 'split');
    expect(root).toHaveAttribute('data-has-tabs', 'true');

    const editor = screen.getByTestId('layout-maximize-editor');
    const split = screen.getByTestId('layout-split-view');
    const transcript = screen.getByTestId('layout-maximize-transcript');

    expect(editor).toHaveAttribute('data-layout-mode', 'editor');
    expect(editor).toHaveAttribute('aria-pressed', 'false');
    expect(split).toHaveClass('agent-elements-layout-control-active');
    expect(split).toHaveAttribute('aria-pressed', 'true');
    expect(transcript).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(editor);
    fireEvent.click(transcript);

    expect(onModeChange).toHaveBeenNthCalledWith(1, 'editor');
    expect(onModeChange).toHaveBeenNthCalledWith(2, 'transcript');
  });

  it('preserves disabled tab-dependent controls while transcript remains available', () => {
    const onModeChange = vi.fn();

    render(<LayoutControls mode="transcript" hasTabs={false} onModeChange={onModeChange} />);

    expect(screen.getByTestId('layout-controls')).toHaveAttribute('data-has-tabs', 'false');
    expect(screen.getByTestId('layout-maximize-editor')).toBeDisabled();
    expect(screen.getByTestId('layout-split-view')).toBeDisabled();
    expect(screen.getByTestId('layout-maximize-transcript')).not.toBeDisabled();
    expect(screen.getByTestId('layout-maximize-transcript')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('layout-maximize-editor'));
    fireEvent.click(screen.getByTestId('layout-split-view'));
    fireEvent.click(screen.getByTestId('layout-maximize-transcript'));

    expect(onModeChange).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith('transcript');
  });

  it('keeps LayoutControls source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-layout-controls');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/<svg|<rect|<line/);
    expect(source).not.toMatch(/bg-nim|text-nim|bg-\[var\(--nim|text-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/text-white|uppercase|tracking-|hover:shadow|active:scale|transition-all/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
  });
});
