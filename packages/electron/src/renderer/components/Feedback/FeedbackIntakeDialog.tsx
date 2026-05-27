import React, { useCallback, useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { MaterialSymbol } from '@nimbalyst/runtime';

export type FeedbackKind = 'bug' | 'feature';

export interface FeedbackDraftOptions {
  mayGatherLogs?: boolean;
  shouldCreateMockup?: boolean;
}

export interface FeedbackIntakeLaunchOptions {
  kind: FeedbackKind;
  mayGatherLogs?: boolean;
  shouldCreateMockup?: boolean;
}

export interface FeedbackIntakeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: (options: FeedbackIntakeLaunchOptions) => void;
}

const ISSUES_URL = 'https://github.com/nimbalyst/nimbalyst/issues';
const DISCUSSIONS_URL = 'https://github.com/nimbalyst/nimbalyst/discussions';
const SUPPORT_EMAIL_URL = 'mailto:support@nimbalyst.com';

const feedbackButtonBase =
  'inline-flex items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color,opacity] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-50';

const feedbackPrimaryButton =
  `${feedbackButtonBase} border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-button-primary-text)] hover:border-[color-mix(in_srgb,var(--an-primary-color)_86%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_86%,var(--an-foreground))]`;

const feedbackDisabledButton =
  `${feedbackButtonBase} border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-subtle)]`;

const feedbackExternalLinkButton =
  'inline-flex cursor-pointer items-center gap-2 rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent px-2 py-1.5 text-left text-sm text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

function feedbackKindCardClass(isSelected: boolean): string {
  const base =
    'feedback-intake-kind-card agent-elements-feedback-intake-kind-card flex cursor-pointer flex-col gap-2 rounded-[var(--an-tool-border-radius)] border p-[var(--an-spacing-md)] text-left transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

  if (isSelected) {
    return `${base} border-[var(--an-primary-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground)]`;
  }

  return `${base} border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]`;
}

export const FeedbackIntakeDialog: React.FC<FeedbackIntakeDialogProps> = ({
  isOpen,
  onClose,
  onLaunch,
}) => {
  const posthog = usePostHog();
  const [selectedKind, setSelectedKind] = useState<FeedbackKind | null>(null);
  const [mayGatherLogs, setMayGatherLogs] = useState(true);
  const [shouldCreateMockup, setShouldCreateMockup] = useState(false);

  const handleLaunch = useCallback(() => {
    if (!selectedKind) return;

    const launchOptions =
      selectedKind === 'bug'
        ? { kind: selectedKind, mayGatherLogs }
        : { kind: selectedKind, shouldCreateMockup };

    posthog?.capture('feedback_intake_launched', launchOptions);
    onLaunch(launchOptions);
    onClose();
  }, [mayGatherLogs, onClose, onLaunch, posthog, selectedKind, shouldCreateMockup]);

  const handleSelectKind = useCallback(
    (kind: FeedbackKind) => {
      setSelectedKind(kind);
      const launchOptions =
        kind === 'bug'
          ? { kind, mayGatherLogs }
          : { kind, shouldCreateMockup };

      posthog?.capture('feedback_intake_type_selected', launchOptions);
    },
    [mayGatherLogs, posthog, shouldCreateMockup],
  );

  const handleOpenExternal = useCallback(
    (url: string, target: 'issues' | 'discussions' | 'email') => {
      posthog?.capture('feedback_external_link_clicked', { target });
      window.electronAPI?.invoke('open-external', url);
      onClose();
    },
    [posthog, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="feedback-intake-overlay nim-overlay agent-elements-feedback-intake-backdrop nim-animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)] p-4"
      onClick={onClose}
      data-testid="agent-elements-feedback-intake-backdrop"
      data-agent-elements-shell="feedback-intake-backdrop"
    >
      <div
        className="feedback-intake-dialog agent-elements-feedback-intake-dialog agent-elements-tool-card nim-animate-slide-up flex max-h-[86vh] w-[560px] max-w-[92vw] flex-col !gap-0 !p-0 [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)] overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-intake-title"
        data-testid="agent-elements-feedback-intake-dialog"
        data-component="FeedbackIntakeDialog"
        data-agent-elements-shell="feedback-intake-dialog"
      >
        <header
          className="feedback-intake-header agent-elements-feedback-intake-header flex items-start justify-between gap-3 border-b border-[var(--an-border-color)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-testid="agent-elements-feedback-intake-header"
          data-agent-elements-shell="feedback-intake-header"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="agent-elements-feedback-intake-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground-muted)]"
              data-agent-elements-shell="feedback-intake-icon"
            >
              <MaterialSymbol icon="feedback" size={18} />
            </span>
            <div className="min-w-0">
              <h2
                id="feedback-intake-title"
                className="m-0 text-sm font-medium leading-snug text-[var(--an-foreground)]"
              >
                Send better feedback with your Agent
              </h2>
              <p className="mt-1 max-w-[56ch] text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                Use your Agent to improve your bug reports and feature requests. You approve everything
                before GitHub opens.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="feedback-intake-close agent-elements-feedback-intake-close flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            onClick={onClose}
            aria-label="Close"
            data-testid="agent-elements-feedback-intake-close"
            data-agent-elements-shell="feedback-intake-close"
          >
            <MaterialSymbol icon="close" size={18} />
          </button>
        </header>

        <div
          className="feedback-intake-body agent-elements-feedback-intake-body flex flex-col gap-[var(--an-spacing-xl)] overflow-y-auto px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-agent-elements-shell="feedback-intake-body"
        >
          <section
            className="feedback-intake-options agent-elements-feedback-intake-options flex flex-col gap-[var(--an-spacing-md)]"
            data-testid="agent-elements-feedback-intake-options"
            data-agent-elements-shell="feedback-intake-options"
          >
            <h2
              className="m-0 text-xs font-medium text-[var(--an-foreground-muted)]"
              data-agent-elements-shell="feedback-intake-options-title"
            >
              Choose a feedback type
            </h2>
            <div className="feedback-intake-kind-grid agent-elements-feedback-intake-kind-grid grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
              <button
                type="button"
                className={feedbackKindCardClass(selectedKind === 'bug')}
                onClick={() => handleSelectKind('bug')}
                data-testid="feedback-intake-select-bug"
                data-agent-elements-shell="feedback-intake-kind-card"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-error-color)]">
                    <MaterialSymbol icon="bug_report" size={18} />
                  </span>
                  <span className="text-sm font-medium leading-snug text-[var(--an-foreground)]">Bug report</span>
                </div>
                <p className="m-0 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                  Broken behavior, crashes, sync issues, or regressions.
                </p>
              </button>

              <button
                type="button"
                className={feedbackKindCardClass(selectedKind === 'feature')}
                onClick={() => handleSelectKind('feature')}
                data-testid="feedback-intake-select-feature"
                data-agent-elements-shell="feedback-intake-kind-card"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-warning-color)]">
                    <MaterialSymbol icon="lightbulb" size={18} />
                  </span>
                  <span className="text-sm font-medium leading-snug text-[var(--an-foreground)]">Feature request</span>
                </div>
                <p className="m-0 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                  Missing capabilities, workflow improvements, or UX changes.
                </p>
              </button>
            </div>
          </section>

          {selectedKind ? (
            <section
              className="feedback-intake-detail agent-elements-feedback-intake-detail nim-animate-slide-up rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-md)]"
              data-testid="agent-elements-feedback-intake-detail"
              data-agent-elements-shell="feedback-intake-detail"
            >
              {selectedKind === 'bug' ? (
                <label
                  htmlFor="feedback-may-gather-logs"
                  className="feedback-intake-detail-option agent-elements-feedback-intake-detail-option flex cursor-pointer items-start gap-3 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-md)] transition-[background-color,border-color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)]"
                  data-agent-elements-shell="feedback-intake-detail-option"
                >
                  <input
                    id="feedback-may-gather-logs"
                    type="checkbox"
                    checked={mayGatherLogs}
                    onChange={(e) => setMayGatherLogs(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--an-primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                    data-testid="feedback-intake-consent"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug text-[var(--an-foreground)]">
                      Include logs and environment details
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                      Logs may include file paths, workspace names, and error details. The assistant
                      anonymizes them first, and you review the final report before it is posted.
                    </span>
                  </span>
                </label>
              ) : null}

              {selectedKind === 'feature' ? (
                <label
                  htmlFor="feedback-should-create-mockup"
                  className="feedback-intake-detail-option agent-elements-feedback-intake-detail-option flex cursor-pointer items-start gap-3 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-md)] transition-[background-color,border-color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)]"
                  data-agent-elements-shell="feedback-intake-detail-option"
                >
                  <input
                    id="feedback-should-create-mockup"
                    type="checkbox"
                    checked={shouldCreateMockup}
                    onChange={(e) => setShouldCreateMockup(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--an-primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                    data-testid="feedback-intake-mockup"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug text-[var(--an-foreground)]">
                      Explore the idea with a UX mockup first
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                      Best for interface or workflow changes. The assistant can sketch a mockup,
                      refine it with you, and include that visual direction in the request.
                    </span>
                  </span>
                </label>
              ) : null}
            </section>
          ) : null}

          <div
            className="feedback-intake-actions agent-elements-feedback-intake-actions flex justify-end"
            data-testid="agent-elements-feedback-intake-actions"
            data-agent-elements-shell="feedback-intake-actions"
          >
            <button
              type="button"
              className={`feedback-intake-start-button agent-elements-feedback-intake-start w-full justify-between ${
                selectedKind ? feedbackPrimaryButton : feedbackDisabledButton
              }`}
              onClick={handleLaunch}
              disabled={!selectedKind}
              data-testid="feedback-intake-start"
              data-agent-elements-shell="feedback-intake-start"
            >
              <span>
                {selectedKind === 'bug'
                  ? 'Start bug report'
                  : selectedKind === 'feature'
                    ? 'Start feature request'
                    : 'Choose a type to continue'}
              </span>
              <MaterialSymbol
                icon="arrow_forward"
                size={18}
                className={selectedKind ? 'text-[var(--an-button-primary-text)]' : 'text-[var(--an-foreground-subtle)]'}
              />
            </button>
          </div>
        </div>

        <footer
          className="feedback-intake-footer agent-elements-feedback-intake-footer border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--agent-elements-card-inline-padding)] py-[var(--an-spacing-md)]"
          data-testid="agent-elements-feedback-intake-footer"
          data-agent-elements-shell="feedback-intake-footer"
        >
          <p className="m-0 mb-1 text-xs font-medium text-[var(--an-foreground-muted)]">
            Other ways to reach us
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            <li>
              <button
                type="button"
                className={feedbackExternalLinkButton}
                onClick={() => handleOpenExternal(ISSUES_URL, 'issues')}
                data-testid="feedback-intake-issues-link"
                data-agent-elements-shell="feedback-intake-link"
              >
                <MaterialSymbol
                  icon="search"
                  size={16}
                  className="text-[var(--an-foreground-subtle)]"
                />
                Browse existing issues on GitHub
              </button>
            </li>
            <li>
              <button
                type="button"
                className={feedbackExternalLinkButton}
                onClick={() => handleOpenExternal(DISCUSSIONS_URL, 'discussions')}
                data-testid="feedback-intake-discussions-link"
                data-agent-elements-shell="feedback-intake-link"
              >
                <MaterialSymbol
                  icon="forum"
                  size={16}
                  className="text-[var(--an-foreground-subtle)]"
                />
                Discuss an idea on GitHub Discussions
              </button>
            </li>
            <li>
              <button
                type="button"
                className={feedbackExternalLinkButton}
                onClick={() => handleOpenExternal(SUPPORT_EMAIL_URL, 'email')}
                data-testid="feedback-intake-email-link"
                data-agent-elements-shell="feedback-intake-link"
              >
                <MaterialSymbol
                  icon="mail"
                  size={16}
                  className="text-[var(--an-foreground-subtle)]"
                />
                Email private feedback to support@nimbalyst.com
              </button>
            </li>
          </ul>
        </footer>
      </div>
    </div>
  );
};

export function buildFeedbackInitialDraft(
  kind: FeedbackKind,
  options: FeedbackDraftOptions = {},
): string {
  const command =
    kind === 'bug'
      ? '/feedback:bug-report'
      : '/feedback:feature-request';

  if (kind === 'bug') {
    const consent = options.mayGatherLogs ? 'allowed' : 'not allowed';
    return `${command}\n\nLog gathering: ${consent}`;
  }

  const mockup = options.shouldCreateMockup ? 'requested' : 'not requested';
  return `${command}\n\nUX mockup: ${mockup}`;
}
