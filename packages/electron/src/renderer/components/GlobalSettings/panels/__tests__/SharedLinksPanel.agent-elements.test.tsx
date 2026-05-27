// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedLinksPanel } from '../SharedLinksPanel';

const sourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/SharedLinksPanel.tsx',
);
const chromeSourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/providerPanelChrome.ts',
);
const legacyVisualChromePattern =
  /bg-nim|text-nim|border-nim|bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-|rgba\(|#[0-9a-fA-F]{3,8}\b|bg-white|rounded-lg|rounded-md|tracking-\[|text-white/;

const copyToClipboardMock = vi.hoisted(() => vi.fn());

vi.mock('@nimbalyst/runtime', async () => {
  const React = await import('react');
  return {
    MaterialSymbol: ({ icon, className }: { icon: string; className?: string }) =>
      React.createElement('span', { className, 'data-material-icon': icon }, icon),
    copyToClipboard: copyToClipboardMock,
  };
});

describe('SharedLinksPanel Agent Elements shell', () => {
  beforeEach(() => {
    copyToClipboardMock.mockClear();
    (window as any).electronAPI = {
      listShares: vi.fn().mockResolvedValue({
        success: true,
        shares: [
          {
            shareId: 'share-1',
            sessionId: 'session-1',
            title: 'Planning session',
            sizeBytes: 2048,
            createdAt: '2026-05-20T12:00:00Z',
            expiresAt: null,
            viewCount: 2,
          },
        ],
      }),
      getShareKeys: vi.fn().mockResolvedValue({
        'session-1': 'share-key-1',
      }),
      deleteShare: vi.fn().mockResolvedValue({ success: true }),
    };
  });

  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it('renders Agent Elements markers while preserving share fetch, copy, refresh, and delete behavior', async () => {
    render(<SharedLinksPanel />);

    const panel = await screen.findByTestId('agent-elements-shared-links-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'shared-links-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(panel).toHaveClass('w-full');
    expect(panel).not.toHaveClass('max-w-2xl');
    expect(screen.getByTestId('agent-elements-shared-links-header')).toHaveClass('agent-elements-settings-panel-header');

    await waitFor(() => {
      expect((window as any).electronAPI.listShares).toHaveBeenCalled();
      expect((window as any).electronAPI.getShareKeys).toHaveBeenCalled();
    });

    expect(screen.getByTestId('agent-elements-shared-links-list')).toHaveAttribute('data-section', 'shared-links-list');
    const row = screen.getByTestId('agent-elements-shared-link-row-share-1');
    expect(row).toHaveClass('agent-elements-tool-card');
    expect(row).toHaveTextContent('Planning session');
    expect(row).toHaveTextContent('2 views');

    fireEvent.click(screen.getByTestId('agent-elements-shared-link-copy-share-1'));
    expect(copyToClipboardMock).toHaveBeenCalledWith(expect.stringContaining('share-1'));

    fireEvent.click(screen.getByTestId('agent-elements-shared-links-refresh'));
    await waitFor(() => {
      expect((window as any).electronAPI.listShares).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByTestId('agent-elements-shared-link-delete-share-1'));
    await waitFor(() => {
      expect((window as any).electronAPI.deleteShare).toHaveBeenCalledWith({
        shareId: 'share-1',
        sessionId: 'session-1',
      });
      expect(screen.queryByTestId('agent-elements-shared-link-row-share-1')).not.toBeInTheDocument();
    });
  });

  it('keeps shared links chrome on Agent Elements aliases instead of legacy visual tokens', () => {
    const panelSource = readFileSync(sourcePath, 'utf8');
    const chromeSource = readFileSync(chromeSourcePath, 'utf8');
    const source = `${panelSource}\n${chromeSource}`;

    expect(panelSource).toContain('createProviderPanelChrome');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-foreground');
    expect(source).toContain('--an-foreground-muted');
    expect(source).toContain('--an-primary-color');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(panelSource).toContain('flex w-full flex-col');
    expect(panelSource).not.toContain('max-w-2xl');
    expect(panelSource).not.toMatch(legacyVisualChromePattern);
  });
});
