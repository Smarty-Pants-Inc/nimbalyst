import React, { useMemo } from 'react';
import { MaterialSymbol, type NewFileMenuContribution } from '@nimbalyst/runtime';
import { useFloatingMenu, FloatingPortal, virtualElement } from '../hooks/useFloatingMenu';

const floatingMenuCardGutters = '[--agent-elements-card-block-padding:var(--an-spacing-xs)] [--agent-elements-card-inline-padding:var(--an-spacing-xs)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';

// Built-in file types
export type BuiltInFileType = 'markdown' | 'mockup' | 'any';

// File type can be built-in or an extension-provided type (by extension string)
export type NewFileType = BuiltInFileType | string;

export interface ExtensionFileType {
  extension: string;
  displayName: string;
  icon: string;
  defaultContent: string;
}

interface NewFileMenuProps {
  x: number;
  y: number;
  onSelect: (fileType: NewFileType) => void;
  onClose: () => void;
  /** Extension-contributed file types */
  extensionFileTypes?: ExtensionFileType[];
}

export function NewFileMenu({
  x,
  y,
  onSelect,
  onClose,
  extensionFileTypes = []
}: NewFileMenuProps) {
  const reference = useMemo(() => virtualElement(x, y), [x, y]);
  const menu = useFloatingMenu({
    placement: 'right-start',
    reference,
    open: true,
    onOpenChange: (open) => { if (!open) onClose(); },
  });

  const handleSelect = (fileType: NewFileType) => {
    onSelect(fileType);
    onClose();
  };

  const renderMenuItem = ({
    id,
    itemKey,
    fileType,
    icon,
    label,
  }: {
    id: string;
    itemKey?: string;
    fileType: NewFileType;
    icon: string;
    label: string;
  }) => (
    <button
      key={itemKey ?? id}
      type="button"
      className="new-file-menu-item agent-elements-new-file-menu-item flex w-full items-center gap-2.5 rounded-[var(--an-small-border-radius)] border-0 bg-transparent px-3 py-2 text-left text-[13px] leading-5 text-[var(--an-foreground)] transition-[background-color,color] duration-150 cursor-pointer select-none hover:bg-[var(--an-background-tertiary)] focus-visible:outline-2 focus-visible:outline-[var(--an-input-focus-outline)] focus-visible:outline-offset-2"
      onClick={() => handleSelect(fileType)}
      role="menuitem"
      data-testid={`agent-elements-new-file-menu-${id}`}
      data-agent-elements-shell="new-file-menu-item"
      data-file-type={fileType}
    >
      <span className="agent-elements-new-file-menu-icon flex h-5 w-5 shrink-0 items-center justify-center text-[var(--an-foreground-muted)]">
        <MaterialSymbol icon={icon} size={18} />
      </span>
      <span className="agent-elements-new-file-menu-label min-w-0 truncate">{label}</span>
    </button>
  );

  return (
    <FloatingPortal>
      <div
        ref={menu.refs.setFloating}
        style={menu.floatingStyles}
        {...menu.getFloatingProps()}
        className={`new-file-menu agent-elements-new-file-menu agent-elements-tool-card min-w-[200px] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[13px] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)] z-[10000] ${floatingMenuCardGutters}`}
        data-component="NewFileMenu"
        data-testid="agent-elements-new-file-menu"
        data-agent-elements-shell="new-file-menu"
        data-agent-elements-card-padding="symmetric-inline"
        data-agent-elements-card-width="floating-menu"
      >
        {renderMenuItem({
          id: 'markdown',
          fileType: 'markdown',
          icon: 'description',
          label: 'New Markdown File',
        })}

        {renderMenuItem({
          id: 'mockup',
          fileType: 'mockup',
          icon: 'web',
          label: 'New Mockup',
        })}

        {/* Extension-contributed file types */}
        {extensionFileTypes.map((extType) => renderMenuItem({
          id: `ext-${extType.extension}`,
          itemKey: extType.extension,
          fileType: `ext:${extType.extension}`,
          icon: extType.icon,
          label: `New ${extType.displayName}`,
        }))}

        <div
          className="new-file-menu-separator agent-elements-new-file-menu-separator mx-2 my-1 h-px bg-[var(--an-border-color)]"
          data-testid="agent-elements-new-file-menu-separator"
          data-agent-elements-shell="new-file-menu-separator"
        />

        {renderMenuItem({
          id: 'any',
          fileType: 'any',
          icon: 'note_add',
          label: 'New File...',
        })}
      </div>
    </FloatingPortal>
  );
}

/**
 * Convert NewFileMenuContribution from extension to ExtensionFileType
 */
export function contributionToExtensionFileType(
  contribution: NewFileMenuContribution
): ExtensionFileType {
  return {
    extension: contribution.extension,
    displayName: contribution.displayName,
    icon: contribution.icon,
    defaultContent: contribution.defaultContent,
  };
}
