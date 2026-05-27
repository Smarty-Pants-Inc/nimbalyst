import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiServiceErrorWidget } from '../ApiServiceErrorWidget';
import { CodexAuthRequiredWidget, OPEN_CODEX_AUTH_SETTINGS_EVENT } from '../CodexAuthRequiredWidget';
import { ContextLimitWidget } from '../ContextLimitWidget';
import { LoginRequiredWidget } from '../LoginRequiredWidget';
import { OpenAIAuthWidget } from '../OpenAIAuthWidget';
import { RateLimitWidget } from '../RateLimitWidget';

const componentDir = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentTranscript/components',
);

const sourcePaths = [
  'ApiServiceErrorWidget.tsx',
  'CodexAuthRequiredWidget.tsx',
  'ContextLimitWidget.tsx',
  'LoginRequiredWidget.tsx',
  'OpenAIAuthWidget.tsx',
  'RateLimitWidget.tsx',
].map((fileName) => path.join(componentDir, fileName));

describe('special transcript status widgets Agent Elements shells', () => {
  const invoke = vi.fn();
  const openExternal = vi.fn();

  beforeEach(() => {
    invoke.mockReset();
    openExternal.mockReset();
    (window as any).electronAPI = { invoke, openExternal };
  });

  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it('renders API service errors as Agent Elements warning cards with debug-only raw payloads', () => {
    render(
      <ApiServiceErrorWidget content={'API Error: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"},"request_id":"req_1234567890"} Check https://status.claude.com'} />,
    );

    const card = screen.getByTestId('agent-elements-api-service-error-widget');
    expect(card).toHaveClass('api-service-error-widget', 'agent-elements-tool-card');
    expect(card).toHaveAttribute('data-agent-elements-shell', 'api-service-error');
    expect(card).toHaveAttribute('data-tool-status', 'error');
    expect(screen.getByText('The Claude API is temporarily overloaded')).toBeInTheDocument();
    expect(screen.getByText('req_1234567890')).toHaveClass('agent-elements-api-service-request-id');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
  });

  it('renders context-limit and rate-limit states with Agent Elements status chrome while preserving actions', () => {
    const onCompact = vi.fn();
    const { container, rerender } = render(
      <ContextLimitWidget isLastMessage={true} onCompact={onCompact} />,
    );

    const contextCard = screen.getByTestId('agent-elements-context-limit-widget');
    expect(contextCard).toHaveClass('context-limit-widget', 'agent-elements-tool-card');
    expect(contextCard).toHaveAttribute('data-agent-elements-shell', 'context-limit');
    expect(screen.getByText('Context limit exceeded')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }));
    expect(onCompact).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Compacting...' })).toBeDisabled();

    rerender(
      <RateLimitWidget content="<!-- [RATE_LIMIT_WARNING] limitType=5-hour session resetsAtUnix=4102444800 usage=91 -->" />,
    );
    expect(screen.getByTestId('agent-elements-rate-limit-widget')).toHaveAttribute('data-agent-elements-shell', 'rate-limit-warning');
    expect(screen.getByText('Approaching rate limit')).toBeInTheDocument();

    rerender(
      <RateLimitWidget content="<!-- [RATE_LIMIT] limitType=5-hour session resetsAtUnix=4102444800 model=claude-sonnet-1m -->" />,
    );
    expect(screen.getByTestId('agent-elements-rate-limit-widget')).toHaveAttribute('data-agent-elements-shell', 'rate-limit-blocked');
    expect(screen.getByText('Rate limit reached')).toBeInTheDocument();
    expect(container.querySelector('.rate-limit-widget-blocked')).toBeInTheDocument();
  });

  it('renders auth widgets with Agent Elements shell markers and preserves auth actions', async () => {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'claude-code:check-login') {
        return { isLoggedIn: false, error: 'Not logged in' };
      }
      if (channel === 'openai-codex:check-login') {
        return {
          installed: true,
          isLoggedIn: false,
          message: 'No auth file found.',
        };
      }
      if (channel === 'openai-codex:login') {
        return { message: 'Started login.' };
      }
      if (channel === 'claude-code:login') {
        return { success: true };
      }
      return null;
    });

    const events: Array<{ anchor?: string }> = [];
    const listener = (event: Event) => {
      events.push((event as CustomEvent<{ anchor?: string }>).detail);
    };
    window.addEventListener(OPEN_CODEX_AUTH_SETTINGS_EVENT, listener);

    const { rerender } = render(<CodexAuthRequiredWidget fallbackMessage="Auth failed" />);
    expect(screen.getByTestId('codex-auth-required-widget')).toHaveAttribute('data-agent-elements-shell', 'codex-auth-required');
    fireEvent.click(screen.getByTestId('codex-auth-required-sign-in'));
    expect(events).toEqual([{ anchor: 'codex-auth-section' }]);
    window.removeEventListener(OPEN_CODEX_AUTH_SETTINGS_EVENT, listener);

    rerender(<OpenAIAuthWidget />);
    expect(await screen.findByTestId('agent-elements-openai-auth-widget')).toHaveAttribute('data-agent-elements-shell', 'openai-auth-required');
    fireEvent.click(screen.getByRole('button', { name: 'Open Setup Docs' }));
    expect(openExternal).toHaveBeenCalledWith('https://developers.openai.com/codex');
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('openai-codex:login'));

    rerender(<LoginRequiredWidget />);
    expect(await screen.findByTestId('agent-elements-login-required-widget')).toHaveAttribute('data-agent-elements-shell', 'claude-login-required');
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('claude-code:login'));
  });

  it('keeps special status widget sources on Agent Elements-compatible visual rules', () => {
    for (const sourcePath of sourcePaths) {
      const source = readFileSync(sourcePath, 'utf8');

      expect(source).toContain('AgentToolCard');
      expect(source).toContain('data-agent-elements-shell');
      expect(source).toContain('--an-');
      expect(source).not.toMatch(/inject[A-Z][A-Za-z]+Styles|--nim-|rgba\(|text-white|rounded-lg|transition-all|style=\{\{/);
    }
  });
});
