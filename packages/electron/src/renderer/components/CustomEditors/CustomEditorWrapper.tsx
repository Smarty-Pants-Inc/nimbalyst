/**
 * Custom Editor Wrapper
 *
 * Provides runtime protection for custom editor components:
 * - Error boundary to catch render errors
 * - Render loop detection to prevent infinite re-renders
 * - Graceful error display with recovery options
 */

import React, { Component, useRef, useEffect, useState, useCallback } from 'react';
import type { EditorHost } from '@nimbalyst/runtime';
import { MaterialSymbol } from '@nimbalyst/runtime';
import type { CustomEditorComponent } from './types';

interface CustomEditorWrapperProps {
  component: CustomEditorComponent;
  host: EditorHost;
  extensionId?: string;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// Configuration for render loop detection
const MAX_RENDERS_PER_SECOND = 60;
const RENDER_WINDOW_MS = 1000;
const RENDER_LOOP_THRESHOLD = MAX_RENDERS_PER_SECOND * 2; // Give some buffer
const CUSTOM_EDITOR_ERROR_CARD_PADDING_CLASS =
  '[--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';

/**
 * Error Boundary component that catches render errors
 */
class CustomEditorErrorBoundary extends Component<
  { children: React.ReactNode; extensionId?: string; componentName?: string; onReset: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; extensionId?: string; componentName?: string; onReset: () => void }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CustomEditorWrapper] Custom editor crashed:', {
      extensionId: this.props.extensionId,
      componentName: this.props.componentName,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          extensionId={this.props.extensionId}
          componentName={this.props.componentName}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Error fallback UI component
 */
const ErrorFallback: React.FC<{
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  extensionId?: string;
  componentName?: string;
  onRetry: () => void;
  isRenderLoop?: boolean;
}> = ({ error, errorInfo, extensionId, componentName, onRetry, isRenderLoop }) => {
  return (
    <div
      className="custom-editor-error agent-elements-custom-editor-error flex h-full items-center justify-center bg-[var(--an-background)] p-[var(--an-spacing-xxl)] text-[var(--an-foreground)]"
      data-agent-elements-shell="custom-editor-error"
      data-testid="agent-elements-custom-editor-error"
    >
      <div
        className={`custom-editor-error-content agent-elements-tool-card w-full max-w-[540px] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-tool-background)] text-left text-[var(--an-tool-color)] ${CUSTOM_EDITOR_ERROR_CARD_PADDING_CLASS}`}
        data-agent-elements-card-padding="symmetric-inline"
        data-agent-elements-card-width="bounded-fallback"
        data-testid="agent-elements-custom-editor-error-content"
      >
        <div
          className={`custom-editor-error-icon mb-[var(--an-spacing-md)] flex h-9 w-9 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] ${isRenderLoop ? 'text-[var(--an-warning-color)]' : 'text-[var(--an-error-color)]'}`}
          aria-hidden="true"
        >
          <MaterialSymbol icon={isRenderLoop ? 'loop' : 'error'} size={22} />
        </div>
        <h2 className="m-0 mb-[var(--an-spacing-sm)] text-[15px] font-medium leading-snug text-[var(--an-tool-color)]">
          {isRenderLoop ? 'Render Loop Detected' : 'Custom Editor Error'}
        </h2>
        {extensionId && (
          <p
            className="custom-editor-error-extension m-0 mb-[var(--an-spacing-md)] flex flex-wrap items-center gap-1.5 text-[12px] leading-normal text-[var(--an-tool-color-muted)]"
            data-testid="agent-elements-custom-editor-error-meta"
          >
            <span>Extension:</span>
            <code className="rounded-[var(--an-radius-xs)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--an-tool-color)]">
              {extensionId}
            </code>
            {componentName && (
              <>
                <span>/ Component:</span>
                <code className="rounded-[var(--an-radius-xs)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--an-tool-color)]">
                  {componentName}
                </code>
              </>
            )}
          </p>
        )}
        <p className="custom-editor-error-message m-0 mb-[var(--an-spacing-lg)] text-sm leading-normal text-[var(--an-tool-color-muted)]">
          {isRenderLoop
            ? 'The custom editor is rendering too rapidly, which may indicate an infinite loop. This has been stopped to prevent freezing.'
            : error?.message || 'An unexpected error occurred while rendering the custom editor.'}
        </p>
        {error?.stack && !isRenderLoop && (
          <details className="custom-editor-error-details m-0 mb-[var(--an-spacing-lg)] text-left">
            <summary className="cursor-pointer rounded-[var(--an-radius-sm)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-[13px] text-[var(--an-tool-color-muted)] transition-colors duration-150 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-tool-color)]">
              Error Details
            </summary>
            <pre
              className="custom-editor-error-stack agent-elements-custom-editor-error-stack mt-[var(--an-spacing-sm)] max-h-[200px] overflow-y-auto overflow-x-auto whitespace-pre-wrap break-words rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-code-background)] p-[var(--an-spacing-md)] font-mono text-[11px] leading-normal text-[var(--an-code-color)]"
              data-testid="agent-elements-custom-editor-error-stack"
            >
              {error.stack}
            </pre>
          </details>
        )}
        {isRenderLoop && (
          <div className="custom-editor-error-hint m-0 mb-[var(--an-spacing-lg)] rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-warning-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_10%,var(--an-tool-background))] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-left">
            <strong className="mb-[var(--an-spacing-sm)] block text-[13px] text-[var(--an-tool-color)]">
              Common causes:
            </strong>
            <ul className="m-0 pl-5 text-xs leading-relaxed text-[var(--an-tool-color-muted)]">
              <li>State updates in useEffect without proper dependencies</li>
              <li>Callback props recreated on every render</li>
              <li>Object/array references changing on every render</li>
            </ul>
          </div>
        )}
        <div className="custom-editor-error-actions flex justify-start gap-3">
          <button
            className="custom-editor-error-retry agent-elements-custom-editor-error-retry nim-btn-primary"
            onClick={onRetry}
          >
            <MaterialSymbol icon="refresh" size={18} />
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Render loop detection hook
 */
function useRenderLoopDetection(
  extensionId?: string,
  componentName?: string
): { isLooping: boolean; resetLoopDetection: () => void } {
  const renderCountRef = useRef(0);
  const windowStartRef = useRef(Date.now());
  const [isLooping, setIsLooping] = useState(false);

  // Increment render count on each render
  useEffect(() => {
    const now = Date.now();

    // Reset window if it's been too long
    if (now - windowStartRef.current > RENDER_WINDOW_MS) {
      renderCountRef.current = 0;
      windowStartRef.current = now;
    }

    renderCountRef.current++;

    // Check for render loop
    if (renderCountRef.current > RENDER_LOOP_THRESHOLD) {
      console.error('[CustomEditorWrapper] Render loop detected:', {
        extensionId,
        componentName,
        renderCount: renderCountRef.current,
        windowMs: now - windowStartRef.current,
      });
      setIsLooping(true);
    }
  });

  const resetLoopDetection = useCallback(() => {
    renderCountRef.current = 0;
    windowStartRef.current = Date.now();
    setIsLooping(false);
  }, []);

  return { isLooping, resetLoopDetection };
}

/**
 * Custom Editor Wrapper Component
 *
 * Wraps custom editor components with:
 * - Error boundary for catching render errors
 * - Render loop detection to prevent freezing
 * - Graceful error display with recovery options
 *
 * Note: Not memoized to allow re-renders when host properties (like theme) change.
 */
export const CustomEditorWrapper: React.FC<CustomEditorWrapperProps> = ({
  component: CustomEditorComponent,
  host,
  extensionId,
  componentName,
}) => {
  const [resetKey, setResetKey] = useState(0);
  const { isLooping, resetLoopDetection } = useRenderLoopDetection(extensionId, componentName);

  const handleReset = useCallback(() => {
    resetLoopDetection();
    setResetKey((k) => k + 1);
  }, [resetLoopDetection]);

  if (isLooping) {
    return (
      <ErrorFallback
        error={null}
        errorInfo={null}
        extensionId={extensionId}
        componentName={componentName}
        onRetry={handleReset}
        isRenderLoop
      />
    );
  }

  return (
    <div className="custom-editor-wrapper flex-1 w-full h-full min-h-0 overflow-hidden">
      <CustomEditorErrorBoundary
        key={resetKey}
        extensionId={extensionId}
        componentName={componentName}
        onReset={handleReset}
      >
        <CustomEditorComponent host={host} />
      </CustomEditorErrorBoundary>
    </div>
  );
};
