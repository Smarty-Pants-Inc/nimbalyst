import React, { useState } from 'react';
import { AgentStatusPill, AgentToolCard, type AgentStatusTone } from '../../AgentElements';
import { MaterialSymbol } from '../../icons/MaterialSymbol';

const COMMIT_REQUEST_PREFIX = 'Use the developer_git_commit_proposal tool to create a commit.';

interface ParsedCommitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

interface ParsedCommitRequest {
  files: ParsedCommitFile[];
  scenario: 'single' | 'workstream';
  sessionCount?: number;
  isWorktree: boolean;
}

export function isCommitRequestMessage(text: string): boolean {
  return text.startsWith(COMMIT_REQUEST_PREFIX) &&
    text.includes('developer_git_commit_proposal immediately');
}

export function parseCommitRequest(text: string): ParsedCommitRequest | null {
  if (!isCommitRequestMessage(text)) return null;

  const files: ParsedCommitFile[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const match = line.match(/^- (.+) \((added|modified|deleted)\)$/);
    if (match) {
      files.push({ path: match[1], status: match[2] as ParsedCommitFile['status'] });
    }
  }

  const isWorkstream = text.includes('across') && text.includes('sessions');
  const sessionCountMatch = text.match(/across (\d+) sessions/);
  const isWorktree = text.includes('worktree branch');

  return {
    files,
    scenario: isWorkstream ? 'workstream' : 'single',
    sessionCount: sessionCountMatch ? parseInt(sessionCountMatch[1], 10) : undefined,
    isWorktree,
  };
}

const STATUS_CLASSES: Record<ParsedCommitFile['status'], string> = {
  added: 'text-[var(--an-diff-added-text)]',
  modified: 'text-[var(--an-primary-color)]',
  deleted: 'text-[var(--an-diff-removed-text)]',
};

const STATUS_TONES: Record<ParsedCommitFile['status'], AgentStatusTone> = {
  added: 'success',
  modified: 'neutral',
  deleted: 'error',
};

interface CommitRequestCardProps {
  request: ParsedCommitRequest;
}

export const CommitRequestCard: React.FC<CommitRequestCardProps> = ({ request }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { files, scenario, sessionCount, isWorktree } = request;

  const scopeLabel = scenario === 'workstream'
    ? `${files.length} file${files.length !== 1 ? 's' : ''} across ${sessionCount ?? '?'} sessions`
    : `${files.length} file${files.length !== 1 ? 's' : ''}`;

  return (
    <AgentToolCard
      className="agent-elements-commit-request-card"
      data-agent-elements-shell="commit-request"
      data-component="CommitRequestCard"
      data-testid="agent-elements-commit-request-card"
      icon={<MaterialSymbol icon="commit" size={14} />}
      status="interrupted"
      subtitle={scopeLabel}
      title="Requesting commit proposal"
      trailing={isWorktree ? <AgentStatusPill tone="warning">worktree</AgentStatusPill> : null}
    >
      <button
        aria-expanded={isExpanded}
        className="agent-elements-commit-request-toggle flex w-full items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-small-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-sm)] text-left text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color-strong)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <MaterialSymbol
          icon={isExpanded ? 'expand_less' : 'expand_more'}
          size={16}
          className="shrink-0 text-[var(--an-foreground-subtle)]"
        />
        <span className="min-w-0 flex-1 text-sm font-medium text-[var(--an-foreground)]">
          {isExpanded ? 'Hide commit request files' : 'Show commit request files'}
        </span>
        <span className="shrink-0 text-xs text-[var(--an-foreground-subtle)]">
          {scopeLabel}
        </span>
      </button>

      {isExpanded && files.length > 0 && (
        <div
          className="agent-elements-commit-request-files flex flex-col gap-[var(--an-spacing-xs)]"
          data-testid="agent-elements-commit-request-files"
        >
          {files.map((file) => (
            <div
              key={file.path}
              className="agent-elements-commit-request-file flex min-w-0 items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-radius-sm)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-[0.8125rem]"
              data-file-status={file.status}
            >
              <AgentStatusPill tone={STATUS_TONES[file.status]}>{file.status}</AgentStatusPill>
              <span className={`min-w-0 shrink-0 font-mono ${STATUS_CLASSES[file.status]}`}>
                {file.path.split('/').pop()}
              </span>
              <span className="min-w-0 truncate text-xs text-[var(--an-foreground-subtle)]">
                {file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </AgentToolCard>
  );
};
