// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  useAtomValue: vi.fn(() => false),
}));

vi.mock('jotai', () => ({
  useAtomValue: mockState.useAtomValue,
}));

vi.mock('../../../store', () => ({
  sessionProcessingAtom: (sessionId: string) => `processing:${sessionId}`,
  sessionUnreadAtom: (sessionId: string) => `unread:${sessionId}`,
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, className }: { icon: string; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, className }, icon),
    ProviderIcon: ({ provider, size }: { provider: string; size?: number }) =>
      ReactModule.createElement('span', { 'data-provider': provider, 'data-size': size }, provider),
    formatDate: (createdAt: string | number | Date) => `formatted:${createdAt}`,
  };
});

import { SessionDropdown } from '../SessionDropdown';

const sourcePath = resolve(__dirname, '../SessionDropdown.tsx');

const sessions = [
  {
    id: 'session-1',
    createdAt: 1_779_756_000_000,
    title: 'Planning pass',
    provider: 'openai',
    model: 'gpt-5.1',
    messageCount: 3,
  },
  {
    id: 'session-2',
    createdAt: 1_779_756_300_000,
    title: 'Implementation pass',
    provider: 'claude-code',
    model: 'sonnet',
    messageCount: 7,
  },
];

describe('SessionDropdown Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps session menu behavior while exposing Agent Elements shell markers', () => {
    const onSessionSelect = vi.fn();
    const onNewSession = vi.fn();
    const onDeleteSession = vi.fn();
    const onRenameSession = vi.fn();
    const onOpenSessionManager = vi.fn();

    render(
      <SessionDropdown
        currentSessionId="session-1"
        sessions={sessions}
        onSessionSelect={onSessionSelect}
        onNewSession={onNewSession}
        onDeleteSession={onDeleteSession}
        onRenameSession={onRenameSession}
        onOpenSessionManager={onOpenSessionManager}
      />,
    );

    const trigger = screen.getByRole('button', { name: /planning pass/i });
    expect(trigger).toHaveClass('session-dropdown-trigger', 'agent-elements-session-dropdown-trigger');
    expect(trigger).toHaveAttribute('data-agent-elements-shell', 'session-dropdown-trigger');

    fireEvent.click(trigger);

    const menu = screen.getByTestId('agent-elements-session-dropdown-menu');
    expect(menu).toHaveClass('session-dropdown-menu', 'agent-elements-session-dropdown-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'session-dropdown-menu');

    fireEvent.click(within(menu).getByText('Implementation pass'));
    expect(onSessionSelect).toHaveBeenCalledWith('session-2');

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /rename planning pass/i }));
    const input = screen.getByDisplayValue('Planning pass');
    fireEvent.change(input, { target: { value: 'Renamed session' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameSession).toHaveBeenCalledWith('session-1', 'Renamed session');
  });

  it('keeps SessionDropdown source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-session-dropdown');
    expect(source).toContain('data-agent-elements-shell="session-dropdown-menu"');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-border-color');
    expect(source).not.toMatch(/\b(?:bg|text|border|hover:bg|hover:text|hover:border)-nim(?:-[\w-]+)?\b/);
    expect(source).not.toMatch(/var\(--nim-/);
    expect(source).not.toMatch(/rgba\(|text-white|rounded-md|rounded-lg|rounded-xl|transition-all|active:scale|nim-btn-icon/);
  });
});
