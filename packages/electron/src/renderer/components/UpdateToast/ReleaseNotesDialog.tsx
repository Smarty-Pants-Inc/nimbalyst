import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { MaterialSymbol } from '@nimbalyst/runtime';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

interface ReleaseNotesDialogProps {
  currentVersion: string;
  newVersion: string;
  releaseNotes: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function ReleaseNotesDialog({
  currentVersion,
  newVersion,
  releaseNotes,
  onClose,
  onUpdate,
}: ReleaseNotesDialogProps): React.ReactElement {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle escape key and click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Parse and render markdown release notes
  const renderedReleaseNotes = React.useMemo(() => {
    if (!releaseNotes) {
      return '<p>No release notes available.</p>';
    }
    try {
      return marked.parse(releaseNotes) as string;
    } catch (err) {
      console.error('[ReleaseNotesDialog] Failed to parse release notes:', err);
      return `<p>${releaseNotes}</p>`;
    }
  }, [releaseNotes]);

  const buttonBase =
    'update-dialog-btn inline-flex items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

  return (
    <div
      className="update-dialog-backdrop nim-overlay agent-elements-release-notes-dialog-backdrop fixed inset-0 z-[10001] flex items-center justify-center bg-[color-mix(in_srgb,var(--nim-text)_36%,transparent)] p-4 nim-animate-fade-in"
      data-testid="agent-elements-release-notes-dialog-backdrop"
      data-agent-elements-shell="release-notes-dialog-backdrop"
    >
      <div
        className="update-dialog agent-elements-release-notes-dialog agent-elements-tool-card relative flex max-h-[82vh] w-[620px] max-w-[92vw] flex-col overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--nim-text)_18%,transparent)] nim-animate-slide-up"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-notes-dialog-title"
        data-testid="agent-elements-release-notes-dialog"
        data-component="ReleaseNotesDialog"
        data-agent-elements-shell="release-notes-dialog"
      >
        <button
          className="update-dialog-close agent-elements-release-notes-dialog-close absolute right-4 top-4 z-10 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
          onClick={onClose}
          title="Close"
          aria-label="Close"
          data-testid="release-notes-close-btn"
          data-agent-elements-shell="release-notes-dialog-close"
        >
          <MaterialSymbol icon="close" size={18} />
        </button>

        <header
          className="update-dialog-header agent-elements-release-notes-dialog-header border-b border-[var(--an-border-color)] p-[var(--an-spacing-xl)] pr-14"
          data-testid="agent-elements-release-notes-dialog-header"
          data-agent-elements-shell="release-notes-dialog-header"
        >
          <div className="flex items-start gap-3">
            <span
              className="agent-elements-release-notes-dialog-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]"
              data-agent-elements-shell="release-notes-dialog-icon"
              aria-hidden="true"
            >
              <MaterialSymbol icon="release_alert" size={19} />
            </span>
            <div className="min-w-0">
              <h2
                id="release-notes-dialog-title"
                className="update-dialog-title m-0 text-sm font-medium leading-snug text-[var(--an-foreground)]"
              >
                Update available
              </h2>
              <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                Review the changes before downloading Nimbalyst {newVersion}.
              </p>
            </div>
          </div>
        </header>

        <div
          className="update-dialog-version-row agent-elements-release-notes-dialog-version-row flex flex-wrap items-center gap-2 border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-release-notes-dialog-version-row"
          data-agent-elements-shell="release-notes-version-row"
        >
          <span className="update-dialog-version-label text-xs text-[var(--an-foreground-muted)]">Current</span>
          <span className="update-dialog-version-badge rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2 py-1 font-mono text-xs font-medium text-[var(--an-foreground)]" data-testid="current-version-badge">{currentVersion}</span>
          <span className="update-dialog-version-arrow inline-flex items-center text-[var(--an-foreground-subtle)]" aria-hidden="true">
            <MaterialSymbol icon="arrow_forward" size={16} />
          </span>
          <span className="update-dialog-version-label text-xs text-[var(--an-foreground-muted)]">Latest</span>
          <span className="update-dialog-version-badge update-dialog-version-badge-new rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-2 py-1 font-mono text-xs font-medium text-[var(--an-background)]" data-testid="new-version-badge">{newVersion}</span>
        </div>

        <div className="update-dialog-content flex-1 overflow-y-auto p-[var(--an-spacing-xl)]">
          <h3 className="update-dialog-notes-title m-0 mb-3 text-sm font-medium text-[var(--an-foreground)]">{newVersion} release notes</h3>
          <div
            className="update-dialog-notes agent-elements-release-notes-dialog-content select-text text-sm leading-relaxed text-[var(--an-foreground-muted)] [&_code]:rounded-[var(--an-input-border-radius)] [&_code]:bg-[var(--an-background-tertiary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-medium [&_h1]:text-[var(--an-foreground)] [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-medium [&_h2]:text-[var(--an-foreground)] [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-[var(--an-foreground)] [&_li]:my-1 [&_ol]:my-2 [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-[var(--an-tool-border-radius)] [&_pre]:border [&_pre]:border-[var(--an-border-color)] [&_pre]:bg-[var(--an-background-secondary)] [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:my-2 [&_ul]:pl-5"
            data-testid="release-notes-content"
            data-agent-elements-shell="release-notes-content"
            dangerouslySetInnerHTML={{ __html: renderedReleaseNotes }}
          />
        </div>

        <footer
          className="update-dialog-actions agent-elements-release-notes-dialog-actions flex justify-end gap-2 border-t border-[var(--an-border-color)] p-[var(--an-spacing-xl)]"
          data-agent-elements-shell="release-notes-dialog-actions"
        >
          <button
            className={`${buttonBase} update-dialog-btn-secondary border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]`}
            onClick={onClose}
            data-testid="release-notes-later-btn"
          >
            Later
          </button>
          <button
            className={`${buttonBase} update-dialog-btn-primary border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)] hover:border-[var(--nim-primary-hover)] hover:bg-[var(--nim-primary-hover)]`}
            onClick={onUpdate}
            data-testid="release-notes-update-btn"
          >
            <MaterialSymbol icon="download" size={16} />
            Update to Nimbalyst {newVersion}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ReleaseNotesDialog;
