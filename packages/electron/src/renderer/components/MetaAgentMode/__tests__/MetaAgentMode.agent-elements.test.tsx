// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetaAgentMode } from '../MetaAgentMode';

const metaAgentModeSourcePath = resolve(__dirname, '../MetaAgentMode.tsx');

const mockState = vi.hoisted(() => ({
  tokenUsage: new Map<string, { totalTokens: number; currentContext?: { tokens: number; contextWindow: number } }>(),
  storeSubscribe: vi.fn(() => vi.fn()),
  createMetaAgentSession: vi.fn(),
  electronInvoke: vi.fn(),
}));

vi.mock('jotai', () => ({
  atom: vi.fn((read: any) => read),
  useAtomValue: vi.fn((atomValue: any) => {
    if (atomValue === 'default-agent-model') return 'claude-sonnet-4';
    if (typeof atomValue === 'string' && atomValue.startsWith('session-token-usage:')) {
      return mockState.tokenUsage.get(atomValue.slice('session-token-usage:'.length)) ?? null;
    }
    if (typeof atomValue === 'function') {
      return atomValue((nestedAtom: string) => {
        if (nestedAtom.startsWith('session-token-usage:')) {
          return mockState.tokenUsage.get(nestedAtom.slice('session-token-usage:'.length)) ?? null;
        }
        return null;
      });
    }
    return null;
  }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size, className }: { icon: string; size?: number; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

vi.mock('@nimbalyst/runtime/store', () => ({
  store: {
    sub: mockState.storeSubscribe,
  },
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  defaultAgentModelAtom: 'default-agent-model',
}));

vi.mock('../../../store', () => ({
  sessionRegistryAtom: 'session-registry',
}));

vi.mock('../../../store/atoms/sessions', () => ({
  sessionTokenUsageAtom: (sessionId: string) => `session-token-usage:${sessionId}`,
}));

vi.mock('../../../utils/dateFormatting', () => ({
  getRelativeTimeString: (timestamp: number) => `relative-${timestamp}`,
}));

vi.mock('../../../utils/metaAgentUtils', () => ({
  createMetaAgentSession: mockState.createMetaAgentSession,
}));

vi.mock('../../UnifiedAI/SessionTranscript', () => ({
  SessionTranscript: ({ sessionId, workspacePath, mode, hideSidebar, additionalTeammates, waitingForNoun }: any) => (
    <div
      data-testid="mock-session-transcript"
      data-session-id={sessionId}
      data-workspace-path={workspacePath}
      data-mode={mode}
      data-hide-sidebar={String(hideSidebar)}
      data-teammates={additionalTeammates.length}
      data-waiting-for-noun={waitingForNoun}
    />
  ),
}));

describe('MetaAgentMode Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.tokenUsage = new Map([
      ['child-running', { totalTokens: 12_500, currentContext: { tokens: 4_000, contextWindow: 8_000 } }],
      ['child-waiting', { totalTokens: 1_500 }],
    ]);
    mockState.electronInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'meta-agent:list-spawned-sessions') {
        return {
          success: true,
          sessions: [
            {
              sessionId: 'child-running',
              title: 'Implement parser',
              provider: 'openai-codex',
              model: 'gpt-5.1',
              status: 'running',
              lastActivity: 1_700_000_100_000,
              originalPrompt: 'Add parser coverage',
              lastResponse: 'Streaming parser work',
              editedFiles: ['src/parser.ts'],
              pendingPrompt: null,
              createdAt: 1_700_000_000_000,
              updatedAt: 1_700_000_100_000,
            },
            {
              sessionId: 'child-waiting',
              title: 'Review UI',
              provider: 'claude-agent',
              model: null,
              status: 'waiting_for_input',
              lastActivity: null,
              originalPrompt: 'Review UI shell',
              lastResponse: null,
              editedFiles: [],
              pendingPrompt: {
                promptId: 'prompt-1',
                promptType: 'approval',
              },
              createdAt: 1_700_000_030_000,
              updatedAt: 1_700_000_070_000,
            },
          ],
        };
      }
      return { success: true };
    });
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: mockState.electronInvoke,
      },
    });
  });

  it('wraps delegated sessions in Agent Elements chrome while preserving transcript and action wiring', async () => {
    const onOpenSessionInAgent = vi.fn();

    render(
      <MetaAgentMode
        workspacePath="/workspace/demo"
        isActive
        sessionId="meta-session"
        onOpenSessionInAgent={onOpenSessionInAgent}
      />,
    );

    const root = screen.getByTestId('agent-elements-meta-agent-mode');
    expect(root).toHaveClass('meta-agent-mode', 'agent-elements-meta-agent-mode');
    expect(root).toHaveAttribute('data-component', 'MetaAgentMode');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'meta-agent-mode');
    expect(root).toHaveAttribute('data-active', 'true');

    await waitFor(() => {
      expect(screen.getAllByTestId('meta-agent-child-card')).toHaveLength(2);
    });

    expect(screen.getByTestId('mock-session-transcript')).toHaveAttribute('data-session-id', 'meta-session');
    expect(screen.getByTestId('mock-session-transcript')).toHaveAttribute('data-workspace-path', '/workspace/demo');
    expect(screen.getByTestId('mock-session-transcript')).toHaveAttribute('data-mode', 'agent');
    expect(screen.getByTestId('mock-session-transcript')).toHaveAttribute('data-hide-sidebar', 'true');
    expect(screen.getByTestId('mock-session-transcript')).toHaveAttribute('data-teammates', '1');

    expect(screen.getByTestId('agent-elements-meta-agent-dashboard')).toHaveAttribute(
      'data-agent-elements-shell',
      'meta-agent-dashboard',
    );
    expect(screen.getByTestId('agent-elements-meta-agent-summary')).toHaveTextContent('2 total');
    expect(screen.getByTestId('agent-elements-meta-agent-summary')).toHaveTextContent('1 running');
    expect(screen.getByTestId('agent-elements-meta-agent-summary')).toHaveTextContent('1 waiting');

    expect(screen.getAllByTestId('meta-agent-child-card')[0]).toHaveClass('agent-elements-meta-agent-child-card');
    expect(screen.getAllByTestId('agent-elements-meta-agent-status-pill')[0]).toHaveAttribute('data-tone', 'running');
    expect(screen.getAllByTestId('agent-elements-meta-agent-status-pill')[1]).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByTestId('agent-elements-meta-agent-pending-prompt')).toHaveTextContent('Waiting for approval');

    fireEvent.click(screen.getAllByTestId('meta-agent-open-session')[0]);
    expect(onOpenSessionInAgent).toHaveBeenCalledWith('child-running');

    fireEvent.click(screen.getByTestId('meta-agent-refresh'));
    await waitFor(() => {
      expect(mockState.electronInvoke).toHaveBeenCalledWith(
        'meta-agent:list-spawned-sessions',
        'meta-session',
        '/workspace/demo',
      );
    });
  });

  it('renders the timeline overlay with Agent Elements shells and token aggregation', async () => {
    render(<MetaAgentMode workspacePath="/workspace/demo" isActive sessionId="meta-session" />);

    await screen.findByText('Implement parser');
    fireEvent.click(screen.getByTestId('meta-agent-open-timeline'));

    const timeline = screen.getByTestId('agent-elements-meta-agent-timeline');
    expect(timeline).toHaveClass('agent-elements-meta-agent-timeline');
    expect(timeline).toHaveAttribute('data-agent-elements-shell', 'meta-agent-timeline');
    expect(screen.getAllByTestId('meta-agent-gantt-row')).toHaveLength(2);
    expect(screen.getAllByTestId('meta-agent-gantt-bar')[0]).toHaveClass('agent-elements-meta-agent-timeline-bar');
    expect(screen.getByText('14k total tokens')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('meta-agent-close-timeline'));
    expect(screen.queryByTestId('agent-elements-meta-agent-timeline')).not.toBeInTheDocument();
  });

  it('uses shared Agent Elements card gutters for the delegated-session empty state', async () => {
    mockState.electronInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'meta-agent:list-spawned-sessions') {
        return { success: true, sessions: [] };
      }
      return { success: true };
    });

    render(<MetaAgentMode workspacePath="/workspace/demo" isActive sessionId="meta-session" />);

    const emptyState = await screen.findByTestId('meta-agent-empty-state');
    expect(emptyState).toHaveClass('agent-elements-meta-agent-empty-state', 'agent-elements-tool-card');
    expect(emptyState.className).toContain('--agent-elements-card-inline-padding');
    expect(emptyState.className).toContain('--agent-elements-card-block-padding');
  });

  it('keeps MetaAgentMode source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(metaAgentModeSourcePath, 'utf8');

    expect(source).toContain('agent-elements-meta-agent-mode');
    expect(source).toContain('data-agent-elements-shell="meta-agent-mode"');
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/bg-white|text-white|bg-black|hover:scale|tracking-/);
    expect(source).toContain('--an-button-primary-text');
    expect(source).toContain('--an-warning-color');
    expect(source).toContain('--an-error-color');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).not.toMatch(/agent-elements-meta-agent-empty-state[^`'"]*\bp-/);
    expect(source).not.toMatch(/var\(--nim-(?:warning|error)\)|text-\[var\(--an-background\)\]/);
    expect(source).not.toMatch(/--nim-accent|--nim-surface|text-nim-fg|<svg/);
  });
});
