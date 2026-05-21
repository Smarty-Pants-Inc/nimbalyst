import React from 'react';
import { ProviderConfig } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';

interface DeepAgentsPanelProps {
  config: ProviderConfig;
  apiKeys: Record<string, string>;
  onToggle: (enabled: boolean) => void;
  onApiKeyChange: (key: string, value: string) => void;
  onConfigChange: (updates: Partial<ProviderConfig>) => void;
}

export function DeepAgentsPanel({
  config,
  apiKeys,
  onToggle,
  onApiKeyChange,
  onConfigChange,
}: DeepAgentsPanelProps) {
  return (
    <div className="provider-panel flex flex-col">
      <div className="provider-panel-header mb-6 pb-4 border-b border-[var(--nim-border)]">
        <h3 className="provider-panel-title text-xl font-semibold leading-tight mb-2 text-[var(--nim-text)]">DeepAgents</h3>
        <p className="provider-panel-description text-sm leading-relaxed text-[var(--nim-text-muted)]">
          DeepAgents over ACP with CLIProxyAPI model routing.
        </p>
      </div>

      <SettingsToggle
        variant="enable"
        name="Enable DeepAgents"
        checked={config.enabled || false}
        onChange={onToggle}
      />

      {config.enabled && (
        <div className="provider-panel-section py-4 mb-4 border-b border-[var(--nim-border)] last:border-b-0 last:mb-0 last:pb-0">
          <label className="provider-input-label block text-sm font-medium mb-2 text-[var(--nim-text)]">
            CLIProxyAPI URL
          </label>
          <input
            type="text"
            value={config.baseUrl || 'http://127.0.0.1:8317/v1'}
            onChange={(event) => onConfigChange({ baseUrl: event.target.value })}
            className="provider-input w-full px-3 py-2 rounded-md border border-[var(--nim-border)] bg-[var(--nim-bg)] text-[var(--nim-text)] text-sm focus:outline-none focus:border-[var(--nim-primary)]"
            data-testid="deepagents-base-url"
          />

          <label className="provider-input-label block text-sm font-medium mt-4 mb-2 text-[var(--nim-text)]">
            Bearer Token
          </label>
          <input
            type="password"
            value={apiKeys['deepagents-acp'] || ''}
            onChange={(event) => onApiKeyChange('deepagents-acp', event.target.value)}
            className="provider-input w-full px-3 py-2 rounded-md border border-[var(--nim-border)] bg-[var(--nim-bg)] text-[var(--nim-text)] text-sm focus:outline-none focus:border-[var(--nim-primary)]"
            data-testid="deepagents-token"
          />
        </div>
      )}
    </div>
  );
}
