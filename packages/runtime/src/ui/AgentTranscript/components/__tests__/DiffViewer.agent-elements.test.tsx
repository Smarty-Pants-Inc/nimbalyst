import React from 'react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer';

const sourcePath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentTranscript/components/DiffViewer.tsx'
);

describe('DiffViewer Agent Elements shell', () => {
  it('renders old/new edit diffs with token-backed Agent Elements chrome', () => {
    const onOpenFile = vi.fn();

    render(
      <DiffViewer
        edit={{ old_string: 'const value = 1;', new_string: 'const value = 2;' }}
        filePath="src/app.ts"
        absoluteFilePath="/repo/src/app.ts"
        onOpenFile={onOpenFile}
        maxHeight="12rem"
      />
    );

    const root = screen.getByTestId('agent-elements-diff-viewer');
    expect(root).toHaveClass('diff-viewer', 'agent-elements-diff-viewer');
    expect(root).toHaveAttribute('data-component', 'DiffViewer');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'diff-viewer');
    expect(root).toHaveStyle({ maxHeight: '12rem' });

    const header = screen.getByTestId('agent-elements-diff-viewer-header');
    expect(header).toHaveAttribute('data-agent-elements-shell', 'diff-viewer-header');

    fireEvent.click(screen.getByRole('button', { name: 'Open src/app.ts' }));
    expect(onOpenFile).toHaveBeenCalledWith('/repo/src/app.ts');

    const removedLine = screen.getByTestId('agent-elements-diff-viewer-line-old-0');
    expect(removedLine).toHaveAttribute('data-line-kind', 'removed');
    expect(removedLine.textContent).toContain('-');
    expect(removedLine.textContent).toContain('const value = 1;');

    const addedLine = screen.getByTestId('agent-elements-diff-viewer-line-new-0');
    expect(addedLine).toHaveAttribute('data-line-kind', 'added');
    expect(addedLine.textContent).toContain('+');
    expect(addedLine.textContent).toContain('const value = 2;');
  });

  it('renders replacement arrays and content-only edits with the same shell contract', () => {
    const { rerender } = render(
      <DiffViewer
        edit={{
          replacements: [
            { oldText: 'before one', newText: 'after one' },
            { oldText: 'before two', newText: 'after two' },
          ],
        }}
        filePath="src/replace.ts"
      />
    );

    expect(screen.getAllByTestId('agent-elements-diff-viewer')).toHaveLength(2);
    expect(screen.getByText('src/replace.ts (1/2)')).toBeInTheDocument();
    expect(screen.getByText('src/replace.ts (2/2)')).toBeInTheDocument();

    rerender(
      <DiffViewer
        edit={{ content: 'export const created = true;' }}
        filePath="src/created.ts"
      />
    );

    const root = screen.getByTestId('agent-elements-diff-viewer');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'diff-viewer');
    expect(screen.getByTestId('agent-elements-diff-viewer-line-add-0')).toHaveAttribute('data-line-kind', 'added');
    expect(screen.getByText('export const created = true;')).toBeInTheDocument();
  });

  it('uses Agent Elements source styling instead of legacy transcript chrome', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-diff-viewer');
    expect(source).toContain('data-agent-elements-shell="diff-viewer"');
    expect(source).toContain('--an-tool-background');
    expect(source).toContain('--an-diff-added-bg');
    expect(source).toContain('--an-diff-removed-bg');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|--nim-|rounded-md|rounded-lg|transition-all|rgba\(|#[0-9a-fA-F]{3,8}/);
  });
});
