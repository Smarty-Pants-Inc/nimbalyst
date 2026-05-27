import React, { useState, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { usePostHog } from 'posthog-js/react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { SettingsToggle } from '../SettingsToggle';
import { HelpTooltip } from '../../../help';
import { createProviderPanelChrome } from './providerPanelChrome';
import {
  advancedSettingsAtom,
  setAdvancedSettingsAtom,
  resetWalkthroughsAtom,
  developerFeatureSettingsAtom,
  setDeveloperFeatureSettingsAtom,
  externalEditorSettingsAtom,
  setExternalEditorSettingsAtom,
  DEVELOPER_FEATURES,
  areAllDeveloperFeaturesEnabled,
  enableAllDeveloperFeatures,
  disableAllDeveloperFeatures,
  debugFlagsAtom,
  setDebugFlagsAtom,
  type ReleaseChannel,
  type ExternalEditorType,
  type PreferredTerminalShell,
} from '../../../store/atoms/appSettings';
import {
  trackerAutomationAtom,
  setTrackerAutomationAtom,
} from '../../../store/atoms/trackerAutomationAtoms';
import {
  multiProjectModeAtom,
  openProjectsAtom,
  activeWorkspacePathAtom,
  restorePreviousProjectsAtom,
} from '../../../store/atoms/openProjects';

const chrome = createProviderPanelChrome({
  headerClassName: 'provider-panel-header advanced-panel-header',
  sectionClassName: 'provider-panel-section advanced-panel-section',
  configCardClassName: 'advanced-config-card',
  inputClassName: 'advanced-input',
  loadingClassName: 'advanced-loading',
  modelRowClassName: 'advanced-row',
  testButtonClassName: 'advanced-action-button',
  testErrorClassName: 'advanced-error',
  emptyClassName: 'advanced-empty',
});

const settingRowClass = 'setting-item py-[var(--an-spacing-sm)]';
const settingTextClass = 'setting-text flex min-w-0 flex-col gap-[var(--an-spacing-xxs)]';
const settingNameClass = 'setting-name text-sm font-medium text-[var(--an-foreground)]';
const settingDescriptionClass = 'setting-description text-xs leading-relaxed text-[var(--an-foreground-muted)]';
const settingLabelClass = 'setting-label flex cursor-pointer items-start gap-[var(--an-spacing-md)]';
const sectionBodyTextClass = 'text-sm leading-relaxed text-[var(--an-foreground-muted)]';
const selectClass =
  'rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-sm text-[var(--an-input-color)] outline-none transition-[background-color,border-color,color] duration-150 ease-out focus:border-[var(--an-input-focus-border)] focus:ring-2 focus:ring-[var(--an-focus-ring)]';
const compactCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-sm)] [--agent-elements-card-inline-padding:var(--an-spacing-md)]';
const codeCardClass =
  `agent-elements-tool-card ${compactCardPaddingClass} select-text overflow-x-auto font-mono text-xs text-[var(--an-foreground-muted)]`;
const modeCardBaseClass =
  'mode-option agent-elements-tool-card advanced-mode-card relative flex flex-1 cursor-pointer items-start border [--agent-elements-card-block-padding:0px] [--agent-elements-card-inline-padding:0px] transition-[background-color,border-color,color,opacity] duration-150 ease-out';
const modeCardSelectedClass =
  'selected border-[var(--an-primary-color)] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))]';
const modeCardDefaultClass =
  'border-[var(--an-border-color)] bg-[var(--an-background-secondary)] hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)]';
const statusPillClass =
  'rounded-[var(--an-small-border-radius)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)] text-xs font-medium';

/** Reusable compact dropdown row */
function DropdownRow({
  value,
  onChange,
  name,
  description,
  options,
  testId,
}: {
  value: string | number;
  onChange: (value: string) => void;
  name: string;
  description: string;
  options: { value: string | number; label: string }[];
  testId?: string;
}) {
  return (
    <div className={settingRowClass}>
      <div className="flex items-center justify-between gap-[var(--an-spacing-xl)]">
        <div className={settingTextClass}>
          <span className={settingNameClass}>{name}</span>
          <span className={settingDescriptionClass}>
            {description}
          </span>
        </div>
        <select
          data-testid={testId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`setting-select min-w-[11rem] flex-none ${selectClass}`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/**
 * AdvancedPanel - Self-contained settings panel for advanced options.
 *
 * All settings subscribe directly to Jotai atoms or load via IPC.
 * Developer mode is a global app setting.
 */
export function AdvancedPanel() {
  const posthog = usePostHog();
  // App-level advanced settings from Jotai atoms
  const [settings] = useAtom(advancedSettingsAtom);
  const [, updateSettings] = useAtom(setAdvancedSettingsAtom);
  const [, resetWalkthroughs] = useAtom(resetWalkthroughsAtom);

  // Current enhanced PATH (fetched from main process)
  const [enhancedPath, setEnhancedPath] = useState<string>('');
  const [showEnhancedPath, setShowEnhancedPath] = useState(false);
  const [availableTerminalShells, setAvailableTerminalShells] = useState<Array<{
    name: string;
    path: string;
    provider?: string;
    bootstrapMode?: 'zsh' | 'bash' | 'powershell' | 'none';
    cwdMode?: 'native' | 'wsl';
  }>>([]);

  // Developer feature settings from Jotai atoms
  const [developerSettings] = useAtom(developerFeatureSettingsAtom);
  const [, updateDeveloperSettings] = useAtom(setDeveloperFeatureSettingsAtom);
  const { developerMode, developerFeatures } = developerSettings;

  // Debug flags (verbose logging toggles, off by default)
  const debugFlags = useAtomValue(debugFlagsAtom);
  const updateDebugFlags = useSetAtom(setDebugFlagsAtom);

  // Tracker automation settings
  const trackerAutomation = useAtomValue(trackerAutomationAtom);
  const setTrackerAutomation = useSetAtom(setTrackerAutomationAtom);

  // External editor settings from Jotai atoms
  const [externalEditorSettings] = useAtom(externalEditorSettingsAtom);
  const [, updateExternalEditorSettings] = useAtom(setExternalEditorSettingsAtom);
  const { editorType: externalEditorType, customPath: externalEditorCustomPath } = externalEditorSettings;

  // Handle developer mode change
  const handleDeveloperModeChange = async (enabled: boolean) => {
    updateDeveloperSettings({ developerMode: enabled });

    // Track mode change in PostHog
    if (posthog) {
      posthog.capture('developer_mode_changed', {
        developer_mode: enabled,
        source: 'settings',
        is_initial: false,
      });

      // Update person property
      posthog.people.set({ developer_mode: enabled });
    }
  };

  const {
    releaseChannel,
    analyticsEnabled,
    extensionDevToolsEnabled,
    walkthroughsEnabled,
    walkthroughsViewedCount,
    walkthroughsTotalCount,
    maxHeapSizeMB,
    customPathDirs,
    spellcheckEnabled,
    historyMaxAgeDays,
    historyMaxSnapshots,
    preferredTerminalShell,
  } = settings;
  const [showFeaturesMenu, setShowFeaturesMenu] = useState(false);

  // Fetch enhanced PATH when user clicks to show it
  useEffect(() => {
    if (showEnhancedPath && !enhancedPath) {
      window.electronAPI.environment.getEnhancedPath().then(setEnhancedPath);
    }
  }, [showEnhancedPath, enhancedPath]);

  // Refresh enhanced PATH when custom paths change
  useEffect(() => {
    if (showEnhancedPath) {
      window.electronAPI.environment.getEnhancedPath().then(setEnhancedPath);
    }
  }, [customPathDirs, showEnhancedPath]);

  useEffect(() => {
    if (process.platform !== 'win32') {
      return;
    }

    window.electronAPI.terminal.getAvailableShells()
      .then((shells) => setAvailableTerminalShells(shells ?? []))
      .catch((error) => {
        console.error('[AdvancedPanel] Failed to load terminal shells:', error);
        setAvailableTerminalShells([]);
      });
  }, []);

  const terminalShellOptions: Array<{ value: PreferredTerminalShell; label: string }> = [
    { value: 'auto', label: 'Auto (Recommended)' },
  ];
  const seenShellProviders = new Set<PreferredTerminalShell>();
  for (const shell of availableTerminalShells) {
    const provider = shell.provider as PreferredTerminalShell | undefined;
    if (!provider || provider === 'auto' || seenShellProviders.has(provider)) {
      continue;
    }
    seenShellProviders.add(provider);
    const label = shell.name === provider
      ? `${shell.name} (${shell.path})`
      : `${shell.name} [${provider}] (${shell.path})`;
    terminalShellOptions.push({ value: provider, label });
  }

  const handleModeClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      setShowFeaturesMenu(prev => !prev);
    }
  };

  return (
    <div
      className="provider-panel advanced-panel agent-elements-settings-panel agent-elements-advanced-panel flex flex-col"
      data-agent-elements-shell="advanced-panel"
      data-testid="agent-elements-advanced-panel"
    >
      <div
        className={chrome.header}
        data-testid="agent-elements-advanced-header"
      >
        <h3 className={chrome.title}>
          Advanced Settings
        </h3>
        <p className={chrome.description}>
          Advanced configuration options for AI features.
        </p>
      </div>

      {/* Application Mode - Always shown at the top */}
      <div
        className={chrome.section}
        data-section="application-mode"
        data-testid="agent-elements-advanced-mode-section"
      >
          <h4 className={chrome.sectionTitle} onClick={handleModeClick}>Application Mode</h4>
          <p className={`${sectionBodyTextClass} mb-[var(--an-spacing-lg)]`}>
            Choose between a simplified experience or full developer features for this project.
          </p>

          <div className="mode-selection flex flex-row gap-[var(--an-spacing-lg)]">
            <label
              className={`${modeCardBaseClass} ${
                !developerMode
                  ? modeCardSelectedClass
                  : modeCardDefaultClass
              }`}
              data-testid="agent-elements-advanced-standard-mode-card"
              onClick={() => handleDeveloperModeChange(false)}
            >
              <input
                type="radio"
                name="mode"
                checked={!developerMode}
                onChange={() => handleDeveloperModeChange(false)}
                className="absolute right-[var(--an-spacing-lg)] top-[var(--an-spacing-lg)] m-0 h-[18px] w-[18px] cursor-pointer accent-[var(--an-primary-color)]"
              />
              <div className="flex w-full flex-col items-center p-[var(--an-spacing-xxl)] text-center">
                <div className="mb-[var(--an-spacing-sm)] flex flex-col items-center gap-[var(--an-spacing-sm)]">
                  <span className="material-symbols-outlined text-[32px] text-[var(--an-primary-color)]">
                    edit_note
                  </span>
                  <span className="text-base font-semibold text-[var(--an-foreground)]">Standard Mode</span>
                </div>
                <p className="m-0 text-[13px] leading-snug text-[var(--an-foreground-muted)]">
                  Simplified interface focused on writing, editing, and AI assistance
                </p>
              </div>
            </label>

            <label
              className={`${modeCardBaseClass} ${
                developerMode
                  ? modeCardSelectedClass
                  : modeCardDefaultClass
              }`}
              data-testid="agent-elements-advanced-developer-mode-card"
              onClick={() => handleDeveloperModeChange(true)}
            >
              <input
                type="radio"
                name="mode"
                checked={developerMode}
                onChange={() => handleDeveloperModeChange(true)}
                className="absolute right-[var(--an-spacing-lg)] top-[var(--an-spacing-lg)] m-0 h-[18px] w-[18px] cursor-pointer accent-[var(--an-primary-color)]"
              />
              <div className="flex w-full flex-col items-center p-[var(--an-spacing-xxl)] text-center">
                <div className="mb-[var(--an-spacing-sm)] flex flex-col items-center gap-[var(--an-spacing-sm)]">
                  <span className="material-symbols-outlined text-[32px] text-[var(--an-primary-color)]">
                    terminal
                  </span>
                  <span className="text-base font-semibold text-[var(--an-foreground)]">Developer Mode</span>
                </div>
                <p className="m-0 text-[13px] leading-snug text-[var(--an-foreground-muted)]">
                  Full development environment with git worktrees, terminal access, development specific features
                </p>
              </div>
            </label>
          </div>
        </div>

      {/* Secret Features Menu - Cmd+Click on "Application Mode" title to show */}
      {showFeaturesMenu && (
        <div
          className={chrome.section}
          data-section="feature-availability"
          data-testid="agent-elements-advanced-feature-availability-section"
        >
          <h4 className={chrome.sectionTitle}>
            Feature Availability
          </h4>
          <p className={`${sectionBodyTextClass} mb-[var(--an-spacing-lg)]`}>
            See which features are available based on your current mode settings.
          </p>

          {/* Developer Features */}
          <div
            className={chrome.configCard}
            data-testid="agent-elements-advanced-feature-availability-card"
          >
            {/* "All Developer Features" master toggle */}
            <div className="setting-item mb-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)] pb-[var(--an-spacing-lg)]">
              <label className={settingLabelClass}>
                <input
                  type="checkbox"
                  checked={areAllDeveloperFeaturesEnabled(developerFeatures)}
                  onChange={(e) => {
                    const newFeatures = e.target.checked ? enableAllDeveloperFeatures() : disableAllDeveloperFeatures();
                    updateDeveloperSettings({ developerFeatures: newFeatures });
                  }}
                  disabled={!developerMode}
                  className={chrome.checkbox}
                />
                <div className={settingTextClass}>
                  <span className={settingNameClass}>All Developer Features</span>
                  <span className={settingDescriptionClass}>
                    Enable or disable all developer features at once
                  </span>
                </div>
              </label>
            </div>

            {/* Individual developer feature toggles */}
            {DEVELOPER_FEATURES.map((feature) => {
              const isAvailable = developerMode && developerFeatures[feature.tag];
              return (
                <div key={feature.tag} className={settingRowClass}>
                  <label className={settingLabelClass}>
                    <input
                      type="checkbox"
                      checked={developerFeatures[feature.tag]}
                      onChange={(e) => {
                        updateDeveloperSettings({
                          developerFeatures: {
                            ...developerFeatures,
                            [feature.tag]: e.target.checked,
                          },
                        });
                      }}
                      disabled={!developerMode}
                      className={chrome.checkbox}
                    />
                    <div className={settingTextClass}>
                      <span className={`${settingNameClass} flex items-center gap-[var(--an-spacing-sm)]`}>
                        {feature.icon && (
                          <span className="material-symbols-outlined text-sm">{feature.icon}</span>
                        )}
                        {feature.name}
                        <span
                          className={`${statusPillClass} ${
                            isAvailable
                              ? 'bg-[color-mix(in_srgb,var(--an-success-color)_12%,transparent)] text-[var(--an-success-color)]'
                              : 'bg-[color-mix(in_srgb,var(--an-error-color)_12%,transparent)] text-[var(--an-error-color)]'
                          }`}
                        >
                          {isAvailable ? 'Available' : 'Hidden'}
                        </span>
                      </span>
                      <span className={settingDescriptionClass}>{feature.description}</span>
                    </div>
                  </label>
                </div>
              );
            })}
          </div>

          <p className="mt-[var(--an-spacing-lg)] text-xs text-[var(--an-foreground-subtle)]">
            Developer mode: {developerMode ? 'ON' : 'OFF'}
          </p>
        </div>
      )}

      {/* Debug Logging */}
      <div
        className={chrome.section}
        data-section="debug-logging"
        data-testid="agent-elements-advanced-debug-section"
      >
        <h4 className={chrome.sectionTitle}>Debug Logging</h4>
        <p className={`${sectionBodyTextClass} mb-[var(--an-spacing-lg)]`}>
          Verbose tracing for internal subsystems. Off by default. Toggle on when reproducing a bug, then check the renderer console (Cmd+Opt+I).
        </p>

        <div className={settingRowClass} data-testid="debug-flag-diff-trace">
          <label className={settingLabelClass}>
            <input
              type="checkbox"
              checked={debugFlags.diffTrace ?? false}
              onChange={(e) => {
                void updateDebugFlags({ diffTrace: e.target.checked });
              }}
              className={chrome.checkbox}
            />
            <div className={settingTextClass}>
              <span className={settingNameClass}>Diff Trace</span>
              <span className={settingDescriptionClass}>
                Logs every step of the AI-edit / diff pipeline (DocumentModel, DiskBackedStore, TabEditor, DiffPlugin, file-change listeners).
                Filter the console for <code>[diff-trace]</code>.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Release Channel */}
      <div
        className={chrome.section}
        data-section="release-channel"
        data-testid="agent-elements-advanced-release-section"
      >
        <h4 className={chrome.sectionTitle}>Release Channel</h4>
        <p className={`${sectionBodyTextClass} mb-[var(--an-spacing-lg)]`}>
          Choose which release stream Nimbalyst pulls auto-updates from. Alpha and beta features are configured separately on each feature&apos;s settings page.
        </p>

        <div className="setting-item py-[var(--an-spacing-lg)]">
          <div className={settingTextClass}>
            <span className={settingNameClass}>Update Channel</span>
            <span className={settingDescriptionClass}>
              <strong>Stable:</strong> Production-ready releases (recommended for most users).<br/>
              <strong>Alpha:</strong> Frequent, rough developer releases. Expect bugs and breaking changes between updates.
            </span>
          </div>
          <select
            data-testid="agent-elements-advanced-release-select"
            value={releaseChannel}
            onChange={(e) => {
              const newChannel = e.target.value as ReleaseChannel;
              updateSettings({ releaseChannel: newChannel });
              posthog?.capture('release_channel_changed', {
                channel: newChannel,
              });
            }}
            className={`setting-select mt-[var(--an-spacing-sm)] w-full ${selectClass}`}
          >
            <option value="stable">Stable</option>
            <option value="alpha">Alpha (Developer Releases)</option>
          </select>
        </div>

        {releaseChannel === 'alpha' && (
          <div
            className={`advanced-release-warning agent-elements-tool-card mt-[var(--an-spacing-lg)] flex items-start gap-[var(--an-spacing-sm)] border-[color-mix(in_srgb,var(--an-warning-color)_32%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_10%,var(--an-background))] ${compactCardPaddingClass}`}
            data-testid="agent-elements-advanced-release-warning"
            data-tone="warning"
          >
            <MaterialSymbol icon="warning" size={16} className="mt-0.5 shrink-0 text-[var(--an-warning-color)]" />
            <p className="m-0 text-[13px] leading-snug text-[var(--an-foreground)]">
              The alpha channel ships rough developer releases that may be unstable or contain unfinished work. Switch back to Stable if you encounter problems.
            </p>
          </div>
        )}
      </div>

      {/* General */}
      <div
        className={chrome.section}
        data-section="general"
        data-testid="agent-elements-advanced-general-section"
      >
        <h4 className={chrome.sectionTitle}>General</h4>

        <MultiProjectModeToggle />

        <RestorePreviousProjectsToggle />

        <SettingsToggle
          checked={analyticsEnabled}
          onChange={(checked) => updateSettings({ analyticsEnabled: checked })}
          name="Send Anonymous Usage Data"
          description="Help improve Nimbalyst by sending anonymous usage data. No prompts or personal info collected."
        />

        <SettingsToggle
          checked={spellcheckEnabled}
          onChange={(checked) => updateSettings({ spellcheckEnabled: checked })}
          name="Spellcheck"
          description="Enable the system spellchecker in editors and text inputs."
        />

        <SettingsToggle
          checked={walkthroughsEnabled}
          onChange={(checked) => updateSettings({ walkthroughsEnabled: checked })}
          name="Show Feature Guides"
          description={`Walkthrough guides for new features and tips.${walkthroughsTotalCount > 0 ? ` (${walkthroughsViewedCount}/${walkthroughsTotalCount} viewed)` : ''}`}
        />

        {walkthroughsViewedCount > 0 && (
          <div className="py-[var(--an-spacing-xs)] pl-[calc(var(--an-spacing-xxl)+var(--an-spacing-sm))]">
            <button onClick={() => resetWalkthroughs()} className={`${chrome.secondaryButton} text-xs`}>
              Reset All Guides
            </button>
          </div>
        )}
      </div>

      {/* Tracker Automation */}
      <div
        className={chrome.section}
        data-agent-elements-shell="advanced-tracker-section"
        data-section="tracker-automation"
        data-testid="tracker-automation-section"
      >
        <HelpTooltip testId="tracker-automation-section">
          <h4 className={`${chrome.sectionTitle} inline-block`}>Tracker Automation</h4>
        </HelpTooltip>

        <SettingsToggle
          checked={trackerAutomation.enabled}
          onChange={(checked) => setTrackerAutomation({ enabled: checked })}
          name="Link Commits to Tracker Items"
          description="Link git commits to tracker items via session relationships and issue key parsing (e.g. NIM-123 in commit messages)."
        />

        {trackerAutomation.enabled && (
          <SettingsToggle
            checked={trackerAutomation.autoCloseOnCommit}
            onChange={(checked) => setTrackerAutomation({ autoCloseOnCommit: checked })}
            name="Close Items on Fixes/Closes/Resolves"
            description="Change tracker item status to done when a commit message uses a closing keyword."
          />
        )}
      </div>

      {/* Tools & Environment */}
      <div
        className={chrome.section}
        data-section="tools-environment"
        data-testid="agent-elements-advanced-tools-section"
      >
        <h4 className={chrome.sectionTitle}>Tools & Environment</h4>

        <DropdownRow
          value={externalEditorType}
          onChange={(val) => updateExternalEditorSettings({ editorType: val as ExternalEditorType })}
          name="External Editor"
          description="Editor for the 'Open in...' context menu option."
          testId="agent-elements-advanced-external-editor-select"
          options={[
            { value: 'none', label: 'None' },
            { value: 'vscode', label: 'VS Code' },
            { value: 'cursor', label: 'Cursor' },
            { value: 'webstorm', label: 'WebStorm' },
            { value: 'sublime', label: 'Sublime Text' },
            { value: 'vim', label: 'Vim (Terminal)' },
            { value: 'nvim', label: 'Neovim (Terminal)' },
            { value: 'custom', label: 'Custom...' },
          ]}
        />

        {externalEditorType === 'custom' && (
          <div className="py-[var(--an-spacing-sm)] pl-[calc(var(--an-spacing-xxl)+var(--an-spacing-sm))]">
            <input
              type="text"
              value={externalEditorCustomPath || ''}
              onChange={(e) => updateExternalEditorSettings({ customPath: e.target.value })}
              placeholder={process.platform === 'win32' ? 'C:\\Program Files\\Editor\\editor.exe' : '/usr/local/bin/myeditor'}
              className={`${chrome.input} w-full`}
            />
          </div>
        )}

        <SettingsToggle
          checked={extensionDevToolsEnabled}
          onChange={(checked) => updateSettings({ extensionDevToolsEnabled: checked })}
          name="Extension Dev Tools"
          description="Enable MCP tools for building, installing, and hot-reloading extensions."
        />

        <DropdownRow
          value={maxHeapSizeMB}
          onChange={(val) => updateSettings({ maxHeapSizeMB: parseInt(val, 10) })}
          name="Max Heap Size"
          description="V8 memory limit. Increase if you get out-of-memory crashes. Requires restart."
          options={[
            { value: 2048, label: '2 GB' },
            { value: 4096, label: '4 GB (Default)' },
            { value: 6144, label: '6 GB' },
            { value: 8192, label: '8 GB' },
            { value: 12288, label: '12 GB' },
            { value: 16384, label: '16 GB' },
          ]}
        />

        {process.platform === 'win32' && (
          <>
            <DropdownRow
              value={preferredTerminalShell}
              onChange={(val) => updateSettings({ preferredTerminalShell: val as PreferredTerminalShell })}
              name="Preferred Terminal Shell"
              description="Choose which detected Windows shell new terminals should open with. Auto follows the built-in priority."
              options={terminalShellOptions}
            />

            <div className={settingRowClass}>
              <div className={`${settingTextClass} mb-[var(--an-spacing-sm)]`}>
                <span className={settingNameClass}>Detected Terminal Shells</span>
                <span className={settingDescriptionClass}>
                  Current Windows shell discovery results used for terminal selection and restore.
                </span>
              </div>

              <div className={codeCardClass}>
                {availableTerminalShells.length === 0 ? (
                  <div>No supported terminal shells detected.</div>
                ) : (
                  availableTerminalShells.map((shell) => (
                    <div key={`${shell.provider || shell.name}-${shell.path}`} className="break-all py-[var(--an-spacing-xxs)]">
                      {`${shell.provider || shell.name} | ${shell.path} | bootstrap=${shell.bootstrapMode || 'none'} | cwd=${shell.cwdMode || 'native'}`}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        <DropdownRow
          value={historyMaxAgeDays}
          onChange={(val) => updateSettings({ historyMaxAgeDays: parseInt(val, 10) })}
          name="History Retention"
          description="Max age of file history snapshots before automatic cleanup."
          options={[
            { value: 7, label: '7 days' },
            { value: 14, label: '14 days' },
            { value: 30, label: '30 days (Default)' },
            { value: 60, label: '60 days' },
            { value: 90, label: '90 days' },
            { value: 180, label: '180 days' },
            { value: 365, label: '1 year' },
          ]}
        />

        <DropdownRow
          value={historyMaxSnapshots}
          onChange={(val) => updateSettings({ historyMaxSnapshots: parseInt(val, 10) })}
          name="Max Snapshots Per File"
          description="Oldest snapshots beyond this limit are deleted."
          options={[
            { value: 50, label: '50' },
            { value: 100, label: '100' },
            { value: 250, label: '250 (Default)' },
            { value: 500, label: '500' },
            { value: 1000, label: '1,000' },
          ]}
        />

        {/* Custom PATH */}
        <div className={settingRowClass}>
          <div className={`${settingTextClass} mb-[var(--an-spacing-sm)]`}>
            <span className={settingNameClass}>Custom PATH Directories</span>
            <span className={settingDescriptionClass}>
              Additional directories for MCP server installation, CLI tool detection, and agent SDK operations.
            </span>
          </div>
          <textarea
            value={customPathDirs}
            onChange={(e) => updateSettings({ customPathDirs: e.target.value })}
            placeholder={process.platform === 'win32'
              ? 'C:\\MyTools;C:\\Programs\\bin'
              : '/opt/mytools/bin:/usr/local/custom/bin'}
            rows={2}
            className={`${chrome.input} w-full resize-none`}
          />
          <div className="mt-[var(--an-spacing-xs)]">
            <button
              data-testid="agent-elements-advanced-show-path"
              onClick={() => setShowEnhancedPath(!showEnhancedPath)}
              className="cursor-pointer border-0 bg-transparent p-0 text-xs text-[var(--an-primary-color)] underline-offset-2 transition-colors duration-150 ease-out hover:text-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]"
            >
              {showEnhancedPath ? 'Hide current PATH' : 'Show current PATH'}
            </button>

            {showEnhancedPath && enhancedPath && (
              <div className="mt-[var(--an-spacing-sm)]">
                <div
                  className={`advanced-path-output ${codeCardClass}`}
                  data-testid="agent-elements-advanced-path-output"
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    wordBreak: 'break-all',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {enhancedPath.split(process.platform === 'win32' ? ';' : ':').map((p, index) => (
                    <div key={index} className="py-[var(--an-spacing-xxs)]">
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

/**
 * Toggle for the multi-project rail. When the user disables it with
 * inactive warm projects in the rail, those projects' main-process
 * services are released and the rail collapses to just the active
 * project so state stays consistent.
 */
function MultiProjectModeToggle() {
  const [enabled, setEnabled] = useAtom(multiProjectModeAtom);
  const [openProjects, setOpenProjects] = useAtom(openProjectsAtom);
  const activePath = useAtomValue(activeWorkspacePathAtom);

  const handleChange = async (next: boolean) => {
    if (!next && openProjects.length > 1) {
      const proceed = window.confirm(
        `${openProjects.length} projects are open in the rail. Disable multi-project mode? The other projects will be closed (their unsaved work stays on disk).`
      );
      if (!proceed) return;

      // Release services for every non-active path before collapsing the
      // rail. The main process refcounts services across windows, so this
      // only frees them when no other window references the path.
      const inactivePaths = openProjects
        .filter((p) => p.path !== activePath)
        .map((p) => p.path);
      await Promise.all(
        inactivePaths.map((path) =>
          window.electronAPI?.invoke?.('workspace:unregister-additional', { workspacePath: path })
            .catch((err: unknown) => {
              console.error('[AdvancedPanel] unregister-additional failed for', path, err);
            })
        )
      );

      const remaining = openProjects.filter((p) => p.path === activePath);
      setOpenProjects(remaining);
    }
    setEnabled(next);
  };

  return (
    <SettingsToggle
      checked={enabled}
      onChange={handleChange}
      name="Multi-project Mode"
      description="Open multiple projects in a single window via a project rail. When off, each project opens in its own window."
    />
  );
}

/**
 * Toggle for re-opening last session's rail projects on launch. Default
 * off so a normal launch from the project picker opens just the picked
 * project; warm rail projects must be added explicitly via the rail's
 * `+` button.
 */
function RestorePreviousProjectsToggle() {
  const [enabled, setEnabled] = useAtom(restorePreviousProjectsAtom);
  const isMultiProject = useAtomValue(multiProjectModeAtom);

  return (
    <SettingsToggle
      checked={enabled}
      onChange={setEnabled}
      name="Restore last session's projects on launch"
      description={
        isMultiProject
          ? 'When on, the project rail rehydrates with every project that was open at last close. When off, only the project you pick from the launch screen opens.'
          : 'Only takes effect when Multi-project Mode is enabled.'
      }
    />
  );
}
