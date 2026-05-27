/**
 * Custom widget for the capture_editor_screenshot MCP tool
 *
 * Displays a preview of the captured editor screenshot with:
 * - Large inline image preview (click to open lightbox)
 * - File path information
 * - Success/error status badge
 * - Full-size lightbox modal
 *
 * Handles both inline base64 images and persisted-output files
 * (when Claude Code saves large outputs to files).
 */

import React, { useState, useEffect } from 'react';
import type { CustomToolWidgetProps } from './index';
import { parseToolResult } from '../../../../ai/server/transcript/toolResultParser';
import { AgentStatusPill, AgentToolCard, type AgentStatusTone, type AgentToolStatus } from '../../../AgentElements/AgentElementsPrimitives';
import { MaterialSymbol } from '../../../icons/MaterialSymbol';

/**
 * Extract a display name from a file path
 * e.g., "/path/to/my_mockup.mockup.html" -> "my_mockup.mockup.html"
 *       "/path/to/diagram.excalidraw" -> "diagram.excalidraw"
 */
function extractFileName(filePath: string): string {
  if (!filePath) return 'screenshot';

  // Get the filename from the path
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1] || '';

  return filename || 'screenshot';
}

/**
 * Extract the base64 image data from the tool result
 *
 * The MCP format returns: { type: 'image', source: { type: 'base64', data: '...', media_type: 'image/png' } }
 */
function extractImageData(result: any): { imageBase64: string; mimeType: string } | null {
  if (!result) return null;

  // Handle array of content blocks (MCP format)
  if (Array.isArray(result)) {
    for (const block of result) {
      // New MCP format: { type: 'image', source: { type: 'base64', data: '...', media_type: '...' } }
      if (block.type === 'image' && block.source?.data) {
        return {
          imageBase64: block.source.data,
          mimeType: block.source.media_type || 'image/png'
        };
      }
      // Old format: { type: 'image', data: '...', mimeType: '...' }
      if (block.type === 'image' && block.data) {
        return {
          imageBase64: block.data,
          mimeType: block.mimeType || 'image/png'
        };
      }
    }
    return null;
  }

  // Handle content wrapper object
  if (result.content && Array.isArray(result.content)) {
    for (const block of result.content) {
      // New MCP format
      if (block.type === 'image' && block.source?.data) {
        return {
          imageBase64: block.source.data,
          mimeType: block.source.media_type || 'image/png'
        };
      }
      // Old format
      if (block.type === 'image' && block.data) {
        return {
          imageBase64: block.data,
          mimeType: block.mimeType || 'image/png'
        };
      }
    }
    return null;
  }

  // Handle direct image data
  if (result.imageBase64) {
    return {
      imageBase64: result.imageBase64,
      mimeType: result.mimeType || 'image/png'
    };
  }

  return null;
}

/**
 * Check if the tool result contains a persisted-output reference
 * Claude Code saves large outputs to files with this format:
 * <persisted-output>Output too large (2MB). Full output saved to: /path/to/file</persisted-output>
 */
function isPersistedOutput(result: any): boolean {
  if (typeof result === 'string') {
    return result.includes('<persisted-output>');
  }

  // Handle array of content blocks
  if (Array.isArray(result)) {
    for (const block of result) {
      if (block.type === 'text' && typeof block.text === 'string' && block.text.includes('<persisted-output>')) {
        return true;
      }
    }
  }

  // Handle content wrapper object
  if (result?.content && Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block.type === 'text' && typeof block.text === 'string' && block.text.includes('<persisted-output>')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract the file path from a persisted-output reference
 */
function extractPersistedFilePath(result: any): string | null {
  const extractFromText = (text: string): string | null => {
    const match = text.match(/<persisted-output>[^]*?Full output saved to:\s*([^\s<]+)/);
    return match ? match[1] : null;
  };

  if (typeof result === 'string') {
    return extractFromText(result);
  }

  // Handle array of content blocks
  if (Array.isArray(result)) {
    for (const block of result) {
      if (block.type === 'text' && typeof block.text === 'string') {
        const path = extractFromText(block.text);
        if (path) return path;
      }
    }
  }

  // Handle content wrapper object
  if (result?.content && Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        const path = extractFromText(block.text);
        if (path) return path;
      }
    }
  }

  return null;
}

/**
 * Parse image data from a persisted output file's JSON content
 */
function parsePersistedImageData(fileContent: string): { imageBase64: string; mimeType: string } | null {
  try {
    const parsed = JSON.parse(fileContent);

    // The file contains an array of MCP content blocks
    const blocks = Array.isArray(parsed) ? parsed : parsed?.content;
    if (!Array.isArray(blocks)) return null;

    for (const block of blocks) {
      // MCP format: { type: 'image', source: { type: 'base64', data: '...', media_type: '...' } }
      if (block.type === 'image' && block.source?.data) {
        return {
          imageBase64: block.source.data,
          mimeType: block.source.media_type || 'image/png'
        };
      }
      // Old format: { type: 'image', data: '...', mimeType: '...' }
      if (block.type === 'image' && block.data) {
        return {
          imageBase64: block.data,
          mimeType: block.mimeType || 'image/png'
        };
      }
    }
  } catch {
    // Failed to parse JSON
  }

  return null;
}

/**
 * Check if the tool result indicates an error
 */
function isToolError(result: any, message: any): boolean {
  // Check message-level error flag
  if (message.isError) return true;

  // Check result-level isError flag (MCP response format)
  if (result?.isError === true) return true;

  return false;
}

function formatUnknownError(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'message' in value && typeof (value as { message?: unknown }).message === 'string') {
    return (value as { message: string }).message;
  }
  return 'Screenshot capture failed';
}

/**
 * Extract error message from tool result
 */
function extractErrorMessage(result: any, message: any): string | null {
  // Only extract error message if there's actually an error
  if (!isToolError(result, message)) return null;

  if (message.errorMessage) {
    return message.errorMessage;
  }

  if (!result) return null;

  // Handle array of content blocks - look for error text
  if (Array.isArray(result)) {
    for (const block of result) {
      if (block.type === 'text' && typeof block.text === 'string') {
        return block.text;
      }
    }
  }

  // Handle content wrapper object
  if (result.content && Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        return block.text;
      }
    }
  }

  // Handle direct error field
  if (result.error) {
    return formatUnknownError(result.error);
  }

  return null;
}

function getCardStatus(isLoading: boolean, hasError: boolean, hasImage: boolean): AgentToolStatus {
  if (isLoading) return 'running';
  if (hasError) return 'error';
  if (hasImage) return 'completed';
  return 'running';
}

function getStatusTone(status: AgentToolStatus): AgentStatusTone {
  if (status === 'completed') return 'success';
  if (status === 'error') return 'error';
  if (status === 'running') return 'running';
  return 'neutral';
}

function getStatusLabel(status: AgentToolStatus): string {
  if (status === 'completed') return 'Captured';
  if (status === 'error') return 'Failed';
  if (status === 'running') return 'Loading';
  return 'Pending';
}

export const EditorScreenshotWidget: React.FC<CustomToolWidgetProps> = ({
  message,
  readFile
}) => {
  const [showLightbox, setShowLightbox] = useState(false);
  const [loadingPersistedFile, setLoadingPersistedFile] = useState(false);
  const [persistedImageData, setPersistedImageData] = useState<{ imageBase64: string; mimeType: string } | null>(null);
  const [persistedLoadError, setPersistedLoadError] = useState<string | null>(null);

  const tool = message.toolCall;

  // Canonical transcript stores tool results as strings -- JSON-stringified for
  // MCP content arrays (including image blocks). Parse once so the array/object
  // helpers below can match.
  const parsedResult = tool ? parseToolResult(tool.result) : undefined;

  // Check if result is a persisted-output reference
  const isPersisted = tool ? isPersistedOutput(parsedResult) : false;
  const persistedFilePath = isPersisted && tool ? extractPersistedFilePath(parsedResult) : null;

  // Load image data from persisted file
  useEffect(() => {
    if (!persistedFilePath) return;
    if (!readFile) {
      setPersistedLoadError('File reading not available');
      return;
    }

    const loadPersistedFile = async () => {
      setLoadingPersistedFile(true);
      setPersistedLoadError(null);

      try {
        const result = await readFile(persistedFilePath);
        if (!result.success || !result.content) {
          throw new Error(result.error || 'Failed to read file');
        }

        const imageData = parsePersistedImageData(result.content);
        if (!imageData) {
          throw new Error('Could not parse image data from file');
        }

        setPersistedImageData(imageData);
      } catch (err) {
        setPersistedLoadError(err instanceof Error ? err.message : 'Failed to load image');
      } finally {
        setLoadingPersistedFile(false);
      }
    };

    loadPersistedFile();
  }, [persistedFilePath, readFile]);

  if (!tool) return null;

  // Extract file path from arguments and get display name
  const args = tool.arguments as Record<string, any> | undefined;
  const filePath = (args?.file_path || args?.filePath || '') as string;
  const fileName = extractFileName(filePath);

  // Extract image data from result (either inline or from persisted file)
  const inlineImageData = extractImageData(parsedResult);
  const imageData = inlineImageData || persistedImageData;

  const hasError = isToolError(parsedResult, message);
  const errorMessage = extractErrorMessage(parsedResult, message) || persistedLoadError;
  const isErrorState = hasError || !!persistedLoadError;

  // Build image source URL
  const imageSrc = imageData
    ? `data:${imageData.mimeType};base64,${imageData.imageBase64}`
    : null;
  const cardStatus = getCardStatus(loadingPersistedFile, isErrorState, !!imageSrc);
  const statusLabel = getStatusLabel(cardStatus);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!showLightbox) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLightbox(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLightbox]);

  return (
    <>
      <AgentToolCard
        className="editor-screenshot-widget agent-elements-editor-screenshot-card"
        data-agent-elements-shell="editor-screenshot-card"
        data-component="RichTranscriptAgentElementsEditorScreenshot"
        data-testid="agent-elements-editor-screenshot-card"
        icon={<MaterialSymbol icon="screenshot_monitor" size={16} />}
        status={cardStatus}
        subtitle={(
          <span className="agent-elements-editor-screenshot-file font-mono" title={filePath || fileName}>
            {fileName}
          </span>
        )}
        title="Editor Screenshot"
        trailing={(
          <AgentStatusPill tone={getStatusTone(cardStatus)}>
            <span data-testid="agent-elements-editor-screenshot-status">{statusLabel}</span>
          </AgentStatusPill>
        )}
      >
        <div
          className="agent-elements-editor-screenshot-body flex flex-col gap-[var(--an-spacing-sm)]"
          data-agent-elements-shell="editor-screenshot-body"
          data-testid="agent-elements-editor-screenshot-body"
        >
          {imageSrc && !loadingPersistedFile ? (
            <button
              className="agent-elements-editor-screenshot-preview block w-full cursor-pointer overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-background)] p-0 transition-opacity duration-200 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline,var(--an-tool-border-color))]"
              data-testid="agent-elements-editor-screenshot-preview"
              onClick={() => setShowLightbox(true)}
              type="button"
            >
              <img
                src={imageSrc}
                alt={fileName}
                className="agent-elements-editor-screenshot-image h-auto max-h-[25rem] w-full object-contain object-left-top"
              />
            </button>
          ) : null}

          {loadingPersistedFile ? (
            <div
              className="agent-elements-editor-screenshot-loading flex items-center gap-[var(--an-spacing-xs)] rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-sm text-[var(--an-tool-color-muted)]"
              data-testid="agent-elements-editor-screenshot-loading"
            >
              <span aria-hidden="true">
                <MaterialSymbol icon="hourglass_empty" size={16} />
              </span>
              Loading persisted screenshot output
            </div>
          ) : null}

          {errorMessage ? (
            <div
              className="agent-elements-editor-screenshot-error rounded-[var(--an-spacing-xs)] border border-[color-mix(in_srgb,var(--an-diff-removed-text)_30%,transparent)] bg-[var(--an-diff-removed-bg)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-sm leading-[1.45] text-[var(--an-diff-removed-text)] select-text"
              data-testid="agent-elements-editor-screenshot-error"
            >
              {errorMessage}
            </div>
          ) : null}

          {!imageSrc && !loadingPersistedFile && !errorMessage ? (
            <div
              className="agent-elements-editor-screenshot-empty rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-sm text-[var(--an-tool-color-muted)]"
              data-testid="agent-elements-editor-screenshot-empty"
            >
              Waiting for screenshot output
            </div>
          ) : null}
        </div>
      </AgentToolCard>

      {showLightbox && imageSrc && (
        <div
          className="agent-elements-editor-screenshot-lightbox fixed inset-0 z-[9999] flex items-center justify-center bg-[color-mix(in_srgb,var(--an-background)_92%,transparent)] p-[var(--an-spacing-xxl)]"
          data-agent-elements-shell="editor-screenshot-lightbox"
          data-testid="agent-elements-editor-screenshot-lightbox"
          onClick={() => setShowLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Editor screenshot preview"
        >
          <div
            className="agent-elements-editor-screenshot-lightbox-panel relative flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] p-[var(--an-spacing-sm)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="agent-elements-editor-screenshot-lightbox-close absolute right-[var(--an-spacing-sm)] top-[var(--an-spacing-sm)] z-10 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-radius-sm)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] p-0 text-[var(--an-tool-color-muted)] transition-colors duration-200 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-tool-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline,var(--an-tool-border-color))]"
              data-testid="agent-elements-editor-screenshot-lightbox-close"
              onClick={() => setShowLightbox(false)}
              aria-label="Close (Escape)"
              title="Close (Escape)"
              type="button"
            >
              <span aria-hidden="true">
                <MaterialSymbol icon="close" size={18} />
              </span>
            </button>
            <img
              src={imageSrc}
              alt={fileName}
              className="agent-elements-editor-screenshot-lightbox-image max-h-[calc(90vh-5rem)] max-w-full rounded-[var(--an-tool-border-radius)] object-contain"
            />
            <div
              className="agent-elements-editor-screenshot-caption max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-[var(--an-spacing-xs)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] font-mono text-xs text-[var(--an-tool-color-muted)]"
              title={filePath || fileName}
            >
              {fileName}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/** @deprecated Use EditorScreenshotWidget instead */
export const MockupScreenshotWidget = EditorScreenshotWidget;
