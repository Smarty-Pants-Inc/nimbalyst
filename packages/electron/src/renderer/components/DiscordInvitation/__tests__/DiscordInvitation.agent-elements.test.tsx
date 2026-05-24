// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscordInvitation } from '../DiscordInvitation';

const posthogCaptureMock = vi.hoisted(() => vi.fn());

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({
    capture: posthogCaptureMock,
  }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
    }: {
      icon: string;
      size?: number;
      className?: string;
    }) =>
      ReactModule.createElement('span', {
        'data-icon': icon,
        'data-size': size,
        className,
      }),
  };
});

function installElectronApi() {
  const invoke = vi.fn(() => Promise.resolve());
  const send = vi.fn();

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke, send },
  });

  return { invoke, send };
}

describe('DiscordInvitation Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installElectronApi();
  });

  it('renders an Agent Elements invitation shell while preserving close and overlay behavior', () => {
    const onClose = vi.fn();
    const onDismiss = vi.fn();

    const { rerender } = render(
      <DiscordInvitation isOpen={false} onClose={onClose} onDismiss={onDismiss} />
    );

    expect(screen.queryByTestId('agent-elements-discord-invitation')).not.toBeInTheDocument();

    rerender(<DiscordInvitation isOpen={true} onClose={onClose} onDismiss={onDismiss} />);

    const backdrop = screen.getByTestId('agent-elements-discord-invitation-backdrop');
    expect(backdrop).toHaveClass('discord-invitation-overlay', 'agent-elements-discord-invitation-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'discord-invitation-backdrop');

    const dialog = screen.getByTestId('agent-elements-discord-invitation');
    expect(dialog).toHaveClass('discord-invitation', 'agent-elements-discord-invitation', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'DiscordInvitation');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'discord-invitation');

    expect(screen.getByTestId('agent-elements-discord-invitation-header')).toHaveTextContent(
      'Join the Community'
    );
    expect(screen.getByTestId('agent-elements-discord-invitation-body')).toHaveAttribute(
      'data-agent-elements-shell',
      'discord-invitation-body'
    );
    expect(screen.getByTestId('agent-elements-discord-invitation-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'discord-invitation-actions'
    );
    expect(screen.getByTestId('agent-elements-discord-invitation-social')).toHaveAttribute(
      'data-agent-elements-shell',
      'discord-invitation-social'
    );
    expect(screen.getByTestId('agent-elements-discord-invitation-footer')).toHaveAttribute(
      'data-agent-elements-shell',
      'discord-invitation-footer'
    );

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('agent-elements-discord-invitation-close'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('preserves Discord launch analytics and external-link behavior', () => {
    const { invoke } = installElectronApi();

    render(<DiscordInvitation isOpen={true} onClose={vi.fn()} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /join discord/i }));

    expect(posthogCaptureMock).toHaveBeenCalledWith('social_link_clicked', {
      channel: 'discord',
    });
    expect(invoke).toHaveBeenCalledWith('open-external', 'https://discord.gg/ubZDt4esEn');
  });

  it.each([
    ['LinkedIn', 'https://linkedin.com/company/nimbalyst', 'linkedin'],
    ['YouTube', 'https://youtube.com/@nimbalyst', 'youtube'],
    ['X', 'https://x.com/nimbalyst', 'x'],
    ['TikTok', 'https://www.tiktok.com/@nimbalyst', 'tiktok'],
    ['Instagram', 'https://www.instagram.com/nimbalyst', 'instagram'],
  ])('preserves %s social link behavior', (name, url, channel) => {
    const { invoke } = installElectronApi();

    render(<DiscordInvitation isOpen={true} onClose={vi.fn()} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name }));

    expect(posthogCaptureMock).toHaveBeenCalledWith('social_link_clicked', {
      channel,
    });
    expect(invoke).toHaveBeenCalledWith('open-external', url);
  });

  it('preserves remind-later and permanent dismiss behavior', () => {
    const { send } = installElectronApi();
    const onClose = vi.fn();
    const onDismiss = vi.fn();

    render(<DiscordInvitation isOpen={true} onClose={onClose} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /remind me later/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /don't show again/i }));
    expect(send).toHaveBeenCalledWith('dismiss-discord-invitation');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
