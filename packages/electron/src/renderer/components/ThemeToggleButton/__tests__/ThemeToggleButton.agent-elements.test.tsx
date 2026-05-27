// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  atoms: {
    themeIdAtom: 'themeIdAtom',
    themeListChangedVersionAtom: 'themeListChangedVersionAtom',
  },
  currentTheme: 'dark',
  themeListVersion: 0,
  themes: [
    { id: 'light', name: 'Light', isDark: false },
    { id: 'dark', name: 'Dark', isDark: true },
    { id: 'crystal-dark', name: 'Crystal Dark', isDark: true },
  ],
  getAllAvailableThemesAsync: vi.fn(),
  send: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.atoms.themeIdAtom) return mockState.currentTheme;
    if (atom === mockState.atoms.themeListChangedVersionAtom) return mockState.themeListVersion;
    return undefined;
  }),
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

vi.mock('@nimbalyst/runtime/store', () => ({
  themeIdAtom: mockState.atoms.themeIdAtom,
}));

vi.mock('../../../hooks/useTheme', () => ({
  getAllAvailableThemesAsync: mockState.getAllAvailableThemesAsync,
}));

vi.mock('../../../store/atoms/themeList', () => ({
  themeListChangedVersionAtom: mockState.atoms.themeListChangedVersionAtom,
}));

vi.mock('../../../help', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    HelpTooltip: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
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

import { ThemeToggleButton } from '../ThemeToggleButton';

const sourcePath = resolve(__dirname, '../ThemeToggleButton.tsx');

describe('ThemeToggleButton Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.currentTheme = 'dark';
    mockState.themeListVersion = 0;
    mockState.getAllAvailableThemesAsync.mockResolvedValue(mockState.themes);

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { send: mockState.send },
    });
  });

  it('renders an Agent Elements theme menu while preserving theme selection IPC', async () => {
    render(<ThemeToggleButton className="custom-class" />);

    const root = screen.getByTestId('agent-elements-theme-toggle');
    expect(root).toHaveClass('theme-toggle-control', 'agent-elements-theme-toggle');
    expect(root).toHaveAttribute('data-component', 'ThemeToggleButton');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'theme-toggle');

    const button = screen.getByTestId('gutter-theme-button');
    expect(button).toHaveClass('theme-toggle-button', 'nav-button', 'agent-elements-theme-toggle-button', 'custom-class');
    expect(button).toHaveAttribute('data-agent-elements-shell', 'theme-toggle-button');
    expect(button).toHaveAttribute('data-theme-id', 'dark');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(within(button).getByText('', { selector: '[data-icon="dark_mode"]' })).toBeInTheDocument();

    fireEvent.click(button);

    const menu = await screen.findByTestId('agent-elements-theme-toggle-menu');
    expect(menu).toHaveClass('theme-menu', 'agent-elements-theme-toggle-menu', 'agent-elements-tool-card');
    expect(menu).toHaveClass('w-52', 'max-w-[calc(100vw-24px)]');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'theme-toggle-menu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');
    expect(menu).toHaveAttribute('role', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'true');

    const darkOption = within(menu).getByRole('menuitemradio', { name: /^Dark$/ });
    expect(darkOption).toHaveAttribute('aria-checked', 'true');
    expect(darkOption).toHaveAttribute('data-selected', 'true');

    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Light/ }));

    expect(mockState.send).toHaveBeenCalledWith('set-theme', 'light', false);
    await waitFor(() => expect(screen.queryByTestId('agent-elements-theme-toggle-menu')).not.toBeInTheDocument());
  });

  it('keeps the source on Agent Elements-compatible theme-toggle primitives', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-theme-toggle');
    expect(source).toContain('data-agent-elements-shell="theme-toggle-button"');
    expect(source).toContain('data-agent-elements-shell="theme-toggle-menu"');
    expect(source).toContain('data-agent-elements-card-padding="symmetric-inline"');
    expect(source).toContain('data-agent-elements-card-width="floating-menu"');
    expect(source).toContain('w-52 max-w-[calc(100vw-24px)]');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('FloatingPortal');
    expect(source).not.toContain('rounded-md');
    expect(source).not.toContain('shadow-lg');
    expect(source).not.toContain('active:scale-95');
    expect(source).not.toContain('bg-nim-secondary');
    expect(source).not.toContain('hover:bg-nim-hover');
    expect(source).not.toContain('border-none');
    expect(source).not.toMatch(/var\(--nim-/);
  });
});
