// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionQuickOpen } from '../SessionQuickOpen';

const mockState = vi.hoisted(() => ({
  fileOptions: [] as Array<{
    id: string;
    label: string;
    description?: string;
    icon?: string;
    data?: Record<string, unknown>;
  }>,
  searchFileMention: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (String(atom).startsWith('fileMentionOptions:')) return mockState.fileOptions;
    return false;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === 'searchFileMentionAtom') return mockState.searchFileMention;
    return vi.fn();
  }),
}));

vi.mock('../../store', () => ({
  sessionOrChildProcessingAtom: (sessionId: string) => `processing:${sessionId}`,
  sessionPendingPromptAtom: (sessionId: string) => `pending:${sessionId}`,
  sessionUnreadAtom: (sessionId: string) => `unread:${sessionId}`,
}));

vi.mock('../../store/atoms/fileMention', () => ({
  fileMentionOptionsAtom: (workspacePath: string) => `fileMentionOptions:${workspacePath}`,
  searchFileMentionAtom: 'searchFileMentionAtom',
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    ProviderIcon: ({
      provider,
      size,
      className,
    }: {
      provider: string;
      size?: number;
      className?: string;
    }) => ReactModule.createElement('span', { 'data-provider': provider, 'data-size': size, className }),
    MaterialSymbol: ({
      icon,
      size,
      className,
      fill,
    }: {
      icon: string;
      size?: number;
      className?: string;
      fill?: boolean;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, 'data-fill': fill, className }),
  };
});

const sessions = [
  {
    id: 'session-1',
    title: 'Build UI shell',
    provider: 'openai',
    parentSessionId: 'workstream-1',
    worktreeId: 'worktree-1',
    messageCount: 3,
    updatedAt: 1700000000000,
    uncommittedCount: 2,
  },
  {
    id: 'session-2',
    title: 'Refactor sync flow',
    provider: 'claude',
    parentSessionId: null,
    worktreeId: null,
    messageCount: 1,
    updatedAt: 1700000100000,
    uncommittedCount: 0,
  },
];

describe('SessionQuickOpen Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.fileOptions.splice(0);
    Element.prototype.scrollIntoView = vi.fn();

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: vi.fn(async (channel: string) => {
          if (channel === 'sessions:list') {
            return { success: true, sessions };
          }
          if (channel === 'session-files:get-sessions-by-file') {
            return { success: true, sessionIds: ['session-2'] };
          }
          return { success: false };
        }),
      },
    });
  });

  it('renders an Agent Elements session palette shell while preserving keyboard open and prompt-switch behavior', async () => {
    const onClose = vi.fn();
    const onSessionSelect = vi.fn();
    const onSwitchToPrompts = vi.fn();

    render(
      <SessionQuickOpen
        isOpen={true}
        onClose={onClose}
        workspacePath="/workspace/app"
        onSessionSelect={onSessionSelect}
        onSwitchToPrompts={onSwitchToPrompts}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-session-quick-open-backdrop');
    expect(backdrop).toHaveClass('session-quick-open-backdrop', 'agent-elements-session-quick-open-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'session-quick-open-backdrop');

    const modal = screen.getByTestId('agent-elements-session-quick-open');
    expect(modal).toHaveClass('session-quick-open-modal', 'agent-elements-session-quick-open', 'agent-elements-tool-card');
    expect(modal).toHaveAttribute('data-component', 'SessionQuickOpen');
    expect(modal).toHaveAttribute('data-agent-elements-shell', 'session-quick-open');

    expect(screen.getByTestId('agent-elements-session-quick-open-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'session-quick-open-header'
    );
    const input = screen.getByTestId('agent-elements-session-quick-open-input');
    expect(input).toHaveAttribute('data-agent-elements-shell', 'session-quick-open-input');

    await screen.findByText('Build UI shell');
    expect(window.electronAPI.invoke).toHaveBeenCalledWith('sessions:list', '/workspace/app', { includeArchived: false });

    const firstItem = screen.getByTestId('agent-elements-session-quick-open-item-0');
    expect(firstItem).toHaveClass('session-quick-open-item', 'agent-elements-session-quick-open-item', 'selected');
    expect(firstItem).toHaveAttribute('data-agent-elements-shell', 'session-quick-open-result');
    expect(firstItem).toHaveAttribute('data-selected', 'true');
    expect(firstItem.className).not.toContain('border-l-[#007aff]');
    expect(within(firstItem).getByTestId('agent-elements-session-quick-open-item-name-0')).toHaveTextContent('Build UI shell');
    expect(within(firstItem).getByText('In Workstream')).toHaveClass('agent-elements-status-pill');
    expect(within(firstItem).getByText('Worktree')).toHaveClass('agent-elements-status-pill');
    expect(screen.getByTestId('agent-elements-session-quick-open-footer')).toHaveAttribute(
      'data-agent-elements-shell',
      'session-quick-open-footer'
    );

    fireEvent.change(input, { target: { value: 'build' } });
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(onSwitchToPrompts).toHaveBeenCalledWith('build');

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSessionSelect).toHaveBeenCalledWith('session-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('preserves @file typeahead selection and file-filtered session results inside the Agent Elements shell', async () => {
    mockState.fileOptions.push({
      id: 'file-1',
      label: 'src/App.tsx',
      description: 'src/App.tsx',
      icon: 'description',
      data: { path: 'src/App.tsx' },
    });

    render(
      <SessionQuickOpen
        isOpen={true}
        onClose={vi.fn()}
        workspacePath="/workspace/app"
        onSessionSelect={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Search sessions... (@ to search by file edited)'), {
      target: { value: '@app' },
    });

    const typeahead = await screen.findByTestId('agent-elements-session-quick-open-typeahead');
    expect(typeahead).toHaveAttribute('data-agent-elements-shell', 'session-quick-open-typeahead');
    const option = screen.getByTestId('agent-elements-session-quick-open-typeahead-item-0');
    expect(option).toHaveClass('agent-elements-session-quick-open-typeahead-item');
    expect(option).toHaveAttribute('data-selected', 'true');

    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(
        'session-files:get-sessions-by-file',
        '/workspace/app',
        '/workspace/app/src/App.tsx',
        'edited'
      );
    });

    expect(await screen.findByText('Refactor sync flow')).toBeInTheDocument();
    expect(screen.queryByText('Build UI shell')).not.toBeInTheDocument();

    const fileChip = screen.getByTestId('agent-elements-session-quick-open-file-chip');
    expect(fileChip).toHaveTextContent('src/App.tsx');
    expect(screen.getByTestId('agent-elements-session-quick-open-file-count')).toHaveTextContent(
      '1 session edited this file'
    );
  });
});
