/**
 * Trust Indicator
 *
 * Shows workspace trust status in the navigation gutter.
 * Uses Jotai atom family for workspace-scoped state that stays in sync
 * with ProjectPermissionsPanel.
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import {
  workspacePermissionsAtomFamily,
  loadWorkspacePermissions,
} from '../../store/atoms/appSettings';
import { permissionsChangedVersionAtom } from '../../store/atoms/permissions';
import { HelpTooltip } from '../../help';
import { FloatingPortal, useFloatingMenu } from '../../hooks/useFloatingMenu';

export interface TrustStatus {
  trustedAt?: number;
  permissionMode: 'ask' | 'allow-all' | 'bypass-all' | null;
}

interface TrustIndicatorProps {
  workspacePath?: string | null;
  onOpenSettings: () => void;
  onChangeMode?: () => void;
}

const floatingPopoverCardGutters =
  '[--agent-elements-card-block-padding:var(--an-spacing-xs)] [--agent-elements-card-inline-padding:var(--an-spacing-xs)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';

export const TrustIndicator: React.FC<TrustIndicatorProps> = ({
  workspacePath,
  onOpenSettings,
  onChangeMode,
}) => {
  const menu = useFloatingMenu({ placement: 'right-end', offsetPx: 8, constrainHeight: true });

  // Get the atom for this workspace (or a placeholder if no workspace)
  const permissionsAtom = useMemo(
    () => workspacePath ? workspacePermissionsAtomFamily(workspacePath) : null,
    [workspacePath]
  );
  const [permissionsState, setPermissionsState] = useAtom(
    permissionsAtom ?? workspacePermissionsAtomFamily('')
  );

  // Extract trust status from permissions state
  const status: TrustStatus | null = workspacePath
    ? {
        trustedAt: permissionsState.trustedAt,
        permissionMode: permissionsState.permissionMode,
      }
    : null;

  const loading = workspacePath ? permissionsState.loading : false;

  // Fetch trust status
  const fetchStatus = useCallback(async () => {
    if (!workspacePath) return;

    try {
      const state = await loadWorkspacePermissions(workspacePath);
      setPermissionsState(state);
    } catch (error) {
      console.error('[TrustIndicator] Failed to fetch trust status:', error);
    }
  }, [workspacePath, setPermissionsState]);

  // Re-fetch on initial mount and whenever the central permissions listener
  // (store/listeners/permissionListeners.ts) bumps the version counter.
  const permissionsVersion = useAtomValue(permissionsChangedVersionAtom);
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus, permissionsVersion]);

  // Don't render if no workspace
  if (!workspacePath) {
    return null;
  }

  const handleOpenSettings = () => {
    menu.setIsOpen(false);
    onOpenSettings();
  };

  const handleChangeMode = async () => {
    if (!workspacePath) return;

    // Just close the menu and trigger the callback to show the toast
    // Don't revoke trust - that happens only if user picks a new mode
    menu.setIsOpen(false);
    onChangeMode?.();
  };

  const isTrusted = status?.permissionMode !== null && status?.permissionMode !== undefined;

  const getStatusIcon = (): string => {
    if (!status || loading) {
      return 'shield';
    }
    if (isTrusted) {
      if (status.permissionMode === 'bypass-all') return 'warning';
      if (status.permissionMode === 'allow-all') return 'shield';
      return 'verified_user';
    }
    return 'gpp_maybe';
  };

  const getStatusClass = (): string => {
    if (!status || loading) {
      return 'loading';
    }
    if (isTrusted) {
      if (status.permissionMode === 'bypass-all') return 'bypass-all';
      if (status.permissionMode === 'allow-all') return 'allow-all';
      return 'trusted';
    }
    return 'untrusted';
  };

  const getIndicatorColorClass = (): string => {
    const statusClass = getStatusClass();
    switch (statusClass) {
      case 'bypass-all':
        return 'text-[var(--an-warning-color)]';
      case 'loading':
        return 'text-[var(--an-foreground-subtle)]';
      default:
        return 'text-[var(--an-foreground-muted)]';
    }
  };

  const getDotColorClass = (): string => {
    const statusClass = getStatusClass();
    switch (statusClass) {
      case 'untrusted':
        return 'bg-[var(--an-warning-color)]';
      case 'trusted':
        return 'bg-[var(--an-success-color)]';
      case 'allow-all':
        return 'bg-[var(--an-primary-color)]';
      case 'bypass-all':
        return 'bg-[var(--an-diff-removed-text)]';
      case 'loading':
        return 'bg-[var(--an-foreground-subtle)]';
      default:
        return 'bg-[var(--an-foreground-subtle)]';
    }
  };

  const getCurrentModeClasses = (): string => {
    const statusClass = getStatusClass();
    const base = 'mx-2 mb-2 rounded-[var(--an-tool-border-radius)] border bg-[var(--an-tool-background)] p-3';
    switch (statusClass) {
      case 'trusted':
        return `${base} border-[color-mix(in_srgb,var(--an-success-color)_26%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_8%,var(--an-tool-background))]`;
      case 'allow-all':
        return `${base} border-[color-mix(in_srgb,var(--an-primary-color)_26%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_8%,var(--an-tool-background))]`;
      case 'bypass-all':
        return `${base} border-[color-mix(in_srgb,var(--an-diff-removed-text)_26%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-diff-removed-text)_8%,var(--an-tool-background))]`;
      case 'untrusted':
        return `${base} border-[color-mix(in_srgb,var(--an-warning-color)_26%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_8%,var(--an-tool-background))]`;
      default:
        return `${base} border-[var(--an-border-color)]`;
    }
  };

  const getModeValueColorClass = (): string => {
    const statusClass = getStatusClass();
    switch (statusClass) {
      case 'trusted':
        return 'text-[var(--an-success-color)]';
      case 'allow-all':
        return 'text-[var(--an-primary-color)]';
      case 'bypass-all':
        return 'text-[var(--an-diff-removed-text)]';
      case 'untrusted':
        return 'text-[var(--an-warning-color)]';
      default:
        return 'text-[var(--an-foreground)]';
    }
  };

  const getStatusLabel = (): string => {
    if (!status || loading) {
      return 'Loading trust status...';
    }
    if (isTrusted) {
      if (status.permissionMode === 'bypass-all') {
        return 'Allow All mode';
      }
      if (status.permissionMode === 'allow-all') {
        return 'Allow Edits mode';
      }
      return 'Ask mode enabled';
    }
    return 'Workspace not trusted for agent';
  };

  const getStatusDescription = (): string => {
    if (!status || loading) {
      return '';
    }
    if (isTrusted) {
      if (status.permissionMode === 'bypass-all') {
        return 'All operations auto-approved without any prompts.';
      }
      if (status.permissionMode === 'allow-all') {
        return 'File operations auto-approved. Bash and web requests follow Claude Code settings.';
      }
      return 'Agent asks before running commands. Approvals saved to .claude/settings.local.json.';
    }
    return 'Trust this workspace to allow the AI agent to run commands.';
  };

  const statusClass = getStatusClass();
  const permissionMode = status?.permissionMode ?? 'none';

  return (
    <div
      className="trust-indicator-container agent-elements-trust-indicator relative"
      data-testid="agent-elements-trust-indicator"
      data-component="TrustIndicator"
      data-agent-elements-shell="trust-indicator"
      data-trust-status={statusClass}
      data-permission-mode={permissionMode}
    >
      <HelpTooltip testId="gutter-permissions-button" placement="right">
        <button
          ref={menu.refs.setReference as React.RefCallback<HTMLButtonElement>}
          {...menu.getReferenceProps()}
          className={`trust-indicator nav-button agent-elements-trust-indicator-button relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--an-tool-border-radius)] border border-transparent bg-transparent p-0 transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)] ${statusClass} ${getIndicatorColorClass()}`}
          onClick={() => menu.setIsOpen(!menu.isOpen)}
          aria-label={getStatusLabel()}
          aria-expanded={menu.isOpen}
          aria-haspopup="menu"
          data-testid="gutter-permissions-button"
          data-component="TrustIndicatorButton"
          data-agent-elements-shell="trust-indicator-button"
          data-trust-status={statusClass}
          data-permission-mode={permissionMode}
        >
          <MaterialSymbol icon={getStatusIcon()} size={20} />
          <span
            className={`trust-indicator-dot agent-elements-trust-indicator-status-dot absolute bottom-1 right-1 h-2 w-2 rounded-[999px] border-2 border-[var(--an-background)] ${statusClass} ${getDotColorClass()}`}
            data-testid="agent-elements-trust-indicator-status-dot"
            data-agent-elements-shell="trust-indicator-status-dot"
            data-trust-status={statusClass}
          />
        </button>
      </HelpTooltip>

      {menu.isOpen && (
        <FloatingPortal>
          <div
            ref={menu.refs.setFloating as React.RefCallback<HTMLDivElement>}
            style={menu.floatingStyles}
            {...menu.getFloatingProps()}
            className={`trust-menu agent-elements-trust-indicator-menu agent-elements-tool-card z-[1000] min-w-[280px] max-w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-tool-background)] text-[var(--an-foreground)] shadow-[0_16px_48px_color-mix(in_srgb,var(--an-foreground)_12%,transparent)] ${floatingPopoverCardGutters}`}
            role="menu"
            aria-label="Agent permissions"
            data-testid="agent-elements-trust-indicator-menu"
            data-component="TrustIndicatorMenu"
            data-agent-elements-shell="trust-indicator-menu"
            data-agent-elements-card-padding="symmetric-inline"
            data-agent-elements-card-width="floating-popover"
            data-trust-status={statusClass}
            data-permission-mode={permissionMode}
          >
            <div
              className="trust-menu-header agent-elements-trust-indicator-menu-header flex items-center justify-between px-3 pb-2 pt-3"
              data-agent-elements-shell="trust-indicator-menu-header"
            >
              <span className="trust-menu-title text-[13px] font-semibold text-[var(--an-foreground)]">
                Agent Permissions
              </span>
            </div>

            <div
              className={`trust-menu-current-mode agent-elements-trust-indicator-current-mode ${statusClass} ${getCurrentModeClasses()}`}
              data-testid="agent-elements-trust-indicator-current-mode"
              data-agent-elements-shell="trust-indicator-current-mode"
              data-trust-status={statusClass}
              data-permission-mode={permissionMode}
            >
              <div className="trust-menu-current-mode-label mb-1.5 text-[11px] font-medium text-[var(--an-foreground-subtle)]">
                Current mode
              </div>
              <div className={`trust-menu-current-mode-value mb-1 flex items-center gap-2 text-sm font-semibold ${getModeValueColorClass()}`}>
                <MaterialSymbol
                  icon={getStatusIcon()}
                  size={20}
                />
                <span>
                  {isTrusted
                    ? (status?.permissionMode === 'bypass-all' ? 'Allow All' : status?.permissionMode === 'allow-all' ? 'Allow Edits' : 'Ask')
                    : 'Not Trusted'}
                </span>
              </div>
              <div className="trust-menu-current-mode-description select-text text-xs leading-[1.4] text-[var(--an-foreground-muted)]">
                {getStatusDescription()}
              </div>
            </div>

            {status?.trustedAt && (
              <div
                className="trust-menu-date px-3 pb-2 text-[11px] text-[var(--an-foreground-subtle)]"
                data-agent-elements-shell="trust-indicator-trusted-date"
              >
                Trusted {new Date(status.trustedAt).toLocaleDateString()}
              </div>
            )}

            <div className="trust-menu-divider mx-2 my-1 h-px bg-[var(--an-border-color)]" />

            <div className="trust-menu-actions p-1" data-agent-elements-shell="trust-indicator-actions">
              <button
                className="trust-menu-action agent-elements-trust-indicator-action flex w-full cursor-pointer items-center gap-2 rounded-[var(--an-tool-border-radius)] border border-transparent bg-transparent p-2 text-left text-[13px] text-[var(--an-foreground)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                onClick={handleChangeMode}
                role="menuitem"
                data-agent-elements-shell="trust-indicator-action"
              >
                <MaterialSymbol icon="swap_horiz" size={18} className="text-[var(--an-foreground-muted)]" />
                <span>Change permission mode</span>
              </button>
              <button
                className="trust-menu-action agent-elements-trust-indicator-action flex w-full cursor-pointer items-center gap-2 rounded-[var(--an-tool-border-radius)] border border-transparent bg-transparent p-2 text-left text-[13px] text-[var(--an-foreground)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                onClick={handleOpenSettings}
                role="menuitem"
                data-agent-elements-shell="trust-indicator-action"
              >
                <MaterialSymbol icon="settings" size={18} className="text-[var(--an-foreground-muted)]" />
                <span>Permission settings</span>
              </button>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
};
