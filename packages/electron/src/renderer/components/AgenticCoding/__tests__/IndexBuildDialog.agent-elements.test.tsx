// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndexBuildDialog } from '../IndexBuildDialog';

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
      ...rest
    }: {
      icon: string;
      size?: number;
      className?: string;
      [key: string]: unknown;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className, ...rest }, icon),
  };
});

const sourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../IndexBuildDialog.tsx'
);

describe('IndexBuildDialog Agent Elements shell', () => {
  it('renders an Agent Elements index-build dialog shell while preserving skip and build actions', () => {
    const onBuild = vi.fn();
    const onSkip = vi.fn();

    render(
      <IndexBuildDialog
        isOpen={true}
        messageCount={12_345}
        isBuilding={false}
        onBuild={onBuild}
        onSkip={onSkip}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-index-build-backdrop');
    expect(backdrop).toHaveClass('index-build-dialog-overlay', 'agent-elements-index-build-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'index-build-backdrop');

    const dialog = screen.getByTestId('agent-elements-index-build-dialog');
    expect(dialog).toHaveClass('index-build-dialog', 'agent-elements-index-build-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'IndexBuildDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'index-build-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    expect(screen.getByTestId('agent-elements-index-build-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'index-build-header'
    );
    expect(screen.getByTestId('agent-elements-index-build-message')).toHaveTextContent(
      '12,345 messages'
    );
    expect(screen.getByTestId('agent-elements-index-build-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'index-build-actions'
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Build Index' }));
    expect(onBuild).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Skip for now' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('preserves closed rendering and building state behavior', () => {
    const onBuild = vi.fn();
    const onSkip = vi.fn();
    const { rerender } = render(
      <IndexBuildDialog
        isOpen={false}
        messageCount={5}
        isBuilding={false}
        onBuild={onBuild}
        onSkip={onSkip}
      />
    );

    expect(screen.queryByTestId('agent-elements-index-build-dialog')).not.toBeInTheDocument();

    rerender(
      <IndexBuildDialog
        isOpen={true}
        messageCount={5}
        isBuilding={true}
        onBuild={onBuild}
        onSkip={onSkip}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-index-build-backdrop');
    const progress = screen.getByTestId('agent-elements-index-build-progress');
    expect(progress).toHaveClass('index-build-dialog-progress', 'agent-elements-index-build-progress');
    expect(progress).toHaveAttribute('data-agent-elements-shell', 'index-build-progress');
    expect(screen.queryByRole('button', { name: 'Build Index' })).not.toBeInTheDocument();

    fireEvent.click(backdrop);
    expect(onSkip).not.toHaveBeenCalled();
    expect(onBuild).not.toHaveBeenCalled();
  });

  it('keeps IndexBuildDialog source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-index-build-dialog');
    expect(source).toContain('data-agent-elements-shell="index-build-dialog"');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/nim-overlay|nim-btn-|bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-lg|shadow-lg|text-white|tracking-wide/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(|rgb\(/);
    expect(source).not.toMatch(/<svg|<\/svg>/);
  });
});
