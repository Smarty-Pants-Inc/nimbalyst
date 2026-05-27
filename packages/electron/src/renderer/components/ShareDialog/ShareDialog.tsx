import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol, copyToClipboard } from '@nimbalyst/runtime';
import {
  addSessionShareAtom,
  sessionShareAtom,
  shareKeysAtom,
  buildShareUrl,
} from '../../store/atoms/sessionShares';

export interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: 'session' | 'file';
  sessionId?: string;
  filePath?: string;
  title?: string;
}

type ExpirationOption = {
  label: string;
  value: number;
};

const EXPIRATION_OPTIONS: ExpirationOption[] = [
  { label: '1 day', value: 1 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
];

type ShareState = 'ready' | 'sharing' | 'success' | 'error';

const shareDialogButtonBase =
  'share-dialog-button inline-flex items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-50';

const shareDialogSecondaryButton =
  `${shareDialogButtonBase} border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]`;

const shareDialogPrimaryButton =
  `${shareDialogButtonBase} border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_86%,var(--an-foreground))] hover:border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))]`;

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  contentType,
  sessionId,
  filePath,
  title,
}) => {
  const [shareState, setShareState] = useState<ShareState>('ready');
  const [errorMessage, setErrorMessage] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [expirationDays, setExpirationDays] = useState<number>(7);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = loading
  const [authEmail, setAuthEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Check if session is already shared
  const existingShare = useAtomValue(sessionShareAtom(sessionId ?? ''));
  const shareKeys = useAtomValue(shareKeysAtom);
  const addShare = useSetAtom(addSessionShareAtom);

  // Check auth state when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const state = await window.electronAPI?.stytch?.getAuthState();
        setIsAuthenticated(state?.isAuthenticated ?? false);
      } catch {
        setIsAuthenticated(false);
      }
    })();

    // Listen for auth state changes (e.g. magic link completed in browser)
    const unsubscribe = window.electronAPI?.stytch?.onAuthStateChange?.((state: { isAuthenticated: boolean }) => {
      setIsAuthenticated(state.isAuthenticated);
      if (state.isAuthenticated) {
        // Reset auth form state on successful sign-in
        setAuthError(null);
        setMagicLinkSent(false);
        setAuthEmail('');
      }
    });
    window.electronAPI?.stytch?.subscribeAuthState?.();

    return unsubscribe;
  }, [isOpen]);

  // Load saved expiration preference
  useEffect(() => {
    if (!isOpen || preferenceLoaded) return;
    (async () => {
      try {
        const pref = await window.electronAPI?.getShareExpirationPreference?.();
        if (pref !== undefined && pref !== null) {
          setExpirationDays(pref);
        }
      } catch {
        // Use default
      }
      setPreferenceLoaded(true);
    })();
  }, [isOpen, preferenceLoaded]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setShareState('ready');
      setErrorMessage('');
      setShareUrl('');
      setUrlCopied(false);
      setAuthError(null);
      setMagicLinkSent(false);
      setAuthEmail('');

      // If already shared, show the existing URL
      if (existingShare) {
        const key = shareKeys.get(sessionId ?? '');
        const url = buildShareUrl(existingShare.shareId, key);
        setShareUrl(url);
      }
    } else {
      setPreferenceLoaded(false);
    }
  }, [isOpen, existingShare, shareKeys, sessionId]);

  const handleShare = useCallback(async () => {
    setShareState('sharing');
    setErrorMessage('');

    // Save preference
    try {
      await window.electronAPI?.setShareExpirationPreference?.(expirationDays);
    } catch {
      // Non-critical
    }

    try {
      let result: { success: boolean; url?: string; shareId?: string; isUpdate?: boolean; encryptionKey?: string; error?: string } | undefined;

      if (contentType === 'session' && sessionId) {
        result = await window.electronAPI?.shareSessionAsLink({
          sessionId,
          expirationDays,
        });
      } else if (contentType === 'file' && filePath) {
        result = await window.electronAPI?.shareFileAsLink({
          filePath,
          expirationDays,
        });
      }

      if (result?.success && result.url) {
        setShareUrl(result.url);
        setShareState('success');

        // Copy to clipboard
        await copyToClipboard(result.url);

        // Update share atoms for sessions
        if (contentType === 'session' && sessionId && result.shareId) {
          const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString();
          addShare({
            shareId: result.shareId,
            sessionId,
            title: title ?? 'Untitled',
            sizeBytes: 0,
            createdAt: new Date().toISOString(),
            expiresAt,
            viewCount: 0,
            encryptionKey: result.encryptionKey,
          });
        }
      } else {
        setErrorMessage(result?.error ?? 'Failed to share');
        setShareState('error');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
      setShareState('error');
    }
  }, [contentType, sessionId, filePath, expirationDays, title, addShare]);

  const handleCopyUrl = useCallback(async () => {
    if (!shareUrl) return;
    await copyToClipboard(shareUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  }, [shareUrl]);

  const handleGoogleSignIn = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await window.electronAPI?.stytch?.signInWithGoogle();
      if (!result?.success && result?.error) {
        setAuthError(result.error);
      }
    } catch (err) {
      setAuthError(String(err));
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleSendMagicLink = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) {
      setAuthError('Email is required');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await window.electronAPI?.stytch?.sendMagicLink(authEmail);
      if (!result?.success && result?.error) {
        setAuthError(result.error);
      } else {
        setMagicLinkSent(true);
      }
    } catch (err) {
      setAuthError(String(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authEmail]);

  if (!isOpen) return null;

  const contentLabel = contentType === 'session' ? 'session' : 'file';
  const isAlreadyShared = !!existingShare;
  const isStytchAvailable = !!window.electronAPI?.stytch;
  const needsAuth = isAuthenticated === false;

  return (
    <div
      className="share-dialog-overlay nim-overlay agent-elements-share-dialog-backdrop bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)]"
      data-testid="agent-elements-share-dialog-backdrop"
      data-agent-elements-shell="share-dialog-backdrop"
      onClick={onClose}
    >
      <div
        className="share-dialog agent-elements-share-dialog agent-elements-tool-card relative w-[440px] max-w-[90vw] !gap-0 !p-0 [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)] overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)]"
        data-testid="agent-elements-share-dialog"
        data-component="ShareDialog"
        data-agent-elements-shell="share-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="share-dialog-close agent-elements-share-dialog-close absolute right-3 top-3 z-[1] inline-flex h-8 w-8 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-transparent bg-transparent text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
          data-testid="agent-elements-share-dialog-close"
          data-agent-elements-shell="share-dialog-close"
          onClick={onClose}
          aria-label="Close"
        >
          <MaterialSymbol icon="close" size={16} />
        </button>

        <div
          className="share-dialog-header agent-elements-share-dialog-header flex items-center gap-3 border-b border-[var(--an-border-color)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-testid="agent-elements-share-dialog-header"
          data-agent-elements-shell="share-dialog-header"
        >
          <span
            className="share-dialog-icon agent-elements-share-dialog-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] text-[var(--an-primary-color)]"
            data-agent-elements-shell="share-dialog-icon"
            aria-hidden="true"
          >
            <MaterialSymbol icon="share" size={22} />
          </span>
          <div className="min-w-0 pr-8">
            <h2 className="share-dialog-title m-0 text-sm font-medium text-[var(--an-foreground)]">
              Share {contentLabel}
            </h2>
            <p className="share-dialog-subtitle m-0 mt-1 text-xs text-[var(--an-foreground-muted)]">
              Create an encrypted link for this {contentLabel}
            </p>
          </div>
        </div>

        <div
          className="share-dialog-body agent-elements-share-dialog-body px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-agent-elements-shell="share-dialog-body"
        >
          {needsAuth ? (
            <div
              className="share-dialog-auth agent-elements-share-dialog-auth"
              data-testid="agent-elements-share-dialog-auth"
              data-agent-elements-shell="share-dialog-auth"
            >
              <p className="m-0 mb-4 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                Sign in to share encrypted links.
              </p>

              {magicLinkSent ? (
                <div
                  className="share-dialog-magic-link-sent agent-elements-share-dialog-magic-link-sent rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xl)] text-center"
                  data-agent-elements-shell="share-dialog-magic-link-sent"
                >
                  <MaterialSymbol icon="mail" size={32} className="mb-2 text-[var(--an-primary-color)]" />
                  <p className="m-0 mb-1 text-sm font-medium text-[var(--an-foreground)]">
                    Check your email
                  </p>
                  <p className="m-0 mb-4 text-xs text-[var(--an-foreground-muted)]">
                    We sent a sign-in link to <strong className="text-[var(--an-foreground)]">{authEmail}</strong>
                  </p>
                  <button
                    onClick={() => {
                      setMagicLinkSent(false);
                      setAuthEmail('');
                    }}
                    className={shareDialogSecondaryButton}
                  >
                    Back
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={authLoading || !isStytchAvailable}
                    className={`${shareDialogSecondaryButton} agent-elements-share-dialog-google w-full`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>

                  <div className="share-dialog-separator agent-elements-share-dialog-separator my-4 flex items-center gap-3 text-xs text-[var(--an-foreground-subtle)]">
                    <div className="h-px flex-1 bg-[var(--an-border-color)]" />
                    or
                    <div className="h-px flex-1 bg-[var(--an-border-color)]" />
                  </div>

                  <form
                    className="share-dialog-auth-form agent-elements-share-dialog-auth-form"
                    data-agent-elements-shell="share-dialog-auth-form"
                    onSubmit={handleSendMagicLink}
                  >
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="Enter your email"
                      disabled={!isStytchAvailable || authLoading}
                      className="share-dialog-email-input agent-elements-share-dialog-email-input mb-3 w-full rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-3 py-2 text-sm text-[var(--an-input-color)] placeholder:text-[var(--an-foreground-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={authLoading || !isStytchAvailable || !authEmail}
                      className={`${shareDialogPrimaryButton} w-full`}
                    >
                      {authLoading ? 'Sending...' : 'Send sign-in link'}
                    </button>
                  </form>

                  {authError && (
                    <p
                      className="share-dialog-auth-error agent-elements-share-dialog-auth-error m-0 mt-2 rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-error-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-error-color)_8%,var(--an-background))] p-2 text-xs text-[var(--an-error-color)]"
                      data-agent-elements-shell="share-dialog-auth-error"
                    >
                      {authError}
                    </p>
                  )}
                </>
              )}

              <div className="share-dialog-auth-actions agent-elements-share-dialog-auth-actions mt-5 flex justify-end">
                <button
                  className={shareDialogSecondaryButton}
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className="share-dialog-privacy agent-elements-share-dialog-privacy mb-5 flex gap-3 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]"
                data-testid="agent-elements-share-dialog-privacy"
                data-agent-elements-shell="share-dialog-privacy"
              >
                <MaterialSymbol icon="lock" size={18} className="mt-0.5 shrink-0 text-[var(--an-foreground-muted)]" />
                <div>
                  <p className="m-0 text-sm text-[var(--an-foreground)]">
                    Anyone with the link can view this {contentLabel}
                  </p>
                  <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-subtle)]">
                    Content is end-to-end encrypted.
                    <br />
                    No one without the link -- including Nimbalyst Servers -- can see it.
                  </p>
                </div>
              </div>

              {shareState !== 'success' && (
                <div
                  className="share-dialog-expiration agent-elements-share-dialog-expiration mb-5"
                  data-testid="agent-elements-share-dialog-expiration"
                  data-agent-elements-shell="share-dialog-expiration"
                >
                  <label className="mb-1.5 block text-xs font-medium text-[var(--an-foreground-muted)]">
                    Link expires after
                  </label>
                  <select
                    className="share-dialog-expiration-select agent-elements-share-dialog-expiration-select w-full cursor-pointer rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-3 py-2 text-sm text-[var(--an-input-color)] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:ring-2 focus:ring-[var(--an-input-focus-outline)] [&>option]:bg-[var(--an-background)] [&>option]:text-[var(--an-foreground)]"
                    data-testid="agent-elements-share-dialog-expiration-select"
                    data-agent-elements-shell="share-dialog-expiration-select"
                    value={String(expirationDays)}
                    onChange={(e) => {
                      setExpirationDays(Number(e.target.value));
                    }}
                  >
                    {EXPIRATION_OPTIONS.map((opt) => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="m-0 mt-1.5 text-xs text-[var(--an-foreground-subtle)]">
                    Your choice will be remembered for next time
                  </p>
                </div>
              )}

              {shareState === 'success' && shareUrl && (
                <div
                  className="share-dialog-success agent-elements-share-dialog-success mb-5"
                  data-agent-elements-shell="share-dialog-success"
                >
                  <label className="mb-1.5 block text-xs font-medium text-[var(--an-foreground-muted)]">
                    Share link
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={urlInputRef}
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="share-dialog-url agent-elements-share-dialog-url min-w-0 flex-1 rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-background-secondary)] px-3 py-2 text-sm text-[var(--an-input-color)] outline-none select-text"
                      data-testid="agent-elements-share-dialog-url"
                      data-agent-elements-shell="share-dialog-url"
                      onClick={() => urlInputRef.current?.select()}
                    />
                    <button
                      className={`${shareDialogSecondaryButton} shrink-0`}
                      onClick={handleCopyUrl}
                    >
                      <MaterialSymbol icon={urlCopied ? 'check' : 'content_copy'} size={14} />
                      {urlCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {shareState === 'error' && (
                <div
                  className="share-dialog-error agent-elements-share-dialog-error mb-5 rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-error-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-error-color)_8%,var(--an-background))] p-[var(--an-spacing-lg)]"
                  data-agent-elements-shell="share-dialog-error"
                >
                  <p className="m-0 text-sm text-[var(--an-error-color)]">{errorMessage}</p>
                </div>
              )}

              <div
                className="share-dialog-actions agent-elements-share-dialog-actions flex justify-end gap-2"
                data-testid="agent-elements-share-dialog-actions"
                data-agent-elements-shell="share-dialog-actions"
              >
                {shareState === 'success' ? (
                  <button
                    className={shareDialogSecondaryButton}
                    onClick={onClose}
                  >
                    Done
                  </button>
                ) : (
                  <>
                    <button
                      className={shareDialogSecondaryButton}
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                    <button
                      className={`${shareDialogPrimaryButton} share-dialog-primary-action agent-elements-share-dialog-primary-action`}
                      onClick={handleShare}
                      disabled={shareState === 'sharing'}
                    >
                      {shareState === 'sharing' ? (
                        <>
                          <MaterialSymbol icon="progress_activity" size={14} className="animate-spin" />
                          Sharing...
                        </>
                      ) : shareState === 'error' ? (
                        'Retry'
                      ) : isAlreadyShared ? (
                        <>
                          <MaterialSymbol icon="link" size={14} />
                          Update link
                        </>
                      ) : (
                        <>
                          <MaterialSymbol icon="link" size={14} />
                          Copy link
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
