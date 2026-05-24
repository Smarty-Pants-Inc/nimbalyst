// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  NewFileMenu,
  contributionToExtensionFileType,
  type ExtensionFileType,
} from '../NewFileMenu';

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

const extensionFileTypes: ExtensionFileType[] = [
  {
    extension: '.diagram',
    displayName: 'Diagram',
    icon: 'schema',
    defaultContent: '{}',
  },
];

describe('NewFileMenu Agent Elements shell', () => {
  it('renders an Agent Elements floating menu shell while preserving file-type selection', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <NewFileMenu
        x={24}
        y={48}
        onSelect={onSelect}
        onClose={onClose}
        extensionFileTypes={extensionFileTypes}
      />
    );

    const menu = screen.getByTestId('agent-elements-new-file-menu');
    expect(menu).toHaveClass('new-file-menu', 'agent-elements-new-file-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-component', 'NewFileMenu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'new-file-menu');
    expect(menu.className).not.toMatch(/backdrop.*blur/);

    const markdownItem = screen.getByTestId('agent-elements-new-file-menu-markdown');
    expect(markdownItem).toHaveClass('new-file-menu-item', 'agent-elements-new-file-menu-item');
    expect(markdownItem).toHaveAttribute('data-file-type', 'markdown');
    expect(markdownItem.tagName).toBe('BUTTON');
    expect(within(markdownItem).getByText('New Markdown File')).toBeInTheDocument();

    const mockupItem = screen.getByTestId('agent-elements-new-file-menu-mockup');
    expect(mockupItem).toHaveAttribute('data-file-type', 'mockup');

    const extensionItem = screen.getByTestId('agent-elements-new-file-menu-ext-.diagram');
    expect(extensionItem).toHaveClass('agent-elements-new-file-menu-item');
    expect(extensionItem).toHaveAttribute('data-file-type', 'ext:.diagram');
    expect(within(extensionItem).getByText('New Diagram')).toBeInTheDocument();

    const separator = screen.getByTestId('agent-elements-new-file-menu-separator');
    expect(separator).toHaveClass('new-file-menu-separator', 'agent-elements-new-file-menu-separator');
    expect(separator).toHaveAttribute('data-agent-elements-shell', 'new-file-menu-separator');

    const anyItem = screen.getByTestId('agent-elements-new-file-menu-any');
    expect(anyItem).toHaveAttribute('data-file-type', 'any');

    fireEvent.click(extensionItem);
    expect(onSelect).toHaveBeenCalledWith('ext:.diagram');
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(markdownItem);
    fireEvent.click(mockupItem);
    fireEvent.click(anyItem);

    expect(onSelect).toHaveBeenNthCalledWith(2, 'markdown');
    expect(onSelect).toHaveBeenNthCalledWith(3, 'mockup');
    expect(onSelect).toHaveBeenNthCalledWith(4, 'any');
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('preserves extension contribution conversion for NewFileMenu callers', () => {
    expect(
      contributionToExtensionFileType({
        extension: '.canvas',
        displayName: 'Canvas',
        icon: 'draw',
        defaultContent: '<canvas></canvas>',
      })
    ).toEqual({
      extension: '.canvas',
      displayName: 'Canvas',
      icon: 'draw',
      defaultContent: '<canvas></canvas>',
    });
  });
});
