import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface UpdateAvailableToastProps {
  version: string;
  onUpdateNow: () => void;
  onViewReleaseNotes: () => void;
  onRemindLater: () => void;
  onDismiss: () => void;
}

export function UpdateAvailableToast({
  version,
  onUpdateNow,
  onViewReleaseNotes,
  onRemindLater,
  onDismiss,
}: UpdateAvailableToastProps): React.ReactElement {
  const toastCardClass =
    'update-toast agent-elements-update-toast agent-elements-tool-card relative w-[380px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)] text-[var(--an-foreground)] shadow-[0_14px_42px_color-mix(in_srgb,var(--an-foreground)_16%,transparent)]';
  const buttonBase =
    'update-toast-btn inline-flex items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

  return (
    <div
      className={toastCardClass}
      data-testid="update-available-toast"
      data-component="UpdateAvailableToast"
      data-agent-elements-shell="update-available-toast"
      data-agent-elements-card-padding="symmetric-inline"
      data-agent-elements-card-width="floating-toast"
    >
      <button
        className="update-toast-dismiss agent-elements-update-toast-dismiss absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
        onClick={onDismiss}
        title="Dismiss"
        aria-label="Dismiss"
        data-testid="update-toast-dismiss"
        data-agent-elements-shell="update-toast-dismiss"
      >
        <MaterialSymbol icon="close" size={18} />
      </button>

      <div className="update-toast-header agent-elements-update-toast-header flex items-start gap-3 pr-8" data-agent-elements-shell="update-toast-header">
        <span
          className="update-toast-icon agent-elements-update-toast-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]"
          data-testid="agent-elements-update-toast-icon"
          data-agent-elements-shell="update-toast-icon"
          aria-hidden="true"
        >
          <MaterialSymbol icon="system_update_alt" size={19} />
        </span>
        <div className="min-w-0">
          <div
            className="update-toast-title m-0 text-sm font-medium leading-snug text-[var(--an-foreground)]"
            data-testid="update-toast-version"
          >
            Nimbalyst {version} is available
          </div>
          <div className="update-toast-subtitle mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
            Download the latest app update when you are ready.
          </div>
        </div>
      </div>

      <div
        className="update-toast-actions agent-elements-update-toast-actions mt-[var(--an-spacing-xl)] flex flex-wrap gap-2"
        data-testid="agent-elements-update-toast-actions"
        data-agent-elements-shell="update-toast-actions"
      >
        <button
          className={`${buttonBase} update-toast-btn-primary flex-1 border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-button-primary-text)] hover:border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]`}
          onClick={onUpdateNow}
          data-testid="update-now-btn"
        >
          <MaterialSymbol icon="download" size={16} />
          Update Now
        </button>
        <button
          className={`${buttonBase} update-toast-btn-secondary border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]`}
          onClick={onViewReleaseNotes}
          data-testid="release-notes-btn"
        >
          Release Notes
        </button>
        <button
          className={`${buttonBase} update-toast-btn-text border-transparent bg-transparent text-[var(--an-foreground-muted)] hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]`}
          onClick={onRemindLater}
          data-testid="remind-later-btn"
        >
          Remind me later
        </button>
      </div>
    </div>
  );
}

export default UpdateAvailableToast;
