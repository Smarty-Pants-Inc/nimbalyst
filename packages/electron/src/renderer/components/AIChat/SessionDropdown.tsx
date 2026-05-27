import React, { useState, memo } from 'react';
import { useAtomValue } from 'jotai';
import { MaterialSymbol, ProviderIcon } from '@nimbalyst/runtime';
import { parseModelInfo, getProviderLabel } from '../../utils/modelUtils';
import type { SessionData } from '@nimbalyst/runtime/ai/server/types';
import { formatDate } from '@nimbalyst/runtime';
import { sessionProcessingAtom, sessionUnreadAtom } from '../../store';
import { useFloatingMenu, FloatingPortal } from '../../hooks/useFloatingMenu';

const SESSION_STATUS_DOT_CLASS = 'session-status-indicator h-2 w-2 shrink-0 rounded-[999px] bg-[var(--an-primary-color)]';
const SESSION_DROPDOWN_ROOT_CLASS = 'session-dropdown agent-elements-session-dropdown relative';
const SESSION_DROPDOWN_TRIGGER_CLASS = [
  'session-dropdown-trigger',
  'agent-elements-session-dropdown-trigger',
  'inline-flex',
  'h-8',
  'cursor-pointer',
  'items-center',
  'gap-1.5',
  'rounded-[var(--an-input-border-radius)]',
  'border',
  'border-[var(--an-border-color)]',
  'bg-transparent',
  'px-2',
  'py-1.5',
  'text-[13px]',
  'text-[var(--an-foreground)]',
  'transition-[background-color,border-color,color,box-shadow]',
  'duration-150',
  'ease-out',
  'hover:border-[var(--an-border-color-strong)]',
  'hover:bg-[var(--an-background-tertiary)]',
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-[var(--an-input-focus-outline)]',
  'disabled:cursor-not-allowed',
  'disabled:opacity-50',
].join(' ');
const SESSION_DROPDOWN_MENU_CLASS = [
  'session-dropdown-menu',
  'agent-elements-session-dropdown-menu',
  'agent-elements-tool-card',
  'z-[10000]',
  'min-w-[280px]',
  'max-w-[400px]',
  'overflow-hidden',
  'rounded-[var(--an-tool-border-radius)]',
  'border',
  'border-[var(--an-tool-border-color)]',
  'bg-[var(--an-tool-background)]',
  'text-[13px]',
  'text-[var(--an-tool-color)]',
  'shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]',
].join(' ');
const SESSION_DROPDOWN_MENU_BUTTON_CLASS = [
  'flex',
  'w-full',
  'cursor-pointer',
  'items-center',
  'gap-2',
  'border-0',
  'bg-transparent',
  'px-3',
  'py-2',
  'text-left',
  'text-[13px]',
  'text-[var(--an-tool-color)]',
  'transition-colors',
  'duration-150',
  'ease-out',
  'hover:bg-[var(--an-background-tertiary)]',
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-[var(--an-input-focus-outline)]',
].join(' ');
const SESSION_DROPDOWN_ITEM_CLASS = [
  'session-dropdown-item',
  'flex',
  'w-full',
  'cursor-pointer',
  'items-center',
  'justify-between',
  'border-0',
  'px-3',
  'py-2.5',
  'text-left',
  'text-[13px]',
  'text-[var(--an-tool-color)]',
  'transition-colors',
  'duration-150',
  'ease-out',
  'hover:bg-[var(--an-background-tertiary)]',
].join(' ');
const SESSION_DROPDOWN_ACTIVE_ITEM_CLASS = [
  'active',
  'bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-tool-background))]',
  'font-medium',
].join(' ');
const SESSION_ACTION_BUTTON_CLASS = [
  'session-action-btn',
  'agent-elements-session-dropdown-action',
  'flex',
  'h-6',
  'w-6',
  'cursor-pointer',
  'items-center',
  'justify-center',
  'rounded-[var(--an-input-border-radius)]',
  'border',
  'border-transparent',
  'bg-transparent',
  'p-0',
  'text-[var(--an-tool-color-muted)]',
  'transition-[background-color,border-color,color,opacity]',
  'duration-150',
  'hover:border-[var(--an-border-color)]',
  'hover:bg-[var(--an-background-tertiary)]',
  'hover:text-[var(--an-tool-color)]',
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-[var(--an-input-focus-outline)]',
].join(' ');

/**
 * Status indicator that subscribes to session atoms.
 * Only this component re-renders when the session's state changes.
 */
const SessionStatusIndicator = memo<{ sessionId: string }>(({ sessionId }) => {
  const isProcessing = useAtomValue(sessionProcessingAtom(sessionId));
  const hasUnread = useAtomValue(sessionUnreadAtom(sessionId));

  if (isProcessing) {
    return (
      <div
        className={`${SESSION_STATUS_DOT_CLASS} processing animate-pulse`}
        title="Running"
        data-agent-elements-shell="session-status-indicator"
      />
    );
  }
  if (hasUnread) {
    return (
      <div
        className={`${SESSION_STATUS_DOT_CLASS} unread`}
        title="Unread response"
        data-agent-elements-shell="session-status-indicator"
      />
    );
  }
  return null;
});

// SessionDropdownItem extends SessionData with message count for display
type SessionDropdownItem = Pick<SessionData, 'id' | 'createdAt' | 'title' | 'provider' | 'model'> & {
  messageCount?: number;
};

interface SessionDropdownProps {
  currentSessionId: string | null;
  sessions: SessionDropdownItem[];
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newName: string) => void;
  onOpenSessionManager?: () => void;
}

export function SessionDropdown({
  currentSessionId,
  sessions,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onOpenSessionManager
}: SessionDropdownProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const menu = useFloatingMenu({ placement: 'bottom-end' });

  const getCurrentSession = () => {
    if (!currentSessionId) return null;
    return sessions.find(s => s.id === currentSessionId) || null;
  };

  const getCurrentSessionName = () => {
    const session = getCurrentSession();
    if (!session) return 'New Session';
    if (session.title) return session.title;
    return formatDate(session.createdAt);
  };

  const formatSessionName = (session: SessionDropdownItem) => {
    if (session.title) return session.title;
    return formatDate(session.createdAt);
  };

  const handleRename = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    setRenamingId(sessionId);
    setRenameValue(session?.title || formatSessionName(session!));
  };

  const submitRename = () => {
    if (renamingId && renameValue.trim() && onRenameSession) {
      onRenameSession(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitRename();
    } else if (e.key === 'Escape') {
      setRenamingId(null);
      setRenameValue('');
    }
  };

  return (
    <div
      className={SESSION_DROPDOWN_ROOT_CLASS}
      data-component="SessionDropdown"
      data-agent-elements-shell="session-dropdown"
    >
      <button
        ref={menu.refs.setReference}
        {...menu.getReferenceProps()}
        className={SESSION_DROPDOWN_TRIGGER_CLASS}
        onClick={() => menu.setIsOpen(!menu.isOpen)}
        title="Session History"
        aria-label={`Session History: ${getCurrentSessionName()}`}
        data-agent-elements-shell="session-dropdown-trigger"
      >
        {currentSessionId && <SessionStatusIndicator sessionId={currentSessionId} />}
        <ProviderIcon provider={getCurrentSession()?.provider || 'claude'} size={16} />
        <span className="session-dropdown-name overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">{getCurrentSessionName()}</span>
        <MaterialSymbol
          icon="expand_more"
          size={16}
          className={`session-dropdown-arrow shrink-0 transition-transform duration-200 ${menu.isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {menu.isOpen && (
        <FloatingPortal>
          <div
            ref={menu.refs.setFloating}
            style={menu.floatingStyles}
            {...menu.getFloatingProps()}
            className={SESSION_DROPDOWN_MENU_CLASS}
            data-testid="agent-elements-session-dropdown-menu"
            data-agent-elements-shell="session-dropdown-menu"
          >
            {onOpenSessionManager && (
              <button
                className={`session-dropdown-all-sessions agent-elements-session-dropdown-menu-item ${SESSION_DROPDOWN_MENU_BUTTON_CLASS}`}
                onClick={() => {
                  onOpenSessionManager();
                  menu.setIsOpen(false);
                }}
                data-agent-elements-shell="session-dropdown-menu-item"
              >
                <MaterialSymbol icon="folder_open" size={16} />
                <span>All Sessions</span>
              </button>
            )}
            {sessions.length > 0 && (
              <div
                className="session-dropdown-divider my-1 h-px bg-[var(--an-tool-border-color)]"
                data-agent-elements-shell="session-dropdown-divider"
              />
            )}
            <div className="session-dropdown-sessions max-h-[300px] overflow-y-auto">
              {sessions.map(session => (
                    <div
                      key={session.id}
                      className={`${SESSION_DROPDOWN_ITEM_CLASS} ${session.id === currentSessionId ? SESSION_DROPDOWN_ACTIVE_ITEM_CLASS : ''}`}
                      data-agent-elements-shell="session-dropdown-item"
                      data-active={session.id === currentSessionId ? 'true' : 'false'}
                    >
                      {renamingId === session.id ? (
                        <input
                          type="text"
                          className="session-rename-input flex-1 rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-background)] px-1.5 py-1 text-[13px] text-[var(--an-foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={submitRename}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          data-agent-elements-shell="session-dropdown-rename-input"
                        />
                      ) : (
                        <div
                          className="session-info flex-1 flex flex-col gap-0.5 min-w-0"
                          onClick={() => {
                            onSessionSelect(session.id);
                            menu.setIsOpen(false);
                          }}
                        >
                          <div className="session-name-row flex items-center gap-1.5">
                            <SessionStatusIndicator sessionId={session.id} />
                            <span className="session-name overflow-hidden text-ellipsis whitespace-nowrap">{formatSessionName(session)}</span>
                            {session.provider && session.provider !== 'claude-code' && (
                              <span
                                className={`session-provider-badge provider-${session.provider} inline-flex shrink-0 items-center rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-1 py-px text-[9px] font-semibold uppercase text-[var(--an-foreground-muted)]`}
                                data-agent-elements-shell="session-provider-badge"
                              >
                                {getProviderLabel(session.provider)}
                              </span>
                            )}
                            {session.model && (
                              <span
                                className="session-model-badge inline-flex shrink-0 items-center rounded-[var(--an-small-border-radius)] bg-[var(--an-background-tertiary)] px-1.5 py-px text-[10px] font-medium text-[var(--an-foreground-muted)]"
                                data-agent-elements-shell="session-model-badge"
                              >
                                {parseModelInfo(session.model)?.shortModelName}
                              </span>
                            )}
                          </div>
                          {session.messageCount !== undefined && session.messageCount > 0 && (
                            <span className="session-message-count text-[11px] text-[var(--an-tool-color-muted)]">{session.messageCount} turns</span>
                          )}
                        </div>
                      )}

                      <div className="session-actions flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [.session-dropdown-item:hover_&]:opacity-100">
                        {onRenameSession && (
                          <button
                            className={SESSION_ACTION_BUTTON_CLASS}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRename(session.id);
                            }}
                            title="Rename"
                            aria-label={`Rename ${formatSessionName(session)}`}
                            data-agent-elements-shell="session-dropdown-action"
                          >
                            <MaterialSymbol icon="edit" size={14} />
                          </button>
                        )}
                        <button
                          className={`${SESSION_ACTION_BUTTON_CLASS} delete hover:text-[var(--an-error-color)]`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this session?')) {
                              onDeleteSession(session.id);
                            }
                          }}
                          title="Delete"
                          aria-label={`Delete ${formatSessionName(session)}`}
                          data-agent-elements-shell="session-dropdown-action"
                        >
                          <MaterialSymbol icon="delete" size={14} />
                        </button>
                      </div>
                    </div>
              ))}
            </div>
            {sessions.length === 0 && (
              <div
                className="session-dropdown-empty p-5 text-center text-[13px] text-[var(--an-tool-color-muted)]"
                data-agent-elements-shell="session-dropdown-empty"
              >
                <span>No sessions yet</span>
              </div>
            )}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
