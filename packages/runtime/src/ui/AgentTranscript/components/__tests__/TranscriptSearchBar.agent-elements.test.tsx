import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TranscriptSearchBar } from '../TranscriptSearchBar';
import type { TranscriptViewMessage } from '../../../../ai/server/transcript/TranscriptProjector';

const sourcePath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentTranscript/components/TranscriptSearchBar.tsx',
);

const messages: TranscriptViewMessage[] = [
  {
    id: 1,
    sequence: 1,
    createdAt: new Date('2026-05-26T02:30:00Z'),
    type: 'user_message',
    text: 'Find the transcript card chrome.',
    subagentId: null,
  },
  {
    id: 2,
    sequence: 2,
    createdAt: new Date('2026-05-26T02:31:00Z'),
    type: 'assistant_message',
    text: 'Transcript search should keep quiet Agent Elements controls.',
    subagentId: null,
  },
];

describe('TranscriptSearchBar Agent Elements shell', () => {
  it('renders Agent Elements search chrome while preserving controls', () => {
    const onClose = vi.fn();
    const onScrollToMessage = vi.fn();
    const containerRef = { current: document.createElement('div') };

    render(
      <TranscriptSearchBar
        isVisible={true}
        messages={messages}
        containerRef={containerRef}
        onClose={onClose}
        onScrollToMessage={onScrollToMessage}
      />,
    );

    const root = screen.getByTestId('agent-elements-transcript-search-bar');
    expect(root).toHaveClass('transcript-search-bar', 'agent-elements-transcript-search-bar');
    expect(root).toHaveAttribute('data-component', 'TranscriptSearchBar');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'transcript-search-bar');

    const input = screen.getByPlaceholderText('Find in transcript...');
    expect(input).toHaveClass('agent-elements-transcript-search-input');
    expect(screen.getByTestId('agent-elements-transcript-search-counter')).toHaveTextContent('No matches');

    const caseButton = screen.getByRole('button', { name: /case insensitive/i });
    expect(caseButton).toHaveClass('agent-elements-transcript-search-button');
    expect(caseButton).toHaveAttribute('data-active', 'false');
    fireEvent.click(caseButton);
    expect(screen.getByRole('button', { name: /case sensitive/i })).toHaveAttribute('data-active', 'true');

    fireEvent.click(screen.getByRole('button', { name: /close transcript search/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps transcript search result navigation working through the Agent Elements shell', async () => {
    const onScrollToMessage = vi.fn();
    const containerRef = { current: document.createElement('div') };

    render(
      <TranscriptSearchBar
        isVisible={true}
        messages={messages}
        containerRef={containerRef}
        onClose={vi.fn()}
        onScrollToMessage={onScrollToMessage}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Find in transcript...'), {
      target: { value: 'transcript' },
    });

    await waitFor(() => expect(onScrollToMessage).toHaveBeenCalledWith(0));
    expect(screen.getByTestId('agent-elements-transcript-search-counter')).toHaveTextContent('1 of 2');

    fireEvent.click(screen.getByRole('button', { name: /next transcript search match/i }));
    expect(onScrollToMessage).toHaveBeenLastCalledWith(1);
  });

  it('keeps TranscriptSearchBar source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-transcript-search-bar');
    expect(source).toContain('data-agent-elements-shell="transcript-search-bar"');
    expect(source).toContain('--an-background-secondary');
    expect(source).toContain('--an-tool-border-color');
    expect(source).toContain('--an-primary-color');
    expect(source).toContain('--an-warning');
    expect(source).not.toMatch(/--nim-|text-white|transition-all|rounded-md|bg-\[var\(--nim|border-\[var\(--nim|text-\[var\(--nim/);
  });
});
