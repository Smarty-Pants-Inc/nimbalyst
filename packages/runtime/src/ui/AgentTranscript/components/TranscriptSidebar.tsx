import React, { useState } from 'react';
import type { PromptMarker } from '../types';
import { MaterialSymbol } from '../../icons/MaterialSymbol';
import { formatTimeAgo, formatDuration } from '../../../utils/dateUtils';

interface TranscriptSidebarProps {
  sessionId: string;
  prompts: PromptMarker[];
  onNavigateToPrompt: (marker: PromptMarker) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const TranscriptSidebar: React.FC<TranscriptSidebarProps> = ({
  sessionId,
  prompts,
  onNavigateToPrompt,
  isCollapsed,
  onToggleCollapse
}) => {
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);

  const handlePromptClick = (marker: PromptMarker) => {
    setSelectedPromptId(marker.id);
    onNavigateToPrompt(marker);
  };

  const promptRowClassName = (isSelected: boolean) => [
    'agent-elements-prompt-history-row group block w-full box-border cursor-pointer border px-[var(--an-spacing-md)] py-[var(--an-spacing-md)] text-left font-inherit outline-none transition-colors duration-150 ease-out',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--an-focus-ring)]',
    isSelected
      ? 'border-[var(--an-border-color-strong)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground)]'
      : 'border-transparent border-t-[var(--an-tool-border-color)] bg-transparent text-[var(--an-foreground)] hover:border-[var(--an-tool-border-color)] hover:bg-[var(--an-background-tertiary)]',
  ].join(' ');

  return (
    <div
      className="transcript-sidebar agent-elements-transcript-sidebar flex h-full flex-1 overflow-hidden"
      data-testid="agent-elements-transcript-sidebar"
      data-component="TranscriptSidebar"
      data-agent-elements-shell="transcript-sidebar"
      data-session-id={sessionId}
      data-collapsed={isCollapsed ? 'true' : 'false'}
    >
      {!isCollapsed && (
        <div
          className="agent-elements-transcript-sidebar-panel box-border flex h-full w-full flex-col border-l border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)]"
          data-testid="agent-elements-transcript-sidebar-panel"
          data-agent-elements-shell="prompt-history-panel"
        >
          <div className="flex items-center gap-[var(--an-spacing-sm)] px-[var(--an-spacing-xl)] py-[var(--an-spacing-lg)] text-[var(--an-foreground)]">
            <span
              className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[var(--an-foreground-muted)]"
              aria-hidden="true"
            >
              <MaterialSymbol icon="history" size={18} />
            </span>
            <h3 className="m-0 text-sm font-medium leading-tight">
              Prompt History
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto py-[var(--an-spacing-sm)]">
            {prompts.length === 0 ? (
              <div
                className="px-[var(--an-spacing-xl)] py-[var(--an-spacing-xl)] text-sm leading-normal text-[var(--an-foreground-subtle)]"
                data-agent-elements-shell="prompt-history-empty"
              >
                No prompts yet. Start by entering a prompt.
              </div>
            ) : (
              <>
                {prompts.map((marker, index) => {
                  const isSelected = selectedPromptId === marker.id;

                  return (
                    <button
                      key={marker.id}
                      onClick={() => handlePromptClick(marker)}
                      className={promptRowClassName(isSelected)}
                      data-testid="agent-elements-prompt-history-row"
                      data-agent-elements-shell="prompt-history-row"
                      data-selected={isSelected ? 'true' : 'false'}
                      type="button"
                    >
                      <div className="flex w-full items-start gap-[var(--an-spacing-sm)]">
                        <span className="inline-flex min-h-5 shrink-0 items-center rounded-[var(--an-radius-sm)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xs)] font-mono text-xs font-semibold leading-none text-[var(--an-primary-color)]">
                          #{index + 1}
                        </span>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="line-clamp-3 break-words text-sm leading-normal text-[var(--an-foreground)]">
                            {marker.promptText}
                          </div>
                          <div className="mt-[var(--an-spacing-sm)] flex flex-wrap items-center gap-[var(--an-spacing-xs)] text-xs leading-tight text-[var(--an-foreground-subtle)]">
                            <span>{formatTimeAgo(marker.timestamp)}</span>
                            {marker.completionTimestamp && (
                              <>
                                <span aria-hidden="true">/</span>
                                <span className="text-[var(--an-foreground-muted)]">
                                  {formatDuration(marker.timestamp, marker.completionTimestamp)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
