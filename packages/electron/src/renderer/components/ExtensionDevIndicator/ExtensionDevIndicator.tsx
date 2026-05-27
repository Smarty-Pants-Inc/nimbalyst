import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { ExtensionErrorConsole } from './ExtensionErrorConsole';
import { extensionDevToolsEnabledAtom } from '../../store/atoms/appSettings';
import { HelpTooltip } from '../../help';
import { useFloatingMenu, FloatingPortal } from '../../hooks/useFloatingMenu';

/**
 * Format a timestamp as a relative time string (e.g., "5m ago", "2h ago")
 */
function formatRelativeTime(startTime: number): string {
  const now = Date.now();
  const diffMs = now - startTime;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m ago`;
  } else {
    return 'just now';
  }
}

interface InstalledExtension {
  id: string;
  path: string;
  manifest: any;
  name: string;
  enabled: boolean;
}

interface ExtensionDevIndicatorProps {
  onOpenSettings?: () => void;
}

const floatingMenuCardGutters =
  '[--agent-elements-card-block-padding:var(--an-spacing-xs)] [--agent-elements-card-inline-padding:var(--an-spacing-xs)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';

export const ExtensionDevIndicator: React.FC<ExtensionDevIndicatorProps> = ({
  onOpenSettings,
}) => {
  const isEnabled = useAtomValue(extensionDevToolsEnabledAtom);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rebuildSubmenuOpen, setRebuildSubmenuOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [processStartTime, setProcessStartTime] = useState<number | null>(null);
  const [relativeTime, setRelativeTime] = useState<string>('');
  const [extensions, setExtensions] = useState<InstalledExtension[]>([]);
  const [rebuildingExtension, setRebuildingExtension] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const handleMenuOpenChange = useCallback((open: boolean) => {
    setMenuOpen(open);
    if (!open) {
      setRebuildSubmenuOpen(false);
    }
  }, []);
  const menu = useFloatingMenu({
    placement: 'right-end',
    offsetPx: 8,
    viewportPadding: 12,
    open: menuOpen,
    onOpenChange: handleMenuOpenChange,
  });
  const rebuildMenu = useFloatingMenu({
    placement: 'right-start',
    offsetPx: 4,
    viewportPadding: 12,
    open: rebuildSubmenuOpen,
    onOpenChange: setRebuildSubmenuOpen,
  });
  const setButtonReference = useCallback((node: HTMLButtonElement | null) => {
    buttonRef.current = node;
    menu.refs.setReference(node);
  }, [menu.refs]);

  // Check for errors periodically
  const checkErrors = useCallback(async () => {
    if (!isEnabled) return;
    try {
      const result = await window.electronAPI.extensionDevTools.getLogs({
        logLevel: 'error',
        lastSeconds: 300, // 5 minutes
      });
      setErrorCount(result.logs.length);
    } catch (error) {
      // Ignore errors during check
    }
  }, [isEnabled]);

  useEffect(() => {
    checkErrors();
    const interval = setInterval(checkErrors, 5000);
    return () => clearInterval(interval);
  }, [checkErrors]);

  // Get process info when enabled
  useEffect(() => {
    if (!isEnabled) {
      setProcessStartTime(null);
      setRelativeTime('');
      return;
    }

    const fetchProcessInfo = async () => {
      try {
        const processInfo = await window.electronAPI.extensionDevTools.getProcessInfo();
        setProcessStartTime(processInfo.startTime);
        setRelativeTime(formatRelativeTime(processInfo.startTime));
      } catch (error) {
        console.error('[ExtensionDevIndicator] Failed to get process info:', error);
      }
    };

    fetchProcessInfo();
  }, [isEnabled]);

  // Update the relative time display every minute
  useEffect(() => {
    if (!processStartTime) return;

    const updateRelativeTime = () => {
      setRelativeTime(formatRelativeTime(processStartTime));
    };

    // Update every minute
    const interval = setInterval(updateRelativeTime, 60000);
    return () => clearInterval(interval);
  }, [processStartTime]);

  // Fetch installed extensions when menu opens
  useEffect(() => {
    if (!menuOpen) {
      setRebuildSubmenuOpen(false);
      return;
    }

    const fetchExtensions = async () => {
      try {
        const installed = await window.electronAPI.extensions.listInstalled();
        // Filter to only extensions with a build script (have a path in packages/extensions)
        // and normalize to ensure we have a name
        const buildableExtensions = installed
          .filter(ext =>
            ext.path.includes('packages/extensions') || ext.path.includes('extensions/')
          )
          .map(ext => ({
            ...ext,
            // Get name from manifest if not provided directly
            name: ext.name || ext.manifest?.name || ext.id,
          }));
        setExtensions(buildableExtensions);
      } catch (error) {
        console.error('[ExtensionDevIndicator] Failed to fetch extensions:', error);
      }
    };

    fetchExtensions();
  }, [menuOpen]);

  // Don't render if not enabled
  if (!isEnabled) {
    return null;
  }

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await window.electronAPI.invoke('app:restart');
    } catch (error) {
      console.error('[ExtensionDevIndicator] Failed to restart:', error);
      setIsRestarting(false);
    }
  };

  const handleOpenSettings = () => {
    setMenuOpen(false);
    onOpenSettings?.();
  };

  const handleOpenConsole = () => {
    setMenuOpen(false);
    setConsoleOpen(true);
  };

  const handleRebuildExtension = async (extension: InstalledExtension) => {
    setRebuildingExtension(extension.id);
    try {
      const result = await window.electronAPI.extensions.devReload(extension.id, extension.path);
      if (!result.success) {
        console.error(`[ExtensionDevIndicator] Failed to rebuild ${extension.name}:`, result.error);
      }
    } catch (error) {
      console.error(`[ExtensionDevIndicator] Failed to rebuild ${extension.name}:`, error);
    } finally {
      setRebuildingExtension(null);
    }
  };

  const handleRebuildAll = async () => {
    setRebuildingExtension('all');
    try {
      for (const ext of extensions) {
        const result = await window.electronAPI.extensions.devReload(ext.id, ext.path);
        if (!result.success) {
          console.error(`[ExtensionDevIndicator] Failed to rebuild ${ext.name}:`, result.error);
        }
      }
    } catch (error) {
      console.error('[ExtensionDevIndicator] Failed to rebuild extensions:', error);
    } finally {
      setRebuildingExtension(null);
      setRebuildSubmenuOpen(false);
      setMenuOpen(false);
    }
  };

  return (
    <>
      <ExtensionErrorConsole
        isOpen={consoleOpen}
        onClose={() => {
          setConsoleOpen(false);
          checkErrors(); // Refresh error count after closing
        }}
      />
      <div className="extension-dev-indicator-container relative">
        <HelpTooltip testId="gutter-extension-dev-button" placement="right">
          <button
            ref={setButtonReference}
            {...menu.getReferenceProps()}
            className="extension-dev-indicator agent-elements-extension-dev-button nav-button relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] cursor-pointer transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-[color-mix(in_srgb,var(--an-primary-color)_24%,transparent)] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_8%,transparent)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2"
            onClick={() => menu.setIsOpen(!menu.isOpen)}
            aria-label="Extension Development Mode"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            data-testid="agent-elements-extension-dev-button"
            data-agent-elements-shell="extension-dev-button"
          >
            <MaterialSymbol icon="developer_mode" size={20} />
            <span className="extension-dev-indicator-dot agent-elements-extension-dev-dot absolute bottom-1 right-1 h-2 w-2 rounded-[999px] border-2 border-[var(--an-background-secondary)] bg-[var(--an-primary-color)]" />
          </button>
        </HelpTooltip>
      </div>

      {menuOpen && (
        <FloatingPortal>
          <div
            ref={menu.refs.setFloating}
            style={menu.floatingStyles}
            {...menu.getFloatingProps()}
            className={`extension-dev-menu agent-elements-extension-dev-menu agent-elements-tool-card z-[10000] w-60 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-tool-background)] text-[13px] text-[var(--an-foreground)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)] animate-[extension-dev-menu-appear_0.15s_ease-out] ${floatingMenuCardGutters}`}
            role="menu"
            data-testid="agent-elements-extension-dev-menu"
            data-agent-elements-shell="extension-dev-menu"
            data-agent-elements-card-padding="symmetric-inline"
            data-agent-elements-card-width="floating-menu"
          >
            <div className="extension-dev-menu-header agent-elements-extension-dev-header flex items-center justify-between px-2 py-2">
              <span className="extension-dev-menu-title text-[13px] font-semibold leading-5 text-[var(--an-foreground)]">Extension Dev Mode</span>
            </div>

            <div
              className="extension-dev-menu-status agent-elements-extension-dev-status mb-1 flex items-center gap-2 rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-primary-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] px-2.5 py-2 text-xs leading-4 text-[var(--an-foreground-muted)] [&_.material-symbols-outlined]:text-[var(--an-primary-color)]"
              data-testid="agent-elements-extension-dev-status"
              data-agent-elements-shell="extension-dev-status"
            >
              <MaterialSymbol icon="check_circle" size={16} />
              <span>Development tools active</span>
            </div>

            {relativeTime && (
              <div className="extension-dev-menu-uptime agent-elements-extension-dev-uptime mb-1 flex items-center gap-2 px-2 py-1.5 text-xs leading-4 text-[var(--an-foreground-subtle)] [&_.material-symbols-outlined]:text-[var(--an-foreground-subtle)]">
                <MaterialSymbol icon="schedule" size={16} />
                <span>Started {relativeTime}</span>
              </div>
            )}

            <div className="extension-dev-menu-divider agent-elements-extension-dev-divider mx-2 my-1 h-px bg-[var(--an-border-color)]" />

            <div
              className="extension-dev-menu-actions agent-elements-extension-dev-actions flex flex-col gap-0.5"
              data-testid="agent-elements-extension-dev-actions"
              data-agent-elements-shell="extension-dev-actions"
            >
              <button
                type="button"
                className="extension-dev-menu-action agent-elements-extension-dev-action flex w-full items-center gap-2.5 rounded-[var(--an-tool-border-radius)] border-0 bg-transparent px-2.5 py-2 text-left text-[13px] leading-5 text-[var(--an-foreground)] cursor-pointer transition-[background-color,color] duration-150 hover:bg-[var(--an-background-tertiary)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2 [&_.material-symbols-outlined]:text-[var(--an-foreground-muted)]"
                onClick={handleOpenConsole}
                role="menuitem"
              >
                <MaterialSymbol icon="terminal" size={18} />
                <span className="min-w-0 flex-1">
                  View Logs
                  {errorCount > 0 && (
                    <span className="extension-dev-error-badge ml-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[999px] bg-[var(--an-diff-removed-text)] px-[5px] text-[11px] font-semibold leading-none text-[var(--an-background)]">{errorCount}</span>
                  )}
                </span>
              </button>

              {onOpenSettings && (
                <button
                  type="button"
                  className="extension-dev-menu-action agent-elements-extension-dev-action flex w-full items-center gap-2.5 rounded-[var(--an-tool-border-radius)] border-0 bg-transparent px-2.5 py-2 text-left text-[13px] leading-5 text-[var(--an-foreground)] cursor-pointer transition-[background-color,color] duration-150 hover:bg-[var(--an-background-tertiary)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2 [&_.material-symbols-outlined]:text-[var(--an-foreground-muted)]"
                  onClick={handleOpenSettings}
                  role="menuitem"
                >
                  <MaterialSymbol icon="settings" size={18} />
                  <span className="min-w-0 flex-1">Extension Settings</span>
                </button>
              )}

              <button
                type="button"
                ref={rebuildMenu.refs.setReference}
                {...rebuildMenu.getReferenceProps()}
                className="extension-dev-menu-action agent-elements-extension-dev-action agent-elements-extension-dev-rebuild-trigger flex w-full items-center justify-between gap-2.5 rounded-[var(--an-tool-border-radius)] border-0 bg-transparent px-2.5 py-2 text-left text-[13px] leading-5 text-[var(--an-foreground)] cursor-pointer transition-[background-color,color] duration-150 hover:bg-[var(--an-background-tertiary)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2 [&_.material-symbols-outlined]:text-[var(--an-foreground-muted)]"
                onClick={() => rebuildMenu.setIsOpen(!rebuildMenu.isOpen)}
                role="menuitem"
                aria-expanded={rebuildSubmenuOpen}
                aria-haspopup="menu"
                data-testid="agent-elements-extension-dev-rebuild-trigger"
                data-agent-elements-shell="extension-dev-rebuild-trigger"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <MaterialSymbol icon="build" size={18} />
                  <span className="truncate">{rebuildingExtension ? 'Rebuilding...' : 'Rebuild Extensions'}</span>
                </span>
                <MaterialSymbol icon="chevron_right" size={18} />
              </button>

              <button
                type="button"
                className="extension-dev-menu-action agent-elements-extension-dev-action flex w-full items-center gap-2.5 rounded-[var(--an-tool-border-radius)] border-0 bg-transparent px-2.5 py-2 text-left text-[13px] leading-5 text-[var(--an-foreground)] cursor-pointer transition-[background-color,color] duration-150 hover:enabled:bg-[var(--an-background-tertiary)] disabled:cursor-not-allowed disabled:text-[var(--an-foreground-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2 [&_.material-symbols-outlined]:text-[var(--an-foreground-muted)] [&:disabled_.material-symbols-outlined]:text-[var(--an-foreground-subtle)]"
                onClick={handleRestart}
                disabled={isRestarting}
                role="menuitem"
              >
                <MaterialSymbol icon="refresh" size={18} />
                <span className="min-w-0 flex-1">{isRestarting ? 'Restarting...' : 'Restart Nimbalyst'}</span>
              </button>
            </div>
          </div>
        </FloatingPortal>
      )}

      {rebuildSubmenuOpen && (
        <FloatingPortal>
          <div
            ref={rebuildMenu.refs.setFloating}
            style={rebuildMenu.floatingStyles}
            {...rebuildMenu.getFloatingProps()}
            className={`extension-dev-rebuild-menu agent-elements-extension-dev-rebuild-menu agent-elements-tool-card z-[10001] w-56 max-h-[calc(100vh-32px)] overflow-y-auto rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-tool-background)] text-[13px] text-[var(--an-foreground)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)] animate-[extension-dev-menu-appear_0.1s_ease-out] ${floatingMenuCardGutters}`}
            role="menu"
            data-testid="agent-elements-extension-dev-rebuild-menu"
            data-agent-elements-shell="extension-dev-rebuild-menu"
            data-agent-elements-card-padding="symmetric-inline"
            data-agent-elements-card-width="floating-menu"
          >
            <button
              type="button"
              className="extension-dev-menu-action agent-elements-extension-dev-action flex w-full items-center gap-2.5 rounded-[var(--an-tool-border-radius)] border-0 bg-transparent px-2.5 py-2 text-left text-[13px] leading-5 text-[var(--an-foreground)] cursor-pointer transition-[background-color,color] duration-150 hover:enabled:bg-[var(--an-background-tertiary)] disabled:cursor-not-allowed disabled:text-[var(--an-foreground-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2 [&_.material-symbols-outlined]:text-[var(--an-foreground-muted)]"
              onClick={handleRebuildAll}
              disabled={rebuildingExtension !== null}
              role="menuitem"
            >
              <MaterialSymbol icon="select_all" size={18} />
              <span className="min-w-0 flex-1">{rebuildingExtension === 'all' ? 'Rebuilding all...' : 'All Extensions'}</span>
            </button>

            {extensions.length > 0 && (
              <div className="agent-elements-extension-dev-divider mx-2 my-1 h-px bg-[var(--an-border-color)]" />
            )}

            {extensions.map((ext) => (
              <button
                key={ext.id}
                type="button"
                className="extension-dev-menu-action agent-elements-extension-dev-action flex w-full items-center gap-2.5 rounded-[var(--an-tool-border-radius)] border-0 bg-transparent px-2.5 py-2 text-left text-[13px] leading-5 text-[var(--an-foreground)] cursor-pointer transition-[background-color,color] duration-150 hover:enabled:bg-[var(--an-background-tertiary)] disabled:cursor-not-allowed disabled:text-[var(--an-foreground-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2 [&_.material-symbols-outlined]:text-[var(--an-foreground-muted)]"
                onClick={() => handleRebuildExtension(ext)}
                disabled={rebuildingExtension !== null}
                role="menuitem"
              >
                <MaterialSymbol icon="extension" size={18} />
                <span className="min-w-0 flex-1 truncate">
                  {rebuildingExtension === ext.id ? 'Rebuilding...' : ext.name}
                </span>
              </button>
            ))}

            {extensions.length === 0 && (
              <div className="px-2.5 py-2 text-xs leading-4 text-[var(--an-foreground-subtle)]">
                No buildable extensions found
              </div>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
};
