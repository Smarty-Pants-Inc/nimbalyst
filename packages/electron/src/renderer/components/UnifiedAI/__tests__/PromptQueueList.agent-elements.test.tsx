// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PromptQueueList } from '../PromptQueueList';

const sourcePath = resolve(__dirname, '../PromptQueueList.tsx');

describe('UnifiedAI PromptQueueList Agent Elements shell', () => {
  it('does not render an empty queue', () => {
    const { container } = render(<PromptQueueList queue={[]} onCancel={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('wraps queued prompts in Agent Elements chrome while preserving actions and metadata', () => {
    const onCancel = vi.fn();
    const onEdit = vi.fn();
    const onSendNow = vi.fn();

    render(
      <PromptQueueList
        queue={[
          {
            id: 'queue-1',
            prompt: 'First message\n\nSecond message\n\nThird message',
            timestamp: 1710000000000,
            attachments: [
              { id: 'image-1', filename: 'mockup.png', type: 'image' },
              { id: 'pdf-1', filename: 'brief.pdf', type: 'pdf' },
              { id: 'doc-1', filename: 'notes.md', type: 'document' },
            ],
          },
          {
            id: 'queue-2',
            prompt: 'Follow-up prompt',
            timestamp: 1710000001000,
          },
        ]}
        onCancel={onCancel}
        onEdit={onEdit}
        onSendNow={onSendNow}
      />,
    );

    const shell = screen.getByTestId('agent-elements-prompt-queue');
    expect(shell).toHaveClass('prompt-queue-list', 'agent-elements-prompt-queue');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'prompt-queue');
    expect(shell).toHaveAttribute('data-component', 'UnifiedAIPromptQueueList');
    expect(shell).toHaveAttribute('data-queue-size', '2');

    expect(screen.getByTestId('agent-elements-prompt-queue-count')).toHaveTextContent('2 queued');
    const queueItems = screen.getAllByTestId('agent-elements-prompt-queue-item');
    expect(queueItems).toHaveLength(2);
    expect(screen.getByTestId('agent-elements-prompt-queue-text-queue-1')).toHaveTextContent('First message');
    expect(screen.getByTestId('agent-elements-prompt-queue-lines-queue-1')).toHaveTextContent('+2 more');

    const attachments = screen.getByTestId('agent-elements-prompt-queue-attachments');
    expect(attachments).toHaveAttribute('title', 'mockup.png, brief.pdf, notes.md');
    expect(attachments).toHaveAttribute('data-image-count', '1');
    expect(attachments).toHaveAttribute('data-file-count', '2');

    fireEvent.click(within(queueItems[0]).getByTitle('Interrupt and send now'));
    expect(onSendNow).toHaveBeenCalledWith('queue-1', 'First message\n\nSecond message\n\nThird message');

    fireEvent.click(within(queueItems[0]).getByTitle('Edit this prompt'));
    expect(onEdit).toHaveBeenCalledWith('queue-1', 'First message\n\nSecond message\n\nThird message');

    fireEvent.click(within(queueItems[1]).getByTitle('Cancel this prompt'));
    expect(onCancel).toHaveBeenCalledWith('queue-2');
  });

  it('keeps PromptQueueList source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-prompt-queue');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/<svg|&#x|×/);
    expect(source).not.toMatch(/rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/bg-nim|text-nim-primary|hover:text-nim-accent|active:scale|tracking-/);
  });
});
