/**
 * MonacoDiffApprovalBar - Approval UI for Monaco diff mode
 *
 * This component provides Accept All / Reject All buttons when
 * Monaco editor is in diff mode, showing AI-generated changes.
 *
 * Kept separate from the Lexical DiffApprovalBar to avoid coupling.
 */

import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { HelpTooltip } from '../../help';

export interface SessionInfo {
  sessionId: string;
  sessionTitle?: string;
  editedAt?: number;
}

export interface MonacoDiffApprovalBarProps {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  fileName?: string;
  sessionInfo?: SessionInfo;
  onGoToSession?: (sessionId: string) => void;
}

const barRootClasses =
  'monaco-diff-approval-bar agent-elements-monaco-diff-approval-bar agent-elements-tool-card sticky top-0 left-0 right-0 z-[100] border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_8%,transparent)] @container/monaco-diff-approval';

const barContentClasses =
  'monaco-diff-approval-bar-content agent-elements-monaco-diff-approval-content flex min-h-[48px] items-center justify-between gap-3 px-4 py-2 @max-[520px]/monaco-diff-approval:flex-wrap @max-[520px]/monaco-diff-approval:gap-2 @max-[520px]/monaco-diff-approval:px-3';

const infoClasses =
  'monaco-diff-approval-bar-info agent-elements-monaco-diff-approval-info flex min-w-0 items-center gap-3 overflow-hidden @max-[520px]/monaco-diff-approval:flex-[1_1_100%]';

const sessionClasses =
  'monaco-diff-approval-bar-session agent-elements-monaco-diff-approval-session flex min-w-0 items-center gap-2 overflow-hidden';

const sessionIconClasses =
  'monaco-diff-approval-bar-session-icon agent-elements-monaco-diff-approval-session-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-primary-color)]';

const labelClasses =
  'monaco-diff-approval-bar-label agent-elements-monaco-diff-approval-label flex min-w-0 items-center gap-2 text-[13px] font-medium leading-5 text-[var(--an-foreground)]';

const sessionNameClasses =
  'monaco-diff-approval-bar-session-name overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--an-primary-color)]';

const timestampClasses =
  'monaco-diff-approval-bar-timestamp text-[11px] leading-4 text-[var(--an-foreground-subtle)]';

const gotoButtonClasses =
  'monaco-diff-approval-bar-goto agent-elements-monaco-diff-approval-goto inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2.5 text-xs font-medium leading-none text-[var(--an-foreground-muted)] transition-[background-color,border-color,color,opacity] duration-150 hover:border-[var(--an-border-color-strong)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';

const actionsClasses =
  'monaco-diff-approval-bar-actions agent-elements-monaco-diff-approval-actions ml-auto flex shrink-0 items-center gap-2 @max-[520px]/monaco-diff-approval:ml-0';

const buttonBaseClasses =
  'monaco-diff-approval-bar-button agent-elements-monaco-diff-approval-button inline-flex h-8 items-center justify-center rounded-[var(--an-input-border-radius)] border px-3.5 text-[13px] font-medium leading-none cursor-pointer whitespace-nowrap transition-[background-color,border-color,color,opacity] duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';

const secondaryButtonClasses =
  `${buttonBaseClasses} monaco-diff-approval-bar-button-reject border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]`;

const primaryButtonClasses =
  `${buttonBaseClasses} monaco-diff-approval-bar-button-accept border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)] hover:opacity-90`;

function DecorativeMaterialSymbol({
  icon,
  size,
  className,
}: {
  icon: string;
  size: number;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={className}>
      <MaterialSymbol icon={icon} size={size} />
    </span>
  );
}

/**
 * Format a timestamp as a relative time string (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  if (hours > 0) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (minutes > 0) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  return 'just now';
}

export const MonacoDiffApprovalBar: React.FC<MonacoDiffApprovalBarProps> = ({
  onAcceptAll,
  onRejectAll,
  fileName,
  sessionInfo,
  onGoToSession,
}) => {
  const handleAcceptClick = () => {
    try {
      onAcceptAll();
    } catch (error) {
      console.error('[MonacoDiffApprovalBar] Error calling onAcceptAll:', error);
    }
  };

  const handleRejectClick = () => {
    onRejectAll();
  };

  const handleGoToSession = () => {
    if (sessionInfo?.sessionId && onGoToSession) {
      onGoToSession(sessionInfo.sessionId);
    }
  };

  // Render session-aware label if session info is provided
  const renderLabel = () => {
    if (sessionInfo?.sessionTitle) {
      return (
        <div
          className={sessionClasses}
          data-testid="agent-elements-monaco-diff-approval-session"
          data-agent-elements-shell="monaco-diff-approval-session"
        >
          <DecorativeMaterialSymbol icon="smart_toy" size={18} className={sessionIconClasses} />
          <div className="monaco-diff-approval-bar-session-details flex min-w-0 flex-col gap-0.5">
            <span className={labelClasses}>
              <span className={sessionNameClasses}>{sessionInfo.sessionTitle}</span>
              {' '}edited {fileName || 'file'}
            </span>
            {sessionInfo.editedAt && (
              <span className={timestampClasses}>
                {formatRelativeTime(sessionInfo.editedAt)}
              </span>
            )}
          </div>
        </div>
      );
    }

    // Fallback to original simple label
    return (
      <span
        className={labelClasses}
        data-testid="agent-elements-monaco-diff-approval-label"
        data-agent-elements-shell="monaco-diff-approval-label"
      >
        <DecorativeMaterialSymbol
          icon="auto_awesome"
          size={16}
          className="agent-elements-monaco-diff-approval-label-icon flex h-5 w-5 shrink-0 items-center justify-center text-[var(--an-primary-color)]"
        />
        AI changes to {fileName || 'file'}
      </span>
    );
  };

  return (
    <div
      className={barRootClasses}
      data-testid="agent-elements-monaco-diff-approval-bar"
      data-component="MonacoDiffApprovalBar"
      data-agent-elements-shell="monaco-diff-approval-bar"
    >
      <div className={barContentClasses}>
        <div className={infoClasses}>
          {renderLabel()}
          {sessionInfo?.sessionId && onGoToSession && (
            <button
              className={gotoButtonClasses}
              onClick={handleGoToSession}
              type="button"
              title="Open the AI session that made these changes"
              data-testid="agent-elements-monaco-diff-approval-goto"
              data-agent-elements-shell="monaco-diff-approval-goto"
            >
              <DecorativeMaterialSymbol
                icon="open_in_new"
                size={14}
                className="agent-elements-monaco-diff-approval-goto-icon flex h-4 w-4 shrink-0 items-center justify-center"
              />
              Go to Session
            </button>
          )}
        </div>
        <div
          className={actionsClasses}
          data-testid="agent-elements-monaco-diff-approval-actions"
          data-agent-elements-shell="monaco-diff-approval-actions"
        >
          <HelpTooltip testId="diff-revert-all-button">
            <button
              className={secondaryButtonClasses}
              onClick={handleRejectClick}
              type="button"
              data-testid="diff-revert-all-button"
            >
              Reject All
            </button>
          </HelpTooltip>
          <HelpTooltip testId="diff-keep-all-button">
            <button
              className={primaryButtonClasses}
              onClick={handleAcceptClick}
              type="button"
              data-testid="diff-keep-all-button"
            >
              Accept All
            </button>
          </HelpTooltip>
        </div>
      </div>
    </div>
  );
};
