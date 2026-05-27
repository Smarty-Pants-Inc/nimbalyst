/**
 * WorkstreamSessionTabs - Manages session tabs + displays active session panel.
 *
 * This component sits at the bottom of the workstream panel (below editor tabs).
 * It contains:
 * - SessionTabBar: horizontal tabs for all sessions in the workstream (always visible)
 * - AgentSessionPanel: the active session's content
 *
 * The tab bar is always shown - even for single sessions - so the user can see
 * which session is active and use the "+" button to add more sessions.
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol, ProviderIcon } from '@nimbalyst/runtime';
import { store } from '@nimbalyst/runtime/store';
import { sessionArchivedAtom, sessionRegistryAtom } from '../../store/atoms/sessions';
import { AgentSessionPanel } from './AgentSessionPanel';
import {
  sessionTitleAtom,
  sessionProviderAtom,
  sessionProcessingAtom,
  sessionUnreadAtom,
  createChildSessionAtom,
} from '../../store';
import { defaultAgentModelAtom } from '../../store/atoms/appSettings';
import { convertToWorkstreamAtom } from '../../store/atoms/sessions';
import { workstreamHasChildrenAtom } from '../../store/atoms/workstreamState';
import { SessionContextMenu } from '../AgenticCoding/SessionContextMenu';
import type { SerializableDocumentContext } from '../../hooks/useDocumentContext';

const emptyStateClass = [
  'workstream-session-tabs-empty',
  'agent-elements-workstream-session-tabs-empty',
  'flex h-full items-center justify-center bg-[var(--an-background-secondary)]',
  'px-[var(--an-spacing-lg)] text-sm text-[var(--an-foreground-muted)]',
].join(' ');

const rootClass = [
  'workstream-session-tabs',
  'agent-elements-workstream-session-tabs',
  'flex flex-col overflow-hidden bg-[var(--an-background)] text-[var(--an-foreground)]',
  '[container-type:inline-size]',
].join(' ');

const tabBarClass = [
  'session-tab-bar',
  'agent-elements-workstream-session-tab-bar',
  'flex shrink-0 flex-wrap items-center gap-[var(--an-spacing-xxs)]',
  'border-b border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)]',
  'px-[var(--an-spacing-lg)] py-[var(--an-spacing-xs)]',
].join(' ');

const sessionTabBaseClass = [
  'session-tab',
  'agent-elements-session-tab',
  'flex max-w-[190px] cursor-pointer items-center gap-[var(--an-spacing-xs)] whitespace-nowrap',
  'rounded-[var(--an-input-border-radius)] border border-transparent',
  'px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-xs font-medium leading-none',
  'outline-none transition-[background-color,border-color,color,opacity] duration-150 ease-out',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const sessionTabActiveClass = [
  'active',
  'border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)]',
].join(' ');

const sessionTabInactiveClass = [
  'bg-transparent text-[var(--an-foreground-muted)]',
  'hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
].join(' ');

const processingDotClass = [
  'session-tab-processing-dot',
  'h-1.5 w-1.5 shrink-0 rounded-[999px] bg-[var(--an-primary-color)]',
  'animate-pulse',
].join(' ');

const unreadDotClass = [
  'session-tab-unread-dot',
  'h-1.5 w-1.5 shrink-0 rounded-[999px] bg-[var(--an-warning)]',
].join(' ');

const renameInputClass = [
  'session-tab-rename-input',
  'agent-elements-session-tab-rename-input',
  'w-full max-w-[150px] rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)]',
  'bg-[var(--an-background)] px-[var(--an-spacing-xs)] py-0 text-xs font-medium',
  'text-[var(--an-foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const newSessionButtonClass = [
  'session-tab-new',
  'agent-elements-new-session-tab-button',
  'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center',
  'rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent text-[var(--an-foreground-subtle)]',
  'outline-none transition-[background-color,border-color,color] duration-150 ease-out',
  'hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground-muted)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
  'active:bg-[var(--an-background)]',
].join(' ');

const contentClass = [
  'workstream-session-tabs-content',
  'agent-elements-workstream-session-tabs-content',
  'overflow-hidden bg-[var(--an-background)]',
].join(' ');

export interface WorkstreamSessionTabsProps {
  workspacePath: string;
  workstreamId: string;
  sessions: string[]; // Array of session IDs
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onFileClick?: (filePath: string) => void;
  worktreeId?: string | null; // If set, this is a worktree session (add sessions to worktree, not convert to workstream)
  onAddSessionToWorktree?: (worktreeId: string) => Promise<void>; // Callback to add session to worktree
  onCreateWorktreeSession?: (worktreeId: string) => Promise<string | null>; // Callback to create session in worktree (returns session ID)
  onSessionArchive?: (sessionId: string) => void; // Callback to archive a session
  onSessionUnarchive?: (sessionId: string) => void; // Callback to unarchive a session
  onSessionRename?: (sessionId: string, newName: string) => void; // Callback to rename a session
  /** Getter for document context from the workstream editor (for AI file/selection context) */
  getDocumentContext?: () => Promise<SerializableDocumentContext>;
  /** When true, collapse the transcript but keep tab bar and AI input visible */
  collapseTranscript?: boolean;
}

/**
 * Individual session tab - subscribes to atoms for isolated re-renders.
 */
const SessionTab: React.FC<{
  sessionId: string;
  isActive: boolean;
  onClick: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onRename?: (newName: string) => void;
}> = React.memo(({ sessionId, isActive, onClick, onArchive, onUnarchive, onRename }) => {
  const title = useAtomValue(sessionTitleAtom(sessionId));
  const provider = useAtomValue(sessionProviderAtom(sessionId));
  const isProcessing = useAtomValue(sessionProcessingAtom(sessionId));
  const hasUnread = useAtomValue(sessionUnreadAtom(sessionId));
  const isArchived = useAtomValue(sessionArchivedAtom(sessionId));

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  const handleRenameSubmit = useCallback(() => {
    const trimmedValue = renameValue.trim();
    if (trimmedValue && trimmedValue !== title && onRename) {
      onRename(trimmedValue);
    }
    setIsRenaming(false);
  }, [renameValue, title, onRename]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsRenaming(false);
    }
  }, [handleRenameSubmit]);

  // Focus and select input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  return (
    <div className="relative">
      <button
        className={`${sessionTabBaseClass} ${isActive ? sessionTabActiveClass : sessionTabInactiveClass} ${hasUnread ? 'unread' : ''} ${isArchived ? 'opacity-60' : ''}`}
        data-active={isActive ? 'true' : 'false'}
        data-archived={isArchived ? 'true' : 'false'}
        data-component="SessionTab"
        data-processing={isProcessing ? 'true' : 'false'}
        data-testid={`agent-elements-session-tab-${sessionId}`}
        data-unread={hasUnread ? 'true' : 'false'}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        title={title || 'Untitled'}
        type="button"
      >
        {isProcessing && (
          <span
            className={processingDotClass}
            data-testid="agent-elements-session-tab-processing-dot"
          />
        )}
        <ProviderIcon
          provider={provider}
          size={14}
          className={`session-tab-icon shrink-0 ${isActive ? 'opacity-100' : 'opacity-80'}`}
        />
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            className={renameInputClass}
            data-testid="agent-elements-session-tab-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSubmit}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`session-tab-title max-w-[150px] overflow-hidden text-ellipsis ${hasUnread ? 'font-semibold' : ''}`}>
            {title || 'Untitled'}
          </span>
        )}
        {hasUnread && !isRenaming && (
          <span
            className={unreadDotClass}
            data-testid="agent-elements-session-tab-unread-dot"
          />
        )}
      </button>

      {/* Context Menu */}
      {showContextMenu && (
        <SessionContextMenu
          sessionId={sessionId}
          title={title || 'Untitled'}
          position={contextMenuPosition}
          onClose={() => setShowContextMenu(false)}
          isArchived={isArchived}
          onRename={onRename ? () => { setRenameValue(title || ''); setIsRenaming(true); } : undefined}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
        />
      )}
    </div>
  );
});

SessionTab.displayName = 'SessionTab';

/**
 * Session tab bar - always shows session tabs + "+" button.
 * For single sessions, shows the session tab (so user can see what's selected).
 * For multi-session workstreams, shows all tabs.
 */
const SessionTabBar: React.FC<{
  sessions: string[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onSessionArchive?: (sessionId: string) => void;
  onSessionUnarchive?: (sessionId: string) => void;
  onSessionRename?: (sessionId: string, newName: string) => void;
}> = React.memo(({ sessions, activeSessionId, onSessionSelect, onNewSession, onSessionArchive, onSessionUnarchive, onSessionRename }) => {
  // Always show the tab bar - even for single sessions, the user should see their session tab
  return (
    <div
      className={tabBarClass}
      data-agent-elements-shell="workstream-session-tab-bar"
      data-testid="agent-elements-workstream-session-tab-bar"
    >
      {sessions.map((sessionId) => (
        <SessionTab
          key={sessionId}
          sessionId={sessionId}
          isActive={sessionId === activeSessionId}
          onClick={() => onSessionSelect(sessionId)}
          onArchive={onSessionArchive ? () => onSessionArchive(sessionId) : undefined}
          onUnarchive={onSessionUnarchive ? () => onSessionUnarchive(sessionId) : undefined}
          onRename={onSessionRename ? (newName) => onSessionRename(sessionId, newName) : undefined}
        />
      ))}
      <button
        className={newSessionButtonClass}
        data-testid="agent-elements-new-session-tab-button"
        onClick={onNewSession}
        title="New session in workstream"
        type="button"
      >
        <MaterialSymbol icon="add" size={16} />
      </button>
    </div>
  );
});

SessionTabBar.displayName = 'SessionTabBar';

/**
 * WorkstreamSessionTabs manages both the tab bar and the active session panel.
 */
export const WorkstreamSessionTabs: React.FC<WorkstreamSessionTabsProps> = React.memo(({
  workspacePath,
  workstreamId,
  sessions,
  activeSessionId,
  onSessionSelect,
  onFileClick,
  worktreeId,
  onAddSessionToWorktree,
  onCreateWorktreeSession,
  onSessionArchive,
  onSessionUnarchive,
  onSessionRename,
  getDocumentContext,
  collapseTranscript = false,
}) => {
  const hasChildren = useAtomValue(workstreamHasChildrenAtom(workstreamId));
  const createChildSession = useSetAtom(createChildSessionAtom);
  const convertToWorkstream = useSetAtom(convertToWorkstreamAtom);
  const defaultModel = useAtomValue(defaultAgentModelAtom);

  // Handle creating a new child session
  const handleNewSession = useCallback(async () => {
    // If this is a worktree, use the callback to add a session to it
    if (worktreeId && onAddSessionToWorktree) {
      await onAddSessionToWorktree(worktreeId);
      return;
    }

    // Resolve the actual parent ID - if workstreamId is a child session, use its parent
    const registry = store.get(sessionRegistryAtom);
    const sessionMeta = registry.get(workstreamId);
    const resolvedParentId = sessionMeta?.parentSessionId || workstreamId;

    // Regular workstream logic
    if (hasChildren || resolvedParentId !== workstreamId) {
      // Already a workstream (has children, or we resolved to a parent) - create a child
      await createChildSession({
        parentSessionId: resolvedParentId,
        workspacePath,
        model: defaultModel,
      });
    } else {
      // Single session - convert to workstream first
      await convertToWorkstream({
        sessionId: workstreamId,
        workspacePath,
        model: defaultModel,
      });
    }
  }, [workstreamId, workspacePath, hasChildren, worktreeId, onAddSessionToWorktree, createChildSession, convertToWorkstream, defaultModel]);

  if (!activeSessionId) {
    return (
      <div
        className={emptyStateClass}
        data-agent-elements-shell="workstream-session-tabs-empty"
        data-component="WorkstreamSessionTabs"
        data-testid="agent-elements-workstream-session-tabs-empty"
      >
        <p>Loading sessions...</p>
      </div>
    );
  }

  return (
    <div
      className={`${rootClass} ${collapseTranscript ? '' : 'h-full'}`}
      data-active-session-id={activeSessionId}
      data-agent-elements-shell="workstream-session-tabs"
      data-component="WorkstreamSessionTabs"
      data-session-count={sessions.length}
      data-testid="agent-elements-workstream-session-tabs"
    >
      <SessionTabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSessionSelect={onSessionSelect}
        onNewSession={handleNewSession}
        onSessionArchive={onSessionArchive}
        onSessionUnarchive={onSessionUnarchive}
        onSessionRename={onSessionRename}
      />

      <div
        className={`${contentClass} ${collapseTranscript ? '' : 'min-h-0 flex-1'}`}
        data-agent-elements-shell="workstream-session-tabs-content"
        data-testid="agent-elements-workstream-session-tabs-content"
      >
        <AgentSessionPanel
          key={activeSessionId}
          sessionId={activeSessionId}
          workspacePath={workspacePath}
          onFileClick={onFileClick}
          onClearAgentSession={handleNewSession}
          onCreateWorktreeSession={onCreateWorktreeSession}
          getDocumentContext={getDocumentContext}
          collapseTranscript={collapseTranscript}
        />
      </div>
    </div>
  );
});

WorkstreamSessionTabs.displayName = 'WorkstreamSessionTabs';
