import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ProviderIcon, MaterialSymbol } from '@nimbalyst/runtime';
import { getRelativeTimeString } from '../utils/dateFormatting';
import { sessionOrChildProcessingAtom, sessionUnreadAtom, sessionPendingPromptAtom } from '../store';
import { fileMentionOptionsAtom, searchFileMentionAtom } from '../store/atoms/fileMention';
import type { TypeaheadOption } from './Typeahead/GenericTypeahead';
import { KeyboardShortcuts, getShortcutDisplay } from '../../shared/KeyboardShortcuts';

import type { SessionMeta as SessionItem } from '../store';

/**
 * Status indicator that shows processing, pending prompt, or unread status.
 * Only re-renders when this session's state changes.
 */
const SessionStatusIndicator = memo<{ sessionId: string }>(({ sessionId }) => {
  const isProcessing = useAtomValue(sessionOrChildProcessingAtom(sessionId));
  const hasPendingPrompt = useAtomValue(sessionPendingPromptAtom(sessionId));
  const hasUnread = useAtomValue(sessionUnreadAtom(sessionId));

  // Priority: processing > pending prompt > unread
  if (isProcessing) {
    return (
      <div
        className="session-quick-open-status processing agent-elements-session-quick-open-status flex items-center justify-center w-5 h-5 text-[var(--an-primary-color)] opacity-80"
        title="Processing..."
        data-agent-elements-shell="session-quick-open-status"
        data-status="processing"
      >
        <MaterialSymbol icon="progress_activity" size={14} className="animate-spin" />
      </div>
    );
  }

  if (hasPendingPrompt) {
    return (
      <div
        className="session-quick-open-status pending-prompt agent-elements-session-quick-open-status flex items-center justify-center w-5 h-5 text-[var(--an-warning-color)] animate-pulse"
        title="Waiting for your response"
        data-agent-elements-shell="session-quick-open-status"
        data-status="pending-prompt"
      >
        <MaterialSymbol icon="help" size={14} />
      </div>
    );
  }

  if (hasUnread) {
    return (
      <div
        className="session-quick-open-status unread agent-elements-session-quick-open-status flex items-center justify-center w-5 h-5 text-[var(--an-primary-color)]"
        title="Unread response"
        data-agent-elements-shell="session-quick-open-status"
        data-status="unread"
      >
        <MaterialSymbol icon="circle" size={8} fill />
      </div>
    );
  }

  return null;
});

interface SessionQuickOpenProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  onSessionSelect: (sessionId: string) => void;
  /** Pre-fill the search input when the modal opens (e.g. from File Quick Open or Cmd+Shift+L) */
  initialSearchQuery?: string;
  /** Callback to switch to Prompt Quick Open with the current search text */
  onSwitchToPrompts?: (query: string) => void;
}

export const SessionQuickOpen: React.FC<SessionQuickOpenProps> = ({
  isOpen,
  onClose,
  workspacePath,
  onSessionSelect,
  initialSearchQuery,
  onSwitchToPrompts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allSessions, setAllSessions] = useState<SessionItem[]>([]);
  const [mouseHasMoved, setMouseHasMoved] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLUListElement>(null);

  // @ file search state
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileFilteredSessionIds, setFileFilteredSessionIds] = useState<string[] | null>(null);
  const [typeaheadIndex, setTypeaheadIndex] = useState(0);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Detect @ file search mode
  const isFileSearchMode = searchQuery.startsWith('@');
  const fileSearchQuery = isFileSearchMode ? searchQuery.slice(1) : '';
  const showTypeahead = isFileSearchMode && !selectedFilePath;

  // Subscribe to file mention typeahead options
  const fileOptions = useAtomValue(fileMentionOptionsAtom(workspacePath));
  const searchFileMention = useSetAtom(searchFileMentionAtom);

  // Update file mention search when in typeahead mode
  useEffect(() => {
    if (!isOpen || !showTypeahead) return;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      searchFileMention({ workspacePath, query: fileSearchQuery });
    }, 150);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [isOpen, showTypeahead, fileSearchQuery, workspacePath]);

  // Query sessions by file when a file is selected
  useEffect(() => {
    if (!isOpen || !isFileSearchMode || !selectedFilePath) {
      setFileFilteredSessionIds(null);
      return;
    }

    // Convert relative path to absolute for the IPC call
    const absolutePath = selectedFilePath.startsWith('/')
      ? selectedFilePath
      : `${workspacePath}/${selectedFilePath}`;

    window.electronAPI.invoke('session-files:get-sessions-by-file', workspacePath, absolutePath, 'edited')
      .then((result: { success: boolean; sessionIds: string[] }) => {
        if (result.success) {
          setFileFilteredSessionIds(result.sessionIds);
        } else {
          setFileFilteredSessionIds([]);
        }
      })
      .catch(() => {
        setFileFilteredSessionIds([]);
      });
  }, [isOpen, isFileSearchMode, selectedFilePath, workspacePath]);

  // Handle typeahead file selection
  const handleFileTypeaheadSelect = useCallback((option: TypeaheadOption) => {
    const filePath = (option.data as any)?.path || option.label;
    setSelectedFilePath(filePath);
    setSearchQuery(`@${filePath}`);
    setSelectedIndex(0);
  }, []);

  // Filter sessions: either by file (@ mode) or by title (normal mode)
  const displaySessions = useMemo(() => {
    // File search mode with selected file -- filter by session IDs
    if (isFileSearchMode && selectedFilePath && fileFilteredSessionIds !== null) {
      return allSessions.filter(s => fileFilteredSessionIds.includes(s.id));
    }

    // File search mode but still in typeahead -- show all sessions (typeahead is on top)
    if (isFileSearchMode) {
      return allSessions;
    }

    // Normal title search
    if (!searchQuery.trim()) {
      return allSessions;
    }
    const query = searchQuery.toLowerCase();
    return allSessions.filter(session =>
      (session.title || 'New conversation').toLowerCase().includes(query)
    );
  }, [searchQuery, allSessions, isFileSearchMode, selectedFilePath, fileFilteredSessionIds]);

  // Load all sessions when modal opens
  useEffect(() => {
    if (isOpen && workspacePath) {
      window.electronAPI.invoke('sessions:list', workspacePath, { includeArchived: false })
        .then((result: { success: boolean; sessions: SessionItem[] }) => {
          // console.log('[SessionQuickOpen] sessions:list returned', result.sessions?.length, 'sessions');
          const sessionsWithParent = result.sessions?.filter(s => s.parentSessionId);
          // console.log('[SessionQuickOpen] Sessions with parentSessionId:', sessionsWithParent?.length, sessionsWithParent?.map(s => ({ id: s.id, title: s.title, parent: s.parentSessionId })));
          if (result.success && Array.isArray(result.sessions)) {
            setAllSessions(result.sessions);
          } else {
            setAllSessions([]);
          }
        })
        .catch((error: Error) => {
          console.error('[SessionQuickOpen] Failed to load sessions:', error);
          setAllSessions([]);
        });
    }
  }, [isOpen, workspacePath]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      const query = initialSearchQuery || '';
      setSearchQuery(query);
      setSelectedIndex(0);
      setMouseHasMoved(false);
      setTypeaheadIndex(0);
      // If initialSearchQuery is an @ query with a full path, set it as selected
      if (query.startsWith('@') && query.length > 1) {
        setSelectedFilePath(query.slice(1));
      } else {
        setSelectedFilePath(null);
      }
      setFileFilteredSessionIds(null);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Track mouse movement to distinguish between mouse hover and mouse at rest
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseMove = () => {
      setMouseHasMoved(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsListRef.current) return;

    const items = resultsListRef.current.querySelectorAll('.session-quick-open-item');
    const selectedItem = items[selectedIndex] as HTMLElement;

    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // When typeahead is showing, override arrow/enter to navigate the dropdown
      if (showTypeahead && fileOptions.length > 0) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setTypeaheadIndex(prev =>
              prev < fileOptions.length - 1 ? prev + 1 : prev
            );
            return;
          case 'ArrowUp':
            e.preventDefault();
            setTypeaheadIndex(prev => prev > 0 ? prev - 1 : prev);
            return;
          case 'Enter':
            e.preventDefault();
            if (fileOptions[typeaheadIndex]) {
              handleFileTypeaheadSelect(fileOptions[typeaheadIndex]);
            }
            return;
          case 'Escape':
            e.preventDefault();
            // Clear the @ search and go back to normal mode
            setSearchQuery('');
            setSelectedFilePath(null);
            return;
        }
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < displaySessions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          e.preventDefault();
          if (displaySessions[selectedIndex]) {
            handleSessionSelect(displaySessions[selectedIndex].id);
          }
          break;
        case 'Tab':
          e.preventDefault();
          if (searchQuery && onSwitchToPrompts && !isFileSearchMode) {
            onSwitchToPrompts(searchQuery);
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (isFileSearchMode && selectedFilePath) {
            // Clear file filter, go back to normal mode
            setSearchQuery('');
            setSelectedFilePath(null);
            setFileFilteredSessionIds(null);
          } else {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, displaySessions, onClose, searchQuery, onSwitchToPrompts, showTypeahead, fileOptions, typeaheadIndex, handleFileTypeaheadSelect, isFileSearchMode, selectedFilePath]);

  const handleSessionSelect = (sessionId: string) => {
    // Pass the session ID to the parent handler
    // The AgentMode component will handle loading the session and determining
    // if it's a child session that needs to open its parent workstream
    onSessionSelect(sessionId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="session-quick-open-backdrop agent-elements-session-quick-open-backdrop fixed inset-0 z-[99998] nim-animate-fade-in bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)]"
        onClick={onClose}
        data-testid="agent-elements-session-quick-open-backdrop"
        data-agent-elements-shell="session-quick-open-backdrop"
      />
      <div
        className="session-quick-open-modal agent-elements-session-quick-open agent-elements-tool-card fixed top-[18%] left-1/2 -translate-x-1/2 w-[90vw] max-w-[700px] max-h-[62vh] !gap-0 !p-0 flex flex-col overflow-hidden rounded-[var(--an-border-radius)] z-[99999] bg-[var(--an-background)] border border-[var(--an-border-color)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)]"
        data-testid="agent-elements-session-quick-open"
        data-component="SessionQuickOpen"
        data-agent-elements-shell="session-quick-open"
      >
        <div
          className="session-quick-open-header agent-elements-session-quick-open-header p-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)]"
          data-testid="agent-elements-session-quick-open-header"
          data-agent-elements-shell="session-quick-open-header"
        >
          <div className="session-quick-open-title agent-elements-session-quick-open-title text-[12px] font-medium text-[var(--an-foreground-muted)] mb-2">Sessions</div>
          <div className="relative">
            {isFileSearchMode && selectedFilePath ? (
              <div
                className="session-quick-open-search agent-elements-session-quick-open-input flex items-center gap-2 w-full py-2 px-3 text-sm rounded-[var(--an-input-border-radius)] box-border bg-[var(--an-input-background)] border border-[var(--an-input-border-color)] focus-within:border-[var(--an-input-focus-outline)] focus-within:ring-2 focus-within:ring-[var(--an-input-focus-outline)]"
                data-testid="agent-elements-session-quick-open-input"
                data-agent-elements-shell="session-quick-open-input"
              >
                <span
                  className="session-quick-open-file-chip agent-elements-session-quick-open-file-chip agent-elements-status-pill shrink-0 flex items-center gap-1.5 max-w-[80%] px-2 py-0.5 rounded-[6px] text-[var(--an-primary-color)] text-sm cursor-default"
                  title={selectedFilePath}
                  data-testid="agent-elements-session-quick-open-file-chip"
                  data-agent-elements-shell="session-quick-open-file-chip"
                >
                  <MaterialSymbol icon="description" size={14} className="shrink-0" />
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap direction-rtl text-left">
                    {selectedFilePath}
                  </span>
                  <button
                    className="session-quick-open-clear-file agent-elements-session-quick-open-clear-file shrink-0 flex items-center justify-center w-4 h-4 rounded-full border-none bg-transparent text-[var(--an-foreground-subtle)] hover:text-[var(--an-foreground)] hover:bg-[var(--an-background-tertiary)] cursor-pointer p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedFilePath(null);
                      setFileFilteredSessionIds(null);
                      setTimeout(() => searchInputRef.current?.focus(), 0);
                    }}
                    title="Clear file filter"
                    data-agent-elements-shell="session-quick-open-clear-file"
                  >
                    <MaterialSymbol icon="close" size={12} />
                  </button>
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="session-quick-open-file-filter-input agent-elements-session-quick-open-file-filter-input flex-1 min-w-0 bg-transparent border-none outline-none text-[var(--an-input-color)] text-sm p-0"
                  placeholder="Filter sessions..."
                  value=""
                  readOnly
                  data-agent-elements-shell="session-quick-open-file-filter-input"
                />
              </div>
            ) : (
              <>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="session-quick-open-search agent-elements-session-quick-open-input w-full py-2 px-3 text-sm rounded-[var(--an-input-border-radius)] outline-none box-border bg-[var(--an-input-background)] border border-[var(--an-input-border-color)] text-[var(--an-input-color)] placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                  placeholder="Search sessions... (@ to search by file edited)"
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    setSelectedIndex(0);
                    // If user edits away from the confirmed file path, clear the selection
                    if (selectedFilePath && val !== `@${selectedFilePath}`) {
                      setSelectedFilePath(null);
                      setFileFilteredSessionIds(null);
                    }
                    // Reset typeahead index when typing
                    if (val.startsWith('@')) {
                      setTypeaheadIndex(0);
                    }
                  }}
                  data-testid="agent-elements-session-quick-open-input"
                  data-agent-elements-shell="session-quick-open-input"
                />
                {searchQuery && onSwitchToPrompts && !isFileSearchMode && (
                  <button
                    className="session-quick-open-prompt-switch agent-elements-session-quick-open-prompt-switch absolute right-3 top-1/2 -translate-y-1/2 text-xs flex items-center gap-1 px-2 py-1 rounded-[6px] cursor-pointer border border-transparent transition-colors duration-150 bg-transparent text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-primary-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
                    onClick={() => onSwitchToPrompts(searchQuery)}
                    title="Search in prompts"
                    data-agent-elements-shell="session-quick-open-prompt-switch"
                  >
                    <kbd className="agent-elements-session-quick-open-kbd px-1.5 py-0.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">Tab</kbd>
                    Search prompts
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div
          className="session-quick-open-results agent-elements-session-quick-open-results flex-1 overflow-y-auto min-h-[200px] py-1"
          data-testid="agent-elements-session-quick-open-results"
          data-agent-elements-shell="session-quick-open-results"
        >
          {/* File typeahead dropdown */}
          {showTypeahead && (
            <ul
              className={`session-quick-open-typeahead agent-elements-session-quick-open-typeahead list-none m-0 p-0 ${mouseHasMoved ? '' : 'pointer-events-none'}`}
              data-testid="agent-elements-session-quick-open-typeahead"
              data-agent-elements-shell="session-quick-open-typeahead"
            >
              {fileOptions.length === 0 ? (
                <li
                  className="session-quick-open-typeahead-empty agent-elements-session-quick-open-typeahead-empty py-6 px-4 text-center text-[var(--an-foreground-subtle)] text-sm"
                  data-testid="agent-elements-session-quick-open-typeahead-empty"
                  data-agent-elements-shell="session-quick-open-typeahead-empty"
                >
                  {fileSearchQuery ? 'No files found' : 'Type to search files...'}
                </li>
              ) : (
                fileOptions.slice(0, 20).map((option, index) => (
                  <li
                    key={option.id}
                    className={`session-quick-open-typeahead-item agent-elements-session-quick-open-typeahead-item mx-2 my-1 flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-[var(--an-tool-border-radius)] border transition-[background-color,border-color,box-shadow] duration-150 ease-out ${
                      index === typeaheadIndex
                        ? 'selected bg-[var(--an-background-tertiary)] border-[var(--an-tool-border-color)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--an-primary-color)_16%,transparent)]'
                        : 'border-transparent hover:bg-[var(--an-background-tertiary)] hover:border-[var(--an-tool-border-color)]'
                    }`}
                    onClick={() => handleFileTypeaheadSelect(option)}
                    onMouseEnter={() => {
                      if (mouseHasMoved) {
                        setTypeaheadIndex(index);
                      }
                    }}
                    data-testid={`agent-elements-session-quick-open-typeahead-item-${index}`}
                    data-agent-elements-shell="session-quick-open-typeahead-item"
                    data-selected={index === typeaheadIndex ? 'true' : 'false'}
                  >
                    <span
                      className="session-quick-open-typeahead-icon agent-elements-session-quick-open-typeahead-icon shrink-0 flex items-center justify-center w-7 h-7 rounded-[8px] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground-muted)]"
                      data-agent-elements-shell="session-quick-open-typeahead-icon"
                    >
                      {typeof option.icon === 'string' ? (
                        <MaterialSymbol icon={option.icon} size={16} />
                      ) : (
                        option.icon
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span
                        className="session-quick-open-typeahead-label agent-elements-session-quick-open-typeahead-label text-sm text-[var(--an-foreground)] block overflow-hidden text-ellipsis whitespace-nowrap"
                        data-agent-elements-shell="session-quick-open-typeahead-label"
                      >
                        {option.label}
                      </span>
                      {option.description && (
                        <span
                          className="session-quick-open-typeahead-description agent-elements-session-quick-open-typeahead-description text-xs text-[var(--an-foreground-subtle)] block overflow-hidden text-ellipsis whitespace-nowrap"
                          data-agent-elements-shell="session-quick-open-typeahead-description"
                        >
                          {option.description}
                        </span>
                      )}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}

          {/* Session results (hidden when typeahead is showing) */}
          {!showTypeahead && displaySessions.length === 0 && (
            <div
              className="session-quick-open-empty agent-elements-session-quick-open-empty p-10 text-center text-[var(--an-foreground-subtle)]"
              data-testid="agent-elements-session-quick-open-empty"
              data-agent-elements-shell="session-quick-open-empty"
            >
              {isFileSearchMode && selectedFilePath
                ? `No sessions edited ${selectedFilePath}`
                : searchQuery ? 'No sessions found' : 'No recent sessions'}
            </div>
          )}
          {!showTypeahead && displaySessions.length > 0 && (
            <ul
              className={`session-quick-open-list agent-elements-session-quick-open-list list-none m-0 p-0 ${mouseHasMoved ? '' : 'pointer-events-none'}`}
              ref={resultsListRef}
              data-agent-elements-shell="session-quick-open-list"
            >
              {displaySessions.map((session, index) => (
                <li
                  key={session.id}
                  className={`session-quick-open-item agent-elements-session-quick-open-item flex items-start gap-3 mx-2 my-1 py-2.5 px-3 cursor-pointer rounded-[var(--an-tool-border-radius)] border transition-[background-color,border-color,box-shadow] duration-150 ease-out ${
                    index === selectedIndex
                      ? 'selected bg-[var(--an-background-tertiary)] border-[var(--an-tool-border-color)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--an-primary-color)_16%,transparent)]'
                      : 'border-transparent hover:bg-[var(--an-background-tertiary)] hover:border-[var(--an-tool-border-color)]'
                  }`}
                  onClick={() => handleSessionSelect(session.id)}
                  onMouseEnter={() => {
                    if (mouseHasMoved) {
                      setSelectedIndex(index);
                    }
                  }}
                  data-testid={`agent-elements-session-quick-open-item-${index}`}
                  data-agent-elements-shell="session-quick-open-result"
                  data-selected={index === selectedIndex ? 'true' : 'false'}
                  data-provider={session.provider || 'claude'}
                  data-workstream={session.parentSessionId ? 'true' : 'false'}
                  data-worktree={session.worktreeId ? 'true' : 'false'}
                >
                  <div
                    className="session-quick-open-item-icon agent-elements-session-quick-open-item-icon shrink-0 flex items-center justify-center w-7 h-7 rounded-[8px] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground-muted)]"
                    data-agent-elements-shell="session-quick-open-provider-icon"
                  >
                    <ProviderIcon provider={session.provider || 'claude'} size={14} />
                  </div>
                  <div className="session-quick-open-item-content agent-elements-session-quick-open-item-content flex-1 min-w-0">
                    <div
                      className="session-quick-open-item-name agent-elements-session-quick-open-item-name text-sm font-medium text-[var(--an-foreground)] flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap"
                      data-testid={`agent-elements-session-quick-open-item-name-${index}`}
                      data-agent-elements-shell="session-quick-open-item-name"
                    >
                      {session.title || 'New conversation'}
                      {session.parentSessionId && (
                        <span
                          className="session-quick-open-badge workstream-badge agent-elements-status-pill shrink-0 text-[10px]"
                          data-agent-elements-shell="session-quick-open-workstream-badge"
                        >
                          In Workstream
                        </span>
                      )}
                      {session.worktreeId && (
                        <span
                          className="session-quick-open-badge worktree-badge agent-elements-status-pill shrink-0 text-[10px]"
                          data-agent-elements-shell="session-quick-open-worktree-badge"
                          data-tone="success"
                        >
                          Worktree
                        </span>
                      )}
                      {session.messageCount > 0 && (
                        <span
                          className="session-quick-open-badge message-count-badge agent-elements-status-pill shrink-0 text-[10px]"
                          data-agent-elements-shell="session-quick-open-message-count"
                        >
                          {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div
                      className="session-quick-open-item-meta agent-elements-session-quick-open-item-meta text-xs text-[var(--an-foreground-subtle)] mt-0.5"
                      data-agent-elements-shell="session-quick-open-item-meta"
                    >
                      {getRelativeTimeString(session.updatedAt)}
                    </div>
                  </div>
                  <div
                    className="session-quick-open-item-right agent-elements-session-quick-open-item-right shrink-0 flex items-center gap-1.5 ml-auto"
                    data-agent-elements-shell="session-quick-open-item-right"
                  >
                    {session.uncommittedCount !== undefined && session.uncommittedCount > 0 && (
                      <span
                        className="session-quick-open-badge uncommitted agent-elements-status-pill shrink-0 text-[10px] text-[var(--an-warning-color)]"
                        title={`${session.uncommittedCount} uncommitted change${session.uncommittedCount !== 1 ? 's' : ''}`}
                        data-agent-elements-shell="session-quick-open-uncommitted-badge"
                        data-tone="warning"
                      >
                        {session.uncommittedCount}
                      </span>
                    )}
                    <SessionStatusIndicator sessionId={session.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="session-quick-open-footer agent-elements-session-quick-open-footer flex justify-between py-2 px-4 border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)]"
          data-testid="agent-elements-session-quick-open-footer"
          data-agent-elements-shell="session-quick-open-footer"
        >
          <div className="flex gap-4">
            <span className="session-quick-open-hint agent-elements-session-quick-open-hint text-[11px] text-[var(--an-foreground-subtle)] flex items-center gap-1">
              <kbd className="agent-elements-session-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">Up/Down</kbd> Navigate
            </span>
            <span className="session-quick-open-hint agent-elements-session-quick-open-hint text-[11px] text-[var(--an-foreground-subtle)] flex items-center gap-1">
              <kbd className="agent-elements-session-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">Enter</kbd> {showTypeahead ? 'Select file' : 'Open'}
            </span>
            <span className="session-quick-open-hint agent-elements-session-quick-open-hint text-[11px] text-[var(--an-foreground-subtle)] flex items-center gap-1">
              <kbd className="agent-elements-session-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">Esc</kbd> {isFileSearchMode ? 'Clear filter' : 'Close'}
            </span>
          </div>
          {isFileSearchMode && selectedFilePath && fileFilteredSessionIds !== null ? (
            <span
              className="session-quick-open-hint agent-elements-session-quick-open-file-count text-[11px] text-[var(--an-primary-color)] flex items-center gap-1"
              data-testid="agent-elements-session-quick-open-file-count"
              data-agent-elements-shell="session-quick-open-file-count"
            >
              {displaySessions.length} session{displaySessions.length !== 1 ? 's' : ''} edited this file
            </span>
          ) : (
            <span className="session-quick-open-hint agent-elements-session-quick-open-hint text-[11px] text-[var(--an-foreground-subtle)] flex items-center gap-1">
              <kbd className="agent-elements-session-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">{getShortcutDisplay(KeyboardShortcuts.window.promptQuickOpen)}</kbd> Search prompts
            </span>
          )}
        </div>
      </div>
    </>
  );
};
