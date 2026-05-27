import type { AgentElementsRendererModel } from './AgentElementsRendererRegistry';
import type { AgentQuestionOption, AgentSubagentItem } from './AgentElementsFrameworkEvents';

export interface FrameworkStreamEvent {
  method?: string;
  namespace?: string | string[];
  data?: unknown;
  event?: string;
  name?: string;
  source?: string;
  runId?: string;
  threadId?: string;
}

function firstString(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  return 'structured value';
}

function namespaceLabel(namespace: FrameworkStreamEvent['namespace']): string | undefined {
  if (Array.isArray(namespace)) {
    return namespace.filter(Boolean).join(' > ') || undefined;
  }
  return namespace;
}

function objectEntries(value: unknown): Array<[string, unknown]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>);
}

function stateChangedKeys(data: unknown) {
  const entries = objectEntries(data);
  if (entries.length === 0) {
    return [{ key: 'value', after: formatScalar(data), summary: formatScalar(data) }];
  }

  return entries.map(([key, value]) => ({
    key,
    after: formatScalar(value),
    summary: formatScalar(value),
  }));
}

function frameworkLifecycleStatus(value: unknown): NonNullable<AgentElementsRendererModel['lifecycleStatus']> {
  const status = typeof value === 'string' ? value.toLowerCase() : '';
  if (status === 'queued' || status === 'running' || status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'interrupted') {
    return status;
  }
  if (status === 'error' || status === 'failure') return 'failed';
  if (status === 'pending' || status === 'started' || status === 'starting') return 'running';
  if (status === 'done' || status === 'success' || status === 'finished') return 'completed';
  return 'running';
}

function frameworkRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
}

function frameworkEventName(event: FrameworkStreamEvent, fallback: string): string {
  return firstString(frameworkRecord(event.data), ['eventName', 'event', 'name', 'type']) ?? event.event ?? event.name ?? event.method ?? fallback;
}

function frameworkArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function frameworkSubagentItems(record: Record<string, unknown>): AgentSubagentItem[] {
  const messageItems = frameworkArray(record.messages).map((message, index): AgentSubagentItem => {
    const messageRecord = frameworkRecord(message);
    return {
      id: firstString(messageRecord, ['id']) ?? `message-${index}`,
      title: firstString(messageRecord, ['role', 'type']) ?? 'Message',
      detail: firstString(messageRecord, ['text', 'content', 'message']),
      kind: 'message',
      status: 'completed',
    };
  });

  const toolItems = frameworkArray(record.toolCalls ?? record.tool_calls).map((tool, index): AgentSubagentItem => {
    const toolRecord = frameworkRecord(tool);
    const status = frameworkLifecycleStatus(firstString(toolRecord, ['status', 'state']));
    return {
      id: firstString(toolRecord, ['id']) ?? `tool-${index}`,
      title: firstString(toolRecord, ['name', 'toolName', 'tool_name']) ?? `Tool ${index + 1}`,
      detail: firstString(toolRecord, ['summary', 'message', 'detail']),
      kind: 'tool',
      status: status === 'failed' ? 'error' : status === 'completed' ? 'completed' : 'running',
    };
  });

  const valueItems = objectEntries(record.values).map(([key, value]): AgentSubagentItem => ({
    id: `value-${key}`,
    title: key,
    detail: formatScalar(value),
    kind: 'value',
    status: 'completed',
  }));

  return [...messageItems, ...toolItems, ...valueItems];
}

function frameworkQuestionOptions(value: unknown): AgentQuestionOption[] | undefined {
  const options = frameworkArray(value)
    .map((option, index): AgentQuestionOption | null => {
      const record = frameworkRecord(option);
      const label = firstString(record, ['label', 'text', 'title', 'value']);
      if (!label) return null;
      return {
        id: firstString(record, ['id', 'value']) ?? `option-${index}`,
        label,
        description: firstString(record, ['description', 'detail', 'summary']),
      };
    })
    .filter((option): option is AgentQuestionOption => option !== null);

  return options.length > 0 ? options : undefined;
}

function frameworkNamespaceFromTool(value: unknown): FrameworkStreamEvent['namespace'] {
  if (typeof value === 'string' && value) return value;
  if (Array.isArray(value)) {
    const namespace = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    return namespace.length > 0 ? namespace : undefined;
  }
  return undefined;
}

export function frameworkStreamEventFromToolArguments(args: Record<string, unknown>): FrameworkStreamEvent | null {
  const event = frameworkRecord(args.frameworkStreamEvent);
  const method = firstString(event, ['method']);
  if (!method) return null;

  return {
    method,
    namespace: frameworkNamespaceFromTool(event.namespace),
    data: event.data,
    event: firstString(event, ['event']),
    name: firstString(event, ['name']),
    source: firstString(event, ['source']) ?? 'smarty-server',
    runId: firstString(event, ['runId', 'run_id']),
    threadId: firstString(event, ['threadId', 'thread_id']),
  };
}

export function projectFrameworkStreamEventsToAgentElementsModels(
  events: readonly FrameworkStreamEvent[],
): AgentElementsRendererModel[] {
  return events.flatMap((event): AgentElementsRendererModel[] => {
    const method = (event.method ?? event.event ?? '').trim();
    const namespace = namespaceLabel(event.namespace);
    const record = frameworkRecord(event.data);
    const rawPayload = { frameworkStreamEvent: event };

    if (method === 'updates' || method === 'values' || method === 'output') {
      return [{
        kind: 'stateUpdate',
        title: method === 'output' ? 'Final output' : method === 'values' ? 'State values' : 'Graph update',
        namespace,
        status: method === 'output' ? 'completed' : 'running',
        summary: method === 'output' ? 'Final agent output' : method === 'values' ? 'State snapshot' : 'Changed state keys',
        changedKeys: stateChangedKeys(event.data),
        rawPayload,
      }];
    }

    if (method === 'messages' || method === 'message') {
      const role = firstString(record, ['role', 'type']) === 'user' ? 'user' : 'assistant';
      const body = firstString(record, ['text', 'content', 'message']);
      const reasoning = firstString(record, ['reasoning', 'thinking']);
      const model = firstString(record, ['model', 'modelName', 'model_name']) ?? namespace;
      const models: AgentElementsRendererModel[] = [];

      if (reasoning) {
        models.push({
          kind: 'thinking',
          body: reasoning,
          detail: model,
          status: body ? 'completed' : 'running',
          rawPayload,
        });
      }

      models.push({
        kind: role === 'user' ? 'userMessage' : 'assistantMessage',
        body,
        actor: {
          role,
          name: role === 'user' ? 'User' : 'Smarty Code',
          metadata: model,
        },
        isStreaming: !body,
        rawPayload,
      });

      return models;
    }

    if (method === 'subagents' || method === 'subgraphs') {
      const name = firstString(record, ['name', 'graphName', 'graph_name', 'agentName', 'agent_name']) ?? namespace ?? 'Subagent';
      const status = frameworkLifecycleStatus(firstString(record, ['status', 'state']));
      return [{
        kind: 'subagent',
        title: name,
        body: name,
        status: status === 'failed' ? 'error' : status === 'completed' ? 'completed' : 'running',
        summary: firstString(record, ['taskInput', 'task_input', 'summary', 'output', 'message']),
        subagentItems: frameworkSubagentItems(record),
        rawPayload,
      }];
    }

    if (method === 'tools' || method === 'toolCalls' || method === 'tool_calls') {
      const toolName = firstString(record, ['name', 'toolName', 'tool_name']) ?? event.name ?? event.event ?? 'Tool call';
      return [{
        kind: 'toolLifecycle',
        title: toolName,
        status: firstString(record, ['status', 'state']) ?? 'running',
        detail: namespace ?? firstString(record, ['detail', 'message']),
        body: event.event ?? firstString(record, ['summary', 'message']) ?? 'Tool lifecycle event',
        rawPayload,
      }];
    }

    if (method === 'lifecycle') {
      return [{
        kind: 'checkpointTaskDebug',
        lifecycleKind: 'run',
        lifecycleStatus: frameworkLifecycleStatus(firstString(record, ['status', 'state']) ?? event.event),
        title: firstString(record, ['graph_name', 'graphName', 'name', 'title']) ?? event.event ?? 'Run lifecycle',
        detail: firstString(record, ['detail', 'message', 'summary']),
        rawPayload,
      }];
    }

    if (method === 'input') {
      const options = frameworkQuestionOptions(record.options ?? record.choices ?? record.decisions);
      return [{
        kind: 'humanInput',
        title: 'Human input required',
        body: firstString(record, ['question', 'prompt', 'message', 'summary']) ?? 'Human input required',
        detail: firstString(record, ['description', 'detail']),
        status: firstString(record, ['status', 'state']) ?? (event.event === 'response' ? 'answered' : 'pending'),
        options,
        questionKind: options ? 'single' : 'text',
        questionInteractionMode: 'display',
        rawPayload,
      }];
    }

    if (method === 'checkpoints') {
      const checkpoint = frameworkRecord(record.checkpoint);
      const taskEvents = Array.isArray(record.tasks)
        ? record.tasks.map((task, index) => {
          const taskRecord = frameworkRecord(task);
          return {
            id: firstString(taskRecord, ['id']) ?? `task-${index}`,
            label: firstString(taskRecord, ['name', 'title']) ?? `Task ${index + 1}`,
            detail: firstString(taskRecord, ['detail', 'message', 'summary']),
            status: frameworkLifecycleStatus(firstString(taskRecord, ['status', 'state'])),
          };
        })
        : undefined;

      return [{
        kind: 'checkpointTaskDebug',
        lifecycleKind: 'checkpoint',
        lifecycleStatus: 'completed',
        title: firstString(record, ['name', 'title']) ?? 'Checkpoint',
        resumeId: firstString(checkpoint, ['id', 'checkpointId', 'checkpoint_id']),
        lifecycleEvents: taskEvents,
        rawPayload,
      }];
    }

    if (method === 'tasks') {
      return [{
        kind: 'checkpointTaskDebug',
        lifecycleKind: 'task',
        lifecycleStatus: frameworkLifecycleStatus(firstString(record, ['status', 'state'])),
        title: firstString(record, ['name', 'title']) ?? event.event ?? 'Task lifecycle',
        detail: firstString(record, ['detail', 'message', 'summary']),
        rawPayload,
      }];
    }

    if (method === 'debug') {
      return [{
        kind: 'checkpointTaskDebug',
        lifecycleKind: 'custom',
        title: event.event ?? firstString(record, ['name', 'title', 'node']) ?? 'Debug event',
        status: firstString(record, ['status', 'state']) ?? 'running',
        detail: firstString(record, ['detail', 'message', 'summary']),
        rawPayload,
      }];
    }

    if (method === 'custom' || method.startsWith('custom:') || method === 'extensions' || method === 'extension') {
      return [{
        kind: 'extensionEvent',
        eventName: frameworkEventName(event, method === 'custom' ? 'custom.event' : method),
        source: event.source ?? namespace ?? firstString(record, ['source']) ?? 'framework',
        status: firstString(record, ['status', 'state']) ?? 'running',
        summary: firstString(record, ['summary', 'message', 'detail']),
        rawPayload,
      }];
    }

    return [];
  });
}
