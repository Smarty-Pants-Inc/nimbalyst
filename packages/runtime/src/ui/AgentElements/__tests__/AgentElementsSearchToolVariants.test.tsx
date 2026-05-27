import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TranscriptViewMessage } from '../../../ai/server/transcript/TranscriptProjector';
import { AgentElementsEventRenderer } from '../AgentElementsRendererRegistry';
import { AgentSearchToolCard } from '../AgentElementsToolRenderers';
import { projectTranscriptViewMessagesToAgentElementsModels } from '../AgentElementsTranscriptProjection';

function makeMessage(overrides: Partial<TranscriptViewMessage> & { type: TranscriptViewMessage['type'] }): TranscriptViewMessage {
  return {
    id: overrides.id ?? 1,
    sequence: overrides.sequence ?? 1,
    createdAt: overrides.createdAt ?? new Date('2026-05-25T20:45:00Z'),
    subagentId: overrides.subagentId ?? null,
    ...overrides,
  };
}

describe('Agent Elements search tool variants', () => {
  it('keeps empty and errored search tool results out of primary raw JSON rows', () => {
    const empty = makeMessage({
      type: 'tool_call',
      toolCall: {
        toolName: 'Grep',
        toolDisplayName: 'Grep',
        status: 'completed',
        description: 'Find missing projection references',
        arguments: { pattern: 'MissingRenderer', path: 'packages/runtime/src' },
        targetFilePath: null,
        mcpServer: null,
        mcpTool: null,
        result: JSON.stringify({ matches: [] }),
        providerToolCallId: 'tool-empty-grep',
        progress: [],
      },
    });
    const errored = makeMessage({
      id: 2,
      sequence: 2,
      type: 'tool_call',
      toolCall: {
        toolName: 'Read',
        toolDisplayName: 'Read',
        status: 'completed',
        description: 'Read source file',
        arguments: { file_path: '/repo/src/missing.ts' },
        targetFilePath: null,
        mcpServer: null,
        mcpTool: null,
        result: JSON.stringify({ error: 'File not found', status: 'error' }),
        isError: true,
        providerToolCallId: 'tool-errored-read',
        progress: [],
      },
    });

    const models = projectTranscriptViewMessagesToAgentElementsModels([empty, errored]);

    expect(models[0]).toMatchObject({
      kind: 'search',
      status: 'completed',
      searchResults: [],
    });
    expect(models[0].body).toBe('Find missing projection references');
    expect(models[1]).toMatchObject({
      kind: 'search',
      status: 'error',
      searchResults: [],
      body: 'error File not found; status error',
    });

    render(<AgentElementsEventRenderer model={models[1]} />);

    expect(screen.getByTestId('agent-elements-search-tool-card')).toHaveAttribute('data-tool-status', 'error');
    expect(screen.getByTestId('agent-elements-tool-primary')).toHaveTextContent('error File not found');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('"error"');
  });

  it('renders errored search results as failures rather than empty successes', () => {
    render(
      <AgentSearchToolCard
        query="/repo/src/missing.ts"
        source="code"
        status="error"
        summary="error File not found; status error"
      />
    );

    const card = screen.getByTestId('agent-elements-search-tool-card');
    expect(card).toHaveAttribute('data-tool-status', 'error');
    expect(card).toHaveTextContent('Search failed');
    expect(screen.getByTestId('agent-elements-search-empty')).toHaveTextContent('error File not found; status error');
  });
});
