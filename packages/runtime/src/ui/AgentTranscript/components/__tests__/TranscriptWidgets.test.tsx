/**
 * Transcript UI Widget Tests
 *
 * Tests the rendering contract of transcript widgets:
 * - MessageSegment (user, assistant, system, error, tool calls)
 * - BashWidget (command display, output, status indicators)
 * - EditToolResultCard (file path, edit count, status)
 * - ToolPermissionWidget (pending, granted, denied states)
 * - AskUserQuestionWidget (questions, options, completed states)
 * - GitCommitConfirmationWidget (pending, committed, cancelled states)
 * - ExitPlanModeWidget (pending, approved, denied states)
 * - ContextLimitWidget (error display, compact button)
 * - FileChangeWidget (collapsed/expanded, file list)
 * - InteractivePromptWidget (permission and question prompt types)
 * - UpdateSessionMetaWidget (name/phase/tags transitions, fallback states)
 * - TrackerToolWidget (structured tracker results, legacy tag normalization)
 * - ToolWidgetErrorBoundary (custom-widget crash fallback, retry/copy/details)
 */

import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as rtl from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import type { TranscriptViewMessage } from '../../../../ai/server/transcript/TranscriptProjector';
import type { CustomToolWidgetProps } from '../CustomToolWidgets/index';
import type { InteractiveWidgetHost } from '../CustomToolWidgets/InteractiveWidgetHost';

const { render, screen, fireEvent, waitFor } = rtl;
const sourceDir = dirname(fileURLToPath(import.meta.url));
const fileChangeWidgetSourcePath = resolve(
  sourceDir,
  '../CustomToolWidgets/FileChangeWidget.tsx'
);
const updateSessionMetaWidgetSourcePath = resolve(
  sourceDir,
  '../CustomToolWidgets/UpdateSessionMetaWidget.tsx'
);
const superProgressSnapshotWidgetSourcePath = resolve(
  sourceDir,
  '../CustomToolWidgets/SuperProgressSnapshotWidget.tsx'
);
const superLoopProgressWidgetSourcePath = resolve(
  sourceDir,
  '../CustomToolWidgets/SuperLoopProgressWidget.tsx'
);
const trackerToolWidgetSourcePath = resolve(
  sourceDir,
  '../CustomToolWidgets/TrackerToolWidget.tsx'
);
const toolWidgetErrorBoundarySourcePath = resolve(
  sourceDir,
  '../CustomToolWidgets/ToolWidgetErrorBoundary.tsx'
);
const editorScreenshotWidgetSourcePath = resolve(
  sourceDir,
  '../CustomToolWidgets/EditorScreenshotWidget.tsx'
);
const interactivePromptWidgetSourcePath = resolve(
  sourceDir,
  '../InteractivePromptWidget.tsx'
);
const toolPermissionWidgetSourcePath = resolve(
  sourceDir,
  '../CustomToolWidgets/ToolPermissionWidget.tsx'
);
const gitCommitConfirmationWidgetSourcePath = resolve(
  sourceDir,
  '../CustomToolWidgets/GitCommitConfirmationWidget.tsx'
);
const toolCallChangesSourcePath = resolve(
  sourceDir,
  '../ToolCallChanges.tsx'
);

// Mock clipboard
vi.mock('../../../../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

// Mock unwrapShellCommand (pass-through)
vi.mock('../../utils/unwrapShellCommand', () => ({
  unwrapShellCommand: (cmd: string) => cmd,
}));

// Mock posthog-js/react
vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}));

// ============================================================================
// Type Helpers (mirrors internal types from widgets for test clarity)
// ============================================================================

interface StructuredSessionMetaResult {
  summary: string;
  before: { name: string | null; tags: string[]; phase: string | null };
  after: { name: string | null; tags: string[]; phase: string | null };
}

interface SuperProgressSnapshotResult {
  timing: 'iteration-start' | 'iteration-end';
  iterationNumber: number;
  superLoopId: string;
  progress: {
    currentIteration: number;
    phase: string;
    status: string;
    completionSignal: boolean;
    learnings: Array<{ iteration: number; summary: string; filesChanged: string[] }>;
    blockers: string[];
    userFeedback?: string;
  };
  capturedAt: number;
}

interface SuperLoopProgressUpdateArgs {
  phase: 'planning' | 'building';
  status: 'running' | 'completed' | 'blocked';
  completionSignal: boolean;
  learnings: Array<{ iteration: number; summary: string; filesChanged: string[] }>;
  blockers: string[];
  currentIteration: number;
}

// ============================================================================
// Test Helpers
// ============================================================================

function createStore_() {
  return createStore();
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const store = createStore_();
  return <JotaiProvider store={store}>{children}</JotaiProvider>;
}

let nextTestId = 1;

function makeMessage(overrides: Partial<TranscriptViewMessage> = {}): TranscriptViewMessage {
  return {
    id: nextTestId++,
    sequence: nextTestId,
    createdAt: new Date(),
    type: 'assistant_message',
    subagentId: null,
    ...overrides,
  };
}

function makeToolMessage(
  toolName: string,
  args: Record<string, unknown> = {},
  result?: unknown,
  overrides: Partial<TranscriptViewMessage> = {}
): TranscriptViewMessage {
  return makeMessage({
    type: 'tool_call',
    toolCall: {
      toolName,
      toolDisplayName: toolName,
      status: result !== undefined ? 'completed' : 'running',
      description: null,
      arguments: args,
      targetFilePath: null,
      mcpServer: null,
      mcpTool: null,
      providerToolCallId: `tool-${Date.now()}`,
      progress: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result: result != null ? (typeof result === 'string' ? result : JSON.stringify(result)) : undefined,
    },
    ...overrides,
  });
}

// ============================================================================
// MessageSegment Tests
// ============================================================================

describe('MessageSegment', () => {
  let MessageSegment: React.FC<any>;

  beforeEach(async () => {
    const mod = await import('../MessageSegment');
    MessageSegment = mod.MessageSegment;
  });

  it('renders user message text', () => {
    const message = makeMessage({ type: 'user_message', text: 'Hello world' });
    render(
      <MessageSegment
        message={message}
        isUser={true}
        showToolCalls={false}
        showThinking={false}
        expandedTools={new Set()}
        onToggleToolExpand={() => {}}
      />
    );
    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('strips NIMBALYST_SYSTEM_MESSAGE from user messages', () => {
    const message = makeMessage({
      type: 'user_message',
      text: 'User text\n<NIMBALYST_SYSTEM_MESSAGE>hidden</NIMBALYST_SYSTEM_MESSAGE>',
    });
    render(
      <MessageSegment
        message={message}
        isUser={true}
        showToolCalls={false}
        showThinking={false}
        expandedTools={new Set()}
        onToggleToolExpand={() => {}}
      />
    );
    expect(screen.getByText('User text')).toBeDefined();
    expect(screen.queryByText('hidden')).toBeNull();
  });

  it('renders error messages with error styling', () => {
    const message = makeMessage({
      type: 'assistant_message',
      text: 'Something went wrong',
      isError: true,
    });
    const { container } = render(
      <MessageSegment
        message={message}
        isUser={false}
        showToolCalls={false}
        showThinking={false}
        expandedTools={new Set()}
        onToggleToolExpand={() => {}}
      />
    );
    expect(screen.getByText('Something went wrong')).toBeDefined();
    // Should have error styling (red background)
    const errorDiv = container.querySelector('.text-nim-error');
    expect(errorDiv).not.toBeNull();
  });

  it('renders the Codex auth required CTA when isCodexAuthRequired is set', () => {
    const message = makeMessage({
      type: 'system_message',
      text: 'Error: Sign in to OpenAI Codex to continue.',
      isError: true,
      isCodexAuthRequired: true,
    });
    const { container } = render(
      <MessageSegment
        message={message}
        isUser={false}
        showToolCalls={false}
        showThinking={false}
        expandedTools={new Set()}
        onToggleToolExpand={() => {}}
        shouldShowLoginWidget={true}
      />
    );
    const widget = container.querySelector('[data-testid="codex-auth-required-widget"]');
    expect(widget).not.toBeNull();
    expect(widget?.textContent ?? '').toMatch(/Sign in to OpenAI Codex to continue/i);
    const signInBtn = container.querySelector('[data-testid="codex-auth-required-sign-in"]') as HTMLButtonElement | null;
    expect(signInBtn).not.toBeNull();

    // Generic error styling MUST NOT appear when the CTA takes over.
    expect(container.querySelector('.text-nim-error')).toBeNull();

    const events: Array<{ anchor?: string }> = [];
    const listener = (e: Event) => {
      events.push((e as CustomEvent<{ anchor?: string }>).detail);
    };
    window.addEventListener('nimbalyst:open-codex-auth-settings', listener);
    try {
      fireEvent.click(signInBtn!);
    } finally {
      window.removeEventListener('nimbalyst:open-codex-auth-settings', listener);
    }
    expect(events).toEqual([{ anchor: 'codex-auth-section' }]);
  });

  it('suppresses the Codex auth CTA when shouldShowLoginWidget is false', () => {
    const message = makeMessage({
      type: 'system_message',
      text: 'Error: Sign in to OpenAI Codex to continue.',
      isError: true,
      isCodexAuthRequired: true,
    });
    const { container } = render(
      <MessageSegment
        message={message}
        isUser={false}
        showToolCalls={false}
        showThinking={false}
        expandedTools={new Set()}
        onToggleToolExpand={() => {}}
        shouldShowLoginWidget={false}
      />
    );
    expect(container.querySelector('[data-testid="codex-auth-required-widget"]')).toBeNull();
  });

  it('renders context limit widget for context limit errors', () => {
    const message = makeMessage({
      type: 'assistant_message',
      text: 'Prompt is too long for this model',
      isError: true,
    });
    const { container } = render(
      <MessageSegment
        message={message}
        isUser={false}
        showToolCalls={false}
        showThinking={false}
        expandedTools={new Set()}
        onToggleToolExpand={() => {}}
      />
    );
    expect(container.querySelector('.context-limit-widget')).not.toBeNull();
  });

  it('renders tool call card with expand/collapse', () => {
    const toolId = 'test-tool-1';
    const message = makeToolMessage(
      'Read',
      { file_path: '/test.ts' },
      'file contents here',
      { toolCall: { toolName: 'Read', toolDisplayName: 'Read', status: 'completed', description: null, arguments: { file_path: '/test.ts' }, targetFilePath: null, mcpServer: null, mcpTool: null, providerToolCallId: toolId, progress: [], result: 'file contents here' } }
    );

    // Initially collapsed
    const { rerender } = render(
      <MessageSegment
        message={message}
        isUser={false}
        showToolCalls={true}
        showThinking={false}
        expandedTools={new Set()}
        onToggleToolExpand={() => {}}
      />
    );
    // Tool name should be visible
    expect(screen.getByText('Read')).toBeDefined();
    // Status should show "Succeeded"
    expect(screen.getByText('Succeeded')).toBeDefined();
    // Result should not be visible when collapsed
    expect(screen.queryByText('file contents here')).toBeNull();

    // Expand it
    rerender(
      <MessageSegment
        message={message}
        isUser={false}
        showToolCalls={true}
        showThinking={false}
        expandedTools={new Set([toolId])}
        onToggleToolExpand={() => {}}
      />
    );
    // Result should now be visible
    expect(screen.getByText('file contents here')).toBeDefined();
  });

  it('shows failed status for error tool calls', () => {
    const message = makeToolMessage(
      'Write',
      {},
      JSON.stringify({ success: false, error: 'Permission denied' }),
      { isError: true }
    );
    render(
      <MessageSegment
        message={message}
        isUser={false}
        showToolCalls={true}
        showThinking={false}
        expandedTools={new Set()}
        onToggleToolExpand={() => {}}
      />
    );
    expect(screen.getByText('Failed')).toBeDefined();
  });

  it('renders structured exit codes inside expanded tool results', () => {
    const toolId = 'execute-pass';
    const message = makeToolMessage(
      'execute',
      { command: 'npm test' },
      JSON.stringify({ output: 'Test Files 1 passed', exit_code: 0 }),
      {
        toolCall: {
          toolName: 'execute',
          toolDisplayName: 'execute',
          status: 'completed',
          description: null,
          arguments: { command: 'npm test' },
          targetFilePath: null,
          mcpServer: null,
          mcpTool: null,
          providerToolCallId: toolId,
          progress: [],
          result: JSON.stringify({ output: 'Test Files 1 passed', exit_code: 0 }),
          exitCode: 0,
        },
      }
    );

    render(
      <MessageSegment
        message={message}
        isUser={false}
        showToolCalls={true}
        showThinking={false}
        expandedTools={new Set([toolId])}
        onToggleToolExpand={() => {}}
      />
    );

    expect(screen.getByText('Exit code: 0')).toBeDefined();
  });

  it('renders attachments for user messages', () => {
    const message = makeMessage({
      type: 'user_message',
      text: 'Check this image',
      attachments: [
        {
          id: 'att-1',
          filename: 'screenshot.png',
          filepath: '/tmp/screenshot.png',
          mimeType: 'image/png',
          size: 1024,
          type: 'image',
        },
      ],
    });
    render(
      <MessageSegment
        message={message}
        isUser={true}
        showToolCalls={false}
        showThinking={false}
        expandedTools={new Set()}
        onToggleToolExpand={() => {}}
      />
    );
    expect(screen.getByText('screenshot.png')).toBeDefined();
    expect(screen.getByText('1.0 KB')).toBeDefined();
  });
});

// ============================================================================
// BashWidget Tests
// ============================================================================

describe('BashWidget', () => {
  let BashWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/BashWidget');
    BashWidget = mod.BashWidget;
  });

  it('renders collapsed view with command and success indicator', () => {
    const message = makeToolMessage('Bash', { command: 'git status', description: 'Check git status' }, 'On branch main');
    const { container } = render(
      <Wrapper>
        <BashWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="s1"
        />
      </Wrapper>
    );
    expect(screen.getByText('Check git status')).toBeDefined();
    // Should show the command
    expect(screen.getByText('git status')).toBeDefined();
    // Should be a button (clickable to expand)
    expect(container.querySelector('button.bash-widget')).not.toBeNull();
  });

  it('renders running state with spinner', () => {
    const message = makeToolMessage('Bash', { command: 'npm install' }, undefined);
    const { container } = render(
      <Wrapper>
        <BashWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="s1"
        />
      </Wrapper>
    );
    // Should show spinner (animate-spin class)
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('renders expanded view with command, output, and copy button', () => {
    const message = makeToolMessage(
      'Bash',
      { command: 'echo hello', description: 'Say hello' },
      'hello'
    );
    const { container } = render(
      <Wrapper>
        <BashWidget
          message={message}
          isExpanded={true}
          onToggle={() => {}}
          sessionId="s1"
        />
      </Wrapper>
    );
    // Shows "Terminal" label in expanded header
    expect(screen.getByText('Terminal')).toBeDefined();
    // Shows the $ prompt with command
    expect(screen.getByText('echo hello')).toBeDefined();
    // Shows output
    expect(screen.getByText('hello')).toBeDefined();
    // Copy button present
    expect(container.querySelector('[aria-label="Copy command"]')).not.toBeNull();
  });

  it('marks the expanded Bash widget with the Agent Elements shell while preserving terminal behavior', () => {
    const message = makeToolMessage(
      'Bash',
      { command: 'npm test', description: 'Run tests' },
      'tests passed'
    );
    const { container } = render(
      <Wrapper>
        <BashWidget
          message={message}
          isExpanded={true}
          onToggle={() => {}}
          sessionId="s1"
        />
      </Wrapper>
    );

    const shell = screen.getByTestId('rich-transcript-agent-elements-bash-shell');
    expect(shell.getAttribute('data-component')).toBe('RichTranscriptAgentElementsBashShell');
    expect(shell.getAttribute('data-agent-elements-shell')).toBe('tool-card');
    expect(shell.classList.contains('bash-widget')).toBe(true);
    expect(shell.classList.contains('agent-elements-bash-tool-card')).toBe(true);
    expect(shell.classList.contains('agent-elements-tool-card')).toBe(false);
    expect(shell.getAttribute('data-bash-state')).toBe('expanded');
    expect(shell.getAttribute('data-bash-status')).toBe('success');
    expect(container.querySelector('.agent-elements-bash-tool-title-row')).not.toBeNull();
    expect(screen.getByText('Terminal')).toBeDefined();
    expect(screen.getByText('npm test')).toBeDefined();
    expect(screen.getByText('tests passed')).toBeDefined();
    expect(container.querySelector('[aria-label="Copy command"]')).not.toBeNull();
  });

  it('renders error state with error styling', () => {
    const message = makeToolMessage(
      'Bash',
      { command: 'false' },
      { exit_code: 1, output: 'command failed' },
      { isError: true }
    );
    const { container } = render(
      <Wrapper>
        <BashWidget
          message={message}
          isExpanded={true}
          onToggle={() => {}}
          sessionId="s1"
        />
      </Wrapper>
    );
    // Error output should have error text styling
    const errorPre = container.querySelector('.text-nim-error');
    expect(errorPre).not.toBeNull();
  });

  it('shows "show more" button for long output', () => {
    const longOutput = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n');
    const message = makeToolMessage('Bash', { command: 'cat file.txt' }, longOutput);
    render(
      <Wrapper>
        <BashWidget
          message={message}
          isExpanded={true}
          onToggle={() => {}}
          sessionId="s1"
        />
      </Wrapper>
    );
    // Should show "Show N more lines" button
    expect(screen.getByText(/Show \d+ more lines/)).toBeDefined();
  });
});

// ============================================================================
// EditToolResultCard Tests
// ============================================================================

describe('EditToolResultCard', () => {
  let EditToolResultCard: React.FC<any>;

  beforeEach(async () => {
    const mod = await import('../EditToolResultCard');
    EditToolResultCard = mod.EditToolResultCard;
  });

  it('renders file path and edit count for single edit', () => {
    const message = makeToolMessage('Edit', {
      file_path: '/workspace/src/app.ts',
    });
    const edits = [{ old_string: 'foo', new_string: 'bar' }];
    render(
      <EditToolResultCard
        toolMessage={message}
        edits={edits}
        workspacePath="/workspace"
      />
    );
    expect(screen.getByText('1 edit')).toBeDefined();
    // File path should be shown (project-relative) - use getAllByText since path may appear in multiple places
    const appTsElements = screen.getAllByText(/app\.ts/);
    expect(appTsElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Applied')).toBeDefined();
  });

  it('renders "Created" status for new file edits', () => {
    const message = makeToolMessage('Write', {
      file_path: '/workspace/new-file.ts',
    });
    const edits = [{ content: 'export const x = 1;\n' }];
    render(
      <EditToolResultCard
        toolMessage={message}
        edits={edits}
        workspacePath="/workspace"
      />
    );
    expect(screen.getByText('Created')).toBeDefined();
  });

  it('renders "Failed" status for error', () => {
    const message = makeToolMessage('Edit', {
      file_path: '/workspace/src/app.ts',
    }, undefined, { isError: true });
    const edits = [{ old_string: 'foo', new_string: 'bar' }];
    render(
      <EditToolResultCard
        toolMessage={message}
        edits={edits}
        workspacePath="/workspace"
      />
    );
    expect(screen.getByText('Failed')).toBeDefined();
  });

  it('returns null when no edits', () => {
    const message = makeToolMessage('Edit', {});
    const { container } = render(
      <EditToolResultCard
        toolMessage={message}
        edits={[]}
        workspacePath="/workspace"
      />
    );
    expect(container.innerHTML).toBe('');
  });
});

// ============================================================================
// ToolPermissionWidget Tests
// ============================================================================

describe('ToolPermissionWidget', () => {
  let ToolPermissionWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/ToolPermissionWidget');
    ToolPermissionWidget = mod.ToolPermissionWidget;
  });

  it('renders pending state with action buttons and reconnecting note when host is null', () => {
    // Before #276: the widget rendered a button-less "Waiting..." shell when
    // the interactiveWidgetHost atom captured a null host, leaving the user
    // stuck with no way to approve or deny. After: the full interactive
    // action row renders, plus a visible "Reconnecting" note so the user
    // knows what's happening. Click handlers fall back to an imperative
    // host lookup at click time, so the buttons stay actionable.
    const message = makeToolMessage('ToolPermission', {
      requestId: 'req-1',
      toolName: 'Bash',
      rawCommand: 'git push',
      pattern: 'Bash(git push:*)',
    });
    render(
      <Wrapper>
        <ToolPermissionWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="no-host-session"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('tool-permission-widget');
    expect(widget).toBeDefined();
    expect(widget.dataset.state).toBe('pending');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsToolPermission');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('approval-card');
    expect(widget.getAttribute('data-approval-state')).toBe('pending');
    expect(widget.classList.contains('agent-elements-tool-card')).toBe(true);
    expect(screen.getByTestId('tool-permission-status').textContent).toContain('awaiting approval');
    expect(screen.getByTestId('tool-permission-command').classList.contains('select-text')).toBe(true);
    expect(screen.getByTestId('tool-permission-host-reconnecting')).toBeDefined();
    expect(screen.getByTestId('tool-permission-deny')).toBeDefined();
    expect(screen.getByTestId('tool-permission-allow-once')).toBeDefined();
  });

  it('renders granted state from tool result', () => {
    const message = makeToolMessage(
      'ToolPermission',
      {
        requestId: 'req-2',
        toolName: 'Bash',
        rawCommand: 'git status',
        pattern: 'Bash(git status:*)',
      },
      JSON.stringify({ decision: 'allow', scope: 'session' })
    );
    render(
      <Wrapper>
        <ToolPermissionWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="completed-session"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('tool-permission-widget');
    expect(widget.dataset.state).toBe('granted');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsToolPermission');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('approval-card');
    expect(widget.getAttribute('data-approval-state')).toBe('granted');
    expect(screen.getByTestId('tool-permission-status').textContent).toContain('granted');
    expect(screen.getByTestId('tool-permission-command').classList.contains('select-text')).toBe(true);
    expect(screen.getByText('Permission Granted')).toBeDefined();
    expect(screen.getByText('This Session')).toBeDefined();
  });

  it('renders denied state from tool result', () => {
    const message = makeToolMessage(
      'ToolPermission',
      {
        requestId: 'req-3',
        toolName: 'Bash',
        rawCommand: 'rm -rf /',
        pattern: 'Bash',
        isDestructive: true,
      },
      JSON.stringify({ decision: 'deny', scope: 'once' })
    );
    render(
      <Wrapper>
        <ToolPermissionWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="denied-session"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('tool-permission-widget');
    expect(widget.dataset.state).toBe('denied');
    expect(screen.getByText('Permission Denied')).toBeDefined();
  });

  it('shows command in the code block', () => {
    const message = makeToolMessage(
      'ToolPermission',
      {
        requestId: 'req-4',
        toolName: 'Bash',
        rawCommand: 'npm test',
        pattern: 'Bash(npm:*)',
      },
      JSON.stringify({ decision: 'allow', scope: 'once' })
    );
    render(
      <Wrapper>
        <ToolPermissionWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="cmd-session"
        />
      </Wrapper>
    );
    expect(screen.getByText('npm test')).toBeDefined();
  });

  it('shows outside-workspace paths on pending permission requests', () => {
    const outsidePath = '/tmp/outside-worktree/probe.txt';
    const message = makeToolMessage('ToolPermission', {
      requestId: 'req-outside-path',
      toolName: 'write_file',
      rawCommand: JSON.stringify({ file_path: outsidePath }),
      pattern: 'Write',
      isDestructive: true,
      warnings: ['Path is outside the active workspace/worktree'],
      outsidePaths: [outsidePath],
    });
    render(
      <Wrapper>
        <ToolPermissionWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="outside-path-session"
        />
      </Wrapper>
    );
    expect(screen.getByTestId('tool-permission-outside-paths')).toBeDefined();
    expect(screen.getByText('Outside active workspace/worktree')).toBeDefined();
    expect(screen.getByText(outsidePath)).toBeDefined();
  });

  it('keeps ToolPermissionWidget source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(toolPermissionWidgetSourcePath, 'utf8');

    expect(source).toContain('agent-elements-permission-tool-card');
    expect(source).toContain('data-agent-elements-shell');
    expect(source).toContain('RichTranscriptAgentElementsToolPermission');
    expect(source).toContain('data-agent-elements-card-padding');
    expect(source).toContain('data-agent-elements-card-width');
    expect(source).not.toMatch(/\b(?:bg|text|border|hover:bg|hover:text|hover:border)-nim(?:-[\w-]+)?\b/);
    expect(source).not.toMatch(/var\(--nim-/);
    expect(source).not.toMatch(/text-white|rounded-md|transition-all|shadow-lg/);
  });
});

// ============================================================================
// AskUserQuestionWidget Tests
// ============================================================================

describe('AskUserQuestionWidget', () => {
  let AskUserQuestionWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/AskUserQuestionWidget');
    AskUserQuestionWidget = mod.AskUserQuestionWidget;
  });

  it('renders pending state without host', () => {
    const message = makeToolMessage('AskUserQuestion', {
      questions: [
        {
          question: 'Which framework?',
          header: 'Framework',
          options: [
            { label: 'React', description: 'Component library' },
            { label: 'Vue', description: 'Progressive framework' },
          ],
          multiSelect: false,
        },
      ],
    });
    render(
      <Wrapper>
        <AskUserQuestionWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="no-host"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('ask-user-question-widget');
    expect(widget).toBeDefined();
    expect(widget.dataset.state).toBe('pending');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsAskUserQuestion');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('question-card');
    expect(widget.getAttribute('data-question-state')).toBe('pending');
    expect(widget.classList.contains('agent-elements-tool-card')).toBe(true);
    expect(widget.classList.contains('agent-elements-question-card')).toBe(true);
    expect(screen.getByTestId('ask-user-question-status').textContent).toContain('awaiting answer');
    expect(screen.getByText('Waiting...')).toBeDefined();
  });

  it('renders completed state with answers', () => {
    const message = makeToolMessage(
      'AskUserQuestion',
      {
        questions: [
          {
            question: 'Which framework?',
            header: 'Framework',
            options: [
              { label: 'React', description: '' },
              { label: 'Vue', description: '' },
            ],
            multiSelect: false,
          },
        ],
      },
      JSON.stringify({ answers: { 'Which framework?': 'React' } })
    );
    render(
      <Wrapper>
        <AskUserQuestionWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="answered"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('ask-user-question-widget');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsAskUserQuestion');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('question-card');
    expect(widget.getAttribute('data-question-state')).toBe('answered');
    expect(screen.getByTestId('ask-user-question-status').textContent).toContain('answered');
    expect(screen.getByText('Questions Answered')).toBeDefined();
    expect(screen.getByText('Submitted')).toBeDefined();
  });

  it('renders cancelled state', () => {
    const message = makeToolMessage(
      'AskUserQuestion',
      {
        questions: [
          {
            question: 'Which framework?',
            header: 'Framework',
            options: [{ label: 'React', description: '' }],
            multiSelect: false,
          },
        ],
      },
      JSON.stringify({ cancelled: true })
    );
    render(
      <Wrapper>
        <AskUserQuestionWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="cancelled"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('ask-user-question-widget');
    expect(widget.getAttribute('data-question-state')).toBe('cancelled');
    expect(screen.getByTestId('ask-user-question-status').textContent).toContain('cancelled');
    expect(screen.getByText('Question Cancelled')).toBeDefined();
    expect(screen.getByText('Cancelled')).toBeDefined();
  });

  it('returns null when no questions', () => {
    const message = makeToolMessage('AskUserQuestion', { questions: [] });
    const { container } = render(
      <Wrapper>
        <AskUserQuestionWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="empty"
        />
      </Wrapper>
    );
    expect(container.innerHTML).toBe('');
  });

  it('persists draft selections across unmount/remount via jotai atom', async () => {
    // Bug: switching sessions or virtual-scroll churn unmounts the widget and
    // user selections were lost. Draft state now lives in a per-toolCallId
    // jotai atom so it survives remount when the same jotai store is reused.
    const { interactiveWidgetHostAtom } = await import('../../../../store/atoms/interactiveWidgetHost');
    const { askUserQuestionDraftAtom, clearAskUserQuestionDraft } = await import(
      '../../../../store/atoms/askUserQuestionDraft'
    );

    const toolCallId = 'persist-test-tool-id';
    const message = makeToolMessage(
      'AskUserQuestion',
      {
        questions: [
          {
            question: 'Which framework?',
            header: 'Framework',
            options: [
              { label: 'React', description: 'Component library' },
              { label: 'Vue', description: 'Progressive framework' },
            ],
            multiSelect: false,
          },
        ],
      },
      undefined,
      {
        toolCall: {
          toolName: 'AskUserQuestion',
          toolDisplayName: 'AskUserQuestion',
          status: 'running',
          description: null,
          arguments: {
            questions: [
              {
                question: 'Which framework?',
                header: 'Framework',
                options: [
                  { label: 'React', description: 'Component library' },
                  { label: 'Vue', description: 'Progressive framework' },
                ],
                multiSelect: false,
              },
            ],
          },
          targetFilePath: null,
          mcpServer: null,
          mcpTool: null,
          providerToolCallId: toolCallId,
          progress: [],
          result: undefined,
        },
      }
    );

    const testStore = createStore();
    // Install a stub host so the widget renders the interactive UI (not the
    // "Waiting..." fallback shown when no host is present).
    const stubHost = {
      sessionId: 'persist-session',
      workspacePath: '/',
      worktreeId: null,
      askUserQuestionSubmit: vi.fn().mockResolvedValue(undefined),
      askUserQuestionCancel: vi.fn().mockResolvedValue(undefined),
      requestUserInputSubmit: vi.fn().mockResolvedValue(undefined),
      requestUserInputCancel: vi.fn().mockResolvedValue(undefined),
      exitPlanModeApprove: vi.fn().mockResolvedValue(undefined),
      exitPlanModeStartNewSession: vi.fn().mockResolvedValue(undefined),
      exitPlanModeDeny: vi.fn().mockResolvedValue(undefined),
      exitPlanModeCancel: vi.fn().mockResolvedValue(undefined),
      toolPermissionSubmit: vi.fn().mockResolvedValue(undefined),
      toolPermissionCancel: vi.fn().mockResolvedValue(undefined),
      autoCommitEnabled: false,
      setAutoCommitEnabled: vi.fn(),
      gitCommit: vi.fn().mockResolvedValue({ success: true }),
      gitCommitCancel: vi.fn().mockResolvedValue(undefined),
      superLoopBlockedFeedback: vi.fn().mockResolvedValue({ success: true }),
      openFile: vi.fn().mockResolvedValue(undefined),
      trackEvent: vi.fn(),
    };
    testStore.set(interactiveWidgetHostAtom('persist-session'), stubHost);

    // Ensure atom starts empty in case a previous test left state behind.
    clearAskUserQuestionDraft(toolCallId);

    const renderWidget = () =>
      render(
        <JotaiProvider store={testStore}>
          <AskUserQuestionWidget
            message={message}
            isExpanded={false}
            onToggle={() => {}}
            sessionId="persist-session"
          />
        </JotaiProvider>
      );

    // Mount 1: pick "React".
    const first = renderWidget();
    const reactOption = first.getByText('React').closest('button');
    expect(reactOption).not.toBeNull();
    expect(reactOption!.classList.contains('agent-elements-question-option')).toBe(true);
    fireEvent.click(reactOption!);
    expect(reactOption!.dataset.selected).toBe('true');

    // Atom should now hold the selection.
    const afterClick = testStore.get(askUserQuestionDraftAtom(toolCallId));
    expect(afterClick.selections['Which framework?']).toEqual(['React']);

    // Simulate session switch / virtual-scroll unmount.
    first.unmount();

    // Mount 2: selection should still be "React" without any user action.
    const second = renderWidget();
    const reactOptionAgain = second.getByText('React').closest('button');
    expect(reactOptionAgain).not.toBeNull();
    expect(reactOptionAgain!.dataset.selected).toBe('true');

    second.unmount();
    clearAskUserQuestionDraft(toolCallId);
  });

  it('keeps the Other answer shell block-like while option buttons use the Agent Elements option class', async () => {
    const { interactiveWidgetHostAtom } = await import('../../../../store/atoms/interactiveWidgetHost');

    const toolCallId = 'other-shell-test-tool-id';
    const message = makeToolMessage(
      'AskUserQuestion',
      {
        questions: [
          {
            question: 'Which framework?',
            header: 'Framework',
            options: [
              { label: 'React', description: 'Component library' },
            ],
            multiSelect: false,
          },
        ],
      },
      undefined,
      {
        toolCall: {
          toolName: 'AskUserQuestion',
          toolDisplayName: 'AskUserQuestion',
          status: 'running',
          description: null,
          arguments: {
            questions: [
              {
                question: 'Which framework?',
                header: 'Framework',
                options: [
                  { label: 'React', description: 'Component library' },
                ],
                multiSelect: false,
              },
            ],
          },
          targetFilePath: null,
          mcpServer: null,
          mcpTool: null,
          providerToolCallId: toolCallId,
          progress: [],
          result: undefined,
        },
      }
    );

    const testStore = createStore();
    testStore.set(interactiveWidgetHostAtom('other-shell-session'), {
      sessionId: 'other-shell-session',
      workspacePath: '/',
      worktreeId: null,
      askUserQuestionSubmit: vi.fn().mockResolvedValue(undefined),
      askUserQuestionCancel: vi.fn().mockResolvedValue(undefined),
      requestUserInputSubmit: vi.fn().mockResolvedValue(undefined),
      requestUserInputCancel: vi.fn().mockResolvedValue(undefined),
      exitPlanModeApprove: vi.fn().mockResolvedValue(undefined),
      exitPlanModeStartNewSession: vi.fn().mockResolvedValue(undefined),
      exitPlanModeDeny: vi.fn().mockResolvedValue(undefined),
      exitPlanModeCancel: vi.fn().mockResolvedValue(undefined),
      toolPermissionSubmit: vi.fn().mockResolvedValue(undefined),
      toolPermissionCancel: vi.fn().mockResolvedValue(undefined),
      autoCommitEnabled: false,
      setAutoCommitEnabled: vi.fn(),
      gitCommit: vi.fn().mockResolvedValue({ success: true }),
      gitCommitCancel: vi.fn().mockResolvedValue(undefined),
      superLoopBlockedFeedback: vi.fn().mockResolvedValue({ success: true }),
      openFile: vi.fn().mockResolvedValue(undefined),
      trackEvent: vi.fn(),
    });

    render(
      <JotaiProvider store={testStore}>
        <AskUserQuestionWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="other-shell-session"
        />
      </JotaiProvider>
    );

    const regularOption = screen.getByText('React').closest('button');
    expect(regularOption).not.toBeNull();
    expect(regularOption!.classList.contains('agent-elements-question-option')).toBe(true);

    const otherShell = screen.getByTestId('ask-user-question-other');
    expect(otherShell.classList.contains('agent-elements-question-other-shell')).toBe(true);
    expect(otherShell.classList.contains('agent-elements-question-option')).toBe(false);

    fireEvent.click(screen.getByText('Other'));
    expect(screen.getByTestId('ask-user-question-other-input').classList.contains('agent-elements-question-textarea')).toBe(true);
  });

  it('returns null and warns when providerToolCallId is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const message = makeToolMessage('AskUserQuestion', {
      questions: [
        {
          question: 'Q?',
          header: 'Q',
          options: [{ label: 'A', description: '' }],
          multiSelect: false,
        },
      ],
    });
    // Force providerToolCallId to empty.
    if (message.toolCall) {
      message.toolCall.providerToolCallId = '';
    }
    const { container } = render(
      <Wrapper>
        <AskUserQuestionWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="no-id"
        />
      </Wrapper>
    );
    expect(container.innerHTML).toBe('');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ============================================================================
// RequestUserInputWidget Tests
// ============================================================================

describe('RequestUserInputWidget', () => {
  let RequestUserInputWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/RequestUserInputWidget');
    RequestUserInputWidget = mod.RequestUserInputWidget;
  });

  async function renderRequestUserInputWithHost(
    message: TranscriptViewMessage,
    sessionId: string,
    hostOverrides: Partial<InteractiveWidgetHost> = {},
  ) {
    const { interactiveWidgetHostAtom } = await import('../../../../store/atoms/interactiveWidgetHost');
    const testStore = createStore();
    const host: InteractiveWidgetHost = {
      sessionId,
      workspacePath: '/',
      worktreeId: null,
      askUserQuestionSubmit: vi.fn().mockResolvedValue(undefined),
      askUserQuestionCancel: vi.fn().mockResolvedValue(undefined),
      requestUserInputSubmit: vi.fn().mockResolvedValue(undefined),
      requestUserInputCancel: vi.fn().mockResolvedValue(undefined),
      exitPlanModeApprove: vi.fn().mockResolvedValue(undefined),
      exitPlanModeStartNewSession: vi.fn().mockResolvedValue(undefined),
      exitPlanModeDeny: vi.fn().mockResolvedValue(undefined),
      exitPlanModeCancel: vi.fn().mockResolvedValue(undefined),
      toolPermissionSubmit: vi.fn().mockResolvedValue(undefined),
      toolPermissionCancel: vi.fn().mockResolvedValue(undefined),
      autoCommitEnabled: false,
      setAutoCommitEnabled: vi.fn(),
      gitCommit: vi.fn().mockResolvedValue({ success: true }),
      gitCommitCancel: vi.fn().mockResolvedValue(undefined),
      superLoopBlockedFeedback: vi.fn().mockResolvedValue({ success: true }),
      openFile: vi.fn().mockResolvedValue(undefined),
      trackEvent: vi.fn(),
      ...hostOverrides,
    };
    testStore.set(interactiveWidgetHostAtom(sessionId), host);

    render(
      <JotaiProvider store={testStore}>
        <RequestUserInputWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId={sessionId}
        />
      </JotaiProvider>
    );

    return { testStore, host };
  }

  it('renders pending structured input with the Agent Elements question shell', async () => {
    const { interactiveWidgetHostAtom } = await import('../../../../store/atoms/interactiveWidgetHost');

    const message = makeToolMessage('PromptForUserInput', {
      title: 'Choose implementation details',
      intro: 'Select the safest path.',
      fields: [
        {
          id: 'framework',
          type: 'singleSelect',
          label: 'Framework',
          description: 'Pick the renderer foundation.',
          allowOther: true,
          options: [
            { id: 'react', label: 'React', description: 'Use the current app framework.' },
          ],
        },
        {
          id: 'checks',
          type: 'multiSelect',
          label: 'Checks',
          items: [
            { id: 'unit', title: 'Unit tests', subtitle: 'Fast regression coverage' },
          ],
        },
      ],
    });
    message.toolCall!.providerToolCallId = 'request-user-input-shell-call';

    const testStore = createStore();
    testStore.set(interactiveWidgetHostAtom('request-shell-session'), {
      sessionId: 'request-shell-session',
      workspacePath: '/',
      worktreeId: null,
      askUserQuestionSubmit: vi.fn().mockResolvedValue(undefined),
      askUserQuestionCancel: vi.fn().mockResolvedValue(undefined),
      requestUserInputSubmit: vi.fn().mockResolvedValue(undefined),
      requestUserInputCancel: vi.fn().mockResolvedValue(undefined),
      exitPlanModeApprove: vi.fn().mockResolvedValue(undefined),
      exitPlanModeStartNewSession: vi.fn().mockResolvedValue(undefined),
      exitPlanModeDeny: vi.fn().mockResolvedValue(undefined),
      exitPlanModeCancel: vi.fn().mockResolvedValue(undefined),
      toolPermissionSubmit: vi.fn().mockResolvedValue(undefined),
      toolPermissionCancel: vi.fn().mockResolvedValue(undefined),
      autoCommitEnabled: false,
      setAutoCommitEnabled: vi.fn(),
      gitCommit: vi.fn().mockResolvedValue({ success: true }),
      gitCommitCancel: vi.fn().mockResolvedValue(undefined),
      superLoopBlockedFeedback: vi.fn().mockResolvedValue({ success: true }),
      openFile: vi.fn().mockResolvedValue(undefined),
      trackEvent: vi.fn(),
    });

    render(
      <JotaiProvider store={testStore}>
        <RequestUserInputWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="request-shell-session"
        />
      </JotaiProvider>
    );

    const widget = screen.getByTestId('request-user-input-widget');
    expect(widget.dataset.state).toBe('pending');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsRequestUserInput');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('input-card');
    expect(widget.getAttribute('data-request-user-input-state')).toBe('pending');
    expect(widget.classList.contains('agent-elements-tool-card')).toBe(true);
    expect(widget.classList.contains('agent-elements-question-card')).toBe(true);
    expect(widget.classList.contains('agent-elements-request-user-input-card')).toBe(true);
    expect(screen.getByTestId('request-user-input-status').textContent).toContain('awaiting input');

    const option = await screen.findByText('React');
    expect(option.closest('.agent-elements-question-option')).not.toBeNull();

    const otherShell = screen.getByTestId('request-user-input-singleselect-other');
    expect(otherShell.classList.contains('agent-elements-question-other-shell')).toBe(true);
    expect(screen.getAllByText('Framework')[0].closest('.agent-elements-request-user-input-field-card')).not.toBeNull();
    expect(screen.getByTestId('request-user-input-cancel')).toBeDefined();
    expect(screen.getByTestId('request-user-input-submit')).toBeDefined();
    expect(screen.getByTestId('request-user-input-submit').closest('.agent-elements-question-actions')).not.toBeNull();
  });

  it('renders host-null pending state without interactive actions', () => {
    const message = makeToolMessage('PromptForUserInput', {
      title: 'Choose renderer',
      fields: [
        {
          id: 'framework',
          type: 'singleSelect',
          label: 'Framework',
          options: [
            { id: 'react', label: 'React' },
          ],
        },
      ],
    });
    message.toolCall!.providerToolCallId = 'request-user-input-host-null-call';

    render(
      <Wrapper>
        <RequestUserInputWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="request-host-null-session"
        />
      </Wrapper>
    );

    const widget = screen.getByTestId('request-user-input-widget');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsRequestUserInput');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('input-card');
    expect(widget.getAttribute('data-request-user-input-state')).toBe('pending');
    expect(screen.getByTestId('request-user-input-status').textContent).toContain('awaiting input');
    expect(screen.getByTestId('request-user-input-pending').textContent).toContain('Waiting');
    expect(screen.queryByTestId('request-user-input-submit')).toBeNull();
    expect(screen.queryByTestId('request-user-input-cancel')).toBeNull();
  });

  it('preserves validation, seeded draft defaults, broad answer conversion, draft cleanup, voice hint, and editText/reorder behavior', async () => {
    const { requestUserInputDraftAtom } = await import('../../../../store/atoms/requestUserInputDraft');
    const longText = 'Initial paragraph '.repeat(16).trim();
    const message = makeToolMessage('PromptForUserInput', {
      title: 'Configure implementation',
      submitLabel: 'Apply',
      cancelLabel: 'Abort',
      fields: [
        {
          id: 'checks',
          type: 'multiSelect',
          label: 'Checks',
          minSelected: 2,
          maxSelected: 2,
          items: [
            { id: 'unit', title: 'Unit tests', defaultChecked: true },
            { id: 'e2e', title: 'E2E tests' },
          ],
        },
        {
          id: 'framework',
          type: 'singleSelect',
          label: 'Framework',
          allowOther: true,
          options: [
            { id: 'react', label: 'React' },
          ],
        },
        {
          id: 'order',
          type: 'reorder',
          label: 'Priority',
          minItems: 1,
          items: [
            { id: 'first', title: 'First task' },
            { id: 'second', title: 'Second task', removable: true },
          ],
        },
        {
          id: 'body',
          type: 'editText',
          label: 'Body',
          format: 'plain',
          initialText: longText,
          minLength: 5,
        },
        {
          id: 'confirm',
          type: 'confirm',
          label: 'Proceed',
          defaultValue: false,
        },
      ],
    });
    message.toolCall!.providerToolCallId = 'request-user-input-complex-call';

    const requestUserInputSubmit = vi.fn().mockResolvedValue(undefined);
    const { testStore } = await renderRequestUserInputWithHost(
      message,
      'request-complex-session',
      { requestUserInputSubmit },
    );

    const submit = screen.getByTestId('request-user-input-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByText(/Voice will defer/).textContent).toContain('text too long');

    const unitOption = screen.getByText('Unit tests').closest('button')!;
    expect(unitOption.dataset.selected).toBe('true');

    const editTextContent = screen.getByTestId('request-user-input-edittext-content');
    await rtl.waitFor(() => {
      expect(editTextContent.textContent).toContain(longText);
    });
    expect(editTextContent.closest('.agent-elements-question-textarea')).not.toBeNull();

    fireEvent.click(screen.getByText('E2E tests').closest('button')!);
    expect(submit.disabled).toBe(true);

    fireEvent.click(screen.getByText('Other'));
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('request-user-input-singleselect-other-input'), {
      target: { value: 'Svelte' },
    });

    fireEvent.click(screen.getByTestId('request-user-input-reorder-remove'));
    fireEvent.click(screen.getByTestId('request-user-input-confirm-confirm'));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await rtl.waitFor(() => {
      expect(requestUserInputSubmit).toHaveBeenCalledWith('request-user-input-complex-call', {
        checks: { type: 'multiSelect', selectedIds: ['unit', 'e2e'] },
        framework: { type: 'singleSelect', selectedId: '__other__', otherText: 'Svelte' },
        order: { type: 'reorder', orderedIds: ['first'], removedIds: ['second'] },
        body: { type: 'editText', text: longText, edited: false },
        confirm: { type: 'confirm', value: true },
      });
    });

    expect(testStore.get(requestUserInputDraftAtom('request-user-input-complex-call')).primed).toBe(false);
  });

  it('preserves submit host calls from the Agent Elements structured input shell', async () => {
    const { interactiveWidgetHostAtom } = await import('../../../../store/atoms/interactiveWidgetHost');

    const message = makeToolMessage('PromptForUserInput', {
      title: 'Choose renderer',
      fields: [
        {
          id: 'framework',
          type: 'singleSelect',
          label: 'Framework',
          allowOther: false,
          options: [
            { id: 'react', label: 'React', description: 'Use the current app framework.' },
          ],
        },
      ],
    });
    message.toolCall!.providerToolCallId = 'request-user-input-submit-call';

    const requestUserInputSubmit = vi.fn().mockResolvedValue(undefined);
    const testStore = createStore();
    testStore.set(interactiveWidgetHostAtom('request-submit-session'), {
      sessionId: 'request-submit-session',
      workspacePath: '/',
      worktreeId: null,
      askUserQuestionSubmit: vi.fn().mockResolvedValue(undefined),
      askUserQuestionCancel: vi.fn().mockResolvedValue(undefined),
      requestUserInputSubmit,
      requestUserInputCancel: vi.fn().mockResolvedValue(undefined),
      exitPlanModeApprove: vi.fn().mockResolvedValue(undefined),
      exitPlanModeStartNewSession: vi.fn().mockResolvedValue(undefined),
      exitPlanModeDeny: vi.fn().mockResolvedValue(undefined),
      exitPlanModeCancel: vi.fn().mockResolvedValue(undefined),
      toolPermissionSubmit: vi.fn().mockResolvedValue(undefined),
      toolPermissionCancel: vi.fn().mockResolvedValue(undefined),
      autoCommitEnabled: false,
      setAutoCommitEnabled: vi.fn(),
      gitCommit: vi.fn().mockResolvedValue({ success: true }),
      gitCommitCancel: vi.fn().mockResolvedValue(undefined),
      superLoopBlockedFeedback: vi.fn().mockResolvedValue({ success: true }),
      openFile: vi.fn().mockResolvedValue(undefined),
      trackEvent: vi.fn(),
    });

    render(
      <JotaiProvider store={testStore}>
        <RequestUserInputWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="request-submit-session"
        />
      </JotaiProvider>
    );

    const reactOption = await screen.findByText('React');
    fireEvent.click(reactOption.closest('button')!);
    fireEvent.click(screen.getByTestId('request-user-input-submit'));

    await rtl.waitFor(() => {
      expect(requestUserInputSubmit).toHaveBeenCalledWith('request-user-input-submit-call', {
        framework: { type: 'singleSelect', selectedId: 'react' },
      });
    });
  });

  it('preserves cancel host calls from the Agent Elements structured input shell', async () => {
    const { interactiveWidgetHostAtom } = await import('../../../../store/atoms/interactiveWidgetHost');

    const message = makeToolMessage('PromptForUserInput', {
      title: 'Choose renderer',
      fields: [
        {
          id: 'framework',
          type: 'singleSelect',
          label: 'Framework',
          options: [
            { id: 'react', label: 'React', description: 'Use the current app framework.' },
          ],
        },
      ],
    });
    message.toolCall!.providerToolCallId = 'request-user-input-cancel-call';

    const requestUserInputCancel = vi.fn().mockResolvedValue(undefined);
    const testStore = createStore();
    testStore.set(interactiveWidgetHostAtom('request-cancel-session'), {
      sessionId: 'request-cancel-session',
      workspacePath: '/',
      worktreeId: null,
      askUserQuestionSubmit: vi.fn().mockResolvedValue(undefined),
      askUserQuestionCancel: vi.fn().mockResolvedValue(undefined),
      requestUserInputSubmit: vi.fn().mockResolvedValue(undefined),
      requestUserInputCancel,
      exitPlanModeApprove: vi.fn().mockResolvedValue(undefined),
      exitPlanModeStartNewSession: vi.fn().mockResolvedValue(undefined),
      exitPlanModeDeny: vi.fn().mockResolvedValue(undefined),
      exitPlanModeCancel: vi.fn().mockResolvedValue(undefined),
      toolPermissionSubmit: vi.fn().mockResolvedValue(undefined),
      toolPermissionCancel: vi.fn().mockResolvedValue(undefined),
      autoCommitEnabled: false,
      setAutoCommitEnabled: vi.fn(),
      gitCommit: vi.fn().mockResolvedValue({ success: true }),
      gitCommitCancel: vi.fn().mockResolvedValue(undefined),
      superLoopBlockedFeedback: vi.fn().mockResolvedValue({ success: true }),
      openFile: vi.fn().mockResolvedValue(undefined),
      trackEvent: vi.fn(),
    });

    render(
      <JotaiProvider store={testStore}>
        <RequestUserInputWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="request-cancel-session"
        />
      </JotaiProvider>
    );

    fireEvent.click(screen.getByTestId('request-user-input-cancel'));

    await rtl.waitFor(() => {
      expect(requestUserInputCancel).toHaveBeenCalledWith('request-user-input-cancel-call');
    });
  });

  it('returns null and warns when providerToolCallId is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const message = makeToolMessage('PromptForUserInput', {
      fields: [
        {
          id: 'confirm',
          type: 'confirm',
          label: 'Proceed',
        },
      ],
    });
    message.toolCall!.providerToolCallId = '';

    const { container } = render(
      <Wrapper>
        <RequestUserInputWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="request-missing-id-session"
        />
      </Wrapper>
    );

    expect(container.innerHTML).toBe('');
    expect(warnSpy).toHaveBeenCalledWith('[RequestUserInputWidget] missing providerToolCallId; skipping render');
    warnSpy.mockRestore();
  });

  it('renders submitted and cancelled states with Agent Elements status markers', () => {
    const submitted = makeToolMessage(
      'PromptForUserInput',
      {
        title: 'Confirm details',
        fields: [
          {
            id: 'confirm',
            type: 'confirm',
            label: 'Proceed',
          },
        ],
      },
      { answers: { confirm: { type: 'confirm', value: true } } }
    );
    const { unmount } = render(
      <Wrapper>
        <RequestUserInputWidget
          message={submitted}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="request-submitted"
        />
      </Wrapper>
    );
    let widget = screen.getByTestId('request-user-input-widget');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsRequestUserInput');
    expect(widget.getAttribute('data-request-user-input-state')).toBe('submitted');
    expect(screen.getByTestId('request-user-input-status').textContent).toContain('submitted');
    expect(screen.getByTestId('request-user-input-completed')).toBeDefined();
    expect(screen.getByText('Proceed').closest('.agent-elements-request-user-input-field-card')).not.toBeNull();

    unmount();

    const cancelled = makeToolMessage(
      'PromptForUserInput',
      {
        title: 'Confirm details',
        fields: [
          {
            id: 'confirm',
            type: 'confirm',
            label: 'Proceed',
          },
        ],
      },
      { cancelled: true, answers: {} }
    );
    render(
      <Wrapper>
        <RequestUserInputWidget
          message={cancelled}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="request-cancelled"
        />
      </Wrapper>
    );
    widget = screen.getByTestId('request-user-input-widget');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsRequestUserInput');
    expect(widget.getAttribute('data-request-user-input-state')).toBe('cancelled');
    expect(screen.getByTestId('request-user-input-status').textContent).toContain('cancelled');
    expect(screen.getByTestId('request-user-input-cancelled')).toBeDefined();
  });
});

// ============================================================================
// GitCommitConfirmationWidget Tests
// ============================================================================

describe('GitCommitConfirmationWidget', () => {
  let GitCommitConfirmationWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/GitCommitConfirmationWidget');
    GitCommitConfirmationWidget = mod.GitCommitConfirmationWidget;
  });

  it('keeps the commit approval shell on Agent Elements card intent and token chrome', () => {
    const source = readFileSync(gitCommitConfirmationWidgetSourcePath, 'utf8');

    expect(source).toContain('data-agent-elements-card-padding');
    expect(source).toContain('data-agent-elements-card-width');
    expect(source).not.toMatch(/var\(--nim-/);
    expect(source).not.toMatch(/\b(?:text|bg|border)-nim/);
    expect(source).not.toContain('text-white');
    expect(source).not.toContain('<svg');
    expect(source).not.toContain('rounded-[3px]');
    expect(source).not.toContain('transition-all');
  });

  it('renders pending state with commit message and files', () => {
    const message = makeToolMessage('git_commit_proposal', {
      commitMessage: 'fix: resolve null check\n\nAdded guard clause',
      filesToStage: [
        { path: 'src/app.ts', status: 'modified' },
        { path: 'src/utils.ts', status: 'added' },
      ],
    });
    render(
      <Wrapper>
        <GitCommitConfirmationWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="pending-commit"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('git-commit-widget');
    expect(widget.dataset.state).toBe('pending');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsGitCommitConfirmation');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('commit-card');
    expect(widget.getAttribute('data-git-commit-state')).toBe('pending');
    expect(widget.classList.contains('agent-elements-tool-card')).toBe(true);
    expect(widget.classList.contains('agent-elements-git-commit-card')).toBe(true);
    expect(screen.getByTestId('git-commit-status').textContent).toContain('awaiting confirmation');
    expect(screen.getByText('Commit Proposal')).toBeDefined();
    // Commit message should be in textarea
    const textarea = screen.getByTestId('git-commit-message-input') as HTMLTextAreaElement;
    expect(textarea.value).toBe('fix: resolve null check\n\nAdded guard clause');
    expect(textarea.classList.contains('agent-elements-question-textarea')).toBe(true);
    // Files should be listed
    expect(screen.getByText('app.ts')).toBeDefined();
    expect(screen.getByText('utils.ts')).toBeDefined();
    const fileRow = screen.getByText('app.ts').closest('.git-commit-widget__file');
    expect(fileRow?.classList.contains('agent-elements-git-commit-file-row')).toBe(true);
    // Confirm and Cancel buttons
    expect(screen.getByTestId('git-commit-confirm')).toBeDefined();
    expect(screen.getByTestId('git-commit-cancel')).toBeDefined();
  });

  it('preserves commit host calls from the Agent Elements commit shell', async () => {
    const { interactiveWidgetHostAtom } = await import('../../../../store/atoms/interactiveWidgetHost');

    const message = makeToolMessage('git_commit_proposal', {
      commitMessage: 'fix: initial message',
      filesToStage: ['src/app.ts'],
    });
    message.toolCall!.providerToolCallId = 'git-commit-call';

    const gitCommit = vi.fn().mockResolvedValue({
      success: true,
      commitHash: 'abc1234567890',
      commitDate: '2026-05-23T21:13:41Z',
    });
    const trackEvent = vi.fn();
    const testStore = createStore();
    testStore.set(interactiveWidgetHostAtom('commit-action-session'), {
      sessionId: 'commit-action-session',
      workspacePath: '/',
      worktreeId: null,
      askUserQuestionSubmit: vi.fn().mockResolvedValue(undefined),
      askUserQuestionCancel: vi.fn().mockResolvedValue(undefined),
      requestUserInputSubmit: vi.fn().mockResolvedValue(undefined),
      requestUserInputCancel: vi.fn().mockResolvedValue(undefined),
      exitPlanModeApprove: vi.fn().mockResolvedValue(undefined),
      exitPlanModeStartNewSession: vi.fn().mockResolvedValue(undefined),
      exitPlanModeDeny: vi.fn().mockResolvedValue(undefined),
      exitPlanModeCancel: vi.fn().mockResolvedValue(undefined),
      toolPermissionSubmit: vi.fn().mockResolvedValue(undefined),
      toolPermissionCancel: vi.fn().mockResolvedValue(undefined),
      autoCommitEnabled: false,
      setAutoCommitEnabled: vi.fn(),
      gitCommit,
      gitCommitCancel: vi.fn().mockResolvedValue(undefined),
      superLoopBlockedFeedback: vi.fn().mockResolvedValue({ success: true }),
      openFile: vi.fn().mockResolvedValue(undefined),
      trackEvent,
    });

    render(
      <JotaiProvider store={testStore}>
        <GitCommitConfirmationWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="commit-action-session"
        />
      </JotaiProvider>
    );

    fireEvent.change(screen.getByTestId('git-commit-message-input'), {
      target: { value: 'fix: edited message' },
    });
    fireEvent.click(screen.getByTestId('git-commit-confirm'));

    await rtl.waitFor(() => {
      expect(gitCommit).toHaveBeenCalledWith('git-commit-call', ['src/app.ts'], 'fix: edited message');
    });
    expect(trackEvent).toHaveBeenCalledWith('git_commit_proposal_response', expect.objectContaining({
      action: 'committed',
      success: true,
      auto_commit: false,
    }));
  });

  it('preserves cancel host calls from the Agent Elements commit shell', async () => {
    const { interactiveWidgetHostAtom } = await import('../../../../store/atoms/interactiveWidgetHost');

    const message = makeToolMessage('git_commit_proposal', {
      commitMessage: 'fix: cancel me',
      filesToStage: ['src/app.ts', 'src/utils.ts'],
    });
    message.toolCall!.providerToolCallId = 'git-cancel-call';

    const gitCommitCancel = vi.fn().mockResolvedValue(undefined);
    const trackEvent = vi.fn();
    const testStore = createStore();
    testStore.set(interactiveWidgetHostAtom('commit-cancel-session'), {
      sessionId: 'commit-cancel-session',
      workspacePath: '/',
      worktreeId: null,
      askUserQuestionSubmit: vi.fn().mockResolvedValue(undefined),
      askUserQuestionCancel: vi.fn().mockResolvedValue(undefined),
      requestUserInputSubmit: vi.fn().mockResolvedValue(undefined),
      requestUserInputCancel: vi.fn().mockResolvedValue(undefined),
      exitPlanModeApprove: vi.fn().mockResolvedValue(undefined),
      exitPlanModeStartNewSession: vi.fn().mockResolvedValue(undefined),
      exitPlanModeDeny: vi.fn().mockResolvedValue(undefined),
      exitPlanModeCancel: vi.fn().mockResolvedValue(undefined),
      toolPermissionSubmit: vi.fn().mockResolvedValue(undefined),
      toolPermissionCancel: vi.fn().mockResolvedValue(undefined),
      autoCommitEnabled: false,
      setAutoCommitEnabled: vi.fn(),
      gitCommit: vi.fn().mockResolvedValue({ success: true }),
      gitCommitCancel,
      superLoopBlockedFeedback: vi.fn().mockResolvedValue({ success: true }),
      openFile: vi.fn().mockResolvedValue(undefined),
      trackEvent,
    });

    render(
      <JotaiProvider store={testStore}>
        <GitCommitConfirmationWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="commit-cancel-session"
        />
      </JotaiProvider>
    );

    fireEvent.click(screen.getByTestId('git-commit-cancel'));

    await rtl.waitFor(() => {
      expect(gitCommitCancel).toHaveBeenCalledWith('git-cancel-call');
    });
    expect(trackEvent).toHaveBeenCalledWith('git_commit_proposal_response', expect.objectContaining({
      action: 'cancelled',
      file_count: '1-5',
    }));
  });

  it('renders committed state from tool result', () => {
    const message = makeToolMessage(
      'git_commit_proposal',
      {
        commitMessage: 'feat: add feature',
        filesToStage: ['src/feature.ts'],
      },
      'committed - commit hash: abc1234567890, commit date: 2025-03-26T12:00:00Z'
    );
    render(
      <Wrapper>
        <GitCommitConfirmationWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="committed"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('git-commit-widget');
    expect(widget.dataset.state).toBe('committed');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsGitCommitConfirmation');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('commit-card');
    expect(widget.getAttribute('data-git-commit-state')).toBe('committed');
    expect(screen.getByTestId('git-commit-status').textContent).toContain('committed');
    expect(screen.getByText('Changes Committed')).toBeDefined();
    // Should show short hash
    expect(screen.getByText('abc1234')).toBeDefined();
  });

  it('renders cancelled state from tool result', () => {
    const message = makeToolMessage(
      'git_commit_proposal',
      {
        commitMessage: 'feat: cancelled',
        filesToStage: ['src/file.ts'],
      },
      { action: 'cancelled' }
    );
    render(
      <Wrapper>
        <GitCommitConfirmationWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="cancelled-commit"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('git-commit-widget');
    expect(widget.dataset.state).toBe('cancelled');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsGitCommitConfirmation');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('commit-card');
    expect(widget.getAttribute('data-git-commit-state')).toBe('cancelled');
    expect(screen.getByTestId('git-commit-status').textContent).toContain('cancelled');
    expect(screen.getByTestId('git-commit-cancelled')).toBeDefined();
  });

  it('renders error state from tool result', () => {
    const message = makeToolMessage(
      'git_commit_proposal',
      {
        commitMessage: 'feat: failing commit',
        filesToStage: ['src/file.ts'],
      },
      { action: 'error', error: 'HOOK_DETAIL: lint failed' }
    );
    render(
      <Wrapper>
        <GitCommitConfirmationWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="error-commit"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('git-commit-widget');
    expect(widget.dataset.state).toBe('error');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsGitCommitConfirmation');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('commit-card');
    expect(widget.getAttribute('data-git-commit-state')).toBe('error');
    expect(screen.getByTestId('git-commit-status').textContent).toContain('failed');
    expect(screen.getByText('Commit Failed')).toBeDefined();
    expect(screen.getByTestId('git-commit-error').textContent).toContain('HOOK_DETAIL: lint failed');
  });

  it('sends cancel through the interactive host', async () => {
    const { interactiveWidgetHostAtom } = await import('../../../../store/atoms/interactiveWidgetHost');

    const message = makeToolMessage('git_commit_proposal', {
      commitMessage: 'fix: cancel from mobile',
      filesToStage: ['src/file.ts'],
    });

    const testStore = createStore();
    const gitCommitCancel = vi.fn().mockResolvedValue(undefined);
    testStore.set(interactiveWidgetHostAtom('cancel-session'), {
      sessionId: 'cancel-session',
      workspacePath: '/',
      worktreeId: null,
      askUserQuestionSubmit: vi.fn().mockResolvedValue(undefined),
      askUserQuestionCancel: vi.fn().mockResolvedValue(undefined),
      requestUserInputSubmit: vi.fn().mockResolvedValue(undefined),
      requestUserInputCancel: vi.fn().mockResolvedValue(undefined),
      exitPlanModeApprove: vi.fn().mockResolvedValue(undefined),
      exitPlanModeStartNewSession: vi.fn().mockResolvedValue(undefined),
      exitPlanModeDeny: vi.fn().mockResolvedValue(undefined),
      exitPlanModeCancel: vi.fn().mockResolvedValue(undefined),
      toolPermissionSubmit: vi.fn().mockResolvedValue(undefined),
      toolPermissionCancel: vi.fn().mockResolvedValue(undefined),
      autoCommitEnabled: false,
      setAutoCommitEnabled: vi.fn(),
      gitCommit: vi.fn().mockResolvedValue({ success: true }),
      gitCommitCancel,
      superLoopBlockedFeedback: vi.fn().mockResolvedValue({ success: true }),
      openFile: vi.fn().mockResolvedValue(undefined),
      trackEvent: vi.fn(),
    });

    render(
      <JotaiProvider store={testStore}>
        <GitCommitConfirmationWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="cancel-session"
        />
      </JotaiProvider>
    );

    fireEvent.click(screen.getByTestId('git-commit-cancel'));

    expect(gitCommitCancel).toHaveBeenCalledTimes(1);
  });

  it('returns null when no tool call', () => {
    const message = makeMessage({ type: 'tool_call' });
    const { container } = render(
      <Wrapper>
        <GitCommitConfirmationWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="no-tool"
        />
      </Wrapper>
    );
    expect(container.innerHTML).toBe('');
  });
});

// ============================================================================
// ExitPlanModeWidget Tests
// ============================================================================

describe('ExitPlanModeWidget', () => {
  let ExitPlanModeWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/ExitPlanModeWidget');
    ExitPlanModeWidget = mod.ExitPlanModeWidget;
  });

  it('renders pending state without host', () => {
    const message = makeToolMessage('ExitPlanMode', {
      planFilePath: 'plan.md',
    });
    render(
      <Wrapper>
        <ExitPlanModeWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="no-host-plan"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('exit-plan-mode-widget');
    expect(widget.dataset.state).toBe('pending');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsExitPlanMode');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('plan-approval-card');
    expect(widget.getAttribute('data-exit-plan-state')).toBe('pending');
    expect(widget.classList.contains('agent-elements-tool-card')).toBe(true);
    expect(widget.classList.contains('agent-elements-exit-plan-mode-card')).toBe(true);
    expect(screen.getByTestId('exit-plan-mode-status').textContent).toContain('awaiting approval');
    expect(screen.getByText('Ready to exit planning mode?')).toBeDefined();
    expect(screen.getByText('Waiting...')).toBeDefined();
  });

  it('renders approved state from tool result', () => {
    const message = makeToolMessage(
      'ExitPlanMode',
      { planFilePath: 'plan.md' },
      'Approved - exited planning mode'
    );
    render(
      <Wrapper>
        <ExitPlanModeWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="approved-plan"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('exit-plan-mode-widget');
    expect(widget.dataset.state).toBe('approved');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsExitPlanMode');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('plan-approval-card');
    expect(widget.getAttribute('data-exit-plan-state')).toBe('approved');
    expect(screen.getByTestId('exit-plan-mode-status').textContent).toContain('approved');
    expect(screen.getByText('Exited Planning Mode')).toBeDefined();
    expect(screen.getByTestId('exit-plan-mode-approved')).toBeDefined();
  });

  it('renders denied state from tool result', () => {
    const message = makeToolMessage(
      'ExitPlanMode',
      { planFilePath: 'plan.md' },
      'Denied - continue planning'
    );
    render(
      <Wrapper>
        <ExitPlanModeWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="denied-plan"
        />
      </Wrapper>
    );
    const widget = screen.getByTestId('exit-plan-mode-widget');
    expect(widget.dataset.state).toBe('denied');
    expect(widget.getAttribute('data-component')).toBe('RichTranscriptAgentElementsExitPlanMode');
    expect(widget.getAttribute('data-agent-elements-shell')).toBe('plan-approval-card');
    expect(widget.getAttribute('data-exit-plan-state')).toBe('denied');
    expect(screen.getByTestId('exit-plan-mode-status').textContent).toContain('denied');
    expect(screen.getByText('Continued Planning')).toBeDefined();
  });

  it('shows plan file path as clickable link', () => {
    const message = makeToolMessage(
      'ExitPlanMode',
      { planFilePath: 'docs/plan.md' },
      'Approved - exited planning mode'
    );
    render(
      <Wrapper>
        <ExitPlanModeWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="plan-link"
          workspacePath="/workspace"
        />
      </Wrapper>
    );
    const planLink = screen.getByText('docs/plan.md');
    expect(planLink).toBeDefined();
    expect(planLink.classList.contains('agent-elements-exit-plan-file-link')).toBe(true);
  });
});

// ============================================================================
// ContextLimitWidget Tests
// ============================================================================

describe('ContextLimitWidget', () => {
  let ContextLimitWidget: React.FC<any>;

  beforeEach(async () => {
    const mod = await import('../ContextLimitWidget');
    ContextLimitWidget = mod.ContextLimitWidget;
  });

  it('renders error indicator and message', () => {
    const { container } = render(<ContextLimitWidget />);
    expect(container.querySelector('.context-limit-widget')).not.toBeNull();
    expect(screen.getByText('Context limit exceeded')).toBeDefined();
  });

  it('shows compact button only on last message', () => {
    const onCompact = vi.fn();
    render(<ContextLimitWidget isLastMessage={true} onCompact={onCompact} />);
    const compactButton = screen.getByText('Compact');
    expect(compactButton).toBeDefined();
    fireEvent.click(compactButton);
    expect(onCompact).toHaveBeenCalledOnce();
  });

  it('does not show compact button when not last message', () => {
    render(<ContextLimitWidget isLastMessage={false} />);
    expect(screen.queryByText('Compact')).toBeNull();
  });

  it('shows "Compacting..." after clicking compact', () => {
    const onCompact = vi.fn();
    render(<ContextLimitWidget isLastMessage={true} onCompact={onCompact} />);
    fireEvent.click(screen.getByText('Compact'));
    expect(screen.getByText('Compacting...')).toBeDefined();
  });
});

// ============================================================================
// FileChangeWidget Tests (Codex)
// ============================================================================

describe('FileChangeWidget', () => {
  let FileChangeWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/FileChangeWidget');
    FileChangeWidget = mod.FileChangeWidget;
  });

  it('renders collapsed view with file summary', () => {
    const message = makeToolMessage('file_change', {
      changes: [
        { path: '/workspace/src/app.ts', kind: 'update' },
        { path: '/workspace/src/utils.ts', kind: 'create' },
      ],
    }, { status: 'completed' });
    const { container } = render(
      <Wrapper>
        <FileChangeWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="fc-collapsed"
          workspacePath="/workspace"
        />
      </Wrapper>
    );
    const shell = screen.getByTestId('agent-elements-file-change-card');
    expect(shell.getAttribute('data-component')).toBe('RichTranscriptAgentElementsFileChange');
    expect(shell.getAttribute('data-agent-elements-shell')).toBe('file-change-card');
    expect(shell.className).toContain('agent-elements-file-change-card');
    expect(shell.className).toContain('agent-elements-tool-card');
    expect(shell.getAttribute('data-tool-status')).toBe('completed');
    expect(container.querySelector('button.file-change-widget')).not.toBeNull();
    expect(screen.getByText('Changed 2 files')).toBeDefined();
    expect(screen.getByText('app.ts, utils.ts')).toBeDefined();
  });

  it('renders expanded view with file list and kind badges', () => {
    const message = makeToolMessage('file_change', {
      changes: [
        { path: '/workspace/src/new-file.ts', kind: 'add' },
        { path: '/workspace/src/deleted.ts', kind: 'delete' },
      ],
    }, { status: 'completed' });
    const onToggle = vi.fn();
    const { container } = render(
      <Wrapper>
        <FileChangeWidget
          message={message}
          isExpanded={true}
          onToggle={onToggle}
          sessionId="fc-expanded"
          workspacePath="/workspace"
        />
      </Wrapper>
    );
    const shell = screen.getByTestId('agent-elements-file-change-card');
    expect(shell.getAttribute('data-component')).toBe('RichTranscriptAgentElementsFileChange');
    expect(shell.getAttribute('data-agent-elements-shell')).toBe('file-change-card');
    expect(shell.className).toContain('agent-elements-file-change-card');
    expect(shell.className).toContain('agent-elements-tool-card');
    expect(shell.getAttribute('data-tool-status')).toBe('completed');
    expect(screen.getByTestId('agent-elements-file-change-body').getAttribute('data-agent-elements-shell')).toBe(
      'file-change-body'
    );
    expect(screen.getByText('File Changes')).toBeDefined();
    expect(screen.getByText('Created')).toBeDefined();
    expect(screen.getByText('Deleted')).toBeDefined();
    expect(container.textContent).toContain('src/new-file.ts');
    expect(container.textContent).toContain('src/deleted.ts');
    expect(container.querySelector('[data-file-kind="add"]')).not.toBeNull();

    const header = container.querySelector('.agent-elements-tool-header');
    expect(header).not.toBeNull();
    fireEvent.click(header!);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders object-form deleted file changes as deleted, not unavailable', () => {
    const message = makeToolMessage('file_change', {
      changes: [
        { path: '/workspace/src/removed.ts', kind: { type: 'delete' } },
      ],
    }, { status: 'completed' });

    const { container } = render(
      <Wrapper>
        <FileChangeWidget
          message={message}
          isExpanded={true}
          onToggle={() => {}}
          sessionId="fc-object-delete"
          workspacePath="/workspace"
        />
      </Wrapper>
    );

    expect(screen.getByText('Deleted')).toBeDefined();
    fireEvent.click(screen.getByTestId('agent-elements-file-change-row-0'));
    expect(screen.getByTestId('agent-elements-file-change-deleted').textContent).toContain('File was deleted');
    expect(screen.queryByTestId('agent-elements-file-change-unavailable')).toBeNull();
    expect(container.querySelector('[data-file-kind="delete"]')).not.toBeNull();
  });

  it('shows running indicator when no result', () => {
    const message = makeToolMessage('file_change', {
      changes: [],
    }, undefined);
    const { container } = render(
      <Wrapper>
        <FileChangeWidget
          message={message}
          isExpanded={true}
          onToggle={() => {}}
          sessionId="fc-running"
        />
      </Wrapper>
    );
    const shell = screen.getByTestId('agent-elements-file-change-card');
    expect(shell.getAttribute('data-tool-status')).toBe('running');
    expect(container.querySelector('.agent-elements-file-change-loading-dot')).not.toBeNull();
    expect(container.querySelector('.animate-bash-dot-pulse')).toBeNull();
  });

  it('preserves selected snapshot, truncation toggle, live fallback, and open-file behavior', async () => {
    const { interactiveWidgetHostAtom } = await import('../../../../store/atoms/interactiveWidgetHost');
    const sessionId = 'fc-expanded-behavior';
    const host: InteractiveWidgetHost = {
      sessionId,
      workspacePath: '/workspace',
      worktreeId: null,
      askUserQuestionSubmit: vi.fn().mockResolvedValue(undefined),
      askUserQuestionCancel: vi.fn().mockResolvedValue(undefined),
      requestUserInputSubmit: vi.fn().mockResolvedValue(undefined),
      requestUserInputCancel: vi.fn().mockResolvedValue(undefined),
      exitPlanModeApprove: vi.fn().mockResolvedValue(undefined),
      exitPlanModeStartNewSession: vi.fn().mockResolvedValue(undefined),
      exitPlanModeDeny: vi.fn().mockResolvedValue(undefined),
      exitPlanModeCancel: vi.fn().mockResolvedValue(undefined),
      toolPermissionSubmit: vi.fn().mockResolvedValue(undefined),
      toolPermissionCancel: vi.fn().mockResolvedValue(undefined),
      autoCommitEnabled: false,
      setAutoCommitEnabled: vi.fn(),
      gitCommit: vi.fn().mockResolvedValue({ success: true }),
      gitCommitCancel: vi.fn().mockResolvedValue(undefined),
      superLoopBlockedFeedback: vi.fn().mockResolvedValue({ success: true }),
      openFile: vi.fn().mockResolvedValue(undefined),
      trackEvent: vi.fn(),
    };
    const longContent = Array.from({ length: 30 }, (_, index) => `line ${index + 1}`).join('\n');
    const message = makeToolMessage('file_change', {
      changes: [
        { path: '/workspace/src/snapshot.ts', kind: 'update' },
        { path: '/workspace/src/live.ts', kind: 'create' },
      ],
    }, {
      status: 'completed',
      fileSnapshots: {
        '/workspace/src/snapshot.ts': { content: longContent },
      },
    });
    const readFile = vi.fn().mockResolvedValue({ success: true, content: 'live file content' });
    const testStore = createStore();
    testStore.set(interactiveWidgetHostAtom(sessionId), host);

    render(
      <JotaiProvider store={testStore}>
        <FileChangeWidget
          message={message}
          isExpanded={true}
          onToggle={() => {}}
          sessionId={sessionId}
          workspacePath="/workspace"
          readFile={readFile}
        />
      </JotaiProvider>
    );

    fireEvent.click(screen.getByTestId('agent-elements-file-change-row-0'));
    expect(screen.getByTestId('agent-elements-file-change-content').textContent).toContain('line 25');
    expect(screen.getByTestId('agent-elements-file-change-show-more').textContent).toContain('Show 5 more lines');
    fireEvent.click(screen.getByTestId('agent-elements-file-change-show-more'));
    expect(screen.getByTestId('agent-elements-file-change-content').textContent).toContain('line 30');

    fireEvent.click(screen.getByTestId('agent-elements-file-change-open-0'));
    expect(host.openFile).toHaveBeenCalledWith('/workspace/src/snapshot.ts');

    fireEvent.click(screen.getByTestId('agent-elements-file-change-row-1'));
    await waitFor(() => {
      expect(readFile).toHaveBeenCalledWith('/workspace/src/live.ts');
    });
    await waitFor(() => {
      expect(screen.getByTestId('agent-elements-file-change-content').textContent).toContain('live file content');
    });
    expect(screen.getByTestId('agent-elements-file-change-live-notice').textContent).toContain('Showing current file');
  });

  it('keeps FileChangeWidget source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(fileChangeWidgetSourcePath, 'utf8');

    expect(source).toContain('AgentToolCard');
    expect(source).toContain('AgentStatusPill');
    expect(source).toContain('agent-elements-file-change-card');
    expect(source).toContain('data-agent-elements-shell="file-change-card"');
    expect(source).toContain('RichTranscriptAgentElementsFileChange');
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/--nim-/);
    expect(source).not.toMatch(/style=\{\{|borderRadius|letterSpacing|text-white|bg-white|bg-black|shadow-|animate-bash-dot-pulse/);
  });
});

// ============================================================================
// InteractivePromptWidget Tests
// ============================================================================

describe('InteractivePromptWidget', () => {
  let InteractivePromptWidget: React.FC<any>;

  beforeEach(async () => {
    const mod = await import('../InteractivePromptWidget');
    InteractivePromptWidget = mod.InteractivePromptWidget;
  });

  it('renders permission request in pending state with action buttons', () => {
    const onSubmit = vi.fn();
    render(
      <InteractivePromptWidget
        promptType="permission_request"
        content={{
          type: 'permission_request',
          requestId: 'perm-1',
          toolName: 'Bash',
          rawCommand: 'git push',
          pattern: 'Bash(git push:*)',
          patternDisplayName: 'git push commands',
          isDestructive: false,
          warnings: [],
          status: 'pending',
        }}
        onSubmitResponse={onSubmit}
      />
    );
    expect(screen.getByText('Allow this tool?')).toBeDefined();
    expect(screen.getByText('git push')).toBeDefined();
    expect(screen.getByText('Deny')).toBeDefined();
    expect(screen.getByText('Allow Once')).toBeDefined();
    expect(screen.getByText('Session')).toBeDefined();
    expect(screen.getByText('Always')).toBeDefined();
  });

  it('renders resolved permission state', () => {
    render(
      <InteractivePromptWidget
        promptType="permission_request"
        content={{
          type: 'permission_request',
          requestId: 'perm-2',
          toolName: 'Read',
          rawCommand: 'Read file',
          pattern: 'Read',
          patternDisplayName: 'Read files',
          isDestructive: false,
          warnings: [],
          status: 'resolved',
        }}
        onSubmitResponse={() => {}}
      />
    );
    expect(screen.getByText('Permission Resolved')).toBeDefined();
  });

  it('renders destructive permission with warning icon', () => {
    const { container } = render(
      <InteractivePromptWidget
        promptType="permission_request"
        content={{
          type: 'permission_request',
          requestId: 'perm-3',
          toolName: 'Bash',
          rawCommand: 'rm -rf /tmp/test',
          pattern: 'Bash',
          patternDisplayName: 'Run shell commands',
          isDestructive: true,
          warnings: ['This command could delete files'],
          status: 'pending',
        }}
        onSubmitResponse={() => {}}
      />
    );
    // Should have destructive styling
    expect(container.querySelector('.interactive-prompt--destructive')).not.toBeNull();
    // Warning should be visible
    expect(screen.getByText('This command could delete files')).toBeDefined();
  });

  it('renders ask_user_question prompt with options', () => {
    render(
      <InteractivePromptWidget
        promptType="ask_user_question_request"
        content={{
          type: 'ask_user_question_request',
          questionId: 'q-1',
          questions: [
            {
              question: 'Pick a color',
              header: 'Color',
              options: [
                { label: 'Red', description: 'Warm' },
                { label: 'Blue', description: 'Cool' },
              ],
              multiSelect: false,
            },
          ],
          status: 'pending',
        }}
        onSubmitResponse={() => {}}
      />
    );
    expect(screen.getByText('Claude has questions for you')).toBeDefined();
    expect(screen.getByText('Pick a color')).toBeDefined();
    expect(screen.getByText('Red')).toBeDefined();
    expect(screen.getByText('Blue')).toBeDefined();
    expect(screen.getByText('Warm')).toBeDefined();
    expect(screen.getByText('Cool')).toBeDefined();
  });

  it('calls onSubmitResponse with correct permission response', () => {
    const onSubmit = vi.fn();
    render(
      <InteractivePromptWidget
        promptType="permission_request"
        content={{
          type: 'permission_request',
          requestId: 'perm-click',
          toolName: 'Bash',
          rawCommand: 'ls',
          pattern: 'Bash(ls:*)',
          patternDisplayName: 'ls commands',
          isDestructive: false,
          warnings: [],
          status: 'pending',
        }}
        onSubmitResponse={onSubmit}
      />
    );
    fireEvent.click(screen.getByText('Allow Once'));
    expect(onSubmit).toHaveBeenCalledOnce();
    const response = onSubmit.mock.calls[0][0];
    expect(response.type).toBe('permission_response');
    expect(response.decision).toBe('allow');
    expect(response.scope).toBe('once');
    expect(response.requestId).toBe('perm-click');
  });

  it('keeps InteractivePromptWidget source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(interactivePromptWidgetSourcePath, 'utf8');

    expect(source).toContain('AgentToolCard');
    expect(source).toContain('AgentStatusPill');
    expect(source).toContain('data-component="InteractivePromptWidget"');
    expect(source).toContain('data-agent-elements-shell="interactive-prompt');
    expect(source).toContain('--an-tool-background');
    expect(source).toContain('--an-foreground-muted');
    expect(source).not.toMatch(/--nim-|rgba\(|style=\{\{|borderRadius|text-white|bg-white|bg-black|shadow-|rounded-lg|transition-all/);
  });
});

// ============================================================================
// ToolCallChanges Tests (unit - getOperationBadge logic)
// ============================================================================

describe('ToolCallChanges', () => {
  let ToolCallChanges: React.FC<any>;

  beforeEach(async () => {
    const mod = await import('../ToolCallChanges');
    ToolCallChanges = mod.ToolCallChanges;
  });

  it('returns null when not expanded', () => {
    const { container } = render(
      <ToolCallChanges
        toolCallItemId="tc-1"
        getToolCallDiffs={async () => null}
        isExpanded={false}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders fetched diffs with Agent Elements shell markers and token-backed chrome', async () => {
    const getToolCallDiffs = vi.fn().mockResolvedValue([
      {
        filePath: '/repo/src/app.ts',
        operation: 'edit',
        diffs: [{ oldString: 'const value = 1;', newString: 'const value = 2;' }],
        linesAdded: 1,
        linesRemoved: 1,
      },
    ]);
    const onOpenFile = vi.fn();

    render(
      <ToolCallChanges
        toolCallItemId="tc-agent-elements"
        toolCallTimestamp={Date.parse('2026-05-25T12:58:00Z')}
        getToolCallDiffs={getToolCallDiffs}
        isExpanded
        workspacePath="/repo"
        onOpenFile={onOpenFile}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('agent-elements-tool-call-changes')).toBeDefined();
    });

    const shell = screen.getByTestId('agent-elements-tool-call-changes');
    expect(shell.className).toContain('agent-elements-tool-call-changes');
    expect(shell.getAttribute('data-agent-elements-shell')).toBe('tool-call-changes');
    const toggle = screen.getByTestId('agent-elements-tool-call-changes-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'File changes 1 file changed +1 -1' })).toBe(toggle);

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('agent-elements-tool-call-changes-file-row').textContent).toContain('src/app.ts');
    fireEvent.click(screen.getByTitle('Open src/app.ts'));
    expect(onOpenFile).toHaveBeenCalledWith('/repo/src/app.ts');
  });

  it('uses Agent Elements source styling instead of legacy transcript chrome', () => {
    const source = readFileSync(toolCallChangesSourcePath, 'utf8');

    expect(source).toContain('MaterialSymbol');
    expect(source).toContain('data-agent-elements-shell="tool-call-changes"');
    expect(source).toContain('agent-elements-tool-call-changes');
    expect(source).toContain('--an-tool-background');
    expect(source).toContain('--an-foreground-muted');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|--nim-|<svg|tracking-wide|rounded-md|transition-all|rgba\(|#[0-9a-fA-F]{3,8}/);
  });
});

// ============================================================================
// SuperProgressSnapshotWidget Tests
// ============================================================================

describe('SuperProgressSnapshotWidget', () => {
  let SuperProgressSnapshotWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/SuperProgressSnapshotWidget');
    SuperProgressSnapshotWidget = mod.SuperProgressSnapshotWidget;
  });

  it('renders progress snapshots inside the Agent Elements card shell without primary raw JSON', () => {
    const snapshot: SuperProgressSnapshotResult = {
      timing: 'iteration-end',
      iterationNumber: 3,
      superLoopId: 'super-loop-123',
      capturedAt: Date.UTC(2026, 4, 25, 3, 40, 0),
      progress: {
        currentIteration: 3,
        phase: 'building',
        status: 'blocked',
        completionSignal: false,
        userFeedback: 'Focus on the renderer shell first.',
        blockers: ['Need product approval before launching the real loop.'],
        learnings: [
          {
            iteration: 2,
            summary: 'The session meta widget can reuse Agent Elements primitives.',
            filesChanged: ['packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/UpdateSessionMetaWidget.tsx'],
          },
        ],
      },
    };
    const message = makeToolMessage('SuperProgressSnapshot', snapshot as unknown as Record<string, unknown>);

    render(
      <Wrapper>
        <SuperProgressSnapshotWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="super-progress-snapshot-shell"
        />
      </Wrapper>
    );

    const shell = screen.getByTestId('agent-elements-super-progress-snapshot-card');
    expect(shell.getAttribute('data-component')).toBe('RichTranscriptAgentElementsSuperProgressSnapshot');
    expect(shell.getAttribute('data-agent-elements-shell')).toBe('super-progress-snapshot-card');
    expect(shell.className).toContain('agent-elements-super-progress-snapshot-card');
    expect(shell.className).toContain('agent-elements-tool-card');
    expect(shell.getAttribute('data-tool-status')).toBe('interrupted');

    expect(screen.getByTestId('agent-elements-super-progress-snapshot-body').getAttribute('data-agent-elements-shell')).toBe(
      'super-progress-snapshot-body'
    );
    expect(screen.getByTestId('agent-elements-super-progress-snapshot-phase').textContent).toContain('building');
    expect(screen.getByTestId('agent-elements-super-progress-snapshot-status').textContent).toContain('blocked');
    expect(screen.getByTestId('agent-elements-super-progress-snapshot-feedback').textContent).toContain(
      'Focus on the renderer shell first.'
    );
    expect(screen.getByTestId('agent-elements-super-progress-snapshot-blocker-0').textContent).toContain(
      'Need product approval before launching the real loop.'
    );
    expect(screen.getByTestId('agent-elements-super-progress-snapshot-learning-0').textContent).toContain(
      'The session meta widget can reuse Agent Elements primitives.'
    );

    const primary = screen.getByTestId('agent-elements-tool-primary');
    expect(primary.textContent).not.toContain('"blockers"');
    expect(primary.textContent).not.toContain('"filesChanged"');
    expect(screen.getByTestId('agent-elements-debug-disclosure').getAttribute('data-debug-only')).toBe('true');
    expect(screen.getByTestId('agent-elements-debug-payload').textContent).toContain('blockers');
  });

  it('keeps SuperProgressSnapshotWidget source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(superProgressSnapshotWidgetSourcePath, 'utf8');

    expect(source).toContain('agent-elements-super-progress-snapshot-card');
    expect(source).toContain('data-agent-elements-shell="super-progress-snapshot-card"');
    expect(source).toContain('RichTranscriptAgentElementsSuperProgressSnapshot');
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/--nim-bg-tertiary|--nim-border|--nim-text|--nim-primary/);
    expect(source).not.toMatch(/style=\{\{|borderRadius|letterSpacing|text-white|bg-white|bg-black/);
    expect(source).not.toMatch(/\\u25B6|\\u25A0|&#9888;/);
  });
});

// ============================================================================
// SuperLoopProgressWidget Tests
// ============================================================================

describe('SuperLoopProgressWidget', () => {
  let SuperLoopProgressWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/SuperLoopProgressWidget');
    SuperLoopProgressWidget = mod.SuperLoopProgressWidget;
  });

  it('renders progress updates inside the Agent Elements card shell without primary raw JSON', () => {
    const args: SuperLoopProgressUpdateArgs = {
      phase: 'building',
      status: 'completed',
      completionSignal: true,
      currentIteration: 4,
      blockers: [],
      learnings: [
        {
          iteration: 4,
          summary: 'The snapshot widget now uses shared Agent Elements primitives.',
          filesChanged: ['packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/SuperProgressSnapshotWidget.tsx'],
        },
      ],
    };
    const message = makeToolMessage('super_loop_progress_update', args as unknown as Record<string, unknown>);

    render(
      <Wrapper>
        <SuperLoopProgressWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="super-loop-progress-shell"
        />
      </Wrapper>
    );

    const shell = screen.getByTestId('agent-elements-super-loop-progress-card');
    expect(shell.getAttribute('data-component')).toBe('RichTranscriptAgentElementsSuperLoopProgress');
    expect(shell.getAttribute('data-agent-elements-shell')).toBe('super-loop-progress-card');
    expect(shell.className).toContain('agent-elements-super-loop-progress-card');
    expect(shell.className).toContain('agent-elements-tool-card');
    expect(shell.getAttribute('data-tool-status')).toBe('completed');

    expect(screen.getByTestId('agent-elements-super-loop-progress-phase').textContent).toContain('building');
    expect(screen.getByTestId('agent-elements-super-loop-progress-status').textContent).toContain('completed');
    expect(screen.getByTestId('agent-elements-super-loop-progress-completion').textContent).toContain('complete');
    expect(screen.getByTestId('agent-elements-super-loop-progress-learning').textContent).toContain(
      'The snapshot widget now uses shared Agent Elements primitives.'
    );

    const primary = screen.getByTestId('agent-elements-tool-primary');
    expect(primary.textContent).not.toContain('"learnings"');
    expect(primary.textContent).not.toContain('"filesChanged"');
    expect(screen.getByTestId('agent-elements-debug-disclosure').getAttribute('data-debug-only')).toBe('true');
    expect(screen.getByTestId('agent-elements-debug-payload').textContent).toContain('filesChanged');
  });

  it('preserves blocked feedback submission inside the Agent Elements shell', async () => {
    const { interactiveWidgetHostAtom } = await import('../../../../store/atoms/interactiveWidgetHost');
    const sessionId = 'super-loop-blocked-shell';
    const feedbackHost: InteractiveWidgetHost = {
      sessionId,
      workspacePath: '/',
      worktreeId: null,
      askUserQuestionSubmit: vi.fn().mockResolvedValue(undefined),
      askUserQuestionCancel: vi.fn().mockResolvedValue(undefined),
      requestUserInputSubmit: vi.fn().mockResolvedValue(undefined),
      requestUserInputCancel: vi.fn().mockResolvedValue(undefined),
      exitPlanModeApprove: vi.fn().mockResolvedValue(undefined),
      exitPlanModeStartNewSession: vi.fn().mockResolvedValue(undefined),
      exitPlanModeDeny: vi.fn().mockResolvedValue(undefined),
      exitPlanModeCancel: vi.fn().mockResolvedValue(undefined),
      toolPermissionSubmit: vi.fn().mockResolvedValue(undefined),
      toolPermissionCancel: vi.fn().mockResolvedValue(undefined),
      autoCommitEnabled: false,
      setAutoCommitEnabled: vi.fn(),
      gitCommit: vi.fn().mockResolvedValue({ success: true }),
      gitCommitCancel: vi.fn().mockResolvedValue(undefined),
      superLoopBlockedFeedback: vi.fn().mockResolvedValue({ success: true }),
      openFile: vi.fn().mockResolvedValue(undefined),
      trackEvent: vi.fn(),
    };
    const args: SuperLoopProgressUpdateArgs = {
      phase: 'planning',
      status: 'blocked',
      completionSignal: false,
      currentIteration: 5,
      blockers: ['Need a product call before continuing.'],
      learnings: [
        {
          iteration: 5,
          summary: 'Blocked progress should keep the latest learning visible.',
          filesChanged: [],
        },
      ],
    };
    const message = makeToolMessage('super_loop_progress_update', args as unknown as Record<string, unknown>);
    const testStore = createStore();
    testStore.set(interactiveWidgetHostAtom(sessionId), feedbackHost);

    render(
      <JotaiProvider store={testStore}>
        <SuperLoopProgressWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId={sessionId}
        />
      </JotaiProvider>
    );

    const shell = screen.getByTestId('agent-elements-super-loop-progress-card');
    expect(shell.getAttribute('data-tool-status')).toBe('interrupted');
    expect(screen.getByTestId('agent-elements-super-loop-progress-blocker-0').textContent).toContain(
      'Need a product call before continuing.'
    );
    expect(screen.getByTestId('agent-elements-super-loop-progress-learning').textContent).toContain(
      'Blocked progress should keep the latest learning visible.'
    );

    const input = screen.getByTestId('agent-elements-super-loop-progress-feedback-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '  use the existing card shell  ' } });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });

    await waitFor(() => {
      expect(feedbackHost.superLoopBlockedFeedback).toHaveBeenCalledWith('use the existing card shell');
    });
    expect(screen.getByTestId('agent-elements-super-loop-progress-submitted').textContent).toContain('Feedback sent');
    expect(screen.getByTestId('agent-elements-super-loop-progress-submitted').textContent).toContain(
      'use the existing card shell'
    );
  });

  it('keeps SuperLoopProgressWidget source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(superLoopProgressWidgetSourcePath, 'utf8');

    expect(source).toContain('agent-elements-super-loop-progress-card');
    expect(source).toContain('data-agent-elements-shell="super-loop-progress-card"');
    expect(source).toContain('RichTranscriptAgentElementsSuperLoopProgress');
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/--nim-bg-tertiary|--nim-border|--nim-text|--nim-primary/);
    expect(source).not.toMatch(/style=\{\{|borderRadius|letterSpacing|text-white|bg-white|bg-black/);
    expect(source).not.toMatch(/color:\s*'white'|color:\s*"white"|&#9888;/);
  });
});

// ============================================================================
// UpdateSessionMetaWidget Tests
// ============================================================================

describe('UpdateSessionMetaWidget', () => {
  let UpdateSessionMetaWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/UpdateSessionMetaWidget');
    UpdateSessionMetaWidget = mod.UpdateSessionMetaWidget;
  });

  it('renders structured result with name, phase, and tags', () => {
    const result: StructuredSessionMetaResult = {
      summary: 'Set name, added tags, set phase',
      before: { name: null, tags: [], phase: null },
      after: { name: 'Dark mode implementation', tags: ['feature', 'ui'], phase: 'implementing' },
    };
    const message = makeToolMessage(
      'update_session_meta',
      { name: 'Dark mode implementation', add: ['feature', 'ui'], phase: 'implementing' },
      JSON.stringify(result)
    );
    const { container } = render(
      <Wrapper>
        <UpdateSessionMetaWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="meta-full"
        />
      </Wrapper>
    );
    // Header
    expect(screen.getByText('Session Meta')).toBeDefined();
    // Name with "set" badge
    expect(screen.getByText('Dark mode implementation')).toBeDefined();
    expect(screen.getByText('set')).toBeDefined();
    // Phase badge
    expect(screen.getByText('implementing')).toBeDefined();
    // Tags with added prefix
    expect(screen.getByText(/feature/)).toBeDefined();
    expect(screen.getByText(/ui/)).toBeDefined();
    // Should NOT render raw JSON
    expect(container.textContent).not.toContain('"before"');
    expect(container.textContent).not.toContain('"after"');
  });

  it('renders structured session metadata inside the Agent Elements card shell', () => {
    const result: StructuredSessionMetaResult = {
      summary: 'Set name, changed phase, updated tags',
      before: { name: 'Planning pass', tags: ['old', 'ux'], phase: 'planning' },
      after: { name: 'Implementation pass', tags: ['ux', 'agent-elements'], phase: 'implementing' },
    };
    const message = makeToolMessage(
      'update_session_meta',
      { name: 'Implementation pass', add: ['agent-elements'], remove: ['old'], phase: 'implementing' },
      JSON.stringify(result)
    );

    const { container } = render(
      <Wrapper>
        <UpdateSessionMetaWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="meta-agent-elements-shell"
        />
      </Wrapper>
    );

    const shell = screen.getByTestId('agent-elements-session-meta-card');
    expect(shell.getAttribute('data-component')).toBe('RichTranscriptAgentElementsSessionMeta');
    expect(shell.getAttribute('data-agent-elements-shell')).toBe('session-meta-card');
    expect(shell.className).toContain('agent-elements-session-meta-card');
    expect(shell.className).toContain('agent-elements-tool-card');

    expect(screen.getByTestId('agent-elements-session-meta-body').getAttribute('data-agent-elements-shell')).toBe(
      'session-meta-body'
    );
    expect(screen.getByTestId('agent-elements-session-meta-name').getAttribute('data-agent-elements-shell')).toBe(
      'session-meta-row'
    );
    expect(screen.getByTestId('agent-elements-session-meta-phase').getAttribute('data-agent-elements-shell')).toBe(
      'session-meta-row'
    );
    expect(screen.getByTestId('agent-elements-session-meta-tags').getAttribute('data-agent-elements-shell')).toBe(
      'session-meta-row'
    );

    const addedTag = screen.getByTestId('agent-elements-session-meta-tag-added-agent-elements');
    expect(addedTag.getAttribute('data-session-meta-tag-state')).toBe('added');
    expect(addedTag.getAttribute('data-tone')).toBe('success');
    const removedTag = screen.getByTestId('agent-elements-session-meta-tag-removed-old');
    expect(removedTag.getAttribute('data-session-meta-tag-state')).toBe('removed');
    expect(removedTag.getAttribute('data-tone')).toBe('error');

    expect(container.textContent).toContain('Planning pass');
    expect(container.textContent).toContain('Implementation pass');
    expect(container.textContent).toContain('\u2192');
    expect(container.textContent).not.toContain('"before"');
    expect(container.textContent).not.toContain('"after"');
  });

  it('renders phase transition with arrow', () => {
    const result: StructuredSessionMetaResult = {
      summary: 'Updated phase',
      before: { name: 'My session', tags: ['feature'], phase: 'planning' },
      after: { name: 'My session', tags: ['feature'], phase: 'implementing' },
    };
    const message = makeToolMessage(
      'update_session_meta',
      { phase: 'implementing' },
      JSON.stringify(result)
    );
    const { container } = render(
      <Wrapper>
        <UpdateSessionMetaWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="meta-phase"
        />
      </Wrapper>
    );
    // Both phases should appear
    expect(screen.getByText('planning')).toBeDefined();
    expect(screen.getByText('implementing')).toBeDefined();
    // Arrow between them
    expect(container.textContent).toContain('\u2192');
  });

  it('renders tag additions and removals', () => {
    const result: StructuredSessionMetaResult = {
      summary: 'Updated tags',
      before: { name: 'My session', tags: ['uncommitted', 'feature'], phase: 'implementing' },
      after: { name: 'My session', tags: ['committed', 'feature'], phase: 'implementing' },
    };
    const message = makeToolMessage(
      'mcp__nimbalyst-session-naming__update_session_meta',
      { add: ['committed'], remove: ['uncommitted'] },
      JSON.stringify(result)
    );
    render(
      <Wrapper>
        <UpdateSessionMetaWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="meta-tags"
        />
      </Wrapper>
    );
    // Kept tag
    expect(screen.getByText('#feature')).toBeDefined();
    // Added tag (with + prefix)
    expect(screen.getByText('#committed')).toBeDefined();
    // Removed tag (with - prefix and strikethrough)
    expect(screen.getByText('#uncommitted')).toBeDefined();
  });

  it('renders "already set" note when name was already set', () => {
    const result: StructuredSessionMetaResult = {
      summary: 'Name already set',
      before: { name: 'Existing name', tags: [], phase: null },
      after: { name: 'Existing name', tags: [], phase: null },
    };
    const message = makeToolMessage(
      'update_session_meta',
      { name: 'New name attempt' },
      JSON.stringify(result)
    );
    render(
      <Wrapper>
        <UpdateSessionMetaWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="meta-name-skip"
        />
      </Wrapper>
    );
    expect(screen.getByText('Existing name')).toBeDefined();
    expect(screen.getByText('(already set)')).toBeDefined();
  });

  it('renders compact card when result is still pending (no result)', () => {
    const message = makeToolMessage(
      'update_session_meta',
      { name: 'New session', add: ['feature'], phase: 'planning' },
      undefined
    );
    render(
      <Wrapper>
        <UpdateSessionMetaWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="meta-pending"
        />
      </Wrapper>
    );
    expect(screen.getByText('Session Meta')).toBeDefined();
    expect(screen.getByText('New session')).toBeDefined();
  });

  it('renders fallback text for old-format (non-JSON) results', () => {
    const message = makeToolMessage(
      'update_session_meta',
      { name: 'Old format' },
      'Session named: Old format'
    );
    render(
      <Wrapper>
        <UpdateSessionMetaWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="meta-fallback"
        />
      </Wrapper>
    );
    expect(screen.getByText('Session Meta')).toBeDefined();
    expect(screen.getByText('Session named: Old format')).toBeDefined();
  });

  it('returns null when no tool call', () => {
    const message = makeMessage({ type: 'tool_call' });
    const { container } = render(
      <Wrapper>
        <UpdateSessionMetaWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="meta-no-tool"
        />
      </Wrapper>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders "No metadata set" for empty result', () => {
    const result: StructuredSessionMetaResult = {
      summary: 'No changes',
      before: { name: null, tags: [], phase: null },
      after: { name: null, tags: [], phase: null },
    };
    const message = makeToolMessage(
      'update_session_meta',
      {},
      JSON.stringify(result)
    );
    render(
      <Wrapper>
        <UpdateSessionMetaWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="meta-empty"
        />
      </Wrapper>
    );
    expect(screen.getByText('No metadata set')).toBeDefined();
  });

  it('renders structured result when tool.result is already a parsed object (canonical transcript path)', () => {
    // When loading Claude Code sessions from the canonical transcript,
    // parseToolResult() parses the stored JSON string back into an object.
    // The widget must handle this shape directly (not just JSON strings or MCP arrays).
    const result = {
      summary: 'Set name: "Bug fix"\nAdded tags: #bug-fix\nSet phase: implementing',
      before: { name: null, tags: [] as string[], phase: null },
      after: { name: 'Bug fix', tags: ['bug-fix'], phase: 'implementing' },
    };
    const message = makeToolMessage(
      'mcp__nimbalyst-session-naming__update_session_meta',
      { name: 'Bug fix', add: ['bug-fix'], phase: 'implementing' },
      result // Pass the object directly, not JSON.stringify
    );
    const { container } = render(
      <Wrapper>
        <UpdateSessionMetaWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="meta-parsed-object"
        />
      </Wrapper>
    );
    expect(screen.getByText('Bug fix')).toBeDefined();
    expect(screen.getByText('#bug-fix')).toBeDefined();
    expect(screen.getByText('implementing')).toBeDefined();
    // Should show the "set" badge since name changed from null
    expect(container.textContent).toContain('set');
  });

  it('keeps UpdateSessionMetaWidget source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(updateSessionMetaWidgetSourcePath, 'utf8');

    expect(source).toContain('agent-elements-session-meta-card');
    expect(source).toContain('data-agent-elements-shell="session-meta-card"');
    expect(source).toContain('RichTranscriptAgentElementsSessionMeta');
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/--nim-bg-tertiary|--nim-border|--nim-text|--nim-primary/);
    expect(source).not.toMatch(/style=\{\{|borderRadius|letterSpacing|text-white|bg-white|bg-black/);
  });
});

describe('TrackerToolWidget', () => {
  let TrackerToolWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/TrackerToolWidget');
    TrackerToolWidget = mod.TrackerToolWidget;
  });

  it('renders created tracker results inside the Agent Elements card shell without primary raw JSON', () => {
    const result = {
      structured: {
        action: 'created',
        item: {
          id: 'task_123',
          type: 'task',
          typeTags: ['task', 'daily-driver'],
          title: 'Replace tracker transcript chrome',
          status: 'active',
          priority: 'high',
          tags: ['agent-elements', 'transcript'],
        },
      },
      summary: 'Created tracker item',
    };

    render(
      <Wrapper>
        <TrackerToolWidget
          message={makeToolMessage('tracker_create', { type: 'task' }, JSON.stringify(result))}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="tracker-create-shell"
        />
      </Wrapper>
    );

    const shell = screen.getByTestId('agent-elements-tracker-tool-card');
    expect(shell.getAttribute('data-component')).toBe('RichTranscriptAgentElementsTrackerTool');
    expect(shell.getAttribute('data-agent-elements-shell')).toBe('tracker-tool-card');
    expect(shell.className).toContain('agent-elements-tracker-tool-card');
    expect(shell.className).toContain('agent-elements-tool-card');
    expect(shell.getAttribute('data-tool-status')).toBe('completed');

    expect(screen.getByTestId('agent-elements-tracker-tool-type').textContent).toContain('task');
    expect(screen.getByTestId('agent-elements-tracker-tool-title').textContent).toContain('Replace tracker transcript chrome');
    expect(screen.getByTestId('agent-elements-tracker-tool-status').textContent).toContain('active');
    expect(screen.getByTestId('agent-elements-tracker-tool-priority').textContent).toContain('high');
    expect(screen.getByTestId('agent-elements-tracker-tool-tag-0').textContent).toContain('agent-elements');

    const primary = screen.getByTestId('agent-elements-tool-primary');
    expect(primary.textContent).not.toContain('"structured"');
    expect(primary.textContent).not.toContain('"tags"');
    expect(screen.getByTestId('agent-elements-debug-disclosure').getAttribute('data-debug-only')).toBe('true');
    expect(screen.getByTestId('agent-elements-debug-payload').textContent).toContain('tracker_create');
  });

  it('normalizes legacy string tag values before rendering tracker_update diffs', () => {
    const result = {
      structured: {
        action: 'updated',
        id: 'bug_123',
        type: 'bug',
        typeTags: ['bug'],
        title: 'Fix transcript widget crash',
        changes: {
          tags: {
            from: 'alpha, beta',
            to: ['beta', 'gamma'],
          },
        },
      },
      summary: 'Updated tracker item',
    };

    render(
      <Wrapper>
        <TrackerToolWidget
          message={makeToolMessage('tracker_update', { id: 'bug_123' }, JSON.stringify(result))}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="tracker-tag-normalization"
        />
      </Wrapper>
    );

    const shell = screen.getByTestId('agent-elements-tracker-tool-card');
    expect(shell.getAttribute('data-component')).toBe('RichTranscriptAgentElementsTrackerTool');
    expect(shell.getAttribute('data-agent-elements-shell')).toBe('tracker-tool-card');
    expect(screen.getByText('Tracker Updated')).toBeDefined();
    expect(screen.getByText('#alpha')).toBeDefined();
    expect(screen.getByText('#beta')).toBeDefined();
    expect(screen.getByText('#gamma')).toBeDefined();
  });

  it('keeps TrackerToolWidget source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(trackerToolWidgetSourcePath, 'utf8');

    expect(source).toContain('agent-elements-tracker-tool-card');
    expect(source).toContain('data-agent-elements-shell="tracker-tool-card"');
    expect(source).toContain('RichTranscriptAgentElementsTrackerTool');
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/--nim-bg-tertiary|--nim-border|--nim-text|--nim-primary/);
    expect(source).not.toMatch(/style=\{\{|borderRadius|letterSpacing|text-white|bg-white|bg-black/);
  });
});

describe('ToolWidgetErrorBoundary', () => {
  let ToolWidgetErrorBoundary: typeof import('../CustomToolWidgets/ToolWidgetErrorBoundary').ToolWidgetErrorBoundary;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/ToolWidgetErrorBoundary');
    ToolWidgetErrorBoundary = mod.ToolWidgetErrorBoundary;
  });

  it('renders custom-widget crashes inside the Agent Elements error card shell', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const BrokenWidget = () => {
      throw new Error('Renderer exploded');
    };

    try {
      render(
        <ToolWidgetErrorBoundary toolName="tracker_create">
          <BrokenWidget />
        </ToolWidgetErrorBoundary>
      );

      const shell = screen.getByTestId('agent-elements-tool-widget-error-card');
      expect(shell.getAttribute('data-component')).toBe('RichTranscriptAgentElementsToolWidgetErrorBoundary');
      expect(shell.getAttribute('data-agent-elements-shell')).toBe('tool-widget-error-card');
      expect(shell.className).toContain('agent-elements-tool-widget-error-card');
      expect(shell.className).toContain('agent-elements-tool-card');
      expect(shell.getAttribute('data-tool-status')).toBe('error');
      expect(screen.getByText('Widget failed to render')).toBeDefined();
      expect(screen.getByText('tracker_create')).toBeDefined();
      expect(screen.getByText('Renderer exploded')).toBeDefined();
      expect(screen.getByTestId('agent-elements-tool-widget-error-message').textContent).toContain('Renderer exploded');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('preserves details, copy, and retry actions from the crash fallback', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const writeText = vi.fn().mockResolvedValue(undefined);
    const previousClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    let shouldThrow = true;
    const MaybeBrokenWidget = () => {
      if (shouldThrow) throw new Error('Retryable crash');
      return <div data-testid="tool-widget-recovered">Recovered widget</div>;
    };

    try {
      render(
        <ToolWidgetErrorBoundary toolName="Bash">
          <MaybeBrokenWidget />
        </ToolWidgetErrorBoundary>
      );

      expect(screen.queryByTestId('agent-elements-tool-widget-error-details')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
      expect(screen.getByTestId('agent-elements-tool-widget-error-details').textContent).toContain('Retryable crash');

      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Tool widget: Bash'));
      });

      shouldThrow = false;
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await waitFor(() => {
        expect(screen.getByTestId('tool-widget-recovered')).toBeDefined();
      });
      expect(screen.queryByTestId('agent-elements-tool-widget-error-card')).toBeNull();
    } finally {
      consoleError.mockRestore();
      if (previousClipboardDescriptor) {
        Object.defineProperty(navigator, 'clipboard', previousClipboardDescriptor);
      } else {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    }
  });

  it('keeps ToolWidgetErrorBoundary source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(toolWidgetErrorBoundarySourcePath, 'utf8');

    expect(source).toContain('AgentToolCard');
    expect(source).toContain('AgentStatusPill');
    expect(source).toContain('agent-elements-tool-widget-error-card');
    expect(source).toContain('data-agent-elements-shell="tool-widget-error-card"');
    expect(source).toContain('RichTranscriptAgentElementsToolWidgetErrorBoundary');
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/--nim-/);
    expect(source).not.toMatch(/style=\{\{|borderRadius|letterSpacing|text-white|bg-white|bg-black|shadow-/);
  });
});

describe('EditorScreenshotWidget', () => {
  let EditorScreenshotWidget: React.FC<CustomToolWidgetProps>;

  beforeEach(async () => {
    const mod = await import('../CustomToolWidgets/EditorScreenshotWidget');
    EditorScreenshotWidget = mod.EditorScreenshotWidget;
  });

  it('renders inline image when result is the canonical JSON-stringified MCP image array', () => {
    // Canonical transcript stores MCP content arrays as JSON strings on tool_call.result.
    // The widget must parse the string back into an array to extract image data.
    const mcpContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          media_type: 'image/png',
        },
      },
    ];
    const message = makeToolMessage(
      'mcp__nimbalyst-mcp__capture_editor_screenshot',
      { file_path: '/tmp/feedback-intake-dialog.mockup.html' },
      mcpContent,
    );
    const { container } = render(
      <Wrapper>
        <EditorScreenshotWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="screenshot-inline"
        />
      </Wrapper>
    );
    expect(screen.getByText('feedback-intake-dialog.mockup.html')).toBeDefined();
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('data:image/png;base64,');
  });

  it('renders screenshots inside the Agent Elements card shell with stable markers', () => {
    const mcpContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          media_type: 'image/png',
        },
      },
    ];
    const message = makeToolMessage(
      'mcp__nimbalyst-mcp__capture_editor_screenshot',
      { file_path: '/tmp/feedback-intake-dialog.mockup.html' },
      mcpContent,
    );
    const { container } = render(
      <Wrapper>
        <EditorScreenshotWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="screenshot-shell"
        />
      </Wrapper>
    );

    const card = screen.getByTestId('agent-elements-editor-screenshot-card');
    expect(card.getAttribute('data-component')).toBe('RichTranscriptAgentElementsEditorScreenshot');
    expect(card.getAttribute('data-agent-elements-shell')).toBe('editor-screenshot-card');
    expect(card.classList.contains('agent-elements-tool-card')).toBe(true);
    expect(card.classList.contains('agent-elements-editor-screenshot-card')).toBe(true);
    expect(screen.getByTestId('agent-elements-editor-screenshot-preview')).toBeDefined();
    expect(screen.getByTestId('agent-elements-editor-screenshot-status').textContent).toContain('Captured');
    expect(container.querySelector('.editor-screenshot-widget')).not.toBeNull();
  });

  it('opens and closes the Agent Elements screenshot lightbox without raw svg chrome', () => {
    const mcpContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          media_type: 'image/png',
        },
      },
    ];
    const message = makeToolMessage(
      'capture_editor_screenshot',
      { file_path: '/tmp/diagram.excalidraw' },
      mcpContent,
    );
    render(
      <Wrapper>
        <EditorScreenshotWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="screenshot-lightbox"
        />
      </Wrapper>
    );

    fireEvent.click(screen.getByTestId('agent-elements-editor-screenshot-preview'));
    const dialog = screen.getByRole('dialog', { name: 'Editor screenshot preview' });
    expect(dialog.getAttribute('data-agent-elements-shell')).toBe('editor-screenshot-lightbox');
    expect(screen.getByTestId('agent-elements-editor-screenshot-lightbox-close')).toBeDefined();

    fireEvent.click(screen.getByTestId('agent-elements-editor-screenshot-lightbox-close'));
    expect(screen.queryByRole('dialog', { name: 'Editor screenshot preview' })).toBeNull();
  });

  it('renders screenshot errors in the Agent Elements error state', () => {
    const message = makeToolMessage(
      'capture_editor_screenshot',
      { file_path: '/tmp/missing.mockup.html' },
      { isError: true, content: [{ type: 'text', text: 'Unable to capture editor screenshot' }] },
    );
    render(
      <Wrapper>
        <EditorScreenshotWidget
          message={message}
          isExpanded={false}
          onToggle={() => {}}
          sessionId="screenshot-error"
        />
      </Wrapper>
    );

    const card = screen.getByTestId('agent-elements-editor-screenshot-card');
    expect(card.getAttribute('data-tool-status')).toBe('error');
    expect(screen.getByTestId('agent-elements-editor-screenshot-status').textContent).toContain('Failed');
    expect(screen.getByTestId('agent-elements-editor-screenshot-error').textContent).toContain('Unable to capture editor screenshot');
  });

  it('keeps EditorScreenshotWidget source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(editorScreenshotWidgetSourcePath, 'utf8');
    expect(source).toContain('AgentToolCard');
    expect(source).toContain('AgentStatusPill');
    expect(source).toContain('data-agent-elements-shell="editor-screenshot-card"');
    expect(source).not.toMatch(/--nim-/);
    expect(source).not.toMatch(/style=\{\{|borderRadius|letterSpacing|text-white|bg-white|bg-black|shadow-|backdrop-blur|<svg/);
  });
});
