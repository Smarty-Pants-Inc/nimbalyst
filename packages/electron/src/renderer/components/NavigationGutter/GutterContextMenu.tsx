import React, { useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { useFloatingMenu, FloatingPortal, virtualElement } from '../../hooks/useFloatingMenu';
import {
  type HideableGutterButton,
  hiddenGutterButtonsAtom,
  toggleGutterButtonHiddenAtom,
  showAllGutterButtonsAtom,
} from '../../store/atoms/projectState';

/** Human-readable labels and icons for hideable gutter buttons */
const BUTTON_META: Record<HideableGutterButton, { label: string; icon: string }> = {
  'voice-mode':     { label: 'Voice Mode',     icon: 'mic' },
  'trust-indicator': { label: 'Permissions',    icon: 'verified_user' },
  'sync-status':    { label: 'Sync Status',    icon: 'sync' },
  'theme-toggle':   { label: 'Theme Toggle',   icon: 'dark_mode' },
  'feedback':       { label: 'Feedback',       icon: 'feedback' },
  'claude-usage':   { label: 'Claude Usage',   icon: 'speed' },
  'codex-usage':    { label: 'Codex Usage',    icon: 'speed' },
  'extension-dev':  { label: 'Extension Dev',  icon: 'extension' },
};

interface GutterContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  /** When set, show "Hide <button>" as the primary action */
  targetButton?: HideableGutterButton;
  workspacePath: string;
}

export function GutterContextMenu({ x, y, onClose, targetButton, workspacePath }: GutterContextMenuProps) {
  const hiddenButtons = useAtomValue(hiddenGutterButtonsAtom);
  const toggleHidden = useSetAtom(toggleGutterButtonHiddenAtom);
  const showAll = useSetAtom(showAllGutterButtonsAtom);

  const vRef = useMemo(() => virtualElement(x, y), [x, y]);

  const menu = useFloatingMenu({
    placement: 'right-start',
    reference: vRef,
    open: true,
    onOpenChange: (open) => { if (!open) onClose(); },
  });

  const hasHidden = hiddenButtons.length > 0;
  const menuShellClasses = 'gutter-context-menu agent-elements-gutter-context-menu agent-elements-tool-card min-w-[180px] overflow-hidden rounded-[10px] border border-nim bg-nim-secondary p-1 text-[13px] shadow-[0_12px_32px_color-mix(in_srgb,var(--nim-text)_10%,transparent)] z-[10000]';
  const menuItemClasses = 'agent-elements-gutter-context-menu-item flex w-full items-center gap-2.5 rounded-[8px] border-0 bg-transparent px-3 py-2 text-left text-[13px] leading-5 text-nim transition-[background-color,color] duration-150 cursor-pointer select-none hover:bg-nim-hover focus-visible:outline-2 focus-visible:outline-[var(--nim-primary)] focus-visible:outline-offset-2';
  const separatorClasses = 'agent-elements-gutter-context-menu-separator mx-2 my-1 h-px bg-[var(--nim-border)]';

  const renderMenuItem = ({
    id,
    action,
    icon,
    label,
    onClick,
  }: {
    id?: HideableGutterButton;
    action: 'hide' | 'show' | 'show-all';
    icon: string;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      className={menuItemClasses}
      onClick={onClick}
      role="menuitem"
      data-testid={`agent-elements-gutter-context-menu-${action}${id ? `-${id}` : ''}`}
      data-agent-elements-shell="gutter-context-menu-item"
      data-gutter-action={action}
      data-gutter-button={id}
    >
      <span className="agent-elements-gutter-context-menu-icon flex h-5 w-5 shrink-0 items-center justify-center text-nim-muted">
        <MaterialSymbol icon={icon} size={18} />
      </span>
      <span className="agent-elements-gutter-context-menu-label min-w-0 truncate">{label}</span>
    </button>
  );

  return (
    <FloatingPortal>
      <div
        ref={menu.refs.setFloating}
        style={menu.floatingStyles}
        {...menu.getFloatingProps()}
        className={menuShellClasses}
        data-component="GutterContextMenu"
        data-testid="gutter-context-menu"
        data-agent-elements-shell="gutter-context-menu"
      >
        {/* If right-clicked on a specific button, show hide option */}
        {targetButton && !hiddenButtons.includes(targetButton) && (
          <>
            {renderMenuItem({
              id: targetButton,
              action: 'hide',
              icon: 'visibility_off',
              label: `Hide ${BUTTON_META[targetButton].label}`,
              onClick: () => {
                toggleHidden({ buttonId: targetButton, workspacePath });
                onClose();
              },
            })}
            {hasHidden && <div className={separatorClasses} data-agent-elements-shell="gutter-context-menu-separator" />}
          </>
        )}

        {/* Show hidden buttons that can be restored */}
        {hasHidden && (
          <>
            {hiddenButtons.map((id) => (
              <React.Fragment key={id}>
                {renderMenuItem({
                  id,
                  action: 'show',
                  icon: 'visibility',
                  label: `Show ${BUTTON_META[id].label}`,
                  onClick: () => {
                    toggleHidden({ buttonId: id, workspacePath });
                    onClose();
                  },
                })}
              </React.Fragment>
            ))}
            <div className={separatorClasses} data-agent-elements-shell="gutter-context-menu-separator" />
            {renderMenuItem({
              action: 'show-all',
              icon: 'restart_alt',
              label: 'Show All',
              onClick: () => {
                showAll(workspacePath);
                onClose();
              },
            })}
          </>
        )}

        {/* If nothing to show (no target, nothing hidden) */}
        {!targetButton && !hasHidden && (
          <div
            className="agent-elements-gutter-context-menu-empty px-3 py-2 text-center text-[13px] leading-5 text-nim-muted"
            data-testid="agent-elements-gutter-context-menu-empty"
            data-agent-elements-shell="gutter-context-menu-empty"
          >
            Right-click buttons to hide them
          </div>
        )}
      </div>
    </FloatingPortal>
  );
}
