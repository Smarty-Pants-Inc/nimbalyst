import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getProviderIcon, MaterialSymbol } from '@nimbalyst/runtime';
import { getClaudeCodeModelLabel } from '../../utils/modelUtils';

interface Model {
  id: string;
  name: string;
  provider: string;
}

interface ModelSelection {
  id: string;
  name: string;
  provider: string;
  checked: boolean;
  count: number;
}

export interface BlitzDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: any) => void;
  workspacePath: string;
}

const overlayClass =
  'nim-overlay agent-elements-blitz-overlay fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--an-foreground)_16%,transparent)] p-[var(--an-spacing-xxl)]';
const dialogClass =
  'nim-modal agent-elements-blitz-dialog agent-elements-tool-card flex max-h-[85vh] w-[min(90vw,560px)] flex-col !gap-0 !p-0 [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xxl)] overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]';
const headerClass =
  'nim-modal-header agent-elements-blitz-header flex items-start justify-between gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';
const iconShellClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]';
const badgeClass =
  'inline-flex shrink-0 items-center rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--an-foreground-muted)]';
const bodyClass =
  'nim-modal-body agent-elements-blitz-body nim-scrollbar flex-1 space-y-[var(--an-spacing-xl)] overflow-y-auto px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';
const fieldClass = 'space-y-[var(--an-spacing-sm)]';
const fieldHeaderClass = 'flex items-center justify-between gap-[var(--an-spacing-sm)]';
const fieldLabelClass = 'block text-sm font-medium text-[var(--an-foreground)]';
const fieldHintClass = 'm-0 text-xs leading-relaxed text-[var(--an-foreground-subtle)]';
const textareaClass =
  'agent-elements-blitz-prompt-input min-h-28 w-full resize-none rounded-[var(--an-tool-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)] text-sm leading-relaxed text-[var(--an-input-color)] outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-60';
const modelListClass =
  'nim-scrollbar max-h-[260px] overflow-y-auto pr-1';
const modelRowBaseClass =
  'agent-elements-blitz-model-row grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_4rem] items-center gap-[var(--an-spacing-md)] rounded-[var(--an-input-border-radius)] border px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-sm transition-[background-color,border-color,color] duration-150 ease-out';
const modelRowActiveClass =
  'border-[color-mix(in_srgb,var(--an-primary-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_9%,var(--an-background))] text-[var(--an-foreground)]';
const modelRowInactiveClass =
  'border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] hover:border-[var(--an-border-color-strong)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]';
const checkboxClass =
  'h-4 w-4 shrink-0 cursor-pointer accent-[var(--an-primary-color)] disabled:cursor-not-allowed';
const numberInputClass =
  'w-16 rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-2 py-1 text-center text-sm text-[var(--an-input-color)] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-40';
const selectClass =
  'agent-elements-blitz-analysis-select w-full cursor-pointer appearance-none rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] pr-8 text-sm text-[var(--an-input-color)] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-60';
const errorClass =
  'agent-elements-blitz-error select-text rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-error-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-error-color)_10%,var(--an-background))] px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)] text-sm text-[var(--an-error-color)]';
const footerClass =
  'nim-modal-footer agent-elements-blitz-actions flex items-center justify-end gap-[var(--an-spacing-sm)] border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--agent-elements-card-inline-padding)] py-[var(--an-spacing-lg)]';
const secondaryButtonClass =
  'inline-flex min-h-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-4 py-1.5 text-sm font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClass =
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-[var(--an-spacing-xs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-send-button-bg)] bg-[var(--an-send-button-bg)] px-4 py-1.5 text-sm font-medium text-[var(--an-send-button-color)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--an-send-button-bg)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-send-button-bg)_88%,var(--an-foreground))] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-50';

export const BlitzDialog: React.FC<BlitzDialogProps> = ({
  isOpen,
  onClose,
  onCreated,
  workspacePath,
}) => {
  const [prompt, setPrompt] = useState('');
  const [modelSelections, setModelSelections] = useState<ModelSelection[]>([]);
  const [analysisModel, setAnalysisModel] = useState<string>('claude-code:opus');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load available models on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadModels = async () => {
      setLoading(true);
      try {
        const response = await window.electronAPI.aiGetModels();
        if (response.success && response.grouped) {
          const selections: ModelSelection[] = [];

          // Only show agent-type providers (claude-code, openai-codex)
          for (const [provider, models] of Object.entries(response.grouped as Record<string, Model[]>)) {
            if (provider === 'claude-code' || provider === 'openai-codex') {
              for (const model of models) {
                selections.push({
                  id: model.id,
                  name: model.name,
                  provider: model.provider || provider,
                  checked: false,
                  count: 1,
                });
              }
            }
          }

          // Check the first model by default
          if (selections.length > 0) {
            selections[0].checked = true;
          }

          setModelSelections(selections);

          // Default analysis model to opus if available, otherwise first model
          const opusModel = selections.find(s => s.id.includes('opus'));
          setAnalysisModel(opusModel?.id || selections[0]?.id || 'claude-code:opus');
        }
      } catch (err) {
        console.error('[BlitzDialog] Failed to load models:', err);
        setError('Failed to load available models');
      } finally {
        setLoading(false);
      }
    };

    loadModels();

    // Focus textarea after a short delay for animation
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [isOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setPrompt('');
      setError(null);
      setCreating(false);
    }
  }, [isOpen]);

  const toggleModel = useCallback((modelId: string) => {
    setModelSelections(prev => prev.map(m =>
      m.id === modelId ? { ...m, checked: !m.checked } : m
    ));
  }, []);

  const updateCount = useCallback((modelId: string, count: number) => {
    const clamped = Math.max(1, Math.min(5, count));
    setModelSelections(prev => prev.map(m =>
      m.id === modelId ? { ...m, count: clamped } : m
    ));
  }, []);

  const selectedModels = modelSelections.filter(m => m.checked);
  const totalWorktrees = selectedModels.reduce((sum, m) => sum + m.count, 0);
  const isValid = prompt.trim().length > 0 && selectedModels.length > 0 && totalWorktrees <= 10;

  const getModelDisplayName = (model: ModelSelection): string => {
    // Use claude code label for claude-code models
    if (model.provider === 'claude-code') {
      return getClaudeCodeModelLabel(model.id);
    }
    return model.name;
  };

  const handleSubmit = useCallback(async () => {
    if (!isValid || creating) return;

    setCreating(true);
    setError(null);

    try {
      const modelConfig = selectedModels.map(m => ({
        provider: m.provider,
        model: m.id,
        count: m.count,
      }));

      const result = await window.electronAPI.invoke('blitz:create', {
        workspacePath,
        prompt: prompt.trim(),
        modelConfig,
        analysisModel,
      });

      if (result.success) {
        onCreated(result);
        onClose();
      } else {
        setError(result.error || 'Failed to create blitz');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create blitz');
    } finally {
      setCreating(false);
    }
  }, [isValid, creating, selectedModels, workspacePath, prompt, analysisModel, onCreated, onClose]);

  // Handle Cmd+Enter for submit within the modal
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey && isValid && !creating) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, isValid, creating]);

  // Global Escape handler (document-level so it works regardless of focus)
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={overlayClass}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      data-component="BlitzDialogBackdrop"
      data-testid="agent-elements-blitz-overlay"
      data-agent-elements-shell="blitz-overlay"
    >
      <div
        className={dialogClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="blitz-dialog-title"
        data-component="BlitzDialog"
        data-testid="agent-elements-blitz-dialog"
        data-agent-elements-shell="blitz-dialog"
      >
        <div
          className={headerClass}
          data-testid="agent-elements-blitz-header"
          data-agent-elements-shell="blitz-header"
        >
          <div className="flex min-w-0 items-start gap-[var(--an-spacing-md)]">
            <span className={iconShellClass} data-agent-elements-shell="blitz-icon" aria-hidden="true">
              <MaterialSymbol icon="bolt" size={20} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-[var(--an-spacing-sm)]">
                <h2 id="blitz-dialog-title" className="m-0 text-base font-medium leading-snug text-[var(--an-foreground)]">New Blitz</h2>
                <span className={badgeClass} data-agent-elements-shell="blitz-beta-badge">
                  Beta
                </span>
              </div>
              <p className="m-0 mt-1 max-w-[24rem] text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                Run a single prompt across multiple worktrees and compare the outcomes side-by-side.
              </p>
            </div>
          </div>
          <span className={badgeClass} data-agent-elements-shell="blitz-worktree-limit">
            Max 10 worktrees
          </span>
        </div>

        <div className={bodyClass} data-agent-elements-shell="blitz-body">
          <div
            className={fieldClass}
            data-testid="agent-elements-blitz-prompt-field"
            data-agent-elements-shell="blitz-prompt-field"
          >
            <div className={fieldHeaderClass}>
              <label className={fieldLabelClass} htmlFor="blitz-prompt-input">Prompt</label>
              <span className="text-xs text-[var(--an-foreground-subtle)]">Cmd+Enter to start</span>
            </div>
            <textarea
              id="blitz-prompt-input"
              ref={textareaRef}
              className={textareaClass}
              rows={4}
              placeholder="Enter the prompt to run across all sessions..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={creating}
              data-testid="agent-elements-blitz-prompt-input"
              data-agent-elements-shell="blitz-prompt-input"
            />
            <p className={fieldHintClass}>
              Tip: Be explicit about scope and acceptance criteria.
            </p>
          </div>

          <div
            className={fieldClass}
            data-testid="agent-elements-blitz-models-field"
            data-agent-elements-shell="blitz-models-field"
          >
            <div className={fieldHeaderClass}>
              <label className={fieldLabelClass}>Models</label>
              {selectedModels.length > 0 && (
                <div className={`text-xs ${totalWorktrees > 10 ? 'text-[var(--an-error-color)]' : 'text-[var(--an-foreground-subtle)]'}`}>
                  Total: {totalWorktrees} worktree{totalWorktrees !== 1 ? 's' : ''}
                  {totalWorktrees > 10 && ' (maximum 10)'}
                </div>
              )}
            </div>
            {loading ? (
              <div className="py-3 text-sm text-[var(--an-foreground-subtle)]">Loading models...</div>
            ) : modelSelections.length === 0 ? (
              <div className="py-3 text-sm text-[var(--an-foreground-subtle)]">No agent models available. Configure API keys in Settings.</div>
            ) : (
              <div className={modelListClass}>
                <div className="flex flex-col gap-[var(--an-spacing-sm)]">
                  {modelSelections.map(model => (
                    <label
                      key={model.id}
                      className={`${modelRowBaseClass} ${model.checked ? modelRowActiveClass : modelRowInactiveClass} ${creating ? 'pointer-events-none opacity-50' : ''}`}
                      data-agent-elements-shell="blitz-model-row"
                      data-checked={model.checked ? 'true' : 'false'}
                    >
                      <input
                        type="checkbox"
                        checked={model.checked}
                        onChange={() => toggleModel(model.id)}
                        className={checkboxClass}
                        disabled={creating}
                        aria-label={`Use ${getModelDisplayName(model)}`}
                      />
                      <span className="shrink-0">{getProviderIcon(model.provider, { size: 14 })}</span>
                      <span className="truncate text-sm text-[var(--an-foreground)]">{getModelDisplayName(model)}</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={model.count}
                        onChange={(e) => updateCount(model.id, parseInt(e.target.value) || 1)}
                        disabled={!model.checked || creating}
                        className={numberInputClass}
                        aria-label={`Worktree count for ${getModelDisplayName(model)}`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
            <p className={fieldHintClass}>
              Choose up to 5 sessions per model.
            </p>
          </div>

          <div
            className={fieldClass}
            data-testid="agent-elements-blitz-analysis-field"
            data-agent-elements-shell="blitz-analysis-field"
          >
            <label className={fieldLabelClass} htmlFor="blitz-analysis-model">Analysis Model</label>
            <p className={fieldHintClass}>
              When all sessions complete, an analysis session compares the results.
            </p>
            <div className="relative">
              <select
                id="blitz-analysis-model"
                className={selectClass}
                value={analysisModel}
                onChange={(e) => setAnalysisModel(e.target.value)}
                disabled={creating || loading}
                data-testid="agent-elements-blitz-analysis-select"
                data-agent-elements-shell="blitz-analysis-select"
              >
                {modelSelections.map(model => (
                  <option key={model.id} value={model.id}>
                    {getModelDisplayName(model)}
                  </option>
                ))}
              </select>
              <span
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--an-foreground-muted)]"
                aria-hidden="true"
              >
                <MaterialSymbol icon="expand_more" size={16} />
              </span>
            </div>
          </div>

          {error && (
            <div
              className={errorClass}
              role="alert"
              data-testid="agent-elements-blitz-error"
              data-agent-elements-shell="blitz-error"
            >
              {error}
            </div>
          )}
        </div>

        <div
          className={footerClass}
          data-testid="agent-elements-blitz-actions"
          data-agent-elements-shell="blitz-actions"
        >
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={handleSubmit}
            disabled={!isValid || creating}
          >
            {creating ? (
              <>
                <MaterialSymbol icon="progress_activity" size={16} className="animate-spin" aria-hidden="true" />
                Creating...
              </>
            ) : (
              `Start Blitz (${totalWorktrees} worktree${totalWorktrees !== 1 ? 's' : ''})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
