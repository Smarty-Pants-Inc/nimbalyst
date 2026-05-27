import React from 'react';
import { ProviderConfig, Model } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';
import { createProviderPanelChrome, getProviderTestButtonClass } from './providerPanelChrome';

interface ClaudePanelProps {
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
  headerClassName: 'provider-panel-header claude-panel-header',
  sectionClassName: 'provider-panel-section claude-panel-section',
  configCardClassName: 'api-key-section claude-api-card',
  inputClassName: 'api-key-input claude-api-key-input',
  loadingClassName: 'models-loading claude-models-loading',
  modelRowClassName: 'model-checkbox claude-model-row',
  testButtonClassName: 'test-button claude-test-button',
  testErrorClassName: 'test-error claude-test-error',
  emptyClassName: 'models-loading claude-models-empty',
});

export function ClaudePanel({
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
}: ClaudePanelProps) {
  return (
    <div
      className="provider-panel claude-panel agent-elements-settings-panel agent-elements-claude-panel flex flex-col"
      data-agent-elements-shell="claude-panel"
      data-component="ClaudePanel"
      data-testid="agent-elements-claude-panel"
    >
      <div
        className={chrome.header}
        data-agent-elements-shell="claude-header"
        data-testid="agent-elements-claude-header"
      >
        <h3 className={chrome.title}>Claude Chat</h3>
        <p className={chrome.description}>
          Chat mode is a quicker, more focused tool that is limited to reading and writing your currently open file.
          Uses direct API calls with files attached as context for faster responses. Requires an Anthropic API key.
        </p>
      </div>

      <SettingsToggle
        variant="enable"
        name="Enable Claude"
        checked={config.enabled}
        onChange={onToggle}
        testId="agent-elements-claude-enable-toggle"
      />

      {config.enabled && (
        <>
          <div
            className={chrome.section}
            data-agent-elements-shell="claude-api-section"
            data-section="api-configuration"
            data-testid="agent-elements-claude-api-section"
          >
            <h4 className={chrome.sectionTitle}>API Configuration</h4>
            <div
              className={chrome.configCard}
              data-agent-elements-shell="claude-api-card"
              data-testid="agent-elements-claude-api-card"
            >
              <div className="api-key-row flex gap-2 items-center">
                <input
                  aria-label="Anthropic API key"
                  data-testid="agent-elements-claude-api-key-input"
                  type="password"
                  value={apiKeys.anthropic || ''}
                  onChange={(e) => onApiKeyChange('anthropic', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="sk-ant-..."
                  className={chrome.input}
                />
                <button
                  className={getProviderTestButtonClass(config.testStatus, chrome)}
                  onClick={onTestConnection}
                  disabled={config.testStatus === 'testing'}
                  data-test-status={config.testStatus || 'idle'}
                  data-testid="agent-elements-claude-test-button"
                >
                  {config.testStatus === 'testing' ? 'Testing...' :
                   config.testStatus === 'success' ? '✓ Connected' :
                   config.testStatus === 'error' ? '✗ Failed' : 'Test'}
                </button>
              </div>
              {config.testMessage && config.testStatus === 'error' && (
                <div
                  className={chrome.testError}
                  data-agent-elements-shell="claude-test-error"
                  data-testid="agent-elements-claude-test-error"
                >
                  {config.testMessage}
                </div>
              )}
            </div>
          </div>

          <div
            className={chrome.section}
            data-agent-elements-shell="claude-models-section"
            data-section="available-models"
            data-testid="agent-elements-claude-models-section"
          >
            <h4 className={chrome.sectionTitle}>Available Models</h4>
            {loading && (
              <div
                className={chrome.loadingText}
                data-agent-elements-shell="claude-models-loading"
                data-testid="agent-elements-claude-models-loading"
              >
                Loading models...
              </div>
            )}

            {!loading && availableModels.length > 0 && (
              <div
                className="models-section claude-models-list"
                data-agent-elements-shell="claude-models-list"
                data-testid="agent-elements-claude-models-list"
              >
                <div className="models-header flex items-center justify-between mb-3">
                  <span className={chrome.modelsHeaderText}>Select models to enable:</span>
                  <div
                    className="models-actions claude-model-actions flex gap-2"
                    data-agent-elements-shell="claude-model-actions"
                    data-testid="agent-elements-claude-model-actions"
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
                      data-agent-elements-shell="claude-model-row"
                      data-model-id={model.id}
                      data-testid={`agent-elements-claude-model-row-${getModelDomId(model.id)}`}
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

            {!loading && availableModels.length === 0 && apiKeys.anthropic && (
              <div
                className={chrome.emptyText}
                data-agent-elements-shell="claude-models-empty"
                data-testid="agent-elements-claude-models-empty"
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
