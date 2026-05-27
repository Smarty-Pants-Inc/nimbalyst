/**
 * CustomEditorAIEditedBar
 *
 * A simple notification bar for custom editors that don't support diff mode.
 * Shows that the file was AI-edited with a button to view the diff in history.
 */

import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import type { SessionInfo } from './DiffCapabilities';

const aiEditedBarRootClasses =
  'unified-diff-header agent-elements-custom-editor-ai-edited-bar agent-elements-tool-card sticky top-0 left-0 right-0 z-[100] border-b border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_8%,transparent)] @container/diff-header';

const aiEditedBarButtonClasses =
  'unified-diff-header-button agent-elements-unified-diff-header-button flex items-center gap-2 rounded-[8px] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-3 py-1.5 text-[13px] font-medium leading-5 text-[var(--an-send-button-color)] cursor-pointer whitespace-nowrap transition-[background-color,color,border-color,opacity] duration-150 hover:enabled:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';

const aiEditedSessionButtonClasses =
  'unified-diff-header-goto agent-elements-custom-editor-ai-session flex items-center gap-1.5 rounded-[8px] border border-[var(--an-tool-border-color)] bg-[var(--an-background)] px-2 py-1 text-[13px] text-[var(--an-foreground-muted)] cursor-pointer transition-[background-color,color,border-color] duration-150 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-1';

export interface CustomEditorAIEditedBarProps {
  fileName: string;
  sessionInfo?: SessionInfo;
  onGoToSession?: (sessionId: string) => void;
  onViewHistory?: () => void;
}

/**
 * Format a timestamp as a relative time string
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

export const CustomEditorAIEditedBar: React.FC<CustomEditorAIEditedBarProps> = ({
  fileName,
  sessionInfo,
  onGoToSession,
  onViewHistory,
}) => {
  const handleGoToSession = () => {
    if (sessionInfo?.sessionId && onGoToSession) {
      onGoToSession(sessionInfo.sessionId);
    }
  };

  return (
    <div
      className={aiEditedBarRootClasses}
      data-testid="agent-elements-custom-editor-ai-edited-bar"
      data-component="CustomEditorAIEditedBar"
      data-agent-elements-shell="custom-editor-ai-edited-bar"
    >
      <div className="unified-diff-header-content flex min-h-[48px] items-center justify-between gap-3 px-4 py-2 @max-[450px]/diff-header:flex-wrap @max-[450px]/diff-header:gap-2 @max-[450px]/diff-header:px-3 @max-[350px]/diff-header:px-2">
        {/* Left section: AI edited info */}
        <div className="unified-diff-header-info flex min-w-0 shrink items-center gap-3 overflow-hidden @max-[450px]/diff-header:flex-[1_1_100%]">
          {sessionInfo?.sessionTitle ? (
            <div className="unified-diff-header-session agent-elements-custom-editor-ai-edited-session flex min-w-0 items-center gap-2 overflow-hidden text-[13px] text-[var(--an-foreground)]">
              <MaterialSymbol icon="smart_toy" size={18} className="unified-diff-header-session-icon shrink-0 text-[var(--an-primary-color)]" />
              <div className="unified-diff-header-session-details flex min-w-0 items-center gap-1.5">
                <span className="unified-diff-header-label agent-elements-custom-editor-ai-label flex items-center gap-2 text-[13px] font-medium text-[var(--an-foreground)]">
                  <span className="unified-diff-header-session-name overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--an-primary-color)]">{sessionInfo.sessionTitle}</span>
                  {' '}edited {fileName || 'file'}
                </span>
                {sessionInfo.editedAt && (
                  <span className="unified-diff-header-timestamp text-[var(--an-foreground-subtle)] shrink-0 before:content-['\00b7'] before:mr-1.5">
                    {formatRelativeTime(sessionInfo.editedAt)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="unified-diff-header-label agent-elements-custom-editor-ai-label flex items-center gap-2 text-[13px] font-medium text-[var(--an-foreground)]">
              <MaterialSymbol icon="auto_awesome" size={16} className="unified-diff-header-sparkle shrink-0 text-[var(--an-primary-color)]" />
              AI edited {fileName || 'file'}
            </span>
          )}
          {sessionInfo?.sessionId && onGoToSession && (
            <button
              className={aiEditedSessionButtonClasses}
              onClick={handleGoToSession}
              type="button"
              title="Open the AI session that made these changes"
              data-testid="agent-elements-custom-editor-ai-session"
            >
              <MaterialSymbol icon="open_in_new" size={14} />
              Go to Session
            </button>
          )}
        </div>

        {/* Right section: View History button */}
        <div className="unified-diff-header-actions flex items-center gap-2 ml-auto shrink-0">
          {onViewHistory && (
            <button
              className={`${aiEditedBarButtonClasses} unified-diff-header-button-accept`}
              onClick={onViewHistory}
              type="button"
              title="View changes in history"
              data-testid="agent-elements-custom-editor-ai-view-history"
            >
              <MaterialSymbol icon="history" size={16} />
              View History
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
