import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="error-boundary-fallback agent-elements-error-boundary agent-elements-tool-card flex min-h-[240px] w-full items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xxl)] text-[var(--an-foreground)] [container-type:inline-size]"
          data-testid="agent-elements-error-boundary"
          data-component="ErrorBoundary"
          data-agent-elements-shell="error-boundary"
        >
          <div
            className="agent-elements-error-boundary-content flex w-full max-w-[520px] flex-col items-start gap-[var(--an-spacing-lg)] text-left"
            data-agent-elements-shell="error-boundary-content"
          >
            <div className="flex items-start gap-3">
              <span
                className="agent-elements-error-boundary-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--nim-error)_30%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-error)_10%,var(--an-background))] text-[var(--nim-error)]"
                aria-hidden="true"
                data-agent-elements-shell="error-boundary-icon"
              >
                !
              </span>
              <div className="min-w-0">
                <h3 className="m-0 text-base font-medium leading-snug text-[var(--an-foreground)]">
                  Something went wrong
                </h3>
                <p
                  className="m-0 mt-1 select-text text-sm leading-relaxed text-[var(--an-foreground-muted)]"
                  data-testid="agent-elements-error-boundary-message"
                  data-agent-elements-shell="error-boundary-message"
                >
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
            <button
              onClick={this.handleReset}
              className="agent-elements-error-boundary-retry rounded-[var(--an-input-border-radius)] border border-[var(--an-send-button-bg)] bg-[var(--an-send-button-bg)] px-4 py-2 text-sm font-medium text-[var(--an-send-button-color)] transition-colors duration-150 ease-out hover:bg-[var(--nim-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
              data-testid="agent-elements-error-boundary-retry"
              data-agent-elements-shell="error-boundary-retry"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
