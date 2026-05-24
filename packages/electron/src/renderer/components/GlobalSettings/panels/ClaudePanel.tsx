import React from 'react';
import { ProviderConfig, Model } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';

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
        className="provider-panel-header claude-panel-header agent-elements-settings-panel-header mb-6 pb-4 border-b border-[var(--nim-border)]"
        data-agent-elements-shell="claude-header"
        data-testid="agent-elements-claude-header"
      >
        <h3 className="provider-panel-title text-xl font-semibold leading-tight mb-2 text-[var(--nim-text)]">Claude Chat</h3>
        <p className="provider-panel-description text-sm leading-relaxed text-[var(--nim-text-muted)]">
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
            className="provider-panel-section claude-panel-section agent-elements-settings-section py-4 mb-4 border-b border-[var(--nim-border)] last:border-b-0 last:mb-0 last:pb-0"
            data-agent-elements-shell="claude-api-section"
            data-section="api-configuration"
            data-testid="agent-elements-claude-api-section"
          >
            <h4 className="provider-panel-section-title text-base font-semibold mb-3 text-[var(--nim-text)]">API Configuration</h4>
            <div
              className="api-key-section claude-api-card agent-elements-tool-card mt-4 rounded-lg border border-[var(--nim-border)] bg-[var(--nim-bg-secondary)] p-3"
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
                  className="api-key-input claude-api-key-input flex-1 py-2 px-3 rounded-md bg-[var(--nim-bg)] border border-[var(--nim-border)] text-[var(--nim-text)] outline-none font-mono focus:border-[var(--nim-primary)]"
                />
                <button
                  className={`test-button claude-test-button inline-flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium whitespace-nowrap cursor-pointer transition-all bg-[var(--nim-bg-tertiary)] text-[var(--nim-text)] border border-[var(--nim-border)] hover:bg-[var(--nim-bg-hover)] hover:border-[var(--nim-primary)] ${
                    config.testStatus === 'testing' ? 'opacity-60 cursor-wait' : ''
                  } ${config.testStatus === 'success' ? 'text-[var(--nim-success)] border-[var(--nim-success)]' : ''} ${
                    config.testStatus === 'error' ? 'text-[var(--nim-error)] border-[var(--nim-error)]' : ''
                  }`}
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
                  className="test-error claude-test-error text-xs mt-2 text-[var(--nim-error)]"
                  data-agent-elements-shell="claude-test-error"
                  data-testid="agent-elements-claude-test-error"
                >
                  {config.testMessage}
                </div>
              )}
            </div>
          </div>

          <div
            className="provider-panel-section claude-panel-section agent-elements-settings-section py-4 mb-4 border-b border-[var(--nim-border)] last:border-b-0 last:mb-0 last:pb-0"
            data-agent-elements-shell="claude-models-section"
            data-section="available-models"
            data-testid="agent-elements-claude-models-section"
          >
            <h4 className="provider-panel-section-title text-base font-semibold mb-3 text-[var(--nim-text)]">Available Models</h4>
            {loading && (
              <div
                className="models-loading claude-models-loading text-sm text-[var(--nim-text-muted)] py-2"
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
                  <span className="text-sm text-[var(--nim-text-muted)]">Select models to enable:</span>
                  <div
                    className="models-actions claude-model-actions flex gap-2"
                    data-agent-elements-shell="claude-model-actions"
                    data-testid="agent-elements-claude-model-actions"
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
                      className="model-checkbox claude-model-row agent-elements-tool-card flex items-center gap-3 py-2 px-3 rounded-md bg-[var(--nim-bg-secondary)] border border-[var(--nim-border)] cursor-pointer hover:bg-[var(--nim-bg-hover)]"
                      data-agent-elements-shell="claude-model-row"
                      data-model-id={model.id}
                      data-testid={`agent-elements-claude-model-row-${getModelDomId(model.id)}`}
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

            {!loading && availableModels.length === 0 && apiKeys.anthropic && (
              <div
                className="models-loading claude-models-empty text-sm text-[var(--nim-text-muted)] py-2"
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
