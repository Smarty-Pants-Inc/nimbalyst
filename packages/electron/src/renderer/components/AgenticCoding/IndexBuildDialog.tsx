import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

export interface IndexBuildDialogProps {
  isOpen: boolean;
  messageCount: number;
  isBuilding: boolean;
  onBuild: () => void;
  onSkip: () => void;
}

export const IndexBuildDialog: React.FC<IndexBuildDialogProps> = ({
  isOpen,
  messageCount,
  isBuilding,
  onBuild,
  onSkip
}) => {
  if (!isOpen) return null;

  const overlayClass =
    'index-build-dialog-overlay agent-elements-index-build-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] p-[var(--an-spacing-xxl)]';
  const dialogClass =
    'index-build-dialog agent-elements-index-build-dialog agent-elements-tool-card w-[min(92vw,500px)] min-w-0 overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]';
  const headerClass =
    'agent-elements-index-build-header flex items-start gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]';
  const iconShellClass =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]';
  const bodyClass =
    'agent-elements-index-build-body px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]';
  const messageClass =
    'index-build-dialog-message agent-elements-index-build-message m-0 select-text text-sm leading-relaxed text-[var(--an-foreground-muted)] [&_strong]:font-medium [&_strong]:text-[var(--an-foreground)]';
  const progressClass =
    'index-build-dialog-progress agent-elements-index-build-progress flex items-center gap-[var(--an-spacing-md)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)] text-sm text-[var(--an-foreground-muted)]';
  const actionsClass =
    'index-build-dialog-buttons agent-elements-index-build-actions flex justify-end gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]';
  const secondaryButtonClass =
    'index-build-dialog-button-skip inline-flex min-h-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-4 py-1.5 text-sm font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
  const primaryButtonClass =
    'index-build-dialog-button-build inline-flex min-h-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-send-button-bg)] bg-[var(--an-send-button-bg)] px-4 py-1.5 text-sm font-medium text-[var(--an-send-button-color)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--an-send-button-bg)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-send-button-bg)_88%,var(--an-foreground))] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

  return (
    <div
      className={overlayClass}
      onClick={isBuilding ? undefined : onSkip}
      data-component="IndexBuildDialogBackdrop"
      data-testid="agent-elements-index-build-backdrop"
      data-agent-elements-shell="index-build-backdrop"
    >
      <div
        className={dialogClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="index-build-dialog-title"
        data-component="IndexBuildDialog"
        data-testid="agent-elements-index-build-dialog"
        data-agent-elements-shell="index-build-dialog"
      >
        <div
          className={headerClass}
          data-testid="agent-elements-index-build-header"
          data-agent-elements-shell="index-build-header"
        >
          <span className={iconShellClass} aria-hidden="true" data-agent-elements-shell="index-build-icon">
            <MaterialSymbol icon="manage_search" size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="index-build-dialog-title" className="index-build-dialog-title m-0 text-base font-medium leading-snug text-[var(--an-foreground)]">
              Build Search Index?
            </h2>
            <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
              Speed up session history search.
            </p>
          </div>
        </div>

        <div className={bodyClass} data-agent-elements-shell="index-build-body">
          <p
            className={messageClass}
            data-testid="agent-elements-index-build-message"
            data-agent-elements-shell="index-build-message"
          >
            Your session history contains <strong>{messageCount.toLocaleString()}</strong> messages.
            Building a search index will make searches much faster, but may take a few minutes.
          </p>
        </div>

        {isBuilding ? (
          <div
            className="px-[var(--an-spacing-xxl)] pb-[var(--an-spacing-xxl)]"
            data-agent-elements-shell="index-build-progress-wrap"
          >
            <div
              className={progressClass}
              data-testid="agent-elements-index-build-progress"
              data-agent-elements-shell="index-build-progress"
            >
              <MaterialSymbol
                icon="progress_activity"
                size={20}
                className="index-build-dialog-spinner shrink-0 animate-spin text-[var(--an-primary-color)]"
                aria-hidden="true"
              />
              <span>Building index... This may take a few minutes.</span>
            </div>
          </div>
        ) : (
          <div
            className={actionsClass}
            data-testid="agent-elements-index-build-actions"
            data-agent-elements-shell="index-build-actions"
          >
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={onSkip}
            >
              Skip for now
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={onBuild}
            >
              Build Index
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
