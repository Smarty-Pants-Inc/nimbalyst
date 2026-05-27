import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { usePostHog } from 'posthog-js/react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { useTheme } from '../../../hooks/useTheme';
import { marketplaceInstallProgressAtom } from '../../../store/atoms/appCommands';

// Registry types (mirror main process types)
interface RegistryExtension {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  categories: string[];
  tags: string[];
  icon: string;
  screenshots: Array<{ src: string; srcLight?: string; alt: string }>;
  downloads: number;
  featured: boolean;
  permissions: string[];
  minimumAppVersion: string;
  downloadUrl: string;
  checksum: string;
  repositoryUrl: string;
  changelog: string;
  tagline?: string;
  longDescription?: string;
  highlights?: string[];
  fileTypes?: string[];
}

interface RegistryCategory {
  id: string;
  name: string;
  icon: string;
}

interface RegistryData {
  schemaVersion: number;
  generatedAt: string;
  extensions: RegistryExtension[];
  categories: RegistryCategory[];
}

interface MarketplaceInstallRecord {
  extensionId: string;
  version: string;
  installedAt: string;
  updatedAt: string;
  source: 'marketplace' | 'github-url';
  githubUrl?: string;
}

interface InstalledExtensionInfo {
  id: string;
  path: string;
  isBuiltin: boolean;
  manifest: {
    name?: string;
    version?: string;
    description?: string;
    author?: string;
    icon?: string;
  };
}

type InstallStatus = 'idle' | 'installing' | 'installed' | 'error';

interface ExtensionMarketplaceInstallRequest {
  extensionId: string;
  requestedAt: string;
  token: number;
}

interface ExtensionMarketplacePanelProps {
  installRequest?: ExtensionMarketplaceInstallRequest | null;
  onInstallRequestHandled?: (token: number) => void;
  onViewInstalled?: () => void;
}

// Category icon map (Material Symbols)
const CATEGORY_ICONS: Record<string, string> = {
  'developer-tools': 'code',
  'diagrams': 'brush',
  'data': 'table_chart',
  'ai-tools': 'auto_awesome',
  'themes': 'palette',
  'writing': 'edit_note',
  'knowledge': 'psychology',
  'integrations': 'link',
};

const panelClass =
  'provider-panel extension-marketplace-panel agent-elements-extension-marketplace-panel agent-elements-settings-panel flex flex-col';
const headerClass =
  'provider-panel-header extension-marketplace-header agent-elements-settings-panel-header flex items-start justify-between gap-[var(--an-spacing-xl)] border-b border-[var(--an-border-color)] pb-[var(--an-spacing-xl)]';
const sectionTitleClass =
  'm-0 mb-[var(--an-spacing-md)] border-b border-[var(--an-border-color)] pb-[var(--an-spacing-sm)] text-xs font-semibold text-[var(--an-foreground-subtle)]';
const iconTileClass =
  'inline-flex shrink-0 items-center justify-center rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)]';
const inputClass =
  'rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] text-[var(--an-input-color)] outline-none transition-[border-color,background-color,color] duration-150 ease-out placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-border)] focus:ring-2 focus:ring-[var(--an-focus-ring)]';
const buttonBaseClass =
  'inline-flex cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] rounded-[var(--an-small-border-radius)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-sm font-medium transition-[background-color,border-color,color,opacity] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60';
const primaryButtonClass =
  `${buttonBaseClass} border border-transparent bg-[var(--an-button-primary-bg)] text-[var(--an-button-primary-text)] hover:opacity-90`;
const secondaryButtonClass =
  `${buttonBaseClass} border border-[var(--an-border-color)] bg-transparent text-[var(--an-foreground-muted)] hover:border-[var(--an-border-color-strong)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]`;
const dangerButtonClass =
  `${buttonBaseClass} border border-[color-mix(in_srgb,var(--an-error-color)_40%,var(--an-border-color))] bg-transparent text-[var(--an-error-color)] hover:bg-[color-mix(in_srgb,var(--an-error-color)_10%,var(--an-background))]`;
const subduedButtonClass =
  `${buttonBaseClass} border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)]`;
const statusPillClass =
  'agent-elements-status-pill inline-flex items-center rounded-[var(--an-small-border-radius)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-[11px] font-medium';
const spaciousCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)]';
const roomyCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-xxl)] [--agent-elements-card-inline-padding:var(--an-spacing-xxl)]';

export function ExtensionMarketplacePanel({
  installRequest = null,
  onInstallRequestHandled,
  onViewInstalled,
}: ExtensionMarketplacePanelProps) {
  const posthog = usePostHog();
  const { theme } = useTheme();

  // All hooks must be declared before any early returns
  const [hasAcceptedRisk, setHasAcceptedRisk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<RegistryData | null>(null);
  const [installedExtensions, setInstalledExtensions] = useState<Record<string, MarketplaceInstallRecord>>({});
  const [allInstalledExtensions, setAllInstalledExtensions] = useState<InstalledExtensionInfo[]>([]);
  const allInstalledIds = useMemo(() => new Set(allInstalledExtensions.map(e => e.id)), [allInstalledExtensions]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedExtension, setSelectedExtension] = useState<RegistryExtension | null>(null);
  const [installStatus, setInstallStatus] = useState<Record<string, InstallStatus>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubInstalling, setGithubInstalling] = useState(false);
  const [availableUpdates, setAvailableUpdates] = useState<Record<string, { currentVersion: string; availableVersion: string }>>({});

  // GitHub-install progress: the central listener bumps an atom on every
  // install-progress IPC event. We watch the atom only while an install is
  // active, and ignore versions that arrived before this install started.
  const installProgress = useAtomValue(marketplaceInstallProgressAtom);
  const installProgressBaselineRef = useRef<number>(0);
  useEffect(() => {
    if (!githubInstalling || !installProgress) return;
    if (installProgress.version <= installProgressBaselineRef.current) return;
    setStatusMessage(installProgress.message);
  }, [githubInstalling, installProgress]);

  // Check if user has previously accepted the marketplace risk warning
  useEffect(() => {
    window.electronAPI.invoke('app-settings:get', 'marketplaceRiskAccepted').then((accepted: boolean) => {
      setHasAcceptedRisk(!!accepted);
    }).catch(() => {
      setHasAcceptedRisk(false);
    });
  }, []);

  useEffect(() => {
    if (hasAcceptedRisk) {
      loadData();
      posthog?.capture('extension_marketplace_viewed');
    }
  }, [hasAcceptedRisk]);

  useEffect(() => {
    if (!installRequest || !hasAcceptedRisk || !registry) return;

    const requestedExtension = registry.extensions.find((extension) => extension.id === installRequest.extensionId);
    if (!requestedExtension) {
      setStatusMessage(`Extension ${installRequest.extensionId} was not found in the marketplace`);
      onInstallRequestHandled?.(installRequest.token);

      const timeoutId = window.setTimeout(() => setStatusMessage(''), 5000);
      return () => window.clearTimeout(timeoutId);
    }

    setSelectedCategory(null);
    setSearchQuery('');
    setSelectedExtension(requestedExtension);
    setStatusMessage(`Review ${requestedExtension.name} before installing it from the marketplace`);
    onInstallRequestHandled?.(installRequest.token);

    const timeoutId = window.setTimeout(() => setStatusMessage(''), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [installRequest, hasAcceptedRisk, onInstallRequestHandled, registry]);

  const handleAcceptRisk = async () => {
    await window.electronAPI.invoke('app-settings:set', 'marketplaceRiskAccepted', true);
    setHasAcceptedRisk(true);
    posthog?.capture('extension_marketplace_risk_accepted');
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [registryResult, installedResult, allExtensionsResult, updatesResult] = await Promise.all([
        window.electronAPI.invoke('extension-marketplace:fetch-registry'),
        window.electronAPI.invoke('extension-marketplace:get-installed'),
        window.electronAPI.invoke('extensions:list-installed'),
        window.electronAPI.invoke('extension-marketplace:check-updates'),
      ]);

      if (registryResult.success) {
        setRegistry(registryResult.data);
      } else {
        setError(registryResult.error || 'Failed to load marketplace');
      }

      if (installedResult.success) {
        setInstalledExtensions(installedResult.data || {});
      }

      // Track all installed extension IDs (built-in + user-installed)
      if (Array.isArray(allExtensionsResult)) {
        setAllInstalledExtensions(allExtensionsResult as InstalledExtensionInfo[]);
      }

      if (updatesResult.success && Array.isArray(updatesResult.data)) {
        const updateMap: Record<string, { currentVersion: string; availableVersion: string }> = {};
        for (const u of updatesResult.data) {
          updateMap[u.extensionId] = { currentVersion: u.currentVersion, availableVersion: u.availableVersion };
        }
        setAvailableUpdates(updateMap);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load marketplace data';
      console.error('Failed to load marketplace data:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = useCallback(async (extension: RegistryExtension) => {
    setInstallStatus(prev => ({ ...prev, [extension.id]: 'installing' }));
    setStatusMessage(`Installing ${extension.name}...`);

    try {
      const result = await window.electronAPI.invoke(
        'extension-marketplace:install',
        extension.id,
        extension.downloadUrl,
        extension.checksum,
        extension.version,
      );

      if (result.success) {
        setInstallStatus(prev => ({ ...prev, [extension.id]: 'installed' }));
        setStatusMessage(`${extension.name} installed successfully`);

        posthog?.capture('extension_marketplace_installed', {
          extensionId: extension.id,
          source: 'marketplace',
          category: extension.categories[0],
        });

        // Refresh installed list
        const [installedResult, allExtensionsResult] = await Promise.all([
          window.electronAPI.invoke('extension-marketplace:get-installed'),
          window.electronAPI.invoke('extensions:list-installed'),
        ]);
        if (installedResult.success) {
          setInstalledExtensions(installedResult.data || {});
        }
        if (Array.isArray(allExtensionsResult)) {
          setAllInstalledExtensions(allExtensionsResult as InstalledExtensionInfo[]);
        }
      } else {
        setInstallStatus(prev => ({ ...prev, [extension.id]: 'error' }));
        setStatusMessage(result.error || 'Installation failed');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Installation failed';
      setInstallStatus(prev => ({ ...prev, [extension.id]: 'error' }));
      setStatusMessage(errorMessage);
    }

    setTimeout(() => setStatusMessage(''), 5000);
  }, [posthog]);

  const handleUninstall = useCallback(async (extensionId: string) => {
    const ext = registry?.extensions.find(e => e.id === extensionId);
    const name = ext?.name || extensionId;

    setStatusMessage(`Uninstalling ${name}...`);

    try {
      const result = await window.electronAPI.invoke('extension-marketplace:uninstall', extensionId);

      if (result.success) {
        setInstallStatus(prev => ({ ...prev, [extensionId]: 'idle' }));
        setStatusMessage(`${name} uninstalled`);

        posthog?.capture('extension_marketplace_uninstalled', { extensionId });

        const [installedResult, allExtensionsResult] = await Promise.all([
          window.electronAPI.invoke('extension-marketplace:get-installed'),
          window.electronAPI.invoke('extensions:list-installed'),
        ]);
        if (installedResult.success) {
          setInstalledExtensions(installedResult.data || {});
        }
        if (Array.isArray(allExtensionsResult)) {
          setAllInstalledExtensions(allExtensionsResult as InstalledExtensionInfo[]);
        }
      } else {
        setStatusMessage(result.error || 'Uninstall failed');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Uninstall failed';
      setStatusMessage(errorMessage);
    }

    setTimeout(() => setStatusMessage(''), 5000);
  }, [registry, posthog]);

  const handleGithubInstall = useCallback(async () => {
    if (!githubUrl.trim()) return;

    // Baseline the progress atom version so we only react to events emitted
    // by this install, not stale ones from a previous run.
    installProgressBaselineRef.current = installProgress?.version ?? 0;
    setGithubInstalling(true);
    setStatusMessage(`Installing from GitHub...`);

    try {
      const result = await window.electronAPI.invoke('extension-marketplace:install-from-github', githubUrl.trim());

      if (result.success) {
        setStatusMessage(`Extension installed from GitHub`);
        setGithubUrl('');

        posthog?.capture('extension_marketplace_installed', {
          extensionId: result.extensionId,
          source: 'github-url',
        });

        const installedResult = await window.electronAPI.invoke('extension-marketplace:get-installed');
        if (installedResult.success) {
          setInstalledExtensions(installedResult.data || {});
        }
      } else {
        setStatusMessage(result.error || 'GitHub installation failed');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'GitHub installation failed';
      setStatusMessage(errorMessage);
    } finally {
      setGithubInstalling(false);
    }

    setTimeout(() => setStatusMessage(''), 5000);
  }, [githubUrl, posthog, installProgress?.version]);

  const isExtensionInstalled = useCallback((extensionId: string): boolean => {
    return !!installedExtensions[extensionId] || allInstalledIds.has(extensionId);
  }, [installedExtensions, allInstalledIds]);

  const isBuiltinExtension = useCallback((extensionId: string): boolean => {
    return allInstalledIds.has(extensionId) && !installedExtensions[extensionId];
  }, [installedExtensions, allInstalledIds]);

  const getAvailableUpdate = useCallback((extensionId: string) => {
    return availableUpdates[extensionId] || null;
  }, [availableUpdates]);

  const handleUpdate = useCallback(async (extension: RegistryExtension) => {
    setInstallStatus(prev => ({ ...prev, [extension.id]: 'installing' }));
    setStatusMessage(`Updating ${extension.name} to v${extension.version}...`);

    try {
      const result = await window.electronAPI.invoke(
        'extension-marketplace:install',
        extension.id,
        extension.downloadUrl,
        extension.checksum,
        extension.version,
      );

      if (result.success) {
        setInstallStatus(prev => ({ ...prev, [extension.id]: 'installed' }));
        setStatusMessage(`${extension.name} updated to v${extension.version}`);
        setAvailableUpdates(prev => {
          const next = { ...prev };
          delete next[extension.id];
          return next;
        });

        posthog?.capture('extension_marketplace_updated', {
          extensionId: extension.id,
          fromVersion: availableUpdates[extension.id]?.currentVersion,
          toVersion: extension.version,
        });

        const [installedResult, allExtensionsResult] = await Promise.all([
          window.electronAPI.invoke('extension-marketplace:get-installed'),
          window.electronAPI.invoke('extensions:list-installed'),
        ]);
        if (installedResult.success) {
          setInstalledExtensions(installedResult.data || {});
        }
        if (Array.isArray(allExtensionsResult)) {
          setAllInstalledExtensions(allExtensionsResult as InstalledExtensionInfo[]);
        }
      } else {
        setInstallStatus(prev => ({ ...prev, [extension.id]: 'error' }));
        setStatusMessage(result.error || 'Update failed');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Update failed';
      setInstallStatus(prev => ({ ...prev, [extension.id]: 'error' }));
      setStatusMessage(errorMessage);
    }

    setTimeout(() => setStatusMessage(''), 5000);
  }, [posthog, availableUpdates]);

  const handleUpdateAll = useCallback(async () => {
    if (!registry) return;
    const updateIds = Object.keys(availableUpdates);
    if (updateIds.length === 0) return;

    setStatusMessage(`Updating ${updateIds.length} extension${updateIds.length > 1 ? 's' : ''}...`);

    for (const extId of updateIds) {
      const ext = registry.extensions.find(e => e.id === extId);
      if (ext) await handleUpdate(ext);
    }
  }, [registry, availableUpdates, handleUpdate]);

  // Filter extensions
  const filteredExtensions = useMemo(() => {
    if (!registry) return [];
    return registry.extensions.filter(ext => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches = ext.name.toLowerCase().includes(query) ||
          ext.description.toLowerCase().includes(query) ||
          ext.author.toLowerCase().includes(query) ||
          ext.tags.some(t => t.toLowerCase().includes(query)) ||
          (ext.tagline && ext.tagline.toLowerCase().includes(query));
        if (!matches) return false;
      }
      // Category filter
      if (selectedCategory) {
        if (!ext.categories.includes(selectedCategory)) return false;
      }
      return true;
    });
  }, [registry, searchQuery, selectedCategory]);

  // Group by category
  const extensionsByCategory = useMemo(() => {
    const grouped: Record<string, RegistryExtension[]> = {};
    filteredExtensions.forEach(ext => {
      const cat = ext.categories[0] || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(ext);
    });
    return grouped;
  }, [filteredExtensions]);

  // Featured extensions
  const featuredExtensions = useMemo(() => {
    return filteredExtensions.filter(e => e.featured);
  }, [filteredExtensions]);

  // Show loading state while checking risk acceptance
  if (hasAcceptedRisk === null) {
    return (
      <div className={panelClass} data-component="ExtensionMarketplacePanel" data-agent-elements-shell="extension-marketplace-panel">
        <div className="p-8 text-center text-[var(--an-foreground-muted)]">Loading...</div>
      </div>
    );
  }

  // Show security warning if not yet accepted
  if (!hasAcceptedRisk) {
    return (
      <div
        className={panelClass}
        data-component="ExtensionMarketplacePanel"
        data-agent-elements-shell="extension-marketplace-panel"
        data-testid="extension-marketplace-panel"
      >
        <div
          className={headerClass}
          data-agent-elements-shell="extension-marketplace-header"
          data-testid="agent-elements-extension-marketplace-header"
        >
          <div>
            <h3 className="m-0 mb-[var(--an-spacing-xs)] text-xl font-semibold leading-tight text-[var(--an-foreground)]">Extension Marketplace</h3>
            <p className="m-0 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
              Discover and install extensions to enhance your Smarty Code workspace.
            </p>
          </div>
        </div>

        <div
          className={`agent-elements-marketplace-risk-warning agent-elements-tool-card flex flex-col gap-[var(--an-spacing-xl)] border-[color-mix(in_srgb,var(--an-warning-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_8%,var(--an-background))] ${roomyCardPaddingClass}`}
          data-agent-elements-shell="marketplace-risk-warning"
          data-testid="agent-elements-marketplace-risk-warning"
        >
          <div className="flex items-start gap-[var(--an-spacing-md)]">
            <span aria-hidden="true" className={`${iconTileClass} h-9 w-9 text-[var(--an-warning-color)]`}>
              <MaterialSymbol icon="warning" size={20} />
            </span>
            <div>
              <h4 className="m-0 mb-[var(--an-spacing-sm)] text-base font-semibold text-[var(--an-foreground)]">Security Warning</h4>
              <div className="flex flex-col gap-[var(--an-spacing-md)] text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                <p className="m-0">
                  Extensions run with access to your local file system and can execute code on your machine.
                  Installing untrusted extensions may pose security risks including:
                </p>
                <ul className="m-0 flex list-disc flex-col gap-[var(--an-spacing-xs)] pl-5">
                  <li>Reading or modifying files on your computer</li>
                  <li>Executing arbitrary code in the application context</li>
                  <li>Accessing network resources</li>
                  <li>Interacting with other installed extensions</li>
                </ul>
                <p className="m-0">
                  Only install extensions from sources you trust. Smarty Code does not review or verify
                  third-party extensions installed from GitHub URLs. Marketplace extensions published
                  by Smarty Code are reviewed for safety.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[var(--an-spacing-md)] border-t border-[var(--an-border-color)] pt-[var(--an-spacing-md)]">
            <button
              className={primaryButtonClass}
              onClick={handleAcceptRisk}
              data-testid="marketplace-accept-risk"
            >
              I understand the risks
            </button>
            <span className="text-xs text-[var(--an-foreground-subtle)]">
              You can reset this in Settings &gt; Advanced
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={panelClass} data-component="ExtensionMarketplacePanel" data-agent-elements-shell="extension-marketplace-panel">
        <div className="p-8 text-center text-[var(--an-foreground-muted)]">Loading marketplace...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={panelClass} data-component="ExtensionMarketplacePanel" data-agent-elements-shell="extension-marketplace-panel">
        <div className={`agent-elements-tool-card flex items-center justify-center gap-[var(--an-spacing-md)] text-center text-[var(--an-error-color)] ${roomyCardPaddingClass}`}>
          Error: {error}
          <button
            onClick={loadData}
            className={primaryButtonClass}
            data-testid="marketplace-retry"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const renderExtensionCard = (ext: RegistryExtension) => {
    const installed = isExtensionInstalled(ext.id);
    const update = getAvailableUpdate(ext.id);
    const status = installStatus[ext.id] || 'idle';
    const categoryIcon = CATEGORY_ICONS[ext.categories[0]] || 'extension';
    const cardToneClass = update
      ? 'border-[color-mix(in_srgb,var(--an-primary-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_7%,var(--an-background))]'
      : installed
        ? 'border-[color-mix(in_srgb,var(--an-success-color)_30%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_7%,var(--an-background))]'
        : 'border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)]';

    return (
      <div
        key={ext.id}
        className={`agent-elements-extension-card agent-elements-tool-card flex cursor-pointer flex-col transition-[background-color,border-color,color] duration-150 ease-out ${spaciousCardPaddingClass} ${cardToneClass} hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--an-focus-ring)]`}
        onClick={() => setSelectedExtension(ext)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedExtension(ext);
          }
        }}
        data-component="ExtensionMarketplaceCard"
        data-agent-elements-shell="extension-card"
        data-installed={String(installed)}
        data-update-available={String(!!update)}
        data-status={status}
        data-testid={`marketplace-card-${ext.id}`}
      >
        <div className="mb-[var(--an-spacing-sm)] flex items-center gap-[var(--an-spacing-md)]">
          <span aria-hidden="true" className={`${iconTileClass} h-8 w-8`}>
            <MaterialSymbol icon={categoryIcon} size={18} />
          </span>
          <div className="truncate text-[0.9375rem] font-semibold text-[var(--an-foreground)]">{ext.name}</div>
        </div>
        <div className="mb-[var(--an-spacing-md)] line-clamp-2 flex-1 text-[0.8125rem] leading-relaxed text-[var(--an-foreground-muted)]">{ext.tagline || ext.description}</div>
        <div className="flex items-center justify-between gap-[var(--an-spacing-sm)]">
          <div className="flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-sm)]">
            <span className="text-xs text-[var(--an-foreground-subtle)]">by {ext.author}</span>
            {ext.downloads > 0 && (
              <span className="text-xs text-[var(--an-foreground-subtle)]">
                {ext.downloads.toLocaleString()} installs
              </span>
            )}
          </div>
          {update ? (
            <button
              className={status === 'installing' ? subduedButtonClass : primaryButtonClass}
              onClick={(e) => {
                e.stopPropagation();
                handleUpdate(ext);
              }}
              disabled={status === 'installing'}
              data-testid={`marketplace-update-${ext.id}`}
            >
              {status === 'installing' ? 'Updating...' : `Update to v${update.availableVersion}`}
            </button>
          ) : installed ? (
            <span
              className={`${statusPillClass} ${
                isBuiltinExtension(ext.id)
                  ? 'border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)]'
                  : 'border border-[color-mix(in_srgb,var(--an-success-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_10%,var(--an-background))] text-[var(--an-success-color)]'
              }`}
            >
              {isBuiltinExtension(ext.id) ? 'Built-in' : 'Installed'}
            </span>
          ) : (
            <button
              className={status === 'installing' ? subduedButtonClass : primaryButtonClass}
              onClick={(e) => {
                e.stopPropagation();
                handleInstall(ext);
              }}
              disabled={status === 'installing'}
              data-testid={`marketplace-install-${ext.id}`}
            >
              {status === 'installing' ? 'Installing...' : 'Install'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderDiscover = () => (
    <div
      className="agent-elements-extension-marketplace-discover"
      data-agent-elements-shell="extension-marketplace-discover"
      data-testid="agent-elements-extension-marketplace-discover"
      role="main"
    >
      {/* Search */}
      <div className="relative mb-[var(--an-spacing-xl)]" role="search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search extensions..."
          className={`${inputClass} w-full py-[var(--an-spacing-lg)] pl-[var(--an-spacing-xl)] pr-10 text-[0.9375rem]`}
          data-testid="marketplace-search"
          autoFocus
        />
        {searchQuery && (
          <button
            aria-label="Clear marketplace search"
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-transparent bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-border-color)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-focus-ring)]"
            onClick={() => setSearchQuery('')}
            data-testid="marketplace-search-clear"
          >
            <MaterialSymbol icon="close" size={14} />
          </button>
        )}
      </div>

      {/* Category Chips */}
      {registry && (
        <div className="mb-[var(--an-spacing-xxl)] flex flex-wrap gap-[var(--an-spacing-sm)]" data-testid="marketplace-categories">
          <button
            className={`${buttonBaseClass} py-[var(--an-spacing-xs)] text-xs ${
              !selectedCategory
                ? 'border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-button-primary-text)]'
                : 'border border-[var(--an-border-color)] bg-transparent text-[var(--an-foreground-muted)] hover:border-[var(--an-primary-color)] hover:text-[var(--an-foreground)]'
            }`}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {registry.categories.map(cat => {
            const count = registry.extensions.filter(e => e.categories.includes(cat.id)).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.id}
                className={`${buttonBaseClass} py-[var(--an-spacing-xs)] text-xs ${
                  selectedCategory === cat.id
                    ? 'border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-button-primary-text)]'
                    : 'border border-[var(--an-border-color)] bg-transparent text-[var(--an-foreground-muted)] hover:border-[var(--an-primary-color)] hover:text-[var(--an-foreground)]'
                }`}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Featured (only when no search/category filter) */}
      {!searchQuery && !selectedCategory && featuredExtensions.length > 0 && (
        <div className="mb-[var(--an-spacing-xxl)]">
          <h4 className={sectionTitleClass}>
            Featured
          </h4>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[var(--an-spacing-md)]">
            {featuredExtensions.map(renderExtensionCard)}
          </div>
        </div>
      )}

      {/* By Category */}
      {(searchQuery || selectedCategory) ? (
        // Flat list when searching/filtering
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[var(--an-spacing-md)]">
          {filteredExtensions.map(renderExtensionCard)}
        </div>
      ) : (
        // Grouped by category
        registry?.categories.map(cat => {
          const exts = extensionsByCategory[cat.id];
          if (!exts || exts.length === 0) return null;
          // Skip featured-only duplicates
          const nonFeatured = exts.filter(e => !e.featured);
          if (nonFeatured.length === 0) return null;

          return (
            <div key={cat.id} className="mb-[var(--an-spacing-xxl)]">
              <h4 className={sectionTitleClass}>
                {cat.name}
              </h4>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[var(--an-spacing-md)]">
                {nonFeatured.map(renderExtensionCard)}
              </div>
            </div>
          );
        })
      )}

      {/* No results */}
      {filteredExtensions.length === 0 && searchQuery && (
        <div className={`agent-elements-tool-card text-center text-[0.9375rem] text-[var(--an-foreground-subtle)] ${roomyCardPaddingClass}`}>
          No extensions match "{searchQuery}"
        </div>
      )}

      {/* Install from GitHub URL */}
      <div className="mt-8 border-t border-[var(--an-border-color)] pt-[var(--an-spacing-xxl)]">
        <h4 className={sectionTitleClass}>
          Install from GitHub
        </h4>
        <div className="flex gap-[var(--an-spacing-sm)]">
          <input
            type="text"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/user/nimbalyst-extension"
            className={`${inputClass} flex-1 px-[var(--an-spacing-md)] py-[var(--an-spacing-md)] text-sm`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGithubInstall();
            }}
            data-testid="marketplace-github-url"
          />
          <button
            className={primaryButtonClass}
            onClick={handleGithubInstall}
            disabled={githubInstalling || !githubUrl.trim()}
            data-testid="marketplace-github-install"
          >
            {githubInstalling ? 'Installing...' : 'Install'}
          </button>
        </div>
        <p className="m-0 mt-[var(--an-spacing-sm)] text-xs text-[var(--an-foreground-subtle)]">
          Paste a GitHub repository URL containing a Smarty Code extension with a manifest.json file.
        </p>
      </div>
    </div>
  );

  const renderExtensionDetails = () => {
    if (!selectedExtension) return null;

    const installed = isExtensionInstalled(selectedExtension.id);
    const update = getAvailableUpdate(selectedExtension.id);
    const status = installStatus[selectedExtension.id] || 'idle';

    return (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_20%,transparent)] p-4"
        onClick={() => setSelectedExtension(null)}
        data-agent-elements-shell="extension-detail-overlay"
        data-testid="marketplace-details-overlay"
      >
        <div
          className={`agent-elements-extension-detail-dialog agent-elements-tool-card relative flex max-h-[80vh] w-full max-w-[500px] flex-col overflow-y-auto rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] ${roomyCardPaddingClass}`}
          onClick={(e) => e.stopPropagation()}
          data-agent-elements-shell="extension-detail-dialog"
          data-testid="agent-elements-extension-detail-dialog"
        >
          <button
            aria-label="Close extension details"
            className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-transparent bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-border-color)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-focus-ring)]"
            onClick={() => setSelectedExtension(null)}
          >
            <MaterialSymbol icon="close" size={16} />
          </button>

          <div className="mb-[var(--an-spacing-xl)] flex items-center gap-[var(--an-spacing-xl)]">
            <span aria-hidden="true" className={`${iconTileClass} h-12 w-12 text-[var(--an-primary-color)]`}>
              <MaterialSymbol icon={CATEGORY_ICONS[selectedExtension.categories[0]] || 'extension'} size={24} />
            </span>
            <div>
              <h3 className="m-0 mb-[var(--an-spacing-xs)] text-lg font-semibold text-[var(--an-foreground)]">{selectedExtension.name}</h3>
              <span className="text-[0.8125rem] text-[var(--an-foreground-subtle)]">by {selectedExtension.author}</span>
            </div>
          </div>

          {selectedExtension.tagline && (
            <p className="m-0 mb-[var(--an-spacing-sm)] text-[0.9375rem] font-medium leading-relaxed text-[var(--an-foreground)]">
              {selectedExtension.tagline}
            </p>
          )}

          <p className="m-0 mb-[var(--an-spacing-xl)] text-[0.875rem] leading-relaxed text-[var(--an-foreground-muted)]">
            {selectedExtension.longDescription || selectedExtension.description}
          </p>

          {/* Highlights */}
          {selectedExtension.highlights && selectedExtension.highlights.length > 0 && (
            <ul className="m-0 mb-[var(--an-spacing-xxl)] flex list-disc flex-col gap-[var(--an-spacing-xs)] pl-5">
              {selectedExtension.highlights.map((h, idx) => (
                <li key={idx} className="text-[0.8125rem] leading-relaxed text-[var(--an-foreground-muted)]">{h}</li>
              ))}
            </ul>
          )}

          {/* Screenshots (theme-aware: use light variant when available) */}
          {selectedExtension.screenshots && selectedExtension.screenshots.length > 0 && (
            <div className="mb-[var(--an-spacing-xxl)] flex flex-col gap-[var(--an-spacing-sm)]">
              {selectedExtension.screenshots.map((ss, idx) => {
                const imgSrc = (theme === 'light' && ss.srcLight) ? ss.srcLight : ss.src;
                return (
                  <img
                    key={idx}
                    src={imgSrc}
                    alt={ss.alt}
                    className="max-h-[300px] w-full rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] object-cover"
                    loading="lazy"
                    data-testid={`marketplace-screenshot-${idx}`}
                  />
                );
              })}
            </div>
          )}

          {update && (
            <div className="mb-[var(--an-spacing-xl)] flex items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-small-border-radius)] border border-[color-mix(in_srgb,var(--an-primary-color)_30%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_9%,var(--an-background))] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)]">
              <MaterialSymbol icon="upgrade" size={18} className="text-[var(--an-primary-color)]" />
              <span className="text-sm text-[var(--an-foreground)]">
                Update available: v{update.currentVersion} &rarr; v{update.availableVersion}
              </span>
            </div>
          )}

          <div
            className="agent-elements-tool-card-bordered mb-[var(--an-spacing-xxl)] flex flex-col gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-md)]"
            data-agent-elements-shell="extension-detail-meta"
            data-testid="agent-elements-extension-detail-meta"
          >
            <div className="flex items-center gap-[var(--an-spacing-sm)] text-[0.8125rem]">
              <span className="text-[var(--an-foreground-subtle)]">Version:</span>
              <span className="font-medium text-[var(--an-foreground)]">
                {update ? `${update.currentVersion} (latest: ${update.availableVersion})` : selectedExtension.version}
              </span>
            </div>
            <div className="flex items-center gap-[var(--an-spacing-sm)] text-[0.8125rem]">
              <span className="text-[var(--an-foreground-subtle)]">Category:</span>
              <span className="font-medium text-[var(--an-foreground)]">
                {registry?.categories.find(c => c.id === selectedExtension.categories[0])?.name || selectedExtension.categories[0]}
              </span>
            </div>
            {selectedExtension.fileTypes && selectedExtension.fileTypes.length > 0 && (
              <div className="flex items-center gap-[var(--an-spacing-sm)] text-[0.8125rem]">
                <span className="text-[var(--an-foreground-subtle)]">File types:</span>
                <div className="flex flex-wrap gap-[var(--an-spacing-xs)]">
                  {selectedExtension.fileTypes.map(ft => (
                    <span key={ft} className={`${statusPillClass} border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] font-mono text-[var(--an-foreground-muted)]`}>
                      {ft}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedExtension.permissions.length > 0 && (
              <div className="flex items-center gap-[var(--an-spacing-sm)] text-[0.8125rem]">
                <span className="text-[var(--an-foreground-subtle)]">Permissions:</span>
                <div className="flex flex-wrap gap-[var(--an-spacing-xs)]">
                  {selectedExtension.permissions.map(p => (
                    <span key={p} className={`${statusPillClass} border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)]`}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedExtension.downloads > 0 && (
              <div className="flex items-center gap-[var(--an-spacing-sm)] text-[0.8125rem]">
                <span className="text-[var(--an-foreground-subtle)]">Downloads:</span>
                <span className="font-medium text-[var(--an-foreground)]">{selectedExtension.downloads.toLocaleString()}</span>
              </div>
            )}
            {selectedExtension.repositoryUrl && (
              <div className="flex items-center gap-[var(--an-spacing-sm)] text-[0.8125rem]">
                <span className="text-[var(--an-foreground-subtle)]">Repository:</span>
                <a
                  href="#"
                  className="cursor-pointer text-[var(--an-primary-color)] no-underline hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    window.electronAPI.openExternal(selectedExtension.repositoryUrl);
                  }}
                >
                  View on GitHub
                </a>
              </div>
            )}
          </div>

          {/* Changelog */}
          {selectedExtension.changelog && (
            <div className="mb-[var(--an-spacing-xxl)]">
              <h4 className="mb-[var(--an-spacing-sm)] text-sm font-semibold text-[var(--an-foreground)]">Changelog</h4>
              <pre className="m-0 whitespace-pre-wrap rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-md)] font-mono text-xs text-[var(--an-foreground-muted)]">
                {selectedExtension.changelog}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-[var(--an-spacing-md)]">
            {update ? (
              <>
                <button
                  className={`flex-1 ${status === 'installing' ? subduedButtonClass : primaryButtonClass}`}
                  onClick={() => handleUpdate(selectedExtension)}
                  disabled={status === 'installing'}
                >
                  {status === 'installing' ? 'Updating...' : `Update to v${update.availableVersion}`}
                </button>
                <button
                  className={dangerButtonClass}
                  onClick={() => {
                    handleUninstall(selectedExtension.id);
                    setSelectedExtension(null);
                  }}
                >
                  Uninstall
                </button>
              </>
            ) : installed ? (
              <>
                <span className={`${statusPillClass} ${
                  isBuiltinExtension(selectedExtension.id)
                    ? 'border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)]'
                    : 'border border-[color-mix(in_srgb,var(--an-success-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-success-color)_10%,var(--an-background))] text-[var(--an-success-color)]'
                }`}>
                  {isBuiltinExtension(selectedExtension.id) ? 'Built-in' : 'Installed'}
                </span>
                {!isBuiltinExtension(selectedExtension.id) && (
                  <button
                    className={dangerButtonClass}
                    onClick={() => {
                      handleUninstall(selectedExtension.id);
                      setSelectedExtension(null);
                    }}
                  >
                    Uninstall
                  </button>
                )}
              </>
            ) : (
              <button
                className={`flex-1 ${status === 'installing' ? subduedButtonClass : primaryButtonClass}`}
                onClick={() => handleInstall(selectedExtension)}
                disabled={status === 'installing'}
              >
                {status === 'installing' ? 'Installing...' : 'Install Extension'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const devExtensionCount = allInstalledExtensions.filter(
    e => !e.isBuiltin && !installedExtensions[e.id]
  ).length;
  const installedCount = Object.keys(installedExtensions).length + devExtensionCount;
  const updateCount = Object.keys(availableUpdates).length;

  return (
    <div
      className={panelClass}
      data-component="ExtensionMarketplacePanel"
      data-agent-elements-shell="extension-marketplace-panel"
      data-testid="extension-marketplace-panel"
    >
      <div
        className={headerClass}
        data-agent-elements-shell="extension-marketplace-header"
        data-testid="agent-elements-extension-marketplace-header"
      >
        <div>
          <h3 className="m-0 mb-[var(--an-spacing-xs)] text-xl font-semibold leading-tight text-[var(--an-foreground)]">Extension Marketplace</h3>
          <p className="m-0 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
            Discover and install extensions to enhance your Smarty Code workspace.
          </p>
        </div>
        {onViewInstalled && (
          <button
            className={`${secondaryButtonClass} shrink-0 text-xs`}
            onClick={onViewInstalled}
            data-testid="marketplace-view-installed"
          >
            <MaterialSymbol icon="extension" size={16} />
            Installed ({installedCount}){updateCount > 0 && ` • ${updateCount} update${updateCount > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className="agent-elements-marketplace-status mb-[var(--an-spacing-xl)] rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-sm text-[var(--an-foreground-muted)]">
          {statusMessage}
        </div>
      )}

      {renderDiscover()}
      {renderExtensionDetails()}
    </div>
  );
}
