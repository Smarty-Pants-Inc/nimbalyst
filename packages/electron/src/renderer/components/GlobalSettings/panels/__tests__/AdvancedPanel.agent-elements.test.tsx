// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const mockState = vi.hoisted(() => ({
  tokens: {
    advancedSettingsAtom: 'advancedSettingsAtom',
    setAdvancedSettingsAtom: 'setAdvancedSettingsAtom',
    resetWalkthroughsAtom: 'resetWalkthroughsAtom',
    developerFeatureSettingsAtom: 'developerFeatureSettingsAtom',
    setDeveloperFeatureSettingsAtom: 'setDeveloperFeatureSettingsAtom',
    customPathDirsAtom: 'customPathDirsAtom',
    externalEditorSettingsAtom: 'externalEditorSettingsAtom',
    setExternalEditorSettingsAtom: 'setExternalEditorSettingsAtom',
    debugFlagsAtom: 'debugFlagsAtom',
    setDebugFlagsAtom: 'setDebugFlagsAtom',
    trackerAutomationAtom: 'trackerAutomationAtom',
    setTrackerAutomationAtom: 'setTrackerAutomationAtom',
    multiProjectModeAtom: 'multiProjectModeAtom',
    openProjectsAtom: 'openProjectsAtom',
    activeWorkspacePathAtom: 'activeWorkspacePathAtom',
    restorePreviousProjectsAtom: 'restorePreviousProjectsAtom',
  },
  advancedSettings: {
    releaseChannel: 'stable',
    analyticsEnabled: true,
    extensionDevToolsEnabled: false,
    walkthroughsEnabled: true,
    walkthroughsViewedCount: 1,
    walkthroughsTotalCount: 3,
    maxHeapSizeMB: 4096,
    customPathDirs: '/opt/smarty/bin',
    spellcheckEnabled: true,
    historyMaxAgeDays: 30,
    historyMaxSnapshots: 250,
    preferredTerminalShell: 'auto',
  },
  developerSettings: {
    developerMode: false,
    developerFeatures: {
      terminalAccess: false,
    },
  },
  debugFlags: {
    diffTrace: false,
  },
  trackerAutomation: {
    enabled: true,
    autoCloseOnCommit: true,
  },
  externalEditorSettings: {
    editorType: 'none',
    customPath: '',
  },
  openProjects: [
    { path: '/work/active', name: 'active', openedAt: 1 },
  ],
  updateSettings: vi.fn(),
  resetWalkthroughs: vi.fn(),
  updateDeveloperSettings: vi.fn(),
  updateDebugFlags: vi.fn(),
  setTrackerAutomation: vi.fn(),
  updateExternalEditorSettings: vi.fn(),
  setMultiProjectMode: vi.fn(),
  setOpenProjects: vi.fn(),
  setRestorePreviousProjects: vi.fn(),
  capture: vi.fn(),
  peopleSet: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.advancedSettingsAtom) return [mockState.advancedSettings, vi.fn()];
    if (atom === mockState.tokens.setAdvancedSettingsAtom) return [null, mockState.updateSettings];
    if (atom === mockState.tokens.resetWalkthroughsAtom) return [null, mockState.resetWalkthroughs];
    if (atom === mockState.tokens.developerFeatureSettingsAtom) return [mockState.developerSettings, vi.fn()];
    if (atom === mockState.tokens.setDeveloperFeatureSettingsAtom) return [null, mockState.updateDeveloperSettings];
    if (atom === mockState.tokens.externalEditorSettingsAtom) return [mockState.externalEditorSettings, vi.fn()];
    if (atom === mockState.tokens.setExternalEditorSettingsAtom) return [null, mockState.updateExternalEditorSettings];
    if (atom === mockState.tokens.multiProjectModeAtom) return [false, mockState.setMultiProjectMode];
    if (atom === mockState.tokens.openProjectsAtom) return [mockState.openProjects, mockState.setOpenProjects];
    if (atom === mockState.tokens.restorePreviousProjectsAtom) return [false, mockState.setRestorePreviousProjects];
    return [null, vi.fn()];
  }),
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.debugFlagsAtom) return mockState.debugFlags;
    if (atom === mockState.tokens.trackerAutomationAtom) return mockState.trackerAutomation;
    if (atom === mockState.tokens.activeWorkspacePathAtom) return '/work/active';
    if (atom === mockState.tokens.multiProjectModeAtom) return false;
    return null;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.setDebugFlagsAtom) return mockState.updateDebugFlags;
    if (atom === mockState.tokens.setTrackerAutomationAtom) return mockState.setTrackerAutomation;
    return vi.fn();
  }),
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({
    capture: mockState.capture,
    people: { set: mockState.peopleSet },
  }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const React = await import('react');
  return {
    MaterialSymbol: ({ icon, className }: { icon: string; className?: string }) =>
      React.createElement('span', { className, 'data-material-icon': icon }, icon),
  };
});

vi.mock('../../../../help', async () => {
  const React = await import('react');
  return {
    HelpTooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

vi.mock('../../../../store/atoms/appSettings', () => ({
  advancedSettingsAtom: mockState.tokens.advancedSettingsAtom,
  setAdvancedSettingsAtom: mockState.tokens.setAdvancedSettingsAtom,
  resetWalkthroughsAtom: mockState.tokens.resetWalkthroughsAtom,
  developerFeatureSettingsAtom: mockState.tokens.developerFeatureSettingsAtom,
  setDeveloperFeatureSettingsAtom: mockState.tokens.setDeveloperFeatureSettingsAtom,
  customPathDirsAtom: mockState.tokens.customPathDirsAtom,
  externalEditorSettingsAtom: mockState.tokens.externalEditorSettingsAtom,
  setExternalEditorSettingsAtom: mockState.tokens.setExternalEditorSettingsAtom,
  debugFlagsAtom: mockState.tokens.debugFlagsAtom,
  setDebugFlagsAtom: mockState.tokens.setDebugFlagsAtom,
  EXTERNAL_EDITOR_NAMES: {},
  DEVELOPER_FEATURES: [
    {
      tag: 'terminalAccess',
      name: 'Terminal Access',
      description: 'Use integrated terminal tools.',
      icon: 'terminal',
    },
  ],
  areAllDeveloperFeaturesEnabled: vi.fn(() => false),
  enableAllDeveloperFeatures: vi.fn(() => ({ terminalAccess: true })),
  disableAllDeveloperFeatures: vi.fn(() => ({ terminalAccess: false })),
}));

vi.mock('../../../../store/atoms/trackerAutomationAtoms', () => ({
  trackerAutomationAtom: mockState.tokens.trackerAutomationAtom,
  setTrackerAutomationAtom: mockState.tokens.setTrackerAutomationAtom,
}));

vi.mock('../../../../store/atoms/openProjects', () => ({
  multiProjectModeAtom: mockState.tokens.multiProjectModeAtom,
  openProjectsAtom: mockState.tokens.openProjectsAtom,
  activeWorkspacePathAtom: mockState.tokens.activeWorkspacePathAtom,
  restorePreviousProjectsAtom: mockState.tokens.restorePreviousProjectsAtom,
}));

import { AdvancedPanel } from '../AdvancedPanel';

const advancedPanelSourcePath = path.join(__dirname, '../AdvancedPanel.tsx');
const providerChromeSourcePath = path.join(__dirname, '../providerPanelChrome.ts');

describe('AdvancedPanel Agent Elements shell', () => {
  beforeEach(() => {
    mockState.updateSettings.mockClear();
    mockState.resetWalkthroughs.mockClear();
    mockState.updateDeveloperSettings.mockClear();
    mockState.updateDebugFlags.mockClear();
    mockState.setTrackerAutomation.mockClear();
    mockState.updateExternalEditorSettings.mockClear();
    mockState.setMultiProjectMode.mockClear();
    mockState.setOpenProjects.mockClear();
    mockState.setRestorePreviousProjects.mockClear();
    mockState.capture.mockClear();
    mockState.peopleSet.mockClear();
    mockState.advancedSettings.releaseChannel = 'stable';
    mockState.advancedSettings.customPathDirs = '/opt/smarty/bin';
    mockState.developerSettings.developerMode = false;
    mockState.debugFlags.diffTrace = false;
    mockState.trackerAutomation.enabled = true;
    mockState.trackerAutomation.autoCloseOnCommit = true;
    mockState.externalEditorSettings.editorType = 'none';
    mockState.externalEditorSettings.customPath = '';
    (window as any).electronAPI = {
      environment: {
        getEnhancedPath: vi.fn().mockResolvedValue('/opt/smarty/bin:/usr/local/bin:/usr/bin'),
      },
      terminal: {
        getAvailableShells: vi.fn().mockResolvedValue([]),
      },
      invoke: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders Agent Elements markers while preserving advanced settings behaviors', async () => {
    render(<AdvancedPanel />);

    const panel = screen.getByTestId('agent-elements-advanced-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'advanced-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-advanced-header')).toHaveClass('agent-elements-settings-panel-header');

    expect(screen.getByTestId('agent-elements-advanced-mode-section')).toHaveAttribute('data-section', 'application-mode');
    expect(screen.getByTestId('agent-elements-advanced-standard-mode-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-advanced-developer-mode-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-advanced-debug-section')).toHaveAttribute('data-section', 'debug-logging');
    expect(screen.getByTestId('agent-elements-advanced-release-section')).toHaveAttribute('data-section', 'release-channel');
    expect(screen.getByTestId('agent-elements-advanced-general-section')).toHaveAttribute('data-section', 'general');
    expect(screen.getByTestId('tracker-automation-section')).toHaveAttribute('data-section', 'tracker-automation');
    expect(screen.getByTestId('agent-elements-advanced-tools-section')).toHaveAttribute('data-section', 'tools-environment');

    fireEvent.click(screen.getByTestId('agent-elements-advanced-developer-mode-card'));
    expect(mockState.updateDeveloperSettings).toHaveBeenCalledWith({ developerMode: true });
    expect(mockState.capture).toHaveBeenCalledWith('developer_mode_changed', {
      developer_mode: true,
      source: 'settings',
      is_initial: false,
    });
    expect(mockState.peopleSet).toHaveBeenCalledWith({ developer_mode: true });

    const debugSection = screen.getByTestId('agent-elements-advanced-debug-section');
    const diffTraceInput = within(debugSection).getByRole('checkbox', { hidden: true });
    fireEvent.click(diffTraceInput);
    expect(mockState.updateDebugFlags).toHaveBeenCalledWith({ diffTrace: true });

    fireEvent.change(screen.getByTestId('agent-elements-advanced-release-select'), {
      target: { value: 'alpha' },
    });
    expect(mockState.updateSettings).toHaveBeenCalledWith({ releaseChannel: 'alpha' });
    expect(mockState.capture).toHaveBeenCalledWith('release_channel_changed', { channel: 'alpha' });

    const trackerSection = screen.getByTestId('tracker-automation-section');
    const trackerToggles = within(trackerSection).getAllByRole('checkbox', { hidden: true });
    fireEvent.click(trackerToggles[0]);
    expect(mockState.setTrackerAutomation).toHaveBeenCalledWith({ enabled: false });

    fireEvent.change(screen.getByTestId('agent-elements-advanced-external-editor-select'), {
      target: { value: 'cursor' },
    });
    expect(mockState.updateExternalEditorSettings).toHaveBeenCalledWith({ editorType: 'cursor' });

    fireEvent.click(screen.getByTestId('agent-elements-advanced-show-path'));
    await waitFor(() => {
      expect((window as any).electronAPI.environment.getEnhancedPath).toHaveBeenCalled();
      expect(screen.getByTestId('agent-elements-advanced-path-output')).toHaveClass('agent-elements-tool-card');
      expect(screen.getByTestId('agent-elements-advanced-path-output')).toHaveTextContent('/opt/smarty/bin');
    });
  });

  it('keeps AdvancedPanel visual chrome on Agent Elements provider panel aliases', () => {
    const source = readFileSync(advancedPanelSourcePath, 'utf8');
    const providerChromeSource = readFileSync(providerChromeSourcePath, 'utf8');

    expect(source).toContain("import { createProviderPanelChrome } from './providerPanelChrome';");
    expect(source).toContain('const chrome = createProviderPanelChrome({');
    expect(source).toContain('chrome.header');
    expect(source).toContain('chrome.section');
    expect(source).toContain('chrome.configCard');
    expect(source).toContain('chrome.input');
    expect(providerChromeSource).toContain('--agent-elements-card-inline-padding');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba\(/);
    expect(source).not.toMatch(/bg-white|text-white|rounded-lg|transition-all/);
  });
});
