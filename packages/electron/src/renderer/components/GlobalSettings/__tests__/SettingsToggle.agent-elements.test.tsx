// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsToggle, ToggleSwitch } from '../SettingsToggle';

const sourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/SettingsToggle.tsx',
);

const legacyVisualChromePattern =
  /bg-nim|text-nim|border-nim|bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-|rgba\(|#[0-9a-fA-F]{3,8}\b|bg-white|rounded-lg|transition-all/;

describe('SettingsToggle Agent Elements shell', () => {
  it('renders enable toggle chrome while preserving provider toggle behavior', () => {
    const onChange = vi.fn();

    render(
      <SettingsToggle
        checked={false}
        description="Use this provider for agent sessions."
        name="Enable OpenAI"
        onChange={onChange}
        testId="agent-elements-settings-toggle-enable"
        variant="enable"
      />,
    );

    const row = screen.getByTestId('agent-elements-settings-toggle-enable');
    expect(row).toHaveClass('provider-enable', 'agent-elements-settings-toggle');
    expect(row).toHaveAttribute('data-agent-elements-shell', 'settings-enable-toggle');
    expect(row).toHaveAttribute('data-settings-toggle-variant', 'enable');
    expect(screen.getByText('Enable OpenAI')).toHaveClass('settings-toggle-label');
    expect(screen.getByText('Use this provider for agent sessions.')).toHaveClass('settings-toggle-description');

    const input = screen.getByRole('checkbox', { name: 'Enable OpenAI' });
    expect(input).not.toBeChecked();
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders inline toggle chrome and keeps disabled switches inert', () => {
    const onChange = vi.fn();

    render(
      <SettingsToggle
        checked
        disabled
        name="Show tool calls"
        onChange={onChange}
        testId="agent-elements-settings-toggle-inline"
      />,
    );

    const row = screen.getByTestId('agent-elements-settings-toggle-inline');
    expect(row).toHaveAttribute('data-agent-elements-shell', 'settings-inline-toggle');
    expect(row).toHaveAttribute('data-settings-toggle-variant', 'inline');

    const input = screen.getByRole('checkbox', { name: 'Show tool calls' });
    expect(input).toBeChecked();
    expect(input).toBeDisabled();
    fireEvent.click(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the raw switch focusable and Agent Elements-tokenized for direct callers', () => {
    const onChange = vi.fn();

    render(<ToggleSwitch checked={false} onChange={onChange} ariaLabel="Enable plugin" />);

    const input = screen.getByRole('checkbox', { name: 'Enable plugin' });
    expect(input).toHaveClass('sr-only', 'peer');
    expect(input.closest('[data-agent-elements-shell="toggle-switch"]')).toHaveClass('agent-elements-toggle-switch');
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('keeps shared toggle source on Agent Elements aliases instead of legacy visual tokens', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-background-tertiary');
    expect(source).toContain('--an-primary-color');
    expect(source).toContain('--an-focus-ring');
    expect(source).toContain('transition-[background-color,border-color,box-shadow]');
    expect(source).toContain('transition-transform');
    expect(source).not.toMatch(legacyVisualChromePattern);
  });
});
