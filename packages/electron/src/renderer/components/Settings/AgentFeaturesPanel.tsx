import React, { useCallback, useEffect, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { usePostHog } from 'posthog-js/react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import {
  advancedSettingsAtom,
  setAdvancedSettingsAtom,
  aiDebugSettingsAtom,
  setAIDebugSettingsAtom,
} from '../../store/atoms/appSettings';
import { autoCommitEnabledAtom, setAutoCommitEnabledAtom } from '../../store/atoms/autoCommitAtoms';
import { ALPHA_FEATURES, type AlphaFeatureTag } from '../../../shared/alphaFeatures';
import { AlphaBadge, SETTINGS_ALPHA_TOOLTIP } from '../common/AlphaBadge';
import { SettingsToggle } from '../GlobalSettings/SettingsToggle';
import { createProviderPanelChrome } from '../GlobalSettings/panels/providerPanelChrome';

const AGENT_FEATURE_TAGS: AlphaFeatureTag[] = [
  'super-loops',
  'blitz',
  'meta-agent',
];

interface WorkflowSourceSettings {
  workspaceClaudeCompatibilityEnabled: boolean;
  includeProjectClaudeSources: boolean;
  includeUserClaudeSources: boolean;
  extensionWorkflowsEnabled: boolean;
}

interface WorkflowExportSettings {
  codexEnabled: boolean;
  claudeGeneratedExtensionWorkflowsEnabled: boolean;
}

const chrome = createProviderPanelChrome({
  headerClassName: 'provider-panel-header agent-features-header',
  sectionClassName: 'provider-panel-section agent-features-section',
  configCardClassName: 'agent-elements-agent-workflow-card',
  inputClassName: 'agent-elements-agent-feature-input',
  loadingClassName: 'agent-elements-agent-feature-loading',
  modelRowClassName: 'agent-elements-agent-feature-row',
  testButtonClassName: 'agent-elements-agent-feature-button',
  testErrorClassName: 'agent-elements-agent-feature-error',
  emptyClassName: 'agent-elements-agent-feature-empty',
});

const formRowClass =
  'agent-preferred-language agent-elements-form-row flex items-start justify-between gap-[var(--an-spacing-lg)] py-[var(--an-spacing-md)]';
const formLabelClass =
  'text-sm font-medium leading-tight text-[var(--an-foreground)]';
const formDescriptionClass =
  'mt-[var(--an-spacing-xxs)] text-xs leading-snug text-[var(--an-foreground-muted)]';
const sectionHeadingClass =
  'agent-elements-section-heading mb-[var(--an-spacing-md)] flex items-center gap-[var(--an-spacing-sm)]';
const warningCardClass =
  'agent-elements-status-card mb-[var(--an-spacing-lg)] flex items-start gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-warning-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_10%,var(--an-background))] px-[var(--agent-elements-card-inline-padding,var(--an-spacing-md))] py-[var(--agent-elements-card-block-padding,var(--an-spacing-md))] [--agent-elements-card-block-padding:var(--an-spacing-md)] [--agent-elements-card-inline-padding:var(--an-spacing-md)]';
const warningIconClass =
  'mt-[var(--an-spacing-xxs)] shrink-0 text-[var(--an-warning-color)]';
const warningTextClass =
  'm-0 text-[13px] leading-snug text-[var(--an-foreground)]';
const workflowCardClass =
  `${chrome.configCard} mb-[var(--an-spacing-xl)]`;
const workflowTitleClass =
  'mb-[var(--an-spacing-xs)] text-sm font-semibold text-[var(--an-foreground)]';
const workflowDescriptionClass =
  'mb-[var(--an-spacing-md)] text-xs leading-relaxed text-[var(--an-foreground-muted)]';
const workflowGroupDividerClass =
  'mb-[var(--an-spacing-md)] border-b border-[var(--an-border-color)] pb-[var(--an-spacing-sm)]';
const developerIntroClass =
  'mb-[var(--an-spacing-md)] text-sm leading-relaxed text-[var(--an-foreground-muted)]';

function AgentFeatureToggleShell({
  control,
  children,
}: {
  control: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="agent-elements-agent-feature-toggle"
      data-agent-elements-shell="agent-feature-toggle"
      data-agent-feature-control={control}
    >
      {children}
    </div>
  );
}

export function AgentFeaturesPanel() {
  const posthog = usePostHog();
  const [settings] = useAtom(advancedSettingsAtom);
  const [, updateSettings] = useAtom(setAdvancedSettingsAtom);
  const { alphaFeatures } = settings;

  const autoCommitEnabled = useAtomValue(autoCommitEnabledAtom);
  const setAutoCommitEnabled = useSetAtom(setAutoCommitEnabledAtom);

  const [aiDebugSettings] = useAtom(aiDebugSettingsAtom);
  const [, updateAIDebugSettings] = useAtom(setAIDebugSettingsAtom);
  const { showToolCalls, chatShowToolCalls, aiDebugLogging, showPromptAdditions } = aiDebugSettings;
  const [workflowSettingsLoading, setWorkflowSettingsLoading] = useState(false);
  const [preferredAgentLanguage, setPreferredAgentLanguage] = useState<string>('');
  const [workflowSourceSettings, setWorkflowSourceSettings] = useState<WorkflowSourceSettings>({
    workspaceClaudeCompatibilityEnabled: false,
    includeProjectClaudeSources: false,
    includeUserClaudeSources: false,
    extensionWorkflowsEnabled: false,
  });
  const [workflowExportSettings, setWorkflowExportSettings] = useState<WorkflowExportSettings>({
    codexEnabled: false,
    claudeGeneratedExtensionWorkflowsEnabled: false,
  });

  const isDevelopment = import.meta.env.DEV;

  const handleAlphaToggle = (tag: AlphaFeatureTag, enabled: boolean) => {
    updateSettings({
      alphaFeatures: { ...alphaFeatures, [tag]: enabled },
    });
    posthog?.capture('alpha_feature_toggled', {
      feature_tag: tag,
      enabled,
      source: 'agent_features_panel',
    });
  };

  const features = AGENT_FEATURE_TAGS
    .map((tag) => ALPHA_FEATURES.find((f) => f.tag === tag))
    .filter((f): f is (typeof ALPHA_FEATURES)[number] => f != null);

  useEffect(() => {
    const loadAgentWorkflowSettings = async () => {
      try {
        const settings = await window.electronAPI.claudeCode.getSettings();
        const workflowSettings = await window.electronAPI.agentWorkflows.getSettings();
        setWorkflowSourceSettings({
          workspaceClaudeCompatibilityEnabled: workflowSettings.sourceSettings.workspaceClaudeCompatibilityEnabled,
          includeProjectClaudeSources: workflowSettings.sourceSettings.includeProjectClaudeSources ?? settings.projectCommandsEnabled,
          includeUserClaudeSources: workflowSettings.sourceSettings.includeUserClaudeSources ?? settings.userCommandsEnabled,
          extensionWorkflowsEnabled: workflowSettings.sourceSettings.extensionWorkflowsEnabled,
        });
        setWorkflowExportSettings(workflowSettings.exportSettings);
      } catch (err) {
        console.error('Failed to load agent workflow settings:', err);
      }
    };

    loadAgentWorkflowSettings();
  }, []);

  useEffect(() => {
    const loadPreferredAgentLanguage = async () => {
      try {
        const language = await window.electronAPI.invoke('preferred-agent-language:get');
        setPreferredAgentLanguage(typeof language === 'string' ? language : '');
      } catch (err) {
        console.error('Failed to load preferred agent language:', err);
      }
    };
    loadPreferredAgentLanguage();
  }, []);

  const handlePreferredAgentLanguageChange = useCallback(async (value: string) => {
    setPreferredAgentLanguage(value);
    try {
      await window.electronAPI.invoke('preferred-agent-language:set', value);
    } catch (err) {
      console.error('Failed to save preferred agent language:', err);
    }
  }, []);

  const handleWorkflowSourceToggle = useCallback(async (
    key: keyof WorkflowSourceSettings,
    enabled: boolean,
  ) => {
    setWorkflowSettingsLoading(true);
    try {
      const next = await window.electronAPI.agentWorkflows.setSourceSettings({ [key]: enabled });
      setWorkflowSourceSettings(next);
    } catch (err) {
      console.error('Failed to update workflow source settings:', err);
    } finally {
      setWorkflowSettingsLoading(false);
    }
  }, []);

  const handleWorkflowExportToggle = useCallback(async (
    key: keyof WorkflowExportSettings,
    enabled: boolean,
  ) => {
    setWorkflowSettingsLoading(true);
    try {
      const next = await window.electronAPI.agentWorkflows.setExportSettings({ [key]: enabled });
      setWorkflowExportSettings(next);
    } catch (err) {
      console.error('Failed to update workflow export settings:', err);
    } finally {
      setWorkflowSettingsLoading(false);
    }
  }, []);

  return (
    <div
      className="provider-panel agent-elements-settings-panel agent-elements-agent-features-panel flex flex-col"
      data-agent-elements-shell="agent-features-panel"
      data-component="AgentFeaturesPanel"
      data-testid="agent-elements-agent-features-panel"
    >
      <div
        className={chrome.header}
        data-agent-elements-shell="agent-features-header"
        data-testid="agent-elements-agent-features-header"
      >
        <h3 className={chrome.title}>
          Agent Features
        </h3>
        <p className={chrome.description}>
          Settings that control how agent sessions behave.
        </p>
      </div>

      <div
        className={chrome.section}
        data-agent-elements-shell="agent-feature-section"
        data-section="core"
        data-testid="agent-elements-agent-features-core-section"
      >
        <AgentFeatureToggleShell control="auto-commit">
          <SettingsToggle
            checked={autoCommitEnabled}
            onChange={(checked) => {
              setAutoCommitEnabled(checked);
              posthog?.capture('auto_commit_toggled', { enabled: checked });
            }}
            name="Auto-approve Commits"
            description="Automatically approve when Claude proposes git commits."
          />
        </AgentFeatureToggleShell>

        <div
          className={formRowClass}
          data-agent-elements-shell="agent-feature-input-row"
          data-agent-feature-control="preferred-agent-language"
        >
          <div className="flex-1 min-w-0">
            <div className={formLabelClass}>
              Preferred Agent Language
            </div>
            <div className={formDescriptionClass}>
              Preferred language for AI-generated session names (e.g. "Japanese", "ja", "Spanish"). Leave blank to let the agent pick based on the conversation.
            </div>
          </div>
          <input
            type="text"
            value={preferredAgentLanguage}
            onChange={(e) => handlePreferredAgentLanguageChange(e.target.value)}
            placeholder="e.g. ja"
            className={`${chrome.input} w-40 text-sm`}
            data-testid="preferred-agent-language-input"
          />
        </div>
      </div>

      <div
        className={chrome.section}
        data-agent-elements-shell="agent-feature-section"
        data-section="experimental"
        data-testid="agent-elements-agent-features-experimental-section"
      >
        <div
          className={sectionHeadingClass}
          data-agent-elements-shell="agent-feature-section-heading"
        >
          <h4 className={`${chrome.sectionTitle} m-0`}>Experimental</h4>
          <AlphaBadge size="sm" tooltip={SETTINGS_ALPHA_TOOLTIP} />
        </div>

        <div
          className={warningCardClass}
          data-agent-elements-shell="agent-feature-warning"
          data-tone="warning"
          data-testid="agent-elements-agent-features-warning"
        >
          <MaterialSymbol icon="science" size={16} className={warningIconClass} />
          <p className={warningTextClass}>
            These features may change, regress, or be removed. Some require a restart to take full effect.
          </p>
        </div>

        <div
          className={workflowCardClass}
          data-agent-elements-shell="agent-feature-workflow-card"
          data-testid="agent-elements-agent-features-workflow-card"
        >
          <h5 className={workflowTitleClass}>
            Agent skills and commands compatibility
          </h5>
          <p className={workflowDescriptionClass}>
            Control which command and skill sources feed the shared picker and which generated compatibility exports are written for Claude Code and Codex.
          </p>

          <div className={workflowGroupDividerClass}>
            <AgentFeatureToggleShell control="workspace-claude-compatibility">
              <SettingsToggle
                checked={workflowSourceSettings.workspaceClaudeCompatibilityEnabled}
                onChange={(checked) => handleWorkflowSourceToggle('workspaceClaudeCompatibilityEnabled', checked)}
                disabled={workflowSettingsLoading}
                name="Workspace Claude compatibility"
                description="Import project and user .claude commands and skills into the shared workflow registry."
              />
            </AgentFeatureToggleShell>
            <AgentFeatureToggleShell control="project-claude-sources">
              <SettingsToggle
                checked={workflowSourceSettings.includeProjectClaudeSources}
                onChange={(checked) => handleWorkflowSourceToggle('includeProjectClaudeSources', checked)}
                disabled={workflowSettingsLoading || !workflowSourceSettings.workspaceClaudeCompatibilityEnabled}
                name="Project .claude sources"
                description="Include .claude/commands and .claude/skills from the current workspace."
              />
            </AgentFeatureToggleShell>
            <AgentFeatureToggleShell control="user-claude-sources">
              <SettingsToggle
                checked={workflowSourceSettings.includeUserClaudeSources}
                onChange={(checked) => handleWorkflowSourceToggle('includeUserClaudeSources', checked)}
                disabled={workflowSettingsLoading || !workflowSourceSettings.workspaceClaudeCompatibilityEnabled}
                name="User .claude sources"
                description="Include ~/.claude commands and skills when you want user-level compatibility in the picker and exports."
              />
            </AgentFeatureToggleShell>
            <AgentFeatureToggleShell control="extension-workflows">
              <SettingsToggle
                checked={workflowSourceSettings.extensionWorkflowsEnabled}
                onChange={(checked) => handleWorkflowSourceToggle('extensionWorkflowsEnabled', checked)}
                disabled={workflowSettingsLoading}
                name="Extension workflows"
                description="Load provider-neutral agentWorkflows contributions and legacy Claude plugin workflows from enabled extensions."
              />
            </AgentFeatureToggleShell>
          </div>

          <div>
            <AgentFeatureToggleShell control="codex-generated-skills">
              <SettingsToggle
                checked={workflowExportSettings.codexEnabled}
                onChange={(checked) => handleWorkflowExportToggle('codexEnabled', checked)}
                disabled={workflowSettingsLoading}
                name="Codex generated skills"
                description="Export registry workflows into .agents/skills/.nimbalyst-generated before Codex turns."
              />
            </AgentFeatureToggleShell>
            <AgentFeatureToggleShell control="claude-generated-extension-workflows">
              <SettingsToggle
                checked={workflowExportSettings.claudeGeneratedExtensionWorkflowsEnabled}
                onChange={(checked) => handleWorkflowExportToggle('claudeGeneratedExtensionWorkflowsEnabled', checked)}
                disabled={workflowSettingsLoading}
                name="Claude generated extension workflows"
                description="Generate Claude plugin shims for extension agentWorkflows under .claude/plugins/.nimbalyst-generated."
              />
            </AgentFeatureToggleShell>
          </div>
        </div>

        {features.map((feature) => (
          <AgentFeatureToggleShell key={feature.tag} control={feature.tag}>
            <SettingsToggle
              checked={alphaFeatures[feature.tag] ?? false}
              onChange={(checked) => handleAlphaToggle(feature.tag, checked)}
              name={feature.name}
              description={feature.description}
            />
          </AgentFeatureToggleShell>
        ))}

        <AgentFeatureToggleShell control="chat-show-tool-calls">
          <SettingsToggle
            checked={chatShowToolCalls}
            onChange={(checked) => updateAIDebugSettings({ chatShowToolCalls: checked })}
            name="Show Tool Calls in Chat"
            description="Display tool call rows in the AI chat view. Turn off to hide tool activity and see only the conversational messages."
          />
        </AgentFeatureToggleShell>
      </div>

      {isDevelopment && (
        <div
          className={chrome.section}
          data-agent-elements-shell="agent-feature-section"
          data-section="developer"
        >
          <h4 className={chrome.sectionTitle}>Developer Options</h4>
          <p className={developerIntroClass}>
            Only available in development mode.
          </p>

          <AgentFeatureToggleShell control="show-all-tool-calls">
            <SettingsToggle
              checked={showToolCalls}
              onChange={(checked) => updateAIDebugSettings({ showToolCalls: checked })}
              name="Show All Tool Calls"
              description="Display all MCP tool calls in the AI chat sidebar, including Edit/applyDiff calls."
            />
          </AgentFeatureToggleShell>

          <AgentFeatureToggleShell control="ai-debug-logging">
            <SettingsToggle
              checked={aiDebugLogging}
              onChange={(checked) => updateAIDebugSettings({ aiDebugLogging: checked })}
              name="AI Debug Logging"
              description="Capture detailed logs of all AI editing operations including LLM requests/responses."
            />
          </AgentFeatureToggleShell>

          <AgentFeatureToggleShell control="show-prompt-additions">
            <SettingsToggle
              checked={showPromptAdditions}
              onChange={(checked) => updateAIDebugSettings({ showPromptAdditions: checked })}
              name="Show Prompt Additions"
              description="Display system prompt additions and context that Nimbalyst appends to Claude Code requests."
            />
          </AgentFeatureToggleShell>
        </div>
      )}
    </div>
  );
}
