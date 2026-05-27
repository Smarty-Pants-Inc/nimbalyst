/**
 * Project Permissions Panel
 *
 * Manages agent permissions for a workspace including trust status,
 * permission mode, allowed patterns, directories, and URL patterns.
 *
 * Uses Jotai atom family for workspace-scoped state that stays in sync
 * with TrustIndicator and other consumers.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { usePostHog } from 'posthog-js/react';
import {
  workspacePermissionsAtomFamily,
  loadWorkspacePermissions,
  type PermissionMode,
} from '../../../store/atoms/appSettings';

interface ProjectPermissionsPanelProps {
  workspacePath: string;
  workspaceName: string;
}

const cardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';
const compactCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-sm)] [--agent-elements-card-inline-padding:var(--an-spacing-md)]';
const roomyCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)]';
const panelClassName =
  'settings-panel-content project-permissions-panel agent-elements-settings-panel flex h-full w-full flex-col gap-[var(--an-spacing-xl)] p-[var(--an-spacing-xxl)] text-[var(--an-foreground)]';
const panelHeaderClassName =
  'settings-panel-header agent-elements-settings-panel-header border-b border-[var(--an-border-color)] pb-[var(--an-spacing-xl)]';
const panelTitleClassName =
  'm-0 mb-[var(--an-spacing-sm)] text-xl font-semibold leading-tight text-[var(--an-foreground)]';
const panelDescriptionClassName =
  'm-0 text-sm leading-relaxed text-[var(--an-foreground-muted)]';
const inlineCodeClassName =
  'rounded-[var(--an-radius-xs)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xs)] py-[var(--an-spacing-xxs)] text-xs text-[var(--an-code-color)]';
const emptyStateClassName =
  `settings-panel-empty agent-elements-empty-state agent-elements-tool-card border-dashed text-center text-sm leading-relaxed text-[var(--an-foreground-muted)] ${roomyCardPaddingClass}`;
const loadingStateClassName =
  `settings-panel-loading agent-elements-loading-state agent-elements-tool-card border-dashed text-center text-sm leading-relaxed text-[var(--an-foreground-muted)] ${roomyCardPaddingClass}`;
const sectionClassName =
  'permissions-section agent-elements-settings-section flex flex-col gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)] pb-[var(--an-spacing-xl)] last:border-b-0 last:pb-0';
const sectionHeaderClassName =
  'permissions-section-header flex items-center gap-[var(--an-spacing-sm)] text-sm font-medium text-[var(--an-foreground)]';
const sectionDescriptionClassName =
  'permissions-section-description m-0 text-xs leading-relaxed text-[var(--an-foreground-muted)]';
const countPillClassName =
  'permissions-section-count rounded-[var(--an-radius-xs)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xs)] py-[var(--an-spacing-xxs)] text-xs text-[var(--an-foreground-muted)]';
const secondaryButtonClassName =
  'btn-secondary inline-flex cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] rounded-[var(--an-radius-sm)] border border-[var(--an-border-color)] bg-transparent px-[var(--an-spacing-md)] py-[var(--an-spacing-xs)] text-xs font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color,opacity] duration-150 ease-out hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClassName =
  'btn-primary inline-flex cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] rounded-[var(--an-radius-sm)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-[var(--an-spacing-md)] py-[var(--an-spacing-xs)] text-xs font-medium text-[var(--an-send-button-color)] transition-[background-color,border-color,opacity] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))] disabled:cursor-not-allowed disabled:opacity-50';
const removeButtonClassName =
  'flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--an-radius-xs)] border-none bg-transparent text-[var(--an-foreground-muted)] transition-[background-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-error-color)]';
const rowClassName =
  'agent-elements-permission-row flex items-center justify-between gap-[var(--an-spacing-md)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--agent-elements-card-inline-padding,var(--an-spacing-md))] py-[var(--agent-elements-card-block-padding,var(--an-spacing-sm))] text-left';
const listEmptyClassName =
  `permissions-empty-state agent-elements-empty-state rounded-[var(--an-tool-border-radius)] border border-dashed border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-xs leading-relaxed text-[var(--an-foreground-muted)] ${compactCardPaddingClass}`;
const inputClassName =
  'permissions-url-input agent-elements-input rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-sm text-[var(--an-input-color)] outline-none transition-[background-color,border-color,color] duration-150 ease-out placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-border)] focus:ring-2 focus:ring-[var(--an-focus-ring)]';

const getPermissionModeOptionClassName = (isActive: boolean) => (
  `permissions-mode-option agent-elements-permission-mode-option agent-elements-tool-card flex-row cursor-pointer items-start ${compactCardPaddingClass} transition-[background-color,border-color,color] duration-150 ease-out ${
    isActive
      ? 'border-[var(--an-primary-color)] bg-[color-mix(in_srgb,var(--an-primary-color)_8%,var(--an-background))]'
      : 'border-[var(--an-border-color)] bg-[var(--an-background-secondary)] hover:bg-[var(--an-background-tertiary)]'
  }`
);

export const ProjectPermissionsPanel: React.FC<ProjectPermissionsPanelProps> = ({
  workspacePath,
  workspaceName,
}) => {
  const posthog = usePostHog();

  // Get the atom for this workspace
  const permissionsAtom = useMemo(
    () => workspacePermissionsAtomFamily(workspacePath),
    [workspacePath]
  );
  const [permissionsState, setPermissionsState] = useAtom(permissionsAtom);

  // Local UI state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAddingDirectory, setIsAddingDirectory] = useState(false);
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [newUrlPattern, setNewUrlPattern] = useState('');
  const [newUrlDescription, setNewUrlDescription] = useState('');

  // Extract permissions from state
  const { loading, error: loadError } = permissionsState;
  const permissions = permissionsState;

  // Load permissions on mount or workspace change
  const loadPermissions = useCallback(async () => {
    if (!workspacePath) return;
    setError(null);
    const state = await loadWorkspacePermissions(workspacePath);
    setPermissionsState(state);
    if (state.error) {
      setError(state.error);
    }
  }, [workspacePath, setPermissionsState]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Track screen open
  useEffect(() => {
    if (!loading && permissions.permissionMode !== undefined) {
      posthog?.capture('agent_permissions_opened', {
        isTrusted: permissions.permissionMode !== null,
        permissionMode: permissions.permissionMode,
        allowedPatternsCount: permissions.allowedPatterns.length,
        additionalDirectoriesCount: permissions.additionalDirectories.length,
      });
    }
  }, [permissions, loading, posthog]);

  const handleTrustWorkspace = async () => {
    try {
      await window.electronAPI.invoke('permissions:trustWorkspace', workspacePath);
      await loadPermissions();
      setSuccess('Workspace trusted for agent operations');
      posthog?.capture('permission_setting_changed', { action: 'trust_workspace' });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to trust workspace:', err);
      setError(err instanceof Error ? err.message : 'Failed to trust workspace');
    }
  };

  const handleRevokeWorkspaceTrust = async () => {
    try {
      await window.electronAPI.invoke('permissions:revokeWorkspaceTrust', workspacePath);
      await loadPermissions();
      setSuccess('Workspace trust revoked');
      posthog?.capture('permission_setting_changed', { action: 'revoke_trust' });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to revoke workspace trust:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke workspace trust');
    }
  };

  const handlePermissionModeChange = async (mode: PermissionMode) => {
    try {
      await window.electronAPI.invoke('permissions:setPermissionMode', workspacePath, mode);
      await loadPermissions();
      posthog?.capture('permission_setting_changed', { action: 'change_mode', mode });
    } catch (err) {
      console.error('Failed to set permission mode:', err);
      setError(err instanceof Error ? err.message : 'Failed to set permission mode');
    }
  };

  const handleRemovePattern = async (pattern: string, type: 'allowed' | 'denied') => {
    try {
      await window.electronAPI.invoke('permissions:removePattern', workspacePath, pattern);
      await loadPermissions();
      setSuccess(`Pattern removed`);
      posthog?.capture('permission_setting_changed', { action: 'remove_pattern' });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to remove pattern:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove pattern');
    }
  };

  const handleResetToDefaults = async () => {
    try {
      await window.electronAPI.invoke('permissions:resetToDefaults', workspacePath);
      await loadPermissions();
      setSuccess('Permissions reset to defaults');
      posthog?.capture('permission_setting_changed', { action: 'reset_to_defaults' });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to reset permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset permissions');
    }
  };

  const handleAddDirectory = async () => {
    setIsAddingDirectory(true);
    try {
      // Use Electron's dialog to select a directory
      const result = await window.electronAPI.invoke('dialog:openDirectory', {
        title: 'Select Additional Directory',
        buttonLabel: 'Add Directory',
      });

      if (result && result.filePaths && result.filePaths.length > 0) {
        const dirPath = result.filePaths[0];
        await window.electronAPI.invoke('permissions:addAdditionalDirectory', workspacePath, dirPath, false);
        await loadPermissions();
        setSuccess('Directory added');
        posthog?.capture('permission_setting_changed', { action: 'add_directory' });
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Failed to add directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to add directory');
    } finally {
      setIsAddingDirectory(false);
    }
  };

  const handleRemoveDirectory = async (dirPath: string) => {
    try {
      await window.electronAPI.invoke('permissions:removeAdditionalDirectory', workspacePath, dirPath);
      await loadPermissions();
      setSuccess('Directory removed');
      posthog?.capture('permission_setting_changed', { action: 'remove_directory' });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to remove directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove directory');
    }
  };

  const handleAddUrlPattern = async () => {
    if (!newUrlPattern.trim()) return;

    try {
      await window.electronAPI.invoke(
        'permissions:addAllowedUrlPattern',
        workspacePath,
        newUrlPattern.trim(),
        newUrlDescription.trim()
      );
      await loadPermissions();
      setNewUrlPattern('');
      setNewUrlDescription('');
      setIsAddingUrl(false);
      setSuccess('URL pattern added');
      posthog?.capture('permission_setting_changed', { action: 'add_url_pattern' });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to add URL pattern:', err);
      setError(err instanceof Error ? err.message : 'Failed to add URL pattern');
    }
  };

  const handleRemoveUrlPattern = async (pattern: string) => {
    try {
      await window.electronAPI.invoke('permissions:removeAllowedUrlPattern', workspacePath, pattern);
      await loadPermissions();
      setSuccess('URL pattern removed');
      posthog?.capture('permission_setting_changed', { action: 'remove_url_pattern' });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to remove URL pattern:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove URL pattern');
    }
  };

  const handleAllowAllDomains = async () => {
    try {
      await window.electronAPI.invoke('permissions:allowAllUrls', workspacePath);
      await loadPermissions();
      setSuccess('All domains are now allowed');
      posthog?.capture('permission_setting_changed', { action: 'allow_all_domains' });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to allow all domains:', err);
      setError(err instanceof Error ? err.message : 'Failed to allow all domains');
    }
  };

  const handleRevokeAllDomains = async () => {
    try {
      await window.electronAPI.invoke('permissions:revokeAllUrlsPermission', workspacePath);
      await loadPermissions();
      setSuccess('All domains permission revoked');
      posthog?.capture('permission_setting_changed', { action: 'revoke_all_domains' });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to revoke all domains permission:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke all domains permission');
    }
  };

  // Check if "all domains" wildcard is enabled (pattern is '*' which maps to 'WebFetch')
  const isAllDomainsAllowed = permissions?.allowedUrlPatterns?.some(p => p.pattern === 'WebFetch') ?? false;

  if (!workspacePath) {
    return (
      <div
        className={panelClassName}
        data-agent-elements-shell="project-permissions-panel"
        data-component="ProjectPermissionsPanel"
        data-testid="agent-elements-project-permissions-panel"
        data-workspace-bound="false"
      >
        <div
          className={emptyStateClassName}
          data-agent-elements-shell="project-permissions-empty-state"
        >
          <p>Open a workspace to configure agent permissions.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={panelClassName}
        data-agent-elements-shell="project-permissions-panel"
        data-component="ProjectPermissionsPanel"
        data-testid="agent-elements-project-permissions-panel"
        data-workspace-bound="true"
      >
        <div
          className={loadingStateClassName}
          data-agent-elements-shell="project-permissions-loading"
        >
          Loading permissions...
        </div>
      </div>
    );
  }

  return (
    <div
      className={panelClassName}
      data-agent-elements-shell="project-permissions-panel"
      data-component="ProjectPermissionsPanel"
      data-source="packages/electron/src/renderer/components/Settings/panels/ProjectPermissionsPanel.tsx"
      data-testid="agent-elements-project-permissions-panel"
      data-workspace-bound="true"
      data-workspace-name={workspaceName}
    >
      <div
        className={panelHeaderClassName}
        data-agent-elements-shell="project-permissions-header"
        data-testid="agent-elements-project-permissions-header"
      >
        <h2 className={panelTitleClassName}>Agent Permissions</h2>
        <p className={panelDescriptionClassName}>
          Manage which commands the AI agent can run in this project.
          Approved patterns are saved to <code className={inlineCodeClassName}>.claude/settings.local.json</code> and shared with Claude Code CLI.
        </p>
      </div>

      {(error || loadError) && (
        <div
          className={`settings-message error agent-elements-status-card agent-elements-tool-card flex-row items-center border-[color-mix(in_srgb,var(--an-error-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-error-color)_10%,var(--an-background))] text-sm text-[var(--an-error-color)] ${compactCardPaddingClass}`}
          data-agent-elements-shell="project-permissions-message"
          data-tone="error"
        >
          <span className="material-symbols-outlined">error</span>
          <span>{error || loadError}</span>
        </div>
      )}

      {success && (
        <div
          className={`settings-message success agent-elements-status-card agent-elements-tool-card flex-row items-center border-[color-mix(in_srgb,var(--an-success-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_10%,var(--an-background))] text-sm text-[var(--an-success-color)] ${compactCardPaddingClass}`}
          data-agent-elements-shell="project-permissions-message"
          data-tone="success"
        >
          <span className="material-symbols-outlined">check_circle</span>
          <span>{success}</span>
        </div>
      )}

      {/* Workspace Trust Section */}
      <div
        className={sectionClassName}
        data-agent-elements-shell="project-permissions-section"
        data-permission-section="trust"
      >
        <div className={sectionHeaderClassName}>
          <span>Workspace Trust</span>
        </div>
        <div
          className={`permissions-trust-card agent-elements-tool-card flex-row items-center justify-between ${cardPaddingClass}`}
          data-agent-elements-shell="project-permissions-trust-card"
          data-permission-trusted={permissions?.permissionMode !== null ? 'true' : 'false'}
          data-testid="agent-elements-project-permissions-trust-card"
        >
          <div className="permissions-trust-info flex-1">
            <div className="permissions-trust-status mb-[var(--an-spacing-xs)] flex items-center gap-[var(--an-spacing-sm)]">
              {permissions?.permissionMode !== null ? (
                <>
                  <span className="material-symbols-outlined permissions-trust-icon trusted text-[var(--an-success-color)]">verified</span>
                  <span className="permissions-trust-label text-sm font-medium text-[var(--an-foreground)]">This workspace is trusted</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined permissions-trust-icon untrusted text-[var(--an-warning-color)]">gpp_maybe</span>
                  <span className="permissions-trust-label text-sm font-medium text-[var(--an-foreground)]">This workspace is not trusted</span>
                </>
              )}
            </div>
            <p className="permissions-trust-description m-0 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
              {permissions?.permissionMode !== null
                ? 'The AI agent can run commands in this workspace.'
                : 'Trust this workspace to allow the AI agent to run commands.'}
            </p>
            {permissions?.trustedAt && (
              <p className="permissions-trust-date m-0 mt-[var(--an-spacing-xs)] text-xs text-[var(--an-foreground-subtle)]">
                Trusted on {new Date(permissions.trustedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="permissions-trust-action">
            {permissions?.permissionMode !== null ? (
              <button
                className={secondaryButtonClassName}
                onClick={handleRevokeWorkspaceTrust}
              >
                Revoke Trust
              </button>
            ) : (
              <button
                className={primaryButtonClassName}
                onClick={handleTrustWorkspace}
              >
                Trust Workspace
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Permission Mode Section - Only show when trusted */}
      {permissions && permissions.permissionMode !== null && (
        <div
          className={sectionClassName}
          data-agent-elements-shell="project-permissions-section"
          data-permission-section="mode"
          data-testid="agent-elements-project-permissions-mode-section"
        >
          <div className={sectionHeaderClassName}>
            <span>Permission Mode</span>
          </div>
          <div className="permissions-mode-options flex flex-col gap-[var(--an-spacing-sm)]">
            <label
              className={getPermissionModeOptionClassName(permissions.permissionMode === 'ask')}
              data-agent-elements-shell="project-permissions-mode-option"
              data-permission-mode="ask"
            >
              <input
                type="radio"
                name="permissionMode"
                value="ask"
                checked={permissions.permissionMode === 'ask'}
                onChange={() => handlePermissionModeChange('ask')}
                className="sr-only"
              />
              <div className="permissions-mode-option-content flex items-start gap-[var(--an-spacing-md)]">
                <span className="material-symbols-outlined text-[var(--an-foreground-muted)]">verified_user</span>
                <div className="permissions-mode-option-text flex flex-col gap-[var(--an-spacing-xxs)]">
                  <span className="permissions-mode-option-title text-sm font-medium text-[var(--an-foreground)]">Ask</span>
                  <span className="permissions-mode-option-description text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                    Agent asks before running commands. Approvals saved to .claude/settings.local.json.
                  </span>
                </div>
              </div>
            </label>
            <label
              className={getPermissionModeOptionClassName(permissions.permissionMode === 'allow-all')}
              data-agent-elements-shell="project-permissions-mode-option"
              data-permission-mode="allow-all"
            >
              <input
                type="radio"
                name="permissionMode"
                value="allow-all"
                checked={permissions.permissionMode === 'allow-all'}
                onChange={() => handlePermissionModeChange('allow-all')}
                className="sr-only"
              />
              <div className="permissions-mode-option-content flex items-start gap-[var(--an-spacing-md)]">
                <span className="material-symbols-outlined text-[var(--an-foreground-muted)]">check_circle</span>
                <div className="permissions-mode-option-text flex flex-col gap-[var(--an-spacing-xxs)]">
                  <span className="permissions-mode-option-title text-sm font-medium text-[var(--an-foreground)]">Allow Edits</span>
                  <span className="permissions-mode-option-description text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                    File operations auto-approved. Bash and web requests follow Claude Code settings.
                  </span>
                </div>
              </div>
            </label>
            <label
              className={getPermissionModeOptionClassName(permissions.permissionMode === 'bypass-all')}
              data-agent-elements-shell="project-permissions-mode-option"
              data-permission-mode="bypass-all"
            >
              <input
                type="radio"
                name="permissionMode"
                value="bypass-all"
                checked={permissions.permissionMode === 'bypass-all'}
                onChange={() => handlePermissionModeChange('bypass-all')}
                className="sr-only"
              />
              <div className="permissions-mode-option-content flex items-start gap-[var(--an-spacing-md)]">
                <span className="material-symbols-outlined text-[var(--an-foreground-muted)]">check_circle</span>
                <div className="permissions-mode-option-text flex flex-col gap-[var(--an-spacing-xxs)]">
                  <span className="permissions-mode-option-title text-sm font-medium text-[var(--an-foreground)]">Allow All</span>
                  <span className="permissions-mode-option-description text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                    All operations auto-approved without any prompts.
                  </span>
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Additional Directories Section - Only show when trusted */}
      {permissions?.permissionMode !== null && (
        <div
          className={sectionClassName}
          data-agent-elements-shell="project-permissions-section"
          data-permission-section="directories"
          data-testid="agent-elements-project-permissions-directories-section"
        >
          <div className={sectionHeaderClassName}>
            <span>Additional Directories</span>
            <span className={countPillClassName}>{permissions?.additionalDirectories.length || 0}</span>
          </div>
          <p className={sectionDescriptionClassName}>
            Allow the agent to access directories outside this project.
          </p>
          {permissions?.additionalDirectories.length === 0 ? (
            <div className={listEmptyClassName}>
              No additional directories. The agent can only access files within this project.
            </div>
          ) : (
            <div className="permissions-directory-list flex flex-col gap-[var(--an-spacing-sm)]">
              {permissions?.additionalDirectories.map((dir) => (
                <div
                  key={dir.path}
                  className={`permissions-directory-item ${rowClassName} ${compactCardPaddingClass}`}
                  data-agent-elements-shell="project-permissions-row"
                  data-permission-row="directory"
                >
                  <div className="permissions-directory-path flex min-w-0 flex-1 items-center gap-[var(--an-spacing-sm)]">
                    <span className="material-symbols-outlined text-base text-[var(--an-foreground-muted)]">folder</span>
                    <span className="permissions-directory-path-text truncate text-xs text-[var(--an-foreground)]" title={dir.path}>{dir.path}</span>
                  </div>
                  <button
                    className={`permissions-directory-remove ${removeButtonClassName}`}
                    onClick={() => handleRemoveDirectory(dir.path)}
                    title="Remove directory"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            className={`permissions-add-directory-btn ${secondaryButtonClassName} w-fit`}
            onClick={handleAddDirectory}
            disabled={isAddingDirectory}
          >
            <span className="material-symbols-outlined text-base">add</span>
            Add Directory
          </button>
        </div>
      )}

      {/* Allowed URL Patterns Section - Only show when trusted */}
      {permissions?.permissionMode !== null && (
        <div
          className={sectionClassName}
          data-agent-elements-shell="project-permissions-section"
          data-permission-section="urls"
          data-testid="agent-elements-project-permissions-urls-section"
        >
          <div className={sectionHeaderClassName}>
            <span>Allowed URL Patterns</span>
            <span className={countPillClassName}>{permissions?.allowedUrlPatterns?.length || 0}</span>
          </div>
          <p className={sectionDescriptionClassName}>
            Allow the agent to fetch or curl specific domains.
            Use wildcards like <code className={inlineCodeClassName}>*.github.com</code> to allow all subdomains.
          </p>

          {/* All Domains Allowed Card */}
          {isAllDomainsAllowed ? (
            <div
              className={`permissions-all-domains-card agent-elements-tool-card flex-row items-center justify-between border-[color-mix(in_srgb,var(--an-primary-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_8%,var(--an-background))] ${compactCardPaddingClass}`}
              data-agent-elements-shell="project-permissions-all-domains-card"
            >
              <div className="permissions-all-domains-info flex items-center gap-[var(--an-spacing-md)]">
                <span className="material-symbols-outlined permissions-all-domains-icon text-[var(--an-primary-color)]">public</span>
                <div className="permissions-all-domains-text flex flex-col">
                  <span className="permissions-all-domains-title text-sm font-medium text-[var(--an-foreground)]">All domains allowed</span>
                  <span className="permissions-all-domains-description text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                    The agent can fetch from any URL without asking.
                  </span>
                </div>
              </div>
              <button
                className={secondaryButtonClassName}
                onClick={handleRevokeAllDomains}
              >
                Revoke
              </button>
            </div>
          ) : (
            <>
              {(permissions?.allowedUrlPatterns?.length || 0) === 0 && !isAddingUrl ? (
                <div className={listEmptyClassName}>
                  No URL patterns allowed yet. The agent will ask before making web requests.
                </div>
              ) : (
                <div className="permissions-url-list flex flex-col gap-[var(--an-spacing-sm)]">
                  {permissions?.allowedUrlPatterns?.map((urlPattern) => (
                    <div
                      key={urlPattern.pattern}
                      className={`permissions-url-item ${rowClassName} ${compactCardPaddingClass}`}
                      data-agent-elements-shell="project-permissions-row"
                      data-permission-row="url-pattern"
                    >
                      <div className="permissions-url-info flex min-w-0 flex-1 flex-col">
                        <span className="permissions-url-pattern font-mono text-xs font-medium text-[var(--an-foreground)]">{urlPattern.pattern}</span>
                        {urlPattern.description && (
                          <span className="permissions-url-description text-xs text-[var(--an-foreground-muted)]">{urlPattern.description}</span>
                        )}
                      </div>
                      <button
                        className={`permissions-url-remove ${removeButtonClassName}`}
                        onClick={() => handleRemoveUrlPattern(urlPattern.pattern)}
                        title="Remove URL pattern"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {isAddingUrl ? (
                <div
                  className={`permissions-add-url-form agent-elements-tool-card ${compactCardPaddingClass}`}
                  data-agent-elements-shell="project-permissions-url-form"
                  data-testid="agent-elements-project-permissions-url-form"
                >
                  <input
                    type="text"
                    className={inputClassName}
                    placeholder="URL pattern (e.g., *.github.com)"
                    value={newUrlPattern}
                    onChange={(e) => setNewUrlPattern(e.target.value)}
                    autoFocus
                  />
                  <input
                    type="text"
                    className={inputClassName}
                    placeholder="Description (optional)"
                    value={newUrlDescription}
                    onChange={(e) => setNewUrlDescription(e.target.value)}
                  />
                  <div className="permissions-add-url-actions mt-[var(--an-spacing-xs)] flex items-center justify-end gap-[var(--an-spacing-sm)]">
                    <button
                      className={secondaryButtonClassName}
                      onClick={() => {
                        setIsAddingUrl(false);
                        setNewUrlPattern('');
                        setNewUrlDescription('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className={primaryButtonClassName}
                      onClick={handleAddUrlPattern}
                      disabled={!newUrlPattern.trim()}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <div className="permissions-url-actions flex items-center gap-[var(--an-spacing-sm)]">
                  <button
                    className={`permissions-add-url-btn ${secondaryButtonClassName}`}
                    onClick={() => setIsAddingUrl(true)}
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Add URL Pattern
                  </button>
                  <button
                    className={`permissions-allow-all-btn ${secondaryButtonClassName}`}
                    onClick={handleAllowAllDomains}
                  >
                    <span className="material-symbols-outlined text-base">public</span>
                    Allow All Domains
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Allowed Patterns Section - Only show when trusted */}
      {permissions?.permissionMode !== null && (
        <div
          className={sectionClassName}
          data-agent-elements-shell="project-permissions-section"
          data-permission-section="patterns"
          data-testid="agent-elements-project-permissions-patterns-section"
        >
          <div className={sectionHeaderClassName}>
            <span>Allowed Patterns</span>
            <span className={countPillClassName}>{permissions?.allowedPatterns.length || 0}</span>
          </div>
          {permissions?.allowedPatterns.length === 0 ? (
            <div className={listEmptyClassName}>
              No patterns allowed yet. When you approve a command, its pattern will appear here.
            </div>
          ) : (
            <div className="permissions-pattern-list flex flex-col gap-[var(--an-spacing-sm)]">
              {permissions?.allowedPatterns.map((rule) => (
                <div
                  key={rule.pattern}
                  className={`permissions-pattern-item ${rowClassName} ${compactCardPaddingClass}`}
                  data-agent-elements-shell="project-permissions-row"
                  data-permission-row="allowed-pattern"
                >
                  <span className="permissions-pattern-name font-mono text-xs font-medium text-[var(--an-foreground)]">{rule.displayName}</span>
                  <button
                    className={`permissions-pattern-remove ${removeButtonClassName}`}
                    onClick={() => handleRemovePattern(rule.pattern, 'allowed')}
                    title="Remove pattern"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Footer */}
      {permissions?.permissionMode !== null && (
        permissions?.allowedPatterns.length ||
        permissions?.allowedUrlPatterns?.length ||
        permissions?.additionalDirectories?.length
      ) ? (
        <div
          className="permissions-footer agent-elements-settings-footer border-t border-[var(--an-border-color)] pt-[var(--an-spacing-lg)]"
          data-agent-elements-shell="project-permissions-footer"
          data-testid="agent-elements-project-permissions-footer"
        >
          <button
            className={secondaryButtonClassName}
            onClick={handleResetToDefaults}
          >
            Reset to Defaults
          </button>
        </div>
      ) : null}
    </div>
  );
};
