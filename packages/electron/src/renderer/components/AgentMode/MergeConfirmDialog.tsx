import React, { useEffect, useRef } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { getWorktreeNameFromPath } from '../../utils/pathUtils';

const overlayClass = [
  'merge-confirm-dialog-overlay',
  'agent-elements-agent-mode-dialog-overlay',
  'fixed inset-0 z-50 flex items-center justify-center',
  'bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] p-[var(--an-spacing-xxl)]',
].join(' ');

const dialogClass = [
  'merge-confirm-dialog',
  'agent-elements-merge-confirm-dialog',
  'w-full max-w-[440px] overflow-hidden rounded-[var(--an-tool-border-radius)]',
  'border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)]',
  'outline-none shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]',
].join(' ');

const headerClass = [
  'merge-confirm-dialog-header',
  'agent-elements-merge-confirm-header',
  'flex items-center gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)]',
  'px-[var(--an-spacing-xxl)] pb-[var(--an-spacing-lg)] pt-[var(--an-spacing-xl)]',
].join(' ');

const iconClass = [
  'merge-confirm-dialog-icon',
  'agent-elements-merge-confirm-icon',
  'inline-flex h-9 w-9 shrink-0 items-center justify-center',
  'rounded-[var(--an-input-border-radius)] border border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] text-[var(--an-primary-color)]',
].join(' ');

const bodyClass = [
  'merge-confirm-dialog-body',
  'agent-elements-merge-confirm-body',
  'px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]',
].join(' ');

const infoBannerClass = [
  'merge-confirm-dialog-info-banner',
  'agent-elements-merge-confirm-info-banner',
  'mb-[var(--an-spacing-lg)] flex items-start gap-[var(--an-spacing-sm)]',
  'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-primary-color)_9%,var(--an-background))]',
  'p-[var(--an-spacing-md)] text-[13px] leading-snug text-[var(--an-foreground-muted)]',
].join(' ');

const infoCardClass = [
  'merge-confirm-dialog-info',
  'agent-elements-merge-confirm-info-card',
  'flex flex-col gap-[var(--an-spacing-sm)] rounded-[calc(var(--an-tool-border-radius)_-_4px)]',
  'border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-md)]',
].join(' ');

const footerClass = [
  'merge-confirm-dialog-footer',
  'agent-elements-merge-confirm-footer',
  'flex justify-end gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]',
].join(' ');

const buttonBaseClass = [
  'merge-confirm-dialog-button',
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)]',
  'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border px-[var(--an-spacing-lg)] py-[var(--an-spacing-xs)]',
  'text-sm font-medium outline-none transition-[background-color,border-color,color,opacity] duration-150 ease-out',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const secondaryButtonClass = [
  buttonBaseClass,
  'agent-elements-merge-confirm-cancel border-[var(--an-border-color)] bg-[var(--an-background)]',
  'text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
].join(' ');

const primaryButtonClass = [
  buttonBaseClass,
  'agent-elements-merge-confirm-action border-[var(--an-primary-color)] bg-[var(--an-primary-color)]',
  'text-[var(--an-background)] hover:border-[color-mix(in_srgb,var(--an-primary-color)_80%,var(--an-foreground))]',
  'hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]',
].join(' ');

interface MergeConfirmDialogProps {
  worktreePath: string;
  workspacePath: string;
  hasUncommittedChanges: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function getWorktreeName(worktreePath: string): string {
  return getWorktreeNameFromPath(worktreePath, 'worktree');
}

function getProjectName(workspacePath: string): string {
  return getWorktreeNameFromPath(workspacePath, 'main');
}

export function MergeConfirmDialog({
  worktreePath,
  workspacePath,
  hasUncommittedChanges,
  onConfirm,
  onCancel,
}: MergeConfirmDialogProps) {
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

  const worktreeName = getWorktreeName(worktreePath);
  const projectName = getProjectName(workspacePath);

  return (
    <div
      className={overlayClass}
      data-agent-elements-shell="agent-mode-dialog-overlay"
      data-component="MergeConfirmDialog"
      data-testid="agent-elements-merge-confirm-overlay"
      onClick={onCancel}
    >
      <div
        aria-labelledby="merge-confirm-dialog-title"
        aria-modal="true"
        className={dialogClass}
        data-agent-elements-shell="merge-confirm-dialog"
        data-testid="agent-elements-merge-confirm-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={headerClass}
          data-agent-elements-shell="merge-confirm-header"
          data-testid="agent-elements-merge-confirm-header"
        >
          <span className={iconClass}>
            <MaterialSymbol icon="merge" size={20} />
          </span>
          <h2 id="merge-confirm-dialog-title" className="m-0 text-lg font-semibold leading-tight text-[var(--an-foreground)]">
            Merge to Main
          </h2>
        </div>

        <div className={bodyClass}>
          <p className="m-0 mb-[var(--an-spacing-lg)] text-sm leading-relaxed text-[var(--an-foreground-muted)]">
            Are you sure you want to merge <strong className="font-medium text-[var(--an-foreground)]">{worktreeName}</strong> into the main branch of <strong className="font-medium text-[var(--an-foreground)]">{projectName}</strong>?
          </p>

          {hasUncommittedChanges && (
            <div
              className={infoBannerClass}
              data-testid="agent-elements-merge-confirm-info-banner"
            >
              <MaterialSymbol icon="info" size={18} className="shrink-0 text-[var(--an-primary-color)]" />
              <span>
                Your uncommitted changes will be preserved. Only committed work will be merged.
              </span>
            </div>
          )}

          <div className={infoCardClass}>
            <div className="merge-confirm-dialog-info-row flex items-center gap-[var(--an-spacing-sm)] text-[13px]">
              <span className="merge-confirm-dialog-info-label min-w-[60px] text-[var(--an-foreground-subtle)]">Source:</span>
              <span className="merge-confirm-dialog-info-value font-mono text-[var(--an-foreground)]">{worktreeName}</span>
            </div>
            <div className="merge-confirm-dialog-info-row flex items-center gap-[var(--an-spacing-sm)] text-[13px]">
              <span className="merge-confirm-dialog-info-label min-w-[60px] text-[var(--an-foreground-subtle)]">Target:</span>
              <span className="merge-confirm-dialog-info-value font-mono text-[var(--an-foreground)]">main ({projectName})</span>
            </div>
          </div>
        </div>

        <div
          className={footerClass}
          data-agent-elements-shell="merge-confirm-footer"
          data-testid="agent-elements-merge-confirm-footer"
        >
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={onConfirm}
          >
            <MaterialSymbol icon="merge" size={16} />
            <span>Merge</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MergeConfirmDialog;
