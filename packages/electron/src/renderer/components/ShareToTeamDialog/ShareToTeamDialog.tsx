import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { sharedDocumentsAtom } from '../../store/atoms/collabDocuments';
import { activeWorkspacePathAtom } from '../../store/atoms/openProjects';
import {
  getCollabDocumentPath,
  getCollabParentPath,
  joinCollabPath,
  normalizeCollabPath,
} from '../CollabMode/collabTree';

export interface ShareToTeamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  /** Workspace-relative path used as the source label in the dialog. */
  sourceRelPath: string;
  /**
   * Called when the user confirms. Returns the selected destination folder
   * (empty string = team root) and the shared name (with extension).
   */
  onConfirm: (params: { folderPath: string; sharedName: string }) => void;
}

interface FolderNode {
  path: string;
  name: string;
  depth: number;
  children: FolderNode[];
}

const overlayClass =
  'share-to-team-overlay agent-elements-share-to-team-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] p-[var(--an-spacing-xxl)]';
const dialogClass =
  'share-to-team-dialog agent-elements-share-to-team-dialog agent-elements-tool-card flex w-[min(92vw,460px)] flex-col overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]';
const headerClass =
  'agent-elements-share-to-team-header flex items-start gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] pb-[var(--an-spacing-lg)] pt-[var(--an-spacing-xl)]';
const bodyClass = 'agent-elements-share-to-team-body px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]';
const sectionLabelClass = 'm-0 mb-[var(--an-spacing-xs)] text-[11px] font-medium text-[var(--an-foreground-subtle)]';
const cardClass =
  'rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)]';
const inputShellClass =
  'agent-elements-share-to-team-name-field flex items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-sm)] transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-[var(--an-input-focus-outline)] focus-within:ring-2 focus-within:ring-[var(--an-input-focus-outline)]';
const inputClass =
  'agent-elements-share-to-team-name-input min-w-0 flex-1 border-0 bg-transparent py-[var(--an-spacing-sm)] text-[13px] text-[var(--an-input-color)] outline-none placeholder:text-[var(--an-input-placeholder-color)]';
const inlineInputClass =
  'agent-elements-share-to-team-new-folder-input min-w-0 flex-1 rounded-[var(--an-input-border-radius)] border border-[var(--an-input-focus-outline)] bg-[var(--an-input-background)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-[13px] text-[var(--an-input-color)] outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
const iconShellClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]';
const subtleIconClass = 'inline-flex shrink-0 items-center justify-center text-[var(--an-foreground-subtle)]';
const folderIconClass = 'inline-flex h-5 w-5 shrink-0 items-center justify-center text-[var(--an-foreground-muted)]';
const selectedFolderIconClass = 'inline-flex h-5 w-5 shrink-0 items-center justify-center text-[var(--an-primary-color)]';
const folderRowBaseClass =
  'agent-elements-share-to-team-folder-row group relative flex cursor-pointer items-center gap-[var(--an-spacing-xs)] rounded-[var(--an-tool-border-radius)] border px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-[13px] transition-[background-color,border-color,color,box-shadow] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
const folderRowIdleClass =
  'border-transparent bg-transparent text-[var(--an-foreground)] hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)]';
const folderRowSelectedClass =
  'border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] text-[var(--an-foreground)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--an-primary-color)_14%,transparent)]';
const badgeClass =
  'agent-elements-share-to-team-badge rounded-full border border-[color-mix(in_srgb,var(--an-primary-color)_22%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] px-2 py-0.5 text-[10px] font-medium leading-none text-[var(--an-primary-color)]';
const secondaryButtonClass =
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-3 py-1.5 text-[13px] font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
const primaryButtonClass =
  'inline-flex min-h-8 items-center justify-center gap-[var(--an-spacing-xs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--an-send-button-color)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-50';

// Build a folder-only tree from existing shared-document titles + custom folders.
// Document titles look like "Engineering/Design Reviews/foo.md"; we strip the
// filename segment (the leaf) and keep every intermediate path as a folder.
function buildFolderTree(documentTitles: string[], customFolders: string[]): FolderNode[] {
  const folderPaths = new Set<string>();

  for (const title of documentTitles) {
    let cursor = getCollabParentPath(normalizeCollabPath(title));
    while (cursor) {
      folderPaths.add(cursor);
      cursor = getCollabParentPath(cursor);
    }
  }
  for (const folder of customFolders) {
    const normalized = normalizeCollabPath(folder);
    if (normalized) folderPaths.add(normalized);
  }

  const sorted = Array.from(folderPaths).sort();
  const byPath = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const path of sorted) {
    const parts = path.split('/');
    const node: FolderNode = {
      path,
      name: parts[parts.length - 1],
      depth: parts.length - 1,
      children: [],
    };
    byPath.set(path, node);
    const parentPath = getCollabParentPath(path);
    if (parentPath && byPath.has(parentPath)) {
      byPath.get(parentPath)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function ShareToTeamDialog({
  isOpen,
  onClose,
  fileName,
  sourceRelPath,
  onConfirm,
}: ShareToTeamDialogProps) {
  const sharedDocuments = useAtomValue(sharedDocumentsAtom);
  const workspacePath = useAtomValue(activeWorkspacePathAtom);

  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [pendingCustomFolders, setPendingCustomFolders] = useState<string[]>([]);
  const [lastSharedFolder, setLastSharedFolder] = useState<string>('');
  const [hasLastSharedFolder, setHasLastSharedFolder] = useState(false);
  const [hasLoadedState, setHasLoadedState] = useState(false);

  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [sharedName, setSharedName] = useState<string>(fileName);
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const hasSeededSelectionRef = useRef(false);

  // Reset transient state every time the dialog opens for a different file.
  useEffect(() => {
    if (!isOpen) return;
    setSharedName(fileName);
    setNewFolderParent(null);
    setNewFolderName('');
    hasSeededSelectionRef.current = false;
  }, [isOpen, fileName]);

  // Load workspace-persisted state: custom folders + last-shared folder.
  useEffect(() => {
    if (!isOpen) return;
    setHasLoadedState(false);
    if (!workspacePath || !window.electronAPI?.invoke) {
      setHasLoadedState(true);
      return;
    }
    let cancelled = false;
    window.electronAPI.invoke('workspace:get-state', workspacePath)
      .then((state: any) => {
        if (cancelled) return;
        const persistedCustom = Array.isArray(state?.collabTree?.customFolders)
          ? state.collabTree.customFolders.map((f: string) => normalizeCollabPath(f)).filter(Boolean)
          : [];
        const hasPersistedLast = typeof state?.collabTree?.lastSharedFolder === 'string';
        const persistedLast = hasPersistedLast
          ? normalizeCollabPath(state.collabTree.lastSharedFolder)
          : '';
        setCustomFolders(Array.from(new Set(persistedCustom)));
        setLastSharedFolder(persistedLast);
        setHasLastSharedFolder(hasPersistedLast);
        setHasLoadedState(true);
      })
      .catch(() => {
        if (cancelled) return;
        setHasLastSharedFolder(false);
        setHasLoadedState(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, workspacePath]);

  const documentTitles = useMemo(
    () => sharedDocuments.map(doc => getCollabDocumentPath(doc)),
    [sharedDocuments],
  );

  const folderTree = useMemo(
    () => buildFolderTree(documentTitles, [...customFolders, ...pendingCustomFolders]),
    [documentTitles, customFolders, pendingCustomFolders],
  );

  const allFolderPaths = useMemo(() => {
    const set = new Set<string>();
    const walk = (nodes: FolderNode[]) => {
      for (const node of nodes) {
        set.add(node.path);
        walk(node.children);
      }
    };
    walk(folderTree);
    return set;
  }, [folderTree]);

  // After state loads, seed the selection + expanded state from last-used.
  useEffect(() => {
    if (!isOpen || !hasLoadedState) return;
    if (hasSeededSelectionRef.current) return;
    hasSeededSelectionRef.current = true;
    const candidate =
      hasLastSharedFolder && lastSharedFolder === ''
        ? ''
        : lastSharedFolder && allFolderPaths.has(lastSharedFolder)
          ? lastSharedFolder
          : '';
    setSelectedFolder(candidate);
    const expanded = new Set<string>();
    let cursor: string | null = candidate;
    while (cursor) {
      expanded.add(cursor);
      cursor = getCollabParentPath(cursor);
    }
    setExpandedFolders(expanded);
  }, [isOpen, hasLoadedState, hasLastSharedFolder, lastSharedFolder, allFolderPaths]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // The "New folder" button (above the tree) creates a child of whatever's
  // currently selected. `null` parent here is "root"; empty string '' is the
  // canonical normalized form we use elsewhere — they mean the same thing.
  const beginNewFolder = useCallback((parent: string | null) => {
    const normalizedParent = parent ?? '';
    setNewFolderParent(normalizedParent);
    setNewFolderName('');
    if (normalizedParent) {
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.add(normalizedParent);
        return next;
      });
    }
  }, []);

  const commitNewFolder = useCallback(() => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setNewFolderParent(null);
      setNewFolderName('');
      return;
    }
    if (trimmed.includes('/') || trimmed.includes('\\')) {
      // Reject path separators; folder names are single segments.
      return;
    }
    const parent = newFolderParent ?? '';
    const fullPath = parent
      ? joinCollabPath(parent, trimmed)
      : normalizeCollabPath(trimmed);
    if (!fullPath || allFolderPaths.has(fullPath)) {
      setNewFolderParent(null);
      setNewFolderName('');
      setSelectedFolder(fullPath);
      return;
    }
    setPendingCustomFolders(prev => Array.from(new Set([...prev, fullPath])));
    setSelectedFolder(fullPath);
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.add(fullPath);
      if (parent) next.add(parent);
      return next;
    });
    setNewFolderParent(null);
    setNewFolderName('');
  }, [allFolderPaths, newFolderName, newFolderParent]);

  const cancelNewFolder = useCallback(() => {
    setNewFolderParent(null);
    setNewFolderName('');
  }, []);

  const handleConfirm = useCallback(() => {
    const trimmedName = sharedName.trim();
    if (!trimmedName) return;
    onConfirm({ folderPath: selectedFolder, sharedName: trimmedName });
    onClose();
  }, [onClose, onConfirm, selectedFolder, sharedName]);

  if (!isOpen) return null;

  const renderFolderRow = (node: FolderNode) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFolder === node.path;
    const isLastUsed = hasLastSharedFolder && lastSharedFolder !== '' && node.path === lastSharedFolder;
    const hasChildren = node.children.length > 0;
    const showInlineNewFolder = newFolderParent === node.path;
    const depthPx = 8 + node.depth * 18;

    return (
      <React.Fragment key={node.path}>
        <div
          role="treeitem"
          aria-selected={isSelected}
          tabIndex={0}
          onClick={() => setSelectedFolder(node.path)}
          onDoubleClick={() => toggleFolder(node.path)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedFolder(node.path);
            }
          }}
          className={`${folderRowBaseClass} ${isSelected ? folderRowSelectedClass : folderRowIdleClass}`}
          data-agent-elements-shell="share-to-team-folder-row"
          data-folder-path={node.path}
          style={{ paddingLeft: depthPx }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleFolder(node.path);
            }}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-[var(--an-radius-xs)] text-[var(--an-foreground-subtle)] transition-[background-color,color] duration-150 ease-out ${
              hasChildren ? 'cursor-pointer' : 'cursor-default invisible'
            }`}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <MaterialSymbol icon={isExpanded ? 'expand_more' : 'chevron_right'} size={16} aria-hidden="true" />
          </button>
          <span
            className={isSelected ? selectedFolderIconClass : folderIconClass}
            aria-hidden="true"
          >
            <MaterialSymbol icon={isExpanded ? 'folder_open' : 'folder'} size={18} />
          </span>
          <span className="flex-1 truncate">{node.name}</span>
          {isLastUsed && (
            <span className={badgeClass} data-agent-elements-shell="share-to-team-badge">
              last used
            </span>
          )}
        </div>
        {showInlineNewFolder && (
          <div
            className="agent-elements-share-to-team-inline-folder flex items-center gap-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]"
            data-agent-elements-shell="share-to-team-inline-folder"
            style={{ paddingLeft: depthPx + 18 }}
          >
            <span className={subtleIconClass} aria-hidden="true">
              <MaterialSymbol icon="create_new_folder" size={14} />
            </span>
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitNewFolder();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelNewFolder();
                }
              }}
              onBlur={commitNewFolder}
              placeholder="Folder name"
              className={inlineInputClass}
            />
          </div>
        )}
        {isExpanded && node.children.map(child => renderFolderRow(child))}
      </React.Fragment>
    );
  };

  const destinationFolderLabel = selectedFolder || 'Team root';
  const destinationFullPath = selectedFolder
    ? `${selectedFolder.split('/').join(' / ')} /`
    : 'Team root /';

  const isRootCreateOpen = newFolderParent === '';

  return (
    <div
      className={overlayClass}
      data-component="ShareToTeamDialogBackdrop"
      data-testid="agent-elements-share-to-team-backdrop"
      data-agent-elements-shell="share-to-team-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={dialogClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Share to Team"
        data-component="ShareToTeamDialog"
        data-testid="agent-elements-share-to-team-dialog"
        data-agent-elements-shell="share-to-team-dialog"
      >
        <div
          className={headerClass}
          data-testid="agent-elements-share-to-team-header"
          data-agent-elements-shell="share-to-team-header"
        >
          <div className={iconShellClass} data-agent-elements-shell="share-to-team-icon" aria-hidden="true">
            <MaterialSymbol icon="group" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-sm font-medium leading-snug text-[var(--an-foreground)]">
              Share to Team
            </h2>
            <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
              Pick where this document should live in your team space.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="agent-elements-share-to-team-close inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            aria-label="Close"
            data-agent-elements-shell="share-to-team-close"
          >
            <MaterialSymbol icon="close" size={16} aria-hidden="true" />
          </button>
        </div>

        <div className={bodyClass} data-agent-elements-shell="share-to-team-body">
          <div className={sectionLabelClass}>
            Source file
          </div>
          <div
            className={`agent-elements-share-to-team-source mb-[var(--an-spacing-xl)] flex items-center gap-[var(--an-spacing-sm)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)] ${cardClass}`}
            data-testid="agent-elements-share-to-team-source"
            data-agent-elements-shell="share-to-team-source"
          >
            <span className={selectedFolderIconClass} aria-hidden="true">
              <MaterialSymbol icon="description" size={20} />
            </span>
            <div className="min-w-0 flex-1 select-text">
              <div className="truncate text-[13px] font-medium text-[var(--an-foreground)]">{fileName}</div>
              <div className="truncate text-[11px] text-[var(--an-foreground-subtle)]">{sourceRelPath}</div>
            </div>
          </div>

          <div className={sectionLabelClass}>
            Shared name
          </div>
          <div
            className={`${inputShellClass} mb-[var(--an-spacing-xl)]`}
            data-testid="agent-elements-share-to-team-name-field"
            data-agent-elements-shell="share-to-team-name-field"
          >
            <span className={subtleIconClass} aria-hidden="true">
              <MaterialSymbol icon="edit" size={14} />
            </span>
            <input
              type="text"
              value={sharedName}
              onChange={(e) => setSharedName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sharedName.trim()) {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              className={inputClass}
              data-testid="agent-elements-share-to-team-name-input"
              placeholder="document.md"
            />
          </div>

          <div className="mb-[var(--an-spacing-xs)] flex items-center justify-between gap-[var(--an-spacing-sm)]">
            <div className={sectionLabelClass}>
              Destination folder
            </div>
            <button
              type="button"
              onClick={() => beginNewFolder(selectedFolder || null)}
              className="agent-elements-share-to-team-new-folder inline-flex cursor-pointer items-center gap-[var(--an-spacing-xs)] rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent px-2 py-1 text-[11px] font-medium text-[var(--an-primary-color)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
              data-agent-elements-shell="share-to-team-new-folder"
            >
              <MaterialSymbol icon="create_new_folder" size={13} aria-hidden="true" />
              New folder
            </button>
          </div>
          <div
            className={`share-to-team-tree agent-elements-share-to-team-tree nim-scrollbar mb-[var(--an-spacing-lg)] max-h-[240px] overflow-y-auto p-[var(--an-spacing-xs)] ${cardClass}`}
            role="tree"
            data-testid="agent-elements-share-to-team-tree"
            data-agent-elements-shell="share-to-team-tree"
          >
            <div
              role="treeitem"
              aria-selected={selectedFolder === ''}
              tabIndex={0}
              onClick={() => setSelectedFolder('')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedFolder('');
                }
              }}
              className={`${folderRowBaseClass} ${selectedFolder === '' ? folderRowSelectedClass : folderRowIdleClass}`}
              data-agent-elements-shell="share-to-team-folder-row"
              data-folder-path=""
              style={{ paddingLeft: 8 }}
            >
              <span className="invisible inline-flex h-5 w-5 items-center justify-center text-[var(--an-foreground-subtle)]" aria-hidden="true">
                <MaterialSymbol icon="chevron_right" size={16} />
              </span>
              <span className={selectedFolder === '' ? selectedFolderIconClass : folderIconClass} aria-hidden="true">
                <MaterialSymbol icon="workspaces" size={18} />
              </span>
              <span className="flex-1 truncate">Team root</span>
              {hasLastSharedFolder && lastSharedFolder === '' && (
                <span className={badgeClass} data-agent-elements-shell="share-to-team-badge">
                  last used
                </span>
              )}
            </div>

            {folderTree.map(node => renderFolderRow(node))}

            {/* Inline new-folder input at root level */}
            {isRootCreateOpen && (
              <div
                className="agent-elements-share-to-team-inline-folder flex items-center gap-[var(--an-spacing-sm)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]"
                data-agent-elements-shell="share-to-team-inline-folder"
              >
                <span className={subtleIconClass} aria-hidden="true">
                  <MaterialSymbol icon="create_new_folder" size={14} />
                </span>
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitNewFolder();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelNewFolder();
                    }
                  }}
                  onBlur={commitNewFolder}
                  placeholder="Folder name"
                  className={inlineInputClass}
                />
              </div>
            )}
          </div>

          <div
            className={`agent-elements-share-to-team-summary flex items-center gap-[var(--an-spacing-sm)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)] text-[12px] text-[var(--an-foreground-muted)] ${cardClass}`}
            data-testid="agent-elements-share-to-team-summary"
            data-agent-elements-shell="share-to-team-summary"
          >
            <span className={subtleIconClass} aria-hidden="true">
              <MaterialSymbol icon="place" size={14} />
            </span>
            <span>Will be shared as</span>
            <span className="truncate font-medium text-[var(--an-foreground)]" title={destinationFolderLabel}>
              {destinationFullPath}
            </span>
            <span className="truncate text-[var(--an-primary-color)]" title={sharedName}>
              {sharedName || fileName}
            </span>
          </div>
        </div>

        <div
          className="agent-elements-share-to-team-actions flex justify-end gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]"
          data-testid="agent-elements-share-to-team-actions"
          data-agent-elements-shell="share-to-team-actions"
        >
          <button
            type="button"
            onClick={onClose}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!sharedName.trim()}
            className={primaryButtonClass}
          >
            <MaterialSymbol icon="group_add" size={16} aria-hidden="true" />
            Share to Team
          </button>
        </div>
      </div>
    </div>
  );
}
