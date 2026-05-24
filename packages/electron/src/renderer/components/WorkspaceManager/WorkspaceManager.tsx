import React, { useState, useEffect, useRef } from 'react';
import { useFloatingMenu, FloatingPortal, virtualElement } from '../../hooks/useFloatingMenu';

const iconClass = "material-symbols-outlined inline-flex shrink-0 items-center justify-center leading-none";

function WorkspaceIcon({
  icon,
  size = 18,
  className = '',
}: {
  icon: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`${iconClass} ${className}`}
      style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20", fontSize: size }}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

const workspaceButtonBase =
  'inline-flex h-8 items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50';
const workspacePrimaryButtonClass = `${workspaceButtonBase} border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_86%,var(--an-background))]`;
const workspaceSecondaryButtonClass = `${workspaceButtonBase} border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-secondary)] hover:text-[var(--an-foreground)]`;
const workspaceDangerButtonClass = `${workspaceButtonBase} border-[color-mix(in_srgb,var(--an-diff-removed-text)_26%,var(--an-border-color))] bg-[var(--an-background)] text-[var(--an-diff-removed-text)] hover:bg-[var(--an-diff-removed-bg)]`;
const workspaceMenuItemClass =
  'agent-elements-workspace-manager-menu-item flex w-full items-center gap-2 rounded-[var(--an-message-radius-inner)] border border-transparent bg-transparent px-3 py-2 text-left text-sm text-[var(--an-foreground)] transition-colors duration-150 hover:bg-[var(--an-background-tertiary)]';
const workspaceDialogPanelClass =
  'workspace-manager-dialog agent-elements-workspace-manager-dialog agent-elements-tool-card w-full rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-xxl)] text-[var(--an-foreground)]';
const workspaceOverlayClass =
  'workspace-manager-overlay fixed inset-0 z-[3000] flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_18%,transparent)] px-5 py-6';

// Helper function to apply theme
const applyTheme = () => {
  if (typeof window === 'undefined') return;

  const savedTheme = localStorage.getItem('theme');
  const root = document.documentElement;

  // Clear all theme classes first
  root.classList.remove('light-theme', 'dark-theme', 'crystal-dark-theme');

  if (savedTheme === 'dark') {
    root.setAttribute('data-theme', 'dark');
    root.classList.add('dark-theme');
  } else if (savedTheme === 'crystal-dark') {
    root.setAttribute('data-theme', 'crystal-dark');
    root.classList.add('crystal-dark-theme');
  } else if (savedTheme === 'light') {
    root.setAttribute('data-theme', 'light');
    root.classList.add('light-theme');
  } else {
    // Auto - check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark-theme');
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.add('light-theme');
    }
  }
};

// Apply theme on mount
applyTheme();

// Listen for theme changes
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
      applyTheme();
    }
  });

  // Also listen for IPC theme changes
  if (window.electronAPI?.onThemeChange) {
    const unsubscribe = window.electronAPI.onThemeChange((theme) => {
      // Guard: skip if unchanged
      if (localStorage.getItem('theme') === theme) return;
      // Update localStorage with the new theme
      localStorage.setItem('theme', theme);
      applyTheme();
    });
    // Note: unsubscribe is returned but we're not cleaning it up since this is module-level
  }
}

interface WorkspaceInfo {
  path: string;
  name: string;
  lastOpened: number | string;
  lastModified?: number | string;
  fileCount?: number;
  markdownCount?: number;
  exists: boolean;
}

interface WorkspaceStats {
  fileCount: number;
  markdownCount: number;
  totalSize: number;
  recentFiles: string[];
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  workspace: WorkspaceInfo | null;
}

export const WorkspaceManager: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceInfo | null>(null);
  const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    workspace: null,
  });

  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{
    visible: boolean;
    workspace: WorkspaceInfo | null;
    newName: string;
    error: string | null;
    stats?: WorkspaceStats | null;
  }>({
    visible: false,
    workspace: null,
    newName: '',
    error: null,
  });

  // Confirmation dialog state (for move operations)
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    type: 'move' | 'rename';
    workspace: WorkspaceInfo | null;
    destinationPath?: string;
    newName?: string;
    stats?: WorkspaceStats | null;
  }>({
    visible: false,
    type: 'move',
    workspace: null,
  });

  // Operation state
  const [operationInProgress, setOperationInProgress] = useState(false);
  const [operationLabel, setOperationLabel] = useState('Moving project...');
  const [operationError, setOperationError] = useState<string | null>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextMenuFloating = useFloatingMenu({
    placement: 'right-start',
    offsetPx: 4,
    open: contextMenu.visible,
    onOpenChange: (open) => setContextMenu(prev => ({ ...prev, visible: open })),
  });

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      loadWorkspaceStats(selectedWorkspace.path);
    }
  }, [selectedWorkspace]);

  // Auto-select first item when search query changes or results update
  useEffect(() => {
    if (filteredWorkspaces.length > 0) {
      setHighlightedIndex(0);
      setSelectedWorkspace(filteredWorkspaces[0]);
    } else {
      setHighlightedIndex(-1);
      setSelectedWorkspace(null);
    }
  }, [searchQuery]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  // Focus rename input when dialog opens
  useEffect(() => {
    if (renameDialog.visible && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameDialog.visible]);

  // Score and filter workspaces based on search query
  // Higher score = better match, prioritizing name matches over path matches
  const scoreWorkspace = (workspace: WorkspaceInfo, query: string): number => {
    const name = workspace.name.toLowerCase();
    const path = workspace.path.toLowerCase();
    const q = query.toLowerCase();

    // Exact name match (highest priority)
    if (name === q) return 100;

    // Name starts with query (prefix match)
    if (name.startsWith(q)) return 80;

    // Name contains query at word boundary (e.g., "My-JSVault" matches "js")
    const wordBoundaryRegex = new RegExp(`(?:^|[\\s_-])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    if (wordBoundaryRegex.test(name)) return 60;

    // Name contains query anywhere
    if (name.includes(q)) return 40;

    // Path contains query
    if (path.includes(q)) return 20;

    // No match
    return 0;
  };

  const filteredWorkspaces = workspaces
    .map(workspace => ({
      workspace,
      score: searchQuery ? scoreWorkspace(workspace, searchQuery) : 1
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ workspace }) => workspace);

  const loadWorkspaces = async () => {
    try {
      const recentWorkspaces = await window.electronAPI.workspaceManager.getRecentWorkspaces();
      // console.log('Loaded workspaces:', recentWorkspaces);
      setWorkspaces(recentWorkspaces);
      // Don't auto-select first workspace - show welcome pane instead
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceStats = async (workspacePath: string) => {
    try {
      const stats = await window.electronAPI.workspaceManager.getWorkspaceStats(workspacePath);
      setWorkspaceStats(stats);
    } catch (error) {
      console.error('Failed to load workspace stats:', error);
    }
  };

  const handleOpenWorkspace = async () => {
    if (!selectedWorkspace) return;

    try {
      await window.electronAPI.workspaceManager.openWorkspace(selectedWorkspace.path);
    } catch (error) {
      console.error('Failed to open workspace:', error);
    }
  };

  const handleBrowse = async () => {
    try {
      const result = await window.electronAPI.workspaceManager.openFolderDialog();
      if (result.success) {
        await window.electronAPI.workspaceManager.openWorkspace(result.path);
      }
    } catch (error) {
      console.error('Failed to browse for workspace:', error);
    }
  };

  const handleCreateWorkspace = async () => {
    try {
      const result = await window.electronAPI.workspaceManager.createWorkspaceDialog();
      if (result.success) {
        await window.electronAPI.workspaceManager.openWorkspace(result.path);
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
    }
  };

  const handleRemoveFromRecent = async (workspace?: WorkspaceInfo) => {
    const target = workspace || selectedWorkspace;
    if (!target) return;

    try {
      await window.electronAPI.workspaceManager.removeRecent(target.path);
      await loadWorkspaces();
      if (selectedWorkspace?.path === target.path) {
        setSelectedWorkspace(null);
      }
    } catch (error) {
      console.error('Failed to remove from recent:', error);
    }
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, workspace: WorkspaceInfo) => {
    e.preventDefault();
    e.stopPropagation();
    contextMenuFloating.refs.setPositionReference(virtualElement(e.clientX, e.clientY));
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      workspace,
    });
  };

  const openRenameDialog = async (workspace: WorkspaceInfo) => {
    const canMoveResult = await window.electronAPI.projectMigration.canMove(workspace.path);
    if (!canMoveResult.canMove) {
      setOperationError(canMoveResult.reason || 'Cannot rename project');
      return;
    }

    let renameStats: WorkspaceStats | null = null;
    try {
      renameStats = await window.electronAPI.workspaceManager.getWorkspaceStats(workspace.path);
    } catch (e) {
      // Stats are optional, continue without them
    }

    setRenameDialog({
      visible: true,
      workspace,
      newName: workspace.name,
      error: null,
      stats: renameStats,
    });
  };

  const handleContextMenuAction = async (action: 'open' | 'rename' | 'move' | 'remove') => {
    const workspace = contextMenu.workspace;
    setContextMenu(prev => ({ ...prev, visible: false }));

    if (!workspace) return;

    switch (action) {
      case 'open':
        await window.electronAPI.workspaceManager.openWorkspace(workspace.path);
        break;

      case 'rename':
        await openRenameDialog(workspace);
        break;

      case 'move':
        await handleMoveProject(workspace);
        break;

      case 'remove':
        await handleRemoveFromRecent(workspace);
        break;
    }
  };

  const handleMoveProject = async (workspace: WorkspaceInfo) => {
    // Check if can move first
    const canMoveResult = await window.electronAPI.projectMigration.canMove(workspace.path);
    if (!canMoveResult.canMove) {
      setOperationError(canMoveResult.reason || 'Cannot move project');
      return;
    }

    // Open directory picker
    const result = await window.electronAPI.workspaceManager.openFolderDialog();
    if (!result.success || !result.path) return;

    // Construct the new path (destination + current project name)
    const projectName = workspace.name;
    const newPath = `${result.path}/${projectName}`;

    // Get workspace stats for the confirmation dialog
    let stats: WorkspaceStats | null = null;
    try {
      stats = await window.electronAPI.workspaceManager.getWorkspaceStats(workspace.path);
    } catch (e) {
      // Stats are optional, continue without them
    }

    // Show confirmation dialog
    setConfirmDialog({
      visible: true,
      type: 'move',
      workspace,
      destinationPath: newPath,
      stats,
    });
  };

  const executeMoveProject = async () => {
    if (!confirmDialog.workspace || !confirmDialog.destinationPath) return;

    const workspace = confirmDialog.workspace;
    const newPath = confirmDialog.destinationPath;

    setConfirmDialog(prev => ({ ...prev, visible: false }));
    setOperationLabel('Moving project...');
    setOperationInProgress(true);
    setOperationError(null);

    try {
      const moveResult = await window.electronAPI.projectMigration.move(workspace.path, newPath);
      if (moveResult.success) {
        await loadWorkspaces();
        // Update selected workspace if it was the one that moved
        if (selectedWorkspace?.path === workspace.path && moveResult.newPath) {
          const updatedWorkspaces = await window.electronAPI.workspaceManager.getRecentWorkspaces();
          const movedWorkspace = updatedWorkspaces.find((w: WorkspaceInfo) => w.path === moveResult.newPath);
          if (movedWorkspace) {
            setSelectedWorkspace(movedWorkspace);
          }
        }
      } else {
        setOperationError(moveResult.error || 'Failed to move project');
      }
    } catch (error: any) {
      setOperationError(error.message || 'Failed to move project');
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleRenameSubmit = async () => {
    if (!renameDialog.workspace || !renameDialog.newName.trim()) return;

    const newName = renameDialog.newName.trim();

    // Validate name
    if (newName === renameDialog.workspace.name) {
      setRenameDialog(prev => ({ ...prev, visible: false }));
      return;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(newName)) {
      setRenameDialog(prev => ({
        ...prev,
        error: 'Name contains invalid characters',
      }));
      return;
    }

    setOperationLabel('Renaming project...');
    setOperationInProgress(true);
    setRenameDialog(prev => ({ ...prev, error: null }));

    try {
      const result = await window.electronAPI.projectMigration.rename(
        renameDialog.workspace.path,
        newName
      );

      if (result.success) {
        setRenameDialog({ visible: false, workspace: null, newName: '', error: null, stats: null });
        await loadWorkspaces();
        // Update selected workspace if it was the one that was renamed
        if (selectedWorkspace?.path === renameDialog.workspace.path && result.newPath) {
          const updatedWorkspaces = await window.electronAPI.workspaceManager.getRecentWorkspaces();
          const renamedWorkspace = updatedWorkspaces.find((w: WorkspaceInfo) => w.path === result.newPath);
          if (renamedWorkspace) {
            setSelectedWorkspace(renamedWorkspace);
          }
        }
      } else {
        setRenameDialog(prev => ({
          ...prev,
          error: result.error || 'Failed to rename project',
        }));
      }
    } catch (error: any) {
      setRenameDialog(prev => ({
        ...prev,
        error: error.message || 'Failed to rename project',
      }));
    } finally {
      setOperationInProgress(false);
    }
  };

  const formatDate = (timestamp: number | string | undefined) => {
    if (!timestamp) {
      return 'Unknown';
    }

    // Convert string to number if needed
    let ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;

    // If timestamp is in seconds (Unix timestamp), convert to milliseconds
    // Unix timestamps are typically 10 digits, JS timestamps are 13
    if (ts && ts < 10000000000) {
      ts = ts * 1000;
    }

    if (!ts || isNaN(ts) || ts === 0) {
      return 'Unknown';
    }

    const date = new Date(ts);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Never';
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return date.toLocaleDateString();
    } else if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatSize = (bytes: number) => {
    // Validate bytes
    if (!bytes || isNaN(bytes) || bytes < 0) {
      return '0 B';
    }

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredWorkspaces.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => {
          const next = prev < filteredWorkspaces.length - 1 ? prev + 1 : prev;
          if (next !== -1) {
            setSelectedWorkspace(filteredWorkspaces[next]);
          }
          return next;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => {
          const next = prev > 0 ? prev - 1 : 0;
          setSelectedWorkspace(filteredWorkspaces[next]);
          return next;
        });
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredWorkspaces.length) {
          const workspace = filteredWorkspaces[highlightedIndex];
          window.electronAPI.workspaceManager.openWorkspace(workspace.path);
        } else if (selectedWorkspace) {
          handleOpenWorkspace();
        }
        break;

      case 'Escape':
        e.preventDefault();
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div
      className="workspace-manager agent-elements-workspace-manager flex h-screen w-full overflow-hidden bg-[var(--an-background)] pt-[38px] text-[var(--an-foreground)] [container-type:inline-size] before:fixed before:left-0 before:right-0 before:top-0 before:z-[1000] before:h-[38px] before:[-webkit-app-region:drag] before:content-['']"
      data-testid="agent-elements-workspace-manager"
      data-component="WorkspaceManager"
      data-agent-elements-shell="workspace-manager"
    >
      <div
        className="sidebar agent-elements-workspace-manager-sidebar flex w-[360px] shrink-0 flex-col border-r border-[var(--an-border-color)] bg-[var(--an-background-secondary)]"
        data-testid="agent-elements-workspace-manager-sidebar"
        data-agent-elements-shell="workspace-manager-sidebar"
      >
        <div
          className="sidebar-header agent-elements-workspace-manager-header border-b border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-xl)] [-webkit-app-region:no-drag]"
          data-testid="agent-elements-workspace-manager-header"
          data-agent-elements-shell="workspace-manager-header"
        >
          <div className="app-branding flex items-center gap-3">
            <img src="./icon.png" alt="Smarty Code" className="app-logo h-8 w-8 shrink-0 object-contain" />
            <div className="min-w-0">
              <h2 className="m-0 text-base font-medium leading-snug text-[var(--an-foreground)]">Smarty Code</h2>
              <p className="m-0 text-xs leading-relaxed text-[var(--an-foreground-muted)]">Workspace picker</p>
            </div>
          </div>
          <div className="action-buttons mt-[var(--an-spacing-lg)] flex gap-[var(--an-spacing-sm)]">
            <button className={workspacePrimaryButtonClass} onClick={handleBrowse}>
              <WorkspaceIcon icon="folder_open" size={16} />
              Open Folder
            </button>
            <button className={workspaceSecondaryButtonClass} onClick={handleCreateWorkspace}>
              <WorkspaceIcon icon="create_new_folder" size={16} />
              New Folder
            </button>
          </div>
        </div>

        <div
          className="workspaces-list agent-elements-workspace-manager-list nim-scrollbar flex flex-1 flex-col overflow-y-auto overflow-x-hidden p-[var(--an-spacing-sm)] [-webkit-app-region:no-drag]"
          data-testid="agent-elements-workspace-manager-list"
          data-agent-elements-shell="workspace-manager-list"
        >
          {!loading && workspaces.length > 0 && (
            <div className="search-container shrink-0 pb-[var(--an-spacing-sm)]">
              <input
                type="text"
                className="workspace-search agent-elements-workspace-manager-search h-9 w-full rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-3 text-sm text-[var(--an-input-color)] outline-none transition-colors duration-150 placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-outline)]"
                data-testid="agent-elements-workspace-manager-search"
                data-agent-elements-shell="workspace-manager-search"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
          )}

          {loading ? (
            <div
              className="loading agent-elements-workspace-manager-loading flex flex-1 items-center justify-center p-8 text-center"
              data-testid="agent-elements-workspace-manager-loading"
              data-agent-elements-shell="workspace-manager-loading"
            >
              <div className="spinner h-5 w-5 rounded-[999px] border-2 border-[var(--an-border-color)] border-t-[var(--an-primary-color)] animate-spin" />
            </div>
          ) : workspaces.length === 0 ? (
            <div
              className="sidebar-empty agent-elements-workspace-manager-empty flex h-full flex-col items-center justify-center p-5 text-center"
              data-testid="agent-elements-workspace-manager-empty"
              data-agent-elements-shell="workspace-manager-empty"
            >
              <p className="m-0 text-sm text-[var(--an-foreground-subtle)]">No recent projects</p>
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div
              className="sidebar-empty agent-elements-workspace-manager-empty flex h-full flex-col items-center justify-center p-5 text-center"
              data-testid="agent-elements-workspace-manager-empty"
              data-agent-elements-shell="workspace-manager-empty"
            >
              <p className="m-0 text-sm text-[var(--an-foreground-subtle)]">No matching projects</p>
            </div>
          ) : (
            filteredWorkspaces.map((workspace, index) => {
              const isSelected = selectedWorkspace?.path === workspace.path;
              const isHighlighted = highlightedIndex === index;

              return (
                <div
                  key={workspace.path}
                  className={`workspace-item agent-elements-workspace-manager-item mb-1 flex cursor-pointer items-center gap-2 rounded-[var(--an-input-border-radius)] border px-2 py-2 transition-colors duration-150 ${
                    isSelected
                      ? 'selected border-[color-mix(in_srgb,var(--an-primary-color)_30%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_11%,var(--an-background))]'
                      : isHighlighted
                        ? 'highlighted border-[var(--an-border-color)] bg-[var(--an-background-tertiary)]'
                        : 'border-transparent bg-transparent hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)]'
                  }`}
                  data-testid={`agent-elements-workspace-manager-item-${index}`}
                  data-agent-elements-shell="workspace-manager-item"
                  data-selected={isSelected ? 'true' : 'false'}
                  data-highlighted={isHighlighted ? 'true' : 'false'}
                  onClick={(e) => {
                    // Command/Ctrl + click to deselect
                    if (e.metaKey || e.ctrlKey) {
                      if (selectedWorkspace?.path === workspace.path) {
                        setSelectedWorkspace(null);
                      }
                    } else {
                      setSelectedWorkspace(workspace);
                    }
                    setHighlightedIndex(index);
                  }}
                  onDoubleClick={handleOpenWorkspace}
                  onContextMenu={(e) => handleContextMenu(e, workspace)}
                >
                  <div
                    className={`workspace-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--an-message-radius-inner)] border ${
                      isSelected
                        ? 'border-[color-mix(in_srgb,var(--an-primary-color)_35%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_12%,var(--an-background))] text-[var(--an-primary-color)]'
                        : 'border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)]'
                    }`}
                  >
                    <WorkspaceIcon icon="folder" size={18} />
                  </div>
                  <div className="workspace-info min-w-0 flex-1">
                    <div
                      className={`workspace-name mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium ${
                        isSelected ? 'text-[var(--an-primary-color)]' : 'text-[var(--an-foreground)]'
                      }`}
                    >
                      {workspace.name}
                    </div>
                    <div className="workspace-path mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[var(--an-foreground-muted)]">
                      {workspace.path}
                    </div>
                    <div className="workspace-meta flex gap-3 text-xs text-[var(--an-foreground-subtle)]">
                      {workspace.markdownCount !== undefined && (
                        <span className="whitespace-nowrap">{workspace.markdownCount} markdown files</span>
                      )}
                      <span className="whitespace-nowrap">{formatDate(workspace.lastOpened)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div
        className="content agent-elements-workspace-manager-content flex flex-1 flex-col overflow-hidden bg-[var(--an-background)]"
        data-agent-elements-shell="workspace-manager-content"
      >
        {selectedWorkspace ? (
          <>
            <div
              className="content-header agent-elements-workspace-manager-details-header flex items-start justify-between gap-5 border-b border-[var(--an-border-color)] bg-[var(--an-background)] px-6 py-5"
              data-agent-elements-shell="workspace-manager-details-header"
            >
              <div className="workspace-title">
                <h1 className="m-0 mb-1 text-xl font-medium leading-snug text-[var(--an-foreground)]">{selectedWorkspace.name}</h1>
                <div className="workspace-path select-text text-sm text-[var(--an-foreground-muted)]">{selectedWorkspace.path}</div>
              </div>
              <div className="content-actions flex flex-col items-end gap-2 shrink-0">
                <div className="content-actions-primary flex flex-wrap justify-end gap-2">
                  <button className={workspacePrimaryButtonClass} onClick={handleOpenWorkspace}>
                    <WorkspaceIcon icon="folder_open" size={16} />
                    Open Project
                  </button>
                  <button className={workspaceDangerButtonClass} onClick={() => handleRemoveFromRecent()}>
                    <WorkspaceIcon icon="close" size={16} />
                    Remove from Recent
                  </button>
                </div>
                <div className="content-actions-secondary flex flex-wrap justify-end gap-2">
                  <button
                    className={workspaceSecondaryButtonClass}
                    onClick={() => openRenameDialog(selectedWorkspace)}
                  >
                    <WorkspaceIcon icon="edit" size={16} />
                    Rename
                  </button>
                  <button
                    className={workspaceSecondaryButtonClass}
                    onClick={() => handleMoveProject(selectedWorkspace)}
                  >
                    <WorkspaceIcon icon="drive_file_move" size={16} />
                    Move
                  </button>
                </div>
              </div>
            </div>

            <div
              className="workspace-details agent-elements-workspace-manager-details nim-scrollbar flex-1 overflow-y-auto bg-[var(--an-background-secondary)] p-6"
              data-testid="agent-elements-workspace-manager-details"
              data-agent-elements-shell="workspace-manager-details"
            >
              {workspaceStats ? (
                <>
                  <div className="stats-grid grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
                    {[
                      ['Total Files', workspaceStats.fileCount],
                      ['Markdown Files', workspaceStats.markdownCount],
                      ['Total Size', formatSize(workspaceStats.totalSize)],
                      ['Last Opened', formatDate(selectedWorkspace.lastOpened)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="stat-card agent-elements-workspace-manager-stat agent-elements-tool-card rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-xl)]"
                        data-agent-elements-shell="workspace-manager-stat"
                      >
                        <div className="stat-value mb-1 text-2xl font-medium leading-tight text-[var(--an-foreground)]">{value}</div>
                        <div className="stat-label text-xs font-medium text-[var(--an-foreground-muted)]">{label}</div>
                      </div>
                    ))}
                  </div>

                  {workspaceStats.recentFiles.length > 0 && (
                    <div
                      className="recent-files agent-elements-workspace-manager-recent-files agent-elements-tool-card mt-4 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-xl)]"
                      data-agent-elements-shell="workspace-manager-recent-files"
                    >
                      <h3 className="m-0 mb-3 text-sm font-medium text-[var(--an-foreground)]">Recent Files</h3>
                      <ul className="list-none m-0 p-0">
                        {workspaceStats.recentFiles.map(file => (
                          <li key={file} className="flex items-center gap-2 border-b border-[var(--an-border-color)] py-1.5 text-sm text-[var(--an-foreground-muted)] last:border-b-0">
                            <WorkspaceIcon icon="description" size={16} className="text-[var(--an-foreground-subtle)]" />
                            <span className="select-text">{file}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="loading flex items-center justify-center p-8 text-center">
                  <div className="spinner h-5 w-5 rounded-[999px] border-2 border-[var(--an-border-color)] border-t-[var(--an-primary-color)] animate-spin"></div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            className="welcome-container workspace-manager-welcome agent-elements-workspace-manager-welcome flex h-full items-center justify-center bg-[var(--an-background)] p-10"
            data-testid="agent-elements-workspace-manager-welcome"
            data-agent-elements-shell="workspace-manager-welcome"
          >
            <div className="welcome-content flex w-full max-w-[560px] flex-col gap-[var(--an-spacing-xl)] text-left">
              <div className="welcome-header flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)]">
                  <img src="./icon.png" alt="Smarty Code" className="welcome-logo h-8 w-8 object-contain" />
                </div>
                <div className="welcome-text min-w-0">
                  <h1 className="welcome-title m-0 text-2xl font-medium leading-tight text-[var(--an-foreground)]">Smarty Code</h1>
                  <p className="welcome-subtitle m-0 mt-1 text-sm leading-relaxed text-[var(--an-foreground-muted)]">Agentic coding workspace</p>
                </div>
              </div>

              <div className="welcome-info-compact agent-elements-tool-card rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xl)]">
                <p className="welcome-description m-0 select-text text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                  Projects are local folders on your computer. Open any folder to view and edit all markdown files within it.
                  If you are working on a coding project, it is recommended to open the root folder of your project as
                  agents are configured at the project level.
                </p>
              </div>

              <div className="welcome-actions flex flex-wrap gap-[var(--an-spacing-sm)]">
                <button className={workspacePrimaryButtonClass} onClick={handleBrowse}>
                  <WorkspaceIcon icon="folder_open" size={16} />
                  Open Folder
                </button>
                <button className={workspaceSecondaryButtonClass} onClick={handleCreateWorkspace}>
                  <WorkspaceIcon icon="create_new_folder" size={16} />
                  New Folder
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.workspace && (
        <FloatingPortal>
          <div
            ref={contextMenuFloating.refs.setFloating}
            className="workspace-manager-context-menu agent-elements-workspace-manager-context-menu agent-elements-tool-card z-[2000] min-w-[176px] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-1 text-[var(--an-foreground)]"
            data-testid="agent-elements-workspace-manager-context-menu"
            data-agent-elements-shell="workspace-manager-context-menu"
            style={contextMenuFloating.floatingStyles}
            onClick={(e) => e.stopPropagation()}
            {...contextMenuFloating.getFloatingProps()}
          >
            <button
              type="button"
              role="menuitem"
              className={workspaceMenuItemClass}
              onClick={() => handleContextMenuAction('open')}
            >
              <WorkspaceIcon icon="folder_open" size={16} />
              Open Project
            </button>
            <div className="my-1 border-t border-[var(--an-border-color)]" />
            <button
              type="button"
              role="menuitem"
              className={workspaceMenuItemClass}
              onClick={() => handleContextMenuAction('rename')}
            >
              <WorkspaceIcon icon="edit" size={16} />
              Rename...
            </button>
            <button
              type="button"
              role="menuitem"
              className={workspaceMenuItemClass}
              onClick={() => handleContextMenuAction('move')}
            >
              <WorkspaceIcon icon="drive_file_move" size={16} />
              Move to...
            </button>
            <div className="my-1 border-t border-[var(--an-border-color)]" />
            <button
              type="button"
              role="menuitem"
              className={`${workspaceMenuItemClass} text-[var(--an-diff-removed-text)] hover:bg-[var(--an-diff-removed-bg)]`}
              onClick={() => handleContextMenuAction('remove')}
            >
              <WorkspaceIcon icon="close" size={16} />
              Remove from Recent
            </button>
          </div>
        </FloatingPortal>
      )}

      {/* Rename Dialog */}
      {renameDialog.visible && (
        <div className={workspaceOverlayClass}>
          <div className={`${workspaceDialogPanelClass} max-w-[450px]`}>
            <h2 className="m-0 mb-3 text-lg font-medium text-[var(--an-foreground)]">Rename Project</h2>

            {/* Warning banner */}
            <div className="mb-4 flex gap-2 rounded-[var(--an-input-border-radius)] border border-[color-mix(in_srgb,var(--nim-warning)_32%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-warning)_10%,var(--an-background))] p-3">
              <WorkspaceIcon icon="warning" size={18} className="mt-0.5 text-[var(--nim-warning)]" />
              <div className="text-xs text-[var(--an-foreground-muted)]">
                <p className="m-0 mb-1 font-medium text-[var(--an-foreground)]">This will rename the project folder on disk</p>
                <p className="m-0">All AI session history, file history, and settings will be migrated. This may take a while for large projects.</p>
                {renameDialog.stats && (
                  <p className="m-0 mt-1 text-[var(--an-foreground-subtle)]">
                    Project size: {renameDialog.stats.fileCount.toLocaleString()} files, {formatSize(renameDialog.stats.totalSize)}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm text-[var(--an-foreground-muted)]">New name</label>
              <input
                ref={renameInputRef}
                type="text"
                className="w-full rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-3 py-2 text-sm text-[var(--an-input-color)] outline-none transition-colors duration-150 focus:border-[var(--an-input-focus-outline)] disabled:opacity-50"
                value={renameDialog.newName}
                onChange={(e) => setRenameDialog(prev => ({ ...prev, newName: e.target.value, error: null }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !operationInProgress) {
                    handleRenameSubmit();
                  } else if (e.key === 'Escape') {
                    setRenameDialog({ visible: false, workspace: null, newName: '', error: null, stats: null });
                  }
                }}
                disabled={operationInProgress}
              />
              {renameDialog.error && (
                <p className="m-0 mt-1 text-xs text-[var(--an-diff-removed-text)]">{renameDialog.error}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                className={workspaceSecondaryButtonClass}
                onClick={() => setRenameDialog({ visible: false, workspace: null, newName: '', error: null })}
                disabled={operationInProgress}
              >
                Cancel
              </button>
              <button
                className={workspacePrimaryButtonClass}
                onClick={handleRenameSubmit}
                disabled={operationInProgress || !renameDialog.newName.trim()}
              >
                {operationInProgress ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Confirmation Dialog */}
      {confirmDialog.visible && confirmDialog.type === 'move' && (
        <div className={workspaceOverlayClass}>
          <div className={`${workspaceDialogPanelClass} max-w-[500px]`}>
            <h2 className="m-0 mb-3 text-lg font-medium text-[var(--an-foreground)]">Move Project</h2>

            {/* Warning banner */}
            <div className="mb-4 flex gap-2 rounded-[var(--an-input-border-radius)] border border-[color-mix(in_srgb,var(--nim-warning)_32%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-warning)_10%,var(--an-background))] p-3">
              <WorkspaceIcon icon="warning" size={18} className="mt-0.5 text-[var(--nim-warning)]" />
              <div className="text-xs text-[var(--an-foreground-muted)]">
                <p className="m-0 mb-1 font-medium text-[var(--an-foreground)]">This will move the entire project folder</p>
                <p className="m-0">All project files will be copied to the new location, and all AI session history, file history, and settings will be migrated. This may take a while for large projects.</p>
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <div>
                <label className="mb-0.5 block text-xs text-[var(--an-foreground-muted)]">From</label>
                <div className="overflow-hidden text-ellipsis rounded-[var(--an-message-radius-inner)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-3 py-2 font-mono text-sm text-[var(--an-foreground)]">{confirmDialog.workspace?.path}</div>
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-[var(--an-foreground-muted)]">To</label>
                <div className="overflow-hidden text-ellipsis rounded-[var(--an-message-radius-inner)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-3 py-2 font-mono text-sm text-[var(--an-foreground)]">{confirmDialog.destinationPath}</div>
              </div>
              {confirmDialog.stats && (
                <div className="flex gap-4 pt-2 text-xs text-[var(--an-foreground-muted)]">
                  <span>{confirmDialog.stats.fileCount.toLocaleString()} files</span>
                  <span>{formatSize(confirmDialog.stats.totalSize)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                className={workspaceSecondaryButtonClass}
                onClick={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
              >
                Cancel
              </button>
              <button
                className={workspacePrimaryButtonClass}
                onClick={executeMoveProject}
              >
                Move Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operation Error Toast */}
      {operationError && (
        <div className="workspace-manager-error-toast agent-elements-tool-card fixed bottom-4 right-4 z-[3000] flex max-w-[400px] items-center gap-3 rounded-[var(--an-tool-border-radius)] border border-[var(--an-diff-removed-border)] bg-[var(--an-diff-removed-bg)] px-4 py-3 text-[var(--an-diff-removed-text)]">
          <WorkspaceIcon icon="error" size={20} />
          <span className="flex-1 select-text text-sm">{operationError}</span>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--an-message-radius-inner)] border border-transparent bg-transparent text-[var(--an-diff-removed-text)] transition-colors duration-150 hover:border-[var(--an-diff-removed-border)]"
            onClick={() => setOperationError(null)}
            aria-label="Dismiss error"
          >
            <WorkspaceIcon icon="close" size={18} />
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {operationInProgress && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)]">
          <div className="agent-elements-tool-card flex items-center gap-3 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-6">
            <div className="spinner h-5 w-5 rounded-[999px] border-2 border-[var(--an-border-color)] border-t-[var(--an-primary-color)] animate-spin"></div>
            <span className="text-sm text-[var(--an-foreground)]">{operationLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
};
