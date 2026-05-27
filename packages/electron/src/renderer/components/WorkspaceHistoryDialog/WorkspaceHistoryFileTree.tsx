import React, { useMemo, useState } from 'react';
import { getFileIcon } from '@nimbalyst/runtime';

interface WorkspaceFile {
  path: string;
  latestTimestamp: number;
  snapshotCount: number;
  exists: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  file?: WorkspaceFile;
}

interface WorkspaceHistoryFileTreeProps {
  files: WorkspaceFile[];
  workspacePath: string;
  selectedFilePath: string | null;
  selectedDeletedFiles: Set<string>;
  onFileSelect: (filePath: string) => void;
  onDeletedFileToggle: (filePath: string, checked: boolean) => void;
}

const treeClass = 'workspace-history-tree agent-elements-workspace-history-tree nim-scrollbar flex-1 overflow-y-auto py-[var(--an-spacing-xs)]';
const emptyClass =
  'workspace-history-tree-empty flex flex-1 items-center justify-center px-[var(--an-spacing-xxl)] py-10 text-center text-[13px] text-[var(--an-foreground-muted)]';
const folderRowClass =
  'workspace-history-tree-item workspace-history-tree-folder agent-elements-workspace-history-tree-folder flex w-full cursor-pointer items-center gap-[var(--an-spacing-xs)] border border-transparent bg-transparent py-[var(--an-spacing-xs)] pr-[var(--an-spacing-sm)] text-left text-[13px] text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-[-2px]';
const fileRowBaseClass =
  'workspace-history-tree-item workspace-history-tree-file agent-elements-workspace-history-tree-file flex cursor-pointer items-center gap-[var(--an-spacing-xs)] border border-transparent py-[var(--an-spacing-xs)] pr-[var(--an-spacing-sm)] text-[13px] transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-[-2px]';
const fileRowIdleClass = 'text-[var(--an-foreground)]';
const fileRowSelectedClass =
  'selected border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_9%,var(--an-background))] text-[var(--an-foreground)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--an-primary-color)_12%,transparent)]';
const fileRowDeletedClass = 'deleted text-[var(--an-foreground-muted)]';
const fileRowCheckedClass =
  'checked border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_8%,var(--an-background))]';
const checkboxBaseClass =
  'workspace-history-deleted-checkbox agent-elements-workspace-history-deleted-checkbox inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-radius-xs)] border text-[10px] transition-[background-color,border-color,color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';
const checkboxIdleClass = 'border-[var(--an-border-color)] bg-[var(--an-background)] text-transparent';
const checkboxCheckedClass = 'checked border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-send-button-color)]';

function DecorativeMaterialSymbol({
  icon,
  className,
}: {
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className ?? ''}`}>
      {icon}
    </span>
  );
}

export function WorkspaceHistoryFileTree({
  files,
  workspacePath,
  selectedFilePath,
  selectedDeletedFiles,
  onFileSelect,
  onDeletedFileToggle
}: WorkspaceHistoryFileTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Build tree structure from flat file paths
  const tree = useMemo(() => {
    const root: TreeNode[] = [];
    const dirMap = new Map<string, TreeNode>();

    // Sort files by path for consistent ordering
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    for (const file of sortedFiles) {
      // Get relative path from workspace
      const relativePath = file.path.replace(workspacePath + '/', '');
      const parts = relativePath.split('/');

      let currentLevel = root;
      let currentPath = workspacePath;

      // Create directory nodes
      for (let i = 0; i < parts.length - 1; i++) {
        const dirName = parts[i];
        currentPath = currentPath + '/' + dirName;

        let dirNode = dirMap.get(currentPath);
        if (!dirNode) {
          dirNode = {
            name: dirName,
            path: currentPath,
            type: 'directory',
            children: []
          };
          dirMap.set(currentPath, dirNode);
          currentLevel.push(dirNode);
        }
        currentLevel = dirNode.children!;
      }

      // Add file node
      const fileName = parts[parts.length - 1];
      currentLevel.push({
        name: fileName,
        path: file.path,
        type: 'file',
        file
      });
    }

    // Sort each level: directories first, then alphabetically
    const sortLevel = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      for (const node of nodes) {
        if (node.children) {
          sortLevel(node.children);
        }
      }
    };
    sortLevel(root);

    return root;
  }, [files, workspacePath]);

  // Auto-expand directories that contain the selected file
  useMemo(() => {
    if (selectedFilePath) {
      const parts = selectedFilePath.replace(workspacePath + '/', '').split('/');
      let currentPath = workspacePath;
      const newExpanded = new Set(expandedDirs);

      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath + '/' + parts[i];
        newExpanded.add(currentPath);
      }

      if (newExpanded.size !== expandedDirs.size) {
        setExpandedDirs(newExpanded);
      }
    }
  }, [selectedFilePath, workspacePath]);

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderNode = (node: TreeNode, level: number) => {
    const isExpanded = expandedDirs.has(node.path);
    const isSelected = node.path === selectedFilePath;
    const isDeleted = node.file && !node.file.exists;
    const isChecked = selectedDeletedFiles.has(node.path);

    if (node.type === 'directory') {
      return (
        <div key={node.path}>
          <button
            type="button"
            className={folderRowClass}
            style={{ paddingLeft: `${12 + level * 16}px` }}
            onClick={() => toggleDir(node.path)}
            aria-expanded={isExpanded}
            data-agent-elements-shell="workspace-history-tree-folder"
          >
            <DecorativeMaterialSymbol
              icon={isExpanded ? 'folder_open' : 'folder'}
              className="workspace-history-folder-icon shrink-0 text-base text-[var(--an-foreground-muted)]"
            />
            <span className="workspace-history-tree-name min-w-0 truncate">{node.name}/</span>
          </button>
          {isExpanded && node.children && (
            <div className="workspace-history-tree-children">
              {node.children.map(child => renderNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // File node
    const fileRowClass = [
      fileRowBaseClass,
      isSelected ? fileRowSelectedClass : fileRowIdleClass,
      isDeleted ? fileRowDeletedClass : '',
      isChecked ? fileRowCheckedClass : '',
    ].join(' ');

    return (
      <div
        key={node.path}
        className={fileRowClass}
        style={{ paddingLeft: `${12 + level * 16}px` }}
        onClick={() => onFileSelect(node.path)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onFileSelect(node.path);
          }
        }}
        role="button"
        tabIndex={0}
        data-agent-elements-shell="workspace-history-tree-file"
        data-selected={isSelected ? 'true' : 'false'}
        data-deleted={isDeleted ? 'true' : 'false'}
      >
        {isDeleted && (
          <button
            type="button"
            role="checkbox"
            aria-checked={isChecked}
            aria-label={`Select deleted file ${node.name}`}
            className={`${checkboxBaseClass} ${isChecked ? checkboxCheckedClass : checkboxIdleClass}`}
            data-testid={`agent-elements-workspace-history-deleted-checkbox-${node.path}`}
            data-agent-elements-shell="workspace-history-deleted-checkbox"
            onClick={(e) => {
              e.stopPropagation();
              onDeletedFileToggle(node.path, !isChecked);
            }}
          >
            {isChecked && <DecorativeMaterialSymbol icon="check" className="text-xs" />}
          </button>
        )}
        <DecorativeMaterialSymbol
          icon={getFileIcon(node.name)}
          className={`workspace-history-file-icon shrink-0 text-base ${isDeleted ? 'text-[var(--an-foreground-subtle)]' : 'text-[var(--an-foreground-muted)]'}`}
        />
        <span className="workspace-history-tree-name min-w-0 flex-1 truncate">{node.name}</span>
        {isDeleted && (
          <span className="workspace-history-deleted-label shrink-0 rounded-[var(--an-radius-xs)] border border-[color-mix(in_srgb,var(--an-diff-removed-text)_18%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-diff-removed-text)_8%,var(--an-background))] px-1.5 py-0.5 text-[10px] font-medium text-[var(--an-diff-removed-text)]">
            deleted
          </span>
        )}
      </div>
    );
  };

  if (files.length === 0) {
    return (
      <div
        className={emptyClass}
        data-agent-elements-shell="workspace-history-tree-empty"
      >
        No files with history in this workspace
      </div>
    );
  }

  return (
    <div
      className={treeClass}
      data-agent-elements-shell="workspace-history-tree"
      data-testid="agent-elements-workspace-history-tree"
    >
      {tree.map(node => renderNode(node, 0))}
    </div>
  );
}
