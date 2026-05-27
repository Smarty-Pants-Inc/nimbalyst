// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { FilesScopeDropdown } from '../FilesScopeDropdown';

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

vi.mock('../../../hooks/useFloatingMenu', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    FloatingPortal: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useFloatingMenu: () => {
      const [isOpen, setIsOpen] = ReactModule.useState(false);
      return {
        isOpen,
        setIsOpen,
        refs: {
          setReference: vi.fn(),
          setFloating: vi.fn(),
        },
        floatingStyles: {},
        getReferenceProps: () => ({}),
        getFloatingProps: () => ({}),
      };
    },
  };
});

const sourcePath = resolve(__dirname, '../FilesScopeDropdown.tsx');

function renderFilesScopeDropdown(
  props: Partial<React.ComponentProps<typeof FilesScopeDropdown>> = {},
) {
  const onFileScopeModeChange = vi.fn();
  const onFilterToCurrentSessionChange = vi.fn();
  const onGroupByDirectoryChange = vi.fn();

  render(
    <FilesScopeDropdown
      fileScopeMode="current-changes"
      onFileScopeModeChange={onFileScopeModeChange}
      hasMultipleSessions
      activeSessionId="child-session"
      filterToCurrentSession={false}
      onFilterToCurrentSessionChange={onFilterToCurrentSessionChange}
      groupByDirectory
      onGroupByDirectoryChange={onGroupByDirectoryChange}
      isWorktree
      workstreamSessionCount={3}
      worktreeName="feature/redesign"
      {...props}
    />,
  );

  return {
    onFileScopeModeChange,
    onFilterToCurrentSessionChange,
    onGroupByDirectoryChange,
  };
}

describe('AgentMode FilesScopeDropdown Agent Elements shell', () => {
  it('wraps the Files Edited scope selector in Agent Elements menu chrome', () => {
    renderFilesScopeDropdown();

    const root = screen.getByTestId('agent-elements-files-scope-dropdown');
    expect(root).toHaveClass('files-scope-dropdown', 'agent-elements-files-scope-dropdown');
    expect(root).toHaveAttribute('data-component', 'FilesScopeDropdown');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'files-scope-dropdown');

    const trigger = screen.getByTestId('files-scope-dropdown');
    expect(trigger).toHaveClass('agent-elements-files-scope-dropdown-trigger');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('Uncommitted Session Edits');
    expect(trigger).toHaveTextContent('in this Workstream (3 sessions)');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByTestId('agent-elements-files-scope-dropdown-menu');
    expect(menu).toHaveClass('files-scope-dropdown__menu', 'agent-elements-files-scope-dropdown-menu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'files-scope-dropdown-menu');
    expect(menu).toHaveAttribute('role', 'menu');

    expect(within(menu).getByText('Show Files')).toBeInTheDocument();
    expect(within(menu).getByText('Scope')).toBeInTheDocument();
    expect(within(menu).getByText('Display')).toBeInTheDocument();
    expect(within(menu).getByLabelText('Uncommitted Session Edits')).toBeChecked();
    expect(within(menu).getByLabelText('All sessions (3)')).toBeChecked();
    expect(within(menu).getByLabelText('Group by directory')).toBeChecked();
  });

  it('preserves scope, session-filter, and grouping callbacks', () => {
    const {
      onFileScopeModeChange,
      onFilterToCurrentSessionChange,
      onGroupByDirectoryChange,
    } = renderFilesScopeDropdown();

    fireEvent.click(screen.getByTestId('files-scope-dropdown'));
    const menu = screen.getByTestId('agent-elements-files-scope-dropdown-menu');

    fireEvent.click(within(menu).getByLabelText('All Session Edits'));
    expect(onFileScopeModeChange).toHaveBeenCalledWith('session-files');

    fireEvent.click(within(menu).getByLabelText('Current session only'));
    expect(onFilterToCurrentSessionChange).toHaveBeenCalledWith(true);

    fireEvent.click(within(menu).getByLabelText('Group by directory'));
    expect(onGroupByDirectoryChange).toHaveBeenCalledWith(false);
  });

  it('keeps all-changes worktree copy and hides session scope when it does not apply', () => {
    renderFilesScopeDropdown({
      fileScopeMode: 'all-changes',
      filterToCurrentSession: true,
    });

    const trigger = screen.getByTestId('files-scope-dropdown');
    expect(trigger).toHaveTextContent('All Uncommitted Files');
    expect(trigger).toHaveTextContent('in worktree feature/redesign');

    fireEvent.click(trigger);

    const menu = screen.getByTestId('agent-elements-files-scope-dropdown-menu');
    expect(within(menu).queryByText('Scope')).not.toBeInTheDocument();
    expect(within(menu).getByText('All uncommitted files in worktree feature/redesign')).toBeInTheDocument();
  });

  it('keeps FilesScopeDropdown source on Floating UI and Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('useFloatingMenu');
    expect(source).toContain('FloatingPortal');
    expect(source).toContain('agent-elements-files-scope-dropdown');
    expect(source).not.toContain('createPortal');
    expect(source).not.toContain('getBoundingClientRect');
    expect(source).not.toContain('window.innerHeight');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-lg|shadow-lg|tracking-wide/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
  });
});
