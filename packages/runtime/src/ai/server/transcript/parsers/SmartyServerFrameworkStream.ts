import type { RawMessage } from '../TranscriptTransformer';
import type { CanonicalEventDescriptor } from './IRawMessageParser';

export interface LangGraphStreamChunk {
  id?: string;
  event?: string;
  namespace?: string | string[];
  data?: unknown;
}

const FRAMEWORK_STREAM_METHODS = new Set([
  'updates',
  'values',
  'output',
  'checkpoints',
  'tasks',
  'debug',
  'custom',
  'lifecycle',
  'input',
  'subagents',
  'subgraphs',
]);

export function normalizeEventStreamProtocolChunk(
  chunk: LangGraphStreamChunk,
): LangGraphStreamChunk | null {
  const raw = chunk as Record<string, unknown>;
  if (typeof raw.method !== 'string' || !isRecord(raw.params)) return null;

  return {
    id: typeof raw.id === 'string'
      ? raw.id
      : typeof raw.seq === 'number'
        ? `seq-${raw.seq}`
        : undefined,
    event: raw.method,
    namespace: frameworkNamespace(raw.params.namespace),
    data: raw.params.data,
  };
}

export function toSubgraphMessageStreamChunk(
  chunk: LangGraphStreamChunk,
): LangGraphStreamChunk | null {
  const namespaced = normalizeNamespaceTuple(chunk.data);
  if (!namespaced || !isNonRootNamespace(namespaced.namespace)) return null;

  return {
    ...chunk,
    event: 'subgraphs',
    namespace: namespaced.namespace,
    data: frameworkSubgraphPayload('messages', namespaced.data),
  };
}

export function unwrapNamespaceTupleData(value: unknown): unknown {
  return normalizeNamespaceTuple(value)?.data ?? value;
}

export function isFrameworkStreamMethod(value: unknown): value is string {
  return typeof value === 'string' && (
    FRAMEWORK_STREAM_METHODS.has(value)
    || value.startsWith('custom:')
  );
}

export function toFrameworkStreamDescriptors(
  msg: RawMessage,
  chunk: LangGraphStreamChunk,
): CanonicalEventDescriptor[] {
  const normalized = normalizeFrameworkStreamChunk(chunk);
  if (!normalized || !isFrameworkStreamMethod(normalized.method)) return [];

  const data = isRecord(normalized.data) ? normalized.data : {};
  const providerToolCallId = frameworkToolCallId(msg, chunk);
  const frameworkStreamEvent = {
    method: normalized.method,
    namespace: frameworkNamespace(normalized.namespace ?? data.namespace),
    data: normalized.data,
    event: firstString(data.event),
    name: firstString(data.name),
    source: 'smarty-server',
    runId: firstString(msg.metadata?.runId, msg.metadata?.run_id),
    threadId: firstString(msg.metadata?.threadId, msg.metadata?.thread_id),
  };

  return [
    {
      type: 'tool_call_started',
      toolName: frameworkToolName(normalized.method),
      toolDisplayName: frameworkDisplayName(normalized.method),
      arguments: {
        frameworkStreamEvent,
      },
      targetFilePath: null,
      mcpServer: null,
      mcpTool: null,
      providerToolCallId,
      createdAt: msg.createdAt,
    },
    {
      type: 'tool_call_completed',
      providerToolCallId,
      status: 'completed',
      result: `${frameworkDisplayName(normalized.method)} stream event`,
      isError: false,
    },
  ];
}

export function frameworkNamespace(value: unknown): string | string[] | undefined {
  if (typeof value === 'string' && value) return value;
  if (Array.isArray(value)) {
    const namespace = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    return namespace.length > 0 ? namespace : undefined;
  }
  return undefined;
}

function normalizeFrameworkStreamChunk(
  chunk: LangGraphStreamChunk,
): { method: string; namespace?: string | string[]; data: unknown } | null {
  if (!isFrameworkStreamMethod(chunk.event)) return null;
  const tuple = normalizeNamespaceTuple(chunk.data);
  if (!tuple) {
    return {
      method: chunk.event,
      namespace: frameworkNamespace(chunk.namespace),
      data: chunk.data,
    };
  }

  const namespace = frameworkNamespace(tuple.namespace);
  if (chunk.event !== 'subagents' && chunk.event !== 'subgraphs' && isNonRootNamespace(namespace)) {
    return {
      method: 'subgraphs',
      namespace,
      data: frameworkSubgraphPayload(chunk.event, tuple.data),
    };
  }

  return {
    method: chunk.event,
    namespace,
    data: tuple.data,
  };
}

function normalizeNamespaceTuple(value: unknown): { namespace: string | string[]; data: unknown } | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const namespace = Array.isArray(value[0])
    ? value[0].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : frameworkNamespace(value[0]);
  if (namespace === undefined) return null;
  return { namespace, data: value[1] };
}

function isNonRootNamespace(namespace: unknown): boolean {
  if (typeof namespace === 'string') return namespace.length > 0;
  return Array.isArray(namespace) && namespace.length > 0;
}

function frameworkSubgraphPayload(method: string, data: unknown): Record<string, unknown> {
  if (method === 'messages') {
    const tuple = Array.isArray(data) ? data : [];
    const message = isRecord(tuple[0]) ? tuple[0] : isRecord(data) ? data : {};
    const text = contentToText(message.content) || firstString(message.text, message.message, message.content);
    return {
      status: 'running',
      messages: [{
        id: firstString(message.id),
        role: firstString(message.role, message.type) ?? 'assistant',
        content: text,
        text,
      }],
    };
  }

  const record = isRecord(data) ? data : {};
  const hasSubagentShape = Boolean(
    record.name
    || record.graphName
    || record.graph_name
    || record.agentName
    || record.agent_name
    || record.taskInput
    || record.task_input
    || record.output
    || record.messages
    || record.toolCalls
    || record.tool_calls
    || record.values,
  );
  if (hasSubagentShape) {
    return {
      status: method === 'output'
        ? 'completed'
        : firstString(record.status, record.state) ?? 'running',
      ...record,
    };
  }

  return {
    status: method === 'output' ? 'completed' : 'running',
    summary: `${frameworkDisplayName(method)} from subgraph`,
    values: isRecord(data) ? data : { value: data },
  };
}

function frameworkToolCallId(
  msg: RawMessage,
  chunk: LangGraphStreamChunk,
): string {
  const eventId = typeof chunk.id === 'string' && chunk.id
    ? chunk.id
    : `${chunk.event ?? 'event'}-${msg.id}`;
  return `smarty-server-framework-${eventId}`;
}

function frameworkToolName(method: string): string {
  if (method === 'subagents') return 'deepagents_subagents';
  if (method.startsWith('custom:')) return `langgraph_${sanitizeFrameworkMethod(method)}`;
  return `langgraph_${method}`;
}

function frameworkDisplayName(method: string): string {
  switch (method) {
    case 'updates':
      return 'LangGraph update';
    case 'values':
      return 'LangGraph values';
    case 'output':
      return 'LangGraph output';
    case 'checkpoints':
      return 'LangGraph checkpoint';
    case 'tasks':
      return 'LangGraph task';
    case 'debug':
      return 'LangGraph debug';
    case 'custom':
      return 'LangGraph custom event';
    case 'lifecycle':
      return 'LangGraph lifecycle';
    case 'input':
      return 'LangGraph input';
    case 'subagents':
      return 'DeepAgents subagent';
    case 'subgraphs':
      return 'LangGraph subgraph';
    default:
      if (method.startsWith('custom:')) return 'LangGraph custom event';
      return 'LangGraph stream event';
  }
}

function sanitizeFrameworkMethod(method: string): string {
  const sanitized = method
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return sanitized || 'event';
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (!isRecord(part)) return '';
      if (part.type === 'text' && typeof part.text === 'string') {
        return part.text;
      }
      return '';
    })
    .join('');
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
