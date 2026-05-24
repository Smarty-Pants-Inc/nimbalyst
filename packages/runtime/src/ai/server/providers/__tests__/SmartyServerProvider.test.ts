import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SmartyServerProvider } from '../SmartyServerProvider';
import { AgentMessagesRepository } from '../../../../storage/repositories/AgentMessagesRepository';

function createMockProtocol(events: any[] = []) {
  return {
    platform: 'langgraph-agent-server',
    createSession: vi.fn(async () => ({
      id: 'lg-thread-1',
      platform: 'langgraph-agent-server',
      raw: {},
    })),
    resumeSession: vi.fn(async (sessionId: string) => ({
      id: sessionId,
      platform: 'langgraph-agent-server',
      raw: {},
    })),
    forkSession: vi.fn(),
    sendMessage: vi.fn(function* () {
      for (const event of events) {
        yield event;
      }
    }),
    resumeInterruptedSession: vi.fn(function* () {
      // no-op by default
    }),
    abortSession: vi.fn(),
    cancelSessionRuns: vi.fn(async () => ({ requested: true, method: 'run', runId: 'run-1' })),
    cleanupSession: vi.fn(),
  } as any;
}

function createThrowingStreamProtocol() {
  return {
    platform: 'langgraph-agent-server',
    createSession: vi.fn(async () => ({
      id: 'lg-thread-fails-mid-stream',
      platform: 'langgraph-agent-server',
      raw: {},
    })),
    resumeSession: vi.fn(),
    forkSession: vi.fn(),
    sendMessage: vi.fn(async function* () {
      throw new Error('stream interrupted before completion');
    }),
    abortSession: vi.fn(),
    cleanupSession: vi.fn(),
  } as any;
}

function createFileWritingProtocol(filePath: string, content: string, diskFilePath = filePath) {
  return {
    platform: 'langgraph-agent-server',
    createSession: vi.fn(async () => ({
      id: 'lg-thread-file-change',
      platform: 'langgraph-agent-server',
      raw: {},
    })),
    resumeSession: vi.fn(),
    forkSession: vi.fn(),
    sendMessage: vi.fn(async function* () {
      yield {
        type: 'tool_call',
        toolCall: {
          id: 'langgraph-write-1',
          name: 'write_file',
          arguments: { file_path: filePath, content },
        },
      };
      await fs.mkdir(path.dirname(diskFilePath), { recursive: true });
      await fs.writeFile(diskFilePath, content, 'utf8');
      yield {
        type: 'tool_result',
        toolResult: {
          id: 'langgraph-write-1',
          name: 'write_file',
          result: { success: true },
        },
      };
      yield { type: 'complete', content: '' };
    }),
    abortSession: vi.fn(),
    cleanupSession: vi.fn(),
  } as any;
}

describe('SmartyServerProvider', () => {
  afterEach(() => {
    AgentMessagesRepository.clearStore();
    SmartyServerProvider.setPermissionPatternChecker(null);
    SmartyServerProvider.setPermissionPatternSaver(null);
    SmartyServerProvider.setTrustChecker(null);
  });

  it('returns smarty-server identity and agent capabilities', () => {
    const provider = new SmartyServerProvider({ protocol: createMockProtocol() });

    expect(provider.getProviderName()).toBe('smarty-server');
    expect(provider.getDisplayName()).toBe('Smarty Server');
    expect(provider.getCapabilities()).toMatchObject({
      streaming: true,
      tools: true,
      mcpSupport: true,
      edits: true,
      resumeSession: true,
      supportsFileTools: true,
    });
  });

  it('passes explicit local server config to the LangGraph protocol without env fallback', async () => {
    const protocol = createMockProtocol([{ type: 'complete', content: '' }]);
    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    for await (const _chunk of provider.sendMessage('test', undefined, 'session-1', [], '/repo')) {
      // drain
    }

    expect(protocol.createSession).toHaveBeenCalledWith(expect.objectContaining({
      workspacePath: '/repo',
      raw: expect.objectContaining({
        baseUrl: 'http://127.0.0.1:8788',
        assistantId: 'smarty_coding_agent',
        apiKey: null,
      }),
    }));
  });

  it('interrupts a persisted LangGraph thread without an active stream', async () => {
    const protocol = createMockProtocol();
    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });
    provider.setProviderSessionData?.('session-1', {
      providerSessionId: 'lg-thread-1',
    });

    const result = await provider.interruptSession('session-1', {
      workspacePath: '/repo',
    });

    expect(protocol.resumeSession).toHaveBeenCalledWith(
      'lg-thread-1',
      expect.objectContaining({ workspacePath: '/repo' }),
    );
    expect(protocol.cancelSessionRuns).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lg-thread-1' }),
      { wait: false, action: 'interrupt' },
    );
    expect(result).toEqual({ method: 'interrupt' });
  });

  it('streams text and tool chunks from protocol events', async () => {
    const protocol = createMockProtocol([
      { type: 'text', content: 'hello' },
      { type: 'tool_call', toolCall: { id: 'tool-1', name: 'read_file', arguments: { path: 'README.md' } } },
      { type: 'tool_result', toolResult: { id: 'tool-1', name: 'read_file', result: { success: true, result: 'done' } } },
      { type: 'complete', content: '' },
    ]);
    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    for await (const chunk of provider.sendMessage('work', undefined, 'session-2', [], '/repo')) {
      chunks.push(chunk);
    }

    expect(chunks).toContainEqual({ type: 'text', content: 'hello' });
    expect(chunks.some((chunk) => chunk.type === 'tool_call' && chunk.toolCall?.name === 'read_file')).toBe(true);
    expect(chunks.some((chunk) => chunk.type === 'complete')).toBe(true);
  });

  it('persists LangGraph run identity with raw stream events', async () => {
    const protocol = createMockProtocol([
      {
        type: 'raw_event',
        metadata: {
          rawEvent: { id: 'evt-2', event: 'messages', data: [{ type: 'ai', content: 'hello' }] },
          runId: 'run-1',
          threadId: 'lg-thread-1',
        },
      },
      { type: 'complete', content: '' },
    ]);
    const provider = new SmartyServerProvider({ protocol });
    const logSpy = vi.spyOn(provider as any, 'logAgentMessageBestEffort').mockResolvedValue(undefined);
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    for await (const _chunk of provider.sendMessage('work', undefined, 'session-raw-event', [], '/repo')) {
      // drain
    }

    expect(logSpy).toHaveBeenCalledWith(
      'session-raw-event',
      'output',
      expect.any(String),
      expect.objectContaining({
        metadata: expect.objectContaining({
          eventType: 'messages',
          smartyServerProvider: true,
          runId: 'run-1',
          threadId: 'lg-thread-1',
        }),
      }),
    );
  });

  it('saves and resumes the LangGraph thread ID', async () => {
    const protocol = createMockProtocol([{ type: 'complete', content: '' }]);
    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    for await (const _chunk of provider.sendMessage('first', undefined, 'session-resume', [], '/repo')) {
      // drain
    }
    for await (const _chunk of provider.sendMessage('second', undefined, 'session-resume', [], '/repo')) {
      // drain
    }

    expect(provider.getProviderSessionData('session-resume')).toMatchObject({
      providerSessionId: 'lg-thread-1',
      langGraphThreadId: 'lg-thread-1',
    });
    expect(protocol.resumeSession).toHaveBeenCalledWith('lg-thread-1', expect.anything());
  });

  it('captures the LangGraph thread ID before consuming the stream', async () => {
    const protocol = createThrowingStreamProtocol();
    const provider = new SmartyServerProvider({ protocol });
    const captured: any[] = [];
    provider.on('session:providerSessionReceived', (payload) => captured.push(payload));
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    for await (const chunk of provider.sendMessage('first', undefined, 'session-crash', [], '/repo')) {
      chunks.push(chunk);
    }

    expect(captured).toEqual([{
      sessionId: 'session-crash',
      providerSessionId: 'lg-thread-fails-mid-stream',
    }]);
    expect(provider.getProviderSessionData('session-crash')).toMatchObject({
      providerSessionId: 'lg-thread-fails-mid-stream',
      langGraphThreadId: 'lg-thread-fails-mid-stream',
    });
    expect(chunks).toContainEqual({
      type: 'error',
      error: 'stream interrupted before completion',
    });
  });

  it('surfaces LangGraph write interrupts as ToolPermission and resumes with approval', async () => {
    const interruptEvent = {
      type: 'interrupt',
      interrupt: {
        id: 'interrupt-1',
        value: {
          action_requests: [{
            name: 'write_file',
            args: { file_path: '/tmp/probe.txt', content: 'ok' },
            description: 'Tool execution requires approval',
          }],
          review_configs: [{ action_name: 'write_file', allowed_decisions: ['approve', 'reject'] }],
        },
      },
      metadata: { runId: 'run-1', threadId: 'lg-thread-1' },
    };
    const protocol = createMockProtocol([interruptEvent]);
    protocol.resumeInterruptedSession = vi.fn(function* (_session: any, _decisions: any) {
      yield { type: 'text', content: 'write approved' };
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    const resolvedEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'allow', scope: 'once' },
        event.sessionId,
      );
    });
    provider.on('toolPermission:resolved', (event) => resolvedEvents.push(event));
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    for await (const chunk of provider.sendMessage('write file', undefined, 'session-approval', [], '/repo')) {
      chunks.push(chunk);
    }

    expect(pendingEvents).toHaveLength(1);
    expect(pendingEvents[0]).toMatchObject({
      sessionId: 'session-approval',
      workspacePath: '/repo',
      request: {
        toolName: 'write_file',
        hasDestructiveActions: true,
      },
    });
    expect(resolvedEvents).toHaveLength(1);
    expect(protocol.resumeInterruptedSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lg-thread-1' }),
      [{ type: 'approve' }],
      { sessionId: 'session-approval' },
    );
    expect(chunks).toContainEqual({ type: 'text', content: 'write approved' });
    expect(chunks.some((chunk) => chunk.type === 'complete')).toBe(true);
  });

  it('keeps session and saved LangGraph file approvals scoped to the approved path', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-path-scoped-session-'));
    const savedPatterns: Array<{ workspacePath: string; pattern: string }> = [];
    SmartyServerProvider.setPermissionPatternSaver(async (workspacePath, pattern) => {
      savedPatterns.push({ workspacePath, pattern });
    });
    SmartyServerProvider.setPermissionPatternChecker(async () => false);

    const protocol = createMockProtocol();
    let sendCount = 0;
    protocol.sendMessage = vi.fn(async function* () {
      sendCount += 1;
      const relativePath = sendCount === 1 ? 'src/approved.ts' : 'src/different.ts';
      yield {
        type: 'interrupt',
        interrupt: {
          id: `interrupt-${sendCount}`,
          value: {
            action_requests: [{
              name: 'write_file',
              args: { file_path: relativePath, content: `content ${sendCount}` },
              description: `Write ${relativePath}`,
            }],
            review_configs: [{ action_name: 'write_file', allowed_decisions: ['approve', 'reject'] }],
          },
        },
        metadata: { runId: `run-${sendCount}`, threadId: 'lg-thread-path-scoped-session' },
      };
    });
    protocol.resumeInterruptedSession = vi.fn(async function* () {
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      const response = pendingEvents.length === 1
        ? { decision: 'allow' as const, scope: 'always' as const }
        : { decision: 'deny' as const, scope: 'once' as const };
      provider.resolveToolPermission(event.requestId, response, event.sessionId);
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    try {
      for await (const _chunk of provider.sendMessage('write first file', undefined, 'session-path-scoped-cache', [], workspace)) {
        // drain first approval
      }
      for await (const _chunk of provider.sendMessage('write second file', undefined, 'session-path-scoped-cache', [], workspace)) {
        // drain second approval
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }

    expect(pendingEvents).toHaveLength(2);
    const patterns = pendingEvents.map(
      (event) => event.request.actionsNeedingApproval[0].action.pattern,
    );
    expect(patterns).toEqual(['Write(src/approved.ts)', 'Write(src/different.ts)']);
    expect(savedPatterns).toEqual([{ workspacePath: workspace, pattern: 'Write(src/approved.ts)' }]);
    expect(protocol.resumeInterruptedSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'lg-thread-1' }),
      [{ type: 'approve' }],
      { sessionId: 'session-path-scoped-cache' },
    );
    expect(protocol.resumeInterruptedSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'lg-thread-1' }),
      [{ type: 'reject' }],
      { sessionId: 'session-path-scoped-cache' },
    );
  });

  it('does not let a persisted broad Write approval bypass a different LangGraph file path', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-path-scoped-persisted-'));
    const checkedPatterns: string[] = [];
    SmartyServerProvider.setPermissionPatternChecker(async (_workspacePath, pattern) => {
      checkedPatterns.push(pattern);
      return pattern === 'Write';
    });

    const protocol = createMockProtocol([
      {
        type: 'interrupt',
        interrupt: {
          id: 'interrupt-persisted-broad-write',
          value: {
            action_requests: [{
              name: 'write_file',
              args: { file_path: 'src/different.ts', content: 'must still ask' },
              description: 'Write a different file',
            }],
            review_configs: [{ action_name: 'write_file', allowed_decisions: ['approve', 'reject'] }],
          },
        },
        metadata: { runId: 'run-persisted-broad-write', threadId: 'lg-thread-persisted-broad-write' },
      },
    ]);
    protocol.resumeInterruptedSession = vi.fn(async function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'reject' }]);
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'deny', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    try {
      for await (const _chunk of provider.sendMessage('write another file', undefined, 'session-persisted-broad-write', [], workspace)) {
        // drain
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }

    expect(checkedPatterns).toEqual(['Write(src/different.ts)']);
    expect(pendingEvents).toHaveLength(1);
    expect(pendingEvents[0].request.actionsNeedingApproval[0].action.pattern).toBe('Write(src/different.ts)');
    expect(protocol.resumeInterruptedSession).toHaveBeenCalled();
  });

  it('keeps session and saved LangGraph execute approvals scoped to the exact command', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-execute-scoped-session-'));
    const savedPatterns: string[] = [];
    SmartyServerProvider.setPermissionPatternSaver(async (_workspacePath, pattern) => {
      savedPatterns.push(pattern);
    });
    SmartyServerProvider.setPermissionPatternChecker(async () => false);

    const protocol = createMockProtocol();
    let sendCount = 0;
    protocol.sendMessage = vi.fn(async function* () {
      sendCount += 1;
      const command = sendCount === 1 ? 'npm test -- --runInBand' : 'npm run build';
      yield {
        type: 'interrupt',
        interrupt: {
          id: `interrupt-execute-${sendCount}`,
          value: {
            action_requests: [{
              name: 'execute',
              args: { command },
              description: `Run ${command}`,
            }],
            review_configs: [{ action_name: 'execute', allowed_decisions: ['approve', 'reject'] }],
          },
        },
        metadata: { runId: `run-execute-${sendCount}`, threadId: 'lg-thread-execute-scoped' },
      };
    });
    protocol.resumeInterruptedSession = vi.fn(async function* () {
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      const response = pendingEvents.length === 1
        ? { decision: 'allow' as const, scope: 'always' as const }
        : { decision: 'deny' as const, scope: 'once' as const };
      provider.resolveToolPermission(event.requestId, response, event.sessionId);
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    try {
      for await (const _chunk of provider.sendMessage('run first command', undefined, 'session-execute-scoped', [], workspace)) {
        // drain first approval
      }
      for await (const _chunk of provider.sendMessage('run second command', undefined, 'session-execute-scoped', [], workspace)) {
        // drain second approval
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }

    expect(pendingEvents).toHaveLength(2);
    const patterns = pendingEvents.map(
      (event) => event.request.actionsNeedingApproval[0].action.pattern,
    );
    expect(patterns[0]).toMatch(/^Execute\(command:[a-f0-9]{16}\)$/);
    expect(patterns[1]).toMatch(/^Execute\(command:[a-f0-9]{16}\)$/);
    expect(patterns[0]).not.toBe(patterns[1]);
    expect(savedPatterns).toEqual([patterns[0]]);
    expect(protocol.resumeInterruptedSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'lg-thread-1' }),
      [{ type: 'approve' }],
      { sessionId: 'session-execute-scoped' },
    );
    expect(protocol.resumeInterruptedSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'lg-thread-1' }),
      [{ type: 'reject' }],
      { sessionId: 'session-execute-scoped' },
    );
  });

  it('keeps LangGraph edit approvals scoped to the approved path', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-edit-path-scoped-'));
    const savedPatterns: string[] = [];
    SmartyServerProvider.setPermissionPatternSaver(async (_workspacePath, pattern) => {
      savedPatterns.push(pattern);
    });
    SmartyServerProvider.setPermissionPatternChecker(async () => false);

    const protocol = createMockProtocol();
    let sendCount = 0;
    protocol.sendMessage = vi.fn(async function* () {
      sendCount += 1;
      const relativePath = sendCount === 1 ? 'src/approved.ts' : 'src/different.ts';
      yield {
        type: 'interrupt',
        interrupt: {
          id: `interrupt-edit-${sendCount}`,
          value: {
            action_requests: [{
              name: 'edit_file',
              args: { file_path: relativePath, old_string: 'old', new_string: 'new' },
              description: `Edit ${relativePath}`,
            }],
            review_configs: [{ action_name: 'edit_file', allowed_decisions: ['approve', 'reject'] }],
          },
        },
        metadata: { runId: `run-edit-${sendCount}`, threadId: 'lg-thread-edit-path-scoped' },
      };
    });
    protocol.resumeInterruptedSession = vi.fn(async function* () {
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      const response = pendingEvents.length === 1
        ? { decision: 'allow' as const, scope: 'always' as const }
        : { decision: 'deny' as const, scope: 'once' as const };
      provider.resolveToolPermission(event.requestId, response, event.sessionId);
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    try {
      for await (const _chunk of provider.sendMessage('edit first file', undefined, 'session-edit-path-scoped', [], workspace)) {
        // drain
      }
      for await (const _chunk of provider.sendMessage('edit second file', undefined, 'session-edit-path-scoped', [], workspace)) {
        // drain
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }

    expect(pendingEvents).toHaveLength(2);
    expect(pendingEvents.map((event) => event.request.actionsNeedingApproval[0].action.pattern)).toEqual([
      'Edit(src/approved.ts)',
      'Edit(src/different.ts)',
    ]);
    expect(savedPatterns).toEqual(['Edit(src/approved.ts)']);
    expect(protocol.resumeInterruptedSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'lg-thread-1' }),
      [{ type: 'reject' }],
      { sessionId: 'session-edit-path-scoped' },
    );
  });

  it('normalizes virtual workspace file approvals before deriving permission patterns', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-virtual-pattern-'));
    const protocol = createMockProtocol([
      {
        type: 'interrupt',
        interrupt: {
          id: 'interrupt-virtual-pattern',
          value: {
            action_requests: [{
              name: 'write_file',
              args: { file_path: '/forks/nimbalyst/src/virtual.ts', content: 'ok' },
              description: 'Write virtual workspace file',
            }],
            review_configs: [{ action_name: 'write_file', allowed_decisions: ['approve', 'reject'] }],
          },
        },
        metadata: { runId: 'run-virtual-pattern', threadId: 'lg-thread-virtual-pattern' },
      },
    ]);
    protocol.resumeInterruptedSession = vi.fn(async function* () {
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(event.requestId, { decision: 'deny', scope: 'once' }, event.sessionId);
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    try {
      for await (const _chunk of provider.sendMessage('write virtual file', undefined, 'session-virtual-pattern', [], workspace)) {
        // drain
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }

    expect(pendingEvents).toHaveLength(1);
    const approval = pendingEvents[0].request.actionsNeedingApproval[0];
    expect(approval.action.pattern).toBe('Write(forks/nimbalyst/src/virtual.ts)');
    expect(approval.outsidePaths).toEqual([]);
  });

  it('keeps outside-workspace file approval patterns distinct by raw target', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-outside-pattern-'));
    const outsideA = path.join(path.dirname(workspace), `outside-a-${Date.now()}.ts`);
    const outsideB = path.join(path.dirname(workspace), `outside-b-${Date.now()}.ts`);
    const protocol = createMockProtocol();
    let sendCount = 0;
    protocol.sendMessage = vi.fn(async function* () {
      sendCount += 1;
      const target = sendCount === 1 ? outsideA : outsideB;
      yield {
        type: 'interrupt',
        interrupt: {
          id: `interrupt-outside-pattern-${sendCount}`,
          value: {
            action_requests: [{
              name: 'write_file',
              args: { file_path: target, content: 'outside' },
              description: `Write ${target}`,
            }],
            review_configs: [{ action_name: 'write_file', allowed_decisions: ['approve', 'reject'] }],
          },
        },
        metadata: { runId: `run-outside-pattern-${sendCount}`, threadId: 'lg-thread-outside-pattern' },
      };
    });
    protocol.resumeInterruptedSession = vi.fn(async function* () {
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(event.requestId, { decision: 'deny', scope: 'once' }, event.sessionId);
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    try {
      for await (const _chunk of provider.sendMessage('write outside A', undefined, 'session-outside-pattern', [], workspace)) {
        // drain
      }
      for await (const _chunk of provider.sendMessage('write outside B', undefined, 'session-outside-pattern', [], workspace)) {
        // drain
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
      await fs.rm(outsideA, { force: true });
      await fs.rm(outsideB, { force: true });
    }

    expect(pendingEvents).toHaveLength(2);
    expect(pendingEvents.map((event) => event.request.actionsNeedingApproval[0].action.pattern)).toEqual([
      `Write(outside:${outsideA})`,
      `Write(outside:${outsideB})`,
    ]);
    for (const event of pendingEvents) {
      const approval = event.request.actionsNeedingApproval[0];
      expect(approval.outsidePaths).toHaveLength(1);
      expect(approval.warnings.join('\n')).toContain('outside the active workspace/worktree');
    }
  });

  it('emits Nimbalyst file-change snapshots for live approved LangGraph edit interrupts', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-live-approved-edit-'));
    const target = path.join(
      workspace,
      'forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts',
    );
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, 'export const status = "fresh";\n', 'utf8');

    const interruptEvent = {
      type: 'interrupt',
      interrupt: {
        id: 'interrupt-live-edit',
        value: {
          action_requests: [{
            name: 'edit_file',
            args: {
              file_path: '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts',
              old_string: 'fresh',
              new_string: 'stale',
            },
            description: 'Update validation summary status',
          }],
          review_configs: [{ action_name: 'edit_file', allowed_decisions: ['approve', 'reject'] }],
        },
      },
      metadata: { runId: 'run-live-edit', threadId: 'lg-thread-live-edit' },
    };
    const protocol = createMockProtocol([interruptEvent]);
    protocol.resumeInterruptedSession = vi.fn(function* () {
      yield { type: 'text', content: 'edit approved' };
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    provider.on('toolPermission:pending', (event) => {
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'allow', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    try {
      for await (const chunk of provider.sendMessage('edit file', undefined, 'session-live-edit', [], workspace)) {
        chunks.push(chunk);
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }

    expect(chunks).toContainEqual({
      type: 'pre_edit_snapshot',
      preEditSnapshot: {
        toolUseId: 'langgraph-interrupt-live-edit-0',
        authoritative: true,
        entries: [{ path: target, content: 'export const status = "fresh";\n', kind: 'update' }],
      },
    });
    expect(chunks).toContainEqual(expect.objectContaining({
      type: 'tool_call',
      toolCall: expect.objectContaining({
        id: 'langgraph-interrupt-live-edit-0',
        name: 'file_change',
        arguments: { changes: [{ path: target, kind: 'update' }] },
      }),
    }));
    expect(chunks).toContainEqual({ type: 'text', content: 'edit approved' });
  });

  it('continues after an approved interrupt resume that only executes tools', async () => {
    const interruptEvent = {
      type: 'interrupt',
      interrupt: {
        id: 'interrupt-tool-only-resume',
        value: {
          action_requests: [{
            name: 'execute',
            args: { command: 'pwd' },
            description: 'Tool execution requires approval',
          }],
          review_configs: [{ action_name: 'execute', allowed_decisions: ['approve', 'reject'] }],
        },
      },
      metadata: { runId: 'run-tool-only-resume', threadId: 'lg-thread-continue' },
    };
    const protocol = {
      platform: 'langgraph-agent-server',
      createSession: vi.fn(async () => ({
        id: 'lg-thread-continue',
        platform: 'langgraph-agent-server',
        raw: {},
      })),
      resumeSession: vi.fn(),
      forkSession: vi.fn(),
      sendMessage: vi.fn(async function* (_session: any, message: any) {
        if (message.content === 'initial coding task') {
          yield interruptEvent;
          return;
        }
        yield { type: 'text', content: 'continued after approved tool result' };
        yield { type: 'complete', content: '' };
      }),
      resumeInterruptedSession: vi.fn(async function* () {
        yield {
          type: 'tool_result',
          toolResult: {
            id: 'execute-1',
            name: 'execute',
            result: { exitCode: 0, output: '/repo\n' },
          },
        };
        yield { type: 'complete', content: '' };
      }),
      abortSession: vi.fn(),
      cancelSessionRuns: vi.fn(async () => ({ requested: true, method: 'run', runId: 'run-1' })),
      cleanupSession: vi.fn(),
    } as any;

    const provider = new SmartyServerProvider({ protocol });
    provider.on('toolPermission:pending', (event) => {
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'allow', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    for await (const chunk of provider.sendMessage('initial coding task', undefined, 'session-tool-only-resume', [], '/repo')) {
      chunks.push(chunk);
    }

    expect(protocol.resumeInterruptedSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lg-thread-continue' }),
      [{ type: 'approve' }],
      { sessionId: 'session-tool-only-resume' },
    );
    expect(protocol.sendMessage).toHaveBeenCalledTimes(2);
    expect(protocol.sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'lg-thread-continue' }),
      expect.objectContaining({
        content: expect.stringContaining('Continue the approved Smarty Code task'),
        sessionId: 'session-tool-only-resume',
      }),
    );
    expect(chunks).toContainEqual({ type: 'text', content: 'continued after approved tool result' });
  });

  it('continues when the agent asks for approval in prose instead of triggering the permission UI', async () => {
    const protocol = {
      platform: 'langgraph-agent-server',
      createSession: vi.fn(async () => ({
        id: 'lg-thread-approval-handoff',
        platform: 'langgraph-agent-server',
        raw: {},
      })),
      resumeSession: vi.fn(),
      forkSession: vi.fn(),
      sendMessage: vi.fn(async function* (_session: any, message: any) {
        if (message.content === 'please use TDD, run tests, and edit the tracker UI with approval') {
          yield {
            type: 'tool_result',
            toolResult: {
              id: 'read-1',
              name: 'read_file',
              result: { success: true, result: 'current UI code' },
            },
          };
          yield { type: 'text', content: 'Ready for the first approval-gated step.' };
          yield { type: 'complete', content: '' };
          return;
        }
        yield {
          type: 'interrupt',
          interrupt: {
            id: 'interrupt-after-approval-nudge',
            value: {
              action_requests: [{
                name: 'execute',
                args: { command: 'npm test -- TrackerItemDetail' },
                description: 'Tool execution requires approval',
              }],
              review_configs: [{ action_name: 'execute', allowed_decisions: ['approve', 'reject'] }],
            },
          },
          metadata: { runId: 'run-after-approval-nudge', threadId: 'lg-thread-approval-handoff' },
        };
      }),
      resumeInterruptedSession: vi.fn(async function* () {
        yield { type: 'text', content: 'approved command ran' };
        yield { type: 'complete', content: '' };
      }),
      abortSession: vi.fn(),
      cancelSessionRuns: vi.fn(async () => ({ requested: true, method: 'run', runId: 'run-1' })),
      cleanupSession: vi.fn(),
    } as any;

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'allow', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    for await (const chunk of provider.sendMessage(
      'please use TDD, run tests, and edit the tracker UI with approval',
      undefined,
      'session-approval-handoff',
      [],
      '/repo',
    )) {
      chunks.push(chunk);
    }

    expect(protocol.sendMessage).toHaveBeenCalledTimes(2);
    expect(protocol.sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'lg-thread-approval-handoff' }),
      expect.objectContaining({
        content: expect.stringContaining('without triggering the Smarty Code permission UI'),
        sessionId: 'session-approval-handoff',
      }),
    );
    expect(pendingEvents).toHaveLength(1);
    expect(protocol.resumeInterruptedSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lg-thread-approval-handoff' }),
      [{ type: 'approve' }],
      { sessionId: 'session-approval-handoff' },
    );
    expect(chunks).toContainEqual({ type: 'text', content: 'approved command ran' });
    expect(chunks.some((chunk) => chunk.type === 'complete')).toBe(true);
  });

  it('continues when a coding task stalls after read-only progress without triggering approval', async () => {
    const protocol = {
      platform: 'langgraph-agent-server',
      createSession: vi.fn(async () => ({
        id: 'lg-thread-readonly-stall',
        platform: 'langgraph-agent-server',
        raw: {},
      })),
      resumeSession: vi.fn(),
      forkSession: vi.fn(),
      sendMessage: vi.fn(async function* (_session: any, message: any) {
        if (message.content === 'please use a TDD loop, run tests, edit the tracker UI, and ask for approval before commands') {
          yield {
            type: 'tool_result',
            toolResult: {
              id: 'grep-1',
              name: 'grep',
              result: { success: true, result: 'TrackerItemDetail.tsx' },
            },
          };
          yield { type: 'text', content: 'I found the linked-session row and am reading the transcript code next.' };
          yield { type: 'complete', content: '' };
          return;
        }
        yield {
          type: 'interrupt',
          interrupt: {
            id: 'interrupt-after-readonly-stall',
            value: {
              action_requests: [{
                name: 'execute',
                args: { command: 'npm test -- TrackerItemDetail' },
                description: 'Tool execution requires approval',
              }],
              review_configs: [{ action_name: 'execute', allowed_decisions: ['approve', 'reject'] }],
            },
          },
          metadata: { runId: 'run-after-readonly-stall', threadId: 'lg-thread-readonly-stall' },
        };
      }),
      resumeInterruptedSession: vi.fn(async function* () {
        yield { type: 'text', content: 'approved stalled command ran' };
        yield { type: 'complete', content: '' };
      }),
      abortSession: vi.fn(),
      cancelSessionRuns: vi.fn(async () => ({ requested: true, method: 'run', runId: 'run-1' })),
      cleanupSession: vi.fn(),
    } as any;

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'allow', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    for await (const chunk of provider.sendMessage(
      'please use a TDD loop, run tests, edit the tracker UI, and ask for approval before commands',
      undefined,
      'session-readonly-stall',
      [],
      '/repo',
    )) {
      chunks.push(chunk);
    }

    expect(protocol.sendMessage).toHaveBeenCalledTimes(2);
    expect(protocol.sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'lg-thread-readonly-stall' }),
      expect.objectContaining({
        content: expect.stringContaining('read-only/progress work without triggering the Smarty Code permission UI'),
        sessionId: 'session-readonly-stall',
      }),
    );
    expect(pendingEvents).toHaveLength(1);
    expect(chunks).toContainEqual({ type: 'text', content: 'approved stalled command ran' });
    expect(chunks.some((chunk) => chunk.type === 'complete')).toBe(true);
  });

  it('continues when a coding task stalls after pure planning text without triggering approval', async () => {
    const protocol = {
      platform: 'langgraph-agent-server',
      createSession: vi.fn(async () => ({
        id: 'lg-thread-planning-stall',
        platform: 'langgraph-agent-server',
        raw: {},
      })),
      resumeSession: vi.fn(),
      forkSession: vi.fn(),
      sendMessage: vi.fn(async function* (_session: any, message: any) {
        if (message.content === 'please use a TDD loop, edit the tracker UI, and ask for approval before commands') {
          yield { type: 'text', content: 'I will inspect the tracker code, add the focused test, then request approval.' };
          yield { type: 'complete', content: '' };
          return;
        }
        yield {
          type: 'interrupt',
          interrupt: {
            id: 'interrupt-after-planning-stall',
            value: {
              action_requests: [{
                name: 'execute',
                args: { command: 'npm test -- TrackerItemDetail' },
                description: 'Tool execution requires approval',
              }],
              review_configs: [{ action_name: 'execute', allowed_decisions: ['approve', 'reject'] }],
            },
          },
          metadata: { runId: 'run-after-planning-stall', threadId: 'lg-thread-planning-stall' },
        };
      }),
      resumeInterruptedSession: vi.fn(async function* () {
        yield { type: 'text', content: 'approved planning-stall command ran' };
        yield { type: 'complete', content: '' };
      }),
      abortSession: vi.fn(),
      cancelSessionRuns: vi.fn(async () => ({ requested: true, method: 'run', runId: 'run-1' })),
      cleanupSession: vi.fn(),
    } as any;

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'allow', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    for await (const chunk of provider.sendMessage(
      'please use a TDD loop, edit the tracker UI, and ask for approval before commands',
      undefined,
      'session-planning-stall',
      [],
      '/repo',
    )) {
      chunks.push(chunk);
    }

    expect(protocol.sendMessage).toHaveBeenCalledTimes(2);
    expect(protocol.sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'lg-thread-planning-stall' }),
      expect.objectContaining({
        content: expect.stringContaining('read-only/progress work without triggering the Smarty Code permission UI'),
        sessionId: 'session-planning-stall',
      }),
    );
    expect(pendingEvents).toHaveLength(1);
    expect(chunks).toContainEqual({ type: 'text', content: 'approved planning-stall command ran' });
    expect(chunks.some((chunk) => chunk.type === 'complete')).toBe(true);
  });

  it('does not continue no-edit tasks that explicitly forbid shell commands', async () => {
    const protocol = createMockProtocol([
      {
        type: 'tool_call',
        toolCall: { id: 'todos-1', name: 'write_todos', arguments: { todos: [] } },
      },
      {
        type: 'tool_result',
        toolResult: { id: 'todos-1', name: 'write_todos', result: { success: true } },
      },
      { type: 'text', content: 'SMARTY_PLAN_NOFANOUT_20260522' },
      { type: 'complete', content: '' },
    ]);
    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    for await (const chunk of provider.sendMessage(
      'This is a deliberately sequential no-edit task. Do not edit files, run shell commands, or call a child agent.',
      undefined,
      'session-no-edit',
      [],
      '/repo',
    )) {
      chunks.push(chunk);
    }

    expect(protocol.sendMessage).toHaveBeenCalledTimes(1);
    expect(chunks).toContainEqual({ type: 'text', content: 'SMARTY_PLAN_NOFANOUT_20260522' });
    expect(chunks.some((chunk) => chunk.type === 'complete')).toBe(true);
  });

  it('marks LangGraph write approvals that target paths outside the active workspace', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-scope-workspace-'));
    const outsidePath = path.join(path.dirname(workspace), `outside-${Date.now()}.txt`);
    const interruptEvent = {
      type: 'interrupt',
      interrupt: {
        id: 'interrupt-outside-path',
        value: {
          action_requests: [{
            name: 'write_file',
            args: { file_path: outsidePath, content: 'nope' },
            description: 'Tool execution requires approval',
          }],
          review_configs: [{ action_name: 'write_file', allowed_decisions: ['approve', 'reject'] }],
        },
      },
      metadata: { runId: 'run-outside-path', threadId: 'lg-thread-outside-path' },
    };
    const protocol = createMockProtocol([interruptEvent]);
    protocol.resumeInterruptedSession = vi.fn(function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'reject' }]);
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'deny', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    try {
      for await (const _chunk of provider.sendMessage('write outside workspace', undefined, 'session-outside-path', [], workspace)) {
        // drain
      }

      expect(pendingEvents).toHaveLength(1);
      const approval = pendingEvents[0].request.actionsNeedingApproval[0];
      expect(approval.action.referencedPaths).toEqual([outsidePath]);
      expect(approval.outsidePaths).toEqual([outsidePath]);
      expect(approval.warnings.join('\n')).toContain('outside the active workspace/worktree');
      expect(protocol.resumeInterruptedSession).toHaveBeenCalled();
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
      await fs.rm(outsidePath, { force: true });
    }
  });

  it('marks LangGraph shell approvals that reference paths outside the active workspace', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-shell-scope-workspace-'));
    const outsidePath = path.join(path.dirname(workspace), `shell-outside-${Date.now()}.txt`);
    const interruptEvent = {
      type: 'interrupt',
      interrupt: {
        id: 'interrupt-shell-outside-path',
        value: {
          action_requests: [{
            name: 'execute',
            args: { command: `sh -c 'printf nope > ${outsidePath}'` },
            description: 'Tool execution requires approval',
          }],
          review_configs: [{ action_name: 'execute', allowed_decisions: ['approve', 'reject'] }],
        },
      },
      metadata: { runId: 'run-shell-outside-path', threadId: 'lg-thread-shell-outside-path' },
    };
    const protocol = createMockProtocol([interruptEvent]);
    protocol.resumeInterruptedSession = vi.fn(function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'reject' }]);
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'deny', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    try {
      for await (const _chunk of provider.sendMessage('shell write outside workspace', undefined, 'session-shell-outside-path', [], workspace)) {
        // drain
      }

      expect(pendingEvents).toHaveLength(1);
      const approval = pendingEvents[0].request.actionsNeedingApproval[0];
      expect(approval.isDestructive).toBe(true);
      expect(approval.action.referencedPaths).toEqual([outsidePath]);
      expect(approval.outsidePaths).toEqual([outsidePath]);
      expect(approval.warnings.join('\n')).toContain('outside the active workspace/worktree');
      expect(protocol.resumeInterruptedSession).toHaveBeenCalled();
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
      await fs.rm(outsidePath, { force: true });
    }
  });

  it('treats LangGraph shell virtual workspace paths as inside the active workspace', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-shell-virtual-workspace-'));
    await fs.mkdir(path.join(workspace, 'forks', 'nimbalyst'), { recursive: true });
    const interruptEvent = {
      type: 'interrupt',
      interrupt: {
        id: 'interrupt-shell-virtual-path',
        value: {
          action_requests: [{
            name: 'execute',
            args: { command: 'git -C "/forks/nimbalyst" status --short' },
            description: 'Tool execution requires approval',
          }],
          review_configs: [{ action_name: 'execute', allowed_decisions: ['approve', 'reject'] }],
        },
      },
      metadata: { runId: 'run-shell-virtual-path', threadId: 'lg-thread-shell-virtual-path' },
    };
    const protocol = createMockProtocol([interruptEvent]);
    protocol.resumeInterruptedSession = vi.fn(function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'approve' }]);
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'allow', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    try {
      for await (const _chunk of provider.sendMessage('shell inspect virtual workspace path', undefined, 'session-shell-virtual-path', [], workspace)) {
        // drain
      }

      expect(pendingEvents).toHaveLength(1);
      const approval = pendingEvents[0].request.actionsNeedingApproval[0];
      expect(approval.action.referencedPaths).toEqual(['/forks/nimbalyst']);
      expect(approval.outsidePaths).toEqual([]);
      expect(approval.warnings.join('\n')).not.toContain('outside the active workspace/worktree');
      expect(protocol.resumeInterruptedSession).toHaveBeenCalled();
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  it('resumes a persisted interrupted approval after provider recreation', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-durable-approval-'));
    const target = path.join(workspace, 'approved-after-restart.txt');
    const content = 'durable approval resumed\n';
    const protocol = createMockProtocol();
    protocol.resumeInterruptedSession = vi.fn(async function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'approve' }]);
      yield {
        type: 'tool_call',
        toolCall: {
          id: 'langgraph-write-after-restart',
          name: 'write_file',
          arguments: { file_path: target, content },
        },
      };
      await fs.writeFile(target, content, 'utf8');
      yield {
        type: 'tool_result',
        toolResult: {
          id: 'langgraph-write-after-restart',
          name: 'write_file',
          result: { success: true },
        },
      };
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent', baseUrl: 'http://127.0.0.1:8791' });
    provider.setProviderSessionData('session-durable-approval', {
      providerSessionId: 'lg-thread-durable-approval',
    });

    try {
      const chunks = await provider.resolveToolPermission(
        'langgraph-interrupt-after-restart-0',
        { decision: 'allow', scope: 'once' },
        'session-durable-approval',
        'desktop',
        { workspacePath: workspace },
      );

      await expect(fs.readFile(target, 'utf8')).resolves.toBe(content);
      expect(chunks).toContainEqual({
        type: 'pre_edit_snapshot',
        preEditSnapshot: {
          toolUseId: 'langgraph-write-after-restart',
          authoritative: true,
          entries: [{ path: target, content: '', kind: 'add' }],
        },
      });
      expect(chunks).toContainEqual({
        type: 'post_edit_snapshot',
        postEditSnapshot: {
          toolUseId: 'langgraph-write-after-restart',
          entries: [{ path: target, content, kind: 'add' }],
        },
      });
      expect(chunks).toContainEqual(expect.objectContaining({
        type: 'tool_call',
        toolCall: expect.objectContaining({
          id: 'langgraph-write-after-restart',
          name: 'file_change',
          arguments: { changes: [{ path: target, kind: 'add' }] },
        }),
      }));
      expect(chunks).toContainEqual(expect.objectContaining({
        type: 'complete',
        isComplete: true,
      }));
      expect(protocol.resumeSession).toHaveBeenCalledWith(
        'lg-thread-durable-approval',
        expect.objectContaining({
          workspacePath: workspace,
          raw: expect.objectContaining({
            baseUrl: 'http://127.0.0.1:8791',
            assistantId: 'smarty_coding_agent',
            apiKey: null,
          }),
        }),
      );
      expect(protocol.resumeInterruptedSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'lg-thread-durable-approval' }),
        [{ type: 'approve' }],
        { sessionId: 'session-durable-approval' },
      );
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  it('emits file-change chunks for a persisted approved edit when the resumed stream omits tool lifecycle events', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-durable-approved-edit-log-'));
    const target = path.join(
      workspace,
      'forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts',
    );
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, 'export const status = "fresh";\n', 'utf8');
    const updatedContent = 'export const status = "stale";\n';

    const requestId = 'langgraph-interrupt-durable-logged-edit-0';
    const storedMessages = [
      ...Array.from({ length: 225 }, (_, index) => ({
        sessionId: 'session-durable-logged-edit',
        source: 'smarty-server',
        direction: 'output' as const,
        content: JSON.stringify({ type: 'progress', index }),
      })),
      {
        sessionId: 'session-durable-logged-edit',
        source: 'smarty-server',
        direction: 'output' as const,
        content: JSON.stringify({
          type: 'nimbalyst_tool_use',
          id: requestId,
          name: 'ToolPermission',
          input: {
            requestId,
            toolName: 'edit_file',
            description: 'Fix validation stale summary',
            langGraphActionIndex: 0,
            allowedDecisions: ['approve', 'reject'],
            args: {
              file_path: '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts',
              old_string: 'fresh',
              new_string: 'stale',
            },
          },
        }),
      },
    ];
    AgentMessagesRepository.setStore({
      create: vi.fn(async () => {}),
      list: vi.fn(async (_sessionId, options) => {
        const limit = options?.limit ?? storedMessages.length;
        const offset = options?.offset ?? 0;
        return storedMessages.slice(offset, offset + limit);
      }),
    });

    const protocol = createMockProtocol();
    protocol.resumeInterruptedSession = vi.fn(async function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'approve' }]);
      await fs.writeFile(target, updatedContent, 'utf8');
      yield { type: 'text', content: 'edit approved after restart' };
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent', baseUrl: 'http://127.0.0.1:8791' });
    provider.setProviderSessionData('session-durable-logged-edit', {
      providerSessionId: 'lg-thread-durable-logged-edit',
    });

    try {
      const chunks = await provider.resolveToolPermission(
        requestId,
        { decision: 'allow', scope: 'once' },
        'session-durable-logged-edit',
        'desktop',
        { workspacePath: workspace },
      );

      expect(chunks).toContainEqual({
        type: 'pre_edit_snapshot',
        preEditSnapshot: {
          toolUseId: requestId,
          authoritative: true,
          entries: [{ path: target, content: 'export const status = "fresh";\n', kind: 'update' }],
        },
      });
      expect(chunks).toContainEqual(expect.objectContaining({
        type: 'tool_call',
        toolCall: expect.objectContaining({
          id: requestId,
          name: 'file_change',
          arguments: { changes: [{ path: target, kind: 'update' }] },
        }),
      }));
      expect(chunks).toContainEqual({
        type: 'post_edit_snapshot',
        postEditSnapshot: {
          toolUseId: requestId,
          entries: [{ path: target, content: updatedContent, kind: 'update' }],
        },
      });
      expect(chunks).toContainEqual({ type: 'text', content: 'edit approved after restart' });
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  it('does not invent a successful post-edit snapshot when a persisted approved edit produces no disk change', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-durable-approved-edit-noop-'));
    const target = path.join(workspace, 'forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, 'export const status = "fresh";\n', 'utf8');

    const requestId = 'langgraph-interrupt-durable-noop-edit-0';
    AgentMessagesRepository.setStore({
      create: vi.fn(async () => {}),
      list: vi.fn(async () => [{
        sessionId: 'session-durable-noop-edit',
        source: 'smarty-server',
        direction: 'output' as const,
        content: JSON.stringify({
          type: 'nimbalyst_tool_use',
          id: requestId,
          name: 'ToolPermission',
          input: {
            requestId,
            toolName: 'edit_file',
            args: {
              file_path: '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts',
              old_string: 'fresh',
              new_string: 'fresh',
            },
          },
        }),
      }]),
    });

    const protocol = createMockProtocol();
    protocol.resumeInterruptedSession = vi.fn(async function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'approve' }]);
      yield { type: 'text', content: 'noop edit approved after restart' };
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent', baseUrl: 'http://127.0.0.1:8791' });
    provider.setProviderSessionData('session-durable-noop-edit', {
      providerSessionId: 'lg-thread-durable-noop-edit',
    });

    try {
      const chunks = await provider.resolveToolPermission(
        requestId,
        { decision: 'allow', scope: 'once' },
        'session-durable-noop-edit',
        'desktop',
        { workspacePath: workspace },
      );

      expect(chunks).toContainEqual(expect.objectContaining({
        type: 'tool_call',
        toolCall: expect.objectContaining({
          id: requestId,
          name: 'file_change',
        }),
      }));
      expect(chunks.some((chunk: any) => chunk.type === 'post_edit_snapshot')).toBe(false);
      expect(chunks.some((chunk: any) =>
        chunk.toolCall?.name === 'file_change' &&
        chunk.toolCall?.result?.success === true
      )).toBe(false);
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  it('does not duplicate file-change chunks when a persisted approved edit also streams the real tool lifecycle', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-durable-approved-edit-real-tool-'));
    const target = path.join(
      workspace,
      'forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts',
    );
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, 'export const status = "fresh";\n', 'utf8');

    const requestId = 'langgraph-interrupt-durable-real-edit-0';
    AgentMessagesRepository.setStore({
      create: vi.fn(async () => {}),
      list: vi.fn(async () => [{
        sessionId: 'session-durable-real-edit',
        source: 'smarty-server',
        direction: 'output' as const,
        content: JSON.stringify({
          type: 'nimbalyst_tool_use',
          id: requestId,
          name: 'ToolPermission',
          input: {
            requestId,
            toolName: 'edit_file',
            args: {
              file_path: '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts',
              old_string: 'fresh',
              new_string: 'stale',
            },
          },
        }),
      }]),
    });

    const protocol = createMockProtocol();
    protocol.resumeInterruptedSession = vi.fn(async function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'approve' }]);
      yield {
        type: 'tool_call',
        toolCall: {
          id: 'real-edit-after-restart',
          name: 'edit_file',
          arguments: {
            file_path: '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts',
            old_string: 'fresh',
            new_string: 'stale',
          },
        },
      };
      await fs.writeFile(target, 'export const status = "stale";\n', 'utf8');
      yield {
        type: 'tool_result',
        toolResult: {
          id: 'real-edit-after-restart',
          name: 'edit_file',
          result: { success: true },
        },
      };
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent', baseUrl: 'http://127.0.0.1:8791' });
    provider.setProviderSessionData('session-durable-real-edit', {
      providerSessionId: 'lg-thread-durable-real-edit',
    });

    try {
      const chunks = await provider.resolveToolPermission(
        requestId,
        { decision: 'allow', scope: 'once' },
        'session-durable-real-edit',
        'desktop',
        { workspacePath: workspace },
      );

      const preSnapshots = chunks.filter((chunk: any) => chunk.type === 'pre_edit_snapshot');
      const postSnapshots = chunks.filter((chunk: any) => chunk.type === 'post_edit_snapshot');
      const fileChangeChunks = chunks.filter((chunk: any) => chunk.toolCall?.name === 'file_change');

      expect(preSnapshots).toHaveLength(1);
      expect(postSnapshots).toHaveLength(1);
      expect(fileChangeChunks).toHaveLength(2);
      expect(preSnapshots[0]).toMatchObject({ preEditSnapshot: { toolUseId: requestId } });
      expect(postSnapshots[0]).toMatchObject({ postEditSnapshot: { toolUseId: requestId } });
      expect(fileChangeChunks.map((chunk: any) => chunk.toolCall.id)).toEqual([requestId, requestId]);
      expect(fileChangeChunks.some((chunk: any) => chunk.toolCall.id === 'real-edit-after-restart')).toBe(false);
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  it('continues after a persisted approved interrupt resume that only executes tools', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-durable-tool-only-'));
    const protocol = createMockProtocol();
    protocol.resumeInterruptedSession = vi.fn(async function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'approve' }]);
      yield {
        type: 'tool_result',
        toolResult: {
          id: 'execute-after-restart',
          name: 'execute',
          result: { exitCode: 0, output: `${workspace}\n` },
        },
      };
      yield { type: 'complete', content: '' };
    });
    protocol.sendMessage = vi.fn(async function* (_session: any, message: any) {
      expect(message.content).toContain('Continue the approved Smarty Code task');
      yield { type: 'text', content: 'continued persisted approval' };
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent', baseUrl: 'http://127.0.0.1:8791' });
    provider.setProviderSessionData('session-durable-tool-only', {
      providerSessionId: 'lg-thread-durable-tool-only',
    });

    try {
      await provider.resolveToolPermission(
        'langgraph-interrupt-durable-tool-only-0',
        { decision: 'allow', scope: 'once' },
        'session-durable-tool-only',
        'desktop',
        { workspacePath: workspace },
      );

      expect(protocol.resumeInterruptedSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'lg-thread-durable-tool-only' }),
        [{ type: 'approve' }],
        { sessionId: 'session-durable-tool-only' },
      );
      expect(protocol.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'lg-thread-durable-tool-only' }),
        expect.objectContaining({
          content: expect.stringContaining('Continue the approved Smarty Code task'),
          sessionId: 'session-durable-tool-only',
        }),
      );
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  it('continues a persisted approved interrupt resume that stalls after read-only progress', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-durable-readonly-stall-'));
    const protocol = createMockProtocol();
    let resumeCalls = 0;
    protocol.resumeInterruptedSession = vi.fn(async function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'approve' }]);
      resumeCalls += 1;
      if (resumeCalls === 1) {
        yield {
          type: 'tool_result',
          toolResult: {
            id: 'execute-status-after-restart',
            name: 'execute',
            result: { exitCode: 0, output: ' M packages/runtime/src/ai/server/providers/SmartyServerProvider.ts\n' },
          },
        };
        yield {
          type: 'tool_result',
          toolResult: {
            id: 'read-after-restart',
            name: 'read_file',
            result: { content: 'existing tracker detail implementation' },
          },
        };
        yield { type: 'text', content: 'I found the tracker files and will add the focused test next.' };
        yield { type: 'complete', content: '' };
        return;
      }
      yield { type: 'text', content: 'follow-up write approval completed' };
      yield { type: 'complete', content: '' };
    });
    protocol.sendMessage = vi.fn(async function* (_session: any, message: any) {
      expect(message.content).toContain('Continue the approved Smarty Code task');
      yield {
        type: 'interrupt',
        interrupt: {
          id: 'interrupt-follow-up-write',
          value: {
            action_requests: [{
              name: 'write_file',
              args: { file_path: '/forks/nimbalyst/packages/runtime/src/example.test.ts', content: 'test' },
              description: 'Write focused regression test',
            }],
            review_configs: [{ action_name: 'write_file', allowed_decisions: ['approve', 'reject'] }],
          },
        },
        metadata: { runId: 'run-follow-up-write', threadId: 'lg-thread-durable-readonly-stall' },
      };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'allow', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent', baseUrl: 'http://127.0.0.1:8791' });
    provider.setProviderSessionData('session-durable-readonly-stall', {
      providerSessionId: 'lg-thread-durable-readonly-stall',
    });

    try {
      const chunks = await provider.resolveToolPermission(
        'langgraph-interrupt-durable-readonly-stall-0',
        { decision: 'allow', scope: 'once' },
        'session-durable-readonly-stall',
        'desktop',
        { workspacePath: workspace },
      );

      expect(protocol.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'lg-thread-durable-readonly-stall' }),
        expect.objectContaining({
          content: expect.stringContaining('Continue the approved Smarty Code task'),
          sessionId: 'session-durable-readonly-stall',
        }),
      );
      expect(protocol.resumeInterruptedSession).toHaveBeenCalledTimes(2);
      expect(pendingEvents).toHaveLength(1);
      expect(pendingEvents[0].requestId).toBe('langgraph-interrupt-follow-up-write-0');
      expect(pendingEvents[0].request.toolName).toBe('write_file');
      expect(chunks).toContainEqual({ type: 'text', content: 'follow-up write approval completed' });
      expect(chunks.some((chunk: any) => chunk.type === 'complete')).toBe(true);
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  it('continues a persisted approved interrupt resume after a failed validation command', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-durable-failed-validation-'));
    const protocol = createMockProtocol();
    let resumeCalls = 0;
    protocol.resumeInterruptedSession = vi.fn(async function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'approve' }]);
      resumeCalls += 1;
      if (resumeCalls > 1) {
        yield { type: 'text', content: 'follow-up fix approval completed' };
        yield { type: 'complete', content: '' };
        return;
      }
      yield {
        type: 'tool_call',
        toolCall: {
          id: 'execute-focused-test-after-restart',
          name: 'execute',
          arguments: {
            command: 'cd forks/nimbalyst && npx --no-install vitest --run packages/electron/src/renderer/components/TrackerMode/__tests__/TrackerItemDetail.validationSummary.test.ts',
          },
        },
      };
      yield {
        type: 'tool_result',
        toolResult: {
          id: 'execute-focused-test-after-restart',
          name: 'execute',
          result: {
            success: true,
            result: {
              exit_code: 1,
              output: 'TrackerItemDetail.validationSummary.test.ts failed\n\nExit code: 1',
            },
          },
        },
      };
      yield { type: 'text', content: 'Command exited with code 1.' };
      yield { type: 'complete', content: '' };
    });
    protocol.sendMessage = vi.fn(async function* (_session: any, message: any) {
      expect(message.content).toContain('Continue the approved Smarty Code task');
      yield {
        type: 'interrupt',
        interrupt: {
          id: 'interrupt-follow-up-fix',
          value: {
            action_requests: [{
              name: 'edit_file',
              args: {
                file_path: '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts',
                old_string: 'old',
                new_string: 'new',
              },
              description: 'Fix the validation summary helper',
            }],
            review_configs: [{ action_name: 'edit_file', allowed_decisions: ['approve', 'reject'] }],
          },
        },
        metadata: { runId: 'run-follow-up-fix', threadId: 'lg-thread-durable-failed-validation' },
      };
    });

    const provider = new SmartyServerProvider({ protocol });
    const pendingEvents: any[] = [];
    provider.on('toolPermission:pending', (event) => {
      pendingEvents.push(event);
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'allow', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent', baseUrl: 'http://127.0.0.1:8791' });
    provider.setProviderSessionData('session-durable-failed-validation', {
      providerSessionId: 'lg-thread-durable-failed-validation',
    });

    try {
      const chunks = await provider.resolveToolPermission(
        'langgraph-interrupt-durable-failed-validation-0',
        { decision: 'allow', scope: 'once' },
        'session-durable-failed-validation',
        'desktop',
        { workspacePath: workspace },
      );

      expect(protocol.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'lg-thread-durable-failed-validation' }),
        expect.objectContaining({
          content: expect.stringContaining('Continue the approved Smarty Code task'),
          sessionId: 'session-durable-failed-validation',
        }),
      );
      expect(pendingEvents).toHaveLength(1);
      expect(pendingEvents[0].requestId).toBe('langgraph-interrupt-follow-up-fix-0');
      expect(pendingEvents[0].request.toolName).toBe('edit_file');
      const expectedSourcePath = path.join(
        workspace,
        'forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts',
      );
      expect(chunks).toContainEqual({
        type: 'pre_edit_snapshot',
        preEditSnapshot: {
          toolUseId: 'langgraph-interrupt-follow-up-fix-0',
          authoritative: true,
          entries: [{ path: expectedSourcePath, content: '', kind: 'add' }],
        },
      });
      expect(chunks).toContainEqual(expect.objectContaining({
        type: 'tool_call',
        toolCall: expect.objectContaining({
          id: 'langgraph-interrupt-follow-up-fix-0',
          name: 'file_change',
          arguments: { changes: [{ path: expectedSourcePath, kind: 'add' }] },
        }),
      }));
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  it('returns live approved file-change chunks for nested approvals during a resumed interrupt', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-live-nested-file-approval-'));
    const sourceRelativePath = 'forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts';
    const expectedSourcePath = path.join(workspace, sourceRelativePath);
    await fs.mkdir(path.dirname(expectedSourcePath), { recursive: true });
    await fs.writeFile(expectedSourcePath, 'export function summarize() {\n  return "old";\n}\n');

    const protocol = createMockProtocol();
    let resumeCalls = 0;
    protocol.resumeInterruptedSession = vi.fn(async function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'approve' }]);
      resumeCalls += 1;
      if (resumeCalls > 1) {
        yield { type: 'text', content: 'follow-up fix approval completed' };
        yield { type: 'complete', content: '' };
        return;
      }
      yield {
        type: 'tool_call',
        toolCall: {
          id: 'execute-focused-test-after-restart',
          name: 'execute',
          arguments: {
            command: 'cd forks/nimbalyst && npx --no-install vitest --run packages/electron/src/renderer/components/TrackerMode/__tests__/TrackerItemDetail.validationSummary.test.ts',
          },
        },
      };
      yield {
        type: 'tool_result',
        toolResult: {
          id: 'execute-focused-test-after-restart',
          name: 'execute',
          result: {
            success: true,
            result: {
              exit_code: 1,
              output: 'TrackerItemDetail.validationSummary.test.ts failed\n\nExit code: 1',
            },
          },
        },
      };
      yield { type: 'text', content: 'Command exited with code 1.' };
      yield { type: 'complete', content: '' };
    });
    protocol.sendMessage = vi.fn(async function* () {
      yield {
        type: 'interrupt',
        interrupt: {
          id: 'interrupt-follow-up-fix',
          value: {
            action_requests: [{
              name: 'edit_file',
              args: {
                file_path: '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts',
                old_string: '  return "old";',
                new_string: '  return "new";',
              },
              description: 'Fix the validation summary helper',
            }],
            review_configs: [{ action_name: 'edit_file', allowed_decisions: ['approve', 'reject'] }],
          },
        },
        metadata: { runId: 'run-follow-up-fix', threadId: 'lg-thread-live-nested-file-approval' },
      };
    });

    const provider = new SmartyServerProvider({ protocol });
    let liveApprovalChunks: Promise<any[]> | undefined;
    provider.on('toolPermission:pending', (event) => {
      liveApprovalChunks = provider.resolveToolPermission(
        event.requestId,
        { decision: 'allow', scope: 'once' },
        event.sessionId,
        'desktop',
        { workspacePath: workspace },
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent', baseUrl: 'http://127.0.0.1:8791' });
    provider.setProviderSessionData('session-live-nested-file-approval', {
      providerSessionId: 'lg-thread-live-nested-file-approval',
    });

    try {
      await provider.resolveToolPermission(
        'langgraph-interrupt-durable-failed-validation-0',
        { decision: 'allow', scope: 'once' },
        'session-live-nested-file-approval',
        'desktop',
        { workspacePath: workspace },
      );

      expect(liveApprovalChunks).toBeDefined();
      const chunks = await liveApprovalChunks!;
      expect(chunks).toContainEqual({
        type: 'pre_edit_snapshot',
        preEditSnapshot: {
          toolUseId: 'langgraph-interrupt-follow-up-fix-0',
          authoritative: true,
          entries: [{
            path: expectedSourcePath,
            content: 'export function summarize() {\n  return "old";\n}\n',
            kind: 'update',
          }],
        },
      });
      expect(chunks).toContainEqual(expect.objectContaining({
        type: 'tool_call',
        toolCall: expect.objectContaining({
          id: 'langgraph-interrupt-follow-up-fix-0',
          name: 'file_change',
          arguments: { changes: [{ path: expectedSourcePath, kind: 'update' }] },
        }),
      }));
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  it('rejects approval decisions disallowed by LangGraph review_configs', async () => {
    const interruptEvent = {
      type: 'interrupt',
      interrupt: {
        id: 'interrupt-reject-only',
        value: {
          action_requests: [{
            name: 'write_file',
            args: { file_path: '/tmp/probe.txt', content: 'ok' },
            description: 'Tool execution requires approval',
          }],
          review_configs: [{ action_name: 'write_file', allowed_decisions: ['reject'] }],
        },
      },
      metadata: { runId: 'run-1', threadId: 'lg-thread-1' },
    };
    const protocol = createMockProtocol([interruptEvent]);
    protocol.resumeInterruptedSession = vi.fn(function* () {
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    provider.on('toolPermission:pending', (event) => {
      provider.resolveToolPermission(
        event.requestId,
        { decision: 'allow', scope: 'once' },
        event.sessionId,
      );
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    for await (const chunk of provider.sendMessage('write file', undefined, 'session-review-config', [], '/repo')) {
      chunks.push(chunk);
    }

    expect(protocol.resumeInterruptedSession).not.toHaveBeenCalled();
    expect(chunks).toContainEqual({
      type: 'error',
      error: 'Smarty Server interrupt does not allow approve for write_file. Allowed: reject',
    });
  });

  it('cancels a pending LangGraph approval by resuming it with reject on a non-aborted resume', async () => {
    const interruptEvent = {
      type: 'interrupt',
      interrupt: {
        id: 'interrupt-abort',
        value: {
          action_requests: [{
            name: 'write_file',
            args: { file_path: '/tmp/probe.txt', content: 'abort' },
          }],
          review_configs: [{ action_name: 'write_file', allowed_decisions: ['approve', 'reject'] }],
        },
      },
      metadata: { runId: 'run-abort', threadId: 'lg-thread-1' },
    };
    let resumeSawAbortedSignal: boolean | null = null;
    const protocol = {
      platform: 'langgraph-agent-server',
      createSession: vi.fn(async (options: any) => ({
        id: 'lg-thread-1',
        platform: 'langgraph-agent-server',
        raw: { abortSignal: options?.raw?.abortSignal },
      })),
      resumeSession: vi.fn(),
      forkSession: vi.fn(),
      sendMessage: vi.fn(function* () {
        yield interruptEvent;
      }),
      resumeInterruptedSession: vi.fn(async function* (session: any) {
        await Promise.resolve();
        resumeSawAbortedSignal = Boolean(session.raw?.abortSignal?.aborted);
        yield { type: 'complete', content: '' };
      }),
      abortSession: vi.fn(),
      cancelSessionRuns: vi.fn(async () => ({ requested: true, method: 'run', runId: 'run-1' })),
      cleanupSession: vi.fn(),
    } as any;
    const provider = new SmartyServerProvider({ protocol });
    const logSpy = vi.spyOn(provider as any, 'logAgentMessageBestEffort').mockResolvedValue(undefined);
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    provider.on('toolPermission:pending', () => {
      provider.abort();
    });

    for await (const _chunk of provider.sendMessage('write then abort', undefined, 'session-abort', [], '/repo')) {
      // drain
    }
    await new Promise((resolve) => setImmediate(resolve));

    expect(protocol.resumeInterruptedSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lg-thread-1' }),
      [{ type: 'reject' }],
      { sessionId: 'session-abort' },
    );
    expect(resumeSawAbortedSignal).toBe(false);
    expect(protocol.abortSession).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'session-abort',
      'output',
      expect.stringContaining('cancelled'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      'session-abort',
      'output',
      expect.stringContaining('langgraph-interrupt-abort-0'),
    );
  });

  it('preserves a pending LangGraph approval across provider lifecycle destroy', async () => {
    const interruptEvent = {
      type: 'interrupt',
      interrupt: {
        id: 'interrupt-lifecycle',
        value: {
          action_requests: [{
            name: 'write_file',
            args: { file_path: '/tmp/probe.txt', content: 'lifecycle' },
          }],
          review_configs: [{ action_name: 'write_file', allowed_decisions: ['approve', 'reject'] }],
        },
      },
      metadata: { runId: 'run-lifecycle', threadId: 'lg-thread-1' },
    };
    const protocol = createMockProtocol([interruptEvent]);
    protocol.resumeInterruptedSession = vi.fn(async function* (_session: any, decisions: any) {
      expect(decisions).toEqual([{ type: 'approve' }]);
      yield { type: 'complete', content: '' };
    });

    const provider = new SmartyServerProvider({ protocol });
    const logSpy = vi.spyOn(provider as any, 'logAgentMessageBestEffort').mockResolvedValue(undefined);
    let pendingRequestId: string | null = null;
    provider.on('toolPermission:pending', (event) => {
      pendingRequestId = event.requestId;
      provider.destroy();
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    for await (const _chunk of provider.sendMessage('write then close app', undefined, 'session-lifecycle', [], '/repo')) {
      // drain
    }
    await new Promise((resolve) => setImmediate(resolve));

    expect(pendingRequestId).toBe('langgraph-interrupt-lifecycle-0');
    expect(protocol.abortSession).not.toHaveBeenCalled();
    expect(protocol.resumeInterruptedSession).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalledWith(
      'session-lifecycle',
      'output',
      expect.stringContaining('cancelled'),
    );

    const recreatedProvider = new SmartyServerProvider({ protocol });
    await recreatedProvider.initialize({ model: 'smarty-server:smarty_coding_agent' });
    recreatedProvider.setProviderSessionData('session-lifecycle', {
      providerSessionId: 'lg-thread-1',
    });

    await recreatedProvider.resolveToolPermission(
      pendingRequestId!,
      { decision: 'allow', scope: 'once' },
      'session-lifecycle',
      'desktop',
      { workspacePath: '/repo' },
    );

    expect(protocol.resumeSession).toHaveBeenCalledWith(
      'lg-thread-1',
      expect.objectContaining({ workspacePath: '/repo' }),
    );
    expect(protocol.resumeInterruptedSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lg-thread-1' }),
      [{ type: 'approve' }],
      { sessionId: 'session-lifecycle' },
    );
  });

  it('interrupts a pending approval by rejecting it before queue processing resumes', async () => {
    const interruptEvent = {
      type: 'interrupt',
      interrupt: {
        id: 'interrupt-current-turn',
        value: {
          action_requests: [{
            name: 'execute',
            args: { command: 'sleep 10' },
          }],
          review_configs: [{ action_name: 'execute', allowed_decisions: ['approve', 'reject'] }],
        },
      },
      metadata: { runId: 'run-current-turn', threadId: 'lg-thread-1' },
    };
    const protocol = createMockProtocol([interruptEvent]);
    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    let interruptResult: Promise<{ method: 'interrupt' | 'abort' }> | null = null;
    provider.on('toolPermission:pending', () => {
      interruptResult = provider.interruptCurrentTurn();
    });

    for await (const _chunk of provider.sendMessage('run then interrupt', undefined, 'session-interrupt', [], '/repo')) {
      // drain
    }

    await expect(interruptResult).resolves.toEqual({ method: 'interrupt' });
    expect(protocol.resumeInterruptedSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lg-thread-1' }),
      [{ type: 'reject' }],
      { sessionId: 'session-interrupt' },
    );
    expect(protocol.cancelSessionRuns).not.toHaveBeenCalled();
  });

  it('emits Nimbalyst file-change snapshots for LangGraph write_file tools', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-file-change-'));
    const target = path.join(workspace, 'src', 'created.ts');
    const content = 'export const created = true;\n';
    const provider = new SmartyServerProvider({
      protocol: createFileWritingProtocol(target, content),
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    try {
      for await (const chunk of provider.sendMessage('create file', undefined, 'session-file-change', [], workspace)) {
        chunks.push(chunk);
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }

    expect(chunks).toContainEqual({
      type: 'pre_edit_snapshot',
      preEditSnapshot: {
        toolUseId: 'langgraph-write-1',
        authoritative: true,
        entries: [{ path: target, content: '', kind: 'add' }],
      },
    });
    expect(chunks).toContainEqual({
      type: 'post_edit_snapshot',
      postEditSnapshot: {
        toolUseId: 'langgraph-write-1',
        entries: [{ path: target, content, kind: 'add' }],
      },
    });
    expect(chunks).toContainEqual({
      type: 'tool_call',
      toolCall: {
        id: 'langgraph-write-1',
        name: 'file_change',
        arguments: { changes: [{ path: target, kind: 'add' }] },
        toolUseId: 'langgraph-write-1',
      },
    });
    expect(chunks).toContainEqual(expect.objectContaining({
      type: 'tool_call',
      toolCall: expect.objectContaining({
        id: 'langgraph-write-1',
        name: 'file_change',
        result: expect.objectContaining({
          success: true,
          changes: [{ path: target, kind: 'add' }],
        }),
      }),
    }));
    expect(chunks.some((chunk) => chunk.toolCall?.name === 'write_file')).toBe(false);
  });

  it('maps LangGraph virtual absolute file paths to workspace paths for diff surfaces', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-virtual-path-'));
    const virtualPath = '/tmp/runtime/edit-001/agent-created.txt';
    const target = path.join(workspace, 'tmp', 'runtime', 'edit-001', 'agent-created.txt');
    const content = 'SMARTY_EDIT_APPROVAL_TEST\n';
    const provider = new SmartyServerProvider({
      protocol: createFileWritingProtocol(virtualPath, content, target),
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    try {
      for await (const chunk of provider.sendMessage('create file', undefined, 'session-virtual-file-change', [], workspace)) {
        chunks.push(chunk);
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }

    expect(chunks).toContainEqual({
      type: 'pre_edit_snapshot',
      preEditSnapshot: {
        toolUseId: 'langgraph-write-1',
        authoritative: true,
        entries: [{ path: target, content: '', kind: 'add' }],
      },
    });
    expect(chunks).toContainEqual({
      type: 'post_edit_snapshot',
      postEditSnapshot: {
        toolUseId: 'langgraph-write-1',
        entries: [{ path: target, content, kind: 'add' }],
      },
    });
    expect(chunks).toContainEqual(expect.objectContaining({
      type: 'tool_call',
      toolCall: expect.objectContaining({
        name: 'file_change',
        arguments: { changes: [{ path: target, kind: 'add' }] },
      }),
    }));
  });

  it('maps LangGraph /workspace virtual paths to the workspace root, not a workspace subdirectory', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-workspace-virtual-path-'));
    const virtualPath = '/workspace/forks/nimbalyst/daily-driver-revert-proof.txt';
    const target = path.join(workspace, 'forks', 'nimbalyst', 'daily-driver-revert-proof.txt');
    const content = 'SMARTY_EVIDENCE_REVERT_REVIEW_TEST\n';
    const provider = new SmartyServerProvider({
      protocol: createFileWritingProtocol(virtualPath, content, target),
    });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    try {
      for await (const chunk of provider.sendMessage('create nested file', undefined, 'session-workspace-virtual-file-change', [], workspace)) {
        chunks.push(chunk);
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }

    expect(chunks).toContainEqual({
      type: 'pre_edit_snapshot',
      preEditSnapshot: {
        toolUseId: 'langgraph-write-1',
        authoritative: true,
        entries: [{ path: target, content: '', kind: 'add' }],
      },
    });
    expect(chunks).toContainEqual(expect.objectContaining({
      type: 'tool_call',
      toolCall: expect.objectContaining({
        name: 'file_change',
        arguments: { changes: [{ path: target, kind: 'add' }] },
      }),
    }));
    expect(JSON.stringify(chunks)).not.toContain(path.join(workspace, 'workspace', 'forks'));
  });

  it('does not project escaping virtual absolute file paths as file changes', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-escape-path-'));
    const protocol = createMockProtocol([
      {
        type: 'tool_call',
        toolCall: {
          id: 'langgraph-write-escape',
          name: 'write_file',
          arguments: { file_path: '/../outside.txt', content: 'nope\n' },
        },
      },
      { type: 'complete', content: '' },
    ]);
    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    try {
      for await (const chunk of provider.sendMessage('create file', undefined, 'session-escape-file-change', [], workspace)) {
        chunks.push(chunk);
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }

    expect(chunks.some((chunk) => chunk.toolCall?.name === 'file_change')).toBe(false);
    expect(JSON.stringify(chunks)).not.toContain(path.dirname(workspace));
  });

  it('does not map real outside absolute file paths into workspace file changes', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-provider-outside-absolute-path-'));
    const outsidePath = path.join(path.dirname(workspace), `outside-${Date.now()}.txt`);
    const protocol = createMockProtocol([
      {
        type: 'tool_call',
        toolCall: {
          id: 'langgraph-write-outside-absolute',
          name: 'write_file',
          arguments: { file_path: outsidePath, content: 'nope\n' },
        },
      },
      { type: 'complete', content: '' },
    ]);
    const provider = new SmartyServerProvider({ protocol });
    await provider.initialize({ model: 'smarty-server:smarty_coding_agent' });

    const chunks: any[] = [];
    try {
      for await (const chunk of provider.sendMessage('create outside file', undefined, 'session-outside-absolute-file-change', [], workspace)) {
        chunks.push(chunk);
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }

    expect(chunks.some((chunk) => chunk.toolCall?.name === 'file_change')).toBe(false);
    expect(chunks.some((chunk) => chunk.type === 'pre_edit_snapshot')).toBe(false);
    expect(chunks.some((chunk) => chunk.type === 'post_edit_snapshot')).toBe(false);
    expect(JSON.stringify(chunks)).not.toContain(path.join(workspace, path.basename(outsidePath)));
  });
});
