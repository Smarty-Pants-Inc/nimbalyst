/**
 * SmartyServerProtocol -- LangGraph Agent Server adapter for the local
 * Smarty Code daily-driver runtime.
 *
 * This protocol intentionally connects to an already-running `smarty-server`.
 * It does not spawn or manage CLIProxyAPI, and it passes `apiKey: null` to the
 * LangGraph SDK unless Nimbalyst settings supplied an explicit key. That avoids
 * the SDK's documented environment-key lookup path.
 */

import { Client } from '@langchain/langgraph-sdk';
import type {
  AgentProtocol,
  ProtocolEvent,
  ProtocolMessage,
  ProtocolSession,
  SessionOptions,
  ToolResult,
} from './ProtocolInterface';
import { normalizeLoopbackHttpUrl } from '../utils/loopbackHttpUrl';

export interface LangGraphClientLike {
  threads: {
    create: (payload?: {
      metadata?: Record<string, unknown>;
      threadId?: string;
      ifExists?: string;
      graphId?: string;
      signal?: AbortSignal;
    }) => Promise<{ thread_id: string }>;
    get: (threadId: string, options?: { signal?: AbortSignal }) => Promise<{ thread_id: string }>;
    getState?: (
      threadId: string,
      checkpoint?: unknown,
      options?: { subgraphs?: boolean; signal?: AbortSignal },
    ) => Promise<unknown>;
  };
  runs: {
    stream: (
      threadId: string,
      assistantId: string,
      payload: Record<string, unknown>,
    ) => AsyncIterable<{ id?: string; event: string; data: unknown }>;
    cancel?: (
      threadId: string,
      runId: string,
      wait?: boolean,
      action?: 'interrupt' | 'rollback',
      options?: { signal?: AbortSignal },
    ) => Promise<unknown>;
    cancelMany?: (options: {
      threadId?: string;
      runIds?: string[];
      status?: 'pending' | 'running';
      action?: 'interrupt' | 'rollback';
      signal?: AbortSignal;
    }) => Promise<unknown>;
  };
}

export type LangGraphClientFactory = (config: {
  apiUrl: string;
  apiKey: string | null;
}) => LangGraphClientLike;

export interface LangGraphReviewDecision {
  type: 'approve' | 'edit' | 'reject' | 'respond';
  edited_action?: {
    name: string;
    args: Record<string, unknown>;
  };
  args?: Record<string, unknown>;
}

interface SmartyServerSessionRaw {
  client: LangGraphClientLike;
  assistantId: string;
  abortSignal?: AbortSignal;
  activeRunId?: string;
  lastRunId?: string;
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:8788';
const DEFAULT_ASSISTANT_ID = 'smarty_coding_agent';
const SMARTY_SERVER_STREAM_MODES = ['messages-tuple', 'updates', 'tasks', 'events'] as const;
// Real daily-driver coding runs can spend many graph steps on planning, tools,
// approvals, validation, and recovery. Keep this finite, but do not cap the
// local DeepAgents runtime at LangGraph's small default/proof-slice budget.
const SMARTY_SERVER_RECURSION_LIMIT = 9_999;

export class SmartyServerProtocol implements AgentProtocol {
  readonly platform = 'langgraph-agent-server';

  constructor(
    private readonly clientFactory: LangGraphClientFactory = ({ apiUrl, apiKey }) =>
      new Client({ apiUrl, apiKey }) as unknown as LangGraphClientLike,
  ) {}

  async createSession(options: SessionOptions): Promise<ProtocolSession> {
    const config = this.resolveConfig(options);
    const client = this.clientFactory({ apiUrl: config.baseUrl, apiKey: config.apiKey });
    const thread = await client.threads.create({
      graphId: config.assistantId,
      metadata: {
        nimbalystProvider: 'smarty-server',
        workspacePath: options.workspacePath,
      },
      signal: config.abortSignal,
    });

    return {
      id: thread.thread_id,
      platform: this.platform,
      raw: {
        client,
        assistantId: config.assistantId,
        abortSignal: config.abortSignal,
      } satisfies SmartyServerSessionRaw,
    };
  }

  async resumeSession(sessionId: string, options: SessionOptions): Promise<ProtocolSession> {
    const config = this.resolveConfig(options);
    const client = this.clientFactory({ apiUrl: config.baseUrl, apiKey: config.apiKey });
    const thread = await client.threads.get(sessionId, { signal: config.abortSignal });

    return {
      id: thread.thread_id,
      platform: this.platform,
      raw: {
        client,
        assistantId: config.assistantId,
        abortSignal: config.abortSignal,
      } satisfies SmartyServerSessionRaw,
    };
  }

  async forkSession(_sessionId: string, options: SessionOptions): Promise<ProtocolSession> {
    return this.createSession(options);
  }

  async *sendMessage(
    session: ProtocolSession,
    message: ProtocolMessage,
  ): AsyncIterable<ProtocolEvent> {
    yield* this.streamRun(session, {
      input: { messages: [{ role: 'user', content: message.content }] },
      metadata: { nimbalystSessionId: message.sessionId },
      signal: this.getSessionRaw(session).abortSignal,
    });
  }

  async *resumeInterruptedSession(
    session: ProtocolSession,
    decisions: LangGraphReviewDecision[],
    message: Pick<ProtocolMessage, 'sessionId'> = {},
  ): AsyncIterable<ProtocolEvent> {
    yield* this.streamRun(session, {
      command: { resume: { decisions } },
      metadata: {
        nimbalystSessionId: message.sessionId,
        langGraphResume: true,
      },
      signal: this.getSessionRaw(session).abortSignal,
    });
  }

  private async *streamRun(
    session: ProtocolSession,
    options: {
      input?: Record<string, unknown>;
      command?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      signal?: AbortSignal;
    },
  ): AsyncIterable<ProtocolEvent> {
    const raw = this.getSessionRaw(session);
    let runId: string | undefined;
    let threadId = session.id;

    const stream = raw.client.runs.stream(session.id, raw.assistantId, {
      input: options.input,
      command: options.command,
      metadata: options.metadata,
      config: { recursion_limit: SMARTY_SERVER_RECURSION_LIMIT },
      streamMode: [...SMARTY_SERVER_STREAM_MODES],
      streamSubgraphs: true,
      streamResumable: true,
      signal: options.signal,
    });

    let pendingInterrupt: ProtocolEvent | null = null;

    try {
      for await (const chunk of stream) {
        if (chunk.event === 'metadata' && isRecord(chunk.data)) {
          runId = typeof chunk.data.run_id === 'string' ? chunk.data.run_id : runId;
          threadId = typeof chunk.data.thread_id === 'string' ? chunk.data.thread_id : threadId;
          raw.activeRunId = runId;
          raw.lastRunId = runId;
          yield rawEventWithRunMetadata(chunk, runId, threadId);
          continue;
        }

        yield rawEventWithRunMetadata(chunk, runId, threadId);

        if (pendingInterrupt) {
          continue;
        }

        const mapped = this.mapStreamChunk(chunk);
        if (mapped) {
          yield mapped;
        }

        const interrupts = extractLangGraphInterrupts(chunk.data);
        if (interrupts.length > 0) {
          pendingInterrupt = {
            type: 'interrupt',
            interrupt: interrupts[0],
            metadata: { runId, threadId, interrupts },
          };
        }
      }
    } finally {
      if (runId && raw.activeRunId === runId) {
        raw.activeRunId = undefined;
      }
    }

    if (pendingInterrupt) {
      yield pendingInterrupt;
      return;
    }

    const persistedInterrupt = await this.getPersistedInterrupt(raw, threadId, runId, options.signal);
    if (persistedInterrupt) {
      yield persistedInterrupt;
      return;
    }

    yield {
      type: 'complete',
      content: '',
      metadata: { runId, threadId },
    };
  }

  abortSession(session: ProtocolSession): void {
    void this.cancelSessionRuns(session, { wait: false, action: 'interrupt' }).catch(() => {});
  }

  async cancelSessionRuns(
    session: ProtocolSession,
    options: { wait?: boolean; action?: 'interrupt' | 'rollback' } = {},
  ): Promise<{ requested: boolean; method: 'run' | 'thread-status' | 'unavailable'; runId?: string }> {
    const raw = this.getSessionRaw(session);
    const action = options.action ?? 'interrupt';
    const wait = options.wait ?? false;
    const runId = raw.activeRunId ?? raw.lastRunId;

    if (runId && typeof raw.client.runs.cancel === 'function') {
      await raw.client.runs.cancel(session.id, runId, wait, action);
      return { requested: true, method: 'run', runId };
    }

    if (typeof raw.client.runs.cancelMany === 'function') {
      await Promise.all([
        raw.client.runs.cancelMany({ threadId: session.id, status: 'running', action }),
        raw.client.runs.cancelMany({ threadId: session.id, status: 'pending', action }),
      ]);
      return { requested: true, method: 'thread-status' };
    }

    return { requested: false, method: 'unavailable' };
  }

  cleanupSession(_session: ProtocolSession): void {
    // External local smarty-server owns runtime state; no process lifecycle here.
  }

  private resolveConfig(options: SessionOptions): {
    baseUrl: string;
    assistantId: string;
    apiKey: string | null;
    abortSignal?: AbortSignal;
  } {
    const raw = options.raw ?? {};
    const baseUrl = normalizeLoopbackHttpUrl(raw.baseUrl, DEFAULT_BASE_URL, 'Smarty Server URL');
    const assistantId = typeof raw.assistantId === 'string' && raw.assistantId.trim()
      ? raw.assistantId.trim()
      : DEFAULT_ASSISTANT_ID;
    const explicitApiKey = typeof raw.apiKey === 'string' && raw.apiKey.length > 0
      ? raw.apiKey
      : null;
    const abortSignal = raw.abortSignal instanceof AbortSignal
      ? raw.abortSignal
      : options.abortSignal;

    return {
      baseUrl,
      assistantId,
      apiKey: explicitApiKey,
      abortSignal,
    };
  }

  private getSessionRaw(session: ProtocolSession): SmartyServerSessionRaw {
    const raw = session.raw as Partial<SmartyServerSessionRaw> | undefined;
    if (!raw?.client || !raw.assistantId) {
      throw new Error('SmartyServerProtocol session is missing LangGraph client state');
    }
    return raw as SmartyServerSessionRaw;
  }

  private async getPersistedInterrupt(
    raw: SmartyServerSessionRaw,
    threadId: string,
    runId: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<ProtocolEvent | null> {
    if (typeof raw.client.threads.getState !== 'function') {
      return null;
    }

    const state = await this.getPersistedThreadState(raw, threadId, signal);

    const interrupts = extractLangGraphInterrupts(state);
    if (interrupts.length === 0) {
      return null;
    }

    return {
      type: 'interrupt',
      interrupt: interrupts[0],
      metadata: { runId, threadId, interrupts, source: 'thread-state' },
    };
  }

  private async getPersistedThreadState(
    raw: SmartyServerSessionRaw,
    threadId: string,
    signal: AbortSignal | undefined,
  ): Promise<unknown> {
    if (typeof raw.client.threads.getState !== 'function') {
      return null;
    }

    try {
      return await raw.client.threads.getState(threadId, undefined, { subgraphs: true, signal });
    } catch {
      return await raw.client.threads.getState(threadId, undefined, { subgraphs: false, signal });
    }
  }

  private mapStreamChunk(chunk: { event: string; data: unknown }): ProtocolEvent | null {
    if (chunk.event === 'messages') {
      const text = extractLangGraphMessageText(chunk.data);
      return text ? { type: 'text', content: text } : null;
    }

    if (chunk.event === 'tools') {
      return mapToolEvent(chunk.data);
    }

    if (chunk.event === 'events') {
      return mapLangChainToolEvent(chunk.data);
    }

    if (chunk.event === 'error' && isRecord(chunk.data)) {
      const message = typeof chunk.data.message === 'string'
        ? chunk.data.message
        : typeof chunk.data.error === 'string'
          ? chunk.data.error
          : 'Smarty server stream error';
      return { type: 'error', error: message };
    }

    return null;
  }
}

function extractLangGraphMessageText(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) return '';
  const message = data[0];
  if (!isRecord(message)) return '';
  return contentToText(message.content);
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (!isRecord(part)) return '';
      if (part.type === 'text' && typeof part.text === 'string') return part.text;
      return '';
    })
    .join('');
}

function mapToolEvent(data: unknown): ProtocolEvent | null {
  if (!isRecord(data) || typeof data.event !== 'string') return null;

  const id = typeof data.toolCallId === 'string' ? data.toolCallId : undefined;
  const name = typeof data.name === 'string' ? data.name : 'unknown_tool';

  if (data.event === 'on_tool_start') {
    return {
      type: 'tool_call',
      toolCall: {
        id,
        name,
        arguments: isRecord(data.input) ? data.input : {},
      },
    };
  }

  if (data.event === 'on_tool_end') {
    return {
      type: 'tool_result',
      toolResult: {
        id,
        name,
        result: normalizeToolResult(data.output),
      },
    };
  }

  if (data.event === 'on_tool_error') {
    return {
      type: 'tool_result',
      toolResult: {
        id,
        name,
        result: {
          success: false,
          error: data.error,
        },
      },
    };
  }

  return null;
}

function mapLangChainToolEvent(data: unknown): ProtocolEvent | null {
  if (!isRecord(data) || typeof data.event !== 'string') return null;
  if (!data.event.startsWith('on_tool_')) return null;

  const payload = isRecord(data.data) ? data.data : {};
  const id = typeof payload.toolCallId === 'string'
    ? payload.toolCallId
    : typeof payload.tool_call_id === 'string'
      ? payload.tool_call_id
      : typeof data.run_id === 'string'
        ? data.run_id
        : undefined;
  const name = typeof data.name === 'string' ? data.name : 'unknown_tool';

  if (data.event === 'on_tool_start') {
    return {
      type: 'tool_call',
      toolCall: {
        id,
        name,
        arguments: isRecord(payload.input) ? payload.input : {},
      },
    };
  }

  if (data.event === 'on_tool_end') {
    return {
      type: 'tool_result',
      toolResult: {
        id,
        name,
        result: normalizeToolResult(payload.output),
      },
    };
  }

  if (data.event === 'on_tool_error') {
    return {
      type: 'tool_result',
      toolResult: {
        id,
        name,
        result: {
          success: false,
          error: payload.error,
        },
      },
    };
  }

  return null;
}

function normalizeToolResult(output: unknown): ToolResult {
  return {
    success: true,
    result: output,
  };
}

function rawEventWithRunMetadata(
  rawEvent: { id?: string; event: string; data: unknown },
  runId: string | undefined,
  threadId: string | undefined,
): ProtocolEvent {
  return {
    type: 'raw_event',
    metadata: {
      rawEvent,
      ...(runId ? { runId } : {}),
      ...(threadId ? { threadId } : {}),
    },
  };
}

function extractLangGraphInterrupts(data: unknown): Array<{ id?: string; value: unknown }> {
  const interrupts: Array<{ id?: string; value: unknown }> = [];
  const seen = new Set<string>();

  function push(value: unknown): void {
    if (!isRecord(value) || !('value' in value)) return;
    const id = typeof value.id === 'string' ? value.id : undefined;
    const key = id ?? JSON.stringify(value.value);
    if (seen.has(key)) return;
    seen.add(key);
    interrupts.push({ id, value: value.value });
  }

  function visit(value: unknown, depth: number): void {
    if (depth > 5) return;
    if (Array.isArray(value)) {
      for (const child of value) visit(child, depth + 1);
      return;
    }
    if (!isRecord(value)) return;
    if (Array.isArray(value.interrupts)) {
      for (const interrupt of value.interrupts) push(interrupt);
    }
    if (Array.isArray(value.__interrupt__)) {
      for (const interrupt of value.__interrupt__) push(interrupt);
    }
    for (const child of Object.values(value)) {
      visit(child, depth + 1);
    }
  }

  visit(data, 0);
  return interrupts;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
