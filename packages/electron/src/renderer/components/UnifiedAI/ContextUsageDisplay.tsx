import React, { useId, useMemo, useState, useRef, useCallback } from 'react';
import type { TokenUsageCategory } from '@nimbalyst/runtime/ai/server/types';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { getHelpContent } from '../../help';

const CATEGORY_COLORS = [
  'var(--an-primary-color)',
  'var(--an-diff-added-text)',
  'var(--an-diff-removed-text)',
  'var(--an-foreground-muted)',
  'var(--an-foreground-subtle)',
  'var(--an-tool-color-muted)',
  'var(--an-border-color)',
];

interface ContextUsageDisplayProps {
  inputTokens: number;       // Cumulative input tokens (for tooltip breakdown)
  outputTokens: number;      // Cumulative output tokens (for tooltip breakdown)
  totalTokens: number;       // Cumulative total tokens (fallback if no currentContext)
  contextWindow: number;     // Context window size (legacy, use currentContext)
  categories?: TokenUsageCategory[];  // Categories (legacy, use currentContext)
  // Current context snapshot for Claude Code (from /context command)
  currentContext?: {
    tokens: number;          // Current tokens in context window
    contextWindow: number;   // Max context window size
    categories?: TokenUsageCategory[];
  };
}

interface FormattedCategory extends TokenUsageCategory {
  color: string;
  width: number;
  percentText: string;
}

/**
 * ContextUsageDisplay shows token usage for AI sessions
 *
 * Display formats:
 * - With context window: "110k/200k Tokens (55%)" - shows percentage usage
 * - Without context window: "15k Tokens" - just shows cumulative total
 * - No data yet: "--"
 */
export function ContextUsageDisplay({
  inputTokens,
  outputTokens,
  totalTokens,
  contextWindow,
  categories,
  currentContext
}: ContextUsageDisplayProps) {
  // For context window display, prefer currentContext (from /context command)
  // Fall back to legacy fields for backward compatibility
  const displayTokens = currentContext?.tokens ?? totalTokens;
  const displayContextWindow = currentContext?.contextWindow ?? contextWindow;
  const displayCategories = currentContext?.categories ?? categories;

  // Check what data we have
  const hasTokenData = displayTokens > 0 || totalTokens > 0;
  const hasContextWindow = displayContextWindow > 0;
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);
  const tooltipId = useId();
  const helpContent = getHelpContent('context-indicator');
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate percentage used (only meaningful with context window)
  const percentage = hasContextWindow ? Math.round((displayTokens / displayContextWindow) * 100) : 0;

  // Format numbers with k suffix for thousands
  const formatTokensShort = (tokens: number): string => {
    if (tokens >= 1_000_000) {
      const m = tokens / 1_000_000;
      return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${Math.round(tokens / 1000)}k`;
    }
    return tokens.toString();
  };

  const formatPercent = (value: number): string => {
    if (!Number.isFinite(value)) {
      return '0';
    }
    return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  };

  const formattedCategories = useMemo<FormattedCategory[]>(() => {
    if (!displayCategories || displayCategories.length === 0) {
      return [];
    }

    return displayCategories
      .filter(cat => cat && (cat.tokens > 0 || cat.percentage > 0))
      .map((cat, index) => ({
        ...cat,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        width: Math.max(0, Math.min(cat.percentage, 100)),
        percentText: formatPercent(cat.percentage)
      }));
  }, [displayCategories]);

  // Categories that represent actual usage (exclude "Free space" from bar fill)
  const usedCategories = useMemo(() => {
    return formattedCategories.filter(cat =>
      !cat.name.toLowerCase().includes('free')
    );
  }, [formattedCategories]);

  // Total width of used categories for the bar fill
  const usedPercentage = useMemo(() => {
    return usedCategories.reduce((sum, cat) => sum + cat.width, 0);
  }, [usedCategories]);

  const enableTooltip = hasTokenData && (formattedCategories.length > 0 || inputTokens > 0 || outputTokens > 0);
  const shouldShowTooltip = tooltipVisible && enableTooltip;

  // Clear any pending hide timeout
  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Show tooltip immediately, hide with delay to allow moving mouse to tooltip
  const handleMouseEnter = useCallback(() => {
    clearHideTimeout();
    if (enableTooltip) {
      setTooltipVisible(true);
    }
  }, [enableTooltip, clearHideTimeout]);

  const handleMouseLeave = useCallback(() => {
    // Delay hiding to allow moving mouse to tooltip
    hideTimeoutRef.current = setTimeout(() => {
      setTooltipVisible(false);
    }, 150);
  }, []);

  const getUsageClass = (): string => {
    if (!hasTokenData) return 'usage-normal';
    if (hasContextWindow && percentage >= 90) return 'usage-critical';
    if (hasContextWindow && percentage >= 80) return 'usage-warning';
    return 'usage-normal';
  };

  // Build display text
  const getDisplayText = (): string => {
    if (!hasTokenData) return '--';
    if (hasContextWindow) {
      return `${formatTokensShort(displayTokens)}/${formatTokensShort(displayContextWindow)} (${percentage}%)`;
    }
    return `${formatTokensShort(displayTokens)} tokens`;
  };

  const label = hasTokenData
    ? hasContextWindow
      ? `Context usage ${formatTokensShort(displayTokens)} of ${formatTokensShort(displayContextWindow)} tokens (${percentage}%)`
      : `Token usage: ${formatTokensShort(displayTokens)} total tokens`
    : 'Token usage data not available yet';

  // Usage level styling
  const usageClass = getUsageClass();
  const usageStyles = {
    'usage-normal': 'bg-[var(--an-background-secondary)] border-[var(--an-border-color)]',
    'usage-warning':
      'bg-[color-mix(in_srgb,var(--an-primary-color)_10%,transparent)] border-[color-mix(in_srgb,var(--an-primary-color)_28%,var(--an-border-color))]',
    'usage-critical': 'bg-[var(--an-diff-removed-bg)] border-[var(--an-diff-removed-border)]',
  };
  const textStyles = {
    'usage-normal': 'text-[var(--an-foreground-muted)]',
    'usage-warning': 'text-[var(--an-primary-color)]',
    'usage-critical': 'text-[var(--an-diff-removed-text)]',
  };

  return (
    <div
      className={`context-usage-display agent-elements-context-usage ${usageClass} relative ml-auto inline-flex cursor-default items-center gap-[var(--an-spacing-xs)] whitespace-nowrap rounded-[calc(var(--an-tool-border-radius)_-_4px)] border px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)] text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-primary-color)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--an-background)] max-[400px]:hidden ${usageStyles[usageClass as keyof typeof usageStyles]}`}
      tabIndex={hasTokenData ? 0 : -1}
      aria-label={label}
      aria-describedby={shouldShowTooltip ? tooltipId : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      role="group"
      data-testid="context-indicator"
      data-agent-elements-shell="context-usage"
      data-component="UnifiedAIContextUsageDisplay"
      data-usage-state={usageClass.replace('usage-', '')}
      data-has-context-window={hasContextWindow}
    >
      <span className={`usage-text ${textStyles[usageClass as keyof typeof textStyles]}`}>{getDisplayText()}</span>

      {shouldShowTooltip && (
        <div
          className="context-usage-tooltip agent-elements-context-usage-tooltip absolute right-0 bottom-[calc(100%+var(--an-spacing-sm))] z-10 box-border w-[280px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-md)] text-[var(--an-foreground)]"
          id={tooltipId}
          role="tooltip"
          data-agent-elements-shell="context-usage-tooltip"
          data-component="UnifiedAIContextUsageTooltip"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="tooltip-header mb-[var(--an-spacing-sm)] flex items-center justify-between text-xs text-[var(--an-foreground-muted)]">
            <div className="tooltip-header-left flex items-center gap-[var(--an-spacing-xs)]">
              <span>{hasContextWindow ? 'Context Breakdown' : 'Token Usage'}</span>
              {helpContent && (
                <button
                  className="tooltip-help-button inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-none bg-[var(--an-background-tertiary)] p-0 text-[var(--an-foreground-subtle)] transition-[background-color,color] duration-150 hover:bg-[var(--an-background-secondary)] hover:text-[var(--an-foreground-muted)] focus-visible:ring-2 focus-visible:ring-[var(--an-primary-color)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHelpExpanded(!helpExpanded);
                  }}
                  title={helpExpanded ? 'Hide help' : 'What is this?'}
                  aria-expanded={helpExpanded}
                >
                  <MaterialSymbol icon={helpExpanded ? 'expand_less' : 'help'} size={14} />
                </button>
              )}
            </div>
            {hasContextWindow && (
              <span className="tooltip-total font-semibold text-[var(--an-foreground)]">
                {formatTokensShort(displayTokens)} / {formatTokensShort(displayContextWindow)}
              </span>
            )}
          </div>

          {/* Expandable help section */}
          {helpExpanded && helpContent && (
            <div className="tooltip-help-section mb-[var(--an-spacing-md)] box-border overflow-hidden whitespace-normal rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-sm)]">
              <div className="tooltip-help-title mb-[var(--an-spacing-xs)] whitespace-normal text-xs font-semibold text-[var(--an-foreground)]">{helpContent.title}</div>
              <div className="tooltip-help-body whitespace-normal break-words text-[11px] leading-[1.4] text-[var(--an-foreground-muted)]">{helpContent.body}</div>
            </div>
          )}

          {/* Show input/output breakdown if available */}
          {(inputTokens > 0 || outputTokens > 0) && (
            <div className="tooltip-io-breakdown mb-[var(--an-spacing-sm)] flex flex-col gap-[var(--an-spacing-xs)] border-b border-[var(--an-border-color)] py-[var(--an-spacing-sm)]">
              <div className="tooltip-io-row flex justify-between text-[11px]">
                <span className="tooltip-io-label text-[var(--an-foreground-muted)]">Input:</span>
                <span className="tooltip-io-value tabular-nums text-[var(--an-foreground)]">{inputTokens.toLocaleString()}</span>
              </div>
              <div className="tooltip-io-row flex justify-between text-[11px]">
                <span className="tooltip-io-label text-[var(--an-foreground-muted)]">Output:</span>
                <span className="tooltip-io-value tabular-nums text-[var(--an-foreground)]">{outputTokens.toLocaleString()}</span>
              </div>
              <div className="tooltip-io-row tooltip-io-total mt-[var(--an-spacing-xs)] flex justify-between border-t border-[var(--an-border-color)] pt-[var(--an-spacing-xs)] text-[11px] font-semibold">
                <span className="tooltip-io-label text-[var(--an-foreground-muted)]">Total:</span>
                <span className="tooltip-io-value tabular-nums text-[var(--an-foreground)]">{totalTokens.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Category bar (only for Claude Code with context data) */}
          {hasContextWindow && formattedCategories.length > 0 && (
            <>
              <div className="tooltip-bar relative mb-[var(--an-spacing-md)] h-2.5 overflow-hidden rounded-full border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)]">
                <div className="tooltip-bar-fill flex h-full rounded-full" style={{ width: `${usedPercentage}%` }}>
                  {usedCategories.map((cat, index) => {
                    // Calculate width relative to the used portion
                    const relativeWidth = usedPercentage > 0 ? (cat.width / usedPercentage) * 100 : 0;
                    return (
                      <span
                        key={`${cat.name}-${index}`}
                        className="tooltip-bar-segment h-full"
                        style={{ width: `${relativeWidth}%`, backgroundColor: cat.color }}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="tooltip-categories flex flex-col gap-[var(--an-spacing-xs)]">
                {formattedCategories.map((cat, index) => {
                  const isFreeSpace = cat.name.toLowerCase().includes('free');
                  return (
                    <div
                      className="tooltip-category-row grid grid-cols-[10px_1fr_auto_auto] items-center gap-[var(--an-spacing-xs)] text-[11px]"
                      key={`${cat.name}-${index}`}
                    >
                      <span
                        className={`tooltip-dot inline-block h-2 w-2 rounded-full ${isFreeSpace ? 'border border-[var(--an-border-color)] bg-transparent' : ''}`}
                        style={isFreeSpace ? undefined : { backgroundColor: cat.color }}
                      />
                      <span className="tooltip-category-name text-[var(--an-foreground)]">{cat.name}</span>
                      <span className="tooltip-category-tokens tabular-nums text-[var(--an-foreground-muted)]">{cat.tokens.toLocaleString()} tokens</span>
                      <span className="tooltip-category-percent tabular-nums font-semibold text-[var(--an-foreground)]">{cat.percentText}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
