// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickOpen } from '../QuickOpen';

const mockState = vi.hoisted(() => ({
  revealFolder: vi.fn(),
  posthogCapture: vi.fn(),
}));

vi.mock('jotai', () => ({
  useSetAtom: vi.fn(() => mockState.revealFolder),
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockState.posthogCapture }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
      title,
    }: {
      icon: string;
      size?: number;
      className?: string;
      title?: string;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className, title }),
  };
});

vi.mock('../../store', () => ({
  revealFolderAtom: 'revealFolderAtom',
}));

describe('QuickOpen Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        getRecentWorkspaceFiles: vi.fn().mockResolvedValue([
          '/workspace/app/README.md',
          '/workspace/app/src/App.tsx',
          '/workspace/app/docs/Plan.md',
        ]),
        buildQuickOpenCache: vi.fn().mockResolvedValue(undefined),
        searchWorkspaceFileNames: vi.fn().mockResolvedValue([
          {
            path: '/workspace/app/src/utils',
            type: 'directory',
            isFileNameMatch: true,
            matches: [],
          },
          {
            path: '/workspace/app/src/utils/format.ts',
            type: 'file',
            isFileNameMatch: true,
            matches: [],
          },
        ]),
        searchWorkspaceFileContent: vi.fn().mockResolvedValue([
          {
            path: '/workspace/app/src/utils/format.ts',
            matches: [{ line: 12, text: 'export function formatName()', start: 16, end: 22 }],
          },
        ]),
      },
    });
  });

  it('renders an Agent Elements command palette shell while preserving recent-file keyboard open behavior', async () => {
    const onClose = vi.fn();
    const onFileSelect = vi.fn();

    render(
      <QuickOpen
        isOpen={true}
        onClose={onClose}
        workspacePath="/workspace/app"
        currentFilePath="/workspace/app/README.md"
        onFileSelect={onFileSelect}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-quick-open-backdrop');
    expect(backdrop).toHaveClass('quick-open-backdrop', 'agent-elements-quick-open-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'quick-open-backdrop');

    const modal = screen.getByTestId('agent-elements-quick-open');
    expect(modal).toHaveClass('quick-open-modal', 'agent-elements-quick-open', 'agent-elements-tool-card');
    expect(modal).toHaveAttribute('data-component', 'QuickOpen');
    expect(modal).toHaveAttribute('data-agent-elements-shell', 'quick-open');
    expect(modal).toHaveAttribute('data-mode', 'file');

    expect(screen.getByTestId('agent-elements-quick-open-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'quick-open-header'
    );
    expect(screen.getByTestId('agent-elements-quick-open-input')).toHaveAttribute(
      'data-agent-elements-shell',
      'quick-open-input'
    );

    await screen.findByText('App.tsx');
    expect(window.electronAPI.getRecentWorkspaceFiles).toHaveBeenCalledWith('/workspace/app');
    expect(window.electronAPI.buildQuickOpenCache).toHaveBeenCalledWith('/workspace/app');
    expect(screen.queryByText('README.md')).not.toBeInTheDocument();

    const firstItem = screen.getByTestId('agent-elements-quick-open-item-0');
    expect(firstItem).toHaveClass('quick-open-item', 'agent-elements-quick-open-item', 'selected');
    expect(firstItem).toHaveAttribute('data-agent-elements-shell', 'quick-open-result');
    expect(firstItem).toHaveAttribute('data-selected', 'true');
    expect(firstItem).not.toHaveClass('border-l-nim-primary');
    expect(within(firstItem).getByTestId('agent-elements-quick-open-item-name-0')).toHaveClass(
      'quick-open-item-name',
      'agent-elements-quick-open-item-name'
    );
    expect(screen.getByTestId('agent-elements-quick-open-footer')).toHaveAttribute(
      'data-agent-elements-shell',
      'quick-open-footer'
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onFileSelect).toHaveBeenCalledWith('/workspace/app/src/App.tsx');
    expect(onClose).toHaveBeenCalled();
  });

  it('preserves file-name search, content search, and folder reveal behavior inside the Agent Elements shell', async () => {
    const onClose = vi.fn();
    const onFileSelect = vi.fn();
    const onFolderSelect = vi.fn();
    const onShowFileSessions = vi.fn();

    render(
      <QuickOpen
        isOpen={true}
        onClose={onClose}
        workspacePath="/workspace/app"
        onFileSelect={onFileSelect}
        onFolderSelect={onFolderSelect}
        onShowFileSessions={onShowFileSessions}
      />
    );

    const input = screen.getByTestId('agent-elements-quick-open-input');
    fireEvent.change(input, { target: { value: 'format' } });

    await waitFor(() => {
      expect(window.electronAPI.searchWorkspaceFileNames).toHaveBeenCalledWith('/workspace/app', 'format');
    });

    const directoryResult = await screen.findByTestId('agent-elements-quick-open-item-0');
    expect(directoryResult).toHaveAttribute('data-file-type', 'directory');
    expect(directoryResult).toHaveAttribute('data-name-match', 'true');
    expect(directoryResult).toHaveAttribute('data-content-match', 'false');

    const contentHint = screen.getByTestId('agent-elements-quick-open-content-search');
    expect(contentHint).toHaveClass('quick-open-content-search-hint', 'agent-elements-quick-open-content-search');
    fireEvent.click(contentHint);

    await waitFor(() => {
      expect(window.electronAPI.searchWorkspaceFileContent).toHaveBeenCalledWith('/workspace/app', 'format');
    });
    await screen.findByText('1 match');

    fireEvent.click(screen.getByTestId('agent-elements-quick-open-show-sessions-0'));
    expect(onShowFileSessions).toHaveBeenCalledWith('src/utils/format.ts');
    expect(onClose).not.toHaveBeenCalled();

    const sortedDirectoryResult = screen.getByTestId('agent-elements-quick-open-item-1');
    expect(sortedDirectoryResult).toHaveAttribute('data-file-type', 'directory');
    fireEvent.click(sortedDirectoryResult);
    expect(onFolderSelect).toHaveBeenCalledWith('/workspace/app/src/utils');
    expect(mockState.revealFolder).toHaveBeenCalledWith('/workspace/app/src/utils');
    expect(onClose).toHaveBeenCalled();
    expect(onFileSelect).not.toHaveBeenCalled();
  });
});
