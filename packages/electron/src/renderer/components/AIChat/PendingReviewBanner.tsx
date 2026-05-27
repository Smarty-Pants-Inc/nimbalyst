import React, { useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { sessionPendingReviewFilesAtom } from '../../store/atoms/sessionFiles';

interface PendingReviewBannerProps {
  workspacePath?: string;
  sessionId?: string | null;
}

export function PendingReviewBanner({ workspacePath, sessionId }: PendingReviewBannerProps) {
  const effectiveSessionId = sessionId || '__no_session__';
  const pendingReviewFiles = useAtomValue(sessionPendingReviewFilesAtom(effectiveSessionId));
  const pendingCount = sessionId ? pendingReviewFiles.size : 0;
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAll = useCallback(async () => {
    if (!workspacePath || !sessionId || isClearing) return;

    setIsClearing(true);
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        await (window as any).electronAPI.history.clearPendingForSession(workspacePath, sessionId);
        // Count will be updated via the event listener
      }
    } catch (error) {
      console.error('[PendingReviewBanner] Failed to clear pending for session:', error);
    } finally {
      setIsClearing(false);
    }
  }, [workspacePath, sessionId, isClearing]);

  // Don't render if no pending files
  if (pendingCount === 0) {
    return null;
  }

  return (
    <div
      className="pending-review-banner agent-elements-pending-review-banner agent-elements-status-banner flex items-center justify-between px-3 py-2 border-b border-[color-mix(in_srgb,var(--an-warning-color)_26%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_8%,var(--an-background))] text-[var(--an-warning-color)] transition-[background-color,border-color,color] duration-150 ease-out"
      data-testid="agent-elements-pending-review-banner"
      data-agent-elements-shell="pending-review-banner"
      data-pending-count={pendingCount}
    >
      <div className="pending-review-banner__info flex items-center gap-2">
        <MaterialSymbol icon="rate_review" size={16} className="pending-review-banner__icon agent-elements-status-banner-icon shrink-0" />
        <span className="pending-review-banner__text agent-elements-status-banner-text text-xs font-medium">
          <span className="pending-review-banner__count font-semibold">{pendingCount}</span>
          {' '}file{pendingCount !== 1 ? 's' : ''} pending review
        </span>
      </div>
      <button
        className="pending-review-banner__clear-btn agent-elements-status-banner-action flex items-center gap-1 px-2.5 py-1 bg-transparent border border-current rounded-[var(--an-radius-sm)] text-[11px] font-medium cursor-pointer transition-[background-color,border-color,color] duration-150 ease-out font-inherit hover:enabled:bg-[color-mix(in_srgb,currentColor_12%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)] disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleClearAll}
        disabled={isClearing}
        title="Accept all pending AI changes"
      >
        <MaterialSymbol icon="check_circle" size={14} />
        {isClearing ? 'Keeping...' : 'Keep All'}
      </button>
    </div>
  );
}
