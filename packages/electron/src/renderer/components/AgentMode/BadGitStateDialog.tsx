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
  'agent-elements-bad-git-state-dialog',
  'mx-[var(--an-spacing-md)] flex max-h-[calc(100vh-2rem)] w-full max-w-[760px] flex-col overflow-hidden',
  'rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background)] text-[var(--an-foreground)] outline-none',
  'shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]',
].join(' ');

const headerClass = [
  'merge-conflict-dialog-header',
  'agent-elements-bad-git-state-header',
  'flex shrink-0 items-center gap-[var(--an-spacing-md)]',
  'border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]',
].join(' ');

const bodyClass = [
  'merge-conflict-dialog-body',
  'agent-elements-bad-git-state-body',
  'flex min-h-0 flex-1 flex-col overflow-y-auto px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]',
].join(' ');

const introClass = [
  'm-0 mb-[var(--an-spacing-lg)] text-sm leading-relaxed text-[var(--an-foreground-muted)]',
].join(' ');

const noticeBaseClass = [
  'flex items-start gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border',
  'p-[var(--an-spacing-lg)] text-[13px] leading-snug',
].join(' ');

const errorClass = [
  'merge-conflict-dialog-info',
  'agent-elements-bad-git-state-error',
  noticeBaseClass,
  'mb-[var(--an-spacing-lg)] border-[color-mix(in_srgb,var(--an-warning-color)_28%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-warning-color)_8%,var(--an-background))] text-[var(--an-warning-color)]',
].join(' ');

const filesClass = [
  'merge-conflict-dialog-files',
  'agent-elements-bad-git-state-files',
  'mb-[var(--an-spacing-lg)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]',
].join(' ');

const filesHeaderClass = [
  'merge-conflict-dialog-files-header',
  'agent-elements-bad-git-state-files-header',
  'mb-[var(--an-spacing-md)] flex items-center gap-[var(--an-spacing-sm)]',
  'text-[13px] font-medium text-[var(--an-foreground)]',
].join(' ');

const filesListClass = [
  'merge-conflict-dialog-files-list',
  'm-0 flex list-none flex-col gap-[var(--an-spacing-xs)] p-0',
].join(' ');

const fileItemClass = [
  'merge-conflict-dialog-file',
  'agent-elements-bad-git-state-file',
  'flex items-center gap-[var(--an-spacing-sm)] text-[13px] text-[var(--an-foreground-muted)]',
].join(' ');

const suggestionClass = [
  'merge-conflict-dialog-suggestion',
  'agent-elements-bad-git-state-suggestion',
  noticeBaseClass,
  'mb-[var(--an-spacing-lg)] border-[color-mix(in_srgb,var(--an-success-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-success-color)_8%,var(--an-background))] text-[var(--an-success-color)]',
].join(' ');

const manualClass = [
  'merge-conflict-dialog-manual',
  'agent-elements-bad-git-state-manual',
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
  'agent-elements-bad-git-state-footer',
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
  'merge-conflict-dialog-button--secondary agent-elements-bad-git-state-close',
  'border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)]',
  'hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
].join(' ');

const primaryButtonClass = [
  buttonBaseClass,
  'merge-conflict-dialog-button--primary agent-elements-bad-git-state-resolve',
  'border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)]',
  'hover:border-[color-mix(in_srgb,var(--an-primary-color)_80%,var(--an-foreground))]',
  'hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]',
].join(' ');

interface BadGitStateDialogProps {
  worktreePath: string;
  errorMessage: string;
  conflictedFiles?: string[];
  agentModels: AgentModelOption[];
  selectedModel: string;
  isLoadingModels: boolean;
  onModelChange: (modelId: string) => void;
  onResolveWithAgent: (modelId: string) => void;
  resolveDisabled?: boolean;
  onCancel: () => void;
}

export function BadGitStateDialog({
  worktreePath,
  errorMessage,
  conflictedFiles,
  agentModels,
  selectedModel,
  isLoadingModels,
  onModelChange,
  onResolveWithAgent,
  resolveDisabled = false,
  onCancel,
}: BadGitStateDialogProps) {
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

  return (
    <div
      className={overlayClass}
      data-agent-elements-shell="agent-mode-dialog-overlay"
      data-component="BadGitStateDialog"
      data-testid="agent-elements-bad-git-state-overlay"
      onClick={onCancel}
    >
      <div
        aria-labelledby="bad-git-state-dialog-title"
        aria-modal="true"
        className={dialogClass}
        data-agent-elements-shell="bad-git-state-dialog"
        data-testid="agent-elements-bad-git-state-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={headerClass}
          data-agent-elements-shell="bad-git-state-header"
          data-testid="agent-elements-bad-git-state-header"
        >
          <span className="merge-conflict-dialog-icon-warning text-[var(--an-warning-color)]" aria-hidden="true">
            <MaterialSymbol icon="warning" size={22} />
          </span>
          <h2 id="bad-git-state-dialog-title" className="m-0 text-lg font-semibold leading-tight">
            Git Operation Failed
          </h2>
        </div>

        <div
          className={bodyClass}
          data-agent-elements-shell="bad-git-state-body"
          data-testid="agent-elements-bad-git-state-body"
        >
          <p className={introClass}>
            Cannot perform git operation on <strong className="font-medium text-[var(--an-foreground)]">{worktreeName}</strong>.
          </p>

          <div
            className={errorClass}
            data-agent-elements-shell="bad-git-state-error"
            data-testid="agent-elements-bad-git-state-error"
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="error" size={16} />
            </span>
            <p className="m-0">
              {errorMessage}
            </p>
          </div>

          {conflictedFiles && conflictedFiles.length > 0 && (
            <div
              className={filesClass}
              data-agent-elements-shell="bad-git-state-files"
              data-testid="agent-elements-bad-git-state-files"
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
          )}

          <div
            className={suggestionClass}
            data-agent-elements-shell="bad-git-state-suggestion"
            data-testid="agent-elements-bad-git-state-suggestion"
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="smart_toy" size={16} />
            </span>
            <p className="m-0">
              An AI agent can help you resolve this issue automatically, or you can fix it manually.
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
            data-agent-elements-shell="bad-git-state-manual"
            data-testid="agent-elements-bad-git-state-manual"
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
          data-agent-elements-shell="bad-git-state-footer"
          data-testid="agent-elements-bad-git-state-footer"
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

export default BadGitStateDialog;
