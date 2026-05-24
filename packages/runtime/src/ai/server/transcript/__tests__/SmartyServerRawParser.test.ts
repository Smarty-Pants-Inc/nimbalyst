import { describe, it, expect } from 'vitest';
import {
  projectRawMessagesToViewMessages,
  rawMessagesToCanonicalEvents,
} from '../projectRawMessages';
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
