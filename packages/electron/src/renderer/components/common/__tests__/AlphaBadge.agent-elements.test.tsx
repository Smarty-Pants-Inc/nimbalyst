// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AlphaBadge } from '../AlphaBadge';

const sourcePath = resolve(__dirname, '../AlphaBadge.tsx');

describe('AlphaBadge Agent Elements shell', () => {
  it('keeps alpha badge text, accessibility, custom classes, and tooltip behavior', async () => {
    vi.useFakeTimers();

    render(<AlphaBadge size="sm" className="custom-badge" tooltip="Experimental feature" />);

    const badge = screen.getByTestId('alpha-badge');
    expect(badge).toHaveClass('agent-elements-alpha-badge', 'custom-badge');
    expect(badge).toHaveAttribute('data-agent-elements-shell', 'alpha-badge');
    expect(badge).toHaveAttribute('aria-label', 'Alpha feature');
    expect(badge).toHaveTextContent('alpha');
    expect(screen.queryByText('Experimental feature')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.mouseEnter(badge);
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByTestId('agent-elements-alpha-tooltip')).toHaveClass(
      'help-tooltip',
      'agent-elements-alpha-tooltip',
    );
    expect(screen.getByTestId('agent-elements-alpha-tooltip')).toHaveTextContent('Alpha');
    expect(screen.getByTestId('agent-elements-alpha-tooltip')).toHaveTextContent('Experimental feature');

    vi.useRealTimers();
  });

  it('renders the compact dot badge for dense icon surfaces', () => {
    render(<AlphaBadge size="dot" />);

    const badge = screen.getByTestId('alpha-badge');
    expect(badge).toHaveTextContent('α');
    expect(badge).toHaveClass('agent-elements-alpha-badge');
    expect(badge).toHaveAttribute('data-agent-elements-size', 'dot');
  });

  it('keeps AlphaBadge visual chrome on Agent Elements aliases', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-alpha-badge');
    expect(source).toContain('--an-background-tertiary');
    expect(source).toContain('--an-foreground-muted');
    expect(source).not.toMatch(/var\(--nim-/);
    expect(source).not.toMatch(/rgba\(/);
    expect(source).not.toMatch(/rounded-lg/);
  });
});
