/**
 * Provider Override Wrapper
 *
 * Wraps provider settings panels to enable per-workspace overrides.
 * Uses Jotai atom family for workspace-scoped state.
 */

import React, { ReactNode, useEffect, useMemo } from 'react';
import { useAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import {
  workspaceAISettingsAtomFamily,
  loadWorkspaceAISettings,
  saveWorkspaceAISettings,
  type AIProviderOverrides,
} from '../../../store/atoms/appSettings';

interface ProviderOverrideWrapperProps {
  providerId: string;
  providerName: string;
  workspacePath: string;
  workspaceName: string;
  globalEnabled: boolean;
  children: ReactNode;
  /** Callback when override state changes - parent should reload/update */
  onOverrideChange?: () => void;
}

export function ProviderOverrideWrapper({
  providerId,
  providerName,
  workspacePath,
  workspaceName,
  globalEnabled,
  children,
  onOverrideChange,
}: ProviderOverrideWrapperProps) {
  // Get the atom for this workspace
  const settingsAtom = useMemo(
    () => workspaceAISettingsAtomFamily(workspacePath),
    [workspacePath]
  );
  const [settings, setSettings] = useAtom(settingsAtom);

  // Load settings on mount or workspace change
  useEffect(() => {
    let mounted = true;
    loadWorkspaceAISettings(workspacePath).then((state) => {
      if (mounted) {
        setSettings(state);
      }
    });
    return () => {
      mounted = false;
    };
  }, [workspacePath, setSettings]);

  const { overrides, loading } = settings;
  const isOverriding = overrides.providers?.[providerId] !== undefined;

  const handleOverrideToggle = async (override: boolean) => {
    const newOverrides: AIProviderOverrides = { ...overrides };
    if (!newOverrides.providers) {
      newOverrides.providers = {};
    }

    if (override) {
      // Initialize override - copy global enabled state
      newOverrides.providers[providerId] = {
        enabled: globalEnabled,
      };
    } else {
      // Remove override
      delete newOverrides.providers[providerId];
      if (Object.keys(newOverrides.providers).length === 0) {
        delete newOverrides.providers;
      }
    }

    // Update atom state
    setSettings({ ...settings, overrides: newOverrides });

    // Persist to IPC
    try {
      await saveWorkspaceAISettings(workspacePath, newOverrides);
      onOverrideChange?.();
    } catch (error) {
      console.error('Failed to save project overrides:', error);
    }
  };

  if (loading) {
    return (
      <div
        className="provider-override-wrapper agent-elements-settings-panel flex flex-col h-full items-center justify-center text-[var(--nim-text-muted)]"
        data-agent-elements-shell="provider-override-wrapper"
        data-component="ProviderOverrideWrapper"
        data-provider-id={providerId}
        data-override-active="loading"
        data-testid="agent-elements-provider-override-wrapper"
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      className="provider-override-wrapper agent-elements-settings-panel flex flex-col h-full"
      data-agent-elements-shell="provider-override-wrapper"
      data-component="ProviderOverrideWrapper"
      data-provider-id={providerId}
      data-override-active={isOverriding ? 'true' : 'false'}
      data-testid="agent-elements-provider-override-wrapper"
    >
      {/* Override Banner */}
      <div
        className={`override-banner agent-elements-tool-card flex !flex-row !items-center !justify-between !gap-4 !px-4 !py-3 border-b ${
          isOverriding
            ? 'bg-[var(--nim-accent-subtle)] border-[var(--nim-accent-subtle)]'
            : 'bg-[var(--nim-bg-secondary)] border-[var(--nim-border)]'
        }`}
        data-agent-elements-shell="provider-override-banner"
        data-state={isOverriding ? 'overriding' : 'global'}
        data-testid="agent-elements-provider-override-banner"
      >
        <div className="override-info flex-1 min-w-0">
          <div
            className={`override-status flex items-center gap-2 text-[13px] ${
              isOverriding ? 'text-[var(--nim-primary)]' : 'text-[var(--nim-text-muted)]'
            }`}
            data-testid="agent-elements-provider-override-status"
          >
            {isOverriding ? (
              <>
                <MaterialSymbol icon="tune" size={16} className="shrink-0" />
                <span>
                  Project override active for{' '}
                  <strong className="font-medium text-[var(--nim-primary)]">{workspaceName}</strong>
                </span>
              </>
            ) : (
              <>
                <MaterialSymbol icon="info" size={16} className="shrink-0" />
                <span>
                  Using global {providerName} settings
                </span>
              </>
            )}
          </div>
        </div>
        <label
          className="override-toggle agent-elements-provider-override-toggle flex items-center gap-2 cursor-pointer shrink-0"
          data-agent-elements-shell="provider-override-toggle"
          data-provider-id={providerId}
          data-state={isOverriding ? 'overriding' : 'global'}
        >
          <input
            type="checkbox"
            checked={isOverriding}
            onChange={(e) => handleOverrideToggle(e.target.checked)}
            className="hidden peer"
            aria-label={`Project override for ${providerName}`}
          />
          <span
            className={`toggle-slider relative w-9 h-5 rounded-[10px] transition-colors duration-200 ${
              isOverriding ? 'bg-[var(--nim-primary)]' : 'bg-[var(--nim-bg-tertiary)]'
            } before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:duration-200 before:shadow-[0_1px_3px_rgba(0,0,0,0.2)] ${
              isOverriding ? 'before:translate-x-4' : ''
            }`}
          ></span>
          <span
            className={`toggle-label text-xs font-medium uppercase tracking-[0.03em] ${
              isOverriding ? 'text-[var(--nim-primary)]' : 'text-[var(--nim-text-muted)]'
            }`}
          >
            Override
          </span>
        </label>
      </div>

      {/* Provider Panel Content */}
      <div
        className="override-content flex-1 overflow-y-auto"
        data-agent-elements-shell="provider-override-content"
        data-testid="agent-elements-provider-override-content"
      >
        {children}
      </div>

      {!isOverriding && (
        <div
          className="override-hint px-4 py-3 text-xs text-center text-[var(--nim-text-faint)] bg-[var(--nim-bg-secondary)] border-t border-[var(--nim-border)]"
          data-agent-elements-shell="provider-override-hint"
          data-testid="agent-elements-provider-override-hint"
        >
          Enable override to customize {providerName} settings for this project only.
          Changes will not affect your global settings.
        </div>
      )}
    </div>
  );
}
