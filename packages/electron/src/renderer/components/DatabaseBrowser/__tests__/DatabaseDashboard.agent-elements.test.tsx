// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseDashboard } from '../DatabaseDashboard';

const dashboardSourcePath = resolve(__dirname, '../DatabaseDashboard.tsx');
const legacyVisualTokenPattern =
  /\b(?:bg|text|border|hover:bg|hover:text|hover:border)-nim(?:-[\w-]+)?\b|var\(--nim-|rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b|rounded-md|rounded-lg|rounded-xl|tracking-\[/;

function installElectronApi() {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === 'database:getDashboardStats') {
      return {
        success: true,
        tableStats: [
          {
            name: 'ai_sessions',
            rowCount: 42,
            size: '48 kB',
            sizeBytes: 49152,
          },
          {
            name: 'document_history',
            rowCount: 7,
            size: '16 kB',
            sizeBytes: 16384,
          },
        ],
        totalSize: '64 kB',
        totalSizeBytes: 65536,
        basicStats: {
          ai_sessions_count: '42',
          history_count: '7',
          database_size: '64 kB',
        },
        backupStatus: {
          currentBackup: {
            timestamp: '2026-05-24T09-20-00-000Z',
            size: 2048,
            verified: true,
          },
          previousBackup: null,
          oldestBackup: null,
          lastBackupAttempt: '2026-05-24T09-20-00-000Z',
          lastSuccessfulBackup: '2026-05-24T09-20-00-000Z',
        },
        walStats: {
          fileCount: 1,
          totalBytes: 1024 * 1024,
          totalSize: '1 MB',
          minWalSize: '80 MB',
          maxWalSize: '200 MB',
          checkpointTimeout: '5 min',
        },
      };
    }

    return { success: false, error: `Unexpected channel ${channel}` };
  });

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke },
  });

  return { invoke };
}

describe('DatabaseDashboard Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installElectronApi();
  });

  it('renders database dashboard chrome with Agent Elements markers while preserving table selection', async () => {
    const { invoke } = installElectronApi();
    const onTableSelect = vi.fn();

    render(<DatabaseDashboard onTableSelect={onTableSelect} />);

    const dashboard = await screen.findByTestId('agent-elements-database-dashboard');
    expect(dashboard).toHaveClass('agent-elements-database-dashboard');
    expect(dashboard).toHaveAttribute('data-agent-elements-shell', 'database-dashboard');

    expect(invoke).toHaveBeenCalledWith('database:getDashboardStats');
    expect(screen.getAllByTestId('agent-elements-database-stat-card')).toHaveLength(5);
    expect(screen.getByTestId('agent-elements-database-backup-status')).toHaveAttribute(
      'data-agent-elements-shell',
      'database-backup-status'
    );
    expect(screen.getByTestId('agent-elements-database-wal-status')).toHaveAttribute(
      'data-agent-elements-shell',
      'database-wal-status'
    );
    expect(screen.getByTestId('agent-elements-database-table-list')).toHaveAttribute(
      'data-agent-elements-shell',
      'database-table-list'
    );
    const statCards = screen.getAllByTestId('agent-elements-database-stat-card');
    for (const card of statCards) {
      expect(card).toHaveClass('agent-elements-tool-card');
      expect(card).toHaveAttribute('data-agent-elements-card-width', 'grid-cell');
      expect(card).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
      expect(card.className).toContain('--agent-elements-card-inline-padding');
      expect(card.className).toContain('--agent-elements-card-block-padding');
      expect(card.className).not.toMatch(/\b(?:p-|px-|py-|pl-|pr-|rounded-\[10px\])/);
    }
    for (const [card, expectedPadding] of [
      [screen.getByTestId('agent-elements-database-backup-status'), 'symmetric-inline'],
      [screen.getByTestId('agent-elements-database-wal-status'), 'symmetric-inline'],
      [screen.getByTestId('agent-elements-database-table-list'), 'sectioned-symmetric'],
    ] as const) {
      expect(card).toHaveClass('agent-elements-tool-card');
      expect(card).toHaveAttribute('data-agent-elements-card-width', 'section-row');
      expect(card).toHaveAttribute('data-agent-elements-card-padding', expectedPadding);
      expect(card.className).toContain('--agent-elements-card-inline-padding');
      expect(card.className).toContain('--agent-elements-card-block-padding');
      expect(card.className).not.toMatch(/\b(?:p-|px-|py-|pl-|pr-|rounded-\[10px\])/);
    }

    fireEvent.click(screen.getByText('ai_sessions'));
    await waitFor(() => expect(onTableSelect).toHaveBeenCalledWith('ai_sessions'));

    fireEvent.keyDown(screen.getAllByTestId('agent-elements-database-table-row')[1], {
      key: 'Enter',
    });
    await waitFor(() => expect(onTableSelect).toHaveBeenCalledWith('document_history'));
  });

  it('keeps database dashboard source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(dashboardSourcePath, 'utf8');

    expect(source).toContain('agent-elements-database-dashboard');
    expect(source).toContain('agent-elements-database-stat-card');
    expect(source).toContain('agent-elements-database-backup-status');
    expect(source).toContain('agent-elements-database-wal-status');
    expect(source).toContain('agent-elements-database-table-row');
    expect(source).toContain('agent-elements-tool-card');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).toContain('data-agent-elements-card-width="grid-cell"');
    expect(source).toContain('data-agent-elements-card-width="section-row"');
    expect(source).toContain('data-agent-elements-card-padding="symmetric-inline"');
    expect(source).toContain('data-agent-elements-card-padding="sectioned-symmetric"');
    expect(source).toContain('--an-foreground-muted');

    expect(source).not.toMatch(
      /agent-elements-database-(?:stat-card|backup-status|wal-status|table-list)[^`'"]*\b(?:p-|p-\[|px-|px-\[|py-|py-\[|pl-|pl-\[|pr-|pr-\[|rounded-\[10px\]|rounded-md|rounded-lg|rounded-xl)/
    );
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/bg-white|text-white|bg-black|hover:scale|tracking-\[/);
    expect(source).not.toMatch(/--nim-accent|--nim-surface|text-nim-fg|<svg/);
    expect(source).not.toMatch(legacyVisualTokenPattern);
  });
});
