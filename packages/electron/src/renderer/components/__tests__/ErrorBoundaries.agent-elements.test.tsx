// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';
import { TabEditorErrorBoundary } from '../TabEditorErrorBoundary';

vi.mock('../../utils/logger', () => ({
  logger: {
    ui: {
      error: vi.fn(),
    },
  },
}));

let activeError: Error | null = null;

function ThrowingChild() {
  if (activeError) {
    throw activeError;
  }

  return <div>Recovered content</div>;
}

describe('Error boundary Agent Elements shells', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    activeError = null;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders the global fallback with Agent Elements shell markers while preserving retry and onError behavior', () => {
    const onError = vi.fn();
    activeError = new Error('Renderer exploded');

    render(
      <ErrorBoundary onError={onError}>
        <ThrowingChild />
      </ErrorBoundary>
    );

    const shell = screen.getByTestId('agent-elements-error-boundary');
    expect(shell).toHaveClass('error-boundary-fallback', 'agent-elements-error-boundary', 'agent-elements-tool-card');
    expect(shell).toHaveAttribute('data-component', 'ErrorBoundary');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'error-boundary');
    expect(shell).toHaveTextContent('Something went wrong');
    expect(screen.getByTestId('agent-elements-error-boundary-message')).toHaveTextContent('Renderer exploded');
    expect(onError).toHaveBeenCalledTimes(1);

    activeError = null;
    fireEvent.click(screen.getByTestId('agent-elements-error-boundary-retry'));

    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });

  it('preserves custom fallback rendering for global error boundaries', () => {
    activeError = new Error('Use custom fallback');

    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom fallback</div>}>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toHaveTextContent('Custom fallback');
    expect(screen.queryByTestId('agent-elements-error-boundary')).not.toBeInTheDocument();
  });

  it('renders the tab-editor fallback with Agent Elements shell markers while preserving retry and close actions', () => {
    const onRetry = vi.fn();
    const onClose = vi.fn();
    activeError = new Error('Parser failed');

    render(
      <TabEditorErrorBoundary fileName="broken.md" filePath="/repo/broken.md" onClose={onClose} onRetry={onRetry}>
        <ThrowingChild />
      </TabEditorErrorBoundary>
    );

    const shell = screen.getByTestId('agent-elements-tab-editor-error-boundary');
    expect(shell).toHaveClass(
      'tab-editor-error-fallback',
      'agent-elements-tab-editor-error-boundary',
      'agent-elements-tool-card'
    );
    expect(shell).toHaveAttribute('data-component', 'TabEditorErrorBoundary');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'tab-editor-error-boundary');
    expect(screen.getByTestId('agent-elements-tab-editor-error-boundary-message')).toHaveTextContent(
      'An error occurred while loading "broken.md".'
    );
    expect(screen.getByTestId('agent-elements-tab-editor-error-boundary-detail')).toHaveTextContent('Parser failed');

    activeError = null;
    fireEvent.click(screen.getByTestId('agent-elements-tab-editor-error-boundary-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Recovered content')).toBeInTheDocument();

    activeError = new Error('Close this tab');
    render(
      <TabEditorErrorBoundary fileName="still-broken.md" filePath="/repo/still-broken.md" onClose={onClose}>
        <ThrowingChild />
      </TabEditorErrorBoundary>
    );
    fireEvent.click(screen.getByTestId('agent-elements-tab-editor-error-boundary-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
