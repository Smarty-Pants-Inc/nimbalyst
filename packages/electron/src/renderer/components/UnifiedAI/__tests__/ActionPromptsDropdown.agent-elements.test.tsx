// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionPromptsDropdown } from '../ActionPromptsDropdown';
import {
  actionPromptsAtomFamily,
  type ActionPromptListState,
} from '../../../store/atoms/actionPrompts';

const capture = vi.fn();

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture }),
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
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

vi.mock('../../../hooks/useFloatingMenu', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    FloatingPortal: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useFloatingMenu: () => {
      const [isOpen, setIsOpen] = ReactModule.useState(false);
      return {
        isOpen,
        setIsOpen,
        refs: {
          setReference: vi.fn(),
          setFloating: vi.fn(),
        },
        floatingStyles: {},
        getReferenceProps: () => ({}),
        getFloatingProps: () => ({}),
      };
    },
  };
});

const sourcePath = resolve(__dirname, '../ActionPromptsDropdown.tsx');
const workspacePath = '/workspace/project';

function renderDropdown(
  state: ActionPromptListState = {
    actions: [
      {
        id: 'fix-tests',
        label: 'Fix tests',
        body: 'Run failing tests\nThen patch the root cause',
      },
      {
        id: 'review-diff',
        label: 'Review diff',
        body: 'Inspect the current git diff',
      },
    ],
    diagnostics: [],
    filePath: '/workspace/project/ai-actions.md',
    fileExists: true,
    loaded: true,
  }
) {
  window.electronAPI.invoke = vi.fn(async (channel: string) => {
    if (channel === 'action-prompts:list') {
      return state;
    }
    return { success: true };
  });

  const store = createStore();
  store.set(actionPromptsAtomFamily(workspacePath), state);

  const onInsert = vi.fn();
  render(
    <Provider store={store}>
      <ActionPromptsDropdown workspacePath={workspacePath} onInsert={onInsert} />
    </Provider>
  );
  return { onInsert };
}

describe('UnifiedAI ActionPromptsDropdown Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(window, {
      electronAPI: {
        invoke: vi.fn().mockResolvedValue({
          actions: [],
          diagnostics: [],
          filePath: null,
          fileExists: false,
          loaded: true,
        }),
      },
    });
  });

  it('renders Agent Elements action-prompt chrome and preserves insertion analytics', async () => {
    const { onInsert } = renderDropdown();
    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('action-prompts:list', {
        workspacePath,
      });
    });

    const trigger = screen.getByTestId('action-prompts-dropdown');
    expect(trigger).toHaveClass(
      'action-prompts-dropdown-button',
      'agent-elements-action-prompts-trigger',
      'agent-elements-status-pill'
    );
    expect(trigger).toHaveAttribute('data-agent-elements-shell', 'action-prompts-trigger');
    expect(trigger).toHaveAttribute('data-component', 'UnifiedAIActionPromptsDropdown');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-label', 'Actions (2)');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByTestId('action-prompts-dropdown-panel');
    expect(panel).toHaveClass('action-prompts-dropdown-panel', 'agent-elements-action-prompts-menu');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'action-prompts-menu');
    expect(panel).toHaveAttribute('data-action-count', '2');

    const firstItem = screen.getByTestId('action-prompt-item-fix-tests');
    expect(firstItem).toHaveClass('action-prompts-dropdown-item', 'agent-elements-action-prompts-item');
    expect(firstItem).toHaveAttribute('data-highlighted', 'true');
    expect(firstItem).toHaveAttribute('data-action-prompt-id', 'fix-tests');
    expect(within(firstItem).getByText('Run failing tests')).toBeInTheDocument();

    fireEvent.click(firstItem);

    expect(onInsert).toHaveBeenCalledWith('Run failing tests\nThen patch the root cause');
    expect(capture).toHaveBeenCalledWith('action_prompt_inserted', {
      actionCount: 2,
      bodyLength: 43,
    });
    expect(screen.queryByTestId('action-prompts-dropdown-panel')).not.toBeInTheDocument();
  });

  it('preserves seed and edit-file IPC actions inside the Agent Elements menu', async () => {
    renderDropdown({
      actions: [],
      diagnostics: [],
      filePath: null,
      fileExists: false,
      loaded: true,
    });
    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('action-prompts:list', {
        workspacePath,
      });
    });

    fireEvent.click(screen.getByTestId('action-prompts-dropdown'));
    const panel = screen.getByTestId('action-prompts-dropdown-panel');

    const seed = within(panel).getByTestId('action-prompts-seed-button');
    expect(seed).toHaveClass('agent-elements-action-prompts-seed');

    fireEvent.click(seed);

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('action-prompts:open-file', {
        workspacePath,
      });
    });
    expect(window.electronAPI.invoke).toHaveBeenCalledWith('action-prompts:list', {
      workspacePath,
    });

    fireEvent.click(screen.getByTestId('action-prompts-dropdown'));
    fireEvent.click(screen.getByTestId('action-prompts-edit-link'));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('action-prompts:open-file', {
        workspacePath,
      });
    });
  });

  it('keeps ActionPromptsDropdown source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('useFloatingMenu');
    expect(source).toContain('FloatingPortal');
    expect(source).toContain('agent-elements-action-prompts');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/bg-nim|text-nim|bg-\[var\(--nim|text-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/text-white|uppercase|tracking-|hover:shadow|active:scale|transition-all/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/shadow-\[/);
  });
});
