import React, { useCallback, useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ProviderConfig, Model } from '../../Settings/SettingsView';
import { SettingsToggle } from '../SettingsToggle';
import { createProviderPanelChrome } from './providerPanelChrome';
import {
  codexUsageIndicatorEnabledAtom,
  setCodexUsageIndicatorEnabledAtom,
} from '../../../store/atoms/codexUsageAtoms';
import { getProviderConfigAtom, setProviderConfigAtom } from '../../../store/atoms/appSettings';

interface OpenAICodexPanelProps {
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

type AuthMethod = 'chatgpt' | 'api-key';

interface CodexAuthStatus {
  installed: boolean;
  isLoggedIn: boolean;
  authMode: 'apikey' | 'chatgpt' | 'chatgptAuthTokens' | null;
  email: string | null;
  planType: string | null;
  message: string;
  error?: string;
}

const chrome = createProviderPanelChrome({
  headerClassName: 'provider-panel-header openai-codex-panel-header',
  sectionClassName: 'provider-panel-section openai-codex-section',
  configCardClassName: 'openai-codex-auth-card',
  inputClassName: 'api-key-input openai-codex-api-key-input',
  loadingClassName: 'openai-codex-loading',
  modelRowClassName: 'openai-codex-model-row',
  testButtonClassName: 'openai-codex-test-button',
  testErrorClassName: 'openai-codex-test-error',
  emptyClassName: 'openai-codex-empty',
});

const codexCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';
const codexAuthCardClass =
  `agent-elements-tool-card mb-[var(--an-spacing-xl)] ${codexCardPaddingClass}`;
const codexHelpTextClass =
  'text-xs leading-relaxed text-[var(--an-foreground-muted)]';
const codexFinePrintClass =
  'mt-[var(--an-spacing-sm)] text-[11px] leading-relaxed text-[var(--an-foreground-subtle)]';
const codexAuthMethodButtonBaseClass =
  'auth-method-button flex-1 cursor-pointer rounded-[var(--an-input-border-radius)] border px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-[13px] font-medium transition-[background-color,border-color,color,box-shadow] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-focus-ring)]';

function getCodexAuthMethodButtonClass(isSelected: boolean): string {
  return isSelected
    ? `${codexAuthMethodButtonBaseClass} border-[var(--an-primary-color)] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] text-[var(--an-primary-color)] shadow-[inset_0_0_0_1px_var(--an-primary-color)]`
    : `${codexAuthMethodButtonBaseClass} border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground)] hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-secondary)]`;
}

export function OpenAICodexPanel({
  config,
  onToggle,
}: OpenAICodexPanelProps) {
  const usageIndicatorEnabled = useAtomValue(codexUsageIndicatorEnabledAtom);
  const setUsageIndicatorEnabled = useSetAtom(setCodexUsageIndicatorEnabledAtom);

  const acpConfig = useAtomValue(getProviderConfigAtom('openai-codex-acp'));
  const setProviderConfig = useSetAtom(setProviderConfigAtom);
  const acpEnabled = acpConfig?.enabled === true;
  const handleAcpToggle = (enabled: boolean) => {
    setProviderConfig({
      providerId: 'openai-codex-acp',
      config: { enabled },
    });
  };

  const [authStatus, setAuthStatus] = useState<CodexAuthStatus | null>(null);
  const [authBusy, setAuthBusy] = useState<'checking' | 'chatgpt' | 'apikey' | 'logout' | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingApiKey, setPendingApiKey] = useState('');
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<AuthMethod>('chatgpt');

  const checkStatus = useCallback(async () => {
    setAuthBusy('checking');
    setAuthError(null);
    try {
      const result = await window.electronAPI.invoke('openai-codex:check-login') as CodexAuthStatus;
      setAuthStatus(result);
      if (result.error) setAuthError(result.error);
      if (result.authMode === 'apikey') setSelectedAuthMethod('api-key');
      else if (result.authMode === 'chatgpt') setSelectedAuthMethod('chatgpt');
    } catch (err: any) {
      setAuthError(err?.message ?? 'Failed to check Codex auth status');
    } finally {
      setAuthBusy(null);
    }
  }, []);

  useEffect(() => {
    if (!config.enabled) return;
    checkStatus();
    const off = window.electronAPI.on('openai-codex:auth-updated', () => {
      checkStatus();
    });
    return () => {
      if (typeof off === 'function') off();
    };
  }, [config.enabled, checkStatus]);

  const handleChatGptLogin = async () => {
    setAuthBusy('chatgpt');
    setAuthError(null);
    try {
      const result = await window.electronAPI.invoke('openai-codex:login-chatgpt') as { success: boolean; error?: string };
      if (!result.success) {
        setAuthError(result.error ?? 'Login failed');
      }
    } catch (err: any) {
      setAuthError(err?.message ?? 'Login failed');
    } finally {
      setAuthBusy(null);
    }
  };

  const handleApiKeyLogin = async () => {
    if (!pendingApiKey.trim()) {
      setAuthError('Enter an API key first');
      return;
    }
    setAuthBusy('apikey');
    setAuthError(null);
    try {
      const result = await window.electronAPI.invoke('openai-codex:login-apikey', pendingApiKey.trim()) as { success: boolean; error?: string };
      if (!result.success) {
        setAuthError(result.error ?? 'Login failed');
      } else {
        setPendingApiKey('');
        await checkStatus();
      }
    } catch (err: any) {
      setAuthError(err?.message ?? 'Login failed');
    } finally {
      setAuthBusy(null);
    }
  };

  const handleLogout = async () => {
    setAuthBusy('logout');
    setAuthError(null);
    try {
      const result = await window.electronAPI.invoke('openai-codex:logout') as { success: boolean; error?: string };
      if (!result.success) {
        setAuthError(result.error ?? 'Logout failed');
      } else {
        await checkStatus();
      }
    } catch (err: any) {
      setAuthError(err?.message ?? 'Logout failed');
    } finally {
      setAuthBusy(null);
    }
  };

  const isLoggedIn = !!authStatus?.isLoggedIn;
  const planLabel = authStatus?.planType ? ` • ${authStatus.planType}` : '';

  return (
    <div
      className="provider-panel openai-codex-panel agent-elements-settings-panel agent-elements-openai-codex-panel flex flex-col"
      data-agent-elements-shell="openai-codex-panel"
      data-testid="agent-elements-openai-codex-panel"
    >
      <div
        className={chrome.header}
        data-agent-elements-shell="openai-codex-header"
        data-testid="agent-elements-openai-codex-header"
      >
        <h3 className={chrome.title}>OpenAI Codex</h3>
        <p className={chrome.description}>
          Advanced code generation and completion powered by OpenAI Codex models.
          Provides intelligent code suggestions and automated programming assistance.
        </p>
      </div>

      <SettingsToggle
        variant="enable"
        name="Enable OpenAI Codex"
        checked={config.enabled || false}
        onChange={onToggle}
        testId="agent-elements-openai-codex-enable-toggle"
      />

      <SettingsToggle
        variant="enable"
        name="Show Usage Indicator"
        description="Display Codex usage limits in the navigation gutter"
        checked={usageIndicatorEnabled}
        onChange={setUsageIndicatorEnabled}
        testId="agent-elements-openai-codex-usage-toggle"
      />

      {acpEnabled && (
        <div
          className={`${chrome.section} openai-codex-acp-section`}
          data-agent-elements-shell="openai-codex-acp-section"
          data-section="legacy-acp-transport"
          data-testid="agent-elements-openai-codex-acp-section"
        >
          <h4 className={chrome.sectionTitle}>
            ACP Transport <span className="text-xs font-normal text-[var(--an-foreground-muted)]">(legacy)</span>
          </h4>
          <p className="mb-[var(--an-spacing-lg)] text-[13px] leading-relaxed text-[var(--an-foreground-muted)]">
            <strong>OpenAI Codex (ACP)</strong> is already enabled for this installation, but new Codex
            sessions now use the app-server transport through the main <strong>OpenAI Codex</strong> provider.
          </p>
          <SettingsToggle
            variant="enable"
            name="Enable ACP transport"
            description="Keeps the separate 'OpenAI Codex (ACP)' legacy provider available"
            checked={acpEnabled}
            onChange={handleAcpToggle}
            testId="agent-elements-openai-codex-acp-toggle"
          />
        </div>
      )}

      {config.enabled && (
        <div
          data-agent-elements-shell="openai-codex-auth-section"
          data-section="sign-in"
          data-testid="codex-auth-section"
          className={`${chrome.section} codex-auth-section openai-codex-auth-section`}
        >
          <h4 className={chrome.sectionTitle}>Sign In</h4>

          {isLoggedIn ? (
            <div
              className={`status-box-success openai-codex-signed-in-card ${codexAuthCardClass} flex items-center justify-between gap-[var(--an-spacing-lg)] text-[13px] border-[color-mix(in_srgb,var(--an-success-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_8%,var(--an-background))]`}
              data-agent-elements-shell="openai-codex-signed-in-card"
              data-testid="agent-elements-openai-codex-signed-in-card"
            >
              <div className="flex flex-1 items-center gap-[var(--an-spacing-lg)]">
                <span className="status-box-icon shrink-0 text-xl leading-none text-[var(--an-success-color)]">✓</span>
                <div className="status-box-content flex flex-col gap-1 flex-1">
                  <span className="status-box-title text-sm font-semibold text-[var(--an-foreground)]">
                    {authStatus?.authMode === 'chatgpt' ? 'Signed in with ChatGPT' : authStatus?.authMode === 'apikey' ? 'Signed in with API key' : 'Signed in'}
                  </span>
                  {(authStatus?.email || authStatus?.planType) && (
                    <span className="status-box-subtitle text-xs text-[var(--an-foreground-muted)]">
                      {authStatus?.email ?? ''}{planLabel}
                    </span>
                  )}
                </div>
              </div>
              <div className="status-box-actions flex shrink-0 gap-[var(--an-spacing-sm)]">
                <button
                  className={`${chrome.secondaryButton} px-[var(--an-spacing-md)] py-[var(--an-spacing-xs)] text-xs`}
                  onClick={checkStatus}
                  disabled={authBusy !== null}
                >
                  Refresh
                </button>
                <button
                  className={`${chrome.secondaryButton} px-[var(--an-spacing-md)] py-[var(--an-spacing-xs)] text-xs`}
                  onClick={handleLogout}
                  disabled={authBusy !== null}
                  data-testid="codex-logout"
                >
                  {authBusy === 'logout' ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="auth-method-row mb-[var(--an-spacing-xl)] flex gap-[var(--an-spacing-sm)]">
                <button
                  className={getCodexAuthMethodButtonClass(selectedAuthMethod === 'chatgpt')}
                  onClick={() => setSelectedAuthMethod('chatgpt')}
                  data-testid="codex-auth-method-chatgpt"
                >
                  ChatGPT (Recommended)
                </button>
                <button
                  className={getCodexAuthMethodButtonClass(selectedAuthMethod === 'api-key')}
                  onClick={() => setSelectedAuthMethod('api-key')}
                  data-testid="codex-auth-method-apikey"
                >
                  API Key
                </button>
              </div>

              {selectedAuthMethod === 'chatgpt' && (
                <div
                  className={`openai-codex-chatgpt-card ${codexAuthCardClass}`}
                  data-agent-elements-shell="openai-codex-chatgpt-card"
                  data-testid="agent-elements-openai-codex-chatgpt-card"
                >
                  <p className={`${codexHelpTextClass} mb-[var(--an-spacing-lg)]`}>
                    Authenticate with your ChatGPT Pro, Plus, or Team subscription. No API credits needed.
                  </p>
                  <div className="flex gap-[var(--an-spacing-sm)]">
                    <button
                      className={`${chrome.primaryButton} flex-1`}
                      onClick={handleChatGptLogin}
                      disabled={authBusy !== null}
                      data-testid="codex-login-chatgpt"
                    >
                      {authBusy === 'chatgpt' ? 'Opening browser…' : 'Sign in with ChatGPT'}
                    </button>
                    <button
                      className={chrome.secondaryButton}
                      onClick={checkStatus}
                      disabled={authBusy !== null}
                    >
                      Refresh
                    </button>
                  </div>
                  <p className={codexFinePrintClass}>
                    Opens your default browser. Complete the OpenAI sign-in flow; Nimbalyst updates automatically when you return.
                  </p>
                </div>
              )}

              {selectedAuthMethod === 'api-key' && (
                <div
                  className={`openai-codex-apikey-card ${codexAuthCardClass}`}
                  data-agent-elements-shell="openai-codex-apikey-card"
                  data-testid="agent-elements-openai-codex-apikey-card"
                >
                  <p className={`${codexHelpTextClass} mb-[var(--an-spacing-lg)]`}>
                    Use an OpenAI API key. Pay-per-use with API credits — more expensive than the ChatGPT subscription path.
                  </p>
                  <div className="api-key-row flex items-center gap-[var(--an-spacing-sm)]">
                    <input
                      aria-label="OpenAI Codex API key"
                      type="password"
                      value={pendingApiKey}
                      onChange={(e) => setPendingApiKey(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="sk-..."
                      className={chrome.input}
                      data-testid="codex-apikey-input"
                    />
                    <button
                      className={chrome.primaryButton}
                      onClick={handleApiKeyLogin}
                      disabled={authBusy !== null || !pendingApiKey.trim()}
                      data-testid="codex-login-apikey"
                    >
                      {authBusy === 'apikey' ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  <p className={codexFinePrintClass}>
                    Stored by Codex in <code className="rounded-[calc(var(--an-tool-border-radius)-6px)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xxs)] text-[var(--an-foreground-muted)]">~/.codex/auth.json</code>, not in Nimbalyst settings.
                  </p>
                </div>
              )}
            </>
          )}

          {authError && (
            <p
              className={`openai-codex-auth-error agent-elements-tool-card mt-[var(--an-spacing-sm)] text-xs text-[var(--an-error-color)] ${codexCardPaddingClass}`}
              data-agent-elements-shell="openai-codex-auth-error"
              data-testid="codex-auth-error"
            >
              {authError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
