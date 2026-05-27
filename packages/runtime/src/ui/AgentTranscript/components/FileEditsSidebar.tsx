import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { FileEditSummary } from '../types';
import { MaterialSymbol } from '../../icons/MaterialSymbol';
import { useDiffPeek } from '../../git/useDiffPeek';
import '../../AgentElements/AgentElementsPrimitives.css';
import '../../AgentElements/AgentElementsToolRenderers.css';

interface FileEditsSidebarProps {
  fileEdits: FileEditSummary[];
  onFileClick?: (filePath: string) => void;
  workspacePath?: string;
  /** Set of file paths that have pending AI edits awaiting review */
  pendingReviewFiles?: Set<string>;
  /** Whether to group files by directory (controlled externally) */
  groupByDirectory?: boolean;
  /** Callback when groupByDirectory changes */
  onGroupByDirectoryChange?: (value: boolean) => void;
  /** If true, hide the internal controls (for when controls are rendered externally) */
  hideControls?: boolean;
  /** Callback to open file in Files mode (main editor) */
  onOpenInFiles?: (filePath: string) => void;
  /** Callback to view diff for a file */
  onViewDiff?: (filePath: string) => void;
  /** Callback to copy file path */
  onCopyPath?: (filePath: string) => void;
  /** Callback to reveal file in system file browser */
  onRevealInFinder?: (filePath: string) => void;
  /** Callback to open file in external editor */
  onOpenInExternalEditor?: (filePath: string) => void;
  /** Display name for the external editor (e.g., "VS Code") */
  externalEditorName?: string;
  /** Whether to show checkboxes for file selection (Manual/Worktree mode) */
  showCheckboxes?: boolean;
  /** Set of selected file paths (for checkbox state) */
  selectedFiles?: Set<string>;
  /** Callback when file selection changes */
  onSelectionChange?: (filePath: string, selected: boolean) => void;
  /** Optional per-file gate for whether a file can be selected for commit */
  isFileSelectable?: (filePath: string) => boolean;
  /** Callback to select/deselect all files */
  onSelectAll?: (selected: boolean) => void;
  /** Callback for bulk selection changes (add/remove multiple files at once) */
  onBulkSelectionChange?: (filePaths: string[], selected: boolean) => void;
  /** Whether to show a root-level "Select All" checkbox (defaults to true when showCheckboxes is true) */
  showRootCheckbox?: boolean;
  /** Total count of session files (used to show "no uncommitted changes" vs "no files edited") */
  totalSessionFilesCount?: number;
  /** Callback to switch to session files view (when showing "no uncommitted changes") */
  onShowSessionFiles?: () => void;
  /** Total count of all uncommitted files in repo (for hint link in session-files mode) */
  totalUncommittedCount?: number;
  /** Callback to switch to all-uncommitted view */
  onShowAllUncommitted?: () => void;
  /** Current scope mode - used to customize empty state messages */
  scopeMode?: 'current-changes' | 'session-files' | 'all-changes';
  /**
   * Fetch the unified diff for a file (HEAD vs working tree).
   * When provided, each row gets a hover-revealed peek icon that opens an inline diff popover.
   */
  onGetDiff?: (filePath: string) => Promise<{ unifiedDiff: string; isBinary: boolean } | null>;
  /** Persisted popover width (px). Shared across diff peek surfaces. */
  diffPeekWidth?: number;
  /** Persisted popover height (px). Shared across diff peek surfaces. */
  diffPeekHeight?: number;
  /** Called (debounced) when the user resizes the popover. */
  onDiffPeekResize?: (size: { width: number; height: number }) => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  filePath: string;
}

interface FileGitStatus {
  status: 'modified' | 'staged' | 'untracked' | 'unchanged' | 'deleted';
  gitStatusCode?: string;
}

interface DirectoryNode {
  path: string;
  displayPath: string;
  files: Array<{ filePath: string; edits: FileEditSummary[]; totalAdded: number; totalRemoved: number; operation?: string; timestamp: string }>;
  subdirectories: Map<string, DirectoryNode>;
  fileCount: number;
}

type SelectionState = 'none' | 'some' | 'all';

const checkboxBaseClass = 'file-edits-sidebar__checkbox w-4 h-4 shrink-0 rounded-[var(--an-radius-xs)] border-[1.5px] cursor-pointer flex items-center justify-center transition-colors';
const selectedCheckboxClass = 'bg-[var(--an-primary-color)] border-[var(--an-primary-color)]';
const emptyCheckboxClass = 'border-[var(--an-foreground-subtle)] bg-transparent hover:border-[var(--an-foreground-muted)]';

const DecorativeMaterialSymbol: React.FC<React.ComponentProps<typeof MaterialSymbol>> = (props) => (
  <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
    <MaterialSymbol {...props} />
  </span>
);

type FileEditCheckboxProps = {
  state: SelectionState;
  testId?: string;
  onClick?: (event: React.MouseEvent) => void;
};

const FileEditCheckbox: React.FC<FileEditCheckboxProps> = ({ state, testId, onClick }) => (
  <div
    onClick={onClick}
    data-testid={testId}
    role="checkbox"
    aria-checked={state === 'all' ? 'true' : state === 'some' ? 'mixed' : 'false'}
    className={`${checkboxBaseClass} ${state === 'none' ? emptyCheckboxClass : selectedCheckboxClass} ${state === 'some' ? 'opacity-70' : ''}`}
  >
    {state === 'all' ? (
      <svg width="8" height="6" viewBox="0 0 8 6" fill="none" className="text-[var(--an-send-button-color)]">
        <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ) : state === 'some' ? (
      <div className="w-2 h-0.5 rounded-[var(--an-radius-xs)] bg-[var(--an-send-button-color)]" />
    ) : null}
  </div>
);

export const FileEditsSidebar: React.FC<FileEditsSidebarProps> = ({
  fileEdits,
  onFileClick,
  workspacePath,
  pendingReviewFiles,
  groupByDirectory: groupByDirectoryProp,
  onGroupByDirectoryChange,
  hideControls = false,
  onOpenInFiles,
  onViewDiff,
  onCopyPath,
  onRevealInFinder,
  onOpenInExternalEditor,
  externalEditorName,
  showCheckboxes = false,
  selectedFiles,
  onSelectionChange,
  isFileSelectable,
  onSelectAll,
  onBulkSelectionChange,
  showRootCheckbox,
  totalSessionFilesCount,
  onShowSessionFiles,
  totalUncommittedCount,
  onShowAllUncommitted,
  scopeMode = 'current-changes',
  onGetDiff,
  diffPeekWidth,
  diffPeekHeight,
  onDiffPeekResize,
}) => {
  // Diff peek state — shared with GitCommitConfirmationWidget via useDiffPeek.
  const { peekSupported, registerRowEl, togglePeek, isActive, popoverElement } = useDiffPeek({
    getDiff: onGetDiff,
    width: diffPeekWidth,
    height: diffPeekHeight,
    onResize: onDiffPeekResize,
  });
  // Default showRootCheckbox to true when showCheckboxes is true
  const shouldShowRootCheckbox = showRootCheckbox ?? showCheckboxes;
  const [gitStatus, setGitStatus] = useState<Record<string, FileGitStatus>>({});
  // Use prop if provided, otherwise use local state
  const [localGroupByDirectory, setLocalGroupByDirectory] = useState(false);
  const groupByDirectory = groupByDirectoryProp ?? localGroupByDirectory;
  const setGroupByDirectory = onGroupByDirectoryChange ?? setLocalGroupByDirectory;
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ isOpen: false, x: 0, y: 0, filePath: '' });

  // Convert absolute path to relative path from workspace root
  const getRelativePath = useCallback((filePath: string): string => {
    if (!workspacePath || !filePath.startsWith(workspacePath)) {
      return filePath;
    }
    const relativePath = filePath.slice(workspacePath.length);
    // Remove leading slash if present
    return relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  }, [workspacePath]);

  // Build directory tree from file list
  const buildDirectoryTree = (files: Array<{ filePath: string; edits: FileEditSummary[]; totalAdded: number; totalRemoved: number; operation?: string; timestamp: string }>): DirectoryNode => {
    const root: DirectoryNode = {
      path: '',
      displayPath: '',
      files: [],
      subdirectories: new Map(),
      fileCount: 0
    };

    files.forEach(file => {
      const relativePath = getRelativePath(file.filePath);
      const parts = relativePath.split('/');

      // If file is at root level (no directory)
      if (parts.length === 1) {
        root.files.push(file);
        root.fileCount++;
        return;
      }

      // Build directory tree
      let currentNode = root;
      const dirParts = parts.slice(0, -1);

      dirParts.forEach((part, index) => {
        const pathSoFar = dirParts.slice(0, index + 1).join('/');

        if (!currentNode.subdirectories.has(part)) {
          currentNode.subdirectories.set(part, {
            path: pathSoFar,
            displayPath: part,
            files: [],
            subdirectories: new Map(),
            fileCount: 0
          });
        }

        currentNode = currentNode.subdirectories.get(part)!;
      });

      currentNode.files.push(file);

      // Update file counts up the tree
      let node: DirectoryNode | undefined = currentNode;
      while (node) {
        node.fileCount++;
        // Walk back up to parent
        const parentPath = node.path.split('/').slice(0, -1).join('/');
        if (!parentPath && node.path) {
          // Reached root's child
          node = root;
        } else if (!node.path) {
          // At root
          node = undefined;
        } else {
          // Find parent
          node = findNodeByPath(root, parentPath);
        }
      }
    });

    return collapseDirectoryTree(root);
  };

  // Helper to find a node by path
  const findNodeByPath = (root: DirectoryNode, path: string): DirectoryNode | undefined => {
    if (!path) return root;

    const parts = path.split('/');
    let current = root;

    for (const part of parts) {
      const next = current.subdirectories.get(part);
      if (!next) return undefined;
      current = next;
    }

    return current;
  };

  // Collapse single-child directory paths
  const collapseDirectoryTree = (node: DirectoryNode): DirectoryNode => {
    // First, recursively collapse all subdirectories
    node.subdirectories.forEach((subdir, key) => {
      node.subdirectories.set(key, collapseDirectoryTree(subdir));
    });

    // If this node has exactly one subdirectory and no files, collapse it
    if (node.subdirectories.size === 1 && node.files.length === 0) {
      const [, childNode] = Array.from(node.subdirectories.entries())[0];

      // Merge the paths
      const newDisplayPath = node.displayPath
        ? `${node.displayPath}/${childNode.displayPath}`
        : childNode.displayPath;

      return {
        ...childNode,
        displayPath: newDisplayPath
      };
    }

    return node;
  };

  // Group edited files by file path
  const editedFiles = useMemo(() => {
    const edited = fileEdits.filter(edit => edit.linkType === 'edited');

    // Group by file path
    const groups = new Map<string, FileEditSummary[]>();
    edited.forEach(file => {
      const existing = groups.get(file.filePath) || [];
      existing.push(file);
      groups.set(file.filePath, existing);
    });

    return Array.from(groups.entries()).map(([filePath, edits]) => {
      const totalAdded = edits.reduce((sum, e) => sum + (e.linesAdded || 0), 0);
      const totalRemoved = edits.reduce((sum, e) => sum + (e.linesRemoved || 0), 0);
      const lastEdit = edits[edits.length - 1];

      return {
        filePath,
        edits,
        totalAdded,
        totalRemoved,
        operation: lastEdit.operation,
        timestamp: lastEdit.timestamp
      };
    });
  }, [fileEdits]);

  // Fetch git status for edited files
  useEffect(() => {
    if (!workspacePath || editedFiles.length === 0) {
      setGitStatus({});
      return;
    }

    const fetchGitStatus = async () => {
      try {
        const filePaths = editedFiles.map(f => getRelativePath(f.filePath));

        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          const result = await (window as any).electronAPI.invoke(
            'git:get-file-status',
            workspacePath,
            filePaths
          );
          if (result.success && result.status) {
            setGitStatus(result.status);
          }
        }
      } catch (error) {
        console.error('[FileEditsSidebar] Failed to fetch git status:', error);
      }
    };

    fetchGitStatus();

    // Refresh on window focus
    const handleFocus = () => {
      fetchGitStatus();
    };

    // Listen for git status changes
    const handleGitStatusChanged = (data: { workspacePath: string }) => {
      if (data.workspacePath === workspacePath) {
        fetchGitStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    const unsubscribe = (window as any).electronAPI?.on?.('git:status-changed', handleGitStatusChanged);

    return () => {
      window.removeEventListener('focus', handleFocus);
      unsubscribe?.();
    };
  }, [editedFiles, workspacePath]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const getAllFolderPaths = (node: DirectoryNode, paths: string[] = []): string[] => {
    if (node.path) {
      paths.push(node.path);
    }
    node.subdirectories.forEach(subdir => {
      getAllFolderPaths(subdir, paths);
    });
    return paths;
  };

  const expandAll = useCallback(() => {
    if (editedFiles.length > 0) {
      const tree = buildDirectoryTree(editedFiles);
      const allPaths = getAllFolderPaths(tree);
      setExpandedFolders(new Set(allPaths));
    }
  }, [editedFiles]);

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  // Auto-expand all folders when groupByDirectory is first enabled.
  // When files change, only expand NEW folders (don't reset manually collapsed ones).
  const prevGroupByDirectoryRef = React.useRef(groupByDirectory);
  useEffect(() => {
    if (!groupByDirectory || editedFiles.length === 0) {
      prevGroupByDirectoryRef.current = groupByDirectory;
      return;
    }

    const tree = buildDirectoryTree(editedFiles);
    const allPaths = getAllFolderPaths(tree);

    if (!prevGroupByDirectoryRef.current && groupByDirectory) {
      // groupByDirectory was just turned on - expand everything
      setExpandedFolders(new Set(allPaths));
    } else {
      // Files changed while already grouped - only add new folders, preserve collapsed state
      setExpandedFolders(prev => {
        const next = new Set(prev);
        let changed = false;
        for (const path of allPaths) {
          if (!prev.has(path)) {
            // This is a new folder not seen before - expand it by default
            next.add(path);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    prevGroupByDirectoryRef.current = groupByDirectory;
  }, [groupByDirectory, editedFiles]);

  // Listen for external expand/collapse events (when hideControls is true)
  useEffect(() => {
    if (!hideControls) return;

    const handleExpandAll = () => expandAll();
    const handleCollapseAll = () => collapseAll();

    window.addEventListener('file-edits-sidebar:expand-all', handleExpandAll);
    window.addEventListener('file-edits-sidebar:collapse-all', handleCollapseAll);

    return () => {
      window.removeEventListener('file-edits-sidebar:expand-all', handleExpandAll);
      window.removeEventListener('file-edits-sidebar:collapse-all', handleCollapseAll);
    };
  }, [hideControls, expandAll, collapseAll]);

  // Check if file has uncommitted changes (is selectable for commit)
  const isFileCommitted = useCallback((filePath: string): boolean => {
    const relativePath = getRelativePath(filePath);
    const status = gitStatus[relativePath];
    return !status || status.status === 'unchanged';
  }, [gitStatus, getRelativePath]);

  const isSelectableForCommit = useCallback((filePath: string): boolean => {
    if (isFileCommitted(filePath)) {
      return false;
    }
    return isFileSelectable ? isFileSelectable(filePath) : true;
  }, [isFileCommitted, isFileSelectable]);

  // Calculate root-level selection state for "Select All" checkbox
  const rootSelectionInfo = useMemo(() => {
    const allFilePaths = editedFiles.map(f => f.filePath);
    const selectablePaths = allFilePaths.filter(isSelectableForCommit);
    const uncommittedCount = selectablePaths.length;

    if (uncommittedCount === 0) {
      return { state: 'none' as const, uncommittedCount: 0 };
    }

    const selectedCount = selectablePaths.filter(p => selectedFiles?.has(p)).length;
    if (selectedCount === 0) {
      return { state: 'none' as const, uncommittedCount };
    }
    if (selectedCount === uncommittedCount) {
      return { state: 'all' as const, uncommittedCount };
    }
    return { state: 'some' as const, uncommittedCount };
  }, [editedFiles, selectedFiles, isSelectableForCommit]);

  // Get file status color class based on operation and git status
  const getFileStatusColor = (filePath: string, operation?: string): string => {
    const relativePath = getRelativePath(filePath);
    const status = gitStatus[relativePath];

    // If file has no git changes (committed/unchanged), use committed color
    const isCommitted = !status || status.status === 'unchanged';

    if (isCommitted) {
      return 'text-[color-mix(in_srgb,var(--an-foreground-muted)_85%,var(--an-foreground))]';
    }

    // File has uncommitted changes - color by operation type
    if (operation === 'delete') {
      return 'text-[var(--an-diff-removed-text)]';
    }
    if (operation === 'create') {
      return 'text-[var(--an-diff-added-text)]';
    }
    // edit, rename, or unknown operation
    return 'text-[var(--an-primary-color)]';
  };

  // Get tooltip text for file status
  const getFileStatusTooltip = (filePath: string, operation?: string): string => {
    const relativePath = getRelativePath(filePath);
    const status = gitStatus[relativePath];

    const isCommitted = !status || status.status === 'unchanged';

    if (isCommitted) {
      if (operation === 'delete') {
        return `${relativePath} - Deleted and committed`;
      }
      return `${relativePath} - Committed`;
    }

    // Build tooltip based on operation and git status
    const operationText = {
      create: 'Created',
      edit: 'Edited',
      delete: 'Deleted',
      rename: 'Renamed'
    }[operation || 'edit'] || 'Modified';

    const gitStatusText = status ? ` (${status.status})` : '';
    return `${relativePath} - ${operationText}${gitStatusText}`;
  };

  const formatFileName = (filePath: string) => {
    // Handle both Windows (\) and Unix (/) path separators
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  const formatOperationLabel = (operation?: string) => {
    if (operation === 'create') return 'Created';
    if (operation === 'delete') return 'Deleted';
    if (operation === 'rename') return 'Renamed';
    return 'Edited';
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, filePath: string) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      filePath
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, filePath: '' });
  };

  // Close context menu when clicking outside
  useEffect(() => {
    if (contextMenu.isOpen) {
      const handleClick = () => closeContextMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
    return undefined;
  }, [contextMenu.isOpen]);

  const renderContextMenu = () => {
    if (!contextMenu.isOpen) return null;

    const hasContextActions = onOpenInFiles || onViewDiff || onCopyPath || onRevealInFinder || onOpenInExternalEditor;
    if (!hasContextActions) return null;

    return (
      <div
        className="file-edits-sidebar__context-menu fixed z-50 min-w-[180px] rounded-[var(--an-radius-sm)] border border-[var(--an-border-color)] bg-[var(--an-tool-background)] py-1"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {onOpenInFiles && (
          <button
            className="file-edits-sidebar__context-menu-item flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.8125rem] text-[var(--an-tool-color)] hover:bg-[var(--an-background-tertiary)]"
            onClick={() => {
              onOpenInFiles(contextMenu.filePath);
              closeContextMenu();
            }}
          >
            <DecorativeMaterialSymbol icon="open_in_new" size={16} className="text-[var(--an-tool-color-muted)]" />
            Open in Files
          </button>
        )}
        {onViewDiff && (
          <button
            className="file-edits-sidebar__context-menu-item flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.8125rem] text-[var(--an-tool-color)] hover:bg-[var(--an-background-tertiary)]"
            onClick={() => {
              onViewDiff(contextMenu.filePath);
              closeContextMenu();
            }}
          >
            <DecorativeMaterialSymbol icon="difference" size={16} className="text-[var(--an-tool-color-muted)]" />
            View Diff
          </button>
        )}
        {onOpenInExternalEditor && externalEditorName && (
          <button
            className="file-edits-sidebar__context-menu-item flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.8125rem] text-[var(--an-tool-color)] hover:bg-[var(--an-background-tertiary)]"
            onClick={() => {
              onOpenInExternalEditor(contextMenu.filePath);
              closeContextMenu();
            }}
          >
            <DecorativeMaterialSymbol icon="open_in_new" size={16} className="text-[var(--an-tool-color-muted)]" />
            Open in {externalEditorName}
          </button>
        )}
        {(onOpenInFiles || onViewDiff || onOpenInExternalEditor) && (onCopyPath || onRevealInFinder) && (
          <div className="file-edits-sidebar__context-menu-divider my-1 h-px bg-[var(--an-border-color)]" />
        )}
        {onCopyPath && (
          <button
            className="file-edits-sidebar__context-menu-item flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.8125rem] text-[var(--an-tool-color)] hover:bg-[var(--an-background-tertiary)]"
            onClick={() => {
              onCopyPath(contextMenu.filePath);
              closeContextMenu();
            }}
          >
            <DecorativeMaterialSymbol icon="content_copy" size={16} className="text-[var(--an-tool-color-muted)]" />
            Copy Path
          </button>
        )}
        {onRevealInFinder && (
          <button
            className="file-edits-sidebar__context-menu-item flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.8125rem] text-[var(--an-tool-color)] hover:bg-[var(--an-background-tertiary)]"
            onClick={() => {
              onRevealInFinder(contextMenu.filePath);
              closeContextMenu();
            }}
          >
            <DecorativeMaterialSymbol icon="folder_open" size={16} className="text-[var(--an-tool-color-muted)]" />
            Reveal in Finder
          </button>
        )}
      </div>
    );
  };

  const renderFile = ({ filePath, operation }: { filePath: string; totalAdded: number; totalRemoved: number; operation?: string }, isInDirectory = false) => {
    const hasPendingReview = pendingReviewFiles?.has(filePath);
    const fileColorClass = getFileStatusColor(filePath, operation);
    // Check both operation and git status for deleted files
    const relativePath = getRelativePath(filePath);
    const gitFileStatus = gitStatus[relativePath];
    const isDeleted = operation === 'delete' || gitFileStatus?.status === 'deleted';
    const tooltip = getFileStatusTooltip(filePath, operation);
    const committed = isFileCommitted(filePath);
    const selectable = isSelectableForCommit(filePath);
    const isSelected = selectedFiles?.has(filePath) ?? false;
    const isPinned = isActive(filePath);

    // Handler to toggle file selection without triggering file click
    const handleCheckboxClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectionChange?.(filePath, !isSelected);
    };

    // Drag handler to enable dropping file as @-mention in AI input
    const handleDragStart = (e: React.DragEvent) => {
      e.dataTransfer.setData('application/x-nimbalyst-file-mention', relativePath);
      e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div
          key={filePath}
          ref={(el) => registerRowEl(filePath, el)}
          data-agent-elements-shell="file-row"
          data-file-operation={operation || 'edit'}
          data-file-deleted={isDeleted ? 'true' : 'false'}
          data-pending-review={hasPendingReview ? 'true' : 'false'}
          data-testid="files-edited-file-row"
          data-file-path={relativePath}
          draggable
        onDragStart={handleDragStart}
        onContextMenu={(e) => handleContextMenu(e, filePath)}
        className={`file-edits-sidebar__file agent-elements-files-edited-row agent-elements-search-result group flex w-full items-center gap-1 rounded-[var(--an-radius-sm)] border border-transparent bg-transparent px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] transition-colors hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] ${
          isPinned ? 'border-[var(--an-primary-color)] bg-[var(--an-background-tertiary)]' : ''
        } ${hasPendingReview ? 'border-[color-mix(in_srgb,var(--an-warning-color)_35%,transparent)] bg-[color-mix(in_srgb,var(--an-warning-color)_10%,var(--an-background))] hover:border-[color-mix(in_srgb,var(--an-warning-color)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--an-warning-color)_14%,var(--an-background))]' : ''}`}
        title={tooltip}
      >
        <button
          type="button"
          onClick={() => {
            // Don't open deleted files - they don't exist anymore
            if (!isDeleted) {
              onFileClick?.(filePath);
            }
          }}
          className="file-edits-sidebar__file-main flex-1 min-w-0 flex items-center gap-1 text-left bg-transparent border-0 p-0 cursor-pointer"
        >
          {isInDirectory && (
            <div className="file-edits-sidebar__caret-placeholder w-4 h-4 shrink-0" />
          )}
          {showCheckboxes && (
            !selectable ? (
              <div className="file-edits-sidebar__checkbox-placeholder w-4 h-4 shrink-0" />
            ) : (
                <FileEditCheckbox
                  onClick={handleCheckboxClick}
                  state={isSelected ? 'all' : 'none'}
                  testId="files-edited-file-checkbox"
                />
            )
          )}
          <div className="file-edits-sidebar__file-info flex-1 min-w-0 flex items-center gap-1">
            <div
              className={`file-edits-sidebar__file-name overflow-hidden text-ellipsis whitespace-nowrap text-[0.8125rem] font-medium ${isDeleted ? 'line-through text-[var(--an-foreground-muted)]' : fileColorClass}`}
            >
              {formatFileName(filePath)}
            </div>
            <span
              className="file-edits-sidebar__file-status agent-elements-status-pill shrink-0"
              data-testid="files-edited-file-status"
              data-tone={isDeleted ? 'error' : hasPendingReview ? 'warning' : 'neutral'}
            >
              {formatOperationLabel(operation)}
              {hasPendingReview ? ' · Pending review' : ''}
            </span>
          </div>
        </button>
        {peekSupported && !isDeleted && (
          <button
            type="button"
            data-testid="files-edited-file-peek"
            className={`file-edits-sidebar__peek-btn flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-radius-xs)] border-0 bg-transparent text-[var(--an-foreground-subtle)] transition-opacity hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-primary-color)] ${
              isPinned ? 'text-[var(--an-primary-color)] opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
            }`}
            title={isPinned ? 'Hide diff' : 'Show diff'}
            onClick={(e) => {
              e.stopPropagation();
              togglePeek(filePath);
            }}
          >
            <DecorativeMaterialSymbol icon="difference" size={14} />
          </button>
        )}
      </div>
    );
  };

  // Helper to collect all file paths from a directory node recursively
  const collectFilePaths = (node: DirectoryNode): string[] => {
    const paths: string[] = [];
    node.files.forEach(f => paths.push(f.filePath));
    node.subdirectories.forEach(subdir => {
      paths.push(...collectFilePaths(subdir));
    });
    return paths;
  };

  // Helper to check if all uncommitted files in a directory are selected
  const getDirectorySelectionState = (node: DirectoryNode): 'none' | 'some' | 'all' => {
    const allPaths = collectFilePaths(node);
    const uncommittedPaths = allPaths.filter(isSelectableForCommit);

    if (uncommittedPaths.length === 0) return 'none'; // All files are committed

    const selectedCount = uncommittedPaths.filter(p => selectedFiles?.has(p)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === uncommittedPaths.length) return 'all';
    return 'some';
  };

  // Toggle selection for all uncommitted files in a directory
  const handleDirectoryCheckboxClick = (e: React.MouseEvent, node: DirectoryNode) => {
    e.stopPropagation();
    const allPaths = collectFilePaths(node);
    const uncommittedPaths = allPaths.filter(isSelectableForCommit);
    const selectionState = getDirectorySelectionState(node);

    // If none or some are selected, select all. If all are selected, deselect all.
    const shouldSelect = selectionState !== 'all';

    // Use bulk selection if available (handles multiple files atomically)
    if (onBulkSelectionChange) {
      onBulkSelectionChange(uncommittedPaths, shouldSelect);
    } else {
      // Fallback to individual calls (may have race condition issues)
      uncommittedPaths.forEach(p => {
        onSelectionChange?.(p, shouldSelect);
      });
    }
  };

  const renderDirectoryNode = (node: DirectoryNode): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path);
    const hasContent = node.files.length > 0 || node.subdirectories.size > 0;

    // Check if directory has any uncommitted files (for checkbox visibility)
    const allPaths = collectFilePaths(node);
    const hasUncommittedFiles = allPaths.some(isSelectableForCommit);
    const selectionState = getDirectorySelectionState(node);

    return (
      <div key={node.path || 'root'} className="file-edits-sidebar__directory-node mb-0.5">
        {node.displayPath && (
          <button
            onClick={() => toggleFolder(node.path)}
            className="file-edits-sidebar__directory-header flex w-full cursor-pointer items-center gap-1 rounded-[var(--an-radius-sm)] border border-transparent bg-transparent px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)] text-left text-[0.8125rem] font-medium text-[var(--an-foreground-muted)] transition-colors hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]"
          >
            <DecorativeMaterialSymbol
              icon={isExpanded ? "expand_more" : "chevron_right"}
              size={16}
              className="file-edits-sidebar__directory-chevron shrink-0 text-[var(--an-foreground-subtle)] transition-transform"
            />
            {showCheckboxes && (
              hasUncommittedFiles ? (
                <FileEditCheckbox
                  onClick={(e) => handleDirectoryCheckboxClick(e, node)}
                  state={selectionState}
                  testId="files-edited-directory-checkbox"
                />
              ) : (
                <div className="file-edits-sidebar__checkbox-placeholder w-4 h-4 shrink-0" />
              )
            )}
            <DecorativeMaterialSymbol
              icon={isExpanded ? "folder_open" : "folder"}
              size={16}
              className="file-edits-sidebar__directory-icon shrink-0 text-[var(--an-foreground-muted)]"
            />
            <span className="file-edits-sidebar__directory-path flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{node.displayPath}</span>
            <span className="file-edits-sidebar__directory-count shrink-0 rounded-[var(--an-radius-xs)] bg-[var(--an-background-tertiary)] px-1 py-0.5 text-[9px] text-[var(--an-foreground-subtle)]">{node.fileCount}</span>
          </button>
        )}

        {(isExpanded || !node.displayPath) && hasContent && (
          <div className={node.displayPath ? "file-edits-sidebar__directory-children mt-0.5 pl-4" : undefined}>
            {/* Render subdirectories first */}
            {Array.from(node.subdirectories.values()).map(subdir =>
              renderDirectoryNode(subdir)
            )}

            {/* Render files */}
            {node.files.map(file => renderFile(file, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="file-edits-sidebar agent-elements-files-edited-sidebar agent-elements-edit-panel flex h-full flex-col bg-[var(--an-tool-background)] text-[var(--an-tool-color)]"
      data-agent-elements-shell="files-edited"
      data-component="FileEditsSidebar"
      data-testid="agent-elements-files-edited-sidebar"
    >
      {!hideControls && editedFiles.length > 0 && (
        <div className="file-edits-sidebar__controls flex items-center gap-1 border-b border-[var(--an-border-color)] bg-[var(--an-tool-background)] p-[var(--an-spacing-sm)]">
          <button
            onClick={() => setGroupByDirectory(!groupByDirectory)}
            className={`file-edits-sidebar__control-button flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--an-radius-sm)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-0 text-[var(--an-tool-color-muted)] transition-colors hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-tool-color)] disabled:cursor-not-allowed disabled:opacity-40 ${groupByDirectory ? 'border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-send-button-color)]' : ''}`}
            title="Group by directory"
          >
            <DecorativeMaterialSymbol icon="folder" size={18} />
          </button>
          <button
            onClick={expandAll}
            disabled={!groupByDirectory}
            className="file-edits-sidebar__control-button flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--an-radius-sm)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-0 text-[var(--an-tool-color-muted)] transition-colors hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-tool-color)] disabled:cursor-not-allowed disabled:opacity-40"
            title="Expand all"
          >
            <DecorativeMaterialSymbol icon="unfold_more" size={18} />
          </button>
          <button
            onClick={collapseAll}
            disabled={!groupByDirectory}
            className="file-edits-sidebar__control-button flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--an-radius-sm)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-0 text-[var(--an-tool-color-muted)] transition-colors hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-tool-color)] disabled:cursor-not-allowed disabled:opacity-40"
            title="Collapse all"
          >
            <DecorativeMaterialSymbol icon="unfold_less" size={18} />
          </button>
        </div>
      )}
      <div className="file-edits-sidebar__files flex-1 overflow-y-auto p-1">
        {/* Root "Select All" checkbox */}
        {shouldShowRootCheckbox && editedFiles.length > 0 && rootSelectionInfo.uncommittedCount > 0 && (
          <div className="file-edits-sidebar__root-checkbox mb-1 flex items-center gap-2 border-b border-[var(--an-border-color)] px-[var(--an-spacing-sm)] py-1.5">
            <FileEditCheckbox
              onClick={() => onSelectAll?.(rootSelectionInfo.state !== 'all')}
              state={rootSelectionInfo.state}
              testId="files-edited-select-all"
            />
            <span className="text-[0.8125rem] text-[var(--an-foreground-muted)]">
              Select all ({rootSelectionInfo.uncommittedCount} uncommitted)
            </span>
          </div>
        )}
        {editedFiles.length === 0 ? (
          <div className="file-edits-sidebar__empty p-4 text-center text-sm text-[var(--an-foreground-subtle)]">
            {scopeMode === 'current-changes' && totalSessionFilesCount && totalSessionFilesCount > 0 ? (
              // Uncommitted Session Edits mode with no uncommitted changes
              <div className="flex flex-col items-center">
                <div>No uncommitted changes</div>
                {onShowSessionFiles && (
                  <button
                    onClick={onShowSessionFiles}
                    className="mt-2 cursor-pointer border-none bg-transparent text-sm text-[var(--an-primary-color)] hover:underline"
                  >
                    Show all session edits ({totalSessionFilesCount})
                  </button>
                )}
                {onShowAllUncommitted && totalUncommittedCount && totalUncommittedCount > 0 && (
                  <button
                    onClick={onShowAllUncommitted}
                    className="mt-2 cursor-pointer border-none bg-transparent text-sm text-[var(--an-primary-color)] hover:underline"
                  >
                    Show all uncommitted files ({totalUncommittedCount})
                  </button>
                )}
              </div>
            ) : scopeMode === 'current-changes' ? (
              // Uncommitted Session Edits mode with no session files at all
              <>
                <div>No files edited yet</div>
                {onShowAllUncommitted && totalUncommittedCount && totalUncommittedCount > 0 && (
                  <button
                    onClick={onShowAllUncommitted}
                    className="mt-2 cursor-pointer border-none bg-transparent text-sm text-[var(--an-primary-color)] hover:underline"
                  >
                    Show all uncommitted files ({totalUncommittedCount})
                  </button>
                )}
              </>
            ) : scopeMode === 'session-files' ? (
              // All Session Edits mode with no files
              <>
                <div>No files edited in this session</div>
                {onShowAllUncommitted && totalUncommittedCount && totalUncommittedCount > 0 && (
                  <button
                    onClick={onShowAllUncommitted}
                    className="mt-2 cursor-pointer border-none bg-transparent text-sm text-[var(--an-primary-color)] hover:underline"
                  >
                    Show all uncommitted files ({totalUncommittedCount})
                  </button>
                )}
              </>
            ) : scopeMode === 'all-changes' ? (
              // All Uncommitted Files mode with no files
              <>
                <div>No uncommitted files</div>
                {onShowSessionFiles && totalSessionFilesCount && totalSessionFilesCount > 0 && (
                  <button
                    onClick={onShowSessionFiles}
                    className="mt-2 cursor-pointer border-none bg-transparent text-sm text-[var(--an-primary-color)] hover:underline"
                  >
                    Show session edits ({totalSessionFilesCount})
                  </button>
                )}
              </>
            ) : (
              'No files edited yet'
            )}
          </div>
        ) : (
          <>
            {groupByDirectory ? (
              renderDirectoryNode(buildDirectoryTree(editedFiles))
            ) : (
              editedFiles.map(file => renderFile(file))
            )}
            {/* Show link to all uncommitted files when in session-files mode and there are additional uncommitted files */}
            {scopeMode === 'session-files' && onShowAllUncommitted && totalUncommittedCount && totalUncommittedCount > editedFiles.length && (
              <div className="file-edits-sidebar__uncommitted-hint px-2 py-3 text-center">
                <button
                  onClick={onShowAllUncommitted}
                  className="cursor-pointer border-none bg-transparent text-sm text-[var(--an-primary-color)] hover:underline"
                >
                  Show all uncommitted files ({totalUncommittedCount})
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {renderContextMenu()}
      {popoverElement}
    </div>
  );
};
