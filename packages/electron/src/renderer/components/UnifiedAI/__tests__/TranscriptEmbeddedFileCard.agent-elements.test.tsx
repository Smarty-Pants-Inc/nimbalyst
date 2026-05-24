// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorHostProps } from '@nimbalyst/runtime';
import { TranscriptEmbeddedFileCard } from '../TranscriptEmbeddedFileCard';

const customEditorRegistryMock = vi.hoisted(() => ({
  findRegistrationForFile: vi.fn(),
}));

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
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

vi.mock('@nimbalyst/runtime/store', () => ({
  store: {
    sub: vi.fn(() => vi.fn()),
  },
}));

vi.mock('../../CustomEditors/registry', () => ({
  customEditorRegistry: customEditorRegistryMock,
}));

vi.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

const sourcePath = resolve(__dirname, '../TranscriptEmbeddedFileCard.tsx');

function EmbeddedPreview({ host }: EditorHostProps) {
  return (
    <div data-testid="embedded-preview" data-theme={host.theme}>
      {host.fileName}
    </div>
  );
}

describe('UnifiedAI TranscriptEmbeddedFileCard Agent Elements shell', () => {
  beforeEach(() => {
    customEditorRegistryMock.findRegistrationForFile.mockReturnValue({
      extensions: ['.mockup.html'],
      component: EmbeddedPreview,
      name: 'Mockup Preview',
      supportsTranscriptEmbed: true,
      transcriptEmbedHeight: 280,
    });
    Object.assign(window, {
      __workspacePath: '/workspace/app',
      electronAPI: {
        readFileContent: vi.fn(async () => ({
          success: true,
          content: '<html></html>',
          isBinary: false,
        })),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    delete (window as unknown as { __workspacePath?: string }).__workspacePath;
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  it('renders supported embedded files in Agent Elements chrome and preserves open-file behavior', () => {
    const onOpenFile = vi.fn();

    render(
      <TranscriptEmbeddedFileCard
        filePath="/workspace/app/design.mockup.html"
        onOpenFile={onOpenFile}
      />,
    );

    const shell = screen.getByTestId('agent-elements-transcript-embedded-file');
    expect(shell).toHaveClass('transcript-embedded-file', 'agent-elements-transcript-embedded-file');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'transcript-embedded-file');
    expect(shell).toHaveAttribute('data-component', 'UnifiedAITranscriptEmbeddedFileCard');
    expect(shell).toHaveAttribute('data-file-path', '/workspace/app/design.mockup.html');
    expect(shell).toHaveAttribute('data-active', 'false');

    expect(screen.getByTestId('agent-elements-transcript-embedded-file-header')).toHaveTextContent('Mockup Preview');
    expect(screen.getByText('design.mockup.html')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open file/i }));
    expect(onOpenFile).toHaveBeenCalledWith('/workspace/app/design.mockup.html');
  });

  it('preserves expand, shield activation, outside deactivation, and double-click open behavior', () => {
    const onOpenFile = vi.fn();
    const { container } = render(
      <div>
        <TranscriptEmbeddedFileCard
          filePath="/workspace/app/design.mockup.html"
          onOpenFile={onOpenFile}
          defaultExpanded
        />
        <button type="button">Outside</button>
      </div>,
    );

    expect(screen.getByTestId('agent-elements-transcript-embedded-file-body')).toBeInTheDocument();
    expect(screen.getByTestId('embedded-preview')).toHaveTextContent('design.mockup.html');

    const shield = screen.getByTestId('transcript-embedded-file-shield');
    fireEvent.click(shield);
    expect(screen.getByTestId('agent-elements-transcript-embedded-file')).toHaveAttribute('data-active', 'true');

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.getByTestId('agent-elements-transcript-embedded-file')).toHaveAttribute('data-active', 'false');

    const reshielded = screen.getByTestId('transcript-embedded-file-shield');
    fireEvent.doubleClick(reshielded);
    expect(onOpenFile).toHaveBeenCalledWith('/workspace/app/design.mockup.html');

    const toggle = screen.getByRole('button', { name: /mockup preview/i });
    fireEvent.click(toggle);
    expect(container.querySelector('.transcript-embedded-file__body')).not.toBeInTheDocument();
  });

  it('does not render unsupported files', () => {
    customEditorRegistryMock.findRegistrationForFile.mockReturnValue(undefined);

    const { container } = render(
      <TranscriptEmbeddedFileCard filePath="/workspace/app/notes.md" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps TranscriptEmbeddedFileCard source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-transcript-embedded-file');
    expect(source).toContain('data-agent-elements-shell');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b/);
    expect(source).not.toMatch(/text-white|uppercase|tracking-|hover:shadow|active:scale|transition-all/);
    expect(source).not.toMatch(/<svg|<path/);
  });
});
