// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  trackerSyncRejectionAtom,
  type TrackerSyncRejectionState,
} from '../../../store/atoms/trackerSync';
import { TrackerSyncRejectionBanner } from '../TrackerSyncRejectionBanner';

vi.mock('@nimbalyst/runtime', async () => {
  const React = await import('react');
  return {
    MaterialSymbol: ({ icon, className, size }: { icon: string; className?: string; size?: number }) =>
      React.createElement('span', { className, 'data-icon': icon, 'data-size': size }, icon),
  };
});

const bannerSourcePath = resolve(__dirname, '../TrackerSyncRejectionBanner.tsx');

function rejectionState(overrides: Partial<TrackerSyncRejectionState> = {}): TrackerSyncRejectionState {
  return {
    staleKeyEpoch: null,
    rotationLocked: null,
    ...overrides,
  };
}

function renderBanner(state: TrackerSyncRejectionState, workspacePath = '/work/current') {
  const store = createStore();
  store.set(trackerSyncRejectionAtom, state);

  render(
    <Provider store={store}>
      <TrackerSyncRejectionBanner workspacePath={workspacePath} />
    </Provider>,
  );

  return store;
}

describe('TrackerSyncRejectionBanner Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders stale-key rejection with Agent Elements markers while preserving retry and dismiss behavior', () => {
    const store = renderBanner(
      rejectionState({
        staleKeyEpoch: {
          workspacePath: '/work/current',
          code: 'staleKeyEpoch',
          itemId: 'TRACK-1',
          timestamp: 1,
        },
        rotationLocked: {
          workspacePath: '/work/current',
          code: 'rotationLocked',
          itemId: 'TRACK-2',
          timestamp: 2,
        },
      }),
    );

    const banner = screen.getByTestId('tracker-sync-rejection-banner');
    expect(banner).toHaveClass(
      'tracker-sync-rejection-banner',
      'agent-elements-tracker-sync-rejection-banner',
      'agent-elements-tool-card',
    );
    expect(banner).toHaveAttribute('data-component', 'TrackerSyncRejectionBanner');
    expect(banner).toHaveAttribute('data-agent-elements-shell', 'tracker-sync-rejection-banner');
    expect(banner).toHaveAttribute('data-rejection-code', 'staleKeyEpoch');

    expect(screen.getByTestId('agent-elements-tracker-sync-rejection-icon')).toHaveAttribute(
      'data-agent-elements-shell',
      'tracker-sync-rejection-icon',
    );
    expect(screen.getByTestId('agent-elements-tracker-sync-rejection-message')).toHaveClass('select-text');
    expect(screen.getByTestId('agent-elements-tracker-sync-rejection-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'tracker-sync-rejection-actions',
    );

    fireEvent.click(screen.getByTestId('tracker-sync-rejection-retry'));
    expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('tracker-sync:connect', {
      workspacePath: '/work/current',
    });

    fireEvent.click(screen.getByTestId('tracker-sync-rejection-dismiss'));
    expect(store.get(trackerSyncRejectionAtom).staleKeyEpoch).toBeNull();
    expect(screen.getByTestId('tracker-sync-rejection-banner')).toHaveAttribute(
      'data-rejection-code',
      'rotationLocked',
    );
  });

  it('does not render a sibling workspace rejection', () => {
    renderBanner(
      rejectionState({
        staleKeyEpoch: {
          workspacePath: '/work/other',
          code: 'staleKeyEpoch',
          itemId: 'TRACK-1',
          timestamp: 1,
        },
      }),
    );

    expect(screen.queryByTestId('tracker-sync-rejection-banner')).not.toBeInTheDocument();
  });

  it('renders rotation state without retry while preserving dismiss behavior', () => {
    const store = renderBanner(
      rejectionState({
        rotationLocked: {
          workspacePath: '/work/current',
          code: 'rotationLocked',
          itemId: 'TRACK-2',
          timestamp: 2,
        },
      }),
    );

    const banner = screen.getByTestId('tracker-sync-rejection-banner');
    expect(banner).toHaveAttribute('data-rejection-code', 'rotationLocked');
    expect(screen.getByTestId('agent-elements-tracker-sync-rejection-status')).toHaveTextContent('Syncing');
    expect(screen.queryByTestId('tracker-sync-rejection-retry')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tracker-sync-rejection-dismiss'));
    expect(store.get(trackerSyncRejectionAtom).rotationLocked).toBeNull();
  });

  it('keeps TrackerSyncRejectionBanner source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(bannerSourcePath, 'utf8');

    expect(source).toContain('agent-elements-tracker-sync-rejection-banner');
    expect(source).toContain('agent-elements-tracker-sync-rejection-icon');
    expect(source).toContain('agent-elements-tracker-sync-rejection-message');
    expect(source).toContain('agent-elements-tracker-sync-rejection-actions');
    expect(source).toContain('data-agent-elements-shell="tracker-sync-rejection-banner"');

    expect(source).not.toContain('border-b border-nim bg-nim-tertiary');
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/bg-white|text-white|bg-black|hover:scale|tracking-\[/);
    expect(source).not.toMatch(/var\(--nim-[^)]+\)|--nim-accent|--nim-surface|text-nim-fg|<svg/);
  });
});
