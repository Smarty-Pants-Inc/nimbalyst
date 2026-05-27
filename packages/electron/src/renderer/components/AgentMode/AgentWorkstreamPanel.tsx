/**
 * AgentWorkstreamPanel - The right side of AgentMode.
 *
 * Displays the selected workstream which could be:
 * - A single session
 * - A workstream (parent + child sessions)
 * - A worktree (worktree + associated sessions)
 *
 * Layout:
 * - WorkstreamHeader (title, provider icon, processing state, layout controls)
 * - WorkstreamEditorTabs (top - file editors for the entire workstream)
 * - WorkstreamSessionTabs (bottom - session tabs + AgentSessionPanel)
 * - FilesEditedSidebar (right - shows files edited by AI)
 *
 * File editing is at the WORKSTREAM level, not per-session.
 * Clicking a file in any session's sidebar opens it in the workstream editor tabs.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useImperativeHandle, type KeyboardEvent } from 'react';
import { getWorktreeNameFromPath } from '../../utils/pathUtils';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  useFloating,
  offset,
  flip,
  shift,
  FloatingPortal,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
} from '@floating-ui/react';
import { ProviderIcon, MaterialSymbol, SearchReplaceStateManager } from '@nimbalyst/runtime';
import { WorkstreamEditorTabs, type WorkstreamEditorTabsRef } from './WorkstreamEditorTabs';
import { WorkstreamSessionTabs } from './WorkstreamSessionTabs';
import { FilesEditedSidebar } from './FilesEditedSidebar';
import { LayoutControls } from '../UnifiedAI/LayoutControls';
import {
  workstreamSessionsAtom,
  workstreamTitleAtom,
  workstreamProcessingAtom,
  workstreamTagsAtom,
  sessionArchivedAtom,
  sessionStoreAtom,
  sessionRegistryAtom,
  sessionParentIdDerivedAtom,
  sessionWorktreeIdAtom,
  loadSessionChildrenAtom,
  loadSessionDataAtom,
  updateSessionStoreAtom,
  setActiveSessionInWorkstreamAtom,
  type WorkstreamType,
} from '../../store';
import {
  workstreamStateAtom,
  workstreamActiveChildAtom,
  workstreamLayoutModeAtom,
  workstreamSplitRatioAtom,
  workstreamFilesSidebarVisibleAtom,
  workstreamHasOpenFilesAtom,
  setWorkstreamLayoutModeAtom,
  setWorkstreamSplitRatioAtom,
  toggleWorkstreamFilesSidebarAtom,
  loadWorkstreamState,
  workstreamStatesLoadedAtom,
  workstreamWorktreePathAtom,
  type WorkstreamLayoutMode,
} from '../../store/atoms/workstreamState';
import {
  filesEditedWidthAtom,
  setFilesEditedWidthAtom,
} from '../../store/atoms/agentMode';
import { ArchiveWorktreeDialog } from './ArchiveWorktreeDialog';
import { useArchiveWorktreeDialog } from '../../hooks/useArchiveWorktreeDialog';
import { detectFileType, type SerializableDocumentContext } from '../../hooks/useDocumentContext';
import { getTextSelection } from '../UnifiedAI/TextSelectionIndicator';
import { terminalListAtom, setActiveTerminal, loadTerminals } from '../../store/atoms/terminals';
import {
  sessionKanbanTagsAtom,
  setSessionTagsAtom,
} from '../../store/atoms/sessionKanban';

export interface AgentWorkstreamPanelRef {
  closeActiveTab: () => void;
}

export interface AgentWorkstreamPanelProps {
  workspacePath: string;
  workstreamId: string;
  workstreamType: WorkstreamType;
  onFileOpen?: (filePath: string) => Promise<void>;
  onAddSessionToWorktree?: (worktreeId: string) => Promise<void>;
  onCreateWorktreeSession?: (worktreeId: string) => Promise<string | null>;
  /** Callback when a worktree is archived */
  onWorktreeArchived?: () => void;
  /** Whether the workspace is a git repository */
  isGitRepo?: boolean;
  /** Open a session in agent mode (navigates to session tab) */
  onSwitchToAgentMode?: (planDocumentPath?: string, sessionId?: string) => void;
  /** Open a session in the chat sidebar */
  onOpenSessionInChat?: (sessionId: string) => void;
}

const TAGS_KEY_SEPARATOR = String.fromCharCode(0);

const iconButtonClass = [
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center',
  'rounded-[var(--an-radius-sm)] border border-transparent bg-transparent text-[var(--an-foreground-subtle)]',
  'outline-none transition-[background-color,border-color,color] duration-150 ease-out',
  'hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground-muted)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const agentWorkstreamPanelClass = [
  'agent-workstream-panel agent-elements-agent-workstream-panel flex h-full flex-row overflow-hidden',
  'bg-[var(--an-background)] text-[var(--an-foreground)] [container-type:inline-size]',
].join(' ');

const agentWorkstreamMainClass = [
  'agent-workstream-panel-main agent-elements-agent-workstream-main',
  'flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--an-background)]',
].join(' ');

const agentWorkstreamContentClass = [
  'agent-workstream-panel-content agent-elements-agent-workstream-content',
  'flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--an-background)]',
].join(' ');

const agentWorkstreamEditorAreaClass = [
  'agent-workstream-editor-area agent-elements-agent-workstream-editor-area',
  'flex min-h-0 shrink-0 flex-col border-b border-[var(--an-border-color)] bg-[var(--an-background)]',
].join(' ');

const agentWorkstreamSessionAreaClass = [
  'agent-workstream-session-area agent-elements-agent-workstream-session-area',
  'flex flex-col overflow-hidden bg-[var(--an-background)]',
].join(' ');

const resizerClass = [
  'agent-elements-agent-workstream-resizer shrink-0 bg-[var(--an-border-color)]',
  'transition-[background-color] duration-150 ease-out hover:bg-[var(--an-primary-color)]',
].join(' ');

const resizerDraggingClass = 'dragging bg-[var(--an-primary-color)]';

/**
 * Tag pill row that fits as many tags as the container allows on a single line.
 * Overflowing tags collapse into a "+N" pill that opens a floating dropdown.
 *
 * Measurement runs in a hidden layer that mirrors the real pill widths, so the
 * visible row never has to render-then-clip the overflowing pills.
 */
const TAG_PILL_CLASS = [
  'agent-elements-workstream-tag-pill group flex cursor-default items-center gap-0.5 whitespace-nowrap',
  'rounded-[999px] bg-[color-mix(in_srgb,var(--an-foreground)_8%,transparent)]',
  'py-0.5 pl-1.5 pr-1 text-[10px] font-medium leading-none text-[var(--an-foreground-subtle)]',
].join(' ');

const TAG_OVERFLOW_PILL_CLASS = [
  'agent-elements-workstream-tag-overflow flex cursor-pointer items-center gap-0.5 whitespace-nowrap border-none',
  'rounded-[999px] bg-[color-mix(in_srgb,var(--an-foreground)_8%,transparent)]',
  'px-1.5 py-0.5 text-[10px] font-medium leading-none text-[var(--an-foreground-subtle)]',
  'outline-none transition-[background-color,color] duration-150 ease-out',
  'hover:bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] hover:text-[var(--an-foreground-muted)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const tagInputClass = [
  'agent-elements-workstream-tag-input w-[80px] rounded-[999px] border border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] px-1.5 py-0.5 text-[10px] leading-none text-[var(--an-foreground)]',
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const tagDropdownClass = [
  'agent-elements-workstream-tag-menu absolute left-0 top-full z-[10000] mt-1 min-w-[120px]',
  'rounded-[var(--an-radius-sm)] border border-[var(--an-border-color)] bg-[var(--an-background)]',
  'py-0.5 text-[11px] text-[var(--an-foreground-muted)]',
].join(' ');

const tagDropdownItemClass = [
  'agent-elements-workstream-tag-menu-item cursor-pointer px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]',
  'text-[var(--an-foreground-muted)] transition-[background-color,color] duration-150 ease-out',
  'hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
].join(' ');

const addTagButtonClass = [
  'agent-elements-workstream-add-tag flex h-4 w-4 cursor-pointer items-center justify-center rounded-[999px]',
  'border border-dashed border-[var(--an-border-color)] bg-transparent text-[var(--an-foreground-subtle)]',
  'outline-none transition-[border-color,color] duration-150 ease-out',
  'hover:border-[var(--an-border-color-strong)] hover:text-[var(--an-foreground-muted)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const tagCloseButtonClass = [
  'flex h-3 w-3 cursor-pointer items-center justify-center rounded-[999px] border-none bg-transparent',
  'text-[var(--an-foreground-subtle)] opacity-0 transition-opacity duration-150 ease-out',
  'hover:text-[var(--an-foreground)] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const overflowMenuClass = [
  'agent-elements-workstream-tag-overflow-menu z-[10000] max-h-[300px] min-w-[140px] overflow-y-auto',
  'rounded-[var(--an-radius-sm)] border border-[var(--an-border-color)] bg-[var(--an-background)] py-[var(--an-spacing-xs)]',
].join(' ');

const overflowMenuRowClass = [
  'group flex items-center justify-between gap-[var(--an-spacing-sm)]',
  'px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-[11px]',
  'text-[var(--an-foreground-muted)] transition-[background-color,color] duration-150 ease-out',
  'hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
].join(' ');

const overflowMenuRemoveButtonClass = [
  'flex h-4 w-4 cursor-pointer items-center justify-center rounded-[999px] border-none bg-transparent',
  'text-[var(--an-foreground-subtle)] opacity-0 transition-opacity duration-150 ease-out',
  'hover:text-[var(--an-foreground)] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const headerClass = [
  'workstream-header agent-elements-workstream-header shrink-0',
  'border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)]',
  'px-[var(--an-spacing-xxl)] py-0 text-[var(--an-foreground)]',
].join(' ');

const headerMainClass = [
  'workstream-header-main agent-elements-workstream-header-main flex h-14 items-center gap-[var(--an-spacing-lg)]',
].join(' ');

const headerIconClass = [
  'workstream-header-icon agent-elements-workstream-header-icon shrink-0 text-[var(--an-foreground-muted)]',
].join(' ');

const headerContentClass = [
  'workstream-header-content agent-elements-workstream-header-content flex min-w-0 flex-1 flex-col items-start gap-0.5',
].join(' ');

const titleInputClass = [
  'workstream-header-title-input agent-elements-workstream-title-input m-0 w-full min-w-[150px] max-w-[500px]',
  'rounded-[var(--an-radius-sm)] border border-[var(--an-border-color-strong)] bg-[var(--an-background)]',
  'px-[var(--an-spacing-xs)] py-0.5 text-sm font-semibold text-[var(--an-foreground)] outline-none',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const titleRowClass = [
  'workstream-header-title-row agent-elements-workstream-title-row flex min-w-0 max-w-full items-baseline gap-[var(--an-spacing-sm)]',
].join(' ');

const titleClass = [
  'workstream-header-title agent-elements-workstream-title m-0 min-w-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap',
  'rounded-[var(--an-radius-xs)] px-[var(--an-spacing-xs)] py-0.5 text-sm font-semibold leading-tight text-[var(--an-foreground)]',
  'transition-[background-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)]',
].join(' ');

const headerContextClass = [
  'workstream-header-context agent-elements-workstream-context whitespace-nowrap text-[10px] leading-tight text-[var(--an-foreground-muted)] opacity-70',
].join(' ');

const spinnerClass = [
  'workstream-header-spinner h-4 w-4 rounded-[999px] border-2 border-[var(--an-border-color)] border-t-[var(--an-primary-color)] animate-spin',
].join(' ');

const terminalMenuClass = [
  'agent-elements-workstream-terminal-menu fixed z-[10000] min-w-[140px]',
  'rounded-[var(--an-radius-sm)] border border-[var(--an-border-color)] bg-[var(--an-background)]',
  'p-[var(--an-spacing-xs)] text-[13px] text-[var(--an-foreground)]',
].join(' ');

const terminalMenuItemClass = [
  'agent-elements-workstream-terminal-menu-item flex cursor-pointer items-center gap-2.5',
  'rounded-[var(--an-radius-xs)] px-[var(--an-spacing-lg)] py-1.5',
  'text-[var(--an-foreground)] transition-[background-color,color] duration-150 ease-out',
  'hover:bg-[var(--an-background-tertiary)]',
].join(' ');

const archiveButtonClass = [
  'workstream-archive-button agent-elements-workstream-archive-button',
  'flex h-8 cursor-pointer items-center gap-1.5 rounded-[var(--an-radius-sm)] border border-transparent bg-transparent px-[var(--an-spacing-sm)]',
  'text-[11px] font-medium text-[var(--an-foreground-subtle)] outline-none',
  'transition-[background-color,border-color,color] duration-150 ease-out',
  'hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground-muted)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const sidebarToggleClass = [
  'workstream-sidebar-toggle agent-elements-workstream-sidebar-toggle ml-[var(--an-spacing-sm)]',
  iconButtonClass,
].join(' ');

const sidebarToggleActiveClass = 'active border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] text-[var(--an-primary-color)]';

const WorkstreamHeaderTagsRow: React.FC<{ workstreamId: string }> = ({ workstreamId }) => {
  const tags = useAtomValue(workstreamTagsAtom(workstreamId));
  const allTags = useAtomValue(sessionKanbanTagsAtom);
  const registry = useAtomValue(sessionRegistryAtom);
  const setSessionTags = useSetAtom(setSessionTagsAtom);

  const rootTags = registry.get(workstreamId)?.tags ?? [];

  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tags.length);

  const [overflowOpen, setOverflowOpen] = useState(false);
  const { refs: overflowRefs, floatingStyles: overflowFloatingStyles, context: overflowContext } = useFloating({
    open: overflowOpen,
    onOpenChange: setOverflowOpen,
    placement: 'bottom-end',
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const overflowClick = useClick(overflowContext);
  const overflowDismiss = useDismiss(overflowContext);
  const overflowRole = useRole(overflowContext, { role: 'menu' });
  const { getReferenceProps: getOverflowReferenceProps, getFloatingProps: getOverflowFloatingProps } = useInteractions([overflowClick, overflowDismiss, overflowRole]);

  // Close the suggestions dropdown when clicking outside the input.
  useEffect(() => {
    if (!isEditingTags) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node) &&
        tagInputRef.current && !tagInputRef.current.contains(e.target as Node)
      ) {
        setIsEditingTags(false);
        setTagInput('');
      }
    };
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditingTags(false);
        setTagInput('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isEditingTags]);

  useEffect(() => {
    if (isEditingTags && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isEditingTags]);

  const handleAddTag = useCallback((tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed || rootTags.includes(trimmed)) return;
    setSessionTags({ sessionId: workstreamId, tags: [...rootTags, trimmed] });
    setTagInput('');
  }, [workstreamId, rootTags, setSessionTags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setSessionTags({ sessionId: workstreamId, tags: rootTags.filter(t => t !== tag) });
  }, [workstreamId, rootTags, setSessionTags]);

  const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && rootTags.length > 0) {
      handleRemoveTag(rootTags[rootTags.length - 1]);
    } else if (e.key === 'Escape') {
      setIsEditingTags(false);
      setTagInput('');
    }
  }, [tagInput, rootTags, handleAddTag, handleRemoveTag]);

  const filteredSuggestions = React.useMemo(() => {
    if (!tagInput.trim()) return [];
    const q = tagInput.trim().toLowerCase();
    return allTags
      .filter(t => t.name.toLowerCase().includes(q) && !tags.includes(t.name))
      .slice(0, 5);
  }, [tagInput, allTags, tags]);

  // Content key so the layout effect only re-runs when tag contents change.
  const tagsKey = tags.join(TAGS_KEY_SEPARATOR);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const compute = () => {
      const containerWidth = container.clientWidth;
      if (containerWidth <= 0) return;

      const tagEls = Array.from(measure.querySelectorAll<HTMLElement>('[data-measure-tag]'));
      const overflowEl = measure.querySelector<HTMLElement>('[data-measure-overflow]');
      const trailingEl = measure.querySelector<HTMLElement>('[data-measure-trailing]');

      const GAP = 4; // matches gap-1
      const trailingWidth = trailingEl ? trailingEl.offsetWidth + GAP : 0;
      const overflowWidth = overflowEl ? overflowEl.offsetWidth + GAP : 0;

      let used = 0;
      let count = 0;
      for (let i = 0; i < tagEls.length; i++) {
        const w = tagEls[i].offsetWidth;
        const gap = count > 0 ? GAP : 0;
        const remaining = tagEls.length - i - 1;
        const overflowReserve = remaining > 0 ? overflowWidth : 0;
        if (used + gap + w + overflowReserve + trailingWidth > containerWidth) break;
        used += gap + w;
        count++;
      }

      setVisibleCount(count);
    };

    const ro = new ResizeObserver(compute);
    ro.observe(container);
    compute();
    return () => ro.disconnect();
  }, [tagsKey, isEditingTags]);

  const visibleTags = tags.slice(0, visibleCount);
  const hiddenTags = tags.slice(visibleCount);
  const hasOverflow = hiddenTags.length > 0;

  const renderTrailing = () => (
    isEditingTags ? (
      <div className="relative">
        <input
          ref={tagInputRef}
          type="text"
          className={tagInputClass}
          placeholder="add tag..."
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagInputKeyDown}
          onBlur={() => {
            setTimeout(() => {
              setIsEditingTags(false);
              setTagInput('');
            }, 150);
          }}
        />
        {filteredSuggestions.length > 0 && (
          <div
            ref={tagDropdownRef}
            className={tagDropdownClass}
          >
            {filteredSuggestions.map(s => (
              <div
                key={s.name}
                className={tagDropdownItemClass}
                onMouseDown={(e) => { e.preventDefault(); handleAddTag(s.name); }}
              >
                {s.name} <span className="text-[var(--an-foreground-subtle)]">({s.count})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ) : (
      <button
        type="button"
        className={addTagButtonClass}
        onClick={() => setIsEditingTags(true)}
        title="Add tag"
      >
        <MaterialSymbol icon="add" size={10} />
      </button>
    )
  );

  return (
    <div
      ref={containerRef}
      className="workstream-header-tags self-stretch flex items-center gap-1 flex-nowrap overflow-hidden min-w-0 relative"
    >
      {/* Hidden measurement layer. Mirrors visible-pill sizes without taking layout space. */}
      <div
        ref={measureRef}
        aria-hidden
        className="flex items-center gap-1 absolute left-0 top-0 pointer-events-none invisible"
      >
        {tags.map(tag => (
          <span key={tag} data-measure-tag className={TAG_PILL_CLASS}>
            {tag}
            <span className="flex items-center justify-center w-3 h-3 rounded-full">
              <MaterialSymbol icon="close" size={10} />
            </span>
          </span>
        ))}
        {tags.length > 0 && (
          <span data-measure-overflow className={TAG_OVERFLOW_PILL_CLASS}>
            +{tags.length}
          </span>
        )}
        <div data-measure-trailing>
          {isEditingTags ? (
            <span className="inline-block h-[18px] w-[80px] rounded-[999px] border border-[var(--an-border-color)]" />
          ) : (
            <span className="flex h-4 w-4 items-center justify-center rounded-[999px] border border-dashed border-[var(--an-border-color)]">
              <MaterialSymbol icon="add" size={10} />
            </span>
          )}
        </div>
      </div>

      {visibleTags.map(tag => (
        <span key={tag} className={TAG_PILL_CLASS}>
          {tag}
          <button
            type="button"
            className={tagCloseButtonClass}
            onClick={() => handleRemoveTag(tag)}
            title={`Remove tag "${tag}"`}
          >
            <MaterialSymbol icon="close" size={10} />
          </button>
        </span>
      ))}

      {hasOverflow && (
        <>
          <button
            ref={overflowRefs.setReference}
            {...getOverflowReferenceProps()}
            className={TAG_OVERFLOW_PILL_CLASS}
            title={`Show ${hiddenTags.length} more tag${hiddenTags.length === 1 ? '' : 's'}`}
          >
            +{hiddenTags.length}
          </button>
          {overflowOpen && (
            <FloatingPortal>
              <div
                ref={overflowRefs.setFloating}
                style={overflowFloatingStyles}
                {...getOverflowFloatingProps()}
                className={overflowMenuClass}
              >
                {hiddenTags.map(tag => (
                  <div
                    key={tag}
                    className={overflowMenuRowClass}
                  >
                    <span className="truncate">{tag}</span>
                    <button
                      type="button"
                      className={overflowMenuRemoveButtonClass}
                      onClick={() => handleRemoveTag(tag)}
                      title={`Remove tag "${tag}"`}
                    >
                      <MaterialSymbol icon="close" size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </FloatingPortal>
          )}
        </>
      )}

      {renderTrailing()}
    </div>
  );
};

/**
 * Header showing workstream title, provider icon, processing state, and layout controls.
 * Subscribes to atoms directly for isolated re-renders.
 */
const WorkstreamHeader: React.FC<{
  workstreamId: string;
  workspacePath: string;
  worktreeId?: string | null;
  worktreePath?: string | null;
  onToggleSidebar: () => void;
  sidebarVisible: boolean;
  onArchiveStatusChange?: () => void;
  onOpenTerminal?: () => void;
  onCreateNewTerminal?: () => void;
  onShowArchiveDialog?: () => void;
}> = React.memo(({ workstreamId, workspacePath, worktreeId, worktreePath, onToggleSidebar, sidebarVisible, onArchiveStatusChange, onOpenTerminal, onCreateNewTerminal, onShowArchiveDialog }) => {
  const title = useAtomValue(workstreamTitleAtom(workstreamId));
  const isProcessing = useAtomValue(workstreamProcessingAtom(workstreamId));
  const sessionData = useAtomValue(sessionStoreAtom(workstreamId));
  const layoutMode = useAtomValue(workstreamLayoutModeAtom(workstreamId));
  const hasTabs = useAtomValue(workstreamHasOpenFilesAtom(workstreamId));
  const sessions = useAtomValue(workstreamSessionsAtom(workstreamId));
  const [isArchived, setIsArchived] = useAtom(sessionArchivedAtom(workstreamId));
  const setLayoutMode = useSetAtom(setWorkstreamLayoutModeAtom);
  const updateSessionStore = useSetAtom(updateSessionStoreAtom);

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Terminal button context menu state
  const [terminalContextMenu, setTerminalContextMenu] = useState<{ x: number; y: number } | null>(null);
  const terminalContextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!terminalContextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (terminalContextMenuRef.current && !terminalContextMenuRef.current.contains(e.target as Node)) {
        setTerminalContextMenu(null);
      }
    };

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTerminalContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [terminalContextMenu]);

  const handleTerminalContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setTerminalContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleNewTerminalClick = useCallback(() => {
    setTerminalContextMenu(null);
    onCreateNewTerminal?.();
  }, [onCreateNewTerminal]);

  // A workstream has children if there are multiple sessions
  const hasChildren = sessions.length > 1;

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Update edit value when title changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(title ?? '');
    }
  }, [title, isEditing]);

  const handleTitleClick = useCallback(() => {
    setEditValue(title ?? '');
    setIsEditing(true);
  }, [title]);

  const handleRenameSubmit = useCallback(async () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== title) {
      try {
        const result = await window.electronAPI.invoke('sessions:update-metadata', workstreamId, { title: trimmedValue });
        if (result.success) {
          const now = Date.now();
          // Update session with new title (syncs both sessionStoreAtom and sessionRegistryAtom)
          updateSessionStore({ sessionId: workstreamId, updates: { title: trimmedValue, updatedAt: now } });
        } else {
          console.error('[WorkstreamHeader] Failed to rename session:', result.error);
        }
      } catch (err) {
        console.error('[WorkstreamHeader] Error renaming session:', err);
      }
    }
    setIsEditing(false);
  }, [editValue, title, workstreamId, updateSessionStore]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(title ?? '');
      setIsEditing(false);
    }
  }, [handleRenameSubmit, title]);

  const handleLayoutChange = useCallback((mode: WorkstreamLayoutMode) => {
    setLayoutMode({ workstreamId, mode });
  }, [workstreamId, setLayoutMode]);

  // Determine session type label for archive button
  const getSessionTypeLabel = useCallback(() => {
    if (worktreeId) return 'Worktree';
    if (hasChildren) return 'Workstream';
    return 'Session';
  }, [worktreeId, hasChildren]);

  const handleArchive = useCallback(async () => {
    // For worktrees, show confirmation dialog first
    if (worktreeId && onShowArchiveDialog) {
      onShowArchiveDialog();
      return;
    }

    try {
      await window.electronAPI.invoke('sessions:update-metadata', workstreamId, { isArchived: true });
      setIsArchived(true);
      // Update atom state for immediate UI feedback across all components
      updateSessionStore({ sessionId: workstreamId, updates: { isArchived: true } });
      onArchiveStatusChange?.();
    } catch (error) {
      console.error('[WorkstreamHeader] Failed to archive:', error);
    }
  }, [workstreamId, worktreeId, onArchiveStatusChange, onShowArchiveDialog, updateSessionStore]);

  const handleUnarchive = useCallback(async () => {
    try {
      await window.electronAPI.invoke('sessions:update-metadata', workstreamId, { isArchived: false });
      setIsArchived(false);
      // Update atom state for immediate UI feedback across all components
      updateSessionStore({ sessionId: workstreamId, updates: { isArchived: false } });
      onArchiveStatusChange?.();
    } catch (error) {
      console.error('[WorkstreamHeader] Failed to unarchive:', error);
    }
  }, [workstreamId, onArchiveStatusChange, updateSessionStore]);

  const contextPath = worktreePath || workspacePath;
  const contextLabel = worktreePath
    ? `worktree ${getWorktreeNameFromPath(worktreePath)}`
    : `repo ${getWorktreeNameFromPath(workspacePath, 'workspace')}`;

  return (
    <div
      className={headerClass}
      data-agent-elements-shell="workstream-header"
      data-component="WorkstreamHeader"
      data-testid="workstream-execution-context"
      data-session-id={workstreamId}
      data-workspace-path={workspacePath}
      data-worktree-id={worktreeId || ''}
      data-worktree-path={worktreePath || ''}
    >
      <div className={headerMainClass}>
        <div className={headerIconClass}>
          {hasChildren ? (
            <MaterialSymbol icon="account_tree" size={20} />
          ) : (
            <ProviderIcon provider={sessionData?.provider || 'claude-code'} size={20} />
          )}
        </div>

        <div className={headerContentClass}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className={titleInputClass}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <div className={titleRowClass}>
              <h2
                className={titleClass}
                onClick={handleTitleClick}
                title="Click to rename"
              >
                {title}
              </h2>
              <span
                className={headerContextClass}
                title={contextPath}
                data-testid="workstream-context-label"
              >
                {contextLabel}
              </span>
            </div>
          )}
          <WorkstreamHeaderTagsRow workstreamId={workstreamId} />
        </div>

        {isProcessing && (
          <div className="workstream-header-processing shrink-0 flex items-center justify-center">
            <span className={spinnerClass} />
          </div>
        )}

        {/* Terminal button - only show for worktree sessions, positioned before layout controls */}
        {worktreeId && onOpenTerminal && (
          <button
            type="button"
            className={`workstream-terminal-btn agent-elements-workstream-terminal-button mr-[var(--an-spacing-sm)] ${iconButtonClass}`}
            onClick={onOpenTerminal}
            onContextMenu={handleTerminalContextMenu}
            title="Open terminal in worktree"
          >
            <MaterialSymbol icon="terminal" size={20} />
          </button>
        )}

        {/* Terminal button context menu */}
        {terminalContextMenu && (
          <div
            ref={terminalContextMenuRef}
            className={terminalMenuClass}
            style={{
              left: terminalContextMenu.x,
              top: terminalContextMenu.y,
            }}
          >
            <div
              className={terminalMenuItemClass}
              onClick={handleNewTerminalClick}
            >
              <MaterialSymbol icon="add" size={18} />
              <span>New Terminal</span>
            </div>
          </div>
        )}

        {/* Layout controls - shared component with Files/Agent labels */}
        <LayoutControls
          mode={layoutMode}
          hasTabs={hasTabs}
          onModeChange={handleLayoutChange}
        />

        {/* Archive/Unarchive button */}
        <button
          type="button"
          className={archiveButtonClass}
          onClick={isArchived ? handleUnarchive : handleArchive}
          title={isArchived ? `Unarchive ${getSessionTypeLabel().toLowerCase()}` : `Archive ${getSessionTypeLabel().toLowerCase()}`}
        >
          <MaterialSymbol icon={isArchived ? 'unarchive' : 'archive'} size={18} />
          <span>{isArchived ? `Unarchive ${getSessionTypeLabel()}` : `Archive ${getSessionTypeLabel()}`}</span>
        </button>

        {/* Toggle files sidebar */}
        <button
          type="button"
          className={`${sidebarToggleClass} ${sidebarVisible ? sidebarToggleActiveClass : ''}`}
          onClick={onToggleSidebar}
          title={sidebarVisible ? 'Hide edited files' : 'Show edited files'}
        >
          <MaterialSymbol icon="dock_to_right" size={20} />
        </button>
      </div>
    </div>
  );
});

WorkstreamHeader.displayName = 'WorkstreamHeader';

/**
 * AgentWorkstreamPanel renders the selected workstream.
 *
 * File clicks open in the workstream-level editor tabs, not per-session.
 */
export const AgentWorkstreamPanel = React.memo(React.forwardRef<AgentWorkstreamPanelRef, AgentWorkstreamPanelProps>(({
  workspacePath,
  workstreamId,
  workstreamType,
  onFileOpen,
  onAddSessionToWorktree,
  onCreateWorktreeSession,
  onWorktreeArchived,
  isGitRepo = false,
  onSwitchToAgentMode,
  onOpenSessionInChat,
}, ref) => {
  // Ref to the workstream editor tabs for opening files
  const editorTabsRef = useRef<WorkstreamEditorTabsRef>(null);

  // Get sessions in this workstream
  const sessions = useAtomValue(workstreamSessionsAtom(workstreamId));
  const activeSessionId = useAtomValue(workstreamActiveChildAtom(workstreamId));
  const setActiveSession = useSetAtom(setActiveSessionInWorkstreamAtom);

  // Worktree state - read cached worktree path from atom (available synchronously on remount)
  const worktreePath = useAtomValue(workstreamWorktreePathAtom(workstreamId));
  const setWorkstreamState = useSetAtom(workstreamStateAtom(workstreamId));
  const sessionParentId = useAtomValue(sessionParentIdDerivedAtom(workstreamId));
  const sessionWorktreeId = useAtomValue(sessionWorktreeIdAtom(workstreamId));

  // Debug: log when activeSessionId changes
  // useEffect(() => {
  //   console.log(`[AgentWorkstreamPanel] activeSessionId changed for ${workstreamId}:`, activeSessionId);
  // }, [workstreamId, activeSessionId]);

  // Layout state (persisted via workstreamStateAtom)
  const layoutMode = useAtomValue(workstreamLayoutModeAtom(workstreamId));
  const sidebarVisible = useAtomValue(workstreamFilesSidebarVisibleAtom(workstreamId));
  const splitRatio = useAtomValue(workstreamSplitRatioAtom(workstreamId));
  const hasTabs = useAtomValue(workstreamHasOpenFilesAtom(workstreamId));
  const toggleSidebar = useSetAtom(toggleWorkstreamFilesSidebarAtom);
  const setSplitRatio = useSetAtom(setWorkstreamSplitRatioAtom);
  const setLayoutMode = useSetAtom(setWorkstreamLayoutModeAtom);

  // Files sidebar width (project-level state from agentMode)
  const sidebarWidth = useAtomValue(filesEditedWidthAtom);
  const setSidebarWidth = useSetAtom(setFilesEditedWidthAtom);

  // Session store for updating archived state
  const updateSessionStore = useSetAtom(updateSessionStoreAtom);

  // Load persisted state when workstream changes
  useEffect(() => {
    loadWorkstreamState(workstreamId);
  }, [workstreamId]);

  // Auto-collapse editor area when last tab is closed
  // Use a ref to track if we just opened a file to prevent immediate collapse
  const justOpenedFileRef = useRef(false);

  useEffect(() => {
    // If we're in editor or split mode and there are no tabs, switch to transcript mode
    // But don't collapse if we just opened a file (wait for it to actually open)
    if (!hasTabs && (layoutMode === 'editor' || layoutMode === 'split') && !justOpenedFileRef.current) {
      setLayoutMode({ workstreamId, mode: 'transcript' });
    }
    // Reset the flag after each check
    justOpenedFileRef.current = false;
  }, [hasTabs, layoutMode, workstreamId, setLayoutMode]);

  // Load session data and children when workstream changes
  // This is critical for workstreams with child sessions to work properly
  const loadSessionData = useSetAtom(loadSessionDataAtom);
  const loadSessionChildren = useSetAtom(loadSessionChildrenAtom);

  // Get session data to check if it's been loaded
  const sessionDataLoaded = useAtomValue(sessionStoreAtom(workstreamId));

  // Wait for workstream states to be loaded from disk before loading children
  // This prevents race conditions where children load before persisted activeChildId is restored
  const workstreamStatesLoaded = useAtomValue(workstreamStatesLoadedAtom);

  // Track which workstreams have had their children loaded to prevent re-loading
  // on session data updates (which would reset activeChildId and cause focus stealing)
  const childrenLoadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!workstreamId || !workspacePath) return;

    // Load session data if not already loaded
    // sessionDataLoaded is null when no data has been fetched yet
    if (sessionDataLoaded === null) {
      // console.log('[AgentWorkstreamPanel] Session data not loaded, fetching for:', workstreamId);
      loadSessionData({ sessionId: workstreamId, workspacePath });
    }
  }, [workstreamId, workspacePath, sessionDataLoaded, loadSessionData]);

  useEffect(() => {
    // Wait for both session data AND workstream states to be loaded before loading children
    // This ensures persisted activeChildId is available when loadSessionChildrenAtom runs
    if (!workstreamId || !workspacePath || sessionDataLoaded === null || !workstreamStatesLoaded) {
      // console.log('[AgentWorkstreamPanel] Children effect - waiting for:', {
      //   workstreamId: !!workstreamId,
      //   workspacePath: !!workspacePath,
      //   sessionDataLoaded: sessionDataLoaded !== null,
      //   workstreamStatesLoaded,
      // });
      return;
    }

    // Only load children once per workstream to prevent focus stealing
    // When session data updates (e.g., new messages), we don't want to reload children
    // because loadSessionChildrenAtom resets activeChildId which causes the active tab to change
    if (childrenLoadedRef.current.has(workstreamId)) {
      return;
    }

    // Load child sessions for this workstream
    // This populates sessionChildrenAtom which workstreamSessionsAtom depends on
    // sessionParentId === null means this IS a root session (not a child of another session)
    if (sessionParentId === null) {
      // This is a root session - load its children
      // console.log('[AgentWorkstreamPanel] Loading children for root session:', workstreamId);
      loadSessionChildren({ parentSessionId: workstreamId, workspacePath });
      childrenLoadedRef.current.add(workstreamId);
    }
  }, [workstreamId, workspacePath, sessionDataLoaded, sessionParentId, workstreamStatesLoaded, loadSessionChildren]);

  // Resolve worktree path if this is a worktree session and not yet cached in atom
  useEffect(() => {
    if (!sessionWorktreeId) {
      if (worktreePath) {
        setWorkstreamState({ worktreePath: null });
      }
      return;
    }

    // Skip IPC if already cached in workstream state
    if (worktreePath) return;

    // Query worktree path via IPC and cache in workstream state atom
    (async () => {
      try {
        const result = await window.electronAPI.invoke('worktree:get', sessionWorktreeId);
        if (result?.success && result.worktree) {
          setWorkstreamState({ worktreePath: result.worktree.path });
        } else {
          console.error('[AgentWorkstreamPanel] Failed to resolve worktree path:', result?.error);
        }
      } catch (error) {
        console.error('[AgentWorkstreamPanel] Error resolving worktree path:', error);
      }
    })();
  }, [sessionWorktreeId, worktreePath, setWorkstreamState]);

  // Local state for drag states
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

  // Archive worktree dialog hook
  const {
    dialogState: archiveDialogState,
    showDialog: showArchiveDialog,
    closeDialog: closeArchiveDialog,
    confirmArchive,
  } = useArchiveWorktreeDialog();

  // Ref for the content container (used for resize calculations)
  const contentRef = useRef<HTMLDivElement>(null);

  // Ref for the editor area to check focus
  const editorAreaRef = useRef<HTMLDivElement>(null);

  // Ref for the session/transcript area to check focus
  const sessionAreaRef = useRef<HTMLDivElement>(null);

  // Track which panel (editor vs session) was last clicked/focused.
  // Used by CMD+F to determine where to route find, since document.activeElement
  // is unreliable (e.g., clicking a tab bar or non-focusable area doesn't set activeElement
  // inside the editor area). Defaults to 'session' since that's the primary panel.
  const lastFocusedPanelRef = useRef<'editor' | 'session'>('session');

  // For single sessions, activeSessionId should be the session itself
  // For workstreams, activeSessionId should be one of the children
  // We trust the atom state - no fallback that masks bugs

  const handleSessionSelect = useCallback((sessionId: string) => {
    setActiveSession({ workstreamId, sessionId });
  }, [workstreamId, setActiveSession]);

  // Archive a child session
  const handleSessionArchive = useCallback(async (sessionId: string) => {
    try {
      await window.electronAPI.invoke('sessions:update-metadata', sessionId, { isArchived: true });
      updateSessionStore({ sessionId, updates: { isArchived: true } });
    } catch (error) {
      console.error('[AgentWorkstreamPanel] Failed to archive session:', error);
    }
  }, [updateSessionStore]);

  // Unarchive a child session
  const handleSessionUnarchive = useCallback(async (sessionId: string) => {
    try {
      await window.electronAPI.invoke('sessions:update-metadata', sessionId, { isArchived: false });
      updateSessionStore({ sessionId, updates: { isArchived: false } });
    } catch (error) {
      console.error('[AgentWorkstreamPanel] Failed to unarchive session:', error);
    }
  }, [updateSessionStore]);

  // Rename a session
  // If this is a worktree with only one session, also rename the worktree to keep them in sync
  const handleSessionRename = useCallback(async (sessionId: string, newName: string) => {
    try {
      console.log('[AgentWorkstreamPanel] Renaming session', { sessionId, newName, sessionWorktreeId, sessionsLength: sessions.length });
      const result = await window.electronAPI.invoke('sessions:update-metadata', sessionId, { title: newName });
      if (result.success) {
        const now = Date.now();
        updateSessionStore({ sessionId, updates: { title: newName, updatedAt: now } });

        // If this is a single-session worktree, also rename the worktree
        if (sessionWorktreeId && sessions.length === 1) {
          console.log('[AgentWorkstreamPanel] Also renaming worktree', { sessionWorktreeId, newName });
          const worktreeResult = await window.electronAPI.invoke('worktree:update-display-name', sessionWorktreeId, newName);
          console.log('[AgentWorkstreamPanel] Worktree rename result', worktreeResult);
        }
      } else {
        console.error('[AgentWorkstreamPanel] Failed to rename session:', result.error);
      }
    } catch (error) {
      console.error('[AgentWorkstreamPanel] Error renaming session:', error);
    }
  }, [updateSessionStore, sessionWorktreeId, sessions.length]);

  // Track pending file open when switching to split mode
  const pendingFileOpenRef = useRef<string | null>(null);

  // File clicks open in the workstream editor tabs
  const handleFileClick = useCallback((filePath: string) => {
    if (editorTabsRef.current) {
      // Editor is mounted, open the file directly
      editorTabsRef.current.openFile(filePath);
    } else {
      // Editor not mounted (transcript mode), switch to split and queue file open
      // Set flag to prevent auto-collapse during this transition
      justOpenedFileRef.current = true;
      pendingFileOpenRef.current = filePath;
      setLayoutMode({ workstreamId, mode: 'split' });
    }
  }, [workstreamId, setLayoutMode]);

  // Get document context from the workstream editor tabs (for AI selection/file context)
  // This is called on-demand when sending a message to capture fresh selection state
  const getDocumentContext = useCallback(async (): Promise<SerializableDocumentContext> => {
    const activeTab = editorTabsRef.current?.getActiveTab();
    if (!activeTab) {
      return {
        filePath: undefined,
        content: undefined,
        fileType: undefined,
        textSelection: undefined,
        textSelectionTimestamp: undefined,
      };
    }

    const fileType = detectFileType(activeTab.filePath);

    // Get text selection if it matches the current file
    const textSelectionData = getTextSelection();
    const textSelection = textSelectionData && textSelectionData.filePath === activeTab.filePath
      ? textSelectionData
      : undefined;

    // Get mockup fields if viewing a mockup
    const mockupSelection = fileType === 'mockup' ? (window as any).__mockupSelectedElement : undefined;
    const mockupDrawing = fileType === 'mockup' ? (window as any).__mockupDrawing : undefined;

    return {
      filePath: activeTab.filePath,
      content: activeTab.content,
      fileType,
      textSelection,
      textSelectionTimestamp: textSelection?.timestamp,
      mockupSelection,
      mockupDrawing,
    };
  }, []);

  const handleToggleSidebar = useCallback(() => {
    toggleSidebar(workstreamId);
  }, [workstreamId, toggleSidebar]);

  // Archive dialog handler
  const handleShowArchiveDialog = useCallback(async () => {
    if (!sessionWorktreeId || !worktreePath) return;
    const autoArchived = await showArchiveDialog({
      worktreeId: sessionWorktreeId,
      worktreeName: getWorktreeNameFromPath(worktreePath, 'worktree'),
      worktreePath,
      workspacePath,
    });
    if (autoArchived) {
      onWorktreeArchived?.();
    }
  }, [sessionWorktreeId, worktreePath, showArchiveDialog, workspacePath, onWorktreeArchived]);

  const handleConfirmArchive = useCallback(async () => {
    await confirmArchive(workspacePath, onWorktreeArchived);
  }, [workspacePath, onWorktreeArchived, confirmArchive]);

  // Get terminal list for checking existing terminals
  const terminals = useAtomValue(terminalListAtom);

  // Open a terminal in the worktree directory (reuses existing if available)
  const handleOpenTerminal = useCallback(async () => {
    if (!sessionWorktreeId || !worktreePath) return;

    // Check if there's already a terminal for this worktree
    const existingTerminal = terminals.find(t => t.worktreeId === sessionWorktreeId);
    if (existingTerminal) {
      // Reuse existing terminal - activate it and show panel
      setActiveTerminal(existingTerminal.id);
      await window.electronAPI.terminal.setActive(workspacePath, existingTerminal.id);
      window.dispatchEvent(new CustomEvent('terminal:show'));
      // Dispatch event to trigger focus animation on the terminal tab
      window.dispatchEvent(new CustomEvent('terminal:focused', {
        detail: { terminalId: existingTerminal.id }
      }));
      return;
    }

    // No existing terminal, create a new one
    try {
      const result = await window.electronAPI.terminal.create(workspacePath, {
        cwd: worktreePath,
        worktreeId: sessionWorktreeId,
        title: `Terminal (${getWorktreeNameFromPath(worktreePath)})`,
        source: 'worktree',
      });

      if (result.success && result.terminalId) {
        // Dispatch event to notify TerminalBottomPanel about the new terminal
        window.dispatchEvent(new CustomEvent('terminal:created', {
          detail: { terminalId: result.terminalId }
        }));
        // Dispatch event to notify App.tsx to show terminal panel
        window.dispatchEvent(new CustomEvent('terminal:show'));
      }
    } catch (error) {
      console.error('[AgentWorkstreamPanel] Failed to create terminal:', error);
    }
  }, [workspacePath, sessionWorktreeId, worktreePath, terminals]);

  // Create a new terminal (for right-click context menu)
  const handleCreateNewTerminal = useCallback(async () => {
    if (!sessionWorktreeId || !worktreePath) return;

    try {
      const result = await window.electronAPI.terminal.create(workspacePath, {
        cwd: worktreePath,
        worktreeId: sessionWorktreeId,
        title: `Terminal (${getWorktreeNameFromPath(worktreePath)})`,
        source: 'worktree',
      });

      if (result.success && result.terminalId) {
        window.dispatchEvent(new CustomEvent('terminal:created', {
          detail: { terminalId: result.terminalId }
        }));
        window.dispatchEvent(new CustomEvent('terminal:show'));
      }
    } catch (error) {
      console.error('[AgentWorkstreamPanel] Failed to create terminal:', error);
    }
  }, [workspacePath, sessionWorktreeId, worktreePath]);

  // Determine what to show based on layout mode
  // Editor tabs are shown in editor and split modes, but wait for worktree path to resolve
  // before rendering (TabContent captures workspaceId permanently on first render)
  const worktreePathReady = !sessionWorktreeId || worktreePath;
  const showEditorTabs = (layoutMode === 'split' || layoutMode === 'editor') && worktreePathReady;
  // Session tabs are always shown - in editor mode, the transcript is collapsed but tabs + input remain visible
  const showSessionTabs = true;
  // Collapse the transcript content (hide messages) when in editor mode
  const collapseTranscript = layoutMode === 'editor';

  // Open pending file once editor mounts after layout mode change
  useEffect(() => {
    if (pendingFileOpenRef.current && showEditorTabs && editorTabsRef.current) {
      editorTabsRef.current.openFile(pendingFileOpenRef.current);
      pendingFileOpenRef.current = null;
    }
  }, [showEditorTabs]); // Re-run when editor becomes visible

  // Vertical resizer (between editor and session) - uses split ratio like AISessionView
  const handleVerticalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingVertical(true);

    const container = contentRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerHeight = containerRect.height;
    const startY = e.clientY;
    const startRatio = splitRatio;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const currentHeight = startRatio * containerHeight;
      const newHeight = currentHeight + deltaY;
      const newRatio = newHeight / containerHeight;

      // Clamp between 10% and 90%
      const clampedRatio = Math.max(0.1, Math.min(0.9, newRatio));
      setSplitRatio({ workstreamId, ratio: clampedRatio });
    };

    const handleMouseUp = () => {
      setIsDraggingVertical(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [workstreamId, splitRatio, setSplitRatio]);

  // Sidebar resizer (between content and sidebar)
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSidebar(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = startWidth + deltaX;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth, setSidebarWidth]);

  // Track which panel was last clicked to route CMD+F correctly.
  // document.activeElement is unreliable because clicking tab bars, non-focusable
  // areas, or scrolling in the editor area doesn't necessarily move activeElement
  // into that area. mousedown on the panel container is a reliable proxy.
  useEffect(() => {
    const editorArea = editorAreaRef.current;
    const sessionArea = sessionAreaRef.current;

    const handleEditorClick = () => { lastFocusedPanelRef.current = 'editor'; };
    const handleSessionClick = () => { lastFocusedPanelRef.current = 'session'; };

    editorArea?.addEventListener('mousedown', handleEditorClick, true);
    sessionArea?.addEventListener('mousedown', handleSessionClick, true);

    return () => {
      editorArea?.removeEventListener('mousedown', handleEditorClick, true);
      sessionArea?.removeEventListener('mousedown', handleSessionClick, true);
    };
  }, [showEditorTabs, showSessionTabs]);

  // Trigger find in the active editor. Two strategies based on editor type:
  // - Monaco: dispatch synthetic Cmd+F keydown to its internal textarea, which
  //   Monaco's keybinding system processes to open its built-in find widget.
  // - Lexical: use SearchReplaceStateManager.toggle() directly (same as Files mode).
  //   We can't use synthetic keydown because Lexical's SearchReplacePlugin checks
  //   isEditorActive (based on React state), which won't be true synchronously
  //   after focusing the contenteditable.
  const triggerEditorFind = useCallback(() => {
    const editorArea = editorAreaRef.current;
    if (!editorArea) {
      console.log('[AgentWorkstreamPanel] triggerEditorFind: no editorArea ref');
      return;
    }

    const monacoTextarea = editorArea.querySelector<HTMLTextAreaElement>('.monaco-editor .inputarea textarea');

    if (monacoTextarea) {
      console.log('[AgentWorkstreamPanel] triggerEditorFind: dispatching to Monaco textarea');
      monacoTextarea.focus();
      monacoTextarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'f', code: 'KeyF', metaKey: true,
        bubbles: true, cancelable: true,
      }));
    } else {
      // Lexical or other editor - use SearchReplaceStateManager
      const activeFilePath = editorTabsRef.current?.getActiveFilePath();
      if (activeFilePath) {
        console.log('[AgentWorkstreamPanel] triggerEditorFind: toggling SearchReplaceStateManager for', activeFilePath);
        SearchReplaceStateManager.toggle(activeFilePath);
      } else {
        console.log('[AgentWorkstreamPanel] triggerEditorFind: no active file path');
      }
    }
  }, []);

  // Dispatch find-next/find-prev keyboard events to the active editor.
  // These only work when the editor already has focus (find dialog is open).
  const dispatchEditorKeyEvent = useCallback((key: string, code: string, meta: boolean, shift = false) => {
    const editorArea = editorAreaRef.current;
    if (!editorArea) return;

    const monacoTextarea = editorArea.querySelector<HTMLTextAreaElement>('.monaco-editor .inputarea textarea');
    const target = monacoTextarea || document;

    target.dispatchEvent(new KeyboardEvent('keydown', {
      key, code, metaKey: meta, shiftKey: shift,
      bubbles: true, cancelable: true,
    }));
  }, []);

  // Handle CMD+F routing based on which panel was last interacted with.
  // Editor panel: triggerEditorFind handles Monaco vs Lexical differently.
  // Session panel: dispatch transcript:find CustomEvent.
  useEffect(() => {
    const handleFind = () => {
      const activeFilePath = editorTabsRef.current?.getActiveFilePath();
      const editorIsTarget = lastFocusedPanelRef.current === 'editor' && activeFilePath;

      console.log('[AgentWorkstreamPanel] handleFind: lastFocusedPanel=' + lastFocusedPanelRef.current +
        ' activeFilePath=' + activeFilePath + ' activeSessionId=' + activeSessionId);

      if (editorIsTarget) {
        triggerEditorFind();
      } else if (activeSessionId) {
        window.dispatchEvent(new CustomEvent('transcript:find', {
          detail: { sessionId: activeSessionId }
        }));
      }
    };

    const handleFindNext = () => {
      if (lastFocusedPanelRef.current === 'editor' && editorTabsRef.current?.getActiveFilePath()) {
        dispatchEditorKeyEvent('g', 'KeyG', true);
      } else if (activeSessionId) {
        window.dispatchEvent(new CustomEvent('transcript:find-next', {
          detail: { sessionId: activeSessionId }
        }));
      }
    };

    const handleFindPrevious = () => {
      if (lastFocusedPanelRef.current === 'editor' && editorTabsRef.current?.getActiveFilePath()) {
        dispatchEditorKeyEvent('g', 'KeyG', true, true);
      }
    };

    window.addEventListener('menu:find', handleFind);
    window.addEventListener('menu:find-next', handleFindNext);
    window.addEventListener('menu:find-previous', handleFindPrevious);

    return () => {
      window.removeEventListener('menu:find', handleFind);
      window.removeEventListener('menu:find-next', handleFindNext);
      window.removeEventListener('menu:find-previous', handleFindPrevious);
    };
  }, [activeSessionId, triggerEditorFind, dispatchEditorKeyEvent]);

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    closeActiveTab: () => {
      // Only close editor tabs if the editor panel was last focused
      if (lastFocusedPanelRef.current === 'editor' && editorTabsRef.current) {
        editorTabsRef.current.closeActiveTab();
      }
      // If transcript has focus, do nothing - we don't want to close AI sessions with CMD+W
    }
  }), []);

  return (
    <div
      className={agentWorkstreamPanelClass}
      data-active-session-id={activeSessionId ?? ''}
      data-agent-elements-shell="agent-workstream-panel"
      data-component="AgentWorkstreamPanel"
      data-layout-mode={layoutMode}
      data-sidebar-visible={String(sidebarVisible)}
      data-testid="agent-elements-agent-workstream-panel"
      data-workspace-path={workspacePath}
      data-workstream-id={workstreamId}
      data-workstream-type={workstreamType}
      data-worktree-id={sessionWorktreeId ?? ''}
      data-worktree-path={worktreePath ?? ''}
    >
      {/* Main column - header + content */}
      <div
        className={agentWorkstreamMainClass}
        data-agent-elements-shell="agent-workstream-main"
        data-testid="agent-elements-agent-workstream-main"
      >
        <WorkstreamHeader
          workstreamId={workstreamId}
          workspacePath={workspacePath}
          worktreeId={sessionWorktreeId}
          worktreePath={worktreePath}
          onToggleSidebar={handleToggleSidebar}
          sidebarVisible={sidebarVisible}
          onOpenTerminal={sessionWorktreeId ? handleOpenTerminal : undefined}
          onCreateNewTerminal={sessionWorktreeId ? handleCreateNewTerminal : undefined}
          onShowArchiveDialog={sessionWorktreeId ? handleShowArchiveDialog : undefined}
          onArchiveStatusChange={onWorktreeArchived}
        />

        <div
          ref={contentRef}
          className={agentWorkstreamContentClass}
          data-agent-elements-shell="agent-workstream-content"
          data-testid="agent-elements-agent-workstream-content"
        >
          {/* Editor tabs for the entire workstream */}
          {showEditorTabs && (
            <div
              ref={editorAreaRef}
              className={`${agentWorkstreamEditorAreaClass} ${layoutMode === 'editor' ? 'maximized flex-1 border-b-0' : ''}`}
              data-agent-elements-shell="agent-workstream-editor-area"
              data-layout-mode={layoutMode}
              data-testid="agent-elements-agent-workstream-editor-area"
              style={layoutMode === 'split' ? { height: `${splitRatio * 100}%`, minHeight: '100px' } : undefined}
            >
              <WorkstreamEditorTabs
                key={workstreamId}
                ref={editorTabsRef}
                workstreamId={workstreamId}
                workspacePath={workspacePath}
                basePath={worktreePath || workspacePath}
                isActive={true}
                onSwitchToAgentMode={onSwitchToAgentMode}
                onOpenSessionInChat={onOpenSessionInChat}
              />
            </div>
          )}

          {/* Vertical resizer between editor and session */}
          {layoutMode === 'split' && (
            <div
              className={`agent-workstream-vertical-resizer h-1 cursor-ns-resize ${resizerClass} ${isDraggingVertical ? resizerDraggingClass : ''}`}
              data-agent-elements-shell="agent-workstream-vertical-resizer"
              data-testid="agent-elements-agent-workstream-vertical-resizer"
              onMouseDown={handleVerticalResizeStart}
            />
          )}

          {/* Session tabs + active session panel */}
          {showSessionTabs && (
            <div
              ref={sessionAreaRef}
              className={`${agentWorkstreamSessionAreaClass} ${collapseTranscript ? 'shrink-0' : 'flex-1 min-h-0'} ${layoutMode === 'transcript' ? 'maximized' : ''}`}
              data-agent-elements-shell="agent-workstream-session-area"
              data-collapse-transcript={String(collapseTranscript)}
              data-testid="agent-elements-agent-workstream-session-area"
            >
              <WorkstreamSessionTabs
                workspacePath={workspacePath}
                workstreamId={workstreamId}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSessionSelect={handleSessionSelect}
                onFileClick={handleFileClick}
                worktreeId={sessionWorktreeId}
                onAddSessionToWorktree={onAddSessionToWorktree}
                onCreateWorktreeSession={onCreateWorktreeSession}
                onSessionArchive={handleSessionArchive}
                onSessionUnarchive={handleSessionUnarchive}
                onSessionRename={handleSessionRename}
                getDocumentContext={getDocumentContext}
                collapseTranscript={collapseTranscript}
              />
            </div>
          )}
        </div>
      </div>

      {/* Sidebar resizer */}
      {sidebarVisible && activeSessionId && (
        <div
          className={`agent-workstream-sidebar-resizer w-1 cursor-ew-resize ${resizerClass} ${isDraggingSidebar ? resizerDraggingClass : ''}`}
          data-agent-elements-shell="agent-workstream-sidebar-resizer"
          data-testid="agent-elements-agent-workstream-sidebar-resizer"
          onMouseDown={handleSidebarResizeStart}
        />
      )}

      {/* Files edited sidebar - full height on the right, sibling of main column */}
      {sidebarVisible && (
        <FilesEditedSidebar
          workstreamId={workstreamId}
          activeSessionId={activeSessionId}
          workspacePath={workspacePath}
          onFileClick={handleFileClick}
          onOpenInFilesMode={onFileOpen}
          width={sidebarWidth}
          worktreeId={sessionWorktreeId}
          worktreePath={worktreePath}
          onWorktreeArchived={onWorktreeArchived}
          isGitRepo={isGitRepo}
        />
      )}

      {/* Archive worktree confirmation dialog */}
      {archiveDialogState && (
        <ArchiveWorktreeDialog
          worktreeName={archiveDialogState.worktreeName}
          onArchive={handleConfirmArchive}
          onKeep={closeArchiveDialog}
          hasUncommittedChanges={archiveDialogState.hasUncommittedChanges}
          uncommittedFileCount={archiveDialogState.uncommittedFileCount}
          hasUnmergedChanges={archiveDialogState.hasUnmergedChanges}
          unmergedCommitCount={archiveDialogState.unmergedCommitCount}
        />
      )}
    </div>
  );
}));

AgentWorkstreamPanel.displayName = 'AgentWorkstreamPanel';
