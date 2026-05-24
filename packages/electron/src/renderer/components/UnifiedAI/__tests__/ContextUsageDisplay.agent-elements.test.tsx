// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

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
  };
});

vi.mock('../../../help', () => ({
  getHelpContent: (id: string) =>
    id === 'context-indicator'
      ? {
          title: 'Context window',
          body: 'Shows the live prompt context currently loaded for the model.',
        }
      : null,
}));

import { ContextUsageDisplay } from '../ContextUsageDisplay';

const sourcePath = resolve(__dirname, '../ContextUsageDisplay.tsx');

describe('UnifiedAI ContextUsageDisplay Agent Elements shell', () => {
  it('renders the compact Agent Elements token pill without token data', () => {
    render(
      <ContextUsageDisplay
        inputTokens={0}
        outputTokens={0}
        totalTokens={0}
        contextWindow={0}
      />
    );

    const root = screen.getByTestId('context-indicator');
    expect(root).toHaveClass('context-usage-display', 'agent-elements-context-usage');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'context-usage');
    expect(root).toHaveAttribute('data-component', 'UnifiedAIContextUsageDisplay');
    expect(root).toHaveAttribute('tabIndex', '-1');
    expect(root).toHaveTextContent('--');
  });

  it('preserves context breakdown tooltip behavior inside the Agent Elements shell', () => {
    render(
      <ContextUsageDisplay
        inputTokens={3000}
        outputTokens={2000}
        totalTokens={5000}
        contextWindow={200000}
        currentContext={{
          tokens: 110000,
          contextWindow: 200000,
          categories: [
            { name: 'Messages', tokens: 80000, percentage: 40 },
            { name: 'Files', tokens: 30000, percentage: 15 },
            { name: 'Free space', tokens: 90000, percentage: 45 },
          ],
        }}
      />
    );

    const root = screen.getByTestId('context-indicator');
    expect(root).toHaveTextContent('110k/200k (55%)');
    expect(root).toHaveAttribute('aria-label', 'Context usage 110k of 200k tokens (55%)');
    expect(root).toHaveAttribute('tabIndex', '0');

    fireEvent.mouseEnter(root);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveClass('agent-elements-context-usage-tooltip');
    expect(within(tooltip).getByText('Context Breakdown')).toBeInTheDocument();
    expect(within(tooltip).getByText('3,000')).toBeInTheDocument();
    expect(within(tooltip).getByText('2,000')).toBeInTheDocument();
    expect(within(tooltip).getByText('Messages')).toBeInTheDocument();
    expect(within(tooltip).getByText('Files')).toBeInTheDocument();
    expect(within(tooltip).getByText('Free space')).toBeInTheDocument();

    fireEvent.click(within(tooltip).getByRole('button', { name: 'What is this?' }));
    expect(within(tooltip).getByText('Context window')).toBeInTheDocument();
    expect(
      within(tooltip).getByText('Shows the live prompt context currently loaded for the model.')
    ).toBeInTheDocument();
  });

  it('keeps ContextUsageDisplay source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-context-usage');
    expect(source).toContain('data-agent-elements-shell="context-usage"');
    expect(source).not.toMatch(/rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b/);
    expect(source).not.toMatch(/bg-nim|text-nim|bg-\[var\(--nim|text-\[var\(--nim|var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/text-white|uppercase|tracking-|hover:shadow|active:scale|transition-all/);
    expect(source).not.toMatch(/shadow-\[/);
  });
});
