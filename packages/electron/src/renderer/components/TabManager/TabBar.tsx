import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { Tab } from './TabManager';
import {
  useTabDirty,
  useTabHasCollabUnsyncedChanges,
  useTabHasUnacceptedChanges,
} from '../../hooks/useTabState';
import { CommonFileActions } from '../CommonFileActions';
import { historyDialogFileAtom } from '../../store';
import { KeyboardShortcuts, getShortcutDisplay } from '../../../shared/KeyboardShortcuts';
import { useFloatingMenu, FloatingPortal, virtualElement } from '../../hooks/useFloatingMenu';

// Separate component for dirty indicator - subscribes to its own tab's dirty state
// This allows only this component to re-render when dirty state changes
// Uses Jotai atoms for efficient per-tab subscriptions
// Memoized to prevent re-renders when parent re-renders but filePath hasn't changed
const TabDirtyIndicator = memo<{ filePath: string }>(({ filePath }) => {
  const isDirty = useTabDirty(filePath);
  const hasCollabUnsyncedChanges = useTabHasCollabUnsyncedChanges(filePath);
  const hasUnacceptedChanges = useTabHasUnacceptedChanges(filePath);

  if (hasUnacceptedChanges) {
    return <span className="tab-unaccepted-indicator font-bold ml-0.5 text-xl leading-none text-[var(--nim-primary)]" title="Has unaccepted AI changes">•</span>;
  }

  if (isDirty) {
    return <span className="tab-dirty-indicator font-bold ml-0.5 text-[var(--nim-warning)]" title="Unsaved changes">•</span>;
  }

  if (hasCollabUnsyncedChanges) {
    return <span className="tab-dirty-indicator font-bold ml-0.5 text-orange-500" title="Collaborative changes not yet synced">•</span>;
  }

  return null;
});

// Menu item dirty indicator - for the dropdown tab list
// Memoized to prevent re-renders when parent re-renders
const MenuItemDirtyIndicator = memo<{ filePath: string }>(({ filePath }) => {
  const isDirty = useTabDirty(filePath);
  const hasCollabUnsyncedChanges = useTabHasCollabUnsyncedChanges(filePath);
  const hasUnacceptedChanges = useTabHasUnacceptedChanges(filePath);

  if (hasUnacceptedChanges || isDirty || hasCollabUnsyncedChanges) {
    return <> •</>;
  }

  return null;
});

interface TabItemProps {
  tab: Tab;
  index: number;
  activeTabId: string | null;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  editingTabId: string | null;
  editingValue: string;
  editInputRef: React.RefObject<HTMLInputElement>;
  onTabClick: (e: React.MouseEvent, tabId: string) => void;
  onCloseClick: (e: React.MouseEvent, tabId: string) => void;
  onContextMenu: (e: React.MouseEvent, tabId: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onEditChange: (value: string) => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
  onRenameBlur: () => void;
  onTabRef: (tabId: string, el: HTMLDivElement | null) => void;
}

// Each tab is a separate component that subscribes to its own dirty state
// Uses Jotai atoms for efficient per-tab subscriptions
const TabItem: React.FC<TabItemProps> = ({
  tab,
  index,
  activeTabId,
  draggedIndex,
  dragOverIndex,
  editingTabId,
  editingValue,
  editInputRef,
  onTabClick,
  onCloseClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onEditChange,
  onRenameKeyDown,
  onRenameBlur,
  onTabRef,
}) => {
  const isDirty = useTabDirty(tab.filePath);
  const hasCollabUnsyncedChanges = useTabHasCollabUnsyncedChanges(tab.filePath);

  return (
    <div
      ref={(el) => onTabRef(tab.id, el)}
      className={`tab agent-elements-tab group flex items-center h-[30px] px-3 mr-px cursor-pointer relative min-w-[120px] max-w-[200px] shrink-0 rounded-t-md border border-[var(--nim-border)] bg-[var(--nim-bg-secondary)] transition-[background-color,border-color,box-shadow,opacity] duration-150 hover:bg-[var(--nim-bg-tertiary)] ${tab.id === activeTabId ? 'active z-[1] border-b-0 bg-[var(--nim-bg)]' : ''} ${isDirty || hasCollabUnsyncedChanges ? 'dirty' : ''} ${tab.isPinned ? 'pinned min-w-[40px] max-w-[150px]' : ''} ${draggedIndex === index ? 'dragging opacity-50 cursor-grabbing' : ''} ${dragOverIndex === index ? 'drag-over ring-1 ring-[var(--nim-primary)]' : ''}`}
      data-agent-elements-shell="tab"
      data-tab-type={tab.isVirtual ? 'session' : 'document'}
      data-tab-id={tab.id}
      data-filename={tab.fileName}
      draggable={true}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if (e.button === 0) {
          onTabClick(e, tab.id);
        }
      }}
      onMouseDown={(e) => {
        if (e.button === 1) {
          onTabClick(e, tab.id);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, tab.id)}
      title={tab.filePath}
    >
      {/* Active tab indicator line */}
      {tab.id === activeTabId && (
        <span className="absolute top-0 left-px right-px h-0.5 rounded-sm bg-[var(--nim-primary)]" />
      )}
      {tab.isPinned && (
        <span className="tab-pin-icon agent-elements-tab-pin-icon mr-1 flex h-4 w-4 items-center justify-center text-[var(--nim-text-muted)]">
          <MaterialSymbol icon="push_pin" size={14} />
        </span>
      )}
      {tab.isProcessing && (
        <span className="tab-processing-indicator inline-flex items-center justify-center mr-1.5 text-[var(--nim-primary)] opacity-80" title="Processing...">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32 16" strokeLinecap="round">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 12 12"
                to="360 12 12"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        </span>
      )}
      {tab.hasUnread && !tab.isProcessing && (
        <span className="tab-unread-indicator inline-block w-2 h-2 rounded-full bg-[var(--nim-primary)] mr-1.5 shrink-0" title="Unread response"></span>
      )}
      {editingTabId === tab.id ? (
        <input
          ref={editInputRef}
          type="text"
          value={editingValue}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={onRenameKeyDown}
          onBlur={onRenameBlur}
          onClick={(e) => e.stopPropagation()}
          className="tab-rename-input flex-1 text-[13px] px-1 py-0.5 border border-[var(--nim-primary)] rounded-sm bg-[var(--nim-bg)] text-[var(--nim-text)] outline-none"
        />
      ) : (
        <>
          <span className={`tab-title flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[var(--nim-text-muted)] ${tab.id === activeTabId ? 'text-[var(--nim-text)] font-medium' : ''}`}>
            {tab.fileName}
          </span>
          <TabDirtyIndicator filePath={tab.filePath} />
        </>
      )}
      {!tab.isPinned && (
        <button
          className="tab-close-button agent-elements-tab-close-button flex items-center justify-center w-[18px] h-[18px] ml-2 border-none bg-transparent text-[var(--nim-text-faint)] cursor-pointer rounded p-0 opacity-0 transition-[background-color,color,opacity] duration-150 group-hover:opacity-100 hover:bg-[var(--nim-error-subtle)] hover:text-[var(--nim-error)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--nim-primary)] focus-visible:outline-offset-1"
          data-agent-elements-shell="tab-close-button"
          data-testid={`tab-close-button-${tab.id}`}
          data-filename={tab.fileName}
          onClick={(e) => onCloseClick(e, tab.id)}
          title="Close tab"
        >
          <MaterialSymbol icon="close" size={14} />
        </button>
      )}
    </div>
  );
};

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onTogglePin: (tabId: string) => void;
  onTabReorder: (fromIndex: number, toIndex: number) => void;
  onReopenLastClosed?: () => void;
  hasClosedTabs?: boolean;
  onTabRename?: (tabId: string, newName: string) => void;
  allowRename?: boolean;
  isActive?: boolean; // Whether this TabBar should handle keyboard shortcuts
  onToggleAIChat?: () => void; // Toggle AI Chat panel
  isAIChatCollapsed?: boolean; // Whether AI Chat is collapsed
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  onTogglePin,
  onTabReorder,
  onReopenLastClosed,
  hasClosedTabs = false,
  onTabRename,
  allowRename = false,
  isActive = true,
  onToggleAIChat,
  isAIChatCollapsed = false
}) => {
  const openHistoryDialog = useSetAtom(historyDialogFileAtom);
  const [contextMenuTab, setContextMenuTab] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showTabMenu, setShowTabMenu] = useState(false);
  const [menuSelectedIndex, setMenuSelectedIndex] = useState<number>(-1);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const isDraggingRef = useRef(false);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const editInputRef = useRef<HTMLInputElement>(null);
  const clickCountRef = useRef<Map<string, number>>(new Map());
  const clickTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const closeContextMenu = useCallback(() => {
    setContextMenuTab(null);
  }, []);

  const contextMenuReference = useMemo(
    () => contextMenuTab ? virtualElement(contextMenuPosition.x, contextMenuPosition.y) : null,
    [contextMenuPosition.x, contextMenuPosition.y, contextMenuTab]
  );

  const contextMenu = useFloatingMenu({
    placement: 'right-start',
    reference: contextMenuReference,
    open: Boolean(contextMenuTab),
    onOpenChange: (open) => {
      if (!open) closeContextMenu();
    },
  });

  const handleTabMenuOpenChange = useCallback((open: boolean) => {
    setShowTabMenu(open);
    if (!open) {
      setMenuSelectedIndex(-1);
    }
  }, []);

  const tabMenu = useFloatingMenu({
    placement: 'bottom-end',
    open: showTabMenu,
    onOpenChange: handleTabMenuOpenChange,
  });

  // Handle tab click (including double-click for rename)
  const handleTabClick = useCallback((e: React.MouseEvent, tabId: string) => {
    // Don't handle clicks if we're dragging or editing
    if (isDraggingRef.current || editingTabId) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Middle click to close
    if (e.button === 1) {
      onTabClose(tabId);
      return;
    }

    // Left click handling
    if (e.button === 0) {
      // Only handle double-click for rename if allowRename is true and onTabRename exists
      if (allowRename && onTabRename) {
        const clickCount = (clickCountRef.current.get(tabId) || 0) + 1;
        clickCountRef.current.set(tabId, clickCount);

        // Clear existing timer
        const existingTimer = clickTimerRef.current.get(tabId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Set new timer to reset click count
        const timer = setTimeout(() => {
          clickCountRef.current.set(tabId, 0);
        }, 300); // 300ms double-click window
        clickTimerRef.current.set(tabId, timer);

        // Double-click detected - enter edit mode
        if (clickCount === 2) {
          const tab = tabs.find(t => t.id === tabId);
          if (tab) {
            setEditingTabId(tabId);
            setEditingValue(tab.fileName);
            // Focus input on next tick
            setTimeout(() => {
              editInputRef.current?.focus();
              editInputRef.current?.select();
            }, 0);
          }
          clickCountRef.current.set(tabId, 0);
          return;
        }
      }

      // Single click to select - only if not already active
      if (tabId !== activeTabId) {
        onTabSelect(tabId);
      }
    }
  }, [onTabSelect, onTabClose, activeTabId, editingTabId, allowRename, onTabRename, tabs]);

  // Handle close button click
  const handleCloseClick = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    onTabClose(tabId);
  }, [onTabClose]);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenuTab(tabId);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Handle context menu actions
  const handleCloseOthers = useCallback(() => {
    tabs.forEach(tab => {
      if (tab.id !== contextMenuTab && !tab.isPinned) {
        onTabClose(tab.id);
      }
    });
    closeContextMenu();
  }, [tabs, contextMenuTab, onTabClose, closeContextMenu]);

  const handleCloseToRight = useCallback(() => {
    const currentIndex = tabs.findIndex(tab => tab.id === contextMenuTab);
    if (currentIndex >= 0) {
      tabs.slice(currentIndex + 1).forEach(tab => {
        if (!tab.isPinned) {
          onTabClose(tab.id);
        }
      });
    }
    closeContextMenu();
  }, [tabs, contextMenuTab, onTabClose, closeContextMenu]);

  const handleCloseAll = useCallback(() => {
    tabs.forEach(tab => {
      if (!tab.isPinned) {
        onTabClose(tab.id);
      }
    });
    closeContextMenu();
  }, [tabs, onTabClose, closeContextMenu]);

  const handleTogglePin = useCallback(() => {
    if (contextMenuTab) {
      onTogglePin(contextMenuTab);
    }
    closeContextMenu();
  }, [contextMenuTab, onTogglePin, closeContextMenu]);

  const handleViewHistory = useCallback(() => {
    if (contextMenuTab) {
      const tab = tabs.find(t => t.id === contextMenuTab);
      if (tab?.filePath) {
        openHistoryDialog(tab.filePath);
      }
    }
    closeContextMenu();
  }, [contextMenuTab, tabs, openHistoryDialog, closeContextMenu]);

  // Get the file info for the context menu tab (used by CommonFileActions)
  const contextMenuTabData = contextMenuTab ? tabs.find(t => t.id === contextMenuTab) : null;

  const tabMenuShellClasses =
    'tab-menu-dropdown agent-elements-tab-menu agent-elements-tool-card min-w-[220px] max-w-[320px] overflow-y-auto rounded-[10px] border border-nim bg-nim-secondary p-1 text-[13px] shadow-[0_12px_32px_color-mix(in_srgb,var(--nim-text)_10%,transparent)] z-[10000]';
  const tabMenuItemClasses =
    'tab-menu-item agent-elements-tab-menu-item flex w-full items-center gap-2.5 rounded-[8px] border-0 bg-transparent px-3 py-2 text-left text-[13px] leading-5 text-nim transition-[background-color,color] duration-150 cursor-pointer select-none hover:bg-nim-hover focus-visible:outline-2 focus-visible:outline-[var(--nim-primary)] focus-visible:outline-offset-2';
  const tabMenuSelectedClasses =
    'bg-nim-hover shadow-[inset_0_0_0_1px_var(--nim-primary)]';
  const tabMenuActiveClasses = 'active bg-nim-selected text-nim';
  const tabMenuSeparatorClasses =
    'tab-menu-separator agent-elements-tab-menu-separator mx-2 my-1 h-px bg-[var(--nim-border)]';

  const contextMenuShellClasses =
    'tab-context-menu agent-elements-tab-context-menu agent-elements-tool-card min-w-[190px] max-h-[calc(100vh-20px)] overflow-y-auto rounded-[10px] border border-nim bg-nim-secondary p-1 text-[13px] shadow-[0_12px_32px_color-mix(in_srgb,var(--nim-text)_10%,transparent)] z-[10000]';
  const contextMenuItemClasses =
    'context-menu-item agent-elements-tab-context-menu-item flex w-full items-center gap-2.5 rounded-[8px] border-0 bg-transparent px-3 py-2 text-left text-[13px] leading-5 text-nim transition-[background-color,color] duration-150 cursor-pointer select-none hover:bg-nim-hover focus-visible:outline-2 focus-visible:outline-[var(--nim-primary)] focus-visible:outline-offset-2';
  const contextMenuSeparatorClasses =
    'context-menu-separator agent-elements-tab-context-menu-separator mx-2 my-1 h-px bg-[var(--nim-border)]';

  const renderContextMenuSeparator = (id: string) => (
    <div
      className={contextMenuSeparatorClasses}
      data-testid={`agent-elements-tab-context-menu-separator-${id}`}
      data-agent-elements-shell="tab-context-menu-separator"
    />
  );

  const renderContextMenuItem = ({
    id,
    icon,
    label,
    onClick,
  }: {
    id: string;
    icon: string;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      className={contextMenuItemClasses}
      onClick={onClick}
      role="menuitem"
      data-testid={`agent-elements-tab-context-menu-${id}`}
      data-agent-elements-shell="tab-context-menu-item"
      data-tab-context-action={id}
    >
      <span className="agent-elements-tab-context-menu-icon flex h-5 w-5 shrink-0 items-center justify-center text-nim-muted">
        <MaterialSymbol icon={icon} size={18} />
      </span>
      <span className="agent-elements-tab-context-menu-label min-w-0 truncate">{label}</span>
    </button>
  );

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    isDraggingRef.current = true;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onTabReorder(draggedIndex, dropIndex);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);

    // Reset drag flag after a short delay to prevent click from firing
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  }, [draggedIndex, onTabReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Reset drag flag after a short delay to prevent click from firing
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  }, []);

  // Toggle tab menu
  const toggleTabMenu = useCallback(() => {
    handleTabMenuOpenChange(!showTabMenu);
  }, [handleTabMenuOpenChange, showTabMenu]);

  // Handle tab menu item click
  const handleTabMenuSelect = useCallback((tabId: string) => {
    onTabSelect(tabId);
    handleTabMenuOpenChange(false);
  }, [onTabSelect, handleTabMenuOpenChange]);

  // Close all tabs from menu
  const handleCloseAllFromMenu = useCallback(() => {
    tabs.forEach(tab => {
      if (!tab.isPinned) {
        onTabClose(tab.id);
      }
    });
    handleTabMenuOpenChange(false);
  }, [tabs, onTabClose, handleTabMenuOpenChange]);

  // Handle rename completion
  const completeRename = useCallback((save: boolean) => {
    if (editingTabId && save && onTabRename && editingValue.trim()) {
      onTabRename(editingTabId, editingValue.trim());
    }
    setEditingTabId(null);
    setEditingValue('');
  }, [editingTabId, editingValue, onTabRename]);

  // Handle rename input key down
  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      completeRename(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      completeRename(false);
    }
  }, [completeRename]);

  // Handle rename input blur
  const handleRenameBlur = useCallback(() => {
    completeRename(true);
  }, [completeRename]);

  // Keyboard navigation for dropdown menu
  React.useEffect(() => {
    if (!showTabMenu) return;

    const handleMenuKeyDown = (e: KeyboardEvent) => {
      const totalItems = tabs.length + 1; // 1 for "Close All"
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setMenuSelectedIndex(prev => {
            const next = prev + 1;
            return next >= totalItems ? 0 : next;
          });
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setMenuSelectedIndex(prev => {
            const next = prev - 1;
            return next < 0 ? totalItems - 1 : next;
          });
          break;
          
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (menuSelectedIndex === 0) {
            handleCloseAllFromMenu();
          } else if (menuSelectedIndex >= 1 && menuSelectedIndex < totalItems) {
            const tabIndex = menuSelectedIndex - 1;
            handleTabMenuSelect(tabs[tabIndex].id);
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          handleTabMenuOpenChange(false);
          break;
          
        default:
          // Number keys 1-9 for quick tab selection
          if (e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            const index = parseInt(e.key) - 1;
            if (index < tabs.length) {
              handleTabMenuSelect(tabs[index].id);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleMenuKeyDown);
    return () => window.removeEventListener('keydown', handleMenuKeyDown);
  }, [showTabMenu, menuSelectedIndex, tabs, handleCloseAllFromMenu, handleTabMenuSelect, handleTabMenuOpenChange]);

  // Auto-scroll active tab into view
  React.useEffect(() => {
    if (!activeTabId) return;

    const activeTabElement = tabRefs.current.get(activeTabId);
    if (activeTabElement && tabBarRef.current) {
      activeTabElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [activeTabId]);

  // Keyboard shortcuts
  React.useEffect(() => {
    // Only handle keyboard shortcuts if this TabBar is active
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if menu is open
      if (showTabMenu) return;

      // Cmd/Ctrl + Shift + [ or ] to navigate tabs
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);

        if (e.key === '[' && currentIndex > 0) {
          e.preventDefault();
          onTabSelect(tabs[currentIndex - 1].id);
        } else if (e.key === ']' && currentIndex < tabs.length - 1) {
          e.preventDefault();
          onTabSelect(tabs[currentIndex + 1].id);
        }
      }

      // Cmd/Ctrl + 1-9 to jump to tab
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < tabs.length) {
          onTabSelect(tabs[index].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, onTabSelect, onTabClose, onNewTab, showTabMenu, isActive]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <>
      <div className="tab-bar-container flex items-center h-9 select-none bg-[var(--nim-bg-secondary)]">
        <div className="tab-bar-scrollable nim-scrollbar-thin flex-1 flex items-center h-full px-2 overflow-x-auto overflow-y-hidden" ref={tabBarRef}>
          {tabs.map((tab, index) => (
            <TabItem
              key={tab.id}
              tab={tab}
              index={index}
              activeTabId={activeTabId}
              draggedIndex={draggedIndex}
              dragOverIndex={dragOverIndex}
              editingTabId={editingTabId}
              editingValue={editingValue}
              editInputRef={editInputRef}
              onTabClick={handleTabClick}
              onCloseClick={handleCloseClick}
              onContextMenu={handleContextMenu}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onEditChange={setEditingValue}
              onRenameKeyDown={handleRenameKeyDown}
              onRenameBlur={handleRenameBlur}
              onTabRef={(tabId, el) => {
                if (el) {
                  tabRefs.current.set(tabId, el);
                } else {
                  tabRefs.current.delete(tabId);
                }
              }}
            />
          ))}
        </div>
        
        <div className="tab-bar-actions flex items-center px-2 gap-1 shrink-0">
          <div className="tab-menu-container relative">
            <button
              ref={tabMenu.refs.setReference}
              className={`tab-menu-button agent-elements-tab-menu-button flex items-center justify-center w-7 h-7 border border-[var(--nim-border)] bg-[var(--nim-bg-secondary)] text-[var(--nim-text-muted)] cursor-pointer rounded-[6px] p-0 transition-[background-color,color,border-color] duration-150 hover:bg-[var(--nim-bg-tertiary)] hover:text-[var(--nim-text)] focus-visible:outline-2 focus-visible:outline-[var(--nim-primary)] focus-visible:outline-offset-1 ${showTabMenu ? 'active bg-[var(--nim-bg-tertiary)] text-[var(--nim-text)]' : ''}`}
              onClick={toggleTabMenu}
              title="Tab menu"
              type="button"
              data-agent-elements-shell="tab-menu-button"
              {...tabMenu.getReferenceProps()}
            >
              <MaterialSymbol icon="keyboard_arrow_down" size={18} />
            </button>

            {showTabMenu && (
              <FloatingPortal>
                <div
                  ref={tabMenu.refs.setFloating}
                  style={tabMenu.floatingStyles}
                  className={tabMenuShellClasses}
                  role="menu"
                  aria-label="Tab menu"
                  data-component="TabBarOverflowMenu"
                  data-testid="agent-elements-tab-menu"
                  data-agent-elements-shell="tab-menu"
                  {...tabMenu.getFloatingProps()}
                >
                  <div className="tab-menu-section agent-elements-tab-menu-section py-0.5">
                    <button
                      type="button"
                      className={`tab-menu-action ${tabMenuItemClasses} font-medium ${menuSelectedIndex === 0 ? `selected ${tabMenuSelectedClasses}` : ''}`}
                      onClick={handleCloseAllFromMenu}
                      role="menuitem"
                      data-testid="agent-elements-tab-menu-close-all"
                      data-agent-elements-shell="tab-menu-item"
                      data-tab-menu-action="close-all"
                    >
                      <span className="agent-elements-tab-menu-icon flex h-5 w-5 shrink-0 items-center justify-center text-nim-muted">
                        <MaterialSymbol icon="cancel" size={18} />
                      </span>
                      <span className="agent-elements-tab-menu-title min-w-0 flex-1 truncate">Close All Tabs</span>
                    </button>
                  </div>
                  {tabs.length > 0 && (
                    <>
                      <div
                        className={tabMenuSeparatorClasses}
                        data-testid="agent-elements-tab-menu-separator"
                        data-agent-elements-shell="tab-menu-separator"
                      />
                      <div className="tab-menu-section tab-menu-list agent-elements-tab-menu-list max-h-[300px] overflow-y-auto py-0.5">
                        {tabs.map((tab, index) => (
                          <button
                            key={tab.id}
                            type="button"
                            className={`${tabMenuItemClasses} ${tab.id === activeTabId ? tabMenuActiveClasses : ''} ${menuSelectedIndex === index + 1 ? `selected ${tabMenuSelectedClasses}` : ''}`}
                            onClick={() => handleTabMenuSelect(tab.id)}
                            role="menuitem"
                            data-testid={`agent-elements-tab-menu-item-${tab.id}`}
                            data-agent-elements-shell="tab-menu-item"
                            data-tab-id={tab.id}
                          >
                            <span className="tab-menu-index agent-elements-tab-menu-index flex h-5 min-w-5 items-center justify-center rounded-[6px] text-[11px] text-nim-faint">{index + 1}</span>
                            <span className="tab-menu-title agent-elements-tab-menu-title min-w-0 flex-1 truncate">
                              {tab.isPinned && (
                                <span className="agent-elements-tab-menu-pin mr-1 inline-flex align-[-2px] text-nim-muted">
                                  <MaterialSymbol icon="push_pin" size={13} />
                                </span>
                              )}
                              {tab.fileName}
                              <MenuItemDirtyIndicator filePath={tab.filePath} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </FloatingPortal>
            )}
          </div>
          {onToggleAIChat && (
            <button
              className="ai-chat-toggle-button agent-elements-tab-ai-toggle flex items-center justify-center w-7 h-7 border border-[var(--nim-border)] bg-[var(--nim-bg-secondary)] text-[var(--nim-primary)] cursor-pointer rounded-[6px] p-0 transition-[background-color,color,border-color] duration-150 hover:bg-[var(--nim-bg-tertiary)] focus-visible:outline-2 focus-visible:outline-[var(--nim-primary)] focus-visible:outline-offset-1"
              data-testid="ai-sidebar-toggle"
              data-agent-elements-shell="tab-ai-toggle"
              onClick={onToggleAIChat}
              title={`${isAIChatCollapsed ? 'Open' : 'Close'} AI Assistant (${getShortcutDisplay(KeyboardShortcuts.view.toggleAIChat)})`}
              aria-label={isAIChatCollapsed ? "Open AI Assistant" : "Close AI Assistant"}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2L11.5 7.5L17 9L11.5 10.5L10 16L8.5 10.5L3 9L8.5 7.5L10 2Z" fill="currentColor"/>
                <path d="M4 3L4.5 4.5L6 5L4.5 5.5L4 7L3.5 5.5L2 5L3.5 4.5L4 3Z" fill="currentColor" opacity="0.6"/>
                <path d="M16 13L16.5 14.5L18 15L16.5 15.5L16 17L15.5 15.5L14 15L15.5 14.5L16 13Z" fill="currentColor" opacity="0.6"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenuTab && (
        <FloatingPortal>
          <div
            ref={contextMenu.refs.setFloating}
            style={contextMenu.floatingStyles}
            className={contextMenuShellClasses}
            data-component="TabBarContextMenu"
            data-testid="agent-elements-tab-context-menu"
            data-agent-elements-shell="tab-context-menu"
            {...contextMenu.getFloatingProps()}
          >
            {renderContextMenuItem({
              id: 'pin',
              icon: 'push_pin',
              label: `${tabs.find(t => t.id === contextMenuTab)?.isPinned ? 'Unpin' : 'Pin'} Tab`,
              onClick: handleTogglePin,
            })}
            {renderContextMenuSeparator('pin')}
            {renderContextMenuItem({
              id: 'history',
              icon: 'history',
              label: 'View History...',
              onClick: handleViewHistory,
            })}
            {/* Common file actions (Open in Default App, External Editor, Finder, Copy Path, Share) */}
            {contextMenuTabData && (
              <>
                {renderContextMenuSeparator('common-file-actions')}
                <CommonFileActions
                  filePath={contextMenuTabData.filePath}
                  fileName={contextMenuTabData.fileName}
                  onClose={closeContextMenu}
                  menuItemClass={contextMenuItemClasses}
                  separatorClass={contextMenuSeparatorClasses}
                  useButtons
                />
              </>
            )}
            {renderContextMenuSeparator('close')}
            {renderContextMenuItem({
              id: 'close',
              icon: 'close',
              label: 'Close',
              onClick: () => { onTabClose(contextMenuTab); closeContextMenu(); },
            })}
            {renderContextMenuItem({
              id: 'close-others',
              icon: 'tab_close',
              label: 'Close Others',
              onClick: handleCloseOthers,
            })}
            {renderContextMenuItem({
              id: 'close-to-right',
              icon: 'tab_close_right',
              label: 'Close to the Right',
              onClick: handleCloseToRight,
            })}
            {renderContextMenuItem({
              id: 'close-all',
              icon: 'cancel',
              label: 'Close All',
              onClick: handleCloseAll,
            })}
            {onReopenLastClosed && hasClosedTabs && (
              <>
                {renderContextMenuSeparator('reopen')}
                {renderContextMenuItem({
                  id: 'reopen-closed',
                  icon: 'restore',
                  label: 'Reopen Closed Tab',
                  onClick: () => {
                    onReopenLastClosed();
                    closeContextMenu();
                  },
                })}
              </>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
};
