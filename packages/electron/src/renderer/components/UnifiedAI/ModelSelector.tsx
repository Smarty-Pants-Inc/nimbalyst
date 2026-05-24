import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol, getProviderIcon } from '@nimbalyst/runtime';
import {
  isAgentProvider,
  shouldBlockStartedSessionProviderSwitch,
} from '@nimbalyst/runtime/ai/server/types';
import { getClaudeCodeModelLabel } from '../../utils/modelUtils';
import { providersAtom } from '../../store/atoms/appSettings';
import { setWindowModeAtom } from '../../store/atoms/windowMode';
import { navigateToSettingsAtom } from '../../store/atoms/settingsNavigation';
import type { SettingsCategory } from '../Settings/SettingsSidebar';
import { FloatingPortal, useFloatingMenu } from '../../hooks/useFloatingMenu';

const ALPHA_PROVIDERS = new Set(['opencode', 'copilot-cli']);

interface Model {
  id: string;
  name: string;
  provider: string;
}

type ProviderType = 'agent' | 'model';

interface ModelSelectorProps {
  currentModel: string; // Full provider:model ID
  onModelChange: (modelId: string) => void;
  sessionHasMessages?: boolean; // Whether current session has any messages
  currentProvider?: string | null; // Current session provider
}

export function ModelSelector({
  currentModel,
  onModelChange,
  sessionHasMessages = false,
  currentProvider = null,
}: ModelSelectorProps) {
  const [models, setModels] = useState<Record<string, Model[]>>({});
  const [loading, setLoading] = useState(false);
  const providers = useAtomValue(providersAtom);
  const setWindowMode = useSetAtom(setWindowModeAtom);
  const navigateToSettings = useSetAtom(navigateToSettingsAtom);

  const menu = useFloatingMenu({
    placement: 'top-start',
    offsetPx: 6,
    constrainHeight: false,
  });

  // Clear cached models when provider settings change so next dropdown open fetches fresh data.
  useEffect(() => {
    setModels({});
  }, [providers]);

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const response = await window.electronAPI.aiGetModels();
      if (response.success && response.grouped) {
        setModels(response.grouped);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load models when dropdown opens.
  useEffect(() => {
    if (menu.isOpen && Object.keys(models).length === 0) {
      void loadModels();
    }
  }, [menu.isOpen, models, loadModels]);

  const toggleDropdown = useCallback(() => {
    menu.setIsOpen(!menu.isOpen);
  }, [menu]);

  const handleModelSelect = useCallback(
    (modelId: string) => {
      onModelChange(modelId);
      menu.setIsOpen(false);
    },
    [onModelChange, menu]
  );

  const getSettingsCategoryForModel = (modelId: string): SettingsCategory => {
    const provider = modelId.split(':')[0];
    switch (provider) {
      case 'claude':
      case 'claude-code':
      case 'openai':
      case 'openai-codex':
      case 'opencode':
      case 'copilot-cli':
      case 'smarty-server':
      case 'lmstudio':
        return provider;
      case 'openai-codex-acp':
        // Settings still live under the OpenAI Codex panel.
        return 'openai-codex';
      default:
        return 'claude-code';
    }
  };

  const handleConfigureModels = useCallback(() => {
    menu.setIsOpen(false);
    navigateToSettings({
      category: getSettingsCategoryForModel(currentModel),
      scope: 'user',
    });
    setWindowMode('settings');
  }, [currentModel, menu, navigateToSettings, setWindowMode]);

  const getCurrentModelName = () => {
    if (!currentModel) return 'Select Model';

    for (const providerModels of Object.values(models)) {
      const model = providerModels.find((m) => m.id === currentModel);
      if (model) return model.name;
    }

    if (currentModel.startsWith('claude-code')) {
      return getClaudeCodeModelLabel(currentModel);
    }
    const [, ...modelParts] = currentModel.split(':');
    return modelParts.join(':') || currentModel;
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'claude':
        return 'Claude Chat';
      case 'claude-code':
        return 'Claude Agent (Claude Code Based)';
      case 'openai':
        return 'OpenAI';
      case 'openai-codex':
        return 'OpenAI Codex';
      case 'openai-codex-acp':
        return 'OpenAI Codex (ACP)';
      case 'opencode':
        return 'OpenCode';
      case 'copilot-cli':
        return 'GitHub Copilot';
      case 'smarty-server':
        return 'Smarty Server';
      case 'lmstudio':
        return 'LMStudio';
      default:
        return provider;
    }
  };

  const getProviderType = (provider: string): ProviderType => {
    return isAgentProvider(provider) ? 'agent' : 'model';
  };

  const isProviderSwitchDisabled = (targetProvider: string): boolean => {
    return shouldBlockStartedSessionProviderSwitch(
      currentProvider,
      targetProvider,
      sessionHasMessages
    );
  };

  const isSectionDisabled = (sectionType: 'agent' | 'model'): boolean => {
    if (!sessionHasMessages || !currentProvider) return false;
    const currentProviderType = getProviderType(currentProvider);
    return sectionType !== currentProviderType;
  };

  const groupedProviders = useMemo(() => {
    return Object.entries(models).reduce(
      (acc, [provider, providerModels]) => {
        const type = isAgentProvider(provider) ? 'agents' : 'models';
        if (!acc[type]) acc[type] = {};
        acc[type][provider] = providerModels;
        return acc;
      },
      {} as Record<'agents' | 'models', Record<string, Model[]>>
    );
  }, [models]);

  const currentModelName = getCurrentModelName();
  const modelGroupCount = Object.keys(models).length;

  const triggerClass = [
    'model-selector-button',
    'agent-elements-model-selector-trigger',
    'agent-elements-status-pill',
    'flex max-w-[220px] cursor-pointer items-center gap-[var(--an-spacing-xs)] whitespace-nowrap',
    'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[var(--an-border-color)]',
    'bg-[var(--an-background-secondary)] px-[var(--an-spacing-sm)] py-[3px]',
    'text-[11px] font-medium text-[var(--an-foreground-muted)] outline-none',
    'transition-[background-color,border-color,color] duration-150',
    'hover:border-[var(--an-border-color-strong)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
    'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
  ].join(' ');

  const menuClass = [
    'model-selector-dropdown',
    'agent-elements-model-selector-menu',
    'nim-scrollbar z-[1000] max-h-[400px] min-w-[260px] max-w-[340px] overflow-y-auto',
    'rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]',
    'bg-[var(--an-background)] p-[var(--an-spacing-xxs)]',
  ].join(' ');

  const sectionHeaderClass = [
    'model-selector-section-header',
    'agent-elements-model-selector-section-header',
    'px-[var(--an-spacing-sm)] pb-[var(--an-spacing-xxs)] pt-[var(--an-spacing-xs)]',
    'text-[10px] font-medium text-[var(--an-foreground-subtle)]',
  ].join(' ');

  const disabledNoticeClass = [
    'model-selector-disabled-notice',
    'agent-elements-model-selector-disabled-notice',
    'px-[var(--an-spacing-sm)] pb-[var(--an-spacing-xs)] pt-[var(--an-spacing-xxs)]',
    'text-[11px] italic text-[var(--an-foreground-subtle)]',
  ].join(' ');

  const providerHeaderClass = [
    'model-selector-provider-header',
    'agent-elements-model-selector-provider-header',
    'flex items-center gap-[var(--an-spacing-xs)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]',
    'text-[11px] font-medium text-[var(--an-foreground-muted)]',
  ].join(' ');

  const dividerClass = [
    'model-selector-divider',
    'agent-elements-model-selector-divider',
    'my-[var(--an-spacing-xs)] h-px bg-[var(--an-border-color)]',
  ].join(' ');

  const configureClass = [
    'model-selector-configure',
    'agent-elements-model-selector-configure',
    'flex w-full cursor-pointer items-center gap-[var(--an-spacing-xs)]',
    'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border-none bg-transparent',
    'px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-left text-xs text-[var(--an-foreground-muted)]',
    'transition-[background-color,color] duration-150',
    'hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
    'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
  ].join(' ');

  const optionClass = (isCurrent: boolean, isDisabled: boolean) =>
    [
      'model-selector-option',
      'agent-elements-model-selector-option',
      'flex w-full items-center justify-between gap-[var(--an-spacing-sm)]',
      'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border-none',
      'px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] pl-[calc(var(--an-spacing-md)+14px)]',
      'text-left text-xs transition-[background-color,color,opacity] duration-150',
      isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      isCurrent
        ? 'selected bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]'
        : isDisabled
          ? 'bg-transparent text-[var(--an-foreground-subtle)]'
          : 'bg-transparent text-[var(--an-foreground)] hover:bg-[var(--an-background-tertiary)]',
      'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
    ].join(' ');

  const renderProviderGroup = (provider: string, providerModels: Model[]) => (
    <div
      key={provider}
      className="model-selector-provider-group agent-elements-model-selector-provider-group mb-[var(--an-spacing-xs)]"
      data-provider={provider}
    >
      <div className={providerHeaderClass}>
        <span aria-hidden="true" className="shrink-0">
          {getProviderIcon(provider, { size: 12 })}
        </span>
        <span>{getProviderLabel(provider)}</span>
        {ALPHA_PROVIDERS.has(provider) && (
          <span
            className="agent-elements-model-selector-alpha rounded-[var(--an-radius-sm)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xs)] py-px text-[10px] font-medium lowercase text-[var(--an-foreground-subtle)]"
            aria-label="Alpha feature"
            title="Alpha feature"
          >
            alpha
          </span>
        )}
      </div>
      {providerModels.map((model) => {
        const isCurrent = model.id === currentModel;
        const isDisabled = isProviderSwitchDisabled(provider);
        const disabledTooltip =
          'Start a new session to switch providers after the session has started';
        return (
          <button
            key={model.id}
            className={optionClass(isCurrent, isDisabled)}
            onClick={() => !isDisabled && handleModelSelect(model.id)}
            title={isDisabled ? disabledTooltip : undefined}
            aria-disabled={isDisabled}
            aria-checked={isCurrent}
            role="menuitemradio"
            type="button"
            data-model-id={model.id}
            data-provider={provider}
            data-current={isCurrent}
            data-disabled={isDisabled}
          >
            <span
              className={`model-selector-option-name flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${
                isDisabled ? 'text-[var(--an-foreground-subtle)]' : ''
              }`}
            >
              {model.name}
            </span>
            {isDisabled ? (
              <span aria-hidden="true" className="shrink-0 text-[var(--an-foreground-subtle)]">
                <MaterialSymbol icon="block" size={14} />
              </span>
            ) : isCurrent ? (
              <span aria-hidden="true" className="shrink-0">
                <MaterialSymbol icon="check" size={14} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className="model-selector agent-elements-model-selector inline-block"
      data-agent-elements-shell="model-selector"
      data-component="UnifiedAIModelSelector"
      data-current-model={currentModel}
      data-current-provider={currentProvider ?? currentModel.split(':')[0] ?? ''}
      data-testid="agent-elements-model-selector"
    >
      <button
        ref={menu.refs.setReference as React.RefCallback<HTMLButtonElement>}
        {...menu.getReferenceProps()}
        className={triggerClass}
        onClick={toggleDropdown}
        aria-label={`Current model: ${currentModelName}`}
        aria-expanded={menu.isOpen}
        aria-haspopup="menu"
        data-testid="model-picker"
        type="button"
      >
        <span className="model-selector-label overflow-hidden text-ellipsis">
          {currentModelName}
        </span>
        <MaterialSymbol
          icon="expand_more"
          size={14}
          className={`model-selector-arrow shrink-0 transition-transform duration-150 ${
            menu.isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {menu.isOpen && (
        <FloatingPortal>
          <div
            ref={menu.refs.setFloating as React.RefCallback<HTMLDivElement>}
            style={menu.floatingStyles}
            {...menu.getFloatingProps()}
            className={menuClass}
            data-agent-elements-shell="model-selector-menu"
            data-component="UnifiedAIModelSelectorMenu"
            data-model-group-count={modelGroupCount}
            data-testid="agent-elements-model-selector-menu"
            role="menu"
          >
            {loading ? (
              <div className="model-selector-loading px-[var(--an-spacing-sm)] py-[var(--an-spacing-md)] text-center text-xs text-[var(--an-foreground-subtle)]">
                Loading models...
              </div>
            ) : Object.keys(models).length === 0 ? (
              <div className="model-selector-empty px-[var(--an-spacing-sm)] py-[var(--an-spacing-md)] text-center text-xs text-[var(--an-foreground-subtle)]">
                No models available
              </div>
            ) : (
              <>
                {groupedProviders.agents && Object.keys(groupedProviders.agents).length > 0 && (
                  <>
                    <div className={sectionHeaderClass}>Agents</div>
                    {isSectionDisabled('agent') && (
                      <div className={disabledNoticeClass}>Start a new session to use agents</div>
                    )}
                    {Object.entries(groupedProviders.agents).map(([provider, providerModels]) =>
                      renderProviderGroup(provider, providerModels)
                    )}
                  </>
                )}

                {groupedProviders.models && Object.keys(groupedProviders.models).length > 0 && (
                  <>
                    {groupedProviders.agents && Object.keys(groupedProviders.agents).length > 0 && (
                      <div className={dividerClass} />
                    )}
                    <div className={sectionHeaderClass}>Chat with open document</div>
                    {isSectionDisabled('model') && (
                      <div className={disabledNoticeClass}>
                        Start a new session to use chat models
                      </div>
                    )}
                    {Object.entries(groupedProviders.models).map(([provider, providerModels]) =>
                      renderProviderGroup(provider, providerModels)
                    )}
                  </>
                )}

                <div className={dividerClass} />
                <button
                  className={configureClass}
                  onClick={handleConfigureModels}
                  role="menuitem"
                  type="button"
                >
                  <MaterialSymbol icon="settings" size={14} />
                  <span>Configure models</span>
                </button>
              </>
            )}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
