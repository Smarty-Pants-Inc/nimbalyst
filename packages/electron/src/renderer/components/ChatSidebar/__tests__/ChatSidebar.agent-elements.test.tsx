// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSidebar } from '../ChatSidebar';

const mocks = vi.hoisted(() => {
  const refreshSessions = vi.fn();
  const initSessionList = vi.fn();
  const electronInvoke = vi.fn();
  const onSwitchToAgentMode = vi.fn();
  const onWidthChange = vi.fn();
  const sessions = [
    {
      id: 'chat-session-1',
      createdAt: '2026-05-24T12:00:00Z',
      title: 'Planning chat',
      messageCount: 3,
      provider: 'claude-code',
      model: 'claude-code/sonnet',
    },
  ];

  return {
    refreshSessions,
    initSessionList,
    electronInvoke,
    onSwitchToAgentMode,
    onWidthChange,
    sessions,
  };
});

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: { key?: string }) => {
    if (atom?.key === 'sessionListChatAtom') {
      return mocks.sessions;
    }
    return 'claude-code/sonnet';
  }),
  useSetAtom: vi.fn(() => mocks.refreshSessions),
}));

vi.mock('../../../store', () => ({
  sessionListChatAtom: { key: 'sessionListChatAtom' },
  refreshSessionListAtom: { key: 'refreshSessionListAtom' },
  initSessionList: mocks.initSessionList,
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  defaultAgentModelAtom: { key: 'defaultAgentModelAtom' },
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size }: { icon: string; size?: number }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size }),
  };
});

vi.mock('@nimbalyst/runtime/ai/server/types', () => ({
  ModelIdentifier: {
    tryParse: vi.fn(() => ({ provider: 'claude-code' })),
  },
}));

vi.mock('../../AIChat/SessionDropdown', () => ({
  SessionDropdown: ({
    currentSessionId,
    onNewSession,
  }: {
    currentSessionId: string;
    onNewSession: () => void;
  }) => (
    <div data-testid="session-dropdown" data-current-session-id={currentSessionId}>
      <button type="button" onClick={onNewSession}>
        Dropdown New
      </button>
    </div>
  ),
}));

vi.mock('../../UnifiedAI/SessionTranscript', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');

  return {
    SessionTranscript: ReactModule.forwardRef(
      (
        {
          sessionId,
          workspacePath,
          mode,
          hideSidebar,
        }: {
          sessionId: string;
          workspacePath: string;
          mode: string;
          hideSidebar: boolean;
        },
        ref
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          focusInput: vi.fn(),
          loadSession: vi.fn(),
        }));

        return (
          <div
            data-testid="session-transcript"
            data-session-id={sessionId}
            data-workspace-path={workspacePath}
            data-mode={mode}
            data-hide-sidebar={String(hideSidebar)}
          />
        );
      }
    ),
  };
});

const sourcePath = resolve(__dirname, '../ChatSidebar.tsx');

describe('ChatSidebar Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.electronInvoke.mockImplementation((channel: string) => {
      if (channel === 'sessions:list') {
        return Promise.resolve({ success: true, sessions: mocks.sessions });
      }
      if (channel === 'sessions:create') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: true });
    });
    (window as any).electronAPI = { invoke: mocks.electronInvoke };
  });

  it('renders an Agent Elements chat sidebar while preserving loaded session wiring', async () => {
    render(
      <ChatSidebar
        workspacePath="/workspace/project"
        width={420}
        onWidthChange={mocks.onWidthChange}
        onSwitchToAgentMode={mocks.onSwitchToAgentMode}
      />
    );

    const panel = await screen.findByTestId('chat-sidebar-panel');
    expect(panel).toHaveClass('chat-sidebar', 'agent-elements-chat-sidebar', 'agent-elements-tool-card');
    expect(panel).toHaveAttribute('data-component', 'ChatSidebar');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'chat-sidebar');
    expect(panel).toHaveStyle({ width: '420px' });

    expect(mocks.initSessionList).toHaveBeenCalledWith('/workspace/project');
    await waitFor(() => {
      expect(mocks.electronInvoke).toHaveBeenCalledWith('sessions:list', '/workspace/project', {
        includeArchived: false,
      });
    });

    expect(screen.getByTestId('session-dropdown')).toHaveAttribute('data-current-session-id', 'chat-session-1');
    expect(screen.getByTestId('session-transcript')).toHaveAttribute('data-mode', 'chat');
    expect(screen.getByTestId('session-transcript')).toHaveAttribute('data-hide-sidebar', 'true');

    const header = within(panel).getByTestId('agent-elements-chat-sidebar-header');
    expect(header).toHaveClass('agent-elements-chat-sidebar-header');

    const openInAgentMode = within(panel).getByRole('button', { name: /Open in agent mode/ });
    fireEvent.click(openInAgentMode);
    expect(mocks.onSwitchToAgentMode).toHaveBeenCalledWith('chat-session-1');
  });

  it('preserves new-session creation through the Agent Elements action button', async () => {
    render(<ChatSidebar workspacePath="/workspace/project" />);

    const panel = await screen.findByTestId('chat-sidebar-panel');
    fireEvent.click(within(panel).getByRole('button', { name: /Start new conversation/ }));

    await waitFor(() => {
      expect(mocks.electronInvoke).toHaveBeenCalledWith(
        'sessions:create',
        expect.objectContaining({
          session: expect.objectContaining({
            provider: 'claude-code',
            model: 'claude-code/sonnet',
            title: 'Chat',
          }),
          workspaceId: '/workspace/project',
        })
      );
    });
    expect(mocks.refreshSessions).toHaveBeenCalled();
  });

  it('keeps the source on Agent Elements-compatible sidebar primitives', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-chat-sidebar');
    expect(source).toContain('data-agent-elements-shell="chat-sidebar"');
    expect(source).toContain('data-agent-elements-shell="chat-sidebar-new-session"');
    expect(source).not.toContain('active:scale');
    expect(source).not.toContain('text-white');
    expect(source).not.toContain('rounded-md');
    expect(source).not.toContain('bg-nim-primary');
  });
});
