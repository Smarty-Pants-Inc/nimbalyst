import React from 'react';

/**
 * iOS-style toggle switch for settings panels.
 *
 * Two variants:
 * - **inline** (default): Label + description on the left, toggle on the right.
 *   Used for on/off settings within a section.
 * - **enable**: Larger "Enable X" row with bottom border, used as the
 *   primary provider enable toggle at the top of a panel.
 */
export function SettingsToggle({
  checked,
  onChange,
  name,
  description,
  disabled,
  variant = 'inline',
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  name: string;
  description?: string;
  disabled?: boolean;
  /** 'inline' for compact rows, 'enable' for the primary provider toggle */
  variant?: 'inline' | 'enable';
  testId?: string;
}) {
  const rowClassName = variant === 'enable'
    ? 'provider-enable agent-elements-settings-toggle agent-elements-settings-toggle--enable flex items-center justify-between gap-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)] py-[var(--an-spacing-lg)] mb-[var(--an-spacing-lg)]'
    : 'settings-toggle agent-elements-settings-toggle agent-elements-settings-toggle--inline flex items-center justify-between gap-[var(--an-spacing-lg)] py-[var(--an-spacing-md)]';

  if (variant === 'enable') {
    return (
      <div
        className={rowClassName}
        data-agent-elements-shell="settings-enable-toggle"
        data-settings-toggle-variant="enable"
        data-testid={testId}
      >
        <div className="settings-toggle-copy min-w-0 pr-[var(--an-spacing-lg)]">
          <span className="provider-enable-label settings-toggle-label block truncate text-sm font-medium text-[var(--an-foreground)]">{name}</span>
          {description && (
            <p className="settings-toggle-description mt-[var(--an-spacing-xxs)] text-xs leading-snug text-[var(--an-foreground-muted)]">{description}</p>
          )}
        </div>
        <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={name} />
      </div>
    );
  }

  return (
    <div
      className={rowClassName}
      data-agent-elements-shell="settings-inline-toggle"
      data-settings-toggle-variant="inline"
      data-testid={testId}
    >
      <div className="settings-toggle-copy min-w-0 pr-[var(--an-spacing-lg)]">
        <span className="settings-toggle-label block truncate text-sm font-medium text-[var(--an-foreground)]">{name}</span>
        {description && (
          <p className="settings-toggle-description mt-[var(--an-spacing-xxs)] text-xs leading-snug text-[var(--an-foreground-muted)]">{description}</p>
        )}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={name} />
    </div>
  );
}

/** The raw toggle switch control without any label/layout. */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <label
      className={`toggle-switch agent-elements-toggle-switch relative inline-flex h-6 w-11 shrink-0 items-center ${disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
      data-agent-elements-shell="toggle-switch"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          if (disabled) return;
          onChange(e.target.checked);
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        className="peer sr-only"
      />
      <span className="agent-elements-toggle-track pointer-events-none absolute inset-0 rounded-[999px] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] transition-[background-color,border-color,box-shadow] duration-150 ease-out peer-checked:border-[var(--an-primary-color)] peer-checked:bg-[var(--an-primary-color)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--an-focus-ring)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--an-background)]" />
      <span className="agent-elements-toggle-thumb pointer-events-none relative ml-0.5 h-5 w-5 rounded-[999px] border border-[color-mix(in_srgb,var(--an-border-color)_62%,transparent)] bg-[var(--an-background)] transition-transform duration-150 ease-out peer-checked:translate-x-5" />
    </label>
  );
}
