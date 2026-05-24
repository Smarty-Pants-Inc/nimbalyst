/**
 * LayoutControls - Toggle buttons for session editor layout modes
 *
 * Provides three buttons to control the split view:
 * - Maximize editor (hide transcript)
 * - Split view (both visible)
 * - Maximize transcript (hide editor)
 */

import React from 'react';
import type { SessionLayoutMode } from '../../store';
import { HelpTooltip } from '../../help';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface LayoutControlsProps {
  mode: SessionLayoutMode;
  hasTabs: boolean;
  onModeChange: (mode: SessionLayoutMode) => void;
}

export function LayoutControls({ mode, hasTabs, onModeChange }: LayoutControlsProps) {
  const getControlClass = (targetMode: SessionLayoutMode, withLabel = false) => {
    const isActive = mode === targetMode;
    return [
      'layout-control-btn',
      'agent-elements-layout-control',
      withLabel ? 'with-label w-auto gap-[var(--an-spacing-xs)] px-[var(--an-spacing-sm)]' : 'w-7 px-0',
      'flex h-6 items-center justify-center rounded-[calc(var(--an-tool-border-radius)_-_4px)] border-none py-0 text-[11px] font-medium outline-none transition-[background-color,border-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-40',
      isActive
        ? 'active agent-elements-layout-control-active bg-[var(--an-primary-color)] text-[var(--an-send-button-color)]'
        : 'bg-transparent text-[var(--an-foreground-muted)] hover:enabled:bg-[var(--an-background-tertiary)] hover:enabled:text-[var(--an-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
    ].join(' ');
  };

  return (
    <HelpTooltip testId="layout-controls">
      <div
        className="layout-controls agent-elements-layout-controls flex items-center gap-[var(--an-spacing-xxs)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xxs)]"
        data-agent-elements-shell="layout-controls"
        data-component="UnifiedAILayoutControls"
        data-has-tabs={hasTabs}
        data-layout-mode={mode}
        data-testid="layout-controls"
      >
        <button
          className={getControlClass('editor', true)}
          onClick={() => onModeChange('editor')}
          aria-label="Maximize editor"
          aria-pressed={mode === 'editor'}
          data-layout-mode="editor"
          disabled={!hasTabs}
          data-testid="layout-maximize-editor"
          type="button"
        >
          <span className="layout-label">Files</span>
          <MaterialSymbol icon="article" size={14} />
        </button>
        <button
          className={getControlClass('split')}
          onClick={() => onModeChange('split')}
          aria-label="Split view"
          aria-pressed={mode === 'split'}
          data-layout-mode="split"
          disabled={!hasTabs}
          data-testid="layout-split-view"
          type="button"
        >
          <MaterialSymbol icon="vertical_split" size={14} />
        </button>
        <button
          className={getControlClass('transcript', true)}
          onClick={() => onModeChange('transcript')}
          aria-label="Maximize transcript"
          aria-pressed={mode === 'transcript'}
          data-layout-mode="transcript"
          data-testid="layout-maximize-transcript"
          type="button"
        >
          <MaterialSymbol icon="chat" size={14} />
          <span className="layout-label">Agent</span>
        </button>
      </div>
    </HelpTooltip>
  );
}

export default LayoutControls;
