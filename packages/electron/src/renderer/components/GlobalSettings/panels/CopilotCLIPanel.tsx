import React, { useState, useEffect, useCallback } from 'react';
import { ProviderConfig } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';
import { AlphaBadge, SETTINGS_ALPHA_TOOLTIP } from '../../common/AlphaBadge';

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
        className="provider-panel-header copilot-cli-panel-header agent-elements-settings-panel-header mb-6 pb-4 border-b border-[var(--nim-border)]"
        data-agent-elements-shell="copilot-cli-header"
        data-testid="agent-elements-copilot-cli-header"
      >
        <h3 className="provider-panel-title text-xl font-semibold leading-tight mb-2 text-[var(--nim-text)] flex items-center gap-2">
          GitHub Copilot
          <AlphaBadge size="sm" tooltip={SETTINGS_ALPHA_TOOLTIP} />
        </h3>
        <p className="provider-panel-description text-sm leading-relaxed text-[var(--nim-text-muted)]">
          GitHub Copilot coding agent via the ACP (Agent Communication Protocol) server mode.
          Uses your existing Copilot CLI login for authentication.
        </p>
      </div>

      <div
        className="provider-panel-section copilot-cli-panel-section agent-elements-settings-section py-4 mb-4 border-b border-[var(--nim-border)]"
        data-agent-elements-shell="copilot-cli-section"
        data-section="cli-installation"
        data-testid="agent-elements-copilot-cli-cli-section"
      >
        <h4 className="provider-panel-section-title text-base font-semibold mb-3 text-[var(--nim-text)]">Copilot CLI</h4>

        {cliStatus === 'checking' && (
          <p
            className="copilot-cli-checking text-[13px] text-[var(--nim-text-muted)]"
            data-agent-elements-shell="copilot-cli-checking"
            data-testid="agent-elements-copilot-cli-checking"
          >
            Checking for Copilot CLI...
          </p>
        )}

        {cliStatus === 'installed' && (
          <div
            className="copilot-cli-installed agent-elements-tool-card flex items-center gap-2 rounded-md border border-[var(--nim-border)] bg-[var(--nim-bg-secondary)] p-3"
            data-agent-elements-shell="copilot-cli-installed"
            data-testid="agent-elements-copilot-cli-installed"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--nim-success)] shrink-0" />
            <span className="text-[13px] text-[var(--nim-text)]">
              Installed{cliVersion ? ` (${cliVersion})` : ''}
            </span>
          </div>
        )}

        {(cliStatus === 'not-installed' || cliStatus === 'install-error') && (
          <div
            className="copilot-cli-install-card agent-elements-tool-card rounded-lg border border-[var(--nim-border)] bg-[var(--nim-bg-secondary)] p-3"
            data-agent-elements-shell="copilot-cli-install-card"
            data-testid="agent-elements-copilot-cli-install-card"
          >
            <p className="text-[13px] text-[var(--nim-text-muted)] mb-3 leading-relaxed">
              The GitHub Copilot CLI is required to run the agent. Install it with:
            </p>
            <code
              className="copilot-cli-install-command block text-[13px] text-[var(--nim-code-text)] bg-[var(--nim-code-bg)] px-3 py-2 rounded mb-3 select-text"
              data-agent-elements-shell="copilot-cli-install-command"
              data-testid="agent-elements-copilot-cli-install-command"
            >
              npm install -g @github/copilot
            </code>
            <button
              className="inline-flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium cursor-pointer transition-all bg-[var(--nim-primary)] text-white border border-[var(--nim-primary)] hover:opacity-90"
              onClick={handleInstall}
              data-testid="agent-elements-copilot-cli-install-button"
            >
              Install Copilot CLI
            </button>
            {installError && (
              <div
                className="copilot-cli-install-error text-xs mt-2 text-[var(--nim-error)]"
                data-agent-elements-shell="copilot-cli-install-error"
                data-testid="agent-elements-copilot-cli-install-error"
              >
                {installError}
                <p className="mt-1 text-[var(--nim-text-muted)]">
                  Try running manually: <code className="text-[var(--nim-code-text)] bg-[var(--nim-code-bg)] px-1 rounded">npm install -g @github/copilot</code>
                </p>
              </div>
            )}
          </div>
        )}

        {cliStatus === 'installing' && (
          <div
            className="copilot-cli-installing agent-elements-tool-card flex items-center gap-2 rounded-md border border-[var(--nim-border)] bg-[var(--nim-bg-secondary)] p-3"
            data-agent-elements-shell="copilot-cli-installing"
            data-testid="agent-elements-copilot-cli-installing"
          >
            <span className="text-[13px] text-[var(--nim-text-muted)]">Installing Copilot CLI...</span>
          </div>
        )}

        <p
          className="copilot-cli-docs text-[13px] text-[var(--nim-text-muted)] mt-3 leading-relaxed"
          data-agent-elements-shell="copilot-cli-docs"
          data-testid="agent-elements-copilot-cli-docs"
        >
          See the{' '}
          <a
            href="https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--nim-primary)] hover:underline"
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
          className="provider-panel-section copilot-cli-panel-section agent-elements-settings-section py-4 mb-4 border-b border-[var(--nim-border)] last:border-b-0 last:mb-0 last:pb-0"
          data-agent-elements-shell="copilot-cli-auth-section"
          data-section="authentication"
          data-testid="agent-elements-copilot-cli-auth-section"
        >
          <h4 className="provider-panel-section-title text-base font-semibold mb-3 text-[var(--nim-text)]">Authentication</h4>
          <div
            className="cli-config-section copilot-cli-auth-card agent-elements-tool-card rounded-lg border border-[var(--nim-border)] bg-[var(--nim-bg-secondary)] p-3"
            data-agent-elements-shell="copilot-cli-auth-card"
            data-testid="agent-elements-copilot-cli-auth-card"
          >
            <p className="text-[13px] text-[var(--nim-text-muted)] mb-3">
              GitHub Copilot uses your existing login for authentication. Run{' '}
              <code className="text-[var(--nim-code-text)] bg-[var(--nim-code-bg)] px-1 rounded">copilot</code>{' '}
              and use the <code className="text-[var(--nim-code-text)] bg-[var(--nim-code-bg)] px-1 rounded">/login</code>{' '}
              command to authenticate.
            </p>
            <p className="text-[13px] text-[var(--nim-text-muted)]">
              Model selection is managed by Copilot. No additional API key is required.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
