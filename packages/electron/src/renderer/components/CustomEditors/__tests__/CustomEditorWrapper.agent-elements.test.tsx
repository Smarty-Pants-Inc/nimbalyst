// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomEditorWrapper } from '../CustomEditorWrapper';

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
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

describe('CustomEditorWrapper Agent Elements shell', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    consoleError.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders custom editor crashes with Agent Elements error chrome while preserving retry behavior', () => {
    let shouldThrow = true;
    const RecoverableEditor = () => {
      if (shouldThrow) {
        throw new Error('Renderer crashed on custom payload');
      }
      return <div data-testid="custom-editor-recovered">Recovered custom editor</div>;
    };

    render(
      <CustomEditorWrapper
        component={RecoverableEditor}
        host={{} as never}
        extensionId="mindmap-extension"
        componentName="MindmapEditor"
      />
    );

    const root = screen.getByTestId('agent-elements-custom-editor-error');
    expect(root).toHaveClass('custom-editor-error', 'agent-elements-custom-editor-error');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'custom-editor-error');
    expect(root.className).not.toMatch(/bg-white|bg-black|text-white|rounded-md|rounded-lg|rgba|backdrop.*blur|scale-/);

    const content = screen.getByTestId('agent-elements-custom-editor-error-content');
    expect(content).toHaveClass('agent-elements-tool-card');
    expect(content.className).not.toMatch(/rounded-md|rounded-lg|shadow-lg|shadow-xl|text-white/);

    const meta = screen.getByTestId('agent-elements-custom-editor-error-meta');
    expect(within(meta).getByText('Extension:')).toBeInTheDocument();
    expect(within(meta).getByText('mindmap-extension')).toBeInTheDocument();
    expect(within(meta).getByText('MindmapEditor')).toBeInTheDocument();

    const stack = screen.getByTestId('agent-elements-custom-editor-error-stack');
    expect(stack).toHaveClass('agent-elements-custom-editor-error-stack');
    expect(stack.className).not.toMatch(/rounded-md|bg-white|bg-black|text-white/);

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByTestId('custom-editor-recovered')).toHaveTextContent('Recovered custom editor');
  });
});
