// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionImportDialog } from '../SessionImportDialog';

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
      fill,
    }: {
      icon: string;
      size?: number;
      className?: string;
      fill?: boolean;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, 'data-fill': fill, className }),
  };
});

const sourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../SessionImportDialog.tsx'
);

const sessions = [
  {
    sessionId: 'session-new',
    workspacePath: '/workspace/app',
    title: 'Build UI shell',
    createdAt: 1_700_000_000_000,
    updatedAt: Date.now() - 60_000,
    messageCount: 7,
    tokenUsage: { inputTokens: 1200, outputTokens: 800, totalTokens: 2000 },
    syncStatus: 'new',
  },
  {
    sessionId: 'session-synced',
    workspacePath: '/workspace/app',
    title: 'Already imported',
    createdAt: 1_700_000_000_000,
    updatedAt: Date.now() - 120_000,
    messageCount: 2,
    tokenUsage: { inputTokens: 500, outputTokens: 250, totalTokens: 750 },
    syncStatus: 'up-to-date',
  },
  {
    sessionId: 'session-update',
    workspacePath: '/workspace/tools',
    title: 'Refactor sync flow',
    createdAt: 1_700_000_000_000,
    updatedAt: Date.now() - 180_000,
    messageCount: 4,
    tokenUsage: { inputTokens: 4000, outputTokens: 1500, totalTokens: 5500 },
    syncStatus: 'needs-update',
  },
] as const;

describe('SessionImportDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: vi.fn(async (channel: string) => {
          if (channel === 'claude-code:scan-sessions') {
            return { success: true, sessions };
          }
          return { success: false };
        }),
      },
    });
  });

  it('renders an Agent Elements import dialog shell while preserving scan, selection, workspace grouping, and import behavior', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <SessionImportDialog
        isOpen={true}
        onClose={onClose}
        onImport={onImport}
        currentWorkspacePath="/workspace/app"
      />
    );

    const backdrop = screen.getByTestId('agent-elements-session-import-backdrop');
    expect(backdrop).toHaveClass('session-import-dialog-overlay', 'agent-elements-session-import-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'session-import-backdrop');

    const dialog = screen.getByTestId('agent-elements-session-import-dialog');
    expect(dialog).toHaveClass('session-import-dialog', 'agent-elements-session-import-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'SessionImportDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'session-import-dialog');

    expect(screen.getByTestId('agent-elements-session-import-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'session-import-header'
    );
    await screen.findByText('Build UI shell');

    expect(screen.getByTestId('agent-elements-session-import-stats')).toHaveAttribute(
      'data-agent-elements-shell',
      'session-import-stats'
    );
    expect(screen.getAllByTestId('agent-elements-session-import-stat')).toHaveLength(4);
    expect(screen.getByTestId('agent-elements-session-import-search')).toHaveAttribute(
      'data-agent-elements-shell',
      'session-import-search'
    );
    expect(screen.getByTestId('agent-elements-session-import-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'session-import-actions'
    );
    expect(screen.getByTestId('agent-elements-session-import-content')).toHaveAttribute(
      'data-agent-elements-shell',
      'session-import-content'
    );
    expect(screen.getByTestId('agent-elements-session-import-footer')).toHaveAttribute(
      'data-agent-elements-shell',
      'session-import-footer'
    );

    expect(window.electronAPI.invoke).toHaveBeenCalledWith('claude-code:scan-sessions', {
      workspacePath: '/workspace/app',
    });

    const currentWorkspace = screen.getByTestId('agent-elements-session-import-workspace-0');
    expect(currentWorkspace).toHaveClass('session-import-workspace-group', 'agent-elements-session-import-workspace');
    const currentHeader = within(currentWorkspace).getByTestId('agent-elements-session-import-workspace-header');
    expect(currentHeader).toHaveClass('session-import-workspace-header', 'agent-elements-session-import-workspace-header');
    expect(currentHeader).toHaveAttribute('data-agent-elements-shell', 'session-import-workspace-header');

    const expandedToggle = within(currentWorkspace).getByRole('button', {
      name: 'Collapse sessions in app',
    });
    expect(expandedToggle).toHaveAttribute('aria-expanded', 'true');

    const firstSession = screen.getByTestId('agent-elements-session-import-session-session-new');
    expect(firstSession).toHaveClass('session-import-session-item', 'agent-elements-session-import-session');
    expect(firstSession).toHaveAttribute('data-agent-elements-shell', 'session-import-session');
    expect(within(firstSession).getByText('New')).toHaveClass('agent-elements-status-pill');
    expect(within(firstSession).getByText('2,000 tokens')).toBeInTheDocument();

    const importButton = screen.getByRole('button', { name: 'Import 2 Sessions' });
    fireEvent.click(importButton);
    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(['session-new', 'session-update']);
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const otherWorkspace = screen.getByTestId('agent-elements-session-import-workspace-1');
    const collapsedToggle = within(otherWorkspace).getByRole('button', {
      name: 'Expand sessions in tools',
    });
    expect(collapsedToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('preserves fallback all-workspace scan, search filtering, select-all controls, and disabled import state', async () => {
    const invoke = vi.fn(async (channel: string, payload?: { workspacePath?: string }) => {
      if (channel !== 'claude-code:scan-sessions') return { success: false };
      if (payload?.workspacePath === '/workspace/app') return { success: true, sessions: [] };
      return { success: true, sessions };
    });
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { invoke },
    });

    render(
      <SessionImportDialog
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        currentWorkspacePath="/workspace/app"
      />
    );

    expect(await screen.findByText('No sessions matched this exact workspace path. Showing all Claude Agent sessions instead.')).toHaveClass(
      'agent-elements-session-import-scope-notice'
    );
    expect(invoke).toHaveBeenNthCalledWith(1, 'claude-code:scan-sessions', {
      workspacePath: '/workspace/app',
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'claude-code:scan-sessions', {
      workspacePath: undefined,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(screen.getByRole('button', { name: 'Import 0 Sessions' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    expect(screen.getByRole('button', { name: 'Import 3 Sessions' })).not.toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Search sessions by title...'), {
      target: { value: 'refactor' },
    });

    expect(screen.queryByText('Build UI shell')).not.toBeInTheDocument();
    const toolsToggle = screen.getByRole('button', { name: 'Expand sessions in tools' });
    fireEvent.click(toolsToggle);
    expect(await screen.findByText('Refactor sync flow')).toBeInTheDocument();
  });

  it('keeps source styling constrained to Agent Elements-compatible dialog tokens', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-session-import-dialog');
    expect(source).toContain('data-agent-elements-shell="session-import-dialog"');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/border-\[var\(--nim|bg-\[var\(--nim|text-\[var\(--nim/);
    expect(source).not.toMatch(/tracking-\[0\.5px\]|text-white|rounded-lg|shadow-\[/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(|rgb\(/);
    expect(source).not.toContain('<svg');
  });
});
