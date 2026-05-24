import React, { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { basename } from 'pathe';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { store } from '@nimbalyst/runtime/store';

import { customEditorRegistry } from '../CustomEditors/registry';
import { fileChangedOnDiskAtomFamily } from '../../store/atoms/fileWatch';
import { useTheme } from '../../hooks/useTheme';
import { createEmbeddedFileHost } from '../EmbedFrame/createEmbeddedFileHost';

const DEFAULT_PREVIEW_HEIGHT = 360;

type ReadFileResult =
  | null
  | { success: true; content: string; isBinary: boolean; detectedEncoding?: string }
  | { success: false; error: string };

async function readFileFromDisk(absolutePath: string): Promise<string> {
  const api = (window as unknown as {
    electronAPI?: {
      readFileContent?: (
        path: string,
        opts?: { binary?: boolean },
      ) => Promise<ReadFileResult>;
    };
  }).electronAPI;
  if (!api?.readFileContent) {
    throw new Error('readFileContent IPC not available');
  }
  const result = await api.readFileContent(absolutePath);
  if (!result) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  if (result.success === false) {
    throw new Error(result.error || `Failed to read ${absolutePath}`);
  }
  return result.content;
}

class TranscriptEmbeddedFileErrorBoundary extends Component<
  { children: ReactNode; filePath: string },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('[TranscriptEmbeddedFileCard] Failed to render preview for', this.props.filePath, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="transcript-embedded-file__error agent-elements-transcript-embedded-file-error flex items-center gap-[var(--an-spacing-sm)] border-t border-[var(--an-tool-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-md)] text-sm text-[var(--an-diff-removed-text)]"
          data-agent-elements-shell="transcript-embedded-file-error"
        >
          <MaterialSymbol icon="error" size={16} />
          <span>{this.state.error?.message ?? 'Failed to render preview'}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

interface TranscriptEmbeddedFileCardProps {
  filePath: string;
  onOpenFile?: (filePath: string) => void;
  defaultExpanded?: boolean;
}

export const TranscriptEmbeddedFileCard: React.FC<TranscriptEmbeddedFileCardProps> = ({
  filePath,
  onOpenFile,
  defaultExpanded = false,
}) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  // Click-to-activate gate. Mirrors EmbedFrame's shield: until the user
  // clicks into the preview, a transparent shield swallows pointer +
  // wheel events so scrolling over the embed scrolls the transcript
  // instead of being captured by the embedded editor (e.g. Excalidraw's
  // wheel-zoom, RevoGrid's wheel-scroll). Once active, the shield drops
  // out and the editor receives input directly until the user clicks
  // elsewhere.
  const [isActive, setIsActive] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (defaultExpanded) {
      setIsExpanded(true);
    }
  }, [defaultExpanded, filePath]);

  // Deactivate when collapsed so the next expansion starts in the
  // scroll-passthrough state.
  useEffect(() => {
    if (!isExpanded && isActive) {
      setIsActive(false);
    }
  }, [isExpanded, isActive]);

  // Click-outside listener: when active, any pointerdown outside the card
  // returns it to the inactive (shielded) state.
  useEffect(() => {
    if (!isActive) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = cardRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setIsActive(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [isActive]);

  const registration = useMemo(
    () => customEditorRegistry.findRegistrationForFile(filePath),
    [filePath],
  );
  const isSupportedFile = !!registration?.supportsTranscriptEmbed;

  const themeRef = useRef(theme);
  themeRef.current = theme;
  const themeListeners = useRef(new Set<(theme: string) => void>());
  useEffect(() => {
    themeListeners.current.forEach((cb) => cb(theme));
  }, [theme]);

  const host = useMemo(() => {
    if (!isSupportedFile || !registration) return null;

    return createEmbeddedFileHost({
      embedPath: filePath,
      isActive: false,
      workspaceId: (window as unknown as { __workspacePath?: string }).__workspacePath,
      getTheme: () => themeRef.current,
      subscribeToThemeChanges(cb) {
        themeListeners.current.add(cb);
        return () => {
          themeListeners.current.delete(cb);
        };
      },
      subscribeToFileChanges(path, cb) {
        const atom = fileChangedOnDiskAtomFamily(path);
        return store.sub(atom, () => {
          readFileFromDisk(path)
            .then(cb)
            .catch((error) => {
              console.error('[TranscriptEmbeddedFileCard] Failed to reload preview for', path, error);
            });
        });
      },
      readFile: readFileFromDisk,
      saveFile: async () => {},
      getReadOnly: () => true,
      subscribeToReadOnlyChanges: () => () => {},
      onDirtyChange: () => {},
      subscribeToSaveRequests: () => () => {},
    });
  }, [filePath, isSupportedFile, registration]);

  const handleOpenFile = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpenFile?.(filePath);
  }, [filePath, onOpenFile]);

  const handleShieldClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setIsActive(true);
  }, []);

  const handleShieldDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onOpenFile?.(filePath);
  }, [filePath, onOpenFile]);

  if (!isSupportedFile) {
    return null;
  }

  const canRenderPreview = isSupportedFile && host != null;
  const ExtensionComponent = registration?.component;
  const editorLabel = registration?.name || 'Rendered file';
  const previewHeight = registration?.transcriptEmbedHeight ?? DEFAULT_PREVIEW_HEIGHT;

  return (
    <div
      ref={cardRef}
      className={`transcript-embedded-file agent-elements-transcript-embedded-file agent-elements-tool-card mt-[var(--an-spacing-sm)] !gap-0 !p-0 rounded-[var(--an-tool-border-radius)] border bg-[var(--an-tool-background)] text-[var(--an-tool-color)] [container-type:inline-size] ${
        isActive
          ? 'border-[var(--an-primary-color)]'
          : 'border-[var(--an-tool-border-color)]'
      }`}
      data-agent-elements-shell="transcript-embedded-file"
      data-component="UnifiedAITranscriptEmbeddedFileCard"
      data-testid="agent-elements-transcript-embedded-file"
      data-file-path={filePath}
      data-active={isActive ? 'true' : 'false'}
    >
      <div
        className="transcript-embedded-file__header agent-elements-transcript-embedded-file-header flex min-h-[34px] items-center gap-[var(--an-spacing-sm)] px-[var(--an-spacing-md)] py-[var(--an-spacing-xs)]"
        data-agent-elements-shell="transcript-embedded-file-header"
        data-testid="agent-elements-transcript-embedded-file-header"
      >
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="agent-elements-transcript-embedded-file-toggle flex min-w-0 flex-1 cursor-pointer items-center gap-[var(--an-spacing-sm)] rounded-[calc(var(--an-tool-border-radius)_-_4px)] border-none bg-transparent p-0 text-left text-sm text-[var(--an-tool-color)] outline-none transition-[background-color,color] duration-150 ease-out hover:text-[var(--an-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
          aria-expanded={isExpanded}
        >
          <MaterialSymbol
            icon={isExpanded ? 'expand_more' : 'chevron_right'}
            size={16}
            className="shrink-0 text-[var(--an-foreground-subtle)]"
          />
          <MaterialSymbol icon="preview" size={16} className="shrink-0 text-[var(--an-primary-color)]" />
          <span className="agent-elements-transcript-embedded-file-title min-w-0 truncate font-medium">
            {editorLabel}
          </span>
          <span className="agent-elements-transcript-embedded-file-filename min-w-0 truncate text-xs text-[var(--an-tool-color-muted)]">
            {basename(filePath)}
          </span>
        </button>
        {onOpenFile && (
          <button
            type="button"
            className="agent-elements-transcript-embedded-file-open flex h-7 w-7 cursor-pointer items-center justify-center rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-subtle)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            onClick={handleOpenFile}
            title="Open file"
            aria-label="Open file"
            data-agent-elements-shell="transcript-embedded-file-open"
          >
            <MaterialSymbol icon="open_in_new" size={14} />
          </button>
        )}
      </div>

      {isExpanded && (
        <div
          className="transcript-embedded-file__body agent-elements-transcript-embedded-file-body relative isolate border-t border-[var(--an-tool-border-color)] bg-[var(--an-background)]"
          style={{ height: `${previewHeight}px` }}
          data-agent-elements-shell="transcript-embedded-file-body"
          data-testid="agent-elements-transcript-embedded-file-body"
        >
          {!canRenderPreview || !ExtensionComponent || !host ? (
            <div
              className="transcript-embedded-file__placeholder agent-elements-transcript-embedded-file-placeholder flex h-full items-center justify-center px-[var(--an-spacing-xl)] text-center text-sm text-[var(--an-tool-color-muted)]"
              data-agent-elements-shell="transcript-embedded-file-placeholder"
            >
              No editor is available to render this file inline.
            </div>
          ) : (
            <TranscriptEmbeddedFileErrorBoundary filePath={filePath}>
              {/* `inert` on the editor wrapper blocks pointer + wheel
                * events even from editor canvases that paint above the
                * shield (e.g. Excalidraw's high-z-index canvas). The
                * shield on top still provides the click-to-activate
                * affordance. */}
              <div
                className="transcript-embedded-file__canvas agent-elements-transcript-embedded-file-canvas h-full overflow-hidden"
                data-agent-elements-shell="transcript-embedded-file-canvas"
                {...(isActive ? {} : { inert: '' as unknown as boolean })}
              >
                <React.Suspense
                  fallback={
                    <div
                      className="transcript-embedded-file__loading agent-elements-transcript-embedded-file-loading flex h-full items-center justify-center text-sm text-[var(--an-tool-color-muted)]"
                      data-agent-elements-shell="transcript-embedded-file-loading"
                    >
                      Loading preview...
                    </div>
                  }
                >
                  <ExtensionComponent host={host} />
                </React.Suspense>
              </div>
              {!isActive && (
                <div
                  className="transcript-embedded-file__shield agent-elements-transcript-embedded-file-shield absolute inset-0 z-[2] cursor-pointer bg-transparent"
                  data-agent-elements-shell="transcript-embedded-file-shield"
                  data-testid="transcript-embedded-file-shield"
                  onClick={handleShieldClick}
                  onDoubleClick={handleShieldDoubleClick}
                  aria-hidden="true"
                />
              )}
            </TranscriptEmbeddedFileErrorBoundary>
          )}
        </div>
      )}
    </div>
  );
};
