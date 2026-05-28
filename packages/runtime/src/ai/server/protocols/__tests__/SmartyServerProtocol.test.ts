import { describe, it, expect, vi } from 'vitest';
import {
  SmartyServerProtocol,
  type LangGraphClientLike,
} from '../SmartyServerProtocol';

function createAsyncStream(events: Array<{ id?: string; event: string; data: unknown }>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
  };
}

function createMockClient(
  events: Array<{ id?: string; event: string; data: unknown }>,
  state: unknown = { interrupts: [] },
) {
  const createThread = vi.fn(async () => ({ thread_id: 'lg-thread-1' }));
  const getThread = vi.fn(async () => ({ thread_id: 'lg-thread-1' }));
  const getState = vi.fn(async () => state);
  const streamRun = vi.fn(() => createAsyncStream(events));
  const cancelRun = vi.fn(async () => undefined);
  const cancelMany = vi.fn(async () => undefined);

  const client: LangGraphClientLike = {
    threads: {
      create: createThread,
      get: getThread,
      getState,
    },
    runs: {
      stream: streamRun,
      cancel: cancelRun,
      cancelMany,
    },
  };

  return { client, createThread, getThread, getState, streamRun, cancelRun, cancelMany };
}

describe('SmartyServerProtocol', () => {
  it('creates persistent LangGraph threads for smarty-server sessions', async () => {
    const { client, createThread } = createMockClient([]);
    const clientFactory = vi.fn(() => client);
    const protocol = new SmartyServerProtocol(clientFactory);

    const session = await protocol.createSession({
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    expect(session).toMatchObject({
      id: 'lg-thread-1',
      platform: 'langgraph-agent-server',
    });
    expect(clientFactory).toHaveBeenCalledWith({
      apiUrl: 'http://127.0.0.1:8788',
      apiKey: null,
    });
    expect(createThread).toHaveBeenCalledWith({
      graphId: 'smarty_coding_agent',
      metadata: {
        nimbalystProvider: 'smarty-server',
        workspacePath: '/repo',
      },
      signal: undefined,
    });
  });

  it('rejects non-loopback smarty-server URLs before creating a LangGraph client', async () => {
    const { client } = createMockClient([]);
    const clientFactory = vi.fn(() => client);
    const protocol = new SmartyServerProtocol(clientFactory);

    await expect(protocol.createSession({
      workspacePath: '/repo',
      raw: {
        baseUrl: 'https://remote-smarty-server.example.com',
        assistantId: 'smarty_coding_agent',
        apiKey: 'do-not-send',
      },
    })).rejects.toThrow(/loopback/i);

    expect(clientFactory).not.toHaveBeenCalled();
  });

  it('normalizes loopback smarty-server URLs before creating a LangGraph client', async () => {
    const { client } = createMockClient([]);
    const clientFactory = vi.fn(() => client);
    const protocol = new SmartyServerProtocol(clientFactory);

    await protocol.createSession({
      workspacePath: '/repo',
      raw: {
        baseUrl: ' http://localhost:8791/// ',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    expect(clientFactory).toHaveBeenCalledWith({
      apiUrl: 'http://localhost:8791',
      apiKey: null,
    });
  });

  it('rejects wildcard bind addresses as smarty-server client targets', async () => {
    const { client } = createMockClient([]);
    const clientFactory = vi.fn(() => client);
    const protocol = new SmartyServerProtocol(clientFactory);

    await expect(protocol.createSession({
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://0.0.0.0:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    })).rejects.toThrow(/loopback/i);

    expect(clientFactory).not.toHaveBeenCalled();
  });

  it('streams LangGraph events into protocol raw/text/tool/complete events', async () => {
    const events = [
      { id: 'evt-1', event: 'metadata', data: { run_id: 'run-1', thread_id: 'lg-thread-1' } },
      { id: 'evt-2', event: 'messages', data: [{ type: 'ai', content: 'hello' }, { langgraph_node: 'agent' }] },
      {
        id: 'evt-3',
        event: 'tools',
        data: { event: 'on_tool_start', toolCallId: 'tool-1', name: 'read_file', input: { path: 'README.md' } },
      },
      {
        id: 'evt-4',
        event: 'tools',
        data: { event: 'on_tool_end', toolCallId: 'tool-1', name: 'read_file', output: 'contents' },
      },
    ];
    const { client, streamRun } = createMockClient(events);
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    const emitted = [];
    for await (const event of protocol.sendMessage(session, { content: 'do work', sessionId: 'nim-session-1' })) {
      emitted.push(event);
    }

    expect(streamRun).toHaveBeenCalledWith('lg-thread-1', 'smarty_coding_agent', {
      input: { messages: [{ role: 'user', content: 'do work' }] },
      metadata: { nimbalystSessionId: 'nim-session-1' },
      config: { recursion_limit: 9_999 },
      streamMode: ['messages-tuple', 'updates', 'tasks', 'events'],
      streamSubgraphs: true,
      streamResumable: true,
      signal: undefined,
    });
    const streamCalls = streamRun.mock.calls as unknown as Array<[string, string, { streamMode: string[] }]>;
    expect(streamCalls[0]?.[2].streamMode).not.toContain('tools');
    expect(emitted.filter((event) => event.type === 'raw_event')).toHaveLength(events.length);
    expect(emitted.find((event) =>
      event.type === 'raw_event' &&
      (event.metadata?.rawEvent as { id?: string } | undefined)?.id === 'evt-2'
    )?.metadata).toMatchObject({
      runId: 'run-1',
      threadId: 'lg-thread-1',
    });
    expect(emitted).toContainEqual({ type: 'text', content: 'hello' });
    expect(emitted).toContainEqual({
      type: 'tool_call',
      toolCall: { id: 'tool-1', name: 'read_file', arguments: { path: 'README.md' } },
    });
    expect(emitted).toContainEqual({
      type: 'tool_result',
      toolResult: {
        id: 'tool-1',
        name: 'read_file',
        result: { success: true, result: 'contents' },
      },
    });
    expect(emitted[emitted.length - 1]).toMatchObject({
      type: 'complete',
      metadata: { runId: 'run-1', threadId: 'lg-thread-1' },
    });
  });

  it('does not stream LangGraph ToolMessage payloads as assistant text', async () => {
    const events = [
      { id: 'evt-1', event: 'metadata', data: { run_id: 'run-1', thread_id: 'lg-thread-1' } },
      {
        id: 'evt-2',
        event: 'messages',
        data: [{
          type: 'tool',
          name: 'read_file',
          content: '1 Simple file edit demo\n2 \n3 This file was created by Smarty Code.',
          tool_call_id: 'call-read-file-1',
        }, { langgraph_node: 'tools' }],
      },
      {
        id: 'evt-3',
        event: 'messages',
        data: [{
          type: 'ToolMessage',
          name: 'write_todos',
          content: "Updated todo list to [{'content': 'Demo file edit', 'status': 'in_progress'}]",
          tool_call_id: 'call-todos-1',
        }, { langgraph_node: 'tools' }],
      },
      { id: 'evt-4', event: 'messages', data: [{ type: 'ai', content: 'Created and verified the file.' }, { langgraph_node: 'agent' }] },
    ];
    const { client } = createMockClient(events);
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    const emitted = [];
    for await (const event of protocol.sendMessage(session, { content: 'demo file edit', sessionId: 'nim-session-1' })) {
      emitted.push(event);
    }

    const textEvents = emitted.filter((event) => event.type === 'text');
    expect(textEvents).toEqual([
      { type: 'text', content: 'Created and verified the file.' },
    ]);
    expect(JSON.stringify(textEvents)).not.toContain('Updated todo list to');
    expect(JSON.stringify(textEvents)).not.toContain('Simple file edit demo');
  });

  it('sets a daily-driver recursion limit above short proof-slice defaults', async () => {
    const { client, streamRun } = createMockClient([
      { id: 'evt-1', event: 'metadata', data: { run_id: 'run-1', thread_id: 'lg-thread-1' } },
    ]);
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    for await (const _event of protocol.sendMessage(session, { content: 'do work', sessionId: 'nim-session-1' })) {
      // Drain the stream so the SDK payload is captured.
    }

    expect(streamRun).toHaveBeenCalledWith('lg-thread-1', 'smarty_coding_agent', expect.objectContaining({
      config: { recursion_limit: 9_999 },
    }));
  });

  it('maps LangChain tool lifecycle events from the server-supported events stream', async () => {
    const events = [
      {
        id: 'evt-1',
        event: 'events',
        data: {
          event: 'on_tool_start',
          run_id: 'tool-run-1',
          name: 'read_file',
          data: { input: { path: 'README.md' } },
        },
      },
      {
        id: 'evt-2',
        event: 'events',
        data: {
          event: 'on_tool_end',
          run_id: 'tool-run-1',
          name: 'read_file',
          data: { output: 'contents' },
        },
      },
    ];
    const { client } = createMockClient(events);
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    const emitted = [];
    for await (const event of protocol.sendMessage(session, { content: 'read file', sessionId: 'nim-session-1' })) {
      emitted.push(event);
    }

    expect(emitted).toContainEqual({
      type: 'tool_call',
      toolCall: { id: 'tool-run-1', name: 'read_file', arguments: { path: 'README.md' } },
    });
    expect(emitted).toContainEqual({
      type: 'tool_result',
      toolResult: {
        id: 'tool-run-1',
        name: 'read_file',
        result: { success: true, result: 'contents' },
      },
    });
  });

  it('emits LangGraph interrupts instead of completing an approval-paused run', async () => {
    const interruptValue = {
      action_requests: [{
        name: 'write_file',
        args: { file_path: '/notes.txt', content: 'hello' },
        description: 'Tool execution requires approval',
      }],
      review_configs: [{ action_name: 'write_file', allowed_decisions: ['approve', 'reject'] }],
    };
    const events = [
      { id: 'evt-1', event: 'metadata', data: { run_id: 'run-1', thread_id: 'lg-thread-1' } },
      {
        id: 'evt-2',
        event: 'tasks',
        data: {
          id: 'task-1',
          name: 'HumanInTheLoopMiddleware.after_model',
          interrupts: [{ id: 'interrupt-1', value: interruptValue }],
        },
      },
    ];
    const { client } = createMockClient(events);
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    const emitted = [];
    for await (const event of protocol.sendMessage(session, { content: 'write', sessionId: 'nim-session-1' })) {
      emitted.push(event);
    }

    expect(emitted[emitted.length - 1]).toMatchObject({
      type: 'interrupt',
      interrupt: { id: 'interrupt-1', value: interruptValue },
      metadata: { runId: 'run-1', threadId: 'lg-thread-1' },
    });
    expect(emitted.some((event) => event.type === 'complete')).toBe(false);
  });

  it('drains the LangGraph stream before surfacing an interrupt so dev persistence can flush', async () => {
    const interruptValue = {
      action_requests: [{
        name: 'write_file',
        args: { file_path: '/notes.txt', content: 'hello' },
      }],
    };
    const events = [
      { id: 'evt-1', event: 'metadata', data: { run_id: 'run-1', thread_id: 'lg-thread-1' } },
      {
        id: 'evt-2',
        event: 'tasks',
        data: {
          interrupts: [{ id: 'interrupt-1', value: interruptValue }],
        },
      },
      {
        id: 'evt-3',
        event: 'events',
        data: { event: 'on_chain_end', name: 'smarty_coding_agent' },
      },
    ];
    const { client } = createMockClient(events);
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    const emitted = [];
    for await (const event of protocol.sendMessage(session, { content: 'write', sessionId: 'nim-session-1' })) {
      emitted.push(event);
    }

    expect(emitted.filter((event) => event.type === 'raw_event')).toHaveLength(events.length);
    expect(emitted.at(-1)).toMatchObject({
      type: 'interrupt',
      interrupt: { id: 'interrupt-1', value: interruptValue },
    });
  });

  it('falls back to persisted thread state when the stream completes without an interrupt chunk', async () => {
    const interruptValue = {
      action_requests: [{
        name: 'write_file',
        args: { file_path: '/notes.txt', content: 'hello' },
      }],
    };
    const events = [
      { id: 'evt-1', event: 'metadata', data: { run_id: 'run-1', thread_id: 'lg-thread-1' } },
      { id: 'evt-2', event: 'messages', data: [{ type: 'ai', content: 'writing next' }, { langgraph_node: 'agent' }] },
    ];
    const { client, getState } = createMockClient(events, {
      tasks: [{
        id: 'task-1',
        name: 'HumanInTheLoopMiddleware.after_model',
        interrupts: [{ id: 'persisted-interrupt-1', value: interruptValue }],
      }],
    });
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    const emitted = [];
    for await (const event of protocol.sendMessage(session, { content: 'write', sessionId: 'nim-session-1' })) {
      emitted.push(event);
    }

    expect(getState).toHaveBeenCalledWith('lg-thread-1', undefined, { subgraphs: true, signal: undefined });
    expect(emitted.at(-1)).toMatchObject({
      type: 'interrupt',
      interrupt: { id: 'persisted-interrupt-1', value: interruptValue },
      metadata: { runId: 'run-1', threadId: 'lg-thread-1', source: 'thread-state' },
    });
    expect(emitted.some((event) => event.type === 'complete')).toBe(false);
  });

  it('falls back to non-subgraph thread state when subgraph state lookup fails after a completed run', async () => {
    const events = [
      { id: 'evt-1', event: 'metadata', data: { run_id: 'run-1', thread_id: 'lg-thread-1' } },
      { id: 'evt-2', event: 'messages', data: [{ type: 'ai', content: 'done' }, { langgraph_node: 'agent' }] },
    ];
    const { client, getState } = createMockClient(events);
    getState
      .mockRejectedValueOnce(new Error('HTTP 500: Internal Server Error'))
      .mockResolvedValueOnce({ interrupts: [] });
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    const emitted = [];
    for await (const event of protocol.sendMessage(session, { content: 'finish', sessionId: 'nim-session-1' })) {
      emitted.push(event);
    }

    expect(getState).toHaveBeenNthCalledWith(1, 'lg-thread-1', undefined, { subgraphs: true, signal: undefined });
    expect(getState).toHaveBeenNthCalledWith(2, 'lg-thread-1', undefined, { subgraphs: false, signal: undefined });
    expect(emitted.at(-1)).toMatchObject({
      type: 'complete',
      metadata: { runId: 'run-1', threadId: 'lg-thread-1' },
    });
    expect(emitted.some((event) => event.type === 'error')).toBe(false);
  });

  it('does not hide persisted interrupts when subgraph state lookup fails', async () => {
    const interruptValue = {
      action_requests: [{
        name: 'edit_file',
        args: { file_path: '/repo/src/app.ts', old_string: 'a', new_string: 'b' },
      }],
    };
    const events = [
      { id: 'evt-1', event: 'metadata', data: { run_id: 'run-1', thread_id: 'lg-thread-1' } },
      { id: 'evt-2', event: 'messages', data: [{ type: 'ai', content: 'need approval' }, { langgraph_node: 'agent' }] },
    ];
    const { client, getState } = createMockClient(events);
    getState
      .mockRejectedValueOnce(new Error('HTTP 500: Internal Server Error'))
      .mockResolvedValueOnce({
        tasks: [{
          id: 'task-1',
          name: 'HumanInTheLoopMiddleware.after_model',
          interrupts: [{ id: 'persisted-interrupt-1', value: interruptValue }],
        }],
      });
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    const emitted = [];
    for await (const event of protocol.sendMessage(session, { content: 'finish', sessionId: 'nim-session-1' })) {
      emitted.push(event);
    }

    expect(getState).toHaveBeenNthCalledWith(1, 'lg-thread-1', undefined, { subgraphs: true, signal: undefined });
    expect(getState).toHaveBeenNthCalledWith(2, 'lg-thread-1', undefined, { subgraphs: false, signal: undefined });
    expect(emitted.at(-1)).toMatchObject({
      type: 'interrupt',
      interrupt: { id: 'persisted-interrupt-1', value: interruptValue },
      metadata: { runId: 'run-1', threadId: 'lg-thread-1', source: 'thread-state' },
    });
    expect(emitted.some((event) => event.type === 'complete')).toBe(false);
  });

  it('does not treat unknown thread state as a clean completion', async () => {
    const events = [
      { id: 'evt-1', event: 'metadata', data: { run_id: 'run-1', thread_id: 'lg-thread-1' } },
      { id: 'evt-2', event: 'messages', data: [{ type: 'ai', content: 'done' }, { langgraph_node: 'agent' }] },
    ];
    const { client, getState } = createMockClient(events);
    getState.mockRejectedValue(new Error('state unavailable'));
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    const collect = async () => {
      const emitted = [];
      for await (const event of protocol.sendMessage(session, { content: 'finish', sessionId: 'nim-session-1' })) {
        emitted.push(event);
      }
      return emitted;
    };

    await expect(collect()).rejects.toThrow('state unavailable');
    expect(getState).toHaveBeenNthCalledWith(1, 'lg-thread-1', undefined, { subgraphs: true, signal: undefined });
    expect(getState).toHaveBeenNthCalledWith(2, 'lg-thread-1', undefined, { subgraphs: false, signal: undefined });
  });

  it('resumes interrupted LangGraph threads with DeepAgents review decisions', async () => {
    const events = [
      { id: 'evt-1', event: 'metadata', data: { run_id: 'run-2', thread_id: 'lg-thread-1' } },
      { id: 'evt-2', event: 'messages', data: [{ type: 'ai', content: 'resumed' }, { langgraph_node: 'agent' }] },
    ];
    const { client, streamRun } = createMockClient(events);
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    const emitted = [];
    for await (const event of protocol.resumeInterruptedSession(
      session,
      [{ type: 'approve' }],
      { sessionId: 'nim-session-1' },
    )) {
      emitted.push(event);
    }

    expect(streamRun).toHaveBeenCalledWith('lg-thread-1', 'smarty_coding_agent', {
      input: undefined,
      command: { resume: { decisions: [{ type: 'approve' }] } },
      metadata: { nimbalystSessionId: 'nim-session-1', langGraphResume: true },
      config: { recursion_limit: 9_999 },
      streamMode: ['messages-tuple', 'updates', 'tasks', 'events'],
      streamSubgraphs: true,
      streamResumable: true,
      signal: undefined,
    });
    expect(emitted).toContainEqual({ type: 'text', content: 'resumed' });
    expect(emitted[emitted.length - 1]).toMatchObject({
      type: 'complete',
      metadata: { runId: 'run-2', threadId: 'lg-thread-1' },
    });
  });

  it('cancels the active LangGraph run with interrupt semantics', async () => {
    const events = [
      { id: 'evt-1', event: 'metadata', data: { run_id: 'run-active', thread_id: 'lg-thread-1' } },
      { id: 'evt-2', event: 'messages', data: [{ type: 'ai', content: 'working' }, { langgraph_node: 'agent' }] },
    ];
    const { client, cancelRun } = createMockClient(events);
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    for await (const _event of protocol.sendMessage(session, { content: 'work', sessionId: 'nim-session-1' })) {
      // Drain once so metadata records the run id.
    }
    const result = await protocol.cancelSessionRuns(session, { wait: false, action: 'interrupt' });

    expect(result).toEqual({ requested: true, method: 'run', runId: 'run-active' });
    expect(cancelRun).toHaveBeenCalledWith('lg-thread-1', 'run-active', false, 'interrupt');
  });

  it('falls back to status-scoped cancellation when no run id is known', async () => {
    const { client, cancelMany } = createMockClient([]);
    delete client.runs.cancel;
    const protocol = new SmartyServerProtocol(() => client);
    const session = await protocol.resumeSession('lg-thread-1', {
      workspacePath: '/repo',
      raw: {
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      },
    });

    const result = await protocol.cancelSessionRuns(session, { wait: false, action: 'interrupt' });

    expect(result).toEqual({ requested: true, method: 'thread-status' });
    expect(cancelMany).toHaveBeenCalledWith({ threadId: 'lg-thread-1', status: 'running', action: 'interrupt' });
    expect(cancelMany).toHaveBeenCalledWith({ threadId: 'lg-thread-1', status: 'pending', action: 'interrupt' });
  });
});
