import React, { useMemo } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { useFloatingMenu, FloatingPortal, virtualElement } from '../../hooks/useFloatingMenu';

const floatingMenuCardGutters = '[--agent-elements-card-block-padding:var(--an-spacing-xs)] [--agent-elements-card-inline-padding:var(--an-spacing-xs)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';

interface TerminalContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onClear: () => void;
}

export function TerminalContextMenu({
  x,
  y,
  onClose,
  onClear,
}: TerminalContextMenuProps) {
  const reference = useMemo(() => virtualElement(x, y), [x, y]);
  const menu = useFloatingMenu({
    placement: 'right-start',
    reference,
    open: true,
    onOpenChange: (open) => { if (!open) onClose(); },
  });

  const handleClear = () => {
    onClear();
    onClose();
  };

  const menuItemClasses =
    'terminal-context-menu-item agent-elements-terminal-context-menu-item flex w-full items-center gap-2.5 rounded-[var(--an-small-border-radius)] border-none bg-transparent px-3 py-2 text-left text-[13px] text-[var(--an-foreground)] transition-colors duration-150 hover:bg-[var(--an-background-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-primary-color)]';

  return (
    <FloatingPortal>
      <div
        ref={menu.refs.setFloating}
        style={menu.floatingStyles}
        {...menu.getFloatingProps()}
        className={`terminal-context-menu agent-elements-terminal-context-menu agent-elements-tool-card z-[10000] min-w-[148px] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[13px] text-[var(--an-foreground)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)] ${floatingMenuCardGutters}`}
        data-component="TerminalContextMenu"
        data-agent-elements-shell="terminal-context-menu"
        data-agent-elements-card-padding="symmetric-inline"
        data-agent-elements-card-width="floating-menu"
        data-testid="terminal-context-menu"
      >
        <button
          type="button"
          className={menuItemClasses}
          onClick={handleClear}
          data-agent-elements-shell="terminal-context-menu-item"
          data-testid="agent-elements-terminal-context-menu-clear"
        >
          <MaterialSymbol icon="backspace" size={18} />
          <span className="agent-elements-terminal-context-menu-label" data-command="clear">Clear</span>
        </button>
      </div>
    </FloatingPortal>
  );
}
