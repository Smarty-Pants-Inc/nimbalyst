import React, { useState, useEffect } from 'react';

interface TableStat {
  name: string;
  rowCount: number;
  size: string;
  sizeBytes: number;
}

interface BackupInfo {
  timestamp: string;
  size: number;
  verified: boolean;
}

interface BackupStatus {
  currentBackup: BackupInfo | null;
  previousBackup: BackupInfo | null;
  oldestBackup: BackupInfo | null;
  lastBackupAttempt: string | null;
  lastSuccessfulBackup: string | null;
}

interface WalStats {
  fileCount: number;
  totalBytes: number;
  totalSize: string;
  minWalSize: string;
  maxWalSize: string;
  checkpointTimeout: string;
}

interface DashboardStats {
  tableStats: TableStat[];
  totalSize: string;
  totalSizeBytes: number;
  basicStats: {
    ai_sessions_count: string;
    history_count: string;
    database_size: string;
  };
  backupStatus: BackupStatus | null;
  walStats: WalStats | null;
}

interface Props {
  onTableSelect: (tableName: string) => void;
}

const dashboardShellClass =
  'agent-elements-database-dashboard flex-1 overflow-auto bg-[var(--an-background)] p-6 text-[var(--an-foreground)]';
const dashboardInnerClass =
  'mx-auto flex max-w-4xl flex-col gap-5';
const dashboardCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)]';
const dashboardZeroCardPaddingClass =
  '[--agent-elements-card-block-padding:0px] [--agent-elements-card-inline-padding:0px]';
const dashboardPanelClass =
  `agent-elements-tool-card gap-0 ${dashboardCardPaddingClass}`;
const dashboardTablePanelClass =
  `agent-elements-tool-card gap-0 ${dashboardZeroCardPaddingClass}`;
const dashboardStatCardClass =
  `agent-elements-database-stat-card ${dashboardPanelClass}`;
const dashboardSectionHeaderClass =
  'border-b border-[var(--an-border-color)] px-4 py-3';
const dashboardMetricLabelClass =
  'mb-1 text-sm text-[var(--an-foreground-muted)]';
const dashboardProgressTrackClass =
  'h-1.5 overflow-hidden rounded-full bg-[var(--an-background-tertiary)]';
const dashboardProgressFillClass =
  'h-full rounded-full transition-[width] duration-200 ease-out';
const dashboardButtonClass =
  'rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-3 py-1 text-sm text-[var(--an-foreground)] transition-colors duration-150 hover:bg-[var(--an-background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--an-background)]';
const dashboardRowClass =
  'flex items-center justify-between gap-3 text-sm';

function DashboardStatCard({
  label,
  value,
  valueClassName = 'text-2xl',
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div
      className={dashboardStatCardClass}
      data-agent-elements-card-padding="symmetric-inline"
      data-agent-elements-card-width="grid-cell"
      data-testid="agent-elements-database-stat-card"
    >
      <div className={dashboardMetricLabelClass}>{label}</div>
      <div className={`${valueClassName} font-semibold`}>{value}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Parse a Postgres-style size string ("80MB", "1GB", "5kB") into bytes.
// Used to render the WAL progress bar against min/max bounds.
function parsePostgresSize(s: string | undefined): number {
  if (!s) return 0;
  const match = s.trim().match(/^(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB)?$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toLowerCase();
  const multipliers: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
  return value * (multipliers[unit] ?? 1);
}

function formatRelativeTime(timestamp: string): string {
  // Handle timestamps that were sanitized for file paths (dashes instead of colons)
  // e.g., "2024-01-15T10-30-45-123Z" -> "2024-01-15T10:30:45.123Z"
  let normalized = timestamp;
  const match = timestamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z?$/);
  if (match) {
    normalized = `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
  }

  const date = new Date(normalized);
  if (isNaN(date.getTime())) {
    return 'unknown';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export function DatabaseDashboard({ onTableSelect }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.electronAPI.invoke('database:getDashboardStats');

      if (result.success) {
        setStats(result);
      } else {
        setError(result.error || 'Failed to load dashboard stats');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`${dashboardShellClass} flex items-center justify-center text-[var(--an-foreground-muted)]`}
        data-agent-elements-shell="database-dashboard"
        data-testid="agent-elements-database-dashboard"
      >
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${dashboardShellClass} flex flex-col items-center justify-center gap-4`}
        data-agent-elements-shell="database-dashboard"
        data-testid="agent-elements-database-dashboard"
      >
        <div className="agent-elements-database-error text-sm text-[var(--an-diff-removed-text)]">{error}</div>
        <button
          onClick={loadStats}
          className={dashboardButtonClass}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const totalRows = stats.tableStats.reduce((sum, t) => sum + t.rowCount, 0);
  const backupCount = [stats.backupStatus?.currentBackup, stats.backupStatus?.previousBackup, stats.backupStatus?.oldestBackup].filter(Boolean).length;

  return (
    <div
      className={dashboardShellClass}
      data-agent-elements-shell="database-dashboard"
      data-testid="agent-elements-database-dashboard"
    >
      <div className={dashboardInnerClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Database Overview</h2>
          <button
            onClick={loadStats}
            className={dashboardButtonClass}
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <DashboardStatCard label="Total Size" value={stats.totalSize} />
          <DashboardStatCard label="Tables" value={stats.tableStats.length} />
          <DashboardStatCard label="Total Rows" value={totalRows.toLocaleString()} />
        </div>

        {stats.backupStatus && (
          <div
            className={`agent-elements-database-backup-status ${dashboardPanelClass}`}
            data-agent-elements-card-padding="symmetric-inline"
            data-agent-elements-card-width="section-row"
            data-agent-elements-shell="database-backup-status"
            data-testid="agent-elements-database-backup-status"
          >
            <h3 className="text-sm font-semibold mb-3">Backup Status</h3>
            <div className="space-y-2">
              <div className={dashboardRowClass}>
                <span className="text-[var(--an-foreground-muted)]">Available Backups</span>
                <span>{backupCount} of 3</span>
              </div>
              {stats.backupStatus.lastSuccessfulBackup && (
                <div className={dashboardRowClass}>
                  <span className="text-[var(--an-foreground-muted)]">Last Successful Backup</span>
                  <span>{formatRelativeTime(stats.backupStatus.lastSuccessfulBackup)}</span>
                </div>
              )}
              {stats.backupStatus.currentBackup && (
                <div className={dashboardRowClass}>
                  <span className="text-[var(--an-foreground-muted)]">Current Backup Size</span>
                  <span>{formatBytes(stats.backupStatus.currentBackup.size)}</span>
                </div>
              )}
              {backupCount === 0 && (
                <div className="text-sm text-[var(--an-foreground-subtle)]">
                  No backups have been created yet. Backups are created automatically every 4 hours.
                </div>
              )}
            </div>
          </div>
        )}

        {stats.walStats && (() => {
          const minBytes = parsePostgresSize(stats.walStats.minWalSize);
          const maxBytes = parsePostgresSize(stats.walStats.maxWalSize);
          const cur = stats.walStats.totalBytes;
          // Bar shows position between min and max. min is the floor that Postgres
          // always retains; growth beyond max triggers an inline checkpoint.
          const range = Math.max(maxBytes - minBytes, 1);
          const pct = Math.min(100, Math.max(0, ((cur - minBytes) / range) * 100));
          const overFloor = cur > minBytes * 1.05;
          return (
            <div
              className={`database-dashboard-wal agent-elements-database-wal-status ${dashboardPanelClass}`}
              data-agent-elements-card-padding="symmetric-inline"
              data-agent-elements-card-width="section-row"
              data-agent-elements-shell="database-wal-status"
              data-testid="agent-elements-database-wal-status"
            >
              <h3 className="text-sm font-semibold mb-3">Write-Ahead Log</h3>
              <div className="space-y-2 text-sm">
                <div className={dashboardRowClass}>
                  <span className="text-[var(--an-foreground-muted)]">Current size</span>
                  <span data-testid="wal-current-size">
                    {stats.walStats.totalSize} ({stats.walStats.fileCount} {stats.walStats.fileCount === 1 ? 'segment' : 'segments'})
                  </span>
                </div>
                <div className={dashboardProgressTrackClass}>
                  <div
                    className={`${dashboardProgressFillClass} ${overFloor ? 'bg-[var(--an-warning-color)]' : 'bg-[var(--an-primary-color)]'}`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--an-foreground-subtle)]">
                  <span>min {stats.walStats.minWalSize}</span>
                  <span>max {stats.walStats.maxWalSize}</span>
                </div>
                <div className={`${dashboardRowClass} pt-2`}>
                  <span className="text-[var(--an-foreground-muted)]">Checkpoint timeout</span>
                  <span>{stats.walStats.checkpointTimeout}</span>
                </div>
                <div className="pt-1 text-xs text-[var(--an-foreground-subtle)]">
                  PGLite has no background checkpointer; WAL is trimmed by explicit CHECKPOINT after init, before close, and when size exceeds 200 MB.
                </div>
              </div>
            </div>
          );
        })()}

        <div
          className={`agent-elements-database-table-list ${dashboardTablePanelClass} overflow-hidden`}
          data-agent-elements-card-padding="sectioned-symmetric"
          data-agent-elements-card-width="section-row"
          data-agent-elements-shell="database-table-list"
          data-testid="agent-elements-database-table-list"
        >
          <div className={dashboardSectionHeaderClass}>
            <h3 className="text-sm font-semibold">Tables by Size</h3>
          </div>
          <div className="divide-y divide-[var(--an-border-color)]">
            {stats.tableStats.length === 0 ? (
              <div className="p-4 text-sm text-[var(--an-foreground-muted)]">No tables found</div>
            ) : (
              stats.tableStats.map((table) => {
                const percentage = stats.totalSizeBytes > 0
                  ? (table.sizeBytes / stats.totalSizeBytes) * 100
                  : 0;

                return (
                  <div
                    key={table.name}
                    className="agent-elements-database-table-row cursor-pointer p-3 transition-colors duration-150 hover:bg-[var(--an-background-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--an-background)]"
                    data-agent-elements-shell="database-table-row"
                    data-testid="agent-elements-database-table-row"
                    onClick={() => onTableSelect(table.name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onTableSelect(table.name);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{table.name}</span>
                      <div className="flex items-center gap-4 text-sm text-[var(--an-foreground-muted)]">
                        <span>{table.rowCount.toLocaleString()} rows</span>
                        <span className="w-20 text-right">{table.size}</span>
                      </div>
                    </div>
                    <div className={dashboardProgressTrackClass}>
                      <div
                        className={`${dashboardProgressFillClass} bg-[var(--an-primary-color)]`}
                        style={{ width: `${Math.max(percentage, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <DashboardStatCard
            label="AI Sessions"
            value={parseInt(stats.basicStats?.ai_sessions_count || '0').toLocaleString()}
            valueClassName="text-xl"
          />
          <DashboardStatCard
            label="Document History Entries"
            value={parseInt(stats.basicStats?.history_count || '0').toLocaleString()}
            valueClassName="text-xl"
          />
        </div>
      </div>
    </div>
  );
}
