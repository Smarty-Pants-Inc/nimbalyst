import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import type { ThemeManifest } from '@nimbalyst/extension-sdk';
import { useTheme } from '../../../hooks/useTheme';
import { pendingThemeFallbackAtom } from '../../../store/atoms/themeFallback';
import { themeListChangedVersionAtom } from '../../../store/atoms/themeList';
import { createProviderPanelChrome } from '../../GlobalSettings/panels/providerPanelChrome';

interface ThemesPanelProps {
  scope: 'user' | 'project';
  workspacePath?: string;
}

interface ThemeWithState extends ThemeManifest {
  isBuiltIn: boolean;
  isExtension: boolean;
  isUser: boolean;
  isActive: boolean;
}

const chrome = createProviderPanelChrome({
  headerClassName: 'themes-panel-header agent-elements-settings-panel-header',
  sectionClassName: 'themes-group agent-elements-settings-section',
  configCardClassName: 'agent-elements-themes-card',
  inputClassName: 'agent-elements-themes-input',
  loadingClassName: 'agent-elements-themes-loading',
  modelRowClassName: 'agent-elements-theme-card',
  testButtonClassName: 'agent-elements-themes-button',
  testErrorClassName: 'themes-message',
  emptyClassName: 'agent-elements-themes-empty',
});

const compactCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';
const emptyCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-xxl)] [--agent-elements-card-inline-padding:var(--an-spacing-xxl)]';
const themeCardBaseClass =
  `agent-elements-theme-card agent-elements-tool-card flex !flex-row items-center gap-[var(--an-spacing-lg)] cursor-pointer border ${compactCardPaddingClass} transition-[background-color,border-color,color] duration-150 ease-out`;
const themeCardSelectedClass =
  'border-[var(--an-primary-color)] bg-[color-mix(in_srgb,var(--an-primary-color)_8%,var(--an-background))]';
const themeCardIdleClass =
  'border-[var(--an-border-color)] bg-[var(--an-background-secondary)] hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)]';
const themeIconBoxClass =
  'flex h-10 w-10 items-center justify-center rounded-[var(--an-small-border-radius)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)]';
const themeTitleClass = 'text-sm font-medium text-[var(--an-foreground)]';
const themeMetaClass = 'text-xs text-[var(--an-foreground-muted)]';
const iconButtonClass =
  'rounded-[var(--an-small-border-radius)] p-[var(--an-spacing-xs)] text-[var(--an-foreground-muted)] transition-colors duration-150 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]';
const applyButtonClass =
  'agent-elements-theme-apply rounded-[var(--an-small-border-radius)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-xs)] text-xs text-[var(--an-foreground-muted)] transition-colors duration-150 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]';
const uninstallButtonClass =
  'agent-elements-theme-uninstall rounded-[var(--an-small-border-radius)] p-[var(--an-spacing-sm)] text-[var(--an-foreground-muted)] transition-colors duration-150 hover:bg-[var(--an-diff-removed-bg)] hover:text-[var(--an-diff-removed-text)]';
const activePillClass =
  'flex items-center gap-[var(--an-spacing-xs)] rounded-[var(--an-small-border-radius)] bg-[color-mix(in_srgb,var(--an-primary-color)_14%,var(--an-background))] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-xs text-[var(--an-primary-color)]';

const getThemeCardClassName = (isSelected: boolean) =>
  `${themeCardBaseClass} ${isSelected ? themeCardSelectedClass : themeCardIdleClass}`;

export const ThemesPanel: React.FC<ThemesPanelProps> = ({ scope, workspacePath }) => {
  const { themeId } = useTheme();
  const [themes, setThemes] = useState<ThemeWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const pendingFallback = useAtomValue(pendingThemeFallbackAtom);
  const setPendingFallback = useSetAtom(pendingThemeFallbackAtom);

  // Load themes
  const loadThemes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const themeManifests = await window.electronAPI.invoke('theme:list');

      const themesWithState: ThemeWithState[] = themeManifests.map((manifest: ThemeManifest) => ({
        ...manifest,
        isBuiltIn: manifest.origin === 'builtin',
        isExtension: manifest.origin === 'extension',
        isUser: manifest.origin === 'user',
        isActive: manifest.id === themeId,
      }));

      setThemes(themesWithState);
    } catch (err) {
      console.error('Failed to load themes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  }, [themeId]);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  // Refresh when extensions register/unregister themes. The IPC event is
  // handled centrally in store/listeners/themeListeners.ts which bumps
  // themeListChangedVersionAtom; we only react to *new* bumps (skip the
  // initial-mount value) so the side effect doesn't double-fire alongside
  // the loadThemes() effect above.
  const themeListVersion = useAtomValue(themeListChangedVersionAtom);
  const initialThemeListVersionRef = useRef(themeListVersion);
  useEffect(() => {
    if (themeListVersion === initialThemeListVersionRef.current) return;
    void loadThemes();
  }, [themeListVersion, loadThemes]);

  const handleDismissFallback = useCallback(() => {
    if (window.electronAPI?.send) {
      window.electronAPI.send('theme:dismiss-pending-fallback');
    }
    setPendingFallback(null);
  }, [setPendingFallback]);

  // Handle theme selection
  const handleThemeSelect = useCallback(async (themeIdToSelect: string) => {
    const theme = themes.find(t => t.id === themeIdToSelect);
    if (!theme) return;

    // Send theme change to main process
    if (window.electronAPI?.send) {
      window.electronAPI.send('set-theme', themeIdToSelect, theme.isDark);
    }

    // Reload themes to update active state
    await loadThemes();
  }, [themes, loadThemes]);

  // Handle theme uninstall
  const handleUninstall = useCallback(async (themeIdToUninstall: string) => {
    const theme = themes.find(t => t.id === themeIdToUninstall);
    if (!theme) return;

    if (theme.isBuiltIn) {
      setError('Cannot uninstall built-in themes');
      return;
    }

    const confirmed = confirm(`Are you sure you want to uninstall "${theme.name}"?`);
    if (!confirmed) return;

    try {
      const result = await window.electronAPI.invoke('theme:uninstall', themeIdToUninstall);
      if (!result.success) {
        throw new Error(result.error || 'Failed to uninstall theme');
      }

      // If the uninstalled theme was active, switch to light theme
      if (theme.isActive) {
        if (window.electronAPI?.send) {
          window.electronAPI.send('set-theme', 'light', false);
        }
      }

      await loadThemes();
    } catch (err) {
      console.error('Failed to uninstall theme:', err);
      setError(err instanceof Error ? err.message : 'Failed to uninstall theme');
    }
  }, [themes, loadThemes]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      await window.electronAPI.invoke('theme:reload');
      await loadThemes();
    } catch (err) {
      console.error('Failed to reload themes:', err);
      setError(err instanceof Error ? err.message : 'Failed to reload themes');
    }
  }, [loadThemes]);

  // Get icon for theme
  const getThemeIcon = (theme: ThemeWithState): string => {
    if (theme.isBuiltIn) {
      switch (theme.id) {
        case 'light': return 'light_mode';
        case 'dark': return 'dark_mode';
        case 'crystal-dark': return 'bedtime';
        default: return 'palette';
      }
    }
    return theme.isDark ? 'dark_mode' : 'light_mode';
  };

  // Group themes by origin
  const builtInThemes = themes.filter(t => t.isBuiltIn);
  const userThemes = themes.filter(t => t.isUser);
  const extensionThemes = themes.filter(t => t.isExtension);
  const selectedTheme = themes.find(t => t.id === selectedThemeId);

  if (loading) {
    return (
      <div
        className="themes-panel agent-elements-settings-panel agent-elements-themes-panel flex items-center justify-center h-64"
        data-agent-elements-shell="themes-panel"
        data-component="ThemesPanel"
        data-source="packages/electron/src/renderer/components/Settings/panels/ThemesPanel.tsx"
        data-testid="agent-elements-themes-panel"
      >
        <div
          className={chrome.loadingText}
          data-agent-elements-shell="themes-loading"
        >
          Loading themes...
        </div>
      </div>
    );
  }

  return (
    <div
      className="themes-panel agent-elements-settings-panel agent-elements-themes-panel flex flex-col h-full"
      data-agent-elements-shell="themes-panel"
      data-component="ThemesPanel"
      data-source="packages/electron/src/renderer/components/Settings/panels/ThemesPanel.tsx"
      data-testid="agent-elements-themes-panel"
      data-settings-scope={scope}
      data-workspace-bound={workspacePath ? 'true' : 'false'}
    >
      {/* Header */}
      <div
        className={`${chrome.header} flex items-center justify-between`}
        data-agent-elements-shell="themes-header"
        data-testid="agent-elements-themes-header"
      >
        <div>
          <h2 className={chrome.title}>Themes</h2>
          <p className={chrome.description}>
            Manage color themes for the editor
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className={`${chrome.secondaryButton} agent-elements-themes-refresh gap-[var(--an-spacing-sm)]`}
          data-agent-elements-shell="themes-refresh"
          data-testid="agent-elements-themes-refresh"
          title="Refresh theme list"
        >
          <MaterialSymbol icon="refresh" size={18} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div
          className={`themes-message agent-elements-tool-card mb-[var(--an-spacing-xl)] border-[color-mix(in_srgb,var(--an-error-color)_36%,var(--an-border-color))] bg-[var(--an-diff-removed-bg)] text-sm text-[var(--an-error-color)] ${compactCardPaddingClass}`}
          data-agent-elements-shell="themes-message"
          data-tone="error"
        >
          {error}
        </div>
      )}

      {/* Pending fallback banner */}
      {pendingFallback && (
        <div
          className={`theme-fallback-banner agent-elements-tool-card agent-elements-themes-fallback mb-[var(--an-spacing-xl)] flex !flex-row items-start gap-[var(--an-spacing-sm)] border-[color-mix(in_srgb,var(--an-warning-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_10%,var(--an-background))] ${compactCardPaddingClass}`}
          data-agent-elements-shell="themes-fallback"
          data-tone="warning"
          data-testid="agent-elements-themes-fallback"
        >
          <MaterialSymbol icon="info" size={18} className="mt-0.5 shrink-0 text-[var(--an-warning-color)]" />
          <div className="flex-1 text-sm text-[var(--an-foreground)]">
            The theme <span className="font-semibold">{pendingFallback.missingId}</span> is no longer available. Switched to <span className="font-semibold">{pendingFallback.appliedId}</span>.
          </div>
          <button
            data-testid="dismiss-theme-fallback"
            onClick={handleDismissFallback}
            className={iconButtonClass}
            title="Dismiss"
          >
            <MaterialSymbol icon="close" size={16} />
          </button>
        </div>
      )}

      {/* Active theme section */}
      <div
        className="themes-active-section agent-elements-settings-section mb-6"
        data-agent-elements-shell="themes-active-section"
        data-testid="agent-elements-themes-active-section"
      >
        <h3 className={chrome.sectionTitle}>Active Theme</h3>
        <div className={`${chrome.configCard} flex !flex-row items-center gap-[var(--an-spacing-lg)] border-[var(--an-border-color)] bg-[var(--an-background-secondary)]`}>
          {(() => {
            const activeTheme = themes.find(t => t.isActive);
            if (!activeTheme) return <div className="text-sm text-[var(--an-foreground-muted)]">No theme selected</div>;

            return (
              <>
                <div className={themeIconBoxClass}>
                  <MaterialSymbol icon={getThemeIcon(activeTheme)} size={20} />
                </div>
                <div className="flex-1">
                  <div className={themeTitleClass}>{activeTheme.name}</div>
                  <div className={themeMetaClass}>{activeTheme.description || 'No description'}</div>
                </div>
                <div className={activePillClass}>
                  <MaterialSymbol icon="check" size={14} />
                  <span>Active</span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Theme list */}
      <div
        className="themes-list agent-elements-themes-list flex-1 overflow-auto"
        data-agent-elements-shell="themes-list"
      >
        {/* Built-in themes */}
        <div
          className="themes-group agent-elements-settings-section mb-6"
          data-agent-elements-shell="themes-group"
          data-theme-origin="builtin"
          data-testid="agent-elements-themes-group-builtin"
        >
          <h3 className={chrome.sectionTitle}>Built-in Themes</h3>
          <div className="space-y-2">
            {builtInThemes.map((theme) => (
              <div
                key={theme.id}
                className={getThemeCardClassName(selectedThemeId === theme.id)}
                data-agent-elements-shell="theme-card"
                data-theme-active={theme.isActive ? 'true' : 'false'}
                data-theme-id={theme.id}
                data-theme-origin="builtin"
                data-testid={`agent-elements-theme-card-${theme.id}`}
                onClick={() => setSelectedThemeId(theme.id)}
              >
                <div className={themeIconBoxClass}>
                  <MaterialSymbol icon={getThemeIcon(theme)} size={20} />
                </div>
                <div className="flex-1">
                  <div className={themeTitleClass}>{theme.name}</div>
                  <div className={themeMetaClass}>{theme.description || 'No description'}</div>
                </div>
                {theme.isActive && (
                  <div className="flex items-center gap-[var(--an-spacing-xs)] text-xs text-[var(--an-primary-color)]">
                    <MaterialSymbol icon="check" size={14} />
                  </div>
                )}
                {!theme.isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleThemeSelect(theme.id);
                    }}
                    className={applyButtonClass}
                  >
                    Apply
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* User themes */}
        {userThemes.length > 0 && (
          <div
            className="themes-group agent-elements-settings-section mb-6"
            data-agent-elements-shell="themes-group"
            data-theme-origin="user"
            data-testid="agent-elements-themes-group-user"
          >
            <h3 className={chrome.sectionTitle}>User Themes</h3>
            <div className="space-y-2">
              {userThemes.map((theme) => (
                <div
                  key={theme.id}
                  className={getThemeCardClassName(selectedThemeId === theme.id)}
                  data-agent-elements-shell="theme-card"
                  data-theme-active={theme.isActive ? 'true' : 'false'}
                  data-theme-id={theme.id}
                  data-theme-origin="user"
                  data-testid={`agent-elements-theme-card-${theme.id}`}
                  onClick={() => setSelectedThemeId(theme.id)}
                >
                  <div className={themeIconBoxClass}>
                    <MaterialSymbol icon={getThemeIcon(theme)} size={20} />
                  </div>
                  <div className="flex-1">
                    <div className={themeTitleClass}>{theme.name}</div>
                    <div className={themeMetaClass}>{theme.description || 'No description'}</div>
                  </div>
                  {theme.isActive && (
                    <div className="flex items-center gap-[var(--an-spacing-xs)] text-xs text-[var(--an-primary-color)]">
                      <MaterialSymbol icon="check" size={14} />
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    {!theme.isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleThemeSelect(theme.id);
                        }}
                        className={applyButtonClass}
                      >
                        Apply
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUninstall(theme.id);
                      }}
                      className={uninstallButtonClass}
                      title="Uninstall theme"
                    >
                      <MaterialSymbol icon="delete" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extension themes */}
        {extensionThemes.length > 0 && (
          <div
            className="extension-themes-section themes-group agent-elements-settings-section mb-6"
            data-agent-elements-shell="themes-group"
            data-theme-origin="extension"
            data-testid="agent-elements-themes-group-extension"
          >
            <h3 className={chrome.sectionTitle}>Extension Themes</h3>
            <div className="space-y-2">
              {extensionThemes.map((theme) => (
                <div
                  key={theme.id}
                  data-testid="extension-theme-item"
                  className={getThemeCardClassName(selectedThemeId === theme.id)}
                  data-agent-elements-shell="theme-card"
                  data-theme-active={theme.isActive ? 'true' : 'false'}
                  data-theme-id={theme.id}
                  data-theme-origin="extension"
                  onClick={() => setSelectedThemeId(theme.id)}
                >
                  <div className={themeIconBoxClass}>
                    <MaterialSymbol icon={getThemeIcon(theme)} size={20} />
                  </div>
                  <div className="flex-1">
                    <div className={themeTitleClass}>{theme.name}</div>
                    <div className={themeMetaClass}>
                      {theme.contributedBy ? `Contributed by ${theme.contributedBy}` : 'Extension theme'}
                    </div>
                  </div>
                  {theme.isActive && (
                    <div className="flex items-center gap-[var(--an-spacing-xs)] text-xs text-[var(--an-primary-color)]">
                      <MaterialSymbol icon="check" size={14} />
                    </div>
                  )}
                  {!theme.isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleThemeSelect(theme.id);
                      }}
                      className={applyButtonClass}
                    >
                      Apply
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no installed themes (user or extension) */}
        {userThemes.length === 0 && extensionThemes.length === 0 && (
          <div
            className="themes-group agent-elements-settings-section mb-6"
            data-agent-elements-shell="themes-group"
            data-theme-origin="installed"
          >
            <h3 className={chrome.sectionTitle}>Installed Themes</h3>
            <div
              className={`${chrome.emptyText} agent-elements-tool-card flex flex-col items-center justify-center border-dashed bg-[var(--an-background-secondary)] text-center ${emptyCardPaddingClass}`}
              data-agent-elements-shell="themes-empty-state"
              data-testid="agent-elements-themes-empty-state"
            >
              <MaterialSymbol icon="palette" size={32} className="mb-[var(--an-spacing-sm)] text-[var(--an-foreground-muted)]" />
              <p className="text-center text-sm text-[var(--an-foreground-muted)]">
                No user or extension themes installed yet
              </p>
              <p className="mt-[var(--an-spacing-xs)] text-center text-xs text-[var(--an-foreground-subtle)]">
                Install themes from files, the marketplace, or via theme extensions
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Theme details panel */}
      {selectedTheme && (
        <div
          className="agent-elements-themes-detail mt-[var(--an-spacing-xl)] border-t border-[var(--an-border-color)] pt-[var(--an-spacing-xl)]"
          data-agent-elements-shell="themes-detail"
          data-theme-id={selectedTheme.id}
          data-testid="agent-elements-themes-detail"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className={themeTitleClass}>{selectedTheme.name}</h3>
              <p className={`mt-0.5 ${themeMetaClass}`}>{selectedTheme.description || 'No description'}</p>
            </div>
            <button
              onClick={() => setSelectedThemeId(null)}
              className={`agent-elements-themes-detail-close ${iconButtonClass}`}
            >
              <MaterialSymbol icon="close" size={16} />
            </button>
          </div>

          {/* Theme metadata */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--an-foreground-muted)]">Version:</span>
              <span className="text-[var(--an-foreground)]">{selectedTheme.version}</span>
            </div>
            {selectedTheme.author && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--an-foreground-muted)]">Author:</span>
                <span className="text-[var(--an-foreground)]">{selectedTheme.author}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[var(--an-foreground-muted)]">Type:</span>
              <span className="text-[var(--an-foreground)]">{selectedTheme.isDark ? 'Dark' : 'Light'}</span>
            </div>
            {selectedTheme.tags && selectedTheme.tags.length > 0 && (
              <div className="flex items-start justify-between">
                <span className="text-[var(--an-foreground-muted)]">Tags:</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {selectedTheme.tags.map(tag => (
                    <span key={tag} className="rounded-[var(--an-radius-xs)] bg-[var(--an-background-tertiary)] px-1.5 py-0.5 text-xs text-[var(--an-foreground-muted)]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(['solarized-dark', 'solarized-light', 'monokai'].includes(selectedTheme.id)) && (
              <div className="mt-[var(--an-spacing-sm)] flex items-start justify-between border-t border-[var(--an-border-color)] pt-[var(--an-spacing-sm)]">
                <span className="text-[var(--an-foreground-muted)]">License:</span>
                <span className="max-w-[60%] text-right text-[var(--an-foreground)]">
                  {selectedTheme.id.startsWith('solarized')
                    ? 'MIT License © 2011 Ethan Schoonover'
                    : 'MIT License © 2006 Wimer Hazenberg'}
                </span>
              </div>
            )}
          </div>

          {/* Color preview */}
          <div className="mt-4">
            <div className="mb-[var(--an-spacing-sm)] text-xs font-medium text-[var(--an-foreground)]">Colors</div>
            <div
              className="agent-elements-themes-color-preview grid grid-cols-4 gap-2"
              data-agent-elements-shell="themes-color-preview"
              data-testid="agent-elements-themes-color-preview"
            >
              {Object.entries(selectedTheme.colors).slice(0, 8).map(([key, value]) => (
                <div key={key} className="flex flex-col items-center gap-1">
                  <div
                    className="h-8 w-full rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)]"
                    style={{ backgroundColor: value }}
                    title={`${key}: ${value}`}
                  />
                  <span className="text-xs text-[var(--an-foreground-muted)]">{key}</span>
                </div>
              ))}
            </div>
            {Object.keys(selectedTheme.colors).length > 8 && (
              <div className="mt-[var(--an-spacing-sm)] text-center text-xs text-[var(--an-foreground-muted)]">
                +{Object.keys(selectedTheme.colors).length - 8} more colors
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
