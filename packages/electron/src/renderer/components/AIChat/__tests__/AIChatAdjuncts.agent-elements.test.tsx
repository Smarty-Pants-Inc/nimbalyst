// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileGutter } from '../FileGutter';
import { PendingReviewBanner } from '../PendingReviewBanner';
import { WakeupBanner } from '../WakeupBanner';
import { projectStateAtom, type ProjectState } from '../../../store/atoms/projectState';
import { sessionPendingReviewFilesAtom } from '../../../store/atoms/sessionFiles';
import { sessionWakeupAtom } from '../../../store/atoms/sessions';

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, className, title }: { icon: string; className?: string; title?: string }) =>
      ReactModule.createElement('span', { 'data-icon': icon, className, title }, icon),
  };
});

const aiChatDir = resolve(__dirname, '..');
const fileGutterSourcePath = resolve(aiChatDir, 'FileGutter.tsx');
const wakeupBannerSourcePath = resolve(aiChatDir, 'WakeupBanner.tsx');
const pendingReviewBannerSourcePath = resolve(aiChatDir, 'PendingReviewBanner.tsx');

function createProjectState(groupByDirectory = false): ProjectState {
  return {
    version: 1,
    contexts: {
      main: {
        tabs: [],
        activeTabKey: null,
      },
    },
    layout: {
      sidebarWidth: 250,
      sidebarCollapsed: false,
      aiPanelWidth: 400,
      aiPanelCollapsed: true,
    },
    fileTree: {
      expandedDirs: [],
      activeFilter: null,
    },
    diffTree: {
      groupByDirectory,
    },
    fileGutterCollapsed: {},
    agentMode: {
      fileScopeMode: 'session-files',
    },
    lastOpenedFile: null,
    recentFiles: [],
    hiddenGutterButtons: [],
  };
}

function renderWithStore(ui: React.ReactElement, store = createStore()) {
  return render(<Provider store={store}>{ui}</Provider>);
}

describe('AIChat adjunct Agent Elements shells', () => {
  beforeEach(() => {
    (window as any).electronAPI = {
      invoke: vi.fn(async (channel: string, ...args: any[]) => {
        if (channel === 'session-files:get-by-session') {
          expect(args).toEqual(['session-1', 'edited']);
          return {
            success: true,
            files: [
              {
                filePath: '/workspace/src/App.tsx',
                metadata: { operation: 'edit', linesAdded: 12, linesRemoved: 3 },
              },
              {
                filePath: '/workspace/src/new.ts',
                metadata: { operation: 'create', linesAdded: 5 },
              },
            ],
          };
        }

        if (channel === 'git:get-file-status') {
          expect(args[0]).toBe('/workspace');
          return {
            success: true,
            status: {
              'src/App.tsx': { status: 'modified' },
              'src/new.ts': { status: 'untracked' },
            },
          };
        }

        return { success: true };
      }),
      history: {
        clearPendingForSession: vi.fn(async () => undefined),
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as any).electronAPI;
  });

  it('renders the edited FileGutter as an Agent Elements file panel while preserving file clicks and pending-review rows', async () => {
    const store = createStore();
    store.set(projectStateAtom, createProjectState(false));
    const onFileClick = vi.fn();

    renderWithStore(
      <FileGutter
        sessionId="session-1"
        workspacePath="/workspace"
        type="edited"
        onFileClick={onFileClick}
        pendingReviewFiles={new Set(['/workspace/src/App.tsx'])}
      />,
      store,
    );

    const appFile = await screen.findByText('App.tsx');
    const gutter = appFile.closest('.file-gutter');
    expect(gutter).not.toBeNull();
    expect(gutter).toHaveClass('file-gutter', 'agent-elements-file-gutter', 'agent-elements-edit-panel');
    expect(gutter).toHaveAttribute('data-agent-elements-shell', 'file-gutter');
    expect(gutter).toHaveAttribute('data-file-gutter-type', 'edited');

    const appRow = appFile.closest('button');
    expect(appRow).toHaveClass('agent-elements-file-gutter-file', 'agent-elements-file-gutter-file--pending');
    expect(appRow).toHaveAttribute('data-pending-review', 'true');
    expect(screen.getByText('+12')).toBeInTheDocument();
    expect(screen.getByText('-3')).toBeInTheDocument();

    fireEvent.click(appRow!);
    expect(onFileClick).toHaveBeenCalledWith('/workspace/src/App.tsx');
  });

  it('renders wakeup and pending-review banners with Agent Elements chrome while preserving actions', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-25T00:00:00Z').getTime());

    const store = createStore();
    store.set(sessionWakeupAtom('session-1'), {
      id: 'wakeup-1',
      sessionId: 'session-1',
      workspaceId: 'workspace-1',
      prompt: 'Continue the implementation',
      reason: 'Resume after tests',
      fireAt: Date.now() + 3_600_000,
      status: 'pending',
      createdAt: Date.now(),
      firedAt: null,
      error: null,
    });
    store.set(sessionPendingReviewFilesAtom('session-1'), new Set(['/workspace/src/App.tsx', '/workspace/src/new.ts']));

    renderWithStore(
      <>
        <WakeupBanner sessionId="session-1" />
        <PendingReviewBanner workspacePath="/workspace" sessionId="session-1" />
      </>,
      store,
    );

    const wakeup = screen.getByTestId('wakeup-banner');
    expect(wakeup).toHaveClass('agent-elements-wakeup-banner', 'agent-elements-status-banner');
    expect(wakeup).toHaveAttribute('data-agent-elements-shell', 'wakeup-banner');
    expect(wakeup).toHaveTextContent('Scheduled to resume in 1h 0m');
    expect(wakeup).toHaveTextContent('Resume after tests');

    fireEvent.click(screen.getByTestId('wakeup-banner-run-now'));
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('wakeup:run-now', 'wakeup-1');
    });

    fireEvent.click(screen.getByTestId('wakeup-banner-cancel'));
    await waitFor(() => {
      expect((window as any).electronAPI.invoke).toHaveBeenCalledWith('wakeup:cancel', 'wakeup-1');
    });

    const pendingReview = screen.getByTestId('agent-elements-pending-review-banner');
    expect(pendingReview).toHaveClass('pending-review-banner', 'agent-elements-pending-review-banner', 'agent-elements-status-banner');
    expect(pendingReview).toHaveAttribute('data-agent-elements-shell', 'pending-review-banner');
    expect(pendingReview).toHaveAttribute('data-pending-count', '2');
    expect(pendingReview).toHaveTextContent('2 files pending review');

    fireEvent.click(screen.getByRole('button', { name: /Keep All/i }));
    await waitFor(() => {
      expect((window as any).electronAPI.history.clearPendingForSession).toHaveBeenCalledWith('/workspace', 'session-1');
    });
  });

  it('keeps AIChat adjunct source on Agent Elements-compatible visual rules', () => {
    const source = [
      readFileSync(fileGutterSourcePath, 'utf8'),
      readFileSync(wakeupBannerSourcePath, 'utf8'),
      readFileSync(pendingReviewBannerSourcePath, 'utf8'),
    ].join('\n');

    expect(source).toContain('agent-elements-file-gutter');
    expect(source).toContain('agent-elements-wakeup-banner');
    expect(source).toContain('agent-elements-pending-review-banner');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-border-color');
    expect(source).not.toMatch(/--nim-|rgba\(|bg-amber|bg-blue|border-amber|border-blue/);
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|text-white|shadow-sm|rounded-lg|rounded-xl|tracking-/);
  });
});
