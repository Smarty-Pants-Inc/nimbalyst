import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'overview' | 'atomfamily';

interface AtomFamilyStat {
  name: string;
  count: number;
  file: string;
  params: string[];
}

interface WorkspaceWatcherInfo {
  workspacePath: string;
  subscriberCount: number;
  subscriberIds: string[];
}

interface SampleSummary {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  totalMs: number;
  blockedP50: number;
  blockedP95: number;
  blockedMax: number;
  blockedTotalMs: number;
}

interface SystemStats {
  fileWatchers: {
    type: string;
    activeWorkspaces: number;
    workspaces: WorkspaceWatcherInfo[];
    totalSubscribers: number;
  };
  process: {
    memoryRssMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    activeHandles: number;
    platform: string;
    nodeVersion: string;
    electronVersion: string;
  };
  ipc: {
    registeredHandlers: number;
  };
  database: {
    queryStats: Record<string, { reads: SampleSummary; writes: SampleSummary }>;
  };
  windows: Array<{
    id: number;
    mode: string;
    workspacePath: string | null;
    filePath: string | null;
    documentEdited: boolean;
  }>;
}

interface TimeSeriesPoint {
  time: string;
  timestamp: number;
  memoryRssMB: number;
  heapUsedMB: number;
  rendererHeapMB: number;
  activeHandles: number;
  ipcHandlers: number;
  activeWorkspaces: number;
  totalSubscribers: number;
  atomFamilies: number;
  atomInstances: number;
  dbReads: number;
  dbWrites: number;
}

const REFRESH_INTERVAL_MS = 15_000;
const MAX_HISTORY_POINTS = 120; // 30 minutes of data at 15s intervals

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchAtomFamilyStats(): Promise<AtomFamilyStat[]> {
  try {
    return await window.electronAPI.invoke('dev:get-atomfamily-stats');
  } catch {
    return [];
  }
}

async function fetchSystemStats(): Promise<SystemStats | null> {
  try {
    return await window.electronAPI.invoke('dev:get-system-stats');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Chart theme
// ---------------------------------------------------------------------------

const CHART_COLORS = {
  rss: 'var(--an-primary-color)',
  heap: 'var(--an-success-color)',
  rendererHeap: 'var(--an-primary-color)',
  handles: 'var(--an-warning-color)',
  ipcHandlers: 'var(--an-primary-color)',
  workspaces: 'color-mix(in srgb, var(--an-primary-color) 86%, var(--an-background))',
  subscribers: 'var(--an-diff-removed-text)',
  families: 'var(--an-primary-color)',
  instances: 'var(--an-warning-color)',
  dbReads: 'var(--an-success-color)',
  dbWrites: 'var(--an-warning-color)',
};

const compactCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-sm)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';
const chartCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';

// ---------------------------------------------------------------------------
// Overview Panel
// ---------------------------------------------------------------------------

function OverviewPanel({
  systemStats,
  atomStats,
  history,
}: {
  systemStats: SystemStats | null;
  atomStats: AtomFamilyStat[];
  history: TimeSeriesPoint[];
}) {
  if (!systemStats) {
    return (
      <div className="agent-elements-developer-dashboard-loading flex h-full items-center justify-center text-[var(--an-foreground-muted)]">
        Loading...
      </div>
    );
  }

  const { fileWatchers, process: proc, ipc, database: db } = systemStats;
  const totalInstances = atomStats.reduce((sum, s) => sum + s.count, 0);
  const nonEmptyFamilies = atomStats.filter(s => s.count > 0).length;

  // Renderer heap (available in Chromium)
  const perfMemory = (performance as any).memory;
  const rendererHeapMB = perfMemory ? Math.round(perfMemory.usedJSHeapSize / 1024 / 1024) : null;
  const rendererHeapTotalMB = perfMemory ? Math.round(perfMemory.jsHeapSizeLimit / 1024 / 1024) : null;

  // Database totals
  const dbEntries = Object.entries(db.queryStats);
  const totalDbReads = dbEntries.reduce((sum, [, s]) => sum + s.reads.count, 0);
  const totalDbWrites = dbEntries.reduce((sum, [, s]) => sum + s.writes.count, 0);

  return (
    <div
      className="developer-dashboard-overview agent-elements-developer-dashboard-section flex h-full flex-col gap-4 overflow-auto p-4"
      data-testid="agent-elements-developer-dashboard-section"
      data-agent-elements-shell="developer-dashboard-section"
    >
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Main Memory (RSS)" value={`${proc.memoryRssMB} MB`} />
        <StatCard label="Main Heap" value={`${proc.heapUsedMB} / ${proc.heapTotalMB} MB`} />
        <StatCard label="Renderer Heap" value={rendererHeapMB != null ? `${rendererHeapMB} / ${rendererHeapTotalMB} MB` : 'N/A'} />
        <StatCard label="Active Handles" value={String(proc.activeHandles)} />
        <StatCard label="IPC Handlers" value={String(ipc.registeredHandlers)} />
        <StatCard label="Watcher Type" value={fileWatchers.type.replace('WorkspaceEventBus ', '').replace(/[()]/g, '')} />
        <StatCard label="Watched Workspaces" value={String(fileWatchers.activeWorkspaces)} />
        <StatCard label="Watcher Subscribers" value={String(fileWatchers.totalSubscribers)} />
        <StatCard label="Atom Families" value={`${nonEmptyFamilies} active / ${atomStats.length} total`} />
        <StatCard label="Atom Instances" value={String(totalInstances)} />
        <StatCard label="DB Queries (5m)" value={`${totalDbReads} R / ${totalDbWrites} W`} />
        <StatCard label="DB Tables Active" value={String(dbEntries.length)} />
      </div>

      {/* Charts */}
      {history.length > 1 && (
        <>
          <ChartSection title="Memory">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--an-border-color)" />
                <XAxis dataKey="time" stroke="var(--an-foreground-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--an-foreground-muted)" tick={{ fontSize: 11 }} unit=" MB" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--an-tool-background)',
                    border: '1px solid var(--an-border-color)',
                    borderRadius: 8,
                    color: 'var(--an-foreground)',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="memoryRssMB" name="Main RSS" stroke={CHART_COLORS.rss} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="heapUsedMB" name="Main Heap" stroke={CHART_COLORS.heap} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="rendererHeapMB" name="Renderer Heap" stroke={CHART_COLORS.rendererHeap} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartSection>

          <ChartSection title="Handles and Watchers">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--an-border-color)" />
                <XAxis dataKey="time" stroke="var(--an-foreground-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--an-foreground-muted)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--an-tool-background)',
                    border: '1px solid var(--an-border-color)',
                    borderRadius: 8,
                    color: 'var(--an-foreground)',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="activeHandles" name="Active Handles" stroke={CHART_COLORS.handles} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="ipcHandlers" name="IPC Handlers" stroke={CHART_COLORS.ipcHandlers} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="activeWorkspaces" name="Workspaces" stroke={CHART_COLORS.workspaces} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="totalSubscribers" name="Subscribers" stroke={CHART_COLORS.subscribers} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartSection>

          <ChartSection title="Jotai Atom Families">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--an-border-color)" />
                <XAxis dataKey="time" stroke="var(--an-foreground-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--an-foreground-muted)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--an-tool-background)',
                    border: '1px solid var(--an-border-color)',
                    borderRadius: 8,
                    color: 'var(--an-foreground)',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="atomFamilies" name="Active Families" stroke={CHART_COLORS.families} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="atomInstances" name="Live Instances" stroke={CHART_COLORS.instances} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartSection>

          <ChartSection title="Database Queries (rolling count per sample)">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--an-border-color)" />
                <XAxis dataKey="time" stroke="var(--an-foreground-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--an-foreground-muted)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--an-tool-background)',
                    border: '1px solid var(--an-border-color)',
                    borderRadius: 8,
                    color: 'var(--an-foreground)',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="dbReads" name="Reads (5m)" stroke={CHART_COLORS.dbReads} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="dbWrites" name="Writes (5m)" stroke={CHART_COLORS.dbWrites} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartSection>
        </>
      )}

      {/* Database query performance table */}
      {dbEntries.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--an-foreground)] mb-2">Database Query Performance (5m window)</h3>
          <div className="overflow-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-left text-[var(--an-foreground-muted)] border-b border-[var(--an-border-color)]">
                  <th className="px-2 py-1.5">Table</th>
                  <th className="px-2 py-1.5 text-right">Op</th>
                  <th className="px-2 py-1.5 text-right">Count</th>
                  <th className="px-2 py-1.5 text-right">p50</th>
                  <th className="px-2 py-1.5 text-right">p95</th>
                  <th className="px-2 py-1.5 text-right">p99</th>
                  <th className="px-2 py-1.5 text-right">Max</th>
                  <th className="px-2 py-1.5 text-right">Blocked p95</th>
                </tr>
              </thead>
              <tbody>
                {dbEntries.sort(([a], [b]) => a.localeCompare(b)).flatMap(([table, stats]) => {
                  const rows: React.ReactElement[] = [];
                  if (stats.reads.count > 0) {
                    rows.push(
                      <tr
                        key={`${table}-r`}
                        className="agent-elements-developer-dashboard-table-row border-b border-[var(--an-border-color)] transition-colors hover:bg-[var(--an-background-tertiary)]"
                        data-agent-elements-shell="developer-dashboard-table-row"
                      >
                        <td className="px-2 py-1 text-[var(--an-foreground)]">{table}</td>
                        <td className="px-2 py-1 text-right text-[var(--an-foreground-muted)]">R</td>
                        <td className="px-2 py-1 text-right">{stats.reads.count}</td>
                        <td className="px-2 py-1 text-right">{stats.reads.p50}ms</td>
                        <td className="px-2 py-1 text-right">{stats.reads.p95}ms</td>
                        <td className="px-2 py-1 text-right">{stats.reads.p99}ms</td>
                        <td className="px-2 py-1 text-right">
                          <span className={stats.reads.max > 100 ? 'text-[var(--an-diff-removed-text)]' : ''}>{stats.reads.max}ms</span>
                        </td>
                        <td className="px-2 py-1 text-right">
                          {stats.reads.blockedP95 > 0 ? <span className="text-[var(--an-warning-color)]">{stats.reads.blockedP95}ms</span> : '-'}
                        </td>
                      </tr>
                    );
                  }
                  if (stats.writes.count > 0) {
                    rows.push(
                      <tr
                        key={`${table}-w`}
                        className="agent-elements-developer-dashboard-table-row border-b border-[var(--an-border-color)] transition-colors hover:bg-[var(--an-background-tertiary)]"
                        data-agent-elements-shell="developer-dashboard-table-row"
                      >
                        <td className="px-2 py-1 text-[var(--an-foreground)]">{table}</td>
                        <td className="px-2 py-1 text-right text-[var(--an-foreground-muted)]">W</td>
                        <td className="px-2 py-1 text-right">{stats.writes.count}</td>
                        <td className="px-2 py-1 text-right">{stats.writes.p50}ms</td>
                        <td className="px-2 py-1 text-right">{stats.writes.p95}ms</td>
                        <td className="px-2 py-1 text-right">{stats.writes.p99}ms</td>
                        <td className="px-2 py-1 text-right">
                          <span className={stats.writes.max > 100 ? 'text-[var(--an-diff-removed-text)]' : ''}>{stats.writes.max}ms</span>
                        </td>
                        <td className="px-2 py-1 text-right">
                          {stats.writes.blockedP95 > 0 ? <span className="text-[var(--an-warning-color)]">{stats.writes.blockedP95}ms</span> : '-'}
                        </td>
                      </tr>
                    );
                  }
                  return rows;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* File watcher detail */}
      {fileWatchers.workspaces.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--an-foreground)] mb-2">Watched Workspaces</h3>
          <div className="space-y-1">
            {fileWatchers.workspaces.map(ws => (
              <div
                key={ws.workspacePath}
                className="agent-elements-developer-dashboard-detail rounded-[8px] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-3 py-2 text-xs font-mono"
              >
                <div className="text-[var(--an-foreground)]">{ws.workspacePath}</div>
                <div className="text-[var(--an-foreground-muted)] mt-0.5">
                  Subscribers ({ws.subscriberCount}): {ws.subscriberIds.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Window state detail */}
      {systemStats.windows.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--an-foreground)] mb-2">Windows</h3>
          <div className="space-y-1">
            {systemStats.windows.map(win => (
              <div
                key={win.id}
                className="agent-elements-developer-dashboard-detail flex items-center gap-3 rounded-[8px] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-3 py-2 text-xs font-mono"
              >
                <span className="text-[var(--an-foreground-muted)]">#{win.id}</span>
                <span className="text-[var(--an-foreground)]">{win.mode}</span>
                <span className="text-[var(--an-foreground-muted)] truncate flex-1">
                  {win.workspacePath || win.filePath || '(none)'}
                </span>
                {win.documentEdited && (
                  <span className="text-[var(--an-warning-color)] text-[10px]">edited</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System info */}
      <div className="text-xs text-[var(--an-foreground-muted)] pb-2">
        {proc.platform} | Node {proc.nodeVersion} | Electron {proc.electronVersion}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={`agent-elements-developer-dashboard-stat-card agent-elements-tool-card gap-0 ${compactCardPaddingClass}`}
      data-agent-elements-card-padding="symmetric-inline"
      data-agent-elements-card-width="grid-cell"
      data-testid="agent-elements-developer-dashboard-stat-card"
      data-agent-elements-shell="developer-dashboard-stat-card"
    >
      <div className="mb-0.5 text-[11px] font-medium leading-4 text-[var(--an-foreground-muted)]">{label}</div>
      <div className="text-sm font-mono text-[var(--an-foreground)]">{value}</div>
    </div>
  );
}

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className={`agent-elements-developer-dashboard-chart agent-elements-tool-card gap-0 ${chartCardPaddingClass}`}
      data-agent-elements-card-padding="symmetric-inline"
      data-agent-elements-card-width="section-row"
      data-agent-elements-shell="developer-dashboard-chart"
    >
      <h3 className="text-sm font-medium text-[var(--an-foreground)] mb-2">{title}</h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AtomFamily Panel (preserved from original)
// ---------------------------------------------------------------------------

function AtomFamilyPanel({ stats, loading, refresh }: { stats: AtomFamilyStat[]; loading: boolean; refresh: () => void }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filterEmpty, setFilterEmpty] = useState(true);

  const displayed = filterEmpty ? stats.filter(s => s.count > 0) : stats;
  const totalInstances = stats.reduce((sum, s) => sum + s.count, 0);
  const nonEmptyCount = stats.filter(s => s.count > 0).length;

  return (
    <div
      className="agent-elements-developer-dashboard-atom-panel flex h-full flex-col"
      data-agent-elements-shell="developer-dashboard-atom-panel"
    >
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--an-border-color)] text-sm">
        <span className="text-[var(--an-foreground-muted)]">
          {stats.length} families registered
        </span>
        <span className="text-[var(--an-foreground-muted)]">|</span>
        <span className="text-[var(--an-foreground)]">
          <strong>{totalInstances}</strong> live instances across <strong>{nonEmptyCount}</strong> families
        </span>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 cursor-pointer text-[var(--an-foreground-muted)]">
          <input
            type="checkbox"
            checked={filterEmpty}
            onChange={e => setFilterEmpty(e.target.checked)}
            className="accent-[var(--an-primary-color)]"
          />
          Hide empty
        </label>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-[8px] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-3 py-1 text-xs text-[var(--an-foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--an-primary-color)_12%,var(--an-background))] disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-[var(--an-tool-background)]">
            <tr className="text-left text-[var(--an-foreground-muted)] border-b border-[var(--an-border-color)]">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium w-20">File</th>
              <th className="px-4 py-2 font-medium w-24 text-right">Instances</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(s => {
              const key = `${s.name}-${s.file}`;
              const isExpanded = expandedRow === key;
              return (
                <React.Fragment key={key}>
                  <tr
                    className="agent-elements-developer-dashboard-table-row cursor-pointer border-b border-[var(--an-border-color)] transition-colors hover:bg-[var(--an-background-tertiary)]"
                    data-agent-elements-shell="developer-dashboard-table-row"
                    onClick={() => setExpandedRow(isExpanded ? null : key)}
                  >
                    <td className="px-4 py-2 font-mono text-[var(--an-foreground)]">
                      <span className="mr-1.5 text-[var(--an-foreground-muted)] text-xs">
                        {isExpanded ? '\u25BC' : '\u25B6'}
                      </span>
                      {s.name}
                    </td>
                    <td className="px-4 py-2 text-[var(--an-foreground-muted)]">{s.file}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      <CountBadge count={s.count} />
                    </td>
                  </tr>
                  {isExpanded && s.params.length > 0 && (
                    <tr className="bg-[var(--an-tool-background)]">
                      <td colSpan={3} className="px-8 py-2">
                        <div className="text-xs text-[var(--an-foreground-muted)] mb-1">
                          Live params ({s.params.length}):
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
                          {s.params.map((p, i) => (
                            <span
                              key={i}
                              className="rounded-[6px] bg-[var(--an-background-tertiary)] px-2 py-0.5 text-xs font-mono text-[var(--an-foreground)]"
                              title={p}
                            >
                              {p.length > 40 ? p.slice(0, 37) + '...' : p}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {displayed.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[var(--an-foreground-muted)]">
                  {filterEmpty ? 'No families with live instances' : 'No families registered'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  const color = count === 0
    ? 'text-[var(--an-foreground-muted)]'
    : count > 50
      ? 'text-[var(--an-diff-removed-text)] font-bold'
      : 'text-[var(--an-foreground)]';
  return <span className={color}>{count}</span>;
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'atomfamily', label: 'Atom Families' },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function DeveloperDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [atomStats, setAtomStats] = useState<AtomFamilyStat[]>([]);
  const [history, setHistory] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [sys, atoms] = await Promise.all([fetchSystemStats(), fetchAtomFamilyStats()]);
      const now = new Date();
      setSystemStats(sys);
      setAtomStats(atoms);
      setLastRefresh(now);

      if (sys) {
        const nonEmptyFamilies = atoms.filter(s => s.count > 0).length;
        const totalInstances = atoms.reduce((sum, s) => sum + s.count, 0);
        const perfMem = (performance as any).memory;
        const dbEntries = Object.values(sys.database.queryStats);
        const dbReadCount = dbEntries.reduce((sum, s) => sum + s.reads.count, 0);
        const dbWriteCount = dbEntries.reduce((sum, s) => sum + s.writes.count, 0);

        const point: TimeSeriesPoint = {
          time: formatTime(now),
          timestamp: now.getTime(),
          memoryRssMB: sys.process.memoryRssMB,
          heapUsedMB: sys.process.heapUsedMB,
          rendererHeapMB: perfMem ? Math.round(perfMem.usedJSHeapSize / 1024 / 1024) : 0,
          activeHandles: sys.process.activeHandles,
          ipcHandlers: sys.ipc.registeredHandlers,
          activeWorkspaces: sys.fileWatchers.activeWorkspaces,
          totalSubscribers: sys.fileWatchers.totalSubscribers,
          atomFamilies: nonEmptyFamilies,
          atomInstances: totalInstances,
          dbReads: dbReadCount,
          dbWrites: dbWriteCount,
        };

        setHistory(prev => {
          const next = [...prev, point];
          return next.length > MAX_HISTORY_POINTS ? next.slice(-MAX_HISTORY_POINTS) : next;
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  return (
    <div
      className="developer-dashboard agent-elements-developer-dashboard flex h-screen flex-col bg-[var(--an-background)] text-[var(--an-foreground)] select-text"
      data-testid="agent-elements-developer-dashboard"
      data-agent-elements-shell="developer-dashboard"
    >
      {/* Title bar drag region (macOS) */}
      <div className="h-8 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Tab bar */}
      <div
        className="developer-dashboard-tabs agent-elements-developer-dashboard-tabs flex items-center gap-1 border-b border-[var(--an-border-color)] px-4"
        data-testid="agent-elements-developer-dashboard-tabs"
        data-agent-elements-shell="developer-dashboard-tabs"
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`agent-elements-developer-dashboard-tab border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2 ${
              activeTab === tab.id
                ? 'border-[var(--an-primary-color)] text-[var(--an-foreground)]'
                : 'border-transparent text-[var(--an-foreground-muted)] hover:text-[var(--an-foreground)]'
            }`}
            data-testid="agent-elements-developer-dashboard-tab"
            data-agent-elements-shell="developer-dashboard-tab"
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-[var(--an-foreground-muted)]">
          {loading && <span className="animate-pulse">Refreshing...</span>}
          {lastRefresh && !loading && (
            <span>Last: {formatTime(lastRefresh)}</span>
          )}
          <span className="opacity-50">Auto-refresh 15s</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && (
          <OverviewPanel systemStats={systemStats} atomStats={atomStats} history={history} />
        )}
        {activeTab === 'atomfamily' && (
          <AtomFamilyPanel stats={atomStats} loading={loading} refresh={refresh} />
        )}
      </div>
    </div>
  );
}
