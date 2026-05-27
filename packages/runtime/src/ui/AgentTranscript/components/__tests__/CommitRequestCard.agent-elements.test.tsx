import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CommitRequestCard, parseCommitRequest } from '../CommitRequestCard';

const sourcePath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentTranscript/components/CommitRequestCard.tsx',
);

const commitRequestText = [
  'Use the developer_git_commit_proposal tool to create a commit.',
  'Call developer_git_commit_proposal immediately.',
  'Changes across 2 sessions on a worktree branch:',
  '- packages/runtime/src/ui/AgentTranscript/components/CommitRequestCard.tsx (modified)',
  '- packages/runtime/src/ui/AgentElements/AgentElementsPrimitives.css (added)',
].join('\n');

describe('CommitRequestCard Agent Elements shell', () => {
  it('renders commit-request output with Agent Elements card chrome while preserving expansion', () => {
    const request = parseCommitRequest(commitRequestText);
    expect(request).not.toBeNull();

    render(<CommitRequestCard request={request!} />);

    const card = screen.getByTestId('agent-elements-commit-request-card');
    expect(card).toHaveClass('agent-elements-tool-card', 'agent-elements-commit-request-card');
    expect(card).toHaveAttribute('data-component', 'CommitRequestCard');
    expect(card).toHaveAttribute('data-agent-elements-shell', 'commit-request');
    expect(card).toHaveAttribute('data-tool-status', 'interrupted');
    expect(card).toHaveTextContent('Requesting commit proposal');
    expect(card).toHaveTextContent('2 files across 2 sessions');
    expect(card).toHaveTextContent('worktree');

    expect(screen.queryByText('CommitRequestCard.tsx')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show commit request files/i }));
    expect(screen.getByTestId('agent-elements-commit-request-files')).toHaveTextContent('CommitRequestCard.tsx');
    expect(screen.getByTestId('agent-elements-commit-request-files')).toHaveTextContent('AgentElementsPrimitives.css');
  });

  it('keeps commit-request source on Agent Elements visual tokens', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('AgentToolCard');
    expect(source).toContain('AgentStatusPill');
    expect(source).toContain('agent-elements-commit-request-card');
    expect(source).toContain('data-agent-elements-shell="commit-request"');
    expect(source).toContain('--an-tool-border-color');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-foreground-muted');
    expect(source).not.toMatch(/--nim-|bg-nim|text-nim|border-nim|rounded-lg|rounded-xl|text-white|transition-all/);
  });
});
