/**
 * MemoryPrompt - Interactive prompt mode for adding to Claude Code memory
 *
 * When user types '#' as the first character in AIInput (for Claude Code provider),
 * this component takes over to handle saving the text to CLAUDE.md files.
 *
 * Supports:
 * - User Memory: ~/.claude/CLAUDE.md
 * - Project Memory: <workspace>/.claude/CLAUDE.md or CLAUDE.md
 */

import React, { useState, useCallback } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { errorNotificationService } from '../../../services/ErrorNotificationService';

export type MemoryTarget = 'user' | 'project';

interface MemoryPromptProps {
  /** The text content to save (without the # prefix) */
  content: string;
  /** Current memory target */
  target: MemoryTarget;
  /** Callback when target changes */
  onTargetChange: (target: MemoryTarget) => void;
  /** Callback when user confirms save */
  onSave: (content: string, target: MemoryTarget) => void;
  /** Callback when user cancels memory mode */
  onCancel: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Workspace path for project memory */
  workspacePath?: string;
}

/**
 * Memory mode indicator and controls
 * Displays current target and provides keyboard navigation hints
 */
export function MemoryPromptIndicator({
  target,
  onTargetChange,
  isSaving,
  workspacePath,
}: Pick<MemoryPromptProps, 'target' | 'onTargetChange' | 'isSaving' | 'workspacePath'>) {
  const toggleTarget = useCallback(() => {
    onTargetChange(target === 'user' ? 'project' : 'user');
  }, [target, onTargetChange]);

  const openMemoryFile = useCallback(async () => {
    if (!workspacePath && target === 'project') return;
    try {
      const { filePath } = await window.electronAPI.invoke('memory:get-path', { target, workspacePath });
      if (filePath) {
        await window.electronAPI.invoke('workspace:open-file', { workspacePath, filePath });
      }
    } catch {
      // File may not exist yet
    }
  }, [target, workspacePath]);

  return (
    <div
      className="memory-prompt-indicator agent-elements-memory-prompt mb-[var(--an-spacing-sm)] flex items-center justify-between gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-[var(--an-foreground)] [container-type:inline-size]"
      data-agent-elements-shell="memory-prompt"
      data-component="UnifiedAIMemoryPromptIndicator"
      data-memory-target={target}
      data-testid="agent-elements-memory-prompt"
    >
      <div className="memory-prompt-left agent-elements-memory-prompt-left flex min-w-0 items-center gap-[var(--an-spacing-sm)]">
        <div className="memory-prompt-icon agent-elements-status-pill flex shrink-0 items-center justify-center" data-tone={isSaving ? 'running' : 'info'}>
          <MaterialSymbol icon="psychology" size={14} />
        </div>
        <span
          className="memory-prompt-label agent-elements-memory-prompt-status truncate text-xs font-medium text-[var(--an-foreground-muted)]"
          data-testid="agent-elements-memory-prompt-status"
        >
          {isSaving ? 'Saving...' : 'Adding to memory'}
        </span>
        <button
          className="memory-prompt-target-button agent-elements-memory-prompt-target agent-elements-status-pill flex cursor-pointer items-center gap-[var(--an-spacing-xxs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)] text-xs font-medium text-[var(--an-foreground)] outline-none transition-[background-color,border-color,color] duration-150 hover:enabled:border-[var(--an-primary-color)] hover:enabled:bg-[var(--an-background-tertiary)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={toggleTarget}
          disabled={isSaving}
          title="Use arrow keys to switch"
          aria-label="Switch memory target"
          data-testid="agent-elements-memory-prompt-target"
          data-memory-target={target}
          type="button"
        >
          <span className="memory-target-name">
            {target === 'user' ? 'User Memory' : 'Project Memory'}
          </span>
          <span className="memory-target-hint flex items-center text-[var(--an-foreground-subtle)]" aria-hidden="true">
            <MaterialSymbol icon="swap_vert" size={14} />
          </span>
        </button>
        <button
          className="memory-prompt-open-button agent-elements-memory-prompt-open flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border-none bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,color] duration-150 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
          onClick={openMemoryFile}
          title="Open memory file in editor"
          aria-label="Open memory file"
          type="button"
        >
          <MaterialSymbol icon="open_in_new" size={15} />
        </button>
      </div>
      <div
        className="memory-prompt-shortcuts agent-elements-memory-prompt-shortcuts flex shrink-0 items-center gap-[var(--an-spacing-xxs)] text-[11px] text-[var(--an-foreground-subtle)]"
        data-testid="agent-elements-memory-prompt-shortcuts"
      >
        <kbd className="inline-block rounded-[calc(var(--an-tool-border-radius)-6px)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xs)] py-[var(--an-spacing-xxs)] font-inherit text-[10px] text-[var(--an-foreground-muted)]">Enter</kbd> to save
        <span className="memory-shortcut-separator mx-[var(--an-spacing-xxs)] text-[var(--an-foreground-subtle)]" aria-hidden="true">/</span>
        <kbd className="inline-block rounded-[calc(var(--an-tool-border-radius)-6px)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xs)] py-[var(--an-spacing-xxs)] font-inherit text-[10px] text-[var(--an-foreground-muted)]">Up</kbd>
        <kbd className="inline-block rounded-[calc(var(--an-tool-border-radius)-6px)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xs)] py-[var(--an-spacing-xxs)] font-inherit text-[10px] text-[var(--an-foreground-muted)]">Down</kbd> to switch
        <span className="memory-shortcut-separator mx-[var(--an-spacing-xxs)] text-[var(--an-foreground-subtle)]" aria-hidden="true">/</span>
        <kbd className="inline-block rounded-[calc(var(--an-tool-border-radius)-6px)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xs)] py-[var(--an-spacing-xxs)] font-inherit text-[10px] text-[var(--an-foreground-muted)]">Esc</kbd> to cancel
      </div>
    </div>
  );
}

/**
 * Memory save button - replaces the normal send button when in memory mode
 */
export function MemorySaveButton({
  onSave,
  disabled,
  isSaving,
}: {
  onSave: () => void;
  disabled: boolean;
  isSaving?: boolean;
}) {
  return (
    <button
      className="memory-save-button agent-elements-memory-save-button flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-send-button-bg)] p-0 text-[var(--an-send-button-color)] transition-[background-color,border-color,color,opacity] duration-150 hover:enabled:bg-[var(--an-primary-color)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onSave}
      disabled={disabled || isSaving}
      title="Save to memory (Enter)"
      aria-label={isSaving ? 'Saving memory' : 'Save to memory'}
      data-agent-elements-shell="memory-save-button"
      data-component="UnifiedAIMemorySaveButton"
      type="button"
    >
      {isSaving ? (
        <span
          className="agent-elements-memory-save-spinner animate-spin"
          data-testid="agent-elements-memory-save-spinner"
        >
          <MaterialSymbol icon="progress_activity" size={16} />
        </span>
      ) : (
        <MaterialSymbol icon="save" size={16} />
      )}
    </button>
  );
}

/**
 * Hook to manage memory mode state
 */
export function useMemoryMode(workspacePath?: string) {
  const [isMemoryMode, setIsMemoryMode] = useState(false);
  const [memoryTarget, setMemoryTarget] = useState<MemoryTarget>('user');
  const [isSaving, setIsSaving] = useState(false);

  const enterMemoryMode = useCallback(() => {
    setIsMemoryMode(true);
  }, []);

  const exitMemoryMode = useCallback(() => {
    setIsMemoryMode(false);
    setMemoryTarget('user');
  }, []);

  const toggleMemoryTarget = useCallback(() => {
    setMemoryTarget(prev => prev === 'user' ? 'project' : 'user');
  }, []);

  const saveToMemory = useCallback(async (content: string): Promise<boolean> => {
    if (!content.trim()) {
      return false;
    }

    setIsSaving(true);
    try {
      const result = await window.electronAPI.invoke('memory:append', {
        content: content.trim(),
        target: memoryTarget,
        workspacePath,
      });

      if (result.success) {
        const targetLabel = memoryTarget === 'user' ? 'User Memory' : 'Project Memory';
        errorNotificationService.showInfo(
          'Memory Updated',
          `Added to ${targetLabel}`,
          { duration: 2000 }
        );
        exitMemoryMode();
        return true;
      } else {
        errorNotificationService.showError(
          'Failed to Save Memory',
          result.error || 'Unknown error'
        );
        return false;
      }
    } catch (error) {
      errorNotificationService.showError(
        'Failed to Save Memory',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [memoryTarget, workspacePath, exitMemoryMode]);

  return {
    isMemoryMode,
    memoryTarget,
    isSaving,
    enterMemoryMode,
    exitMemoryMode,
    toggleMemoryTarget,
    setMemoryTarget,
    saveToMemory,
  };
}

/**
 * Check if input should activate memory mode
 * Memory mode activates when the first character is '#' (for Claude Code provider only)
 */
export function shouldActivateMemoryMode(value: string, provider?: string): boolean {
  return provider === 'claude-code' && value.trimStart().startsWith('#');
}

/**
 * Get the content without the '#' prefix
 */
export function getMemoryContent(value: string): string {
  const trimmed = value.trimStart();
  if (trimmed.startsWith('#')) {
    // Remove the '#' and any following space
    return trimmed.slice(1).trimStart();
  }
  return value;
}
