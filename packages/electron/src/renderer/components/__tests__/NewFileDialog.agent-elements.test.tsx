// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewFileDialog } from '../NewFileDialog';

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

const folderTree = [
  {
    name: 'src',
    path: '/workspace/app/src',
    type: 'directory' as const,
    children: [
      {
        name: 'components',
        path: '/workspace/app/src/components',
        type: 'directory' as const,
      },
    ],
  },
  {
    name: 'docs',
    path: '/workspace/app/docs',
    type: 'directory' as const,
  },
  {
    name: 'README.md',
    path: '/workspace/app/README.md',
    type: 'file' as const,
  },
];

describe('NewFileDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        getFolderContents: vi.fn().mockResolvedValue(folderTree),
      },
    });
  });

  it('keeps dialog chrome on Agent Elements aliases instead of legacy Nimbalyst visual tokens', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'packages/electron/src/renderer/components/NewFileDialog.tsx'),
      'utf8'
    );

    expect(source).toContain('--an-');
    expect(source).not.toMatch(/\b(?:text|border|bg)-nim(?:\b|-)/);
    expect(source).not.toMatch(/--nim-(?:text|primary|border|bg|error)/);
  });

  it('renders an Agent Elements dialog shell while preserving folder selection and markdown create behavior', async () => {
    const onClose = vi.fn();
    const onCreateFile = vi.fn();
    const onDirectoryChange = vi.fn();

    render(
      <NewFileDialog
        isOpen={true}
        onClose={onClose}
        currentDirectory="/workspace/app/src"
        workspacePath="/workspace/app"
        onCreateFile={onCreateFile}
        onDirectoryChange={onDirectoryChange}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-new-file-dialog-backdrop');
    expect(backdrop).toHaveClass('new-file-dialog-overlay', 'agent-elements-new-file-dialog-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'new-file-dialog-backdrop');

    const dialog = screen.getByTestId('agent-elements-new-file-dialog');
    expect(dialog).toHaveClass('new-file-dialog', 'agent-elements-new-file-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'NewFileDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'new-file-dialog');

    expect(screen.getByTestId('agent-elements-new-file-dialog-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'new-file-dialog-header'
    );
    expect(screen.getByTestId('agent-elements-new-file-dialog-type')).toHaveAttribute(
      'data-agent-elements-shell',
      'new-file-dialog-select'
    );
    expect(screen.getByTestId('agent-elements-new-file-dialog-location')).toHaveAttribute(
      'data-agent-elements-shell',
      'new-file-dialog-location'
    );
    expect(screen.getByTestId('agent-elements-new-file-dialog-input')).toHaveAttribute(
      'data-agent-elements-shell',
      'new-file-dialog-input'
    );

    await waitFor(() => {
      expect(window.electronAPI.getFolderContents).toHaveBeenCalledWith('/workspace/app');
    });

    expect(screen.getByText('.md')).toHaveClass('agent-elements-new-file-dialog-extension');

    fireEvent.click(screen.getByTestId('agent-elements-new-file-dialog-location'));
    const folderPicker = await screen.findByTestId('agent-elements-new-file-dialog-folder-picker');
    expect(folderPicker).toHaveClass('new-file-folder-picker', 'agent-elements-new-file-dialog-folder-picker');

    const rootOption = within(folderPicker).getByText('app (root)').closest('.new-file-folder-item');
    expect(rootOption).toHaveClass('agent-elements-new-file-dialog-folder-item');
    expect(rootOption).not.toHaveClass('text-white');

    fireEvent.click(within(folderPicker).getByText('docs'));
    expect(onDirectoryChange).toHaveBeenCalledWith('/workspace/app/docs');

    fireEvent.change(screen.getByTestId('agent-elements-new-file-dialog-input'), {
      target: { value: 'README' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onCreateFile).toHaveBeenCalledWith('README', 'markdown');
    expect(onClose).toHaveBeenCalled();
  });

  it('preserves extension-contributed file types, Other file names, and validation inside the Agent Elements shell', async () => {
    const onClose = vi.fn();
    const onCreateFile = vi.fn();

    render(
      <NewFileDialog
        isOpen={true}
        onClose={onClose}
        currentDirectory="/workspace/app"
        workspacePath="/workspace/app"
        onCreateFile={onCreateFile}
        extensionFileTypes={[
          {
            extension: '.diagram',
            displayName: 'Diagram',
            icon: 'schema',
            defaultContent: '{}',
          },
        ]}
      />
    );

    await waitFor(() => {
      expect(window.electronAPI.getFolderContents).toHaveBeenCalledWith('/workspace/app');
    });

    const typeSelect = screen.getByTestId('agent-elements-new-file-dialog-type');
    fireEvent.change(typeSelect, { target: { value: 'ext:.diagram' } });
    expect(screen.getByText('.diagram')).toHaveClass('agent-elements-new-file-dialog-extension');

    fireEvent.change(screen.getByTestId('agent-elements-new-file-dialog-input'), {
      target: { value: 'bad/name' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    const error = screen.getByTestId('agent-elements-new-file-dialog-error');
    expect(error).toHaveClass('new-file-error', 'agent-elements-new-file-dialog-error');
    expect(error).toHaveTextContent('File name cannot contain / or \\');
    expect(onCreateFile).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.change(typeSelect, { target: { value: 'any' } });
    fireEvent.change(screen.getByTestId('agent-elements-new-file-dialog-input'), {
      target: { value: 'notes.txt' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onCreateFile).toHaveBeenCalledWith('notes.txt', 'any');
    expect(onClose).toHaveBeenCalled();
  });
});
