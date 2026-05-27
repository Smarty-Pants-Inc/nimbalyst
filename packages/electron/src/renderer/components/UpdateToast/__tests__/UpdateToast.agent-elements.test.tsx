// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloadProgressToast } from '../DownloadProgressToast';
import { ReleaseNotesDialog } from '../ReleaseNotesDialog';
import { UpdateAvailableToast } from '../UpdateAvailableToast';
import { UpdateReadyToast } from '../UpdateReadyToast';
import { UpdateToast } from '../UpdateToast';
import { updateStateAtom, type UpdateStateData } from '../../../store/atoms/updateState';

const posthogCaptureMock = vi.hoisted(() => vi.fn());

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: posthogCaptureMock }),
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
    }) =>
      ReactModule.createElement('span', {
        'data-material-symbol': icon,
        'data-size': size,
        className,
      }),
  };
});

const defaultUpdateState: UpdateStateData = {
  state: 'idle',
  updateInfo: null,
  currentVersion: '1.0.0',
  downloadProgress: null,
  errorMessage: '',
};

const updateToastSourceFiles = [
  'DownloadProgressToast.tsx',
  'ReleaseNotesDialog.tsx',
  'UpdateAvailableToast.tsx',
  'UpdateReadyToast.tsx',
  'UpdateToast.tsx',
].map((fileName) =>
  path.join(
    process.cwd(),
    'packages/electron/src/renderer/components/UpdateToast',
    fileName
  )
);

function readUpdateToastSources(): string {
  return updateToastSourceFiles
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n');
}

function installElectronApi({ hasActiveSessions = false }: { hasActiveSessions?: boolean } = {}) {
  const api = {
    send: vi.fn(),
    invoke: vi.fn((channel: string) => {
      if (channel === 'update:has-active-sessions') {
        return Promise.resolve({ hasActiveSessions });
      }
      if (channel === 'update:set-reminder-suppression') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(undefined);
    }),
  };

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: api,
  });

  return api;
}

function renderUpdateToast(state: Partial<UpdateStateData>) {
  const store = createStore();
  store.set(updateStateAtom, {
    ...defaultUpdateState,
    ...state,
  });

  const result = render(
    <JotaiProvider store={store}>
      <UpdateToast />
    </JotaiProvider>
  );

  return { store, ...result };
}

describe('UpdateToast Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    posthogCaptureMock.mockClear();
    installElectronApi();
  });

  it('uses Agent Elements token aliases for visual chrome', () => {
    const source = readUpdateToastSources();

    expect(source).toContain('--an-button-primary-text');
    expect(source).toContain('--an-foreground');
    expect(source).toContain('--an-success-color');
    expect(source).toContain('--an-error-color');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).toContain('data-agent-elements-card-width="floating-toast"');
    expect(source).not.toMatch(/var\(--nim-(?:text|primary-hover|success|error)\)/);
    expect(source).not.toMatch(/shadow-\[[^\]]*var\(--nim/);
    expect(source).not.toContain('text-[var(--an-background)]');
    expect(source).not.toMatch(/agent-elements-update-toast agent-elements-tool-card[^`'"]*\bp-\[var\(--an-spacing/);
  });

  it('renders Agent Elements shells for available, download, and ready update toasts while preserving callbacks', () => {
    const onUpdateNow = vi.fn();
    const onViewReleaseNotes = vi.fn();
    const onRemindLater = vi.fn();
    const onDismiss = vi.fn();

    const { rerender } = render(
      <UpdateAvailableToast
        version="2.0.0"
        onUpdateNow={onUpdateNow}
        onViewReleaseNotes={onViewReleaseNotes}
        onRemindLater={onRemindLater}
        onDismiss={onDismiss}
      />
    );

    const availableToast = screen.getByTestId('update-available-toast');
    expect(availableToast).toHaveClass('update-toast', 'agent-elements-update-toast', 'agent-elements-tool-card');
    expect(availableToast).toHaveAttribute('data-component', 'UpdateAvailableToast');
    expect(availableToast).toHaveAttribute('data-agent-elements-shell', 'update-available-toast');
    expect(availableToast).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(availableToast).toHaveAttribute('data-agent-elements-card-width', 'floating-toast');
    expect(screen.getByTestId('agent-elements-update-toast-icon')).toHaveAttribute(
      'data-agent-elements-shell',
      'update-toast-icon'
    );
    expect(screen.getByTestId('agent-elements-update-toast-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'update-toast-actions'
    );

    fireEvent.click(screen.getByTestId('update-now-btn'));
    fireEvent.click(screen.getByTestId('release-notes-btn'));
    fireEvent.click(screen.getByTestId('remind-later-btn'));
    fireEvent.click(screen.getByTestId('update-toast-dismiss'));
    expect(onUpdateNow).toHaveBeenCalledTimes(1);
    expect(onViewReleaseNotes).toHaveBeenCalledTimes(1);
    expect(onRemindLater).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(
      <DownloadProgressToast
        version="2.0.0"
        progress={{
          bytesPerSecond: 1024,
          percent: 42,
          transferred: 42 * 1024,
          total: 100 * 1024,
        }}
        onCancel={vi.fn()}
      />
    );

    const downloadToast = screen.getByTestId('download-progress-toast');
    expect(downloadToast).toHaveClass('update-toast', 'agent-elements-update-toast', 'agent-elements-tool-card');
    expect(downloadToast).toHaveAttribute('data-component', 'DownloadProgressToast');
    expect(downloadToast).toHaveAttribute('data-agent-elements-shell', 'download-progress-toast');
    expect(downloadToast).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(downloadToast).toHaveAttribute('data-agent-elements-card-width', 'floating-toast');
    expect(screen.getByTestId('agent-elements-update-toast-progress')).toHaveAttribute(
      'data-agent-elements-shell',
      'update-toast-progress'
    );
    expect(screen.getByTestId('download-progress-fill')).toHaveAttribute('data-percent', '42');

    rerender(
      <UpdateReadyToast
        version="2.0.0"
        waitingForSessions={true}
        onRelaunch={vi.fn()}
        onForceRestart={vi.fn()}
        onDoItLater={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    const readyToast = screen.getByTestId('update-ready-toast');
    expect(readyToast).toHaveClass('update-toast', 'agent-elements-update-toast', 'agent-elements-tool-card');
    expect(readyToast).toHaveAttribute('data-component', 'UpdateReadyToast');
    expect(readyToast).toHaveAttribute('data-agent-elements-shell', 'update-ready-toast');
    expect(readyToast).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(readyToast).toHaveAttribute('data-agent-elements-card-width', 'floating-toast');
    expect(readyToast).toHaveAttribute('data-update-waiting-for-sessions', 'true');
  });

  it('renders checking, up-to-date, and error states with Agent Elements shell markers', () => {
    const { unmount } = renderUpdateToast({ state: 'checking' });
    expect(screen.getByTestId('update-toast-container')).toHaveClass('agent-elements-update-toast-container');
    expect(screen.getByTestId('update-checking-toast')).toHaveClass(
      'agent-elements-update-toast',
      'agent-elements-tool-card'
    );
    expect(screen.getByTestId('update-checking-toast')).toHaveAttribute(
      'data-agent-elements-shell',
      'update-checking-toast'
    );
    expect(screen.getByTestId('update-checking-toast')).toHaveAttribute(
      'data-agent-elements-card-width',
      'floating-toast'
    );

    unmount();
    renderUpdateToast({ state: 'up-to-date', currentVersion: '1.0.0' });
    expect(screen.getByTestId('update-up-to-date-toast')).toHaveAttribute(
      'data-agent-elements-shell',
      'update-up-to-date-toast'
    );
    expect(screen.getByTestId('update-up-to-date-toast')).toHaveAttribute(
      'data-agent-elements-card-width',
      'floating-toast'
    );
    expect(screen.getByTestId('agent-elements-update-toast-icon')).toHaveClass('agent-elements-status-pill');

    fireEvent.click(screen.getByTestId('update-toast-dismiss'));
    expect(screen.queryByTestId('update-up-to-date-toast')).not.toBeInTheDocument();
  });

  it('preserves update state transitions, analytics, and IPC inside the Agent Elements shell', async () => {
    const api = installElectronApi({ hasActiveSessions: true });
    const { store } = renderUpdateToast({
      state: 'available',
      updateInfo: {
        version: '2.0.0',
        releaseNotes: '## Fixed\n\n- Better updates',
      },
      currentVersion: '1.0.0',
    });

    expect(screen.getByTestId('update-toast-container')).toHaveAttribute('data-agent-elements-shell', 'update-toast-container');
    fireEvent.click(screen.getByTestId('release-notes-btn'));

    await waitFor(() => {
      expect(store.get(updateStateAtom).state).toBe('viewing-notes');
      expect(screen.getByTestId('agent-elements-release-notes-dialog')).toBeInTheDocument();
    });
    expect(posthogCaptureMock).toHaveBeenCalledWith('update_toast_action', {
      action: 'release_notes_clicked',
      new_version: '2.0.0',
    });

    fireEvent.click(screen.getByTestId('release-notes-update-btn'));
    expect(api.send).toHaveBeenCalledWith('update-toast:download');
    expect(store.get(updateStateAtom).state).toBe('downloading');
  });

  it('preserves relaunch deferral when active AI sessions are running', async () => {
    const api = installElectronApi({ hasActiveSessions: true });
    const { store } = renderUpdateToast({
      state: 'ready',
      updateInfo: { version: '2.0.0' },
      currentVersion: '1.0.0',
    });

    fireEvent.click(screen.getByTestId('relaunch-btn'));

    await waitFor(() => {
      expect(api.invoke).toHaveBeenCalledWith('update:has-active-sessions');
      expect(api.send).toHaveBeenCalledWith('update-toast:install-when-idle');
      expect(store.get(updateStateAtom).state).toBe('waiting-for-sessions');
    });
  });
});

describe('ReleaseNotesDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an Agent Elements release-notes dialog while preserving close and update behavior', () => {
    const onClose = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ReleaseNotesDialog
        currentVersion="1.0.0"
        newVersion="2.0.0"
        releaseNotes="## Fixed\n\n- Better update rendering"
        onClose={onClose}
        onUpdate={onUpdate}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-release-notes-dialog-backdrop');
    expect(backdrop).toHaveClass('update-dialog-backdrop', 'agent-elements-release-notes-dialog-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'release-notes-dialog-backdrop');

    const dialog = screen.getByTestId('agent-elements-release-notes-dialog');
    expect(dialog).toHaveClass('update-dialog', 'agent-elements-release-notes-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'ReleaseNotesDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'release-notes-dialog');

    expect(screen.getByTestId('agent-elements-release-notes-dialog-header')).toHaveTextContent('Update available');
    expect(screen.getByTestId('agent-elements-release-notes-dialog-version-row')).toHaveAttribute(
      'data-agent-elements-shell',
      'release-notes-version-row'
    );
    expect(screen.getByTestId('current-version-badge')).toHaveTextContent('1.0.0');
    expect(screen.getByTestId('new-version-badge')).toHaveTextContent('2.0.0');
    expect(screen.getByTestId('release-notes-content')).toHaveClass('select-text');
    expect(screen.getByTestId('release-notes-content')).toHaveTextContent('Better update rendering');

    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('release-notes-update-btn'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
