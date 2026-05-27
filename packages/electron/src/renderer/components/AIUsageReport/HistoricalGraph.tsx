import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HistoricalGraphProps {
  workspaceId?: string;
}

interface TimeSeriesDataPoint {
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessionCount: number;
}

export const HistoricalGraph: React.FC<HistoricalGraphProps> = ({ workspaceId }) => {
  const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const ranges = {
          week: 7 * 24 * 60 * 60 * 1000,
          month: 30 * 24 * 60 * 60 * 1000,
          quarter: 90 * 24 * 60 * 60 * 1000,
          year: 365 * 24 * 60 * 60 * 1000,
        };
        const startDate = now - ranges[timeRange];

        const timeSeries = await window.electronAPI.invoke(
          'usage-analytics:get-time-series',
          startDate,
          now,
          'day',
          workspaceId
        );
        setData(timeSeries);
      } catch (error) {
        console.error('Failed to load time series data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [timeRange, workspaceId]);

  if (loading) {
    return (
      <div className="historical-graph-loading agent-elements-ai-usage-loading flex min-h-[400px] items-center justify-center text-base text-[var(--an-foreground-muted)]">
        Loading...
      </div>
    );
  }

  const chartData = data.map((point) => ({
    // Use UTC date formatting since timestamps are truncated to UTC midnight
    date: new Date(point.timestamp).toLocaleDateString(undefined, { timeZone: 'UTC' }),
    'Input Tokens': point.inputTokens,
    'Output Tokens': point.outputTokens,
    Sessions: point.sessionCount,
  }));

  return (
    <div
      className="historical-graph agent-elements-ai-usage-chart flex flex-col gap-6"
      data-agent-elements-shell="ai-usage-chart"
    >
      <div className="historical-graph-controls flex items-center justify-between gap-4">
        <h3 className="m-0 text-base font-semibold leading-6 text-[var(--an-foreground)]">Token Usage Over Time</h3>
        <div className="time-range-selector flex gap-1 rounded-[10px] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] p-1">
          {(['week', 'month', 'quarter', 'year'] as const).map((range) => (
            <button
              key={range}
              className={`rounded-[8px] border px-3.5 py-1.5 text-[13px] leading-5 cursor-pointer transition-[background-color,border-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2 ${
                timeRange === range
                  ? 'border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)]'
                  : 'bg-[var(--an-tool-background)] border-[var(--an-tool-border-color)] text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]'
              }`}
              onClick={() => setTimeRange(range)}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--an-border-color)" />
            <XAxis dataKey="date" stroke="var(--an-foreground-muted)" />
            <YAxis stroke="var(--an-foreground-muted)" />
            <Tooltip
              contentStyle={{
                background: 'var(--an-tool-background)',
                border: '1px solid var(--an-tool-border-color)',
                borderRadius: '8px',
                color: 'var(--an-foreground)',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="Input Tokens" stroke="var(--an-primary-color)" strokeWidth={2} />
            <Line type="monotone" dataKey="Output Tokens" stroke="var(--an-success-color)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="no-data agent-elements-ai-usage-empty flex min-h-[400px] items-center justify-center text-base text-[var(--an-foreground-muted)]">No data available for this time range</div>
      )}
    </div>
  );
};
