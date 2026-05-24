/**
 * ChatSidebar - Lightweight chat panel for files mode sidebar.
 *
 * This is the replacement for AIChat/AgenticPanel when used in chat mode.
 * It renders a single session tied to the current document context.
 * Supports resizable width and collapse/expand functionality.
 */

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { ModelIdentifier } from '@nimbalyst/runtime/ai/server/types';
import { SessionTranscript, SessionTranscriptRef } from '../UnifiedAI/SessionTranscript';
import { SessionDropdown } from '../AIChat/SessionDropdown';
import {
  sessionListChatAtom,
  refreshSessionListAtom,
  initSessionList,
} from '../../store';
import { defaultAgentModelAtom } from '../../store/atoms/appSettings';
import type { SerializableDocumentContext } from '../../hooks/useDocumentContext';

const chatSidebarShellClass = 'chat-sidebar agent-elements-chat-sidebar agent-elements-tool-card flex h-full flex-col overflow-hidden border-l border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)]';
const chatSidebarCenteredClass = `${chatSidebarShellClass} relative items-center justify-center text-[var(--an-foreground-muted)]`;

export interface ChatSidebarRef {
  focusInput: () => void;
  loadSession: (sessionId: string) => void;
}

export interface ChatSidebarProps {
  workspacePath: string;
  /** Whether the parent mode/panel is actively visible */
  isActive?: boolean;
  documentContext?: SerializableDocumentContext;
  /** Getter function for document context - async, reads from disk */
  getDocumentContext?: () => Promise<SerializableDocumentContext>;
  onFileOpen?: (filePath: string) => Promise<void>;
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
  /** Callback when collapse state should toggle */
  onToggleCollapse?: () => void;
  /** Current width of the sidebar */
  width?: number;
  /** Callback when width changes (during resize) */
  onWidthChange?: (width: number) => void;
  /** Callback to switch to agent mode, optionally opening a specific session */
  onSwitchToAgentMode?: (sessionId?: string) => void;
}

export const ChatSidebar = forwardRef<ChatSidebarRef, ChatSidebarProps>(({
  workspacePath,
  isActive = true,
  documentContext,
  getDocumentContext,
  onFileOpen,
  isCollapsed = false,
  onToggleCollapse,
  width = 350,
  onWidthChange,
  onSwitchToAgentMode,
}, ref) => {
  const transcriptRef = useRef<SessionTranscriptRef>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const isInitializingRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Session list from Jotai - filtered for chat mode (no worktrees, no workstream parents)
  const sessionList = useAtomValue(sessionListChatAtom);
  const refreshSessions = useSetAtom(refreshSessionListAtom);

  // Default model for new sessions (user's last selected model)
  const defaultModel = useAtomValue(defaultAgentModelAtom);

  // Convert to format expected by SessionDropdown
  const availableSessions = useMemo(() => {
    return sessionList.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      name: s.title,
      title: s.title,
      messageCount: s.messageCount || 0,
      provider: s.provider,
      model: s.model,
    }));
  }, [sessionList]);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      transcriptRef.current?.focusInput();
    },
    loadSession: (id: string) => {
      setSessionId(id);
    },
  }), []);

  // Initialize session list on mount
  useEffect(() => {
    if (!isActive) return;
    initSessionList(workspacePath);
  }, [isActive, workspacePath]);

  // Initialize session - select most recent or create new if none exist
  // CRITICAL: Only runs once on mount to avoid creating duplicate sessions
  useEffect(() => {
    if (!isActive) {
      setIsLoading(false);
      return;
    }

    const initSession = async () => {
      // Prevent concurrent initialization
      if (isInitializingRef.current) {
        return;
      }
      isInitializingRef.current = true;

      try {
        setIsLoading(true);

        // Wait for session list to load (it's initialized in parallel above)
        // We need to give the session list time to populate
        await new Promise(resolve => setTimeout(resolve, 100));

        // Re-read session list after waiting
        const sessions = await window.electronAPI.invoke('sessions:list', workspacePath, {
          includeArchived: false,
        });

        if (sessions.success && Array.isArray(sessions.sessions)) {
          // Filter for chat sessions (no worktrees, no workstream parents)
          const chatSessions = sessions.sessions.filter((s: any) => {
            if (s.worktreeId) return false;
            if (s.childCount && s.childCount > 0) return false;
            return true;
          });

          // If we have existing chat sessions, use the most recent one
          if (chatSessions.length > 0) {
            setSessionId(chatSessions[0].id);
            setIsLoading(false);
            return;
          }
        }

        // No chat sessions exist - create a new one
        const newSessionId = crypto.randomUUID();
        // Parse provider from defaultModel using ModelIdentifier
        const modelId = defaultModel ? ModelIdentifier.tryParse(defaultModel) : null;
        const provider = modelId?.provider || 'claude-code';
        const result = await window.electronAPI.invoke(
          'sessions:create',
          {
            session: {
              id: newSessionId,
              provider,
              model: defaultModel,
              title: 'New Session',
            },
            workspaceId: workspacePath,
          }
        );
        if (result?.success) {
          setSessionId(newSessionId);
          // Refresh the session list to include the new session
          refreshSessions();
        }
      } catch (err) {
        console.error('[ChatSidebar] Failed to init session:', err);
      } finally {
        setIsLoading(false);
        isInitializingRef.current = false;
      }
    };

    initSession();
    // CRITICAL: Only run once on mount - workspacePath changes trigger full remount anyway
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, workspacePath]);

  const handleFileClick = useCallback(async (filePath: string) => {
    if (onFileOpen) {
      await onFileOpen(filePath);
    }
  }, [onFileOpen]);

  const handleSessionSelect = useCallback((selectedSessionId: string) => {
    setSessionId(selectedSessionId);
  }, []);

  const handleNewSession = useCallback(async () => {
    const newSessionId = crypto.randomUUID();
    // Parse provider from defaultModel using ModelIdentifier
    const modelId = defaultModel ? ModelIdentifier.tryParse(defaultModel) : null;
    const provider = modelId?.provider || 'claude-code';
    const result = await window.electronAPI.invoke(
      'sessions:create',
      {
        session: {
          id: newSessionId,
          provider,
          model: defaultModel,
          title: 'Chat',
        },
        workspaceId: workspacePath,
      }
    );
    if (result?.success) {
      setSessionId(newSessionId);
      refreshSessions();
    }
  }, [workspacePath, refreshSessions, defaultModel]);

  const handleDeleteSession = useCallback(async (sessionIdToDelete: string) => {
    await window.electronAPI.invoke('session:delete', sessionIdToDelete);
    refreshSessions();
    // If we deleted the current session, switch to another or create new
    if (sessionIdToDelete === sessionId) {
      const remaining = sessionList.filter(s => s.id !== sessionIdToDelete);
      if (remaining.length > 0) {
        setSessionId(remaining[0].id);
      } else {
        handleNewSession();
      }
    }
  }, [workspacePath, sessionId, sessionList, refreshSessions, handleNewSession]);

  const handleRenameSession = useCallback(async (sessionIdToRename: string, newName: string) => {
    await window.electronAPI.invoke('sessions:update-title', sessionIdToRename, newName);
    refreshSessions();
  }, [workspacePath, refreshSessions]);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onWidthChange) return;
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onWidthChange]);

  useEffect(() => {
    if (!onWidthChange) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      // Calculate new width from right edge
      const newWidth = window.innerWidth - e.clientX;
      // Allow up to 50% of window width, with minimum of 280px
      const maxWidth = Math.floor(window.innerWidth * 0.5);
      const clampedWidth = Math.min(Math.max(280, newWidth), maxWidth);
      onWidthChange(clampedWidth);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;

      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onWidthChange]);

  // When collapsed, render nothing (toggle button is in the title bar)
  if (isCollapsed || !isActive) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className={`chat-sidebar-loading agent-elements-chat-sidebar-loading ${chatSidebarCenteredClass}`}
        style={{ width: onWidthChange ? width : undefined }}
        data-session-id={sessionId}
        data-component="ChatSidebar"
        data-agent-elements-shell="chat-sidebar-loading"
      >
        <div
          className="chat-sidebar-spinner h-6 w-6 animate-spin rounded-full border-2 border-[var(--an-border-color)] border-t-[var(--an-primary-color)]"
          data-agent-elements-shell="chat-sidebar-spinner"
        />
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div
        className={`chat-sidebar-error agent-elements-chat-sidebar-error ${chatSidebarCenteredClass}`}
        style={{ width: onWidthChange ? width : undefined }}
        data-session-id={sessionId}
        data-component="ChatSidebar"
        data-agent-elements-shell="chat-sidebar-error"
      >
        <p>Failed to load chat session</p>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`${chatSidebarShellClass} relative`}
      style={{ width: onWidthChange ? width : undefined }}
      data-testid="chat-sidebar-panel"
      data-session-id={sessionId}
      data-component="ChatSidebar"
      data-agent-elements-shell="chat-sidebar"
    >
      {onWidthChange && (
        <div
          className="chat-sidebar-resize-handle agent-elements-chat-sidebar-resize absolute -left-0.5 bottom-0 top-0 z-10 w-[5px] cursor-col-resize before:absolute before:bottom-0 before:left-0.5 before:top-0 before:w-0.5 before:bg-[var(--an-border-color)] before:content-[''] hover:before:bg-[var(--an-primary-color)]"
          onMouseDown={handleMouseDown}
          data-agent-elements-shell="chat-sidebar-resize"
        />
      )}

      {/* Header with session dropdown */}
      <div
        className="chat-sidebar-header agent-elements-chat-sidebar-header flex shrink-0 items-center justify-between gap-2 border-b border-[var(--an-border-color)] bg-[var(--an-background)] p-2"
        data-testid="agent-elements-chat-sidebar-header"
        data-agent-elements-shell="chat-sidebar-header"
      >
        <SessionDropdown
          currentSessionId={sessionId}
          sessions={availableSessions}
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onOpenSessionManager={onSwitchToAgentMode}
        />
        <div
          className="agent-elements-chat-sidebar-actions flex items-center gap-1"
          data-agent-elements-shell="chat-sidebar-actions"
        >
          {onSwitchToAgentMode && (
            <button
              className="chat-sidebar-maximize-button agent-elements-chat-sidebar-action flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--an-small-border-radius)] border border-transparent bg-transparent text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
              onClick={() => onSwitchToAgentMode(sessionId ?? undefined)}
              title="Open in agent mode"
              aria-label="Open in agent mode"
              data-agent-elements-shell="chat-sidebar-open-agent-mode"
            >
              <MaterialSymbol icon="zoom_out_map" size={16} />
            </button>
          )}
          <button
            className="chat-sidebar-new-button agent-elements-chat-sidebar-new-button flex cursor-pointer items-center gap-1 rounded-[var(--an-small-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--an-background)] transition-[background-color,border-color,opacity] duration-150 ease-out hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleNewSession}
            title="Start new conversation"
            aria-label="Start new conversation"
            data-agent-elements-shell="chat-sidebar-new-session"
          >
            <MaterialSymbol icon="add" size={16} />
            New
          </button>
        </div>
      </div>

      <SessionTranscript
        key={sessionId}
        ref={transcriptRef}
        sessionId={sessionId}
        workspacePath={workspacePath}
        mode="chat"
        hideSidebar={true}
        onFileClick={handleFileClick}
        onClearSession={handleNewSession}
        documentContext={documentContext}
        getDocumentContext={getDocumentContext}
      />
    </div>
  );
});

ChatSidebar.displayName = 'ChatSidebar';
