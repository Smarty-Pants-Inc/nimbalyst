import React, { useEffect, useState, useCallback } from 'react';
import { MaterialSymbol, copyToClipboard } from '@nimbalyst/runtime';
import { buildShareUrl } from '../../../store/atoms/sessionShares';
import { createProviderPanelChrome } from './providerPanelChrome';

interface SharedLink {
  shareId: string;
  sessionId: string;
  title: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string | null;
  viewCount: number;
}

type PanelState = 'loading' | 'loaded' | 'unauthenticated' | 'error';

const chrome = createProviderPanelChrome({
  headerClassName: 'provider-panel-header shared-links-panel-header',
  sectionClassName: 'provider-panel-section shared-links-section',
  configCardClassName: 'shared-links-card',
  inputClassName: 'shared-links-input',
  loadingClassName: 'shared-links-loading-text',
  modelRowClassName: 'shared-link-row',
  testButtonClassName: 'shared-links-action-button',
  testErrorClassName: 'shared-links-error-text',
  emptyClassName: 'shared-links-empty-text',
});

const spaciousCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-xxl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)]';
const compactCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';
const loadingCardClass =
  `shared-links-loading agent-elements-tool-card ${spaciousCardPaddingClass} flex min-h-32 items-center justify-center gap-[var(--an-spacing-sm)] text-sm text-[var(--an-foreground-muted)]`;
const centeredStateCardClass =
  `agent-elements-tool-card ${spaciousCardPaddingClass} flex min-h-32 flex-col items-center justify-center text-center`;
const stateIconClass = 'mb-[var(--an-spacing-md)] text-[var(--an-foreground-subtle)]';
const stateTextClass = 'mb-[var(--an-spacing-xs)] text-sm text-[var(--an-foreground-muted)]';
const stateSubtextClass = 'text-xs text-[var(--an-foreground-subtle)]';
const listClass = 'shared-links-list flex flex-col gap-[var(--an-spacing-sm)]';
const rowClass =
  `shared-link-row agent-elements-tool-card flex !flex-row items-start gap-[var(--an-spacing-lg)] ${compactCardPaddingClass}`;
const shareTitleClass = 'truncate text-sm font-medium text-[var(--an-foreground)]';
const shareBadgeClass =
  'shrink-0 rounded-[var(--an-small-border-radius)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xs)] py-[var(--an-spacing-xxs)] text-[10px] font-medium uppercase text-[var(--an-foreground-subtle)]';
const shareMetaClass = 'shrink-0 text-xs text-[var(--an-foreground-subtle)]';
const shareDetailClass = 'flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-sm)] text-xs text-[var(--an-foreground-subtle)]';
const iconButtonClass =
  'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--an-small-border-radius)] border-0 bg-transparent text-[var(--an-foreground-subtle)] transition-[background-color,color,opacity] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';
const dangerIconButtonClass =
  `${iconButtonClass} hover:text-[var(--an-error-color)]`;

/**
 * Shared Links settings panel.
 * Displays and manages all shared file and session links for the current user.
 * Self-contained - fetches data via IPC, no props needed.
 */
export const SharedLinksPanel: React.FC = () => {
  const [shares, setShares] = useState<SharedLink[]>([]);
  const [shareKeys, setShareKeys] = useState<Record<string, string>>({});
  const [state, setState] = useState<PanelState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    setState('loading');
    try {
      const [result, keys] = await Promise.all([
        (window as any).electronAPI?.listShares(),
        (window as any).electronAPI?.getShareKeys(),
      ]);
      if (keys) {
        setShareKeys(keys);
      }
      if (result?.success && result.shares) {
        setShares(result.shares);
        setState('loaded');
      } else if (result?.error?.includes('Not signed in')) {
        setState('unauthenticated');
      } else {
        setErrorMessage(result?.error || 'Failed to load shares');
        setState('error');
      }
    } catch (error) {
      setErrorMessage(String(error));
      setState('error');
    }
  }, []);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleDelete = async (share: SharedLink) => {
    setDeletingId(share.shareId);
    try {
      const result = await (window as any).electronAPI?.deleteShare({
        shareId: share.shareId,
        sessionId: typeof share.sessionId === 'string' ? share.sessionId : undefined,
      });
      if (result?.success) {
        setShares(prev => prev.filter(s => s.shareId !== share.shareId));
      }
    } catch (error) {
      console.error('[SharedLinksPanel] Delete failed:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyLink = (share: SharedLink) => {
    const key = typeof share.sessionId === 'string' ? shareKeys[share.sessionId] : undefined;
    const url = buildShareUrl(share.shareId, key);
    copyToClipboard(url);
    setCopiedId(share.shareId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'No expiration';
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expired';
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days === 1) return 'Expires tomorrow';
    return `Expires in ${days}d`;
  };

  const getShareKindLabel = (share: SharedLink) =>
    typeof share.sessionId === 'string' && share.sessionId.startsWith('file:') ? 'File' : 'Session';

  return (
    <div
      className="provider-panel shared-links-panel agent-elements-settings-panel flex w-full flex-col"
      data-agent-elements-shell="shared-links-panel"
      data-component="SharedLinksPanel"
      data-testid="agent-elements-shared-links-panel"
    >
      <div
        className={`${chrome.header} flex items-start justify-between gap-[var(--an-spacing-xl)]`}
        data-testid="agent-elements-shared-links-header"
      >
        <div className="min-w-0">
          <h3 className={chrome.title}>Shared Links</h3>
          <p className={chrome.description}>
            Manage links you've shared for files and sessions. Anyone with a link can view the content.
          </p>
        </div>
        {state === 'loaded' && shares.length > 0 && (
          <button
            className={`${chrome.secondaryButton} shrink-0 gap-[var(--an-spacing-xs)] px-[var(--an-spacing-md)] py-[var(--an-spacing-xs)] text-xs`}
            onClick={fetchShares}
            data-testid="agent-elements-shared-links-refresh"
          >
            <MaterialSymbol icon="refresh" size={14} />
            Refresh
          </button>
        )}
      </div>

      {/* Loading state */}
      {state === 'loading' && (
        <div
          className={loadingCardClass}
          data-testid="agent-elements-shared-links-loading"
        >
          <MaterialSymbol icon="progress_activity" size={20} className="animate-spin" />
          Loading shared links...
        </div>
      )}

      {/* Unauthenticated state */}
      {state === 'unauthenticated' && (
        <div
          className={`shared-links-unauthenticated ${centeredStateCardClass}`}
          data-testid="agent-elements-shared-links-unauthenticated"
        >
          <MaterialSymbol icon="account_circle" size={32} className={stateIconClass} />
          <p className={stateTextClass}>
            Sign in to share files and sessions.
          </p>
          <p className={stateSubtextClass}>
            Go to Account & Sync to set up your account.
          </p>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div
          className={`shared-links-error ${centeredStateCardClass}`}
          data-testid="agent-elements-shared-links-error"
        >
          <MaterialSymbol icon="error" size={32} className="mb-[var(--an-spacing-md)] text-[var(--an-error-color)]" />
          <p className={stateTextClass}>
            {errorMessage}
          </p>
          <button
            className={`${chrome.secondaryButton} gap-[var(--an-spacing-xs)] px-[var(--an-spacing-md)] py-[var(--an-spacing-xs)] text-xs`}
            onClick={fetchShares}
          >
            <MaterialSymbol icon="refresh" size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {state === 'loaded' && shares.length === 0 && (
        <div
          className={`shared-links-empty ${centeredStateCardClass}`}
          data-testid="agent-elements-shared-links-empty"
        >
          <MaterialSymbol icon="link" size={32} className={stateIconClass} />
          <p className={stateTextClass}>
            No shared links yet.
          </p>
          <p className={stateSubtextClass}>
            Right-click a file or session and select "Share link" to create one.
          </p>
        </div>
      )}

      {/* Shares list */}
      {state === 'loaded' && shares.length > 0 && (
        <div
          className={listClass}
          data-section="shared-links-list"
          data-testid="agent-elements-shared-links-list"
        >
          {shares.map((share) => (
            <div
              key={share.shareId}
              className={rowClass}
              data-testid={`agent-elements-shared-link-row-${share.shareId}`}
            >
              <div className="flex-1 min-w-0">
                <div className="mb-[var(--an-spacing-xs)] flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-sm)]">
                  <span className={shareTitleClass}>
                    {share.title || 'Untitled'}
                  </span>
                  <span className={shareBadgeClass}>
                    {getShareKindLabel(share)}
                  </span>
                  <span className={shareMetaClass}>
                    {share.viewCount} {share.viewCount === 1 ? 'view' : 'views'}
                  </span>
                </div>
                <div className={shareDetailClass}>
                  <span className="truncate">sync-dev.smartypants.ai/share/{share.shareId.slice(0, 8)}...</span>
                  <span>{formatDate(share.createdAt)}</span>
                  <span>{formatSize(share.sizeBytes)}</span>
                  {formatExpiry(share.expiresAt) && (
                    <span className={formatExpiry(share.expiresAt) === 'Expired' ? 'text-[var(--an-error-color)]' : ''}>
                      {formatExpiry(share.expiresAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-[var(--an-spacing-xs)]">
                <button
                  className={iconButtonClass}
                  title="Copy link"
                  onClick={() => handleCopyLink(share)}
                  data-testid={`agent-elements-shared-link-copy-${share.shareId}`}
                >
                  <MaterialSymbol icon={copiedId === share.shareId ? 'check' : 'content_copy'} size={14} />
                </button>
                <button
                  className={dangerIconButtonClass}
                  title="Delete shared link"
                  onClick={() => handleDelete(share)}
                  disabled={deletingId === share.shareId}
                  data-testid={`agent-elements-shared-link-delete-${share.shareId}`}
                >
                  <MaterialSymbol
                    icon={deletingId === share.shareId ? 'progress_activity' : 'delete'}
                    size={14}
                    className={deletingId === share.shareId ? 'animate-spin' : ''}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
