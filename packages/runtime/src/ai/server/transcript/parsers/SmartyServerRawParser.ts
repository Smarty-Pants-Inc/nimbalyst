/**
 * SmartyServerRawParser -- parses LangGraph Agent Server stream events logged
 * by the `smarty-server` provider.
 *
 * Raw output rows are the exact SDK stream chunks:
 * `{ id?, event, data }`. The parser also accepts LangGraph Event Streaming
 * protocol envelopes shaped as `{ method, params: { namespace, data } }`.
 * Nimbalyst owns projection; LangGraph remains the runtime source for
 * thread/run/tool state.
 */

import type { RawMessage } from '../TranscriptTransformer';
import { parseMcpToolName } from '../utils';
import type {
  CanonicalEventDescriptor,
  IRawMessageParser,
  ParseContext,
} from './IRawMessageParser';
import type { InteractivePromptPayload } from '../types';
import {
  frameworkNamespace,
  isFrameworkStreamMethod,
  type LangGraphStreamChunk,
  normalizeEventStreamProtocolChunk,
  toFrameworkStreamDescriptors,
  toSubgraphMessageStreamChunk,
  unwrapNamespaceTupleData,
} from './SmartyServerFrameworkStream';
import {
  firstLangChainGenerationRecord,
  turnEndedFromLangChainUsage,
} from './SmartyServerUsage';

interface LangGraphToolEvent {
  event?: string;
  toolCallId?: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
}

export class SmartyServerRawParser implements IRawMessageParser {
  async parseMessage(
    msg: RawMessage,
    context: ParseContext,
  ): Promise<CanonicalEventDescriptor[]> {
    if (msg.hidden && msg.direction !== 'output') return [];

    if (msg.direction === 'input') {
      return this.parseInputMessage(msg);
    }

    return this.parseOutputMessage(msg, context);
  }

  private parseInputMessage(msg: RawMessage): CanonicalEventDescriptor[] {
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed && typeof parsed === 'object' && typeof parsed.prompt === 'string') {
        return [{
          type: 'user_message',
          text: parsed.prompt,
          mode: (msg.metadata?.mode as 'agent' | 'planning') ?? 'agent',
          attachments: msg.metadata?.attachments as never,
          createdAt: msg.createdAt,
        }];
      }
    } catch {
      // Fall through to plain text.
    }

    const content = String(msg.content ?? '').trim();
    if (!content) return [];

    return [{
      type: 'user_message',
      text: content,
      mode: (msg.metadata?.mode as 'agent' | 'planning') ?? 'agent',
      createdAt: msg.createdAt,
    }];
  }

  private async parseOutputMessage(
    msg: RawMessage,
    context: ParseContext,
  ): Promise<CanonicalEventDescriptor[]> {
    let chunk: LangGraphStreamChunk;
    try {
      chunk = JSON.parse(msg.content) as LangGraphStreamChunk;
    } catch {
      return [];
    }

    if (!chunk || typeof chunk !== 'object') return [];

    if ((chunk as Record<string, unknown>).type === 'nimbalyst_tool_use') {
      return this.parseNimbalystToolUse(msg, chunk, context);
    }

    if ((chunk as Record<string, unknown>).type === 'nimbalyst_tool_result') {
      const result = this.parseNimbalystToolResult(chunk, context);
      return result ? [result] : [];
    }

    chunk = normalizeEventStreamProtocolChunk(chunk) ?? chunk;

    switch (chunk.event) {
      case 'messages':
        return this.parseMessageTuple(msg, chunk);
      case 'tools':
        return this.parseToolEvent(msg, chunk.data, context);
      case 'events':
        return this.parseLangChainEvent(msg, chunk.data, context);
      case 'error':
        return this.parseError(msg, chunk.data);
      default:
        if (isFrameworkStreamMethod(chunk.event)) {
          return toFrameworkStreamDescriptors(msg, chunk);
        }
        return [];
    }
  }

  private parseMessageTuple(
    msg: RawMessage,
    chunk: LangGraphStreamChunk,
  ): CanonicalEventDescriptor[] {
    const messageChannelDescriptors = this.parseEventStreamMessage(msg, chunk);
    if (messageChannelDescriptors.length > 0) return messageChannelDescriptors;

    const subgraphChunk = toSubgraphMessageStreamChunk(chunk);
    if (subgraphChunk) return toFrameworkStreamDescriptors(msg, subgraphChunk);

    const data = unwrapNamespaceTupleData(chunk.data);
    if (!Array.isArray(data) || data.length === 0) return [];
    const message = data[0];
    if (!isRecord(message)) return [];

    const text = contentToText(message.content);
    if (!text) return [];

    return [{
      type: 'assistant_message',
      text,
      coalesceKey: getAssistantCoalesceKey(msg, chunk, message),
      createdAt: msg.createdAt,
    }];
  }

  private parseEventStreamMessage(
    msg: RawMessage,
    chunk: LangGraphStreamChunk,
  ): CanonicalEventDescriptor[] {
    const data = isRecord(chunk.data) ? chunk.data : null;
    if (!data || typeof data.event !== 'string') return [];

    const delta = isRecord(data.delta) ? data.delta : {};
    const deltaType = firstString(delta.type, data.type);
    const coalesceKey = getEventStreamMessageCoalesceKey(msg, chunk, data);

    if (data.event === 'content-block-delta') {
      if (deltaType === 'reasoning-delta' || deltaType === 'thinking-delta') {
        const thinking = firstString(delta.reasoning, delta.thinking, delta.text, data.reasoning, data.thinking);
        return thinking ? [{
          type: 'assistant_message',
          text: '',
          thinking,
          coalesceKey,
          createdAt: msg.createdAt,
        }] : [];
      }

      const text = firstString(delta.text, delta.content, data.text, data.content);
      return text ? [{
        type: 'assistant_message',
        text,
        coalesceKey,
        createdAt: msg.createdAt,
      }] : [];
    }

    if (data.event === 'message-finish') {
      const message = isRecord(data.message) ? data.message : data;
      const text = contentToText(message.content) || firstString(message.text, message.content);
      const descriptors: CanonicalEventDescriptor[] = text ? [{
        type: 'assistant_message',
        text,
        coalesceKey,
        createdAt: msg.createdAt,
      }] : [];
      const usage = turnEndedFromLangChainUsage(msg, data, message);
      if (usage) descriptors.push(usage);
      return descriptors;
    }

    return [];
  }

  private parseToolEvent(
    msg: RawMessage,
    data: unknown,
    context: ParseContext,
  ): CanonicalEventDescriptor[] {
    if (!isRecord(data)) return [];
    const event = data as LangGraphToolEvent;
    const providerToolCallId = this.getToolCallId(event, msg);
    const toolName = typeof event.name === 'string' && event.name ? event.name : 'unknown_tool';

    if (event.event === 'on_tool_start') {
      if (context.hasToolCall(providerToolCallId)) return [];
      const args = isRecord(event.input) ? event.input : {};
      const fileChange = toFileChangeArgs(toolName, args);
      const parsed = parseMcpToolName(toolName);
      return [{
        type: 'tool_call_started',
        toolName: fileChange ? 'file_change' : toolName,
        toolDisplayName: fileChange ? 'file_change' : toolName,
        arguments: fileChange?.arguments ?? args,
        targetFilePath: fileChange?.targetFilePath ?? extractTargetPath(args),
        mcpServer: parsed?.server ?? null,
        mcpTool: parsed?.tool ?? null,
        providerToolCallId,
        createdAt: msg.createdAt,
      }];
    }

    if (event.event === 'on_tool_end' || event.event === 'on_tool_error') {
      const result = event.event === 'on_tool_error' ? event.error : event.output;
      const exitCode = extractExitCode(result);
      const isError = event.event === 'on_tool_error' || isNonZeroExitCode(exitCode);
      return [{
        type: 'tool_call_completed',
        providerToolCallId,
        status: isError ? 'error' : 'completed',
        result: stringifyResult(result),
        isError,
        ...(exitCode !== null ? { exitCode } : {}),
      }];
    }

    return [];
  }

  private parseLangChainEvent(
    msg: RawMessage,
    data: unknown,
    context: ParseContext,
  ): CanonicalEventDescriptor[] {
    if (!isRecord(data) || typeof data.event !== 'string') return [];

    if (data.event === 'on_chat_model_end' || data.event === 'on_llm_end') {
      const payload = isRecord(data.data) ? data.data : {};
      const output = isRecord(payload.output) ? payload.output : {};
      const generation = firstLangChainGenerationRecord(payload, output);
      const usage = turnEndedFromLangChainUsage(msg, payload, output, generation);
      return usage ? [usage] : [];
    }

    if (!data.event.startsWith('on_tool_')) return [];

    const payload = isRecord(data.data) ? data.data : {};
    const providerToolCallId = typeof payload.toolCallId === 'string'
      ? payload.toolCallId
      : typeof payload.tool_call_id === 'string'
        ? payload.tool_call_id
        : typeof data.run_id === 'string'
          ? data.run_id
          : `smarty-server-tool-${msg.id}`;
    const toolName = typeof data.name === 'string' && data.name ? data.name : 'unknown_tool';

    if (data.event === 'on_tool_start') {
      if (context.hasToolCall(providerToolCallId)) return [];
      const args = isRecord(payload.input) ? payload.input : {};
      const fileChange = toFileChangeArgs(toolName, args);
      const parsed = parseMcpToolName(toolName);
      return [{
        type: 'tool_call_started',
        toolName: fileChange ? 'file_change' : toolName,
        toolDisplayName: fileChange ? 'file_change' : toolName,
        arguments: fileChange?.arguments ?? args,
        targetFilePath: fileChange?.targetFilePath ?? extractTargetPath(args),
        mcpServer: parsed?.server ?? null,
        mcpTool: parsed?.tool ?? null,
        providerToolCallId,
        createdAt: msg.createdAt,
      }];
    }

    if (data.event === 'on_tool_end' || data.event === 'on_tool_error') {
      const result = data.event === 'on_tool_error' ? payload.error : payload.output;
      const exitCode = extractExitCode(result);
      const isError = data.event === 'on_tool_error' || isNonZeroExitCode(exitCode);
      return [{
        type: 'tool_call_completed',
        providerToolCallId,
        status: isError ? 'error' : 'completed',
        result: stringifyResult(result),
        isError,
        ...(exitCode !== null ? { exitCode } : {}),
      }];
    }

    return [];
  }

  private parseError(msg: RawMessage, data: unknown): CanonicalEventDescriptor[] {
    const text = isRecord(data) && typeof data.message === 'string'
      ? data.message
      : isRecord(data) && typeof data.error === 'string'
        ? data.error
        : 'Smarty server stream error';

    return [{
      type: 'system_message',
      text,
      systemType: 'error',
      searchable: false,
      createdAt: msg.createdAt,
    }];
  }

  private getToolCallId(event: LangGraphToolEvent, msg: RawMessage): string {
    if (typeof event.toolCallId === 'string' && event.toolCallId) {
      return event.toolCallId;
    }
    return `smarty-server-tool-${msg.id}`;
  }

  private async parseNimbalystToolUse(
    msg: RawMessage,
    parsed: unknown,
    context: ParseContext,
  ): Promise<CanonicalEventDescriptor[]> {
    if (!isRecord(parsed)) return [];
    const id = typeof parsed.id === 'string' ? parsed.id : null;
    if (id) {
      if (context.hasToolCall(id)) return [];
      const existing = await context.findByProviderToolCallId(id);
      if (existing) return [];
    }

    const toolName = typeof parsed.name === 'string' && parsed.name ? parsed.name : 'unknown';
    const args = isRecord(parsed.input) ? parsed.input : {};
    if (toolName === 'ToolPermission') {
      if (id) {
        if (context.hasToolCall(id)) return [];
        const existing = await context.findByProviderToolCallId(id);
        if (existing) return [];
      }
      const prompt = toPermissionPromptPayload(id, args);
      return prompt ? [{
        type: 'interactive_prompt_created',
        payload: prompt,
        createdAt: msg.createdAt,
      }] : [];
    }

    const parsedMcpTool = parseMcpToolName(toolName);

    return [{
      type: 'tool_call_started',
      toolName,
      toolDisplayName: toolName,
      arguments: args,
      targetFilePath: extractTargetPath(args),
      mcpServer: parsedMcpTool?.server ?? null,
      mcpTool: parsedMcpTool?.tool ?? null,
      providerToolCallId: id,
      createdAt: msg.createdAt,
    }];
  }

  private parseNimbalystToolResult(
    parsed: unknown,
    _context: ParseContext,
  ): CanonicalEventDescriptor | null {
    if (!isRecord(parsed)) return null;
    const providerToolCallId = typeof parsed.tool_use_id === 'string'
      ? parsed.tool_use_id
      : typeof parsed.id === 'string'
        ? parsed.id
        : null;
    if (!providerToolCallId) return null;
    const permissionUpdate = toPermissionPromptUpdate(providerToolCallId, parsed.result);
    if (permissionUpdate) {
      return permissionUpdate;
    }

    const exitCode = extractExitCode(parsed.result);
    const isError = Boolean(parsed.is_error) || isNonZeroExitCode(exitCode);
    return {
      type: 'tool_call_completed',
      providerToolCallId,
      status: isError ? 'error' : 'completed',
      result: stringifyResult(parsed.result),
      isError,
      ...(exitCode !== null ? { exitCode } : {}),
    };
  }
}

function toPermissionPromptPayload(
  id: string | null,
  input: Record<string, unknown>,
): InteractivePromptPayload | null {
  const requestId = typeof input.requestId === 'string'
    ? input.requestId
    : id;
  if (!requestId) return null;

  return {
    promptType: 'permission_request',
    requestId,
    status: 'pending',
    toolName: stringField(input.toolName, 'ToolPermission'),
    rawCommand: stringField(input.rawCommand, ''),
    pattern: stringField(input.pattern, stringField(input.toolName, 'ToolPermission')),
    patternDisplayName: stringField(input.patternDisplayName, stringField(input.toolName, 'ToolPermission')),
    isDestructive: Boolean(input.isDestructive),
    warnings: stringArrayField(input.warnings),
  };
}

function toPermissionPromptUpdate(
  requestId: string,
  result: unknown,
): CanonicalEventDescriptor | null {
  const parsed = parseResultRecord(result);
  if (!parsed) return null;

  const decision = parsed.decision;
  if (decision !== 'allow' && decision !== 'deny') return null;

  const scope = parsed.scope;
  return {
    type: 'interactive_prompt_updated',
    requestId,
    update: {
      status: 'resolved',
      decision,
      ...(scope === 'once' || scope === 'session' || scope === 'always' || scope === 'always-all'
        ? { scope }
        : {}),
      respondedBy: parsed.respondedBy === 'mobile' ? 'mobile' : 'desktop',
    },
  };
}

function parseResultRecord(result: unknown): Record<string, unknown> | null {
  if (isRecord(result)) return result;
  if (typeof result !== 'string') return null;
  try {
    const parsed = JSON.parse(result);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stringField(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function stringArrayField(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
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

function extractTargetPath(args: Record<string, unknown>): string | null {
  if (typeof args.path === 'string') return args.path;
  if (typeof args.file_path === 'string') return args.file_path;
  if (typeof args.filePath === 'string') return args.filePath;
  return null;
}

function toFileChangeArgs(
  toolName: string,
  args: Record<string, unknown>,
): { arguments: { changes: Array<{ path: string; kind: string }> }; targetFilePath: string } | null {
  if (toolName !== 'write_file' && toolName !== 'edit_file') return null;
  const targetFilePath = extractTargetPath(args);
  if (!targetFilePath) return null;
  return {
    arguments: {
      changes: [{
        path: targetFilePath,
        kind: toolName === 'write_file' ? 'add' : 'update',
      }],
    },
    targetFilePath,
  };
}

function stringifyResult(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractExitCode(value: unknown): number | null {
  if (typeof value === 'string') {
    const parsed = parseJsonValue(value);
    if (parsed !== null) {
      const parsedExitCode = extractExitCode(parsed);
      if (parsedExitCode !== null) return parsedExitCode;
    }
    const match = value.match(/\b(?:exit code|exited with code)\s*:?\s*(-?\d+)\b/i);
    return match ? Number(match[1]) : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const exitCode = extractExitCode(item);
      if (exitCode !== null) return exitCode;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  const direct = numericField(value.exit_code)
    ?? numericField(value.exitCode)
    ?? numericField(value.returncode)
    ?? numericField(value.returnCode);
  if (direct !== null) return direct;

  return extractExitCode(value.result) ?? extractExitCode(value.output);
}

function parseJsonValue(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function numericField(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isNonZeroExitCode(exitCode: number | null): boolean {
  return typeof exitCode === 'number' && exitCode !== 0;
}

function getAssistantCoalesceKey(
  msg: RawMessage,
  chunk: LangGraphStreamChunk,
  message: Record<string, any>,
): string | undefined {
  const metadata = Array.isArray(chunk.data) && isRecord(chunk.data[1])
    ? chunk.data[1]
    : {};
  const threadId = firstString(
    metadata.thread_id,
    metadata.threadId,
    msg.metadata?.threadId,
    msg.metadata?.thread_id,
  );
  const runId = firstString(
    metadata.run_id,
    metadata.runId,
    msg.metadata?.runId,
    msg.metadata?.run_id,
  );
  if (runId) {
    return `smarty-server:${threadId ?? 'thread'}:${runId}`;
  }
  if (typeof message.id === 'string' && message.id) {
    return `smarty-server-message:${message.id}`;
  }
  if (typeof chunk.id === 'string' && chunk.id) {
    return `smarty-server-event:${chunk.id}`;
  }
  return undefined;
}

function getEventStreamMessageCoalesceKey(
  msg: RawMessage,
  chunk: LangGraphStreamChunk,
  data: Record<string, unknown>,
): string | undefined {
  const message = isRecord(data.message) ? data.message : {};
  const messageId = firstString(
    data.messageId,
    data.message_id,
    message.id,
    data.id,
  );
  if (messageId) {
    return `smarty-server-message:${messageId}`;
  }

  const runId = firstString(
    data.run_id,
    data.runId,
    msg.metadata?.runId,
    msg.metadata?.run_id,
  );
  if (runId) {
    const namespace = frameworkNamespace(chunk.namespace);
    const namespaceKey = Array.isArray(namespace)
      ? namespace.join('/')
      : namespace;
    return `smarty-server:${namespaceKey || 'root'}:${runId}`;
  }

  if (typeof chunk.id === 'string' && chunk.id) {
    return `smarty-server-event:${chunk.id}`;
  }

  return undefined;
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
