// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryDialog } from '../HistoryDialog';

const sourcePath = resolve(__dirname, '../HistoryDialog.tsx');

const historyMock = vi.hoisted(() => ({
  refreshSnapshots: vi.fn(),
  loadSnapshot: vi.fn(async (timestamp: string) => `content ${timestamp}`),
  deleteSnapshot: vi.fn(),
  snapshots: [
    {
      timestamp: '2026-05-24T16:00:00.000Z',
      type: 'ai-diff',
      size: 24,
      baseMarkdownHash: 'hash-new',
      metadata: { sessionId: 'session-1' },
    },
    {
      timestamp: '2026-05-24T15:00:00.000Z',
      type: 'manual',
      size: 12,
      baseMarkdownHash: 'hash-old',
    },
  ],
}));

const posthogCapture = vi.hoisted(() => vi.fn());

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: posthogCapture }),
}));

vi.mock('../../../hooks/useHistory', () => ({
  useHistory: vi.fn(() => ({
    snapshots: historyMock.snapshots,
    loading: false,
    refreshSnapshots: historyMock.refreshSnapshots,
    loadSnapshot: historyMock.loadSnapshot,
    deleteSnapshot: historyMock.deleteSnapshot,
  })),
}));

vi.mock('@nimbalyst/runtime', () => ({
  ProviderIcon: ({ provider }: { provider: string }) => <span data-testid="mock-provider-icon">{provider}</span>,
  MarkdownEditor: ({ host }: { host: { content?: string } }) => (
    <div data-testid="mock-markdown-preview">{host.content}</div>
  ),
  MonacoEditor: ({ fileName }: { fileName: string }) => (
    <div data-testid="mock-monaco-preview" data-file-name={fileName}>
      monaco preview
    </div>
  ),
}));

vi.mock('../DiffPreviewEditor', () => ({
  DiffPreviewEditor: ({ oldMarkdown, newMarkdown }: { oldMarkdown: string; newMarkdown: string }) => (
    <div data-testid="mock-rich-diff" data-old={oldMarkdown} data-new={newMarkdown}>
      rich diff
    </div>
  ),
}));

vi.mock('../TextDiffViewer', () => ({
  TextDiffViewer: ({ oldText, newText }: { oldText: string; newText: string }) => (
    <div data-testid="mock-text-diff" data-old={oldText} data-new={newText}>
      text diff
    </div>
  ),
}));

vi.mock('../MonacoDiffViewer', () => ({
  MonacoDiffViewer: ({ filePath }: { filePath: string }) => (
    <div data-testid="mock-monaco-diff" data-file-path={filePath}>
      monaco diff
    </div>
  ),
}));

vi.mock('../ImageDiffViewer', () => ({
  ImageDiffViewer: ({ filePath }: { filePath: string }) => (
    <div data-testid="mock-image-diff" data-file-path={filePath}>
      image diff
    </div>
  ),
}));

function installElectronApi() {
  const getSessionList = vi.fn(async () => [
    {
      id: 'session-1',
      title: 'Implement history restore',
      provider: 'claude',
    },
  ]);

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      ai: { getSessionList },
    },
  });

  return { getSessionList };
}

describe('HistoryDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historyMock.loadSnapshot.mockImplementation(async (timestamp: string) => `content ${timestamp}`);
    installElectronApi();
  });

  it('renders document history with Agent Elements chrome while preserving open and close behavior', async () => {
    const onClose = vi.fn();

    const { rerender } = render(
      <HistoryDialog isOpen={false} onClose={onClose} filePath="/workspace/docs/plan.md" workspacePath="/workspace" />
    );

    expect(screen.queryByTestId('agent-elements-history-dialog')).not.toBeInTheDocument();

    rerender(
      <HistoryDialog isOpen={true} onClose={onClose} filePath="/workspace/docs/plan.md" workspacePath="/workspace" />
    );

    const backdrop = screen.getByTestId('agent-elements-history-backdrop');
    expect(backdrop).toHaveClass('history-dialog-overlay', 'agent-elements-history-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'history-backdrop');

    const dialog = screen.getByTestId('agent-elements-history-dialog');
    expect(dialog).toHaveClass('history-dialog', 'agent-elements-history-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'HistoryDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'history-dialog');
    expect(screen.getByTestId('agent-elements-history-header')).toHaveTextContent('plan.md');
    expect(screen.getByTestId('agent-elements-history-list-panel')).toHaveAttribute(
      'data-agent-elements-shell',
      'history-list-panel'
    );
    expect(screen.getByTestId('agent-elements-history-preview-panel')).toHaveAttribute(
      'data-agent-elements-shell',
      'history-preview-panel'
    );

    await waitFor(() => {
      expect(historyMock.refreshSnapshots).toHaveBeenCalled();
      expect(screen.getByText('ai diff')).toBeInTheDocument();
    });

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('preserves snapshot diff loading, rich/text toggles, session jump, and restore payloads', async () => {
    const onClose = vi.fn();
    const onRestore = vi.fn();
    const onOpenSessionInChat = vi.fn();

    render(
      <HistoryDialog
        isOpen={true}
        onClose={onClose}
        filePath="/workspace/docs/plan.md"
        workspacePath="/workspace"
        onRestore={onRestore}
        onOpenSessionInChat={onOpenSessionInChat}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('ai diff')).toBeInTheDocument();
      expect(screen.getByText('Implement history restore')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Implement history restore'));
    expect(onOpenSessionInChat).toHaveBeenCalledWith('session-1');
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('ai diff'));

    await waitFor(() => {
      expect(historyMock.loadSnapshot).toHaveBeenCalledWith('2026-05-24T15:00:00.000Z');
      expect(historyMock.loadSnapshot).toHaveBeenCalledWith('2026-05-24T16:00:00.000Z');
      expect(screen.getByTestId('agent-elements-history-diff-header')).toBeInTheDocument();
      expect(screen.getByTestId('mock-rich-diff')).toBeInTheDocument();
    });

    const variantToggle = screen.getByTestId('agent-elements-history-rich-toggle');
    expect(variantToggle).toHaveAttribute('data-agent-elements-shell', 'history-rich-toggle');
    fireEvent.click(within(variantToggle).getByRole('button', { name: 'Raw' }));
    expect(screen.getByTestId('mock-text-diff')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /restore this version/i }));

    expect(onRestore).toHaveBeenCalledWith('content 2026-05-24T16:00:00.000Z');
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(posthogCapture).toHaveBeenCalledWith('file_history_restored', { fileType: 'markdown' });
  });

  it('removes legacy modal chrome in favor of Agent Elements tokenized rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-history-dialog');
    expect(source).toContain('data-agent-elements-shell="history-dialog"');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-input-border-radius');
    expect(source).not.toMatch(/nim-btn-icon|nim-btn-primary/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-/);
    expect(source).not.toMatch(/bg-black\/|text-white|rounded-md|rounded-lg|rounded-xl|transition-all|tracking-wider/);
  });
});
