/**
 * FloatingEditorActions - Floating action buttons for custom editors
 *
 * Provides consistent floating buttons (like "View Source") for custom editors.
 * Positioned in the top-right corner of the editor area.
 *
 * Usage:
 * ```tsx
 * <FloatingEditorActions>
 *   <FloatingEditorButton
 *     icon="code"
 *     label="View Source"
 *     onClick={() => host.toggleSourceMode?.()}
 *   />
 * </FloatingEditorActions>
 * ```
 */

import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { FloatingPortal, useFloatingMenu } from '../../hooks/useFloatingMenu';

const floatingEditorMenuCardGutters = '[--agent-elements-card-block-padding:var(--an-spacing-xs)] [--agent-elements-card-inline-padding:var(--an-spacing-xs)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';

interface FloatingEditorActionsProps {
  children: React.ReactNode;
}

/**
 * Container for floating action buttons in custom editors.
 * Positioned in the top-right corner with proper z-index.
 */
export const FloatingEditorActions: React.FC<FloatingEditorActionsProps> = ({
  children,
}) => {
  return (
    <div
      className="floating-editor-actions agent-elements-floating-editor-actions pointer-events-none absolute right-3 top-1.5 z-[100] flex gap-2"
      data-agent-elements-shell="floating-editor-actions"
      data-component="FloatingEditorActions"
    >
      {children}
    </div>
  );
};

interface FloatingEditorButtonProps {
  /** Icon name (uses Material Symbols) or custom icon element */
  icon?: string | React.ReactNode;
  /** Button label (shown in tooltip) */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Whether button is active/pressed */
  isActive?: boolean;
  /** Whether button is disabled */
  disabled?: boolean;
}

/**
 * A floating action button for custom editors.
 * Consistent with the editor's FloatingDocumentActionsPlugin styling.
 */
export const FloatingEditorButton: React.FC<FloatingEditorButtonProps> = ({
  icon,
  label,
  onClick,
  isActive = false,
  disabled = false,
}) => {
  return (
    <button
      className={`floating-editor-button agent-elements-floating-editor-button pointer-events-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-0 text-[var(--an-foreground-muted)] shadow-[0_10px_24px_color-mix(in_srgb,var(--an-foreground)_8%,transparent)] transition-colors duration-150 hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-secondary)] hover:text-[var(--an-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-primary-color)] disabled:cursor-not-allowed disabled:opacity-50 ${isActive ? 'active border-[var(--an-primary-color)] bg-[color-mix(in_srgb,var(--an-primary-color)_12%,var(--an-background))] text-[var(--an-primary-color)]' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      data-agent-elements-shell="floating-editor-button"
      data-active={isActive ? 'true' : 'false'}
      data-component="FloatingEditorButton"
    >
      {typeof icon === 'string' ? (
        <MaterialSymbol icon={icon} size={18} />
      ) : (
        icon
      )}
    </button>
  );
};

/**
 * A dropdown menu that appears when clicking a floating button.
 */
interface FloatingEditorMenuProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement>;
}

export const FloatingEditorMenu: React.FC<FloatingEditorMenuProps> = ({
  children,
  isOpen,
  onClose,
  anchorRef,
}) => {
  const menu = useFloatingMenu({
    placement: 'bottom-end',
    offsetPx: 8,
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
    reference: anchorRef?.current ?? null,
  });

  if (!isOpen) return null;

  return (
    <FloatingPortal>
      <div
        className="floating-editor-menu-backdrop agent-elements-floating-editor-menu-backdrop fixed inset-0 z-[99]"
        data-agent-elements-shell="floating-editor-menu-backdrop"
        onClick={onClose}
      />
      <div
        ref={menu.refs.setFloating}
        className={`floating-editor-menu agent-elements-floating-editor-menu agent-elements-tool-card pointer-events-auto z-[1000] min-w-[180px] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[13px] text-[var(--an-foreground)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)] ${floatingEditorMenuCardGutters}`}
        style={menu.floatingStyles}
        {...menu.getFloatingProps()}
        data-agent-elements-shell="floating-editor-menu"
        data-agent-elements-card-padding="symmetric-inline"
        data-agent-elements-card-width="floating-menu"
        data-component="FloatingEditorMenu"
        role="menu"
      >
        {children}
      </div>
    </FloatingPortal>
  );
};

interface FloatingEditorMenuItemProps {
  label: string;
  onClick: () => void;
  icon?: string;
  isActive?: boolean;
}

export const FloatingEditorMenuItem: React.FC<FloatingEditorMenuItemProps> = ({
  label,
  onClick,
  icon,
  isActive = false,
}) => {
  return (
    <button
      className={`floating-editor-menu-item agent-elements-floating-editor-menu-item flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--an-small-border-radius)] border-none bg-transparent px-3 py-2 text-left text-[13px] text-[var(--an-foreground)] transition-colors duration-150 hover:bg-[var(--an-background-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-primary-color)] ${isActive ? 'active text-[var(--an-primary-color)]' : ''}`}
      onClick={onClick}
      aria-current={isActive ? 'true' : undefined}
      data-active={isActive ? 'true' : 'false'}
      data-agent-elements-shell="floating-editor-menu-item"
      role="menuitem"
    >
      {icon && <MaterialSymbol icon={icon} size={18} />}
      <span className="agent-elements-floating-editor-menu-label">{label}</span>
      {isActive && (
        <span className="checkmark agent-elements-floating-editor-menu-check ml-auto text-[var(--an-primary-color)]" aria-hidden="true">
          <MaterialSymbol icon="check" size={16} />
        </span>
      )}
    </button>
  );
};
