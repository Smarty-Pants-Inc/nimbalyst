import React, { useState, useEffect, useCallback } from 'react';
import { ProviderConfig } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';
import { AlphaBadge, SETTINGS_ALPHA_TOOLTIP } from '../../common/AlphaBadge';
import { createProviderPanelChrome } from './providerPanelChrome';

interface CopilotCLIPanelProps {
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

const chrome = createProviderPanelChrome({
  headerClassName: 'provider-panel-header copilot-cli-panel-header',
  sectionClassName: 'provider-panel-section copilot-cli-panel-section',
  configCardClassName: 'copilot-cli-config-card',
  inputClassName: 'copilot-cli-input',
  loadingClassName: 'copilot-cli-loading',
  modelRowClassName: 'copilot-cli-model-row',
  testButtonClassName: 'copilot-cli-action-button',
  testErrorClassName: 'copilot-cli-error',
  emptyClassName: 'copilot-cli-empty',
});

const copilotCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';
const copilotCardClass =
  `agent-elements-tool-card ${copilotCardPaddingClass}`;
const copilotBodyTextClass =
  'text-[13px] leading-relaxed text-[var(--an-foreground-muted)]';
const copilotCodeClass =
  'rounded-[calc(var(--an-tool-border-radius)-6px)] bg-[var(--an-code-background)] px-[var(--an-spacing-xxs)] py-[1px] font-mono text-[var(--an-code-color)]';

export function CopilotCLIPanel({
  config,
  onToggle,
}: CopilotCLIPanelProps) {
  const [cliStatus, setCLIStatus] = useState<CLIStatus>('checking');
  const [cliVersion, setCLIVersion] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  const checkCLI = useCallback(async () => {
    setCLIStatus('checking');
    try {
      const result = await window.electronAPI.invoke('cli:checkInstallation', 'copilot-cli');
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

  useEffect(() => {
    checkCLI();
  }, [checkCLI]);

  const handleInstall = async () => {
    setCLIStatus('installing');
    setInstallError(null);
    try {
      await window.electronAPI.invoke('cli:install', 'copilot-cli', {});
      await checkCLI();
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
      setCLIStatus('install-error');
    }
  };

  return (
    <div
      className="provider-panel copilot-cli-panel agent-elements-settings-panel agent-elements-copilot-cli-panel flex flex-col"
      data-agent-elements-shell="copilot-cli-panel"
      data-component="CopilotCLIPanel"
      data-testid="agent-elements-copilot-cli-panel"
    >
      <div
        className={chrome.header}
        data-agent-elements-shell="copilot-cli-header"
        data-testid="agent-elements-copilot-cli-header"
      >
        <h3 className={`${chrome.title} flex items-center gap-[var(--an-spacing-sm)]`}>
          GitHub Copilot
          <AlphaBadge size="sm" tooltip={SETTINGS_ALPHA_TOOLTIP} />
        </h3>
        <p className={chrome.description}>
          GitHub Copilot coding agent via the ACP (Agent Communication Protocol) server mode.
          Uses your existing Copilot CLI login for authentication.
        </p>
      </div>

      <div
        className={chrome.section}
        data-agent-elements-shell="copilot-cli-section"
        data-section="cli-installation"
        data-testid="agent-elements-copilot-cli-cli-section"
      >
        <h4 className={chrome.sectionTitle}>Copilot CLI</h4>

        {cliStatus === 'checking' && (
          <p
            className={`${chrome.loadingText} copilot-cli-checking`}
            data-agent-elements-shell="copilot-cli-checking"
            data-testid="agent-elements-copilot-cli-checking"
          >
            Checking for Copilot CLI...
          </p>
        )}

        {cliStatus === 'installed' && (
          <div
            className={`copilot-cli-installed ${copilotCardClass} flex-row items-center gap-[var(--an-spacing-sm)] border-[color-mix(in_srgb,var(--an-success-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_8%,var(--an-background))]`}
            data-agent-elements-shell="copilot-cli-installed"
            data-testid="agent-elements-copilot-cli-installed"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--an-success-color)]" />
            <span className="text-[13px] text-[var(--an-foreground)]">
              Installed{cliVersion ? ` (${cliVersion})` : ''}
            </span>
          </div>
        )}

        {(cliStatus === 'not-installed' || cliStatus === 'install-error') && (
          <div
            className={`copilot-cli-install-card ${copilotCardClass}`}
            data-agent-elements-shell="copilot-cli-install-card"
            data-testid="agent-elements-copilot-cli-install-card"
          >
            <p className={`${copilotBodyTextClass} mb-[var(--an-spacing-lg)]`}>
              The GitHub Copilot CLI is required to run the agent. Install it with:
            </p>
            <code
              className="copilot-cli-install-command mb-[var(--an-spacing-lg)] block select-text rounded-[var(--an-input-border-radius)] bg-[var(--an-code-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] font-mono text-[13px] text-[var(--an-code-color)]"
              data-agent-elements-shell="copilot-cli-install-command"
              data-testid="agent-elements-copilot-cli-install-command"
            >
              npm install -g @github/copilot
            </code>
            <button
              className={chrome.primaryButton}
              onClick={handleInstall}
              data-testid="agent-elements-copilot-cli-install-button"
            >
              Install Copilot CLI
            </button>
            {installError && (
              <div
                className="copilot-cli-install-error mt-[var(--an-spacing-sm)] text-xs text-[var(--an-error-color)]"
                data-agent-elements-shell="copilot-cli-install-error"
                data-testid="agent-elements-copilot-cli-install-error"
              >
                {installError}
                <p className="mt-[var(--an-spacing-xxs)] text-[var(--an-foreground-muted)]">
                  Try running manually: <code className={copilotCodeClass}>npm install -g @github/copilot</code>
                </p>
              </div>
            )}
          </div>
        )}

        {cliStatus === 'installing' && (
          <div
            className={`copilot-cli-installing ${copilotCardClass} flex-row items-center gap-[var(--an-spacing-sm)]`}
            data-agent-elements-shell="copilot-cli-installing"
            data-testid="agent-elements-copilot-cli-installing"
          >
            <span className="text-[13px] text-[var(--an-foreground-muted)]">Installing Copilot CLI...</span>
          </div>
        )}

        <p
          className="copilot-cli-docs mt-[var(--an-spacing-lg)] text-[13px] leading-relaxed text-[var(--an-foreground-muted)]"
          data-agent-elements-shell="copilot-cli-docs"
          data-testid="agent-elements-copilot-cli-docs"
        >
          See the{' '}
          <a
            href="https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--an-primary-color)] hover:underline"
          >
            Copilot CLI documentation
          </a>
          {' '}for installation and authentication details.
        </p>
      </div>

      <SettingsToggle
        variant="enable"
        name="Enable GitHub Copilot"
        checked={config.enabled || false}
        onChange={onToggle}
        testId="agent-elements-copilot-cli-enable-toggle"
      />

      {config.enabled && (
        <div
          className={chrome.section}
          data-agent-elements-shell="copilot-cli-auth-section"
          data-section="authentication"
          data-testid="agent-elements-copilot-cli-auth-section"
        >
          <h4 className={chrome.sectionTitle}>Authentication</h4>
          <div
            className={`cli-config-section copilot-cli-auth-card ${copilotCardClass}`}
            data-agent-elements-shell="copilot-cli-auth-card"
            data-testid="agent-elements-copilot-cli-auth-card"
          >
            <p className={`${copilotBodyTextClass} mb-[var(--an-spacing-lg)]`}>
              GitHub Copilot uses your existing login for authentication. Run{' '}
              <code className={copilotCodeClass}>copilot</code>{' '}
              and use the <code className={copilotCodeClass}>/login</code>{' '}
              command to authenticate.
            </p>
            <p className={copilotBodyTextClass}>
              Model selection is managed by Copilot. No additional API key is required.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
