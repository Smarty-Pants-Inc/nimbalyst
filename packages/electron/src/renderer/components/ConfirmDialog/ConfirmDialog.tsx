import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const confirmDialogButtonBase =
  'confirm-dialog-button inline-flex items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="confirm-dialog-overlay nim-overlay agent-elements-confirm-dialog-backdrop bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)]"
      data-testid="agent-elements-confirm-dialog-backdrop"
      data-agent-elements-shell="confirm-dialog-backdrop"
      onClick={onCancel}
    >
      <div
        className="confirm-dialog agent-elements-confirm-dialog agent-elements-tool-card w-[420px] max-w-[90vw] !gap-0 !p-0 [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)] overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)]"
        data-testid="agent-elements-confirm-dialog"
        data-component="ConfirmDialog"
        data-agent-elements-shell="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="confirm-dialog-header agent-elements-confirm-dialog-header flex items-center gap-3 border-b border-[var(--an-border-color)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-testid="agent-elements-confirm-dialog-header"
          data-agent-elements-shell="confirm-dialog-header"
        >
          <span
            className={`confirm-dialog-icon agent-elements-confirm-dialog-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border ${
              destructive
                ? 'border-[color-mix(in_srgb,var(--an-error-color)_30%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-error-color)_10%,var(--an-background))] text-[var(--an-error-color)]'
                : 'border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground-muted)]'
            }`}
            data-agent-elements-shell="confirm-dialog-icon"
            aria-hidden="true"
          >
            <MaterialSymbol icon={destructive ? 'warning' : 'help'} size={18} />
          </span>
          <h2 className="confirm-dialog-title m-0 text-sm font-medium text-[var(--an-foreground)]">
            {title}
          </h2>
        </div>

        <div
          className="confirm-dialog-body agent-elements-confirm-dialog-body px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-agent-elements-shell="confirm-dialog-body"
        >
          <p
            className="confirm-dialog-message agent-elements-confirm-dialog-message m-0 text-sm leading-relaxed text-[var(--an-foreground-muted)]"
            data-testid="agent-elements-confirm-dialog-message"
            data-agent-elements-shell="confirm-dialog-message"
          >
            {message}
          </p>
        </div>

        <div
          className="confirm-dialog-buttons agent-elements-confirm-dialog-footer flex justify-end gap-2 border-t border-[var(--an-border-color)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-agent-elements-shell="confirm-dialog-footer"
        >
          <button
            className={`${confirmDialogButtonBase} confirm-dialog-button-cancel nim-btn-secondary !border-[var(--an-border-color)] !bg-[var(--an-background)] !text-[var(--an-foreground-muted)] hover:!bg-[var(--an-background-tertiary)] hover:!text-[var(--an-foreground)]`}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`${confirmDialogButtonBase} confirm-dialog-button-confirm ${
              destructive
                ? 'nim-btn-danger !border-[var(--an-error-color)] !bg-[var(--an-error-color)] !text-[var(--an-button-primary-text)] hover:!bg-[color-mix(in_srgb,var(--an-error-color)_88%,var(--an-foreground))]'
                : 'nim-btn-primary !border-[var(--an-primary-color)] !bg-[var(--an-primary-color)] !text-[var(--an-send-button-color)] hover:!bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))] hover:!border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))]'
            }`}
            onClick={onConfirm}
          >
            <span aria-hidden="true">
              <MaterialSymbol icon={destructive ? 'delete' : 'check'} size={16} />
            </span>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
