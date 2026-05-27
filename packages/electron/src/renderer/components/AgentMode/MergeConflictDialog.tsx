import React, { useEffect, useRef } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { AgentModelPicker, type AgentModelOption } from './AgentModelPicker';

const overlayClass = [
  'merge-conflict-dialog-overlay',
  'agent-elements-agent-mode-dialog-overlay',
  'fixed inset-0 z-50 flex items-center justify-center',
  'bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] p-[var(--an-spacing-xxl)]',
].join(' ');

const dialogClass = [
  'merge-conflict-dialog',
  'agent-elements-merge-conflict-dialog',
  'mx-[var(--an-spacing-md)] flex max-h-[calc(100vh-2rem)] w-full max-w-[760px] flex-col overflow-hidden',
  'rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background)] text-[var(--an-foreground)] outline-none',
  'shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]',
].join(' ');

const headerClass = [
  'merge-conflict-dialog-header',
  'agent-elements-merge-conflict-header',
  'flex shrink-0 items-center gap-[var(--an-spacing-md)]',
  'border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]',
].join(' ');

const bodyClass = [
  'merge-conflict-dialog-body',
  'agent-elements-merge-conflict-body',
  'flex min-h-0 flex-1 flex-col overflow-y-auto px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]',
].join(' ');

const introClass = [
  'm-0 mb-[var(--an-spacing-lg)] text-sm leading-relaxed text-[var(--an-foreground-muted)]',
].join(' ');

const filesClass = [
  'merge-conflict-dialog-files',
  'agent-elements-merge-conflict-files',
  'mb-[var(--an-spacing-lg)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]',
].join(' ');

const filesHeaderClass = [
  'merge-conflict-dialog-files-header',
  'agent-elements-merge-conflict-files-header',
  'mb-[var(--an-spacing-md)] flex items-center gap-[var(--an-spacing-sm)]',
  'text-[13px] font-medium text-[var(--an-foreground)]',
].join(' ');

const filesListClass = [
  'merge-conflict-dialog-files-list',
  'm-0 flex list-none flex-col gap-[var(--an-spacing-xs)] p-0',
].join(' ');

const fileItemClass = [
  'merge-conflict-dialog-file',
  'agent-elements-merge-conflict-file',
  'flex items-center gap-[var(--an-spacing-sm)] text-[13px] text-[var(--an-foreground-muted)]',
].join(' ');

const noticeBaseClass = [
  'flex items-start gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border',
  'p-[var(--an-spacing-lg)] text-[13px] leading-snug',
].join(' ');

const infoClass = [
  'merge-conflict-dialog-info',
  'agent-elements-merge-conflict-info',
  noticeBaseClass,
  'mb-[var(--an-spacing-md)] border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-primary-color)_8%,var(--an-background))] text-[var(--an-primary-color)]',
].join(' ');

const suggestionClass = [
  'merge-conflict-dialog-suggestion',
  'agent-elements-merge-conflict-suggestion',
  noticeBaseClass,
  'mb-[var(--an-spacing-lg)] border-[color-mix(in_srgb,var(--an-success-color)_24%,var(--an-border-color))]',
  'bg-[color-mix(in_srgb,var(--an-success-color)_8%,var(--an-background))] text-[var(--an-success-color)]',
].join(' ');

const manualClass = [
  'merge-conflict-dialog-manual',
  'agent-elements-merge-conflict-manual',
  'flex flex-col gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)]',
  'border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)] text-[13px]',
].join(' ');

const pathClass = [
  'merge-conflict-dialog-path',
  'block break-all rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]',
  'font-mono text-xs text-[var(--an-foreground)]',
].join(' ');

const footerClass = [
  'merge-conflict-dialog-footer',
  'agent-elements-merge-conflict-footer',
  'flex shrink-0 justify-end gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]',
].join(' ');

const buttonBaseClass = [
  'merge-conflict-dialog-button',
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)]',
  'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border px-[var(--an-spacing-lg)] py-[var(--an-spacing-xs)]',
  'text-sm font-medium outline-none transition-[background-color,border-color,color,opacity] duration-150 ease-out',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const secondaryButtonClass = [
  buttonBaseClass,
  'merge-conflict-dialog-button--secondary agent-elements-merge-conflict-close',
  'border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)]',
  'hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
].join(' ');

const primaryButtonClass = [
  buttonBaseClass,
  'merge-conflict-dialog-button--primary agent-elements-merge-conflict-resolve',
  'border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)]',
  'hover:border-[color-mix(in_srgb,var(--an-primary-color)_80%,var(--an-foreground))]',
  'hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]',
].join(' ');

interface MergeConflictDialogProps {
  workspacePath: string;
  conflictedFiles: string[];
  agentModels: AgentModelOption[];
  selectedModel: string;
  isLoadingModels: boolean;
  onModelChange: (modelId: string) => void;
  onResolveWithAgent: (modelId: string) => void;
  resolveDisabled?: boolean;
  onCancel: () => void;
}

export function MergeConflictDialog({
  workspacePath,
  conflictedFiles,
  agentModels,
  selectedModel,
  isLoadingModels,
  onModelChange,
  onResolveWithAgent,
  resolveDisabled = false,
  onCancel,
}: MergeConflictDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Focus trap
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const projectName = workspacePath.split('/').pop() || 'project';

  return (
    <div
      className={overlayClass}
      data-agent-elements-shell="agent-mode-dialog-overlay"
      data-component="MergeConflictDialog"
      data-testid="agent-elements-merge-conflict-overlay"
      onClick={onCancel}
    >
      <div
        aria-labelledby="merge-conflict-dialog-title"
        aria-modal="true"
        className={dialogClass}
        data-agent-elements-shell="merge-conflict-dialog"
        data-testid="agent-elements-merge-conflict-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={headerClass}
          data-agent-elements-shell="merge-conflict-header"
          data-testid="agent-elements-merge-conflict-header"
        >
          <span className="merge-conflict-dialog-icon-warning text-[var(--an-warning-color)]" aria-hidden="true">
            <MaterialSymbol icon="warning" size={22} />
          </span>
          <h2 id="merge-conflict-dialog-title" className="m-0 text-lg font-semibold leading-tight">
            Merge Conflict Detected
          </h2>
        </div>

        <div
          className={bodyClass}
          data-agent-elements-shell="merge-conflict-body"
          data-testid="agent-elements-merge-conflict-body"
        >
          <p className={introClass}>
            Cannot merge worktree to <strong className="font-medium text-[var(--an-foreground)]">{projectName}</strong> because there are unresolved merge conflicts in the main repository.
          </p>

          <div
            className={filesClass}
            data-agent-elements-shell="merge-conflict-files"
            data-testid="agent-elements-merge-conflict-files"
          >
            <div className={filesHeaderClass}>
              <span aria-hidden="true">
                <MaterialSymbol icon="description" size={16} />
              </span>
              <span>Conflicted Files:</span>
            </div>
            <ul className={filesListClass}>
              {conflictedFiles.map((file) => (
                <li key={file} className={fileItemClass}>
                  <span className="merge-conflict-dialog-file-icon shrink-0 text-[var(--an-warning-color)]" aria-hidden="true">
                    <MaterialSymbol icon="error" size={14} />
                  </span>
                  <code className="bg-transparent p-0 font-mono text-[var(--an-foreground)]">{file}</code>
                </li>
              ))}
            </ul>
          </div>

          <div
            className={infoClass}
            data-agent-elements-shell="merge-conflict-info"
            data-testid="agent-elements-merge-conflict-info"
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="info" size={16} />
            </span>
            <p className="m-0">
              You must resolve these conflicts in the main repository before the worktree can be merged.
            </p>
          </div>

          <div
            className={suggestionClass}
            data-agent-elements-shell="merge-conflict-suggestion"
            data-testid="agent-elements-merge-conflict-suggestion"
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="smart_toy" size={16} />
            </span>
            <p className="m-0">
              An AI agent can help you resolve these conflicts automatically, or you can resolve them manually.
            </p>
          </div>

          <AgentModelPicker
            models={agentModels}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            isLoading={isLoadingModels}
          />

          <div
            className={manualClass}
            data-agent-elements-shell="merge-conflict-manual"
            data-testid="agent-elements-merge-conflict-manual"
          >
            <p className="m-0 flex items-center gap-[var(--an-spacing-sm)] text-[var(--an-foreground-muted)]">
              <span aria-hidden="true">
                <MaterialSymbol icon="terminal" size={16} />
              </span>
              Main repository location:
            </p>
            <code className={pathClass}>{workspacePath}</code>
          </div>
        </div>

        <div
          className={footerClass}
          data-agent-elements-shell="merge-conflict-footer"
          data-testid="agent-elements-merge-conflict-footer"
        >
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onCancel}
          >
            Close
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => onResolveWithAgent(selectedModel)}
            disabled={resolveDisabled}
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="smart_toy" size={16} />
            </span>
            <span>Resolve with Agent</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MergeConflictDialog;
