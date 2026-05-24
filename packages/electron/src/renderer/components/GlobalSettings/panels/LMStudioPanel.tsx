import React from 'react';
import { ProviderConfig, Model } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';

interface LMStudioPanelProps {
  config: ProviderConfig;
  apiKeys: Record<string, string>;
  availableModels: Model[];
  loading: boolean;
  onToggle: (enabled: boolean) => void;
  onApiKeyChange: (key: string, value: string) => void;
  onModelToggle: (modelId: string, enabled: boolean) => void;
  onSelectAllModels: (selectAll: boolean) => void;
  onTestConnection: () => Promise<void>;
  onConfigChange: (updates: Partial<ProviderConfig>) => void;
}

const getModelDomId = (modelId: string) => modelId.replace(/[^a-zA-Z0-9_-]+/g, '-');

export function LMStudioPanel({
  config,
  apiKeys,
  availableModels,
  loading,
  onToggle,
  onApiKeyChange,
  onModelToggle,
  onSelectAllModels,
  onTestConnection,
  onConfigChange
}: LMStudioPanelProps) {
  return (
    <div
      className="provider-panel lmstudio-panel agent-elements-settings-panel agent-elements-lmstudio-panel flex flex-col"
      data-agent-elements-shell="lmstudio-panel"
      data-component="LMStudioPanel"
      data-testid="agent-elements-lmstudio-panel"
    >
      <div
        className="provider-panel-header lmstudio-panel-header agent-elements-settings-panel-header mb-6 pb-4 border-b border-[var(--nim-border)]"
        data-agent-elements-shell="lmstudio-header"
        data-testid="agent-elements-lmstudio-header"
      >
        <h3 className="provider-panel-title text-xl font-semibold leading-tight mb-2 text-[var(--nim-text)]">LM Studio</h3>
        <p className="provider-panel-description text-sm leading-relaxed text-[var(--nim-text-muted)]">
          Connect to local LLMs running in LM Studio on your machine.
          Start LM Studio and load a model before enabling.
        </p>
      </div>

      <SettingsToggle
        variant="enable"
        name="Enable LM Studio"
        checked={config.enabled}
        onChange={onToggle}
        testId="agent-elements-lmstudio-enable-toggle"
      />

      {config.enabled && (
        <>
          <div
            className="provider-panel-section lmstudio-panel-section agent-elements-settings-section py-4 mb-4 border-b border-[var(--nim-border)] last:border-b-0 last:mb-0 last:pb-0"
            data-agent-elements-shell="lmstudio-server-section"
            data-section="server-configuration"
            data-testid="agent-elements-lmstudio-server-section"
          >
            <h4 className="provider-panel-section-title text-base font-semibold mb-3 text-[var(--nim-text)]">Server Configuration</h4>
            <div
              className="api-key-section lmstudio-server-card agent-elements-tool-card mt-4 rounded-lg border border-[var(--nim-border)] bg-[var(--nim-bg-secondary)] p-3"
              data-agent-elements-shell="lmstudio-server-card"
              data-testid="agent-elements-lmstudio-server-card"
            >
              <div className="api-key-row flex gap-2 items-center">
                <input
                  aria-label="LM Studio base URL"
                  data-testid="agent-elements-lmstudio-base-url-input"
                  type="text"
                  value={config.baseUrl || 'http://127.0.0.1:8234'}
                  onChange={(e) => onConfigChange({ baseUrl: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  placeholder="http://127.0.0.1:8234"
                  className="api-key-input lmstudio-base-url-input flex-1 py-2 px-3 rounded-md bg-[var(--nim-bg)] border border-[var(--nim-border)] text-[var(--nim-text)] outline-none font-mono focus:border-[var(--nim-primary)]"
                />
                <button
                  className={`test-button lmstudio-test-button inline-flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium whitespace-nowrap cursor-pointer transition-all bg-[var(--nim-bg-tertiary)] text-[var(--nim-text)] border border-[var(--nim-border)] hover:bg-[var(--nim-bg-hover)] hover:border-[var(--nim-primary)] ${
                    config.testStatus === 'testing' ? 'opacity-60 cursor-wait' : ''
                  } ${config.testStatus === 'success' ? 'text-[var(--nim-success)] border-[var(--nim-success)]' : ''} ${
                    config.testStatus === 'error' ? 'text-[var(--nim-error)] border-[var(--nim-error)]' : ''
                  }`}
                  onClick={onTestConnection}
                  disabled={config.testStatus === 'testing'}
                  data-test-status={config.testStatus || 'idle'}
                  data-testid="agent-elements-lmstudio-test-button"
                >
                  {config.testStatus === 'testing' ? 'Testing...' :
                   config.testStatus === 'success' ? '✓ Connected' :
                   config.testStatus === 'error' ? '✗ Failed' : 'Test'}
                </button>
              </div>
              {config.testMessage && config.testStatus === 'error' && (
                <div
                  className="test-error lmstudio-test-error text-xs mt-2 text-[var(--nim-error)]"
                  data-agent-elements-shell="lmstudio-test-error"
                  data-testid="agent-elements-lmstudio-test-error"
                >
                  {config.testMessage}
                </div>
              )}
            </div>
          </div>

          <div
            className="provider-panel-section lmstudio-panel-section agent-elements-settings-section py-4 mb-4 border-b border-[var(--nim-border)] last:border-b-0 last:mb-0 last:pb-0"
            data-agent-elements-shell="lmstudio-models-section"
            data-section="available-models"
            data-testid="agent-elements-lmstudio-models-section"
          >
            <h4 className="provider-panel-section-title text-base font-semibold mb-3 text-[var(--nim-text)]">Available Models</h4>
            {loading && (
              <div
                className="models-loading lmstudio-models-loading text-sm text-[var(--nim-text-muted)] py-2"
                data-agent-elements-shell="lmstudio-models-loading"
                data-testid="agent-elements-lmstudio-models-loading"
              >
                Loading models from LM Studio...
              </div>
            )}

            {!loading && availableModels.length > 0 && (
              <div
                className="models-section lmstudio-models-list"
                data-agent-elements-shell="lmstudio-models-list"
                data-testid="agent-elements-lmstudio-models-list"
              >
                <div className="models-header flex items-center justify-between mb-3">
                  <span className="text-sm text-[var(--nim-text-muted)]">Detected models:</span>
                  <div
                    className="models-actions lmstudio-model-actions flex gap-2"
                    data-agent-elements-shell="lmstudio-model-actions"
                    data-testid="agent-elements-lmstudio-model-actions"
                  >
                    <button
                      className="models-action-btn text-xs py-1 px-2 rounded bg-[var(--nim-bg-secondary)] border border-[var(--nim-border)] text-[var(--nim-text-muted)] hover:text-[var(--nim-text)] hover:bg-[var(--nim-bg-hover)] cursor-pointer transition-all"
                      onClick={() => onSelectAllModels(true)}
                    >
                      Select All
                    </button>
                    <button
                      className="models-action-btn text-xs py-1 px-2 rounded bg-[var(--nim-bg-secondary)] border border-[var(--nim-border)] text-[var(--nim-text-muted)] hover:text-[var(--nim-text)] hover:bg-[var(--nim-bg-hover)] cursor-pointer transition-all"
                      onClick={() => onSelectAllModels(false)}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="models-grid flex flex-col gap-2">
                  {availableModels.map(model => (
                    <label
                      key={model.id}
                      className="model-checkbox lmstudio-model-row agent-elements-tool-card flex items-center gap-3 py-2 px-3 rounded-md bg-[var(--nim-bg-secondary)] border border-[var(--nim-border)] cursor-pointer hover:bg-[var(--nim-bg-hover)]"
                      data-agent-elements-shell="lmstudio-model-row"
                      data-model-id={model.id}
                      data-testid={`agent-elements-lmstudio-model-row-${getModelDomId(model.id)}`}
                    >
                      <input
                        type="checkbox"
                        checked={config.models?.includes(model.id) ?? false}
                        onChange={(e) => onModelToggle(model.id, e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-[var(--nim-primary)]"
                      />
                      <span className="text-sm text-[var(--nim-text)]">{model.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!loading && availableModels.length === 0 && (
              <div
                className="models-loading lmstudio-models-empty text-sm text-[var(--nim-text-muted)] py-2"
                data-agent-elements-shell="lmstudio-models-empty"
                data-testid="agent-elements-lmstudio-models-empty"
              >
                No models found. Make sure LM Studio is running with a loaded model.
              </div>
            )}

            <div className="mt-4">
              <button
                className="models-action-btn text-xs py-1.5 px-3 rounded bg-[var(--nim-bg-secondary)] border border-[var(--nim-border)] text-[var(--nim-text-muted)] hover:text-[var(--nim-text)] hover:bg-[var(--nim-bg-hover)] cursor-pointer transition-all"
                onClick={() => onTestConnection()}
                disabled={loading}
                data-testid="agent-elements-lmstudio-refresh-button"
              >
                Refresh Models
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
