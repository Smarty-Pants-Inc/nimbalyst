import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptViewMessage } from '../../../../ai/server/transcript/TranscriptProjector';

vi.mock('virtua', async () => {
  const ReactModule = await import('react');
  return {
    VList: ReactModule.forwardRef<any, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => {
        const {
          bufferSize: _bufferSize,
          itemSize: _itemSize,
          cache: _cache,
          onScroll: _onScroll,
          ...domProps
        } = props as React.HTMLAttributes<HTMLDivElement> & {
          bufferSize?: number;
          itemSize?: number;
          cache?: unknown;
          onScroll?: unknown;
        };
        ReactModule.useImperativeHandle(ref, () => ({
          scrollOffset: 0,
          scrollSize: 1000,
          viewportSize: 500,
          cache: {},
          findItemIndex: () => 0,
          scrollToIndex: vi.fn(),
        }));
        return <div {...domProps}>{children}</div>;
      },
    ),
  };
});

vi.mock('../../../../utils/platform', () => ({
  isAppleMobileWebKit: () => false,
}));

vi.mock('../../../../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

import { RichTranscriptView } from '../RichTranscriptView';
import { copyToClipboard } from '../../../../utils/clipboard';
import { TranscriptProjector } from '../../../../ai/server/transcript/TranscriptProjector';
import type { TranscriptEvent } from '../../../../ai/server/transcript/types';

function makeToolMessage(toolName: string, overrides: Partial<NonNullable<TranscriptViewMessage['toolCall']>> = {}): TranscriptViewMessage {
  return {
    id: 1,
    sequence: 1,
    createdAt: new Date('2026-05-23T14:25:00Z'),
    type: 'tool_call',
    subagentId: null,
    toolCall: {
      toolName,
      toolDisplayName: toolName,
      status: 'completed',
      description: 'Read source file',
      arguments: { file_path: '/repo/src/app.ts' },
      targetFilePath: null,
      mcpServer: null,
      mcpTool: null,
      providerToolCallId: `tool-${toolName}`,
      progress: [],
      result: 'export const value = 1;',
      ...overrides,
    },
  };
}

function renderTranscript(
  messages: TranscriptViewMessage[],
  extraProps: Partial<React.ComponentProps<typeof RichTranscriptView>> = {},
) {
  return render(
    <RichTranscriptView
      sessionId="agent-elements-live-bridge"
      sessionStatus="completed"
      isProcessing={false}
      hasPendingInteractivePrompt={false}
      messages={messages}
      provider="openai-codex"
      settings={{
        showToolCalls: true,
        showThinking: true,
        compactMode: false,
        collapseTools: false,
        showSessionInit: false,
      }}
      persistScrollState={false}
      {...extraProps}
    />,
  );
}

describe('RichTranscriptView Agent Elements live bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('CSS', {
      highlights: {
        set: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
      },
    });
  });

  it('routes generic non-interactive tool rows through the Agent Elements renderer without primary raw JSON', () => {
    renderTranscript([makeToolMessage('Read')]);

    expect(screen.getByTestId('rich-transcript-agent-elements-tool-bridge')).toHaveAttribute(
      'data-component',
      'rich-transcript-agent-elements-tool-bridge',
    );
    expect(screen.getByTestId('rich-transcript-agent-elements-tool-bridge')).toHaveClass('agent-elements-live-bridge');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'search');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-fallback-class', 'known');
    expect(screen.getByTestId('agent-elements-search-tool-card')).toHaveTextContent('/repo/src/app.ts');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('"file_path"');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
  });

  it('proves live MCP, generic, and non-built-in shell rows use first-class Agent Elements tool renderers', () => {
    renderTranscript([
      {
        ...makeToolMessage('exec_command', {
          description: 'Run focused validation',
          arguments: { cmd: 'npm run typecheck --workspace @nimbalyst/runtime', workdir: '/repo' },
          result: 'Typecheck passed.',
          exitCode: 0,
        }),
        id: 41,
        sequence: 41,
      },
      {
        ...makeToolMessage('mcp__github__list_issues', {
          description: 'List open issues',
          arguments: { query: 'is:issue is:open', limit: 2 },
          mcpServer: 'github',
          mcpTool: 'list_issues',
          result: JSON.stringify({ rows: [{ title: 'raw mcp row' }] }),
        }),
        id: 42,
        sequence: 42,
      },
      {
        ...makeToolMessage('workspace_summary', {
          toolDisplayName: 'Workspace summary',
          description: 'Summarize workspace metadata',
          arguments: { includeFiles: true },
          result: JSON.stringify({ rows: [{ title: 'raw generic row' }] }),
        }),
        id: 43,
        sequence: 43,
      },
    ]);

    const bridges = screen.getAllByTestId('rich-transcript-agent-elements-tool-bridge');
    expect(bridges).toHaveLength(3);
    for (const bridge of bridges) {
      expect(bridge).toHaveClass('agent-elements-live-bridge');
      expect(bridge).toHaveAttribute('data-component', 'rich-transcript-agent-elements-tool-bridge');
    }

    const boundaries = screen.getAllByTestId('agent-elements-renderer-boundary');
    expect(boundaries.map((boundary) => boundary.getAttribute('data-renderer-kind'))).toEqual(['bash', 'mcp', 'genericTool']);
    expect(boundaries.every((boundary) => boundary.getAttribute('data-fallback-class') === 'known')).toBe(true);
    expect(screen.getByTestId('agent-elements-command-terminal')).toHaveTextContent('npm run typecheck --workspace @nimbalyst/runtime');
    expect(screen.getByTestId('agent-elements-command-terminal')).toHaveTextContent('Typecheck passed.');
    expect(screen.getByTestId('agent-elements-mcp-tool-card')).toHaveTextContent('github');
    expect(screen.getByTestId('agent-elements-mcp-tool-card')).toHaveTextContent('list_issues');
    expect(screen.getByTestId('agent-elements-mcp-result')).toHaveTextContent('Structured result available in debug details.');
    expect(screen.getByTestId('agent-elements-generic-tool-card')).toHaveTextContent('Workspace summary');
    expect(screen.getByTestId('agent-elements-generic-result')).toHaveTextContent('Structured result available in debug details.');
    for (const primary of screen.getAllByTestId('agent-elements-tool-primary')) {
      expect(primary).not.toHaveTextContent('raw mcp row');
      expect(primary).not.toHaveTextContent('raw generic row');
      expect(primary).not.toHaveTextContent('"includeFiles"');
    }
  });

  it('preserves ToolCallChanges diffs for Agent Elements generic tool rows', async () => {
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
    const { container } = renderTranscript([
      makeToolMessage('workspace_summary', {
        toolDisplayName: 'Workspace summary',
        providerToolCallId: 'tool-workspace-summary',
        description: 'Summarize workspace metadata',
        arguments: { includeFiles: true },
        result: JSON.stringify({ ok: true }),
      }),
    ], { getToolCallDiffs, onOpenFile, workspacePath: '/repo' });

    await waitFor(() => expect(screen.getByText('File Changes')).toBeInTheDocument());
    expect(getToolCallDiffs).toHaveBeenCalledWith('tool-workspace-summary', expect.any(Number));
    expect(screen.getByTestId('rich-transcript-agent-elements-tool-bridge')).toHaveClass('agent-elements-live-bridge');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'genericTool');

    fireEvent.click(screen.getByText('File Changes').closest('button')!);
    expect(container.querySelector('.diff-viewer')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Open src/app.ts'));
    expect(onOpenFile).toHaveBeenCalledWith('/repo/src/app.ts');
  });

  it('keeps built-in Bash custom widgets on their existing path while adding the Agent Elements shell', () => {
    const { container } = renderTranscript([
      makeToolMessage('Bash', {
        description: 'Run focused validation',
        arguments: { command: 'npm run typecheck --workspace @nimbalyst/runtime' },
        result: 'ok',
      }),
    ]);

    expect(container.querySelector('.bash-widget')).toBeInTheDocument();
    expect(screen.getByTestId('rich-transcript-agent-elements-bash-shell')).toHaveAttribute(
      'data-component',
      'RichTranscriptAgentElementsBashShell',
    );
    expect(screen.getByTestId('rich-transcript-agent-elements-bash-shell')).toHaveAttribute('data-agent-elements-shell', 'tool-card');
    expect(screen.getByTestId('rich-transcript-agent-elements-bash-shell')).toHaveClass('agent-elements-bash-tool-card');
    expect(screen.getByTestId('rich-transcript-agent-elements-bash-shell')).not.toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('rich-transcript-agent-elements-bash-shell')).toHaveAttribute('data-bash-state', 'collapsed');
    expect(screen.queryByTestId('agent-elements-renderer-boundary')).not.toBeInTheDocument();
  });

  it('keeps pending interactive tool-call widgets visible when tool rows are hidden', () => {
    const permissionMessage = makeToolMessage('ToolPermission', {
      arguments: {
        requestId: 'permission-1',
        toolName: 'Bash',
        rawCommand: 'npm run typecheck',
        pattern: 'npm run typecheck',
        patternDisplayName: 'Typecheck command',
        isDestructive: false,
      },
      providerToolCallId: 'permission-1',
      result: undefined,
    });
    const questionMessage = makeToolMessage('AskUserQuestion', {
      arguments: {
        questions: [
          {
            header: 'Scope',
            question: 'Which surface should be styled next?',
            options: [
              { label: 'Transcript', description: 'Continue transcript integration.' },
              { label: 'Settings', description: 'Wait for daily-driver landing.' },
            ],
          },
        ],
      },
      providerToolCallId: 'question-1',
      result: undefined,
    });
    const exitPlanMessage = makeToolMessage('ExitPlanMode', {
      arguments: {
        planFilePath: 'plan.md',
      },
      providerToolCallId: 'exit-plan-1',
      result: undefined,
    });
    const gitCommitMessage = makeToolMessage('mcp__nimbalyst-mcp__developer_git_commit_proposal', {
      arguments: {
        commitMessage: 'fix: keep commit prompt visible',
        filesToStage: [{ path: 'src/app.ts', status: 'modified' }],
        reasoning: 'Commit proposal should stay actionable when tool rows are hidden.',
      },
      providerToolCallId: 'git-commit-1',
      result: undefined,
    });

    renderTranscript([
      {
        ...permissionMessage,
        id: 31,
        sequence: 31,
      },
      {
        ...questionMessage,
        id: 32,
        sequence: 32,
      },
      {
        ...exitPlanMessage,
        id: 33,
        sequence: 33,
      },
      {
        ...gitCommitMessage,
        id: 34,
        sequence: 34,
      },
    ], {
      settings: {
        showToolCalls: false,
        showThinking: true,
        compactMode: false,
        collapseTools: false,
        showSessionInit: false,
      },
    });

    expect(screen.getByTestId('tool-permission-widget')).toBeInTheDocument();
    expect(screen.getByTestId('ask-user-question-widget')).toBeInTheDocument();
    expect(screen.getByTestId('exit-plan-mode-widget')).toBeInTheDocument();
    expect(screen.getByTestId('git-commit-widget')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-elements-renderer-boundary')).not.toBeInTheDocument();
  });

  it('wraps concrete edit tools in the Agent Elements edit shell while preserving red-green edit behavior', () => {
    const onOpenFile = vi.fn();
    const { container } = renderTranscript([
      makeToolMessage('Edit', {
        description: 'Update source',
        arguments: { file_path: '/repo/src/app.ts' },
        targetFilePath: '/repo/src/app.ts',
        result: JSON.stringify({
          success: true,
          edits: [
            {
              filePath: '/repo/src/app.ts',
              replacements: [{ oldText: 'const value = 1;', newText: 'const value = 2;' }],
            },
          ],
        }),
      }),
    ], { onOpenFile });

    expect(screen.getByTestId('rich-transcript-agent-elements-edit-bridge')).toHaveAttribute(
      'data-component',
      'rich-transcript-agent-elements-edit-bridge',
    );
    expect(screen.getByTestId('rich-transcript-agent-elements-edit-bridge')).toHaveClass('agent-elements-live-bridge');
    expect(container.querySelector('.rich-transcript-edit-card')).toBeInTheDocument();
    expect(screen.getByTestId('rich-transcript-agent-elements-edit-card')).toHaveAttribute(
      'data-component',
      'RichTranscriptAgentElementsEditCard',
    );
    expect(screen.getByTestId('rich-transcript-agent-elements-edit-card')).toHaveClass('agent-elements-edit-tool-card');
    expect(container.querySelector('.diff-viewer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open file' }));
    expect(onOpenFile).toHaveBeenCalledWith('/repo/src/app.ts');
    expect(screen.queryByTestId('agent-elements-renderer-boundary')).not.toBeInTheDocument();
  });

  it('preserves new-file previews inside the Agent Elements edit shell', () => {
    const { container } = renderTranscript([
      makeToolMessage('ApplyPatch', {
        description: 'Create source file',
        arguments: {
          changes: {
            '/repo/src/new-file.ts': {
              type: 'add',
              content: 'export const created = true;\n',
            },
          },
        },
        targetFilePath: '/repo/src/new-file.ts',
        result: JSON.stringify({ success: true }),
      }),
    ], { workspacePath: '/repo' });

    expect(screen.getByTestId('rich-transcript-agent-elements-edit-bridge')).toHaveClass('agent-elements-live-bridge');
    expect(screen.getByTestId('rich-transcript-agent-elements-edit-card')).toHaveClass('agent-elements-edit-tool-card');
    expect(container.querySelector('.new-file-preview')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getAllByText('src/new-file.ts').length).toBeGreaterThan(0);
    expect(container.querySelector('.new-file-preview')).toHaveTextContent('export const created = true;');
  });

  it('preserves embedded previews inside the Agent Elements edit shell', () => {
    const renderEmbeddedFile = vi.fn(({ filePath, defaultExpanded }) => (
      <div data-testid="embedded-edit-preview">
        {filePath}
        {' '}
        {defaultExpanded ? 'expanded' : 'collapsed'}
      </div>
    ));
    const canEmbedFile = vi.fn((filePath: string) => filePath.endsWith('.mockup.html'));
    const { container } = renderTranscript([
      makeToolMessage('ApplyPatch', {
        description: 'Create mockup file',
        arguments: {
          changes: {
            '/repo/ui/example.mockup.html': {
              type: 'add',
              content: '<main>Preview</main>\n',
            },
          },
        },
        targetFilePath: '/repo/ui/example.mockup.html',
        result: JSON.stringify({ success: true }),
      }),
    ], { workspacePath: '/repo', renderEmbeddedFile, canEmbedFile });

    expect(screen.getByTestId('rich-transcript-agent-elements-edit-bridge')).toHaveClass('agent-elements-live-bridge');
    expect(screen.getByTestId('rich-transcript-agent-elements-edit-card')).toHaveClass('agent-elements-edit-tool-card');
    expect(screen.getByTestId('embedded-edit-preview')).toHaveTextContent('/repo/ui/example.mockup.html expanded');
    expect(renderEmbeddedFile).toHaveBeenCalledWith({ filePath: '/repo/ui/example.mockup.html', defaultExpanded: true });
    expect(container.querySelector('.new-file-preview')).not.toBeInTheDocument();
  });

  it('wraps async file_change diffs in the Agent Elements edit shell while preserving diff fetching', async () => {
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
    const { container } = renderTranscript([
      makeToolMessage('file_change', {
        arguments: { changes: [{ path: '/repo/src/app.ts', kind: 'update' }] },
        result: JSON.stringify({ success: true, changes: [{ path: '/repo/src/app.ts', kind: 'update' }] }),
      }),
    ], { getToolCallDiffs, onOpenFile });

    await waitFor(() => expect(container.querySelector('.rich-transcript-edit-card')).toBeInTheDocument());
    expect(getToolCallDiffs).toHaveBeenCalledWith('tool-file_change', expect.any(Number));
    expect(screen.getByTestId('rich-transcript-agent-elements-edit-bridge')).toHaveClass('agent-elements-live-bridge');
    expect(screen.getByTestId('rich-transcript-agent-elements-edit-card')).toHaveClass('agent-elements-edit-tool-card');
    expect(container.querySelector('.diff-viewer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open file' }));
    expect(onOpenFile).toHaveBeenCalledWith('/repo/src/app.ts');
    expect(screen.queryByTestId('agent-elements-renderer-boundary')).not.toBeInTheDocument();
  });

  it('renders normal user message rows with the left-aligned Agent Elements transcript shell', () => {
    renderTranscript([
      {
        id: 11,
        sequence: 11,
        createdAt: new Date('2026-05-23T15:08:00Z'),
        type: 'user_message',
        subagentId: null,
        text: 'Please inspect the renderer.',
      },
    ]);

    expect(screen.getByTestId('rich-transcript-agent-elements-message-bridge')).toHaveAttribute(
      'data-component',
      'rich-transcript-agent-elements-message-bridge',
    );
    expect(screen.getByTestId('agent-elements-transcript-row')).toHaveAttribute('data-agent-align', 'left');
    expect(screen.getByTestId('agent-elements-transcript-row')).toHaveAttribute('data-agent-role', 'user');
    expect(screen.getByTestId('agent-elements-identity-row')).toHaveTextContent('You');
    expect(screen.getByText('Please inspect the renderer.')).toBeInTheDocument();
  });

  it('renders assistant thinking through the Agent Elements thinking card inside the live transcript row', () => {
    const { container } = renderTranscript([
      {
        id: 16,
        sequence: 16,
        createdAt: new Date('2026-05-23T16:24:00Z'),
        type: 'assistant_message',
        subagentId: null,
        model: 'gpt-5.5',
        thinking: 'Need to preserve the Daily Driver event contract before live wiring.',
        text: 'I will keep this display-only.',
      },
    ]);

    expect(screen.getByTestId('rich-transcript-agent-elements-thinking-bridge')).toHaveAttribute(
      'data-component',
      'rich-transcript-agent-elements-thinking-bridge',
    );
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'thinking');
    expect(screen.getByTestId('agent-elements-thinking-card')).toHaveAttribute('data-component', 'AgentThinkingCard');
    expect(screen.getByTestId('agent-elements-thinking-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('.rich-transcript-thinking')).not.toBeInTheDocument();
    expect(screen.getByText('I will keep this display-only.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('agent-elements-thinking-toggle'));
    expect(screen.getByTestId('agent-elements-thinking-content')).toHaveTextContent('Daily Driver event contract');
  });

  it('honors showThinking=false without falling back to the legacy thinking block', () => {
    const { container } = renderTranscript([
      {
        id: 17,
        sequence: 17,
        createdAt: new Date('2026-05-23T16:29:00Z'),
        type: 'assistant_message',
        subagentId: null,
        model: 'gpt-5.5',
        thinking: 'This hidden reasoning should not render in either thinking surface.',
        text: 'Visible assistant body stays rendered.',
      },
    ], {
      settings: {
        showToolCalls: true,
        showThinking: false,
        compactMode: false,
        collapseTools: false,
        showSessionInit: false,
      },
    });

    expect(screen.queryByTestId('rich-transcript-agent-elements-thinking-bridge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-elements-thinking-card')).not.toBeInTheDocument();
    expect(container.querySelector('.rich-transcript-thinking')).not.toBeInTheDocument();
    expect(screen.queryByText('This hidden reasoning should not render')).not.toBeInTheDocument();
    expect(screen.getByText('Visible assistant body stays rendered.')).toBeInTheDocument();
  });

  it('keeps upstream API service-error system rows on the MessageSegment widget path', () => {
    const { container } = renderTranscript([
      {
        id: 12,
        sequence: 12,
        createdAt: new Date('2026-05-23T15:10:00Z'),
        type: 'system_message',
        subagentId: null,
        text: 'API Error: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"},"request_id":"req_1234567890"} Check https://status.claude.com',
        isError: true,
        systemMessage: {
          systemType: 'error',
          statusCode: 'service_error',
        },
      },
    ]);

    expect(container.querySelector('.api-service-error-widget')).toBeInTheDocument();
    expect(screen.getByText('The Claude API is temporarily overloaded')).toBeInTheDocument();
    expect(screen.queryByTestId('rich-transcript-agent-elements-message-bridge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-elements-renderer-boundary')).not.toBeInTheDocument();
  });

  it('keeps context-limit system errors on the MessageSegment widget path', () => {
    const { container } = renderTranscript([
      {
        id: 17,
        sequence: 17,
        createdAt: new Date('2026-05-23T15:11:00Z'),
        type: 'system_message',
        subagentId: null,
        text: 'Prompt is too long for this model and exceeds maximum context length.',
        isError: true,
        systemMessage: {
          systemType: 'error',
          statusCode: 'service_error',
        },
      },
    ]);

    expect(container.querySelector('.context-limit-widget')).toBeInTheDocument();
    expect(screen.getByText('Context limit exceeded')).toBeInTheDocument();
    expect(screen.queryByTestId('rich-transcript-agent-elements-message-bridge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-elements-renderer-boundary')).not.toBeInTheDocument();
  });

  it('renders generic system errors through the Agent Elements system status bridge', () => {
    const { container } = renderTranscript([
      {
        id: 21,
        sequence: 21,
        createdAt: new Date('2026-05-23T17:54:00Z'),
        type: 'system_message',
        subagentId: null,
        text: 'Provider returned an unclassified service failure.',
        isError: true,
        systemMessage: {
          systemType: 'error',
          statusCode: 'service_error',
        },
      },
    ]);

    expect(screen.getByTestId('rich-transcript-agent-elements-system-bridge')).toHaveAttribute(
      'data-component',
      'rich-transcript-agent-elements-system-bridge',
    );
    expect(screen.getByTestId('rich-transcript-agent-elements-system-bridge')).toHaveClass('agent-elements-live-bridge');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'systemStatus');
    expect(screen.getByTestId('agent-elements-error-message-card')).toHaveAttribute('data-error-kind', 'service_error');
    expect(screen.getByTestId('agent-elements-error-message-body')).toHaveTextContent('unclassified service failure');
    expect(container.querySelector('.api-service-error-widget')).not.toBeInTheDocument();
    expect(container.querySelector('.context-limit-widget')).not.toBeInTheDocument();
  });

  it('renders generic non-reminder system status rows through the Agent Elements system status bridge', () => {
    const { container } = renderTranscript([
      {
        id: 22,
        sequence: 22,
        createdAt: new Date('2026-05-23T18:02:00Z'),
        type: 'system_message',
        subagentId: null,
        text: 'Runtime connected to smarty-server.',
        isError: false,
        systemMessage: {
          systemType: 'status',
          statusCode: 'info',
        },
      },
    ]);

    expect(screen.getByTestId('rich-transcript-agent-elements-system-bridge')).toHaveAttribute(
      'data-component',
      'rich-transcript-agent-elements-system-bridge',
    );
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'systemStatus');
    expect(screen.getByTestId('agent-elements-error-message-card')).toHaveAttribute('data-error-kind', 'info');
    expect(screen.getByTestId('agent-elements-error-message-body')).toHaveTextContent('Runtime connected to smarty-server.');
    expect(container.querySelector('.rich-transcript-system-reminder')).not.toBeInTheDocument();
  });

  it('renders canonical subagent rows without synthetic toolCall through the Agent Elements subagent card', () => {
    renderTranscript([
      {
        id: 18,
        sequence: 18,
        createdAt: new Date('2026-05-23T15:46:00Z'),
        type: 'subagent',
        subagentId: 'subagent-1',
        subagent: {
          agentType: 'reviewer',
          status: 'running',
          teammateName: 'Ada',
          teamName: null,
          teammateMode: 'review',
          model: 'gpt-5.5',
          color: null,
          isBackground: false,
          prompt: 'Review the transcript renderer.',
          resultSummary: 'Checking transcript contracts',
          durationMs: 1500,
          childEvents: [
            {
              id: 19,
              sequence: 19,
              createdAt: new Date('2026-05-23T15:46:01Z'),
              type: 'assistant_message',
              subagentId: 'subagent-1',
              text: 'Inspecting the renderer contract.',
            },
          ],
        },
      },
    ]);

    expect(screen.getByTestId('rich-transcript-agent-elements-subagent-bridge')).toHaveAttribute(
      'data-component',
      'rich-transcript-agent-elements-subagent-bridge',
    );
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'subagent');
    expect(screen.getByTestId('agent-elements-subagent-card')).toHaveTextContent('Running subagent');
    expect(screen.getByTestId('agent-elements-subagent-toggle')).toHaveTextContent('Ada');
    expect(screen.getByTestId('agent-elements-subagent-list')).toHaveTextContent('Inspecting the renderer contract.');
  });

  it('preserves grouped canonical subagent rows before assistant responses', () => {
    renderTranscript([
      {
        id: 20,
        sequence: 20,
        createdAt: new Date('2026-05-23T15:47:00Z'),
        type: 'subagent',
        subagentId: 'subagent-2',
        subagent: {
          agentType: 'explorer',
          status: 'completed',
          teammateName: null,
          teamName: null,
          teammateMode: null,
          model: 'gpt-5.5',
          color: null,
          isBackground: false,
          prompt: 'Inspect grouped transcript rows.',
          resultSummary: 'Found the grouped row contract',
          durationMs: 2100,
          childEvents: [],
        },
      },
      {
        id: 21,
        sequence: 21,
        createdAt: new Date('2026-05-23T15:47:02Z'),
        type: 'assistant_message',
        subagentId: null,
        text: 'I integrated the subagent finding.',
      },
    ]);

    expect(screen.getByTestId('rich-transcript-agent-elements-subagent-bridge')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'subagent');
    expect(screen.getByTestId('agent-elements-subagent-card')).toHaveTextContent('Found the grouped row contract');
    expect(screen.getByTestId('rich-transcript-agent-elements-message-bridge')).toBeInTheDocument();
    expect(screen.getByText('I integrated the subagent finding.')).toBeInTheDocument();
  });

  it('renders canonical interactive prompt rows without synthetic toolCall through the Agent Elements question card', () => {
    renderTranscript([
      {
        id: 22,
        sequence: 22,
        createdAt: new Date('2026-05-23T16:10:00Z'),
        type: 'interactive_prompt',
        subagentId: null,
        interactivePrompt: {
          promptType: 'permission_request',
          requestId: 'langgraph-interrupt-1',
          status: 'pending',
          toolName: 'Bash',
          rawCommand: 'npm run typecheck',
          pattern: 'npm run typecheck',
          patternDisplayName: 'Typecheck command',
          isDestructive: false,
          warnings: ['Runs in the current worktree.'],
        },
      },
    ]);

    expect(screen.getByTestId('rich-transcript-agent-elements-prompt-bridge')).toHaveAttribute(
      'data-component',
      'rich-transcript-agent-elements-prompt-bridge',
    );
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'humanInput');
    expect(screen.getByTestId('agent-elements-question-card')).toHaveAttribute('data-display-only', 'true');
    expect(screen.getByTestId('agent-elements-question-title')).toHaveTextContent('Allow Bash?');
    expect(screen.getByTestId('agent-elements-question-options')).toHaveAttribute('data-interactive', 'false');
    expect(screen.getByTestId('agent-elements-question-options')).toHaveTextContent('Allow');
    expect(screen.getByTestId('agent-elements-question-options')).toHaveTextContent('Deny');
    expect(screen.queryByRole('button', { name: /allow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deny/i })).not.toBeInTheDocument();
  });

  it('renders standalone stream metadata rows through Agent Elements stream cards', () => {
    renderTranscript([
      {
        id: 35,
        sequence: 35,
        createdAt: new Date('2026-05-23T17:01:00Z'),
        type: 'tool_progress',
        subagentId: null,
        text: 'Running repository checks',
      },
      {
        id: 36,
        sequence: 36,
        createdAt: new Date('2026-05-23T17:02:00Z'),
        type: 'turn_ended',
        subagentId: null,
        turnEnded: {
          contextFill: {
            inputTokens: 3000,
            cacheReadInputTokens: 200,
            cacheCreationInputTokens: 100,
            outputTokens: 500,
            totalContextTokens: 3800,
          },
          contextWindow: 7600,
          cumulativeUsage: {
            inputTokens: 6200,
            outputTokens: 1400,
            cacheReadInputTokens: 300,
            cacheCreationInputTokens: 120,
            costUSD: 0.42,
            webSearchRequests: 0,
          },
          contextCompacted: true,
        },
      },
    ]);

    const streamBridges = screen.getAllByTestId('rich-transcript-agent-elements-stream-bridge');
    expect(streamBridges).toHaveLength(2);
    expect(streamBridges[0]).toHaveAttribute('data-component', 'rich-transcript-agent-elements-stream-bridge');
    expect(screen.getAllByTestId('agent-elements-renderer-boundary')[0]).toHaveAttribute('data-renderer-kind', 'toolProgress');
    expect(screen.getByTestId('agent-elements-progress-card')).toHaveTextContent('Running repository checks');
    expect(screen.getAllByTestId('agent-elements-renderer-boundary')[1]).toHaveAttribute('data-renderer-kind', 'turnSummary');
    expect(screen.getByTestId('agent-elements-turn-summary-card')).toHaveAttribute('data-component', 'AgentTurnSummaryCard');
    expect(screen.getByTestId('agent-elements-turn-summary-metrics')).toHaveTextContent('7,600');
    expect(screen.getByTestId('agent-elements-turn-summary-metrics')).toHaveTextContent('50% context');
    expect(screen.getByTestId('agent-elements-turn-summary-warnings')).toHaveTextContent('Context was compacted');
  });

  it('renders projected canonical turn_ended rows through the Agent Elements turn summary bridge', () => {
    const events: TranscriptEvent[] = [
      {
        id: 71,
        sequence: 71,
        sessionId: 'agent-elements-live-bridge',
        provider: 'openai-codex',
        eventType: 'assistant_message',
        searchable: true,
        searchableText: 'Done.',
        payload: { mode: 'agent' },
        parentEventId: null,
        subagentId: null,
        providerToolCallId: null,
        createdAt: new Date('2026-05-23T18:01:00Z'),
      },
      {
        id: 72,
        sequence: 72,
        sessionId: 'agent-elements-live-bridge',
        provider: 'openai-codex',
        eventType: 'turn_ended',
        searchable: false,
        searchableText: null,
        payload: {
          contextFill: {
            inputTokens: 1100,
            cacheReadInputTokens: 100,
            cacheCreationInputTokens: 50,
            outputTokens: 300,
            totalContextTokens: 1550,
          },
          contextWindow: 3100,
          cumulativeUsage: {
            inputTokens: 2100,
            outputTokens: 500,
            cacheReadInputTokens: 100,
            cacheCreationInputTokens: 50,
            costUSD: 0.13,
            webSearchRequests: 0,
          },
          contextCompacted: false,
        },
        parentEventId: null,
        subagentId: null,
        providerToolCallId: null,
        createdAt: new Date('2026-05-23T18:02:00Z'),
      },
    ];

    renderTranscript(TranscriptProjector.project(events).messages);

    expect(screen.getByTestId('rich-transcript-agent-elements-stream-bridge')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'turnSummary');
    expect(screen.getByTestId('agent-elements-turn-summary-card')).toHaveAttribute('data-component', 'AgentTurnSummaryCard');
    expect(screen.getByTestId('agent-elements-turn-summary-metrics')).toHaveTextContent('2,600');
    expect(screen.getByTestId('agent-elements-turn-summary-metrics')).toHaveTextContent('50% context');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('"contextFill"');
  });

  it('renders live todo and plan tool rows through Agent Elements todo and plan cards', () => {
    renderTranscript([
      {
        ...makeToolMessage('TodoWrite', {
          description: 'Update task list',
          arguments: {
            todos: [
              { id: 'todo-1', content: 'Replace raw todo JSON', status: 'completed' },
              { id: 'todo-2', content: 'Bridge live plan rows', status: 'in_progress' },
            ],
          },
          result: JSON.stringify({
            todos: [
              { content: 'Replace raw todo JSON', status: 'completed' },
              { content: 'Bridge live plan rows', status: 'in_progress' },
            ],
          }),
        }),
        id: 37,
        sequence: 37,
      },
      {
        ...makeToolMessage('update_plan', {
          description: 'Record plan update',
          arguments: {
            title: 'Agent Elements live todo and plan bridge',
            file_path: 'docs/agent-elements-app-redesign-rider.md',
            steps: [
              { step: 'Add red coverage', status: 'completed' },
              { step: 'Patch projection adapter', status: 'in_progress' },
            ],
          },
          result: 'Plan updated.',
        }),
        id: 38,
        sequence: 38,
      },
    ]);

    const bridges = screen.getAllByTestId('rich-transcript-agent-elements-tool-bridge');
    expect(bridges).toHaveLength(2);
    expect(screen.getAllByTestId('agent-elements-renderer-boundary')[0]).toHaveAttribute('data-renderer-kind', 'todo');
    const todoList = screen.getAllByTestId('agent-elements-todo-list')[0];
    expect(todoList).toHaveTextContent('Replace raw todo JSON');
    expect(todoList).toHaveTextContent('Bridge live plan rows');
    expect(screen.getAllByTestId('agent-elements-renderer-boundary')[1]).toHaveAttribute('data-renderer-kind', 'plan');
    const planCard = screen.getByTestId('agent-elements-plan-card');
    expect(planCard).toHaveTextContent('Agent Elements live todo and plan bridge');
    expect(planCard).toHaveTextContent('Patch projection adapter');
    expect(todoList).not.toHaveTextContent('"todos"');
    expect(planCard).not.toHaveTextContent('"steps"');
  });

  it('preserves grouped canonical interactive prompt rows before assistant responses', () => {
    renderTranscript([
      {
        id: 23,
        sequence: 23,
        createdAt: new Date('2026-05-23T16:11:00Z'),
        type: 'interactive_prompt',
        subagentId: null,
        interactivePrompt: {
          promptType: 'ask_user_question',
          requestId: 'question-1',
          status: 'pending',
          questions: [
            {
              header: 'Scope',
              question: 'Which surface should be styled next?',
              options: [
                { label: 'Transcript', description: 'Continue transcript integration.' },
                { label: 'Settings', description: 'Wait for daily-driver landing.' },
              ],
            },
          ],
        },
      },
      {
        id: 24,
        sequence: 24,
        createdAt: new Date('2026-05-23T16:11:03Z'),
        type: 'assistant_message',
        subagentId: null,
        text: 'I will wait for the answer before changing behavior.',
      },
    ]);

    expect(screen.getByTestId('rich-transcript-agent-elements-prompt-bridge')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'humanInput');
    expect(screen.getByTestId('agent-elements-question-title')).toHaveTextContent('Which surface should be styled next?');
    expect(screen.getByTestId('rich-transcript-agent-elements-message-bridge')).toBeInTheDocument();
    expect(screen.getByText('I will wait for the answer before changing behavior.')).toBeInTheDocument();
  });

  it('renders assistant rows with the Agent Elements transcript shell while preserving grouped tool rows', () => {
    renderTranscript([
      makeToolMessage('Read'),
      {
        id: 13,
        sequence: 13,
        createdAt: new Date('2026-05-23T15:12:00Z'),
        type: 'assistant_message',
        subagentId: null,
        text: 'I inspected the renderer.',
        model: 'gpt-5.5',
      },
    ]);

    const bridgeRows = screen.getAllByTestId('rich-transcript-agent-elements-message-bridge');
    expect(bridgeRows).toHaveLength(1);
    expect(screen.getByTestId('agent-elements-transcript-row')).toHaveAttribute('data-agent-role', 'assistant');
    expect(screen.getByTestId('agent-elements-identity-row')).toHaveTextContent('OpenAI');
    expect(screen.getByTestId('agent-elements-identity-row')).toHaveTextContent('gpt-5.5');
    expect(screen.getByTestId('rich-transcript-agent-elements-tool-bridge')).toBeInTheDocument();
    expect(screen.getByText('I inspected the renderer.')).toBeInTheDocument();
  });

  it('keeps system reminders on the existing SystemReminderCard path', () => {
    const { container } = renderTranscript([
      {
        id: 14,
        sequence: 14,
        createdAt: new Date('2026-05-23T15:13:00Z'),
        type: 'system_message',
        subagentId: null,
        text: '<SYSTEM_REMINDER>Resume the existing session.</SYSTEM_REMINDER>',
        systemMessage: {
          systemType: 'status',
          reminderKind: 'wakeup_resume',
        },
      },
    ]);

    expect(container.querySelector('.rich-transcript-system-reminder')).toBeInTheDocument();
    expect(screen.queryByTestId('rich-transcript-agent-elements-message-bridge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-elements-renderer-boundary')).not.toBeInTheDocument();
  });

  it('keeps teammate notifications on the compact notification path', () => {
    const { container } = renderTranscript([
      {
        id: 15,
        sequence: 15,
        createdAt: new Date('2026-05-23T15:14:00Z'),
        type: 'user_message',
        subagentId: null,
        text: 'The explorer found the risky branches.',
        metadata: {
          isTeammateMessage: true,
          teammateName: 'Cicero',
        },
      },
    ]);

    expect(container.querySelector('.rich-transcript-teammate-notification')).toBeInTheDocument();
    expect(screen.getByText(/Received message from agent Cicero/)).toBeInTheDocument();
    expect(screen.queryByTestId('rich-transcript-agent-elements-message-bridge')).not.toBeInTheDocument();
  });

  it('preserves copy and collapse controls inside Agent Elements message rows', async () => {
    const longText = `Please inspect the renderer. ${'Long content. '.repeat(24)}`;
    const { container } = renderTranscript([
      {
        id: 16,
        sequence: 16,
        createdAt: new Date('2026-05-23T15:15:00Z'),
        type: 'user_message',
        subagentId: null,
        text: longText,
      },
    ]);

    fireEvent.click(screen.getByTitle('Copy as Markdown'));
    await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith(longText));

    expect(container.querySelector('.max-h-20')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Collapse message'));
    expect(container.querySelector('.max-h-20')).toBeInTheDocument();
    expect(screen.getByTitle('Show full message')).toBeInTheDocument();
  });
});
