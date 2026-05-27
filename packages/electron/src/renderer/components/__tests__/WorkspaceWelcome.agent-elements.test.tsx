// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceWelcome } from '../WorkspaceWelcome';

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
  };
});

describe('WorkspaceWelcome Agent Elements shell', () => {
  it('renders a left-aligned Agent Elements empty-state shell while preserving title, tips, and icon fallback', () => {
    render(<WorkspaceWelcome workspaceName="Open a file to get started" />);

    const shell = screen.getByTestId('agent-elements-workspace-welcome');
    expect(shell).toHaveClass('workspace-welcome', 'agent-elements-workspace-welcome');
    expect(shell).toHaveAttribute('data-component', 'WorkspaceWelcome');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'workspace-welcome');

    const content = screen.getByTestId('agent-elements-workspace-welcome-content');
    expect(content).toHaveClass('workspace-welcome-content', 'agent-elements-workspace-welcome-content');
    expect(content).toHaveAttribute('data-agent-elements-shell', 'workspace-welcome-content');

    expect(screen.getByRole('heading', { name: 'Open a file to get started' })).toHaveClass(
      'workspace-welcome-title'
    );

    const iconFrame = screen.getByTestId('agent-elements-workspace-welcome-icon');
    expect(iconFrame).toHaveAttribute('data-agent-elements-shell', 'workspace-welcome-icon');

    const tips = screen.getByTestId('agent-elements-workspace-welcome-tips');
    expect(tips).toHaveClass('workspace-welcome-tips', 'agent-elements-tool-card');
    expect(tips).toHaveAttribute('data-agent-elements-shell', 'workspace-welcome-tips');
    expect(tips).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(tips).toHaveAttribute('data-agent-elements-card-width', 'bounded-fallback');
    expect(tips.className).toContain('--agent-elements-card-inline-padding');
    expect(tips.className).toContain('--agent-elements-card-block-padding');
    expect(screen.getAllByTestId('agent-elements-workspace-welcome-tip')).toHaveLength(3);
    expect(tips).toHaveTextContent('Open Markdown files from the sidebar');
    expect(tips).toHaveTextContent('Edit files directly or use the agent on the right side');
    expect(tips).toHaveTextContent('Files are automatically saved as you work');

    const icon = screen.queryByRole('img', { name: 'Nimbalyst' });
    if (icon) {
      fireEvent.error(icon);
      expect(icon).toHaveStyle({ display: 'none' });
    }
  });
});
