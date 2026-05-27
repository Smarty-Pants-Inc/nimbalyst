import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NewFilePreview } from '../NewFilePreview';

const sourcePath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentTranscript/components/NewFilePreview.tsx',
);

describe('NewFilePreview Agent Elements shell', () => {
  it('renders a clickable Agent Elements new-file preview while preserving expansion', () => {
    const onOpenFile = vi.fn();
    const content = Array.from({ length: 32 }, (_, index) => `line ${index + 1}`).join('\n');

    render(
      <NewFilePreview
        content={content}
        filePath="src/generated/example.ts"
        absoluteFilePath="/repo/src/generated/example.ts"
        onOpenFile={onOpenFile}
      />,
    );

    const root = screen.getByTestId('agent-elements-new-file-preview');
    expect(root).toHaveClass('new-file-preview', 'agent-elements-new-file-preview');
    expect(root).toHaveAttribute('data-component', 'NewFilePreview');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'new-file-preview');
    expect(screen.getByText('src/generated/example.ts')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-new-file-preview-line-count')).toHaveTextContent('32 lines');

    fireEvent.click(screen.getByRole('button', { name: /open src\/generated\/example.ts/i }));
    expect(onOpenFile).toHaveBeenCalledWith('/repo/src/generated/example.ts');

    fireEvent.click(screen.getByRole('button', { name: /show all 32 lines/i }));
    expect(screen.getByRole('button', { name: /collapse new file preview/i })).toBeInTheDocument();
  });

  it('keeps NewFilePreview source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-new-file-preview');
    expect(source).toContain('data-agent-elements-shell="new-file-preview"');
    expect(source).toContain('--an-tool-background');
    expect(source).toContain('--an-tool-border-color');
    expect(source).toContain('--an-code-background');
    expect(source).toContain('--an-primary-color');
    expect(source).not.toMatch(/--nim-|text-white|transition-all|rounded-md|rounded-full|bg-\[var\(--nim|border-\[var\(--nim|text-\[var\(--nim/);
  });
});
