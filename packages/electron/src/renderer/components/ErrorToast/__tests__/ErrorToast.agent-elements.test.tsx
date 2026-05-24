// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorToastContainer } from '../ErrorToast';
import { errorNotificationService } from '../../../services/ErrorNotificationService';

const copyToClipboardMock = vi.hoisted(() => vi.fn());

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
    }: {
      icon: string;
      size?: number;
      className?: string;
    }) =>
      ReactModule.createElement('span', {
        'data-material-symbol': icon,
        'data-size': size,
        className,
      }),
    copyToClipboard: copyToClipboardMock,
  };
});

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

describe('ErrorToast Agent Elements shell', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let consoleInfo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorNotificationService.clearAll();
    copyToClipboardMock.mockClear();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorNotificationService.clearAll();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    consoleInfo.mockRestore();
  });

  it('renders Agent Elements toast chrome while preserving dismiss, action, and copy details behavior', () => {
    const action = vi.fn();

    render(<ErrorToastContainer />);

    expect(screen.queryByTestId('agent-elements-error-toast-container')).not.toBeInTheDocument();

    act(() => {
      errorNotificationService.showWarning('Sync stalled', 'Retry the sync connection.', {
        details: 'HTTP 503 from sync worker',
        duration: 0,
        action: {
          label: 'Retry',
          onClick: action,
        },
      });
    });

    const container = screen.getByTestId('agent-elements-error-toast-container');
    expect(container).toHaveClass('error-toast-container', 'agent-elements-error-toast-container');
    expect(container).toHaveAttribute('data-component', 'ErrorToastContainer');
    expect(container).toHaveAttribute('data-agent-elements-shell', 'error-toast-container');

    const toast = screen.getByRole('alert');
    expect(toast).toHaveClass('error-toast', 'agent-elements-error-toast', 'agent-elements-tool-card');
    expect(toast).toHaveAttribute('data-agent-elements-shell', 'error-toast');
    expect(toast).toHaveAttribute('data-severity', 'warning');
    expect(toast).toHaveTextContent('Sync stalled');
    expect(toast).toHaveTextContent('Retry the sync connection.');
    expect(screen.getByTestId('agent-elements-error-toast-icon')).toHaveAttribute(
      'data-agent-elements-shell',
      'error-toast-icon'
    );
    expect(screen.getByTestId('agent-elements-error-toast-icon').querySelector('[data-material-symbol="warning"]'))
      .toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-error-toast-message')).toHaveClass('select-text');
    expect(screen.getByTestId('agent-elements-error-toast-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'error-toast-actions'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      errorNotificationService.showError('Renderer failed', 'The panel crashed.', {
        details: 'Stack collapsed',
        stack: 'Error: boom',
        context: { component: 'Panel' },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /copy details/i }));
    expect(copyToClipboardMock).toHaveBeenCalledWith(expect.stringContaining('Renderer failed'));
    expect(copyToClipboardMock).toHaveBeenCalledWith(expect.stringContaining('Stack collapsed'));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders severity-specific Agent Elements icons and avoids raw emoji or hardcoded visual chrome', () => {
    render(<ErrorToastContainer />);

    act(() => {
      errorNotificationService.showInfo('Tips enabled', 'Workflow tips will appear here.', { duration: 0 });
      errorNotificationService.showError('Build failed', 'The renderer build failed.');
    });

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByText('Tips enabled').closest('.error-toast')).toHaveAttribute('data-severity', 'info');
    expect(screen.getByText('Build failed').closest('.error-toast')).toHaveAttribute('data-severity', 'error');
    expect(screen.getAllByTestId('agent-elements-error-toast-icon')[0].textContent ?? '').not.toMatch(/[🚨⚠️ℹ️]/u);
    expect(screen.getAllByTestId('agent-elements-error-toast-icon')[1].textContent ?? '').not.toMatch(/[🚨⚠️ℹ️]/u);

    const source = ErrorToastContainer.toString();
    expect(source).not.toMatch(/border-l-\[#[0-9a-fA-F]{6}\]|bg-\[#[0-9a-fA-F]{6}\]|dark:bg-\[#[0-9a-fA-F]{6}\]/);
    expect(source).not.toContain('rounded-lg');
    expect(source).not.toContain('shadow-[0_4px_12px_rgba');
  });
});
