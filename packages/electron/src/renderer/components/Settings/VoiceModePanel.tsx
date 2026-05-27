/**
 * Voice Mode Settings Panel
 *
 * Self-contained component that subscribes directly to Jotai atoms.
 * No props needed - settings are read from and written to atoms.
 */

import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { ModelIdentifier } from '@nimbalyst/runtime/ai/server/types';
import {
  voiceModeSettingsAtom,
  setVoiceModeSettingsAtom,
  apiKeysAtom,
  setApiKeyAtom,
  defaultAgentModelAtom,
  type VoiceModeSettings,
  type VoiceId,
  type TurnDetectionConfig,
  type SystemPromptConfig,
} from '../../store/atoms/appSettings';
import { voiceModePreviewAudioAtom } from '../../store/atoms/voiceModeState';
import { addSessionFullAtom, setSelectedWorkstreamAtom, setWindowModeAtom, navigateToSettingsAtom } from '../../store';
import { useDialog } from '../../contexts/DialogContext';
import { AlphaBadge, SETTINGS_ALPHA_TOOLTIP } from '../common/AlphaBadge';
import { SettingsToggle } from '../GlobalSettings/SettingsToggle';
import { createProviderPanelChrome } from '../GlobalSettings/panels/providerPanelChrome';
import { buildVoiceProjectSummaryPrompt, VOICE_PROJECT_SUMMARY_PATH } from './voiceModeSummaryPrompt';
import type { SessionCreateResult } from '../../../shared/ipc/types';

interface VoiceModePanelProps {
  /** Optional workspace path for project-specific features like summary generation */
  workspacePath?: string;
}

// Default turn detection config
const DEFAULT_TURN_DETECTION: TurnDetectionConfig = {
  mode: 'server_vad',
  vadThreshold: 0.5,
  silenceDuration: 500,
  interruptible: true,
};

// Available OpenAI Realtime API voices with descriptions
// Some voices are Realtime-only and use approximations for TTS preview
// Gender categorization based on OpenAI documentation and community observations
const VOICE_OPTIONS: Array<{
  id: string;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  realtimeOnly?: boolean; // If true, preview uses a similar voice approximation
}> = [
  // Male voices
  { id: 'ash', name: 'Ash', description: 'Clear and confident', gender: 'male' },
  { id: 'echo', name: 'Echo', description: 'Smooth and resonant', gender: 'male' },
  { id: 'verse', name: 'Verse', description: 'Dynamic and engaging', gender: 'male', realtimeOnly: true },
  { id: 'cedar', name: 'Cedar', description: 'Deep and authoritative', gender: 'male', realtimeOnly: true },
  // Female voices
  { id: 'coral', name: 'Coral', description: 'Warm and friendly', gender: 'female' },
  { id: 'sage', name: 'Sage', description: 'Thoughtful and calm', gender: 'female' },
  { id: 'shimmer', name: 'Shimmer', description: 'Bright and cheerful', gender: 'female' },
  { id: 'ballad', name: 'Ballad', description: 'Melodic and expressive', gender: 'female', realtimeOnly: true },
  { id: 'marin', name: 'Marin', description: 'Natural and conversational', gender: 'female', realtimeOnly: true },
  // Neutral voices
  { id: 'alloy', name: 'Alloy', description: 'Balanced and versatile', gender: 'neutral' },
];

// Group voices by gender for the dropdown
const VOICE_GROUPS = [
  { label: 'Male', voices: VOICE_OPTIONS.filter(v => v.gender === 'male') },
  { label: 'Female', voices: VOICE_OPTIONS.filter(v => v.gender === 'female') },
  { label: 'Neutral', voices: VOICE_OPTIONS.filter(v => v.gender === 'neutral') },
];

type MicAccessStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown';

const chrome = createProviderPanelChrome({
  headerClassName: 'provider-panel-header voice-mode-header',
  sectionClassName: 'provider-panel-section voice-mode-section',
  configCardClassName: 'voice-mode-card',
  inputClassName: 'voice-mode-input',
  loadingClassName: 'voice-mode-loading',
  modelRowClassName: 'voice-mode-row',
  testButtonClassName: 'voice-mode-button',
  testErrorClassName: 'voice-mode-error',
  emptyClassName: 'voice-mode-empty',
});

const settingItemClass = 'setting-item py-[var(--an-spacing-md)]';
const settingItemSpacedClass = `${settingItemClass} mb-[var(--an-spacing-lg)]`;
const settingTextClass = 'setting-text flex flex-col gap-[var(--an-spacing-xxs)]';
const settingNameClass = 'setting-name text-sm font-medium text-[var(--an-foreground)]';
const settingDescriptionClass = 'setting-description text-xs text-[var(--an-foreground-muted)]';
const controlRowClass =
  'mt-[var(--an-spacing-sm)] flex items-center gap-[var(--an-spacing-sm)]';
const rangeRowClass =
  'mt-[var(--an-spacing-sm)] flex items-center gap-[var(--an-spacing-md)]';
const rangeLabelClass = 'text-xs text-[var(--an-foreground-muted)]';
const rangeValueClass = 'min-w-[50px] text-xs text-[var(--an-foreground)]';
const selectClass =
  'rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-sm text-[var(--an-input-color)] outline-none transition-[background-color,border-color,color] duration-150 ease-out focus:border-[var(--an-input-focus-border)] focus:ring-2 focus:ring-[var(--an-focus-ring)]';
const textareaClass =
  'mt-[var(--an-spacing-sm)] min-h-[80px] w-full resize-y rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-sm text-[var(--an-input-color)] outline-none transition-[background-color,border-color,color] duration-150 ease-out placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-border)] focus:ring-2 focus:ring-[var(--an-focus-ring)]';
const hintClass = 'provider-panel-hint text-sm text-[var(--an-foreground-muted)]';
const hintSmallClass = 'provider-panel-hint text-xs text-[var(--an-foreground-muted)]';
const primaryButtonClass = `${chrome.primaryButton} gap-[var(--an-spacing-sm)]`;
const secondaryButtonClass = `${chrome.secondaryButton} gap-[var(--an-spacing-xs)]`;
const warningCardClass =
  `${chrome.configCard} voice-mode-mic-permission-warning provider-panel-section agent-elements-settings-section mb-[var(--an-spacing-xxl)] border-[color-mix(in_srgb,var(--an-warning-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_10%,var(--an-background))]`;
const warningIconClass =
  'mt-[var(--an-spacing-xxs)] text-[var(--an-warning-color)]';
const summaryCardClass =
  `${chrome.configCard} voice-mode-project-summary provider-panel-section agent-elements-settings-section mb-[var(--an-spacing-xxl)]`;
const summaryStatusRowClass =
  'flex flex-wrap items-center gap-[var(--an-spacing-sm)] text-sm';
const successIconClass = 'text-[var(--an-success-color)]';
const mutedTextClass = 'text-[var(--an-foreground-muted)]';
const inlineCodeClass =
  'rounded-[var(--an-radius-xs)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xs)] py-[var(--an-spacing-xxs)] text-xs text-[var(--an-code-color)]';
const linkButtonClass =
  'cursor-pointer border-0 bg-transparent p-0 text-[var(--an-primary-color)] underline underline-offset-2 hover:text-[color-mix(in_srgb,var(--an-primary-color)_76%,var(--an-foreground))]';
const promptDisclosureClass = (isOpen: boolean, closedClass = 'mb-[var(--an-spacing-xl)]') =>
  `flex cursor-pointer items-center gap-[var(--an-spacing-sm)] border-0 bg-transparent p-0 text-sm font-medium text-[var(--an-foreground)] transition-[color] duration-150 ease-out hover:text-[var(--an-primary-color)] ${
    isOpen ? 'mb-[var(--an-spacing-md)]' : closedClass
  }`;
const promptInsetClass = 'mb-[var(--an-spacing-xxl)] pl-[calc(var(--an-spacing-xxl)+var(--an-spacing-lg))]';
const promptInsetLastClass = 'pl-[calc(var(--an-spacing-xxl)+var(--an-spacing-lg))]';
const listClass =
  'mb-[var(--an-spacing-sm)] ml-[var(--an-spacing-xl)] mt-[var(--an-spacing-sm)] list-disc text-sm text-[var(--an-foreground-muted)]';
const errorTextClass = 'mt-[var(--an-spacing-sm)] text-xs text-[var(--an-error-color)]';

export const VoiceModePanel: React.FC<VoiceModePanelProps> = ({
  workspacePath,
}) => {
  // Subscribe to atoms directly - no props needed
  const [voiceModeSettings] = useAtom(voiceModeSettingsAtom);
  const [, updateVoiceModeSettings] = useAtom(setVoiceModeSettingsAtom);
  const apiKeys = useAtomValue(apiKeysAtom);
  const [, setApiKey] = useAtom(setApiKeyAtom);
  const defaultAgentModel = useAtomValue(defaultAgentModelAtom);
  const addSession = useSetAtom(addSessionFullAtom);
  const setSelectedWorkstream = useSetAtom(setSelectedWorkstreamAtom);
  const setWindowMode = useSetAtom(setWindowModeAtom);
  const navigateToSettings = useSetAtom(navigateToSettingsAtom);
  const dialog = useDialog();
  const hasAgentConfigured = !!defaultAgentModel?.trim();

  // Extract values from atom
  const {
    enabled,
    voice,
    turnDetection,
    voiceAgentPrompt,
    codingAgentPrompt,
    submitDelayMs,
    listenWindowMs,
  } = voiceModeSettings;

  // Check if OpenAI key is configured
  const hasOpenAIKey = !!apiKeys.openai;

  // Handler to update any voice mode setting
  const handleSettingChange = React.useCallback((updates: Partial<VoiceModeSettings>) => {
    updateVoiceModeSettings(updates);
  }, [updateVoiceModeSettings]);

  const [showVoiceAgentPrompt, setShowVoiceAgentPrompt] = React.useState(false);
  const [showCodingAgentPrompt, setShowCodingAgentPrompt] = React.useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Project summary state. Generation now happens inside an agent session, so
  // there's no in-panel spinner -- we only track whether the file exists on
  // disk and surface failure messages from the launch path.
  const [projectSummaryExists, setProjectSummaryExists] = React.useState<boolean | null>(null);
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [summaryPath, setSummaryPath] = React.useState<string | null>(null);

  // Microphone access state. Only populated while voice mode is enabled --
  // we don't probe the OS at all when voice is off, so a user who never opts
  // in never has the mic permission concept surfaced.
  const [micStatus, setMicStatus] = React.useState<MicAccessStatus | null>(null);
  const [micPlatform, setMicPlatform] = React.useState<NodeJS.Platform | null>(null);

  const checkMicStatus = React.useCallback(async () => {
    try {
      const result = await window.electronAPI?.invoke('voice-mode:get-mic-status') as
        | { status: MicAccessStatus; platform: NodeJS.Platform }
        | undefined;
      if (result) {
        setMicStatus(result.status);
        setMicPlatform(result.platform);
      }
    } catch {
      setMicStatus(null);
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      setMicStatus(null);
      return;
    }
    checkMicStatus();
  }, [enabled, checkMicStatus]);

  const handleOpenMicSettings = async () => {
    await window.electronAPI?.invoke('voice-mode:open-mic-settings');
  };

  // Check if project summary exists
  React.useEffect(() => {
    if (!workspacePath) {
      setProjectSummaryExists(null);
      return;
    }

    const checkSummary = async () => {
      try {
        const path = `${workspacePath}/${VOICE_PROJECT_SUMMARY_PATH}`;
        const exists = await window.electronAPI?.invoke('file:exists', path);
        setProjectSummaryExists(exists);
        if (exists) {
          setSummaryPath(path);
        }
      } catch {
        setProjectSummaryExists(false);
      }
    };

    checkSummary();
  }, [workspacePath]);

  // Launch an agent session that generates the voice-mode project summary.
  // The agent reads project files itself and writes the summary to
  // nimbalyst-local/voice-project-summary.md via its Write tool. Voice mode
  // picks up the file on next session start (see VoiceModeService.ts loadSessionContext).
  const handleGenerateSummary = async () => {
    if (!workspacePath || !window.electronAPI) return;
    if (!hasAgentConfigured) return;

    setSummaryError(null);

    const parsed = ModelIdentifier.tryParse(defaultAgentModel);
    const provider = parsed?.provider || 'claude-code';

    const confirmed = await dialog.confirm({
      title: 'Generate project summary?',
      message:
        `This will launch a new AI session using ${defaultAgentModel}. ` +
        `The session will read your project files and write a voice-friendly ` +
        `summary to ${VOICE_PROJECT_SUMMARY_PATH}, which voice mode uses for ` +
        `context. You'll be taken to the session so you can watch it run.`,
      confirmLabel: 'Launch session',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    try {
      const sessionId = crypto.randomUUID();
      const title = 'Voice mode: project summary';
      const result: SessionCreateResult = await window.electronAPI.invoke('sessions:create', {
        session: {
          id: sessionId,
          provider,
          model: defaultAgentModel,
          title,
        },
        workspaceId: workspacePath,
      });

      if (!result?.success || !result.id) {
        setSummaryError(result?.error || 'Failed to create agent session');
        return;
      }

      addSession({
        id: result.id,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        provider,
        model: defaultAgentModel,
        sessionType: 'session',
        messageCount: 0,
        workspaceId: workspacePath,
        isArchived: false,
        isPinned: false,
        parentSessionId: null,
        worktreeId: null,
        childCount: 0,
        uncommittedCount: 0,
      });

      // Send the first message -- this kicks off agent execution.
      await window.electronAPI.invoke(
        'ai:sendMessage',
        buildVoiceProjectSummaryPrompt(),
        undefined,
        result.id,
        workspacePath,
      );

      // Switch to Agent mode and select the new session so the user can watch it run.
      // Switching modes implicitly unmounts the Settings view -- no explicit close needed.
      setWindowMode('agent');
      setSelectedWorkstream({
        workspacePath,
        selection: { type: 'session', id: result.id },
      });
    } catch (error) {
      console.error('[VoiceModePanel] Failed to launch summary session:', error);
      setSummaryError(error instanceof Error ? error.message : 'Failed to launch summary session');
    }
  };

  // Open summary file in editor
  const handleOpenSummary = async () => {
    if (summaryPath && workspacePath) {
      await window.electronAPI?.invoke('workspace:open-file', { workspacePath, filePath: summaryPath });
    }
  };

  // Toggle voice mode. We no longer auto-launch a summary session here --
  // generating the summary spawns a visible agent session that costs tokens,
  // so it must be an explicit user action.
  const handleEnabledChange = (newEnabled: boolean) => {
    handleSettingChange({ enabled: newEnabled });
  };

  // Listen for preview audio from main process
  // Stop any playing audio on unmount.
  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Play preview audio when main process broadcasts a `voice-mode:preview-audio`
  // event. The IPC event is handled centrally in
  // store/listeners/voiceModeListeners.ts which writes voiceModePreviewAudioAtom;
  // we play only on *new* bumps so any audio that was queued up before this
  // panel mounted doesn't replay on open.
  const previewAudio = useAtomValue(voiceModePreviewAudioAtom);
  const initialPreviewAudioRef = React.useRef(previewAudio);
  React.useEffect(() => {
    if (previewAudio === initialPreviewAudioRef.current) return;
    if (!previewAudio) return;
    const { audioBase64, format } = previewAudio.payload;
    const audio = new Audio(`data:audio/${format};base64,${audioBase64}`);
    audioRef.current = audio;
    setIsPreviewPlaying(true);

    audio.onended = () => {
      setIsPreviewPlaying(false);
      audioRef.current = null;
    };

    audio.onerror = () => {
      setIsPreviewPlaying(false);
      audioRef.current = null;
    };

    audio.play().catch(() => {
      setIsPreviewPlaying(false);
      audioRef.current = null;
    });
  }, [previewAudio]);

  // Use defaults for turn detection
  const currentTurnDetection = { ...DEFAULT_TURN_DETECTION, ...turnDetection };

  const handleTurnDetectionChange = (updates: Partial<TurnDetectionConfig>) => {
    handleSettingChange({ turnDetection: { ...currentTurnDetection, ...updates } });
  };

  const handlePreviewVoice = async () => {
    if (isPreviewPlaying) {
      // Stop current preview
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPreviewPlaying(false);
      return;
    }

    setIsPreviewPlaying(true);
    try {
      const result = await window.electronAPI?.invoke('voice-mode:preview-voice', voice);
      if (!result?.success) {
        console.error('[VoiceModePanel] Preview failed:', result?.message);
        setIsPreviewPlaying(false);
      }
      // Audio will be received via IPC and played automatically
    } catch (error) {
      console.error('[VoiceModePanel] Preview error:', error);
      setIsPreviewPlaying(false);
    }
  };
  return (
    <div
      className="provider-panel agent-elements-settings-panel agent-elements-voice-mode-panel flex flex-col"
      data-agent-elements-shell="voice-mode-panel"
      data-component="VoiceModePanel"
      data-testid="agent-elements-voice-mode-panel"
    >
      <div
        className={chrome.header}
        data-agent-elements-shell="voice-mode-header"
        data-testid="agent-elements-voice-mode-header"
      >
        <h3 className={`${chrome.title} flex items-center gap-[var(--an-spacing-sm)]`}>
          Voice Mode
          <AlphaBadge size="sm" tooltip={SETTINGS_ALPHA_TOOLTIP} />
        </h3>
        <p className={chrome.description}>
          Use OpenAI's Advanced Voice Mode to control Claude Code with your voice.
          Speak naturally to give commands, and receive spoken responses.
        </p>
      </div>

      <div
        className={chrome.section}
        data-agent-elements-shell="voice-mode-section"
        data-section="enable"
        data-testid="agent-elements-voice-mode-enable-section"
      >
        <h4 className={chrome.sectionTitle}>Enable Voice Mode</h4>

        <div className={settingItemSpacedClass}>
          <div className={settingTextClass}>
            <span className={settingNameClass}>OpenAI API Key</span>
            <span className={settingDescriptionClass}>
              Required for Voice Mode. Get one from platform.openai.com.
            </span>
          </div>
          <input
            type="password"
            value={apiKeys.openai || ''}
            onChange={(e) => setApiKey({ keyName: 'openai', value: e.target.value })}
            onFocus={(e) => e.target.select()}
            placeholder="sk-..."
            className={`${chrome.input} mt-[var(--an-spacing-sm)] w-full text-sm`}
          />
        </div>

        <SettingsToggle
          checked={enabled}
          onChange={handleEnabledChange}
          disabled={!hasOpenAIKey}
          name="Show Voice Mode Button"
          description="Display the microphone button in the AI input area"
        />
      </div>

      {enabled && hasOpenAIKey && micStatus && micStatus !== 'granted' && (
        <div
          className={warningCardClass}
          data-agent-elements-shell="voice-mode-mic-warning"
          data-tone="warning"
          data-testid="voice-mode-mic-permission-warning"
        >
          <div
            className="flex items-start gap-[var(--an-spacing-md)]"
            data-tone="warning"
            data-testid="agent-elements-voice-mode-mic-warning"
          >
            <MaterialSymbol icon="mic_off" size={20} className={warningIconClass} />
            <div className="flex-1">
              <h4 className={`${settingNameClass} mb-[var(--an-spacing-xs)]`}>Microphone access not granted</h4>
              <p className={`${hintSmallClass} mb-[var(--an-spacing-lg)]`}>
                {micStatus === 'denied'
                  ? 'Voice Mode needs microphone access. Enable it for Nimbalyst in System Settings, then re-check below.'
                  : micStatus === 'restricted'
                  ? 'Microphone access is restricted on this device (e.g. by parental controls or MDM). Voice Mode cannot capture audio.'
                  : 'Voice Mode needs microphone access. Open System Settings to grant it for Nimbalyst.'}
              </p>
              <div className="flex items-center gap-[var(--an-spacing-sm)]">
                {micPlatform === 'darwin' && (
                  <button
                    onClick={handleOpenMicSettings}
                    className={primaryButtonClass}
                    data-testid="voice-mode-open-mic-settings"
                  >
                    <MaterialSymbol icon="open_in_new" size={14} />
                    Open System Settings
                  </button>
                )}
                <button
                  onClick={checkMicStatus}
                  className={secondaryButtonClass}
                  data-testid="voice-mode-recheck-mic"
                >
                  <MaterialSymbol icon="refresh" size={14} />
                  Re-check
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {enabled && hasOpenAIKey && (
        <>
          <div
            className={chrome.section}
            data-agent-elements-shell="voice-mode-section"
            data-section="voice"
            data-testid="agent-elements-voice-mode-voice-section"
          >
            <h4 className={chrome.sectionTitle}>Voice Settings</h4>

            <div className={settingItemClass}>
              <div className={settingTextClass}>
                <span className={settingNameClass}>Voice</span>
                <span className={settingDescriptionClass}>
                  Choose the voice for the assistant. Each voice has its own personality and tone.
                </span>
              </div>
              <div className={controlRowClass}>
                <select
                  value={voice}
                  onChange={(e) => handleSettingChange({ voice: e.target.value as VoiceId })}
                  className={`${selectClass} flex-1`}
                  data-testid="voice-mode-voice-select"
                >
                  {VOICE_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} - {v.description}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  onClick={handlePreviewVoice}
                  disabled={isPreviewPlaying && !audioRef.current}
                  className={isPreviewPlaying ? primaryButtonClass : secondaryButtonClass}
                  title={isPreviewPlaying ? 'Stop preview' : 'Preview this voice'}
                  data-testid="voice-mode-preview-button"
                >
                  <MaterialSymbol icon={isPreviewPlaying ? 'stop' : 'play_arrow'} size={16} />
                  {isPreviewPlaying ? 'Stop' : 'Preview'}
                </button>
              </div>
              <p className={`${hintSmallClass} mt-[var(--an-spacing-sm)]`}>
                Preview plays a short sample using OpenAI's TTS API.
                {VOICE_OPTIONS.find(v => v.id === voice)?.realtimeOnly && (
                  <span className={mutedTextClass}>
                    {' '}This voice is Realtime-only; preview uses a similar voice.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div
            className={chrome.section}
            data-agent-elements-shell="voice-mode-section"
            data-section="turn-detection"
            data-testid="agent-elements-voice-mode-turn-section"
          >
            <h4 className={chrome.sectionTitle}>Turn Detection</h4>
            <p className={`${hintClass} mb-[var(--an-spacing-xl)]`}>
              Control how the assistant detects when you're speaking and when you're done.
            </p>

            {/* Mode Selection */}
            <div className={settingItemSpacedClass}>
              <div className={settingTextClass}>
                <span className={settingNameClass}>Input Mode</span>
                <span className={settingDescriptionClass}>
                  Choose how voice input is captured
                </span>
              </div>
              <select
                value={currentTurnDetection.mode}
                onChange={(e) => handleTurnDetectionChange({ mode: e.target.value as 'server_vad' | 'push_to_talk' })}
                className={`${selectClass} mt-[var(--an-spacing-sm)]`}
              >
                <option value="server_vad">Voice Activity Detection (automatic)</option>
                <option value="push_to_talk">Push to Talk (hold button)</option>
              </select>
            </div>

            {/* VAD-specific settings */}
            {currentTurnDetection.mode === 'server_vad' && (
              <>
                {/* VAD Threshold */}
                <div className={settingItemSpacedClass}>
                  <div className={settingTextClass}>
                    <span className={settingNameClass}>Voice Detection Sensitivity</span>
                    <span className={settingDescriptionClass}>
                      How sensitive the microphone is to your voice. Lower = more sensitive (picks up quiet speech), Higher = less sensitive (requires louder speech).
                    </span>
                  </div>
                  <div className={rangeRowClass}>
                    <span className={rangeLabelClass}>Sensitive</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={(currentTurnDetection.vadThreshold || 0.5) * 100}
                      onChange={(e) => handleTurnDetectionChange({ vadThreshold: parseInt(e.target.value) / 100 })}
                      className="flex-1"
                    />
                    <span className={rangeLabelClass}>Less sensitive</span>
                    <span className="min-w-[36px] text-xs text-[var(--an-foreground)]">
                      {Math.round((currentTurnDetection.vadThreshold || 0.5) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Silence Duration */}
                <div className={settingItemSpacedClass}>
                  <div className={settingTextClass}>
                    <span className={settingNameClass}>Pause Before Processing</span>
                    <span className={settingDescriptionClass}>
                      How long to wait after you stop speaking before processing your request. Shorter = faster response, Longer = more time for natural pauses.
                    </span>
                  </div>
                  <div className={rangeRowClass}>
                    <span className={rangeLabelClass}>Faster</span>
                    <input
                      type="range"
                      min="200"
                      max="1500"
                      step="100"
                      value={currentTurnDetection.silenceDuration || 500}
                      onChange={(e) => handleTurnDetectionChange({ silenceDuration: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className={rangeLabelClass}>Slower</span>
                    <span className={rangeValueClass}>
                      {((currentTurnDetection.silenceDuration || 500) / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Interruptible setting */}
            <SettingsToggle
              checked={currentTurnDetection.interruptible !== false}
              onChange={(checked) => handleTurnDetectionChange({ interruptible: checked })}
              name="Allow Interruptions"
              description="You can interrupt the assistant while it's speaking by starting to talk"
            />

            {/* Listen Window Duration */}
            <div className={settingItemClass}>
              <div className={settingTextClass}>
                <span className={settingNameClass}>Listen Window Duration</span>
                <span className={settingDescriptionClass}>
                  How long to keep listening after you stop speaking. After this time, the mic goes to sleep until the assistant responds or you click the mic button.
                </span>
              </div>
              <div className={rangeRowClass}>
                <span className={rangeLabelClass}>5s</span>
                <input
                  type="range"
                  min="5000"
                  max="30000"
                  step="1000"
                  value={listenWindowMs ?? 15000}
                  onChange={(e) => handleSettingChange({ listenWindowMs: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className={rangeLabelClass}>30s</span>
                <span className="min-w-[36px] text-xs text-[var(--an-foreground)]">
                  {Math.round((listenWindowMs ?? 15000) / 1000)}s
                </span>
              </div>
            </div>
          </div>

          <div
            className={chrome.section}
            data-agent-elements-shell="voice-mode-section"
            data-section="command-submission"
            data-testid="agent-elements-voice-mode-command-section"
          >
            <h4 className={chrome.sectionTitle}>Command Submission</h4>

            {/* Submit Delay */}
            <div className={settingItemSpacedClass}>
              <div className={settingTextClass}>
                <span className={settingNameClass}>Review Delay Before Submitting</span>
                <span className={settingDescriptionClass}>
                  Time to review and edit voice commands before they're sent to the coding agent. Set to 0 for immediate submission.
                </span>
              </div>
              <div className={rangeRowClass}>
                <span className={rangeLabelClass}>Immediate</span>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="500"
                  value={submitDelayMs ?? 3000}
                  onChange={(e) => handleSettingChange({ submitDelayMs: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className={rangeLabelClass}>10 seconds</span>
                <span className={rangeValueClass}>
                  {((submitDelayMs ?? 3000) / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          </div>

          {/* Project Summary Section */}
          {workspacePath && (
            <div
              className={summaryCardClass}
              data-agent-elements-shell="voice-mode-summary-card"
              data-section="project-summary"
              data-testid="agent-elements-voice-mode-summary-section"
            >
              <h4 className={chrome.sectionTitle}>Project Summary</h4>
              <p className={`${hintClass} mb-[var(--an-spacing-lg)]`}>
                The voice assistant uses an AI-generated summary of your project to understand context.
                Stored in <code className={inlineCodeClass}>{VOICE_PROJECT_SUMMARY_PATH}</code>.
              </p>

              {projectSummaryExists ? (
                <div className={summaryStatusRowClass}>
                  <MaterialSymbol icon="check_circle" size={16} className={successIconClass} />
                  <span className={mutedTextClass}>Summary exists</span>
                  <button
                    onClick={handleOpenSummary}
                    className={secondaryButtonClass}
                    title="Open summary file"
                    data-testid="voice-mode-summary-view"
                  >
                    <MaterialSymbol icon="open_in_new" size={14} />
                    View
                  </button>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={!hasAgentConfigured}
                    className={secondaryButtonClass}
                    title={hasAgentConfigured ? 'Regenerate summary' : 'Configure an agent to enable regeneration'}
                    data-testid="voice-mode-summary-regenerate"
                  >
                    <MaterialSymbol icon="refresh" size={14} />
                    Regenerate
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={!hasAgentConfigured}
                    className={primaryButtonClass}
                    data-testid="voice-mode-summary-generate"
                  >
                    <MaterialSymbol icon="auto_awesome" size={16} />
                    Generate Project Summary
                  </button>
                  <p className={`${hintSmallClass} mt-[var(--an-spacing-sm)]`}>
                    Launches an agent session that reads your project and writes the summary file. You'll
                    be taken to the session so you can watch it work.
                  </p>
                </div>
              )}

              {!hasAgentConfigured && (
                <p className={`mt-[var(--an-spacing-lg)] ${hintSmallClass}`} data-testid="voice-mode-summary-no-agent">
                  No agent is configured.{' '}
                  <button
                    type="button"
                    onClick={() => navigateToSettings({ category: 'claude-code' })}
                    className={linkButtonClass}
                  >
                    Configure one in AI Models settings
                  </button>{' '}
                  to enable this.
                </p>
              )}

              {summaryError && (
                <p className={errorTextClass} data-testid="voice-mode-summary-error">
                  {summaryError}
                </p>
              )}
            </div>
          )}

          <div
            className={chrome.section}
            data-agent-elements-shell="voice-mode-section"
            data-section="pricing"
            data-testid="agent-elements-voice-mode-pricing-section"
          >
            <h4 className={chrome.sectionTitle}>Usage & Pricing</h4>
            <p className={hintClass}>
              OpenAI charges for voice mode usage:
            </p>
            <ul className={listClass}>
              <li>Audio Input: $0.06 per minute</li>
              <li>Audio Output: $0.24 per minute</li>
              <li>Plus standard token costs for processing</li>
            </ul>
            <p className={hintClass}>
              Example: A 5-minute conversation costs approximately $0.50
            </p>
          </div>

          <div
            className={chrome.section}
            data-agent-elements-shell="voice-mode-section"
            data-section="how-it-works"
            data-testid="agent-elements-voice-mode-how-section"
          >
            <h4 className={chrome.sectionTitle}>How It Works</h4>
            <p className={hintClass}>
              Voice Mode uses OpenAI's Advanced Voice Mode (GPT Realtime) as an intelligent
              voice interface to Claude Code. You speak your coding requests naturally,
              and the voice assistant translates them into Claude Code commands.
            </p>
            <p className={`${hintClass} mt-[var(--an-spacing-sm)]`}>
              When Claude Code finishes working, the assistant summarizes what was done
              and speaks it back to you.
            </p>
          </div>

          <div
            className={chrome.section}
            data-agent-elements-shell="voice-mode-section"
            data-section="prompts"
            data-testid="agent-elements-voice-mode-prompts-section"
          >
            <h4 className={chrome.sectionTitle}>System Prompt Customization</h4>
            <p className={`${hintClass} mb-[var(--an-spacing-xl)]`}>
              Customize the behavior of the voice agent and coding agent during voice mode sessions.
            </p>

            {/* Voice Agent Prompt Section */}
            <button
              onClick={() => setShowVoiceAgentPrompt(!showVoiceAgentPrompt)}
              className={promptDisclosureClass(showVoiceAgentPrompt)}
            >
              <MaterialSymbol icon={showVoiceAgentPrompt ? 'expand_less' : 'expand_more'} size={20} />
              Voice Agent Instructions
            </button>

            {showVoiceAgentPrompt && (
              <div className={promptInsetClass}>
                <p className={`${hintClass} mb-[var(--an-spacing-lg)]`}>
                  Customize the voice assistant (GPT-4 Realtime) that handles speech interaction.
                </p>

                <div className={settingItemSpacedClass}>
                  <div className={settingTextClass}>
                    <span className={settingNameClass}>Prepend to Instructions</span>
                    <span className={settingDescriptionClass}>
                      Added before the default voice assistant instructions
                    </span>
                  </div>
                  <textarea
                    value={voiceAgentPrompt?.prepend || ''}
                    onChange={(e) => handleSettingChange({
                      voiceAgentPrompt: {
                        ...voiceAgentPrompt,
                        prepend: e.target.value,
                      },
                    })}
                    placeholder="e.g., Always respond in a formal tone..."
                    className={textareaClass}
                  />
                </div>

                <div className={settingItemClass}>
                  <div className={settingTextClass}>
                    <span className={settingNameClass}>Append to Instructions</span>
                    <span className={settingDescriptionClass}>
                      Added after the default voice assistant instructions
                    </span>
                  </div>
                  <textarea
                    value={voiceAgentPrompt?.append || ''}
                    onChange={(e) => handleSettingChange({
                      voiceAgentPrompt: {
                        ...voiceAgentPrompt,
                        append: e.target.value,
                      },
                    })}
                    placeholder="e.g., When discussing code, always mention file names..."
                    className={textareaClass}
                  />
                </div>
              </div>
            )}

            {/* Coding Agent Prompt Section */}
            <button
              onClick={() => setShowCodingAgentPrompt(!showCodingAgentPrompt)}
              className={promptDisclosureClass(showCodingAgentPrompt, '')}
            >
              <MaterialSymbol icon={showCodingAgentPrompt ? 'expand_less' : 'expand_more'} size={20} />
              Coding Agent Instructions (Voice Mode)
            </button>

            {showCodingAgentPrompt && (
              <div className={promptInsetLastClass}>
                <p className={`${hintClass} mb-[var(--an-spacing-lg)]`}>
                  Customize the coding agent (Claude) when processing voice mode requests.
                  These instructions are added to the system prompt only during voice mode sessions.
                </p>

                <div className={settingItemSpacedClass}>
                  <div className={settingTextClass}>
                    <span className={settingNameClass}>Prepend to Instructions</span>
                    <span className={settingDescriptionClass}>
                      Added before the coding agent's voice mode context
                    </span>
                  </div>
                  <textarea
                    value={codingAgentPrompt?.prepend || ''}
                    onChange={(e) => handleSettingChange({
                      codingAgentPrompt: {
                        ...codingAgentPrompt,
                        prepend: e.target.value,
                      },
                    })}
                    placeholder="e.g., When responding to voice requests, prioritize brevity..."
                    className={textareaClass}
                  />
                </div>

                <div className={settingItemClass}>
                  <div className={settingTextClass}>
                    <span className={settingNameClass}>Append to Instructions</span>
                    <span className={settingDescriptionClass}>
                      Added after the coding agent's voice mode context
                    </span>
                  </div>
                  <textarea
                    value={codingAgentPrompt?.append || ''}
                    onChange={(e) => handleSettingChange({
                      codingAgentPrompt: {
                        ...codingAgentPrompt,
                        append: e.target.value,
                      },
                    })}
                    placeholder="e.g., Always summarize what you did in 1-2 sentences at the end..."
                    className={textareaClass}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
