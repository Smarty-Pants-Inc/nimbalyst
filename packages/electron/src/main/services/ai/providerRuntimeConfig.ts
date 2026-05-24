import {
  ModelRegistry,
  normalizeLoopbackHttpUrl,
} from '@nimbalyst/runtime/ai/server';
import { parseEffortLevel } from '@nimbalyst/runtime/ai/server/effortLevels';
import type {
  AIProviderType,
  ProviderConfig,
  SessionData,
} from '@nimbalyst/runtime/ai/server/types';
import { extractModelForProvider } from './aiServiceUtils';

const DEFAULT_BASE_URLS: Record<string, string> = {
  lmstudio: 'http://127.0.0.1:8234',
  'smarty-server': 'http://127.0.0.1:8788',
};

export function normalizeSmartyServerBaseUrl(value?: string): string {
  return normalizeLoopbackHttpUrl(
    value || DEFAULT_BASE_URLS['smarty-server'],
    DEFAULT_BASE_URLS['smarty-server'],
    'Smarty Server URL',
  );
}

export async function buildProviderRuntimeConfig({
  session,
  apiKey,
  providerSettings = {},
}: {
  session: SessionData;
  apiKey?: string;
  providerSettings?: Record<string, any>;
}): Promise<ProviderConfig> {
  const sessionConfig = (session.providerConfig || {}) as Record<string, any>;
  const provider = session.provider as AIProviderType;
  const config: ProviderConfig = {
    apiKey,
    maxTokens: sessionConfig.maxTokens ?? providerSettings.maxTokens,
    temperature: sessionConfig.temperature ?? providerSettings.temperature,
  };

  const effortLevel = (session.metadata as any)?.effortLevel;
  if (effortLevel) {
    config.effortLevel = parseEffortLevel(effortLevel);
  }

  const configuredModel =
    session.model ||
    sessionConfig.model ||
    providerSettings.defaultModel ||
    providerSettings.model;

  if (configuredModel && provider !== 'claude-code') {
    const modelForProvider = extractModelForProvider(configuredModel, provider);
    if (modelForProvider !== null) {
      config.model = modelForProvider;
    }
  }

  if (!config.model && provider !== 'claude-code') {
    const defaultModel = await ModelRegistry.getDefaultModel(provider);
    if (defaultModel) {
      const defaultModelForProvider = extractModelForProvider(defaultModel, provider);
      if (defaultModelForProvider !== null) {
        config.model = defaultModelForProvider;
      }
    }
  }

  const defaultBaseUrl = DEFAULT_BASE_URLS[provider];
  if (defaultBaseUrl) {
    config.baseUrl = provider === 'smarty-server'
      ? normalizeSmartyServerBaseUrl(providerSettings.baseUrl)
      : providerSettings.baseUrl || defaultBaseUrl;
  }

  return config;
}
