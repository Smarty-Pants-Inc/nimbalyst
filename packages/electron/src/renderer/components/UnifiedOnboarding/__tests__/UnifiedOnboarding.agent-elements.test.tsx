// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedOnboarding } from '../UnifiedOnboarding';

const sourcePath = resolve(__dirname, '../UnifiedOnboarding.tsx');
const stylePath = resolve(__dirname, '../UnifiedOnboarding.css');

function renderUnifiedOnboarding(overrides: Partial<React.ComponentProps<typeof UnifiedOnboarding>> = {}) {
  const props: React.ComponentProps<typeof UnifiedOnboarding> = {
    isOpen: true,
    onComplete: vi.fn(),
    onSkip: vi.fn(),
    forcedMode: null,
    ...overrides,
  };

  const view = render(<UnifiedOnboarding {...props} />);
  return { props, ...view };
}

describe('UnifiedOnboarding Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: vi.fn().mockResolvedValue({
          userRole: null,
          unifiedOnboardingCompleted: false,
        }),
      },
    });
  });

  it('renders an Agent Elements shell while preserving mode selection behavior', async () => {
    const onComplete = vi.fn();
    renderUnifiedOnboarding({ onComplete, forcedMode: 'new' });

    const backdrop = document.querySelector('.agent-elements-unified-onboarding-backdrop');
    expect(backdrop).toHaveClass('unified-onboarding-overlay', 'agent-elements-unified-onboarding-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'unified-onboarding-backdrop');

    const dialog = document.querySelector('.agent-elements-unified-onboarding');
    expect(dialog).toHaveClass(
      'unified-onboarding-dialog',
      'agent-elements-unified-onboarding',
      'agent-elements-tool-card'
    );
    expect(dialog).toHaveAttribute('data-component', 'UnifiedOnboarding');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'unified-onboarding');

    expect(document.querySelector('[data-agent-elements-shell="unified-onboarding-header"]')).toHaveTextContent(
      'Welcome to Nimbalyst'
    );
    expect(document.querySelector('[data-agent-elements-shell="unified-onboarding-content"]')).toBeInTheDocument();
    expect(document.querySelector('[data-agent-elements-shell="unified-onboarding-mode-selection"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-agent-elements-shell="unified-onboarding-mode-option"]')).toHaveLength(2);
    expect(document.querySelector('[data-agent-elements-shell="unified-onboarding-footer"]')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Developer Mode'));

    await waitFor(() => {
      expect(screen.getByLabelText('What best describes your role?')).toHaveValue('developer');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'developer',
        customRole: null,
        developerMode: true,
      })
    );
  });

  it('keeps new-user data collection disabled until a mode is selected', () => {
    renderUnifiedOnboarding({ forcedMode: 'new' });

    expect(screen.getByLabelText('What best describes your role?')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeDisabled();

    fireEvent.click(screen.getByText('Standard Mode'));

    expect(screen.getByLabelText('What best describes your role?')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Get Started' })).not.toBeDisabled();
  });

  it('keeps the Unified Onboarding shell on Agent Elements aliases instead of legacy visual chrome', () => {
    const source = `${readFileSync(sourcePath, 'utf8')}\n${readFileSync(stylePath, 'utf8')}`;

    expect(source).toContain('agent-elements-unified-onboarding');
    expect(source).toContain('data-agent-elements-shell="unified-onboarding"');
    expect(source).toContain('var(--an-background)');
    expect(source).toContain('var(--an-border-color)');
    expect(source).toContain('var(--an-input-background)');
    expect(source).not.toContain('var(--nim-');
    expect(source).not.toContain('rgba(');
    expect(source).not.toContain('color: white');
    expect(source).not.toContain('border: 2px solid');
    expect(source).not.toContain('translateY(-');
    expect(source).not.toContain('scale(');
  });
});
