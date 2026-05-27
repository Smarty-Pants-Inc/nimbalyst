import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { copyToClipboard, MaterialSymbol } from '@nimbalyst/runtime';

interface QRPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverUrl: string;
  /** Current sleep prevention mode */
  preventSleepMode?: 'off' | 'always' | 'pluggedIn';
  /** Called when the user changes the prevent-sleep mode */
  onPreventSleepModeChange?: (mode: 'off' | 'always' | 'pluggedIn') => void;
}

/**
 * Check if the URL is a localhost/local dev server URL
 */
function isLocalDevServer(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  } catch {
    return false;
  }
}

/**
 * Replace localhost in URL with the given IP address
 */
function replaceLocalhostWithIP(url: string, ip: string): string {
  try {
    const parsed = new URL(url);
    parsed.hostname = ip;
    return parsed.toString().replace(/\/$/, ''); // Remove trailing slash
  } catch {
    return url;
  }
}

const backdropClass =
  'qr-modal-overlay agent-elements-qr-pairing-backdrop fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xxl)]';
const dialogClass =
  'qr-modal-content agent-elements-qr-pairing-dialog agent-elements-tool-card my-auto flex max-h-[90vh] w-[min(92vw,420px)] flex-col overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)]';
const headerClass =
  'qr-modal-header agent-elements-qr-pairing-header flex items-start justify-between gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]';
const bodyClass =
  'qr-modal-body agent-elements-qr-pairing-body nim-scrollbar flex flex-col overflow-y-auto px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]';
const iconFrameClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]';
const closeButtonClass =
  'qr-modal-close inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-focus-ring)]';
const panelBaseClass =
  'rounded-[var(--an-tool-border-radius)] border px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)]';
const warningPanelClass =
  `${panelBaseClass} border-[color-mix(in_srgb,var(--an-warning-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_9%,var(--an-background))] text-[var(--an-warning-color)]`;
const successPanelClass =
  `${panelBaseClass} border-[color-mix(in_srgb,var(--an-success-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_8%,var(--an-background))] text-[var(--an-success-color)]`;
const infoPanelClass =
  `${panelBaseClass} border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_7%,var(--an-background))] text-[var(--an-foreground)]`;
const inlineCodeClass =
  'rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--an-foreground)]';
const secondaryButtonClass =
  'inline-flex min-h-8 w-full cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-4 py-2 text-sm font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color-strong)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-focus-ring)]';
const primaryButtonClass =
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-send-button-bg)] bg-[var(--an-send-button-bg)] px-4 py-2 text-sm font-medium text-[var(--an-send-button-color)] transition-[background-color,border-color,opacity] duration-150 ease-out hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--an-focus-ring)]';

function DecorativeMaterialSymbol({ icon, size, className = '' }: { icon: string; size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex ${className}`.trim()}>
      <MaterialSymbol icon={icon} size={size} />
    </span>
  );
}

/**
 * QR Pairing Modal
 *
 * Shows a QR code containing the encryption key seed for pairing with mobile devices.
 * Mobile devices authenticate independently via Stytch OAuth - the QR code only shares
 * the encryption key needed for E2E encrypted sync.
 */
export function QRPairingModal({ isOpen, onClose, serverUrl, preventSleepMode, onPreventSleepModeChange }: QRPairingModalProps) {
  const [qrDataUrl, setQRDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrPayload, setQRPayload] = useState<object | null>(null);
  const [copied, setCopied] = useState(false);

  // Local dev server detection
  const [localIP, setLocalIP] = useState<string | null>(null);
  const [useLocalIP, setUseLocalIP] = useState(true); // Default to using LAN IP for local servers
  const [effectiveUrl, setEffectiveUrl] = useState(serverUrl);

  const isLocalServer = isLocalDevServer(serverUrl);

  // Fetch local IP when modal opens
  useEffect(() => {
    if (isOpen && isLocalServer) {
      window.electronAPI.network.getLocalIP().then((ip: string | null) => {
        setLocalIP(ip);
      });
    }
  }, [isOpen, isLocalServer]);

  // Update effective URL when toggle changes or local IP is fetched
  useEffect(() => {
    if (isLocalServer && localIP && useLocalIP) {
      setEffectiveUrl(replaceLocalhostWithIP(serverUrl, localIP));
    } else {
      setEffectiveUrl(serverUrl);
    }
  }, [isLocalServer, localIP, useLocalIP, serverUrl]);

  const generateQR = useCallback(async () => {
    if (!effectiveUrl) {
      setError('Server URL is required');
      return;
    }

    try {
      // Get QR payload from main process (with effective URL)
      // The payload contains only serverUrl and encryptionKeySeed
      // Mobile devices authenticate independently via Stytch OAuth
      const payload = await window.electronAPI.credentials.generateQRPayload(effectiveUrl);
      setQRPayload(payload);

      // Wrap payload in a nimbalyst:// deep link URL so the iOS Camera app
      // can open Nimbalyst directly when scanning. The payload stays local —
      // it goes from screen -> camera -> app, never touches a server.
      const payloadBase64 = btoa(JSON.stringify(payload));
      const deepLinkUrl = `nimbalyst://pair?data=${encodeURIComponent(payloadBase64)}`;

      // Generate QR code data URL
      const dataUrl = await QRCode.toDataURL(deepLinkUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });

      setQRDataUrl(dataUrl);
      setError(null);
      setCopied(false);
    } catch (err) {
      console.error('[QRPairingModal] Failed to generate QR:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate QR code');
    }
  }, [effectiveUrl]);

  const handleCopyPayload = async () => {
    if (!qrPayload) return;
    try {
      const jsonString = JSON.stringify(qrPayload, null, 2);
      console.log('[QRPairingModal] Copying payload:', jsonString);
      await copyToClipboard(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[QRPairingModal] Failed to copy:', err);
    }
  };

  // Generate QR when modal opens or effective URL changes
  useEffect(() => {
    if (isOpen && effectiveUrl) {
      generateQR();
    }
  }, [isOpen, effectiveUrl, generateQR]);

  // Clear state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQRDataUrl(null);
      setError(null);
      setQRPayload(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={backdropClass}
      onClick={onClose}
      data-testid="agent-elements-qr-pairing-backdrop"
      data-component="QRPairingModalBackdrop"
      data-agent-elements-shell="qr-pairing-backdrop"
    >
      <div
        className={dialogClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-pairing-title"
        data-testid="agent-elements-qr-pairing-dialog"
        data-component="QRPairingModal"
        data-agent-elements-shell="qr-pairing-dialog"
      >
        <div
          className={headerClass}
          data-testid="agent-elements-qr-pairing-header"
          data-agent-elements-shell="qr-pairing-header"
        >
          <div className="flex min-w-0 items-start gap-[var(--an-spacing-md)]">
            <span className={iconFrameClass} aria-hidden="true">
              <MaterialSymbol icon="qr_code_scanner" size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="qr-pairing-title" className="qr-modal-title m-0 text-base font-medium leading-snug text-[var(--an-foreground)]">
                Pair Mobile Device
              </h2>
              <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                Share your sync key with a signed-in mobile app.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={closeButtonClass}
            onClick={onClose}
            aria-label="Close"
          >
            <DecorativeMaterialSymbol icon="close" size={20} />
          </button>
        </div>

        <div
          className={bodyClass}
          data-testid="agent-elements-qr-pairing-body"
          data-agent-elements-shell="qr-pairing-body"
        >
          {/* Local dev server notice */}
          {isLocalServer && localIP && (
            <div
              className={`qr-dev-notice agent-elements-qr-pairing-local-dev mb-[var(--an-spacing-lg)] ${warningPanelClass}`}
              data-testid="agent-elements-qr-pairing-local-dev"
              data-agent-elements-shell="qr-pairing-local-dev"
            >
              <div className="qr-dev-notice-header mb-[var(--an-spacing-sm)] flex items-center gap-[var(--an-spacing-xs)] text-sm font-medium">
                <DecorativeMaterialSymbol icon="info" size={16} />
                <span>Local Development Server</span>
              </div>
              <p className="qr-dev-notice-text m-0 mb-[var(--an-spacing-sm)] select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                Your phone needs to connect via your local network IP instead of localhost.
              </p>
              <label className="qr-dev-toggle flex cursor-pointer items-center gap-[var(--an-spacing-xs)]">
                <input
                  type="checkbox"
                  checked={useLocalIP}
                  onChange={(e) => setUseLocalIP(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-[var(--an-primary-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
                />
                <span className="qr-dev-toggle-text text-xs text-[var(--an-foreground)]">
                  Use LAN IP: <code className={inlineCodeClass}>{localIP}</code>
                </span>
              </label>
              <p className="qr-dev-notice-url m-0 mt-[var(--an-spacing-sm)] select-text text-xs text-[var(--an-foreground-subtle)]">
                Server URL in QR: <code className={inlineCodeClass}>{effectiveUrl}</code>
              </p>
            </div>
          )}

          {error ? (
            <div
              className="qr-error flex flex-col items-center justify-center py-[var(--an-spacing-xxl)] text-center"
              data-agent-elements-shell="qr-pairing-error"
            >
              <p className="m-0 mb-[var(--an-spacing-lg)] select-text text-sm text-[var(--an-diff-removed-text)]">{error}</p>
              <button
                type="button"
                className={`qr-regenerate-button ${primaryButtonClass}`}
                onClick={generateQR}
              >
                Try Again
              </button>
            </div>
          ) : qrDataUrl ? (
            <>
              <div className="qr-code-container mb-[var(--an-spacing-xl)] flex justify-center">
                <img
                  src={qrDataUrl}
                  alt="QR Code for mobile pairing"
                  className="qr-code-image cursor-pointer rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-md)]"
                  onClick={(e) => {
                    if (e.metaKey && qrPayload) {
                      handleCopyPayload();
                    }
                  }}
                  title="Cmd+click to copy payload"
                />
              </div>

              <div
                className="qr-instructions agent-elements-qr-pairing-instructions mb-[var(--an-spacing-lg)] space-y-[var(--an-spacing-xs)] text-sm text-[var(--an-foreground-muted)]"
                data-testid="agent-elements-qr-pairing-instructions"
                data-agent-elements-shell="qr-pairing-instructions"
              >
                <p className="qr-step m-0 select-text">1. Open Nimbalyst on your mobile device</p>
                <p className="qr-step m-0 select-text">2. Go to Settings and tap "Scan QR Code"</p>
                <p className="qr-step m-0 select-text">3. Point your camera at this QR code</p>
                <p className="qr-step m-0 select-text">4. Sign in with the same account as desktop</p>
              </div>

              <div
                className={`qr-info agent-elements-qr-pairing-security mt-[var(--an-spacing-md)] text-[13px] ${successPanelClass}`}
                data-testid="agent-elements-qr-pairing-security"
                data-agent-elements-shell="qr-pairing-security"
              >
                <div className="mb-[var(--an-spacing-sm)] flex items-center gap-[var(--an-spacing-xs)]">
                  <DecorativeMaterialSymbol icon="lock" size={16} />
                  <span className="font-medium">End-to-End Encrypted</span>
                </div>
                <p className="m-0 select-text leading-relaxed text-[var(--an-foreground-muted)]">
                  This QR code securely transfers your encryption key. Your keys never touch our servers - only your devices can decrypt your data.
                </p>
              </div>

              {/* Prevent sleep suggestion */}
              {onPreventSleepModeChange && (
                <div
                  className={`agent-elements-qr-pairing-sleep mt-[var(--an-spacing-md)] ${infoPanelClass}`}
                  data-agent-elements-shell="qr-pairing-sleep"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex-1">
                      <span className="text-[13px] font-medium text-[var(--an-foreground)]">Prevent sleep while syncing</span>
                      <p className="m-0 mt-1 select-text text-[11px] leading-relaxed text-[var(--an-foreground-muted)]">
                        Keeps your computer awake so you can send prompts from your phone. Display can still turn off.
                      </p>
                    </div>
                    <select
                      value={preventSleepMode ?? 'off'}
                      onChange={(e) => onPreventSleepModeChange(e.target.value as 'off' | 'always' | 'pluggedIn')}
                      className="mt-0.5 shrink-0 cursor-pointer rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-2 py-1 text-[12px] text-[var(--an-input-color)] outline-none focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-focus-ring)]"
                    >
                      <option value="off">Off</option>
                      <option value="always">Always</option>
                      <option value="pluggedIn">When plugged in</option>
                    </select>
                  </div>
                </div>
              )}

              <div
                className={`qr-warning agent-elements-qr-pairing-warning mt-[var(--an-spacing-md)] flex items-center gap-[var(--an-spacing-xs)] text-xs ${warningPanelClass}`}
                data-testid="agent-elements-qr-pairing-warning"
                data-agent-elements-shell="qr-pairing-warning"
              >
                <DecorativeMaterialSymbol icon="warning" size={16} className="shrink-0" />
                <span className="select-text">Only scan with your own device. This shares your encryption key.</span>
              </div>

              <button
                type="button"
                className={`qr-regenerate-button mt-[var(--an-spacing-lg)] ${secondaryButtonClass}`}
                onClick={generateQR}
              >
                <DecorativeMaterialSymbol icon="refresh" size={16} />
                Regenerate QR Code
              </button>

              {/* Copy pairing data for manual setup (alternative to QR scanning) */}
              {qrPayload && (
                <div className="qr-dev-copy">
                  <button
                    type="button"
                    className={`qr-dev-copy-button mt-[var(--an-spacing-md)] ${
                      copied
                        ? primaryButtonClass
                        : secondaryButtonClass
                    }`}
                    onClick={handleCopyPayload}
                  >
                    <DecorativeMaterialSymbol icon={copied ? 'check' : 'content_copy'} size={16} />
                    {copied ? 'Copied!' : 'Copy Pairing Data'}
                  </button>
                  <p className="m-0 mt-[var(--an-spacing-sm)] select-text text-center text-[11px] text-[var(--an-foreground-subtle)]">
                    Can't scan? Paste this into the mobile app's Manual Setup
                  </p>
                </div>
              )}
            </>
          ) : (
            <div
              className="qr-loading flex flex-col items-center justify-center py-[var(--an-spacing-xxl)]"
              data-agent-elements-shell="qr-pairing-loading"
            >
              <div className="qr-spinner mb-[var(--an-spacing-md)] h-8 w-8 rounded-full border-2 border-[var(--an-primary-color)] border-t-transparent animate-spin" />
              <p className="m-0 text-sm text-[var(--an-foreground-muted)]">Generating QR code...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
