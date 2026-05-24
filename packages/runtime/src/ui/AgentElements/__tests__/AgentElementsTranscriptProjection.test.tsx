import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TranscriptViewMessage } from '../../../ai/server/transcript/TranscriptProjector';
import type { TranscriptEvent } from '../../../ai/server/transcript/types';
import {
  AgentElementsEventRenderer,
  getAgentElementsRendererDescriptor,
} from '../AgentElementsRendererRegistry';
import {
  projectTranscriptEventsToAgentElementsModels,
  projectFrameworkStreamEventsToAgentElementsModels,
  projectTranscriptViewMessagesToAgentElementsModels,
  projectTranscriptViewMessageToAgentElementsModels,
} from '../AgentElementsTranscriptProjection';

function makeMessage(overrides: Partial<TranscriptViewMessage> & { type: TranscriptViewMessage['type'] }): TranscriptViewMessage {
  return {
    id: overrides.id ?? 1,
    sequence: overrides.sequence ?? 1,
    createdAt: overrides.createdAt ?? new Date('2026-05-23T13:45:00Z'),
    subagentId: overrides.subagentId ?? null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<TranscriptEvent> & { eventType: TranscriptEvent['eventType']; sequence: number }): TranscriptEvent {
  return {
    id: overrides.id ?? overrides.sequence,
    sessionId: overrides.sessionId ?? 'agent-elements-projection-session',
    sequence: overrides.sequence,
    createdAt: overrides.createdAt ?? new Date(`2026-05-23T13:45:${String(overrides.sequence).padStart(2, '0')}Z`),
    eventType: overrides.eventType,
    searchableText: overrides.searchableText ?? null,
    payload: overrides.payload ?? {},
    parentEventId: overrides.parentEventId ?? null,
    searchable: overrides.searchable ?? false,
    subagentId: overrides.subagentId ?? null,
    provider: overrides.provider ?? 'openai-codex',
    providerToolCallId: overrides.providerToolCallId ?? null,
  };
}

describe('Agent Elements transcript projection adapter', () => {
  it('maps user and assistant transcript messages to left-aligned message renderers', () => {
    const userMessage = makeMessage({
      type: 'user_message',
      text: 'Please update the Files Edited validation view.',
      mode: 'agent',
      attachments: [
        {
          id: 'att-1',
          filename: 'daily-driver-agent-ux-bridge.md',
          filepath: '/workspace/docs/daily-driver-agent-ux-bridge.md',
          mimeType: 'text/markdown',
          size: 1042,
          type: 'file',
        },
      ],
    });

    const assistantMessage = makeMessage({
      id: 2,
      sequence: 2,
      type: 'assistant_message',
      text: 'I will keep the adapter isolated from live transcript wiring.',
      thinking: 'Need to preserve Daily Driver contracts first.',
      model: 'smarty_coding_agent',
      mode: 'agent',
    });

    const models = projectTranscriptViewMessagesToAgentElementsModels([userMessage, assistantMessage]);

    expect(models.map((model) => model.kind)).toEqual(['userMessage', 'thinking', 'assistantMessage']);
    for (const model of models) {
      expect(getAgentElementsRendererDescriptor(model).fallbackClass).toBe('known');
    }
    expect(models[0].attachments?.[0]).toMatchObject({
      name: 'daily-driver-agent-ux-bridge.md',
      detail: '/workspace/docs/daily-driver-agent-ux-bridge.md',
      kind: 'file',
    });
    expect(models[2].actor?.metadata).toBe('smarty_coding_agent');

    render(<AgentElementsEventRenderer model={models[0]} />);

    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'userMessage');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-fallback-class', 'known');
    expect(screen.getByTestId('agent-elements-transcript-row')).toHaveAttribute('data-agent-align', 'left');
    expect(screen.getByTestId('agent-elements-user-message-body')).toHaveTextContent('Files Edited validation');
    expect(screen.getByTestId('agent-elements-user-message-body')).not.toHaveTextContent('"filepath"');
  });

  it('classifies canonical tool calls into specific Agent Elements tool renderers', () => {
    const bash = makeMessage({
      type: 'tool_call',
      toolCall: {
        toolName: 'Bash',
        toolDisplayName: 'Bash',
        status: 'completed',
        description: 'Run tests',
        arguments: { command: 'npm test', cwd: '/workspace/forks/nimbalyst' },
        targetFilePath: null,
        mcpServer: null,
        mcpTool: null,
        result: 'PASS AgentElementsTranscriptProjection',
        exitCode: 0,
        providerToolCallId: 'tool-bash',
        progress: [],
      },
    });

    const fileChange = makeMessage({
      id: 2,
      sequence: 2,
      type: 'tool_call',
      toolCall: {
        toolName: 'file_change',
        toolDisplayName: 'File change',
        status: 'completed',
        description: 'Edited adapter source',
        arguments: { path: 'packages/runtime/src/ui/AgentElements/AgentElementsTranscriptProjection.ts' },
        targetFilePath: 'packages/runtime/src/ui/AgentElements/AgentElementsTranscriptProjection.ts',
        mcpServer: null,
        mcpTool: null,
        result: 'updated projection adapter',
        changes: [
          {
            path: 'packages/runtime/src/ui/AgentElements/AgentElementsTranscriptProjection.ts',
            patch: '-return <JSONViewer />;\n+return <AgentElementsEventRenderer />;',
          },
        ],
        providerToolCallId: 'tool-edit',
        progress: [],
      },
    });

    const grep = makeMessage({
      id: 3,
      sequence: 3,
      type: 'tool_call',
      toolCall: {
        toolName: 'Grep',
        toolDisplayName: 'Grep',
        status: 'completed',
        description: 'Search source',
        arguments: { pattern: 'TranscriptViewMessage', path: 'packages/runtime/src' },
        targetFilePath: null,
        mcpServer: null,
        mcpTool: null,
        result: 'packages/runtime/src/ai/server/transcript/TranscriptProjector.ts:29',
        providerToolCallId: 'tool-grep',
        progress: [{ elapsedSeconds: 3, progressContent: '2 matches' }],
      },
    });

    const mcp = makeMessage({
      id: 4,
      sequence: 4,
      type: 'tool_call',
      toolCall: {
        toolName: 'mcp__github__search_pull_requests',
        toolDisplayName: 'Search pull requests',
        status: 'completed',
        description: 'Find open PRs',
        arguments: { query: 'is:pr is:open', limit: 5 },
        targetFilePath: null,
        mcpServer: 'github',
        mcpTool: 'search_pull_requests',
        result: 'Found 3 open PRs.',
        providerToolCallId: 'tool-mcp',
        progress: [],
      },
    });

    const generic = makeMessage({
      id: 5,
      sequence: 5,
      type: 'tool_call',
      toolCall: {
        toolName: 'update_session_meta',
        toolDisplayName: 'Update session metadata',
        status: 'running',
        description: 'Session metadata update',
        arguments: { phase: 'renderer-adapter' },
        targetFilePath: null,
        mcpServer: null,
        mcpTool: null,
        providerToolCallId: 'tool-generic',
        progress: [],
      },
    });

    const incompleteFileChange = makeMessage({
      id: 6,
      sequence: 6,
      type: 'tool_call',
      toolCall: {
        toolName: 'file_change',
        toolDisplayName: 'File change',
        status: 'completed',
        description: 'No diff payload was available.',
        arguments: {},
        targetFilePath: null,
        mcpServer: null,
        mcpTool: null,
        result: 'changed',
        providerToolCallId: 'tool-edit-no-diff',
        progress: [],
      },
    });

    const models = projectTranscriptViewMessagesToAgentElementsModels([bash, fileChange, grep, mcp, generic, incompleteFileChange]);

    expect(models.map((model) => model.kind)).toEqual(['bash', 'fileEdit', 'search', 'mcp', 'genericTool', 'genericTool']);
    expect(models.every((model) => getAgentElementsRendererDescriptor(model).fallbackClass === 'known')).toBe(true);
    expect(models[0]).toMatchObject({ command: 'npm test', cwd: '/workspace/forks/nimbalyst', exitCode: 0 });
    expect(models[1].diffLines).toEqual([
      { type: 'remove', content: 'return <JSONViewer />;' },
      { type: 'add', content: 'return <AgentElementsEventRenderer />;' },
    ]);
    expect(models[2].progressUpdates?.[0]).toMatchObject({ label: '2 matches', detail: '3s elapsed' });
    expect(models[3]).toMatchObject({ serverName: 'github', toolName: 'search_pull_requests' });

    render(<AgentElementsEventRenderer model={models[1]} />);

    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'fileEdit');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-fallback-class', 'known');
    expect(screen.getByTestId('agent-elements-diff')).toHaveTextContent('AgentElementsEventRenderer');
    expect(screen.getByTestId('agent-elements-diff')).not.toHaveTextContent('"changes"');
  });

  it('maps todo and plan tool calls to first-class Agent Elements renderers', () => {
    const todoWrite = makeMessage({
      type: 'tool_call',
      toolCall: {
        toolName: 'TodoWrite',
        toolDisplayName: 'TodoWrite',
        status: 'completed',
        description: 'Update the task list',
        arguments: {
          todos: [
            { id: 'todo-1', content: 'Map remaining event rows', status: 'completed' },
            { id: 'todo-2', content: 'Bridge live plan rows', status: 'in_progress' },
          ],
        },
        targetFilePath: null,
        mcpServer: null,
        mcpTool: null,
        result: JSON.stringify({
          todos: [
            { content: 'Map remaining event rows', status: 'completed' },
            { content: 'Bridge live plan rows', status: 'in_progress' },
          ],
        }),
        providerToolCallId: 'tool-todo-write',
        progress: [],
      },
    });

    const codexTodoList = makeMessage({
      id: 2,
      sequence: 2,
      type: 'tool_call',
      toolCall: {
        toolName: 'todo_list',
        toolDisplayName: 'Todo list',
        status: 'running',
        description: 'Stream todo updates',
        arguments: {
          items: [
            { text: 'Keep rows left aligned', status: 'active' },
          ],
        },
        targetFilePath: null,
        mcpServer: null,
        mcpTool: null,
        providerToolCallId: 'tool-todo-list',
        progress: [],
      },
    });

    const updatePlan = makeMessage({
      id: 3,
      sequence: 3,
      type: 'tool_call',
      toolCall: {
        toolName: 'update_plan',
        toolDisplayName: 'Update plan',
        status: 'completed',
        description: 'Record implementation steps',
        arguments: {
          title: 'Todo and plan live bridge',
          file_path: 'docs/agent-elements-app-redesign-rider.md',
          steps: [
            { step: 'Add failing live coverage', status: 'completed' },
            { step: 'Map plan steps to Agent Elements', status: 'in_progress' },
          ],
        },
        targetFilePath: null,
        mcpServer: null,
        mcpTool: null,
        result: 'Plan updated.',
        providerToolCallId: 'tool-update-plan',
        progress: [],
      },
    });

    const models = projectTranscriptViewMessagesToAgentElementsModels([todoWrite, codexTodoList, updatePlan]);

    expect(models.map((model) => model.kind)).toEqual(['todo', 'todo', 'plan']);
    expect(models.every((model) => getAgentElementsRendererDescriptor(model).fallbackClass === 'known')).toBe(true);
    expect(models[0].todos?.map((todo) => todo.content)).toEqual([
      'Map remaining event rows',
      'Bridge live plan rows',
    ]);
    expect(models[1]).toMatchObject({ status: 'running', isStreaming: true });
    expect(models[2]).toMatchObject({
      title: 'Todo and plan live bridge',
      filePath: 'docs/agent-elements-app-redesign-rider.md',
    });
    expect(models[2].planSteps?.map((step) => step.label)).toEqual([
      'Add failing live coverage',
      'Map plan steps to Agent Elements',
    ]);

    render(<AgentElementsEventRenderer model={models[2]} />);

    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'plan');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-fallback-class', 'known');
    const planCard = screen.getByTestId('agent-elements-plan-card');
    expect(planCard).toHaveTextContent('Todo and plan live bridge');
    expect(planCard).toHaveTextContent('Add failing live coverage');
    expect(planCard).not.toHaveTextContent('"steps"');
  });

  it('keeps serialized MCP and generic tool results out of primary UI', () => {
    const serializedResult = JSON.stringify({
      foo: 'bar',
      rows: [{ id: 1, title: 'raw payload row' }],
    });
    const mcp = makeMessage({
      type: 'tool_call',
      toolCall: {
        toolName: 'mcp__github__list_issues',
        toolDisplayName: 'List issues',
        status: 'completed',
        description: 'Load issue rows',
        arguments: { query: 'is:issue is:open' },
        targetFilePath: null,
        mcpServer: 'github',
        mcpTool: 'list_issues',
        result: serializedResult,
        providerToolCallId: 'tool-mcp-json',
        progress: [],
      },
    });
    const generic = makeMessage({
      id: 2,
      sequence: 2,
      type: 'tool_call',
      toolCall: {
        toolName: 'workspace_summary',
        toolDisplayName: 'Workspace summary',
        status: 'completed',
        description: 'Summarize workspace state',
        arguments: { includeFiles: true },
        targetFilePath: null,
        mcpServer: null,
        mcpTool: null,
        result: serializedResult,
        providerToolCallId: 'tool-generic-json',
        progress: [],
      },
    });

    const models = projectTranscriptViewMessagesToAgentElementsModels([mcp, generic]);

    expect(models.map((model) => model.kind)).toEqual(['mcp', 'genericTool']);
    expect(models[0].result).toBe('Structured result available in debug details.');
    expect(models[1].result).toBe('Structured result available in debug details.');

    const { unmount } = render(<AgentElementsEventRenderer model={models[0]} />);
    expect(screen.getByTestId('agent-elements-mcp-result')).toHaveTextContent('Structured result available in debug details.');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('"foo"');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('raw payload row');
    expect(screen.getByTestId('agent-elements-debug-payload')).toHaveTextContent('foo');
    unmount();

    render(<AgentElementsEventRenderer model={models[1]} />);
    expect(screen.getByTestId('agent-elements-generic-result')).toHaveTextContent('Structured result available in debug details.');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('"foo"');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('raw payload row');
    expect(screen.getByTestId('agent-elements-debug-payload')).toHaveTextContent('foo');
  });

  it('maps prompts, subagents, turn summaries, and system status without unsupported fallbacks', () => {
    const prompt = makeMessage({
      type: 'interactive_prompt',
      interactivePrompt: {
        promptType: 'permission_request',
        requestId: 'langgraph-interrupt-1',
        status: 'pending',
        toolName: 'Bash',
        rawCommand: 'npm run build',
        pattern: 'npm run build',
        patternDisplayName: 'Build command',
        isDestructive: false,
        warnings: ['Will use the current worktree.'],
      },
    });

    const subagent = makeMessage({
      id: 2,
      sequence: 2,
      type: 'subagent',
      subagentId: 'subagent-1',
      subagent: {
        agentType: 'reviewer',
        status: 'running',
        teammateName: 'Faraday',
        teamName: null,
        teammateMode: 'read-only',
        model: 'gpt-5.5',
        color: null,
        isBackground: false,
        prompt: 'Review projection mapping.',
        toolCallCount: 2,
        childEvents: [
          makeMessage({
            id: 3,
            sequence: 3,
            type: 'tool_call',
            toolCall: {
              toolName: 'Grep',
              toolDisplayName: 'Grep',
              status: 'completed',
              description: 'Scan helpers',
              arguments: { pattern: 'INTERACTIVE_WIDGET_TOOLS' },
              targetFilePath: null,
              mcpServer: null,
              mcpTool: null,
              result: 'RichTranscriptView.tsx:587',
              providerToolCallId: 'child-grep',
              progress: [],
            },
          }),
        ],
      },
    });

    const turnEnded = makeMessage({
      id: 4,
      sequence: 4,
      type: 'turn_ended',
      turnEnded: {
        contextFill: {
          inputTokens: 1200,
          cacheReadInputTokens: 100,
          cacheCreationInputTokens: 40,
          outputTokens: 340,
          totalContextTokens: 1540,
        },
        contextWindow: 2000,
        cumulativeUsage: {
          inputTokens: 5200,
          outputTokens: 1340,
          cacheReadInputTokens: 900,
          cacheCreationInputTokens: 140,
          costUSD: 0.12,
          webSearchRequests: 0,
        },
        contextCompacted: true,
      },
    });

    const system = makeMessage({
      id: 5,
      sequence: 5,
      type: 'system_message',
      text: 'Runtime health is degraded.',
      systemMessage: {
        systemType: 'error',
        statusCode: 'service_error',
      },
      isError: true,
    });

    const models = projectTranscriptViewMessagesToAgentElementsModels([prompt, subagent, turnEnded, system]);

    expect(models.map((model) => model.kind)).toEqual(['humanInput', 'subagent', 'turnSummary', 'systemStatus']);
    expect(models.every((model) => getAgentElementsRendererDescriptor(model).fallbackClass === 'known')).toBe(true);
    expect(models[0].options?.map((option) => option.id)).toEqual(['allow', 'deny']);
    expect(models[1].subagentItems?.[0]).toMatchObject({ title: 'Grep', kind: 'tool', status: 'completed' });
    expect(models[2]).toMatchObject({
      contextUsagePercent: 77,
      usage: { input: 5200, output: 1340, total: 6540 },
    });
    expect(models[2].warnings?.[0]).toBe('Context was compacted during this turn.');
    expect(models[3]).toMatchObject({ title: 'System error', status: 'service_error' });

    render(<AgentElementsEventRenderer model={models[0]} />);

    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'humanInput');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-fallback-class', 'known');
    expect(screen.getByTestId('agent-elements-question-title')).toHaveTextContent('Allow Bash?');
    expect(screen.getByTestId('agent-elements-question-card')).toHaveAttribute('data-display-only', 'true');
    expect(screen.getByTestId('agent-elements-question-options')).toHaveAttribute('data-interactive', 'false');
    expect(screen.getByTestId('agent-elements-question-options')).toHaveTextContent('Allow');
    expect(screen.getByTestId('agent-elements-question-options')).toHaveTextContent('Deny');
    expect(within(screen.getByTestId('agent-elements-question-shell')).queryByRole('button', { name: /allow/i })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('agent-elements-question-shell')).queryByRole('button', { name: /deny/i })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('agent-elements-question-shell')).queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('agent-elements-question-shell')).queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('"requestId"');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
  });

  it('projects canonical transcript events with a single projector-owned turn summary', () => {
    const events: TranscriptEvent[] = [
      makeEvent({
        eventType: 'user_message',
        sequence: 1,
        searchableText: 'Run the focused projection tests.',
        payload: { mode: 'agent', inputType: 'user' },
        searchable: true,
      }),
      makeEvent({
        id: 20,
        eventType: 'tool_call',
        sequence: 2,
        payload: {
          toolName: 'Bash',
          toolDisplayName: 'Bash',
          status: 'completed',
          description: 'Run focused tests',
          arguments: { command: 'npx vitest --run AgentElementsTranscriptProjection.test.tsx' },
          targetFilePath: null,
          mcpServer: null,
          mcpTool: null,
          result: 'PASS AgentElementsTranscriptProjection',
          exitCode: 0,
        },
        providerToolCallId: 'tool-bash-raw',
      }),
      makeEvent({
        eventType: 'tool_progress',
        sequence: 3,
        parentEventId: 20,
        payload: {
          toolName: 'Bash',
          elapsedSeconds: 4,
          progressContent: 'Focused test suite completed.',
        },
      }),
      makeEvent({
        eventType: 'turn_ended',
        sequence: 4,
        payload: {
          contextFill: {
            inputTokens: 1200,
            cacheReadInputTokens: 100,
            cacheCreationInputTokens: 40,
            outputTokens: 300,
            totalContextTokens: 1640,
          },
          contextWindow: 2000,
          cumulativeUsage: {
            inputTokens: 5000,
            outputTokens: 1200,
            cacheReadInputTokens: 600,
            cacheCreationInputTokens: 200,
            costUSD: 0.18,
            webSearchRequests: 0,
          },
          contextCompacted: true,
        },
      }),
      makeEvent({
        eventType: 'assistant_message',
        sequence: 5,
        searchableText: 'Focused projection proof passed.',
        payload: { mode: 'agent', model: 'smarty_coding_agent' },
        searchable: true,
      }),
    ];

    const models = projectTranscriptEventsToAgentElementsModels(events);

    expect(models.map((model) => model.kind)).toEqual(['userMessage', 'bash', 'turnSummary', 'assistantMessage']);
    expect(models.filter((model) => model.kind === 'turnSummary')).toHaveLength(1);
    expect(models.every((model) => getAgentElementsRendererDescriptor(model).fallbackClass === 'known')).toBe(true);
    expect(models[1].progressUpdates?.[0]).toMatchObject({
      label: 'Focused test suite completed.',
      detail: '4s elapsed',
    });
    expect(models[2]).toMatchObject({
      contextUsagePercent: 82,
      usage: { input: 5000, output: 1200, total: 6200 },
    });
    expect(models[2].warnings?.[0]).toBe('Context was compacted during this turn.');

    render(<AgentElementsEventRenderer model={models[2]} />);

    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'turnSummary');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-fallback-class', 'known');
    expect(screen.getByTestId('agent-elements-turn-summary-metrics')).toHaveTextContent('82% context');
    expect(screen.getByTestId('agent-elements-turn-summary-metrics')).toHaveTextContent('6,200');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('"contextFill"');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
  });

  it('preserves standalone canonical tool progress that has no parent tool call', () => {
    const events: TranscriptEvent[] = [
      makeEvent({
        eventType: 'tool_call',
        sequence: 1,
        payload: {
          toolName: 'Bash',
          toolDisplayName: 'Bash',
          status: 'completed',
          description: 'Run focused tests',
          arguments: { command: 'npx vitest --run AgentElementsTranscriptProjection.test.tsx' },
          targetFilePath: null,
          mcpServer: null,
          mcpTool: null,
          result: 'PASS AgentElementsTranscriptProjection',
          exitCode: 0,
        },
        providerToolCallId: 'tool-bash-raw',
      }),
      makeEvent({
        eventType: 'tool_progress',
        sequence: 2,
        parentEventId: 1,
        payload: {
          toolName: 'Bash',
          elapsedSeconds: 4,
          progressContent: 'Parented progress stays inside the tool row.',
        },
      }),
      makeEvent({
        id: 30,
        eventType: 'tool_progress',
        sequence: 3,
        payload: {
          toolName: 'Repository check',
          elapsedSeconds: 7,
          progressContent: 'Standalone repository checks are still running.',
        },
      }),
      makeEvent({
        eventType: 'turn_ended',
        sequence: 4,
        payload: {
          contextFill: {
            inputTokens: 1200,
            cacheReadInputTokens: 100,
            cacheCreationInputTokens: 40,
            outputTokens: 300,
            totalContextTokens: 1640,
          },
          contextWindow: 2000,
          cumulativeUsage: {
            inputTokens: 5000,
            outputTokens: 1200,
            cacheReadInputTokens: 600,
            cacheCreationInputTokens: 200,
            costUSD: 0.18,
            webSearchRequests: 0,
          },
          contextCompacted: false,
        },
      }),
    ];

    const models = projectTranscriptEventsToAgentElementsModels(events);

    expect(models.map((model) => model.kind)).toEqual(['bash', 'toolProgress', 'turnSummary']);
    expect(models.filter((model) => model.kind === 'turnSummary')).toHaveLength(1);
    expect(models[0].progressUpdates?.[0]).toMatchObject({
      label: 'Parented progress stays inside the tool row.',
      detail: '4s elapsed',
    });
    expect(models[1]).toMatchObject({
      kind: 'toolProgress',
      body: 'Standalone repository checks are still running.',
      status: 'running',
    });

    render(<AgentElementsEventRenderer model={models[1]} />);

    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'toolProgress');
    expect(screen.getByTestId('agent-elements-progress-card')).toHaveTextContent('Standalone repository checks are still running.');
  });

  it('projects LangGraph and LangChain state stream events into state update renderers', () => {
    const models = projectFrameworkStreamEventsToAgentElementsModels([
      {
        method: 'updates',
        namespace: ['agent'],
        data: {
          agent: {
            plan: { status: 'running' },
            messages: ['drafting adapter'],
          },
        },
      },
      {
        method: 'values',
        namespace: 'agent',
        data: {
          messages: ['drafting adapter', 'adapter complete'],
          todos: [{ content: 'Cover state streams', status: 'completed' }],
        },
      },
      {
        method: 'output',
        data: {
          final: 'State projection proof complete.',
        },
      },
    ]);

    expect(models.map((model) => model.kind)).toEqual(['stateUpdate', 'stateUpdate', 'stateUpdate']);
    expect(models.every((model) => getAgentElementsRendererDescriptor(model).fallbackClass === 'known')).toBe(true);
    expect(models[0]).toMatchObject({
      title: 'Graph update',
      namespace: 'agent',
      changedKeys: [{ key: 'agent', after: 'structured value', summary: 'structured value' }],
    });
    expect(models[1].changedKeys?.map((change) => change.key)).toEqual(['messages', 'todos']);
    expect(models[2]).toMatchObject({
      title: 'Final output',
      status: 'completed',
      changedKeys: [{ key: 'final', after: 'State projection proof complete.', summary: 'State projection proof complete.' }],
    });

    render(<AgentElementsEventRenderer model={models[0]} />);

    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'stateUpdate');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-fallback-class', 'known');
    expect(screen.getByTestId('agent-elements-state-snapshot-card')).toHaveTextContent('Graph update');
    expect(screen.getByTestId('agent-elements-state-key-list')).toHaveTextContent('agent');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('"messages"');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
  });

  it('projects framework tool, lifecycle, checkpoint, task, debug, and custom stream events', () => {
    const models = projectFrameworkStreamEventsToAgentElementsModels([
      {
        method: 'toolCalls',
        event: 'tool-started',
        namespace: ['agent', 'tools'],
        data: {
          id: 'tool-1',
          name: 'execute',
          status: 'running',
          input: { command: 'npm test' },
        },
      },
      {
        method: 'lifecycle',
        event: 'interrupted',
        data: {
          name: 'approval gate',
          status: 'interrupted',
          detail: 'Waiting for human approval',
        },
      },
      {
        method: 'checkpoints',
        data: {
          checkpoint: { id: 'ckpt-42' },
          tasks: [{ id: 'task-1', name: 'agent', status: 'completed' }],
        },
      },
      {
        method: 'tasks',
        data: {
          id: 'task-2',
          name: 'run validation',
          status: 'running',
        },
      },
      {
        method: 'debug',
        event: 'node:state',
        data: {
          node: 'agent',
          status: 'running',
        },
      },
      {
        method: 'custom:retrieval',
        source: 'retriever',
        data: {
          eventName: 'retrieval.progress',
          status: 'running',
          summary: '3 documents indexed',
        },
      },
    ]);

    expect(models.map((model) => model.kind)).toEqual([
      'toolLifecycle',
      'checkpointTaskDebug',
      'checkpointTaskDebug',
      'checkpointTaskDebug',
      'checkpointTaskDebug',
      'extensionEvent',
    ]);
    expect(models.every((model) => getAgentElementsRendererDescriptor(model).fallbackClass === 'known')).toBe(true);
    expect(models[0]).toMatchObject({
      title: 'execute',
      status: 'running',
      detail: 'agent > tools',
      body: 'tool-started',
    });
    expect(models[1]).toMatchObject({
      lifecycleKind: 'run',
      lifecycleStatus: 'interrupted',
      title: 'approval gate',
      detail: 'Waiting for human approval',
    });
    expect(models[2]).toMatchObject({
      lifecycleKind: 'checkpoint',
      lifecycleStatus: 'completed',
      resumeId: 'ckpt-42',
    });
    expect(models[3]).toMatchObject({
      lifecycleKind: 'task',
      lifecycleStatus: 'running',
      title: 'run validation',
    });
    expect(models[4]).toMatchObject({
      lifecycleKind: 'custom',
      title: 'node:state',
      status: 'running',
    });
    expect(models[5]).toMatchObject({
      eventName: 'retrieval.progress',
      source: 'retriever',
      status: 'running',
      summary: '3 documents indexed',
    });

    render(<AgentElementsEventRenderer model={models[5]} />);

    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'extensionEvent');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-fallback-class', 'known');
    expect(screen.getByTestId('agent-elements-extension-event-card')).toHaveTextContent('retrieval.progress');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('"eventName"');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
  });

  it('projects framework message and DeepAgents subagent stream events', () => {
    const models = projectFrameworkStreamEventsToAgentElementsModels([
      {
        method: 'messages',
        namespace: ['main'],
        data: {
          role: 'assistant',
          text: 'Streaming answer from LangChain.',
          reasoning: 'Check the framework event envelope first.',
          model: 'gpt-5.5',
        },
      },
      {
        method: 'subagents',
        namespace: ['researcher'],
        data: {
          name: 'researcher',
          status: 'running',
          taskInput: 'Inspect DeepAgents streaming docs',
          messages: [{ role: 'assistant', content: 'Reading event stream projections.' }],
          toolCalls: [{ name: 'search_docs', status: 'completed' }],
          values: { documents: 3 },
        },
      },
      {
        method: 'subgraphs',
        namespace: ['agent', 'reviewer'],
        data: {
          name: 'reviewer',
          status: 'completed',
          output: 'Projection reviewed.',
        },
      },
    ]);

    expect(models.map((model) => model.kind)).toEqual(['thinking', 'assistantMessage', 'subagent', 'subagent']);
    expect(models.every((model) => getAgentElementsRendererDescriptor(model).fallbackClass === 'known')).toBe(true);
    expect(models[0]).toMatchObject({
      body: 'Check the framework event envelope first.',
      detail: 'gpt-5.5',
      status: 'completed',
    });
    expect(models[1]).toMatchObject({
      body: 'Streaming answer from LangChain.',
      actor: { role: 'assistant', name: 'Smarty Code', metadata: 'gpt-5.5' },
    });
    expect(models[2]).toMatchObject({
      title: 'researcher',
      body: 'researcher',
      status: 'running',
      summary: 'Inspect DeepAgents streaming docs',
    });
    expect(models[2].subagentItems?.map((item) => item.kind)).toEqual(['message', 'tool', 'value']);
    expect(models[3]).toMatchObject({
      title: 'reviewer',
      body: 'reviewer',
      status: 'completed',
      summary: 'Projection reviewed.',
    });

    render(<AgentElementsEventRenderer model={models[2]} />);

    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'subagent');
    expect(screen.getByTestId('agent-elements-subagent-card')).toHaveTextContent('researcher');
    expect(screen.getByTestId('agent-elements-subagent-list')).toHaveTextContent('search_docs');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('"toolCalls"');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
  });
});
