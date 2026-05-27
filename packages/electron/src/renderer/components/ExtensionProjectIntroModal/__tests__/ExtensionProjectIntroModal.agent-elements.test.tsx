// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExtensionProjectIntroModal } from '../ExtensionProjectIntroModal';

const sourcePath = resolve(__dirname, '../ExtensionProjectIntroModal.tsx');

describe('ExtensionProjectIntroModal Agent Elements shell', () => {
  it('renders Agent Elements onboarding chrome while preserving modal actions', () => {
    const onCancel = vi.fn();
    const onContinue = vi.fn();
    const onDontShowAgain = vi.fn();

    const { rerender } = render(
      <ExtensionProjectIntroModal
        isOpen={false}
        onCancel={onCancel}
        onContinue={onContinue}
        onDontShowAgain={onDontShowAgain}
      />,
    );

    expect(screen.queryByTestId('agent-elements-extension-project-intro')).not.toBeInTheDocument();

    rerender(
      <ExtensionProjectIntroModal
        isOpen
        onCancel={onCancel}
        onContinue={onContinue}
        onDontShowAgain={onDontShowAgain}
      />,
    );

    const backdrop = screen.getByTestId('agent-elements-extension-project-intro-backdrop');
    expect(backdrop).toHaveClass(
      'extension-project-intro-overlay',
      'agent-elements-extension-project-intro-backdrop',
    );
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'extension-project-intro-backdrop');

    const dialog = screen.getByTestId('agent-elements-extension-project-intro');
    expect(dialog).toHaveClass(
      'extension-project-intro-dialog',
      'agent-elements-extension-project-intro',
      'agent-elements-tool-card',
    );
    expect(dialog).toHaveAttribute('data-component', 'ExtensionProjectIntroModal');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'extension-project-intro');

    expect(screen.getByTestId('agent-elements-extension-project-intro-header')).toHaveTextContent(
      'Build with Extensions',
    );
    expect(screen.getAllByTestId('agent-elements-extension-project-intro-capability')).toHaveLength(4);
    expect(screen.getByTestId('agent-elements-extension-project-intro-callout')).toHaveAttribute(
      'data-agent-elements-shell',
      'extension-project-intro-callout',
    );

    fireEvent.click(dialog);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: "Don't Show Again" }));
    expect(onDontShowAgain).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('keeps the extension intro source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-extension-project-intro');
    expect(source).toContain('--an-foreground');
    expect(source).toContain('--an-primary-color');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).not.toMatch(/var\(--nim-(?:text|primary-hover)[^)]+\)/);
    expect(source).not.toMatch(/bg-black|backdrop-blur|rgba\(|nim-modal|nim-btn-primary|nim-btn-secondary/);
    expect(source).not.toMatch(/rounded-lg|rounded-xl|tracking-\[|text-white|text-black/);
  });
});
