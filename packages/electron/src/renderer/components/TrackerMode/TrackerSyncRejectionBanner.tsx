/**
 * TrackerSyncRejectionBanner
 *
 * Surfaces tracker-sync mutation rejections that would otherwise silently
 * roll back a user edit. The banner sits above `TrackerMainView` and
 * subscribes to `trackerSyncRejectionAtom`, which is populated by
 * `trackerSyncListeners` on `tracker-sync:mutation-rejected` events.
 *
 * Two states, distinct affordances:
 * - `rotationLocked`: team is mid-rotation; writes will resume in a
 *   moment. Auto-clears 30s after the last event.
 * - `staleKeyEpoch` with `refreshKey -> null`: the user's admin hasn't
 *   shared the new envelope yet. Persistent until cleared; "Retry"
 *   triggers `tracker-sync:connect` which re-fetches the org key.
 *
 * No button-gating: the mutation surface stays available so the user
 * can keep trying. The banner itself is the explanation for any
 * subsequent silent rollback.
 */

import React, { useCallback, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { trackerSyncRejectionAtom } from '../../store/atoms/trackerSync';

interface TrackerSyncRejectionBannerProps {
  workspacePath?: string;
}

const iconShellClass =
  'agent-elements-tracker-sync-rejection-icon inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)]';

const actionButtonClass =
  'inline-flex h-7 items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-3 text-xs font-medium text-[var(--an-foreground)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

const iconButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-subtle)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

export const TrackerSyncRejectionBanner: React.FC<TrackerSyncRejectionBannerProps> = ({ workspacePath }) => {
  const state = useAtomValue(trackerSyncRejectionAtom);
  const setRejection = useSetAtom(trackerSyncRejectionAtom);

  // Filter to this workspace -- the listener stores rejections globally
  // (mutation-rejected is broadcast to all windows). A user with multiple
  // workspaces open shouldn't see a peer workspace's banner.
  const active = useMemo(() => {
    const candidates = [state.staleKeyEpoch, state.rotationLocked].filter(
      (r): r is NonNullable<typeof r> => r != null && (!workspacePath || r.workspacePath === workspacePath),
    );
    if (candidates.length === 0) return null;
    // Show the most recent. staleKeyEpoch needs explicit user action,
    // rotationLocked auto-clears -- if both are present at once,
    // staleKeyEpoch wins because it's the one that won't disappear.
    const stale = candidates.find((r) => r.code === 'staleKeyEpoch');
    if (stale) return stale;
    return candidates[0];
  }, [state, workspacePath]);

  const handleRetry = useCallback(async () => {
    if (!workspacePath) return;
    try {
      // Use generic invoke -- the typed `trackerSync` namespace is wired in
      // preload but not declared in electron.d.ts; other call sites use
      // the same pattern.
      await (window as any).electronAPI.invoke('tracker-sync:connect', { workspacePath });
    } catch (err) {
      console.error('[TrackerSyncRejectionBanner] retry failed:', err);
    }
  }, [workspacePath]);

  const handleDismiss = useCallback(() => {
    if (!active) return;
    setRejection((prev) => ({ ...prev, [active.code]: null }));
  }, [active, setRejection]);

  if (!active) return null;

  const isRotation = active.code === 'rotationLocked';

  return (
    <div
      className="tracker-sync-rejection-banner agent-elements-tracker-sync-rejection-banner agent-elements-tool-card !gap-[var(--an-spacing-sm)] !rounded-none !border-x-0 !border-t-0 !border-b !border-[var(--an-border-color)] !bg-[var(--an-background-secondary)] !px-[var(--an-spacing-lg)] !py-[var(--an-spacing-md)] !text-[var(--an-foreground)] flex-row items-start shrink-0 [container-type:inline-size]"
      role="status"
      aria-live="polite"
      data-component="TrackerSyncRejectionBanner"
      data-agent-elements-shell="tracker-sync-rejection-banner"
      data-testid="tracker-sync-rejection-banner"
      data-rejection-code={active.code}
    >
      {isRotation ? (
        <>
          <span
            className={`${iconShellClass} text-[var(--an-foreground-muted)]`}
            data-testid="agent-elements-tracker-sync-rejection-icon"
            data-agent-elements-shell="tracker-sync-rejection-icon"
          >
            <MaterialSymbol icon="sync" size={16} className="animate-spin motion-reduce:animate-none" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[var(--an-spacing-xxs)]">
            <span
              className="agent-elements-tracker-sync-rejection-message select-text text-sm leading-relaxed text-[var(--an-foreground)]"
              data-testid="agent-elements-tracker-sync-rejection-message"
              data-agent-elements-shell="tracker-sync-rejection-message"
            >
              Team key rotation in progress. Your changes will resume in a moment.
            </span>
            <span
              className="agent-elements-status-pill w-fit"
              data-testid="agent-elements-tracker-sync-rejection-status"
              data-agent-elements-shell="tracker-sync-rejection-status"
              data-tone="running"
            >
              Syncing
            </span>
          </span>
        </>
      ) : (
        <>
          <span
            className={`${iconShellClass} text-[var(--nim-warning)]`}
            data-testid="agent-elements-tracker-sync-rejection-icon"
            data-agent-elements-shell="tracker-sync-rejection-icon"
          >
            <MaterialSymbol icon="key_off" size={16} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[var(--an-spacing-xxs)]">
            <span
              className="agent-elements-tracker-sync-rejection-message select-text text-sm leading-relaxed text-[var(--an-foreground)]"
              data-testid="agent-elements-tracker-sync-rejection-message"
              data-agent-elements-shell="tracker-sync-rejection-message"
            >
              Your team's encryption key changed. Ask your team admin to share the new key envelope with you.
            </span>
            <span
              className="agent-elements-status-pill w-fit"
              data-testid="agent-elements-tracker-sync-rejection-status"
              data-agent-elements-shell="tracker-sync-rejection-status"
              data-tone="warning"
            >
              Action needed
            </span>
          </span>
        </>
      )}
      <span
        className="agent-elements-tracker-sync-rejection-actions flex shrink-0 items-center gap-[var(--an-spacing-xs)]"
        data-testid="agent-elements-tracker-sync-rejection-actions"
        data-agent-elements-shell="tracker-sync-rejection-actions"
      >
        {!isRotation ? (
          <button
            type="button"
            className={actionButtonClass}
            onClick={handleRetry}
            data-testid="tracker-sync-rejection-retry"
            data-agent-elements-shell="tracker-sync-rejection-retry"
          >
            Check again
          </button>
        ) : null}
        <button
          type="button"
          className={iconButtonClass}
          onClick={handleDismiss}
          aria-label="Dismiss"
          data-testid="tracker-sync-rejection-dismiss"
          data-agent-elements-shell="tracker-sync-rejection-dismiss"
        >
          <MaterialSymbol icon="close" size={14} />
        </button>
      </span>
    </div>
  );
};
