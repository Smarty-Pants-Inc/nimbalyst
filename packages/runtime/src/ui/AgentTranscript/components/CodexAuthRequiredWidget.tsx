import React, { useCallback } from 'react';
import { AgentToolCard } from '../../AgentElements';
import {
  SPECIAL_STATUS_ACTIONS_CLASS,
  SPECIAL_STATUS_INLINE_PRIMARY_BUTTON_CLASS,
} from './SpecialStatusWidgetChrome';

/**
 * Custom event name used to ask the renderer to open the OpenAI Codex settings
 * panel and scroll the auth section into view. Listened for by `App.tsx`.
 * Detail carries the data-testid of the element to scroll to once the panel
 * mounts.
 */
export const OPEN_CODEX_AUTH_SETTINGS_EVENT = 'nimbalyst:open-codex-auth-settings';

export interface OpenCodexAuthSettingsEventDetail {
  anchor: string;
}

export const CodexAuthRequiredWidget: React.FC<{ fallbackMessage?: string }> = ({ fallbackMessage }) => {
  const handleClick = useCallback(() => {
    const detail: OpenCodexAuthSettingsEventDetail = { anchor: 'codex-auth-section' };
    window.dispatchEvent(new CustomEvent(OPEN_CODEX_AUTH_SETTINGS_EVENT, { detail }));
  }, []);

  return (
    <AgentToolCard
      className="codex-auth-required-widget"
      data-agent-elements-shell="codex-auth-required"
      data-component="CodexAuthRequiredWidget"
      data-testid="codex-auth-required-widget"
      icon={<span className="h-2 w-2 rounded-full bg-[var(--an-primary-color)]" />}
      status="idle"
      subtitle="ChatGPT or API key login is required before this session can run."
      title="Sign in to OpenAI Codex to continue"
      footer={(
        <div className={SPECIAL_STATUS_ACTIONS_CLASS} data-interactive="true">
          <button
            type="button"
            onClick={handleClick}
            className={SPECIAL_STATUS_INLINE_PRIMARY_BUTTON_CLASS}
            data-testid="codex-auth-required-sign-in"
          >
            Sign In
          </button>
        </div>
      )}
    >
      {fallbackMessage && (
        <div className="select-text rounded-[calc(var(--an-tool-border-radius)-4px)] border border-[var(--an-tool-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-sm)] text-[12px] leading-relaxed text-[var(--an-tool-color-muted)]">
          {fallbackMessage}
        </div>
      )}
    </AgentToolCard>
  );
};
