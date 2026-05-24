import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { atom } from 'jotai';
import { useAtomValue } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { store } from '@nimbalyst/runtime/store';
import { defaultAgentModelAtom } from '../../store/atoms/appSettings';
import { sessionRegistryAtom } from '../../store';
import { sessionTokenUsageAtom } from '../../store/atoms/sessions';
import { getRelativeTimeString } from '../../utils/dateFormatting';
import { createMetaAgentSession } from '../../utils/metaAgentUtils';
import { SessionTranscript } from '../UnifiedAI/SessionTranscript';

interface MetaAgentModeProps {
  workspacePath: string;
  isActive?: boolean;
  /** If provided, use this session ID directly instead of finding/creating one */
  sessionId?: string;
  onOpenSessionInAgent?: (sessionId: string) => void;
}

interface SpawnedSessionSummary {
  sessionId: string;
  title: string;
  provider: string;
  model: string | null;
  status: string;
  lastActivity: number | null;
  originalPrompt: string | null;
  lastResponse: string | null;
  editedFiles: string[];
  pendingPrompt: {
    promptId: string;
    promptType: string;
  } | null;
  createdAt: number;
  updatedAt: number;
  worktreeId?: string | null;
}

interface TimelineWindow {
  sessionId: string;
  title: string;
  status: string;
  startedAt: number;
  endedAt: number;
  leftPct: number;
  widthPct: number;
  durationMs: number;
}

function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(durationMs: number): string {
  const minutes = Math.max(1, Math.round(durationMs / 60000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

function getStatusTone(status: string): 'running' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'running':
      return 'running';
    case 'waiting_for_input':
      return 'warning';
    case 'error':
    case 'interrupted':
      return 'error';
    default:
      return 'neutral';
  }
}

function formatTokensShort(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}k`;
  }
  return tokens.toString();
}

function getBarTone(status: string): string {
  switch (status) {
    case 'running':
      return 'bg-[var(--an-primary-color)] text-[var(--an-background)]';
    case 'waiting_for_input':
      return 'bg-[var(--nim-warning)] text-[var(--an-background)]';
    case 'error':
    case 'interrupted':
      return 'bg-[var(--nim-error)] text-[var(--an-background)]';
    default:
      return 'bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)]';
  }
}

/** Reads per-session token usage from Jotai without causing parent to subscribe */
function TimelineRowLabel({ window }: { window: TimelineWindow }) {
  const tokenUsage = useAtomValue(sessionTokenUsageAtom(window.sessionId));

  const totalTokens = tokenUsage?.totalTokens ?? 0;
  const ctxTokens = tokenUsage?.currentContext?.tokens ?? 0;
  const ctxWindow = tokenUsage?.currentContext?.contextWindow ?? 0;
  const hasCtx = ctxWindow > 0;
  const ctxPct = hasCtx ? Math.round((ctxTokens / ctxWindow) * 100) : 0;
  const statusTone = getStatusTone(window.status);

  return (
    <div className="agent-elements-meta-agent-timeline-label min-w-0 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)]">
      <div className="truncate text-sm font-medium text-[var(--an-foreground)]">{window.title}</div>
      <div className="mt-[var(--an-spacing-xs)] flex items-center gap-[var(--an-spacing-sm)] text-[11px] text-[var(--an-foreground-muted)]">
        <span className="agent-elements-status-pill" data-tone={statusTone}>
          {window.status}
        </span>
        <span>{formatDuration(window.durationMs)}</span>
      </div>
      <div className="mt-[var(--an-spacing-xs)] flex items-center gap-[var(--an-spacing-sm)] text-[11px] text-[var(--an-foreground-subtle)]">
        <span>
          {totalTokens > 0 ? `${formatTokensShort(totalTokens)} tokens` : '--'}
        </span>
        {hasCtx && (
          <>
            <span className="text-[var(--an-border-color)]">|</span>
            <span className="flex items-center gap-1.5">
              {formatTokensShort(ctxTokens)}/{formatTokensShort(ctxWindow)} ctx
              <span className="inline-flex h-1.5 w-10 overflow-hidden rounded-full bg-[var(--an-background-tertiary)]">
                <span
                  className={`h-full rounded-full ${ctxPct > 80 ? 'bg-[var(--nim-warning)]' : 'bg-[var(--an-primary-color)]'}`}
                  style={{ width: `${Math.min(ctxPct, 100)}%` }}
                />
              </span>
              <span>{ctxPct}%</span>
            </span>
          </>
        )}
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--an-foreground-subtle)]">
        {formatAbsoluteTime(window.startedAt)} - {formatAbsoluteTime(window.endedAt)}
      </div>
    </div>
  );
}

/** Reads aggregate token usage for timeline header summary */
function TimelineAggregateSummary({ sessionIds }: { sessionIds: string[] }) {
  // Create a derived atom that aggregates all session token usages reactively
  const aggregateAtom = useMemo(
    () =>
      atom((get) => {
        let totalTokens = 0;
        for (const id of sessionIds) {
          const usage = get(sessionTokenUsageAtom(id));
          if (usage) {
            totalTokens += usage.totalTokens ?? 0;
          }
        }
        return totalTokens;
      }),
    [sessionIds]
  );
  const totalTokens = useAtomValue(aggregateAtom);

  if (totalTokens === 0) return null;

  return (
    <span className="agent-elements-status-pill" data-tone="neutral">
      {formatTokensShort(totalTokens)} total tokens
    </span>
  );
}

export function MetaAgentMode({
  workspacePath,
  isActive = false,
  sessionId: externalSessionId,
  onOpenSessionInAgent,
}: MetaAgentModeProps) {
  const defaultModel = useAtomValue(defaultAgentModelAtom);
  const [metaSessionId, setMetaSessionId] = useState<string | null>(externalSessionId ?? null);
  const [loadingSession, setLoadingSession] = useState(!externalSessionId);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [childSessions, setChildSessions] = useState<SpawnedSessionSummary[]>([]);
  const [showTimeline, setShowTimeline] = useState(false);

  const createMetaSession = useCallback(
    async (): Promise<string | null> => {
      const result = await createMetaAgentSession(workspacePath, defaultModel);
      return result?.id ?? null;
    },
    [defaultModel, workspacePath]
  );

  const ensureMetaSession = useCallback(async () => {
    setLoadingSession(true);
    try {
      const existing = await window.electronAPI.invoke('sessions:list', workspacePath, { includeArchived: false });
      if (existing?.success && Array.isArray(existing.sessions)) {
        const metaSessions = existing.sessions
          .filter((session: any) => session.agentRole === 'meta-agent' && !session.isArchived)
          .sort((a: any, b: any) => b.updatedAt - a.updatedAt);

        if (metaSessions.length > 0) {
          setMetaSessionId(metaSessions[0].id);
          return;
        }
      }

      const createdSessionId = await createMetaSession();
      if (createdSessionId) {
        setMetaSessionId(createdSessionId);
      }
    } catch (error) {
      console.error('[MetaAgentMode] Failed to initialize meta-agent session:', error);
    } finally {
      setLoadingSession(false);
    }
  }, [createMetaSession, workspacePath]);

  const handleClearMetaSession = useCallback(async () => {
    if (!metaSessionId) {
      return;
    }

    setLoadingSession(true);
    setChildSessions([]);

    try {
      const previousSessionId = metaSessionId;
      const nextSessionId = await createMetaSession();
      if (!nextSessionId) {
        throw new Error('Failed to create replacement meta-agent session');
      }

      setMetaSessionId(nextSessionId);

      await window.electronAPI.invoke('sessions:update-metadata', previousSessionId, {
        isArchived: true,
      });
    } catch (error) {
      console.error('[MetaAgentMode] Failed to clear meta-agent session:', error);
    } finally {
      setLoadingSession(false);
    }
  }, [createMetaSession, metaSessionId]);

  const refreshSpawnedSessions = useCallback(async (sessionId: string) => {
    setLoadingChildren(true);
    try {
      const result = await window.electronAPI.invoke('meta-agent:list-spawned-sessions', sessionId, workspacePath);
      if (result?.success && Array.isArray(result.sessions)) {
        setChildSessions(result.sessions);
      }
    } catch (error) {
      console.error('[MetaAgentMode] Failed to refresh spawned sessions:', error);
    } finally {
      setLoadingChildren(false);
    }
  }, [workspacePath]);

  // When an external sessionId is provided, sync it; otherwise find/create one
  useEffect(() => {
    if (externalSessionId) {
      setMetaSessionId(externalSessionId);
      setLoadingSession(false);
      return;
    }
    void ensureMetaSession();
  }, [externalSessionId, ensureMetaSession]);

  useEffect(() => {
    if (!metaSessionId) {
      setChildSessions([]);
      return;
    }
    void refreshSpawnedSessions(metaSessionId);
  }, [metaSessionId, refreshSpawnedSessions]);

  useEffect(() => {
    if (!metaSessionId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void refreshSpawnedSessions(metaSessionId);
      }, 300);
    };

    const unsubscribe = store.sub(sessionRegistryAtom, debouncedRefresh);

    return () => {
      unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [metaSessionId, refreshSpawnedSessions]);

  const summary = useMemo(() => {
    const waitingCount = childSessions.filter((session) => session.status === 'waiting_for_input').length;
    const runningCount = childSessions.filter((session) => session.status === 'running').length;
    return {
      total: childSessions.length,
      waitingCount,
      runningCount,
    };
  }, [childSessions]);

  const activeChildSessionTeammates = useMemo(
    () =>
      childSessions
        .filter((session) => session.status === 'running')
        .map((session) => ({
          agentId: session.sessionId,
          status: 'running' as const,
        })),
    [childSessions]
  );

  const timeline = useMemo(() => {
    if (childSessions.length === 0) {
      return {
        windows: [] as TimelineWindow[],
        ticks: [] as Array<{ label: string; leftPct: number }>,
        peakConcurrency: 0,
        spanLabel: '',
      };
    }

    const now = Date.now();
    const rawWindows = childSessions
      .map((session) => {
        const startedAt = session.createdAt;
        const endedAt = Math.max(
          startedAt,
          session.lastActivity ?? 0,
          session.updatedAt ?? 0,
          session.status === 'running' ? now : 0
        );

        return {
          sessionId: session.sessionId,
          title: session.title,
          status: session.status,
          startedAt,
          endedAt,
          durationMs: endedAt - startedAt,
        };
      })
      .sort((a, b) => a.startedAt - b.startedAt);

    const minStart = Math.min(...rawWindows.map((window) => window.startedAt));
    const maxEnd = Math.max(...rawWindows.map((window) => window.endedAt));
    const totalSpan = Math.max(maxEnd - minStart, 60000);

    const windows = rawWindows.map((window) => {
      const leftPct = ((window.startedAt - minStart) / totalSpan) * 100;
      const widthPct = Math.max(((window.endedAt - window.startedAt) / totalSpan) * 100, 2);

      return {
        ...window,
        leftPct,
        widthPct,
      };
    });

    const concurrencyEvents = rawWindows.flatMap((window) => [
      { at: window.startedAt, delta: 1 },
      { at: window.endedAt, delta: -1 },
    ]);
    concurrencyEvents.sort((a, b) => {
      if (a.at !== b.at) return a.at - b.at;
      return b.delta - a.delta;
    });

    let currentConcurrency = 0;
    let peakConcurrency = 0;
    for (const event of concurrencyEvents) {
      currentConcurrency += event.delta;
      peakConcurrency = Math.max(peakConcurrency, currentConcurrency);
    }

    const tickCount = Math.min(6, Math.max(2, windows.length + 1));
    const ticks = Array.from({ length: tickCount }, (_, index) => {
      const ratio = tickCount === 1 ? 0 : index / (tickCount - 1);
      const timestamp = minStart + totalSpan * ratio;
      return {
        label: formatAbsoluteTime(timestamp),
        leftPct: ratio * 100,
      };
    });

    return {
      windows,
      ticks,
      peakConcurrency,
      spanLabel: `${formatAbsoluteTime(minStart)} - ${formatAbsoluteTime(maxEnd)}`,
    };
  }, [childSessions]);

  if (loadingSession) {
    return (
      <div
        className="meta-agent-mode agent-elements-meta-agent-mode flex flex-1 items-center justify-center bg-[var(--an-background)] text-sm text-[var(--an-foreground-muted)]"
        data-component="MetaAgentMode"
        data-agent-elements-shell="meta-agent-mode"
        data-active={isActive ? 'true' : 'false'}
        data-state="loading"
        data-testid="agent-elements-meta-agent-mode"
      >
        Loading meta-agent session...
      </div>
    );
  }

  if (!metaSessionId) {
    return (
      <div
        className="meta-agent-mode agent-elements-meta-agent-mode flex flex-1 items-center justify-center bg-[var(--an-background)] text-sm text-[var(--an-foreground-muted)]"
        data-component="MetaAgentMode"
        data-agent-elements-shell="meta-agent-mode"
        data-active={isActive ? 'true' : 'false'}
        data-state="empty"
        data-testid="agent-elements-meta-agent-mode"
      >
        Unable to initialize meta-agent mode.
      </div>
    );
  }

  return (
    <div
      className="meta-agent-mode agent-elements-meta-agent-mode relative flex min-h-0 flex-1 bg-[var(--an-background)] text-[var(--an-foreground)] [container-type:inline-size]"
      data-component="MetaAgentMode"
      data-agent-elements-shell="meta-agent-mode"
      data-active={isActive ? 'true' : 'false'}
      data-testid="agent-elements-meta-agent-mode"
    >
      <div
        className="agent-elements-meta-agent-transcript flex min-w-0 flex-1 flex-col overflow-hidden border-r border-[var(--an-border-color)]"
        data-agent-elements-shell="meta-agent-transcript"
      >
        <SessionTranscript
          sessionId={metaSessionId}
          workspacePath={workspacePath}
          mode="agent"
          hideSidebar={true}
          additionalTeammates={activeChildSessionTeammates}
          waitingForNoun="session"
        />
      </div>

      <aside
        className="agent-elements-meta-agent-dashboard flex min-h-0 w-[360px] min-w-[320px] max-w-[420px] flex-col bg-[var(--an-background-secondary)]"
        data-agent-elements-shell="meta-agent-dashboard"
        data-testid="agent-elements-meta-agent-dashboard"
      >
        <div className="agent-elements-meta-agent-dashboard-header border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-semibold leading-snug text-[var(--an-foreground)]">Delegated Sessions</h2>
              <p className="m-0 mt-[var(--an-spacing-xxs)] text-xs leading-snug text-[var(--an-foreground-muted)]">Child sessions created by this meta-agent.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="agent-elements-meta-agent-action inline-flex min-h-[28px] items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-md)] text-xs font-medium text-[var(--an-foreground-muted)] transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setShowTimeline(true)}
                disabled={childSessions.length === 0}
                data-testid="meta-agent-open-timeline"
              >
                Timeline
              </button>
              <button
                type="button"
                className="agent-elements-meta-agent-action inline-flex min-h-[28px] items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-md)] text-xs font-medium text-[var(--an-foreground-muted)] transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)]"
                onClick={() => void handleClearMetaSession()}
                data-testid="meta-agent-clear"
              >
                Clear
              </button>
              <button
                type="button"
                className="agent-elements-meta-agent-action inline-flex min-h-[28px] items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-md)] text-xs font-medium text-[var(--an-foreground-muted)] transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)]"
                onClick={() => void refreshSpawnedSessions(metaSessionId)}
                data-testid="meta-agent-refresh"
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="agent-elements-meta-agent-summary mt-[var(--an-spacing-lg)] flex flex-wrap gap-[var(--an-spacing-xs)] text-xs" data-testid="agent-elements-meta-agent-summary">
            <span className="agent-elements-status-pill" data-tone="neutral">
              {summary.total} total
            </span>
            <span className="agent-elements-status-pill" data-tone="running">
              {summary.runningCount} running
            </span>
            <span className="agent-elements-status-pill" data-tone="warning">
              {summary.waitingCount} waiting
            </span>
          </div>
        </div>

        <div className="agent-elements-meta-agent-session-list flex-1 space-y-[var(--an-spacing-md)] overflow-y-auto p-[var(--an-spacing-md)]">
          {loadingChildren && childSessions.length === 0 ? (
            <div className="agent-elements-meta-agent-loading px-[var(--an-spacing-sm)] py-[var(--an-spacing-xl)] text-sm text-[var(--an-foreground-muted)]">Loading child sessions...</div>
          ) : childSessions.length === 0 ? (
            <div
              className="agent-elements-meta-agent-empty-state rounded-[var(--an-tool-border-radius)] border border-dashed border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-xxl)] text-sm leading-relaxed text-[var(--an-foreground-muted)]"
              data-agent-elements-shell="meta-agent-empty-state"
              data-testid="meta-agent-empty-state"
            >
              No delegated sessions yet. The meta-agent will populate this dashboard as it spawns child sessions.
            </div>
          ) : (
            childSessions.map((session) => (
              <section
                key={session.sessionId}
                className="agent-elements-meta-agent-child-card agent-elements-tool-card"
                data-agent-elements-shell="meta-agent-child-card"
                data-testid="meta-agent-child-card"
                data-session-id={session.sessionId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--an-foreground)]">{session.title}</div>
                    <div className="mt-[var(--an-spacing-xs)] flex items-center gap-[var(--an-spacing-sm)] text-[11px] text-[var(--an-foreground-subtle)]">
                      <span>{session.provider}</span>
                      {session.model && <span>{session.model}</span>}
                    </div>
                  </div>
                  <span
                    className="agent-elements-status-pill shrink-0"
                    data-tone={getStatusTone(session.status)}
                    data-testid="agent-elements-meta-agent-status-pill"
                  >
                    {session.status}
                  </span>
                </div>

                <div className="agent-elements-tool-primary mt-[var(--an-spacing-sm)] space-y-[var(--an-spacing-sm)] text-xs text-[var(--an-foreground-muted)]">
                  <div className="flex items-center gap-1">
                    <MaterialSymbol icon="schedule" size={14} />
                    <span>Last activity {session.lastActivity ? getRelativeTimeString(session.lastActivity) : 'No activity yet'}</span>
                  </div>
                  {session.originalPrompt && (
                    <p className="line-clamp-2">
                      <span className="text-[var(--an-foreground-subtle)]">Task:</span> {session.originalPrompt}
                    </p>
                  )}
                  {session.lastResponse && (
                    <p className="line-clamp-3">
                      <span className="text-[var(--an-foreground-subtle)]">Result:</span> {session.lastResponse}
                    </p>
                  )}
                  {session.pendingPrompt && (
                    <div
                      className="agent-elements-meta-agent-pending-prompt rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-sm)] text-[var(--nim-warning)]"
                      data-testid="agent-elements-meta-agent-pending-prompt"
                    >
                      Waiting for {session.pendingPrompt.promptType}
                    </div>
                  )}
                  {session.editedFiles.length > 0 && (
                    <p className="line-clamp-2">
                      <span className="text-[var(--an-foreground-subtle)]">Edited:</span> {session.editedFiles.join(', ')}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="agent-elements-meta-agent-action inline-flex min-h-[28px] items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-md)] text-xs font-medium text-[var(--an-foreground-muted)] transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)]"
                    onClick={() => onOpenSessionInAgent?.(session.sessionId)}
                    data-testid="meta-agent-open-session"
                  >
                    Open In Agent
                  </button>
                </div>
              </section>
            ))
          )}
        </div>
      </aside>

      {showTimeline && (
        <div className="absolute inset-4 z-20" data-testid="meta-agent-gantt-view">
          <div
            className="agent-elements-meta-agent-timeline flex h-full flex-col rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] shadow-lg"
            data-agent-elements-shell="meta-agent-timeline"
            data-testid="agent-elements-meta-agent-timeline"
          >
          <div className="flex items-center justify-between gap-4 border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]">
            <div className="flex items-center gap-[var(--an-spacing-md)] text-xs">
              <h3 className="m-0 text-sm font-semibold text-[var(--an-foreground)]">Timeline</h3>
              <span className="text-[var(--an-foreground-muted)]">
                {timeline.windows.length} sessions
              </span>
              <span className="text-[var(--an-primary-color)]" data-testid="meta-agent-gantt-peak">
                Peak {timeline.peakConcurrency}x
              </span>
              {timeline.spanLabel && (
                <span className="text-[var(--an-foreground-subtle)]">
                  {timeline.spanLabel}
                </span>
              )}
              <TimelineAggregateSummary sessionIds={timeline.windows.map((w) => w.sessionId)} />
            </div>
            <button
              type="button"
              className="agent-elements-meta-agent-action inline-flex min-h-[28px] items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-md)] text-xs font-medium text-[var(--an-foreground-muted)] transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)]"
              onClick={() => setShowTimeline(false)}
              data-testid="meta-agent-close-timeline"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-auto px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]">
            {timeline.windows.length === 0 ? (
              <div className="rounded-[var(--an-tool-border-radius)] border border-dashed border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-6 text-sm text-[var(--an-foreground-muted)]">
                No delegated sessions yet.
              </div>
            ) : (
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[220px_minmax(420px,1fr)] items-end gap-3 pb-2">
                  <div className="text-[11px] font-medium uppercase text-[var(--an-foreground-subtle)]">
                    Session
                  </div>
                  <div className="relative h-5">
                    {timeline.ticks.map((tick) => (
                      <div
                        key={tick.label}
                        className="absolute bottom-0"
                        style={{ left: `${tick.leftPct}%` }}
                      >
                        <div className="h-2 w-px bg-[var(--an-border-color)] opacity-60" />
                        <span className="absolute bottom-2.5 -translate-x-1/2 whitespace-nowrap text-[10px] text-[var(--an-foreground-subtle)]">
                          {tick.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  {timeline.windows.map((window) => (
                    <div
                      key={window.sessionId}
                      className="agent-elements-meta-agent-timeline-row grid grid-cols-[220px_minmax(420px,1fr)] gap-3 rounded-[var(--an-tool-border-radius)] px-1 py-1.5"
                      data-testid="meta-agent-gantt-row"
                    >
                      <TimelineRowLabel window={window} />

                      <div className="relative flex items-center min-h-[52px]">
                        {timeline.ticks.map((tick) => (
                          <div
                             key={`${window.sessionId}-${tick.label}`}
                             className="absolute top-0 h-2"
                             style={{ left: `${tick.leftPct}%` }}
                           >
                            <div className="h-full w-px bg-[var(--an-border-color)] opacity-30" />
                          </div>
                        ))}
                        <div
                          className={`agent-elements-meta-agent-timeline-bar absolute h-7 rounded-[var(--an-tool-border-radius)] px-[var(--an-spacing-sm)] shadow-sm ${getBarTone(window.status)}`}
                          style={{
                            left: `${window.leftPct}%`,
                            width: `${window.widthPct}%`,
                          }}
                          data-testid="meta-agent-gantt-bar"
                        >
                          <div className="truncate pt-1 text-[11px] font-medium">
                            {formatDuration(window.durationMs)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
