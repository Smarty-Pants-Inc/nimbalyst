// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ApiKeyDialog } from '../ApiKeyDialog';

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

describe('ApiKeyDialog Agent Elements shell', () => {
  it('keeps API key dialog visual chrome on Agent Elements aliases', () => {
    const sourcePath = [
      path.join(
        process.cwd(),
        'src/renderer/components/ApiKeyDialog/ApiKeyDialog.tsx',
      ),
      path.join(
        process.cwd(),
        'packages/electron/src/renderer/components/ApiKeyDialog/ApiKeyDialog.tsx',
      ),
    ].find((candidate) => fs.existsSync(candidate));

    expect(sourcePath).toBeTruthy();
    const source = fs.readFileSync(
      sourcePath!,
      'utf8',
    );

    expect(source).toContain('--an-foreground');
    expect(source).toContain('--an-button-primary-text');
    expect(source).toContain('--an-primary-color');
    expect(source).not.toMatch(/var\(--nim-(?:text|primary-hover)\)/);
    expect(source).not.toMatch(/shadow-\[[^\]]*var\(--nim-/);
    expect(source).not.toContain('text-[var(--an-background)]');
  });

  it('renders an Agent Elements API key shell while preserving provider links and settings action', () => {
    const onClose = vi.fn();
    const onOpenPreferences = vi.fn();

    render(
      <ApiKeyDialog
        isOpen={true}
        onClose={onClose}
        onOpenPreferences={onOpenPreferences}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-api-key-dialog-backdrop');
    expect(backdrop).toHaveClass('api-key-dialog-overlay', 'agent-elements-api-key-dialog-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'api-key-dialog-backdrop');

    const dialog = screen.getByTestId('agent-elements-api-key-dialog');
    expect(dialog).toHaveClass('api-key-dialog', 'agent-elements-api-key-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'ApiKeyDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'api-key-dialog');

    expect(screen.getByTestId('agent-elements-api-key-dialog-header')).toHaveTextContent('API Key Required');
    expect(screen.getByTestId('agent-elements-api-key-dialog-icon')).toHaveAttribute('data-agent-elements-shell', 'api-key-dialog-icon');
    expect(screen.getByTestId('agent-elements-api-key-dialog-steps')).toHaveClass('agent-elements-api-key-dialog-steps');

    expect(screen.getByRole('link', { name: 'Anthropic' })).toHaveAttribute(
      'href',
      'https://console.anthropic.com/settings/keys'
    );
    expect(screen.getByRole('link', { name: 'OpenAI' })).toHaveAttribute(
      'href',
      'https://platform.openai.com/api-keys'
    );
    expect(screen.getByRole('link', { name: 'LM Studio' })).toHaveAttribute(
      'href',
      'https://lmstudio.ai'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open AI Settings' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenPreferences).toHaveBeenCalledTimes(1);
  });

  it('preserves closed rendering, overlay close, dialog click isolation, and close button behavior', () => {
    const onClose = vi.fn();
    const onOpenPreferences = vi.fn();

    const { rerender } = render(
      <ApiKeyDialog
        isOpen={false}
        onClose={onClose}
        onOpenPreferences={onOpenPreferences}
      />
    );

    expect(screen.queryByTestId('agent-elements-api-key-dialog')).not.toBeInTheDocument();

    rerender(
      <ApiKeyDialog
        isOpen={true}
        onClose={onClose}
        onOpenPreferences={onOpenPreferences}
      />
    );

    fireEvent.click(screen.getByTestId('agent-elements-api-key-dialog'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('agent-elements-api-key-dialog-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('agent-elements-api-key-dialog-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onOpenPreferences).not.toHaveBeenCalled();
  });
});
