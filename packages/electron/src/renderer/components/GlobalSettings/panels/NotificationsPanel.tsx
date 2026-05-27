import React, { useState } from 'react';
import { useAtom } from 'jotai';
import { SettingsToggle } from '../SettingsToggle';
import {
  notificationSettingsAtom,
  setNotificationSettingsAtom,
  type CompletionSoundType,
} from '../../../store/atoms/appSettings';
import { createProviderPanelChrome } from './providerPanelChrome';

const chrome = createProviderPanelChrome({
  headerClassName: 'provider-panel-header notifications-panel-header',
  sectionClassName: 'provider-panel-section notifications-panel-section',
  configCardClassName: 'notifications-sound-options',
  inputClassName: 'notifications-input',
  loadingClassName: 'notifications-loading',
  modelRowClassName: 'notifications-row',
  testButtonClassName: 'notifications-action-button',
  testErrorClassName: 'notifications-error',
  emptyClassName: 'notifications-empty',
});

const notificationHelpPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-sm)] [--agent-elements-card-inline-padding:var(--an-spacing-md)]';
const notificationBodyTextClass =
  'text-sm leading-relaxed text-[var(--an-foreground-muted)]';

/**
 * NotificationsPanel - Self-contained settings panel for notifications.
 *
 * This component subscribes directly to Jotai atoms instead of receiving props.
 * Changes are automatically persisted via the setter atom.
 */
export function NotificationsPanel() {
  const [settings] = useAtom(notificationSettingsAtom);
  const [, updateSettings] = useAtom(setNotificationSettingsAtom);
  const [isTestPlaying, setIsTestPlaying] = useState(false);
  const [notificationHelp, setNotificationHelp] = useState<string | null>(null);

  const { completionSoundEnabled, completionSoundType, osNotificationsEnabled, notifyWhenFocused } = settings;

  // play-completion-sound is handled by store/listeners/soundListeners.ts.

  const handleTestSound = async () => {
    if (!window.electronAPI) return;

    setIsTestPlaying(true);
    try {
      await window.electronAPI.invoke('completion-sound:test', completionSoundType);
    } catch (error) {
      console.error('Failed to test sound:', error);
    } finally {
      setTimeout(() => setIsTestPlaying(false), 500);
    }
  };

  const handleTestNotification = async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.invoke('notifications:show-test');
    if (result?.success) {
      setNotificationHelp('A test notification was sent. If you do not see it, open your OS notification settings and allow Nimbalyst notifications.');
    } else {
      setNotificationHelp(result?.error || 'Failed to show a test notification.');
    }
  };

  const handleOpenNotificationSettings = async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.invoke('notifications:open-system-settings');
    if (!result?.success) {
      setNotificationHelp(result?.error || 'Failed to open system notification settings.');
    }
  };

  return (
    <div
      className="provider-panel notifications-panel agent-elements-settings-panel agent-elements-notifications-panel flex flex-col"
      data-agent-elements-shell="notifications-panel"
      data-component="NotificationsPanel"
      data-testid="agent-elements-notifications-panel"
    >
      <div
        className={chrome.header}
        data-agent-elements-shell="notifications-header"
        data-testid="agent-elements-notifications-header"
      >
        <h3 className={chrome.title}>Notifications</h3>
        <p className={chrome.description}>
          Configure audio and visual notifications for AI interactions.
        </p>
      </div>

      <div
        className={chrome.section}
        data-agent-elements-shell="notifications-section"
        data-section="completion-sounds"
        data-testid="agent-elements-notifications-sounds-section"
      >
        <h4 className={chrome.sectionTitle}>Completion Sounds</h4>
        <p className={`${notificationBodyTextClass} mb-[var(--an-spacing-lg)]`}>
          Play a sound when the AI or agent completes a turn and is ready for more input.
        </p>

        <SettingsToggle
          checked={completionSoundEnabled}
          onChange={(checked) => updateSettings({ completionSoundEnabled: checked })}
          name="Enable Completion Sounds"
          description="Play an audio notification when AI chat or agent completes a response."
        />

        {completionSoundEnabled && (
          <div
            className={`setting-item ${chrome.configCard}`}
            data-agent-elements-shell="notifications-sound-options"
            data-testid="agent-elements-notifications-sound-options"
          >
            <div className="setting-text flex flex-col gap-[var(--an-spacing-xxs)]">
              <span className="setting-name text-sm font-medium text-[var(--an-foreground)]">Sound Type</span>
              <span className="setting-description text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                Choose the sound to play when a response completes.
              </span>
            </div>
            <div className="mt-[var(--an-spacing-lg)] flex flex-col gap-[var(--an-spacing-sm)]">
              {(['chime', 'bell', 'pop'] as CompletionSoundType[]).map((sound) => (
                <label key={sound} className="setting-radio-label flex cursor-pointer items-center gap-[var(--an-spacing-sm)] text-sm text-[var(--an-foreground)]">
                  <input
                    type="radio"
                    name="sound-type"
                    value={sound}
                    checked={completionSoundType === sound}
                    onChange={(e) => updateSettings({ completionSoundType: e.target.value as CompletionSoundType })}
                    className="setting-radio h-4 w-4 shrink-0 cursor-pointer accent-[var(--an-primary-color)]"
                  />
                  <span className="capitalize">{sound}</span>
                </label>
              ))}
            </div>
            <button
              onClick={handleTestSound}
              disabled={isTestPlaying}
              className={`${chrome.secondaryButton} mt-[var(--an-spacing-lg)]`}
            >
              {isTestPlaying ? 'Playing...' : 'Test Sound'}
            </button>
          </div>
        )}
      </div>

      <div
        className={chrome.section}
        data-agent-elements-shell="notifications-section"
        data-section="os-notifications"
        data-testid="agent-elements-notifications-os-section"
      >
        <h4 className={chrome.sectionTitle}>OS Notifications</h4>
        <p className={`${notificationBodyTextClass} mb-[var(--an-spacing-lg)]`}>
          Show system notifications when AI responses complete while the app is in the background.
        </p>

        <SettingsToggle
          checked={osNotificationsEnabled}
          onChange={(checked) => {
            updateSettings({ osNotificationsEnabled: checked });
            if (checked) {
              void handleTestNotification();
            } else {
              setNotificationHelp(null);
            }
          }}
          name="Enable OS Notifications"
          description="Native system notifications when AI completes a response. Respects Do Not Disturb."
        />

        {osNotificationsEnabled && (
          <>
            <SettingsToggle
              checked={notifyWhenFocused}
              onChange={(checked) => updateSettings({ notifyWhenFocused: checked })}
              name="Notify Even When Focused"
              description="Show notifications even when the app is focused, unless viewing that session."
            />

            <div className="setting-item py-[var(--an-spacing-lg)]">
              <div className="setting-text flex flex-col gap-[var(--an-spacing-sm)]">
                <span className="setting-description text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                  Electron does not expose a reliable cross-platform notification permission state here.
                  Use a test notification to trigger the OS prompt or verify delivery.
                </span>
                <div
                  className="notifications-actions flex flex-wrap gap-[var(--an-spacing-sm)]"
                  data-agent-elements-shell="notifications-actions"
                  data-testid="agent-elements-notifications-actions"
                >
                  <button onClick={handleTestNotification} className={chrome.secondaryButton}>
                    Send Test Notification
                  </button>
                  <button onClick={handleOpenNotificationSettings} className={chrome.secondaryButton}>
                    Open System Notification Settings
                  </button>
                </div>
                {notificationHelp && (
                  <span
                    className={`notifications-help agent-elements-tool-card text-xs leading-relaxed text-[var(--an-foreground-muted)] ${notificationHelpPaddingClass}`}
                    data-agent-elements-shell="notifications-help"
                    data-testid="agent-elements-notifications-help"
                  >
                    {notificationHelp}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div
        className={chrome.section}
        data-agent-elements-shell="notifications-section"
        data-section="session-blocked"
        data-testid="agent-elements-notifications-session-section"
      >
        <h4 className={chrome.sectionTitle}>Session Blocked Notifications</h4>
        <p className={`${notificationBodyTextClass} mb-[var(--an-spacing-lg)]`}>
          Show system notifications when an AI session needs your input.
        </p>

        <SettingsToggle
          checked={settings.sessionBlockedNotificationsEnabled}
          onChange={(checked) => updateSettings({ sessionBlockedNotificationsEnabled: checked })}
          name="Notify When Session Needs Attention"
          description="Notify when a session is waiting for input (permissions, questions, plan reviews, commits)."
        />
      </div>
    </div>
  );
}
