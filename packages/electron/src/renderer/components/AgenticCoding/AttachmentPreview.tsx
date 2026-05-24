import React, { useState, useEffect, useMemo } from 'react';
import type { ChatAttachment } from '@nimbalyst/runtime';
import { getFileIcon, MaterialSymbol } from '@nimbalyst/runtime';
import { nimAssetUrl } from '../../utils/assetUrl';
import { FloatingPortal, useFloatingMenu, virtualElement } from '../../hooks/useFloatingMenu';

interface ProcessingAttachmentPreviewProps {
  filename: string;
}

/**
 * Shows a loading indicator for an attachment that is being processed (e.g., compressed).
 */
export function ProcessingAttachmentPreview({ filename }: ProcessingAttachmentPreviewProps) {
  return (
    <div
      className="attachment-preview attachment-preview-processing agent-elements-attachment-preview agent-elements-attachment-processing flex min-w-[200px] max-w-[250px] items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-sm)] text-[var(--an-foreground)] opacity-80"
      data-testid="agent-elements-attachment-processing"
      data-component="ProcessingAttachmentPreview"
      data-agent-elements-shell="attachment-processing"
    >
      <div className="attachment-preview-thumbnail agent-elements-attachment-thumbnail flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[var(--an-border-color)] bg-[var(--an-background)]">
        <div
          className="attachment-preview-spinner h-5 w-5 animate-spin rounded-full border-2 border-[var(--an-border-color)] border-t-[var(--an-primary-color)]"
          aria-hidden="true"
        />
      </div>
      <div className="attachment-preview-info agent-elements-attachment-info flex min-w-0 flex-1 flex-col gap-[var(--an-spacing-xxs)]">
        <div
          className="attachment-preview-filename select-text overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium leading-snug text-[var(--an-foreground)]"
          title={filename}
        >
          {filename}
        </div>
        <div className="attachment-preview-size attachment-preview-processing-text text-[11px] leading-snug text-[var(--an-foreground-subtle)]">
          Processing
        </div>
      </div>
    </div>
  );
}

interface AttachmentPreviewProps {
  attachment: ChatAttachment;
  onRemove: (attachmentId: string) => void;
  onConvertToText?: (attachment: ChatAttachment) => void;
}

export function AttachmentPreview({ attachment, onRemove, onConvertToText }: AttachmentPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const contextMenuReference = useMemo(
    () => showContextMenu ? virtualElement(contextMenuPosition.x, contextMenuPosition.y) : null,
    [contextMenuPosition.x, contextMenuPosition.y, showContextMenu]
  );
  const contextMenu = useFloatingMenu({
    placement: 'right-start',
    offsetPx: 2,
    reference: contextMenuReference,
    open: showContextMenu,
    onOpenChange: setShowContextMenu,
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle Escape key to close expanded image
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const handleThumbnailClick = () => {
    if (attachment.type === 'image') {
      setIsExpanded(true);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Only show context menu for document attachments (text files)
    if (attachment.type !== 'document' || !onConvertToText) return;

    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleConvertToText = () => {
    setShowContextMenu(false);
    if (onConvertToText) {
      onConvertToText(attachment);
    }
  };

  return (
    <>
      <div
        className="attachment-preview agent-elements-attachment-preview flex min-w-[200px] max-w-[250px] items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-sm)] text-[var(--an-foreground)] hover:bg-[var(--an-background-tertiary)]"
        data-testid="agent-elements-attachment-preview"
        data-component="AttachmentPreview"
        data-agent-elements-shell="attachment-preview"
        data-attachment-type={attachment.type}
        onContextMenu={handleContextMenu}
      >
        <button
          type="button"
          className="attachment-preview-thumbnail agent-elements-attachment-thumbnail flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-0 text-[var(--an-foreground-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]"
          data-testid="agent-elements-attachment-thumbnail"
          data-agent-elements-shell="attachment-thumbnail"
          onClick={handleThumbnailClick}
          aria-label={`${attachment.filename} attachment preview`}
          style={{ cursor: attachment.type === 'image' ? 'pointer' : attachment.type === 'document' ? 'context-menu' : 'default' }}
          title={attachment.type === 'image' ? 'Click to enlarge' : attachment.type === 'document' ? 'Right-click for options' : undefined}
        >
          {attachment.type === 'image' ? (
            <img
              src={nimAssetUrl(attachment.filepath)}
              alt={attachment.filename}
              className="attachment-preview-image w-full h-full object-cover"
            />
          ) : (
            <span className="attachment-preview-icon text-[20px] text-[var(--an-foreground-muted)]">
              {getFileIcon(attachment.filename, 18)}
            </span>
          )}
        </button>

        <div className="attachment-preview-info agent-elements-attachment-info flex min-w-0 flex-1 flex-col gap-[var(--an-spacing-xxs)]">
          <div
            className="attachment-preview-filename select-text overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium leading-snug text-[var(--an-foreground)]"
            title={attachment.filename}
          >
            {attachment.filename}
          </div>
          <div className="attachment-preview-size text-[11px] leading-snug text-[var(--an-foreground-subtle)]">
            {formatFileSize(attachment.size)}
          </div>
        </div>

        <button
          className="attachment-preview-remove agent-elements-attachment-remove flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-spacing-xs)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-subtle)] hover:border-[var(--an-border-color)] hover:bg-[var(--an-background)] hover:text-[var(--an-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]"
          onClick={() => onRemove(attachment.id)}
          title="Remove attachment"
          aria-label="Remove attachment"
          type="button"
        >
          <MaterialSymbol icon="close" size={16} />
        </button>
      </div>

      {/* Expanded image modal */}
      {isExpanded && attachment.type === 'image' && (
        <div
          className="attachment-preview-modal-overlay agent-elements-attachment-modal-overlay fixed inset-0 z-[10000] flex items-center justify-center bg-[color-mix(in_srgb,var(--an-background)_88%,transparent)] p-[var(--an-spacing-xxl)]"
          data-testid="agent-elements-attachment-modal"
          data-agent-elements-shell="attachment-image-modal"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="attachment-preview-modal agent-elements-attachment-modal flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-[var(--an-spacing-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="attachment-preview-modal-close agent-elements-attachment-modal-close self-end flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-spacing-sm)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-0 text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]"
              onClick={() => setIsExpanded(false)}
              aria-label="Close"
              type="button"
            >
              <MaterialSymbol icon="close" size={20} />
            </button>
            <img
              src={nimAssetUrl(attachment.filepath)}
              alt={attachment.filename}
              className="attachment-preview-modal-image max-h-[80vh] max-w-[90vw] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] object-contain"
            />
            <div
              className="attachment-preview-modal-caption agent-elements-attachment-modal-caption max-w-[90vw] overflow-hidden text-ellipsis whitespace-nowrap rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xl)] py-[var(--an-spacing-sm)] text-center text-sm text-[var(--an-foreground)]"
              data-testid="agent-elements-attachment-modal-caption"
            >
              {attachment.filename}
            </div>
          </div>
        </div>
      )}

      {/* Context menu for text attachments */}
      {showContextMenu && (
        <FloatingPortal>
          <div
            ref={contextMenu.refs.setFloating}
            style={contextMenu.floatingStyles}
            {...contextMenu.getFloatingProps()}
            className="attachment-context-menu agent-elements-attachment-context-menu agent-elements-tool-card z-[10000] min-w-[150px] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xs)] text-[var(--an-foreground)]"
            data-testid="agent-elements-attachment-context-menu"
            data-agent-elements-shell="attachment-context-menu"
            role="menu"
          >
            <button
              className="attachment-context-menu-item agent-elements-attachment-context-menu-item flex w-full cursor-pointer items-center gap-[var(--an-spacing-sm)] rounded-[calc(var(--an-tool-border-radius)_-_4px)] border-none bg-transparent px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-left text-[13px] text-[var(--an-foreground)] hover:bg-[var(--an-background-tertiary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]"
              onClick={handleConvertToText}
              role="menuitem"
              type="button"
            >
              <span aria-hidden="true">
                <MaterialSymbol icon="text_snippet" size={16} />
              </span>
              <span>Insert as text</span>
            </button>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
