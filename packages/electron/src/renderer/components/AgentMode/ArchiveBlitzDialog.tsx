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
  'agent-elements-archive-blitz-dialog',
  'w-full max-w-[440px] overflow-hidden rounded-[var(--an-tool-border-radius)]',
  'border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)]',
  'outline-none shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]',
].join(' ');

const headerClass = [
  'archive-worktree-dialog-header',
  'agent-elements-archive-blitz-header',
  'flex items-center gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)]',
  'px-[var(--an-spacing-xxl)] pb-[var(--an-spacing-lg)] pt-[var(--an-spacing-xl)]',
].join(' ');

const iconClass = [
  'archive-worktree-dialog-icon',
  'agent-elements-archive-blitz-icon',
  'inline-flex h-9 w-9 shrink-0 items-center justify-center',
  'rounded-[var(--an-input-border-radius)] border border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] text-[var(--an-primary-color)]',
].join(' ');

const bodyClass = [
  'archive-worktree-dialog-body',
  'agent-elements-archive-blitz-body',
  'px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]',
].join(' ');

const successClass = [
  'archive-worktree-dialog-success',
  'agent-elements-archive-blitz-success',
  'mb-[var(--an-spacing-lg)] flex items-start gap-[var(--an-spacing-sm)]',
  'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[color-mix(in_srgb,var(--an-success-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-success-color)_9%,var(--an-background))]',
  'p-[var(--an-spacing-md)] text-sm leading-relaxed text-[var(--an-foreground-muted)]',
].join(' ');

const footerClass = [
  'archive-worktree-dialog-footer',
  'agent-elements-archive-blitz-footer',
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
  'agent-elements-archive-blitz-secondary border-[var(--an-border-color)] bg-[var(--an-background)]',
  'text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
].join(' ');

const primaryButtonClass = [
  buttonBaseClass,
  'agent-elements-archive-blitz-primary border-[var(--an-primary-color)] bg-[var(--an-primary-color)]',
  'text-[var(--an-background)] hover:border-[color-mix(in_srgb,var(--an-primary-color)_80%,var(--an-foreground))]',
  'hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]',
].join(' ');

interface ArchiveBlitzDialogProps {
  blitzName: string;
  worktreeName: string;
  onArchiveBlitz: () => void;
  onArchiveWorktreeOnly: () => void;
  onKeep: () => void;
}

export function ArchiveBlitzDialog({
  blitzName,
  worktreeName,
  onArchiveBlitz,
  onArchiveWorktreeOnly,
  onKeep,
}: ArchiveBlitzDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onKeep();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onKeep]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className={overlayClass}
      data-agent-elements-shell="agent-mode-dialog-overlay"
      data-component="ArchiveBlitzDialog"
      data-testid="agent-elements-archive-blitz-overlay"
      onClick={onKeep}
    >
      <div
        aria-labelledby="archive-blitz-dialog-title"
        aria-modal="true"
        className={dialogClass}
        data-agent-elements-shell="archive-blitz-dialog"
        data-testid="agent-elements-archive-blitz-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={headerClass}
          data-agent-elements-shell="archive-blitz-header"
          data-testid="agent-elements-archive-blitz-header"
        >
          <span className={iconClass}>
            <MaterialSymbol icon="archive" size={20} />
          </span>
          <h2 id="archive-blitz-dialog-title" className="m-0 text-lg font-semibold leading-tight text-[var(--an-foreground)]">Merge Successful</h2>
        </div>

        <div className={bodyClass}>
          <div
            className={successClass}
            data-testid="agent-elements-archive-blitz-success"
          >
            <MaterialSymbol icon="check_circle" size={18} className="mt-[1px] shrink-0 text-[var(--an-success-color)]" />
            <p className="m-0">
              Changes from <strong className="font-medium text-[var(--an-foreground)]">{worktreeName}</strong> have been merged successfully.
            </p>
          </div>

          <p className="m-0 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
            This worktree is part of the blitz{' '}
            <strong className="font-medium text-[var(--an-foreground)]">{blitzName}</strong>.
            Would you like to archive the entire blitz or just this worktree?
          </p>
        </div>

        <div
          className={footerClass}
          data-agent-elements-shell="archive-blitz-footer"
          data-testid="agent-elements-archive-blitz-footer"
        >
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onKeep}
          >
            Keep All
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onArchiveWorktreeOnly}
          >
            <MaterialSymbol icon="archive" size={16} />
            <span>Archive Worktree Only</span>
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={onArchiveBlitz}
          >
            <MaterialSymbol icon="archive" size={16} />
            <span>Archive Blitz</span>
          </button>
        </div>
      </div>
    </div>
  );
}
