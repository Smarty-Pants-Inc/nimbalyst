import React, { useCallback, useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { sessionWakeupAtom, type SessionWakeupView } from '../../store/atoms/sessions';

interface WakeupBannerProps {
  sessionId?: string | null;
}

function formatRelativeFireAt(fireAt: number): string {
  const ms = fireAt - Date.now();
  if (ms <= 0) return 'now';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `in ${days}d ${hours % 24}h`;
}

function formatAbsoluteFireAt(fireAt: number): string {
  return new Date(fireAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusLabel(wakeup: SessionWakeupView): string {
  switch (wakeup.status) {
    case 'pending':
      return `Scheduled to resume ${formatRelativeFireAt(wakeup.fireAt)} (${formatAbsoluteFireAt(wakeup.fireAt)})`;
    case 'firing':
      return 'Resuming session…';
    case 'waiting_for_workspace':
      return 'Waiting for the workspace window to open';
    case 'overdue': {
      const hoursAgo = Math.max(0, Math.floor((Date.now() - wakeup.fireAt) / 3_600_000));
      return hoursAgo > 0
        ? `Wakeup was due ${hoursAgo}h ago, fire now or cancel?`
        : 'Wakeup was due while the app was closed, fire now or cancel?';
    }
    default:
      return '';
  }
}

export function WakeupBanner({ sessionId }: WakeupBannerProps) {
  const effectiveSessionId = sessionId || '__no_session__';
  const wakeup = useAtomValue(sessionWakeupAtom(effectiveSessionId));
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  // Re-render every 30s so the relative time stays fresh.
  useEffect(() => {
    if (!wakeup || wakeup.status !== 'pending') return;
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, [wakeup]);

  const handleCancel = useCallback(async () => {
    if (!wakeup || busy) return;
    setBusy(true);
    try {
      await window.electronAPI.invoke('wakeup:cancel', wakeup.id);
    } catch (error) {
      console.error('[WakeupBanner] cancel failed', error);
    } finally {
      setBusy(false);
    }
  }, [wakeup, busy]);

  const handleRunNow = useCallback(async () => {
    if (!wakeup || busy) return;
    setBusy(true);
    try {
      await window.electronAPI.invoke('wakeup:run-now', wakeup.id);
    } catch (error) {
      console.error('[WakeupBanner] run-now failed', error);
    } finally {
      setBusy(false);
    }
  }, [wakeup, busy]);

  if (!sessionId) return null;
  if (!wakeup) return null;

  const isOverdue = wakeup.status === 'overdue';
  const toneColor = isOverdue ? 'var(--an-warning-color)' : 'var(--an-primary-color)';
  const containerClass =
    'agent-elements-wakeup-banner agent-elements-status-banner flex items-center justify-between gap-3 px-3 py-2 border-b text-[var(--an-foreground)] transition-[background-color,border-color,color] duration-150 ease-out';
  const toneClass = isOverdue
    ? 'border-[color-mix(in_srgb,var(--an-warning-color)_26%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_8%,var(--an-background))]'
    : 'border-[color-mix(in_srgb,var(--an-primary-color)_22%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_7%,var(--an-background))]';
  const textClass = 'agent-elements-status-banner-text truncate text-xs font-medium';
  const actionClass =
    'agent-elements-status-banner-action flex items-center gap-1 rounded-[var(--an-radius-sm)] border border-current bg-transparent px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-[background-color,border-color,color] duration-150 ease-out hover:enabled:bg-[color-mix(in_srgb,currentColor_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)] disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div
      className={`${containerClass} ${toneClass}`}
      data-testid="wakeup-banner"
      data-agent-elements-shell="wakeup-banner"
      data-wakeup-status={wakeup.status}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <MaterialSymbol icon="schedule" size={16} className="agent-elements-status-banner-icon shrink-0" style={{ color: toneColor }} />
        <span className={textClass} style={{ color: toneColor }}>
          {statusLabel(wakeup)}
          {wakeup.reason ? <span className="opacity-80">, {wakeup.reason}</span> : null}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {(wakeup.status === 'pending' || wakeup.status === 'overdue') && (
          <button
            type="button"
            onClick={handleRunNow}
            disabled={busy}
            className={actionClass}
            data-testid="wakeup-banner-run-now"
            title="Fire this wakeup right now"
            style={{ color: toneColor }}
          >
            <MaterialSymbol icon="bolt" size={14} />
            Fire now
          </button>
        )}
        <button
          type="button"
          onClick={handleCancel}
          disabled={busy}
          className="agent-elements-status-banner-action flex items-center gap-1 rounded-[var(--an-radius-sm)] border border-[var(--an-border-color)] bg-transparent px-2.5 py-1 text-[var(--an-foreground-muted)] text-[11px] font-medium cursor-pointer transition-[background-color,border-color,color] duration-150 ease-out hover:enabled:bg-[var(--an-background-tertiary)] hover:enabled:text-[var(--an-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)] disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="wakeup-banner-cancel"
          title="Cancel the scheduled wakeup"
        >
          <MaterialSymbol icon="cancel" size={14} />
          Cancel
        </button>
      </div>
    </div>
  );
}
