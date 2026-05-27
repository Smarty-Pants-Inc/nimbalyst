/**
 * Provider Override Wrapper
 *
 * Wraps provider settings panels to enable per-workspace overrides.
 * Uses Jotai atom family for workspace-scoped state.
 */

import React, { ReactNode, useEffect, useMemo } from 'react';
import { useAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { ToggleSwitch } from '../../GlobalSettings/SettingsToggle';
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

const compactCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';
const loadingClass =
  'provider-override-wrapper agent-elements-settings-panel flex h-full w-full flex-col items-center justify-center text-sm text-[var(--an-foreground-muted)]';
const bannerBaseClass =
  `override-banner agent-elements-tool-card flex !flex-row !items-center !justify-between gap-[var(--an-spacing-lg)] border ${compactCardPaddingClass}`;
const bannerOverridingClass =
  'border-[color-mix(in_srgb,var(--an-primary-color)_30%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))]';
const bannerGlobalClass =
  'border-[var(--an-border-color)] bg-[var(--an-background-secondary)]';
const statusBaseClass = 'override-status flex items-center gap-[var(--an-spacing-sm)] text-sm';
const overrideActiveTextClass = 'text-[var(--an-primary-color)]';
const overrideInactiveTextClass = 'text-[var(--an-foreground-muted)]';
const toggleLabelClass = 'toggle-label text-xs font-medium uppercase text-[var(--an-foreground-muted)]';
const hintClass =
  'override-hint border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xl)] py-[var(--an-spacing-lg)] text-center text-xs text-[var(--an-foreground-subtle)]';

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
        className={loadingClass}
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
      className="provider-override-wrapper agent-elements-settings-panel flex h-full w-full flex-col"
      data-agent-elements-shell="provider-override-wrapper"
      data-component="ProviderOverrideWrapper"
      data-provider-id={providerId}
      data-override-active={isOverriding ? 'true' : 'false'}
      data-testid="agent-elements-provider-override-wrapper"
    >
      {/* Override Banner */}
      <div
        className={`${bannerBaseClass} ${isOverriding ? bannerOverridingClass : bannerGlobalClass}`}
        data-agent-elements-shell="provider-override-banner"
        data-state={isOverriding ? 'overriding' : 'global'}
        data-testid="agent-elements-provider-override-banner"
      >
        <div className="override-info flex-1 min-w-0">
          <div
            className={`${statusBaseClass} ${isOverriding ? overrideActiveTextClass : overrideInactiveTextClass}`}
            data-testid="agent-elements-provider-override-status"
          >
            {isOverriding ? (
              <>
                <MaterialSymbol icon="tune" size={16} className="shrink-0" />
                <span>
                  Project override active for{' '}
                  <strong className="font-medium text-[var(--an-primary-color)]">{workspaceName}</strong>
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
        <div
          className="override-toggle agent-elements-provider-override-toggle flex shrink-0 items-center gap-[var(--an-spacing-sm)]"
          data-agent-elements-shell="provider-override-toggle"
          data-provider-id={providerId}
          data-state={isOverriding ? 'overriding' : 'global'}
        >
          <ToggleSwitch
            checked={isOverriding}
            onChange={handleOverrideToggle}
            ariaLabel={`Project override for ${providerName}`}
          />
          <span
            className={`${toggleLabelClass} ${isOverriding ? overrideActiveTextClass : ''}`}
          >
            Override
          </span>
        </div>
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
          className={hintClass}
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
