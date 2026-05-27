// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ErrorDialog } from '../ErrorDialog';

const copyToClipboardMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
    }: {
      icon: string;
      size?: number;
      className?: string;
    }) =>
      ReactModule.createElement('span', {
        'data-icon': icon,
        'data-size': size,
        className,
      }),
    copyToClipboard: copyToClipboardMock,
  };
});

const diffErrorDetails = {
  originalMarkdown: '# Checkout\n\nOriginal content',
  prompt: 'Replace the checkout copy',
  aiResponse: 'Updated checkout copy',
  replacements: [
    {
      oldText: 'Original content',
      newText: 'Updated content',
    },
  ],
  errorMessage: 'Could not apply replacement',
  timestamp: '2026-05-24T04:20:00Z',
  filePath: '/workspace/docs/checkout.md',
};

const errorDialogSourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/ErrorDialog/ErrorDialog.tsx'
);

describe('ErrorDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an Agent Elements error shell while preserving string details and close behavior', () => {
    const onClose = vi.fn();

    render(
      <ErrorDialog
        isOpen={true}
        title="Export failed"
        message="Failed to export PDF."
        details="stack trace line 1"
        onClose={onClose}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-error-dialog-backdrop');
    expect(backdrop).toHaveClass('error-dialog-overlay', 'agent-elements-error-dialog-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'error-dialog-backdrop');

    const dialog = screen.getByTestId('agent-elements-error-dialog');
    expect(dialog).toHaveClass('error-dialog', 'agent-elements-error-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'ErrorDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'error-dialog');

    expect(screen.getByTestId('agent-elements-error-dialog-header')).toHaveTextContent('Export failed');
    expect(screen.getByTestId('agent-elements-error-dialog-message')).toHaveTextContent(
      'Failed to export PDF.'
    );
    expect(screen.getByTestId('agent-elements-error-dialog-string-details')).toHaveTextContent(
      'stack trace line 1'
    );

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('preserves structured debug sections, expansion, copy debug info, and closed rendering', async () => {
    const onClose = vi.fn();

    const { rerender } = render(
      <ErrorDialog
        isOpen={false}
        title="AI edit failed"
        message="The document changed while the edit was running."
        details={diffErrorDetails}
        onClose={onClose}
      />
    );

    expect(screen.queryByTestId('agent-elements-error-dialog')).not.toBeInTheDocument();

    rerender(
      <ErrorDialog
        isOpen={true}
        title="AI edit failed"
        message="The document changed while the edit was running."
        details={diffErrorDetails}
        onClose={onClose}
      />
    );

    expect(screen.getByTestId('agent-elements-error-dialog-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'error-dialog-actions'
    );
    expect(screen.getByTestId('agent-elements-error-dialog-sections')).toHaveClass(
      'agent-elements-error-dialog-sections'
    );
    expect(screen.getByText('Could not apply replacement')).toBeInTheDocument();
    expect(screen.getByText('/workspace/docs/checkout.md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Prompt' }));
    expect(screen.getByText('Replace the checkout copy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy Debug Info' }));
    await waitFor(() => {
      expect(copyToClipboardMock).toHaveBeenCalledWith(expect.stringContaining('## Error Details'));
      expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('agent-elements-error-dialog-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Agent Elements dialog chrome on --an-* aliases instead of direct legacy visual tokens', () => {
    const source = fs.readFileSync(errorDialogSourcePath, 'utf8');

    expect(source).toContain('--an-code-background');
    expect(source).toContain('--an-code-color');
    expect(source).toContain('--an-error-color');
    expect(source).toContain('--an-info-color');
    expect(source).toContain('--an-diff-added-bg');
    expect(source).toContain('--an-diff-removed-bg');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).not.toMatch(/var\(--nim-(?:code|diff|error|info|primary-hover|text)[^)]+\)/);
  });
});
