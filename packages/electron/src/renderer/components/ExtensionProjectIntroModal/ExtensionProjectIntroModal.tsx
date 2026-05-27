import React from 'react';

export interface ExtensionProjectIntroModalProps {
  isOpen: boolean;
  onContinue: () => void;
  onDontShowAgain: () => void;
  onCancel: () => void;
}

const capabilities = [
  { icon: 'edit_note', text: 'Custom editors for any file type, with native look and feel' },
  { icon: 'view_sidebar', text: 'Side panels and workspace views for dashboards and live status' },
  { icon: 'psychology', text: 'AI tools that Claude can use while working in your project' },
  { icon: 'deployed_code', text: 'In-app dev loop: build, install, and reload without leaving Nimbalyst' },
];

export const ExtensionProjectIntroModal: React.FC<ExtensionProjectIntroModalProps> = ({
  isOpen,
  onContinue,
  onDontShowAgain,
  onCancel,
}) => {
  if (!isOpen) return null;

  const secondaryButton =
    'extension-project-intro-secondary-button inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-4 py-2 text-sm font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
  const primaryButton =
    'extension-project-intro-primary-button inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-5 py-2 text-sm font-medium text-[var(--an-background)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--an-primary-color)_86%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_86%,var(--an-foreground))] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

  return (
    <div
      className="extension-project-intro-overlay nim-overlay agent-elements-extension-project-intro-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)] p-4 nim-animate-fade-in"
      onClick={onCancel}
      data-testid="agent-elements-extension-project-intro-backdrop"
      data-agent-elements-shell="extension-project-intro-backdrop"
    >
      <div
        className="extension-project-intro-dialog agent-elements-extension-project-intro agent-elements-tool-card flex w-[min(92vw,480px)] flex-col !gap-0 !p-0 [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)] overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)] nim-animate-slide-up"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="extension-project-intro-title"
        data-testid="agent-elements-extension-project-intro"
        data-component="ExtensionProjectIntroModal"
        data-agent-elements-shell="extension-project-intro"
      >
        <div
          className="extension-project-intro-header agent-elements-extension-project-intro-header flex items-start gap-3 border-b border-[var(--an-border-color)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-testid="agent-elements-extension-project-intro-header"
          data-agent-elements-shell="extension-project-intro-header"
        >
          <span
            className="extension-project-intro-icon agent-elements-extension-project-intro-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]"
            data-agent-elements-shell="extension-project-intro-icon"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-[19px]">extension</span>
          </span>
          <div className="min-w-0">
            <h2
              id="extension-project-intro-title"
              className="m-0 text-sm font-medium leading-snug text-[var(--an-foreground)]"
            >
              Build with Extensions
            </h2>
            <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
              Extensions add custom editors, AI tools, commands, panels, and more.
              Nimbalyst loads your extension live while you develop.
            </p>
          </div>
        </div>

        <div
          className="extension-project-intro-capabilities agent-elements-extension-project-intro-capabilities flex flex-col gap-[var(--an-spacing-md)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-agent-elements-shell="extension-project-intro-capabilities"
        >
          {capabilities.map((cap) => (
            <div
              key={cap.icon}
              className="extension-project-intro-capability agent-elements-extension-project-intro-capability flex items-start gap-3 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]"
              data-testid="agent-elements-extension-project-intro-capability"
              data-agent-elements-shell="extension-project-intro-capability"
            >
              <span className="material-symbols-outlined mt-0.5 text-[18px] text-[var(--an-primary-color)]" aria-hidden="true">
                {cap.icon}
              </span>
              <span className="text-xs leading-relaxed text-[var(--an-foreground-muted)]">{cap.text}</span>
            </div>
          ))}
        </div>

        <div
          className="extension-project-intro-callout agent-elements-extension-project-intro-callout mx-[var(--agent-elements-card-inline-padding)] mb-[var(--agent-elements-card-block-padding)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)]"
          data-testid="agent-elements-extension-project-intro-callout"
          data-agent-elements-shell="extension-project-intro-callout"
        >
          <span className="select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]">
            Describe what you want to the agent, and it will scaffold, build, and install the extension for you.
          </span>
        </div>

        <div
          className="extension-project-intro-actions agent-elements-extension-project-intro-actions flex flex-wrap items-center justify-end gap-2 border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-agent-elements-shell="extension-project-intro-actions"
        >
          <button
            className={secondaryButton}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={secondaryButton}
            onClick={onDontShowAgain}
          >
            Don&apos;t Show Again
          </button>
          <button
            className={primaryButton}
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
