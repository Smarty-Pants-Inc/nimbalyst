// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  capture: vi.fn(),
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockState.capture }),
}));

vi.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

import { ClaudeCodePluginsPanel } from '../ClaudeCodePluginsPanel';

const marketplaceData = {
  plugins: [
    {
      name: 'GitHub',
      description: 'Connect Claude Code to GitHub repositories.',
      author: 'Smarty',
      homepage: 'https://github.com',
      source: 'github:smarty/github-plugin',
      category: 'development',
    },
    {
      name: 'Linear',
      description: 'Create and update Linear issues.',
      author: 'Smarty',
      source: 'github:smarty/linear-plugin',
      category: 'productivity',
    },
  ],
  categories: ['development', 'productivity'],
};

const installedPlugins = [
  {
    name: 'Linear',
    path: '/Users/test/.claude/plugins/linear',
    enabled: true,
  },
];

describe('ClaudeCodePluginsPanel Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).confirm = vi.fn(() => true);
    (window as any).electronAPI = {
      invoke: vi.fn((channel: string, ...args: any[]) => {
        if (channel === 'claude-plugin:fetch-marketplace') {
          return Promise.resolve({ success: true, data: marketplaceData });
        }
        if (channel === 'claude-plugin:list-installed') {
          return Promise.resolve({ success: true, data: installedPlugins });
        }
        if (channel === 'claude-plugin:install') {
          expect(args).toEqual(['GitHub', 'github:smarty/github-plugin']);
          return Promise.resolve({ success: true });
        }
        if (channel === 'claude-plugin:uninstall') {
          expect(args).toEqual(['Linear']);
          return Promise.resolve({ success: true });
        }
        return Promise.resolve(undefined);
      }),
      openExternal: vi.fn(),
    };
  });

  it('renders Agent Elements markers while preserving plugin discover, install, and uninstall behavior', async () => {
    render(<ClaudeCodePluginsPanel />);

    const panel = await screen.findByTestId('agent-elements-claude-plugins-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'claude-plugins-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-claude-plugins-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-claude-plugins-view-switcher')).toHaveAttribute('data-agent-elements-shell', 'claude-plugins-view-switcher');
    expect(screen.getByTestId('agent-elements-claude-plugins-search')).toHaveAttribute('data-agent-elements-shell', 'claude-plugins-search');
    expect(screen.getByTestId('agent-elements-claude-plugins-category-development')).toHaveAttribute('data-category', 'development');
    expect(screen.getByTestId('agent-elements-claude-plugins-card-GitHub')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-claude-plugins-card-Linear')).toHaveAttribute('data-installed', 'true');

    fireEvent.change(screen.getByTestId('agent-elements-claude-plugins-search-input'), {
      target: { value: 'github' },
    });
    expect(screen.getByTestId('agent-elements-claude-plugins-card-GitHub')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-elements-claude-plugins-card-Linear')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('agent-elements-claude-plugins-install-GitHub'));
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
        'claude-plugin:install',
        'GitHub',
        'github:smarty/github-plugin',
      );
    });
    expect(mockState.capture).toHaveBeenCalledWith('claude_plugin_installed', {
      pluginName: 'GitHub',
      category: 'development',
      source: 'github:smarty/github-plugin',
    });

    fireEvent.click(screen.getByTestId('agent-elements-claude-plugins-tab-installed'));
    const installedView = screen.getByTestId('agent-elements-claude-plugins-installed-view');
    expect(installedView).toHaveAttribute('data-agent-elements-shell', 'claude-plugins-installed-view');
    expect(screen.getByTestId('agent-elements-claude-plugins-installed-Linear')).toHaveClass('agent-elements-tool-card');

    fireEvent.click(within(installedView).getByTestId('agent-elements-claude-plugins-uninstall-Linear'));
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('claude-plugin:uninstall', 'Linear');
    });
    expect(globalThis.confirm).toHaveBeenCalledWith('Uninstall Linear?');
  });
});
