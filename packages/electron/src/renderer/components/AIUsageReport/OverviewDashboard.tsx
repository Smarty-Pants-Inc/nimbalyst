import React, { useEffect, useState } from 'react';

interface OverviewDashboardProps {
  workspaceId?: string;
}

interface TokenUsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  sessionCount: number;
  messageCount: number;
}

interface ProviderUsageStats {
  provider: string;
  model: string | null;
  sessionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
}

const statCardClass =
  'stat-card agent-elements-ai-usage-stat-card agent-elements-tool-card [--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)]';

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ workspaceId }) => {
  const [overallStats, setOverallStats] = useState<TokenUsageStats | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderUsageStats[]>([]);
  const [allSessionCount, setAllSessionCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [overall, providers, totalSessions] = await Promise.all([
          window.electronAPI.invoke('usage-analytics:get-overall-stats', workspaceId),
          window.electronAPI.invoke('usage-analytics:get-usage-by-provider', workspaceId),
          window.electronAPI.invoke('usage-analytics:get-all-session-count', workspaceId),
        ]);
        setOverallStats(overall);
        setProviderStats(providers);
        setAllSessionCount(totalSessions);
      } catch (error) {
        console.error('Failed to load overview data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [workspaceId]);

  if (loading) {
    return (
      <div
        className="overview-loading agent-elements-ai-usage-loading flex min-h-[300px] items-center justify-center text-base text-[var(--an-foreground-muted)]"
        data-agent-elements-shell="ai-usage-loading"
      >
        Loading...
      </div>
    );
  }

  if (!overallStats) {
    return (
      <div
        className="overview-empty agent-elements-ai-usage-empty flex min-h-[300px] items-center justify-center text-base text-[var(--an-foreground-muted)]"
        data-agent-elements-shell="ai-usage-empty"
      >
        No usage data available
      </div>
    );
  }

  // Get most used provider
  const mostUsedProvider = providerStats.length > 0 ? providerStats[0] : null;

  return (
    <div
      className="overview-dashboard agent-elements-ai-usage-overview flex flex-col gap-4"
      data-agent-elements-shell="ai-usage-overview"
    >
      <div className="stats-grid grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
        <div
          className={statCardClass}
          data-agent-elements-card-padding="symmetric-inline"
          data-agent-elements-card-width="grid-cell"
        >
          <div className="stat-label mb-1 text-[11px] font-medium leading-4 text-[var(--an-foreground-subtle)]">
            Total Sessions
          </div>
          <div className="stat-value mb-0.5 text-2xl font-semibold leading-8 text-[var(--an-foreground)]">
            {allSessionCount.toLocaleString()}
          </div>
          {overallStats.sessionCount < allSessionCount && (
            <div className="stat-detail text-[11px] text-[var(--an-foreground-muted)]">
              {overallStats.sessionCount.toLocaleString()} with token data
            </div>
          )}
        </div>

        <div
          className={statCardClass}
          data-agent-elements-card-padding="symmetric-inline"
          data-agent-elements-card-width="grid-cell"
        >
          <div className="stat-label mb-1 text-[11px] font-medium leading-4 text-[var(--an-foreground-subtle)]">
            Total Tokens
          </div>
          <div className="stat-value mb-0.5 text-2xl font-semibold leading-8 text-[var(--an-foreground)]">
            {overallStats.totalTokens.toLocaleString()}
          </div>
          <div className="stat-detail text-[11px] text-[var(--an-foreground-muted)]">
            {overallStats.totalInputTokens.toLocaleString()} in / {overallStats.totalOutputTokens.toLocaleString()} out
          </div>
        </div>

        {mostUsedProvider && (
          <div
            className={statCardClass}
            data-agent-elements-card-padding="symmetric-inline"
            data-agent-elements-card-width="grid-cell"
          >
            <div className="stat-label mb-1 text-[11px] font-medium leading-4 text-[var(--an-foreground-subtle)]">
              Most Used
            </div>
            <div className="stat-value mb-0.5 text-2xl font-semibold leading-8 text-[var(--an-foreground)]">
              {mostUsedProvider.provider}
            </div>
            <div className="stat-detail text-[11px] text-[var(--an-foreground-muted)]">
              {mostUsedProvider.model || 'Default model'} - {mostUsedProvider.sessionCount} sessions
            </div>
          </div>
        )}
      </div>

      {providerStats.length > 0 && (
        <div className="provider-breakdown agent-elements-ai-usage-provider-breakdown mt-2">
          <h3 className="m-0 mb-3 text-sm font-semibold text-[var(--an-foreground)]">
            Usage by Provider
          </h3>
          <div className="provider-bars flex flex-col gap-2">
            {providerStats.map((provider, index) => {
              const maxTokens = providerStats[0]?.totalTokens || 1;
              const percentage = (provider.totalTokens / maxTokens) * 100;
              const displayName = provider.model
                ? `${provider.provider} (${provider.model})`
                : provider.provider;
              return (
                <div key={index} className="provider-bar-item flex flex-col gap-1">
                  <div className="provider-bar-label flex justify-between items-center">
                    <span className="provider-bar-name text-xs font-medium text-[var(--an-foreground)]">
                      {displayName}
                    </span>
                    <span className="provider-bar-tokens text-[11px] text-[var(--an-foreground-muted)]">
                      {provider.totalTokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="provider-bar-track h-1.5 overflow-hidden rounded-[6px] bg-[var(--an-background-tertiary)]">
                    <div
                      className="provider-bar-fill h-full rounded-[6px] bg-[var(--an-primary-color)] transition-[width] duration-200 ease-out"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
