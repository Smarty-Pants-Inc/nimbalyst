import React, { useEffect, useRef } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { getWorktreeNameFromPath } from '../../utils/pathUtils';
import { AgentModelPicker, type AgentModelOption } from './AgentModelPicker';

const overlayClass = [
  'merge-conflict-dialog-overlay',
  'agent-elements-agent-mode-dialog-overlay',
  'fixed inset-0 z-50 flex items-center justify-center',
  'bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] p-[var(--an-spacing-xxl)]',
].join(' ');

const dialogClass = [
  'merge-conflict-dialog',
  'agent-elements-rebase-conflict-dialog',
  'mx-[var(--an-spacing-md)] flex max-h-[calc(100vh-2rem)] w-full max-w-[760px] flex-col overflow-hidden',
  'rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background)] text-[var(--an-foreground)] outline-none',
  'shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]',
].join(' ');

const headerClass = [
  'merge-conflict-dialog-header',
  'agent-elements-rebase-conflict-header',
  'flex shrink-0 items-center gap-[var(--an-spacing-md)]',
  'border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]',
].join(' ');

const bodyClass = [
  'merge-conflict-dialog-body',
  'agent-elements-rebase-conflict-body',
  'flex min-h-0 flex-1 flex-col overflow-y-auto px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]',
].join(' ');

const introClass = [
  'm-0 mb-[var(--an-spacing-lg)] text-sm leading-relaxed text-[var(--an-foreground-muted)]',
].join(' ');

const noticeBaseClass = [
  'flex items-start gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border',
  'p-[var(--an-spacing-lg)] text-[13px] leading-snug',
].join(' ');

const filesClass = [
  'merge-conflict-dialog-files',
  'agent-elements-rebase-conflict-files',
  'mb-[var(--an-spacing-lg)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]',
].join(' ');

const filesHeaderClass = [
  'merge-conflict-dialog-files-header',
  'agent-elements-rebase-conflict-files-header',
  'mb-[var(--an-spacing-md)] flex items-center gap-[var(--an-spacing-sm)]',
  'text-[13px] font-medium text-[var(--an-foreground)]',
].join(' ');

const filesListClass = [
  'merge-conflict-dialog-files-list',
  'm-0 flex list-none flex-col gap-[var(--an-spacing-xs)] p-0',
].join(' ');

const fileItemClass = [
  'merge-conflict-dialog-file',
  'agent-elements-rebase-conflict-file',
  'flex items-center gap-[var(--an-spacing-sm)] text-[13px] text-[var(--an-foreground-muted)]',
].join(' ');

const commitsGridClass = [
  'agent-elements-rebase-conflict-commits',
  'mb-[var(--an-spacing-lg)] grid grid-cols-1 gap-[var(--an-spacing-md)] sm:grid-cols-2',
].join(' ');

const commitCardClass = [
  'merge-conflict-dialog-files',
  'agent-elements-rebase-conflict-commit-card',
  'rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]',
].join(' ');

const commitListClass = [
  'merge-conflict-dialog-files-list',
  'm-0 flex max-h-[150px] list-none flex-col gap-[var(--an-spacing-xs)] overflow-y-auto p-0',
].join(' ');

const commitItemClass = [
  'merge-conflict-dialog-file',
  'agent-elements-rebase-conflict-commit',
  'flex items-center gap-[var(--an-spacing-sm)] text-[13px] text-[var(--an-foreground-muted)]',
].join(' ');

const moreCommitItemClass = [
  commitItemClass,
  'italic opacity-70',
].join(' ');

const infoClass = [
  'merge-conflict-dialog-info',
  'agent-elements-rebase-conflict-info',
  noticeBaseClass,
  'mb-[var(--an-spacing-lg)] border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-primary-color)_7%,var(--an-background))] text-[var(--an-primary-color)]',
].join(' ');

const suggestionClass = [
  'merge-conflict-dialog-suggestion',
  'agent-elements-rebase-conflict-suggestion',
  noticeBaseClass,
  'mb-[var(--an-spacing-lg)] border-[color-mix(in_srgb,var(--an-success-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-success-color)_8%,var(--an-background))] text-[var(--an-success-color)]',
].join(' ');

const manualClass = [
  'merge-conflict-dialog-manual',
  'agent-elements-rebase-conflict-manual',
  'flex flex-col gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)]',
  'border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)] text-[13px]',
].join(' ');

const pathClass = [
  'merge-conflict-dialog-path',
  'block break-all rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]',
  'font-mono text-xs text-[var(--an-foreground)]',
].join(' ');

const footerClass = [
  'merge-conflict-dialog-footer',
  'agent-elements-rebase-conflict-footer',
  'flex shrink-0 justify-end gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]',
].join(' ');

const buttonBaseClass = [
  'merge-conflict-dialog-button',
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)]',
  'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border px-[var(--an-spacing-lg)] py-[var(--an-spacing-xs)]',
  'text-sm font-medium outline-none transition-[background-color,border-color,color,opacity] duration-150 ease-out',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const secondaryButtonClass = [
  buttonBaseClass,
  'merge-conflict-dialog-button--secondary agent-elements-rebase-conflict-close',
  'border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)]',
  'hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
].join(' ');

const primaryButtonClass = [
  buttonBaseClass,
  'merge-conflict-dialog-button--primary agent-elements-rebase-conflict-resolve',
  'border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)]',
  'hover:border-[color-mix(in_srgb,var(--an-primary-color)_80%,var(--an-foreground))]',
  'hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]',
].join(' ');

interface RebaseConflictDialogProps {
  worktreePath: string;
  conflictedFiles: string[];
  conflictingCommits?: { ours: string[]; theirs: string[] };
  agentModels: AgentModelOption[];
  selectedModel: string;
  isLoadingModels: boolean;
  onModelChange: (modelId: string) => void;
  onResolveWithAgent: (modelId: string) => void;
  resolveDisabled?: boolean;
  onCancel: () => void;
}

export function RebaseConflictDialog({
  worktreePath,
  conflictedFiles,
  conflictingCommits,
  agentModels,
  selectedModel,
  isLoadingModels,
  onModelChange,
  onResolveWithAgent,
  resolveDisabled = false,
  onCancel,
}: RebaseConflictDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Focus trap
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const worktreeName = getWorktreeNameFromPath(worktreePath, 'worktree');

  // Limit commits to show (max 5 each)
  const ourCommits = conflictingCommits?.ours?.slice(0, 5) || [];
  const theirCommits = conflictingCommits?.theirs?.slice(0, 5) || [];
  const hasMoreOurCommits = (conflictingCommits?.ours?.length || 0) > 5;
  const hasMoreTheirCommits = (conflictingCommits?.theirs?.length || 0) > 5;

  return (
    <div
      className={overlayClass}
      data-agent-elements-shell="agent-mode-dialog-overlay"
      data-component="RebaseConflictDialog"
      data-testid="agent-elements-rebase-conflict-overlay"
      onClick={onCancel}
    >
      <div
        aria-labelledby="rebase-conflict-dialog-title"
        aria-modal="true"
        className={dialogClass}
        data-agent-elements-shell="rebase-conflict-dialog"
        data-testid="agent-elements-rebase-conflict-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={headerClass}
          data-agent-elements-shell="rebase-conflict-header"
          data-testid="agent-elements-rebase-conflict-header"
        >
          <span className="merge-conflict-dialog-icon-warning text-[var(--an-warning-color)]" aria-hidden="true">
            <MaterialSymbol icon="warning" size={22} />
          </span>
          <h2 id="rebase-conflict-dialog-title" className="m-0 text-lg font-semibold leading-tight">
            Rebase Conflicts Detected
          </h2>
        </div>

        <div
          className={bodyClass}
          data-agent-elements-shell="rebase-conflict-body"
          data-testid="agent-elements-rebase-conflict-body"
        >
          <p className={introClass}>
            Cannot rebase <strong className="font-medium text-[var(--an-foreground)]">{worktreeName}</strong> because there are conflicts between the worktree branch and the base branch.
          </p>

          <div
            className={filesClass}
            data-agent-elements-shell="rebase-conflict-files"
            data-testid="agent-elements-rebase-conflict-files"
          >
            <div className={filesHeaderClass}>
              <span aria-hidden="true">
                <MaterialSymbol icon="description" size={16} />
              </span>
              <span>Conflicted Files:</span>
            </div>
            <ul className={filesListClass}>
              {conflictedFiles.map((file) => (
                <li key={file} className={fileItemClass}>
                  <span className="merge-conflict-dialog-file-icon shrink-0 text-[var(--an-warning-color)]" aria-hidden="true">
                    <MaterialSymbol icon="error" size={14} />
                  </span>
                  <code className="bg-transparent p-0 font-mono text-[var(--an-foreground)]">{file}</code>
                </li>
              ))}
            </ul>
          </div>

          {conflictingCommits && (ourCommits.length > 0 || theirCommits.length > 0) && (
            <div
              className={commitsGridClass}
              data-agent-elements-shell="rebase-conflict-commits"
              data-testid="agent-elements-rebase-conflict-commits"
            >
              {ourCommits.length > 0 && (
                <div className={commitCardClass}>
                  <div className={[filesHeaderClass, 'text-[var(--an-primary-color)]'].join(' ')}>
                    <span aria-hidden="true">
                      <MaterialSymbol icon="commit" size={16} />
                    </span>
                    <span>Your Conflicting Commits:</span>
                  </div>
                  <ul className={commitListClass}>
                    {ourCommits.map((commit, idx) => (
                      <li key={idx} className={commitItemClass}>
                        <span aria-hidden="true">
                          <MaterialSymbol icon="arrow_forward" size={14} />
                        </span>
                        <span className="text-xs">{commit}</span>
                      </li>
                    ))}
                    {hasMoreOurCommits && (
                      <li className={moreCommitItemClass}>
                        <span aria-hidden="true">
                          <MaterialSymbol icon="more_horiz" size={14} />
                        </span>
                        <span className="text-xs">
                          {(conflictingCommits?.ours?.length || 0) - 5} more commit(s)
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {theirCommits.length > 0 && (
                <div className={commitCardClass}>
                  <div className={[filesHeaderClass, 'text-[var(--an-success-color)]'].join(' ')}>
                    <span aria-hidden="true">
                      <MaterialSymbol icon="commit" size={16} />
                    </span>
                    <span>Incoming Conflicting Commits:</span>
                  </div>
                  <ul className={commitListClass}>
                    {theirCommits.map((commit, idx) => (
                      <li key={idx} className={commitItemClass}>
                        <span aria-hidden="true">
                          <MaterialSymbol icon="arrow_forward" size={14} />
                        </span>
                        <span className="text-xs">{commit}</span>
                      </li>
                    ))}
                    {hasMoreTheirCommits && (
                      <li className={moreCommitItemClass}>
                        <span aria-hidden="true">
                          <MaterialSymbol icon="more_horiz" size={14} />
                        </span>
                        <span className="text-xs">
                          {(conflictingCommits?.theirs?.length || 0) - 5} more commit(s)
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div
            className={infoClass}
            data-agent-elements-shell="rebase-conflict-info"
            data-testid="agent-elements-rebase-conflict-info"
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="info" size={16} />
            </span>
            <p className="m-0">
              Conflicts were detected before starting the rebase. You must resolve these conflicts before the rebase can complete.
            </p>
          </div>

          <div
            className={suggestionClass}
            data-agent-elements-shell="rebase-conflict-suggestion"
            data-testid="agent-elements-rebase-conflict-suggestion"
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="smart_toy" size={16} />
            </span>
            <p className="m-0">
              An AI agent can help you resolve these conflicts automatically, or you can resolve them manually.
            </p>
          </div>

          <AgentModelPicker
            models={agentModels}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            isLoading={isLoadingModels}
          />

          <div
            className={manualClass}
            data-agent-elements-shell="rebase-conflict-manual"
            data-testid="agent-elements-rebase-conflict-manual"
          >
            <p className="m-0 flex items-center gap-[var(--an-spacing-sm)] text-[var(--an-foreground-muted)]">
              <span aria-hidden="true">
                <MaterialSymbol icon="terminal" size={16} />
              </span>
              Worktree location:
            </p>
            <code className={pathClass}>{worktreePath}</code>
          </div>
        </div>

        <div
          className={footerClass}
          data-agent-elements-shell="rebase-conflict-footer"
          data-testid="agent-elements-rebase-conflict-footer"
        >
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onCancel}
          >
            Close
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => onResolveWithAgent(selectedModel)}
            disabled={resolveDisabled}
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="smart_toy" size={16} />
            </span>
            <span>Resolve with Agent</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default RebaseConflictDialog;
