/**
 * TabEditorErrorBoundary - Error boundary for individual tab editors
 *
 * Wraps each TabEditor instance to catch errors during rendering or in lifecycle methods.
 * When an error occurs, shows a recovery UI instead of crashing the entire app.
 * Other tabs remain functional.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../../utils/logger';

const TAB_EDITOR_ERROR_CARD_PADDING_CLASS =
  '[--agent-elements-card-block-padding:var(--an-spacing-xxl)] [--agent-elements-card-inline-padding:var(--an-spacing-xxl)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';

interface Props {
  children: ReactNode;
  filePath: string;
  fileName: string;
  onRetry?: () => void;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class TabEditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.ui.error(`[TabEditorErrorBoundary] Error in tab editor for ${this.props.filePath}:`, error);
    logger.ui.error(`[TabEditorErrorBoundary] Component stack:`, errorInfo.componentStack);

    this.setState({ errorInfo });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onRetry?.();
  };

  handleClose = (): void => {
    this.props.onClose?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className={`tab-editor-error-fallback agent-elements-tab-editor-error-boundary agent-elements-tool-card flex h-full w-full items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-tool-background)] text-[var(--an-foreground)] [container-type:inline-size] ${TAB_EDITOR_ERROR_CARD_PADDING_CLASS}`}
          role="alert"
          aria-live="assertive"
          data-testid="agent-elements-tab-editor-error-boundary"
          data-component="TabEditorErrorBoundary"
          data-agent-elements-shell="tab-editor-error-boundary"
          data-agent-elements-card-padding="symmetric-inline"
          data-agent-elements-card-width="bounded-fallback"
        >
          <div
            className="agent-elements-tab-editor-error-boundary-content flex w-full max-w-[540px] flex-col items-start gap-[var(--an-spacing-lg)] text-left"
            data-agent-elements-shell="tab-editor-error-boundary-content"
          >
            <div className="flex items-start gap-3">
              <span
                className="agent-elements-tab-editor-error-boundary-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-diff-removed-text)_30%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-diff-removed-text)_10%,var(--an-background))] text-[var(--an-diff-removed-text)]"
                aria-hidden="true"
                data-agent-elements-shell="tab-editor-error-boundary-icon"
              >
                !
              </span>
              <div className="min-w-0">
                <h3 className="m-0 text-base font-medium leading-snug text-[var(--an-foreground)]">
                  Unable to Load Editor
                </h3>

                <p
                  className="m-0 mt-1 select-text text-sm leading-relaxed text-[var(--an-foreground-muted)]"
                  data-testid="agent-elements-tab-editor-error-boundary-message"
                  data-agent-elements-shell="tab-editor-error-boundary-message"
                >
                  An error occurred while loading "{this.props.fileName}".
                </p>

                <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-subtle)]">
                  Other tabs should continue to work normally.
                </p>
              </div>
            </div>

            {this.state.error && (
              <pre
                className="agent-elements-tab-editor-error-boundary-detail m-0 max-h-[150px] w-full overflow-auto whitespace-pre-wrap break-words rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-lg)] text-left font-mono text-xs leading-relaxed text-[var(--an-foreground-muted)] select-text"
                data-testid="agent-elements-tab-editor-error-boundary-detail"
                data-agent-elements-shell="tab-editor-error-boundary-detail"
              >
                {this.state.error.message}
              </pre>
            )}

            <div
              className="agent-elements-tab-editor-error-boundary-actions flex flex-wrap justify-start gap-2"
              data-agent-elements-shell="tab-editor-error-boundary-actions"
            >
              <button
                onClick={this.handleRetry}
                className="agent-elements-tab-editor-error-boundary-retry rounded-[var(--an-input-border-radius)] border border-[var(--an-send-button-bg)] bg-[var(--an-send-button-bg)] px-4 py-2 text-sm font-medium text-[var(--an-send-button-color)] transition-colors duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                data-testid="agent-elements-tab-editor-error-boundary-retry"
                data-agent-elements-shell="tab-editor-error-boundary-retry"
              >
                Try Again
              </button>

              {this.props.onClose && (
                <button
                  onClick={this.handleClose}
                  className="agent-elements-tab-editor-error-boundary-close rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-4 py-2 text-sm font-medium text-[var(--an-foreground)] transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                  data-testid="agent-elements-tab-editor-error-boundary-close"
                  data-agent-elements-shell="tab-editor-error-boundary-close"
                >
                  Close Tab
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
