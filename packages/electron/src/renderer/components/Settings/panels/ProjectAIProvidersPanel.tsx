import React, { useState, useEffect } from 'react';
import { MaterialSymbol, getProviderIcon } from '@nimbalyst/runtime';
import { ToggleSwitch } from '../../GlobalSettings/SettingsToggle';
import { createProviderPanelChrome } from '../../GlobalSettings/panels/providerPanelChrome';

interface ProviderOverride {
  enabled?: boolean;
  models?: string[];
  defaultModel?: string;
  baseUrl?: string;
  apiKey?: string;
}

interface AIProviderOverrides {
  defaultProvider?: string;
  providers?: Record<string, ProviderOverride>;
}

interface GlobalProviderSettings {
  enabled?: boolean;
  models?: string[];
  defaultModel?: string;
}

interface Model {
  id: string;
  name: string;
  provider: string;
}

interface TrackerAutomationOverride {
  enabled?: boolean;
  autoCloseOnCommit?: boolean;
}

interface ProjectAIProvidersPanelProps {
  workspacePath: string;
  workspaceName: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  subtitle: string;
  apiKeyField?: string; // The key name in apiKeys (e.g., 'anthropic', 'openai')
}

const PROVIDERS: ProviderInfo[] = [
  { id: 'claude-code', name: 'Claude Agent', subtitle: 'CLI-based MCP', apiKeyField: 'claude-code' },
  { id: 'claude', name: 'Claude', subtitle: 'Anthropic API', apiKeyField: 'anthropic' },
  { id: 'openai', name: 'OpenAI', subtitle: 'GPT Models', apiKeyField: 'openai' },
  { id: 'lmstudio', name: 'LM Studio', subtitle: 'Local Models' },
];

const chrome = createProviderPanelChrome({
  headerClassName: 'panel-header project-ai-providers-header',
  sectionClassName: 'provider-panel-section project-ai-providers-section',
  configCardClassName: 'project-ai-providers-card',
  inputClassName: 'project-ai-providers-input',
  loadingClassName: 'project-ai-providers-loading',
  modelRowClassName: 'project-ai-providers-model-row',
  testButtonClassName: 'project-ai-providers-action-button',
  testErrorClassName: 'project-ai-providers-error',
  emptyClassName: 'project-ai-providers-empty',
});

const panelClass =
  'project-ai-providers-panel agent-elements-settings-panel flex h-full flex-col gap-[var(--an-spacing-xxl)] p-[var(--an-spacing-xxl)]';
const cardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';
const cardInsetClass =
  'px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';
const zeroCardPaddingClass =
  '[--agent-elements-card-block-padding:0px] [--agent-elements-card-inline-padding:0px]';
const providerCardClass =
  `provider-card agent-elements-tool-card overflow-hidden border transition-[background-color,border-color,color] duration-150 ease-out ${zeroCardPaddingClass}`;
const providerHeaderClass =
  'provider-card-header flex cursor-pointer items-center justify-between p-[var(--an-spacing-xxl)] transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)]';
const providerContentClass =
  `provider-card-content agent-elements-tool-card-bordered border-t border-[var(--an-border-color)] bg-[var(--an-background)] ${cardPaddingClass} ${cardInsetClass}`;
const sectionDividerClass =
  'config-section border-b border-[var(--an-border-color)] py-[var(--an-spacing-xl)] last:border-b-0';
const statusPillClass =
  'agent-elements-status-pill rounded-[var(--an-small-border-radius)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)] text-[11px] font-medium';
const selectClass =
  'rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-sm text-[var(--an-input-color)] outline-none transition-[background-color,border-color,color] duration-150 ease-out focus:border-[var(--an-input-focus-border)] focus:ring-2 focus:ring-[var(--an-focus-ring)]';
const labelTextClass = 'text-[13px] text-[var(--an-foreground)]';

export function ProjectAIProvidersPanel({ workspacePath, workspaceName }: ProjectAIProvidersPanelProps) {
  const [globalSettings, setGlobalSettings] = useState<Record<string, GlobalProviderSettings>>({});
  const [globalApiKeys, setGlobalApiKeys] = useState<Record<string, string>>({});
  const [projectOverrides, setProjectOverrides] = useState<AIProviderOverrides>({});
  const [availableModels, setAvailableModels] = useState<Record<string, Model[]>>({});
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [trackerAutomationOverride, setTrackerAutomationOverride] = useState<TrackerAutomationOverride | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [workspacePath]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Load global settings
      const globalResult = await window.electronAPI.aiGetSettings();
      if (globalResult.providerSettings) {
        setGlobalSettings(globalResult.providerSettings);
      }
      if (globalResult.apiKeys) {
        setGlobalApiKeys(globalResult.apiKeys);
      }

      // Load project overrides
      const projectResult = await window.electronAPI.invoke('ai:getProjectSettings', workspacePath);
      if (projectResult.success && projectResult.overrides) {
        setProjectOverrides(projectResult.overrides);
      } else {
        setProjectOverrides({});
      }

      // Load tracker automation override
      try {
        const trackerResult = await window.electronAPI.invoke('ai:getProjectTrackerAutomation', workspacePath);
        if (trackerResult.success) {
          setTrackerAutomationOverride(trackerResult.override);
        }
      } catch (err) {
        console.error('Failed to load tracker automation override:', err);
      }

      // Load available models
      try {
        const modelsResult = await window.electronAPI.aiGetAllModels();
        if (modelsResult.success && modelsResult.grouped) {
          setAvailableModels(modelsResult.grouped);
        }
      } catch (err) {
        console.error('Failed to load models:', err);
      }
    } catch (error) {
      console.error('Failed to load AI provider settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.electronAPI.invoke('ai:saveProjectSettings', workspacePath, projectOverrides);
      await window.electronAPI.invoke('ai:saveProjectTrackerAutomation', workspacePath, trackerAutomationOverride);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save project AI settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const isOverriding = (providerId: string): boolean => {
    return projectOverrides.providers?.[providerId] !== undefined;
  };

  const getOverride = (providerId: string): ProviderOverride | undefined => {
    return projectOverrides.providers?.[providerId];
  };

  const getEffectiveEnabled = (providerId: string): boolean => {
    const override = getOverride(providerId);
    if (override?.enabled !== undefined) {
      return override.enabled;
    }
    return globalSettings[providerId]?.enabled ?? false;
  };

  const getEffectiveApiKey = (providerId: string, apiKeyField?: string): string => {
    const override = getOverride(providerId);
    if (override?.apiKey) {
      return override.apiKey;
    }
    return apiKeyField ? (globalApiKeys[apiKeyField] || '') : '';
  };

  const getEffectiveModels = (providerId: string): string[] => {
    const override = getOverride(providerId);
    if (override?.models) {
      return override.models;
    }
    return globalSettings[providerId]?.models || [];
  };

  const handleOverrideToggle = (providerId: string, override: boolean) => {
    setProjectOverrides(prev => {
      const newOverrides = { ...prev };
      if (!newOverrides.providers) {
        newOverrides.providers = {};
      }

      if (override) {
        // Initialize override with current global values
        const globalProvider = globalSettings[providerId] || {};
        newOverrides.providers[providerId] = {
          enabled: globalProvider.enabled ?? false,
          models: globalProvider.models ? [...globalProvider.models] : [],
          apiKey: '', // Don't copy global API key, let user enter project-specific one
        };
      } else {
        // Remove override
        delete newOverrides.providers[providerId];
        if (Object.keys(newOverrides.providers).length === 0) {
          delete newOverrides.providers;
        }
      }

      return newOverrides;
    });
    setHasChanges(true);
  };

  const handleEnabledChange = (providerId: string, enabled: boolean) => {
    setProjectOverrides(prev => {
      const newOverrides = { ...prev };
      if (!newOverrides.providers) newOverrides.providers = {};
      if (!newOverrides.providers[providerId]) newOverrides.providers[providerId] = {};
      newOverrides.providers[providerId].enabled = enabled;
      return newOverrides;
    });
    setHasChanges(true);
  };

  const handleApiKeyChange = (providerId: string, apiKey: string) => {
    setProjectOverrides(prev => {
      const newOverrides = { ...prev };
      if (!newOverrides.providers) newOverrides.providers = {};
      if (!newOverrides.providers[providerId]) newOverrides.providers[providerId] = {};
      newOverrides.providers[providerId].apiKey = apiKey;
      return newOverrides;
    });
    setHasChanges(true);
  };

  const handleModelToggle = (providerId: string, modelId: string, enabled: boolean) => {
    setProjectOverrides(prev => {
      const newOverrides = { ...prev };
      if (!newOverrides.providers) newOverrides.providers = {};
      if (!newOverrides.providers[providerId]) newOverrides.providers[providerId] = {};

      const currentModels = newOverrides.providers[providerId].models || [];
      if (enabled) {
        newOverrides.providers[providerId].models = [...currentModels, modelId];
      } else {
        newOverrides.providers[providerId].models = currentModels.filter(m => m !== modelId);
      }
      return newOverrides;
    });
    setHasChanges(true);
  };

  const handleSelectAllModels = (providerId: string, selectAll: boolean) => {
    const models = availableModels[providerId] || [];
    setProjectOverrides(prev => {
      const newOverrides = { ...prev };
      if (!newOverrides.providers) newOverrides.providers = {};
      if (!newOverrides.providers[providerId]) newOverrides.providers[providerId] = {};
      newOverrides.providers[providerId].models = selectAll ? models.map(m => m.id) : [];
      return newOverrides;
    });
    setHasChanges(true);
  };

  const hasAnyOverrides = () => {
    return (projectOverrides.providers && Object.keys(projectOverrides.providers).length > 0) ||
           projectOverrides.defaultProvider !== undefined;
  };

  if (loading) {
    return (
      <div
        className={panelClass}
        data-testid="agent-elements-project-ai-providers-panel"
        data-agent-elements-shell="project-ai-providers-panel"
        data-workspace-bound={String(Boolean(workspacePath))}
        data-state="loading"
      >
        <div className={`${chrome.configCard} flex h-[200px] items-center justify-center text-[var(--an-foreground-muted)]`}>
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div
      className={panelClass}
      data-testid="agent-elements-project-ai-providers-panel"
      data-agent-elements-shell="project-ai-providers-panel"
      data-workspace-bound={String(Boolean(workspacePath))}
      data-state={hasAnyOverrides() ? 'customized' : 'inherited'}
    >
      <div
        className={chrome.header}
        data-testid="agent-elements-project-ai-providers-header"
        data-agent-elements-shell="project-ai-providers-header"
      >
        <h2 className={chrome.title}>AI Providers</h2>
        <p className={chrome.description}>
          Override AI provider settings for <strong className="font-medium text-[var(--an-foreground)]">{workspaceName}</strong>.
          Enable overrides to use different API keys or models for this project.
        </p>
      </div>

      <div className="panel-content flex-1 overflow-y-auto">
        <div
          className="providers-list flex flex-col gap-[var(--an-spacing-lg)]"
          data-testid="agent-elements-project-ai-providers-list"
          data-agent-elements-shell="project-ai-providers-list"
        >
          {PROVIDERS.map(provider => {
            const globalEnabled = globalSettings[provider.id]?.enabled ?? false;
            const overriding = isOverriding(provider.id);
            const effectiveEnabled = getEffectiveEnabled(provider.id);
            const isExpanded = expandedProvider === provider.id;
            const override = getOverride(provider.id);
            const models = availableModels[provider.id] || [];
            const selectedModels = getEffectiveModels(provider.id);

            return (
              <div
                key={provider.id}
                className={`${providerCardClass} ${overriding ? 'border-[var(--an-primary-color)] bg-[color-mix(in_srgb,var(--an-primary-color)_7%,var(--an-background))]' : 'border-[var(--an-border-color)] bg-[var(--an-background-secondary)]'}`}
                data-testid={`agent-elements-project-ai-provider-${provider.id}`}
                data-agent-elements-shell="project-ai-provider-card"
                data-provider-id={provider.id}
                data-override-active={String(overriding)}
                data-global-enabled={String(globalEnabled)}
                data-effective-enabled={String(effectiveEnabled)}
                data-state={isExpanded ? 'expanded' : 'collapsed'}
              >
                {/* Provider Header - Always Visible */}
                <div
                  className={providerHeaderClass}
                  data-testid={`agent-elements-project-ai-provider-header-${provider.id}`}
                  data-agent-elements-shell="project-ai-provider-header"
                  onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                >
                  <div className="provider-info flex items-center gap-[var(--an-spacing-lg)]">
                    <span className="provider-icon flex h-10 w-10 items-center justify-center rounded-[var(--an-small-border-radius)] bg-[var(--an-background-tertiary)]">
                      {getProviderIcon(provider.id as any, { size: 24 })}
                    </span>
                    <div className="provider-details flex flex-col gap-0.5">
                      <span className="provider-name text-sm font-medium text-[var(--an-foreground)]">{provider.name}</span>
                      <span className="provider-subtitle text-xs text-[var(--an-foreground-subtle)]">{provider.subtitle}</span>
                    </div>
                  </div>

                  <div className="provider-status flex items-center gap-[var(--an-spacing-md)]">
                    <span className={`global-status ${statusPillClass} ${globalEnabled ? 'bg-[color-mix(in_srgb,var(--an-success-color)_12%,transparent)] text-[var(--an-success-color)]' : 'bg-[var(--an-background-tertiary)] text-[var(--an-foreground-subtle)]'}`}>
                      Global: {globalEnabled ? 'On' : 'Off'}
                    </span>
                    {overriding && (
                      <span className={`${statusPillClass} override-badge bg-[color-mix(in_srgb,var(--an-primary-color)_12%,transparent)] text-[var(--an-primary-color)]`}>Overridden</span>
                    )}
                    <span className={`effective-status ${statusPillClass} font-semibold ${effectiveEnabled ? 'bg-[color-mix(in_srgb,var(--an-success-color)_18%,var(--an-background))] text-[var(--an-success-color)]' : 'bg-[var(--an-background-tertiary)] text-[var(--an-foreground-subtle)]'}`}>
                      {effectiveEnabled ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`expand-icon text-[var(--an-foreground-subtle)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      <MaterialSymbol icon="expand_more" size={16} />
                    </span>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div
                    className={providerContentClass}
                    data-testid={`agent-elements-project-ai-provider-content-${provider.id}`}
                    data-agent-elements-shell="project-ai-provider-content"
                  >
                    {/* Override Toggle */}
                    <div className={sectionDividerClass}>
                      <label className="override-toggle flex cursor-pointer items-center gap-[var(--an-spacing-lg)]">
                        <ToggleSwitch
                          checked={overriding}
                          onChange={(checked) => handleOverrideToggle(provider.id, checked)}
                          ariaLabel={`Project override for ${provider.name}`}
                        />
                        <span className="toggle-label text-[13px] text-[var(--an-foreground-muted)]">
                          {overriding ? 'Override enabled - using project settings' : 'Using global settings'}
                        </span>
                      </label>
                    </div>

                    {overriding && (
                      <>
                        {/* Enable Toggle */}
                        <div className={sectionDividerClass}>
                          <div className="config-row flex items-center justify-between">
                            <span className={`config-label ${labelTextClass}`}>Enable for this project</span>
                            <ToggleSwitch
                              checked={override?.enabled ?? false}
                              onChange={(checked) => handleEnabledChange(provider.id, checked)}
                              ariaLabel={`Enable ${provider.name} for this project`}
                            />
                          </div>
                        </div>

                        {/* API Key (if applicable) */}
                        {provider.apiKeyField && (
                          <div className={sectionDividerClass}>
                            <h4 className="config-section-title m-0 mb-[var(--an-spacing-lg)] text-sm font-medium text-[var(--an-foreground)]">API Key</h4>
                            <div className="api-key-info mb-[var(--an-spacing-sm)]">
                              <span className="api-key-hint text-xs text-[var(--an-foreground-subtle)]">
                                {globalApiKeys[provider.apiKeyField]
                                  ? 'Leave empty to use global key, or enter a project-specific key'
                                  : 'Enter an API key for this project'}
                              </span>
                            </div>
                            <input
                              type="password"
                              className={`${chrome.input} api-key-input text-[13px]`}
                              data-testid={`agent-elements-project-ai-provider-api-key-${provider.id}`}
                              aria-label={`${provider.name} project API key`}
                              placeholder={globalApiKeys[provider.apiKeyField] ? 'Using global key...' : 'Enter API key...'}
                              value={override?.apiKey || ''}
                              onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                            />
                          </div>
                        )}

                        {/* Models Selection */}
                        {models.length > 0 && (
                          <div className={sectionDividerClass}>
                            <div className="config-section-header mb-[var(--an-spacing-lg)] flex items-center justify-between">
                              <h4 className="config-section-title m-0 text-sm font-medium text-[var(--an-foreground)]">Models</h4>
                              <div className="models-actions flex gap-[var(--an-spacing-sm)]">
                                <button
                                  className={`${chrome.modelActionButton} models-action-btn`}
                                  onClick={() => handleSelectAllModels(provider.id, true)}
                                >
                                  All
                                </button>
                                <button
                                  className={`${chrome.modelActionButton} models-action-btn`}
                                  onClick={() => handleSelectAllModels(provider.id, false)}
                                >
                                  None
                                </button>
                              </div>
                            </div>
                            <div className="models-grid grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                              {models.map(model => {
                                const isSelected = selectedModels.includes(model.id);
                                return (
                                  <label
                                    key={model.id}
                                    className={`model-item flex cursor-pointer items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-small-border-radius)] border px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] transition-[background-color,border-color,color] duration-150 ease-out ${isSelected ? 'border-[var(--an-primary-color)] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))]' : 'border-[var(--an-border-color)] bg-[var(--an-background-secondary)] hover:border-[var(--an-border-color-strong)]'}`}
                                    data-agent-elements-shell="project-ai-provider-model-row"
                                    data-provider-id={provider.id}
                                    data-model-id={model.id}
                                    data-selected={String(isSelected)}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => handleModelToggle(provider.id, model.id, e.target.checked)}
                                      className={chrome.checkbox}
                                    />
                                    <span className="model-name text-[13px] text-[var(--an-foreground)]">{model.name || model.id}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {!overriding && (
                      <div className="no-override-message py-4 text-center">
                        <p className="m-0 text-[13px] text-[var(--an-foreground-muted)]">This project uses global settings for {provider.name}.</p>
                        <p className="hint mt-[var(--an-spacing-xs)] text-xs text-[var(--an-foreground-subtle)]">Enable override to customize API key or models for this project.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasAnyOverrides() && (
          <div
            className={`overrides-summary agent-elements-tool-card mt-[var(--an-spacing-xl)] flex !flex-row items-center gap-[var(--an-spacing-sm)] border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] text-[13px] text-[var(--an-primary-color)] ${cardPaddingClass}`}
            data-testid="agent-elements-project-ai-providers-summary"
            data-agent-elements-shell="project-ai-providers-summary"
          >
            <MaterialSymbol icon="info" size={16} className="shrink-0" />
            <span>This project has custom AI provider settings</span>
          </div>
        )}
      </div>

      {/* Tracker Automation Override */}
      <div
        className={`${chrome.section} tracker-automation-override`}
        data-testid="agent-elements-project-ai-tracker-automation"
        data-agent-elements-shell="project-ai-tracker-automation"
      >
        <h3 className={chrome.sectionTitle}>Tracker Automation</h3>
        <div className="mb-[var(--an-spacing-sm)] flex items-center gap-[var(--an-spacing-lg)]">
          <select
            className={selectClass}
            value={trackerAutomationOverride === null ? 'inherit' : trackerAutomationOverride?.enabled ? 'enable' : 'disable'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'inherit') {
                setTrackerAutomationOverride(null);
              } else {
                setTrackerAutomationOverride({ enabled: val === 'enable' });
              }
              setHasChanges(true);
            }}
          >
            <option value="inherit">Inherit from global settings</option>
            <option value="enable">Enable for this project</option>
            <option value="disable">Disable for this project</option>
          </select>
        </div>
        <p className="m-0 text-xs text-[var(--an-foreground-subtle)]">
          Override the global tracker automation setting for this workspace.
        </p>
      </div>

      <div
        className="panel-footer flex justify-end border-t border-[var(--an-border-color)] pt-[var(--an-spacing-xl)]"
        data-testid="agent-elements-project-ai-providers-footer"
        data-agent-elements-shell="project-ai-providers-footer"
      >
        <button
          className={`${chrome.primaryButton} save-button px-[var(--an-spacing-xxl)] py-[var(--an-spacing-md)] text-[13px]`}
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
        </button>
      </div>
    </div>
  );
}
