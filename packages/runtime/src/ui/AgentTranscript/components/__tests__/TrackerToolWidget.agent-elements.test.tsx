import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TranscriptViewMessage } from '../../../../ai/server/transcript/TranscriptProjector';
import { TrackerToolWidget } from '../CustomToolWidgets/TrackerToolWidget';

function makeTrackerMessage(
  result: string,
  overrides: Partial<TranscriptViewMessage['toolCall']> = {},
): TranscriptViewMessage {
  return {
    id: 1,
    sequence: 1,
    createdAt: new Date('2026-05-25T10:00:00Z'),
    type: 'tool_call',
    subagentId: null,
    toolCall: {
      toolName: 'tracker_update',
      toolDisplayName: 'tracker_update',
      status: 'completed',
      description: null,
      arguments: {
        id: 'bug-agent-elements-tracker',
      },
      targetFilePath: null,
      mcpServer: null,
      mcpTool: null,
      providerToolCallId: 'tracker-tool-1',
      progress: [],
      result,
      ...overrides,
    },
  };
}

describe('TrackerToolWidget Agent Elements shell', () => {
  it('uses canonical tool-call error status when tracker output is plain text', () => {
    const message = makeTrackerMessage('Tracker API rejected the update.', {
      status: 'error',
      isError: true,
    });

    render(
      <TrackerToolWidget
        message={message}
        isExpanded={true}
        onToggle={() => {}}
        sessionId="s1"
      />,
    );

    const card = screen.getByTestId('agent-elements-tracker-tool-card');
    expect(card).toHaveAttribute('data-agent-elements-shell', 'tracker-tool-card');
    expect(card).toHaveAttribute('data-component', 'RichTranscriptAgentElementsTrackerTool');
    expect(card).toHaveAttribute('data-tool-status', 'error');
    expect(screen.getByText('Tracker API rejected the update.')).toBeInTheDocument();
  });
});
