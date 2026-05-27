/**
 * NewSuperLoopDialog - Dialog for creating a new Super Loop
 *
 * Allows users to specify a task description and configuration for a new Super Loop.
 * A dedicated worktree is automatically created for each Super Loop.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import {
  newSuperLoopDialogOpenAtom,
  upsertSuperLoopAtom,
} from '../../store/atoms/superLoop';
import { SUPER_LOOP_DEFAULTS } from '../../../shared/types/superLoop';
import { DEFAULT_MODELS } from '@nimbalyst/runtime/ai/modelConstants';

interface AgentModel {
  id: string;
  name: string;
  provider: string;
}

interface NewSuperLoopDialogProps {
  workspacePath: string;
  onSuperLoopCreated?: (superLoopId: string, worktreeId: string) => void;
}

export const SUPER_LOOP_DEFAULT_MODEL = DEFAULT_MODELS['smarty-server'];

export function getSuperLoopAgentModels(grouped: Record<string, unknown>): AgentModel[] {
  const smartyModels = grouped['smarty-server'];
  if (!Array.isArray(smartyModels)) return [];
  return smartyModels.filter((model): model is AgentModel => (
    model !== null &&
    typeof model === 'object' &&
    typeof (model as AgentModel).id === 'string' &&
    typeof (model as AgentModel).name === 'string' &&
    (model as AgentModel).provider === 'smarty-server'
  ));
}

const overlayClass =
  'new-super-loop-dialog-overlay agent-elements-new-super-loop-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] p-[var(--an-spacing-xxl)]';
const dialogClass =
  'new-super-loop-dialog agent-elements-new-super-loop-dialog agent-elements-tool-card flex max-h-[80vh] w-[min(92vw,600px)] flex-col overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]';
const headerClass =
  'agent-elements-new-super-loop-header flex items-start justify-between gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]';
const iconShellClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]';
const closeButtonClass =
  'agent-elements-new-super-loop-close inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-50';
const bodyClass =
  'agent-elements-new-super-loop-body nim-scrollbar flex-1 space-y-[var(--an-spacing-xl)] overflow-y-auto px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]';
const descriptionClass =
  'agent-elements-new-super-loop-description select-text rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)] text-sm leading-relaxed text-[var(--an-foreground-muted)]';
const fieldClass = 'space-y-[var(--an-spacing-sm)]';
const fieldLabelClass = 'block text-sm font-medium text-[var(--an-foreground)]';
const fieldHintClass = 'm-0 text-xs leading-relaxed text-[var(--an-foreground-subtle)]';
const textareaClass =
  'agent-elements-new-super-loop-task-input min-h-40 w-full resize-none rounded-[var(--an-tool-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)] text-sm leading-relaxed text-[var(--an-input-color)] outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-60';
const selectClass =
  'agent-elements-new-super-loop-model-select w-full cursor-pointer appearance-none rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] pr-8 text-sm text-[var(--an-input-color)] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-60';
const numberInputClass =
  'agent-elements-new-super-loop-iterations-input w-24 rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-sm text-[var(--an-input-color)] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-60';
const errorClass =
  'agent-elements-new-super-loop-error rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-diff-removed-text)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-diff-removed-text)_10%,var(--an-background))] px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)] text-sm text-[var(--an-diff-removed-text)]';
const footerClass =
  'agent-elements-new-super-loop-actions flex items-center justify-end gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]';
const secondaryButtonClass =
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-4 py-1.5 text-sm font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClass =
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-send-button-bg)] bg-[var(--an-send-button-bg)] px-4 py-1.5 text-sm font-medium text-[var(--an-send-button-color)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--an-send-button-bg)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-send-button-bg)_88%,var(--an-foreground))] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-50';

export const NewSuperLoopDialog: React.FC<NewSuperLoopDialogProps> = ({
  workspacePath,
  onSuperLoopCreated,
}) => {
  const [isOpen, setIsOpen] = useAtom(newSuperLoopDialogOpenAtom);
  const upsertSuperLoop = useSetAtom(upsertSuperLoopAtom);

  const [taskDescription, setTaskDescription] = useState('');
  const [maxIterations, setMaxIterations] = useState<number>(SUPER_LOOP_DEFAULTS.maxIterations);
  const [selectedModel, setSelectedModel] = useState<string>(SUPER_LOOP_DEFAULT_MODEL);
  const [agentModels, setAgentModels] = useState<AgentModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load agent models when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    const loadModels = async () => {
      setLoadingModels(true);
      try {
        const response = await window.electronAPI.aiGetModels();
        if (response.success && response.grouped) {
          const agents = getSuperLoopAgentModels(response.grouped);
          setAgentModels(agents);

          // If the default model isn't in the list, select the first available
          if (agents.length > 0 && !agents.some(m => m.id === selectedModel)) {
            setSelectedModel(agents[0].id);
          }
        }
      } catch (err) {
        console.error('[NewSuperLoopDialog] Failed to load models:', err);
      } finally {
        setLoadingModels(false);
      }
    };

    loadModels();
  }, [isOpen]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTaskDescription('');
      setMaxIterations(SUPER_LOOP_DEFAULTS.maxIterations);
      setSelectedModel(SUPER_LOOP_DEFAULT_MODEL);
      setError(null);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (!isCreating) {
      setIsOpen(false);
    }
  }, [setIsOpen, isCreating]);

  const handleCreate = useCallback(async () => {
    if (!taskDescription.trim()) {
      setError('Task description is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // The IPC handler will auto-create a dedicated worktree for this Super Loop
      const result = await window.electronAPI.invoke('super-loop:create', workspacePath, taskDescription.trim(), {
        maxIterations,
        modelId: selectedModel,
      });

      if (result.success && result.loop) {
        upsertSuperLoop(result.loop);
        setIsOpen(false);
        onSuperLoopCreated?.(result.loop.id, result.worktree?.id);
      } else {
        setError(result.error || 'Failed to create Super Loop');
      }
    } catch (err) {
      console.error('[NewSuperLoopDialog] Failed to create super loop:', err);
      setError('Failed to create Super Loop');
    } finally {
      setIsCreating(false);
    }
  }, [workspacePath, taskDescription, maxIterations, selectedModel, setIsOpen, upsertSuperLoop, onSuperLoopCreated]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleCreate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, handleCreate]);

  const getModelDisplayName = (modelId: string): string => {
    // Check if it's in the loaded list
    const model = agentModels.find(m => m.id === modelId);
    if (model) return model.name;

    // Strip provider prefix
    const [, ...parts] = modelId.split(':');
    return parts.join(':') || modelId;
  };

  if (!isOpen) return null;

  return (
    <div
      className={overlayClass}
      onClick={handleClose}
      data-component="NewSuperLoopDialogBackdrop"
      data-testid="agent-elements-new-super-loop-backdrop"
      data-agent-elements-shell="new-super-loop-backdrop"
    >
      <div
        className={dialogClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-super-loop-title"
        data-component="NewSuperLoopDialog"
        data-testid="agent-elements-new-super-loop-dialog"
        data-agent-elements-shell="new-super-loop-dialog"
      >
        <div
          className={headerClass}
          data-testid="agent-elements-new-super-loop-header"
          data-agent-elements-shell="new-super-loop-header"
        >
          <div className="flex min-w-0 items-start gap-[var(--an-spacing-md)]">
            <span className={iconShellClass} data-agent-elements-shell="new-super-loop-icon" aria-hidden="true">
              <MaterialSymbol icon="sync" size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="new-super-loop-title" className="m-0 text-base font-medium leading-snug text-[var(--an-foreground)]">
                New Super Loop
              </h2>
              <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                Launch an iterative agent with a dedicated worktree.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className={closeButtonClass}
            disabled={isCreating}
            aria-label="Close"
            data-agent-elements-shell="new-super-loop-close"
          >
            <MaterialSymbol icon="close" size={20} aria-hidden="true" />
          </button>
        </div>

        <div className={bodyClass} data-agent-elements-shell="new-super-loop-body">
          <div
            className={descriptionClass}
            data-testid="agent-elements-new-super-loop-description"
            data-agent-elements-shell="new-super-loop-description"
          >
            Super Loops run an autonomous AI agent iteratively until a task is complete.
            Each iteration starts with fresh context while progress persists via files.
            A dedicated worktree will be automatically created for this loop.
            <span className="italic"> Heavily inspired by Ralph Loops.</span>
          </div>

          <div
            className={fieldClass}
            data-testid="agent-elements-new-super-loop-task-field"
            data-agent-elements-shell="new-super-loop-task-field"
          >
            <label className={fieldLabelClass} htmlFor="new-super-loop-task">
              Task Description
            </label>
            <textarea
              id="new-super-loop-task"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Describe the task you want the AI to complete..."
              className={textareaClass}
              disabled={isCreating}
              data-testid="agent-elements-new-super-loop-task-input"
              data-agent-elements-shell="new-super-loop-task-input"
              autoFocus
            />
            <p className={fieldHintClass}>
              This will be saved to .superloop/task.md in a new worktree.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-[var(--an-spacing-xl)] sm:grid-cols-[minmax(0,1fr)_136px]">
            <div
              className={fieldClass}
              data-testid="agent-elements-new-super-loop-model-field"
              data-agent-elements-shell="new-super-loop-model-field"
            >
              <label className={fieldLabelClass} htmlFor="new-super-loop-model">
                Model
              </label>
              <div className="relative">
                <select
                  id="new-super-loop-model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className={selectClass}
                  disabled={isCreating || loadingModels}
                  data-testid="agent-elements-new-super-loop-model-select"
                  data-agent-elements-shell="new-super-loop-model-select"
                >
                  {loadingModels ? (
                    <option value={selectedModel}>Loading models...</option>
                  ) : agentModels.length === 0 ? (
                    <option value={SUPER_LOOP_DEFAULT_MODEL}>{getModelDisplayName(SUPER_LOOP_DEFAULT_MODEL)}</option>
                  ) : (
                    agentModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))
                  )}
                </select>
                <span
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--an-foreground-muted)]"
                  aria-hidden="true"
                >
                  <MaterialSymbol icon="expand_more" size={16} />
                </span>
              </div>
              <p className={fieldHintClass}>
                The AI model used for each iteration.
              </p>
            </div>

            <div
              className={fieldClass}
              data-testid="agent-elements-new-super-loop-iterations-field"
              data-agent-elements-shell="new-super-loop-iterations-field"
            >
              <label className={fieldLabelClass} htmlFor="new-super-loop-iterations">
                Max Iterations
              </label>
              <div className="flex items-center gap-[var(--an-spacing-sm)]">
                <input
                  id="new-super-loop-iterations"
                  type="number"
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={100}
                  className={numberInputClass}
                  disabled={isCreating}
                  data-testid="agent-elements-new-super-loop-iterations-input"
                  data-agent-elements-shell="new-super-loop-iterations-input"
                />
                <span className="text-sm text-[var(--an-foreground-muted)]">
                  (1-100)
                </span>
              </div>
              <p className={fieldHintClass}>
                Stops after this many iterations.
              </p>
            </div>
          </div>

          {error && (
            <div
              className={errorClass}
              role="alert"
              data-testid="agent-elements-new-super-loop-error"
              data-agent-elements-shell="new-super-loop-error"
            >
              {error}
            </div>
          )}
        </div>

        <div
          className={footerClass}
          data-testid="agent-elements-new-super-loop-actions"
          data-agent-elements-shell="new-super-loop-actions"
        >
          <button
            type="button"
            onClick={handleClose}
            className={secondaryButtonClass}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !taskDescription.trim()}
            className={primaryButtonClass}
          >
            {isCreating ? (
              <>
                <MaterialSymbol icon="progress_activity" size={16} className="animate-spin" aria-hidden="true" />
                Creating...
              </>
            ) : (
              <>
                <MaterialSymbol icon="play_arrow" size={16} aria-hidden="true" />
                Create & Start
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewSuperLoopDialog;
