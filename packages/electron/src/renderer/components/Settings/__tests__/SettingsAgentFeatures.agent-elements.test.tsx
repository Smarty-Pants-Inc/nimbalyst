// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => {
  const advancedSettings = {
    alphaFeatures: {
      'super-loops': false,
      blitz: false,
      'meta-agent': false,
      collaboration: false,
    },
  };
  const aiDebugSettings = {
    showToolCalls: false,
    chatShowToolCalls: true,
    aiDebugLogging: false,
    showPromptAdditions: false,
  };

  return {
    tokens: {
      advancedSettingsAtom: 'advancedSettingsAtom',
      setAdvancedSettingsAtom: 'setAdvancedSettingsAtom',
      aiDebugSettingsAtom: 'aiDebugSettingsAtom',
      setAIDebugSettingsAtom: 'setAIDebugSettingsAtom',
      autoCommitEnabledAtom: 'autoCommitEnabledAtom',
      setAutoCommitEnabledAtom: 'setAutoCommitEnabledAtom',
    },
    advancedSettings,
    aiDebugSettings,
    updateSettings: vi.fn(),
    updateAIDebugSettings: vi.fn(),
    setAutoCommitEnabled: vi.fn(),
    capture: vi.fn(),
  };
});

vi.mock('jotai', () => ({
  useAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.advancedSettingsAtom) {
      return [mockState.advancedSettings, mockState.updateSettings];
    }
    if (atom === mockState.tokens.setAdvancedSettingsAtom) {
      return [null, mockState.updateSettings];
    }
    if (atom === mockState.tokens.aiDebugSettingsAtom) {
      return [mockState.aiDebugSettings, mockState.updateAIDebugSettings];
    }
    if (atom === mockState.tokens.setAIDebugSettingsAtom) {
      return [null, mockState.updateAIDebugSettings];
    }
    return [null, vi.fn()];
  }),
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.autoCommitEnabledAtom) return false;
    return null;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.setAutoCommitEnabledAtom) return mockState.setAutoCommitEnabled;
    return vi.fn();
  }),
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockState.capture }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size, className }: { icon: string; size?: number; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

vi.mock('../../../store/atoms/appSettings', () => ({
  advancedSettingsAtom: mockState.tokens.advancedSettingsAtom,
  setAdvancedSettingsAtom: mockState.tokens.setAdvancedSettingsAtom,
  aiDebugSettingsAtom: mockState.tokens.aiDebugSettingsAtom,
  setAIDebugSettingsAtom: mockState.tokens.setAIDebugSettingsAtom,
}));

vi.mock('../../../store/atoms/autoCommitAtoms', () => ({
  autoCommitEnabledAtom: mockState.tokens.autoCommitEnabledAtom,
  setAutoCommitEnabledAtom: mockState.tokens.setAutoCommitEnabledAtom,
}));

import { AgentFeaturesPanel } from '../AgentFeaturesPanel';

const getToggleInput = (name: string) => {
  const row = screen.getByText(name).closest('[data-agent-elements-shell="agent-feature-toggle"]');
  expect(row).toBeInTheDocument();
  const input = row!.querySelector('input[type="checkbox"]');
  expect(input).toBeInstanceOf(HTMLInputElement);
  return input as HTMLInputElement;
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('AgentFeaturesPanel Agent Elements shell', () => {
  beforeEach(() => {
    mockState.updateSettings.mockClear();
    mockState.updateAIDebugSettings.mockClear();
    mockState.setAutoCommitEnabled.mockClear();
    mockState.capture.mockClear();

    (window as any).electronAPI = {
      claudeCode: {
        getSettings: vi.fn().mockResolvedValue({
          projectCommandsEnabled: true,
          userCommandsEnabled: false,
        }),
      },
      agentWorkflows: {
        getSettings: vi.fn().mockResolvedValue({
          sourceSettings: {
            workspaceClaudeCompatibilityEnabled: true,
            includeProjectClaudeSources: true,
            includeUserClaudeSources: false,
            extensionWorkflowsEnabled: true,
          },
          exportSettings: {
            codexEnabled: true,
            claudeGeneratedExtensionWorkflowsEnabled: false,
          },
        }),
        setSourceSettings: vi.fn().mockResolvedValue({
          workspaceClaudeCompatibilityEnabled: true,
          includeProjectClaudeSources: false,
          includeUserClaudeSources: false,
          extensionWorkflowsEnabled: true,
        }),
        setExportSettings: vi.fn().mockResolvedValue({
          codexEnabled: true,
          claudeGeneratedExtensionWorkflowsEnabled: true,
        }),
      },
      invoke: vi.fn((channel: string, value?: string) => {
        if (channel === 'preferred-agent-language:get') return Promise.resolve('ja');
        if (channel === 'preferred-agent-language:set') return Promise.resolve(value);
        return Promise.resolve(undefined);
      }),
    };
  });

  it('renders Agent Elements markers while preserving feature settings behavior', async () => {
    render(<AgentFeaturesPanel />);

    await waitFor(() => expect(screen.getByTestId('preferred-agent-language-input')).toHaveValue('ja'));

    const panel = screen.getByTestId('agent-elements-agent-features-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'agent-features-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-agent-features-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-agent-features-core-section')).toHaveAttribute('data-agent-elements-shell', 'agent-feature-section');
    expect(screen.getByTestId('agent-elements-agent-features-experimental-section')).toHaveAttribute('data-agent-elements-shell', 'agent-feature-section');
    expect(screen.getByTestId('agent-elements-agent-features-workflow-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-agent-features-warning')).toHaveAttribute('data-tone', 'warning');

    fireEvent.change(screen.getByTestId('preferred-agent-language-input'), { target: { value: 'Spanish' } });
    expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('preferred-agent-language:set', 'Spanish');

    fireEvent.click(getToggleInput('Auto-approve Commits'));
    expect(mockState.setAutoCommitEnabled).toHaveBeenCalledWith(true);
    expect(mockState.capture).toHaveBeenCalledWith('auto_commit_toggled', { enabled: true });

    await waitFor(() => expect(getToggleInput('Workspace Claude compatibility')).toBeChecked());
    fireEvent.click(getToggleInput('Project .claude sources'));
    await waitFor(() => expect((window as any).electronAPI.agentWorkflows.setSourceSettings).toHaveBeenCalledWith({ includeProjectClaudeSources: false }));

    fireEvent.click(getToggleInput('Claude generated extension workflows'));
    await waitFor(() => expect((window as any).electronAPI.agentWorkflows.setExportSettings).toHaveBeenCalledWith({ claudeGeneratedExtensionWorkflowsEnabled: true }));

    fireEvent.click(getToggleInput('Super Loops'));
    expect(mockState.updateSettings).toHaveBeenCalledWith({
      alphaFeatures: expect.objectContaining({ 'super-loops': true }),
    });
    expect(mockState.capture).toHaveBeenCalledWith('alpha_feature_toggled', {
      feature_tag: 'super-loops',
      enabled: true,
      source: 'agent_features_panel',
    });
  });

  it('preserves workflow loading disabled state inside Agent Elements toggle shells', async () => {
    const sourceUpdate = deferred<{
      workspaceClaudeCompatibilityEnabled: boolean;
      includeProjectClaudeSources: boolean;
      includeUserClaudeSources: boolean;
      extensionWorkflowsEnabled: boolean;
    }>();
    (window as any).electronAPI.agentWorkflows.setSourceSettings.mockReturnValue(sourceUpdate.promise);

    render(<AgentFeaturesPanel />);

    await waitFor(() => expect(getToggleInput('Workspace Claude compatibility')).toBeChecked());

    fireEvent.click(getToggleInput('Workspace Claude compatibility'));
    expect((window as any).electronAPI.agentWorkflows.setSourceSettings).toHaveBeenCalledWith({
      workspaceClaudeCompatibilityEnabled: false,
    });

    await waitFor(() => expect(getToggleInput('Workspace Claude compatibility')).toBeDisabled());
    expect(getToggleInput('Project .claude sources')).toBeDisabled();
    expect(getToggleInput('Extension workflows')).toBeDisabled();

    await act(async () => {
      sourceUpdate.resolve({
        workspaceClaudeCompatibilityEnabled: false,
        includeProjectClaudeSources: true,
        includeUserClaudeSources: false,
        extensionWorkflowsEnabled: true,
      });
      await sourceUpdate.promise;
    });

    await waitFor(() => expect(getToggleInput('Workspace Claude compatibility')).not.toBeDisabled());
  });
});
