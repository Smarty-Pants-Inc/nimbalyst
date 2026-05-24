/**
 * Pending Voice Command Component
 *
 * Displays a pending voice command with countdown timer before auto-submission.
 * User can cancel, edit, or send immediately.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { pendingVoiceCommandAtom } from '../../store/atoms/voiceModeState';

// Global set of submitted command IDs to prevent duplicate submissions across component instances
const globalSubmittedCommands = new Set<string>();

interface PendingVoiceCommandProps {
  sessionId: string;
  onSubmit: (prompt: string, sessionId: string, workspacePath: string, codingAgentPrompt?: { prepend?: string; append?: string }) => void;
}

const iconButtonClass = 'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]';
const secondaryButtonClass = 'inline-flex cursor-pointer items-center gap-[var(--an-spacing-xxs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-transparent px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)] text-[12px] font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]';
const primaryButtonClass = 'inline-flex cursor-pointer items-center gap-[var(--an-spacing-xxs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-send-button-bg)] bg-[var(--an-send-button-bg)] px-[var(--an-spacing-md)] py-[var(--an-spacing-xxs)] text-[12px] font-medium text-[var(--an-send-button-color)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-primary-color)] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_90%,var(--an-background))] focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]';

export function PendingVoiceCommand({ sessionId, onSubmit }: PendingVoiceCommandProps) {
  const [pendingCommand, setPendingCommand] = useAtom(pendingVoiceCommandAtom);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [editedPrompt, setEditedPrompt] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize edited prompt when pending command changes
  useEffect(() => {
    if (pendingCommand) {
      setEditedPrompt(pendingCommand.prompt);
      setRemainingMs(pendingCommand.delayMs);
      setIsEditing(false);
    }
  }, [pendingCommand?.id]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!pendingCommand) return;

    // Use GLOBAL deduplication to prevent multiple component instances from submitting
    if (globalSubmittedCommands.has(pendingCommand.id)) {
      console.log('[PendingVoiceCommand] Command already submitted globally, skipping:', pendingCommand.id);
      setPendingCommand(null);
      return;
    }

    // Mark as submitted globally BEFORE the async operation
    globalSubmittedCommands.add(pendingCommand.id);
    // Clean up old entries after 10 seconds to prevent memory leak
    setTimeout(() => globalSubmittedCommands.delete(pendingCommand.id), 10000);

    console.log('[PendingVoiceCommand] Submitting command:', pendingCommand.id, pendingCommand.prompt.substring(0, 50));
    const promptToSubmit = editedPrompt || pendingCommand.prompt;
    onSubmit(
      promptToSubmit,
      pendingCommand.sessionId,
      pendingCommand.workspacePath,
      pendingCommand.codingAgentPrompt
    );
    setPendingCommand(null);
  }, [pendingCommand, editedPrompt, onSubmit, setPendingCommand]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setPendingCommand(null);
  }, [setPendingCommand]);

  // Countdown timer - only runs when pendingCommand is for this session
  useEffect(() => {
    if (!pendingCommand || pendingCommand.sessionId !== sessionId || isEditing) return;

    const submitAt = pendingCommand.createdAt + pendingCommand.delayMs;

    const interval = setInterval(() => {
      const remaining = submitAt - Date.now();
      if (remaining <= 0) {
        clearInterval(interval);
        // handleSubmit checks global deduplication, so just call it
        handleSubmit();
      } else {
        setRemainingMs(remaining);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [pendingCommand?.id, pendingCommand?.sessionId, pendingCommand?.createdAt, pendingCommand?.delayMs, sessionId, isEditing, handleSubmit]);

  // Handle edit mode
  const handleEditClick = useCallback(() => {
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 0);
  }, []);

  // Handle blur from textarea - resume countdown
  const handleTextareaBlur = useCallback(() => {
    if (pendingCommand && editedPrompt.trim()) {
      // Update the pending command with new timestamp to restart countdown
      setPendingCommand({
        ...pendingCommand,
        prompt: editedPrompt,
        createdAt: Date.now(),
      });
    }
    setIsEditing(false);
  }, [pendingCommand, editedPrompt, setPendingCommand]);

  // Handle keyboard shortcuts in textarea
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSubmit, handleCancel]);

  // Only render if the pending command is for this session
  if (!pendingCommand || pendingCommand.sessionId !== sessionId) {
    return null;
  }

  // Calculate progress for circular indicator (0-1)
  const progress = Math.max(0, Math.min(1, remainingMs / pendingCommand.delayMs));
  const circumference = 2 * Math.PI * 12; // radius = 12
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className="pending-voice-command agent-elements-pending-voice-command mb-[var(--an-spacing-sm)] overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground)] [container-type:inline-size]"
      data-agent-elements-shell="pending-voice-command"
      data-component="UnifiedAIPendingVoiceCommand"
      data-session-id={pendingCommand.sessionId}
      data-testid="agent-elements-pending-voice-command"
    >
      <div
        className="pending-voice-command-header agent-elements-pending-voice-command-header flex items-center justify-between border-b border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)]"
        data-agent-elements-shell="pending-voice-command-header"
        data-testid="agent-elements-pending-voice-command-header"
      >
        <div
          className="flex min-w-0 items-center gap-[var(--an-spacing-xs)] text-[13px] font-medium text-[var(--an-foreground)]"
        >
          <span className="agent-elements-status-pill shrink-0" data-tone={isEditing ? 'warning' : 'running'}>
            <MaterialSymbol icon="mic" size={14} />
          </span>
          <span className="truncate">Voice Command</span>
        </div>
        <button
          onClick={handleCancel}
          className={iconButtonClass}
          aria-label="Cancel voice command"
          title="Cancel (Esc)"
          type="button"
        >
          <MaterialSymbol icon="close" size={18} />
        </button>
      </div>

      <div
        className="pending-voice-command-body agent-elements-pending-voice-command-body p-[var(--an-spacing-md)]"
        data-agent-elements-shell="pending-voice-command-body"
        data-testid="agent-elements-pending-voice-command-body"
      >
        <textarea
          ref={textareaRef}
          value={editedPrompt}
          onChange={(e) => setEditedPrompt(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={handleTextareaBlur}
          onKeyDown={handleKeyDown}
          className="pending-voice-command-input min-h-[64px] w-full resize-none rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-[13px] leading-relaxed text-[var(--an-foreground)] outline-none transition-[background-color,border-color] duration-150 placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-primary-color)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
          placeholder="Voice command..."
        />
      </div>

      <div
        className="pending-voice-command-footer agent-elements-pending-voice-command-footer flex flex-wrap items-center justify-between gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)]"
        data-agent-elements-shell="pending-voice-command-footer"
        data-testid="agent-elements-pending-voice-command-footer"
      >
        <div
          className="pending-voice-command-countdown agent-elements-pending-voice-command-countdown flex min-w-0 items-center gap-[var(--an-spacing-sm)]"
          data-agent-elements-shell="pending-voice-command-countdown"
          data-testid="agent-elements-pending-voice-command-countdown"
        >
          <div
            className="pending-voice-command-countdown-ring relative h-8 w-8 shrink-0"
            data-testid="agent-elements-pending-voice-command-countdown-ring"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="var(--an-border-color)"
                strokeWidth="3"
              />
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke={isEditing ? 'var(--an-foreground-muted)' : 'var(--an-primary-color)'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-[stroke-dashoffset] duration-100"
              />
            </svg>
          </div>
          <span className="agent-elements-status-pill min-w-0 font-mono" data-tone={isEditing ? 'warning' : 'running'}>
            {isEditing ? (
              'Paused - editing'
            ) : (
              <>Sending in <span className="tabular-nums text-[var(--an-foreground)]">{(remainingMs / 1000).toFixed(1)}s</span></>
            )}
          </span>
        </div>

        <div
          className="pending-voice-command-actions agent-elements-pending-voice-command-actions flex items-center gap-[var(--an-spacing-xs)]"
          data-agent-elements-shell="pending-voice-command-actions"
          data-testid="agent-elements-pending-voice-command-actions"
        >
          <button
            onClick={handleEditClick}
            className={secondaryButtonClass}
            aria-label="Edit"
            type="button"
          >
            <MaterialSymbol icon="edit" size={16} />
            Edit
          </button>
          <button
            onClick={handleSubmit}
            className={primaryButtonClass}
            aria-label="Send Now"
            type="button"
          >
            Send Now
            <MaterialSymbol icon="arrow_forward" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
