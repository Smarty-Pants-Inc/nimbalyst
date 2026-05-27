/**
 * UnifiedDiffHeader - Unified diff approval UI for all editor types
 *
 * This component provides a consistent diff approval experience across
 * Monaco, Lexical, and custom editors. It adapts its UI based on the
 * capabilities provided by each editor type.
 *
 * Features:
 * - Keep All / Revert All (all editors)
 * - Session info display with "Go to Session" (when available)
 * - Change navigation (prev/next) when supported
 * - Per-change keep/revert when supported
 *
 * Note: We use "Keep" / "Revert" terminology because AI changes are already
 * written to disk - we're reviewing changes that have been made, not approving
 * changes that are pending.
 */

import React from 'react';
import { MaterialSymbol, ProviderIcon } from '@nimbalyst/runtime';
import { usePostHog } from 'posthog-js/react';
import type { UnifiedDiffHeaderProps } from './DiffCapabilities';

const diffHeaderRootClasses =
  'unified-diff-header agent-elements-unified-diff-header agent-elements-tool-card sticky top-0 left-0 right-0 z-[100] border-b border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_8%,transparent)] @container/diff-header';

const diffHeaderContentClasses =
  'unified-diff-header-content flex min-h-[48px] items-center justify-between gap-3 px-4 py-2 @max-[450px]/diff-header:flex-wrap @max-[450px]/diff-header:gap-2 @max-[450px]/diff-header:px-3 @max-[450px]/diff-header:py-2 @max-[350px]/diff-header:px-2 @max-[350px]/diff-header:py-1.5';

const iconButtonClasses =
  'unified-diff-header-nav-button agent-elements-unified-diff-header-icon-button flex h-7 w-7 items-center justify-center rounded-[6px] border border-[var(--an-tool-border-color)] bg-[var(--an-background)] p-0 text-[var(--an-foreground-muted)] cursor-pointer transition-[background-color,color,border-color,opacity] duration-150 hover:enabled:bg-[var(--an-background-tertiary)] hover:enabled:text-[var(--an-foreground)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-1';

const secondaryButtonClasses =
  'unified-diff-header-button agent-elements-unified-diff-header-button flex items-center gap-2 rounded-[8px] border border-[var(--an-tool-border-color)] bg-[var(--an-background)] px-3 py-1.5 text-[13px] font-medium leading-5 text-[var(--an-foreground)] cursor-pointer whitespace-nowrap transition-[background-color,color,border-color,opacity] duration-150 hover:enabled:bg-[var(--an-background-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2 @max-[450px]/diff-header:px-2.5 @max-[350px]/diff-header:px-2 @max-[350px]/diff-header:py-[5px] @max-[350px]/diff-header:text-xs';

const primaryButtonClasses =
  'unified-diff-header-button agent-elements-unified-diff-header-button flex items-center gap-2 rounded-[8px] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-3 py-1.5 text-[13px] font-medium leading-5 text-[var(--an-send-button-color)] cursor-pointer whitespace-nowrap transition-[background-color,color,border-color,opacity] duration-150 hover:enabled:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2 @max-[450px]/diff-header:px-2.5 @max-[350px]/diff-header:px-2 @max-[350px]/diff-header:py-[5px] @max-[350px]/diff-header:text-xs';

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

export const UnifiedDiffHeader: React.FC<UnifiedDiffHeaderProps> = ({
  fileName,
  sessionInfo,
  onGoToSession,
  capabilities,
  editorType,
}) => {
  const posthog = usePostHog();
  const { changeGroups } = capabilities;
  const hasChangeGroups = changeGroups && changeGroups.count > 0;
  const hasSelection = changeGroups && changeGroups.currentIndex !== null && changeGroups.currentIndex >= 0;
  // Per-change actions are supported if explicitly set, or if the callbacks exist
  const supportsPerChangeActions = changeGroups?.supportsPerChangeActions ??
    (changeGroups?.onAcceptCurrent !== undefined && changeGroups?.onRejectCurrent !== undefined);

  const handleAcceptAll = () => {
    posthog?.capture('ai_diff_accepted', {
      acceptType: 'all',
      editorType,
    });
    capabilities.onAcceptAll();
  };

  const handleRejectAll = () => {
    posthog?.capture('ai_diff_rejected', {
      rejectType: 'all',
      editorType,
    });
    capabilities.onRejectAll();
  };

  const handleAcceptCurrent = () => {
    if (!changeGroups?.onAcceptCurrent) return;
    posthog?.capture('ai_diff_accepted', {
      acceptType: 'partial',
      editorType,
    });
    changeGroups.onAcceptCurrent();
  };

  const handleRejectCurrent = () => {
    if (!changeGroups?.onRejectCurrent) return;
    posthog?.capture('ai_diff_rejected', {
      rejectType: 'partial',
      editorType,
    });
    changeGroups.onRejectCurrent();
  };

  const handleGoToSession = () => {
    if (sessionInfo?.sessionId && onGoToSession) {
      onGoToSession(sessionInfo.sessionId);
    }
  };

  const renderSessionInfo = () => {
    if (sessionInfo?.sessionTitle) {
      const provider = sessionInfo.provider;
      const canNavigate = sessionInfo.sessionId && onGoToSession;

      const sessionLink = (
        <button
          className={`unified-diff-header-session-link agent-elements-unified-diff-header-session-link flex min-w-0 shrink items-center gap-2 overflow-hidden rounded-[8px] border-0 bg-transparent px-2 py-1 text-[13px] text-[var(--an-foreground)] transition-[background-color,color] duration-150 ${canNavigate ? 'unified-diff-header-session-link--clickable cursor-pointer hover:bg-[var(--an-background-tertiary)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-1' : 'cursor-default'}`}
          onClick={canNavigate ? handleGoToSession : undefined}
          type="button"
          disabled={!canNavigate}
          title={canNavigate ? `Open "${sessionInfo.sessionTitle}" session` : undefined}
          data-testid="agent-elements-unified-diff-header-session-link"
          data-agent-elements-shell="unified-diff-header-session-link"
        >
          {provider ? (
            <ProviderIcon provider={provider} size={18} className="unified-diff-header-session-icon agent-elements-unified-diff-header-session-icon shrink-0" />
          ) : (
            <MaterialSymbol icon="smart_toy" size={18} className="unified-diff-header-session-icon agent-elements-unified-diff-header-session-icon shrink-0" />
          )}
          <span className="unified-diff-header-session-name overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--an-primary-color)] @max-[350px]/diff-header:max-w-[120px]">{sessionInfo.sessionTitle}</span>
          {canNavigate && (
            <MaterialSymbol icon="open_in_new" size={14} className="unified-diff-header-session-open-icon opacity-0 text-[var(--an-foreground-subtle)] transition-opacity duration-150 shrink-0 group-hover/session:opacity-100" />
          )}
        </button>
      );

      return (
        <div className="unified-diff-header-session agent-elements-unified-diff-header-session flex min-w-0 items-center gap-2 overflow-hidden text-[13px] text-[var(--an-foreground)] group/session">
          {sessionLink}
          {sessionInfo.editedAt && (
            <span className="unified-diff-header-timestamp text-[var(--an-foreground-subtle)] shrink-0 before:content-['\00b7'] before:mr-1.5 @max-[700px]/diff-header:hidden">
              edited {formatRelativeTime(sessionInfo.editedAt)}
            </span>
          )}
        </div>
      );
    }

    // Fallback to simple label with sparkle icon
    return (
      <span className="unified-diff-header-label agent-elements-unified-diff-header-label flex items-center gap-2 text-[13px] font-medium text-[var(--an-foreground)]">
        <MaterialSymbol icon="auto_awesome" size={16} className="unified-diff-header-sparkle shrink-0 text-[var(--an-primary-color)]" />
        AI changes to {fileName || 'file'}
      </span>
    );
  };

  return (
    <div
      className={diffHeaderRootClasses}
      data-testid="agent-elements-unified-diff-header"
      data-component="UnifiedDiffHeader"
      data-agent-elements-shell="unified-diff-header"
    >
      <div className={diffHeaderContentClasses}>
        {/* Left section: Session info */}
        <div className="unified-diff-header-info flex items-center gap-3 shrink min-w-0 overflow-hidden @max-[450px]/diff-header:flex-[1_1_100%] @max-[450px]/diff-header:order-1">
          {renderSessionInfo()}
        </div>

        {/* Middle section: Navigation (only if change groups supported) */}
        {hasChangeGroups && (
          <div className="unified-diff-header-navigation flex items-center gap-2 shrink-0 @max-[450px]/diff-header:flex-[0_1_auto] @max-[450px]/diff-header:order-2">
            <button
              onClick={changeGroups.onNavigatePrevious}
              aria-label="Previous change"
              className={iconButtonClasses}
              type="button"
              data-testid="agent-elements-unified-diff-header-previous"
              data-agent-elements-shell="unified-diff-header-nav-button"
            >
              <MaterialSymbol icon="chevron_left" size={18} />
            </button>
            <span
              className="unified-diff-header-change-counter min-w-[80px] select-none text-center text-[13px] text-[var(--an-foreground-muted)] @max-[350px]/diff-header:min-w-[60px] @max-[350px]/diff-header:text-xs"
              data-testid="agent-elements-unified-diff-header-counter"
            >
              {hasSelection
                ? `${changeGroups.currentIndex! + 1} of ${changeGroups.count}`
                : `${changeGroups.count} changes`}
            </span>
            <button
              onClick={changeGroups.onNavigateNext}
              aria-label="Next change"
              className={iconButtonClasses}
              type="button"
              data-testid="agent-elements-unified-diff-header-next"
              data-agent-elements-shell="unified-diff-header-nav-button"
            >
              <MaterialSymbol icon="chevron_right" size={18} />
            </button>
          </div>
        )}

        {/* Right section: Actions */}
        <div className="unified-diff-header-actions flex items-center gap-2 ml-auto shrink-0 @max-[450px]/diff-header:order-3 @max-[450px]/diff-header:gap-1.5">
          {/* Per-change buttons (only if change groups AND per-change actions supported) */}
          {hasChangeGroups && supportsPerChangeActions && (
            <>
              <button
                className={`${secondaryButtonClasses} unified-diff-header-button-reject-single`}
                onClick={handleRejectCurrent}
                title="Revert this change"
                disabled={!hasSelection}
                type="button"
                data-testid="agent-elements-unified-diff-header-revert-current"
              >
                <MaterialSymbol icon="close" size={16} />
                Revert
              </button>
              <button
                className={`${primaryButtonClasses} unified-diff-header-button-accept-single`}
                onClick={handleAcceptCurrent}
                title="Keep this change"
                disabled={!hasSelection}
                type="button"
                data-testid="agent-elements-unified-diff-header-keep-current"
              >
                <MaterialSymbol icon="check" size={16} />
                Keep
              </button>
            </>
          )}
          {/* All buttons (always shown) */}
          <button
            className={`${secondaryButtonClasses} unified-diff-header-button-reject`}
            onClick={handleRejectAll}
            type="button"
            data-testid="diff-revert-all"
          >
            {hasChangeGroups && supportsPerChangeActions && (
              <MaterialSymbol icon="close" size={16} />
            )}
            Revert{hasChangeGroups && supportsPerChangeActions ? ' All' : ''}
          </button>
          <button
            className={`${primaryButtonClasses} unified-diff-header-button-accept`}
            onClick={handleAcceptAll}
            type="button"
            data-testid="diff-keep-all"
          >
            {hasChangeGroups && supportsPerChangeActions && (
              <MaterialSymbol icon="check" size={16} />
            )}
            Keep{hasChangeGroups && supportsPerChangeActions ? ' All' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
