// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentSessionPanel, type AgentSessionPanelRef } from '../AgentSessionPanel';

const mockState = vi.hoisted(() => ({
  transcriptFocusInput: vi.fn(),
  transcriptProps: [] as any[],
}));

vi.mock('../../UnifiedAI/SessionTranscript', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');

  return {
    SessionTranscript: ReactModule.forwardRef(
      (
        props: {
          sessionId: string;
          workspacePath: string;
          mode: string;
          hideSidebar: boolean;
          collapseTranscript: boolean;
          onFileClick?: (filePath: string) => void;
          onClearAgentSession?: () => void;
          onCreateWorktreeSession?: (worktreeId: string) => Promise<string | null>;
          getDocumentContext?: () => Promise<unknown>;
        },
        ref,
      ) => {
        mockState.transcriptProps.push(props);
        ReactModule.useImperativeHandle(ref, () => ({
          focusInput: mockState.transcriptFocusInput,
        }));

        return (
          <div
            data-testid="mock-session-transcript"
            data-session-id={props.sessionId}
            data-workspace-path={props.workspacePath}
            data-mode={props.mode}
            data-hide-sidebar={String(props.hideSidebar)}
            data-collapse-transcript={String(props.collapseTranscript)}
          >
            <button
              type="button"
              data-testid="mock-file-click"
              onClick={() => props.onFileClick?.('/workspace/src/App.tsx')}
            >
              Open file
            </button>
          </div>
        );
      },
    ),
  };
});

const sourcePath = resolve(__dirname, '../AgentSessionPanel.tsx');

function renderPanel(overrides: Partial<React.ComponentProps<typeof AgentSessionPanel>> = {}) {
  const ref = React.createRef<AgentSessionPanelRef>();
  const onFileClick = vi.fn();
  const onClearAgentSession = vi.fn();
  const onCreateWorktreeSession = vi.fn().mockResolvedValue('child-session');
  const getDocumentContext = vi.fn().mockResolvedValue({ currentFile: '/workspace/src/App.tsx' });
  const result = render(
    <AgentSessionPanel
      ref={ref}
      sessionId="session-1"
      workspacePath="/workspace"
      onFileClick={onFileClick}
      onClearAgentSession={onClearAgentSession}
      onCreateWorktreeSession={onCreateWorktreeSession}
      getDocumentContext={getDocumentContext}
      {...overrides}
    />,
  );

  return {
    ref,
    onFileClick,
    onClearAgentSession,
    onCreateWorktreeSession,
    getDocumentContext,
    ...result,
  };
}

describe('AgentSessionPanel Agent Elements shell', () => {
  beforeEach(() => {
    mockState.transcriptFocusInput.mockClear();
    mockState.transcriptProps.length = 0;
  });

  it('uses the existing root as the Agent Elements shell while preserving transcript pass-throughs', () => {
    const { container, onFileClick, onClearAgentSession, onCreateWorktreeSession, getDocumentContext } = renderPanel();

    const root = screen.getByTestId('agent-elements-agent-session-panel');
    expect(container.firstElementChild).toBe(root);
    expect(root).toHaveClass(
      'agent-session-panel',
      'agent-elements-agent-session-panel',
      'h-full',
      'min-h-0',
    );
    expect(root).toHaveAttribute('data-component', 'AgentSessionPanel');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'agent-session-panel');
    expect(root).toHaveAttribute('data-session-id', 'session-1');
    expect(root).toHaveAttribute('data-collapse-transcript', 'false');

    expect(screen.getByTestId('mock-session-transcript')).toHaveAttribute('data-mode', 'agent');
    expect(screen.getByTestId('mock-session-transcript')).toHaveAttribute('data-hide-sidebar', 'true');
    expect(screen.getByTestId('mock-session-transcript')).toHaveAttribute('data-collapse-transcript', 'false');
    expect(mockState.transcriptProps[0]).toMatchObject({
      sessionId: 'session-1',
      workspacePath: '/workspace',
      mode: 'agent',
      hideSidebar: true,
      collapseTranscript: false,
      onClearAgentSession,
      onCreateWorktreeSession,
      getDocumentContext,
    });

    fireEvent.click(screen.getByTestId('mock-file-click'));
    expect(onFileClick).toHaveBeenCalledWith('/workspace/src/App.tsx');
  });

  it('preserves collapsed transcript sizing and focus forwarding', () => {
    const { ref } = renderPanel({ collapseTranscript: true });

    const root = screen.getByTestId('agent-elements-agent-session-panel');
    expect(root).toHaveClass('agent-session-panel', 'agent-elements-agent-session-panel');
    expect(root).not.toHaveClass('h-full');
    expect(root).not.toHaveClass('min-h-0');
    expect(root).toHaveAttribute('data-collapse-transcript', 'true');
    expect(screen.getByTestId('mock-session-transcript')).toHaveAttribute('data-collapse-transcript', 'true');

    ref.current?.focusInput();
    expect(mockState.transcriptFocusInput).toHaveBeenCalledTimes(1);
  });

  it('keeps AgentSessionPanel source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-agent-session-panel');
    expect(source).toContain('data-agent-elements-shell="agent-session-panel"');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
