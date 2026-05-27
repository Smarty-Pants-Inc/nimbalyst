import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

interface DownloadProgressToastProps {
  version: string;
  progress: DownloadProgress | null;
  onCancel: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

function estimateTimeRemaining(bytesPerSecond: number, remaining: number): string {
  if (bytesPerSecond <= 0 || remaining <= 0) {
    return 'Calculating...';
  }

  const secondsRemaining = remaining / bytesPerSecond;

  if (secondsRemaining < 60) {
    return 'Less than 1 minute remaining';
  } else if (secondsRemaining < 3600) {
    const minutes = Math.ceil(secondsRemaining / 60);
    return `About ${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
  } else {
    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.ceil((secondsRemaining % 3600) / 60);
    return `About ${hours}h ${minutes}m remaining`;
  }
}

export function DownloadProgressToast({
  version,
  progress,
  onCancel,
}: DownloadProgressToastProps): React.ReactElement {
  const remaining = progress ? progress.total - progress.transferred : 0;
  const timeRemaining = progress ? estimateTimeRemaining(progress.bytesPerSecond, remaining) : 'Starting download...';
  const percent = progress ? Math.round(progress.percent) : 0;
  const secondaryButton =
    'update-toast-btn update-toast-btn-secondary inline-flex items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-3 py-2 text-sm font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
  const toastCardClass =
    'update-toast update-toast-download agent-elements-update-toast agent-elements-tool-card relative w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)] text-[var(--an-foreground)] shadow-[0_14px_42px_color-mix(in_srgb,var(--an-foreground)_16%,transparent)]';

  return (
    <div
      className={toastCardClass}
      data-testid="download-progress-toast"
      data-component="DownloadProgressToast"
      data-agent-elements-shell="download-progress-toast"
      data-agent-elements-card-padding="symmetric-inline"
      data-agent-elements-card-width="floating-toast"
    >
      <div
        className="update-toast-header agent-elements-update-toast-header mb-[var(--an-spacing-xl)] flex items-start gap-3"
        data-agent-elements-shell="update-toast-header"
      >
        <span
          className="update-toast-icon agent-elements-update-toast-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]"
          data-testid="agent-elements-update-toast-icon"
          data-agent-elements-shell="update-toast-icon"
          aria-hidden="true"
        >
          <MaterialSymbol icon="downloading" size={19} />
        </span>
        <div className="min-w-0">
          <div className="update-toast-title m-0 text-sm font-medium leading-snug text-[var(--an-foreground)]">
            Downloading Nimbalyst {version}
          </div>
          <div className="update-toast-subtitle mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
            The update will be ready after the download completes.
          </div>
        </div>
      </div>

      <div
        className="update-toast-progress-section agent-elements-update-toast-progress"
        data-testid="agent-elements-update-toast-progress"
        data-agent-elements-shell="update-toast-progress"
      >
        <div className="update-toast-progress-details">
          <div className="update-toast-progress-text mb-2 text-xs text-[var(--an-foreground)]" data-testid="download-progress-text">
            {progress ? `${formatBytes(progress.transferred)} of ${formatBytes(progress.total)}` : 'Preparing...'}
          </div>
          <div className="update-toast-progress-bar h-1.5 overflow-hidden rounded-full bg-[var(--an-background-tertiary)]">
            <div
              className="update-toast-progress-fill h-full rounded-full bg-[var(--an-primary-color)] transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
              data-testid="download-progress-fill"
              data-percent={percent}
            />
          </div>
        </div>
      </div>

      <div className="update-toast-time-remaining mt-2 text-xs text-[var(--an-foreground-subtle)]" data-testid="download-time-remaining">
        {timeRemaining}
      </div>

      <div
        className="update-toast-actions agent-elements-update-toast-actions mt-[var(--an-spacing-xl)] flex flex-wrap gap-2"
        data-agent-elements-shell="update-toast-actions"
      >
        <button
          className={secondaryButton}
          onClick={onCancel}
          data-testid="download-cancel-btn"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default DownloadProgressToast;
