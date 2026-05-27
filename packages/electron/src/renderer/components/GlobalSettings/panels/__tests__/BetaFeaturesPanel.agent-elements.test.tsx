// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/BetaFeaturesPanel.tsx',
);
const chromeSourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/providerPanelChrome.ts',
);
const legacyVisualChromePattern =
  /bg-nim|text-nim|border-nim|bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-|rgba\(|#[0-9a-fA-F]{3,8}\b|bg-white|rounded-lg|transition-all|text-white/;

const mockState = vi.hoisted(() => ({
  tokens: {
    advancedSettingsAtom: 'advancedSettingsAtom',
    setAdvancedSettingsAtom: 'setAdvancedSettingsAtom',
  },
  settings: {
    betaFeatures: {
      quickReview: false,
    },
    enableAllBetaFeatures: false,
  },
  updateSettings: vi.fn(),
  capture: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.advancedSettingsAtom) return [mockState.settings, vi.fn()];
    if (atom === mockState.tokens.setAdvancedSettingsAtom) return [null, mockState.updateSettings];
    return [null, vi.fn()];
  }),
}));

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockState.capture }),
}));

vi.mock('../../../../store/atoms/appSettings', () => ({
  advancedSettingsAtom: mockState.tokens.advancedSettingsAtom,
  setAdvancedSettingsAtom: mockState.tokens.setAdvancedSettingsAtom,
}));

vi.mock('../../../../../shared/betaFeatures', () => ({
  BETA_FEATURES: [
    {
      tag: 'quickReview',
      name: 'Quick Review',
      description: 'Try a faster review loop.',
      icon: 'rate_review',
    },
  ],
  areAllBetaFeaturesEnabled: vi.fn(() => false),
  enableAllBetaFeatures: vi.fn(() => ({ quickReview: true })),
  disableAllBetaFeatures: vi.fn(() => ({ quickReview: false })),
}));

import { BetaFeaturesPanel } from '../BetaFeaturesPanel';

describe('BetaFeaturesPanel Agent Elements shell', () => {
  beforeEach(() => {
    mockState.updateSettings.mockClear();
    mockState.capture.mockClear();
    mockState.settings.betaFeatures = { quickReview: false };
    mockState.settings.enableAllBetaFeatures = false;
  });

  it('renders Agent Elements markers while preserving master and individual beta feature toggles', () => {
    render(<BetaFeaturesPanel />);

    const panel = screen.getByTestId('agent-elements-beta-features-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'beta-features-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-beta-features-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-beta-features-section')).toHaveAttribute('data-agent-elements-shell', 'beta-features-section');
    expect(screen.getByTestId('agent-elements-beta-features-master-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByTestId('agent-elements-beta-features-master-card')).toHaveAttribute('data-agent-elements-shell', 'beta-features-master-card');
    expect(screen.getByTestId('agent-elements-beta-feature-row-quickReview')).toHaveAttribute('data-beta-feature-tag', 'quickReview');
    expect(screen.getByTestId('agent-elements-beta-features-note')).toHaveAttribute('data-tone', 'warning');

    const checkboxes = within(panel).getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(mockState.updateSettings).toHaveBeenCalledWith({
      enableAllBetaFeatures: true,
      betaFeatures: { quickReview: true },
    });
    expect(mockState.capture).toHaveBeenCalledWith('beta_feature_toggled', {
      feature_tag: 'all',
      enabled: true,
    });

    fireEvent.click(screen.getByLabelText(/Quick Review/));
    expect(mockState.updateSettings).toHaveBeenCalledWith({
      betaFeatures: { quickReview: true },
    });
    expect(mockState.capture).toHaveBeenCalledWith('beta_feature_toggled', {
      feature_tag: 'quickReview',
      enabled: true,
    });
  });

  it('keeps beta feature chrome on Agent Elements aliases instead of legacy visual tokens', () => {
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
