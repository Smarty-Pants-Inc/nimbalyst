import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { HelpTooltip } from '../../help';

export type AIMode = 'planning' | 'agent';

interface ModeTagProps {
  mode: AIMode;
  onModeChange: (mode: AIMode) => void;
}

/**
 * ModeTag - Compact toggle between Plan and Agent modes
 *
 * Plan mode: Creates plan documents, restricted to markdown files
 * Agent mode: Full tool access, write operations enabled
 */
export function ModeTag({ mode, onModeChange }: ModeTagProps) {
  const handleToggle = () => {
    onModeChange(mode === 'planning' ? 'agent' : 'planning');
  };

  const label = mode === 'planning' ? 'Plan' : 'Agent';
  const tone = mode === 'planning' ? 'warning' : 'success';

  return (
    <HelpTooltip testId="plan-mode-toggle">
      <button
        data-testid="plan-mode-toggle"
        className={`mode-tag agent-elements-mode-tag agent-elements-status-pill inline-flex cursor-pointer items-center gap-[var(--an-spacing-xxs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)] text-[11px] font-medium text-[var(--an-foreground-muted)] outline-none transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] ${mode === 'planning' ? 'mode-tag-plan' : 'mode-tag-agent'}`}
        data-agent-elements-shell="mode-tag"
        data-component="UnifiedAIModeTag"
        data-mode={mode}
        data-tone={tone}
        onClick={handleToggle}
        aria-label={mode === 'planning'
          ? 'Plan mode: Creates plan documents (click to enable full agent mode)'
          : 'Agent mode: Full tool access (click to switch to plan mode)'}
        type="button"
      >
        <MaterialSymbol icon={mode === 'planning' ? 'edit_note' : 'bolt'} size={13} />
        <span>{label}</span>
      </button>
    </HelpTooltip>
  );
}
