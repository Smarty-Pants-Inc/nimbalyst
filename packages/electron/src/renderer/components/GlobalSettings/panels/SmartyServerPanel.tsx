import React from 'react';
import { ProviderConfig } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';

interface SmartyServerPanelProps {
  config: ProviderConfig;
  apiKeys: Record<string, string>;
  availableModels: any[];
  loading: boolean;
  onToggle: (enabled: boolean) => void;
  onApiKeyChange: (key: string, value: string) => void;
  onModelToggle: (modelId: string, enabled: boolean) => void;
  onSelectAllModels: (selectAll: boolean) => void;
  onTestConnection: () => Promise<void>;
  onConfigChange: (updates: Partial<ProviderConfig>) => void;
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:8788';
const DEFAULT_ASSISTANT_ID = 'smarty_coding_agent';

function assistantIdFromModel(modelId?: string): string {
  if (!modelId) return DEFAULT_ASSISTANT_ID;
  if (modelId.startsWith('smarty-server:')) {
    return modelId.slice('smarty-server:'.length) || DEFAULT_ASSISTANT_ID;
  }
  return modelId;
}

function modelFromAssistantId(assistantId: string): string {
  const trimmed = assistantId.trim() || DEFAULT_ASSISTANT_ID;
  return trimmed.startsWith('smarty-server:') ? trimmed : `smarty-server:${trimmed}`;
}

function statusLabel(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'unknown';
}

function optionalCapabilities(health: Record<string, any> | undefined): Array<Record<string, any>> {
  return Array.isArray(health?.optionalCapabilities) ? health.optionalCapabilities : [];
}

export function getSmartyServerRuntimeHealth(config: ProviderConfig): Record<string, any> | undefined {
  if (config.runtimeHealth) return config.runtimeHealth;
  if (config.testStatus === 'testing' || config.testStatus === 'error') return undefined;
  return config.lastSuccessfulRuntimeHealth;
}

function localModeLabel(localMode: Record<string, any> | undefined): string {
  if (localMode?.localOnly === true) return 'local-only';
  if (localMode?.localOnly === false) return 'not-local-only';
  return 'unknown';
}

function localModeDataValue(localMode: Record<string, any> | undefined): string {
  if (localMode?.localOnly === true) return 'true';
  if (localMode?.localOnly === false) return 'false';
  return 'unknown';
}

export function SmartyServerPanel({
  config,
  apiKeys,
  onToggle,
  onApiKeyChange,
  onTestConnection,
  onConfigChange,
}: SmartyServerPanelProps) {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const assistantId = assistantIdFromModel(config.defaultModel);
  const runtimeHealth = getSmartyServerRuntimeHealth(config);
  const cliProxyReachable = runtimeHealth?.cliProxy?.reachable === true;
  const tracing = runtimeHealth?.langSmithTracing;
  const localMode = runtimeHealth?.localMode;
  const degradedCapabilities = optionalCapabilities(runtimeHealth)
    .filter((capability) => capability.status !== 'ready');

  return (
    <div className="smarty-server-panel provider-panel flex flex-col" data-component="SmartyServerPanel">
      <div className="provider-panel-header mb-6 pb-4 border-b border-[var(--nim-border)]">
        <h3 className="provider-panel-title text-xl font-semibold leading-tight mb-2 text-[var(--nim-text)]">Smarty Server</h3>
        <p className="provider-panel-description text-sm leading-relaxed text-[var(--nim-text-muted)]">
          Local LangGraph/DeepAgents runtime for Smarty Code agent sessions.
        </p>
      </div>

      <SettingsToggle
        variant="enable"
        name="Enable Smarty Server"
        checked={config.enabled || false}
        onChange={onToggle}
      />

      {config.enabled && (
        <div className="provider-panel-section py-4 mb-4 border-b border-[var(--nim-border)] last:border-b-0 last:mb-0 last:pb-0">
          <h4 className="provider-panel-section-title text-base font-semibold mb-3 text-[var(--nim-text)]">Connection</h4>

          <label className="smarty-server-field flex flex-col gap-1.5 mb-3">
            <span className="text-[13px] font-medium text-[var(--nim-text)]">Server URL</span>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => onConfigChange({ baseUrl: e.target.value })}
              className="smarty-server-input py-2 px-3 rounded-md bg-[var(--nim-bg-secondary)] border border-[var(--nim-border)] text-[var(--nim-text)] outline-none font-mono text-sm focus:border-[var(--nim-primary)]"
              placeholder={DEFAULT_BASE_URL}
              data-testid="smarty-server-base-url"
            />
          </label>

          <label className="smarty-server-field flex flex-col gap-1.5 mb-3">
            <span className="text-[13px] font-medium text-[var(--nim-text)]">Assistant ID</span>
            <input
              type="text"
              value={assistantId}
              onChange={(e) => onConfigChange({ defaultModel: modelFromAssistantId(e.target.value) })}
              className="smarty-server-input py-2 px-3 rounded-md bg-[var(--nim-bg-secondary)] border border-[var(--nim-border)] text-[var(--nim-text)] outline-none font-mono text-sm focus:border-[var(--nim-primary)]"
              placeholder={DEFAULT_ASSISTANT_ID}
              data-testid="smarty-server-assistant-id"
            />
          </label>

          <label className="smarty-server-field flex flex-col gap-1.5 mb-4">
            <span className="text-[13px] font-medium text-[var(--nim-text)]">API Key</span>
            <input
              type="password"
              value={apiKeys['smarty-server'] || ''}
              onChange={(e) => onApiKeyChange('smarty-server', e.target.value)}
              onFocus={(e) => e.target.select()}
              className="smarty-server-input py-2 px-3 rounded-md bg-[var(--nim-bg-secondary)] border border-[var(--nim-border)] text-[var(--nim-text)] outline-none font-mono text-sm focus:border-[var(--nim-primary)]"
              placeholder="Optional"
              data-testid="smarty-server-api-key"
            />
          </label>

          <button
            className={`test-button inline-flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium whitespace-nowrap cursor-pointer transition-all bg-[var(--nim-bg-tertiary)] text-[var(--nim-text)] border border-[var(--nim-border)] hover:bg-[var(--nim-bg-hover)] hover:border-[var(--nim-primary)] ${
              config.testStatus === 'testing' ? 'opacity-60 cursor-wait' : ''
            } ${config.testStatus === 'success' ? 'text-[var(--nim-success)] border-[var(--nim-success)]' : ''} ${
              config.testStatus === 'error' ? 'text-[var(--nim-error)] border-[var(--nim-error)]' : ''
            }`}
            onClick={onTestConnection}
            disabled={config.testStatus === 'testing'}
            data-testid="smarty-server-test-connection"
          >
            {config.testStatus === 'testing' ? 'Testing...' :
              config.testStatus === 'success' ? 'Connected' :
              config.testStatus === 'error' ? 'Failed' : 'Test'}
          </button>

          {config.testMessage && config.testStatus === 'error' && (
            <div className="test-error text-xs mt-2 text-[var(--nim-error)]" data-testid="smarty-server-test-error">{config.testMessage}</div>
          )}

          {(runtimeHealth || config.runtimeHealthRecovery || config.testStatus === 'error') && (
            <div
              className="smarty-server-runtime-health mt-4 rounded-md border border-[var(--nim-border)] bg-[var(--nim-bg-secondary)] p-3 text-xs text-[var(--nim-text)]"
              data-testid="smarty-server-runtime-health"
              data-runtime={statusLabel(runtimeHealth?.runtime)}
              data-cli-proxy-status={runtimeHealth ? (cliProxyReachable ? 'ready' : 'unavailable') : 'unknown'}
              data-selected-model={statusLabel(runtimeHealth?.modelBackend?.selectedModel)}
              data-tracing-status={tracing?.enabled === true ? 'enabled' : 'disabled'}
              data-local-only={localModeDataValue(localMode)}
              data-degraded-count={String(degradedCapabilities.length)}
            >
              <div className="smarty-server-health-grid grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <div className="text-[10px] uppercase tracking-normal text-[var(--nim-text-faint)]">Runtime</div>
                  <div data-testid="smarty-server-health-runtime">{statusLabel(runtimeHealth?.runtime)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-normal text-[var(--nim-text-faint)]">Mode</div>
                  <div data-testid="smarty-server-health-local-mode">{localModeLabel(localMode)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-normal text-[var(--nim-text-faint)]">Backend</div>
                  <div data-testid="smarty-server-health-backend">{statusLabel(runtimeHealth?.modelBackend?.backend)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-normal text-[var(--nim-text-faint)]">Model</div>
                  <div data-testid="smarty-server-health-model">{statusLabel(runtimeHealth?.modelBackend?.selectedModel)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-normal text-[var(--nim-text-faint)]">CLIProxyAPI</div>
                  <div data-testid="smarty-server-health-cliproxy">{runtimeHealth ? (cliProxyReachable ? 'ready' : 'unavailable') : 'unknown'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-normal text-[var(--nim-text-faint)]">Tracing</div>
                  <div data-testid="smarty-server-health-tracing">
                    {tracing?.enabled === true ? `enabled ${tracing?.project || ''}`.trim() : 'disabled'}
                  </div>
                </div>
              </div>

              {runtimeHealth?.workspace?.path && (
                <div className="smarty-server-health-workspace mt-3 text-[var(--nim-text-muted)]" data-testid="smarty-server-health-workspace">
                  {runtimeHealth.workspace.path}
                </div>
              )}

              {degradedCapabilities.length > 0 && (
                <div className="smarty-server-health-degraded mt-3" data-testid="smarty-server-degraded-capabilities">
                  <div className="mb-1 text-[10px] uppercase tracking-normal text-[var(--nim-warning)]">Optional degraded</div>
                  <div className="flex flex-col gap-1">
                    {degradedCapabilities.map((capability) => (
                      <div
                        key={capability.id || capability.label}
                        className="smarty-server-optional-capability flex items-start justify-between gap-3 rounded bg-[var(--nim-bg-tertiary)] px-2 py-1 text-[var(--nim-text-muted)]"
                        data-testid="smarty-server-optional-capability"
                        data-capability-id={capability.id}
                        data-status={capability.status}
                      >
                        <span>{capability.label}</span>
                        <span className="text-[var(--nim-warning)]">{capability.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(config.runtimeHealthRecovery || runtimeHealth?.recovery?.cliProxy) && (
                <div className="smarty-server-health-recovery mt-3 text-[var(--nim-text-muted)]" data-testid="smarty-server-health-recovery">
                  {config.runtimeHealthRecovery || runtimeHealth?.recovery?.cliProxy}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
