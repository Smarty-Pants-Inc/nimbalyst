import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FloatingTranscriptActions } from '../FloatingTranscriptActions';
import type { PromptMarker } from '../../types';

const sourcePath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentTranscript/components/FloatingTranscriptActions.tsx',
);
const panelSourcePath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentTranscript/components/AgentTranscriptPanel.tsx',
);

const prompts: PromptMarker[] = [
  {
    id: 7,
    sessionId: 'session-1',
    promptText: 'Investigate the stream renderer and replace raw JSON output with proper tool chrome.',
    outputIndex: 3,
    timestamp: '2026-05-25T08:00:00Z',
  },
];

const phaseColumns = [
  { value: 'planning', label: 'Planning', color: '#2563eb' },
  { value: 'review', label: 'Review', color: '#15803d' },
];

describe('FloatingTranscriptActions Agent Elements shell', () => {
  it('renders Agent Elements transcript controls while preserving prompt, phase, and history actions', () => {
    const onNavigateToPrompt = vi.fn();
    const onToggleSidebar = vi.fn();
    const onSetPhase = vi.fn();

    render(
      <FloatingTranscriptActions
        prompts={prompts}
        isSidebarCollapsed={true}
        onToggleSidebar={onToggleSidebar}
        onNavigateToPrompt={onNavigateToPrompt}
        currentPhase="planning"
        phaseColumns={phaseColumns}
        onSetPhase={onSetPhase}
        searchBarVisible={true}
      />,
    );

    const root = screen.getByTestId('agent-elements-floating-transcript-actions');
    expect(root).toHaveClass('floating-transcript-actions', 'agent-elements-floating-transcript-actions');
    expect(root).toHaveAttribute('data-component', 'FloatingTranscriptActions');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'floating-transcript-actions');
    expect(root).toHaveAttribute('data-search-bar-visible', 'true');

    const phaseButton = screen.getByRole('button', { name: /set phase/i });
    expect(phaseButton).toHaveClass('agent-elements-floating-transcript-button');
    expect(phaseButton).toHaveTextContent('Planning');
    fireEvent.click(phaseButton);
    fireEvent.click(screen.getByRole('menuitem', { name: /review/i }));
    expect(onSetPhase).toHaveBeenCalledWith('review');

    fireEvent.click(screen.getByRole('button', { name: /prompts menu/i }));
    const menu = screen.getByTestId('agent-elements-prompts-menu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'prompts-menu');
    expect(within(menu).getByText(/replace raw JSON output/i)).toBeInTheDocument();
    fireEvent.click(within(menu).getByText(/replace raw JSON output/i));
    expect(onNavigateToPrompt).toHaveBeenCalledWith(prompts[0]);

    fireEvent.click(screen.getByRole('button', { name: /show file history/i }));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('keeps FloatingTranscriptActions source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');
    const panelSource = readFileSync(panelSourcePath, 'utf8');

    expect(source).toContain('agent-elements-floating-transcript-actions');
    expect(source).toContain('data-agent-elements-shell="floating-transcript-actions"');
    expect(source).toContain('data-agent-elements-shell="prompts-menu"');
    expect(panelSource).toContain('data-floating-transcript-actions={shouldShowFloatingActions ? \'true\' : \'false\'}');
    expect(panelSource).toContain('data-transcript-search-visible={searchBarVisible ? \'true\' : \'false\'}');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-tool-border-color');
    expect(source).toContain('--an-primary-color');
    expect(source).not.toMatch(/--nim-|rgba\(|shadow-|transition-all|active:scale|text-white|dark:invert|tableOfContentsIconUrl|backgroundImage/);
  });
});
