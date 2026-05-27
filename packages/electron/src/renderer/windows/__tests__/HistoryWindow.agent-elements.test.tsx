// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryWindow } from '../HistoryWindow';

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

const sourcePath = resolve(process.cwd(), 'packages/electron/src/renderer/windows/HistoryWindow.tsx');

const snapshots = [
  {
    timestamp: '2026-05-25T08:00:00.000Z',
    type: 'ai-edit' as const,
    size: 2048,
    baseMarkdownHash: 'hash-1',
  },
  {
    timestamp: '2026-05-24T08:00:00.000Z',
    type: 'manual' as const,
    size: 512,
    baseMarkdownHash: 'hash-2',
  },
];

describe('HistoryWindow Agent Elements shell', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/history.html?filePath=/workspace/src/app.ts');

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        history: {
          listSnapshots: vi.fn().mockResolvedValue(snapshots),
          loadSnapshot: vi.fn().mockResolvedValue('export const answer = 42;'),
          deleteSnapshot: vi.fn().mockResolvedValue(undefined),
        },
        sendToMainWindow: vi.fn().mockResolvedValue(undefined),
      },
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'close').mockImplementation(() => undefined);
  });

  it('renders an Agent Elements history window shell while preserving snapshot preview, restore, and delete behavior', async () => {
    render(<HistoryWindow />);

    const shell = await screen.findByTestId('agent-elements-history-window');
    expect(shell).toHaveClass('history-window', 'agent-elements-history-window');
    expect(shell).toHaveAttribute('data-component', 'HistoryWindow');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'history-window');

    expect(window.electronAPI.history.listSnapshots).toHaveBeenCalledWith('/workspace/src/app.ts');
    expect(window.electronAPI.history.loadSnapshot).toHaveBeenCalledWith(
      '/workspace/src/app.ts',
      '2026-05-25T08:00:00.000Z',
    );

    const list = screen.getByTestId('agent-elements-history-window-snapshots');
    expect(within(list).getByText('AI Edit')).toBeInTheDocument();
    expect(within(list).getByText('2.0 KB')).toBeInTheDocument();

    const selectedSnapshot = screen.getByTestId('agent-elements-history-window-snapshot-2026-05-25T08:00:00.000Z');
    expect(selectedSnapshot).toHaveAttribute('data-snapshot-selected', 'true');
    expect(selectedSnapshot).toHaveAttribute('role', 'button');

    const preview = await screen.findByTestId('agent-elements-history-window-preview-content');
    expect(preview).toHaveTextContent('export const answer = 42;');

    fireEvent.click(screen.getByRole('button', { name: /restore this version/i }));
    await waitFor(() => {
      expect(window.electronAPI.sendToMainWindow).toHaveBeenCalledWith('restore-from-history', {
        filePath: '/workspace/src/app.ts',
        content: 'export const answer = 42;',
        timestamp: '2026-05-25T08:00:00.000Z',
      });
    });
    expect(window.close).toHaveBeenCalled();

    fireEvent.click(within(selectedSnapshot).getByTitle('Delete snapshot'));
    await waitFor(() => {
      expect(window.electronAPI.history.deleteSnapshot).toHaveBeenCalledWith(
        '/workspace/src/app.ts',
        '2026-05-25T08:00:00.000Z',
      );
    });
  });

  it('keeps the source constrained to Agent Elements-compatible history window styling', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-history-window');
    expect(source).toContain('data-agent-elements-shell="history-window"');
    expect(source).toContain('--an-');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|nim-btn/);
    expect(source).not.toMatch(/var\(--nim-|border-l-\[3px\]|tracking-wide/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|transition-all|text-white/);
    expect(source).not.toMatch(/rgba\(|#[0-9a-fA-F]{3,8}\b/);
  });
});
