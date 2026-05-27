import React from 'react';
import { ProviderConfig, Model } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';
import { createProviderPanelChrome, getProviderTestButtonClass } from './providerPanelChrome';

interface OpenAIPanelProps {
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
  headerClassName: 'provider-panel-header openai-panel-header',
  sectionClassName: 'provider-panel-section openai-panel-section',
  configCardClassName: 'api-key-section openai-api-card',
  inputClassName: 'api-key-input openai-api-key-input',
  loadingClassName: 'models-loading openai-models-loading',
  modelRowClassName: 'model-checkbox openai-model-row',
  testButtonClassName: 'test-button openai-test-button',
  testErrorClassName: 'test-error openai-test-error',
  emptyClassName: 'models-loading openai-models-empty',
});

export function OpenAIPanel({
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
}: OpenAIPanelProps) {
  return (
    <div
      className="provider-panel openai-panel agent-elements-settings-panel agent-elements-openai-panel flex flex-col"
      data-agent-elements-shell="openai-panel"
      data-component="OpenAIPanel"
      data-testid="agent-elements-openai-panel"
    >
      <div
        className={chrome.header}
        data-agent-elements-shell="openai-header"
        data-testid="agent-elements-openai-header"
      >
        <h3 className={chrome.title}>OpenAI</h3>
        <p className={chrome.description}>
          Access to GPT-5.4, GPT-5.3 Chat, GPT-5 mini/nano, GPT-4.1, GPT-4o, and other current OpenAI models.
          Requires an OpenAI API key from platform.openai.com.
        </p>
      </div>

      <SettingsToggle
        variant="enable"
        name="Enable OpenAI"
        checked={config.enabled}
        onChange={onToggle}
        testId="agent-elements-openai-enable-toggle"
      />

      {config.enabled && (
        <>
          <div
            className={chrome.section}
            data-agent-elements-shell="openai-api-section"
            data-section="api-configuration"
            data-testid="agent-elements-openai-api-section"
          >
            <h4 className={chrome.sectionTitle}>API Configuration</h4>
            <div
              className={chrome.configCard}
              data-agent-elements-shell="openai-api-card"
              data-testid="agent-elements-openai-api-card"
            >
              <div className="api-key-row flex gap-2 items-center">
                <input
                  aria-label="OpenAI API key"
                  data-testid="agent-elements-openai-api-key-input"
                  type="password"
                  value={apiKeys.openai || ''}
                  onChange={(e) => onApiKeyChange('openai', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="sk-..."
                  className={chrome.input}
                />
                <button
                  className={getProviderTestButtonClass(config.testStatus, chrome)}
                  onClick={onTestConnection}
                  disabled={config.testStatus === 'testing'}
                  data-test-status={config.testStatus || 'idle'}
                  data-testid="agent-elements-openai-test-button"
                >
                  {config.testStatus === 'testing' ? 'Testing...' :
                   config.testStatus === 'success' ? '✓ Connected' :
                   config.testStatus === 'error' ? '✗ Failed' : 'Test'}
                </button>
              </div>
              {config.testMessage && config.testStatus === 'error' && (
                <div
                  className={chrome.testError}
                  data-agent-elements-shell="openai-test-error"
                  data-testid="agent-elements-openai-test-error"
                >
                  {config.testMessage}
                </div>
              )}
            </div>
          </div>

          <div
            className={chrome.section}
            data-agent-elements-shell="openai-models-section"
            data-section="available-models"
            data-testid="agent-elements-openai-models-section"
          >
            <h4 className={chrome.sectionTitle}>Available Models</h4>
            {loading && (
              <div
                className={chrome.loadingText}
                data-agent-elements-shell="openai-models-loading"
                data-testid="agent-elements-openai-models-loading"
              >
                Loading models...
              </div>
            )}

            {!loading && availableModels.length > 0 && (
              <div
                className="models-section openai-models-list"
                data-agent-elements-shell="openai-models-list"
                data-testid="agent-elements-openai-models-list"
              >
                <div className="models-header flex items-center justify-between mb-3">
                  <span className={chrome.modelsHeaderText}>Select models to enable:</span>
                  <div
                    className="models-actions openai-model-actions flex gap-2"
                    data-agent-elements-shell="openai-model-actions"
                    data-testid="agent-elements-openai-model-actions"
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
                      data-agent-elements-shell="openai-model-row"
                      data-model-id={model.id}
                      data-testid={`agent-elements-openai-model-row-${getModelDomId(model.id)}`}
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

            {!loading && availableModels.length === 0 && apiKeys.openai && (
              <div
                className={chrome.emptyText}
                data-agent-elements-shell="openai-models-empty"
                data-testid="agent-elements-openai-models-empty"
              >
                No models available. Check your API key and connection.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
