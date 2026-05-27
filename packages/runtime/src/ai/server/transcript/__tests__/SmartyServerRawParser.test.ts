import { describe, it, expect } from 'vitest';
import {
  projectRawMessagesToViewMessages,
  rawMessagesToCanonicalEvents,
} from '../projectRawMessages';
import { projectTranscriptEventsToAgentElementsModels } from '../../../../ui/AgentElements/AgentElementsTranscriptProjection';
import type { RawMessage } from '../TranscriptTransformer';

const SESSION_ID = 'smarty-server-parser-session';

function raw(overrides: Partial<RawMessage>): RawMessage {
  return {
    id: 1,
    sessionId: SESSION_ID,
    source: 'smarty-server',
    direction: 'output',
    content: '',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('SmartyServerRawParser', () => {
  it('projects input prompts and LangGraph message chunks', async () => {
    const events = await rawMessagesToCanonicalEvents([
      raw({
        id: 1,
        direction: 'input',
        content: JSON.stringify({ prompt: 'Hello Smarty' }),
        metadata: { mode: 'agent' },
      }),
      raw({
        id: 2,
        content: JSON.stringify({
          id: 'evt-1',
          event: 'messages',
          data: [{ type: 'ai', content: 'Hello from LangGraph' }, { langgraph_node: 'agent' }],
        }),
        metadata: { eventType: 'messages', smartyServerProvider: true },
      }),
    ], 'smarty-server');

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ eventType: 'user_message', searchableText: 'Hello Smarty' });
    expect(events[1]).toMatchObject({ eventType: 'assistant_message', searchableText: 'Hello from LangGraph' });
  });

  it('projects LangGraph tool lifecycle events', async () => {
    const events = await rawMessagesToCanonicalEvents([
      raw({
        id: 1,
        content: JSON.stringify({
          id: 'evt-1',
          event: 'tools',
          data: {
            event: 'on_tool_start',
            toolCallId: 'tool-1',
            name: 'mcp__nimbalyst-mcp__read_file',
            input: { path: 'README.md' },
          },
        }),
      }),
      raw({
        id: 2,
        content: JSON.stringify({
          id: 'evt-2',
          event: 'tools',
          data: {
            event: 'on_tool_end',
            toolCallId: 'tool-1',
            name: 'mcp__nimbalyst-mcp__read_file',
            output: 'file contents',
          },
        }),
      }),
    ], 'smarty-server');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'tool_call',
      providerToolCallId: 'tool-1',
      payload: {
        toolName: 'mcp__nimbalyst-mcp__read_file',
        arguments: { path: 'README.md' },
        status: 'completed',
        result: 'file contents',
      },
    });
  });

  it('projects LangGraph framework stream modes into Agent Elements framework rows', async () => {
    const events = await rawMessagesToCanonicalEvents([
      raw({
        id: 11,
        content: JSON.stringify({
          id: 'evt-updates-1',
          event: 'updates',
          namespace: ['planner'],
          data: {
            plan: { status: 'running' },
            next: 'write_tests',
          },
        }),
      }),
      raw({
        id: 12,
        content: JSON.stringify({
          id: 'evt-values-1',
          event: 'values',
          namespace: ['planner'],
          data: {
            currentStep: 'write_tests',
            attempts: 1,
          },
        }),
      }),
      raw({
        id: 13,
        content: JSON.stringify({
          id: 'evt-output-1',
          event: 'output',
          namespace: ['planner'],
          data: {
            result: 'Test plan generated',
          },
        }),
      }),
      raw({
        id: 14,
        content: JSON.stringify({
          id: 'evt-checkpoint-1',
          event: 'checkpoints',
          namespace: ['planner'],
          data: {
            checkpoint: { id: 'checkpoint-42' },
            tasks: [{ id: 'task-1', name: 'Write tests', status: 'completed' }],
          },
        }),
      }),
      raw({
        id: 15,
        content: JSON.stringify({
          id: 'evt-task-1',
          event: 'tasks',
          namespace: ['planner'],
          data: {
            name: 'Run focused tests',
            status: 'running',
          },
        }),
      }),
      raw({
        id: 16,
        content: JSON.stringify({
          id: 'evt-debug-1',
          event: 'debug',
          namespace: ['planner'],
          data: {
            name: 'planner.trace',
            message: 'Planner selected test files',
          },
        }),
      }),
      raw({
        id: 17,
        content: JSON.stringify({
          id: 'evt-custom-1',
          event: 'custom',
          namespace: ['planner'],
          data: {
            eventName: 'planner.progress',
            summary: 'Test plan generated',
            status: 'completed',
          },
        }),
      }),
    ], 'smarty-server');

    expect(events).toHaveLength(7);
    expect(events.map((event) => event.eventType)).toEqual([
      'tool_call',
      'tool_call',
      'tool_call',
      'tool_call',
      'tool_call',
      'tool_call',
      'tool_call',
    ]);
    expect(events.map((event) => (event.payload as { toolName?: string }).toolName)).toEqual([
      'langgraph_updates',
      'langgraph_values',
      'langgraph_output',
      'langgraph_checkpoints',
      'langgraph_tasks',
      'langgraph_debug',
      'langgraph_custom',
    ]);
    expect(events[0].payload).toMatchObject({
      arguments: {
        frameworkStreamEvent: {
          method: 'updates',
          namespace: ['planner'],
          source: 'smarty-server',
        },
      },
      status: 'completed',
    });

    const models = projectTranscriptEventsToAgentElementsModels(events);
    expect(models.map((model) => model.kind)).toEqual([
      'stateUpdate',
      'stateUpdate',
      'stateUpdate',
      'checkpointTaskDebug',
      'checkpointTaskDebug',
      'checkpointTaskDebug',
      'extensionEvent',
    ]);
    expect(models[0]).toMatchObject({
      title: 'Graph update',
      namespace: 'planner',
      changedKeys: expect.arrayContaining([
        expect.objectContaining({ key: 'plan' }),
        expect.objectContaining({ key: 'next', after: 'write_tests' }),
      ]),
    });
    expect(models[1]).toMatchObject({
      title: 'State values',
      namespace: 'planner',
      changedKeys: expect.arrayContaining([
        expect.objectContaining({ key: 'currentStep', after: 'write_tests' }),
        expect.objectContaining({ key: 'attempts', after: '1' }),
      ]),
    });
    expect(models[2]).toMatchObject({
      title: 'Final output',
      status: 'completed',
      changedKeys: [expect.objectContaining({ key: 'result', after: 'Test plan generated' })],
    });
    expect(models[3]).toMatchObject({
      title: 'Checkpoint',
      resumeId: 'checkpoint-42',
      lifecycleEvents: [expect.objectContaining({ label: 'Write tests', status: 'completed' })],
    });
    expect(models[4]).toMatchObject({
      title: 'Run focused tests',
      lifecycleStatus: 'running',
    });
    expect(models[5]).toMatchObject({
      title: 'planner.trace',
      detail: 'Planner selected test files',
    });
    expect(models[6]).toMatchObject({
      eventName: 'planner.progress',
      source: 'smarty-server',
      summary: 'Test plan generated',
    });
    expect(models[0].rawPayload).toMatchObject({
      frameworkStreamEvent: {
        data: expect.objectContaining({ plan: { status: 'running' } }),
      },
    });
  });

  it('projects DeepAgents subagents and LangGraph subgraph namespace tuples into Agent Elements subagent rows', async () => {
    const events = await rawMessagesToCanonicalEvents([
      raw({
        id: 21,
        content: JSON.stringify({
          id: 'evt-subagent-1',
          event: 'subagents',
          namespace: ['tools:call_researcher'],
          data: {
            name: 'researcher',
            status: 'running',
            taskInput: 'Inspect DeepAgents subagent streaming docs',
            messages: [{ role: 'assistant', content: 'Reading event stream projections.' }],
            toolCalls: [{ id: 'tool-1', name: 'search_docs', status: 'finished' }],
            values: { documents: 3 },
          },
        }),
      }),
      raw({
        id: 22,
        content: JSON.stringify({
          id: 'evt-subgraph-update-1',
          event: 'updates',
          data: [
            ['tools:call_reviewer'],
            {
              model_request: {
                status: 'running',
                topic: 'Agent Elements renderer coverage',
              },
            },
          ],
        }),
      }),
      raw({
        id: 23,
        content: JSON.stringify({
          id: 'evt-subgraph-message-1',
          event: 'messages',
          data: [
            ['tools:call_reviewer'],
            [
              { type: 'AIMessageChunk', content: 'Nested reviewer finding.' },
              { langgraph_node: 'model_request' },
            ],
          ],
        }),
      }),
      raw({
        id: 24,
        content: JSON.stringify({
          id: 'evt-root-update-1',
          event: 'updates',
          data: [
            [],
            {
              planner: {
                status: 'running',
                next: 'write_tests',
              },
            },
          ],
        }),
      }),
    ], 'smarty-server');

    expect(events).toHaveLength(4);
    expect(events.map((event) => event.eventType)).toEqual([
      'tool_call',
      'tool_call',
      'tool_call',
      'tool_call',
    ]);
    expect(events.map((event) => (event.payload as { toolName?: string }).toolName)).toEqual([
      'deepagents_subagents',
      'langgraph_subgraphs',
      'langgraph_subgraphs',
      'langgraph_updates',
    ]);

    const models = projectTranscriptEventsToAgentElementsModels(events);
    expect(models.map((model) => model.kind)).toEqual(['subagent', 'subagent', 'subagent', 'stateUpdate']);
    expect(models[0]).toMatchObject({
      title: 'researcher',
      status: 'running',
      summary: 'Inspect DeepAgents subagent streaming docs',
    });
    expect(models[0].subagentItems?.map((item) => item.kind)).toEqual(['message', 'tool', 'value']);
    expect(models[1]).toMatchObject({
      title: 'tools:call_reviewer',
      status: 'running',
    });
    expect(models[1].subagentItems).toEqual([
      expect.objectContaining({ title: 'model_request', detail: 'structured value', kind: 'value' }),
    ]);
    expect(models[2]).toMatchObject({
      title: 'tools:call_reviewer',
      status: 'running',
    });
    expect(models[2].subagentItems).toEqual([
      expect.objectContaining({
        title: 'AIMessageChunk',
        detail: 'Nested reviewer finding.',
        kind: 'message',
      }),
    ]);
    expect(models[3]).toMatchObject({
      title: 'Graph update',
      changedKeys: [
        expect.objectContaining({ key: 'planner', summary: 'structured value' }),
      ],
    });
  });

  it('projects LangGraph event-stream protocol envelopes into Agent Elements rows', async () => {
    const events = await rawMessagesToCanonicalEvents([
      raw({
        id: 31,
        content: JSON.stringify({
          seq: 1,
          method: 'messages',
          params: {
            namespace: [],
            data: {
              event: 'content-block-delta',
              messageId: 'msg-1',
              delta: {
                type: 'reasoning-delta',
                reasoning: 'Check the state before answering.',
              },
            },
          },
        }),
      }),
      raw({
        id: 32,
        content: JSON.stringify({
          seq: 2,
          method: 'messages',
          params: {
            namespace: [],
            data: {
              event: 'content-block-delta',
              messageId: 'msg-1',
              delta: {
                type: 'text-delta',
                text: 'Ready to continue.',
              },
            },
          },
        }),
      }),
      raw({
        id: 33,
        content: JSON.stringify({
          seq: 3,
          method: 'lifecycle',
          params: {
            namespace: ['researcher:abc'],
            data: {
              event: 'started',
              graph_name: 'researcher',
              summary: 'Subgraph started.',
            },
          },
        }),
      }),
      raw({
        id: 34,
        content: JSON.stringify({
          seq: 4,
          method: 'custom:artifact',
          params: {
            namespace: [],
            data: {
              eventName: 'artifact.created',
              summary: 'Report artifact created.',
              status: 'completed',
            },
          },
        }),
      }),
      raw({
        id: 35,
        content: JSON.stringify({
          seq: 5,
          method: 'input',
          params: {
            namespace: [],
            data: {
              event: 'request',
              question: 'Approve the proposed file edit?',
              options: [
                { label: 'Approve' },
                { label: 'Reject' },
              ],
              status: 'pending',
            },
          },
        }),
      }),
    ], 'smarty-server');

    expect(events).toHaveLength(4);
    expect(events.map((event) => event.eventType)).toEqual([
      'assistant_message',
      'tool_call',
      'tool_call',
      'tool_call',
    ]);
    expect(events[0].payload).toMatchObject({
      thinking: 'Check the state before answering.',
      coalesceKey: 'smarty-server-message:msg-1',
    });
    expect(events[1]).toMatchObject({
      eventType: 'tool_call',
    });
    expect(events[0]).toMatchObject({
      eventType: 'assistant_message',
      searchableText: 'Ready to continue.',
    });
    expect(events.map((event) => (event.payload as { toolName?: string }).toolName).slice(1)).toEqual([
      'langgraph_lifecycle',
      'langgraph_custom_artifact',
      'langgraph_input',
    ]);

    const models = projectTranscriptEventsToAgentElementsModels(events);
    expect(models.map((model) => model.kind)).toEqual([
      'thinking',
      'assistantMessage',
      'checkpointTaskDebug',
      'extensionEvent',
      'humanInput',
    ]);
    expect(models[2]).toMatchObject({
      title: 'researcher',
      lifecycleStatus: 'running',
    });
    expect(models[3]).toMatchObject({
      eventName: 'artifact.created',
      summary: 'Report artifact created.',
    });
    expect(models[4]).toMatchObject({
      title: 'Human input required',
      body: 'Approve the proposed file edit?',
      questionKind: 'single',
      status: 'pending',
    });
  });

  it('projects LangChain message usage metadata into Agent Elements turn summaries', async () => {
    const events = await rawMessagesToCanonicalEvents([
      raw({
        id: 41,
        content: JSON.stringify({
          seq: 41,
          method: 'messages',
          params: {
            namespace: [],
            data: {
              event: 'message-finish',
              messageId: 'msg-usage-1',
              contextWindow: 3000,
              message: {
                content: [{ type: 'text', text: 'Finished with usage.' }],
                usage_metadata: {
                  input_tokens: 1200,
                  output_tokens: 300,
                  total_tokens: 1500,
                  input_token_details: {
                    cache_read: 100,
                    cache_creation: 50,
                  },
                },
              },
            },
          },
        }),
      }),
      raw({
        id: 42,
        content: JSON.stringify({
          id: 'evt-chat-end-1',
          event: 'events',
          data: {
            event: 'on_chat_model_end',
            run_id: 'chat-run-1',
            data: {
              llmOutput: {
                tokenUsage: {
                  promptTokens: 50,
                  completionTokens: 25,
                  totalTokens: 75,
                },
              },
              output: {
                usage_metadata: {
                  input_tokens: 400,
                  output_tokens: 100,
                  total_tokens: 500,
                },
                response_metadata: {
                  model_name: 'gpt-5.1',
                },
              },
              context_window: 1000,
            },
          },
        }),
      }),
    ], 'smarty-server');

    expect(events.map((event) => event.eventType)).toEqual([
      'assistant_message',
      'turn_ended',
      'turn_ended',
    ]);
    expect(events[1].payload).toMatchObject({
      contextFill: {
        inputTokens: 1200,
        cacheReadInputTokens: 100,
        cacheCreationInputTokens: 50,
        outputTokens: 300,
        totalContextTokens: 1500,
      },
      contextWindow: 3000,
      cumulativeUsage: {
        inputTokens: 1200,
        outputTokens: 300,
        cacheReadInputTokens: 100,
        cacheCreationInputTokens: 50,
      },
      contextCompacted: false,
    });
    expect(events[1].createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(events[2].payload).toMatchObject({
      contextFill: {
        inputTokens: 400,
        outputTokens: 100,
        totalContextTokens: 500,
      },
      contextWindow: 1000,
    });

    const llmOutputOnlyEvents = await rawMessagesToCanonicalEvents([
      raw({
        id: 43,
        createdAt: new Date('2026-01-01T00:01:00Z'),
        content: JSON.stringify({
          id: 'evt-llm-end-1',
          event: 'events',
          data: {
            event: 'on_llm_end',
            run_id: 'llm-run-1',
            data: {
              llmOutput: {
                tokenUsage: {
                  promptTokens: 50,
                  completionTokens: 25,
                  totalTokens: 75,
                },
              },
            },
          },
        }),
      }),
    ], 'smarty-server');

    expect(llmOutputOnlyEvents).toHaveLength(1);
    expect(llmOutputOnlyEvents[0]).toMatchObject({
      eventType: 'turn_ended',
      payload: {
        contextFill: {
          inputTokens: 50,
          outputTokens: 25,
          totalContextTokens: 75,
        },
      },
      createdAt: new Date('2026-01-01T00:01:00Z'),
    });

    const models = projectTranscriptEventsToAgentElementsModels(events);
    expect(models.map((model) => model.kind)).toEqual([
      'assistantMessage',
      'turnSummary',
      'turnSummary',
    ]);
    expect(models[1]).toMatchObject({
      contextUsagePercent: 50,
      usage: {
        input: 1200,
        output: 300,
        total: 1500,
      },
    });
    expect(models[2]).toMatchObject({
      contextUsagePercent: 50,
      usage: {
        input: 400,
        output: 100,
        total: 500,
      },
    });
  });

  it('promotes execute result exit codes into canonical tool metadata', async () => {
    const events = await rawMessagesToCanonicalEvents([
      raw({
        id: 1,
        content: JSON.stringify({
          type: 'nimbalyst_tool_use',
          id: 'execute-fail',
          name: 'execute',
          input: { command: 'npm test', timeout: 120 },
        }),
      }),
      raw({
        id: 2,
        content: JSON.stringify({
          type: 'nimbalyst_tool_result',
          tool_use_id: 'execute-fail',
          result: {
            output: 'FAIL pathUtils.planPrompt.test.ts\nexpected quoted path',
            exit_code: 1,
            truncated: false,
          },
        }),
      }),
      raw({
        id: 3,
        content: JSON.stringify({
          type: 'nimbalyst_tool_use',
          id: 'execute-pass',
          name: 'execute',
          input: { command: 'npm test', timeout: 120 },
        }),
      }),
      raw({
        id: 4,
        content: JSON.stringify({
          type: 'nimbalyst_tool_result',
          tool_use_id: 'execute-pass',
          result: JSON.stringify({
            output: 'Test Files 1 passed\nTests 4 passed',
            exit_code: 0,
            truncated: false,
          }),
        }),
      }),
    ], 'smarty-server');

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      eventType: 'tool_call',
      providerToolCallId: 'execute-fail',
      payload: {
        toolName: 'execute',
        status: 'error',
        isError: true,
        exitCode: 1,
      },
    });
    expect(events[1]).toMatchObject({
      eventType: 'tool_call',
      providerToolCallId: 'execute-pass',
      payload: {
        toolName: 'execute',
        status: 'completed',
        isError: false,
        exitCode: 0,
      },
    });
  });

  it('projects LangChain tool lifecycle events from the events channel', async () => {
    const events = await rawMessagesToCanonicalEvents([
      raw({
        id: 1,
        content: JSON.stringify({
          id: 'evt-1',
          event: 'events',
          data: {
            event: 'on_tool_start',
            run_id: 'tool-run-1',
            name: 'write_file',
            data: { input: { file_path: '/tmp/probe.txt' } },
          },
        }),
      }),
      raw({
        id: 2,
        content: JSON.stringify({
          id: 'evt-2',
          event: 'events',
          data: {
            event: 'on_tool_end',
            run_id: 'tool-run-1',
            name: 'write_file',
            data: { output: 'Updated file /tmp/probe.txt' },
          },
        }),
      }),
    ], 'smarty-server');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'tool_call',
      providerToolCallId: 'tool-run-1',
      payload: {
        toolName: 'file_change',
        arguments: { changes: [{ path: '/tmp/probe.txt', kind: 'add' }] },
        targetFilePath: '/tmp/probe.txt',
        status: 'completed',
        result: 'Updated file /tmp/probe.txt',
      },
    });
  });

  it('projects Nimbalyst ToolPermission use and result rows as an interactive prompt', async () => {
    const events = await rawMessagesToCanonicalEvents([
      raw({
        id: 1,
        content: JSON.stringify({
          type: 'nimbalyst_tool_use',
          id: 'langgraph-interrupt-1-0',
          name: 'ToolPermission',
          input: {
            requestId: 'langgraph-interrupt-1-0',
            toolName: 'write_file',
            rawCommand: '{"file_path":"/tmp/probe.txt"}',
            pattern: 'Write',
            patternDisplayName: 'Write',
            isDestructive: true,
            warnings: ['Smarty Server paused before running this LangGraph tool.'],
            outsidePaths: ['/tmp/probe.txt'],
          },
        }),
      }),
      raw({
        id: 2,
        content: JSON.stringify({
          type: 'nimbalyst_tool_result',
          tool_use_id: 'langgraph-interrupt-1-0',
          result: JSON.stringify({
            decision: 'allow',
            scope: 'once',
            respondedBy: 'desktop',
          }),
        }),
      }),
    ], 'smarty-server');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'interactive_prompt',
      providerToolCallId: 'langgraph-interrupt-1-0',
      payload: {
        promptType: 'permission_request',
        requestId: 'langgraph-interrupt-1-0',
        toolName: 'write_file',
        rawCommand: '{"file_path":"/tmp/probe.txt"}',
        status: 'resolved',
        decision: 'allow',
        scope: 'once',
        respondedBy: 'desktop',
      },
    });

    const viewMessages = await projectRawMessagesToViewMessages([
      raw({
        id: 1,
        content: JSON.stringify({
          type: 'nimbalyst_tool_use',
          id: 'langgraph-interrupt-1-0',
          name: 'ToolPermission',
          input: {
            requestId: 'langgraph-interrupt-1-0',
            toolName: 'write_file',
            rawCommand: '{"file_path":"/tmp/probe.txt"}',
            pattern: 'Write',
            patternDisplayName: 'Write',
            isDestructive: true,
            warnings: ['Smarty Server paused before running this LangGraph tool.'],
          },
        }),
      }),
      raw({
        id: 2,
        content: JSON.stringify({
          type: 'nimbalyst_tool_result',
          tool_use_id: 'langgraph-interrupt-1-0',
          result: JSON.stringify({
            decision: 'allow',
            scope: 'once',
            respondedBy: 'desktop',
          }),
        }),
      }),
    ], 'smarty-server');

    expect(viewMessages[0].interactivePrompt?.promptType).toBe('permission_request');
    expect(viewMessages[0].interactivePrompt?.status).toBe('resolved');
  });

  it('keeps interleaved LangGraph runs as separate assistant messages', async () => {
    const messageChunk = (
      id: number,
      runId: string,
      messageId: string,
      content: string,
    ) => raw({
      id,
      content: JSON.stringify({
        id: `evt-${id}`,
        event: 'messages',
        data: [
          { type: 'AIMessageChunk', id: messageId, content },
          {
            thread_id: 'thread-1',
            run_id: runId,
            langgraph_node: 'model',
          },
        ],
      }),
      metadata: { eventType: 'messages', smartyServerProvider: true },
    });

    const messages = [
      raw({
        id: 1,
        direction: 'input',
        content: JSON.stringify({ prompt: 'Interrupt the pending write.' }),
      }),
      raw({
        id: 2,
        direction: 'input',
        content: JSON.stringify({ prompt: 'Reply with exactly SMARTY_SEND_NOW_RECOVERY_20260522.' }),
      }),
      messageChunk(3, 'resume-run', 'lc-run-resume', 'The write was interrupted'),
      messageChunk(4, 'recovery-run', 'lc-run-recovery', 'SMARTY_SEND'),
      messageChunk(5, 'resume-run', 'lc-run-resume', ' in the runtime permission UI.'),
      messageChunk(6, 'recovery-run', 'lc-run-recovery', '_NOW_RECOVERY_20260522'),
    ];

    const events = await rawMessagesToCanonicalEvents(messages, 'smarty-server');
    const assistantEvents = events.filter((event) => event.eventType === 'assistant_message');

    expect(assistantEvents).toHaveLength(2);
    expect(assistantEvents[0].searchableText).toBe(
      'The write was interrupted in the runtime permission UI.',
    );
    expect(assistantEvents[1].searchableText).toBe('SMARTY_SEND_NOW_RECOVERY_20260522');
    expect(assistantEvents.map((event) => event.payload.coalesceKey)).toEqual([
      'smarty-server:thread-1:resume-run',
      'smarty-server:thread-1:recovery-run',
    ]);

    const viewMessages = await projectRawMessagesToViewMessages(messages, 'smarty-server');
    const assistantMessages = viewMessages.filter((message) => message.type === 'assistant_message');
    expect(assistantMessages.map((message) => message.text)).toEqual([
      'The write was interrupted in the runtime permission UI.',
      'SMARTY_SEND_NOW_RECOVERY_20260522',
    ]);
  });

  it('coalesces message chunks by protocol-level run metadata when tuple metadata omits run IDs', async () => {
    const messages = [
      raw({
        id: 1,
        content: JSON.stringify({
          id: 'evt-1',
          event: 'messages',
          data: [{ type: 'AIMessageChunk', content: 'Hello' }, { langgraph_node: 'model' }],
        }),
        metadata: {
          eventType: 'messages',
          smartyServerProvider: true,
          threadId: 'thread-1',
          runId: 'run-1',
        },
      }),
      raw({
        id: 2,
        content: JSON.stringify({
          id: 'evt-2',
          event: 'messages',
          data: [{ type: 'AIMessageChunk', content: ' world' }, { langgraph_node: 'model' }],
        }),
        metadata: {
          eventType: 'messages',
          smartyServerProvider: true,
          threadId: 'thread-1',
          runId: 'run-1',
        },
      }),
    ];

    const events = await rawMessagesToCanonicalEvents(messages, 'smarty-server');
    const assistantEvents = events.filter((event) => event.eventType === 'assistant_message');

    expect(assistantEvents).toHaveLength(1);
    expect(assistantEvents[0].searchableText).toBe('Hello world');
    expect(assistantEvents[0].payload.coalesceKey).toBe('smarty-server:thread-1:run-1');
  });
});
