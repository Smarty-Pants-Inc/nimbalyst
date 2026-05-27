import React from 'react';
import { useAtom } from 'jotai';
import { usePostHog } from 'posthog-js/react';
import { SettingsToggle } from '../SettingsToggle';
import {
  advancedSettingsAtom,
  setAdvancedSettingsAtom,
} from '../../../store/atoms/appSettings';
import {
  BETA_FEATURES,
  enableAllBetaFeatures as enableAllBetaFeaturesUtil,
  disableAllBetaFeatures,
} from '../../../../shared/betaFeatures';
import { createProviderPanelChrome } from './providerPanelChrome';

/**
 * BetaFeaturesPanel - Settings panel for toggling beta features.
 *
 * Always visible in Settings > Advanced > Beta Features.
 * Unlike alpha features (hidden behind release channel), beta features
 * are user-facing and discoverable.
 */
const chrome = createProviderPanelChrome({
  headerClassName: 'provider-panel-header beta-features-panel-header',
  sectionClassName: 'provider-panel-section beta-features-section',
  configCardClassName: 'beta-features-card',
  inputClassName: 'beta-features-input',
  loadingClassName: 'beta-features-loading',
  modelRowClassName: 'beta-features-row',
  testButtonClassName: 'beta-features-action-button',
  testErrorClassName: 'beta-features-error',
  emptyClassName: 'beta-features-empty',
});

const betaCardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';

export function BetaFeaturesPanel() {
  const posthog = usePostHog();
  const [settings] = useAtom(advancedSettingsAtom);
  const [, updateSettings] = useAtom(setAdvancedSettingsAtom);
  const { betaFeatures, enableAllBetaFeatures } = settings;

  return (
    <div
      className="provider-panel beta-features-panel agent-elements-settings-panel agent-elements-beta-features-panel flex flex-col"
      data-agent-elements-shell="beta-features-panel"
      data-component="BetaFeaturesPanel"
      data-testid="agent-elements-beta-features-panel"
    >
      <div
        className={chrome.header}
        data-agent-elements-shell="beta-features-header"
        data-testid="agent-elements-beta-features-header"
      >
        <h3 className={chrome.title}>
          Beta Features
        </h3>
        <p className={chrome.description}>
          Try out new features before they are generally available. Beta features may not be fully complete or polished, and may be removed in the future.
        </p>
      </div>

      <div
        className={chrome.section}
        data-agent-elements-shell="beta-features-section"
        data-testid="agent-elements-beta-features-section"
      >
        <div
          className={`beta-features-master-card agent-elements-tool-card ${betaCardPaddingClass}`}
          data-agent-elements-shell="beta-features-master-card"
          data-testid="agent-elements-beta-features-master-card"
        >
          {/* "Enable All Beta Features" master toggle */}
          <div className="mb-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)] pb-[var(--an-spacing-lg)]">
            <SettingsToggle
              checked={enableAllBetaFeatures}
              onChange={(enabled) => {
                const newFeatures = enabled ? enableAllBetaFeaturesUtil() : disableAllBetaFeatures();
                updateSettings({
                  enableAllBetaFeatures: enabled,
                  betaFeatures: newFeatures,
                });
                posthog?.capture('beta_feature_toggled', {
                  feature_tag: 'all',
                  enabled,
                });
              }}
              name="Enable All Beta Features"
              description="Automatically enable all current and future beta features."
            />
          </div>

          {/* Individual beta feature toggles */}
          {BETA_FEATURES.map((feature) => (
            <div
              key={feature.tag}
              className={`setting-item beta-feature-row py-[var(--an-spacing-sm)] ${enableAllBetaFeatures ? 'pointer-events-none opacity-60' : ''}`}
              data-agent-elements-shell="beta-feature-row"
              data-beta-feature-tag={feature.tag}
              data-testid={`agent-elements-beta-feature-row-${feature.tag}`}
            >
              <label className="setting-label flex cursor-pointer items-start gap-[var(--an-spacing-md)]">
                <input
                  type="checkbox"
                  checked={betaFeatures[feature.tag] ?? false}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateSettings({ betaFeatures: { ...betaFeatures, [feature.tag]: checked } });
                    posthog?.capture('beta_feature_toggled', {
                      feature_tag: feature.tag,
                      enabled: checked,
                    });
                  }}
                  className="setting-checkbox mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--an-primary-color)]"
                  disabled={enableAllBetaFeatures}
                />
                <div className="setting-text flex flex-col gap-[var(--an-spacing-xxs)]">
                  <span className="setting-name flex items-center gap-[var(--an-spacing-sm)] text-sm font-medium text-[var(--an-foreground)]">
                    {feature.icon && (
                      <span className="material-symbols-outlined text-sm">{feature.icon}</span>
                    )}
                    {feature.name}
                  </span>
                  <span className="setting-description text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                    {feature.description}
                  </span>
                </div>
              </label>
            </div>
          ))}
        </div>
        <p
          className={`beta-features-note agent-elements-tool-card mt-[var(--an-spacing-lg)] text-[13px] text-[var(--an-foreground-muted)] ${betaCardPaddingClass}`}
          data-agent-elements-shell="beta-features-note"
          data-tone="warning"
          data-testid="agent-elements-beta-features-note"
        >
          Some beta features may require restarting Nimbalyst to take effect.
        </p>
      </div>
    </div>
  );
}
