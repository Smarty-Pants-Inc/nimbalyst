// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QRPairingModal } from '../QRPairingModal';

const mocks = vi.hoisted(() => ({
  copyToClipboard: vi.fn(),
  toDataURL: vi.fn(async () => 'data:image/png;base64,qr-code'),
  generateQRPayload: vi.fn(async (serverUrl: string) => ({
    serverUrl,
    encryptionKeySeed: 'seed-123',
  })),
  getLocalIP: vi.fn(async () => '192.168.1.44'),
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: mocks.toDataURL,
  },
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    copyToClipboard: mocks.copyToClipboard,
    MaterialSymbol: ({
      icon,
      size,
      className,
    }: {
      icon: string;
      size?: number;
      className?: string;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }, icon),
  };
});

const sourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../QRPairingModal.tsx'
);

describe('QRPairingModal Agent Elements shell', () => {
  beforeEach(() => {
    vi.stubGlobal('electronAPI', {
      credentials: {
        generateQRPayload: mocks.generateQRPayload,
      },
      network: {
        getLocalIP: mocks.getLocalIP,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders an Agent Elements pairing dialog while preserving QR generation and close behavior', async () => {
    const onClose = vi.fn();

    render(
      <QRPairingModal
        isOpen={true}
        onClose={onClose}
        serverUrl="https://sync.example.test"
      />
    );

    const dialog = screen.getByTestId('agent-elements-qr-pairing-dialog');
    expect(dialog).toHaveClass(
      'qr-modal-content',
      'agent-elements-qr-pairing-dialog',
      'agent-elements-tool-card'
    );
    expect(dialog).toHaveAttribute('data-component', 'QRPairingModal');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'qr-pairing-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    expect(screen.getByTestId('agent-elements-qr-pairing-backdrop')).toHaveAttribute(
      'data-agent-elements-shell',
      'qr-pairing-backdrop'
    );
    expect(screen.getByTestId('agent-elements-qr-pairing-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'qr-pairing-header'
    );
    expect(screen.getByTestId('agent-elements-qr-pairing-body')).toHaveAttribute(
      'data-agent-elements-shell',
      'qr-pairing-body'
    );

    await waitFor(() => {
      expect(mocks.generateQRPayload).toHaveBeenCalledWith('https://sync.example.test');
      expect(mocks.toDataURL).toHaveBeenCalled();
    });
    expect(await screen.findByAltText('QR Code for mobile pairing')).toHaveAttribute(
      'src',
      'data:image/png;base64,qr-code'
    );
    expect(screen.getByTestId('agent-elements-qr-pairing-instructions')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-qr-pairing-security')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-qr-pairing-warning')).toBeInTheDocument();

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('agent-elements-qr-pairing-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('preserves local dev URL replacement, sleep-mode selection, and manual copy behavior', async () => {
    const onClose = vi.fn();
    const onPreventSleepModeChange = vi.fn();

    render(
      <QRPairingModal
        isOpen={true}
        onClose={onClose}
        serverUrl="http://localhost:5273"
        preventSleepMode="pluggedIn"
        onPreventSleepModeChange={onPreventSleepModeChange}
      />
    );

    await waitFor(() => {
      expect(mocks.getLocalIP).toHaveBeenCalledTimes(1);
      expect(mocks.generateQRPayload).toHaveBeenCalledWith('http://192.168.1.44:5273');
    });

    expect(screen.getByTestId('agent-elements-qr-pairing-local-dev')).toBeInTheDocument();
    expect(screen.getByText(/Server URL in QR:/)).toHaveTextContent('http://192.168.1.44:5273');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'always' } });
    expect(onPreventSleepModeChange).toHaveBeenCalledWith('always');

    fireEvent.click(screen.getByRole('button', { name: 'Copy Pairing Data' }));
    await waitFor(() => {
      expect(mocks.copyToClipboard).toHaveBeenCalledWith(
        JSON.stringify(
          {
            serverUrl: 'http://192.168.1.44:5273',
            encryptionKeySeed: 'seed-123',
          },
          null,
          2
        )
      );
    });
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('preserves cmd-click QR image payload copy behavior', async () => {
    render(
      <QRPairingModal
        isOpen={true}
        onClose={vi.fn()}
        serverUrl="https://sync.example.test"
      />
    );

    const qrCode = await screen.findByAltText('QR Code for mobile pairing');
    fireEvent.click(qrCode, { metaKey: true });

    await waitFor(() => {
      expect(mocks.copyToClipboard).toHaveBeenCalledWith(
        JSON.stringify(
          {
            serverUrl: 'https://sync.example.test',
            encryptionKeySeed: 'seed-123',
          },
          null,
          2
        )
      );
    });
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('keeps QRPairingModal source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-qr-pairing-dialog');
    expect(source).toContain('data-agent-elements-shell="qr-pairing-dialog"');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/<MaterialSymbol[^>]*aria-hidden/);
    expect(source).not.toMatch(/bg-black\/|text-white|rounded-lg|rounded-xl|shadow-|backdrop-blur/);
    expect(source).not.toMatch(/bg-amber-|text-amber-|border-amber-|bg-green-|text-green-|border-green-|bg-blue-|border-blue-/);
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|nim-modal|nim-btn-/);
    expect(source).not.toContain('var(--nim-error)');
    expect(source).not.toMatch(/rgba\(|rgb\(|<svg|<\/svg>/);
  });
});
