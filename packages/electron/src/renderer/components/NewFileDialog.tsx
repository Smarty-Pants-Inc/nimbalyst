import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import type { NewFileType, ExtensionFileType } from './NewFileMenu';

interface FileTypeOption {
  id: NewFileType;
  label: string;
  icon: string;
  extension: string;
  defaultContent?: string;
}

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeItem[];
}

interface NewFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
  workspacePath: string;
  onCreateFile: (fileName: string, fileType: NewFileType) => void;
  /** Extension-contributed file types */
  extensionFileTypes?: ExtensionFileType[];
  /** Callback when directory changes */
  onDirectoryChange?: (directory: string) => void;
}

export const NewFileDialog: React.FC<NewFileDialogProps> = ({
  isOpen,
  onClose,
  currentDirectory,
  workspacePath,
  onCreateFile,
  extensionFileTypes = [],
  onDirectoryChange,
}) => {
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [selectedFileType, setSelectedFileType] = useState<NewFileType>('markdown');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [fileTree, setFileTree] = useState<FileTreeItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderPickerRef = useRef<HTMLDivElement>(null);

  // Load file tree when dialog opens
  useEffect(() => {
    if (!isOpen || !workspacePath || !window.electronAPI?.getFolderContents) return;

    const loadFileTree = async () => {
      try {
        const tree = await window.electronAPI.getFolderContents(workspacePath);
        setFileTree(tree);
      } catch (error) {
        console.error('Error loading file tree:', error);
      }
    };

    loadFileTree();
  }, [isOpen, workspacePath]);

  // Build file type options
  const fileTypeOptions = useMemo<FileTypeOption[]>(() => {
    const options: FileTypeOption[] = [
      { id: 'markdown', label: 'Markdown', icon: 'description', extension: '.md' },
      { id: 'mockup', label: 'Mockup', icon: 'web', extension: '.mockup.html' },
    ];

    // Add extension-contributed types
    extensionFileTypes.forEach((extType) => {
      options.push({
        id: `ext:${extType.extension}`,
        label: extType.displayName,
        icon: extType.icon,
        extension: extType.extension,
        defaultContent: extType.defaultContent,
      });
    });

    // Add "Other" option for any file type
    options.push({ id: 'any', label: 'Other', icon: 'note_add', extension: '' });

    return options;
  }, [extensionFileTypes]);

  // Get the currently selected file type option
  const currentFileType = useMemo(() => {
    return fileTypeOptions.find((opt) => opt.id === selectedFileType) || fileTypeOptions[0];
  }, [fileTypeOptions, selectedFileType]);

  // Compute the extension suffix to display
  const extensionSuffix = useMemo(() => {
    if (selectedFileType === 'any') {
      return ''; // User provides their own extension
    }
    // Check if the user already typed the extension
    const ext = currentFileType.extension;
    if (ext && !fileName.endsWith(ext)) {
      return ext;
    }
    return '';
  }, [selectedFileType, currentFileType, fileName]);

  useEffect(() => {
    if (isOpen) {
      setFileName('');
      setError('');
      setSelectedFileType('markdown');
      setShowFolderPicker(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close folder picker when clicking outside
  useEffect(() => {
    if (!showFolderPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (folderPickerRef.current && !folderPickerRef.current.contains(event.target as Node)) {
        setShowFolderPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFolderPicker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fileName.trim()) {
      setError('Please enter a file name');
      return;
    }

    // Check for invalid characters
    if (fileName.includes('/') || fileName.includes('\\')) {
      setError('File name cannot contain / or \\');
      return;
    }

    onCreateFile(fileName.trim(), selectedFileType);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showFolderPicker) {
        setShowFolderPicker(false);
      } else {
        onClose();
      }
    }
  };

  const handleFolderSelect = (folderPath: string) => {
    onDirectoryChange?.(folderPath);
    setShowFolderPicker(false);
  };

  // Recursively render folder tree for folder picker
  const renderFolderTree = (items: typeof fileTree, level = 0) => {
    const folders = items.filter((item) => item.type === 'directory');
    if (folders.length === 0) return null;

    return (
      <ul
        className="new-file-folder-list agent-elements-new-file-dialog-folder-list list-none m-0 p-0"
        data-agent-elements-shell="new-file-dialog-folder-list"
        style={{ paddingLeft: level > 0 ? 16 : 0 }}
      >
        {folders.map((folder) => {
          const isSelected = folder.path === currentDirectory;
          return (
            <li key={folder.path}>
              <div
                className={`new-file-folder-item agent-elements-new-file-dialog-folder-item flex items-center gap-2 py-1.5 px-2.5 rounded-[var(--an-tool-border-radius)] cursor-pointer text-[13px] border transition-[background-color,border-color,color] duration-150 ease-out ${
                  isSelected
                    ? 'bg-[var(--an-primary-color)] text-[var(--an-background)] border-[var(--an-primary-color)]'
                    : 'text-[var(--an-foreground)] border-transparent hover:bg-[var(--an-background-tertiary)] hover:border-[var(--an-border-color)]'
                }`}
                data-agent-elements-shell="new-file-dialog-folder-item"
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => handleFolderSelect(folder.path)}
              >
                <MaterialSymbol
                  icon="folder"
                  size={16}
                  className={isSelected ? 'text-[var(--an-background)]' : 'text-[var(--an-foreground-muted)]'}
                />
                <span>{folder.name}</span>
              </div>
              {folder.children && renderFolderTree(folder.children, level + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  if (!isOpen) return null;

  // Get relative path for display
  const relativePath = currentDirectory.startsWith(workspacePath)
    ? currentDirectory.slice(workspacePath.length + 1) || '/'
    : currentDirectory;

  const workspaceName = workspacePath.split('/').pop() || 'workspace';

  return (
    <div
      className="new-file-dialog-overlay nim-overlay agent-elements-new-file-dialog-backdrop bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)]"
      data-testid="agent-elements-new-file-dialog-backdrop"
      data-agent-elements-shell="new-file-dialog-backdrop"
      onClick={onClose}
    >
      <div
        className="new-file-dialog agent-elements-new-file-dialog agent-elements-tool-card w-[420px] max-w-[90vw] !gap-0 !p-0 overflow-hidden rounded-[var(--an-border-radius)] bg-[var(--an-background)] border border-[var(--an-border-color)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)]"
        data-testid="agent-elements-new-file-dialog"
        data-component="NewFileDialog"
        data-agent-elements-shell="new-file-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="new-file-dialog-header agent-elements-new-file-dialog-header p-[var(--an-spacing-xl)] border-b border-[var(--an-border-color)]"
          data-testid="agent-elements-new-file-dialog-header"
          data-agent-elements-shell="new-file-dialog-header"
        >
          <h2 className="m-0 text-sm font-medium text-[var(--an-foreground)]">
            New File
          </h2>
          <div className="mt-1 text-xs text-[var(--an-foreground-subtle)]">
            {relativePath === '/' ? workspaceName : relativePath}
          </div>
        </div>

        <div className="new-file-dialog-body agent-elements-new-file-dialog-body p-[var(--an-spacing-xl)]">
          <div className="new-file-field agent-elements-new-file-dialog-field mb-4" data-agent-elements-shell="new-file-dialog-field">
            <label className="block mb-1.5 text-[13px] font-medium text-[var(--an-foreground-muted)]">
              Type
            </label>
            <select
              value={selectedFileType}
              onChange={(e) => {
                setSelectedFileType(e.target.value as NewFileType);
                setError('');
              }}
              className="new-file-select agent-elements-new-file-dialog-select w-full py-2 px-3 pr-8 text-sm rounded-[var(--an-input-border-radius)] cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] bg-[var(--an-input-background)] border border-[var(--an-input-border-color)] text-[var(--an-input-color)] bg-[url('data:image/svg+xml,%3Csvg_xmlns=%27http://www.w3.org/2000/svg%27_width=%2712%27_height=%2712%27_viewBox=%270_0_12_12%27%3E%3Cpath_fill=%27%23969696%27_d=%27M3_4.5L6_7.5L9_4.5%27/%3E%3C/svg%3E')] bg-no-repeat bg-[right_12px_center]"
              data-testid="agent-elements-new-file-dialog-type"
              data-agent-elements-shell="new-file-dialog-select"
            >
              {fileTypeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="new-file-field agent-elements-new-file-dialog-field mb-4" data-agent-elements-shell="new-file-dialog-field">
            <label className="block mb-1.5 text-[13px] font-medium text-[var(--an-foreground-muted)]">
              Location
            </label>
            <div className="new-file-location-picker relative" ref={folderPickerRef}>
              <button
                type="button"
                className="new-file-location-button agent-elements-new-file-dialog-location w-full flex items-center gap-2 py-2 px-3 text-sm rounded-[var(--an-input-border-radius)] cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] bg-[var(--an-input-background)] border border-[var(--an-input-border-color)] text-[var(--an-input-color)]"
                data-testid="agent-elements-new-file-dialog-location"
                data-agent-elements-shell="new-file-dialog-location"
                onClick={() => setShowFolderPicker(!showFolderPicker)}
              >
                <MaterialSymbol icon="folder" size={16} />
                <span className="path agent-elements-new-file-dialog-path flex-1 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                  {relativePath}
                </span>
                <MaterialSymbol icon="expand_more" size={16} className="text-[var(--an-foreground-subtle)]" />
              </button>
              {showFolderPicker && fileTree.length > 0 && (
                <div
                  className="new-file-folder-picker agent-elements-new-file-dialog-folder-picker absolute top-[calc(100%+4px)] left-0 right-0 max-h-[250px] overflow-y-auto p-1 rounded-[var(--an-tool-border-radius)] z-[10001] bg-[var(--an-background)] border border-[var(--an-border-color)] shadow-[0_12px_36px_color-mix(in_srgb,var(--an-foreground)_16%,transparent)]"
                  data-testid="agent-elements-new-file-dialog-folder-picker"
                  data-agent-elements-shell="new-file-dialog-folder-picker"
                >
                  <div
                    className={`new-file-folder-item agent-elements-new-file-dialog-folder-item flex items-center gap-2 py-1.5 px-2.5 rounded-[var(--an-tool-border-radius)] cursor-pointer text-[13px] border transition-[background-color,border-color,color] duration-150 ease-out ${
                      currentDirectory === workspacePath
                        ? 'bg-[var(--an-primary-color)] text-[var(--an-background)] border-[var(--an-primary-color)]'
                        : 'text-[var(--an-foreground)] border-transparent hover:bg-[var(--an-background-tertiary)] hover:border-[var(--an-border-color)]'
                    }`}
                    data-agent-elements-shell="new-file-dialog-folder-item"
                    data-selected={currentDirectory === workspacePath ? 'true' : 'false'}
                    onClick={() => handleFolderSelect(workspacePath)}
                  >
                    <MaterialSymbol
                      icon="folder"
                      size={16}
                      className={currentDirectory === workspacePath ? 'text-[var(--an-background)]' : 'text-[var(--an-foreground-muted)]'}
                    />
                    <span>{workspaceName} (root)</span>
                  </div>
                  {renderFolderTree(fileTree)}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
          <div className="new-file-field agent-elements-new-file-dialog-field mb-4" data-agent-elements-shell="new-file-dialog-field">
            <label className="block mb-1.5 text-[13px] font-medium text-[var(--an-foreground-muted)]">
              Name
            </label>
            <div className="new-file-input-wrapper agent-elements-new-file-dialog-input-wrapper flex items-center overflow-hidden rounded-[var(--an-input-border-radius)] bg-[var(--an-input-background)] border border-[var(--an-input-border-color)] focus-within:ring-2 focus-within:ring-[var(--an-input-focus-outline)]">
              <input
                ref={inputRef}
                type="text"
                value={fileName}
                onChange={(e) => {
                  setFileName(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder={selectedFileType === 'any' ? 'document.txt' : 'document'}
                className="new-file-input agent-elements-new-file-dialog-input flex-1 py-2 px-3 text-sm bg-transparent border-none focus:outline-none text-[var(--an-input-color)] placeholder:text-[var(--an-input-placeholder-color)]"
                data-testid="agent-elements-new-file-dialog-input"
                data-agent-elements-shell="new-file-dialog-input"
              />
              {extensionSuffix && (
                <span
                  className="new-file-extension agent-elements-new-file-dialog-extension py-2 pr-3 text-sm font-mono select-none text-[var(--an-foreground-subtle)]"
                  data-agent-elements-shell="new-file-dialog-extension"
                >
                  {extensionSuffix}
                </span>
              )}
            </div>
          </div>
          {error && (
            <div
              className="new-file-error agent-elements-new-file-dialog-error text-[13px] mb-4 rounded-[var(--an-tool-border-radius)] border border-[var(--an-diff-removed-text)] bg-[var(--an-diff-removed-bg)] px-3 py-2 text-[var(--an-diff-removed-text)]"
              data-testid="agent-elements-new-file-dialog-error"
              data-agent-elements-shell="new-file-dialog-error"
            >
              {error}
            </div>
          )}
          <div
            className="new-file-buttons agent-elements-new-file-dialog-footer flex justify-end gap-2 mt-5"
            data-agent-elements-shell="new-file-dialog-footer"
          >
            <button
              type="button"
              onClick={onClose}
              className="agent-elements-new-file-dialog-button px-4 py-1.5 text-[13px] rounded-[6px] cursor-pointer transition-colors duration-150 ease-out bg-[var(--an-background-secondary)] border border-[var(--an-border-color)] text-[var(--an-foreground)] hover:bg-[var(--an-background-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
              data-agent-elements-shell="new-file-dialog-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="agent-elements-new-file-dialog-button px-4 py-1.5 text-[13px] rounded-[6px] cursor-pointer transition-colors duration-150 ease-out bg-[var(--an-send-button-bg)] border border-[var(--an-send-button-bg)] text-[var(--an-send-button-color)] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
              data-agent-elements-shell="new-file-dialog-create"
            >
              Create
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>
  );
};
