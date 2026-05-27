import React from 'react';
import { AgentStatusPill, AgentToolCard } from '../../AgentElements';
import { SPECIAL_STATUS_BODY_CLASS } from './SpecialStatusWidgetChrome';

interface RateLimitWidgetProps {
  content: string;
}

/**
 * Parses rate limit info from the HTML comment marker format:
 * <!-- [RATE_LIMIT_WARNING] limitType=5-hour session resetsAtUnix=1772233200 usage=91 -->
 * <!-- [RATE_LIMIT] limitType=5-hour session resetsAtUnix=1772233200 -->
 */
function parseRateLimitInfo(content: string): {
  isWarning: boolean;
  limitType: string;
  resetsAtMs: number | null;
  utilization: number | null;
  model: string | null;
} {
  const isWarning = content.includes('[RATE_LIMIT_WARNING]');
  const limitTypeMatch = content.match(/limitType=([^\s]+(?:\s+[^\s=]+)*?)(?:\s+resetsAtUnix=|\s+usage=|\s*-->)/);
  const resetsAtMatch = content.match(/resetsAtUnix=(\d+)/);
  const utilizationMatch = content.match(/usage=(\d+)/);
  const modelMatch = content.match(/model=([^\s>]+)/);

  return {
    isWarning,
    limitType: limitTypeMatch ? limitTypeMatch[1] : 'usage',
    // Convert Unix seconds to milliseconds for Date math
    resetsAtMs: resetsAtMatch ? parseInt(resetsAtMatch[1], 10) * 1000 : null,
    utilization: utilizationMatch ? parseInt(utilizationMatch[1], 10) : null,
    model: modelMatch ? modelMatch[1] : null,
  };
}

function formatResetTime(resetsAtMs: number): string {
  const diffMs = resetsAtMs - Date.now();

  if (diffMs <= 0) return 'any moment now';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;

  if (diffHours > 0) {
    return `${diffHours}h ${remainingMinutes}m`;
  }
  return `${diffMinutes}m`;
}

export const RateLimitWidget: React.FC<RateLimitWidgetProps> = ({ content }) => {
  const { isWarning, limitType, resetsAtMs, utilization, model } = parseRateLimitInfo(content);
  const is1mModel = model != null && model.includes('-1m');
  const title = isWarning ? 'Approaching rate limit' : 'Rate limit reached';
  const shell = isWarning ? 'rate-limit-warning' : 'rate-limit-blocked';
  const status = isWarning ? 'idle' : 'error';
  const tone = isWarning ? 'warning' : 'error';
  const iconColor = isWarning ? 'text-[var(--an-warning-color)]' : 'text-[var(--an-diff-removed-text)]';

  return (
    <AgentToolCard
      className={isWarning ? 'rate-limit-widget' : 'rate-limit-widget-blocked'}
      data-agent-elements-shell={shell}
      data-component="RateLimitWidget"
      data-testid="agent-elements-rate-limit-widget"
      icon={<span className={iconColor}>!</span>}
      status={status}
      subtitle={model ?? limitType}
      title={title}
      trailing={<AgentStatusPill tone={tone}>{isWarning ? 'Warning' : 'Blocked'}</AgentStatusPill>}
    >
      <div className={SPECIAL_STATUS_BODY_CLASS}>
        {isWarning
          ? `You're at ${utilization != null ? `${utilization}%` : 'near'} of your ${limitType} limit.`
          : `You've hit your ${limitType} rate limit.`}
        {resetsAtMs && ` Resets in ${formatResetTime(resetsAtMs)}.`}
        {!isWarning && is1mModel && ' This 1M context model may not be available on your plan.'}
      </div>
    </AgentToolCard>
  );
};
