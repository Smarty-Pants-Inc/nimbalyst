import React, { useEffect, useRef } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

const overlayClass = [
  'archive-worktree-dialog-overlay',
  'agent-elements-agent-mode-dialog-overlay',
  'fixed inset-0 z-50 flex items-center justify-center',
  'bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] p-[var(--an-spacing-xxl)]',
].join(' ');

const dialogClass = [
  'archive-worktree-dialog',
  'agent-elements-archive-worktree-dialog',
  'w-full max-w-[440px] overflow-hidden rounded-[var(--an-tool-border-radius)]',
  'border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)]',
  'outline-none shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]',
].join(' ');

const headerClass = [
  'archive-worktree-dialog-header',
  'agent-elements-archive-worktree-header',
  'flex items-center gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)]',
  'px-[var(--an-spacing-xxl)] pb-[var(--an-spacing-lg)] pt-[var(--an-spacing-xl)]',
].join(' ');

const iconClass = [
  'archive-worktree-dialog-icon',
  'agent-elements-archive-worktree-icon',
  'inline-flex h-9 w-9 shrink-0 items-center justify-center',
  'rounded-[var(--an-input-border-radius)] border border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] text-[var(--an-primary-color)]',
].join(' ');

const bodyClass = [
  'archive-worktree-dialog-body',
  'agent-elements-archive-worktree-body',
  'px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]',
].join(' ');

const bodyCopyClass = [
  'm-0 mb-[var(--an-spacing-lg)] select-text text-sm leading-relaxed text-[var(--an-foreground-muted)]',
].join(' ');

const warningClass = [
  'archive-worktree-warning',
  'agent-elements-archive-worktree-warning',
  'mb-[var(--an-spacing-lg)] flex items-start gap-[var(--an-spacing-sm)]',
  'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[color-mix(in_srgb,var(--an-warning-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-warning-color)_9%,var(--an-background))]',
  'p-[var(--an-spacing-md)]',
].join(' ');

const warningIconClass = [
  'archive-worktree-warning-icon',
  'agent-elements-archive-worktree-warning-icon',
  'mt-[1px] shrink-0 text-[var(--an-warning-color)]',
].join(' ');

const warningTitleClass = [
  'm-0 text-sm font-medium leading-snug text-[var(--an-warning-color)]',
].join(' ');

const warningDescriptionClass = [
  'm-0 mt-[var(--an-spacing-xs)] select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]',
].join(' ');

const infoClass = [
  'archive-worktree-dialog-info',
  'agent-elements-archive-worktree-info',
  'm-0 select-text text-xs leading-relaxed text-[var(--an-foreground-subtle)]',
].join(' ');

const footerClass = [
  'archive-worktree-dialog-footer',
  'agent-elements-archive-worktree-footer',
  'flex justify-end gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]',
].join(' ');

const buttonBaseClass = [
  'archive-worktree-dialog-button',
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)]',
  'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border px-[var(--an-spacing-lg)] py-[var(--an-spacing-xs)]',
  'text-sm font-medium outline-none transition-[background-color,border-color,color,opacity] duration-150 ease-out',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const secondaryButtonClass = [
  buttonBaseClass,
  'agent-elements-archive-worktree-secondary border-[var(--an-border-color)] bg-[var(--an-background)]',
  'text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
].join(' ');

const primaryButtonClass = [
  buttonBaseClass,
  'agent-elements-archive-worktree-primary border-[var(--an-primary-color)] bg-[var(--an-primary-color)]',
  'text-[var(--an-background)] hover:border-[color-mix(in_srgb,var(--an-primary-color)_80%,var(--an-foreground))]',
  'hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]',
].join(' ');

interface ArchiveWorktreeDialogProps {
  /** Single worktree name (singular mode) */
  worktreeName?: string;
  /** Number of worktrees being archived (bulk mode, >1 shows bulk messaging) */
  worktreeCount?: number;
  onArchive: () => void;
  onKeep: () => void;
  /** Optional message to show (e.g., "Merge successful!" after a merge) */
  contextMessage?: string;
  /** Whether any worktree has uncommitted changes that will be lost */
  hasUncommittedChanges?: boolean;
  /** Number of uncommitted files (for display) */
  uncommittedFileCount?: number;
  /** How many worktrees have uncommitted changes (bulk mode) */
  uncommittedWorktreeCount?: number;
  /** Whether any branch has unmerged commits */
  hasUnmergedChanges?: boolean;
  /** Number of unmerged commits */
  unmergedCommitCount?: number;
  /** How many worktrees have unmerged changes (bulk mode) */
  unmergedWorktreeCount?: number;
}

export function ArchiveWorktreeDialog({
  worktreeName,
  worktreeCount,
  onArchive,
  onKeep,
  contextMessage,
  hasUncommittedChanges,
  uncommittedFileCount,
  uncommittedWorktreeCount,
  hasUnmergedChanges,
  unmergedCommitCount,
  unmergedWorktreeCount,
}: ArchiveWorktreeDialogProps) {
  const isBulk = (worktreeCount ?? 1) > 1;
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onKeep();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onKeep]);

  // Focus trap
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className={overlayClass}
      data-agent-elements-shell="agent-mode-dialog-overlay"
      data-component="ArchiveWorktreeDialog"
      data-testid="agent-elements-archive-worktree-overlay"
      onClick={onKeep}
    >
      <div
        aria-labelledby="archive-worktree-dialog-title"
        aria-modal="true"
        className={dialogClass}
        data-agent-elements-shell="archive-worktree-dialog"
        data-testid="agent-elements-archive-worktree-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={headerClass}
          data-agent-elements-shell="archive-worktree-header"
          data-testid="agent-elements-archive-worktree-header"
        >
          <span className={iconClass} aria-hidden="true">
            <MaterialSymbol icon="archive" size={20} />
          </span>
          <h2 id="archive-worktree-dialog-title" className="m-0 text-lg font-semibold leading-tight text-[var(--an-foreground)]">
            {isBulk ? `Archive ${worktreeCount} Worktrees` : 'Archive Worktree'}
          </h2>
        </div>

        <div
          className={bodyClass}
          data-agent-elements-shell="archive-worktree-body"
          data-testid="agent-elements-archive-worktree-body"
        >
          <p className={bodyCopyClass}>
            {contextMessage ? `${contextMessage} ` : ''}
            {isBulk
              ? <>Are you sure you want to archive <strong className="font-medium text-[var(--an-foreground)]">{worktreeCount} worktrees</strong>?</>
              : <>Are you sure you want to archive{' '}<strong className="font-medium text-[var(--an-foreground)]">{worktreeName}</strong>?</>
            }
          </p>

          {hasUncommittedChanges && (
            <div
              className={warningClass}
              data-agent-elements-shell="archive-worktree-warning"
              data-testid="agent-elements-archive-worktree-warning"
            >
              <span className={warningIconClass} aria-hidden="true">
                <MaterialSymbol icon="warning" size={18} />
              </span>
              <div>
                <p className={warningTitleClass}>
                  Uncommitted changes will be lost
                </p>
                <p className={warningDescriptionClass}>
                  {isBulk
                    ? <>{uncommittedWorktreeCount} {uncommittedWorktreeCount === 1 ? 'worktree has' : 'worktrees have'} uncommitted changes ({uncommittedFileCount} {uncommittedFileCount === 1 ? 'file' : 'files'} total). These changes will be permanently deleted.</>
                    : <>This worktree has {uncommittedFileCount === 1 ? '1 file' : `${uncommittedFileCount} files`} with uncommitted changes. These changes will be permanently deleted.</>
                  }
                </p>
              </div>
            </div>
          )}

          {hasUnmergedChanges && (
            <div
              className={warningClass}
              data-agent-elements-shell="archive-worktree-warning"
              data-testid="agent-elements-archive-worktree-warning"
            >
              <span className={warningIconClass} aria-hidden="true">
                <MaterialSymbol icon="warning" size={18} />
              </span>
              <div>
                <p className={warningTitleClass}>
                  Unmerged commits will be lost
                </p>
                <p className={warningDescriptionClass}>
                  {isBulk
                    ? <>{unmergedWorktreeCount} {unmergedWorktreeCount === 1 ? 'worktree has' : 'worktrees have'} unmerged commits{(unmergedCommitCount ?? 0) > 0 ? ` (${unmergedCommitCount} ${unmergedCommitCount === 1 ? 'commit' : 'commits'} total)` : ''}.</>
                    : (unmergedCommitCount ?? 0) > 0
                      ? <>This branch has {unmergedCommitCount === 1 ? '1 commit' : `${unmergedCommitCount} commits`} that
                        {unmergedCommitCount === 1 ? " hasn't" : " haven't"} been merged to the base branch.</>
                      : <>This branch hasn&apos;t been merged to the base branch.</>
                  }
                </p>
              </div>
            </div>
          )}

          <p
            className={infoClass}
            data-agent-elements-shell="archive-worktree-info"
            data-testid="agent-elements-archive-worktree-info"
          >
            {isBulk
              ? 'Archiving will remove all worktrees from disk and mark their associated sessions as archived.'
              : 'Archiving will remove the worktree from disk and mark all associated sessions as archived.'
            }
          </p>
        </div>

        <div
          className={footerClass}
          data-agent-elements-shell="archive-worktree-footer"
          data-testid="agent-elements-archive-worktree-footer"
        >
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onKeep}
          >
            {isBulk ? 'Cancel' : 'Keep Worktree'}
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={onArchive}
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="archive" size={16} />
            </span>
            <span>{isBulk ? 'Archive All' : 'Archive'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ArchiveWorktreeDialog;
