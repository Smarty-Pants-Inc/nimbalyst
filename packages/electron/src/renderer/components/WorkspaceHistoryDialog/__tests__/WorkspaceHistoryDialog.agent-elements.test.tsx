// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceHistoryDialog } from '../WorkspaceHistoryDialog';

const sourcePath = resolve(__dirname, '../WorkspaceHistoryDialog.tsx');
const treeSourcePath = resolve(__dirname, '../WorkspaceHistoryFileTree.tsx');

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
    },
    {
      timestamp: '2026-05-24T15:00:00.000Z',
      type: 'manual',
      size: 12,
      baseMarkdownHash: 'hash-old',
    },
  ],
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

vi.mock('../../HistoryDialog/DiffPreviewEditor', () => ({
  DiffPreviewEditor: ({ oldMarkdown, newMarkdown }: { oldMarkdown: string; newMarkdown: string }) => (
    <div data-testid="mock-rich-diff" data-old={oldMarkdown} data-new={newMarkdown}>
      rich diff
    </div>
  ),
}));

vi.mock('../../HistoryDialog/TextDiffViewer', () => ({
  TextDiffViewer: ({ oldText, newText }: { oldText: string; newText: string }) => (
    <div data-testid="mock-text-diff" data-old={oldText} data-new={newText}>
      text diff
    </div>
  ),
}));

vi.mock('../../HistoryDialog/MonacoDiffViewer', () => ({
  MonacoDiffViewer: ({ filePath }: { filePath: string }) => (
    <div data-testid="mock-monaco-diff" data-file-path={filePath}>
      monaco diff
    </div>
  ),
}));

vi.mock('@nimbalyst/runtime', () => ({
  getFileIcon: (fileName: string) => (fileName.endsWith('.md') ? 'article' : 'description'),
}));

function installElectronApi() {
  const invoke = vi.fn(async (channel: string, payload: unknown) => {
    if (channel === 'history:list-workspace-files') {
      expect(payload).toBe('/workspace');
      return [
        {
          path: '/workspace/docs/plan.md',
          latestTimestamp: Date.parse('2026-05-24T16:00:00.000Z'),
          snapshotCount: 2,
        },
        {
          path: '/workspace/src/deleted.md',
          latestTimestamp: Date.parse('2026-05-24T14:00:00.000Z'),
          snapshotCount: 1,
        },
      ];
    }
    if (channel === 'history:check-files-exist') {
      expect(payload).toEqual(['/workspace/docs/plan.md', '/workspace/src/deleted.md']);
      return {
        '/workspace/docs/plan.md': true,
        '/workspace/src/deleted.md': false,
      };
    }
    if (channel === 'history:restore-deleted-file') {
      return { success: true };
    }
    if (channel === 'history:batch-restore-deleted-files') {
      return [{ path: '/workspace/src/deleted.md', success: true }];
    }
    throw new Error(`Unexpected invoke channel ${channel}`);
  });

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke },
  });

  return { invoke };
}

describe('WorkspaceHistoryDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historyMock.loadSnapshot.mockImplementation(async (timestamp: string) => `content ${timestamp}`);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  it('renders a left-panel history shell with Agent Elements chrome while preserving open and close behavior', async () => {
    const api = installElectronApi();
    const onClose = vi.fn();

    const { rerender } = render(
      <WorkspaceHistoryDialog isOpen={false} onClose={onClose} workspacePath="/workspace" />
    );

    expect(screen.queryByTestId('agent-elements-workspace-history-dialog')).not.toBeInTheDocument();

    rerender(
      <WorkspaceHistoryDialog isOpen={true} onClose={onClose} workspacePath="/workspace" />
    );

    const backdrop = screen.getByTestId('agent-elements-workspace-history-backdrop');
    expect(backdrop).toHaveClass('workspace-history-dialog-overlay', 'agent-elements-workspace-history-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'workspace-history-backdrop');

    const dialog = screen.getByTestId('agent-elements-workspace-history-dialog');
    expect(dialog).toHaveClass('workspace-history-dialog', 'agent-elements-workspace-history-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'WorkspaceHistoryDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'workspace-history-dialog');

    expect(screen.getByTestId('agent-elements-workspace-history-header')).toHaveTextContent('Folder History');
    expect(screen.getByTestId('agent-elements-workspace-history-file-panel')).toHaveAttribute(
      'data-agent-elements-shell',
      'workspace-history-file-panel'
    );
    expect(screen.getByTestId('agent-elements-workspace-history-preview-panel')).toHaveAttribute(
      'data-agent-elements-shell',
      'workspace-history-preview-panel'
    );
    expect(screen.getByTestId('agent-elements-workspace-history-empty-preview')).toHaveTextContent(
      'Select a file from the tree to view its history'
    );

    await waitFor(() => {
      expect(api.invoke).toHaveBeenCalledWith('history:list-workspace-files', '/workspace');
      expect(api.invoke).toHaveBeenCalledWith('history:check-files-exist', [
        '/workspace/docs/plan.md',
        '/workspace/src/deleted.md',
      ]);
      expect(screen.getByText('docs/')).toBeInTheDocument();
      expect(screen.getByText('src/')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('docs/'));
    fireEvent.click(screen.getByText('src/'));

    await waitFor(() => {
      expect(screen.getByText('plan.md')).toBeInTheDocument();
      expect(screen.getByText('deleted.md')).toBeInTheDocument();
    });

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('preserves deleted-file batch restore, snapshot diff toggles, and single restore payloads', async () => {
    const api = installElectronApi();
    const onFileRestored = vi.fn();

    render(
      <WorkspaceHistoryDialog
        isOpen={true}
        onClose={vi.fn()}
        onFileRestored={onFileRestored}
        workspacePath="/workspace"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('docs/')).toBeInTheDocument();
      expect(screen.getByText('src/')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('docs/'));
    fireEvent.click(screen.getByText('src/'));

    await waitFor(() => {
      expect(screen.getByText('plan.md')).toBeInTheDocument();
      expect(screen.getByText('deleted.md')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('agent-elements-workspace-history-deleted-checkbox-/workspace/src/deleted.md'));
    const restoreSelected = screen.getByRole('button', { name: /restore selected/i });
    expect(restoreSelected).toHaveClass('agent-elements-workspace-history-button');
    fireEvent.click(restoreSelected);

    await waitFor(() => {
      expect(api.invoke).toHaveBeenCalledWith('history:batch-restore-deleted-files', ['/workspace/src/deleted.md']);
      expect(onFileRestored).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByText('plan.md'));
    await waitFor(() => {
      expect(historyMock.refreshSnapshots).toHaveBeenCalled();
      expect(screen.getByText('ai diff')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('ai diff'));
    await waitFor(() => {
      expect(historyMock.loadSnapshot).toHaveBeenCalledWith('2026-05-24T15:00:00.000Z');
      expect(historyMock.loadSnapshot).toHaveBeenCalledWith('2026-05-24T16:00:00.000Z');
      expect(screen.getByTestId('agent-elements-workspace-history-diff-header')).toBeInTheDocument();
      expect(screen.getByTestId('mock-rich-diff')).toBeInTheDocument();
    });

    const modeToggle = screen.getByTestId('agent-elements-workspace-history-diff-mode-toggle');
    expect(modeToggle).toHaveAttribute('data-agent-elements-shell', 'workspace-history-diff-mode-toggle');
    fireEvent.click(within(modeToggle).getByRole('button', { name: 'Text' }));
    expect(screen.getByTestId('mock-text-diff')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /restore this version/i }));

    await waitFor(() => {
      expect(api.invoke).toHaveBeenCalledWith(
        'history:restore-deleted-file',
        '/workspace/docs/plan.md',
        '2026-05-24T16:00:00.000Z'
      );
      expect(onFileRestored).toHaveBeenCalledTimes(2);
    });
  });

  it('removes legacy modal chrome in favor of Agent Elements tokenized rules', () => {
    const source = `${readFileSync(sourcePath, 'utf8')}\n${readFileSync(treeSourcePath, 'utf8')}`;

    expect(source).toContain('agent-elements-workspace-history-dialog');
    expect(source).toContain('data-agent-elements-shell="workspace-history-dialog"');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-input-border-radius');
    expect(source).not.toMatch(/nim-overlay|nim-modal|nim-btn-icon|nim-btn-primary/);
    expect(source).not.toMatch(/bg-(blue|emerald|purple|orange|teal)-|text-white|border-l-\[3px\]/);
    expect(source).not.toMatch(/tracking-wide|transition-all|--nim-/);
  });
});
