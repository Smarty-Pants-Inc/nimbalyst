// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareDialog } from '../ShareDialog/ShareDialog';

const copyToClipboardMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

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
    copyToClipboard: copyToClipboardMock,
  };
});

function installElectronApi({ authenticated = true }: { authenticated?: boolean } = {}) {
  const unsubscribe = vi.fn();
  const api = {
    getShareExpirationPreference: vi.fn().mockResolvedValue(7),
    setShareExpirationPreference: vi.fn().mockResolvedValue(undefined),
    shareSessionAsLink: vi.fn().mockResolvedValue({
      success: true,
      url: 'https://share.nimbalyst.com/share/share-session-1#key=session-key',
      shareId: 'share-session-1',
      encryptionKey: 'session-key',
    }),
    shareFileAsLink: vi.fn().mockResolvedValue({
      success: true,
      url: 'https://share.nimbalyst.com/share/share-file-1#key=file-key',
      shareId: 'share-file-1',
      encryptionKey: 'file-key',
    }),
    stytch: {
      getAuthState: vi.fn().mockResolvedValue({ isAuthenticated: authenticated }),
      onAuthStateChange: vi.fn(() => unsubscribe),
      subscribeAuthState: vi.fn(),
      signInWithGoogle: vi.fn().mockResolvedValue({ success: true }),
      sendMagicLink: vi.fn().mockResolvedValue({ success: true }),
    },
  };

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: api,
  });

  return api;
}

describe('ShareDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyToClipboardMock.mockClear();
  });

  it('renders an Agent Elements share shell while preserving close and overlay behavior', async () => {
    const api = installElectronApi();
    const onClose = vi.fn();

    const { rerender } = render(
      <ShareDialog
        isOpen={false}
        onClose={onClose}
        contentType="session"
        sessionId="closed-session"
        title="Closed session"
      />
    );

    expect(screen.queryByTestId('agent-elements-share-dialog')).not.toBeInTheDocument();

    rerender(
      <ShareDialog
        isOpen={true}
        onClose={onClose}
        contentType="session"
        sessionId="shell-session"
        title="Shell session"
      />
    );

    const backdrop = screen.getByTestId('agent-elements-share-dialog-backdrop');
    expect(backdrop).toHaveClass('share-dialog-overlay', 'agent-elements-share-dialog-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'share-dialog-backdrop');

    const dialog = screen.getByTestId('agent-elements-share-dialog');
    expect(dialog).toHaveClass('share-dialog', 'agent-elements-share-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'ShareDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'share-dialog');
    expect(dialog.className).toContain('!p-0');
    expect(dialog.className).toContain('!gap-0');
    expect(dialog.className).toContain('--agent-elements-card-inline-padding');
    expect(dialog.className).toContain('--agent-elements-card-block-padding');

    expect(screen.getByTestId('agent-elements-share-dialog-header')).toHaveTextContent('Share session');
    expect(screen.getByTestId('agent-elements-share-dialog-privacy')).toHaveAttribute(
      'data-agent-elements-shell',
      'share-dialog-privacy'
    );
    expect(screen.getByTestId('agent-elements-share-dialog-expiration')).toHaveAttribute(
      'data-agent-elements-shell',
      'share-dialog-expiration'
    );
    expect(screen.getByTestId('agent-elements-share-dialog-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'share-dialog-actions'
    );

    await waitFor(() => {
      expect(api.stytch.getAuthState).toHaveBeenCalledTimes(1);
      expect(api.getShareExpirationPreference).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('preserves file sharing, saved expiration preference, success URL display, and copy behavior', async () => {
    const api = installElectronApi();

    render(
      <ShareDialog
        isOpen={true}
        onClose={vi.fn()}
        contentType="file"
        filePath="/workspace/notes.md"
        title="notes.md"
      />
    );

    fireEvent.change(screen.getByTestId('agent-elements-share-dialog-expiration-select'), {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }));

    await waitFor(() => {
      expect(api.setShareExpirationPreference).toHaveBeenCalledWith(30);
      expect(api.shareFileAsLink).toHaveBeenCalledWith({
        filePath: '/workspace/notes.md',
        expirationDays: 30,
      });
      expect(copyToClipboardMock).toHaveBeenCalledWith(
        'https://share.nimbalyst.com/share/share-file-1#key=file-key'
      );
    });

    const shareUrl = await screen.findByTestId('agent-elements-share-dialog-url');
    expect(shareUrl).toHaveClass('agent-elements-share-dialog-url', 'select-text');
    expect(shareUrl).toHaveValue('https://share.nimbalyst.com/share/share-file-1#key=file-key');

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => {
      expect(copyToClipboardMock).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
    });
  });

  it('preserves the authentication-required path inside the Agent Elements shell', async () => {
    const api = installElectronApi({ authenticated: false });
    const onClose = vi.fn();

    render(
      <ShareDialog
        isOpen={true}
        onClose={onClose}
        contentType="file"
        filePath="/workspace/notes.md"
        title="notes.md"
      />
    );

    const authPanel = await screen.findByTestId('agent-elements-share-dialog-auth');
    expect(authPanel).toHaveClass('agent-elements-share-dialog-auth');
    expect(authPanel).toHaveAttribute('data-agent-elements-shell', 'share-dialog-auth');

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => {
      expect(api.stytch.signInWithGoogle).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
      target: { value: 'paul@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() => {
      expect(api.stytch.sendMagicLink).toHaveBeenCalledWith('paul@example.com');
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps ShareDialog chrome on shared Agent Elements gutters and alias tokens', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'packages/electron/src/renderer/components/ShareDialog/ShareDialog.tsx'),
      'utf8',
    );

    expect(source).toContain('--an-foreground');
    expect(source).toContain('--an-primary-color');
    expect(source).toContain('--an-error-color');
    expect(source).toContain('!p-0');
    expect(source).toContain('!gap-0');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).toContain('px-[var(--agent-elements-card-inline-padding)]');
    expect(source).toContain('py-[var(--agent-elements-card-block-padding)]');
    expect(source).not.toMatch(/var\(--nim-(?:text|primary-hover|bg|error)[^)]+\)/);
    expect(source).not.toMatch(/agent-elements-share-dialog-(?:header|body)[^`'"]*\bp-\[var\(--an-spacing/);
  });
});
