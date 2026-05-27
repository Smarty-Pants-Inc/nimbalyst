// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeveloperDashboard } from '../DeveloperDashboard';

const sourcePath = resolve(__dirname, '../DeveloperDashboard.tsx');

vi.mock('recharts', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const Stub = ({ children, ...props }: { children?: React.ReactNode }) =>
    ReactModule.createElement('div', props, children);

  return {
    CartesianGrid: Stub,
    Legend: Stub,
    Line: Stub,
    LineChart: Stub,
    ResponsiveContainer: Stub,
    Tooltip: Stub,
    XAxis: Stub,
    YAxis: Stub,
  };
});

function installElectronApi() {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === 'dev:get-atomfamily-stats') {
      return [
        {
          name: 'sessionAtomFamily',
          count: 2,
          file: 'sessions.ts',
          params: ['workspace-a', 'workspace-b'],
        },
      ];
    }

    if (channel === 'dev:get-system-stats') {
      return {
        fileWatchers: {
          type: 'WorkspaceEventBus (native)',
          activeWorkspaces: 1,
          workspaces: [
            {
              workspacePath: '/repo/demo',
              subscriberCount: 2,
              subscriberIds: ['tree', 'editor'],
            },
          ],
          totalSubscribers: 2,
        },
        process: {
          memoryRssMB: 128,
          heapUsedMB: 64,
          heapTotalMB: 96,
          activeHandles: 8,
          platform: 'darwin',
          nodeVersion: 'v22.0.0',
          electronVersion: '37.0.0',
        },
        ipc: {
          registeredHandlers: 42,
        },
        database: {
          queryStats: {},
        },
        windows: [
          {
            id: 1,
            mode: 'developer-dashboard',
            workspacePath: '/repo/demo',
            filePath: null,
            documentEdited: false,
          },
        ],
      };
    }

    return null;
  });

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke },
  });

  return { invoke };
}

describe('DeveloperDashboard Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installElectronApi();
  });

  it('renders developer dashboard chrome with Agent Elements shell markers while preserving data fetches', async () => {
    const { invoke } = installElectronApi();
    render(<DeveloperDashboard />);

    const dashboard = screen.getByTestId('agent-elements-developer-dashboard');
    expect(dashboard).toHaveClass('developer-dashboard', 'agent-elements-developer-dashboard');
    expect(dashboard).toHaveAttribute('data-agent-elements-shell', 'developer-dashboard');

    expect(screen.getByTestId('agent-elements-developer-dashboard-tabs')).toHaveAttribute(
      'data-agent-elements-shell',
      'developer-dashboard-tabs'
    );
    expect(screen.getAllByTestId('agent-elements-developer-dashboard-tab')).toHaveLength(2);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('dev:get-system-stats');
      expect(invoke).toHaveBeenCalledWith('dev:get-atomfamily-stats');
    });

    const statCards = await screen.findAllByTestId('agent-elements-developer-dashboard-stat-card');
    expect(statCards).toHaveLength(12);
    expect(statCards[0]).toHaveTextContent('Main Memory');
    for (const card of statCards) {
      expect(card).toHaveClass('agent-elements-tool-card');
      expect(card).toHaveAttribute('data-agent-elements-card-width', 'grid-cell');
      expect(card).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
      expect(card.className).toContain('--agent-elements-card-inline-padding');
      expect(card.className).toContain('--agent-elements-card-block-padding');
      expect(card.className).not.toMatch(/\b(?:p-|px-|py-|pl-|pr-|rounded-\[10px\])/);
    }
    expect(screen.getByTestId('agent-elements-developer-dashboard-section')).toHaveAttribute(
      'data-agent-elements-shell',
      'developer-dashboard-section'
    );
  });

  it('keeps developer dashboard source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-developer-dashboard');
    expect(source).toContain('agent-elements-developer-dashboard-stat-card');
    expect(source).toContain('agent-elements-developer-dashboard-section');
    expect(source).toContain('agent-elements-developer-dashboard-table-row');
    expect(source).toContain('agent-elements-tool-card');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).toContain('data-agent-elements-card-width="grid-cell"');
    expect(source).toContain('data-agent-elements-card-width="section-row"');
    expect(source).toContain('data-agent-elements-card-padding="symmetric-inline"');
    expect(source).toContain('--an-tool-background');
    expect(source).toContain('--an-foreground-muted');

    expect(source).not.toMatch(
      /agent-elements-developer-dashboard-(?:stat-card|chart)[^`'"]*\b(?:p-|p-\[|px-|px-\[|py-|py-\[|pl-|pl-\[|pr-|pr-\[|rounded-\[10px\]|rounded-md|rounded-lg|rounded-xl)/
    );
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/--nim-surface|--nim-accent|text-white|bg-white|bg-black/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|tracking-\[/);
    expect(source).not.toMatch(/\b(?:bg|text|border|hover:bg|hover:text|hover:border)-nim(?:-[\w-]+)?\b/);
    expect(source).not.toMatch(/var\(--nim-/);
  });
});
