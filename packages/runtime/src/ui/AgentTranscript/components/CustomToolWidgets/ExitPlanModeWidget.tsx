/**
 * ExitPlanModeWidget
 *
 * Custom tool widget that renders when Claude calls ExitPlanMode.
 * Shows the plan file path and allows user to approve/deny the exit from planning mode.
 *
 * Uses InteractiveWidgetHost for operations that require access to atoms, callbacks, and analytics.
 * The host is read from interactiveWidgetHostAtom(sessionId) - no prop drilling needed.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import type { CustomToolWidgetProps } from './index';
import { interactiveWidgetHostAtom } from '../../../../store/atoms/interactiveWidgetHost';
import { AgentStatusPill, type AgentStatusTone } from '../../../AgentElements/AgentElementsPrimitives';
import '../../../AgentElements/AgentElementsFrameworkEvents.css';

// ============================================================
// Types
// ============================================================

interface ExitPlanModeArgs {
  planFilePath?: string;
  allowedPrompts?: Array<{ tool: string; prompt: string }>;
}

type ExitPlanVisualState = 'pending' | 'approved' | 'denied';

function getExitPlanTone(state: ExitPlanVisualState): AgentStatusTone {
  if (state === 'approved') return 'success';
  if (state === 'denied') return 'error';
  return 'running';
}

function getExitPlanLabel(state: ExitPlanVisualState): string {
  if (state === 'approved') return 'approved';
  if (state === 'denied') return 'denied';
  return 'awaiting approval';
}

function ExitPlanStatusIcon({ state }: { state: ExitPlanVisualState }) {
  const iconClassName = `agent-elements-tool-icon ${
    state === 'approved'
      ? 'text-nim-success'
      : state === 'denied'
        ? 'text-nim-muted'
        : 'text-nim-primary'
  }`;

  if (state === 'approved') {
    return (
      <span className={iconClassName}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M13.5 4.5L6 12l-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    );
  }

  if (state === 'denied') {
    return (
      <span className={iconClassName}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    );
  }

  return (
    <span className={iconClassName}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 4.25v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 10.75h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    </span>
  );
}

// ============================================================
// Widget Component
// ============================================================

export const ExitPlanModeWidget: React.FC<CustomToolWidgetProps> = ({
  message,
  workspacePath,
  sessionId,
}) => {
  const toolCall = message.toolCall;
  if (!toolCall) {
    return null;
  }

  // Get host from atom (set by SessionTranscript)
  const host = useAtomValue(interactiveWidgetHostAtom(sessionId));

  // Get data from tool call arguments
  const args = toolCall.arguments as ExitPlanModeArgs | undefined;
  const planFilePath = args?.planFilePath || '';

  // Parse the tool result
  const toolResult = toolCall.result ?? '';
  const isCompleted = toolResult !== '';

  // The requestId is the tool call ID
  const requestId = toolCall.providerToolCallId || `exit-plan-${Date.now()}`;

  // Widget is interactive if the tool hasn't completed yet
  const isPending = !isCompleted;

  // Local state for UI
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [localResult, setLocalResult] = useState<{
    approved: boolean;
    feedback?: string;
    startNewSession?: boolean;
  } | null>(null);
  const feedbackInputRef = useRef<HTMLTextAreaElement>(null);

  // Focus feedback input when shown
  useEffect(() => {
    if (showFeedbackInput && feedbackInputRef.current) {
      feedbackInputRef.current.focus();
    }
  }, [showFeedbackInput]);

  // Parse completed state from result
  const completedState = useMemo(() => {
    if (!isCompleted || !toolResult) return null;

    const resultLower = toolResult.toLowerCase();

    // Check for error patterns first - don't show as completed, return null to keep interactive UI
    if (resultLower.includes('error') || resultLower.includes('missing') || resultLower.includes('invalid')) {
      return null;
    }

    // Check for denial patterns
    if (resultLower.includes('denied') || resultLower.includes('continue planning') || resultLower.includes('cancelled')) {
      return { type: 'denied' as const };
    }

    // Check for approval patterns
    // Note: We can't reliably distinguish user-initiated approval from SDK timeout
    // based solely on the tool result text. Both produce similar messages.
    // TODO: To detect timeouts, we'd need to check if there's an exit_plan_mode_response
    // message in the transcript (which we persist when user responds via IPC).
    // For now, treat all approvals the same - the agent proceeded either way.
    if (resultLower.includes('approved') || resultLower.includes('exited planning')) {
      return { type: 'approved' as const };
    }

    // Unknown result - don't default to approved, return null to keep interactive
    return null;
  }, [isCompleted, toolResult]);

  // Determine display result (local takes precedence while waiting for tool to complete)
  const displayResult = localResult || (completedState ? {
    approved: completedState.type === 'approved',
  } : null);
  const exitPlanState: ExitPlanVisualState = (displayResult || hasResponded)
    ? (displayResult?.approved ? 'approved' : 'denied')
    : 'pending';
  const shellClassName = `exit-plan-mode-widget agent-elements-tool-card agent-elements-question-card agent-elements-exit-plan-mode-card ${
    exitPlanState === 'pending' ? '' : 'opacity-85'
  }`;
  const shellProps = {
    'data-component': 'RichTranscriptAgentElementsExitPlanMode',
    'data-agent-elements-shell': 'plan-approval-card',
    'data-exit-plan-state': exitPlanState,
    'data-testid': 'exit-plan-mode-widget',
  };

  // Handle approve
  const handleApprove = useCallback(async () => {
    if (hasResponded || !isPending || !host) return;

    setIsSubmitting(true);
    setLocalResult({ approved: true });
    setHasResponded(true);

    try {
      await host.exitPlanModeApprove(requestId);
    } catch (error) {
      console.error('[ExitPlanModeWidget] Failed to approve:', error);
      setLocalResult(null);
      setHasResponded(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [host, requestId, hasResponded, isPending]);

  // Handle start new session
  const handleStartNewSession = useCallback(async () => {
    if (hasResponded || !isPending || !host) return;

    setIsSubmitting(true);
    // Match the "Stop for now" end state in the original session while
    // the replacement session opens with the implementation prompt.
    setLocalResult({ approved: false, startNewSession: true });
    setHasResponded(true);

    try {
      await host.exitPlanModeStartNewSession(requestId, planFilePath);
    } catch (error) {
      console.error('[ExitPlanModeWidget] Failed to start new session:', error);
      setLocalResult(null);
      setHasResponded(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [host, requestId, planFilePath, hasResponded, isPending]);

  // Handle deny with feedback
  const handleDeny = useCallback(async (feedbackText?: string) => {
    if (hasResponded || !isPending || !host) return;

    setIsSubmitting(true);
    setLocalResult({ approved: false, feedback: feedbackText });
    setHasResponded(true);

    try {
      await host.exitPlanModeDeny(requestId, feedbackText);
    } catch (error) {
      console.error('[ExitPlanModeWidget] Failed to deny:', error);
      setLocalResult(null);
      setHasResponded(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [host, requestId, hasResponded, isPending]);

  // Handle cancel (stop the session)
  const handleCancel = useCallback(async () => {
    if (hasResponded || !isPending || !host) return;

    setIsSubmitting(true);
    setLocalResult({ approved: false });
    setHasResponded(true);

    try {
      await host.exitPlanModeCancel(requestId);
    } catch (error) {
      console.error('[ExitPlanModeWidget] Failed to cancel:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [host, requestId, hasResponded, isPending]);

  const handleShowFeedbackInput = useCallback(() => {
    setShowFeedbackInput(true);
  }, []);

  const handleSubmitFeedback = useCallback(() => {
    if (feedback.trim()) {
      handleDeny(feedback.trim());
    }
  }, [feedback, handleDeny]);

  const handleFeedbackKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitFeedback();
    } else if (e.key === 'Escape') {
      setShowFeedbackInput(false);
      setFeedback('');
    }
  }, [handleSubmitFeedback]);

  const handleOpenPlanFile = useCallback(() => {
    if (!planFilePath || !workspacePath) return;

    // Check if path is already absolute (works for both Unix and Windows)
    const isAbsolute = planFilePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(planFilePath);

    // If path is relative but we don't have a workspacePath, we can't resolve it
    if (!isAbsolute && !workspacePath) {
      console.warn('[ExitPlanModeWidget] Cannot resolve relative path without workspacePath:', planFilePath);
      return;
    }

    // Detect path separator from workspacePath (works cross-platform)
    const separator = workspacePath?.includes('\\') ? '\\' : '/';

    const absolutePath = isAbsolute
      ? planFilePath
      : `${workspacePath}${separator}${planFilePath}`;

    if (host) {
      host.openFile(absolutePath);
    }
  }, [planFilePath, workspacePath, host]);

  // Show completed state
  if (displayResult || hasResponded) {
    const approved = displayResult?.approved ?? false;

    return (
      <div
        {...shellProps}
        data-state={approved ? 'approved' : 'denied'}
        className={shellClassName}
      >
        <div className="agent-elements-tool-header">
          <ExitPlanStatusIcon state={exitPlanState} />
          <div className="agent-elements-tool-title-group">
            <span className="agent-elements-tool-title">
              {approved ? 'Exited Planning Mode' : 'Continued Planning'}
            </span>
            <span className="agent-elements-tool-subtitle">Plan mode decision</span>
          </div>
          <span className="agent-elements-tool-trailing">
            <AgentStatusPill tone={getExitPlanTone(exitPlanState)}>
              <span data-testid="exit-plan-mode-status">{getExitPlanLabel(exitPlanState)}</span>
            </AgentStatusPill>
          </span>
        </div>
        <div className="agent-elements-tool-footer">
          <span
            data-testid={approved ? 'exit-plan-mode-approved' : 'exit-plan-mode-denied'}
            className={`agent-elements-status-pill ${approved ? 'text-nim-success' : 'text-nim-muted'}`}
          >
            {approved ? 'Approved' : 'Denied'}
          </span>
        </div>
        {planFilePath && (
          <div className="agent-elements-tool-primary">
            <span className="text-nim-muted">Plan: </span>
            <button
              onClick={handleOpenPlanFile}
              className="agent-elements-exit-plan-file-link text-nim-link hover:text-nim-link-hover hover:underline cursor-pointer bg-transparent border-none p-0 font-mono text-[13px] select-text"
            >
              {planFilePath}
            </button>
          </div>
        )}
      </div>
    );
  }

  // If tool is not pending (has a result) but we didn't handle it above, show nothing
  if (!isPending) {
    return null;
  }

  // If no host available, show non-interactive pending state
  if (!host) {
    return (
      <div
        {...shellProps}
        data-state="pending"
        className={shellClassName}
      >
        <div className="agent-elements-tool-header">
          <ExitPlanStatusIcon state={exitPlanState} />
          <div className="agent-elements-tool-title-group">
            <span className="agent-elements-tool-title">
              Ready to exit planning mode?
            </span>
            <span className="agent-elements-tool-subtitle">Plan approval required</span>
          </div>
          <span className="agent-elements-tool-trailing">
            <AgentStatusPill tone={getExitPlanTone(exitPlanState)}>
              <span data-testid="exit-plan-mode-status">{getExitPlanLabel(exitPlanState)}</span>
            </AgentStatusPill>
          </span>
        </div>
        <div className="agent-elements-tool-footer">
          <span data-testid="exit-plan-mode-pending" className="agent-elements-status-pill text-nim-muted">Waiting...</span>
        </div>
      </div>
    );
  }

  // Show interactive UI for pending request
  return (
    <div
      {...shellProps}
      data-state="pending"
      className={shellClassName}
    >
      <div className="agent-elements-tool-header">
        <ExitPlanStatusIcon state={exitPlanState} />
        <div className="agent-elements-tool-title-group">
          <span className="agent-elements-tool-title">
            Ready to exit planning mode?
          </span>
          <span className="agent-elements-tool-subtitle">Plan approval required</span>
        </div>
        <span className="agent-elements-tool-trailing">
          <AgentStatusPill tone={getExitPlanTone(exitPlanState)}>
            <span data-testid="exit-plan-mode-status">{getExitPlanLabel(exitPlanState)}</span>
          </AgentStatusPill>
        </span>
      </div>

      <div className="agent-elements-tool-primary flex flex-col gap-3">
        {planFilePath && (
          <div className="p-2 bg-nim-tertiary rounded-md text-[13px]">
            <span className="text-nim-muted">Plan file: </span>
            <button
              onClick={handleOpenPlanFile}
              className="agent-elements-exit-plan-file-link text-nim-link hover:text-nim-link-hover hover:underline cursor-pointer bg-transparent border-none p-0 font-mono text-[13px] select-text"
            >
              {planFilePath}
            </button>
          </div>
        )}

        <div className="text-[13px] text-nim">
          Would you like to proceed?
        </div>

        <div className="agent-elements-exit-plan-actions flex flex-col gap-2">
          <button
            data-testid="exit-plan-mode-new-session"
            className="w-full px-4 py-2 rounded-md text-[13px] font-medium cursor-pointer border border-nim transition-colors duration-150 hover:bg-nim-hover active:opacity-80 bg-nim-tertiary text-nim text-left disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleStartNewSession}
            disabled={isSubmitting}
          >
            <span className="text-nim-muted mr-2">1.</span>
            Yes, start new session and implement (clean context window)
          </button>
          <button
            data-testid="exit-plan-mode-approve"
            className="w-full px-4 py-2 rounded-md text-[13px] font-medium cursor-pointer border border-nim transition-colors duration-150 hover:bg-nim-hover active:opacity-80 bg-nim-tertiary text-nim text-left disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleApprove}
            disabled={isSubmitting}
          >
            <span className="text-nim-muted mr-2">2.</span>
            Yes, proceed in this same session
          </button>
          {!showFeedbackInput ? (
            <button
              data-testid="exit-plan-mode-deny"
              className="w-full px-4 py-2 rounded-md text-[13px] font-medium cursor-pointer border border-nim transition-colors duration-150 hover:bg-nim-hover active:opacity-80 bg-nim-tertiary text-nim text-left disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleShowFeedbackInput}
              disabled={isSubmitting}
            >
              <span className="text-nim-muted mr-2">3.</span>
              Type here to tell Claude what to change
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                ref={feedbackInputRef}
                data-testid="exit-plan-mode-feedback-input"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={handleFeedbackKeyDown}
                placeholder="Tell Claude what to change in the plan..."
                className="agent-elements-question-textarea w-full disabled:opacity-50"
                rows={3}
                disabled={isSubmitting}
              />
              <div className="flex gap-2 justify-end">
                <button
                  className="px-3 py-1 rounded-md text-[12px] cursor-pointer border border-nim transition-colors duration-150 hover:bg-nim-hover bg-nim-tertiary text-nim-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    setShowFeedbackInput(false);
                    setFeedback('');
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  data-testid="exit-plan-mode-send-feedback"
                  className="px-3 py-1 rounded-md text-[12px] cursor-pointer border-none transition-colors duration-150 hover:opacity-90 bg-nim-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSubmitFeedback}
                  disabled={!feedback.trim() || isSubmitting}
                >
                  Send Feedback
                </button>
              </div>
            </div>
          )}
          <button
            data-testid="exit-plan-mode-cancel"
            className="w-full px-4 py-2 rounded-md text-[13px] font-medium cursor-pointer border border-nim transition-colors duration-150 hover:bg-nim-hover active:opacity-80 bg-nim-tertiary text-nim text-left disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            <span className="text-nim-muted mr-2">4.</span>
            Stop for now
          </button>
        </div>
      </div>
    </div>
  );
};
