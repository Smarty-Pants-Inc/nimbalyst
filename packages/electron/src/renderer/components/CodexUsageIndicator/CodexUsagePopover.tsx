/**
 * CodexUsagePopover - detailed Codex usage information popover.
 *
 * Shows session and weekly usage with progress bars and reset times.
 */

import React, { RefObject, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import {
  codexUsageAtom,
  codexUsageSessionColorAtom,
  codexUsageWeeklyColorAtom,
  formatResetTime,
  setCodexUsageIndicatorEnabledAtom,
} from '../../store/atoms/codexUsageAtoms';
import { FloatingPortal, useFloatingMenu } from '../../hooks/useFloatingMenu';

type UsageVisualState = 'healthy' | 'warning' | 'danger' | 'muted';

interface CodexUsagePopoverProps {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

interface UsageSectionProps {
  title: string;
  subtitle: string;
  utilization: number;
  resetsAt: string | null;
  color: 'green' | 'yellow' | 'red' | 'muted';
  windowDurationMs: number;
}

const sectionedPopoverCardGutters =
  '[--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-xxl)] !gap-0 !p-0';

function calculateTimeElapsedPercent(resetsAt: string | null, windowDurationMs: number): number {
  if (!resetsAt) return 0;

  const resetTime = new Date(resetsAt).getTime();
  const now = Date.now();
  const windowStartTime = resetTime - windowDurationMs;
  const elapsedMs = now - windowStartTime;
  const percent = (elapsedMs / windowDurationMs) * 100;
  return Math.max(0, Math.min(100, percent));
}

function getUsageVisualState(color: string): UsageVisualState {
  if (color === 'green') return 'healthy';
  if (color === 'yellow') return 'warning';
  if (color === 'red') return 'danger';
  return 'muted';
}

function getUsageColorClasses(state: UsageVisualState): { text: string; fill: string; marker: string } {
  switch (state) {
    case 'healthy':
      return {
        text: 'text-[var(--an-success-color)]',
        fill: 'bg-[var(--an-success-color)]',
        marker: 'bg-[var(--an-success-color)]',
      };
    case 'warning':
      return {
        text: 'text-[var(--an-warning-color)]',
        fill: 'bg-[var(--an-warning-color)]',
        marker: 'bg-[var(--an-warning-color)]',
      };
    case 'danger':
      return {
        text: 'text-[var(--an-error-color)]',
        fill: 'bg-[var(--an-error-color)]',
        marker: 'bg-[var(--an-error-color)]',
      };
    default:
      return {
        text: 'text-[var(--an-foreground-muted)]',
        fill: 'bg-[var(--an-foreground-subtle)]',
        marker: 'bg-[var(--an-foreground-subtle)]',
      };
  }
}

const UsageSection: React.FC<UsageSectionProps> = ({
  title,
  subtitle,
  utilization,
  resetsAt,
  color,
  windowDurationMs,
}) => {
  const state = getUsageVisualState(color);
  const colors = getUsageColorClasses(state);
  const timeElapsedPercent = calculateTimeElapsedPercent(resetsAt, windowDurationMs);
  const isOverPacing = utilization > timeElapsedPercent;

  return (
    <div
      className="agent-elements-usage-section mb-4 last:mb-0"
      data-agent-elements-shell="usage-section"
      data-usage-state={state}
      data-testid="agent-elements-codex-usage-section"
    >
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-5 text-[var(--an-foreground)]">{title}</div>
          <div className="text-[11px] leading-4 text-[var(--an-foreground-muted)]">{subtitle}</div>
        </div>
        <div className={`text-[16px] font-semibold leading-5 ${colors.text}`}>
          {Math.round(utilization)}%
        </div>
      </div>
      <div className="relative mb-1.5 h-1.5 overflow-hidden rounded-[999px] bg-[var(--an-background-tertiary)]">
        <div
          className={`h-full rounded-[999px] transition-[width] duration-300 ease-out ${colors.fill}`}
          style={{ width: `${Math.min(utilization, 100)}%` }}
        />
        <div
          className={`absolute top-0 h-full w-0.5 transition-[left,background-color] duration-300 ease-out ${isOverPacing ? 'bg-[var(--an-error-color)]' : colors.marker}`}
          style={{ left: `${timeElapsedPercent}%` }}
          title={`${Math.round(timeElapsedPercent)}% of window elapsed`}
        />
      </div>
      <div className="flex items-center gap-1 text-[11px] leading-4 text-[var(--an-foreground-muted)]">
        <MaterialSymbol icon="schedule" size={12} className="opacity-70" />
        <span>Resets in {formatResetTime(resetsAt)}</span>
      </div>
    </div>
  );
};

export const CodexUsagePopover: React.FC<CodexUsagePopoverProps> = ({
  anchorRef,
  onClose,
  onRefresh,
}) => {
  const usage = useAtomValue(codexUsageAtom);
  const sessionColor = useAtomValue(codexUsageSessionColorAtom);
  const weeklyColor = useAtomValue(codexUsageWeeklyColorAtom);
  const setUsageIndicatorEnabled = useSetAtom(setCodexUsageIndicatorEnabledAtom);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const menu = useFloatingMenu({
    placement: 'right-end',
    open: true,
    onOpenChange: (open) => { if (!open) onClose(); },
  });

  useEffect(() => {
    if (anchorRef.current) {
      menu.refs.setReference(anchorRef.current);
    }
  }, [anchorRef, menu.refs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!usage) {
    return null;
  }

  const limitsAvailable = usage.limitsAvailable ?? true;

  return (
    <FloatingPortal>
      <div
        ref={menu.refs.setFloating}
        style={menu.floatingStyles}
        {...menu.getFloatingProps()}
        className={`agent-elements-usage-popover agent-elements-tool-card z-50 max-h-[min(420px,calc(100vh-24px))] w-60 overflow-y-auto rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)] ${sectionedPopoverCardGutters}`}
        data-agent-elements-shell="codex-usage-popover"
        data-agent-elements-card-padding="sectioned-symmetric"
        data-agent-elements-card-width="floating-popover"
        data-usage-provider="codex"
        data-testid="codex-usage-popover"
      >
        <div className="agent-elements-usage-popover-header flex items-center justify-between border-b border-[var(--an-border-color)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-info-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-info-color)_10%,var(--an-background))] text-[var(--an-info-color)]">
              <MaterialSymbol icon="data_usage" size={16} />
            </span>
            <span className="text-[14px] font-semibold leading-5 text-[var(--an-foreground)]">Codex Usage</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-[var(--an-tool-border-radius)] border border-transparent p-1 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)] disabled:opacity-50"
              aria-label="Refresh usage"
            >
              <MaterialSymbol icon="refresh" size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="rounded-[var(--an-tool-border-radius)] border border-transparent p-1 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
              aria-label="Close Codex usage"
            >
              <MaterialSymbol icon="close" size={14} />
            </button>
          </div>
        </div>

        <div className="px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]">
          {usage.error ? (
            <div className="agent-elements-status-pill rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-error-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-error-color)_8%,var(--an-background))] px-3 py-2 text-[13px] leading-5 text-[var(--an-error-color)]">
              {usage.error}
            </div>
          ) : (
            <>
              {!limitsAvailable && (
                <div className="agent-elements-status-pill mb-3 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-3 py-2 text-[12px] leading-5 text-[var(--an-foreground-muted)]">
                  Usage detected, but Codex limits are unavailable in recent session data.
                </div>
              )}
              <UsageSection
                title="Session"
                subtitle="5-hour window"
                utilization={usage.fiveHour.utilization}
                resetsAt={usage.fiveHour.resetsAt}
                color={sessionColor as 'green' | 'yellow' | 'red' | 'muted'}
                windowDurationMs={5 * 60 * 60 * 1000}
              />
              <UsageSection
                title="Weekly"
                subtitle="7-day window"
                utilization={usage.sevenDay.utilization}
                resetsAt={usage.sevenDay.resetsAt}
                color={weeklyColor as 'green' | 'yellow' | 'red' | 'muted'}
                windowDurationMs={7 * 24 * 60 * 60 * 1000}
              />
            </>
          )}
        </div>

        <div className="flex flex-col gap-1.5 border-t border-[var(--an-border-color)] px-[var(--agent-elements-card-inline-padding)] py-[var(--an-spacing-sm)]">
          <div className="flex items-center justify-between gap-3">
            {usage.lastUpdated && (
              <span className="text-[10px] leading-4 text-[var(--an-foreground-subtle)]">
                Updated {formatLastUpdated(usage.lastUpdated)}
              </span>
            )}
            <button
              onClick={() => {
                setUsageIndicatorEnabled(false);
                onClose();
              }}
              className="rounded-[var(--an-tool-border-radius)] border border-transparent px-2 py-0.5 text-[11px] font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
              aria-label="Disable Codex usage indicator"
            >
              Disable
            </button>
          </div>
          <button
            onClick={() => window.electronAPI.openExternal('https://status.openai.com')}
            className="flex items-center gap-1 rounded-[var(--an-tool-border-radius)] border border-transparent px-1 py-0.5 text-[11px] leading-4 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
            aria-label="OpenAI Status Page"
          >
            <MaterialSymbol icon="open_in_new" size={12} />
            <span>OpenAI Status Page</span>
          </button>
        </div>
      </div>
    </FloatingPortal>
  );
};

function formatLastUpdated(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffSeconds < 60) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
}
