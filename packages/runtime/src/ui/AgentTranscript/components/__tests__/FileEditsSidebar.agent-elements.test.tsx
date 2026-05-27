import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileEditsSidebar } from '../FileEditsSidebar';
import type { FileEditSummary } from '../../types';

const sourcePath = resolve(__dirname, '../FileEditsSidebar.tsx');
const legacyVisualTokenPattern =
  /bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-|bg-nim|text-nim|border-nim|text-white|bg-white|bg-black|rounded(?:\s|")|rounded-\[3px\]|rounded-md|rounded-lg|rounded-xl|rounded-2xl|rounded-full|shadow(?:-|\\b)|transition-all|rgba\(|rgb\(/;

function makeEdit(filePath: string, overrides: Partial<FileEditSummary> = {}): FileEditSummary {
  return {
    filePath,
    linkType: 'edited',
    operation: 'edit',
    linesAdded: 3,
    linesRemoved: 1,
    timestamp: '2026-05-23T22:37:51.000Z',
    ...overrides,
  };
}

describe('FileEditsSidebar Agent Elements shell', () => {
  beforeEach(() => {
    (window as any).electronAPI = {
      invoke: vi.fn().mockResolvedValue({
        success: true,
        status: {
          'src/app.ts': { status: 'modified' },
          'src/deleted.ts': { status: 'deleted' },
          'src/components/Button.tsx': { status: 'modified' },
          'src/components/Committed.tsx': { status: 'unchanged' },
        },
      }),
      on: vi.fn(() => vi.fn()),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).electronAPI;
  });

  it('renders Agent Elements file rows while preserving file actions and guards', async () => {
    const onFileClick = vi.fn();
    const onSelectionChange = vi.fn();
    const onCopyPath = vi.fn();
    const onGetDiff = vi.fn().mockResolvedValue({
      unifiedDiff: 'diff --git a/src/app.ts b/src/app.ts\n+const ok = true;\n',
      isBinary: false,
    });

    render(
      <FileEditsSidebar
        fileEdits={[
          makeEdit('/workspace/src/app.ts'),
          makeEdit('/workspace/src/deleted.ts', { operation: 'delete', linesAdded: 0, linesRemoved: 8 }),
        ]}
        workspacePath="/workspace"
        pendingReviewFiles={new Set(['/workspace/src/app.ts'])}
        showCheckboxes
        selectedFiles={new Set()}
        onFileClick={onFileClick}
        onSelectionChange={onSelectionChange}
        onCopyPath={onCopyPath}
        onGetDiff={onGetDiff}
      />,
    );

    const shell = screen.getByTestId('agent-elements-files-edited-sidebar');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'files-edited');
    expect(shell).toHaveClass('agent-elements-files-edited-sidebar');
    expect(shell).toHaveClass('agent-elements-edit-panel');

    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
        'git:get-file-status',
        '/workspace',
        ['src/app.ts', 'src/deleted.ts'],
      );
    });

    const rows = screen.getAllByTestId('files-edited-file-row');
    expect(rows).toHaveLength(2);
    const appRow = rows.find((row) => within(row).queryByText('app.ts'))!;
    const deletedRow = rows.find((row) => within(row).queryByText('deleted.ts'))!;
    expect(appRow).toHaveAttribute('data-agent-elements-shell', 'file-row');
    expect(appRow).toHaveClass('agent-elements-search-result');
    expect(within(appRow).getByTestId('files-edited-file-status')).toHaveTextContent('Pending review');
    expect(within(appRow).getByTestId('files-edited-file-status')).toHaveTextContent('Edited');
    expect(within(deletedRow).getByTestId('files-edited-file-status')).toHaveTextContent('Deleted');

    fireEvent.click(within(appRow).getByRole('button', { name: /app\.ts/i }));
    expect(onFileClick).toHaveBeenCalledWith('/workspace/src/app.ts');

    fireEvent.click(within(deletedRow).getByRole('button', { name: /deleted\.ts/i }));
    expect(onFileClick).toHaveBeenCalledTimes(1);

    fireEvent.click(within(appRow).getByTestId('files-edited-file-checkbox'));
    expect(onSelectionChange).toHaveBeenCalledWith('/workspace/src/app.ts', true);

    fireEvent.click(within(appRow).getByTestId('files-edited-file-peek'));
    await waitFor(() => expect(onGetDiff).toHaveBeenCalledWith('/workspace/src/app.ts'));

    fireEvent.contextMenu(appRow);
    fireEvent.click(screen.getByText('Copy Path').closest('button')!);
    expect(onCopyPath).toHaveBeenCalledWith('/workspace/src/app.ts');
  });

  it('preserves grouped directory expansion and bulk selection for uncommitted files', async () => {
    const onBulkSelectionChange = vi.fn();

    render(
      <FileEditsSidebar
        fileEdits={[
          makeEdit('/workspace/src/components/Button.tsx'),
          makeEdit('/workspace/src/components/Committed.tsx'),
        ]}
        workspacePath="/workspace"
        groupByDirectory
        showCheckboxes
        selectedFiles={new Set()}
        onBulkSelectionChange={onBulkSelectionChange}
      />,
    );

    const directoryLabel = await screen.findByText('src/components');
    const directoryHeader = directoryLabel.closest('button')!;

    await waitFor(() => {
      expect(within(directoryHeader).getByRole('checkbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    expect(screen.getByText('Committed.tsx')).toBeInTheDocument();
    expect(screen.getAllByTestId('files-edited-file-row')).toHaveLength(2);

    fireEvent.click(within(directoryHeader).getByRole('checkbox'));
    expect(onBulkSelectionChange).toHaveBeenCalledWith(['/workspace/src/components/Button.tsx'], true);

    fireEvent.click(directoryHeader);
    expect(screen.queryByText('Button.tsx')).not.toBeInTheDocument();

    fireEvent.click(directoryHeader);
    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
  });

  it('keeps Files Edited source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-files-edited-sidebar');
    expect(source).toContain('data-agent-elements-shell="files-edited"');
    expect(source).toContain('--an-tool-background');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-warning-color');
    expect(source).toContain('--an-radius-sm');
    expect(source).not.toMatch(legacyVisualTokenPattern);
    expect(source).not.toMatch(/<MaterialSymbol[^>]*aria-hidden/);
  });
});
