// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorktreeOnboardingModal } from '../WorktreeOnboardingModal';

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
  };
});

describe('WorktreeOnboardingModal Agent Elements shell', () => {
  it('renders an Agent Elements worktree onboarding shell while preserving modal actions', () => {
    const onCancel = vi.fn();
    const onContinue = vi.fn();

    const { rerender } = render(
      <WorktreeOnboardingModal
        isOpen={false}
        onCancel={onCancel}
        onContinue={onContinue}
      />
    );

    expect(screen.queryByTestId('agent-elements-worktree-onboarding')).not.toBeInTheDocument();

    rerender(
      <WorktreeOnboardingModal
        isOpen={true}
        onCancel={onCancel}
        onContinue={onContinue}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-worktree-onboarding-backdrop');
    expect(backdrop).toHaveClass(
      'worktree-onboarding-overlay',
      'agent-elements-worktree-onboarding-backdrop'
    );
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'worktree-onboarding-backdrop');

    const dialog = screen.getByTestId('agent-elements-worktree-onboarding');
    expect(dialog).toHaveClass(
      'worktree-onboarding-dialog',
      'agent-elements-worktree-onboarding',
      'agent-elements-tool-card'
    );
    expect(dialog).toHaveAttribute('data-component', 'WorktreeOnboardingModal');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'worktree-onboarding');

    expect(screen.getByTestId('agent-elements-worktree-onboarding-header')).toHaveTextContent(
      'What is a Worktree?'
    );
    expect(screen.getByTestId('agent-elements-worktree-onboarding-benefits')).toHaveAttribute(
      'data-agent-elements-shell',
      'worktree-onboarding-benefits'
    );
    expect(screen.getAllByTestId('agent-elements-worktree-onboarding-benefit')).toHaveLength(3);

    fireEvent.click(dialog);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Create Worktree' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
