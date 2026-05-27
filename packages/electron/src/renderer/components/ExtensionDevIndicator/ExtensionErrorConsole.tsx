import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';
type LogSource = 'renderer' | 'main' | 'build';

interface ExtensionLogEntry {
  timestamp: number;
  level: LogLevel;
  source: LogSource;
  extensionId?: string;
  message: string;
  stack?: string;
  line?: number;
  sourceFile?: string;
}

interface ExtensionErrorConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

const LOG_LEVEL_ICONS: Record<LogLevel, string> = {
  error: 'error',
  warn: 'warning',
  info: 'info',
  debug: 'bug_report',
};

interface InstalledExtension {
  id: string;
  name: string;
  enabled: boolean;
}

export const ExtensionErrorConsole: React.FC<ExtensionErrorConsoleProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<ExtensionLogEntry[]>([]);
  const [installedExtensions, setInstalledExtensions] = useState<InstalledExtension[]>([]);
  const [stats, setStats] = useState<{
    totalEntries: number;
    byLevel: Record<LogLevel, number>;
  } | null>(null);
  const [filter, setFilter] = useState<{
    logLevel: LogLevel | 'all';
    source: LogSource | 'all';
    extensionId: string;
  }>({
    logLevel: 'all',
    source: 'all',
    extensionId: '',
  });
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch installed extensions on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchExtensions = async () => {
      try {
        const extensions = await window.electronAPI.extensions.listInstalled();
        setInstalledExtensions(extensions || []);
      } catch (error) {
        console.error('[ExtensionErrorConsole] Failed to fetch extensions:', error);
      }
    };

    fetchExtensions();
  }, [isOpen]);

  const fetchLogs = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    try {
      const result = await window.electronAPI.extensionDevTools.getLogs({
        logLevel: filter.logLevel,
        source: filter.source,
        extensionId: filter.extensionId || undefined,
        lastSeconds: 300, // 5 minutes
      });
      setLogs(result.logs);
      setStats(result.stats);
    } catch (error) {
      console.error('[ExtensionErrorConsole] Failed to fetch logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, filter]);

  // Fetch logs on open and when filter changes
  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Auto-refresh every 2 seconds
  useEffect(() => {
    if (!isOpen || !autoRefresh) return;

    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, fetchLogs]);

  const handleClearLogs = async () => {
    try {
      await window.electronAPI.extensionDevTools.clearLogs(
        filter.extensionId || undefined
      );
      await fetchLogs();
    } catch (error) {
      console.error('[ExtensionErrorConsole] Failed to clear logs:', error);
    }
  };

  const toggleExpand = (index: number) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Combine installed extensions with any extension IDs found in logs
  // This ensures we show both installed extensions AND any dev extensions that have logs
  const allExtensionOptions = useMemo(() => {
    const extensionMap = new Map<string, { id: string; name: string }>();

    // Add installed extensions
    for (const ext of installedExtensions) {
      if (ext.id) {
        extensionMap.set(ext.id, { id: ext.id, name: ext.name || ext.id });
      }
    }

    // Add any extension IDs from logs that aren't already in the map
    for (const log of logs) {
      if (log.extensionId && !extensionMap.has(log.extensionId)) {
        extensionMap.set(log.extensionId, { id: log.extensionId, name: log.extensionId });
      }
    }

    return Array.from(extensionMap.values()).sort((a, b) =>
      (a.name || a.id).localeCompare(b.name || b.id)
    );
  }, [installedExtensions, logs]);

  if (!isOpen) return null;

  return (
    <div
      className="extension-error-console-overlay agent-elements-extension-error-console-overlay nim-overlay z-[1000]"
      onClick={onClose}
      data-testid="agent-elements-extension-error-console-overlay"
      data-agent-elements-shell="extension-error-console-overlay"
    >
      <div
        className="extension-error-console agent-elements-extension-error-console agent-elements-tool-card flex h-[70vh] max-h-[600px] w-[min(1000px,80vw)] flex-col rounded-[12px] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_16px_48px_color-mix(in_srgb,var(--an-foreground)_14%,transparent)] nim-animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        data-testid="agent-elements-extension-error-console"
        data-agent-elements-shell="extension-error-console"
      >
        <div
          className="extension-error-console-header agent-elements-extension-error-console-header flex items-center gap-4 rounded-t-[12px] border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-5 py-4"
          data-testid="agent-elements-extension-error-console-header"
          data-agent-elements-shell="extension-error-console-header"
        >
          <h2 className="m-0 text-base font-semibold text-[var(--an-foreground)]">
            Extension Logs
          </h2>
          <div className="extension-error-console-stats flex gap-3 ml-auto">
            {stats && (
              <>
                <span className="stat stat-error flex items-center gap-1 text-xs font-medium text-[var(--an-diff-removed-text)]">
                  <MaterialSymbol icon="error" size={14} />
                  {stats.byLevel.error}
                </span>
                <span className="stat stat-warn flex items-center gap-1 text-xs font-medium text-[var(--an-warning-color)]">
                  <MaterialSymbol icon="warning" size={14} />
                  {stats.byLevel.warn}
                </span>
                <span className="stat stat-info flex items-center gap-1 text-xs font-medium text-[var(--an-primary-color)]">
                  <MaterialSymbol icon="info" size={14} />
                  {stats.byLevel.info}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            className="extension-error-console-close agent-elements-extension-error-console-close flex h-8 w-8 items-center justify-center rounded-[8px] border-0 bg-transparent text-[var(--an-foreground-muted)] cursor-pointer transition-[background-color,color] duration-150 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2"
            onClick={onClose}
            aria-label="Close"
            data-agent-elements-shell="extension-error-console-close"
          >
            <MaterialSymbol icon="close" size={20} />
          </button>
        </div>

        <div
          className="extension-error-console-toolbar agent-elements-extension-error-console-toolbar flex items-center justify-between gap-3 border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-4 py-2"
          data-testid="agent-elements-extension-error-console-toolbar"
          data-agent-elements-shell="extension-error-console-toolbar"
        >
          <div className="extension-error-console-filters flex gap-2">
            <select
              className="agent-elements-extension-error-console-select rounded-[8px] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2 py-1.5 text-xs text-[var(--an-foreground)] cursor-pointer transition-colors duration-150 hover:border-[var(--an-primary-color)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2"
              value={filter.logLevel}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  logLevel: e.target.value as LogLevel | 'all',
                }))
              }
              aria-label="Filter by level"
            >
              <option value="all">All Levels</option>
              <option value="error">Errors</option>
              <option value="warn">Warnings</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>

            <select
              className="agent-elements-extension-error-console-select rounded-[8px] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2 py-1.5 text-xs text-[var(--an-foreground)] cursor-pointer transition-colors duration-150 hover:border-[var(--an-primary-color)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2"
              value={filter.source}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  source: e.target.value as LogSource | 'all',
                }))
              }
              aria-label="Filter by source"
            >
              <option value="all">All Sources</option>
              <option value="renderer">Renderer</option>
              <option value="main">Main</option>
              <option value="build">Build</option>
            </select>

            <select
              className="agent-elements-extension-error-console-select rounded-[8px] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2 py-1.5 text-xs text-[var(--an-foreground)] cursor-pointer transition-colors duration-150 hover:border-[var(--an-primary-color)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2"
              value={filter.extensionId}
              onChange={(e) =>
                setFilter((f) => ({ ...f, extensionId: e.target.value }))
              }
              aria-label="Filter by extension"
            >
              <option value="">All Extensions</option>
              {allExtensionOptions.map((ext) => (
                <option key={ext.id} value={ext.id}>
                  {ext.name}
                </option>
              ))}
            </select>
          </div>

          <div className="extension-error-console-actions flex items-center gap-2">
            <label className="auto-refresh-toggle flex items-center gap-1.5 text-xs cursor-pointer text-[var(--an-foreground-muted)]">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <button
              type="button"
              className="toolbar-button agent-elements-extension-error-console-action flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] cursor-pointer transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] disabled:cursor-not-allowed disabled:text-[var(--an-foreground-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2"
              onClick={fetchLogs}
              disabled={isLoading}
              title="Refresh"
              data-agent-elements-shell="extension-error-console-action"
            >
              <MaterialSymbol icon="refresh" size={18} />
            </button>
            <button
              type="button"
              className="toolbar-button agent-elements-extension-error-console-action flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] cursor-pointer transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2"
              onClick={handleClearLogs}
              title="Clear logs"
              data-agent-elements-shell="extension-error-console-action"
            >
              <MaterialSymbol icon="delete" size={18} />
            </button>
          </div>
        </div>

        <div
          className="extension-error-console-logs agent-elements-extension-error-console-logs flex-1 overflow-y-auto p-2 font-mono text-xs"
          data-testid="agent-elements-extension-error-console-logs"
          data-agent-elements-shell="extension-error-console-logs"
        >
          {logs.length === 0 ? (
            <div
              className="extension-error-console-empty agent-elements-extension-error-console-empty flex h-full flex-col items-center justify-center text-center text-[var(--an-foreground-subtle)]"
              data-agent-elements-shell="extension-error-console-empty"
            >
              <MaterialSymbol icon="check_circle" size={48} />
              <p className="mt-2 mb-0">No logs to display</p>
              <p className="hint text-xs max-w-[300px]">
                Extension logs will appear here when extensions emit console
                messages or errors.
              </p>
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                className={`log-entry agent-elements-extension-log-entry log-${log.level} mb-0.5 rounded-[8px] px-2 py-1.5 transition-colors duration-150 hover:bg-[var(--an-background-tertiary)] ${
                  expandedLogs.has(index) ? 'expanded bg-[var(--an-tool-background)]' : ''
                } ${log.stack ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => log.stack && toggleExpand(index)}
                data-testid="agent-elements-extension-log-entry"
                data-agent-elements-shell="extension-log-entry"
              >
                <div className="log-entry-header flex items-start gap-2">
                  <span
                    className={
                      log.level === 'error'
                        ? 'text-[var(--an-diff-removed-text)]'
                        : log.level === 'warn'
                          ? 'text-[var(--an-warning-color)]'
                          : log.level === 'info'
                            ? 'text-[var(--an-primary-color)]'
                            : 'text-[var(--an-foreground-subtle)]'
                    }
                  >
                    <MaterialSymbol
                      icon={LOG_LEVEL_ICONS[log.level]}
                      size={16}
                    />
                  </span>
                  <span className="log-time shrink-0 text-[var(--an-foreground-subtle)]">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className="log-source shrink-0 text-[var(--an-foreground-subtle)]">
                    [{log.source}]
                  </span>
                  {log.extensionId && (
                    <button
                      type="button"
                      className="log-extension agent-elements-extension-log-badge shrink-0 rounded-[6px] border-0 bg-[color-mix(in_srgb,var(--an-primary-color)_10%,transparent)] px-1 text-[var(--an-primary-color)] font-inherit cursor-pointer transition-[background-color,color] duration-150 hover:bg-[color-mix(in_srgb,var(--an-primary-color)_16%,transparent)] hover:text-[var(--an-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilter((f) => ({ ...f, extensionId: log.extensionId! }));
                      }}
                      title={`Filter by ${log.extensionId}`}
                      data-testid="agent-elements-extension-log-badge"
                      data-agent-elements-shell="extension-log-badge"
                    >
                      {log.extensionId}
                    </button>
                  )}
                  <span
                    className={`log-message flex-1 break-words ${
                      log.level === 'error'
                        ? 'text-[var(--an-diff-removed-text)]'
                        : log.level === 'warn'
                          ? 'text-[var(--an-warning-color)]'
                          : 'text-[var(--an-foreground)]'
                    }`}
                  >
                    {log.message}
                  </span>
                  {log.stack && (
                    <MaterialSymbol
                      icon={expandedLogs.has(index) ? 'expand_less' : 'expand_more'}
                      size={16}
                      className="log-expand-icon shrink-0 text-[var(--an-foreground-subtle)]"
                    />
                  )}
                </div>
                {expandedLogs.has(index) && log.stack && (
                  <pre className="log-stack agent-elements-extension-log-stack mt-2 ml-6 overflow-x-auto rounded-[8px] border border-[var(--an-border-color)] bg-[var(--an-background)] p-2 text-[11px] whitespace-pre-wrap break-words text-[var(--an-foreground-muted)]">
                    {log.stack}
                  </pre>
                )}
                {log.sourceFile && log.line && (
                  <div className="log-location mt-1 ml-6 text-[11px] text-[var(--an-foreground-subtle)]">
                    {log.sourceFile}:{log.line}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
