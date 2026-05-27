import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

export interface WindowsClaudeCodeWarningProps {
  isOpen: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onOpenSettings: () => void;
}

export const WindowsClaudeCodeWarning: React.FC<WindowsClaudeCodeWarningProps> = ({
  isOpen,
  onClose,
  onDismiss,
  onOpenSettings
}) => {
  if (!isOpen) return null;

  const handleOpenSettings = () => {
    onOpenSettings();
    onClose();
  };

  const handleRemindLater = () => {
    onClose();
  };

  const handleDontRemind = () => {
    window.electronAPI.send('dismiss-claude-code-windows-warning');
    onDismiss();
  };

  return (
    <div
      className="windows-warning-overlay nim-overlay agent-elements-windows-claude-code-warning-backdrop bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)]"
      data-testid="agent-elements-windows-claude-code-warning-backdrop"
      data-agent-elements-shell="platform-warning-backdrop"
      onClick={handleRemindLater}
    >
      <div
        className="windows-warning agent-elements-windows-claude-code-warning agent-elements-tool-card flex w-[min(92vw,460px)] flex-col overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)]"
        data-testid="agent-elements-windows-claude-code-warning"
        data-component="WindowsClaudeCodeWarning"
        data-agent-elements-shell="platform-warning"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="windows-warning-header agent-elements-windows-claude-code-warning-header flex items-start justify-between gap-3 border-b border-[var(--an-border-color)] p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-windows-claude-code-warning-header"
          data-agent-elements-shell="platform-warning-header"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="windows-warning-icon agent-elements-windows-claude-code-warning-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-warning-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_12%,var(--an-background))] text-[var(--an-warning-color)]"
              data-agent-elements-shell="platform-warning-icon"
              aria-hidden="true"
            >
              <MaterialSymbol icon="warning" size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="windows-warning-title m-0 text-sm font-medium text-[var(--an-foreground)]">
                Claude Code Installation Required
              </h2>
              <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                Windows agent setup
              </p>
            </div>
          </div>
          <button
            type="button"
            className="windows-warning-close agent-elements-windows-claude-code-warning-close flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            data-testid="agent-elements-windows-claude-code-warning-close"
            data-agent-elements-shell="platform-warning-close"
            onClick={handleRemindLater}
            aria-label="Close"
          >
            <MaterialSymbol icon="close" size={18} />
          </button>
        </div>

        <div
          className="windows-warning-content agent-elements-windows-claude-code-warning-body p-[var(--an-spacing-xl)]"
          data-agent-elements-shell="platform-warning-body"
        >
          <p className="windows-warning-message m-0 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
            To use Nimbalyst's AI features on Windows, you need to install Claude Code separately.
            Without it, many agentic editing features will not be available.
          </p>
        </div>

        <div
          className="windows-warning-buttons agent-elements-windows-claude-code-warning-actions flex flex-col gap-2 border-t border-[var(--an-border-color)] p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-windows-claude-code-warning-actions"
          data-agent-elements-shell="platform-warning-actions"
        >
          <button
            type="button"
            className="windows-warning-button windows-warning-button-primary agent-elements-windows-claude-code-warning-primary inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-4 py-2 text-sm font-medium text-[var(--an-button-primary-text)] transition-[background-color,border-color,transform] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] active:translate-y-px"
            onClick={handleOpenSettings}
          >
            <MaterialSymbol icon="settings" size={17} />
            View Installation Instructions
          </button>
          <div
            className="windows-warning-footer flex items-center justify-center gap-2"
            data-agent-elements-shell="platform-warning-footer"
          >
            <button
              type="button"
              className="windows-warning-link agent-elements-windows-claude-code-warning-link cursor-pointer rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent px-2 py-1 text-xs text-[var(--an-foreground-muted)] transition-[background-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
              onClick={handleRemindLater}
            >
              Remind Me Later
            </button>
            <span className="windows-warning-separator text-xs text-[var(--an-foreground-subtle)]" aria-hidden="true">
              /
            </span>
            <button
              type="button"
              className="windows-warning-link agent-elements-windows-claude-code-warning-link cursor-pointer rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent px-2 py-1 text-xs text-[var(--an-foreground-muted)] transition-[background-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
              onClick={handleDontRemind}
            >
              Don't Show Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
