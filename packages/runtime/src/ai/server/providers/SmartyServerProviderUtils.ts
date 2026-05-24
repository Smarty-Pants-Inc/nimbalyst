import { ModelIdentifier } from '../types';

const DEFAULT_ASSISTANT_ID = 'smarty_coding_agent';

export function normalizeAssistantId(model: string | undefined): string {
  if (!model) return DEFAULT_ASSISTANT_ID;
  const parsed = ModelIdentifier.tryParse(model);
  if (parsed && parsed.provider === 'smarty-server') {
    return parsed.model || DEFAULT_ASSISTANT_ID;
  }
  return model || DEFAULT_ASSISTANT_ID;
}

export function stringifyForDisplay(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
