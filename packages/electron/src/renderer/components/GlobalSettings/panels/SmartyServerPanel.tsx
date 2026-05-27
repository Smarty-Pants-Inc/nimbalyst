import React from 'react';
import { ProviderConfig } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';
import { createProviderPanelChrome, getProviderTestButtonClass } from './providerPanelChrome';

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

const chrome = createProviderPanelChrome({
  headerClassName: 'provider-panel-header smarty-server-panel-header',
  sectionClassName: 'provider-panel-section smarty-server-section',
  configCardClassName: 'smarty-server-card',
  inputClassName: 'smarty-server-input',
  loadingClassName: 'smarty-server-loading',
  modelRowClassName: 'smarty-server-model-row',
  testButtonClassName: 'test-button smarty-server-test-button',
  testErrorClassName: 'test-error smarty-server-test-error',
  emptyClassName: 'smarty-server-empty',
});

const fieldClass =
  'smarty-server-field mb-[var(--an-spacing-md)] flex flex-col gap-[var(--an-spacing-xs)]';
const fieldLabelClass =
  'text-[13px] font-medium text-[var(--an-foreground)]';
const healthCardClass =
  `${chrome.configCard} text-xs text-[var(--an-foreground)]`;
const healthGridClass =
  'smarty-server-health-grid grid grid-cols-2 gap-x-[var(--an-spacing-xxl)] gap-y-[var(--an-spacing-md)]';
const healthLabelClass =
  'text-[10px] uppercase tracking-normal text-[var(--an-foreground-subtle)]';
const healthValueClass =
  'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[var(--an-foreground)]';
const mutedTextClass =
  'text-[var(--an-foreground-muted)]';
const degradedCardClass =
  'smarty-server-optional-capability flex items-start justify-between gap-[var(--an-spacing-lg)] rounded-[calc(var(--an-tool-border-radius)_-_4px)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-[var(--an-foreground-muted)]';

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
    <div
      className="smarty-server-panel provider-panel agent-elements-settings-panel agent-elements-smarty-server-panel flex flex-col"
      data-agent-elements-shell="smarty-server-panel"
      data-component="SmartyServerPanel"
      data-testid="agent-elements-smarty-server-panel"
    >
      <div
        className={chrome.header}
        data-agent-elements-shell="smarty-server-header"
        data-testid="agent-elements-smarty-server-header"
      >
        <h3 className={chrome.title}>Smarty Server</h3>
        <p className={chrome.description}>
          Local LangGraph/DeepAgents runtime for Smarty Code agent sessions.
        </p>
      </div>

      <SettingsToggle
        variant="enable"
        name="Enable Smarty Server"
        checked={config.enabled || false}
        onChange={onToggle}
        testId="agent-elements-smarty-server-enable-toggle"
      />

      {config.enabled && (
        <div
          className={`${chrome.section} smarty-server-connection-section`}
          data-agent-elements-shell="smarty-server-connection-section"
          data-section="connection"
          data-testid="agent-elements-smarty-server-connection-section"
        >
          <h4 className={chrome.sectionTitle}>Connection</h4>

          <label className={fieldClass}>
            <span className={fieldLabelClass}>Server URL</span>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => onConfigChange({ baseUrl: e.target.value })}
              className={`w-full ${chrome.input}`}
              placeholder={DEFAULT_BASE_URL}
              data-testid="smarty-server-base-url"
            />
          </label>

          <label className={fieldClass}>
            <span className={fieldLabelClass}>Assistant ID</span>
            <input
              type="text"
              value={assistantId}
              onChange={(e) => onConfigChange({ defaultModel: modelFromAssistantId(e.target.value) })}
              className={`w-full ${chrome.input}`}
              placeholder={DEFAULT_ASSISTANT_ID}
              data-testid="smarty-server-assistant-id"
            />
          </label>

          <label className={fieldClass}>
            <span className={fieldLabelClass}>API Key</span>
            <input
              type="password"
              value={apiKeys['smarty-server'] || ''}
              onChange={(e) => onApiKeyChange('smarty-server', e.target.value)}
              onFocus={(e) => e.target.select()}
              className={`w-full ${chrome.input}`}
              placeholder="Optional"
              data-testid="smarty-server-api-key"
            />
          </label>

          <button
            className={getProviderTestButtonClass(config.testStatus, chrome)}
            onClick={onTestConnection}
            disabled={config.testStatus === 'testing'}
            data-testid="smarty-server-test-connection"
          >
            {config.testStatus === 'testing' ? 'Testing...' :
              config.testStatus === 'success' ? 'Connected' :
              config.testStatus === 'error' ? 'Failed' : 'Test'}
          </button>

          {config.testMessage && config.testStatus === 'error' && (
            <div className={chrome.testError} data-testid="smarty-server-test-error">{config.testMessage}</div>
          )}

          {(runtimeHealth || config.runtimeHealthRecovery || config.testStatus === 'error') && (
            <div
              className={healthCardClass}
              data-agent-elements-card-padding="symmetric-inline"
              data-agent-elements-card-width="section-row"
              data-agent-elements-shell="smarty-server-runtime-health"
              data-testid="smarty-server-runtime-health"
              data-runtime={statusLabel(runtimeHealth?.runtime)}
              data-cli-proxy-status={runtimeHealth ? (cliProxyReachable ? 'ready' : 'unavailable') : 'unknown'}
              data-selected-model={statusLabel(runtimeHealth?.modelBackend?.selectedModel)}
              data-tracing-status={tracing?.enabled === true ? 'enabled' : 'disabled'}
              data-local-only={localModeDataValue(localMode)}
              data-degraded-count={String(degradedCapabilities.length)}
            >
              <div className={healthGridClass}>
                <div>
                  <div className={healthLabelClass}>Runtime</div>
                  <div className={healthValueClass} data-testid="smarty-server-health-runtime">{statusLabel(runtimeHealth?.runtime)}</div>
                </div>
                <div>
                  <div className={healthLabelClass}>Mode</div>
                  <div className={healthValueClass} data-testid="smarty-server-health-local-mode">{localModeLabel(localMode)}</div>
                </div>
                <div>
                  <div className={healthLabelClass}>Backend</div>
                  <div className={healthValueClass} data-testid="smarty-server-health-backend">{statusLabel(runtimeHealth?.modelBackend?.backend)}</div>
                </div>
                <div>
                  <div className={healthLabelClass}>Model</div>
                  <div className={healthValueClass} data-testid="smarty-server-health-model">{statusLabel(runtimeHealth?.modelBackend?.selectedModel)}</div>
                </div>
                <div>
                  <div className={healthLabelClass}>CLIProxyAPI</div>
                  <div className={healthValueClass} data-testid="smarty-server-health-cliproxy">{runtimeHealth ? (cliProxyReachable ? 'ready' : 'unavailable') : 'unknown'}</div>
                </div>
                <div>
                  <div className={healthLabelClass}>Tracing</div>
                  <div className={healthValueClass} data-testid="smarty-server-health-tracing">
                    {tracing?.enabled === true ? `enabled ${tracing?.project || ''}`.trim() : 'disabled'}
                  </div>
                </div>
              </div>

              {runtimeHealth?.workspace?.path && (
                <div className={`smarty-server-health-workspace mt-[var(--an-spacing-md)] overflow-hidden text-ellipsis whitespace-nowrap ${mutedTextClass}`} data-testid="smarty-server-health-workspace">
                  {runtimeHealth.workspace.path}
                </div>
              )}

              {degradedCapabilities.length > 0 && (
                <div className="smarty-server-health-degraded mt-[var(--an-spacing-md)]" data-testid="smarty-server-degraded-capabilities">
                  <div className="mb-[var(--an-spacing-xs)] text-[10px] uppercase tracking-normal text-[var(--an-warning-color)]">Optional degraded</div>
                  <div className="flex flex-col gap-[var(--an-spacing-xs)]">
                    {degradedCapabilities.map((capability) => (
                      <div
                        key={capability.id || capability.label}
                        className={degradedCardClass}
                        data-testid="smarty-server-optional-capability"
                        data-capability-id={capability.id}
                        data-status={capability.status}
                      >
                        <span>{capability.label}</span>
                        <span className="text-[var(--an-warning-color)]">{capability.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(config.runtimeHealthRecovery || runtimeHealth?.recovery?.cliProxy) && (
                <div className={`smarty-server-health-recovery mt-[var(--an-spacing-md)] ${mutedTextClass}`} data-testid="smarty-server-health-recovery">
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
