// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  tokens: {
    pendingThemeFallbackAtom: 'pendingThemeFallbackAtom',
    themeListChangedVersionAtom: 'themeListChangedVersionAtom',
  },
  pendingFallback: {
    missingId: 'missing-ocean',
    appliedId: 'dark',
  },
  setPendingFallback: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === mockState.tokens.pendingThemeFallbackAtom) return mockState.pendingFallback;
    if (atom === mockState.tokens.themeListChangedVersionAtom) return 0;
    return null;
  }),
  useSetAtom: vi.fn((atom: string) => {
    if (atom === mockState.tokens.pendingThemeFallbackAtom) return mockState.setPendingFallback;
    return vi.fn();
  }),
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size, className }: { icon: string; size?: number; className?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
  };
});

vi.mock('../../../../hooks/useTheme', () => ({
  useTheme: () => ({ themeId: 'dark' }),
}));

vi.mock('../../../../store/atoms/themeFallback', () => ({
  pendingThemeFallbackAtom: mockState.tokens.pendingThemeFallbackAtom,
}));

vi.mock('../../../../store/atoms/themeList', () => ({
  themeListChangedVersionAtom: mockState.tokens.themeListChangedVersionAtom,
}));

import { ThemesPanel } from '../ThemesPanel';

const themes = [
  {
    id: 'light',
    name: 'Light',
    description: 'Bright workspace',
    origin: 'builtin',
    isDark: false,
    version: '1.0.0',
    colors: { background: '#ffffff', foreground: '#111111' },
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Dim workspace',
    origin: 'builtin',
    isDark: true,
    version: '1.0.0',
    colors: { background: '#111111', foreground: '#eeeeee' },
  },
  {
    id: 'user-theme',
    name: 'Solarized User',
    description: 'Local theme file',
    origin: 'user',
    isDark: false,
    version: '2.1.0',
    author: 'Local User',
    tags: ['local', 'warm'],
    colors: { background: '#fdf6e3', foreground: '#657b83' },
  },
  {
    id: 'extension-theme',
    name: 'Extension Night',
    description: 'Extension theme',
    origin: 'extension',
    isDark: true,
    version: '3.0.0',
    contributedBy: 'Theme Pack',
    colors: { background: '#0f172a', foreground: '#e2e8f0' },
  },
];

describe('ThemesPanel Agent Elements shell', () => {
  beforeEach(() => {
    mockState.setPendingFallback.mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    (window as any).electronAPI = {
      invoke: vi.fn((channel: string) => {
        if (channel === 'theme:list') return Promise.resolve(themes);
        if (channel === 'theme:reload') return Promise.resolve({ success: true });
        if (channel === 'theme:uninstall') return Promise.resolve({ success: true });
        return Promise.resolve(undefined);
      }),
      send: vi.fn(),
    };
  });

  it('renders Agent Elements markers while preserving theme load, fallback, refresh, apply, details, and uninstall behavior', async () => {
    render(<ThemesPanel scope="user" />);

    await waitFor(() => expect(screen.getByTestId('agent-elements-themes-panel')).toBeInTheDocument());

    const panel = screen.getByTestId('agent-elements-themes-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'themes-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-themes-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-themes-fallback')).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByTestId('agent-elements-themes-active-section')).toHaveAttribute('data-agent-elements-shell', 'themes-active-section');
    expect(screen.getByTestId('agent-elements-themes-group-builtin')).toHaveAttribute('data-theme-origin', 'builtin');
    expect(screen.getByTestId('agent-elements-themes-group-user')).toHaveAttribute('data-theme-origin', 'user');
    expect(screen.getByTestId('agent-elements-themes-group-extension')).toHaveAttribute('data-theme-origin', 'extension');

    const darkCard = screen.getByTestId('agent-elements-theme-card-dark');
    expect(darkCard).toHaveAttribute('data-theme-active', 'true');
    expect(darkCard).toHaveClass('agent-elements-theme-card');

    const lightCard = screen.getByTestId('agent-elements-theme-card-light');
    fireEvent.click(lightCard);
    expect(screen.getByTestId('agent-elements-themes-detail')).toHaveAttribute('data-theme-id', 'light');
    expect(screen.getByTestId('agent-elements-themes-color-preview')).toHaveAttribute('data-agent-elements-shell', 'themes-color-preview');

    fireEvent.click(within(lightCard).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect((window as any).electronAPI.send).toHaveBeenCalledWith('set-theme', 'light', false));

    fireEvent.click(screen.getByTestId('agent-elements-themes-refresh'));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('theme:reload'));
    expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('theme:list');

    fireEvent.click(screen.getByTestId('dismiss-theme-fallback'));
    expect((window as any).electronAPI.send).toHaveBeenCalledWith('theme:dismiss-pending-fallback');
    expect(mockState.setPendingFallback).toHaveBeenCalledWith(null);

    const userCard = screen.getByTestId('agent-elements-theme-card-user-theme');
    fireEvent.click(within(userCard).getByTitle('Uninstall theme'));
    await waitFor(() => expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('theme:uninstall', 'user-theme'));
  });
});
