import React from 'react';
import type { ChatAttachment } from '@nimbalyst/runtime';
import { AttachmentPreview, ProcessingAttachmentPreview } from './AttachmentPreview';

export interface ProcessingAttachment {
  id: string;
  filename: string;
}

interface AttachmentPreviewListProps {
  attachments: ChatAttachment[];
  onRemove: (attachmentId: string) => void;
  onConvertToText?: (attachment: ChatAttachment) => void;
  processingAttachments?: ProcessingAttachment[];
}

export function AttachmentPreviewList({
  attachments,
  onRemove,
  onConvertToText,
  processingAttachments = [],
}: AttachmentPreviewListProps) {
  if (attachments.length === 0 && processingAttachments.length === 0) {
    return null;
  }

  return (
    <div
      className="attachment-preview-list agent-elements-attachment-preview-list flex flex-wrap gap-[var(--an-spacing-sm)]"
      data-testid="agent-elements-attachment-preview-list"
      data-component="AttachmentPreviewList"
      data-agent-elements-shell="attachment-preview-list"
      data-attachment-count={attachments.length}
      data-processing-count={processingAttachments.length}
    >
      {processingAttachments.map(processing => (
        <ProcessingAttachmentPreview
          key={processing.id}
          filename={processing.filename}
        />
      ))}
      {attachments.map(attachment => (
        <AttachmentPreview
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
          onConvertToText={onConvertToText}
        />
      ))}
    </div>
  );
}
