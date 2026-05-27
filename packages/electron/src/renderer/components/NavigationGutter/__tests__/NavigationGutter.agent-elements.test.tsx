// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  atoms: {
    setActiveSessionAtom: 'setActiveSessionAtom',
    terminalFeatureAvailableAtom: 'terminalFeatureAvailableAtom',
    syncEnabledAtom: 'syncEnabledAtom',
    syncEnabledProjectsAtom: 'syncEnabledProjectsAtom',
    workspaceHasTeamAtom: 'workspaceHasTeamAtom',
    stytchIsSignedInAtom: 'stytchIsSignedInAtom',
    hiddenGutterButtonsAtom: 'hiddenGutterButtonsAtom',
  },
  setActiveSession: vi.fn(),
  capture: vi.fn(),
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockState.capture }),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.atoms.terminalFeatureAvailableAtom) return true;
    if (atom === mockState.atoms.syncEnabledAtom) return false;
    if (atom === mockState.atoms.syncEnabledProjectsAtom) return [];
    if (atom === mockState.atoms.workspaceHasTeamAtom) return false;
    if (atom === mockState.atoms.stytchIsSignedInAtom) return true;
    if (atom === mockState.atoms.hiddenGutterButtonsAtom) return [];
    return undefined;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.atoms.setActiveSessionAtom) return mockState.setActiveSession;
    return vi.fn();
  }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      fill,
      className,
    }: {
      icon: string;
      size?: number;
      fill?: boolean;
      className?: string;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, 'data-fill': fill, className }),
  };
});

vi.mock('../../../shared/KeyboardShortcuts', () => ({
  KeyboardShortcuts: {
    view: {
      filesMode: 'files-mode',
      agentMode: 'agent-mode',
      trackerMode: 'tracker-mode',
      collabMode: 'collab-mode',
    },
  },
  getShortcutDisplay: (shortcut: string) => shortcut,
}));

vi.mock('../../ThemeToggleButton/ThemeToggleButton', () => ({
  ThemeToggleButton: () => <button type="button" data-testid="mock-theme-toggle" />,
}));

vi.mock('../../SyncStatusButton/SyncStatusButton', () => ({
  SyncStatusButton: () => <button type="button" data-testid="mock-sync-status" />,
}));

vi.mock('../../TrustIndicator', () => ({
  TrustIndicator: () => <button type="button" data-testid="mock-trust-indicator" />,
}));

vi.mock('../../ExtensionDevIndicator', () => ({
  ExtensionDevIndicator: () => <button type="button" data-testid="mock-extension-dev" />,
}));

vi.mock('../../ClaudeUsageIndicator', () => ({
  ClaudeUsageIndicator: () => <button type="button" data-testid="mock-claude-usage" />,
}));

vi.mock('../../CodexUsageIndicator', () => ({
  CodexUsageIndicator: () => <button type="button" data-testid="mock-codex-usage" />,
}));

vi.mock('../../BackgroundTaskIndicator', () => ({
  BackgroundTaskIndicator: () => <button type="button" data-testid="mock-background-task" />,
}));

vi.mock('../../UnifiedAI/VoiceModeButton', () => ({
  VoiceModeButton: () => <button type="button" data-testid="mock-voice-mode" />,
}));

vi.mock('../../../extensions/panels/usePanels', () => ({
  useExtensionGutterButtons: () => [],
  useExtensionBottomPanelButtons: () => [],
}));

vi.mock('../../../help', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    HelpTooltip: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

vi.mock('../../../store', () => ({
  setActiveSessionAtom: mockState.atoms.setActiveSessionAtom,
}));

vi.mock('../../../store/atoms/appSettings', () => ({
  terminalFeatureAvailableAtom: mockState.atoms.terminalFeatureAvailableAtom,
  syncEnabledAtom: mockState.atoms.syncEnabledAtom,
  syncEnabledProjectsAtom: mockState.atoms.syncEnabledProjectsAtom,
}));

vi.mock('../../../store/atoms/collabDocuments', () => ({
  workspaceHasTeamAtom: mockState.atoms.workspaceHasTeamAtom,
}));

vi.mock('../../../store/atoms/stytchAuth', () => ({
  stytchIsSignedInAtom: mockState.atoms.stytchIsSignedInAtom,
}));

vi.mock('../../../hooks/useAlphaFeature', () => ({
  useAlphaFeature: () => false,
}));

vi.mock('../../common/AlphaBadge', () => ({
  AlphaBadge: () => <span data-testid="mock-alpha-badge" />,
}));

vi.mock('../UserMenuPopover', () => ({
  UserMenuPopover: () => <div data-testid="mock-user-menu-popover" />,
}));

vi.mock('../GutterContextMenu', () => ({
  GutterContextMenu: () => <div data-testid="mock-gutter-context-menu" />,
}));

vi.mock('../../../store/atoms/projectState', () => ({
  hiddenGutterButtonsAtom: mockState.atoms.hiddenGutterButtonsAtom,
}));

import { NavigationGutter } from '../NavigationGutter';

const sourcePath = resolve(__dirname, '../NavigationGutter.tsx');

describe('NavigationGutter Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'IS_DEV_MODE', {
      configurable: true,
      value: false,
    });
  });

  it('keeps app-rail navigation behavior while exposing Agent Elements shell markers', () => {
    const onContentModeChange = vi.fn();
    const onToggleFilesCollapsed = vi.fn();
    const onToggleTerminalPanel = vi.fn();

    const { container } = render(
      <NavigationGutter
        contentMode="files"
        onContentModeChange={onContentModeChange}
        onToggleFilesCollapsed={onToggleFilesCollapsed}
        onToggleTerminalPanel={onToggleTerminalPanel}
        workspacePath="/workspace/app"
      />
    );

    const rail = container.querySelector('.navigation-gutter');
    expect(rail).toHaveClass('navigation-gutter', 'agent-elements-navigation-gutter');
    expect(rail).toHaveAttribute('data-component', 'NavigationGutter');
    expect(rail).toHaveAttribute('data-agent-elements-shell', 'navigation-gutter');

    const filesButton = screen.getByTestId('files-mode-button');
    expect(filesButton).toHaveClass('nav-button', 'agent-elements-navigation-gutter-button');
    expect(filesButton).toHaveAttribute('data-agent-elements-shell', 'navigation-gutter-button');
    expect(filesButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(filesButton);
    expect(onToggleFilesCollapsed).toHaveBeenCalledTimes(1);
    expect(onContentModeChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('agent-mode-button'));
    expect(onContentModeChange).toHaveBeenCalledWith('agent');
    expect(mockState.capture).toHaveBeenCalledWith('content_mode_switched', {
      fromMode: 'files',
      toMode: 'agent',
    });

    fireEvent.click(screen.getByTestId('terminal-panel-button'));
    expect(onToggleTerminalPanel).toHaveBeenCalledTimes(1);
  });

  it('keeps NavigationGutter source on Agent Elements token aliases', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-navigation-gutter');
    expect(source).toContain('data-agent-elements-shell="navigation-gutter-button"');
    expect(source).not.toMatch(/\b(?:bg|text|border|hover:bg|hover:text|hover:border)-nim(?:-[\w-]+)?\b/);
    expect(source).not.toMatch(/var\(--nim-/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|active:scale|transition-all|text-white/);
  });
});
