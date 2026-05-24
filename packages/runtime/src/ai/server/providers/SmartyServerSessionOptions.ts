import type { ProviderConfig } from '../types';
import { normalizeAssistantId } from './SmartyServerProviderUtils';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8788';

export function buildSmartyServerSessionOptions(
  config: ProviderConfig | undefined,
  workspacePath: string,
  abortSignal: AbortSignal | undefined,
) {
  return {
    workspacePath,
    model: config?.model,
    raw: {
      baseUrl: config?.baseUrl ?? DEFAULT_BASE_URL,
      assistantId: normalizeAssistantId(config?.model),
      apiKey: config?.apiKey ?? null,
      abortSignal,
    },
  };
}
