import React from 'react';

const DIFF_VIEWER_ROOT_CLASS =
  'diff-viewer agent-elements-diff-viewer flex max-w-full flex-col overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] font-mono text-xs leading-normal text-[var(--an-tool-color)]';
const DIFF_VIEWER_HEADER_CLASS =
  'diff-file-header agent-elements-diff-viewer-header flex shrink-0 items-center border-b border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-[0.7rem] font-medium text-[var(--an-tool-color-muted)]';
const DIFF_VIEWER_PATH_BUTTON_CLASS =
  'diff-file-header-link agent-elements-diff-viewer-path min-w-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left font-mono text-[var(--an-primary-color)] no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]';
const DIFF_VIEWER_CONTENT_CLASS =
  'diff-content agent-elements-diff-viewer-content min-h-0 flex-1 overflow-auto bg-[var(--an-code-background)] py-[var(--an-spacing-xs)] text-[var(--an-code-color)]';
const DIFF_VIEWER_CONTENT_INNER_CLASS =
  'diff-content-inner agent-elements-diff-viewer-content-inner inline-block min-w-full';
const DIFF_LINE_BASE_CLASS =
  'diff-line agent-elements-diff-viewer-line flex min-h-6 items-start whitespace-pre px-[var(--an-spacing-sm)] py-0.5 leading-normal motion-safe:transition-colors motion-safe:duration-150';
const DIFF_LINE_MARKER_CLASS =
  'diff-line-marker agent-elements-diff-viewer-line-marker inline-block w-6 shrink-0 select-none text-center font-semibold';
const DIFF_LINE_CONTENT_CLASS =
  'diff-line-content agent-elements-diff-viewer-line-content whitespace-pre pl-[var(--an-spacing-xs)] leading-normal';

const getDiffLineToneClass = (type: 'added' | 'removed' | 'info') => {
  if (type === 'removed') {
    return 'removed bg-[var(--an-diff-removed-bg)] text-[var(--an-diff-removed-text)] hover:bg-[color-mix(in_srgb,var(--an-diff-removed-text)_16%,var(--an-code-background))]';
  }
  if (type === 'added') {
    return 'added bg-[var(--an-diff-added-bg)] text-[var(--an-diff-added-text)] hover:bg-[color-mix(in_srgb,var(--an-diff-added-text)_16%,var(--an-code-background))]';
  }
  return 'info bg-[var(--an-background-secondary)] text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)]';
};

interface DiffViewerProps {
  edit: any;
  filePath?: string; // File path from session context
  maxHeight?: string;
  /** Optional: Open a file in the editor (makes file path clickable) */
  onOpenFile?: (filePath: string) => void;
  /** Absolute file path for opening (may differ from display filePath) */
  absoluteFilePath?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ edit, filePath: contextFilePath, maxHeight = '20rem', onOpenFile, absoluteFilePath }) => {
  // Extract the relevant diff information from the edit object
  const replacements = edit.replacements || [];
  // Use file path from props (session context) or fallback to edit fields
  const filePath = contextFilePath || edit.filePath || edit.file_path || edit.targetFilePath || 'Unknown file';

  // Helper to render clickable file header
  const renderFileHeader = (displayPath: string) => {
    const pathToOpen = absoluteFilePath || edit.filePath || edit.file_path || edit.targetFilePath;
    const isClickable = onOpenFile && pathToOpen;

    const handleClick = (e: React.MouseEvent) => {
      if (isClickable) {
        e.preventDefault();
        onOpenFile(pathToOpen);
      }
    };

    if (isClickable) {
      return (
        <div
          className={DIFF_VIEWER_HEADER_CLASS}
          data-testid="agent-elements-diff-viewer-header"
          data-agent-elements-shell="diff-viewer-header"
        >
          <button
            className={DIFF_VIEWER_PATH_BUTTON_CLASS}
            onClick={handleClick}
            aria-label={`Open ${displayPath}`}
            title={`Open ${pathToOpen}`}
            type="button"
          >
            {displayPath}
          </button>
        </div>
      );
    }
    return (
      <div
        className={DIFF_VIEWER_HEADER_CLASS}
        data-testid="agent-elements-diff-viewer-header"
        data-agent-elements-shell="diff-viewer-header"
      >
        <span className="agent-elements-diff-viewer-path min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono">
          {displayPath}
        </span>
      </div>
    );
  };

  // Render a diff line with appropriate styling
  const renderDiffLine = (type: 'added' | 'removed' | 'info', marker: string, content: string, key: string) => {
    const lineKind = type === 'removed' ? 'removed' : type === 'added' ? 'added' : 'info';

    return (
      <div
        key={key}
        className={`${DIFF_LINE_BASE_CLASS} ${getDiffLineToneClass(type)}`}
        data-testid={`agent-elements-diff-viewer-line-${key}`}
        data-agent-elements-shell="diff-viewer-line"
        data-line-kind={lineKind}
      >
        <span className={DIFF_LINE_MARKER_CLASS}>{marker}</span>
        <span className={DIFF_LINE_CONTENT_CLASS}>{content || ' '}</span>
      </div>
    );
  };

  const renderDiffFrame = (
    displayPath: string,
    children: React.ReactNode,
    style?: React.CSSProperties
  ) => (
    <div
      className={DIFF_VIEWER_ROOT_CLASS}
      style={{ maxHeight, ...style }}
      data-testid="agent-elements-diff-viewer"
      data-component="DiffViewer"
      data-agent-elements-shell="diff-viewer"
    >
      {renderFileHeader(displayPath)}
      <div className={DIFF_VIEWER_CONTENT_CLASS}>
        <div className={DIFF_VIEWER_CONTENT_INNER_CLASS}>
          {children}
        </div>
      </div>
    </div>
  );

  // Handle single edit with old_string/new_string (Claude Code Edit tool format)
  if (!replacements.length && (edit.old_string || edit.new_string)) {
    const oldTextRaw = edit.old_string || edit.oldText || '';
    const newTextRaw = edit.new_string || edit.newText || '';

    // Keep the full context provided by the tool result so hunk boundaries stay visible.
    const oldText = oldTextRaw;
    const newText = newTextRaw;

    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    return renderDiffFrame(
      filePath,
      <>
        {/* Show removed lines */}
        {oldLines.length > 0 && oldLines.some((line: string) => line.trim()) && (
          <>
            {oldLines.map((line: string, i: number) => renderDiffLine('removed', '-', line, `old-${i}`))}
          </>
        )}

        {/* Show added lines */}
        {newLines.length > 0 && newLines.some((line: string) => line.trim()) && (
          <>
            {newLines.map((line: string, i: number) => renderDiffLine('added', '+', line, `new-${i}`))}
          </>
        )}
      </>
    );
  }

  // If we have replacements array, show each replacement as a separate diff
  if (replacements.length > 0) {
    return (
      <>
        {replacements.map((replacement: any, idx: number) => {
          const oldTextRaw = replacement.oldText || replacement.old_text || '';
          const newTextRaw = replacement.newText || replacement.new_text || '';

          // Keep the full context provided by the tool result so hunk boundaries stay visible.
          const oldText = oldTextRaw;
          const newText = newTextRaw;

          const oldLines = oldText.split('\n');
          const newLines = newText.split('\n');

          return (
            <React.Fragment key={idx}>
              {renderDiffFrame(
                `${filePath}${replacements.length > 1 ? ` (${idx + 1}/${replacements.length})` : ''}`,
                <>
                  {/* Show removed lines */}
                  {oldLines.length > 0 && oldLines.some((line: string) => line.trim()) && (
                    <>
                      {oldLines.map((line: string, i: number) => renderDiffLine('removed', '-', line, `old-${i}`))}
                    </>
                  )}

                  {/* Show added lines */}
                  {newLines.length > 0 && newLines.some((line: string) => line.trim()) && (
                    <>
                      {newLines.map((line: string, i: number) => renderDiffLine('added', '+', line, `new-${i}`))}
                    </>
                  )}
                </>,
                { marginBottom: idx < replacements.length - 1 ? '0.5rem' : '0' }
              )}
            </React.Fragment>
          );
        })}
      </>
    );
  }

  // If we only have content (insertion), show it as added lines
  if (edit.content) {
    const lines = edit.content.split('\n');
    return renderDiffFrame(
      filePath,
      <>
        {lines.map((line: string, i: number) => renderDiffLine('added', '+', line, `add-${i}`))}
      </>
    );
  }

  // Fallback: show edit details in a simple format
  return renderDiffFrame(
    filePath,
    <>
      {edit.operation && renderDiffLine('info', '\u2022', `Operation: ${edit.operation}`, 'operation')}
      {edit.instruction && renderDiffLine('info', '\u2022', edit.instruction, 'instruction')}
    </>
  );
};
