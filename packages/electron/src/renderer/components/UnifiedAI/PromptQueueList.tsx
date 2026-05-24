import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface QueuedPromptAttachment {
  id: string;
  filename: string;
  type: 'image' | 'pdf' | 'document';
}

export interface QueuedPrompt {
  id: string;
  prompt: string;
  timestamp: number;
  attachments?: QueuedPromptAttachment[];
}

interface PromptQueueListProps {
  queue: QueuedPrompt[];
  onCancel: (id: string) => void;
  onEdit?: (id: string, prompt: string) => void;
  onSendNow?: (id: string, prompt: string) => void;
}

function AttachmentIndicator({ attachments }: { attachments: QueuedPromptAttachment[] }) {
  const imageCount = attachments.filter(a => a.type === 'image').length;
  const fileCount = attachments.length - imageCount;

  const label = attachments.map(a => a.filename).join(', ');

  return (
    <span
      className="prompt-queue-attachments agent-elements-prompt-queue-attachments agent-elements-status-pill shrink-0"
      data-file-count={fileCount}
      data-image-count={imageCount}
      data-testid="agent-elements-prompt-queue-attachments"
      title={label}
    >
      {imageCount > 0 && (
        <span className="prompt-queue-attachment-group inline-flex items-center gap-[var(--an-spacing-xxs)]">
          <MaterialSymbol icon="image" size={12} />
          {imageCount > 1 && <span>{imageCount}</span>}
        </span>
      )}
      {fileCount > 0 && (
        <span className="prompt-queue-attachment-group inline-flex items-center gap-[var(--an-spacing-xxs)]">
          <MaterialSymbol icon="description" size={12} />
          {fileCount > 1 && <span>{fileCount}</span>}
        </span>
      )}
    </span>
  );
}

/**
- PromptQueueList - Displays queued prompts waiting to be processed
 */
export function PromptQueueList({ queue, onCancel, onEdit, onSendNow }: PromptQueueListProps) {
  if (queue.length === 0) {
    return null;
  }

  return (
    <div
      className="prompt-queue-list agent-elements-prompt-queue border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-[var(--an-foreground)] [container-type:inline-size]"
      data-agent-elements-shell="prompt-queue"
      data-component="UnifiedAIPromptQueueList"
      data-queue-size={queue.length}
      data-testid="agent-elements-prompt-queue"
    >
      <div className="prompt-queue-header flex items-center mb-[var(--an-spacing-sm)]">
        <span
          className="prompt-queue-count agent-elements-status-pill font-mono"
          data-testid="agent-elements-prompt-queue-count"
        >
          {queue.length} queued
        </span>
      </div>
      <div className="prompt-queue-items flex flex-col gap-[var(--an-spacing-xs)]">
        {queue.map((item, index) => (
          <div
            key={item.id}
            className="prompt-queue-item agent-elements-prompt-queue-item flex min-w-0 items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-[13px] transition-[background-color,border-color] duration-150"
            data-item-index={index + 1}
            data-testid="agent-elements-prompt-queue-item"
          >
            <span className="prompt-queue-number agent-elements-status-pill shrink-0 font-mono">{index + 1}</span>
            <span
              className="prompt-queue-text min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[var(--an-foreground)] select-text"
              data-testid={`agent-elements-prompt-queue-text-${item.id}`}
              title={item.prompt}
            >
              {item.prompt}
            </span>
            {item.prompt.includes('\n') && (
              <span
                className="prompt-queue-lines agent-elements-status-pill shrink-0 text-[10px]"
                data-testid={`agent-elements-prompt-queue-lines-${item.id}`}
                title={`${item.prompt.split('\n\n').length} messages bundled`}
              >
                +{item.prompt.split('\n\n').length - 1} more
              </span>
            )}
            {item.attachments && item.attachments.length > 0 && (
              <AttachmentIndicator attachments={item.attachments} />
            )}
              {onSendNow && (
                <button
                  className="prompt-queue-send-now agent-elements-prompt-queue-action shrink-0 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]"
                  data-testid="prompt-queue-send-now"
                  onClick={() => onSendNow(item.id, item.prompt)}
                  title="Interrupt and send now"
                  type="button"
              >
                <MaterialSymbol icon="bolt" size={14} />
              </button>
            )}
            {onEdit && (
              <button
                className="prompt-queue-edit agent-elements-prompt-queue-action shrink-0 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]"
                onClick={() => onEdit(item.id, item.prompt)}
                title="Edit this prompt"
                type="button"
              >
                <MaterialSymbol icon="edit" size={14} />
              </button>
            )}
            <button
              className="prompt-queue-cancel agent-elements-prompt-queue-action shrink-0 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]"
              onClick={() => onCancel(item.id)}
              title="Cancel this prompt"
              type="button"
            >
              <MaterialSymbol icon="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
