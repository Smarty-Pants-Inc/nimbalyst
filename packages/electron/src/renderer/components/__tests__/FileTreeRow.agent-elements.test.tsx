// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileTreeRow } from '../FileTreeRow';
import type { FlatTreeNode } from '../../store';

const mockState = vi.hoisted(() => ({
  fileStatus: undefined as { index: string; workingTree: string } | undefined,
  directoryStatus: undefined as { index: string; workingTree: string } | undefined,
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom.startsWith('fileGitStatus:')) return mockState.fileStatus;
    if (atom.startsWith('directoryGitStatus:')) return mockState.directoryStatus;
    return undefined;
  }),
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
    }) =>
      ReactModule.createElement('span', {
        'data-material-symbol': icon,
        'data-size': size,
        className,
      }),
    getFileIcon: (name: string) =>
      ReactModule.createElement('span', {
        'data-file-icon': name,
      }),
  };
});

vi.mock('../../store', () => ({
  fileGitStatusAtom: (path: string) => `fileGitStatus:${path}`,
  directoryGitStatusAtom: (path: string) => `directoryGitStatus:${path}`,
}));

function createNode(overrides: Partial<FlatTreeNode>): FlatTreeNode {
  return {
    path: '/workspace/src/index.ts',
    name: 'index.ts',
    type: 'file',
    depth: 1,
    index: 0,
    parentPath: '/workspace/src',
    hasChildren: false,
    isExpanded: false,
    isActive: false,
    isSelected: false,
    isMultiSelected: false,
    isDragOver: false,
    isSpecialDirectory: false,
    ...overrides,
  };
}

function renderRow(node: FlatTreeNode, overrides: Partial<React.ComponentProps<typeof FileTreeRow>> = {}) {
  const props: React.ComponentProps<typeof FileTreeRow> = {
    node,
    showIcons: true,
    isFocused: false,
    isRenaming: false,
    isDragSource: false,
    isCopyDrag: false,
    onClick: vi.fn(),
    onContextMenu: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    ...overrides,
  };

  render(<FileTreeRow {...props} />);
  return props;
}

describe('FileTreeRow Agent Elements shell', () => {
  beforeEach(() => {
    mockState.fileStatus = undefined;
    mockState.directoryStatus = undefined;
    vi.clearAllMocks();
  });

  it('renders a directory row with Agent Elements markers while preserving tree semantics and handlers', () => {
    mockState.directoryStatus = { index: ' ', workingTree: 'M' };
    const props = renderRow(createNode({
      path: '/workspace/src',
      name: 'src',
      type: 'directory',
      depth: 1,
      hasChildren: true,
      isExpanded: true,
      isSelected: true,
    }), {
      isFocused: true,
      isCopyDrag: true,
      onDragOver: vi.fn(),
      onDragLeave: vi.fn(),
      onDrop: vi.fn(),
    });

    const row = screen.getByRole('treeitem', { name: /src/i });
    expect(row).toHaveClass(
      'file-tree-directory',
      'agent-elements-file-tree-row',
      'agent-elements-file-tree-directory',
      'selected',
      'focused'
    );
    expect(row).toHaveAttribute('data-component', 'FileTreeRow');
    expect(row).toHaveAttribute('data-agent-elements-shell', 'file-tree-row');
    expect(row).toHaveAttribute('data-file-tree-kind', 'directory');
    expect(row).toHaveAttribute('data-selected', 'true');
    expect(row).toHaveAttribute('data-focused', 'true');
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(row).toHaveAttribute('aria-level', '2');

    expect(screen.getByTestId('agent-elements-file-tree-name')).toHaveTextContent('src');
    expect(screen.getByTestId('agent-elements-file-tree-status')).toHaveTextContent('M');
    expect(screen.getByTestId('agent-elements-file-tree-status')).toHaveAttribute('data-status', 'modified');

    fireEvent.click(row);
    fireEvent.contextMenu(row);
    fireEvent.dragOver(row);
    fireEvent.drop(row);

    expect(props.onClick).toHaveBeenCalledTimes(1);
    expect(props.onContextMenu).toHaveBeenCalledTimes(1);
    expect(props.onDragOver).toHaveBeenCalledTimes(1);
    expect(props.onDrop).toHaveBeenCalledTimes(1);
  });

  it('renders an active file row and inline rename input without losing legacy selectors', () => {
    mockState.fileStatus = { index: '?', workingTree: ' ' };
    const onRenameConfirm = vi.fn();
    const onRenameCancel = vi.fn();
    renderRow(createNode({
      isActive: true,
      isMultiSelected: true,
    }), {
      isRenaming: true,
      onRenameConfirm,
      onRenameCancel,
    });

    const row = screen.getByRole('treeitem');
    expect(row).toHaveClass(
      'file-tree-file',
      'agent-elements-file-tree-row',
      'agent-elements-file-tree-file',
      'active',
      'multi-selected'
    );
    expect(row).toHaveAttribute('data-component', 'FileTreeRow');
    expect(row).toHaveAttribute('data-agent-elements-shell', 'file-tree-row');
    expect(row).toHaveAttribute('data-file-tree-kind', 'file');
    expect(row).toHaveAttribute('data-active', 'true');
    expect(row).toHaveAttribute('data-selected', 'true');
    expect(row).toHaveAttribute('aria-selected', 'true');

    const input = screen.getByDisplayValue('index.ts');
    expect(input).toHaveClass('file-tree-rename-input', 'agent-elements-file-tree-rename-input');
    expect(input).toHaveAttribute('data-agent-elements-shell', 'file-tree-rename-input');

    fireEvent.change(input, { target: { value: 'main.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameConfirm).toHaveBeenCalledWith('/workspace/src/index.ts', 'main.ts');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRenameCancel).toHaveBeenCalledTimes(1);
  });
});
