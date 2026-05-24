/**
 * Utility functions for normalizing AI provider model configurations.
 *
 * OpenAI Codex provider uses dynamic model discovery instead of user-configured
 * model selections. This utility removes the `models` field from Codex configs
 * to prevent stale model lists from being persisted or transmitted.
 */

import { AI_PROVIDER_TYPES } from '../types';

const ACTIVE_AI_PROVIDER_IDS = new Set<string>(AI_PROVIDER_TYPES);

/**
 * Removes the `models` field from an object, returning a new object without it.
 * TypeScript will correctly infer the return type as `Omit<T, 'models'>`.
 */
export function omitModelsField<T extends { models?: any }>(
  config: T
): Omit<T, 'models'> {
  if (!config || typeof config !== 'object') {
    return config as Omit<T, 'models'>;
  }

  const { models: _removed, ...rest } = config;
  return rest;
}

/**
 * Providers that use dynamic model discovery and should not persist a `models` field.
 */
const DYNAMIC_MODEL_PROVIDERS = ['openai-codex', 'copilot-cli', 'smarty-server'] as const;

export function isKnownAIProviderId(providerId: string | null | undefined): providerId is string {
  return typeof providerId === 'string' && ACTIVE_AI_PROVIDER_IDS.has(providerId);
}

export function normalizeDefaultProvider(providerId: string | null | undefined, fallback = 'smarty-server'): string {
  return isKnownAIProviderId(providerId) ? providerId : fallback;
}

export function stripUnknownProviderConfigs<T extends Record<string, any>>(
  providers: T
): T {
  if (!providers || typeof providers !== 'object') {
    return providers;
  }

  let changed = false;
  const sanitized: Record<string, any> = {};

  for (const [providerId, config] of Object.entries(providers)) {
    if (!isKnownAIProviderId(providerId)) {
      changed = true;
      continue;
    }
    sanitized[providerId] = config;
  }

  return (changed ? sanitized : providers) as T;
}

/**
 * Normalizes provider configurations by removing the `models` field from
 * providers that use dynamic model discovery.
 */
export function normalizeCodexProviderConfig<T extends Record<string, any>>(
  providers: T
): T {
  if (!providers || typeof providers !== 'object') {
    return providers;
  }

  let result = providers;
  for (const providerId of DYNAMIC_MODEL_PROVIDERS) {
    const config = result[providerId];
    if (config && typeof config === 'object' && 'models' in config) {
      result = { ...result, [providerId]: omitModelsField(config) } as T;
    }
  }

  return result;
}

/**
 * Remove transient provider status fields that should never be persisted.
 * These fields are UI state for the current renderer session only.
 */
export function stripTransientProviderFields<T extends Record<string, any>>(
  providers: T
): T {
  if (!providers || typeof providers !== 'object') {
    return providers;
  }

  let changed = false;
  const sanitized: Record<string, any> = {};

  for (const [providerId, config] of Object.entries(providers)) {
    if (!config || typeof config !== 'object') {
      sanitized[providerId] = config;
      continue;
    }

    const {
      testStatus: _testStatus,
      testMessage: _testMessage,
      runtimeHealth: _runtimeHealth,
      runtimeHealthCheckedAt: _runtimeHealthCheckedAt,
      runtimeHealthRecovery: _runtimeHealthRecovery,
      runtimeHealthWarnings: _runtimeHealthWarnings,
      ...rest
    } = config as Record<string, any>;

    if (
      'testStatus' in config ||
      'testMessage' in config ||
      'runtimeHealth' in config ||
      'runtimeHealthCheckedAt' in config ||
      'runtimeHealthRecovery' in config ||
      'runtimeHealthWarnings' in config
    ) {
      changed = true;
    }

    sanitized[providerId] = rest;
  }

  return (changed ? sanitized : providers) as T;
}
