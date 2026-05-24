import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import type { ThemeManifest } from '@nimbalyst/extension-sdk';
import { useTheme } from '../../../hooks/useTheme';
import { pendingThemeFallbackAtom } from '../../../store/atoms/themeFallback';
import { themeListChangedVersionAtom } from '../../../store/atoms/themeList';

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

const getThemeCardClassName = (isSelected: boolean) => (
  `agent-elements-theme-card flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors duration-150 ${
    isSelected
      ? 'border-nim-primary bg-nim-primary/5'
      : 'border-nim bg-nim-secondary hover:bg-nim-tertiary'
  }`
);

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
          className="agent-elements-themes-loading text-nim-muted"
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
        className="themes-panel-header agent-elements-settings-panel-header flex items-center justify-between mb-4 pb-4 border-b border-nim"
        data-agent-elements-shell="themes-header"
        data-testid="agent-elements-themes-header"
      >
        <div>
          <h2 className="text-lg font-semibold text-nim">Themes</h2>
          <p className="text-sm text-nim-muted mt-1">
            Manage color themes for the editor
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="agent-elements-themes-refresh flex items-center gap-2 px-3 py-1.5 text-sm text-nim-muted hover:text-nim hover:bg-nim-hover rounded-md transition-colors"
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
          className="themes-message agent-elements-tool-card mb-4 p-3 bg-nim-error/10 border border-nim-error/30 rounded-lg text-nim-error text-sm"
          data-agent-elements-shell="themes-message"
          data-tone="error"
        >
          {error}
        </div>
      )}

      {/* Pending fallback banner */}
      {pendingFallback && (
        <div
          className="theme-fallback-banner agent-elements-tool-card agent-elements-themes-fallback mb-4 p-3 bg-nim-warning/10 border border-nim-warning/30 rounded-lg flex items-start gap-2"
          data-agent-elements-shell="themes-fallback"
          data-tone="warning"
          data-testid="agent-elements-themes-fallback"
        >
          <MaterialSymbol icon="info" size={18} className="text-nim-warning shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-nim">
            The theme <span className="font-semibold">{pendingFallback.missingId}</span> is no longer available. Switched to <span className="font-semibold">{pendingFallback.appliedId}</span>.
          </div>
          <button
            data-testid="dismiss-theme-fallback"
            onClick={handleDismissFallback}
            className="p-1 text-nim-muted hover:text-nim hover:bg-nim-hover rounded transition-colors"
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
        <h3 className="text-sm font-medium text-nim mb-3">Active Theme</h3>
        <div className="agent-elements-tool-card flex items-center gap-3 p-3 bg-nim-secondary border border-nim rounded-lg">
          {(() => {
            const activeTheme = themes.find(t => t.isActive);
            if (!activeTheme) return <div className="text-nim-muted text-sm">No theme selected</div>;

            return (
              <>
                <div className="flex items-center justify-center w-10 h-10 bg-nim-tertiary rounded-md">
                  <MaterialSymbol icon={getThemeIcon(activeTheme)} size={20} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-nim">{activeTheme.name}</div>
                  <div className="text-xs text-nim-muted">{activeTheme.description || 'No description'}</div>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-nim-primary/20 text-nim-primary text-xs rounded">
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
          <h3 className="text-sm font-medium text-nim mb-3">Built-in Themes</h3>
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
                <div className="flex items-center justify-center w-10 h-10 bg-nim-tertiary rounded-md">
                  <MaterialSymbol icon={getThemeIcon(theme)} size={20} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-nim">{theme.name}</div>
                  <div className="text-xs text-nim-muted">{theme.description || 'No description'}</div>
                </div>
                {theme.isActive && (
                  <div className="flex items-center gap-1 text-nim-primary text-xs">
                    <MaterialSymbol icon="check" size={14} />
                  </div>
                )}
                {!theme.isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleThemeSelect(theme.id);
                    }}
                    className="agent-elements-theme-apply px-3 py-1 text-xs text-nim-muted hover:text-nim hover:bg-nim-hover rounded-md transition-colors"
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
            <h3 className="text-sm font-medium text-nim mb-3">User Themes</h3>
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
                  <div className="flex items-center justify-center w-10 h-10 bg-nim-tertiary rounded-md">
                    <MaterialSymbol icon={getThemeIcon(theme)} size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-nim">{theme.name}</div>
                    <div className="text-xs text-nim-muted">{theme.description || 'No description'}</div>
                  </div>
                  {theme.isActive && (
                    <div className="flex items-center gap-1 text-nim-primary text-xs">
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
                        className="agent-elements-theme-apply px-3 py-1 text-xs text-nim-muted hover:text-nim hover:bg-nim-hover rounded-md transition-colors"
                      >
                        Apply
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUninstall(theme.id);
                      }}
                      className="agent-elements-theme-uninstall p-1.5 text-nim-muted hover:text-nim-error hover:bg-nim-error/10 rounded-md transition-colors"
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
            <h3 className="text-sm font-medium text-nim mb-3">Extension Themes</h3>
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
                  <div className="flex items-center justify-center w-10 h-10 bg-nim-tertiary rounded-md">
                    <MaterialSymbol icon={getThemeIcon(theme)} size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-nim">{theme.name}</div>
                    <div className="text-xs text-nim-muted">
                      {theme.contributedBy ? `Contributed by ${theme.contributedBy}` : 'Extension theme'}
                    </div>
                  </div>
                  {theme.isActive && (
                    <div className="flex items-center gap-1 text-nim-primary text-xs">
                      <MaterialSymbol icon="check" size={14} />
                    </div>
                  )}
                  {!theme.isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleThemeSelect(theme.id);
                      }}
                      className="agent-elements-theme-apply px-3 py-1 text-xs text-nim-muted hover:text-nim hover:bg-nim-hover rounded-md transition-colors"
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
            <h3 className="text-sm font-medium text-nim mb-3">Installed Themes</h3>
            <div
              className="agent-elements-themes-empty flex flex-col items-center justify-center p-8 bg-nim-secondary border border-nim border-dashed rounded-lg"
              data-agent-elements-shell="themes-empty-state"
            >
              <MaterialSymbol icon="palette" size={32} className="text-nim-muted mb-2" />
              <p className="text-sm text-nim-muted text-center">
                No user or extension themes installed yet
              </p>
              <p className="text-xs text-nim-faint text-center mt-1">
                Install themes from files, the marketplace, or via theme extensions
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Theme details panel */}
      {selectedTheme && (
        <div
          className="agent-elements-themes-detail mt-4 pt-4 border-t border-nim"
          data-agent-elements-shell="themes-detail"
          data-theme-id={selectedTheme.id}
          data-testid="agent-elements-themes-detail"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-nim">{selectedTheme.name}</h3>
              <p className="text-xs text-nim-muted mt-0.5">{selectedTheme.description || 'No description'}</p>
            </div>
            <button
              onClick={() => setSelectedThemeId(null)}
              className="agent-elements-themes-detail-close p-1 text-nim-muted hover:text-nim rounded-md transition-colors"
            >
              <MaterialSymbol icon="close" size={16} />
            </button>
          </div>

          {/* Theme metadata */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-nim-muted">Version:</span>
              <span className="text-nim">{selectedTheme.version}</span>
            </div>
            {selectedTheme.author && (
              <div className="flex items-center justify-between">
                <span className="text-nim-muted">Author:</span>
                <span className="text-nim">{selectedTheme.author}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-nim-muted">Type:</span>
              <span className="text-nim">{selectedTheme.isDark ? 'Dark' : 'Light'}</span>
            </div>
            {selectedTheme.tags && selectedTheme.tags.length > 0 && (
              <div className="flex items-start justify-between">
                <span className="text-nim-muted">Tags:</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {selectedTheme.tags.map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 bg-nim-tertiary text-nim-muted rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(['solarized-dark', 'solarized-light', 'monokai'].includes(selectedTheme.id)) && (
              <div className="flex items-start justify-between pt-2 border-t border-nim mt-2">
                <span className="text-nim-muted">License:</span>
                <span className="text-nim text-right max-w-[60%]">
                  {selectedTheme.id.startsWith('solarized')
                    ? 'MIT License © 2011 Ethan Schoonover'
                    : 'MIT License © 2006 Wimer Hazenberg'}
                </span>
              </div>
            )}
          </div>

          {/* Color preview */}
          <div className="mt-4">
            <div className="text-xs font-medium text-nim mb-2">Colors</div>
            <div
              className="agent-elements-themes-color-preview grid grid-cols-4 gap-2"
              data-agent-elements-shell="themes-color-preview"
              data-testid="agent-elements-themes-color-preview"
            >
              {Object.entries(selectedTheme.colors).slice(0, 8).map(([key, value]) => (
                <div key={key} className="flex flex-col items-center gap-1">
                  <div
                    className="w-full h-8 rounded border border-nim"
                    style={{ backgroundColor: value }}
                    title={`${key}: ${value}`}
                  />
                  <span className="text-xs text-nim-muted">{key}</span>
                </div>
              ))}
            </div>
            {Object.keys(selectedTheme.colors).length > 8 && (
              <div className="text-xs text-nim-muted text-center mt-2">
                +{Object.keys(selectedTheme.colors).length - 8} more colors
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
