// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackIntakeDialog } from '../FeedbackIntakeDialog';

const posthogCaptureMock = vi.hoisted(() => vi.fn());

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({
    capture: posthogCaptureMock,
  }),
}));

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
        'data-icon': icon,
        'data-size': size,
        className,
      }),
  };
});

function installElectronApi() {
  const invoke = vi.fn(() => Promise.resolve());

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke },
  });

  return { invoke };
}

describe('FeedbackIntakeDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installElectronApi();
  });

  it('renders an Agent Elements intake shell while preserving close and overlay behavior', () => {
    const onClose = vi.fn();
    const onLaunch = vi.fn();

    const { rerender } = render(
      <FeedbackIntakeDialog isOpen={false} onClose={onClose} onLaunch={onLaunch} />
    );

    expect(screen.queryByTestId('agent-elements-feedback-intake-dialog')).not.toBeInTheDocument();

    rerender(<FeedbackIntakeDialog isOpen={true} onClose={onClose} onLaunch={onLaunch} />);

    const backdrop = screen.getByTestId('agent-elements-feedback-intake-backdrop');
    expect(backdrop).toHaveClass('feedback-intake-overlay', 'agent-elements-feedback-intake-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'feedback-intake-backdrop');

    const dialog = screen.getByTestId('agent-elements-feedback-intake-dialog');
    expect(dialog).toHaveClass('feedback-intake-dialog', 'agent-elements-feedback-intake-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'FeedbackIntakeDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'feedback-intake-dialog');

    expect(screen.getByTestId('agent-elements-feedback-intake-header')).toHaveTextContent(
      'Send better feedback with your Agent'
    );
    expect(screen.getByTestId('agent-elements-feedback-intake-options')).toHaveAttribute(
      'data-agent-elements-shell',
      'feedback-intake-options'
    );
    expect(screen.getByTestId('agent-elements-feedback-intake-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'feedback-intake-actions'
    );
    expect(screen.getByTestId('agent-elements-feedback-intake-footer')).toHaveAttribute(
      'data-agent-elements-shell',
      'feedback-intake-footer'
    );

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('agent-elements-feedback-intake-close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('preserves bug selection, log-consent toggling, launch payload, and analytics', () => {
    const onClose = vi.fn();
    const onLaunch = vi.fn();

    render(<FeedbackIntakeDialog isOpen={true} onClose={onClose} onLaunch={onLaunch} />);

    expect(screen.getByTestId('feedback-intake-start')).toBeDisabled();

    fireEvent.click(screen.getByTestId('feedback-intake-select-bug'));
    expect(posthogCaptureMock).toHaveBeenCalledWith('feedback_intake_type_selected', {
      kind: 'bug',
      mayGatherLogs: true,
    });

    const detail = screen.getByTestId('agent-elements-feedback-intake-detail');
    expect(detail).toHaveAttribute('data-agent-elements-shell', 'feedback-intake-detail');

    fireEvent.click(screen.getByTestId('feedback-intake-consent'));
    fireEvent.click(screen.getByRole('button', { name: /start bug report/i }));

    expect(posthogCaptureMock).toHaveBeenCalledWith('feedback_intake_launched', {
      kind: 'bug',
      mayGatherLogs: false,
    });
    expect(onLaunch).toHaveBeenCalledWith({ kind: 'bug', mayGatherLogs: false });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('preserves feature selection, mockup toggling, and launch payload', () => {
    const onClose = vi.fn();
    const onLaunch = vi.fn();

    render(<FeedbackIntakeDialog isOpen={true} onClose={onClose} onLaunch={onLaunch} />);

    fireEvent.click(screen.getByTestId('feedback-intake-select-feature'));
    expect(posthogCaptureMock).toHaveBeenCalledWith('feedback_intake_type_selected', {
      kind: 'feature',
      shouldCreateMockup: false,
    });

    fireEvent.click(screen.getByTestId('feedback-intake-mockup'));
    fireEvent.click(screen.getByRole('button', { name: /start feature request/i }));

    expect(posthogCaptureMock).toHaveBeenCalledWith('feedback_intake_launched', {
      kind: 'feature',
      shouldCreateMockup: true,
    });
    expect(onLaunch).toHaveBeenCalledWith({ kind: 'feature', shouldCreateMockup: true });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('preserves external feedback links and closes after opening them', () => {
    const { invoke } = installElectronApi();
    const onClose = vi.fn();

    render(<FeedbackIntakeDialog isOpen={true} onClose={onClose} onLaunch={vi.fn()} />);

    fireEvent.click(screen.getByTestId('feedback-intake-issues-link'));
    expect(invoke).toHaveBeenCalledWith('open-external', 'https://github.com/nimbalyst/nimbalyst/issues');
    expect(posthogCaptureMock).toHaveBeenCalledWith('feedback_external_link_clicked', { target: 'issues' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('feedback-intake-discussions-link'));
    expect(invoke).toHaveBeenCalledWith('open-external', 'https://github.com/nimbalyst/nimbalyst/discussions');
    expect(posthogCaptureMock).toHaveBeenCalledWith('feedback_external_link_clicked', { target: 'discussions' });
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('feedback-intake-email-link'));
    expect(invoke).toHaveBeenCalledWith('open-external', 'mailto:support@nimbalyst.com');
    expect(posthogCaptureMock).toHaveBeenCalledWith('feedback_external_link_clicked', { target: 'email' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
