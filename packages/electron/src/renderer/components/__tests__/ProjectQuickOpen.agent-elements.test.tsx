// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectQuickOpen } from '../ProjectQuickOpen';

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
      title,
      fill,
    }: {
      icon: string;
      size?: number;
      className?: string;
      title?: string;
      fill?: boolean;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, 'data-fill': fill, className, title }),
  };
});

describe('ProjectQuickOpen Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        workspaceManager: {
          getRecentWorkspaces: vi.fn().mockResolvedValue([
            { path: '/workspace/app', name: 'App', lastOpened: 20 },
            { path: '/workspace/tools', name: 'Tools', lastOpened: 30 },
            { path: '/workspace/archive', name: 'Archive', lastOpened: 10 },
          ]),
          getOpenWorkspaces: vi.fn().mockResolvedValue(['/workspace/app', '/workspace/tools']),
          openWorkspace: vi.fn().mockResolvedValue(undefined),
        },
      },
    });
  });

  it('renders an Agent Elements project palette shell while preserving sorting and keyboard open behavior', async () => {
    const onClose = vi.fn();

    render(
      <ProjectQuickOpen
        isOpen={true}
        onClose={onClose}
        currentWorkspacePath="/workspace/app"
      />
    );

    const backdrop = screen.getByTestId('agent-elements-project-quick-open-backdrop');
    expect(backdrop).toHaveClass('project-quick-open-backdrop', 'agent-elements-project-quick-open-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'project-quick-open-backdrop');

    const modal = screen.getByTestId('agent-elements-project-quick-open');
    expect(modal).toHaveClass('project-quick-open-modal', 'agent-elements-project-quick-open', 'agent-elements-tool-card');
    expect(modal).toHaveAttribute('data-component', 'ProjectQuickOpen');
    expect(modal).toHaveAttribute('data-agent-elements-shell', 'project-quick-open');

    expect(screen.getByTestId('agent-elements-project-quick-open-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'project-quick-open-header'
    );
    expect(screen.getByTestId('agent-elements-project-quick-open-input')).toHaveAttribute(
      'data-agent-elements-shell',
      'project-quick-open-input'
    );

    await screen.findByText('App');
    expect(window.electronAPI.workspaceManager.getRecentWorkspaces).toHaveBeenCalledTimes(1);
    expect(window.electronAPI.workspaceManager.getOpenWorkspaces).toHaveBeenCalledTimes(1);

    const firstItem = screen.getByTestId('agent-elements-project-quick-open-item-0');
    expect(firstItem).toHaveClass('project-quick-open-item', 'agent-elements-project-quick-open-item', 'selected');
    expect(firstItem).toHaveAttribute('data-agent-elements-shell', 'project-quick-open-result');
    expect(firstItem).toHaveAttribute('data-current', 'true');
    expect(firstItem).toHaveAttribute('data-open', 'true');
    expect(firstItem).not.toHaveClass('border-l-[#007aff]');
    expect(within(firstItem).getByTestId('agent-elements-project-quick-open-item-name-0')).toHaveTextContent('App');
    expect(screen.getByTestId('agent-elements-project-quick-open-footer')).toHaveAttribute(
      'data-agent-elements-shell',
      'project-quick-open-footer'
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => {
      expect(window.electronAPI.workspaceManager.openWorkspace).toHaveBeenCalledWith('/workspace/app');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('preserves project search filtering and click selection inside the Agent Elements shell', async () => {
    const onClose = vi.fn();

    render(
      <ProjectQuickOpen
        isOpen={true}
        onClose={onClose}
        currentWorkspacePath="/workspace/app"
      />
    );

    await screen.findByText('Archive');
    const input = screen.getByTestId('agent-elements-project-quick-open-input');
    fireEvent.change(input, { target: { value: 'tools' } });

    expect(screen.queryByText('App')).not.toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();

    const filteredItem = screen.getByTestId('agent-elements-project-quick-open-item-0');
    expect(filteredItem).toHaveAttribute('data-open', 'true');
    expect(filteredItem).toHaveAttribute('data-current', 'false');

    fireEvent.click(filteredItem);
    await waitFor(() => {
      expect(window.electronAPI.workspaceManager.openWorkspace).toHaveBeenCalledWith('/workspace/tools');
    });
    expect(onClose).toHaveBeenCalled();
  });
});
