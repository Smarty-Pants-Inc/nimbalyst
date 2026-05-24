import React, { useCallback } from 'react';
import { useAtom } from 'jotai';
import { usePostHog } from 'posthog-js/react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { UpdateAvailableToast } from './UpdateAvailableToast';
import { ReleaseNotesDialog } from './ReleaseNotesDialog';
import { DownloadProgressToast } from './DownloadProgressToast';
import { UpdateReadyToast } from './UpdateReadyToast';
import { updateStateAtom } from '../../store/atoms/updateState';

// Re-export types from atom file for backwards compatibility
export type { UpdateState, UpdateInfo, DownloadProgress } from '../../store/atoms/updateState';

export function UpdateToast(): React.ReactElement | null {
  const [updateState, setUpdateState] = useAtom(updateStateAtom);
  const { state, updateInfo, currentVersion, downloadProgress, errorMessage } = updateState;
  const posthog = usePostHog();

  // Action handlers
  const handleUpdateNow = useCallback(() => {
    console.log('[UpdateToast] Update now clicked');
    posthog?.capture('update_toast_action', {
      action: 'download_clicked',
      new_version: updateInfo?.version || 'unknown'
    });
    setUpdateState((prev) => ({ ...prev, state: 'downloading' }));
    window.electronAPI.send('update-toast:download');
  }, [posthog, updateInfo?.version, setUpdateState]);

  const handleViewReleaseNotes = useCallback(() => {
    console.log('[UpdateToast] View release notes clicked');
    posthog?.capture('update_toast_action', {
      action: 'release_notes_clicked',
      new_version: updateInfo?.version || 'unknown'
    });
    setUpdateState((prev) => ({ ...prev, state: 'viewing-notes' }));
  }, [posthog, updateInfo?.version, setUpdateState]);

  const handleRemindLater = useCallback(async () => {
    console.log('[UpdateToast] Remind later clicked');
    posthog?.capture('update_toast_action', {
      action: 'remind_later_clicked',
      new_version: updateInfo?.version || 'unknown'
    });
    if (updateInfo) {
      try {
        await window.electronAPI.invoke('update:set-reminder-suppression', updateInfo.version);
      } catch (error) {
        console.error('[UpdateToast] Failed to set reminder suppression:', error);
      }
    }
    setUpdateState((prev) => ({ ...prev, state: 'idle', updateInfo: null }));
  }, [posthog, updateInfo, setUpdateState]);

  const handleDismiss = useCallback(() => {
    console.log('[UpdateToast] Dismiss clicked');
    setUpdateState((prev) => ({ ...prev, state: 'idle', updateInfo: null }));
  }, [setUpdateState]);

  const handleCloseReleaseNotes = useCallback(() => {
    console.log('[UpdateToast] Close release notes clicked');
    setUpdateState((prev) => ({ ...prev, state: 'available' }));
  }, [setUpdateState]);

  const handleUpdateFromNotes = useCallback(() => {
    console.log('[UpdateToast] Update from release notes clicked');
    setUpdateState((prev) => ({ ...prev, state: 'downloading' }));
    window.electronAPI.send('update-toast:download');
  }, [setUpdateState]);

  const handleCancelDownload = useCallback(() => {
    console.log('[UpdateToast] Cancel download clicked');
    // Note: electron-updater doesn't support canceling downloads directly
    // We'll just hide the toast and let the download continue in the background
    setUpdateState((prev) => ({ ...prev, state: 'idle', updateInfo: null, downloadProgress: null }));
  }, [setUpdateState]);

  const handleRelaunch = useCallback(async () => {
    console.log('[UpdateToast] Relaunch clicked');
    try {
      const result = await window.electronAPI.invoke('update:has-active-sessions');
      if (result.hasActiveSessions) {
        console.log('[UpdateToast] Active AI sessions detected, deferring install');
        posthog?.capture('update_toast_action', {
          action: 'install_deferred',
          reason: 'active_ai_sessions',
          new_version: updateInfo?.version || 'unknown'
        });
        setUpdateState((prev) => ({ ...prev, state: 'waiting-for-sessions' }));
        window.electronAPI.send('update-toast:install-when-idle');
        return;
      }
    } catch (error) {
      console.error('[UpdateToast] Failed to check active sessions, proceeding with install:', error);
    }
    window.electronAPI.send('update-toast:install');
  }, [posthog, updateInfo?.version, setUpdateState]);

  const handleForceRestart = useCallback(() => {
    console.log('[UpdateToast] Force restart clicked');
    posthog?.capture('update_toast_action', {
      action: 'force_restart_clicked',
      new_version: updateInfo?.version || 'unknown'
    });
    window.electronAPI.send('update-toast:install');
  }, [posthog, updateInfo?.version]);

  const handleDoItLater = useCallback(() => {
    console.log('[UpdateToast] Do it later clicked');
    setUpdateState((prev) => ({ ...prev, state: 'idle', updateInfo: null, downloadProgress: null }));
  }, [setUpdateState]);

  // Don't render anything if idle
  if (state === 'idle') {
    return null;
  }

  const toastCardClass =
    'update-toast agent-elements-update-toast agent-elements-tool-card relative max-w-[calc(100vw-32px)] overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-xl)] text-[var(--an-foreground)] shadow-[0_14px_42px_color-mix(in_srgb,var(--nim-text)_16%,transparent)]';
  const dismissButtonClass =
    'update-toast-dismiss agent-elements-update-toast-dismiss absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
  const secondaryButtonClass =
    'update-toast-btn update-toast-btn-secondary inline-flex items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-3 py-2 text-sm font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

  return (
    <>
      {(state === 'checking' || state === 'up-to-date' || state === 'available' || state === 'downloading' || state === 'ready' || state === 'waiting-for-sessions' || state === 'error') && (
        <div
          className="update-toast-container agent-elements-update-toast-container fixed bottom-5 right-5 z-[10000] nim-animate-slide-up"
          data-testid="update-toast-container"
          data-state={state}
          data-agent-elements-shell="update-toast-container"
        >
          {state === 'checking' && (
            <div
              className={`${toastCardClass} update-toast-checking flex w-auto min-w-[240px] items-center gap-3`}
              data-testid="update-checking-toast"
              data-component="UpdateToastChecking"
              data-agent-elements-shell="update-checking-toast"
            >
              <span
                className="update-toast-icon agent-elements-update-toast-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]"
                data-testid="agent-elements-update-toast-icon"
                data-agent-elements-shell="update-toast-icon"
                aria-hidden="true"
              >
                <MaterialSymbol icon="progress_activity" size={18} className="animate-spin" />
              </span>
              <div className="update-toast-title m-0 text-sm font-medium text-[var(--an-foreground)]">Checking for updates...</div>
            </div>
          )}

          {state === 'up-to-date' && (
            <div
              className={`${toastCardClass} update-toast-up-to-date flex w-[340px] flex-col items-start`}
              data-testid="update-up-to-date-toast"
              data-component="UpdateToastUpToDate"
              data-agent-elements-shell="update-up-to-date-toast"
            >
              <button
                className={dismissButtonClass}
                onClick={handleDismiss}
                title="Dismiss"
                aria-label="Dismiss"
                data-testid="update-toast-dismiss"
                data-agent-elements-shell="update-toast-dismiss"
              >
                <MaterialSymbol icon="close" size={18} />
              </button>
              <span
                className="update-toast-check-icon agent-elements-status-pill agent-elements-update-toast-icon mb-3 inline-flex h-8 w-8 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--nim-success)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-success)_10%,var(--an-background))] text-[var(--nim-success)]"
                data-testid="agent-elements-update-toast-icon"
                data-agent-elements-shell="update-toast-icon"
                aria-hidden="true"
              >
                <MaterialSymbol icon="check" size={18} />
              </span>
              <div className="update-toast-title m-0 pr-7 text-sm font-medium text-[var(--an-foreground)]">You're up to date</div>
              <div className="update-toast-subtitle mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">Nimbalyst {currentVersion} is the latest version.</div>
            </div>
          )}

          {state === 'available' && updateInfo && (
            <UpdateAvailableToast
              version={updateInfo.version}
              onUpdateNow={handleUpdateNow}
              onViewReleaseNotes={handleViewReleaseNotes}
              onRemindLater={handleRemindLater}
              onDismiss={handleDismiss}
            />
          )}

          {state === 'downloading' && updateInfo && (
            <DownloadProgressToast
              version={updateInfo.version}
              progress={downloadProgress}
              onCancel={handleCancelDownload}
            />
          )}

          {(state === 'ready' || state === 'waiting-for-sessions') && updateInfo && (
            <UpdateReadyToast
              version={updateInfo.version}
              waitingForSessions={state === 'waiting-for-sessions'}
              onRelaunch={handleRelaunch}
              onForceRestart={handleForceRestart}
              onDoItLater={handleDoItLater}
              onDismiss={handleDismiss}
            />
          )}

          {state === 'error' && (
            <div
              className={`${toastCardClass} update-toast-error w-[380px] border-[color-mix(in_srgb,var(--nim-error)_38%,var(--an-border-color))]`}
              data-testid="update-error-toast"
              data-component="UpdateToastError"
              data-agent-elements-shell="update-error-toast"
            >
              <button
                className={dismissButtonClass}
                onClick={handleDismiss}
                title="Dismiss"
                aria-label="Dismiss"
                data-testid="update-toast-dismiss"
                data-agent-elements-shell="update-toast-dismiss"
              >
                <MaterialSymbol icon="close" size={18} />
              </button>
              <div className="update-toast-header agent-elements-update-toast-header flex items-start gap-3 pr-8" data-agent-elements-shell="update-toast-header">
                <span
                  className="update-toast-icon agent-elements-update-toast-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--nim-error)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-error)_10%,var(--an-background))] text-[var(--nim-error)]"
                  data-testid="agent-elements-update-toast-icon"
                  data-agent-elements-shell="update-toast-icon"
                  aria-hidden="true"
                >
                  <MaterialSymbol icon="error" size={19} />
                </span>
                <div className="min-w-0">
                  <div className="update-toast-title m-0 text-sm font-medium text-[var(--nim-error)]">Update Error</div>
                  <div className="update-toast-subtitle select-text mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]" data-testid="error-message">{errorMessage}</div>
                </div>
              </div>
              <div className="mt-[var(--an-spacing-md)] text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                You can <a
                  href="https://nimbalyst.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer rounded-[var(--an-input-border-radius)] text-[var(--an-primary-color)] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                  data-testid="manual-download-link"
                >download the latest version manually</a>.
              </div>
              <div className="update-toast-actions agent-elements-update-toast-actions mt-[var(--an-spacing-xl)] flex flex-wrap gap-2" data-agent-elements-shell="update-toast-actions">
                <button
                  className={secondaryButtonClass}
                  onClick={handleDismiss}
                  data-testid="error-dismiss-btn"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {state === 'viewing-notes' && updateInfo && (
        <ReleaseNotesDialog
          currentVersion={currentVersion}
          newVersion={updateInfo.version}
          releaseNotes={updateInfo.releaseNotes || ''}
          onClose={handleCloseReleaseNotes}
          onUpdate={handleUpdateFromNotes}
        />
      )}
    </>
  );
}

export default UpdateToast;
