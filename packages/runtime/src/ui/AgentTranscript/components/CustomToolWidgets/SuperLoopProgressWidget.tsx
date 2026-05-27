/**
 * SuperLoopProgressWidget - Custom widget for the super_loop_progress_update MCP tool.
 *
 * Shows compact Agent Elements progress updates and preserves the blocked
 * feedback flow through InteractiveWidgetHost.
 */

import React, { useCallback, useState } from 'react';
import { useAtomValue } from 'jotai';
import { AgentStatusPill, AgentToolCard, type AgentStatusTone, type AgentToolStatus } from '../../../AgentElements/AgentElementsPrimitives';
import { MaterialSymbol } from '../../../icons/MaterialSymbol';
import { interactiveWidgetHostAtom } from '../../../../store/atoms/interactiveWidgetHost';
import type { CustomToolWidgetProps } from './index';

interface ProgressUpdateArgs {
  phase: 'planning' | 'building';
  status: 'running' | 'completed' | 'blocked';
  completionSignal: boolean;
  learnings: Array<{ iteration: number; summary: string; filesChanged: string[] }>;
  blockers: string[];
  currentIteration: number;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function phaseTone(phase: string): AgentStatusTone {
  if (phase === 'building') return 'running';
  if (phase === 'planning') return 'neutral';
  return 'neutral';
}

function statusTone(status: string): AgentStatusTone {
  if (status === 'completed') return 'success';
  if (status === 'blocked') return 'warning';
  if (status === 'running') return 'running';
  return 'neutral';
}

function toolStatus(status: string): AgentToolStatus {
  if (status === 'completed') return 'completed';
  if (status === 'blocked') return 'interrupted';
  if (status === 'running') return 'running';
  return 'idle';
}

const ProgressRow: React.FC<{
  className?: string;
  icon: string;
  label: string;
  testId: string;
  children: React.ReactNode;
}> = ({ className, icon, label, testId, children }) => (
  <div
    className={classNames(
      'agent-elements-super-loop-progress-row grid grid-cols-[1rem_4.5rem_minmax(0,1fr)] items-start gap-[var(--an-spacing-xs)] text-sm text-[var(--an-tool-color)]',
      className
    )}
    data-agent-elements-shell="super-loop-progress-row"
    data-testid={testId}
  >
    <span className="agent-elements-super-loop-progress-row-icon mt-0.5 text-[var(--an-tool-color-muted)]" aria-hidden="true">
      <MaterialSymbol icon={icon} size={14} />
    </span>
    <span className="agent-elements-super-loop-progress-row-label text-xs font-medium text-[var(--an-tool-color-muted)]">
      {label}
    </span>
    <span className="agent-elements-super-loop-progress-row-value min-w-0 break-words select-text">
      {children}
    </span>
  </div>
);

const LatestLearning: React.FC<{ args: ProgressUpdateArgs }> = ({ args }) => {
  const latestLearning = args.learnings[args.learnings.length - 1];

  if (!latestLearning) {
    return (
      <span
        className="agent-elements-super-loop-progress-empty text-sm italic text-[var(--an-tool-color-muted)]"
        data-testid="agent-elements-super-loop-progress-learning"
      >
        No learnings recorded
      </span>
    );
  }

  return (
    <ProgressRow
      icon="psychology"
      label={`#${latestLearning.iteration}`}
      testId="agent-elements-super-loop-progress-learning"
    >
      {latestLearning.summary}
    </ProgressRow>
  );
};

const ReadOnlyProgressContent: React.FC<{ args: ProgressUpdateArgs }> = ({ args }) => (
  <div
    className="agent-elements-super-loop-progress-body flex flex-col gap-[var(--an-spacing-sm)]"
    data-agent-elements-shell="super-loop-progress-body"
    data-testid="agent-elements-super-loop-progress-body"
  >
    <LatestLearning args={args} />
  </div>
);

const BlockedFeedbackContent: React.FC<{ args: ProgressUpdateArgs; sessionId: string }> = ({ args, sessionId }) => {
  const host = useAtomValue(interactiveWidgetHostAtom(sessionId));

  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedFeedback, setSubmittedFeedback] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isSubmitDisabled = !feedback.trim() || isSubmitting || !host;

  const handleSubmit = useCallback(async () => {
    const trimmedFeedback = feedback.trim();
    if (!trimmedFeedback || !host || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await host.superLoopBlockedFeedback(trimmedFeedback);
      if (result.success) {
        setHasSubmitted(true);
        setSubmittedFeedback(trimmedFeedback);
      } else {
        setSubmitError(result.error || 'Failed to send feedback');
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to send feedback');
    } finally {
      setIsSubmitting(false);
    }
  }, [feedback, host, isSubmitting]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div
      className="agent-elements-super-loop-progress-body flex flex-col gap-[var(--an-spacing-sm)]"
      data-agent-elements-shell="super-loop-progress-body"
      data-testid="agent-elements-super-loop-progress-body"
    >
      {args.blockers.length > 0 ? (
        <div className="agent-elements-super-loop-progress-blockers flex flex-col gap-[var(--an-spacing-xs)]">
          {args.blockers.map((blocker, index) => (
            <ProgressRow
              className="text-[var(--an-warning-color,var(--an-tool-color))]"
              icon="report"
              key={`${blocker}-${index}`}
              label="Blocker"
              testId={`agent-elements-super-loop-progress-blocker-${index}`}
            >
              {blocker}
            </ProgressRow>
          ))}
        </div>
      ) : null}

      <LatestLearning args={args} />

      {hasSubmitted ? (
        <div
          className="agent-elements-super-loop-progress-submitted flex flex-col gap-[var(--an-spacing-xs)]"
          data-testid="agent-elements-super-loop-progress-submitted"
        >
          <div className="flex items-center gap-[var(--an-spacing-xs)] text-sm font-medium text-[var(--an-diff-added-text)]">
            <MaterialSymbol icon="check_circle" size={14} />
            <span>Feedback sent</span>
          </div>
          <div className="min-w-0 whitespace-pre-wrap rounded-[var(--an-spacing-xs)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-sm text-[var(--an-tool-color)] select-text">
            {submittedFeedback}
          </div>
        </div>
      ) : (
        <div className="agent-elements-super-loop-progress-feedback-form flex flex-col gap-[var(--an-spacing-xs)]">
          <textarea
            className="agent-elements-super-loop-progress-feedback-input min-h-[5rem] w-full resize-none rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-[var(--an-input-background,var(--an-tool-background))] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-sm leading-[1.45] text-[var(--an-tool-color)] outline-none transition-colors placeholder:text-[var(--an-tool-color-muted)] focus-visible:border-[var(--an-input-focus-border,var(--an-tool-border-color))] focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline,var(--an-tool-border-color))] disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="agent-elements-super-loop-progress-feedback-input"
            disabled={isSubmitting || !host}
            onChange={(event) => setFeedback(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Provide guidance to help overcome the blockers..."
            rows={3}
            value={feedback}
          />

          {submitError ? (
            <div
              className="agent-elements-super-loop-progress-error text-xs text-[var(--an-diff-removed-text)]"
              data-testid="agent-elements-super-loop-progress-error"
            >
              {submitError}
            </div>
          ) : null}

          <div className="agent-elements-super-loop-progress-feedback-actions flex flex-wrap items-center gap-[var(--an-spacing-sm)]">
            <button
              className="agent-elements-super-loop-progress-submit inline-flex min-h-[2rem] items-center gap-[var(--an-spacing-xs)] rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-[var(--an-button-primary-bg,var(--an-foreground))] px-[var(--an-spacing-md)] text-sm font-medium text-[var(--an-button-primary-text,var(--an-background))] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="agent-elements-super-loop-progress-feedback-submit"
              disabled={isSubmitDisabled}
              onClick={handleSubmit}
              type="button"
            >
              <MaterialSymbol icon={isSubmitting ? 'hourglass_empty' : 'send'} size={14} />
              <span>{isSubmitting ? 'Sending...' : 'Send Feedback'}</span>
            </button>
            {!host ? (
              <span
                className="agent-elements-super-loop-progress-waiting text-xs italic text-[var(--an-tool-color-muted)]"
                data-testid="agent-elements-super-loop-progress-waiting"
              >
                Waiting for session...
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export const SuperLoopProgressWidget: React.FC<CustomToolWidgetProps> = ({ message, sessionId }) => {
  const tool = message.toolCall;
  if (!tool?.arguments) return null;

  const args = tool.arguments as unknown as ProgressUpdateArgs;
  if (!args.status) return null;

  const status = toolStatus(args.status);

  return (
    <AgentToolCard
      className="agent-elements-super-loop-progress-card"
      data-agent-elements-shell="super-loop-progress-card"
      data-component="RichTranscriptAgentElementsSuperLoopProgress"
      data-testid="agent-elements-super-loop-progress-card"
      debugPayload={args}
      icon={<MaterialSymbol icon={args.status === 'blocked' ? 'help' : 'cycle'} size={14} />}
      status={status}
      subtitle={`iteration ${args.currentIteration}`}
      title={args.status === 'blocked' ? 'Blocked Progress Update' : 'Progress Update'}
      trailing={(
        <div className="agent-elements-super-loop-progress-badges flex min-w-0 flex-wrap justify-end gap-[var(--an-spacing-xs)]">
          <span
            className="agent-elements-super-loop-progress-phase"
            data-testid="agent-elements-super-loop-progress-phase"
          >
            <AgentStatusPill tone={phaseTone(args.phase)}>
              {args.phase}
            </AgentStatusPill>
          </span>
          <span
            className="agent-elements-super-loop-progress-status"
            data-testid="agent-elements-super-loop-progress-status"
          >
            <AgentStatusPill tone={statusTone(args.status)}>
              {args.status}
            </AgentStatusPill>
          </span>
          {args.completionSignal ? (
            <span
              className="agent-elements-super-loop-progress-completion"
              data-testid="agent-elements-super-loop-progress-completion"
            >
              <AgentStatusPill tone="success">complete</AgentStatusPill>
            </span>
          ) : null}
        </div>
      )}
    >
      {args.status === 'blocked' ? (
        <BlockedFeedbackContent args={args} sessionId={sessionId} />
      ) : (
        <ReadOnlyProgressContent args={args} />
      )}
    </AgentToolCard>
  );
};

SuperLoopProgressWidget.displayName = 'SuperLoopProgressWidget';
