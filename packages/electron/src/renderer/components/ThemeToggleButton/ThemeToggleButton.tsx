import React, { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { themeIdAtom } from '@nimbalyst/runtime/store';
import {
  getAllAvailableThemesAsync,
} from '../../hooks/useTheme';
import { themeListChangedVersionAtom } from '../../store/atoms/themeList';
import { HelpTooltip } from '../../help';
import { FloatingPortal, useFloatingMenu } from '../../hooks/useFloatingMenu';

interface ThemeToggleButtonProps {
  className?: string;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({ className = '' }) => {
  // Theme state lives in themeIdAtom; updated by store/listeners/themeListeners.ts
  const currentTheme = useAtomValue(themeIdAtom) as string;

  const [availableThemes, setAvailableThemes] = useState<Array<{
    id: string;
    name: string;
    isDark: boolean;
  }>>([]);
  const menu = useFloatingMenu({ placement: 'right-end', offsetPx: 8, constrainHeight: true });

  // Load available themes; refresh when extensions register/unregister
  // themes. The IPC event is handled centrally in
  // store/listeners/themeListeners.ts and surfaced via
  // themeListChangedVersionAtom -- using it as a dep re-runs this effect on
  // every bump.
  const themeListVersion = useAtomValue(themeListChangedVersionAtom);
  useEffect(() => {
    let cancelled = false;
    const loadThemes = async () => {
      const themes = await getAllAvailableThemesAsync();
      if (!cancelled) setAvailableThemes(themes);
    };

    loadThemes();

    return () => {
      cancelled = true;
    };
  }, [themeListVersion]);

  const selectTheme = (themeId: string) => {
    menu.setIsOpen(false);

    // Find the theme to get its isDark property
    const theme = availableThemes.find(t => t.id === themeId);
    const isDark = theme?.isDark ?? false;

    // Send theme change to main process for persistence and cross-window sync.
    // Main process broadcasts back via theme-change, picked up by themeListeners,
    // which updates themeIdAtom and re-renders this component.
    if (window.electronAPI?.send) {
      window.electronAPI.send('set-theme', themeId, isDark);
    }
  };

  const getThemeIcon = (themeId: string, isDark: boolean): string => {
    switch (themeId) {
      case 'light':
        return 'light_mode';
      case 'dark':
        return 'dark_mode';
      case 'crystal-dark':
        return 'bedtime';
      default:
        return 'palette';
    }
  };

  const getCurrentThemeIcon = (): string => {
    const theme = availableThemes.find(t => t.id === currentTheme);
    if (theme) {
      return getThemeIcon(theme.id, theme.isDark);
    }
    // Fallback for built-in themes
    switch (currentTheme) {
      case 'light':
        return 'light_mode';
      case 'dark':
        return 'dark_mode';
      case 'crystal-dark':
        return 'bedtime';
      default:
        return 'light_mode';
    }
  };

  return (
    <div
      className="theme-toggle-control agent-elements-theme-toggle relative"
      data-testid="agent-elements-theme-toggle"
      data-component="ThemeToggleButton"
      data-agent-elements-shell="theme-toggle"
    >
      <HelpTooltip testId="gutter-theme-button" placement="right">
        <button
          ref={menu.refs.setReference as React.RefCallback<HTMLButtonElement>}
          {...menu.getReferenceProps()}
          className={`theme-toggle-button nav-button agent-elements-theme-toggle-button relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--an-tool-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)] ${className}`}
          onClick={() => menu.setIsOpen(!menu.isOpen)}
          aria-label="Change theme"
          aria-expanded={menu.isOpen}
          aria-haspopup="menu"
          data-testid="gutter-theme-button"
          data-component="ThemeToggleButton"
          data-agent-elements-shell="theme-toggle-button"
          data-theme-id={currentTheme}
        >
          <MaterialSymbol icon={getCurrentThemeIcon()} size={20} />
        </button>
      </HelpTooltip>

      {menu.isOpen && (
        <FloatingPortal>
          <div
            ref={menu.refs.setFloating as React.RefCallback<HTMLDivElement>}
            style={menu.floatingStyles}
            {...menu.getFloatingProps()}
            className="theme-menu agent-elements-theme-toggle-menu agent-elements-tool-card z-[1000] max-h-[min(360px,calc(100vh-24px))] min-w-[208px] overflow-y-auto rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-1 text-[var(--an-foreground)] shadow-[0_16px_48px_color-mix(in_srgb,var(--nim-text)_16%,transparent)]"
            role="menu"
            aria-label="Theme selection"
            data-testid="agent-elements-theme-toggle-menu"
            data-component="ThemeToggleMenu"
            data-agent-elements-shell="theme-toggle-menu"
          >
            {availableThemes.map(theme => {
              const isSelected = currentTheme === theme.id;

              return (
                <button
                  key={theme.id}
                  className={`theme-menu-item agent-elements-theme-toggle-menu-item flex w-full cursor-pointer items-center gap-2 rounded-[var(--an-tool-border-radius)] border border-transparent bg-transparent px-3 py-2 text-left text-[13px] text-[var(--an-foreground)] transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] ${
                    isSelected
                      ? 'border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))]'
                      : 'hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)]'
                  }`}
                  onClick={() => selectTheme(theme.id)}
                  role="menuitemradio"
                  aria-checked={isSelected}
                  data-agent-elements-shell="theme-toggle-menu-item"
                  data-theme-id={theme.id}
                  data-selected={isSelected ? 'true' : 'false'}
                >
                  <span
                    className="theme-icon agent-elements-theme-toggle-menu-item-icon flex w-5 shrink-0 justify-center text-[var(--an-foreground-muted)]"
                    data-agent-elements-shell="theme-toggle-menu-item-icon"
                  >
                    <MaterialSymbol icon={getThemeIcon(theme.id, theme.isDark)} size={18} />
                  </span>
                  <span className="theme-name min-w-0 flex-1 truncate whitespace-nowrap">{theme.name}</span>
                  {isSelected ? (
                    <span
                      className="theme-check agent-elements-theme-toggle-menu-item-check flex w-4 shrink-0 justify-center text-[var(--an-primary-color)]"
                      data-agent-elements-shell="theme-toggle-menu-item-check"
                      aria-hidden="true"
                    >
                      <MaterialSymbol icon="check" size={16} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
};
