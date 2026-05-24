import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { usePostHog } from 'posthog-js/react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { permissionsChangedVersionAtom } from '../../store/atoms/permissions';

interface ProjectTrustToastProps {
  workspacePath: string | null;
  onOpenSettings?: () => void;
  /** Force the toast to show (e.g., when user wants to change permission mode) */
  forceShow?: boolean;
  /** Callback when toast is dismissed without making a choice */
  onDismiss?: () => void;
}

type TrustChoice = 'ask' | 'allow-all' | 'bypass-all';

const modeLabels: Record<TrustChoice, string> = {
  ask: 'Ask',
  'allow-all': 'Allow Edits',
  'bypass-all': 'Allow All',
};

const modeDetails: Record<TrustChoice, {
  tone: 'neutral' | 'warning';
  summary: string;
  items: Array<{ icon: string; iconTone: 'primary' | 'warning'; text: React.ReactNode }>;
}> = {
  ask: {
    tone: 'neutral',
    summary:
      'The agent will ask for permission before running commands. When you approve, your choices are saved to .claude/settings.local.json for future sessions.',
    items: [
      {
        icon: 'check',
        iconTone: 'primary',
        text: (
          <>
            <strong className="font-medium text-[var(--an-foreground)]">Approve once</strong> or{' '}
            <strong className="font-medium text-[var(--an-foreground)]">always</strong> for each tool pattern
          </>
        ),
      },
      {
        icon: 'check',
        iconTone: 'primary',
        text: (
          <>
            <strong className="font-medium text-[var(--an-foreground)]">Fine-grained control</strong> - allow
            "npm test" but block "rm -rf"
          </>
        ),
      },
      {
        icon: 'check',
        iconTone: 'primary',
        text: (
          <>
            <strong className="font-medium text-[var(--an-foreground)]">Permissions shared</strong> with Claude
            Code CLI in this project
          </>
        ),
      },
    ],
  },
  'allow-all': {
    tone: 'warning',
    summary: 'The agent will run all file and edit operations without asking. Shell commands and web requests may still require approval.',
    items: [
      { icon: 'warning', iconTone: 'warning', text: 'All file read/write/edit operations are automatically approved' },
      { icon: 'warning', iconTone: 'warning', text: "Bash commands and web fetches follow Claude Code's settings" },
      { icon: 'warning', iconTone: 'warning', text: 'Only use with projects you fully trust' },
    ],
  },
  'bypass-all': {
    tone: 'warning',
    summary:
      'The agent will run all operations without permission prompts, including shell commands, file operations, and web requests.',
    items: [
      { icon: 'warning', iconTone: 'warning', text: 'All tool calls are automatically approved' },
      { icon: 'warning', iconTone: 'warning', text: 'Uses Nimbalyst permissions instead of Claude Code settings' },
      { icon: 'warning', iconTone: 'warning', text: 'Best for development and testing workflows' },
    ],
  },
};

const secondaryButtonClass =
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-transparent px-3 py-1.5 text-sm font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-50';

const primaryButtonClass =
  'inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border border-[var(--an-send-button-bg)] bg-[var(--an-send-button-bg)] px-4 py-2 text-sm font-medium text-[var(--an-send-button-color)] transition-[background-color,border-color,color,opacity] duration-150 ease-out hover:bg-[var(--nim-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-70';

/**
 * One-time toast that appears when an untrusted project is opened.
 * The user must choose a permission mode before the agent can operate.
 */
export const ProjectTrustToast: React.FC<ProjectTrustToastProps> = ({
  workspacePath,
  onOpenSettings,
  forceShow = false,
  onDismiss,
}) => {
  const posthog = usePostHog();
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChangingMode, setIsChangingMode] = useState(false);
  const [selectedMode, setSelectedMode] = useState<TrustChoice>('allow-all');
  const toastRef = useRef<HTMLDivElement>(null);
  const justSavedRef = useRef(false);
  const permissionChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectName = workspacePath?.split(/[\\/]/).pop() || 'this project';

  const releasePermissionChangeSuppression = useCallback(() => {
    if (permissionChangeTimeoutRef.current) {
      clearTimeout(permissionChangeTimeoutRef.current);
      permissionChangeTimeoutRef.current = null;
    }
    justSavedRef.current = false;
  }, [permissionChangeTimeoutRef, justSavedRef]);

  const suppressPermissionChangeEvents = useCallback(() => {
    releasePermissionChangeSuppression();
    justSavedRef.current = true;
    permissionChangeTimeoutRef.current = setTimeout(() => {
      justSavedRef.current = false;
      permissionChangeTimeoutRef.current = null;
    }, 500);
  }, [permissionChangeTimeoutRef, releasePermissionChangeSuppression, justSavedRef]);

  useEffect(() => {
    return () => {
      releasePermissionChangeSuppression();
    };
  }, [releasePermissionChangeSuppression]);

  // Handle forceShow prop - show toast when parent wants to change mode
  useEffect(() => {
    if (forceShow && workspacePath) {
      setIsChangingMode(true);
      setIsVisible(true);
      // Fetch current permission mode to pre-select it
      window.electronAPI.invoke('permissions:getWorkspacePermissions', workspacePath)
        .then((status) => {
          if (status.permissionMode) {
            setSelectedMode(status.permissionMode as TrustChoice);
          }
        })
        .catch((error) => {
          console.error('[ProjectTrustToast] Failed to fetch current permission mode:', error);
        });
    }
  }, [forceShow, workspacePath]);

  // Check trust status when workspace changes
  useEffect(() => {
    if (!workspacePath) {
      setIsVisible(false);
      return;
    }

    const checkTrustStatus = async () => {
      try {
        const status = await window.electronAPI.invoke('permissions:getWorkspacePermissions', workspacePath);
        console.log('[ProjectTrustToast] Trust status for', workspacePath, ':', status);
        // Show toast if workspace is not trusted yet (but not if we're in change mode)
        // Trusted = permissionMode is not null
        if (status.permissionMode === null && !isChangingMode) {
          setIsVisible(true);
        }
      } catch (error) {
        console.error('[ProjectTrustToast] Failed to check trust status:', error);
      }
    };

    checkTrustStatus();
  }, [workspacePath, isChangingMode]);

  // React to external trust changes (settings, TrustIndicator) by depending on
  // permissionsChangedVersionAtom (incremented by store/listeners/permissionListeners.ts).
  // Skip the initial mount value -- the prior useEffect handles initial fetch.
  const permissionsVersion = useAtomValue(permissionsChangedVersionAtom);
  const initialPermissionsVersionRef = useRef(permissionsVersion);
  useEffect(() => {
    if (permissionsVersion === initialPermissionsVersionRef.current) {
      return;
    }
    if (!workspacePath) return;
    if (justSavedRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        const status = await window.electronAPI.invoke('permissions:getWorkspacePermissions', workspacePath);
        if (cancelled) return;
        setIsVisible(status.permissionMode === null);
      } catch (error) {
        console.error('[ProjectTrustToast] Failed to check trust status on change:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permissionsVersion, workspacePath]);

  // Handle dismissing the toast without making a choice
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setIsChangingMode(false);
    onDismiss?.();
  }, [onDismiss]);

  // Handle escape key to dismiss without changing settings
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, handleDismiss]);


  const handleSave = useCallback(async () => {
    if (!workspacePath || isSubmitting) return;

    setIsSubmitting(true);
    // Temporarily ignore permission change broadcasts triggered by this save
    suppressPermissionChangeEvents();

    try {
      // Set the permission mode directly - this also trusts the workspace
      // (any non-null mode means trusted)
      await window.electronAPI.invoke('permissions:setPermissionMode', workspacePath, selectedMode);

      // Track trust dialog completion
      posthog?.capture('trust_dialog_saved', {
        permissionMode: selectedMode,
        isChangingMode,
      });

      setIsVisible(false);
      setIsChangingMode(false);
      // Reset parent's forceShow state
      onDismiss?.();
    } catch (error) {
      console.error('[ProjectTrustToast] Failed to set trust:', error);
      // Allow future permission change events if this attempt failed
      releasePermissionChangeSuppression();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    workspacePath,
    isSubmitting,
    selectedMode,
    onDismiss,
    posthog,
    isChangingMode,
    suppressPermissionChangeEvents,
    releasePermissionChangeSuppression,
  ]);

  const handleDontTrust = useCallback(async () => {
    if (!workspacePath || isSubmitting) return;

    const confirmed = window.confirm(
      `Stop trusting "${projectName}"?\n\nThe AI agent won't run any tools in this workspace until you trust it again.`
    );
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    suppressPermissionChangeEvents();
    setIsVisible(false);
    setIsChangingMode(false);
    onDismiss?.();

    try {
      await window.electronAPI.invoke('permissions:revokeWorkspaceTrust', workspacePath);
      posthog?.capture('permission_setting_changed', { action: 'revoke_trust', source: 'trust_toast' });
    } catch (error) {
      console.error('[ProjectTrustToast] Failed to revoke trust:', error);
      releasePermissionChangeSuppression();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    workspacePath,
    isSubmitting,
    projectName,
    suppressPermissionChangeEvents,
    onDismiss,
    posthog,
    releasePermissionChangeSuppression,
  ]);

  const handleOpenSettings = useCallback(() => {
    setIsVisible(false);
    setIsChangingMode(false);
    onDismiss?.();
    onOpenSettings?.();
  }, [onOpenSettings, onDismiss]);

  if (!isVisible || !workspacePath) {
    return null;
  }

  const selectedDetails = modeDetails[selectedMode];

  return (
    <div
      className="project-trust-toast-overlay nim-overlay agent-elements-project-trust-toast-backdrop"
      data-testid="agent-elements-project-trust-toast-backdrop"
      data-agent-elements-shell="project-trust-toast-backdrop"
    >
      <div
        className="project-trust-toast agent-elements-project-trust-toast agent-elements-tool-card w-[calc(100%-32px)] max-w-[540px] overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-xxl)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--nim-text)_18%,transparent)] [container-type:inline-size]"
        data-testid="agent-elements-project-trust-toast"
        data-component="ProjectTrustToast"
        data-agent-elements-shell="project-trust-toast"
        data-permission-mode={selectedMode}
        ref={toastRef}
      >
        <div
          className="project-trust-toast-header agent-elements-project-trust-toast-header mb-[var(--an-spacing-xl)] flex items-start gap-[var(--an-spacing-lg)]"
          data-testid="agent-elements-project-trust-toast-header"
          data-agent-elements-shell="project-trust-toast-header"
        >
          <span
            className="project-trust-toast-icon agent-elements-project-trust-toast-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-primary-color)_30%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] text-[var(--an-primary-color)]"
            aria-hidden="true"
          >
            <MaterialSymbol icon="verified_user" size={22} />
          </span>
          <div className="project-trust-toast-header-text min-w-0 flex-1">
            <h2
              className="project-trust-toast-title m-0 mb-1 text-base font-semibold leading-tight text-[var(--an-foreground)]"
            >
              Trust "{projectName}"?
            </h2>
            <p
              className="project-trust-toast-subtitle m-0 text-sm leading-normal text-[var(--an-foreground-muted)]"
            >
              This project wants to use the AI agent
            </p>
          </div>
          <button
            className={`project-trust-toast-dont-trust ${secondaryButtonClass} shrink-0`}
            onClick={handleDontTrust}
            disabled={isSubmitting}
          >
            <MaterialSymbol icon="gpp_maybe" size={15} />
            Don't Trust
          </button>
        </div>

        <div
          className="project-trust-toast-warning agent-elements-project-trust-toast-warning mb-[var(--an-spacing-xl)] flex items-start gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--nim-warning)_30%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-warning)_9%,var(--an-background))] p-[var(--an-spacing-lg)] text-[13px] leading-relaxed text-[var(--an-foreground-muted)]"
          data-testid="agent-elements-project-trust-toast-warning"
          data-agent-elements-shell="project-trust-toast-warning"
          data-tone="warning"
        >
          <MaterialSymbol icon="warning" size={16} className="mt-0.5 shrink-0 text-[var(--nim-warning)]" />
          <span className="select-text">
            Untrusted projects can contain malicious code. Only trust projects from sources you know.
          </span>
        </div>

        <p
          className="project-trust-toast-description m-0 mb-[var(--an-spacing-md)] text-sm leading-normal text-[var(--an-foreground-muted)]"
        >
          Choose how the agent handles tool calls in this project:
        </p>

        <div
          className="project-trust-toast-mode-toggle agent-elements-project-trust-toast-mode-toggle mb-[var(--an-spacing-xl)] grid grid-cols-3 gap-[var(--an-spacing-sm)]"
          data-testid="agent-elements-project-trust-toast-mode-toggle"
          data-agent-elements-shell="project-trust-toast-mode-toggle"
        >
          {(['ask', 'allow-all', 'bypass-all'] as TrustChoice[]).map((mode) => {
            const isSelected = selectedMode === mode;

            return (
              <button
                key={mode}
                className={`project-trust-toast-mode-btn agent-elements-project-trust-toast-mode-option grid min-h-16 cursor-pointer grid-rows-[1fr_auto] items-center justify-items-center rounded-[var(--an-tool-border-radius)] border px-[var(--an-spacing-md)] pb-[var(--an-spacing-sm)] pt-[var(--an-spacing-md)] text-center transition-[background-color,border-color,box-shadow,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelected
                    ? 'project-trust-toast-mode-btn--selected border-[var(--an-primary-color)] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--an-primary-color)_24%,transparent)]'
                    : 'border-[var(--an-border-color)] bg-[var(--an-background-secondary)] hover:bg-[var(--an-background-tertiary)]'
                }`}
                data-testid={`agent-elements-project-trust-toast-mode-option-${mode}`}
                data-agent-elements-shell="project-trust-toast-mode-option"
                data-mode={mode}
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => setSelectedMode(mode)}
                disabled={isSubmitting}
              >
                <span className="project-trust-toast-mode-label text-sm font-semibold text-[var(--an-foreground)]">
                  {modeLabels[mode]}
                </span>
                {mode === 'allow-all' ? (
                  <span className="project-trust-toast-mode-badge row-start-2 whitespace-nowrap rounded-[var(--an-input-border-radius)] border border-[color-mix(in_srgb,var(--an-primary-color)_22%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] px-2 py-0.5 text-[11px] font-medium text-[var(--an-primary-color)]">
                    Recommended
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div
          className="project-trust-toast-mode-details agent-elements-project-trust-toast-mode-details mb-[var(--an-spacing-xl)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-project-trust-toast-mode-details"
          data-agent-elements-shell="project-trust-toast-mode-details"
          data-selected-mode={selectedMode}
          data-tone={selectedDetails.tone}
        >
          <p
            className={`project-trust-toast-mode-summary m-0 mb-[var(--an-spacing-lg)] text-[13px] leading-normal select-text ${
              selectedDetails.tone === 'warning'
                ? 'text-[var(--nim-warning)]'
                : 'text-[var(--an-foreground-muted)]'
            }`}
          >
            {selectedDetails.summary}
          </p>
          <ul className="project-trust-toast-features-list m-0 flex list-none flex-col gap-[var(--an-spacing-sm)] p-0">
            {selectedDetails.items.map((item, index) => (
              <li
                key={`${selectedMode}-${index}`}
                className="project-trust-toast-feature flex items-start gap-[var(--an-spacing-sm)] text-[13px] leading-relaxed text-[var(--an-foreground-muted)]"
              >
                <MaterialSymbol
                  icon={item.icon}
                  size={14}
                  className={`mt-0.5 shrink-0 ${
                    item.iconTone === 'warning'
                      ? 'text-[var(--nim-warning)]'
                      : 'text-[var(--an-primary-color)]'
                  }`}
                />
                <span className="select-text">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="project-trust-toast-footer agent-elements-project-trust-toast-footer flex items-center justify-between gap-[var(--an-spacing-md)]"
          data-testid="agent-elements-project-trust-toast-footer"
          data-agent-elements-shell="project-trust-toast-footer"
        >
          <button
            className="project-trust-toast-settings-link inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent px-2 py-1 text-[13px] font-medium text-[var(--an-foreground-subtle)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            onClick={handleOpenSettings}
          >
            <MaterialSymbol icon="tune" size={14} />
            Advanced settings
          </button>
          <div className="project-trust-toast-actions flex gap-2">
            <button
              className={`project-trust-toast-cancel ${secondaryButtonClass} min-w-[74px]`}
              onClick={handleDismiss}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className={`project-trust-toast-save ${primaryButtonClass} min-w-[74px]`}
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
