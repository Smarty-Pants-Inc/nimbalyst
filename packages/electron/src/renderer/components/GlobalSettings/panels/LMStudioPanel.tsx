import React from 'react';
import { ProviderConfig, Model } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';
import { createProviderPanelChrome, getProviderTestButtonClass } from './providerPanelChrome';

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
const chrome = createProviderPanelChrome({
  headerClassName: 'provider-panel-header lmstudio-panel-header',
  sectionClassName: 'provider-panel-section lmstudio-panel-section',
  configCardClassName: 'api-key-section lmstudio-server-card',
  inputClassName: 'api-key-input lmstudio-base-url-input',
  loadingClassName: 'models-loading lmstudio-models-loading',
  modelRowClassName: 'model-checkbox lmstudio-model-row',
  testButtonClassName: 'test-button lmstudio-test-button',
  testErrorClassName: 'test-error lmstudio-test-error',
  emptyClassName: 'models-loading lmstudio-models-empty',
});

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
        className={chrome.header}
        data-agent-elements-shell="lmstudio-header"
        data-testid="agent-elements-lmstudio-header"
      >
        <h3 className={chrome.title}>LM Studio</h3>
        <p className={chrome.description}>
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
            className={chrome.section}
            data-agent-elements-shell="lmstudio-server-section"
            data-section="server-configuration"
            data-testid="agent-elements-lmstudio-server-section"
          >
            <h4 className={chrome.sectionTitle}>Server Configuration</h4>
            <div
              className={chrome.configCard}
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
                  className={chrome.input}
                />
                <button
                  className={getProviderTestButtonClass(config.testStatus, chrome)}
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
                  className={chrome.testError}
                  data-agent-elements-shell="lmstudio-test-error"
                  data-testid="agent-elements-lmstudio-test-error"
                >
                  {config.testMessage}
                </div>
              )}
            </div>
          </div>

          <div
            className={chrome.section}
            data-agent-elements-shell="lmstudio-models-section"
            data-section="available-models"
            data-testid="agent-elements-lmstudio-models-section"
          >
            <h4 className={chrome.sectionTitle}>Available Models</h4>
            {loading && (
              <div
                className={chrome.loadingText}
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
                  <span className={chrome.modelsHeaderText}>Detected models:</span>
                  <div
                    className="models-actions lmstudio-model-actions flex gap-2"
                    data-agent-elements-shell="lmstudio-model-actions"
                    data-testid="agent-elements-lmstudio-model-actions"
                  >
                    <button
                      className={chrome.modelActionButton}
                      onClick={() => onSelectAllModels(true)}
                    >
                      Select All
                    </button>
                    <button
                      className={chrome.modelActionButton}
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
                      className={chrome.modelRow}
                      data-agent-elements-shell="lmstudio-model-row"
                      data-model-id={model.id}
                      data-testid={`agent-elements-lmstudio-model-row-${getModelDomId(model.id)}`}
                    >
                      <input
                        type="checkbox"
                        checked={config.models?.includes(model.id) ?? false}
                        onChange={(e) => onModelToggle(model.id, e.target.checked)}
                        className={chrome.checkbox}
                      />
                      <span className={chrome.modelName}>{model.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!loading && availableModels.length === 0 && (
              <div
                className={chrome.emptyText}
                data-agent-elements-shell="lmstudio-models-empty"
                data-testid="agent-elements-lmstudio-models-empty"
              >
                No models found. Make sure LM Studio is running with a loaded model.
              </div>
            )}

            <div className="mt-4">
              <button
                className={`${chrome.secondaryButton} models-action-btn px-[var(--an-spacing-md)] py-[var(--an-spacing-xs)] text-xs`}
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
