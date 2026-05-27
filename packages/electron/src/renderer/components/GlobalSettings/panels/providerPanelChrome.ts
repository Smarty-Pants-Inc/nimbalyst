export type ProviderTestStatus = 'idle' | 'testing' | 'success' | 'error' | undefined;

interface ProviderPanelChromeOptions {
  headerClassName: string;
  sectionClassName: string;
  configCardClassName: string;
  inputClassName: string;
  loadingClassName: string;
  modelRowClassName: string;
  testButtonClassName: string;
  testErrorClassName: string;
  emptyClassName: string;
}

const cardPaddingClass =
  '[--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';
const buttonBaseClass =
  'inline-flex cursor-pointer items-center justify-center rounded-[var(--an-small-border-radius)] border px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-sm font-medium transition-[background-color,border-color,color,opacity] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60';

export function createProviderPanelChrome(options: ProviderPanelChromeOptions) {
  const secondaryButtonClass =
    `${buttonBaseClass} border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] text-[var(--an-foreground-muted)] hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-secondary)] hover:text-[var(--an-foreground)]`;
  const primaryButtonClass =
    `${buttonBaseClass} border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-send-button-color)] hover:border-[color-mix(in_srgb,var(--an-primary-color)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))]`;

  return {
    header:
      `${options.headerClassName} agent-elements-settings-panel-header mb-[var(--an-spacing-xxl)] border-b border-[var(--an-border-color)] pb-[var(--an-spacing-xl)]`,
    title:
      'provider-panel-title mb-[var(--an-spacing-sm)] text-xl font-semibold leading-tight text-[var(--an-foreground)]',
    description:
      'provider-panel-description text-sm leading-relaxed text-[var(--an-foreground-muted)]',
    section:
      `${options.sectionClassName} agent-elements-settings-section mb-[var(--an-spacing-xl)] border-b border-[var(--an-border-color)] py-[var(--an-spacing-xl)] last:mb-0 last:border-b-0 last:pb-0`,
    sectionTitle:
      'provider-panel-section-title mb-[var(--an-spacing-lg)] text-base font-semibold text-[var(--an-foreground)]',
    configCard:
      `${options.configCardClassName} agent-elements-tool-card mt-[var(--an-spacing-lg)] ${cardPaddingClass}`,
    input:
      `${options.inputClassName} flex-1 rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] font-mono text-[var(--an-input-color)] outline-none transition-[background-color,border-color,color] duration-150 ease-out placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-border)] focus:ring-2 focus:ring-[var(--an-focus-ring)]`,
    secondaryButton: secondaryButtonClass,
    primaryButton: primaryButtonClass,
    modelActionButton:
      `models-action-btn ${secondaryButtonClass} px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-xs`,
    modelsHeaderText:
      'text-sm text-[var(--an-foreground-muted)]',
    loadingText:
      `${options.loadingClassName} py-[var(--an-spacing-sm)] text-sm text-[var(--an-foreground-muted)]`,
    emptyText:
      `${options.emptyClassName} py-[var(--an-spacing-sm)] text-sm text-[var(--an-foreground-muted)]`,
    modelRow:
      `${options.modelRowClassName} agent-elements-tool-card flex-row items-center gap-[var(--an-spacing-md)] cursor-pointer hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] ${cardPaddingClass}`,
    checkbox:
      'h-4 w-4 cursor-pointer accent-[var(--an-primary-color)]',
    modelName:
      'text-sm text-[var(--an-foreground)]',
    testButtonClassName: options.testButtonClassName,
    testError:
      `${options.testErrorClassName} mt-[var(--an-spacing-sm)] text-xs text-[var(--an-error-color)]`,
  };
}

export function getProviderTestButtonClass(
  testStatus: ProviderTestStatus,
  chrome: ReturnType<typeof createProviderPanelChrome>,
) {
  const statusClass =
    testStatus === 'success'
      ? 'border-[color-mix(in_srgb,var(--an-success-color)_38%,var(--an-border-color))] text-[var(--an-success-color)]'
      : testStatus === 'error'
        ? 'border-[color-mix(in_srgb,var(--an-error-color)_44%,var(--an-border-color))] text-[var(--an-error-color)]'
        : '';

  return `${chrome.testButtonClassName} whitespace-nowrap ${chrome.secondaryButton} ${
    testStatus === 'testing' ? 'cursor-wait opacity-60' : ''
  } ${statusClass}`;
}
