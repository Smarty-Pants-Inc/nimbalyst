import React, { useState, useEffect, useCallback } from 'react';
import { AgentStatusPill, AgentToolCard } from '../../AgentElements';
import {
  SPECIAL_STATUS_BLOCK_PRIMARY_BUTTON_CLASS,
  SPECIAL_STATUS_BLOCK_SECONDARY_BUTTON_CLASS,
  SPECIAL_STATUS_BODY_CLASS,
} from './SpecialStatusWidgetChrome';

export const LoginRequiredWidget: React.FC = () => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [loginStatus, setLoginStatus] = useState<{
    message: string;
    success: boolean;
    accountInfo?: {
      email?: string;
      organization?: string;
      subscriptionType?: string;
    };
  } | null>(null);

  const handleRefreshStatus = useCallback(async () => {
    setIsChecking(true);
    setLoginStatus(null);

    try {
      if (!window.electronAPI?.invoke) {
        setLoginStatus({
          message: 'Cannot access Electron API. Please restart the application.',
          success: false
        });
        setIsChecking(false);
        return;
      }

      const status = await window.electronAPI.invoke('claude-code:check-login');

      if (status.isLoggedIn) {
        setLoginStatus({
          message: 'Login successful! You can now use Claude Agent.',
          success: true,
          accountInfo: {
            email: status.email,
            organization: status.organization,
            subscriptionType: status.subscriptionType
          }
        });
      } else {
        setLoginStatus({
          message: status.error || 'Not logged in. Please complete the authentication flow.',
          success: false
        });
      }
    } catch (error: any) {
      setLoginStatus({
        message: `Failed to check status: ${error.message || 'Unknown error'}`,
        success: false
      });
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Check login status when component mounts
  useEffect(() => {
    handleRefreshStatus();
  }, [handleRefreshStatus]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginStatus(null);

    try {
      // Check if we have the electronAPI available
      if (!window.electronAPI?.invoke) {
        setLoginStatus({
          message: 'Cannot access Electron API. Please restart the application.',
          success: false
        });
        setIsLoggingIn(false);
        return;
      }

      const result = await window.electronAPI.invoke('claude-code:login');

      if (result.success) {
        setLoginStatus({
          message: 'Login initiated! Complete authentication in the Terminal window (you may have to type /login to complete the process), then click "Check Status".',
          success: true
        });
      } else {
        setLoginStatus({
          message: result.error || 'Login failed. Please try again.',
          success: false
        });
      }
    } catch (error: any) {
      setLoginStatus({
        message: `Login failed: ${error.message || 'Unknown error'}`,
        success: false
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isLoggedIn = loginStatus?.success && loginStatus?.accountInfo;
  const loginButtonLabel = isLoggingIn
    ? 'Opening Login...'
    : isLoggedIn
      ? 'Log In Again'
      : 'Log In';
  const statusButtonLabel = isChecking ? 'Checking...' : 'Check Status';
  const title = isLoggedIn
    ? 'You are logged in and can continue your conversation'
    : 'Claude Agent login required';
  const shell = isLoggedIn ? 'claude-login-ready' : 'claude-login-required';

  return (
    <AgentToolCard
      className={`login-required-widget ${isLoggedIn ? 'logged-in' : ''}`}
      data-agent-elements-shell={shell}
      data-component="LoginRequiredWidget"
      data-testid="agent-elements-login-required-widget"
      icon={<span className={isLoggedIn ? 'login-status-icon success h-2 w-2 rounded-full bg-[var(--an-diff-added-text)]' : 'login-status-icon text-[var(--an-diff-removed-text)]'}>{isLoggedIn ? null : '!'}</span>}
      status={isLoggedIn ? 'completed' : 'error'}
      title={title}
      trailing={<AgentStatusPill tone={isLoggedIn ? 'success' : 'error'}>{isLoggedIn ? 'Ready' : 'Auth required'}</AgentStatusPill>}
    >
      {!isLoggedIn && (
        <div className={`login-required-message ${SPECIAL_STATUS_BODY_CLASS}`}>
          An Anthropic account is required to use Claude Agent. Please login or create an account.
        </div>
      )}

      {loginStatus && loginStatus.accountInfo && (
        <div className="login-account-info flex flex-col gap-1 text-xs text-[var(--an-tool-color-muted)]">
          {loginStatus.accountInfo.email && (
            <div>Account: {loginStatus.accountInfo.email}</div>
          )}
          {loginStatus.accountInfo.organization && (
            <div>Organization: {loginStatus.accountInfo.organization}</div>
          )}
        </div>
      )}

      {loginStatus && !loginStatus.success && (
        <div className="login-status-message error flex flex-col gap-2 rounded-[calc(var(--an-tool-border-radius)-4px)] border border-[var(--an-diff-removed-text)] bg-[var(--an-diff-removed-bg)] p-[var(--an-spacing-sm)] text-[0.8125rem] leading-relaxed text-[var(--an-diff-removed-text)] select-text">
          <div className="login-status-header flex items-center gap-2">
            <span>{loginStatus.message}</span>
          </div>
        </div>
      )}

      <div className="login-actions grid w-full grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3" data-interactive="true">
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className={`login-button ${SPECIAL_STATUS_BLOCK_PRIMARY_BUTTON_CLASS}`}
        >
          {loginButtonLabel}
        </button>

        <button
          onClick={handleRefreshStatus}
          disabled={isChecking}
          className={`status-button ${SPECIAL_STATUS_BLOCK_SECONDARY_BUTTON_CLASS}`}
        >
          {statusButtonLabel}
        </button>
      </div>
    </AgentToolCard>
  );
};
