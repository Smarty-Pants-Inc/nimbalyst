/**
 * CodexUsageIndicator - circular usage indicator for Codex.
 *
 * Displays the 5-hour session utilization in the navigation gutter. Clicking
 * opens a popover with full details. Error states render as a blank indicator
 * with hover details.
 */

import React, { useCallback, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  codexUsageAtom,
  codexUsageAvailableAtom,
  codexUsageIndicatorEnabledAtom,
  codexUsageSessionColorAtom,
  formatResetTime,
} from '../../store/atoms/codexUsageAtoms';
import { CodexUsagePopover } from './CodexUsagePopover';
import { refreshCodexUsage } from '../../store/listeners/codexUsageListeners';

type UsageVisualState = 'healthy' | 'warning' | 'danger' | 'muted';

interface CodexUsageIndicatorProps {
  className?: string;
}

function getUsageVisualState(color: string, forceMuted = false): UsageVisualState {
  if (forceMuted) return 'muted';
  if (color === 'green') return 'healthy';
  if (color === 'yellow') return 'warning';
  if (color === 'red') return 'danger';
  return 'muted';
}

function getUsageRingColor(state: UsageVisualState): string {
  switch (state) {
    case 'healthy':
      return 'var(--nim-success)';
    case 'warning':
      return 'var(--nim-warning)';
    case 'danger':
      return 'var(--nim-error)';
    default:
      return 'var(--an-foreground-subtle)';
  }
}

function getUsageRingStyle(utilization: number, state: UsageVisualState): React.CSSProperties {
  const clampedUtilization = Math.max(0, Math.min(utilization, 100));
  return {
    '--usage-ring-color': getUsageRingColor(state),
    background: `conic-gradient(var(--usage-ring-color) ${clampedUtilization}%, var(--an-background-tertiary) 0)`,
  } as React.CSSProperties;
}

export const CodexUsageIndicator: React.FC<CodexUsageIndicatorProps> = ({ className }) => {
  const usage = useAtomValue(codexUsageAtom);
  const isAvailable = useAtomValue(codexUsageAvailableAtom);
  const isEnabled = useAtomValue(codexUsageIndicatorEnabledAtom);
  const sessionColor = useAtomValue(codexUsageSessionColorAtom);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => {
    setIsPopoverOpen((prev) => !prev);
  }, []);

  const handleRefresh = useCallback(async () => {
    await refreshCodexUsage();
  }, []);

  if (!isEnabled || !isAvailable) {
    return null;
  }

  const hasLoadError = Boolean(usage?.error);
  const utilization = hasLoadError ? 0 : usage?.fiveHour?.utilization ?? 0;
  const limitsAvailable = !hasLoadError && (usage?.limitsAvailable ?? true);
  const usageState = getUsageVisualState(sessionColor, !limitsAvailable);

  const tooltipContent = usage?.error
    ? `Codex usage unavailable: ${usage.error}`
    : usage
      ? limitsAvailable
        ? `Codex: ${Math.round(utilization)}% (resets ${formatResetTime(usage.fiveHour.resetsAt)})`
        : 'Codex usage (limits unavailable)'
      : 'Codex usage unavailable';

  return (
    <div
      className={`agent-elements-usage-indicator relative ${className || ''}`}
      data-component="CodexUsageIndicator"
      data-agent-elements-shell="usage-indicator-root"
      data-usage-provider="codex"
    >
      <button
        ref={buttonRef}
        onClick={handleClick}
        title={tooltipContent}
        className="nav-button agent-elements-usage-indicator-button relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--an-tool-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
        aria-label="Codex Usage"
        aria-expanded={isPopoverOpen}
        aria-haspopup="menu"
        data-agent-elements-shell="codex-usage-indicator"
        data-usage-provider="codex"
        data-usage-state={usageState}
        data-testid="codex-usage-indicator"
      >
        <span
          className="agent-elements-usage-ring relative flex h-8 w-8 items-center justify-center rounded-[999px] border border-[color-mix(in_srgb,var(--usage-ring-color)_28%,var(--an-border-color))] transition-[background,border-color] duration-300 ease-out"
          data-agent-elements-shell="usage-ring"
          data-usage-state={usageState}
          data-testid="agent-elements-codex-usage-ring"
          style={getUsageRingStyle(utilization, usageState)}
        >
          <span className="absolute inset-[4px] rounded-[999px] bg-[var(--an-background)]" />
        </span>
        <span className="agent-elements-usage-percent absolute inset-0 flex items-center justify-center text-[9px] font-semibold leading-none text-[var(--an-foreground)]">
          {limitsAvailable ? `${Math.round(utilization)}%` : '--'}
        </span>
      </button>

      {isPopoverOpen && (
        <CodexUsagePopover
          anchorRef={buttonRef}
          onClose={() => setIsPopoverOpen(false)}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
};
