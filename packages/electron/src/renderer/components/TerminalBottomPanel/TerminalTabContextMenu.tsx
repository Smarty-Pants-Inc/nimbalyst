/**
 * TerminalTabContextMenu - Context menu for terminal tabs
 *
 * Provides options to close the tab, close other tabs, close all tabs,
 * and close tabs to the right.
 */

import React, { useMemo } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { useFloatingMenu, FloatingPortal, virtualElement } from '../../hooks/useFloatingMenu';

interface TerminalTabContextMenuProps {
  x: number;
  y: number;
  terminalId: string;
  terminalCount: number;
  terminalIndex: number;
  onClose: () => void;
  onCloseTab: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onCloseToRight: () => void;
}

export function TerminalTabContextMenu({
  x,
  y,
  terminalId,
  terminalCount,
  terminalIndex,
  onClose,
  onCloseTab,
  onCloseOthers,
  onCloseAll,
  onCloseToRight,
}: TerminalTabContextMenuProps) {
  const reference = useMemo(() => virtualElement(x, y), [x, y]);
  const menu = useFloatingMenu({
    placement: 'right-start',
    reference,
    open: true,
    onOpenChange: (open) => { if (!open) onClose(); },
  });

  // Calculate how many tabs are to the right
  const tabsToRight = terminalCount - terminalIndex - 1;
  const hasOtherTabs = terminalCount > 1;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const menuItemClasses =
    'terminal-tab-context-menu-item agent-elements-terminal-tab-menu-item flex w-full items-center gap-2.5 rounded-[8px] border-none bg-transparent px-3 py-2 text-left text-[13px] text-[var(--an-foreground)] transition-colors duration-150 hover:bg-[var(--an-background-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-primary-color)]';
  const disabledMenuItemClasses =
    'terminal-tab-context-menu-item agent-elements-terminal-tab-menu-item agent-elements-terminal-tab-menu-item-disabled flex w-full items-center gap-2.5 rounded-[8px] border-none bg-transparent px-3 py-2 text-left text-[13px] text-[var(--an-foreground-subtle)] opacity-60 cursor-not-allowed';

  return (
    <FloatingPortal>
      <div
        ref={menu.refs.setFloating}
        style={menu.floatingStyles}
        {...menu.getFloatingProps()}
        className="terminal-tab-context-menu agent-elements-terminal-tab-menu agent-elements-tool-card z-[10000] min-w-[176px] rounded-[10px] border border-[var(--an-border-color)] bg-[var(--an-background)] p-1 text-[13px] text-[var(--an-foreground)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]"
        data-agent-elements-shell="terminal-tab-context-menu"
        data-agent-elements-testid="agent-elements-terminal-tab-menu"
        data-component="TerminalTabContextMenu"
        data-terminal-id={terminalId}
        data-testid="terminal-tab-context-menu"
      >
        <button
          type="button"
          className={menuItemClasses}
          data-agent-elements-shell="terminal-menu-item"
          data-terminal-action="close"
          data-testid="agent-elements-terminal-menu-close"
          onClick={() => handleAction(onCloseTab)}
        >
          <MaterialSymbol icon="close" size={18} />
          <span className="agent-elements-terminal-tab-menu-label" data-command="close">Close</span>
        </button>

        <button
          type="button"
          className={hasOtherTabs ? menuItemClasses : disabledMenuItemClasses}
          data-agent-elements-shell="terminal-menu-item"
          data-terminal-action="close-others"
          data-testid="agent-elements-terminal-menu-close-others"
          disabled={!hasOtherTabs}
          aria-disabled={!hasOtherTabs}
          onClick={hasOtherTabs ? () => handleAction(onCloseOthers) : undefined}
        >
          <MaterialSymbol icon="tab_close" size={18} />
          <span className="agent-elements-terminal-tab-menu-label" data-command="close-others">Close Others</span>
        </button>

        <button
          type="button"
          className={tabsToRight > 0 ? menuItemClasses : disabledMenuItemClasses}
          data-agent-elements-shell="terminal-menu-item"
          data-terminal-action="close-right"
          data-testid="agent-elements-terminal-menu-close-right"
          disabled={tabsToRight <= 0}
          aria-disabled={tabsToRight <= 0}
          onClick={tabsToRight > 0 ? () => handleAction(onCloseToRight) : undefined}
        >
          <MaterialSymbol icon="tab_close_right" size={18} />
          <span className="agent-elements-terminal-tab-menu-label" data-command="close-right">Close to the Right</span>
        </button>

        <div
          className="agent-elements-terminal-menu-separator my-1 h-px bg-[var(--an-border-color)]"
          data-agent-elements-shell="terminal-menu-separator"
        />

        <button
          type="button"
          className={menuItemClasses}
          data-agent-elements-shell="terminal-menu-item"
          data-terminal-action="close-all"
          data-testid="agent-elements-terminal-menu-close-all"
          onClick={() => handleAction(onCloseAll)}
        >
          <MaterialSymbol icon="cancel" size={18} />
          <span className="agent-elements-terminal-tab-menu-label" data-command="close-all">Close All</span>
        </button>
      </div>
    </FloatingPortal>
  );
}
