import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { TranscriptViewMessage } from '../../../../ai/server/transcript/TranscriptProjector';
import { VisualDisplayWidget } from '../CustomToolWidgets/VisualDisplayWidget';

vi.mock('recharts', async () => {
  const React = await import('react');
  const Stub = ({ children, ...props }: any) => (
    <div data-recharts-stub={props.dataKey ?? props.name ?? 'chart'}>
      {children}
    </div>
  );
  return {
    ResponsiveContainer: Stub,
    BarChart: Stub,
    Bar: Stub,
    LineChart: Stub,
    Line: Stub,
    PieChart: Stub,
    Pie: Stub,
    AreaChart: Stub,
    Area: Stub,
    ScatterChart: Stub,
    Scatter: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
    Legend: Stub,
    Cell: Stub,
    ErrorBar: Stub,
  };
});

const sourcePaths = [
  'packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/VisualDisplayWidget.tsx',
  'packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/VisualDisplayImageDisplay.tsx',
].map((sourcePath) => path.join(process.cwd(), sourcePath));

function makeToolMessage(
  args: Record<string, unknown>,
  result?: string,
  overrides: Partial<TranscriptViewMessage> = {},
): TranscriptViewMessage {
  return {
    id: 1,
    sequence: 1,
    createdAt: new Date('2026-05-25T10:00:00Z'),
    type: 'tool_call',
    subagentId: null,
    toolCall: {
      toolName: 'display_to_user',
      toolDisplayName: 'display_to_user',
      status: result !== undefined ? 'completed' : 'running',
      description: null,
      arguments: args,
      targetFilePath: null,
      mcpServer: null,
      mcpTool: null,
      providerToolCallId: 'display-tool-1',
      progress: [],
      result,
    },
    ...overrides,
  };
}

describe('VisualDisplayWidget Agent Elements shell', () => {
  it('renders chart content inside an Agent Elements visual display card', () => {
    const message = makeToolMessage({
      items: [
        {
          description: 'Latency by phase',
          chart: {
            chartType: 'bar',
            data: [
              { phase: 'Plan', ms: 12 },
              { phase: 'Build', ms: 42 },
            ],
            xAxisKey: 'phase',
            yAxisKey: 'ms',
          },
        },
      ],
    }, '{"ok":true}');

    render(<VisualDisplayWidget message={message} isExpanded={true} onToggle={() => {}} sessionId="visual-display-session" />);

    const card = screen.getByTestId('agent-elements-visual-display-card');
    expect(card).toHaveClass('visual-display-widget', 'agent-elements-tool-card', 'agent-elements-visual-display-card');
    expect(card).toHaveAttribute('data-component', 'RichTranscriptAgentElementsVisualDisplay');
    expect(card).toHaveAttribute('data-agent-elements-shell', 'visual-display-card');
    expect(card).toHaveAttribute('data-tool-status', 'completed');
    expect(screen.getByTestId('agent-elements-visual-display-status')).toHaveTextContent('Rendered');

    const chart = screen.getByTestId('agent-elements-visual-display-chart');
    expect(chart).toHaveAttribute('data-chart-type', 'bar');
    expect(chart).toHaveAttribute('aria-label', 'bar chart: Latency by phase');
    expect(within(chart).getByText('Latency by phase')).toBeInTheDocument();
  });

  it('renders image galleries, loads image data, and preserves lightbox navigation', async () => {
    const readFile = vi.fn().mockResolvedValue({
      success: true,
      content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    });
    const message = makeToolMessage({
      items: [
        { description: 'Before state', image: { path: '/workspace/before.png' } },
        { description: 'After state', image: { path: '/workspace/after.png' } },
      ],
    }, '{"ok":true}');

    render(
      <VisualDisplayWidget
        message={message}
        isExpanded={true}
        onToggle={() => {}}
        sessionId="visual-display-session"
        readFile={readFile}
      />,
    );

    const gallery = screen.getByTestId('agent-elements-visual-display-gallery');
    expect(gallery).toHaveAttribute('data-image-count', '2');
    await waitFor(() => {
      expect(readFile).toHaveBeenCalledWith('/workspace/before.png');
      expect(readFile).toHaveBeenCalledWith('/workspace/after.png');
    });
    await waitFor(() => {
      expect(screen.queryAllByTestId('agent-elements-visual-display-image-loading')).toHaveLength(0);
    });

    fireEvent.click(screen.getByTestId('agent-elements-visual-display-image-card-0'));
    expect(screen.getByRole('dialog', { name: 'Image lightbox' })).toBeInTheDocument();
    const lightbox = screen.getByTestId('agent-elements-visual-display-lightbox');
    expect(lightbox).toHaveAttribute('data-agent-elements-shell', 'visual-display-lightbox');
    await waitFor(() => {
      expect(within(lightbox).queryByTestId('agent-elements-visual-display-image-loading')).toBeNull();
    });
    expect(screen.getByTestId('agent-elements-visual-display-lightbox-count')).toHaveTextContent('1 / 2');

    fireEvent.click(screen.getByTestId('agent-elements-visual-display-lightbox-next'));
    await waitFor(() => {
      expect(within(screen.getByTestId('agent-elements-visual-display-lightbox')).queryByTestId('agent-elements-visual-display-image-loading')).toBeNull();
    });
    expect(screen.getByTestId('agent-elements-visual-display-lightbox-count')).toHaveTextContent('2 / 2');
    expect(screen.getByTestId('agent-elements-visual-display-lightbox-caption')).toHaveTextContent('After state');

    fireEvent.click(screen.getByTestId('agent-elements-visual-display-lightbox-close'));
    expect(screen.queryByRole('dialog', { name: 'Image lightbox' })).toBeNull();
  });

  it('renders invalid visual arguments as an Agent Elements error card with selectable details', () => {
    const message = makeToolMessage(
      { items: [{ description: 'Broken image', image: { path: '/missing.png' } }] },
      'items[0].image.path file does not exist: "/missing.png"',
      { isError: true },
    );
    message.toolCall!.arguments = { items: [] };

    render(<VisualDisplayWidget message={message} isExpanded={true} onToggle={() => {}} sessionId="visual-display-session" />);

    const card = screen.getByTestId('agent-elements-visual-display-card');
    expect(card).toHaveAttribute('data-tool-status', 'error');
    expect(card).toHaveAttribute('data-agent-elements-shell', 'visual-display-error-card');
    expect(screen.getByTestId('agent-elements-visual-display-status')).toHaveTextContent('Error');
    expect(screen.getByTestId('agent-elements-visual-display-error')).toHaveTextContent('File not found');
  });

  it('keeps VisualDisplayWidget source on Agent Elements-compatible visual rules', () => {
    const source = sourcePaths.map((sourcePath) => readFileSync(sourcePath, 'utf8')).join('\n');

    expect(source).toContain('AgentToolCard');
    expect(source).toContain('AgentStatusPill');
    expect(source).toContain('data-agent-elements-shell="visual-display-card"');
    expect(source).toContain('RichTranscriptAgentElementsVisualDisplay');
    expect(source).toContain('--an-tool-background');
    expect(source).toContain('--an-tool-border-color');
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3,8})\b|rgba\(/);
    expect(source).not.toMatch(/--nim-/);
    expect(source).not.toMatch(/style=\{\{|contentStyle|borderRadius|letterSpacing|text-white|bg-white|bg-black|shadow-|rounded-(?:md|lg|xl|full)|transition-all|hover:scale|&times;|&larr;|&rarr;/);
  });
});
