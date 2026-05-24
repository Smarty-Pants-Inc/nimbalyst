import { TranscriptProjector } from '../../ai/server/transcript/TranscriptProjector';
import type { TranscriptViewMessage } from '../../ai/server/transcript/TranscriptProjector';
import type { InteractivePromptPayload, ToolProgressPayload, TranscriptEvent } from '../../ai/server/transcript/types';
import type { AgentElementsRendererModel } from './AgentElementsRendererRegistry';
import type { AgentDiffLine, AgentSearchResult } from './AgentElementsToolRenderers';
import type { AgentPlanStep, AgentTodoItem } from './AgentElementsTodoPlan';
import type { AgentMcpArgument, AgentQuestionAnswer, AgentQuestionOption, AgentSubagentItem } from './AgentElementsFrameworkEvents';

type TranscriptToolCall = NonNullable<TranscriptViewMessage['toolCall']>;

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

const EDIT_TOOL_NAMES = new Set([
  'edit',
  'write',
  'multi-edit',
  'multiedit',
  'multi_edit',
  'applypatch',
  'apply_patch',
  'file_change',
]);

const BASH_TOOL_NAMES = new Set([
  'bash',
  'command_execution',
  'shell',
  'execute',
  'exec',
  'exec_command',
  'run_shell_command',
  'run_command',
]);

const SEARCH_TOOL_NAMES = new Set([
  'grep',
  'glob',
  'search',
  'read',
  'list',
  'ls',
  'rg',
  'ripgrep',
  'find',
  'search_query',
  'web_search',
  'code_search',
]);

const HUMAN_INPUT_TOOL_NAMES = new Set([
  'toolpermission',
  'askuserquestion',
  'gitcommitproposal',
  'promptforuserinput',
  'requestuserinput',
]);

const PLAN_TOOL_NAMES = new Set([
  'plan',
  'update_plan',
  'write_plan',
  'task_plan',
  'create_plan',
]);

function normalizeToolName(name: string | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() ?? filePath;
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
    return {
      id: firstString(toolRecord, ['id']) ?? `tool-${index}`,
      title: firstString(toolRecord, ['name', 'toolName', 'tool_name']) ?? `Tool ${index + 1}`,
      detail: firstString(toolRecord, ['summary', 'message', 'detail']),
      kind: 'tool',
      status: frameworkLifecycleStatus(firstString(toolRecord, ['status', 'state'])) === 'failed' ? 'error' : frameworkLifecycleStatus(firstString(toolRecord, ['status', 'state'])) === 'completed' ? 'completed' : 'running',
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

function safeParseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function progressUpdates(tool: TranscriptToolCall) {
  return tool.progress.map((entry) => ({
    label: entry.progressContent,
    detail: `${Math.round(entry.elapsedSeconds)}s elapsed`,
    tone: tool.status === 'error' ? 'error' as const : 'running' as const,
  }));
}

function mapAttachments(message: TranscriptViewMessage) {
  return message.attachments?.map((attachment) => ({
    id: attachment.id,
    name: attachment.filename,
    detail: attachment.filepath || `${attachment.size} bytes`,
    kind: attachment.mimeType?.startsWith('image/') ? 'image' as const : 'file' as const,
  }));
}

function diffLinesFromPatch(patch: string | undefined): AgentDiffLine[] {
  if (!patch) return [];
  return patch
    .split(/\r?\n/)
    .map((line): AgentDiffLine | null => {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@') || line.startsWith('\\')) {
        return null;
      }
      if (line.startsWith('+')) return { type: 'add', content: line.slice(1) };
      if (line.startsWith('-')) return { type: 'remove', content: line.slice(1) };
      if (line.startsWith(' ')) return { type: 'context', content: line.slice(1) };
      if (line.trim().length === 0) return null;
      return { type: 'context', content: line };
    })
    .filter((line): line is AgentDiffLine => line !== null);
}

function diffLinesFromTool(tool: TranscriptToolCall): AgentDiffLine[] {
  const fromChanges = tool.changes?.flatMap((change) => diffLinesFromPatch(change.patch)) ?? [];
  if (fromChanges.length > 0) return fromChanges;

  const args = tool.arguments;
  const oldText = firstString(args, ['old_string', 'oldText']);
  const newText = firstString(args, ['new_string', 'newText', 'content']);
  const lines: AgentDiffLine[] = [];
  if (oldText) {
    lines.push(...oldText.split(/\r?\n/).filter(Boolean).map((content) => ({ type: 'remove' as const, content })));
  }
  if (newText) {
    lines.push(...newText.split(/\r?\n/).filter(Boolean).map((content) => ({ type: 'add' as const, content })));
  }
  return lines;
}

function targetPath(tool: TranscriptToolCall): string | undefined {
  return (
    tool.targetFilePath ??
    firstString(tool.arguments, ['file_path', 'filePath', 'path', 'notebook_path']) ??
    tool.changes?.[0]?.path
  );
}

function resultText(tool: TranscriptToolCall): string | undefined {
  return tool.result && tool.result.trim().length > 0 ? tool.result : undefined;
}

function isSerializedJsonResult(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (
    !((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')))
  ) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function primaryResultText(tool: TranscriptToolCall): string | undefined {
  const result = resultText(tool);
  return isSerializedJsonResult(result) ? undefined : result;
}

function parseSearchResults(value: string | undefined): AgentSearchResult[] | undefined {
  if (!value) return undefined;
  const rows = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line): AgentSearchResult => {
      const match = line.match(/^(.+?):(\d+)(?::(.*))?$/);
      if (!match) {
        return { title: line, excerpt: line };
      }
      const [, path, lineNumber, excerpt] = match;
      return {
        title: basename(path),
        path,
        line: Number(lineNumber),
        excerpt: excerpt?.trim(),
      };
    });
  return rows.length > 0 ? rows : undefined;
}

function parseMcpIdentity(tool: TranscriptToolCall): { serverName?: string; toolName: string } {
  if (tool.mcpServer || tool.mcpTool) {
    return {
      serverName: tool.mcpServer ?? undefined,
      toolName: tool.mcpTool ?? tool.toolName,
    };
  }

  const match = tool.toolName.match(/^mcp__([^_]+)__(.+)$/);
  if (match) {
    return { serverName: match[1], toolName: match[2] };
  }

  return { toolName: tool.toolName };
}

function mcpArgs(args: Record<string, unknown>): AgentMcpArgument[] {
  return Object.entries(args)
    .slice(0, 8)
    .map(([key, value]) => ({ key, value: formatScalar(value) }));
}

function parseTodoStatus(value: unknown): AgentTodoItem['status'] {
  const status = typeof value === 'string' ? value.toLowerCase() : '';
  if (status === 'completed' || status === 'done') return 'completed';
  if (status === 'in_progress' || status === 'in-progress' || status === 'active' || status === 'running') return 'in_progress';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  return 'pending';
}

function parseTodos(tool: TranscriptToolCall): AgentTodoItem[] {
  const candidate =
    tool.arguments.todos ??
    tool.arguments.todoList ??
    tool.arguments.items ??
    safeParseObject(tool.result)?.todos;

  if (!Array.isArray(candidate)) {
    return [{
      content: tool.description ?? tool.toolDisplayName ?? 'Todo update',
      status: tool.status === 'running' ? 'in_progress' : 'pending',
    }];
  }

  return candidate.map((item, index) => {
    if (typeof item === 'string') {
      return { id: `todo-${index}`, content: item, status: 'pending' };
    }
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      id: firstString(record, ['id']) ?? `todo-${index}`,
      content: firstString(record, ['content', 'task', 'title', 'text']) ?? `Todo ${index + 1}`,
      activeForm: firstString(record, ['activeForm', 'active_form']),
      status: parseTodoStatus(record.status),
    };
  });
}

function parsePlanStepStatus(value: unknown): AgentPlanStep['status'] {
  const status = typeof value === 'string' ? value.toLowerCase() : '';
  if (status === 'completed' || status === 'done') return 'completed';
  if (status === 'in_progress' || status === 'in-progress' || status === 'active' || status === 'running') return 'in_progress';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  if (status === 'blocked') return 'blocked';
  return 'pending';
}

function parsePlanSteps(tool: TranscriptToolCall): AgentPlanStep[] {
  const candidate =
    tool.arguments.steps ??
    tool.arguments.plan ??
    tool.arguments.items ??
    safeParseObject(tool.result)?.steps ??
    safeParseObject(tool.result)?.plan;

  if (!Array.isArray(candidate)) return [];

  return candidate.map((item, index) => {
    if (typeof item === 'string') {
      return { id: `plan-step-${index}`, label: item, status: 'pending' };
    }
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      id: firstString(record, ['id']) ?? `plan-step-${index}`,
      label: firstString(record, ['step', 'label', 'content', 'task', 'title', 'text']) ?? `Step ${index + 1}`,
      status: parsePlanStepStatus(record.status),
    };
  });
}

function mapPlanStatus(tool: TranscriptToolCall): string {
  if (tool.status === 'running') return 'streaming';
  if (tool.status === 'error' || tool.isError) return 'rejected';
  const rawStatus = firstString(tool.arguments, ['status', 'planStatus']);
  if (rawStatus === 'awaiting_approval' || rawStatus === 'approved' || rawStatus === 'rejected') return rawStatus;
  if (rawStatus === 'streaming' || rawStatus === 'draft' || rawStatus === 'completed') return rawStatus;
  return 'completed';
}

function mapToolCall(message: TranscriptViewMessage, tool: TranscriptToolCall): AgentElementsRendererModel {
  const normalized = normalizeToolName(tool.toolName);
  const rawPayload = { transcriptMessage: message };

  if (normalized.includes('todo')) {
    return {
      kind: 'todo',
      status: tool.status,
      todos: parseTodos(tool),
      isStreaming: tool.status === 'running',
      rawPayload,
    };
  }

  if (PLAN_TOOL_NAMES.has(normalized) || normalized.endsWith('__update_plan') || normalized.endsWith(':update_plan')) {
    return {
      kind: 'plan',
      title: firstString(tool.arguments, ['title', 'planTitle', 'name']) ?? tool.description ?? tool.toolDisplayName ?? 'Plan update',
      status: mapPlanStatus(tool),
      body: firstString(tool.arguments, ['summary', 'description']) ?? primaryResultText(tool),
      filePath: firstString(tool.arguments, ['file_path', 'filePath', 'planFilePath', 'path']) ?? 'plan-working.md',
      planSteps: parsePlanSteps(tool),
      rawPayload,
    };
  }

  if (normalized === 'exitplanmode' || normalized === 'exit_plan_mode') {
    return {
      kind: 'plan',
      title: 'Plan approval',
      status: tool.status === 'running' ? 'awaiting_approval' : 'completed',
      body: primaryResultText(tool) ?? tool.description,
      rawPayload,
    };
  }

  if (HUMAN_INPUT_TOOL_NAMES.has(normalized)) {
    return {
      kind: 'humanInput',
      title: tool.toolDisplayName,
      body: tool.description ?? tool.toolDisplayName,
      status: tool.status === 'running' ? 'pending' : 'answered',
      detail: firstString(tool.arguments, ['rawCommand', 'command']),
      rawPayload,
    };
  }

  if (BASH_TOOL_NAMES.has(normalized)) {
    return {
      kind: 'bash',
      title: tool.toolDisplayName,
      status: tool.status,
      command: firstString(tool.arguments, ['command', 'cmd', 'rawCommand', 'script']) ?? tool.description ?? tool.toolDisplayName,
      cwd: firstString(tool.arguments, ['cwd', 'workdir', 'workingDirectory']),
      output: resultText(tool),
      exitCode: tool.exitCode,
      deniedReason: tool.isError ? primaryResultText(tool) : undefined,
      progressUpdates: progressUpdates(tool),
      rawPayload,
    };
  }

  if (
    EDIT_TOOL_NAMES.has(normalized) ||
    normalized.endsWith('__edit') ||
    normalized.endsWith(':edit') ||
    normalized.endsWith('__write') ||
    normalized.endsWith(':write')
  ) {
    const filePath = targetPath(tool);
    const diffLines = diffLinesFromTool(tool);
    if (!filePath && diffLines.length === 0) {
      return {
        kind: 'genericTool',
        title: tool.toolDisplayName || tool.toolName || 'Tool call',
        status: tool.status,
        summary: tool.description,
        result: primaryResultText(tool) ?? 'File tool event did not include path or diff evidence.',
        metadata: [{ label: 'tool', value: tool.toolName }],
        rawPayload,
      };
    }

    return {
      kind: 'fileEdit',
      title: tool.toolDisplayName,
      status: tool.status,
      editStatus: tool.status === 'running' ? 'streaming' : tool.status === 'error' || tool.isError ? 'error' : 'completed',
      filePath: filePath ?? tool.toolDisplayName,
      diffLines,
      body: tool.description ?? primaryResultText(tool),
      rawPayload,
    };
  }

  if (SEARCH_TOOL_NAMES.has(normalized) || normalized.endsWith('__search') || normalized.endsWith(':search')) {
    const query = firstString(tool.arguments, ['query', 'pattern', 'path', 'file_path', 'filePath']) ?? tool.description ?? tool.toolDisplayName;
    return {
      kind: 'search',
      title: tool.toolDisplayName,
      status: tool.status,
      query,
      searchSource: normalized === 'web_search' ? 'web' : 'code',
      searchResults: parseSearchResults(resultText(tool)),
      body: tool.description,
      progressUpdates: progressUpdates(tool),
      rawPayload,
    };
  }

  if (tool.mcpServer || tool.mcpTool || tool.toolName.startsWith('mcp__')) {
    const identity = parseMcpIdentity(tool);
    return {
      kind: 'mcp',
      title: tool.toolDisplayName,
      status: tool.status,
      serverName: identity.serverName,
      toolName: identity.toolName,
      displayName: tool.toolDisplayName,
      args: mcpArgs(tool.arguments),
      result: primaryResultText(tool) ?? (resultText(tool) ? 'Structured result available in debug details.' : undefined),
      error: tool.isError ? primaryResultText(tool) ?? 'Structured error available in debug details.' : undefined,
      rawPayload,
    };
  }

  return {
    kind: 'genericTool',
    title: tool.toolDisplayName || tool.toolName || 'Tool call',
    status: tool.status,
    summary: tool.description,
    result: primaryResultText(tool) ?? (
      resultText(tool)
        ? 'Structured result available in debug details.'
        : tool.status === 'running' ? 'Tool is running.' : 'No result content.'
    ),
    metadata: [
      { label: 'tool', value: tool.toolName },
      ...(targetPath(tool) ? [{ label: 'path', value: targetPath(tool) }] : []),
    ],
    rawPayload,
  };
}

function promptStatus(prompt: InteractivePromptPayload): AgentElementsRendererModel['status'] {
  if (prompt.status === 'pending') return 'pending';
  if (prompt.status === 'cancelled') return 'cancelled';
  if (prompt.promptType === 'permission_request') {
    if (prompt.decision === 'allow') return 'approved';
    if (prompt.decision === 'deny') return 'denied';
  }
  return 'answered';
}

function promptOptions(prompt: InteractivePromptPayload): AgentQuestionOption[] {
  if (prompt.promptType === 'permission_request') {
    return [
      { id: 'allow', label: 'Allow', description: prompt.patternDisplayName },
      { id: 'deny', label: 'Deny', description: prompt.rawCommand },
    ];
  }

  if (prompt.promptType === 'ask_user_question') {
    return (prompt.questions[0]?.options ?? []).map((option, index) => ({
      id: `${index}`,
      label: option.label,
      description: option.description,
    }));
  }

  if (prompt.promptType === 'git_commit_proposal') {
    return [
      { id: 'commit', label: 'Commit', description: prompt.commitMessage },
      { id: 'cancel', label: 'Cancel' },
    ];
  }

  return [];
}

function responseHistory(prompt: InteractivePromptPayload): AgentQuestionAnswer[] {
  if (prompt.promptType === 'permission_request' && prompt.decision) {
    return [{ label: `Decision: ${prompt.decision}` }];
  }
  if (prompt.promptType === 'ask_user_question' && prompt.answers) {
    return Object.entries(prompt.answers).map(([key, value]) => ({ label: `${key}: ${value}` }));
  }
  if (prompt.promptType === 'git_commit_proposal' && prompt.decision) {
    return [{ label: `Decision: ${prompt.decision}` }];
  }
  return [];
}

function mapInteractivePrompt(message: TranscriptViewMessage, prompt: InteractivePromptPayload): AgentElementsRendererModel {
  if (prompt.promptType === 'permission_request') {
    return {
      kind: 'humanInput',
      title: 'Permission request',
      body: `Allow ${prompt.toolName}?`,
      detail: prompt.rawCommand,
      status: promptStatus(prompt),
      options: promptOptions(prompt),
      questionKind: 'single',
      questionInteractionMode: 'display',
      responseHistory: responseHistory(prompt),
      rawPayload: { transcriptMessage: message },
    };
  }

  if (prompt.promptType === 'ask_user_question') {
    const firstQuestion = prompt.questions[0];
    return {
      kind: 'humanInput',
      title: firstQuestion?.header ?? 'Question',
      body: firstQuestion?.question ?? 'Question from agent',
      status: promptStatus(prompt),
      options: promptOptions(prompt),
      questionKind: firstQuestion?.multiSelect ? 'multi' : firstQuestion?.options?.length ? 'single' : 'text',
      questionInteractionMode: 'display',
      responseHistory: responseHistory(prompt),
      rawPayload: { transcriptMessage: message },
    };
  }

  return {
    kind: 'humanInput',
    title: 'Git commit proposal',
    body: prompt.commitMessage,
    status: promptStatus(prompt),
    options: promptOptions(prompt),
    questionKind: 'single',
    questionInteractionMode: 'display',
    responseHistory: responseHistory(prompt),
    rawPayload: { transcriptMessage: message },
  };
}

function mapSubagentItem(message: TranscriptViewMessage): AgentSubagentItem {
  if (message.toolCall) {
    return {
      id: String(message.id),
      title: message.toolCall.toolDisplayName || message.toolCall.toolName,
      detail: message.toolCall.description ?? resultText(message.toolCall),
      kind: 'tool',
      status: message.toolCall.status === 'error' ? 'error' : message.toolCall.status,
    };
  }

  if (message.type === 'assistant_message' || message.type === 'user_message') {
    return {
      id: String(message.id),
      title: message.type === 'assistant_message' ? 'Assistant message' : 'User message',
      detail: message.text,
      kind: 'message',
      status: 'completed',
    };
  }

  if (message.type === 'turn_ended') {
    return { id: String(message.id), title: 'Turn summary', kind: 'checkpoint', status: 'completed' };
  }

  return { id: String(message.id), title: message.type, kind: 'value', status: 'completed' };
}

function mapSubagent(message: TranscriptViewMessage): AgentElementsRendererModel {
  const subagent = message.subagent;
  return {
    kind: 'subagent',
    title: subagent?.teammateName ?? subagent?.agentType ?? 'Subagent',
    body: subagent?.teammateName ?? subagent?.agentType ?? 'Subagent',
    status: subagent?.status === 'completed' ? 'completed' : 'running',
    summary: subagent?.resultSummary ?? subagent?.prompt,
    subagentItems: subagent?.childEvents.map(mapSubagentItem),
    elapsedLabel: subagent?.durationMs ? `${Math.round(subagent.durationMs / 1000)}s` : undefined,
    rawPayload: { transcriptMessage: message },
  };
}

function mapTurnSummary(message: TranscriptViewMessage): AgentElementsRendererModel {
  const turn = message.turnEnded;
  const cumulative = turn?.cumulativeUsage;
  const total = cumulative ? cumulative.inputTokens + cumulative.outputTokens : undefined;
  return {
    kind: 'turnSummary',
    status: 'completed',
    usage: cumulative ? {
      input: cumulative.inputTokens,
      output: cumulative.outputTokens,
      total,
    } : undefined,
    contextUsagePercent: turn && turn.contextWindow > 0
      ? Math.round((turn.contextFill.totalContextTokens / turn.contextWindow) * 100)
      : undefined,
    warnings: turn?.contextCompacted ? ['Context was compacted during this turn.'] : undefined,
    rawPayload: { transcriptMessage: message },
  };
}

function transcriptEventToToolProgressMessage(event: TranscriptEvent): TranscriptViewMessage {
  const payload = event.payload as unknown as ToolProgressPayload;
  return {
    id: event.id,
    sequence: event.sequence,
    createdAt: event.createdAt,
    type: 'tool_progress',
    subagentId: event.subagentId,
    text: payload.progressContent,
  };
}

function mapSystemStatus(message: TranscriptViewMessage): AgentElementsRendererModel {
  const system = message.systemMessage;
  const isError = message.isError || system?.systemType === 'error';
  return {
    kind: 'systemStatus',
    title: isError ? 'System error' : system?.systemType === 'slash_command' ? 'Slash command' : 'System status',
    body: message.text ?? 'System status update.',
    status: message.isAuthError || system?.isAuthError ? 'auth_required' : system?.statusCode ?? (isError ? 'service_error' : 'info'),
    detail: system?.reminderKind,
    rawPayload: { transcriptMessage: message },
  };
}

export function projectTranscriptViewMessageToAgentElementsModels(
  message: TranscriptViewMessage,
): AgentElementsRendererModel[] {
  switch (message.type) {
    case 'user_message':
      return [{
        kind: 'userMessage',
        body: message.text,
        actor: { role: 'user', name: 'User', metadata: message.mode },
        attachments: mapAttachments(message),
        rawPayload: { transcriptMessage: message },
      }];
    case 'assistant_message': {
      const models: AgentElementsRendererModel[] = [];
      if (message.thinking) {
        models.push({
          kind: 'thinking',
          body: message.thinking,
          detail: message.model,
          status: message.text ? 'completed' : 'running',
          rawPayload: { transcriptMessage: message },
        });
      }
      if (message.text || !message.thinking) {
        models.push({
          kind: 'assistantMessage',
          body: message.text,
          actor: { role: 'assistant', name: 'Smarty Code', metadata: message.model ?? message.mode },
          isStreaming: message.text === undefined || message.text.length === 0,
          rawPayload: { transcriptMessage: message },
        });
      }
      return models;
    }
    case 'system_message':
      return [mapSystemStatus(message)];
    case 'tool_call':
      return message.toolCall ? [mapToolCall(message, message.toolCall)] : [];
    case 'interactive_prompt':
      return message.interactivePrompt ? [mapInteractivePrompt(message, message.interactivePrompt)] : [];
    case 'subagent':
      return [mapSubagent(message)];
    case 'turn_ended':
      return [mapTurnSummary(message)];
    case 'tool_progress':
      return [{
        kind: 'toolProgress',
        body: message.text ?? 'Tool progress update',
        status: 'running',
        rawPayload: { transcriptMessage: message },
      }];
  }
}

export function projectTranscriptViewMessagesToAgentElementsModels(
  messages: readonly TranscriptViewMessage[],
): AgentElementsRendererModel[] {
  return messages.flatMap((message) => projectTranscriptViewMessageToAgentElementsModels(message));
}

export function projectTranscriptEventsToAgentElementsModels(
  events: readonly TranscriptEvent[],
): AgentElementsRendererModel[] {
  const sortedEvents = [...events].sort((a, b) => a.sequence - b.sequence || a.id - b.id);
  const projectedMessages = TranscriptProjector.project(sortedEvents).messages;
  const rows = [
    ...projectedMessages.map((message) => ({
      sequence: message.sequence,
      id: message.id,
      models: projectTranscriptViewMessageToAgentElementsModels(message),
    })),
    ...sortedEvents
      .filter((event) => event.eventType === 'tool_progress' && event.parentEventId == null)
      .map((event) => ({
        sequence: event.sequence,
        id: event.id,
        models: projectTranscriptViewMessageToAgentElementsModels(transcriptEventToToolProgressMessage(event)),
      })),
  ];

  return rows
    .sort((a, b) => a.sequence - b.sequence || a.id - b.id)
    .flatMap((row) => row.models);
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
        title: firstString(record, ['name', 'title']) ?? event.event ?? 'Run lifecycle',
        detail: firstString(record, ['detail', 'message', 'summary']),
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
