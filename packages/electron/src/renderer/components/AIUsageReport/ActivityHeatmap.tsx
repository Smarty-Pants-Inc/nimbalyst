import React, { useEffect, useState } from 'react';

interface ActivityHeatmapProps {
  workspaceId?: string;
}

interface ActivityHeatmapData {
  hourOfDay: number;
  dayOfWeek: number;
  activityCount: number;
}

type ActivityMetric = 'sessions' | 'messages' | 'edits';

const METRIC_LABELS: Record<ActivityMetric, { title: string; description: string }> = {
  sessions: {
    title: 'AI Sessions Created',
    description: 'When new AI chat sessions are started',
  },
  messages: {
    title: 'AI Messages Sent',
    description: 'When you send messages to AI',
  },
  edits: {
    title: 'Documents Edited',
    description: 'When documents are saved',
  },
};

function getHeatmapBackground(intensity: number): string | undefined {
  if (intensity <= 0) return undefined;
  const mix = Math.max(14, Math.round(intensity * 72));
  return `color-mix(in srgb, var(--an-primary-color) ${mix}%, var(--an-background))`;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ workspaceId }) => {
  const [data, setData] = useState<ActivityHeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<ActivityMetric>('messages');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Get user's timezone offset in minutes (e.g., -300 for EST)
        const timezoneOffsetMinutes = new Date().getTimezoneOffset();

        const heatmapData = await window.electronAPI.invoke(
          'usage-analytics:get-activity-heatmap',
          workspaceId,
          metric,
          timezoneOffsetMinutes
        );
        setData(heatmapData);
      } catch (error) {
        console.error('Failed to load activity heatmap:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [workspaceId, metric]);

  if (loading) {
    return (
      <div className="activity-heatmap-loading agent-elements-ai-usage-loading flex min-h-[200px] items-center justify-center text-sm text-[var(--an-foreground-muted)]">
        Loading...
      </div>
    );
  }

  // Create a 2D grid: rows = days (0-6), columns = hours (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Find max activity for scaling
  const maxActivity = Math.max(...data.map((d) => d.activityCount), 1);

  // Create lookup map
  const activityMap = new Map<string, number>();
  data.forEach((d) => {
    const key = `${d.dayOfWeek}-${d.hourOfDay}`;
    activityMap.set(key, d.activityCount);
  });

  const getIntensity = (dayOfWeek: number, hour: number): number => {
    const key = `${dayOfWeek}-${hour}`;
    const count = activityMap.get(key) || 0;
    return count / maxActivity;
  };

  const currentMetricLabels = METRIC_LABELS[metric];

  return (
    <div
      className="activity-heatmap agent-elements-ai-usage-heatmap flex flex-col gap-3"
      data-agent-elements-shell="ai-usage-heatmap"
    >
      <div className="heatmap-header-section flex items-start justify-between gap-4">
        <div>
          <h3 className="m-0 text-base font-semibold text-[var(--an-foreground)]">
            {currentMetricLabels.title}
          </h3>
          <p className="heatmap-description mt-1 mb-0 text-xs text-[var(--an-foreground-muted)]">
            {currentMetricLabels.description}
          </p>
        </div>
        <div className="metric-toggle flex gap-1 rounded-[10px] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-1">
          {(['messages', 'edits', 'sessions'] as ActivityMetric[]).map((m) => (
            <button
              key={m}
              className={`metric-button rounded-[8px] border-0 px-3 py-1.5 text-xs font-medium text-[var(--an-foreground-muted)] cursor-pointer whitespace-nowrap transition-[background-color,color] duration-150 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2 ${metric === m ? 'active bg-[var(--an-background)] text-[var(--an-foreground)]' : ''}`}
              onClick={() => setMetric(m)}
            >
              {METRIC_LABELS[m].title.replace(/^(AI |Documents )/g, '')}
            </button>
          ))}
        </div>
      </div>

      <div className="heatmap-container overflow-x-auto">
        <div className="heatmap-grid inline-block min-w-[800px]">
          {/* Header row with hour labels */}
          <div className="heatmap-header grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 mb-0.5">
            <div className="day-label flex items-center justify-end pr-2 text-right text-[10px] font-semibold text-[var(--an-foreground)]"></div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="hour-label flex items-center justify-center text-center text-[9px] text-[var(--an-foreground-subtle)]"
              >
                {hour.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Data rows - one per day */}
          {days.map((day, dayIndex) => (
            <div key={dayIndex} className="heatmap-row grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 mb-0.5">
              <div className="day-label flex items-center justify-end pr-2 text-right text-[10px] font-semibold text-[var(--an-foreground)]">
                {day}
              </div>
              {hours.map((hour) => {
                const intensity = getIntensity(dayIndex, hour);
                const count = activityMap.get(`${dayIndex}-${hour}`) || 0;
                const tooltipText = (() => {
                  if (metric === 'messages') return `${count} message${count !== 1 ? 's' : ''} sent`;
                  if (metric === 'edits') return `${count} edit${count !== 1 ? 's' : ''} saved`;
                  return `${count} session${count !== 1 ? 's' : ''} started`;
                })();
                return (
                  <div
                    key={hour}
                    className="heatmap-cell agent-elements-ai-usage-heatmap-cell relative flex aspect-square max-h-[28px] min-h-[20px] items-center justify-center rounded-[6px] border border-[var(--an-border-color)] bg-[var(--an-background)] cursor-pointer transition-[background-color,border-color,box-shadow] duration-150 hover:z-10 hover:border-[var(--an-primary-color)] hover:shadow-[0_0_0_1px_var(--an-primary-color)]"
                    style={{
                      backgroundColor: getHeatmapBackground(intensity),
                    }}
                    data-tooltip={`${day} ${hour}:00 - ${tooltipText}`}
                    data-agent-elements-shell="ai-usage-heatmap-cell"
                  >
                    {count > 0 && (
                      <span className="cell-count text-[7px] font-semibold text-[var(--an-background)]">
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="heatmap-legend mt-2 flex items-center justify-center gap-1.5 text-[10px] text-[var(--an-foreground-muted)]">
          <span>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((level) => (
            <span
              key={level}
              className="agent-elements-ai-usage-heatmap-legend-swatch h-2 w-4 rounded-[4px] border border-[var(--an-border-color)] bg-[var(--an-background)]"
              style={{ backgroundColor: getHeatmapBackground(level) }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
