// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AIUsageReport } from '../AIUsageReport';

const folderPath = resolve(__dirname, '..');
const sourceFiles = [
  'AIUsageReport.tsx',
  'OverviewDashboard.tsx',
  'ActivityHeatmap.tsx',
  'HistoricalGraph.tsx',
  'ProjectInsights.tsx',
  'ModelComparison.tsx',
].map((fileName) => resolve(folderPath, fileName));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size }: { icon: string; size?: number }) =>
      ReactModule.createElement('span', {
        'data-icon': icon,
        'data-size': size,
      }),
  };
});

vi.mock('../OverviewDashboard', () => ({
  OverviewDashboard: ({ workspaceId }: { workspaceId?: string }) => (
    <div data-testid="mock-overview-dashboard" data-workspace-id={workspaceId ?? ''} />
  ),
}));

vi.mock('../ActivityHeatmap', () => ({
  ActivityHeatmap: ({ workspaceId }: { workspaceId?: string }) => (
    <div data-testid="mock-activity-heatmap" data-workspace-id={workspaceId ?? ''} />
  ),
}));

vi.mock('../HistoricalGraph', () => ({
  HistoricalGraph: ({ workspaceId }: { workspaceId?: string }) => (
    <div data-testid="mock-historical-graph" data-workspace-id={workspaceId ?? ''} />
  ),
}));

vi.mock('../ProjectInsights', () => ({
  ProjectInsights: () => <div data-testid="mock-project-insights" />,
}));

describe('AIUsageReport Agent Elements shell', () => {
  it('renders the usage report with Agent Elements shell markers and close behavior', () => {
    const onClose = vi.fn();
    render(<AIUsageReport onClose={onClose} />);

    const report = screen.getByTestId('agent-elements-ai-usage-report');
    expect(report).toHaveClass('ai-usage-report', 'agent-elements-ai-usage-report');
    expect(report).toHaveAttribute('data-agent-elements-shell', 'ai-usage-report');

    expect(screen.getByTestId('agent-elements-ai-usage-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'ai-usage-header'
    );
    expect(screen.getAllByTestId('agent-elements-ai-usage-section')).toHaveLength(3);
    expect(screen.getByTestId('mock-overview-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('mock-activity-heatmap')).toBeInTheDocument();
    expect(screen.getByTestId('mock-historical-graph')).toBeInTheDocument();
    expect(screen.getByTestId('mock-project-insights')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('agent-elements-ai-usage-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps AI usage report source on Agent Elements-compatible visual rules', () => {
    const sources = sourceFiles.map((sourcePath) => readFileSync(sourcePath, 'utf8')).join('\n');

    expect(sources).toContain('agent-elements-ai-usage-report');
    expect(sources).toContain('agent-elements-ai-usage-section');
    expect(sources).toContain('agent-elements-ai-usage-stat-card');
    expect(sources).toContain('agent-elements-ai-usage-heatmap-cell');
    expect(sources).toContain('agent-elements-ai-usage-chart');
    expect(sources).toContain('agent-elements-ai-usage-project-card');

    expect(sources).not.toMatch(/rounded-md|rounded-lg|rounded-xl/);
    expect(sources).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(sources).not.toMatch(/bg-white|text-white|bg-black|hover:scale|tracking-\[/);
    expect(sources).not.toMatch(/legend-gradient|linear-gradient|--nim-accent|--nim-surface|text-nim-fg/);
  });
});
