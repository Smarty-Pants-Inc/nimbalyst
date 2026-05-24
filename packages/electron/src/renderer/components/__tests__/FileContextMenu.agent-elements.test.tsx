// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileContextMenu } from '../FileContextMenu';
import type { ExtensionFileType } from '../NewFileMenu';

const fileActions = {
  hasExternalEditor: false,
  externalEditorName: undefined,
  isShareable: false,
  openInDefaultApp: vi.fn(),
  openInExternalEditor: vi.fn(),
  revealInFinder: vi.fn(),
  copyFilePath: vi.fn(),
  shareLink: vi.fn(),
};

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
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../store', async () => {
  const { atom } = await vi.importActual<typeof import('jotai')>('jotai');
  return {
    historyDialogFileAtom: atom<string | null>(null),
  };
});

vi.mock('../CommonFileActions', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    CommonFileActions: ({
      menuItemClass,
      separatorClass,
      onClose,
    }: {
      menuItemClass: string;
      separatorClass: string;
      onClose: () => void;
    }) => ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.createElement('div', {
        className: separatorClass,
        'data-testid': 'mock-common-file-actions-separator',
      }),
      ReactModule.createElement(
        'button',
        {
          type: 'button',
          className: menuItemClass,
          'data-testid': 'mock-common-file-action',
          onClick: onClose,
        },
        'Open in Default App'
      )
    ),
  };
});

vi.mock('../../hooks/useFileActions', () => ({
  useFileActions: () => fileActions,
}));

const extensionFileTypes: ExtensionFileType[] = [
  {
    extension: '.diagram',
    displayName: 'Diagram',
    icon: 'schema',
    defaultContent: '{}',
  },
];

describe('FileContextMenu Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders an Agent Elements directory menu while preserving file creation actions', () => {
    const onClose = vi.fn();
    const onNewFile = vi.fn();
    const onNewFolder = vi.fn();
    const onViewWorkspaceHistory = vi.fn();

    render(
      <FileContextMenu
        x={24}
        y={48}
        filePath="/workspace/docs"
        fileName="docs"
        fileType="directory"
        onClose={onClose}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onNewFile={onNewFile}
        onNewFolder={onNewFolder}
        onViewWorkspaceHistory={onViewWorkspaceHistory}
        extensionFileTypes={extensionFileTypes}
      />
    );

    const menu = screen.getByTestId('agent-elements-file-context-menu');
    expect(menu).toHaveClass('file-context-menu', 'agent-elements-file-context-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'file-context-menu');
    expect(menu.className).not.toMatch(/backdrop.*blur/);

    const extensionItem = screen.getByTestId('agent-elements-file-context-menu-new-ext-.diagram');
    expect(extensionItem).toHaveClass('file-context-menu-item', 'agent-elements-file-context-menu-item');
    expect(extensionItem.tagName).toBe('BUTTON');
    expect(extensionItem).toHaveAttribute('data-file-context-action', 'new-ext-.diagram');
    expect(within(extensionItem).getByText('New Diagram')).toBeInTheDocument();

    fireEvent.click(extensionItem);
    expect(onNewFile).toHaveBeenCalledWith('/workspace/docs', 'ext:.diagram');
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('agent-elements-file-context-menu-new-folder'));
    expect(onNewFolder).toHaveBeenCalledWith('/workspace/docs');

    fireEvent.click(screen.getByTestId('agent-elements-file-context-menu-history'));
    expect(onViewWorkspaceHistory).toHaveBeenCalledWith('/workspace/docs');
  });

  it('preserves rename focus and submit behavior inside the Agent Elements rename shell', () => {
    const onRename = vi.fn();
    const onClose = vi.fn();

    render(
      <FileContextMenu
        x={24}
        y={48}
        filePath="/workspace/docs/notes.md"
        fileName="notes.md"
        fileType="file"
        onClose={onClose}
        onRename={onRename}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('agent-elements-file-context-menu-rename-action'));

    const renameMenu = screen.getByTestId('agent-elements-file-context-menu-rename');
    expect(renameMenu).toHaveClass('file-context-menu-rename', 'agent-elements-file-context-menu-rename');
    expect(renameMenu).toHaveAttribute('data-agent-elements-shell', 'file-context-menu-rename');

    const input = screen.getByTestId('agent-elements-file-context-menu-rename-input');
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: 'renamed.md' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('/workspace/docs/notes.md', 'renamed.md');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('preserves batch delete confirmation under the Agent Elements danger row', () => {
    const onDeleteMultiple = vi.fn();
    const onClose = vi.fn();

    render(
      <FileContextMenu
        x={24}
        y={48}
        filePath="/workspace/docs/a.md"
        fileName="a.md"
        fileType="file"
        onClose={onClose}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onDeleteMultiple={onDeleteMultiple}
        selectedPaths={new Set(['/workspace/docs/a.md', '/workspace/docs/b.md'])}
      />
    );

    const menu = screen.getByTestId('agent-elements-file-context-menu');
    expect(menu).toHaveClass('agent-elements-file-context-menu');

    const deleteItem = screen.getByTestId('agent-elements-file-context-menu-delete-multiple');
    expect(deleteItem).toHaveClass('file-context-menu-item-danger', 'agent-elements-file-context-menu-item-danger');

    fireEvent.click(deleteItem);

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete 2 items?');
    expect(onDeleteMultiple).toHaveBeenCalledWith(['/workspace/docs/a.md', '/workspace/docs/b.md']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
