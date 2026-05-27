import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

export interface WorktreeOnboardingModalProps {
  isOpen: boolean;
  onContinue: () => void;
  onCancel: () => void;
}

export const WorktreeOnboardingModal: React.FC<WorktreeOnboardingModalProps> = ({
  isOpen,
  onContinue,
  onCancel,
}) => {
  if (!isOpen) return null;

  const benefits = [
    {
      icon: 'shield',
      title: 'Safe experimentation',
      description: 'AI changes stay in a separate branch',
    },
    {
      icon: 'rate_review',
      title: 'Easy review',
      description: 'Review and merge changes when ready',
    },
    {
      icon: 'stacks',
      title: 'Parallel work',
      description: 'Run multiple experiments simultaneously',
    },
  ];

  const secondaryButton =
    'worktree-onboarding-secondary-button inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-4 py-2 text-sm font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
  const primaryButton =
    'worktree-onboarding-primary-button inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-4 py-2 text-sm font-medium text-[var(--an-background)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--an-primary-color)_86%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_86%,var(--an-foreground))] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

  return (
    <div
      className="worktree-onboarding-overlay nim-overlay agent-elements-worktree-onboarding-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)] p-4 nim-animate-fade-in"
      onClick={onCancel}
      data-testid="agent-elements-worktree-onboarding-backdrop"
      data-agent-elements-shell="worktree-onboarding-backdrop"
    >
      <div
        className="worktree-onboarding-dialog agent-elements-worktree-onboarding agent-elements-tool-card flex w-[min(92vw,480px)] flex-col !gap-0 !p-0 [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)] overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)] nim-animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="worktree-onboarding-title"
        data-testid="agent-elements-worktree-onboarding"
        data-component="WorktreeOnboardingModal"
        data-agent-elements-shell="worktree-onboarding"
      >
        <div
          className="worktree-onboarding-header agent-elements-worktree-onboarding-header flex items-start gap-3 border-b border-[var(--an-border-color)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-testid="agent-elements-worktree-onboarding-header"
          data-agent-elements-shell="worktree-onboarding-header"
        >
          <span
            className="worktree-onboarding-icon agent-elements-worktree-onboarding-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]"
            data-testid="agent-elements-worktree-onboarding-icon"
            data-agent-elements-shell="worktree-onboarding-icon"
            aria-hidden="true"
          >
            <MaterialSymbol icon="account_tree" size={19} />
          </span>
          <div className="min-w-0">
            <h2
              id="worktree-onboarding-title"
              className="m-0 text-sm font-medium leading-snug text-[var(--an-foreground)]"
            >
              What is a Worktree?
            </h2>
            <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
              Isolated branches for agent work that should not disturb your main checkout.
            </p>
          </div>
        </div>

        <div className="worktree-onboarding-content px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]">
          <p className="worktree-onboarding-description m-0 mb-[var(--an-spacing-xl)] select-text text-sm leading-relaxed text-[var(--an-foreground-muted)] [&_strong]:font-medium [&_strong]:text-[var(--an-foreground)]">
            Worktrees create a git branch in an <strong>isolated directory</strong>, separate from your main repository.
            This gives you a safe place to make changes without affecting the rest of your code.
          </p>

          <div
            className="worktree-onboarding-benefits agent-elements-worktree-onboarding-benefits flex flex-col gap-[var(--an-spacing-md)]"
            data-testid="agent-elements-worktree-onboarding-benefits"
            data-agent-elements-shell="worktree-onboarding-benefits"
          >
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="worktree-benefit agent-elements-worktree-onboarding-benefit flex items-start gap-3 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]"
                data-testid="agent-elements-worktree-onboarding-benefit"
                data-agent-elements-shell="worktree-onboarding-benefit"
              >
                <span
                  className="benefit-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-primary-color)]"
                  aria-hidden="true"
                >
                  <MaterialSymbol icon={benefit.icon} size={18} />
                </span>
                <div className="benefit-text flex min-w-0 flex-col gap-1">
                  <strong className="text-sm font-medium leading-snug text-[var(--an-foreground)]">
                    {benefit.title}
                  </strong>
                  <span className="text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                    {benefit.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="worktree-onboarding-footer agent-elements-worktree-onboarding-actions flex justify-end gap-2 border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-testid="agent-elements-worktree-onboarding-actions"
          data-agent-elements-shell="worktree-onboarding-actions"
        >
          <button
            className={secondaryButton}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={primaryButton}
            onClick={onContinue}
          >
            <MaterialSymbol icon="add" size={16} />
            Create Worktree
          </button>
        </div>
      </div>
    </div>
  );
};
