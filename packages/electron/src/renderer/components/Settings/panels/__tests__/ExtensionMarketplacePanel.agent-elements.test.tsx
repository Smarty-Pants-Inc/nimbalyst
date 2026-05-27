// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  capture: vi.fn(),
  riskAccepted: true,
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockState.capture }),
}));

vi.mock('../../../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size, className }: { icon: string; size?: number; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

import { ExtensionMarketplacePanel } from '../ExtensionMarketplacePanel';

const registry = {
  schemaVersion: 1,
  generatedAt: '2026-05-25T00:00:00.000Z',
  categories: [
    { id: 'developer-tools', name: 'Developer Tools', icon: 'code' },
    { id: 'diagrams', name: 'Diagrams', icon: 'brush' },
  ],
  extensions: [
    {
      id: 'smarty-chart',
      name: 'Smarty Chart',
      description: 'Render structured data as charts.',
      version: '1.2.0',
      author: 'Smarty',
      categories: ['developer-tools'],
      tags: ['charts', 'data'],
      icon: 'bar_chart',
      screenshots: [{ src: 'dark.png', srcLight: 'light.png', alt: 'Chart preview' }],
      downloads: 1250,
      featured: true,
      permissions: ['filesystem'],
      minimumAppVersion: '0.61.0',
      downloadUrl: 'https://example.com/chart.zip',
      checksum: 'sha256-chart',
      repositoryUrl: 'https://github.com/smarty/chart',
      changelog: 'Improved chart rendering.',
      tagline: 'Charts for agent output.',
      longDescription: 'Render structured data as polished charts inside Smarty Code.',
      highlights: ['Theme-aware previews', 'Agent-friendly output'],
      fileTypes: ['.chart.json'],
    },
    {
      id: 'diagram-kit',
      name: 'Diagram Kit',
      description: 'Build diagrams.',
      version: '0.4.0',
      author: 'Diagram Labs',
      categories: ['diagrams'],
      tags: ['diagram'],
      icon: 'account_tree',
      screenshots: [],
      downloads: 0,
      featured: false,
      permissions: [],
      minimumAppVersion: '0.61.0',
      downloadUrl: 'https://example.com/diagram.zip',
      checksum: 'sha256-diagram',
      repositoryUrl: '',
      changelog: '',
      tagline: 'Diagramming tools.',
    },
  ],
};

describe('ExtensionMarketplacePanel Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.riskAccepted = true;

    (window as any).electronAPI = {
      invoke: vi.fn((channel: string, ...args: any[]) => {
        if (channel === 'app-settings:get') {
          expect(args).toEqual(['marketplaceRiskAccepted']);
          return Promise.resolve(mockState.riskAccepted);
        }
        if (channel === 'app-settings:set') {
          return Promise.resolve(undefined);
        }
        if (channel === 'extension-marketplace:fetch-registry') {
          return Promise.resolve({ success: true, data: registry });
        }
        if (channel === 'extension-marketplace:get-installed') {
          return Promise.resolve({
            success: true,
            data: {
              'smarty-chart': {
                extensionId: 'smarty-chart',
                version: '1.0.0',
                installedAt: '2026-05-24T00:00:00.000Z',
                updatedAt: '2026-05-24T00:00:00.000Z',
                source: 'marketplace',
              },
            },
          });
        }
        if (channel === 'extensions:list-installed') {
          return Promise.resolve([]);
        }
        if (channel === 'extension-marketplace:check-updates') {
          return Promise.resolve({
            success: true,
            data: [{ extensionId: 'smarty-chart', currentVersion: '1.0.0', availableVersion: '1.2.0' }],
          });
        }
        if (channel === 'extension-marketplace:install') {
          expect(args).toEqual(['diagram-kit', 'https://example.com/diagram.zip', 'sha256-diagram', '0.4.0']);
          return Promise.resolve({ success: true });
        }
        if (channel === 'extension-marketplace:install-from-github') {
          expect(args).toEqual(['https://github.com/smarty/diagram-kit']);
          return Promise.resolve({ success: true, extensionId: 'github-extension' });
        }
        return Promise.resolve({ success: true });
      }),
      openExternal: vi.fn(),
    };
  });

  it('renders the risk gate with Agent Elements chrome while preserving acceptance behavior', async () => {
    mockState.riskAccepted = false;

    render(<ExtensionMarketplacePanel />);

    const panel = await screen.findByTestId('extension-marketplace-panel');
    expect(panel).toHaveClass('agent-elements-extension-marketplace-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'extension-marketplace-panel');

    const warning = screen.getByTestId('agent-elements-marketplace-risk-warning');
    expect(warning).toHaveClass('agent-elements-tool-card');
    expect(warning).toHaveAttribute('data-agent-elements-shell', 'marketplace-risk-warning');
    expect(warning.className).toContain('--agent-elements-card-inline-padding');

    fireEvent.click(screen.getByTestId('marketplace-accept-risk'));

    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
        'app-settings:set',
        'marketplaceRiskAccepted',
        true,
      );
    });
    expect(mockState.capture).toHaveBeenCalledWith('extension_marketplace_risk_accepted');
  });

  it('renders extension cards and detail modal with Agent Elements shell while preserving install flows', async () => {
    const onViewInstalled = vi.fn();
    render(<ExtensionMarketplacePanel onViewInstalled={onViewInstalled} />);

    const panel = await screen.findByTestId('extension-marketplace-panel');
    expect(panel).toHaveClass('agent-elements-extension-marketplace-panel');
    expect(panel).toHaveAttribute('data-component', 'ExtensionMarketplacePanel');
    expect(screen.getByTestId('agent-elements-extension-marketplace-header')).toHaveClass(
      'agent-elements-settings-panel-header',
    );
    expect(screen.getByTestId('agent-elements-extension-marketplace-discover')).toHaveAttribute(
      'data-agent-elements-shell',
      'extension-marketplace-discover',
    );

    const chartCard = await screen.findByTestId('marketplace-card-smarty-chart');
    expect(chartCard).toHaveClass('agent-elements-extension-card', 'agent-elements-tool-card');
    expect(chartCard.className).toContain('--agent-elements-card-inline-padding');
    expect(chartCard).toHaveAttribute('data-installed', 'true');
    expect(chartCard).toHaveAttribute('data-update-available', 'true');

    const diagramCard = screen.getByTestId('marketplace-card-diagram-kit');
    expect(diagramCard).toHaveClass('agent-elements-extension-card', 'agent-elements-tool-card');
    expect(diagramCard).toHaveAttribute('data-installed', 'false');

    fireEvent.click(screen.getByTestId('marketplace-install-diagram-kit'));
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
        'extension-marketplace:install',
        'diagram-kit',
        'https://example.com/diagram.zip',
        'sha256-diagram',
        '0.4.0',
      );
    });

    fireEvent.click(chartCard);
    const overlay = await screen.findByTestId('marketplace-details-overlay');
    expect(overlay).toHaveAttribute('data-agent-elements-shell', 'extension-detail-overlay');
    const dialog = screen.getByTestId('agent-elements-extension-detail-dialog');
    expect(dialog).toHaveClass('agent-elements-tool-card');
    expect(dialog.className).toContain('--agent-elements-card-inline-padding');
    expect(within(dialog).getByText('Smarty Chart')).toBeInTheDocument();
    expect(within(dialog).getByTestId('agent-elements-extension-detail-meta')).toHaveClass(
      'agent-elements-tool-card-bordered',
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close extension details' }));
    await waitFor(() => {
      expect(screen.queryByTestId('marketplace-details-overlay')).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('marketplace-github-url'), {
      target: { value: 'https://github.com/smarty/diagram-kit' },
    });
    fireEvent.click(screen.getByTestId('marketplace-github-install'));
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
        'extension-marketplace:install-from-github',
        'https://github.com/smarty/diagram-kit',
      );
    });

    fireEvent.click(screen.getByTestId('marketplace-view-installed'));
    expect(onViewInstalled).toHaveBeenCalledOnce();
  });
});
