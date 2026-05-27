import type { RawMessage } from '../TranscriptTransformer';
import type { TurnEndedDescriptor } from './IRawMessageParser';

export function turnEndedFromLangChainUsage(
  msg: RawMessage,
  ...records: Array<Record<string, unknown>>
): TurnEndedDescriptor | null {
  const usage = findUsageRecord(records);
  if (!usage) return null;

  const inputTokenDetails = recordField(usage, 'input_token_details', 'inputTokenDetails');
  const inputTokens = numberField(usage, [
    'inputTokens',
    'input_tokens',
    'promptTokens',
    'prompt_tokens',
    'prompt',
    'input',
  ]) ?? 0;
  const outputTokens = numberField(usage, [
    'outputTokens',
    'output_tokens',
    'completionTokens',
    'completion_tokens',
    'completion',
    'output',
  ]) ?? 0;
  const cacheReadInputTokens = numberField(usage, [
    'cacheReadInputTokens',
    'cache_read_input_tokens',
    'cache_read_tokens',
    'cacheReadTokens',
  ]) ?? numberField(inputTokenDetails, [
    'cache_read',
    'cacheRead',
    'cache_read_input_tokens',
  ]) ?? 0;
  const cacheCreationInputTokens = numberField(usage, [
    'cacheCreationInputTokens',
    'cache_creation_input_tokens',
    'cache_creation_tokens',
    'cacheCreationTokens',
  ]) ?? numberField(inputTokenDetails, [
    'cache_creation',
    'cacheCreation',
    'cache_creation_input_tokens',
  ]) ?? 0;
  const totalContextTokens = numberField(usage, [
    'totalContextTokens',
    'total_context_tokens',
    'totalTokens',
    'total_tokens',
    'total',
  ]) ?? inputTokens + outputTokens + cacheReadInputTokens + cacheCreationInputTokens;

  if (inputTokens === 0 && outputTokens === 0 && totalContextTokens === 0) {
    return null;
  }

  const contextWindow = numberFromRecords(records, [
    'contextWindow',
    'context_window',
    'contextWindowTokens',
    'context_window_tokens',
    'maxContextTokens',
    'max_context_tokens',
  ]) ?? numberField(usage, [
    'contextWindow',
    'context_window',
    'contextWindowTokens',
    'context_window_tokens',
  ]) ?? 0;

  return {
    type: 'turn_ended',
    contextFill: {
      inputTokens,
      cacheReadInputTokens,
      cacheCreationInputTokens,
      outputTokens,
      totalContextTokens,
    },
    contextWindow,
    cumulativeUsage: {
      inputTokens,
      outputTokens,
      cacheReadInputTokens,
      cacheCreationInputTokens,
      costUSD: numberField(usage, ['costUSD', 'cost_usd', 'cost']) ?? 0,
      webSearchRequests: numberField(usage, [
        'webSearchRequests',
        'web_search_requests',
      ]) ?? 0,
    },
    contextCompacted: booleanFromRecords([usage, ...records], [
      'contextCompacted',
      'context_compacted',
      'compacted',
    ]) ?? false,
    createdAt: msg.createdAt,
  };
}

export function firstLangChainGenerationRecord(
  ...records: Array<Record<string, unknown>>
): Record<string, unknown> {
  for (const record of records) {
    const generations = record.generations;
    if (!Array.isArray(generations)) continue;
    for (const group of generations) {
      const candidates = Array.isArray(group) ? group : [group];
      for (const candidate of candidates) {
        if (!isRecord(candidate)) continue;
        if (isRecord(candidate.message)) return candidate.message;
        if (isRecord(candidate.generationInfo)) return candidate.generationInfo;
        return candidate;
      }
    }
  }
  return {};
}

function findUsageRecord(records: Array<Record<string, unknown>>): Record<string, unknown> | null {
  for (const record of records) {
    const direct = directUsageRecord(record);
    if (direct) return direct;
  }
  for (const record of records) {
    const providerUsage = providerUsageRecord(record);
    if (providerUsage) return providerUsage;
  }
  return null;
}

function directUsageRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  for (const key of [
    'usage',
    'usageMetadata',
    'usage_metadata',
    'tokenUsage',
    'token_usage',
  ]) {
    const value = record[key];
    if (isRecord(value)) return value;
  }

  const responseMetadata = record.response_metadata ?? record.responseMetadata;
  if (isRecord(responseMetadata)) {
    return directUsageRecord(responseMetadata);
  }

  return null;
}

function providerUsageRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  const llmOutput = record.llmOutput ?? record.llm_output;
  if (!isRecord(llmOutput)) return null;
  const tokenUsage = llmOutput.tokenUsage ?? llmOutput.token_usage;
  return isRecord(tokenUsage) ? tokenUsage : directUsageRecord(llmOutput);
}

function recordField(
  record: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> {
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) return value;
  }
  return {};
}

function numberField(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function numberFromRecords(records: Array<Record<string, unknown>>, keys: string[]): number | null {
  for (const record of records) {
    const number = numberField(record, keys);
    if (number !== null) return number;
  }
  return null;
}

function booleanFromRecords(records: Array<Record<string, unknown>>, keys: string[]): boolean | null {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') return value;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
