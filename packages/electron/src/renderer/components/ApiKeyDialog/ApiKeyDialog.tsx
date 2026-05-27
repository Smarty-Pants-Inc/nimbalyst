import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface ApiKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPreferences: () => void;
}

export function ApiKeyDialog({ isOpen, onClose, onOpenPreferences }: ApiKeyDialogProps) {
  if (!isOpen) return null;

  const handleOpenPreferences = () => {
    onClose();
    onOpenPreferences();
  };

  const buttonBase =
    'api-key-dialog-button inline-flex items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

  return (
    <div
      className="api-key-dialog-overlay nim-overlay agent-elements-api-key-dialog-backdrop bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)]"
      data-testid="agent-elements-api-key-dialog-backdrop"
      data-agent-elements-shell="api-key-dialog-backdrop"
      onClick={onClose}
    >
      <div
        className="api-key-dialog nim-modal agent-elements-api-key-dialog agent-elements-tool-card w-[90vw] max-w-[520px] !gap-0 !p-0 overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)]"
        data-testid="agent-elements-api-key-dialog"
        data-component="ApiKeyDialog"
        data-agent-elements-shell="api-key-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="api-key-dialog-header nim-modal-header agent-elements-api-key-dialog-header flex items-center justify-between gap-3 border-b border-[var(--an-border-color)] p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-api-key-dialog-header"
          data-agent-elements-shell="api-key-dialog-header"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="api-key-dialog-icon agent-elements-api-key-dialog-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]"
              data-testid="agent-elements-api-key-dialog-icon"
              data-agent-elements-shell="api-key-dialog-icon"
              aria-hidden="true"
            >
              <MaterialSymbol icon="key" size={18} />
            </span>
            <h2 className="m-0 min-w-0 truncate text-sm font-medium text-[var(--an-foreground)]">
              API Key Required
            </h2>
          </div>
          <button
            type="button"
            className="api-key-dialog-close nim-btn-icon agent-elements-api-key-dialog-close inline-flex h-8 w-8 items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            data-testid="agent-elements-api-key-dialog-close"
            data-agent-elements-shell="api-key-dialog-close"
            aria-label="Close API key dialog"
            onClick={onClose}
          >
            <MaterialSymbol icon="close" size={18} />
          </button>
        </div>

        <div
          className="api-key-dialog-content nim-modal-body agent-elements-api-key-dialog-content p-[var(--an-spacing-xl)]"
          data-agent-elements-shell="api-key-dialog-content"
        >
          <p
            className="api-key-dialog-message agent-elements-api-key-dialog-message select-text m-0 text-sm leading-relaxed text-[var(--an-foreground-muted)]"
            data-testid="agent-elements-api-key-dialog-message"
            data-agent-elements-shell="api-key-dialog-message"
          >
            To use the AI chat features, you need to configure your AI provider.
          </p>

          <div
            className="api-key-dialog-steps agent-elements-api-key-dialog-steps mt-[var(--an-spacing-xl)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xl)]"
            data-testid="agent-elements-api-key-dialog-steps"
            data-agent-elements-shell="api-key-dialog-steps"
          >
            <h3 className="m-0 mb-3 text-sm font-medium text-[var(--an-foreground)]">
              How to get started:
            </h3>
            <ol className="m-0 space-y-2 pl-5 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
              <li className="mb-2">
                Choose your AI provider:
                <ul className="mt-2 grid gap-1.5 pl-0">
                  <li>
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="api-key-dialog-provider-link agent-elements-api-key-dialog-provider-link inline-flex items-center gap-1.5 rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2 py-1 text-sm font-medium text-[var(--an-primary-color)] no-underline transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                      data-agent-elements-shell="api-key-dialog-provider-link"
                    >
                      <span aria-hidden="true">
                        <MaterialSymbol icon="open_in_new" size={14} />
                      </span>
                      Anthropic
                    </a>{' '}
                    (Claude)
                  </li>
                  <li>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="api-key-dialog-provider-link agent-elements-api-key-dialog-provider-link inline-flex items-center gap-1.5 rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2 py-1 text-sm font-medium text-[var(--an-primary-color)] no-underline transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                      data-agent-elements-shell="api-key-dialog-provider-link"
                    >
                      <span aria-hidden="true">
                        <MaterialSymbol icon="open_in_new" size={14} />
                      </span>
                      OpenAI
                    </a>{' '}
                    (GPT-4)
                  </li>
                  <li>
                    <a
                      href="https://lmstudio.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="api-key-dialog-provider-link agent-elements-api-key-dialog-provider-link inline-flex items-center gap-1.5 rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2 py-1 text-sm font-medium text-[var(--an-primary-color)] no-underline transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                      data-agent-elements-shell="api-key-dialog-provider-link"
                    >
                      <span aria-hidden="true">
                        <MaterialSymbol icon="open_in_new" size={14} />
                      </span>
                      LM Studio
                    </a>{' '}
                    (Local)
                  </li>
                </ul>
              </li>
              <li className="mb-2">Get your API key (or start LM Studio)</li>
              <li className="mb-2">Click "Open AI Settings" below</li>
              <li className="mb-2">Enter your API key and save</li>
            </ol>
          </div>
        </div>

        <div
          className="api-key-dialog-footer nim-modal-footer agent-elements-api-key-dialog-footer flex justify-end gap-2 border-t border-[var(--an-border-color)] p-[var(--an-spacing-xl)]"
          data-agent-elements-shell="api-key-dialog-footer"
        >
          <button
            type="button"
            className={`${buttonBase} nim-btn-secondary !border-[var(--an-border-color)] !bg-[var(--an-background)] !text-[var(--an-foreground-muted)] hover:!bg-[var(--an-background-tertiary)] hover:!text-[var(--an-foreground)]`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${buttonBase} nim-btn-primary !border-[var(--an-primary-color)] !bg-[var(--an-primary-color)] !text-[var(--an-button-primary-text)] hover:!border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))] hover:!bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]`}
            onClick={handleOpenPreferences}
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="settings" size={16} />
            </span>
            Open AI Settings
          </button>
        </div>
      </div>
    </div>
  );
}
