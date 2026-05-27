// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/NotificationsPanel.tsx',
);
const chromeSourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/providerPanelChrome.ts',
);
const legacyVisualChromePattern =
  /bg-nim|text-nim|border-nim|bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-|rgba\(|#[0-9a-fA-F]{3,8}\b|bg-white|rounded-lg|transition-all|text-white/;

const mockState = vi.hoisted(() => ({
  tokens: {
    notificationSettingsAtom: 'notificationSettingsAtom',
    setNotificationSettingsAtom: 'setNotificationSettingsAtom',
  },
  settings: {
    completionSoundEnabled: true,
    completionSoundType: 'chime',
    osNotificationsEnabled: true,
    notifyWhenFocused: false,
    sessionBlockedNotificationsEnabled: true,
  },
  updateSettings: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.notificationSettingsAtom) return [mockState.settings, vi.fn()];
    if (atom === mockState.tokens.setNotificationSettingsAtom) return [null, mockState.updateSettings];
    return [null, vi.fn()];
  }),
}));

vi.mock('../../../../store/atoms/appSettings', () => ({
  notificationSettingsAtom: mockState.tokens.notificationSettingsAtom,
  setNotificationSettingsAtom: mockState.tokens.setNotificationSettingsAtom,
}));

import { NotificationsPanel } from '../NotificationsPanel';

describe('NotificationsPanel Agent Elements shell', () => {
  beforeEach(() => {
    mockState.updateSettings.mockClear();
    mockState.settings.completionSoundEnabled = true;
    mockState.settings.completionSoundType = 'chime';
    mockState.settings.osNotificationsEnabled = true;
    mockState.settings.notifyWhenFocused = false;
    mockState.settings.sessionBlockedNotificationsEnabled = true;

    (window as any).electronAPI = {
      invoke: vi.fn((channel: string) => {
        if (channel === 'completion-sound:test') return Promise.resolve({ success: true });
        if (channel === 'notifications:show-test') return Promise.resolve({ success: true });
        if (channel === 'notifications:open-system-settings') return Promise.resolve({ success: true });
        return Promise.resolve(undefined);
      }),
    };
  });

  it('renders Agent Elements markers while preserving notification setting and IPC behavior', async () => {
    render(<NotificationsPanel />);

    const panel = await screen.findByTestId('agent-elements-notifications-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'notifications-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-notifications-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-notifications-sounds-section')).toHaveAttribute('data-section', 'completion-sounds');
    expect(screen.getByTestId('agent-elements-notifications-sound-options')).toHaveAttribute('data-agent-elements-shell', 'notifications-sound-options');
    expect(screen.getByTestId('agent-elements-notifications-os-section')).toHaveAttribute('data-section', 'os-notifications');
    expect(screen.getByTestId('agent-elements-notifications-actions')).toHaveAttribute('data-agent-elements-shell', 'notifications-actions');
    expect(screen.getByTestId('agent-elements-notifications-session-section')).toHaveAttribute('data-section', 'session-blocked');

    fireEvent.click(screen.getByText('Test Sound'));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('completion-sound:test', 'chime'));

    fireEvent.click(screen.getByLabelText('bell'));
    expect(mockState.updateSettings).toHaveBeenCalledWith({ completionSoundType: 'bell' });

    fireEvent.click(screen.getByText('Send Test Notification'));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('notifications:show-test'));
    expect(await screen.findByTestId('agent-elements-notifications-help')).toHaveTextContent('A test notification was sent');

    fireEvent.click(screen.getByText('Open System Notification Settings'));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('notifications:open-system-settings'));

    const checkboxes = within(panel).getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(mockState.updateSettings).toHaveBeenCalledWith({ completionSoundEnabled: false });

    fireEvent.click(checkboxes[1]);
    expect(mockState.updateSettings).toHaveBeenCalledWith({ osNotificationsEnabled: false });

    fireEvent.click(checkboxes[3]);
    expect(mockState.updateSettings).toHaveBeenCalledWith({ sessionBlockedNotificationsEnabled: false });
  });

  it('keeps notification settings chrome on Agent Elements aliases instead of legacy visual tokens', () => {
    const panelSource = readFileSync(sourcePath, 'utf8');
    const chromeSource = readFileSync(chromeSourcePath, 'utf8');
    const source = `${panelSource}\n${chromeSource}`;

    expect(panelSource).toContain('createProviderPanelChrome');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-foreground');
    expect(source).toContain('--an-foreground-muted');
    expect(source).toContain('--an-primary-color');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).not.toMatch(legacyVisualChromePattern);
  });
});
