import React, { useState, useRef, useEffect } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

const overlayClass = [
  'squash-commit-modal-overlay',
  'agent-elements-agent-mode-dialog-overlay',
  'fixed inset-0 z-50 flex items-center justify-center',
  'bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] p-[var(--an-spacing-xxl)]',
].join(' ');

const dialogClass = [
  'squash-commit-modal',
  'agent-elements-squash-commit-dialog',
  'w-full max-w-[500px] overflow-hidden rounded-[var(--an-tool-border-radius)]',
  'border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)]',
  'outline-none shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]',
].join(' ');

const formClass = [
  'squash-commit-modal-form',
  'agent-elements-squash-commit-form',
  'flex max-h-[90vh] flex-col',
].join(' ');

const headerClass = [
  'squash-commit-modal-header',
  'agent-elements-squash-commit-header',
  'flex items-center justify-between gap-[var(--an-spacing-md)]',
  'border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]',
].join(' ');

const closeButtonClass = [
  'squash-commit-modal-close',
  'agent-elements-squash-commit-close',
  'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[calc(var(--an-tool-border-radius)_-_4px)]',
  'border border-transparent bg-transparent text-[var(--an-foreground-muted)] outline-none',
  'transition-[background-color,border-color,color,opacity] duration-150 ease-out',
  'hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-secondary)] hover:text-[var(--an-foreground)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const warningClass = [
  'squash-commit-modal-warning',
  'agent-elements-squash-commit-warning',
  'flex items-start gap-[var(--an-spacing-sm)] border-b border-[color-mix(in_srgb,var(--an-warning-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-warning-color)_9%,var(--an-background))]',
  'px-[var(--an-spacing-xxl)] py-[var(--an-spacing-md)] text-sm leading-relaxed text-[var(--an-warning-color)]',
].join(' ');

const bodyClass = [
  'squash-commit-modal-body',
  'agent-elements-squash-commit-body',
  'flex flex-1 flex-col gap-[var(--an-spacing-sm)] overflow-y-auto px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]',
].join(' ');

const labelClass = [
  'squash-commit-modal-label',
  'agent-elements-squash-commit-label',
  'block text-sm font-medium text-[var(--an-foreground-muted)]',
].join(' ');

const textareaClass = [
  'squash-commit-modal-textarea',
  'agent-elements-squash-commit-textarea',
  'min-h-[120px] resize-y rounded-[calc(var(--an-tool-border-radius)_-_4px)]',
  'border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-md)]',
  'font-mono text-sm leading-relaxed text-[var(--an-foreground)] outline-none',
  'placeholder:text-[var(--an-foreground-subtle)] focus:border-[var(--an-primary-color)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const hintClass = [
  'squash-commit-modal-hint',
  'agent-elements-squash-commit-hint',
  'text-xs leading-snug text-[var(--an-foreground-subtle)]',
].join(' ');

const footerClass = [
  'squash-commit-modal-buttons',
  'agent-elements-squash-commit-footer',
  'flex justify-end gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]',
].join(' ');

const buttonBaseClass = [
  'squash-commit-modal-button',
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)]',
  'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border px-[var(--an-spacing-lg)] py-[var(--an-spacing-xs)]',
  'text-sm font-medium outline-none transition-[background-color,border-color,color,opacity] duration-150 ease-out',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const secondaryButtonClass = [
  buttonBaseClass,
  'squash-commit-modal-cancel agent-elements-squash-commit-cancel',
  'border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)]',
  'hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
].join(' ');

const primaryButtonClass = [
  buttonBaseClass,
  'squash-commit-modal-confirm agent-elements-squash-commit-confirm',
  'border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)]',
  'hover:border-[color-mix(in_srgb,var(--an-primary-color)_80%,var(--an-foreground))]',
  'hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]',
].join(' ');

interface SquashCommitModalProps {
  isOpen: boolean;
  commitCount: number;
  warningMessage?: string;
  isChecking?: boolean;
  onConfirm: (message: string) => void;
  onCancel: () => void;
}

export function SquashCommitModal({
  isOpen,
  commitCount,
  warningMessage,
  isChecking = false,
  onConfirm,
  onCancel
}: SquashCommitModalProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect platform for keyboard shortcut hint
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const submitShortcut = isMac ? 'Cmd+Enter' : 'Ctrl+Enter';

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onConfirm(message.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
    // Allow Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (message.trim()) {
        onConfirm(message.trim());
      }
    }
  };

  return (
    <div
      className={overlayClass}
      data-agent-elements-shell="agent-mode-dialog-overlay"
      data-component="SquashCommitModal"
      data-testid="agent-elements-squash-commit-overlay"
      onClick={onCancel}
    >
      <div
        aria-labelledby="squash-commit-modal-title"
        aria-modal="true"
        className={dialogClass}
        data-agent-elements-shell="squash-commit-dialog"
        data-testid="agent-elements-squash-commit-dialog"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          className={formClass}
          data-agent-elements-shell="squash-commit-form"
          onSubmit={handleSubmit}
        >
          <div
            className={headerClass}
            data-agent-elements-shell="squash-commit-header"
            data-testid="agent-elements-squash-commit-header"
          >
            <h3
              id="squash-commit-modal-title"
              className="squash-commit-modal-title m-0 text-base font-semibold leading-tight text-[var(--an-foreground)]"
            >
              Squash {commitCount} Commits
            </h3>
            <button
              type="button"
              aria-label="Close"
              className={closeButtonClass}
              onClick={onCancel}
              title="Close"
            >
              <span aria-hidden="true">
                <MaterialSymbol icon="close" size={20} />
              </span>
            </button>
          </div>

          {warningMessage && (
            <div
              className={warningClass}
              data-agent-elements-shell="squash-commit-warning"
              data-testid="agent-elements-squash-commit-warning"
            >
              <span className="mt-[1px] shrink-0" aria-hidden="true">
                <MaterialSymbol icon="warning" size={18} />
              </span>
              <span className="select-text">{warningMessage}</span>
            </div>
          )}

          <div
            className={bodyClass}
            data-agent-elements-shell="squash-commit-body"
            data-testid="agent-elements-squash-commit-body"
          >
            <label
              htmlFor="commit-message"
              className={labelClass}
            >
              Commit Message
            </label>
            <textarea
              ref={textareaRef}
              id="commit-message"
              className={textareaClass}
              placeholder="Enter commit message for squashed commit..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
            />
            <div
              className={hintClass}
              data-testid="agent-elements-squash-commit-hint"
            >
              Press {submitShortcut} to submit
            </div>
          </div>

          <div
            className={footerClass}
            data-agent-elements-shell="squash-commit-footer"
            data-testid="agent-elements-squash-commit-footer"
          >
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={!message.trim() || isChecking}
            >
              {isChecking ? 'Checking...' : 'Squash Commits'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SquashCommitModal;
