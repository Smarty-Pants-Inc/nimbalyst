// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenericTypeahead, type TypeaheadOption } from '../GenericTypeahead';

vi.mock('../typeaheadUtils', () => ({
  getCursorCoordinates: vi.fn(() => ({ top: 24, left: 32 })),
}));

const sourcePath = resolve(__dirname, '../GenericTypeahead.tsx');

const options: TypeaheadOption[] = [
  {
    id: 'open-file',
    label: 'Open file',
    description: 'Jump to a workspace file',
    icon: 'folder_open',
    section: 'Commands',
  },
  {
    id: 'search',
    label: 'Search',
    description: 'Find text',
    icon: 'search',
    section: 'Commands',
  },
  {
    id: 'disabled',
    label: 'Disabled option',
    description: 'Cannot be selected',
    icon: 'block',
    section: 'Other',
    disabled: true,
  },
];

function renderTypeahead(overrides: Partial<React.ComponentProps<typeof GenericTypeahead>> = {}) {
  const anchor = document.createElement('textarea');
  anchor.value = '/o';
  document.body.appendChild(anchor);
  Object.defineProperty(anchor, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      top: 100,
      left: 80,
      right: 380,
      bottom: 140,
      width: 300,
      height: 40,
      x: 80,
      y: 100,
      toJSON: () => ({}),
    }),
  });

  const props = {
    anchorElement: anchor,
    options,
    selectedIndex: 0,
    onSelectedIndexChange: vi.fn(),
    onSelectedOptionChange: vi.fn(),
    onSelect: vi.fn(),
    onClose: vi.fn(),
    cursorPosition: 2,
    ...overrides,
  };

  const view = render(<GenericTypeahead {...props} />);
  return { ...view, anchor, props };
}

describe('GenericTypeahead Agent Elements shell', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders grouped options in an Agent Elements popover while preserving selection semantics', async () => {
    const { props } = renderTypeahead();

    const menu = await screen.findByTestId('agent-elements-generic-typeahead');
    await waitFor(() => expect(menu).toHaveStyle({ opacity: '1' }));
    expect(menu).toHaveClass('generic-typeahead', 'agent-elements-generic-typeahead', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'generic-typeahead');
    expect(menu).toHaveAttribute('data-component', 'GenericTypeahead');

    expect(screen.getByTestId('agent-elements-generic-typeahead-section-commands')).toHaveAttribute(
      'data-agent-elements-shell',
      'generic-typeahead-section',
    );
    expect(screen.getByText('Commands')).toHaveClass('agent-elements-generic-typeahead-section-header');

    const first = screen.getByTestId('agent-elements-generic-typeahead-option-open-file');
    expect(first).toHaveClass('generic-typeahead-option', 'agent-elements-generic-typeahead-option', 'selected');
    expect(first).toHaveAttribute('data-option-index', '0');
    expect(first).toHaveAttribute('data-selected', 'true');
    expect(first).toHaveAttribute('data-disabled', 'false');

    fireEvent.mouseDown(first);
    expect(props.onSelect).toHaveBeenCalledWith(options[0]);
    expect(props.onSelectedOptionChange).toHaveBeenCalledWith(options[0]);
  });

  it('preserves disabled options and outside-click close behavior', async () => {
    const { props, anchor } = renderTypeahead({ selectedIndex: 2 });

    const disabled = await screen.findByTestId('agent-elements-generic-typeahead-option-disabled');
    expect(disabled).toHaveAttribute('data-disabled', 'true');

    fireEvent.mouseDown(disabled);
    expect(props.onSelect).not.toHaveBeenCalled();

    fireEvent.mouseDown(anchor);
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.body);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render for an empty option list', () => {
    renderTypeahead({ options: [] });
    expect(screen.queryByTestId('agent-elements-generic-typeahead')).not.toBeInTheDocument();
  });

  it('keeps GenericTypeahead source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-generic-typeahead');
    expect(source).toContain('data-agent-elements-shell="generic-typeahead"');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).not.toMatch(/var\(--nim-[^)]+\)|bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide/);
    expect(source).not.toMatch(/rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b|text-white|bg-white|bg-black/);
  });
});
