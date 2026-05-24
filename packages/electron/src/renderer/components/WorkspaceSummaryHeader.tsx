import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { getFileName } from '../utils/pathUtils';
import { providersAtom } from '../store/atoms/appSettings';
import { generateWorkspaceAccentColor } from './workspaceAccent';

export { generateWorkspaceAccentColor } from './workspaceAccent';

interface WorkspaceSummaryHeaderProps {
  workspacePath: string;
  workspaceName?: string;
  actions?: React.ReactNode;
  subtitle?: React.ReactNode;
  showAccent?: boolean;
  headerClassName?: string;
  actionsClassName?: string;
}

interface GitStatusView {
  branch?: string;
  ahead?: number;
  behind?: number;
  hasUncommitted?: boolean;
}

interface WorkspaceRuntimeHealth {
  cliProxy?: { reachable?: boolean };
  modelBackend?: { selectedModel?: string };
  langSmithTracing?: { enabled?: boolean };
  localMode?: { localOnly?: boolean };
}

interface WorkspaceRuntimeProviderConfig {
  enabled?: boolean;
  baseUrl?: string;
  testStatus?: 'idle' | 'testing' | 'success' | 'error';
  runtimeHealth?: WorkspaceRuntimeHealth;
  lastSuccessfulRuntimeHealth?: WorkspaceRuntimeHealth;
}

function formatServerUrl(value?: string): string {
  if (!value) return 'not configured';
  try {
    const url = new URL(value);
    return `${url.hostname}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
}

export function formatWorkspaceLocalModeStatus(runtimeHealth?: { localMode?: { localOnly?: boolean } }): string {
  if (!runtimeHealth?.localMode) return 'unknown';
  return runtimeHealth.localMode.localOnly === true ? 'local-only' : 'not-local-only';
}

export function getWorkspaceRuntimeHealth(
  provider?: Pick<WorkspaceRuntimeProviderConfig, 'enabled' | 'runtimeHealth' | 'lastSuccessfulRuntimeHealth' | 'testStatus'>,
): WorkspaceRuntimeHealth | undefined {
  if (provider?.enabled === false) return undefined;
  if (provider?.runtimeHealth) return provider.runtimeHealth;
  if (provider?.testStatus === 'testing' || provider?.testStatus === 'error') return undefined;
  return provider?.lastSuccessfulRuntimeHealth;
}

function WorkspaceExecutionContext({ workspacePath }: { workspacePath: string }) {
  const providers = useAtomValue(providersAtom);
  const smartyServer = providers['smarty-server'] as WorkspaceRuntimeProviderConfig | undefined;
  const [gitStatus, setGitStatus] = useState<GitStatusView | null>(null);

  const fetchGitStatus = useCallback(async () => {
    if (!workspacePath || !window.electronAPI?.invoke) return;
    try {
      const status = await window.electronAPI.invoke('git:status', workspacePath);
      setGitStatus(status as GitStatusView);
    } catch {
      setGitStatus(null);
    }
  }, [workspacePath]);

  useEffect(() => {
    void fetchGitStatus();
    const unsubscribe = window.electronAPI?.git?.onStatusChanged?.(
      (data: { workspacePath: string }) => {
        if (data.workspacePath === workspacePath) {
          void fetchGitStatus();
        }
      },
    );
    return () => unsubscribe?.();
  }, [fetchGitStatus, workspacePath]);

  const serverStatus = useMemo(() => {
    if (!smartyServer?.enabled) return 'disabled';
    if (smartyServer.testStatus === 'success') return 'connected';
    if (smartyServer.testStatus === 'error') return 'failed';
    if (smartyServer.testStatus === 'testing') return 'testing';
    return 'configured';
  }, [smartyServer]);

  const branch = gitStatus?.branch || 'unknown';
  const dirtyState = gitStatus?.hasUncommitted ? 'dirty' : 'clean';
  const serverUrl = smartyServer?.baseUrl || '';
  const runtimeHealth = getWorkspaceRuntimeHealth(smartyServer);
  const cliProxyStatus = runtimeHealth
    ? (runtimeHealth.cliProxy?.reachable === true ? 'ready' : 'unavailable')
    : 'unknown';
  const selectedModel = runtimeHealth?.modelBackend?.selectedModel || 'unknown';
  const tracingStatus = runtimeHealth?.langSmithTracing?.enabled === true ? 'enabled' : 'disabled';
  const localOnlyStatus = formatWorkspaceLocalModeStatus(runtimeHealth);

  return (
    <div
      className="workspace-execution-context agent-elements-workspace-execution-context mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-tight text-[var(--an-foreground-muted)]"
      data-testid="workspace-execution-context"
      data-agent-elements-shell="workspace-execution-context"
      data-workspace-path={workspacePath}
      data-branch={branch}
      data-dirty={dirtyState}
      data-smarty-server-status={serverStatus}
      data-smarty-server-url={serverUrl}
      data-cli-proxy-status={cliProxyStatus}
      data-selected-model={selectedModel}
      data-tracing-status={tracingStatus}
      data-local-mode={localOnlyStatus}
    >
      <span data-testid="workspace-execution-context-branch">branch {branch}</span>
      <span className="text-[var(--an-foreground-subtle)]" aria-hidden="true">/</span>
      <span data-testid="workspace-execution-context-dirty">{dirtyState}</span>
      <span className="text-[var(--an-foreground-subtle)]" aria-hidden="true">/</span>
      <span data-testid="workspace-execution-context-server">
        smarty-server {serverStatus}{serverUrl ? ` ${formatServerUrl(serverUrl)}` : ''}
      </span>
      <span className="text-[var(--an-foreground-subtle)]" aria-hidden="true">/</span>
      <span data-testid="workspace-execution-context-cliproxy">cliproxy {cliProxyStatus}</span>
      <span className="text-[var(--an-foreground-subtle)]" aria-hidden="true">/</span>
      <span data-testid="workspace-execution-context-model">model {selectedModel}</span>
      <span className="text-[var(--an-foreground-subtle)]" aria-hidden="true">/</span>
      <span data-testid="workspace-execution-context-tracing">tracing {tracingStatus}</span>
      <span className="text-[var(--an-foreground-subtle)]" aria-hidden="true">/</span>
      <span data-testid="workspace-execution-context-local-mode">{localOnlyStatus}</span>
    </div>
  );
}

export function WorkspaceSummaryHeader({
  workspacePath,
  workspaceName,
  actions,
  subtitle,
  showAccent = true,
  headerClassName = '',
  actionsClassName = '',
}: WorkspaceSummaryHeaderProps) {
  const displayName = workspaceName || getFileName(workspacePath) || 'Workspace';

  return (
    <>
      {showAccent && (
        <div
          className="workspace-color-accent agent-elements-workspace-summary-header-accent h-[3px] w-full shrink-0"
          data-testid="workspace-summary-header-accent"
          data-agent-elements-shell="workspace-summary-header-accent"
          style={{ backgroundColor: generateWorkspaceAccentColor(workspacePath) }}
        />
      )}
      <div
        className={`workspace-summary-header agent-elements-workspace-summary-header px-3 pt-2.5 pb-2 border-b border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] gap-2 min-h-14 shrink-0 ${headerClassName}`.trim()}
        data-testid="workspace-summary-header"
        data-component="WorkspaceSummaryHeader"
        data-agent-elements-shell="workspace-summary-header"
      >
        <div className="workspace-summary-header-top flex items-start gap-2">
          <div className="workspace-summary-header-title-row flex items-baseline gap-2.5 min-w-0 flex-1">
            <h3 className="workspace-summary-header-name agent-elements-workspace-summary-header-name m-0 text-[15px] font-semibold text-[var(--an-foreground)] overflow-hidden text-ellipsis whitespace-nowrap leading-tight">
              {displayName}
            </h3>
            {subtitle ? (
              <span className="workspace-summary-header-subtitle agent-elements-workspace-summary-header-subtitle text-[13px] font-medium text-[var(--an-foreground-muted)] whitespace-nowrap">
                {subtitle}
              </span>
            ) : null}
          </div>
          {actions ? (
            <div
              className={`workspace-summary-header-actions agent-elements-workspace-summary-header-actions flex items-center gap-1.5 shrink-0 ${actionsClassName}`.trim()}
              data-testid="workspace-summary-header-actions"
            >
              {actions}
            </div>
          ) : null}
        </div>
        <div
          className="workspace-summary-header-path agent-elements-workspace-summary-header-path mt-0.5 text-[11px] text-[var(--an-foreground-muted)] overflow-hidden text-ellipsis whitespace-nowrap font-normal"
          data-testid="workspace-summary-header-path"
          title={workspacePath}
        >
          {workspacePath}
        </div>
        <WorkspaceExecutionContext workspacePath={workspacePath} />
      </div>
    </>
  );
}
