import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

export interface RosettaWarningProps {
  isOpen: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onDownload: () => void;
}

export const RosettaWarning: React.FC<RosettaWarningProps> = ({
  isOpen,
  onClose,
  onDismiss,
  onDownload,
}) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    onDownload();
    onClose();
  };

  const handleRemindLater = () => {
    onClose();
  };

  const handleDontRemind = () => {
    window.electronAPI.send('dismiss-rosetta-warning');
    onDismiss();
  };

  return (
    <div
      className="nim-overlay agent-elements-rosetta-warning-backdrop bg-[color-mix(in_srgb,var(--nim-text)_36%,transparent)]"
      data-testid="agent-elements-rosetta-warning-backdrop"
      data-agent-elements-shell="platform-warning-backdrop"
      onClick={handleRemindLater}
    >
      <div
        className="agent-elements-rosetta-warning agent-elements-tool-card flex w-[min(92vw,460px)] flex-col overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--nim-text)_18%,transparent)]"
        data-testid="agent-elements-rosetta-warning"
        data-component="RosettaWarning"
        data-agent-elements-shell="platform-warning"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="agent-elements-rosetta-warning-header flex items-start justify-between gap-3 border-b border-[var(--an-border-color)] p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-rosetta-warning-header"
          data-agent-elements-shell="platform-warning-header"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="agent-elements-rosetta-warning-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--nim-warning)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-warning)_12%,var(--an-background))] text-[var(--nim-warning)]"
              data-agent-elements-shell="platform-warning-icon"
              aria-hidden="true"
            >
              <MaterialSymbol icon="warning" size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="m-0 text-sm font-medium text-[var(--an-foreground)]">
                Running via Rosetta Translation
              </h2>
              <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                Intel build on Apple Silicon
              </p>
            </div>
          </div>
          <button
            type="button"
            className="agent-elements-rosetta-warning-close flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            data-testid="agent-elements-rosetta-warning-close"
            data-agent-elements-shell="platform-warning-close"
            onClick={handleRemindLater}
            aria-label="Close"
          >
            <MaterialSymbol icon="close" size={18} />
          </button>
        </div>

        <div
          className="agent-elements-rosetta-warning-body p-[var(--an-spacing-xl)]"
          data-agent-elements-shell="platform-warning-body"
        >
          <p className="m-0 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
            You're running the Intel (x64) build on an Apple Silicon Mac.
            Download the native Apple Silicon build for significantly better performance.
          </p>
        </div>

        <div
          className="agent-elements-rosetta-warning-actions flex flex-col gap-2 border-t border-[var(--an-border-color)] p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-rosetta-warning-actions"
          data-agent-elements-shell="platform-warning-actions"
        >
          <button
            type="button"
            className="agent-elements-rosetta-warning-primary inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-4 py-2 text-sm font-medium text-[var(--nim-bg)] transition-[background-color,border-color,transform] duration-150 ease-out hover:bg-[var(--nim-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] active:translate-y-px"
            onClick={handleDownload}
          >
            <MaterialSymbol icon="download" size={17} />
            Download Apple Silicon Build
          </button>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              className="agent-elements-rosetta-warning-link cursor-pointer rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent px-2 py-1 text-xs text-[var(--an-foreground-muted)] transition-[background-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
              onClick={handleRemindLater}
            >
              Remind Me Later
            </button>
            <span className="text-xs text-[var(--an-foreground-subtle)]" aria-hidden="true">
              /
            </span>
            <button
              type="button"
              className="agent-elements-rosetta-warning-link cursor-pointer rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent px-2 py-1 text-xs text-[var(--an-foreground-muted)] transition-[background-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
              onClick={handleDontRemind}
            >
              Don't Show Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
