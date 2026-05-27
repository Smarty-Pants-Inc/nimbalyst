import React, { useId, useMemo } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { getClaudeCodeModelLabel } from '../../utils/modelUtils';

export interface AgentModelOption {
  id: string;
  name: string;
  provider: string;
}

interface AgentModelPickerProps {
  models: AgentModelOption[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const providerLabels: Record<string, string> = {
  'claude-code': 'Claude Agent',
  'openai-codex': 'OpenAI Codex',
  'openai-codex-acp': 'OpenAI Codex (ACP)',
  'smarty-server': 'Smarty Server',
};

const rootClass = [
  'merge-conflict-dialog-model',
  'agent-elements-agent-model-picker',
  'mb-4 flex flex-col gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)]',
  'border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]',
  'text-[var(--an-foreground)]',
].join(' ');

const labelClass = [
  'agent-elements-agent-model-picker-label',
  'flex items-center gap-[var(--an-spacing-sm)] text-[13px] font-medium text-[var(--an-foreground)]',
].join(' ');

const selectClass = [
  'agent-elements-agent-model-picker-select',
  'w-full rounded-[calc(var(--an-input-border-radius)_-_4px)] border border-[var(--an-input-border-color)]',
  'bg-[var(--an-input-background)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]',
  'text-xs text-[var(--an-input-color)] outline-none',
  'transition-[background-color,border-color,color] duration-150 ease-out',
  'focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)]',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

function getModelLabel(model: AgentModelOption): string {
  if (model.name) return model.name;
  if (model.id.startsWith('claude-code')) return getClaudeCodeModelLabel(model.id);
  const [, ...parts] = model.id.split(':');
  return parts.join(':') || model.id;
}

export function AgentModelPicker({
  models,
  selectedModel,
  onModelChange,
  isLoading = false,
  disabled = false,
}: AgentModelPickerProps) {
  const groupedModels = useMemo(() => {
    return models.reduce((acc, model) => {
      const key = model.provider || 'unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(model);
      return acc;
    }, {} as Record<string, AgentModelOption[]>);
  }, [models]);

  const hasModels = models.length > 0;
  const selectValue = hasModels ? selectedModel : '';
  const isDisabled = disabled || (!hasModels && !isLoading);
  const selectId = useId();

  return (
    <div
      className={rootClass}
      data-agent-elements-shell="agent-model-picker"
      data-component="AgentModelPicker"
      data-loading={isLoading ? 'true' : 'false'}
      data-model-count={models.length}
      data-testid="agent-elements-agent-model-picker"
    >
      <label
        className={labelClass}
        data-agent-elements-shell="agent-model-picker-label"
        data-testid="agent-elements-agent-model-picker-label"
        htmlFor={selectId}
      >
        <span aria-hidden="true" className="flex shrink-0">
          <MaterialSymbol icon="memory" size={16} className="text-[var(--an-foreground-muted)]" />
        </span>
        <span>Model</span>
      </label>
      <select
        className={selectClass}
        data-agent-elements-shell="agent-model-picker-select"
        data-testid="agent-elements-agent-model-picker-select"
        id={selectId}
        value={selectValue}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={isDisabled}
      >
        {isLoading && (
          <option value={selectValue}>Loading models...</option>
        )}
        {!isLoading && !hasModels && (
          <option value="">No agent models available</option>
        )}
        {!isLoading && hasModels && Object.entries(groupedModels).map(([provider, providerModels]) => (
          <optgroup key={provider} label={providerLabels[provider] || provider}>
            {providerModels.map((model) => (
              <option key={model.id} value={model.id}>
                {getModelLabel(model)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export default AgentModelPicker;
