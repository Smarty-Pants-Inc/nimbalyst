import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import type { NewFileType, ExtensionFileType } from './NewFileMenu';
import { CommonFileActions } from './CommonFileActions';
import { useFloatingMenu, FloatingPortal, virtualElement } from '../hooks/useFloatingMenu';
import { historyDialogFileAtom } from '../store';

interface FileContextMenuProps {
  x: number;
  y: number;
  filePath: string;
  fileName: string;
  fileType: 'file' | 'directory';
  onClose: () => void;
  onRename: (filePath: string, newName: string) => void;
  onDelete: (filePath: string) => void;
  onDeleteMultiple?: (filePaths: string[]) => void;
  onNewFile?: (folderPath: string, fileType: NewFileType) => void;
  onNewFolder?: (folderPath: string) => void;
  onViewWorkspaceHistory?: (folderPath: string) => void;
  selectedPaths?: Set<string>;
  /** Extension-contributed file types */
  extensionFileTypes?: ExtensionFileType[];
}

export function FileContextMenu({
  x,
  y,
  filePath,
  fileName,
  fileType,
  onClose,
  onRename,
  onDelete,
  onDeleteMultiple,
  onNewFile,
  onNewFolder,
  onViewWorkspaceHistory,
  selectedPaths,
  extensionFileTypes = []
}: FileContextMenuProps) {
  const openHistoryDialog = useSetAtom(historyDialogFileAtom);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(fileName);
  const inputRef = useRef<HTMLInputElement>(null);
  const reference = useMemo(() => virtualElement(x, y), [x, y]);

  const menu = useFloatingMenu({
    placement: 'right-start',
    reference,
    open: true,
    onOpenChange: (open) => {
      if (!open && !isRenaming) onClose();
    },
  });

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      // Select filename without extension for files
      if (fileType === 'file') {
        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex > 0) {
          inputRef.current.setSelectionRange(0, lastDotIndex);
        } else {
          inputRef.current.select();
        }
      } else {
        inputRef.current.select();
      }
    }
  }, [isRenaming]); // Only run when isRenaming changes, not when typing

  const handleRenameClick = () => {
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    if (newName && newName !== fileName) {
      onRename(filePath, newName);
    }
    setIsRenaming(false);
    onClose();
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setNewName(fileName);
    }
  };

  const handleDelete = () => {
    // Check if we have multiple items selected
    const hasMultipleSelected = selectedPaths && selectedPaths.size > 1;

    if (hasMultipleSelected && onDeleteMultiple) {
      const selectedArray = Array.from(selectedPaths);
      const confirmMessage = `Are you sure you want to delete ${selectedArray.length} items?`;

      if (window.confirm(confirmMessage)) {
        onDeleteMultiple(selectedArray);
        onClose();
      }
    } else {
      const confirmMessage = fileType === 'directory'
        ? `Are you sure you want to delete the folder "${fileName}" and all its contents?`
        : `Are you sure you want to delete "${fileName}"?`;

      if (window.confirm(confirmMessage)) {
        onDelete(filePath);
        onClose();
      }
    }
  };

  const hasMultipleSelected = selectedPaths && selectedPaths.size > 1;

  const floatingMenuCardGutters = "[--agent-elements-card-block-padding:var(--an-spacing-xs)] [--agent-elements-card-inline-padding:var(--an-spacing-xs)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]";
  const menuShellClasses = `file-context-menu agent-elements-file-context-menu agent-elements-tool-card min-w-[200px] max-h-[calc(100vh-20px)] overflow-y-auto rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] text-[13px] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)] z-[10000] ${floatingMenuCardGutters}`;
  const renameMenuShellClasses = `file-context-menu file-context-menu-rename agent-elements-file-context-menu-rename agent-elements-tool-card min-w-[250px] rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)] z-[10000] ${floatingMenuCardGutters}`;
  const menuItemClasses = "file-context-menu-item agent-elements-file-context-menu-item flex w-full items-center gap-2.5 rounded-[var(--an-small-border-radius)] border-0 bg-transparent px-3 py-2 text-left text-[13px] leading-5 text-[var(--an-tool-color)] transition-[background-color,color] duration-150 cursor-pointer select-none hover:bg-[var(--an-background-tertiary)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2";
  const dangerItemClasses = "file-context-menu-item file-context-menu-item-danger agent-elements-file-context-menu-item agent-elements-file-context-menu-item-danger flex w-full items-center gap-2.5 rounded-[var(--an-small-border-radius)] border-0 bg-transparent px-3 py-2 text-left text-[13px] leading-5 text-[var(--an-error-color)] transition-[background-color,color] duration-150 cursor-pointer select-none hover:bg-[color-mix(in_srgb,var(--an-error-color)_12%,transparent)] focus-visible:outline-2 focus-visible:outline-[var(--an-error-color)] focus-visible:outline-offset-2";
  const separatorClasses = "context-menu-separator agent-elements-file-context-menu-separator h-px my-1 mx-2 bg-[var(--an-border-color)]";

  const renderSeparator = (id: string) => (
    <div
      className={separatorClasses}
      data-testid={`agent-elements-file-context-menu-separator-${id}`}
      data-agent-elements-shell="file-context-menu-separator"
    />
  );

  const renderMenuItem = ({
    id,
    itemKey,
    icon,
    label,
    onClick,
    danger = false,
  }: {
    id: string;
    itemKey?: string;
    icon: string;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) => (
    <button
      key={itemKey ?? id}
      type="button"
      className={danger ? dangerItemClasses : menuItemClasses}
      onClick={onClick}
      role="menuitem"
      data-testid={`agent-elements-file-context-menu-${id}`}
      data-agent-elements-shell={danger ? 'file-context-menu-danger-item' : 'file-context-menu-item'}
      data-file-context-action={id}
    >
      <span className="agent-elements-file-context-menu-icon flex h-5 w-5 shrink-0 items-center justify-center text-current">
        <MaterialSymbol icon={icon} size={18} />
      </span>
      <span className="agent-elements-file-context-menu-label min-w-0 truncate">{label}</span>
    </button>
  );

  if (isRenaming) {
    return (
      <FloatingPortal>
        <div
          ref={menu.refs.setFloating}
          style={menu.floatingStyles}
          {...menu.getFloatingProps()}
          className={renameMenuShellClasses}
          data-testid="agent-elements-file-context-menu-rename"
          data-agent-elements-shell="file-context-menu-rename"
          data-agent-elements-card-padding="symmetric-inline"
          data-agent-elements-card-width="floating-menu"
        >
          <div className="rename-input-container agent-elements-file-context-menu-rename-container flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleRenameSubmit}
              className="rename-input agent-elements-file-context-menu-rename-input w-full rounded-[var(--an-small-border-radius)] border border-[var(--an-input-focus-border)] bg-[var(--an-input-background)] px-2.5 py-2 text-[13px] leading-5 text-[var(--an-input-color)] outline-none transition-[border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--an-focus-ring)_25%,transparent)]"
              data-testid="agent-elements-file-context-menu-rename-input"
            />
          </div>
        </div>
      </FloatingPortal>
    );
  }

  // When multiple items are selected, show only batch-compatible options
  if (hasMultipleSelected) {
    return (
      <FloatingPortal>
        <div
          ref={menu.refs.setFloating}
          style={menu.floatingStyles}
          {...menu.getFloatingProps()}
          className={menuShellClasses}
          data-testid="agent-elements-file-context-menu"
          data-agent-elements-shell="file-context-menu"
          data-agent-elements-card-padding="symmetric-inline"
          data-agent-elements-card-width="floating-menu"
        >
          {renderMenuItem({
            id: 'delete-multiple',
            icon: 'delete',
            label: `Delete ${selectedPaths.size} Items`,
            onClick: handleDelete,
            danger: true,
          })}
        </div>
      </FloatingPortal>
    );
  }

  return (
    <FloatingPortal>
      <div
        ref={menu.refs.setFloating}
        style={menu.floatingStyles}
        {...menu.getFloatingProps()}
        className={menuShellClasses}
        data-testid="agent-elements-file-context-menu"
        data-agent-elements-shell="file-context-menu"
        data-agent-elements-card-padding="symmetric-inline"
        data-agent-elements-card-width="floating-menu"
      >
        {fileType === 'directory' && (
          <>
            {onNewFile && (
              <>
                {renderMenuItem({
                  id: 'new-markdown',
                  icon: 'description',
                  label: 'New Markdown File',
                  onClick: () => { onNewFile(filePath, 'markdown'); onClose(); },
                })}
                {renderMenuItem({
                  id: 'new-mockup',
                  icon: 'web',
                  label: 'New Mockup',
                  onClick: () => { onNewFile(filePath, 'mockup'); onClose(); },
                })}
                {extensionFileTypes.map((extType) => renderMenuItem({
                  id: `new-ext-${extType.extension}`,
                  itemKey: extType.extension,
                  icon: extType.icon,
                  label: `New ${extType.displayName}`,
                  onClick: () => { onNewFile(filePath, `ext:${extType.extension}`); onClose(); },
                }))}
                {renderMenuItem({
                  id: 'new-any',
                  icon: 'note_add',
                  label: 'New File...',
                  onClick: () => { onNewFile(filePath, 'any'); onClose(); },
                })}
              </>
            )}
            {onNewFolder && (
              renderMenuItem({
                id: 'new-folder',
                icon: 'create_new_folder',
                label: 'New Folder',
                onClick: () => { onNewFolder(filePath); onClose(); },
              })
            )}
            {(onNewFile || onNewFolder) && renderSeparator('new')}
            {onViewWorkspaceHistory && (
              renderMenuItem({
                id: 'history',
                icon: 'history',
                label: 'View Folder History...',
                onClick: () => { onViewWorkspaceHistory(filePath); onClose(); },
              })
            )}
          </>
        )}

        {fileType === 'file' && (
          renderMenuItem({
            id: 'history',
            icon: 'history',
            label: 'View History...',
            onClick: () => { openHistoryDialog(filePath); onClose(); },
          })
        )}

        {/* Common file actions (Open in Default App, External Editor, Finder, Copy Path, Share) */}
        <CommonFileActions
          filePath={filePath}
          fileName={fileName}
          onClose={onClose}
          menuItemClass={menuItemClasses}
          separatorClass={separatorClasses}
          useButtons
        />

        {renderSeparator('common')}

        {renderMenuItem({
          id: 'rename-action',
          icon: 'edit',
          label: 'Rename',
          onClick: handleRenameClick,
        })}

        {renderSeparator('rename')}

        {renderMenuItem({
          id: 'delete',
          icon: 'delete',
          label: 'Delete',
          onClick: handleDelete,
          danger: true,
        })}
      </div>
    </FloatingPortal>
  );
}
