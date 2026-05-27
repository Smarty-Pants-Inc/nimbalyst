// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  FloatingEditorActions,
  FloatingEditorButton,
  FloatingEditorMenu,
  FloatingEditorMenuItem,
} from '../FloatingEditorActions';

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

const floatingEditorActionsSourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/FloatingEditorActions/FloatingEditorActions.tsx',
);

describe('FloatingEditorActions Agent Elements shell', () => {
  it('renders Agent Elements floating editor controls while preserving legacy classes and button behavior', () => {
    const onClick = vi.fn();

    render(
      <FloatingEditorActions>
        <FloatingEditorButton icon="code" label="View source" onClick={onClick} isActive />
        <FloatingEditorButton icon={<span>Custom</span>} label="Custom action" onClick={vi.fn()} />
      </FloatingEditorActions>
    );

    const actions = screen.getByText('Custom').closest('.floating-editor-actions');
    expect(actions).toHaveClass('floating-editor-actions', 'agent-elements-floating-editor-actions');
    expect(actions).toHaveAttribute('data-component', 'FloatingEditorActions');
    expect(actions?.className).not.toMatch(/rounded-md|rgba|active:scale|text-white|--nim-/);

    const button = screen.getByRole('button', { name: 'View source' });
    expect(button).toHaveClass('floating-editor-button', 'agent-elements-floating-editor-button');
    expect(button).toHaveAttribute('data-component', 'FloatingEditorButton');
    expect(button).toHaveAttribute('data-agent-elements-shell', 'floating-editor-button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.className).not.toMatch(/rounded-md|rgba|active:scale|text-white|--nim-/);
    expect(button.querySelector('[data-icon="code"]')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders an Agent Elements menu shell and active menu item without old menu chrome', () => {
    const onClose = vi.fn();
    const onActiveClick = vi.fn();

    render(
      <FloatingEditorMenu isOpen onClose={onClose}>
        <FloatingEditorMenuItem label="Preview" icon="visibility" onClick={onActiveClick} isActive />
        <FloatingEditorMenuItem label="Source" icon="code" onClick={vi.fn()} />
      </FloatingEditorMenu>
    );

    const menu = screen.getByRole('menu');
    expect(menu).toHaveClass('floating-editor-menu', 'agent-elements-floating-editor-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-component', 'FloatingEditorMenu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');
    expect(menu.className).not.toMatch(/rounded-md|rgba|shadow-\[0_4px|--nim-/);

    const activeItem = screen.getByRole('menuitem', { name: /Preview/i });
    expect(activeItem).toHaveClass('floating-editor-menu-item', 'agent-elements-floating-editor-menu-item');
    expect(activeItem).toHaveAttribute('data-agent-elements-shell', 'floating-editor-menu-item');
    expect(activeItem).toHaveAttribute('aria-current', 'true');
    expect(activeItem.className).not.toMatch(/--nim-|rgba|text-white/);
    expect(activeItem.querySelector('[data-icon="visibility"]')).toBeInTheDocument();
    expect(activeItem.querySelector('[data-icon="check"]')).toBeInTheDocument();

    fireEvent.click(activeItem);
    expect(onActiveClick).toHaveBeenCalledTimes(1);

    const backdrop = document.querySelector('.floating-editor-menu-backdrop');
    expect(backdrop).toHaveClass('agent-elements-floating-editor-menu-backdrop');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps a closed menu out of the DOM', () => {
    render(
      <FloatingEditorMenu isOpen={false} onClose={vi.fn()}>
        <FloatingEditorMenuItem label="Hidden" onClick={vi.fn()} />
      </FloatingEditorMenu>
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps floating editor menu card intent and gutters explicit in source', () => {
    const source = fs.readFileSync(floatingEditorActionsSourcePath, 'utf8');

    expect(source).toContain('data-agent-elements-card-padding="symmetric-inline"');
    expect(source).toContain('data-agent-elements-card-width="floating-menu"');
    expect(source).toContain('px-[var(--agent-elements-card-inline-padding)]');
    expect(source).toContain('py-[var(--agent-elements-card-block-padding)]');
    expect(source).not.toMatch(/floating-editor-menu[^\n"]*\bp-1\b/);
    expect(source).not.toMatch(/rounded-\[(?:8|10)px\]/);
    expect(source).not.toMatch(/var\(--nim-[^)]+\)/);
  });
});
