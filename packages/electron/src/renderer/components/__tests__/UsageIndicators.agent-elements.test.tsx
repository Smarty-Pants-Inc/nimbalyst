// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeUsageIndicator } from '../ClaudeUsageIndicator/ClaudeUsageIndicator';
import { CodexUsageIndicator } from '../CodexUsageIndicator/CodexUsageIndicator';

const claudeIndicatorSourcePath = resolve(__dirname, '../ClaudeUsageIndicator/ClaudeUsageIndicator.tsx');
const claudePopoverSourcePath = resolve(__dirname, '../ClaudeUsageIndicator/ClaudeUsagePopover.tsx');
const codexIndicatorSourcePath = resolve(__dirname, '../CodexUsageIndicator/CodexUsageIndicator.tsx');
const codexPopoverSourcePath = resolve(__dirname, '../CodexUsageIndicator/CodexUsagePopover.tsx');

const mockState = vi.hoisted(() => ({
  tokens: {
    claudeUsageAtom: 'claudeUsageAtom',
    claudeUsageAvailableAtom: 'claudeUsageAvailableAtom',
    claudeUsageIndicatorEnabledAtom: 'claudeUsageIndicatorEnabledAtom',
    claudeUsageSessionColorAtom: 'claudeUsageSessionColorAtom',
    claudeUsageWeeklyColorAtom: 'claudeUsageWeeklyColorAtom',
    setClaudeUsageIndicatorEnabledAtom: 'setClaudeUsageIndicatorEnabledAtom',
    codexUsageAtom: 'codexUsageAtom',
    codexUsageAvailableAtom: 'codexUsageAvailableAtom',
    codexUsageIndicatorEnabledAtom: 'codexUsageIndicatorEnabledAtom',
    codexUsageSessionColorAtom: 'codexUsageSessionColorAtom',
    codexUsageWeeklyColorAtom: 'codexUsageWeeklyColorAtom',
    setCodexUsageIndicatorEnabledAtom: 'setCodexUsageIndicatorEnabledAtom',
  },
  setClaudeUsageIndicatorEnabled: vi.fn(),
  setCodexUsageIndicatorEnabled: vi.fn(),
  refreshClaudeUsage: vi.fn().mockResolvedValue(undefined),
  refreshCodexUsage: vi.fn().mockResolvedValue(undefined),
}));

const claudeUsage = {
  fiveHour: {
    utilization: 42,
    resetsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  },
  sevenDay: {
    utilization: 24,
    resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  sevenDayOpus: {
    utilization: 12,
    resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  lastUpdated: Date.now() - 90_000,
};

const codexUsage = {
  fiveHour: {
    utilization: 67,
    resetsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  },
  sevenDay: {
    utilization: 55,
    resetsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  limitsAvailable: true,
  lastUpdated: Date.now() - 120_000,
};

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    switch (atom) {
      case mockState.tokens.claudeUsageAtom:
        return claudeUsage;
      case mockState.tokens.claudeUsageAvailableAtom:
      case mockState.tokens.claudeUsageIndicatorEnabledAtom:
      case mockState.tokens.codexUsageAvailableAtom:
      case mockState.tokens.codexUsageIndicatorEnabledAtom:
        return true;
      case mockState.tokens.claudeUsageSessionColorAtom:
      case mockState.tokens.codexUsageSessionColorAtom:
        return 'yellow';
      case mockState.tokens.claudeUsageWeeklyColorAtom:
      case mockState.tokens.codexUsageWeeklyColorAtom:
        return 'green';
      case mockState.tokens.codexUsageAtom:
        return codexUsage;
      default:
        return null;
    }
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.setClaudeUsageIndicatorEnabledAtom) {
      return mockState.setClaudeUsageIndicatorEnabled;
    }
    if (atom === mockState.tokens.setCodexUsageIndicatorEnabledAtom) {
      return mockState.setCodexUsageIndicatorEnabled;
    }
    return vi.fn();
  }),
}));

vi.mock('../../store/atoms/claudeUsageAtoms', () => ({
  claudeUsageAtom: mockState.tokens.claudeUsageAtom,
  claudeUsageAvailableAtom: mockState.tokens.claudeUsageAvailableAtom,
  claudeUsageIndicatorEnabledAtom: mockState.tokens.claudeUsageIndicatorEnabledAtom,
  claudeUsageSessionColorAtom: mockState.tokens.claudeUsageSessionColorAtom,
  claudeUsageWeeklyColorAtom: mockState.tokens.claudeUsageWeeklyColorAtom,
  setClaudeUsageIndicatorEnabledAtom: mockState.tokens.setClaudeUsageIndicatorEnabledAtom,
  formatResetTime: () => '1h',
}));

vi.mock('../../store/atoms/codexUsageAtoms', () => ({
  codexUsageAtom: mockState.tokens.codexUsageAtom,
  codexUsageAvailableAtom: mockState.tokens.codexUsageAvailableAtom,
  codexUsageIndicatorEnabledAtom: mockState.tokens.codexUsageIndicatorEnabledAtom,
  codexUsageSessionColorAtom: mockState.tokens.codexUsageSessionColorAtom,
  codexUsageWeeklyColorAtom: mockState.tokens.codexUsageWeeklyColorAtom,
  setCodexUsageIndicatorEnabledAtom: mockState.tokens.setCodexUsageIndicatorEnabledAtom,
  formatResetTime: () => '2h',
}));

vi.mock('../../store/listeners/claudeUsageListeners', () => ({
  refreshClaudeUsage: mockState.refreshClaudeUsage,
}));

vi.mock('../../store/listeners/codexUsageListeners', () => ({
  refreshCodexUsage: mockState.refreshCodexUsage,
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
  };
});

vi.mock('../../hooks/useFloatingMenu', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    FloatingPortal: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useFloatingMenu: (options: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) => ({
      isOpen: options.open ?? true,
      setIsOpen: options.onOpenChange ?? vi.fn(),
      refs: {
        setReference: vi.fn(),
        setFloating: vi.fn(),
      },
      floatingStyles: {},
      getReferenceProps: () => ({}),
      getFloatingProps: () => ({}),
    }),
  };
});

describe('usage indicators Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        openExternal: vi.fn(),
      },
    });
  });

  it('renders Claude usage indicator and popover with Agent Elements markers while preserving refresh, disable, and status actions', async () => {
    render(<ClaudeUsageIndicator />);

    const button = screen.getByTestId('claude-usage-indicator');
    expect(button).toHaveClass('agent-elements-usage-indicator-button');
    expect(button).toHaveAttribute('data-agent-elements-shell', 'claude-usage-indicator');
    expect(button).toHaveAttribute('data-usage-provider', 'claude');
    expect(screen.getByTestId('agent-elements-claude-usage-ring')).toHaveAttribute(
      'data-usage-state',
      'warning'
    );

    fireEvent.click(button);

    const popover = await screen.findByTestId('claude-usage-popover');
    expect(popover).toHaveClass('agent-elements-usage-popover', 'agent-elements-tool-card');
    expect(popover).toHaveAttribute('data-agent-elements-shell', 'claude-usage-popover');
    expect(screen.getAllByTestId('agent-elements-claude-usage-section')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /refresh usage/i }));
    await waitFor(() => {
      expect(mockState.refreshClaudeUsage).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /disable claude usage indicator/i }));
    expect(mockState.setClaudeUsageIndicatorEnabled).toHaveBeenCalledWith(false);
  });

  it('renders Codex usage indicator and popover with Agent Elements markers while preserving refresh, disable, and external status actions', async () => {
    render(<CodexUsageIndicator />);

    const button = screen.getByTestId('codex-usage-indicator');
    expect(button).toHaveClass('agent-elements-usage-indicator-button');
    expect(button).toHaveAttribute('data-agent-elements-shell', 'codex-usage-indicator');
    expect(button).toHaveAttribute('data-usage-provider', 'codex');
    expect(screen.getByTestId('agent-elements-codex-usage-ring')).toHaveAttribute(
      'data-usage-state',
      'warning'
    );

    fireEvent.click(button);

    const popover = await screen.findByTestId('codex-usage-popover');
    expect(popover).toHaveClass('agent-elements-usage-popover', 'agent-elements-tool-card');
    expect(popover).toHaveAttribute('data-agent-elements-shell', 'codex-usage-popover');
    expect(screen.getAllByTestId('agent-elements-codex-usage-section')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /refresh usage/i }));
    await waitFor(() => {
      expect(mockState.refreshCodexUsage).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /openai status page/i }));
    expect(window.electronAPI.openExternal).toHaveBeenCalledWith('https://status.openai.com');

    fireEvent.click(screen.getByRole('button', { name: /disable codex usage indicator/i }));
    expect(mockState.setCodexUsageIndicatorEnabled).toHaveBeenCalledWith(false);
  });

  it('keeps usage indicator sources on Agent Elements-compatible visual rules', () => {
    const sources = [
      readFileSync(claudeIndicatorSourcePath, 'utf8'),
      readFileSync(claudePopoverSourcePath, 'utf8'),
      readFileSync(codexIndicatorSourcePath, 'utf8'),
      readFileSync(codexPopoverSourcePath, 'utf8'),
    ].join('\n');

    expect(sources).toContain('agent-elements-usage-indicator-button');
    expect(sources).toContain('agent-elements-usage-popover');
    expect(sources).toContain('data-agent-elements-shell="usage-section"');
    expect(sources).toContain('color-mix(in_srgb');

    expect(sources).not.toMatch(/active:scale|rounded-md|rounded-lg|shadow-lg|rgba\(/);
    expect(sources).not.toMatch(/stroke-(green|yellow|red)-500|bg-(green|yellow|red)-500|text-(green|yellow|red)-500/);
    expect(sources).not.toMatch(/<svg|<\/svg>/);
  });
});
