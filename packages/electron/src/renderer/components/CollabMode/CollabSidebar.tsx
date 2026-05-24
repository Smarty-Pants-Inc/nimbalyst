import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { InputModal } from '../InputModal';
import { WorkspaceSummaryHeader } from '../WorkspaceSummaryHeader';
import { useFloatingMenu, FloatingPortal, virtualElement } from '../../hooks/useFloatingMenu';
import {
  sharedDocumentsAtom,
  teamSyncStatusAtom,
  removeSharedDocument,
  updateSharedDocumentTitle,
  activeTeamOrgIdAtom,
  buildSharedDocumentDeepLink,
  type SharedDocument,
} from '../../store/atoms/collabDocuments';
import { errorNotificationService } from '../../services/ErrorNotificationService';
import {
  buildCollabTree,
  getCollabDocumentPath,
  getCollabNodeName,
  getCollabParentPath,
  joinCollabPath,
  normalizeCollabPath,
  renameCollabDocumentPath,
  type CollabTreeNode,
} from './collabTree';
import { registerDocumentInIndex } from '../../store/atoms/collabDocuments';
import { useCollabLocalOrigin } from '../../hooks/useCollabLocalOrigin';

// ---------------------------------------------------------------------------
// TeamSync status indicator -- shown in the header subtitle slot
// ---------------------------------------------------------------------------

type TeamSyncStatus = 'disconnected' | 'connecting' | 'syncing' | 'connected' | 'error';

const STATUS_CONFIG: Record<TeamSyncStatus, { label: string; dotClass: string }> = {
  connected:    { label: 'Team synced',   dotClass: 'bg-[var(--an-diff-added-text)]' },
  syncing:      { label: 'Syncing...',    dotClass: 'bg-[var(--an-primary-color)] animate-pulse' },
  connecting:   { label: 'Connecting...', dotClass: 'bg-[var(--an-primary-color)] animate-pulse' },
  disconnected: { label: 'Disconnected',  dotClass: 'bg-[var(--an-foreground-subtle)]' },
  error:        { label: 'Sync error',    dotClass: 'bg-[var(--an-diff-removed-text)]' },
};

const TeamSyncStatusLabel: React.FC<{ status: TeamSyncStatus }> = ({ status }) => {
  const { label, dotClass } = STATUS_CONFIG[status];
  return (
    <span
      className="agent-elements-collab-sync-status inline-flex items-center gap-[var(--an-spacing-xs)] text-[11px] font-medium leading-none text-[var(--an-foreground-muted)]"
      data-agent-elements-shell="collab-sync-status"
      data-sync-status={status}
      data-testid="agent-elements-collab-sync-status"
    >
      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
};

const sidebarActionClassName =
  'workspace-action-button agent-elements-collab-header-action inline-flex h-7 w-7 items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent text-[var(--an-foreground-subtle)] transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

const treeRowBaseClassName =
  'agent-elements-collab-tree-row mx-1 flex min-h-8 w-full items-center gap-[var(--an-spacing-xs)] rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent py-[var(--an-spacing-xs)] pr-[var(--an-spacing-sm)] text-left text-[13px] text-[var(--an-foreground-muted)] transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

const treeRowActiveClassName =
  'bg-[var(--an-background-tertiary)] text-[var(--an-foreground)] shadow-[inset_0_0_0_1px_var(--an-border-color)]';

const treeRowDropTargetClassName =
  'border-[var(--an-primary-color)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground)] shadow-[inset_0_0_0_1px_var(--an-primary-color)]';

const treeIconClassName =
  'agent-elements-collab-tree-icon text-[var(--an-foreground-muted)] transition-colors duration-150 ease-out';

const contextMenuClassName =
  'agent-elements-collab-context-menu agent-elements-tool-card z-[10000] min-w-[176px] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-1 text-[13px] text-[var(--an-foreground)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]';

const contextMenuItemClassName =
  'agent-elements-collab-context-menu-item flex w-full items-center gap-2.5 rounded-[8px] border-none bg-transparent px-3 py-2 text-left text-[13px] text-[var(--an-foreground)] transition-colors duration-150 ease-out hover:bg-[var(--an-background-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-primary-color)]';

const contextMenuDangerItemClassName =
  'agent-elements-collab-context-menu-item flex w-full items-center gap-2.5 rounded-[8px] border-none bg-transparent px-3 py-2 text-left text-[13px] text-[var(--an-diff-removed-text)] transition-colors duration-150 ease-out hover:bg-[var(--an-background-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-primary-color)]';

interface CollabSidebarProps {
  workspacePath: string;
  onDocumentSelect: (doc: SharedDocument) => void;
  activeDocumentId?: string | null;
}

export const CollabSidebar: React.FC<CollabSidebarProps> = ({
  workspacePath,
  onDocumentSelect,
  activeDocumentId,
}) => {
  const sharedDocuments = useAtomValue(sharedDocumentsAtom);
  const teamSyncStatus = useAtomValue(teamSyncStatusAtom);
  const teamOrgId = useAtomValue(activeTeamOrgIdAtom);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: CollabTreeNode;
  } | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [isCreateDocumentOpen, setIsCreateDocumentOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [documentToRename, setDocumentToRename] = useState<SharedDocument | null>(null);
  const [hasLoadedState, setHasLoadedState] = useState(false);
  const [loadedWorkspacePath, setLoadedWorkspacePath] = useState<string | null>(null);
  const [draggedDocument, setDraggedDocument] = useState<{
    documentId: string;
    sourcePath: string;
    name: string;
  } | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  const tree = useMemo(
    () => buildCollabTree(sharedDocuments, customFolders),
    [sharedDocuments, customFolders]
  );

  const existingPaths = useMemo(() => {
    const paths = new Set<string>();

    const collect = (nodes: CollabTreeNode[]) => {
      for (const node of nodes) {
        paths.add(node.path);
        if (node.type === 'folder') {
          collect(node.children);
        }
      }
    };

    collect(tree);
    return paths;
  }, [tree]);

  const activeDocument = useMemo(
    () => sharedDocuments.find(document => document.documentId === activeDocumentId) ?? null,
    [activeDocumentId, sharedDocuments]
  );

  const contextMenuReference = useMemo(
    () => contextMenu ? virtualElement(contextMenu.x, contextMenu.y) : null,
    [contextMenu]
  );
  const contextMenuFloating = useFloatingMenu({
    placement: 'right-start',
    reference: contextMenuReference,
    open: Boolean(contextMenu),
    onOpenChange: (open) => {
      if (!open) {
        setContextMenu(null);
      }
    },
  });

  const canMutateMetadata = useCallback((actionLabel: string) => {
    if (teamSyncStatus === 'connected') {
      return true;
    }

    window.alert(
      `Cannot ${actionLabel} while shared document sync is ${teamSyncStatus}. Reconnect to the team before changing shared document metadata.`
    );
    return false;
  }, [teamSyncStatus]);

  useEffect(() => {
    setHasLoadedState(false);
    setLoadedWorkspacePath(null);
    setContextMenu(null);
    setDocumentToRename(null);
    setSelectedFolderPath(null);
    setExpandedFolders(new Set());
    setCustomFolders([]);

    if (!workspacePath || !window.electronAPI?.invoke) {
      setHasLoadedState(true);
      return;
    }

    let cancelled = false;
    window.electronAPI.invoke('workspace:get-state', workspacePath)
      .then((state) => {
        if (cancelled) return;

        const nextExpanded = Array.isArray(state?.collabTree?.expandedFolders)
          ? state.collabTree.expandedFolders.map((folder: string) => normalizeCollabPath(folder)).filter(Boolean)
          : [];
        const nextFolders = Array.isArray(state?.collabTree?.customFolders)
          ? state.collabTree.customFolders.map((folder: string) => normalizeCollabPath(folder)).filter(Boolean)
          : [];

        setExpandedFolders(new Set(nextExpanded));
        setCustomFolders(Array.from(new Set(nextFolders)));
        setHasLoadedState(true);
        setLoadedWorkspacePath(workspacePath);
      })
      .catch(() => {
        if (cancelled) return;
        setHasLoadedState(true);
        setLoadedWorkspacePath(workspacePath);
      });

    return () => {
      cancelled = true;
    };
  }, [workspacePath]);

  useEffect(() => {
    if (!hasLoadedState || loadedWorkspacePath !== workspacePath || !workspacePath || !window.electronAPI?.invoke) return;

    const payload = {
      collabTree: {
        expandedFolders: Array.from(expandedFolders),
        customFolders,
      },
    };

    window.electronAPI.invoke('workspace:update-state', workspacePath, payload).catch((error) => {
      console.warn('[CollabSidebar] Failed to persist tree state:', error);
    });
  }, [customFolders, expandedFolders, hasLoadedState, loadedWorkspacePath, workspacePath]);

  useEffect(() => {
    if (!activeDocument) return;
    const path = getCollabDocumentPath(activeDocument);
    const parents: string[] = [];
    let current = getCollabParentPath(path);
    while (current) {
      parents.unshift(current);
      current = getCollabParentPath(current);
    }

    if (parents.length === 0) return;

    setExpandedFolders((currentFolders) => {
      const next = new Set(currentFolders);
      let changed = false;
      for (const folderPath of parents) {
        if (!next.has(folderPath)) {
          next.add(folderPath);
          changed = true;
        }
      }
      return changed ? next : currentFolders;
    });
  }, [activeDocument]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: CollabTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.type === 'folder') {
      setSelectedFolderPath(node.path);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleCopyLink = useCallback(async (document: SharedDocument) => {
    if (!teamOrgId) {
      errorNotificationService.showWarning(
        'No team configured',
        'This workspace is not connected to a team, so no shareable link is available.',
        { duration: 4000 }
      );
      return;
    }
    const url = buildSharedDocumentDeepLink(document.documentId, teamOrgId);
    try {
      await navigator.clipboard.writeText(url);
      errorNotificationService.showInfo(
        'Link copied',
        'Paste it anywhere to open this document in Nimbalyst.',
        { duration: 3000 }
      );
    } catch (err) {
      console.error('[CollabSidebar] Failed to copy link:', err);
      errorNotificationService.showError(
        'Copy failed',
        'Could not write the link to the clipboard.'
      );
    }
  }, [teamOrgId]);

  const handleDelete = useCallback(() => {
    if (!contextMenu || contextMenu.node.type !== 'document') return;
    if (!canMutateMetadata('delete this document')) return;
    const { document } = contextMenu.node;
    if (window.confirm(`Delete shared document "${document.title}"?`)) {
      removeSharedDocument(document.documentId);
    }
    setContextMenu(null);
  }, [canMutateMetadata, contextMenu]);

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((currentFolders) => {
      const next = new Set(currentFolders);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const getCreationBaseFolder = useCallback(() => {
    return contextMenu?.node.type === 'folder'
      ? contextMenu.node.path
      : selectedFolderPath;
  }, [contextMenu, selectedFolderPath]);

  const handleCreateFolder = useCallback((folderName: string) => {
    const nextPath = joinCollabPath(getCreationBaseFolder(), folderName);
    if (!nextPath) return;

    if (existingPaths.has(nextPath)) {
      window.alert(`A document or folder named "${nextPath}" already exists.`);
      return;
    }

    setCustomFolders((currentFolders) => Array.from(new Set([...currentFolders, nextPath])));
    setExpandedFolders((currentFolders) => {
      const next = new Set(currentFolders);
      next.add(nextPath);
      const parent = getCollabParentPath(nextPath);
      if (parent) {
        next.add(parent);
      }
      return next;
    });
    setSelectedFolderPath(nextPath);
    setIsCreateFolderOpen(false);
    setContextMenu(null);
  }, [existingPaths, getCreationBaseFolder]);

  const handleCreateDocument = useCallback(async (documentName: string) => {
    if (!canMutateMetadata('create documents')) return;

    const title = joinCollabPath(getCreationBaseFolder(), documentName);
    if (!title) return;

    if (existingPaths.has(title)) {
      window.alert(`A document or folder named "${title}" already exists.`);
      return;
    }

    const now = Date.now();
    const documentId = crypto.randomUUID();
    const document: SharedDocument = {
      documentId,
      title,
      documentType: 'markdown',
      createdBy: '',
      createdAt: now,
      updatedAt: now,
    };

    await registerDocumentInIndex(documentId, title, 'markdown');

    const parent = getCollabParentPath(title);
    if (parent) {
      setExpandedFolders((currentFolders) => {
        const next = new Set(currentFolders);
        next.add(parent);
        return next;
      });
    }

    setSelectedFolderPath(parent);
    setIsCreateDocumentOpen(false);
    setContextMenu(null);
    onDocumentSelect(document);
  }, [canMutateMetadata, existingPaths, getCreationBaseFolder, onDocumentSelect]);

  const handleRenameDocument = useCallback(async (documentName: string) => {
    if (!documentToRename) return;
    if (!canMutateMetadata('rename this document')) return;

    const currentPath = getCollabDocumentPath(documentToRename);
    const nextPath = renameCollabDocumentPath(currentPath, documentName);
    if (!nextPath || nextPath === currentPath) {
      setDocumentToRename(null);
      setContextMenu(null);
      return;
    }

    if (existingPaths.has(nextPath)) {
      window.alert(`A document or folder named "${nextPath}" already exists.`);
      return;
    }

    await updateSharedDocumentTitle(documentToRename.documentId, nextPath);

    const parent = getCollabParentPath(nextPath);
    if (parent) {
      setExpandedFolders((currentFolders) => {
        const next = new Set(currentFolders);
        next.add(parent);
        return next;
      });
    }

    setSelectedFolderPath(parent);
    setDocumentToRename(null);
    setContextMenu(null);
  }, [canMutateMetadata, documentToRename, existingPaths]);

  const moveDraggedDocument = useCallback(async (targetFolderPath: string | null) => {
    if (!draggedDocument) return;
    if (!canMutateMetadata('move this document')) {
      setDropTargetPath(null);
      setDraggedDocument(null);
      return;
    }

    const nextPath = joinCollabPath(targetFolderPath, draggedDocument.name);
    if (!nextPath || nextPath === draggedDocument.sourcePath) {
      setDropTargetPath(null);
      setDraggedDocument(null);
      return;
    }

    if (existingPaths.has(nextPath) && nextPath !== draggedDocument.sourcePath) {
      window.alert(`A document or folder named "${nextPath}" already exists.`);
      setDropTargetPath(null);
      setDraggedDocument(null);
      return;
    }

    await updateSharedDocumentTitle(draggedDocument.documentId, nextPath);

    if (targetFolderPath) {
      setExpandedFolders((currentFolders) => {
        const next = new Set(currentFolders);
        next.add(targetFolderPath);
        return next;
      });
      setSelectedFolderPath(targetFolderPath);
    } else {
      setSelectedFolderPath(null);
    }

    setDropTargetPath(null);
    setDraggedDocument(null);
  }, [canMutateMetadata, draggedDocument, existingPaths]);

  const canDropDocument = useCallback((targetFolderPath: string | null) => {
    if (!draggedDocument) return false;

    const nextPath = joinCollabPath(targetFolderPath, draggedDocument.name);
    if (!nextPath || nextPath === draggedDocument.sourcePath) {
      return false;
    }

    return !existingPaths.has(nextPath) || nextPath === draggedDocument.sourcePath;
  }, [draggedDocument, existingPaths]);

  const renderTree = useCallback((nodes: CollabTreeNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      const indent = depth * 16 + 8;

      if (node.type === 'folder') {
        const isExpanded = expandedFolders.has(node.path);
        const isSelected = selectedFolderPath === node.path;
        const isDropTarget = dropTargetPath === node.path;

        return (
          <div key={node.id}>
            <button
              className={`file-tree-directory ${treeRowBaseClassName}${isSelected ? ` selected ${treeRowActiveClassName}` : ''}${isDropTarget ? ` drag-over ${treeRowDropTargetClassName}` : ''}`}
              style={{ paddingLeft: indent }}
              data-component="CollabSidebarTreeRow"
              data-agent-elements-shell="collab-tree-row"
              data-collab-node-type="folder"
              data-collab-path={node.path}
              data-expanded={isExpanded ? 'true' : 'false'}
              data-selected={isSelected ? 'true' : 'false'}
              data-drop-target={isDropTarget ? 'true' : 'false'}
              onClick={() => {
                toggleFolder(node.path);
                setSelectedFolderPath(node.path);
              }}
              onContextMenu={(event) => handleContextMenu(event, node)}
              onDragOver={(event) => {
                if (!canDropDocument(node.path)) return;
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = 'move';
                if (dropTargetPath !== node.path) {
                  setDropTargetPath(node.path);
                }
              }}
              onDragLeave={(event) => {
                event.stopPropagation();
                const relatedTarget = event.relatedTarget as Node | null;
                if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
                  return;
                }
                if (dropTargetPath === node.path) {
                  setDropTargetPath(null);
                }
              }}
              onDrop={(event) => {
                if (!canDropDocument(node.path)) return;
                event.preventDefault();
                event.stopPropagation();
                void moveDraggedDocument(node.path);
              }}
              title={node.path}
            >
              <span className="file-tree-chevron agent-elements-collab-tree-chevron text-[var(--an-foreground-subtle)]">
                <MaterialSymbol
                  icon={isExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
                  size={16}
                />
              </span>
              <span className={`file-tree-icon ${treeIconClassName}`}>
                <MaterialSymbol icon={isExpanded ? 'folder_open' : 'folder'} size={18} />
              </span>
              <span className="file-tree-name min-w-0 flex-1 truncate">{node.name}</span>
            </button>
            {isExpanded ? renderTree(node.children, depth + 1) : null}
          </div>
        );
      }

      const isActive = node.document.documentId === activeDocumentId;

      return (
        <button
          key={node.id}
          className={`file-tree-file ${treeRowBaseClassName}${isActive ? ` active ${treeRowActiveClassName}` : ''}`}
          style={{ paddingLeft: indent }}
          data-component="CollabSidebarTreeRow"
          data-agent-elements-shell="collab-tree-row"
          data-collab-node-type="document"
          data-collab-document-id={node.document.documentId}
          data-collab-path={node.path}
          data-active={isActive ? 'true' : 'false'}
          onClick={() => {
            setSelectedFolderPath(getCollabParentPath(node.path));
            onDocumentSelect(node.document);
          }}
          onContextMenu={(event) => handleContextMenu(event, node)}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', node.document.documentId);
            setDraggedDocument({
              documentId: node.document.documentId,
              sourcePath: node.path,
              name: node.name,
            });
          }}
          onDragEnd={() => {
            setDraggedDocument(null);
            setDropTargetPath(null);
          }}
          title={node.path}
        >
          <span className="file-tree-spacer w-4 shrink-0" />
          <span className={`file-tree-icon ${treeIconClassName}`}>
            <MaterialSymbol icon="description" size={16} />
          </span>
          <span className="file-tree-name min-w-0 flex-1 truncate">{node.name}</span>
        </button>
      );
    });
  }, [
    activeDocumentId,
    canDropDocument,
    dropTargetPath,
    expandedFolders,
    handleContextMenu,
    moveDraggedDocument,
    onDocumentSelect,
    selectedFolderPath,
    toggleFolder,
  ]);

  const selectedFolderLabel = selectedFolderPath ? getCollabNodeName(selectedFolderPath) : 'Shared Docs';
  const contextDocument = contextMenu?.node.type === 'document' ? contextMenu.node.document : null;
  const contextLocalOrigin = useCollabLocalOrigin(
    workspacePath,
    contextDocument?.documentId,
    contextDocument?.documentType,
  );

  return (
    <div
      className="collab-sidebar agent-elements-collab-sidebar h-full w-full flex flex-col overflow-hidden border-r border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground)] [container-type:inline-size]"
      data-component="CollabSidebar"
      data-agent-elements-shell="collab-sidebar"
      data-testid="collab-sidebar"
    >
      {/* Header -- matches WorkspaceSummaryHeader used by EditorMode */}
      <WorkspaceSummaryHeader
        workspacePath={workspacePath}
        subtitle={<TeamSyncStatusLabel status={teamSyncStatus} />}
        actionsClassName="gap-1"
        actions={
          <>
            <button
              type="button"
              className={sidebarActionClassName}
              title="New document"
              data-agent-elements-shell="collab-header-action"
              data-testid="agent-elements-collab-new-document"
              onClick={() => {
                setIsCreateDocumentOpen(true);
                setContextMenu(null);
              }}
            >
              <MaterialSymbol icon="note_add" size={16} />
            </button>
            <button
              type="button"
              className={sidebarActionClassName}
              title="New folder"
              data-agent-elements-shell="collab-header-action"
              data-testid="agent-elements-collab-new-folder"
              onClick={() => {
                setIsCreateFolderOpen(true);
                setContextMenu(null);
              }}
            >
              <MaterialSymbol icon="create_new_folder" size={16} />
            </button>
          </>
        }
      />

      {/* Document tree */}
      <div
        className={`agent-elements-collab-doc-tree flex-1 overflow-y-auto px-[var(--an-spacing-sm)] py-[var(--an-spacing-sm)] transition-colors duration-150 ease-out ${dropTargetPath === '__root__' ? 'bg-[var(--an-background-tertiary)]' : ''}`}
        data-agent-elements-shell="collab-document-tree"
        data-testid="agent-elements-collab-doc-tree"
        data-drop-target={dropTargetPath === '__root__' ? 'true' : 'false'}
        onDragOver={(event) => {
          if (!canDropDocument(null)) return;
          const target = event.target as HTMLElement;
          if (target.closest('.file-tree-directory, .file-tree-file')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          if (dropTargetPath !== '__root__') {
            setDropTargetPath('__root__');
          }
        }}
        onDragLeave={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('.file-tree-directory, .file-tree-file')) return;
          const relatedTarget = event.relatedTarget as Node | null;
          if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
            return;
          }
          if (dropTargetPath === '__root__') {
            setDropTargetPath(null);
          }
        }}
        onDrop={(event) => {
          if (!canDropDocument(null)) return;
          const target = event.target as HTMLElement;
          if (target.closest('.file-tree-directory, .file-tree-file')) return;
          event.preventDefault();
          void moveDraggedDocument(null);
        }}
      >
        {tree.length === 0 ? (
          <div
            className="agent-elements-collab-empty-state px-[var(--an-spacing-xl)] py-[var(--an-spacing-xxl)] text-center text-[var(--an-foreground-subtle)]"
            data-agent-elements-shell="collab-empty-state"
          >
            <MaterialSymbol icon="cloud_sync" size={32} className="mb-[var(--an-spacing-sm)]" />
            <p className="m-0 text-xs">
              No shared documents yet.
            </p>
            <p className="m-0 mt-[var(--an-spacing-xs)] text-xs">
              Create one here or share a local file to collaborate.
            </p>
          </div>
        ) : (
          <div className="agent-elements-collab-tree-list" data-agent-elements-shell="collab-tree-list">
            {renderTree(tree)}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <FloatingPortal>
          <div
            ref={contextMenuFloating.refs.setFloating}
            style={contextMenuFloating.floatingStyles}
            {...contextMenuFloating.getFloatingProps()}
            className={contextMenuClassName}
            data-component="CollabSidebarContextMenu"
            data-agent-elements-shell="collab-context-menu"
            data-collab-node-type={contextMenu.node.type}
            data-testid="agent-elements-collab-context-menu"
          >
            {contextMenu.node.type === 'folder' ? (
              <>
                <button
                  type="button"
                  className={contextMenuItemClassName}
                  data-agent-elements-shell="collab-context-menu-item"
                  data-collab-action="new-document"
                  data-testid="agent-elements-collab-context-new-document"
                  onClick={() => {
                    setIsCreateDocumentOpen(true);
                    setContextMenu(null);
                  }}
                >
                  <MaterialSymbol icon="note_add" size={18} />
                  <span>New Document</span>
                </button>
                <button
                  type="button"
                  className={contextMenuItemClassName}
                  data-agent-elements-shell="collab-context-menu-item"
                  data-collab-action="new-folder"
                  data-testid="agent-elements-collab-context-new-folder"
                  onClick={() => {
                    setIsCreateFolderOpen(true);
                    setContextMenu(null);
                  }}
                >
                  <MaterialSymbol icon="create_new_folder" size={18} />
                  <span>New Folder</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={contextMenuItemClassName}
                  data-agent-elements-shell="collab-context-menu-item"
                  data-collab-action="open"
                  data-testid="agent-elements-collab-context-open"
                  onClick={() => {
                    if (!contextDocument) return;
                    onDocumentSelect(contextDocument);
                    setContextMenu(null);
                  }}
                >
                  <MaterialSymbol icon="open_in_new" size={18} />
                  <span>Open</span>
                </button>
                <button
                  type="button"
                  className={contextMenuItemClassName}
                  disabled={!teamOrgId}
                  title={teamOrgId ? undefined : 'No team is connected to this workspace'}
                  data-agent-elements-shell="collab-context-menu-item"
                  data-collab-action="copy-link"
                  data-testid="agent-elements-collab-context-copy-link"
                  onClick={() => {
                    if (!contextDocument) return;
                    setContextMenu(null);
                    void handleCopyLink(contextDocument);
                  }}
                >
                  <MaterialSymbol icon="link" size={18} />
                  <span>Copy Link</span>
                </button>
                <button
                  type="button"
                  className={contextMenuItemClassName}
                  data-agent-elements-shell="collab-context-menu-item"
                  data-collab-action="rename"
                  data-testid="agent-elements-collab-context-rename"
                  onClick={() => {
                    if (!contextDocument) return;
                    setDocumentToRename(contextDocument);
                    setContextMenu(null);
                  }}
                >
                  <MaterialSymbol icon="edit" size={18} />
                  <span>Rename</span>
                </button>
                <button
                  type="button"
                  className={contextMenuItemClassName}
                  disabled={!contextLocalOrigin.hasResolvedBinding || contextLocalOrigin.busyAction !== null}
                  data-agent-elements-shell="collab-context-menu-item"
                  data-collab-action="open-local-source"
                  data-testid="agent-elements-collab-context-open-local-source"
                  onClick={() => {
                    setContextMenu(null);
                    void contextLocalOrigin.openLocalSource();
                  }}
                >
                  <MaterialSymbol icon="draft" size={18} />
                  <span>Open Local Source</span>
                </button>
                <button
                  type="button"
                  className={contextMenuItemClassName}
                  disabled={!contextLocalOrigin.binding || contextLocalOrigin.busyAction !== null}
                  data-agent-elements-shell="collab-context-menu-item"
                  data-collab-action="reupload-from-local"
                  data-testid="agent-elements-collab-context-reupload-from-local"
                  onClick={() => {
                    setContextMenu(null);
                    void contextLocalOrigin.reuploadFromLocalSource();
                  }}
                >
                  <MaterialSymbol icon="upload" size={18} />
                  <span>Re-upload From Local</span>
                </button>
                <button
                  type="button"
                  className={contextMenuItemClassName}
                  disabled={contextLocalOrigin.busyAction !== null}
                  data-agent-elements-shell="collab-context-menu-item"
                  data-collab-action={contextLocalOrigin.binding ? 'relink-local-source' : 'link-local-source'}
                  data-testid="agent-elements-collab-context-link-local-source"
                  onClick={() => {
                    setContextMenu(null);
                    void contextLocalOrigin.relinkLocalSource();
                  }}
                >
                  <MaterialSymbol icon="link" size={18} />
                  <span>{contextLocalOrigin.binding ? 'Relink Local Source...' : 'Link Local Source...'}</span>
                </button>
                {contextLocalOrigin.binding && (
                  <button
                    type="button"
                    className={contextMenuItemClassName}
                    disabled={contextLocalOrigin.busyAction !== null}
                    data-agent-elements-shell="collab-context-menu-item"
                    data-collab-action="clear-local-source"
                    data-testid="agent-elements-collab-context-clear-local-source"
                    onClick={() => {
                      setContextMenu(null);
                      void contextLocalOrigin.clearLocalSource();
                    }}
                  >
                    <MaterialSymbol icon="link_off" size={18} />
                    <span>Clear Local Source</span>
                  </button>
                )}
                <button
                  type="button"
                  className={contextMenuDangerItemClassName}
                  data-agent-elements-shell="collab-context-menu-item"
                  data-collab-action="delete"
                  data-testid="agent-elements-collab-context-delete"
                  onClick={handleDelete}
                >
                  <MaterialSymbol icon="delete" size={18} />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </FloatingPortal>
      )}

      <InputModal
        isOpen={isCreateDocumentOpen}
        title="New Shared Document"
        placeholder="Document name"
        defaultValue=""
        confirmLabel="Create"
        onConfirm={handleCreateDocument}
        onCancel={() => {
          setIsCreateDocumentOpen(false);
          setContextMenu(null);
        }}
      />

      <InputModal
        isOpen={isCreateFolderOpen}
        title="New Shared Folder"
        placeholder="Folder name"
        defaultValue=""
        confirmLabel="Create"
        onConfirm={handleCreateFolder}
        onCancel={() => {
          setIsCreateFolderOpen(false);
          setContextMenu(null);
        }}
      />

      <InputModal
        isOpen={documentToRename !== null}
        title="Rename Shared Document"
        placeholder="Document name"
        defaultValue={documentToRename ? getCollabNodeName(getCollabDocumentPath(documentToRename)) : ''}
        confirmLabel="Rename"
        onConfirm={handleRenameDocument}
        onCancel={() => {
          setDocumentToRename(null);
          setContextMenu(null);
        }}
      />
    </div>
  );
};
