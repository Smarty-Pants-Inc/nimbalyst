import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProviderConfig } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';
import { AlphaBadge, SETTINGS_ALPHA_TOOLTIP } from '../../common/AlphaBadge';
import { OPENCODE_PRESET_MODELS } from '@nimbalyst/runtime/ai/modelConstants';
import type { OpenCodeFileConfig } from '@nimbalyst/runtime/ai/server';
import { createProviderPanelChrome, getProviderTestButtonClass } from './providerPanelChrome';

interface OpenCodePanelProps {
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

type CLIStatus = 'checking' | 'installed' | 'not-installed' | 'installing' | 'install-error';
type LMStudioStatus = 'idle' | 'configuring' | 'success' | 'error';

interface OpenCodeConfigReadResponse {
  success: boolean;
  config?: OpenCodeFileConfig | null;
  configPath?: string;
  error?: string;
}

interface OpenCodeConfigMergeResponse {
  success: boolean;
  config?: OpenCodeFileConfig;
  error?: string;
}

interface OpenCodeLMStudioResponse {
  success: boolean;
  config?: OpenCodeFileConfig;
  modelIds?: string[];
  error?: string;
}

interface ModelOption {
  id: string;
  label: string;
  group: 'preset' | 'lmstudio' | 'custom';
}

function buildModelOptions(config: OpenCodeFileConfig | null): ModelOption[] {
  const presetIds = new Set<string>();
  const presets: ModelOption[] = OPENCODE_PRESET_MODELS.map((m) => {
    const id = `${m.providerID}/${m.modelID}`;
    presetIds.add(id);
    return { id, label: m.name, group: 'preset' };
  });

  const extras: ModelOption[] = [];
  const providers = config?.provider ?? {};
  for (const [providerID, entry] of Object.entries(providers)) {
    const models = entry.models ?? {};
    const providerLabel = entry.name || providerID;
    for (const [modelID, modelEntry] of Object.entries(models)) {
      const id = `${providerID}/${modelID}`;
      if (presetIds.has(id)) continue;
      const baseLabel = modelEntry?.name || modelID;
      extras.push({
        id,
        label: `${baseLabel} (${providerLabel})`,
        group: providerID === 'lmstudio' ? 'lmstudio' : 'custom',
      });
    }
  }

  return [...presets, ...extras];
}

const chrome = createProviderPanelChrome({
  headerClassName: 'provider-panel-header opencode-panel-header',
  sectionClassName: 'provider-panel-section opencode-section',
  configCardClassName: 'opencode-card',
  inputClassName: 'opencode-input',
  loadingClassName: 'opencode-loading',
  modelRowClassName: 'opencode-model-row',
  testButtonClassName: 'test-button opencode-test-button',
  testErrorClassName: 'test-error opencode-test-error',
  emptyClassName: 'opencode-empty',
});

const statusCardClass = `${chrome.configCard} text-[13px] text-[var(--an-foreground-muted)]`;
const promptTextClass = 'mb-[var(--an-spacing-lg)] text-[13px] leading-relaxed text-[var(--an-foreground-muted)]';
const subtleTextClass = 'text-xs leading-relaxed text-[var(--an-foreground-muted)]';
const inlineCodeClass =
  'rounded-[var(--an-radius-xs)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xs)] py-[var(--an-spacing-xxs)] text-xs text-[var(--an-code-color)]';
const linkClass =
  'text-[var(--an-primary-color)] underline-offset-2 hover:underline';
const selectClass =
  'w-full rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-sm text-[var(--an-input-color)] outline-none transition-[background-color,border-color,color] duration-150 ease-out focus:border-[var(--an-input-focus-border)] focus:ring-2 focus:ring-[var(--an-focus-ring)]';
const formRowClass = 'mb-[var(--an-spacing-md)] flex flex-wrap items-center gap-[var(--an-spacing-sm)]';
const successDotClass = 'h-2 w-2 shrink-0 rounded-full bg-[var(--an-success-color)]';
const cardRowClass = 'flex items-center gap-[var(--an-spacing-sm)]';
const successTextClass = 'text-[13px] text-[var(--an-foreground)]';
const messageTextClass = (status: LMStudioStatus) =>
  `opencode-lmstudio-message mt-[var(--an-spacing-sm)] text-xs ${
    status === 'error' ? 'text-[var(--an-error-color)]' : 'text-[var(--an-foreground-muted)]'
  }`;

export function OpenCodePanel({
  config,
  apiKeys,
  onToggle,
  onApiKeyChange,
  onTestConnection,
}: OpenCodePanelProps) {
  const [cliStatus, setCLIStatus] = useState<CLIStatus>('checking');
  const [cliVersion, setCLIVersion] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  const [openCodeConfig, setOpenCodeConfig] = useState<OpenCodeFileConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [lmStudioStatus, setLmStudioStatus] = useState<LMStudioStatus>('idle');
  const [lmStudioMessage, setLmStudioMessage] = useState<string | null>(null);

  const existingBridgeBaseUrl = openCodeConfig?.provider?.lmstudio?.options?.baseURL as string | undefined;

  // The LM Studio bridge URL field. Default to LM Studio's standard local port;
  // if opencode.json already contains a bridge entry we seed from that exactly
  // once via the ref guard so an async config load doesn't cause a render loop.
  const [lmStudioBaseUrl, setLmStudioBaseUrl] = useState<string>('http://127.0.0.1:1234');
  const seededFromConfig = useRef(false);
  useEffect(() => {
    if (seededFromConfig.current) return;
    if (existingBridgeBaseUrl) {
      setLmStudioBaseUrl(existingBridgeBaseUrl.replace(/\/v\d+\/?$/, ''));
      seededFromConfig.current = true;
    }
  }, [existingBridgeBaseUrl]);

  const checkCLI = useCallback(async () => {
    setCLIStatus('checking');
    try {
      const result = await window.electronAPI.invoke('cli:checkInstallation', 'opencode');
      if (result?.installed) {
        setCLIVersion(result.version || null);
        setCLIStatus('installed');
      } else {
        setCLIStatus('not-installed');
      }
    } catch {
      setCLIStatus('not-installed');
    }
  }, []);

  const refreshOpenCodeConfig = useCallback(async () => {
    try {
      const response = await window.electronAPI.invoke('opencode-config:read') as OpenCodeConfigReadResponse;
      if (response.success) {
        setOpenCodeConfig(response.config ?? null);
        setConfigError(null);
      } else {
        setConfigError(response.error ?? 'Failed to read OpenCode config');
      }
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    checkCLI();
    refreshOpenCodeConfig();
  }, [checkCLI, refreshOpenCodeConfig]);

  const handleInstall = async () => {
    setCLIStatus('installing');
    setInstallError(null);
    try {
      await window.electronAPI.invoke('cli:install', 'opencode', {});
      await checkCLI();
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
      setCLIStatus('install-error');
    }
  };

  const persistConfigPatch = async (patch: Partial<OpenCodeFileConfig>): Promise<boolean> => {
    try {
      const response = await window.electronAPI.invoke('opencode-config:merge', patch) as OpenCodeConfigMergeResponse;
      if (response.success && response.config) {
        setOpenCodeConfig(response.config);
        setConfigError(null);
        return true;
      }
      setConfigError(response.error ?? 'Failed to update OpenCode config');
      return false;
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleModelChange = async (modelId: string) => {
    if (!modelId) {
      await persistConfigPatch({ model: null as unknown as string });
      return;
    }
    await persistConfigPatch({ model: modelId });
  };

  const handleAutoUpdateToggle = async (enabled: boolean) => {
    // OpenCode's `autoupdate` is true by default. Only write the field when
    // the user opts out -- a missing field means "default behavior".
    await persistConfigPatch({ autoupdate: enabled });
  };

  const handleConnectLMStudio = async () => {
    setLmStudioStatus('configuring');
    setLmStudioMessage(null);
    try {
      const response = await window.electronAPI.invoke('opencode-config:upsert-lmstudio', {
        baseUrl: lmStudioBaseUrl,
        modelIds: [],
        autoDiscoverModels: true,
        displayName: 'LM Studio (local)',
      }) as OpenCodeLMStudioResponse;
      if (response.success && response.config) {
        setOpenCodeConfig(response.config);
        setLmStudioStatus('success');
        const count = response.modelIds?.length ?? 0;
        setLmStudioMessage(`Configured ${count} ${count === 1 ? 'model' : 'models'} from LM Studio.`);
      } else {
        setLmStudioStatus('error');
        setLmStudioMessage(response.error ?? 'Failed to configure LM Studio bridge');
      }
    } catch (err) {
      setLmStudioStatus('error');
      setLmStudioMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDisconnectLMStudio = async () => {
    setLmStudioStatus('configuring');
    try {
      const response = await window.electronAPI.invoke('opencode-config:remove-lmstudio') as OpenCodeConfigMergeResponse;
      if (response.success) {
        setOpenCodeConfig(response.config ?? null);
        setLmStudioStatus('idle');
        setLmStudioMessage(null);
      } else {
        setLmStudioStatus('error');
        setLmStudioMessage(response.error ?? 'Failed to remove LM Studio bridge');
      }
    } catch (err) {
      setLmStudioStatus('error');
      setLmStudioMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const modelOptions = buildModelOptions(openCodeConfig);
  const selectedModel = openCodeConfig?.model ?? '';
  const lmStudioBridgeConfigured = !!openCodeConfig?.provider?.lmstudio;
  const lmStudioBridgeModelCount = openCodeConfig?.provider?.lmstudio?.models
    ? Object.keys(openCodeConfig.provider.lmstudio.models).length
    : 0;
  const autoUpdateOptedOut = openCodeConfig?.autoupdate === false;

  return (
    <div
      className="provider-panel opencode-panel agent-elements-settings-panel agent-elements-opencode-panel flex flex-col"
      data-agent-elements-shell="opencode-panel"
      data-component="OpenCodePanel"
      data-testid="agent-elements-opencode-panel"
    >
      <div
        className={chrome.header}
        data-testid="agent-elements-opencode-header"
      >
        <h3 className={`${chrome.title} flex items-center gap-[var(--an-spacing-sm)]`}>
          OpenCode
          <AlphaBadge size="sm" tooltip={SETTINGS_ALPHA_TOOLTIP} />
        </h3>
        <p className={chrome.description}>
          Open source coding agent with multi-model support. Works with Claude, OpenAI, Gemini,
          and local models through a unified interface.
        </p>
      </div>

      <div
        className={chrome.section}
        data-section="cli-installation"
        data-testid="agent-elements-opencode-cli-section"
      >
        <h4 className={chrome.sectionTitle}>OpenCode CLI</h4>

        {cliStatus === 'checking' && (
          <p
            className={`opencode-cli-checking ${statusCardClass}`}
            data-testid="agent-elements-opencode-checking"
          >
            Checking for OpenCode CLI...
          </p>
        )}

        {cliStatus === 'installed' && (
          <div
            className={`opencode-installed ${chrome.configCard} ${cardRowClass}`}
            data-testid="agent-elements-opencode-installed"
          >
            <span className={successDotClass} />
            <span className={successTextClass}>
              Installed{cliVersion ? ` (${cliVersion})` : ''}
            </span>
          </div>
        )}

        {(cliStatus === 'not-installed' || cliStatus === 'install-error') && (
          <div
            className={`opencode-install-card ${chrome.configCard}`}
            data-testid="agent-elements-opencode-install-card"
          >
            <p className={promptTextClass}>
              The OpenCode CLI is required to run the agent.
            </p>
            <button
              className={chrome.primaryButton}
              onClick={handleInstall}
              data-testid="agent-elements-opencode-install-button"
            >
              Install OpenCode CLI
            </button>
            {installError && (
              <div
                className="opencode-install-error mt-[var(--an-spacing-sm)] text-xs text-[var(--an-error-color)]"
                data-testid="agent-elements-opencode-install-error"
              >
                {installError}
                <p className="mt-[var(--an-spacing-xs)] text-[var(--an-foreground-muted)]">
                  Try running manually: <code className={inlineCodeClass}>npm i -g opencode-ai</code>
                </p>
              </div>
            )}
          </div>
        )}

        {cliStatus === 'installing' && (
          <div
            className={`opencode-installing ${chrome.configCard} ${cardRowClass}`}
            data-testid="agent-elements-opencode-installing"
          >
            <span className="text-[13px] text-[var(--an-foreground-muted)]">Installing OpenCode CLI...</span>
          </div>
        )}

        <p className="mt-[var(--an-spacing-lg)] text-[13px] leading-relaxed text-[var(--an-foreground-muted)]">
          See the{' '}
          <a
            href="https://github.com/sst/opencode"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            OpenCode documentation
          </a>
          {' '}for more details.
        </p>
      </div>

      <SettingsToggle
        variant="enable"
        name="Enable OpenCode"
        checked={config.enabled || false}
        onChange={onToggle}
        testId="agent-elements-opencode-enable-toggle"
      />

      {config.enabled && (
        <>
          <div
            className={chrome.section}
            data-section="default-model"
            data-testid="agent-elements-opencode-model-section"
          >
            <h4 className={chrome.sectionTitle}>Default model</h4>
            <p className={promptTextClass}>
              Choose which model OpenCode uses by default. This writes the <code className={inlineCodeClass}>model</code> field
              of your <code className={inlineCodeClass}>~/.config/opencode/opencode.json</code>.
            </p>
            <select
              data-testid="opencode-model-select"
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className={selectClass}
            >
              <option value="">OpenCode default</option>
              <optgroup label="Hosted">
                {modelOptions.filter((m) => m.group === 'preset').map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </optgroup>
              {modelOptions.some((m) => m.group === 'lmstudio') && (
                <optgroup label="LM Studio (local)">
                  {modelOptions.filter((m) => m.group === 'lmstudio').map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </optgroup>
              )}
              {modelOptions.some((m) => m.group === 'custom') && (
                <optgroup label="Custom providers">
                  {modelOptions.filter((m) => m.group === 'custom').map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className={`mt-[var(--an-spacing-sm)] ${subtleTextClass}`}>
              Picking a hosted model requires the matching API key to be set up in OpenCode's own config.
            </p>
          </div>

          <div
            className={chrome.section}
            data-section="lmstudio-integration"
            data-testid="agent-elements-opencode-lmstudio-section"
          >
            <h4 className={chrome.sectionTitle}>LM Studio integration</h4>
            <div
              className={`opencode-lmstudio-card ${chrome.configCard}`}
              data-testid="agent-elements-opencode-lmstudio-card"
            >
              <p className={promptTextClass}>
                Point at a running LM Studio server and Nimbalyst will query <code className={inlineCodeClass}>/v1/models</code>,
                then write a <code className={inlineCodeClass}>provider.lmstudio</code> block into your <code className={inlineCodeClass}>opencode.json</code>.
                You don't need to enable LM Studio as a separate Nimbalyst chat provider.
              </p>
              <div className={formRowClass}>
                <input
                  data-testid="opencode-lmstudio-base-url"
                  type="text"
                  value={lmStudioBaseUrl}
                  onChange={(e) => { setLmStudioBaseUrl(e.target.value); seededFromConfig.current = true; }}
                  onFocus={(e) => e.target.select()}
                  placeholder="http://127.0.0.1:1234"
                  className={`${chrome.input} min-w-[220px]`}
                />
                <button
                  data-testid="opencode-lmstudio-connect"
                  className={chrome.primaryButton}
                  onClick={handleConnectLMStudio}
                  disabled={lmStudioStatus === 'configuring' || !lmStudioBaseUrl.trim()}
                >
                  {lmStudioStatus === 'configuring' ? 'Configuring...' : (lmStudioBridgeConfigured ? 'Refresh' : 'Connect')}
                </button>
                {lmStudioBridgeConfigured && (
                  <button
                    data-testid="opencode-lmstudio-disconnect"
                    className={chrome.secondaryButton}
                    onClick={handleDisconnectLMStudio}
                    disabled={lmStudioStatus === 'configuring'}
                  >
                    Remove
                  </button>
                )}
              </div>
              {lmStudioBridgeConfigured && (
                <p className={subtleTextClass}>
                  Bridge active with {lmStudioBridgeModelCount} {lmStudioBridgeModelCount === 1 ? 'model' : 'models'}. Select one above to use it as the default.
                </p>
              )}
              {lmStudioMessage && (
                <div
                  className={messageTextClass(lmStudioStatus)}
                  data-testid="agent-elements-opencode-lmstudio-message"
                >
                  {lmStudioMessage}
                </div>
              )}
            </div>
          </div>

          <div
            className={chrome.section}
            data-section="updates"
            data-testid="agent-elements-opencode-updates-section"
          >
            <h4 className={chrome.sectionTitle}>Updates</h4>
            <SettingsToggle
              variant="enable"
              name="Disable OpenCode auto-update"
              checked={autoUpdateOptedOut}
              onChange={(checked) => handleAutoUpdateToggle(!checked)}
            />
            <p className={`mt-[var(--an-spacing-sm)] ${subtleTextClass}`}>
              When on, OpenCode will not auto-upgrade itself between sessions. Useful if you want
              version stability while debugging.
            </p>
          </div>

          <div
            className={chrome.section}
            data-section="api-configuration"
            data-testid="agent-elements-opencode-api-section"
          >
            <h4 className={chrome.sectionTitle}>API Configuration <span className="text-xs font-normal text-[var(--an-foreground-muted)]">(optional)</span></h4>
            <p className={promptTextClass}>
              OpenCode reads provider API keys from its own config and from environment variables.
              Setting a key here is optional and is only used by Nimbalyst's connection test.
            </p>
            <div className={`api-key-section opencode-api-card ${chrome.configCard}`}>
              <div className="api-key-row flex items-center gap-[var(--an-spacing-sm)]">
                <input
                  type="password"
                  value={apiKeys['opencode'] || ''}
                  onChange={(e) => onApiKeyChange('opencode', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="API key (optional)"
                  className={`api-key-input ${chrome.input}`}
                />
                <button
                  className={getProviderTestButtonClass(config.testStatus, chrome)}
                  onClick={onTestConnection}
                  disabled={config.testStatus === 'testing'}
                >
                  {config.testStatus === 'testing' ? 'Testing...' :
                   config.testStatus === 'success' ? 'Connected' :
                   config.testStatus === 'error' ? 'Failed' : 'Test'}
                </button>
              </div>
              {config.testMessage && config.testStatus === 'error' && (
                <div className={chrome.testError}>{config.testMessage}</div>
              )}
            </div>
          </div>

          {configError && (
            <div
              className="provider-panel-section opencode-config-error py-[var(--an-spacing-sm)] text-xs text-[var(--an-error-color)]"
              data-testid="agent-elements-opencode-config-error"
            >
              {configError}
            </div>
          )}
        </>
      )}
    </div>
  );
}
