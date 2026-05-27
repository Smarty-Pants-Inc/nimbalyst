import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { TranscriptViewMessage } from '../../../../ai/server/transcript/TranscriptProjector';
import { BashWidget } from '../CustomToolWidgets/BashWidget';

vi.mock('../../../../utils/clipboard', () => ({
  copyToClipboard: vi.fn(),
}));

function makeBashMessage(
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
      toolName: 'Bash',
      toolDisplayName: 'Bash',
      status: 'completed',
      description: null,
      arguments: {
        command: 'npm run failing-test',
        description: 'Run failing command',
      },
      targetFilePath: null,
      mcpServer: null,
      mcpTool: null,
      providerToolCallId: 'bash-tool-1',
      progress: [],
      result,
      ...overrides,
    },
  };
}

describe('BashWidget Agent Elements shell', () => {
  it('uses canonical tool-call error status when Bash output is plain text', () => {
    const message = makeBashMessage('tests failed', {
      status: 'error',
      isError: true,
    });

    const { container } = render(
      <BashWidget
        message={message}
        isExpanded={true}
        onToggle={() => {}}
        sessionId="s1"
      />,
    );

    const shell = screen.getByTestId('rich-transcript-agent-elements-bash-shell');
    expect(shell).toHaveAttribute('data-component', 'RichTranscriptAgentElementsBashShell');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'tool-card');
    expect(shell).toHaveAttribute('data-bash-status', 'error');
    expect(container.querySelector('pre.text-nim-error')).not.toBeNull();
    expect(screen.getByText('tests failed')).toBeInTheDocument();
  });

  it('routes Bash card gutters through the shared Agent Elements inline padding token', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/BashWidget.tsx'),
      'utf8',
    );

    expect(source).toContain('px-[var(--agent-elements-card-inline-padding,var(--an-spacing-md))]');
    expect(source).not.toMatch(/agent-elements-bash-tool-card[^`]*\bpx-2\b/s);
    expect(source).not.toMatch(/agent-elements-bash-tool-card[^`]*\bp-2\b/s);
  });
});
