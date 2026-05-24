// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { EffortLevelSelector } from '../EffortLevelSelector';

const sourcePath = resolve(__dirname, '../EffortLevelSelector.tsx');

describe('UnifiedAI EffortLevelSelector Agent Elements shell', () => {
  it('renders the current level with Agent Elements chrome and preserves option selection', () => {
    const onLevelChange = vi.fn();

    render(<EffortLevelSelector level="high" onLevelChange={onLevelChange} />);

    const root = screen.getByTestId('agent-elements-effort-level-selector');
    expect(root).toHaveClass('effort-level-selector', 'agent-elements-effort-level-selector');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'effort-level-selector');
    expect(root).toHaveAttribute('data-component', 'UnifiedAIEffortLevelSelector');
    expect(root).toHaveAttribute('data-effort-level', 'high');

    const trigger = screen.getByTestId('effort-level-selector');
    expect(trigger).toHaveClass('agent-elements-effort-level-trigger', 'agent-elements-status-pill');
    expect(trigger).toHaveTextContent('High');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-label', 'Effort level: High');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dropdown = screen.getByTestId('agent-elements-effort-level-menu');
    expect(dropdown).toHaveClass('agent-elements-effort-level-menu');
    expect(within(dropdown).getAllByTestId('agent-elements-effort-level-option')).toHaveLength(5);
    expect(within(dropdown).getByRole('menuitemradio', { name: 'High' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(within(dropdown).getByRole('menuitemradio', { name: 'Max' }));

    expect(onLevelChange).toHaveBeenCalledWith('max');
    expect(screen.queryByTestId('agent-elements-effort-level-menu')).not.toBeInTheDocument();
  });

  it('preserves escape-to-close behavior without changing the selected level', () => {
    const onLevelChange = vi.fn();

    render(<EffortLevelSelector level="medium" onLevelChange={onLevelChange} />);

    fireEvent.click(screen.getByTestId('effort-level-selector'));
    expect(screen.getByTestId('agent-elements-effort-level-menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('agent-elements-effort-level-menu')).not.toBeInTheDocument();
    expect(onLevelChange).not.toHaveBeenCalled();
  });

  it('keeps EffortLevelSelector source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-effort-level-selector');
    expect(source).not.toMatch(/rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b/);
    expect(source).not.toMatch(/bg-nim|text-nim-primary|hover:text-nim-accent|tracking-|uppercase/);
    expect(source).not.toMatch(/shadow-\[0_/);
  });
});
