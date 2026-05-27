import React, { useState } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { OverviewDashboard } from './OverviewDashboard';
import { HistoricalGraph } from './HistoricalGraph';
import { ProjectInsights } from './ProjectInsights';
import { ActivityHeatmap } from './ActivityHeatmap';

interface AIUsageReportProps {
  onClose?: () => void;
}

const usageSectionCardClass =
  'dashboard-section agent-elements-ai-usage-section agent-elements-tool-card [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)]';

export const AIUsageReport: React.FC<AIUsageReportProps> = ({ onClose }) => {
  const [workspaceFilter] = useState<string | undefined>(undefined);

  return (
    <div
      className="ai-usage-report agent-elements-ai-usage-report flex h-full flex-col overflow-hidden bg-[var(--an-background)] text-[var(--an-foreground)]"
      data-testid="agent-elements-ai-usage-report"
      data-agent-elements-shell="ai-usage-report"
    >
      <div
        className="ai-usage-report-header agent-elements-ai-usage-header flex min-h-12 items-center gap-3 border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-4"
        data-testid="agent-elements-ai-usage-header"
        data-agent-elements-shell="ai-usage-header"
      >
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-[15px] font-semibold leading-5 text-[var(--an-foreground)]">AI Usage</h1>
          <p className="m-0 truncate text-xs leading-4 text-[var(--an-foreground-muted)]">Local token, session, model, and project activity</p>
        </div>
        {onClose && (
          <button
            type="button"
            className="agent-elements-ai-usage-close flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent bg-transparent text-[var(--an-foreground-muted)] cursor-pointer transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2"
            onClick={onClose}
            aria-label="Close AI usage report"
            data-testid="agent-elements-ai-usage-close"
            data-agent-elements-shell="ai-usage-close"
          >
            <MaterialSymbol icon="close" size={18} />
          </button>
        )}
      </div>

      <div className="ai-usage-report-content flex flex-1 flex-col gap-4 overflow-y-auto p-4 scrollbar-nim">
        <OverviewDashboard workspaceId={workspaceFilter} />

        <div className="dashboard-row grid grid-cols-[repeat(auto-fit,minmax(500px,1fr))] gap-4">
          <div
            className={usageSectionCardClass}
            data-agent-elements-card-padding="symmetric-inline"
            data-agent-elements-card-width="section-row"
            data-testid="agent-elements-ai-usage-section"
            data-agent-elements-shell="ai-usage-section"
          >
            <ActivityHeatmap workspaceId={workspaceFilter} />
          </div>
        </div>

        <div className="dashboard-row grid grid-cols-[repeat(auto-fit,minmax(500px,1fr))] gap-4">
          <div
            className={usageSectionCardClass}
            data-agent-elements-card-padding="symmetric-inline"
            data-agent-elements-card-width="section-row"
            data-testid="agent-elements-ai-usage-section"
            data-agent-elements-shell="ai-usage-section"
          >
            <HistoricalGraph workspaceId={workspaceFilter} />
          </div>
        </div>

        <div className="dashboard-row grid grid-cols-[repeat(auto-fit,minmax(500px,1fr))] gap-4">
          <div
            className={usageSectionCardClass}
            data-agent-elements-card-padding="symmetric-inline"
            data-agent-elements-card-width="section-row"
            data-testid="agent-elements-ai-usage-section"
            data-agent-elements-shell="ai-usage-section"
          >
            <ProjectInsights />
          </div>
        </div>
      </div>
    </div>
  );
};
