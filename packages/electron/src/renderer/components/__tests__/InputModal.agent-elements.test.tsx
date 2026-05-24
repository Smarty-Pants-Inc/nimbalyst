// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InputModal } from '../InputModal';

describe('InputModal Agent Elements shell', () => {
  it('renders an Agent Elements modal shell while preserving focus, suffix, and trimmed submit behavior', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <InputModal
        isOpen={true}
        title="Rename File"
        placeholder="File name"
        defaultValue=" draft "
        suffix=".md"
        confirmLabel="Rename"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-input-modal-backdrop');
    expect(backdrop).toHaveClass('input-modal-overlay', 'agent-elements-input-modal-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'input-modal-backdrop');

    const dialog = screen.getByTestId('agent-elements-input-modal');
    expect(dialog).toHaveClass('input-modal', 'agent-elements-input-modal', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'InputModal');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'input-modal');

    expect(screen.getByTestId('agent-elements-input-modal-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'input-modal-header'
    );
    expect(screen.getByTestId('agent-elements-input-modal-input-wrapper')).toHaveClass(
      'input-modal-input-wrapper',
      'agent-elements-input-modal-input-wrapper',
      'has-suffix'
    );

    const input = screen.getByTestId('agent-elements-input-modal-input') as HTMLInputElement;
    expect(input).toHaveClass('input-modal-input', 'agent-elements-input-modal-input');
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(' draft '.length);
    expect(screen.getByTestId('agent-elements-input-modal-suffix')).toHaveTextContent('.md');

    fireEvent.change(input, { target: { value: ' renamed ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(onConfirm).toHaveBeenCalledWith('renamed');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('preserves disabled empty submit, Escape cancel, and overlay cancel inside the Agent Elements shell', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <InputModal
        isOpen={true}
        title="New Folder"
        placeholder="Folder name"
        defaultValue=""
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const input = screen.getByTestId('agent-elements-input-modal-input');
    const confirmButton = screen.getByRole('button', { name: 'Create' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: '   ' } });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('agent-elements-input-modal-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
