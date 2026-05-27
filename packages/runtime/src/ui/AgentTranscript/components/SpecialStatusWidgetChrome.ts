export const SPECIAL_STATUS_BODY_CLASS =
  'select-text text-[0.8125rem] leading-relaxed text-[var(--an-tool-color-muted)]';

export const SPECIAL_STATUS_ACTIONS_CLASS =
  'flex flex-wrap gap-[var(--an-spacing-sm)]';

const SPECIAL_STATUS_BUTTON_BASE =
  'inline-flex cursor-pointer items-center justify-center rounded-[var(--an-radius-sm)] motion-safe:transition-colors motion-safe:duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-60';

const SPECIAL_STATUS_PRIMARY_BUTTON_BASE =
  `${SPECIAL_STATUS_BUTTON_BASE} border border-transparent bg-[var(--an-primary-color)] text-[var(--an-background)] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground)_12%)]`;

const SPECIAL_STATUS_SECONDARY_BUTTON_BASE =
  `${SPECIAL_STATUS_BUTTON_BASE} border border-[var(--an-tool-border-color)] bg-[var(--an-background)] text-[var(--an-tool-color)] hover:bg-[var(--an-background-secondary)]`;

export const SPECIAL_STATUS_INLINE_PRIMARY_BUTTON_CLASS =
  `${SPECIAL_STATUS_PRIMARY_BUTTON_BASE} px-4 py-2 text-sm font-medium`;

export const SPECIAL_STATUS_INLINE_SECONDARY_BUTTON_CLASS =
  `${SPECIAL_STATUS_SECONDARY_BUTTON_BASE} px-4 py-2 text-sm font-medium`;

export const SPECIAL_STATUS_BLOCK_PRIMARY_BUTTON_CLASS =
  `${SPECIAL_STATUS_PRIMARY_BUTTON_BASE} w-full px-5 py-3 text-sm font-semibold disabled:bg-[var(--an-background-tertiary)] disabled:text-[var(--an-foreground-subtle)]`;

export const SPECIAL_STATUS_BLOCK_SECONDARY_BUTTON_CLASS =
  `${SPECIAL_STATUS_SECONDARY_BUTTON_BASE} w-full px-5 py-3 text-sm font-semibold`;
