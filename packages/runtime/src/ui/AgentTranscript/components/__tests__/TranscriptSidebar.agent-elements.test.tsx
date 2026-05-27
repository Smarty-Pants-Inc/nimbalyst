import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TranscriptSidebar } from '../TranscriptSidebar';
import type { PromptMarker } from '../../types';

const sourcePath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentTranscript/components/TranscriptSidebar.tsx',
);

const prompts: PromptMarker[] = [
  {
    id: 11,
    sessionId: 'session-1',
    promptText: 'Replace raw prompt-history chrome with the Agent Elements sidebar shell.',
    outputIndex: 2,
    timestamp: '2026-05-25T08:00:00Z',
    completionTimestamp: '2026-05-25T08:05:00Z',
  },
  {
    id: 12,
    sessionId: 'session-1',
    promptText: 'Keep prompt navigation and selected-row behavior intact.',
    outputIndex: 5,
    timestamp: '2026-05-25T08:10:00Z',
  },
];

describe('TranscriptSidebar Agent Elements shell', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders Agent Elements prompt-history rows while preserving navigation and collapsed behavior', () => {
    vi.setSystemTime(new Date('2026-05-25T08:15:00Z'));
    const onNavigateToPrompt = vi.fn();
    const onToggleCollapse = vi.fn();

    render(
      <TranscriptSidebar
        sessionId="session-1"
        prompts={prompts}
        onNavigateToPrompt={onNavigateToPrompt}
        isCollapsed={false}
        onToggleCollapse={onToggleCollapse}
      />,
    );

    const root = screen.getByTestId('agent-elements-transcript-sidebar');
    expect(root).toHaveClass('transcript-sidebar', 'agent-elements-transcript-sidebar');
    expect(root).toHaveAttribute('data-component', 'TranscriptSidebar');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'transcript-sidebar');
    expect(root).toHaveAttribute('data-session-id', 'session-1');
    expect(root).toHaveAttribute('data-collapsed', 'false');

    const panel = screen.getByTestId('agent-elements-transcript-sidebar-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'prompt-history-panel');
    expect(within(panel).getByText('Prompt History')).toBeInTheDocument();

    const rows = screen.getAllByTestId('agent-elements-prompt-history-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-agent-elements-shell', 'prompt-history-row');
    expect(rows[0]).toHaveAttribute('data-selected', 'false');
    expect(within(rows[0]).getByText('#1')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/Agent Elements sidebar shell/i)).toBeInTheDocument();
    expect(within(rows[0]).getByText('5m 0s')).toBeInTheDocument();

    fireEvent.click(rows[1]);
    expect(onNavigateToPrompt).toHaveBeenCalledWith(prompts[1]);
    expect(rows[1]).toHaveAttribute('data-selected', 'true');
    expect(onToggleCollapse).not.toHaveBeenCalled();

    render(
      <TranscriptSidebar
        sessionId="session-1"
        prompts={prompts}
        onNavigateToPrompt={onNavigateToPrompt}
        isCollapsed={true}
        onToggleCollapse={onToggleCollapse}
      />,
    );
    const collapsedRoots = screen.getAllByTestId('agent-elements-transcript-sidebar');
    expect(collapsedRoots[1]).toHaveAttribute('data-collapsed', 'true');
  });

  it('keeps TranscriptSidebar source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-transcript-sidebar');
    expect(source).toContain('data-agent-elements-shell="transcript-sidebar"');
    expect(source).toContain('data-agent-elements-shell="prompt-history-panel"');
    expect(source).toContain('data-agent-elements-shell="prompt-history-row"');
    expect(source).toContain('--an-background-secondary');
    expect(source).toContain('--an-tool-border-color');
    expect(source).toContain('--an-primary-color');
    expect(source).not.toMatch(/style=\{\{|--nim-|borderLeft|onMouseEnter|onMouseLeave|transition:\s*['"]all|rounded-none|border-l-\[2px\]/);
  });
});
