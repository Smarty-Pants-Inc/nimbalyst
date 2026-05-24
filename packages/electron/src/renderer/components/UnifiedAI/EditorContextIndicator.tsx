import React, { useSyncExternalStore, useCallback } from 'react';
import {
  getEditorContext,
  subscribeEditorContext,
  getEditorContextSnapshot,
} from '../../stores/editorContextStore';

interface EditorContextIndicatorProps {
  /** Current document file path */
  currentFilePath?: string;
  /** Timestamp of the last user message in the session (or null if no messages) */
  lastUserMessageTimestamp: number | null;
}

/**
 * Indicator that shows when an extension has pushed context to the chat.
 * Shows the context label (e.g., "+ Screen: Login Page") between
 * attachments and the prompt box.
 */
export const EditorContextIndicator: React.FC<EditorContextIndicatorProps> = ({
  currentFilePath,
  lastUserMessageTimestamp,
}) => {
  // Subscribe to editor context changes
  useSyncExternalStore(subscribeEditorContext, getEditorContextSnapshot);

  const entry = getEditorContext();

  const shouldShow = useCallback((): boolean => {
    if (!entry) return false;

    // Must match current file
    if (currentFilePath && entry.filePath !== currentFilePath) return false;

    // If no user messages yet, show (new session)
    if (!lastUserMessageTimestamp) return true;

    // Show if context was set after the last prompt
    return entry.timestamp > lastUserMessageTimestamp;
  }, [entry, currentFilePath, lastUserMessageTimestamp]);

  if (!shouldShow()) return null;

  const chipClass = [
    'editor-context-indicator',
    'agent-elements-context-chip',
    'agent-elements-editor-context-indicator',
    'mb-[var(--an-spacing-xs)] flex items-center gap-[var(--an-spacing-xs)]',
    'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[var(--an-border-color)]',
    'bg-[var(--an-background-secondary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]',
    'text-xs text-[var(--an-foreground-muted)]',
  ].join(' ');

  return (
    <div
      className={chipClass}
      title={entry!.context.description}
      data-agent-elements-shell="editor-context-chip"
      data-component="UnifiedAIEditorContextIndicator"
    >
      <span>+ {entry!.context.label}</span>
    </div>
  );
};
