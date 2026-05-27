// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileTreeFilterMenu } from '../FileTreeFilterMenu';

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

const sourcePath = resolve(__dirname, '../FileTreeFilterMenu.tsx');

const defaultProps = {
  x: 24,
  y: 48,
  currentFilter: 'all' as const,
  showIcons: true,
  showGitStatus: false,
  enableAutoScroll: true,
  onFilterChange: vi.fn(),
  onShowIconsChange: vi.fn(),
  onShowGitStatusChange: vi.fn(),
  onEnableAutoScrollChange: vi.fn(),
  hasActiveClaudeSession: true,
  claudeSessionFileCounts: { read: 3, written: 2 },
  isGitRepo: true,
  gitUncommittedCount: 4,
  isGitWorktree: true,
  gitWorktreeCount: 1,
  onClose: vi.fn(),
};

describe('FileTreeFilterMenu Agent Elements shell', () => {
  it('renders an Agent Elements filter menu while preserving filter and toggle callbacks', () => {
    const props = {
      ...defaultProps,
      onFilterChange: vi.fn(),
      onShowIconsChange: vi.fn(),
      onShowGitStatusChange: vi.fn(),
      onEnableAutoScrollChange: vi.fn(),
      onClose: vi.fn(),
    };

    render(<FileTreeFilterMenu {...props} />);

    const menu = screen.getByTestId('agent-elements-file-tree-filter-menu');
    expect(menu).toHaveClass('file-tree-filter-menu', 'agent-elements-file-tree-filter-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-component', 'FileTreeFilterMenu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'file-tree-filter-menu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');
    expect(menu).toHaveAttribute('role', 'menu');
    expect(menu.className).not.toMatch(/backdrop.*blur/);

    const allFiles = within(menu).getByRole('menuitemradio', { name: /All Files/ });
    expect(allFiles).toHaveClass('filter-menu-item', 'agent-elements-file-tree-filter-menu-item', 'active');
    expect(allFiles).toHaveAttribute('aria-checked', 'true');
    expect(allFiles).toHaveAttribute('data-filter-action', 'all');
    expect(within(allFiles).getByText('', { selector: '[data-icon="folder_open"]' })).toBeInTheDocument();

    const uncommitted = within(menu).getByRole('menuitemradio', { name: /Uncommitted Changes/ });
    expect(uncommitted).toHaveAttribute('data-filter-action', 'git-uncommitted');
    expect(within(uncommitted).getByText('4')).toHaveClass('filter-menu-pill', 'agent-elements-file-tree-filter-menu-pill');

    fireEvent.click(uncommitted);
    expect(props.onFilterChange).toHaveBeenCalledWith('git-uncommitted');
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Show Icons/ }));
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Show Git Status/ }));
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Auto-Scroll to Active File/ }));

    expect(props.onShowIconsChange).toHaveBeenCalledWith(false);
    expect(props.onShowGitStatusChange).toHaveBeenCalledWith(true);
    expect(props.onEnableAutoScrollChange).toHaveBeenCalledWith(false);
  });

  it('preserves disabled git and Claude-session filters without changing selection', () => {
    const props = {
      ...defaultProps,
      currentFilter: 'known' as const,
      hasActiveClaudeSession: false,
      isGitRepo: false,
      isGitWorktree: false,
      onFilterChange: vi.fn(),
      onClose: vi.fn(),
    };

    render(<FileTreeFilterMenu {...props} />);

    const menu = screen.getByTestId('agent-elements-file-tree-filter-menu');
    const gitItem = within(menu).getByRole('menuitemradio', { name: /Uncommitted Changes/ });
    const readItem = within(menu).getByRole('menuitemradio', { name: /Files Read/ });

    expect(gitItem).toBeDisabled();
    expect(gitItem).toHaveAttribute('aria-disabled', 'true');
    expect(readItem).toBeDisabled();
    expect(within(menu).getByText('Not a git repository.')).toHaveClass('filter-menu-hint');
    expect(within(menu).getByText('Open a Claude Agent session to enable these filters.')).toHaveClass('filter-menu-hint');

    fireEvent.click(gitItem);
    fireEvent.click(readItem);

    expect(props.onFilterChange).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('keeps the source on Agent Elements-compatible filter-menu primitives', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-file-tree-filter-menu');
    expect(source).toContain('data-agent-elements-card-width="floating-menu"');
    expect(source).toContain('px-[var(--agent-elements-card-inline-padding)]');
    expect(source).toContain('py-[var(--agent-elements-card-block-padding)]');
    expect(source).toContain('data-agent-elements-shell="file-tree-filter-menu-item"');
    expect(source).toContain('role="menuitemradio"');
    expect(source).toContain('role="menuitemcheckbox"');
    expect(source).not.toContain('backdrop-blur');
    expect(source).not.toContain('rgba(');
    expect(source).not.toContain('rounded-md');
    expect(source).not.toMatch(/agent-elements-file-tree-filter-menu[^\n"]*\bp-1\b/);
    expect(source).not.toContain('bg-[var(--nim-bg-hover)]');
  });
});
