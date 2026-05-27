import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface UpdateReadyToastProps {
  version: string;
  waitingForSessions?: boolean;
  onRelaunch: () => void;
  onForceRestart: () => void;
  onDoItLater: () => void;
  onDismiss: () => void;
}

export function UpdateReadyToast({
  version,
  waitingForSessions,
  onRelaunch,
  onForceRestart,
  onDoItLater,
  onDismiss,
}: UpdateReadyToastProps): React.ReactElement {
  const buttonBase =
    'update-toast-btn inline-flex items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
  const primaryButton =
    `${buttonBase} update-toast-btn-primary border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-button-primary-text)] hover:border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]`;
  const secondaryButton =
    `${buttonBase} update-toast-btn-secondary border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]`;
  const closeButton =
    'update-toast-dismiss agent-elements-update-toast-dismiss absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
  const rootClass =
    'update-toast agent-elements-update-toast agent-elements-tool-card relative w-[380px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)] text-[var(--an-foreground)] shadow-[0_14px_42px_color-mix(in_srgb,var(--an-foreground)_16%,transparent)]';

  if (waitingForSessions) {
    return (
      <div
        className={rootClass}
        data-testid="update-ready-toast"
        data-component="UpdateReadyToast"
        data-agent-elements-shell="update-ready-toast"
        data-agent-elements-card-padding="symmetric-inline"
        data-agent-elements-card-width="floating-toast"
        data-update-waiting-for-sessions="true"
      >
        <button
          className={closeButton}
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
            <MaterialSymbol icon="progress_activity" size={19} className="animate-spin" />
          </span>
          <div className="min-w-0">
            <div className="update-toast-title m-0 text-sm font-medium leading-snug text-[var(--an-foreground)]">
              Update ready
            </div>
            <div className="update-toast-subtitle mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
              Update will apply when all AI sessions are finished.
            </div>
          </div>
        </div>

        <div className="update-toast-actions agent-elements-update-toast-actions mt-[var(--an-spacing-xl)] flex flex-wrap gap-2" data-agent-elements-shell="update-toast-actions">
          <button
            className={primaryButton}
            onClick={onForceRestart}
            data-testid="force-restart-btn"
          >
            <MaterialSymbol icon="restart_alt" size={16} />
            Restart Now
          </button>
          <button
            className={secondaryButton}
            onClick={onDoItLater}
            data-testid="do-it-later-btn"
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={rootClass}
      data-testid="update-ready-toast"
      data-component="UpdateReadyToast"
      data-agent-elements-shell="update-ready-toast"
      data-agent-elements-card-padding="symmetric-inline"
      data-agent-elements-card-width="floating-toast"
      data-update-waiting-for-sessions="false"
    >
      <button
        className={closeButton}
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
          <MaterialSymbol icon="verified" size={19} />
        </span>
        <div className="min-w-0">
          <div className="update-toast-title m-0 text-sm font-medium leading-snug text-[var(--an-foreground)]">
            Nimbalyst {version} is ready
          </div>
          <div className="update-toast-subtitle mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
            Restart the app to apply the update.
          </div>
        </div>
      </div>

      <div className="update-toast-actions agent-elements-update-toast-actions mt-[var(--an-spacing-xl)] flex flex-wrap gap-2" data-agent-elements-shell="update-toast-actions">
        <button
          className={primaryButton}
          onClick={onRelaunch}
          data-testid="relaunch-btn"
        >
          <MaterialSymbol icon="restart_alt" size={16} />
          Relaunch
        </button>
        <button
          className={secondaryButton}
          onClick={onDoItLater}
          data-testid="do-it-later-btn"
        >
          Later
        </button>
      </div>
    </div>
  );
}

export default UpdateReadyToast;
