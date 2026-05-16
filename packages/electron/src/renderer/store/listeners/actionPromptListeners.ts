/**
 * Central listener for `action-prompts:changed` broadcasts.
 *
 * The main process emits this event when ai-actions.md changes on disk for a
 * given workspace. We dispatch the new list into the per-workspace atom so the
 * composer dropdown picks it up.
 */

import { store } from '@nimbalyst/runtime/store';
import {
  actionPromptsAtomFamily,
  type ActionPromptListState,
  type ActionPrompt,
  type ActionPromptParseDiagnostic,
} from '../atoms/actionPrompts';

interface ChangedPayload {
  workspacePath?: string;
  actions?: ActionPrompt[];
  diagnostics?: ActionPromptParseDiagnostic[];
  filePath?: string;
  fileExists?: boolean;
}

let initialized = false;

export function initActionPromptListeners(): () => void {
  if (initialized) {
    return () => {};
  }
  initialized = true;

  const cleanups: Array<() => void> = [];

  const unsubscribe = window.electronAPI?.on?.('action-prompts:changed', (data: ChangedPayload) => {
    if (!data?.workspacePath) return;
    const next: ActionPromptListState = {
      actions: data.actions ?? [],
      diagnostics: data.diagnostics ?? [],
      filePath: data.filePath ?? null,
      fileExists: data.fileExists ?? false,
      loaded: true,
    };
    store.set(actionPromptsAtomFamily(data.workspacePath), next);
  });
  if (typeof unsubscribe === 'function') cleanups.push(unsubscribe);

  return () => {
    initialized = false;
    cleanups.forEach((c) => c());
  };
}
