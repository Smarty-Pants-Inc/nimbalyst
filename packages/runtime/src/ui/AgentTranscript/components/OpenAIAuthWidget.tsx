import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AgentStatusPill, AgentToolCard } from '../../AgentElements';
import {
  SPECIAL_STATUS_ACTIONS_CLASS,
  SPECIAL_STATUS_INLINE_PRIMARY_BUTTON_CLASS,
  SPECIAL_STATUS_INLINE_SECONDARY_BUTTON_CLASS,
} from './SpecialStatusWidgetChrome';

const CODEX_DOCS_URL = 'https://developers.openai.com/codex';

interface CodexLoginStatus {
  installed: boolean;
  isLoggedIn: boolean;
  authMethod?: 'chatgpt' | 'api-key' | 'unknown';
  message: string;
  error?: string;
}

export const OpenAIAuthWidget: React.FC = () => {
  const [status, setStatus] = useState<CodexLoginStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleCheckStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      if (!window.electronAPI?.invoke) {
        setStatus({
          installed: false,
          isLoggedIn: false,
          message: 'Cannot access Electron API. Please restart the application.',
          error: 'Cannot access Electron API. Please restart the application.',
        });
        return;
      }

      const result = await window.electronAPI.invoke('openai-codex:check-login');
      setStatus(result);
    } catch (error: any) {
      setStatus({
        installed: false,
        isLoggedIn: false,
        message: 'Failed to check Codex login status.',
        error: error?.message || 'Failed to check Codex login status.',
      });
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void handleCheckStatus();
  }, [handleCheckStatus]);

  const handleLogin = useCallback(async () => {
    setIsLoggingIn(true);
    try {
      if (!window.electronAPI?.invoke) {
        setStatus({
          installed: false,
          isLoggedIn: false,
          message: 'Cannot access Electron API. Please restart the application.',
          error: 'Cannot access Electron API. Please restart the application.',
        });
        return;
      }

      const result = await window.electronAPI.invoke('openai-codex:login');
      setStatus({
        installed: true,
        isLoggedIn: false,
        message: result?.message || 'Started the Codex login flow.',
      });
    } catch (error: any) {
      setStatus({
        installed: false,
        isLoggedIn: false,
        message: 'Failed to start the Codex login flow.',
        error: error?.message || 'Failed to start the Codex login flow.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const handleOpenDocs = useCallback(() => {
    void window.electronAPI?.openExternal?.(CODEX_DOCS_URL);
  }, []);

  const title = useMemo(() => {
    if (status?.isLoggedIn) {
      return 'OpenAI Codex is logged in';
    }
    return 'OpenAI Codex authentication required';
  }, [status?.isLoggedIn]);

  const description = useMemo(() => {
    if (status?.isLoggedIn) {
      if (status.authMethod === 'chatgpt') {
        return 'Codex is authenticated with ChatGPT. Retry your prompt if this session was blocked earlier.';
      }
      if (status.authMethod === 'api-key') {
        return 'Codex is authenticated with an API key. Retry your prompt if this session was blocked earlier.';
      }
      return 'Codex is authenticated. Retry your prompt if this session was blocked earlier.';
    }

    return 'No ~/.codex/auth.json yet is normal before first login. Start the Codex login flow below, or use an API key in Settings if you prefer.';
  }, [status]);

  const statusBoxClassName = useMemo(() => {
    if (status?.isLoggedIn) {
      return 'border-[var(--an-diff-added-text)] bg-[var(--an-diff-added-bg)] text-[var(--an-diff-added-text)]';
    }
    if (status?.error) {
      return 'border-[var(--an-diff-removed-text)] bg-[var(--an-diff-removed-bg)] text-[var(--an-diff-removed-text)]';
    }
    return 'border-[var(--an-tool-border-color)] bg-[var(--an-background)] text-[var(--an-tool-color-muted)]';
  }, [status]);

  const shell = status?.isLoggedIn ? 'openai-auth-ready' : 'openai-auth-required';

  return (
    <AgentToolCard
      className={`openai-auth-widget ${status?.isLoggedIn ? 'logged-in' : ''}`}
      data-agent-elements-shell={shell}
      data-component="OpenAIAuthWidget"
      data-testid="agent-elements-openai-auth-widget"
      icon={<span className={status?.isLoggedIn ? 'text-[var(--an-diff-added-text)]' : 'text-[var(--an-diff-removed-text)]'}>!</span>}
      status={status?.isLoggedIn ? 'completed' : 'error'}
      title={title}
      trailing={<AgentStatusPill tone={status?.isLoggedIn ? 'success' : 'error'}>{status?.isLoggedIn ? 'Ready' : 'Auth required'}</AgentStatusPill>}
    >
      <p className="m-0 select-text text-[13px] leading-relaxed text-[var(--an-tool-color-muted)]">
        {description}
      </p>

      {status && (
        <div className={`select-text rounded-[calc(var(--an-tool-border-radius)-4px)] border p-[var(--an-spacing-sm)] text-[13px] leading-relaxed ${statusBoxClassName}`}>
          {status.error || status.message}
        </div>
      )}

      <div className={SPECIAL_STATUS_ACTIONS_CLASS} data-interactive="true">
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className={SPECIAL_STATUS_INLINE_PRIMARY_BUTTON_CLASS}
        >
          {isLoggingIn ? 'Opening Login...' : status?.isLoggedIn ? 'Log In Again' : 'Log In'}
        </button>
        <button
          onClick={() => void handleCheckStatus()}
          disabled={isChecking}
          className={SPECIAL_STATUS_INLINE_SECONDARY_BUTTON_CLASS}
        >
          {isChecking ? 'Checking...' : 'Check Status'}
        </button>
        <button
          onClick={handleOpenDocs}
          className={SPECIAL_STATUS_INLINE_SECONDARY_BUTTON_CLASS}
        >
          Open Setup Docs
        </button>
      </div>
    </AgentToolCard>
  );
};
