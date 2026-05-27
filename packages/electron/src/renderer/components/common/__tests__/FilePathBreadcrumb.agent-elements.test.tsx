// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilePathBreadcrumb } from '../FilePathBreadcrumb';

const mockState = vi.hoisted(() => ({
  tokens: {
    openFileRequestAtom: 'openFileRequestAtom',
    revealFileAtom: 'revealFileAtom',
    revealFolderAtom: 'revealFolderAtom',
    setWindowModeAtom: 'setWindowModeAtom',
  },
  setOpenFileRequest: vi.fn(),
  revealFile: vi.fn(),
  revealFolder: vi.fn(),
  setWindowMode: vi.fn(),
}));

vi.mock('jotai', () => ({
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.openFileRequestAtom) return mockState.setOpenFileRequest;
    if (atom === mockState.tokens.revealFileAtom) return mockState.revealFile;
    if (atom === mockState.tokens.revealFolderAtom) return mockState.revealFolder;
    if (atom === mockState.tokens.setWindowModeAtom) return mockState.setWindowMode;
    return vi.fn();
  }),
}));

vi.mock('../../../store', () => ({
  openFileRequestAtom: mockState.tokens.openFileRequestAtom,
  revealFileAtom: mockState.tokens.revealFileAtom,
  revealFolderAtom: mockState.tokens.revealFolderAtom,
  setWindowModeAtom: mockState.tokens.setWindowModeAtom,
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size, className }: { icon: string; size?: number; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

const sourcePath = resolve(__dirname, '../FilePathBreadcrumb.tsx');

describe('FilePathBreadcrumb Agent Elements shell', () => {
  beforeEach(() => {
    mockState.setOpenFileRequest.mockClear();
    mockState.revealFile.mockClear();
    mockState.revealFolder.mockClear();
    mockState.setWindowMode.mockClear();
    vi.spyOn(Date, 'now').mockReturnValue(123456);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders workspace-relative Agent Elements breadcrumb chrome and preserves folder/file navigation', () => {
    render(
      <FilePathBreadcrumb
        filePath="/workspace/project/src/components/App.tsx"
        workspacePath="/workspace/project"
        className="custom-breadcrumb"
      />,
    );

    const root = screen.getByTestId('agent-elements-file-path-breadcrumb');
    expect(root).toHaveClass('unified-header-breadcrumb', 'agent-elements-file-path-breadcrumb', 'custom-breadcrumb');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'file-path-breadcrumb');

    const folders = screen.getAllByTestId('agent-elements-file-path-breadcrumb-folder');
    expect(folders).toHaveLength(2);
    expect(folders[0]).toHaveTextContent('src');
    expect(folders[0].querySelector('[data-icon="folder"]')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-file-path-breadcrumb-file')).toHaveTextContent('App.tsx');
    expect(screen.getByTestId('agent-elements-file-path-breadcrumb-file').querySelector('[data-icon="description"]')).toBeInTheDocument();

    fireEvent.click(folders[0]);
    expect(mockState.setWindowMode).toHaveBeenCalledWith('files');
    expect(mockState.revealFolder).toHaveBeenCalledWith('/workspace/project/src');

    fireEvent.click(screen.getByTestId('agent-elements-file-path-breadcrumb-file'));
    expect(mockState.setOpenFileRequest).toHaveBeenCalledWith({
      path: '/workspace/project/src/components/App.tsx',
      ts: 123456,
    });
    expect(mockState.revealFile).toHaveBeenCalledWith('/workspace/project/src/components/App.tsx');
  });

  it('keeps FilePathBreadcrumb visual chrome on Agent Elements aliases and runtime icons', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-file-path-breadcrumb');
    expect(source).toContain('MaterialSymbol');
    expect(source).toContain('--an-foreground');
    expect(source).toContain('--an-background-tertiary');
    expect(source).not.toMatch(/var\(--nim-/);
    expect(source).not.toMatch(/<svg/);
  });
});
