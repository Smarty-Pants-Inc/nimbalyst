import React from 'react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TranscriptViewMessage } from '../../../../ai/server/transcript/TranscriptProjector';
import { EditToolResultCard } from '../EditToolResultCard';

const sourcePath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentTranscript/components/EditToolResultCard.tsx',
);

type TestToolCall = NonNullable<TranscriptViewMessage['toolCall']>;

const makeToolMessage = (
  toolCallOverrides: Partial<TestToolCall> = {},
  messageOverrides: Partial<TranscriptViewMessage> = {},
): TranscriptViewMessage => ({
  id: 1,
  type: 'tool_call',
  text: '',
  createdAt: new Date('2026-05-26T03:06:00Z'),
  sequence: 1,
  subagentId: null,
  toolCall: {
    toolName: 'Edit',
    toolDisplayName: 'Edit',
    status: 'completed',
    description: null,
    arguments: {
      file_path: '/repo/src/app.ts',
      instruction: 'Replace the constant value.',
    },
    targetFilePath: null,
    mcpServer: null,
    mcpTool: null,
    providerToolCallId: 'edit-tool-1',
    progress: [],
    ...toolCallOverrides,
  },
  ...messageOverrides,
});

describe('EditToolResultCard Agent Elements shell', () => {
  it('renders edit result chrome while preserving file opening and nested diff routing', () => {
    const onOpenFile = vi.fn();

    render(
      <EditToolResultCard
        toolMessage={makeToolMessage()}
        edits={[{ old_string: 'const value = 1;', new_string: 'const value = 2;' }]}
        workspacePath="/repo"
        onOpenFile={onOpenFile}
      />,
    );

    const root = screen.getByTestId('rich-transcript-agent-elements-edit-card');
    expect(root).toHaveClass('agent-elements-edit-tool-card', 'agent-elements-tool-card');
    expect(root).toHaveAttribute('data-component', 'RichTranscriptAgentElementsEditCard');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'edit-tool-card');

    expect(screen.getByText('1 edit')).toBeInTheDocument();
    expect(screen.getByText('Instruction')).toBeInTheDocument();
    expect(screen.getByText('Replace the constant value.')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toHaveAttribute('data-tone', 'success');
    expect(screen.getByTestId('agent-elements-diff-viewer')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Open src/app.ts' })[0]);
    expect(onOpenFile).toHaveBeenCalledWith('/repo/src/app.ts');

    fireEvent.click(screen.getByRole('button', { name: 'Open file' }));
    expect(onOpenFile).toHaveBeenCalledTimes(2);
  });

  it('keeps new-file edits on the Agent Elements preview path', () => {
    render(
      <EditToolResultCard
        toolMessage={makeToolMessage({
          toolName: 'Write',
          toolDisplayName: 'Write',
          arguments: { file_path: '/repo/src/new-file.ts' },
        })}
        edits={[{ content: 'export const created = true;\n' }]}
        workspacePath="/repo"
      />,
    );

    expect(screen.getByText('Created')).toHaveAttribute('data-tone', 'success');
    expect(screen.getByTestId('agent-elements-new-file-preview-line-count')).toHaveTextContent('2 lines');
    expect(screen.getByTestId('agent-elements-new-file-preview')).toBeInTheDocument();
  });

  it('uses Agent Elements source styling instead of legacy transcript chrome', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-edit-tool-card');
    expect(source).toContain('data-agent-elements-shell="edit-tool-card"');
    expect(source).toContain('--an-background-tertiary');
    expect(source).toContain('--an-primary-color');
    expect(source).toContain('--an-tool-color-muted');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|--nim-|hover:bg-nim|rounded-md|rounded-lg|transition-all|rgba\(|#[0-9a-fA-F]{3,8}/);
  });
});
