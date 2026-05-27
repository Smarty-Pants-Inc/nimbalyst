import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { getFileName } from '../../utils/pathUtils';
import {
  diffTreeGroupByDirectoryAtom,
  setDiffTreeGroupByDirectoryAtom,
  fileGutterCollapsedAtom,
  setFileGutterCollapsedAtom,
} from '../../store/atoms/projectState';
import { sessionFileEditsAtom, sessionPendingReviewFilesAtom } from '../../store/atoms/sessionFiles';

interface FileGutterProps {
  sessionId: string | null;
  workspacePath?: string;
  type: 'referenced' | 'edited';
  onFileClick?: (filePath: string) => void;
  /** Optional: Set of file paths that have pending AI edits awaiting review */
  pendingReviewFiles?: Set<string>;
}

interface FileData {
  filePath: string;
  operation?: 'create' | 'edit' | 'delete' | 'rename';
  linesAdded?: number;
  linesRemoved?: number;
}

interface FileGitStatus {
  status: 'modified' | 'staged' | 'untracked' | 'unchanged' | 'deleted';
  gitStatusCode?: string;
}

interface DirectoryNode {
  path: string;
  displayPath: string;
  files: FileData[];
  subdirectories: Map<string, DirectoryNode>;
  fileCount: number;
}

const fileGutterButtonBase =
  'rounded-[var(--an-radius-sm)] transition-[background-color,border-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]';

const fileGutterIconTone = {
  create: 'text-[var(--an-success-color)]',
  edit: 'text-[var(--an-primary-color)]',
  delete: 'text-[var(--an-diff-removed-text)]',
  rename: 'text-[var(--an-warning-color)]',
};

const fileGutterFileClass =
  `file-gutter__file agent-elements-file-gutter-file w-full text-left px-2 py-0.5 border border-transparent bg-transparent ${fileGutterButtonBase} hover:bg-[var(--an-background-tertiary)] hover:border-[var(--an-border-color)]`;

const fileGutterPendingFileClass =
  'file-gutter__file--pending agent-elements-file-gutter-file--pending border-[color-mix(in_srgb,var(--an-warning-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_8%,var(--an-background))] hover:bg-[color-mix(in_srgb,var(--an-warning-color)_12%,var(--an-background))] hover:border-[color-mix(in_srgb,var(--an-warning-color)_34%,var(--an-border-color))]';

const fileGutterControlButtonBase =
  `file-gutter__control-button agent-elements-file-gutter-control flex items-center justify-center w-6 h-6 p-0 border border-[var(--an-border-color)] rounded-[var(--an-radius-sm)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] cursor-pointer ${fileGutterButtonBase} hover:enabled:bg-[var(--an-background-tertiary)] hover:enabled:text-[var(--an-foreground)] hover:enabled:border-[var(--an-border-color-strong)] disabled:opacity-40 disabled:cursor-not-allowed`;

export function FileGutter({ sessionId, workspacePath, type, onFileClick, pendingReviewFiles }: FileGutterProps) {
  const [files, setFiles] = useState<FileData[]>([]);
  const fileGutterCollapsed = useAtomValue(fileGutterCollapsedAtom);
  const setFileGutterCollapsed = useSetAtom(setFileGutterCollapsedAtom);
  const isExpanded = !(fileGutterCollapsed[type] ?? false);
  const toggleExpanded = useCallback(() => {
    if (!workspacePath) return;
    setFileGutterCollapsed({ type, collapsed: isExpanded, workspacePath });
  }, [isExpanded, setFileGutterCollapsed, type, workspacePath]);
  const [gitStatus, setGitStatus] = useState<Record<string, FileGitStatus>>({});
  const [groupByDirectory] = useAtom(diffTreeGroupByDirectoryAtom);
  const setDiffTreeGroupByDirectory = useSetAtom(setDiffTreeGroupByDirectoryAtom);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Wrapper to pass workspacePath to the setter atom
  const setGroupByDirectory = useCallback((value: boolean) => {
    if (workspacePath) {
      setDiffTreeGroupByDirectory({ groupByDirectory: value, workspacePath });
    }
  }, [workspacePath, setDiffTreeGroupByDirectory]);

  // Note: groupByDirectory is hydrated from workspace state once at app init (in App.tsx)
  // No need to load it here - just use the Jotai atom value

  // Convert absolute path to relative path from workspace root
  const getRelativePath = (filePath: string): string => {
    if (!workspacePath || !filePath.startsWith(workspacePath)) {
      return filePath;
    }
    const relativePath = filePath.slice(workspacePath.length);
    return relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  };

  // Group files by path and aggregate stats
  const groupedFiles = useMemo(() => {
    // In Files mode, pending-review can update before session_files linkage.
    // Merge pending file paths so the Edited list stays in sync with the
    // pending-review banner without requiring a manual refresh.
    let sourceFiles = files;
    if (type === 'edited' && pendingReviewFiles && pendingReviewFiles.size > 0) {
      const existingPaths = new Set(files.map(file => file.filePath));
      const pendingOnly: FileData[] = [];
      for (const filePath of pendingReviewFiles) {
        if (!existingPaths.has(filePath)) {
          pendingOnly.push({ filePath });
          existingPaths.add(filePath);
        }
      }
      if (pendingOnly.length > 0) {
        sourceFiles = [...files, ...pendingOnly];
      }
    }

    const groups = new Map<string, FileData>();
    sourceFiles.forEach(file => {
      const existing = groups.get(file.filePath);
      if (existing) {
        // Aggregate stats
        groups.set(file.filePath, {
          filePath: file.filePath,
          operation: file.operation || existing.operation,
          linesAdded: (existing.linesAdded || 0) + (file.linesAdded || 0),
          linesRemoved: (existing.linesRemoved || 0) + (file.linesRemoved || 0)
        });
      } else {
        groups.set(file.filePath, { ...file });
      }
    });
    return Array.from(groups.values());
  }, [files, pendingReviewFiles, type]);

  // Build directory tree from file list
  const buildDirectoryTree = (fileList: FileData[]): DirectoryNode => {
    const root: DirectoryNode = {
      path: '',
      displayPath: '',
      files: [],
      subdirectories: new Map(),
      fileCount: 0
    };

    fileList.forEach(file => {
      const relativePath = getRelativePath(file.filePath);
      const parts = relativePath.split('/');

      if (parts.length === 1) {
        root.files.push(file);
        root.fileCount++;
        return;
      }

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
      currentNode.fileCount++;
    });

    return collapseDirectoryTree(root);
  };

  const collapseDirectoryTree = (node: DirectoryNode): DirectoryNode => {
    node.subdirectories.forEach((subdir, key) => {
      node.subdirectories.set(key, collapseDirectoryTree(subdir));
    });

    if (node.subdirectories.size === 1 && node.files.length === 0) {
      const [childKey, childNode] = Array.from(node.subdirectories.entries())[0];
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

  const expandAll = () => {
    if (groupedFiles.length > 0) {
      const tree = buildDirectoryTree(groupedFiles);
      const allPaths = getAllFolderPaths(tree);
      setExpandedFolders(new Set(allPaths));
    }
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  const fetchFiles = useCallback(async () => {
    if (!sessionId) {
      setFiles([]);
      return;
    }
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.invoke(
          'session-files:get-by-session',
          sessionId,
          type
        );
        if (result.success && result.files) {
          const fileData: FileData[] = result.files.map((f: any) => ({
            filePath: f.filePath,
            operation: f.metadata?.operation,
            linesAdded: f.metadata?.linesAdded,
            linesRemoved: f.metadata?.linesRemoved
          }));
          setFiles(fileData);
        }
      }
    } catch (error) {
      console.error('[FileGutter] Failed to fetch file links:', error);
    }
  }, [sessionId, type]);

  // Auto-expand all folders when groupByDirectory is enabled or files change
  useEffect(() => {
    if (groupByDirectory && groupedFiles.length > 0) {
      const tree = buildDirectoryTree(groupedFiles);
      const allPaths = getAllFolderPaths(tree);
      setExpandedFolders(new Set(allPaths));
    }
  }, [groupByDirectory, groupedFiles]);

  // Watch centrally-maintained atoms (updated by fileStateListeners.ts) and
  // refetch when they change. Avoids component-level IPC subscriptions.
  const sessionFileEdits = useAtomValue(sessionFileEditsAtom(sessionId ?? ''));
  const centralPendingReviewFiles = useAtomValue(sessionPendingReviewFilesAtom(sessionId ?? ''));
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, sessionFileEdits, centralPendingReviewFiles]);

  // Fetch git status for edited files
  useEffect(() => {
    if (!workspacePath || type !== 'edited' || groupedFiles.length === 0) {
      setGitStatus({});
      return;
    }

    const fetchGitStatus = async () => {
      try {
        const filePaths = groupedFiles.map(f => getRelativePath(f.filePath));

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
        console.error('[FileGutter] Failed to fetch git status:', error);
      }
    };

    fetchGitStatus();

    // Refresh on window focus
    const handleFocus = () => {
      fetchGitStatus();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [groupedFiles, workspacePath, type]);

  if (groupedFiles.length === 0) {
    return null;
  }

  const handleFileClick = (filePath: string) => {
    if (onFileClick) {
      onFileClick(filePath);
    } else if (window.electronAPI && workspacePath) {
      window.electronAPI.invoke('workspace:open-file', { workspacePath, filePath });
    }
  };

  const getOperationIcon = (operation?: string) => {
    switch (operation) {
      case 'create':
        return <MaterialSymbol icon="add" size={14} className={`file-gutter__icon file-gutter__icon--create w-3.5 h-3.5 ${fileGutterIconTone.create}`} />;
      case 'edit':
        return <MaterialSymbol icon="edit" size={14} className={`file-gutter__icon file-gutter__icon--edit w-3.5 h-3.5 ${fileGutterIconTone.edit}`} />;
      case 'delete':
        return <MaterialSymbol icon="delete" size={14} className={`file-gutter__icon file-gutter__icon--delete w-3.5 h-3.5 ${fileGutterIconTone.delete}`} />;
      case 'rename':
        return <MaterialSymbol icon="drive_file_rename_outline" size={14} className={`file-gutter__icon file-gutter__icon--rename w-3.5 h-3.5 ${fileGutterIconTone.rename}`} />;
      default:
        return null;
    }
  };

  const renderGitStatus = (filePath: string) => {
    if (type !== 'edited') return null;

    const relativePath = getRelativePath(filePath);
    const status = gitStatus[relativePath];
    if (!status || status.status === 'unchanged') {
      return null;
    }

    const statusChar = {
      modified: 'M',
      staged: 'S',
      untracked: '?',
      deleted: 'D',
      unchanged: ''
    }[status.status];

    const statusClasses: Record<string, string> = {
      modified: 'bg-[var(--an-warning-color)]',
      staged: 'bg-[var(--an-success-color)]',
      untracked: 'bg-[var(--an-foreground-subtle)] text-[var(--an-background)]',
      deleted: 'bg-[var(--an-diff-removed-text)]'
    };

    return (
      <span
        className={`file-gutter__git-status file-gutter__git-status--${status.status} inline-flex items-center justify-center w-3.5 h-3.5 text-[0.65rem] font-semibold rounded-[var(--an-radius-xs)] shrink-0 text-[var(--an-background)] ${statusClasses[status.status] || ''}`}
        title={`Git status: ${status.status}`}
      >
        {statusChar}
      </span>
    );
  };

  const getSectionIcon = () => {
    if (type === 'referenced') {
      return <MaterialSymbol icon="tag" size={14} className="file-gutter__section-icon agent-elements-file-gutter-section-icon w-4 h-4 text-[var(--an-foreground-muted)]" />;
    }
    return <MaterialSymbol icon="edit_document" size={14} className="file-gutter__section-icon agent-elements-file-gutter-section-icon w-4 h-4 text-[var(--an-foreground-muted)]" />;
  };

  const renderDirectoryNode = (node: DirectoryNode): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path);
    const hasContent = node.files.length > 0 || node.subdirectories.size > 0;

    return (
      <div key={node.path} className="file-gutter__directory-node mb-0.5">
        {node.displayPath && (
          <button
            onClick={() => toggleFolder(node.path)}
            className={`file-gutter__directory-header agent-elements-file-gutter-directory w-full flex items-center gap-1 px-2 py-0.5 text-[0.8125rem] font-medium text-[var(--an-foreground-muted)] bg-transparent border border-transparent cursor-pointer text-left hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] ${fileGutterButtonBase}`}
            data-agent-elements-shell="file-gutter-directory"
          >
            <MaterialSymbol
              icon={isExpanded ? "expand_more" : "chevron_right"}
              size={16}
              className="file-gutter__directory-chevron shrink-0 transition-transform duration-150 ease-out text-[var(--an-foreground-subtle)]"
            />
            <MaterialSymbol
              icon={isExpanded ? "folder_open" : "folder"}
              size={16}
              className="file-gutter__directory-icon shrink-0 text-[var(--an-foreground-muted)]"
            />
            <span className="file-gutter__directory-path flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{node.displayPath}</span>
            <span className="file-gutter__directory-count agent-elements-file-gutter-count shrink-0 py-0.5 px-1 bg-[var(--an-background-tertiary)] rounded-[var(--an-radius-xs)] text-[9px] text-[var(--an-foreground-subtle)]">{node.fileCount}</span>
          </button>
        )}

        {(isExpanded || !node.displayPath) && hasContent && (
          <div className={node.displayPath ? "file-gutter__directory-children mt-0.5 pl-4" : "file-gutter__directory-children mt-0.5"}>
            {Array.from(node.subdirectories.values()).map(subdir =>
              renderDirectoryNode(subdir)
            )}

            {node.files.map((file) => {
              const fileName = getFileName(file.filePath);
              const hasStats = type === 'edited' && (file.linesAdded || file.linesRemoved);
              const hasPendingReview = type === 'edited' && pendingReviewFiles?.has(file.filePath);

              return (
                <button
                  key={file.filePath}
                  onClick={() => handleFileClick(file.filePath)}
                  className={`${fileGutterFileClass} ${hasPendingReview ? fileGutterPendingFileClass : ''}`}
                  title={getRelativePath(file.filePath)}
                  data-agent-elements-shell="file-gutter-file"
                  data-pending-review={hasPendingReview ? 'true' : 'false'}
                >
                  <div className="file-gutter__file-content flex items-center gap-1.5">
                    {hasPendingReview && (
                      <MaterialSymbol
                        icon="rate_review"
                        size={14}
                        className="file-gutter__pending-icon text-[var(--an-warning-color)] shrink-0"
                        title="Pending review"
                      />
                    )}
                    {file.operation && (
                      <div className="file-gutter__file-operation-icon shrink-0">
                        {getOperationIcon(file.operation)}
                      </div>
                    )}
                    {renderGitStatus(file.filePath)}
                    <div className="file-gutter__file-info flex-1 min-w-0">
                      <div className="file-gutter__file-name text-[0.8125rem] text-[var(--an-foreground)] font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                        {fileName}
                      </div>
                    </div>
                    {hasStats && (
                      <div className="file-gutter__file-stats flex items-center gap-1 text-[0.6875rem] shrink-0">
                        {file.linesAdded ? (
                          <span className="file-gutter__file-stats-added text-[var(--an-success-color)]">+{file.linesAdded}</span>
                        ) : null}
                        {file.linesRemoved ? (
                          <span className="file-gutter__file-stats-removed text-[var(--an-diff-removed-text)]">-{file.linesRemoved}</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const label = type === 'referenced' ? 'Referenced' : 'Edited';

  return (
    <div
      className={`file-gutter agent-elements-file-gutter agent-elements-edit-panel flex flex-col bg-[var(--an-background-secondary)] max-h-[50%] shrink-0 text-[var(--an-foreground)] ${type === 'referenced' ? 'file-gutter--referenced border-b border-[var(--an-border-color)]' : 'file-gutter--edited border-t border-[var(--an-border-color)]'}`}
      data-testid="agent-elements-file-gutter"
      data-agent-elements-shell="file-gutter"
      data-file-gutter-type={type}
    >
      <div className="file-gutter__header-container flex items-center justify-between gap-2 py-1 px-2">
        <button
          onClick={toggleExpanded}
          className={`file-gutter__header agent-elements-file-gutter-header w-full flex items-center justify-between py-1 px-2 text-base font-semibold text-[var(--an-foreground-muted)] bg-transparent border-none cursor-pointer hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] ${fileGutterButtonBase}`}
          data-agent-elements-shell="file-gutter-header"
        >
          <div className="file-gutter__header-content flex items-center gap-1.5">
            {getSectionIcon()}
            <span>{label}</span>
            <span className="file-gutter__count agent-elements-file-gutter-count py-0.5 px-1 bg-[var(--an-background-tertiary)] rounded-[var(--an-radius-xs)] text-[9px] text-[var(--an-foreground-subtle)]">{groupedFiles.length}</span>
          </div>
          <MaterialSymbol
            icon="expand_more"
            size={16}
            className={`file-gutter__chevron w-3 h-3 transition-transform duration-150 ease-out ${isExpanded ? '' : 'file-gutter__chevron--collapsed -rotate-90'}`}
          />
        </button>

        {groupedFiles.length > 0 && (
          <div className="file-gutter__controls flex items-center gap-1 shrink-0">
            <button
              onClick={() => setGroupByDirectory(!groupByDirectory)}
              className={`${fileGutterControlButtonBase} ${groupByDirectory ? 'file-gutter__control-button--active border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)] hover:enabled:bg-[var(--an-primary-color)] hover:enabled:border-[var(--an-primary-color)]' : ''}`}
              title="Group by directory"
              data-agent-elements-shell="file-gutter-group-toggle"
            >
              <MaterialSymbol icon="folder" size={16} />
            </button>
            <button
              onClick={expandAll}
              disabled={!groupByDirectory}
              className={fileGutterControlButtonBase}
              title="Expand all"
              data-agent-elements-shell="file-gutter-expand-all"
            >
              <MaterialSymbol icon="unfold_more" size={16} />
            </button>
            <button
              onClick={collapseAll}
              disabled={!groupByDirectory}
              className={fileGutterControlButtonBase}
              title="Collapse all"
              data-agent-elements-shell="file-gutter-collapse-all"
            >
              <MaterialSymbol icon="unfold_less" size={16} />
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="file-gutter__files p-1 overflow-y-auto flex-1 min-h-0">
          {groupByDirectory ? (
            renderDirectoryNode(buildDirectoryTree(groupedFiles))
          ) : (
            groupedFiles.map((file) => {
              const fileName = getFileName(file.filePath);
              const hasStats = type === 'edited' && (file.linesAdded || file.linesRemoved);
              const hasPendingReview = type === 'edited' && pendingReviewFiles?.has(file.filePath);

              return (
                <button
                  key={file.filePath}
                  onClick={() => handleFileClick(file.filePath)}
                  className={`${fileGutterFileClass} ${hasPendingReview ? fileGutterPendingFileClass : ''}`}
                  title={getRelativePath(file.filePath)}
                  data-agent-elements-shell="file-gutter-file"
                  data-pending-review={hasPendingReview ? 'true' : 'false'}
                >
                  <div className="file-gutter__file-content flex items-center gap-1.5">
                    {hasPendingReview && (
                      <MaterialSymbol
                        icon="rate_review"
                        size={14}
                        className="file-gutter__pending-icon text-[var(--an-warning-color)] shrink-0"
                        title="Pending review"
                      />
                    )}
                    {file.operation && (
                      <div className="file-gutter__file-operation-icon shrink-0">
                        {getOperationIcon(file.operation)}
                      </div>
                    )}
                    {renderGitStatus(file.filePath)}
                    <div className="file-gutter__file-info flex-1 min-w-0">
                      <div className="file-gutter__file-name text-[0.8125rem] text-[var(--an-foreground)] font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                        {fileName}
                      </div>
                    </div>
                    {hasStats && (
                      <div className="file-gutter__file-stats flex items-center gap-1 text-[0.6875rem] shrink-0">
                        {file.linesAdded ? (
                          <span className="file-gutter__file-stats-added text-[var(--an-success-color)]">+{file.linesAdded}</span>
                        ) : null}
                        {file.linesRemoved ? (
                          <span className="file-gutter__file-stats-removed text-[var(--an-diff-removed-text)]">-{file.linesRemoved}</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
