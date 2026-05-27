// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ProjectSelectionDialog } from '../ProjectSelectionDialog';

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

const recentProjects = [
  { name: 'Smarty Code', path: '/workspace/smarty-code' },
  { name: 'Daily Driver', path: '/workspace/daily-driver' },
];

describe('ProjectSelectionDialog Agent Elements shell', () => {
  it('keeps project selection dialog visual chrome on Agent Elements aliases', () => {
    const sourcePath = [
      path.join(
        process.cwd(),
        'src/renderer/components/ProjectSelectionDialog/ProjectSelectionDialog.tsx',
      ),
      path.join(
        process.cwd(),
        'packages/electron/src/renderer/components/ProjectSelectionDialog/ProjectSelectionDialog.tsx',
      ),
    ].find((candidate) => fs.existsSync(candidate));

    expect(sourcePath).toBeTruthy();
    const source = fs.readFileSync(sourcePath!, 'utf8');

    expect(source).toContain('--an-foreground');
    expect(source).toContain('--an-button-primary-text');
    expect(source).toContain('--an-primary-color');
    expect(source).not.toMatch(/var\(--nim-(?:text|primary-hover)\)/);
    expect(source).not.toMatch(/shadow-\[[^\]]*var\(--nim-/);
    expect(source).not.toContain('text-[var(--an-background)]');
  });

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: vi.fn((channel: string, options?: unknown) => {
          if (channel === 'get-recent-workspaces') {
            return Promise.resolve(recentProjects);
          }

          if (channel === 'dialog-show-open-dialog') {
            const title = typeof options === 'object' && options && 'title' in options
              ? (options as { title?: string }).title
              : undefined;

            return Promise.resolve({
              canceled: false,
              filePaths: [title === 'Create New Project' ? '/workspace/new-project' : '/workspace/browsed-project'],
            });
          }

          return Promise.resolve(undefined);
        }),
      },
    });
  });

  it('renders an Agent Elements dialog shell while preserving suggested and recent project selection', async () => {
    const onSelectProject = vi.fn();
    const onCancel = vi.fn();

    render(
      <ProjectSelectionDialog
        isOpen={true}
        fileName="notes.md"
        suggestedWorkspace="/workspace/smarty-code"
        onSelectProject={onSelectProject}
        onCancel={onCancel}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-project-selection-dialog-backdrop');
    expect(backdrop).toHaveClass(
      'project-selection-dialog-overlay',
      'agent-elements-project-selection-dialog-backdrop'
    );
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'project-selection-dialog-backdrop');

    const dialog = screen.getByTestId('agent-elements-project-selection-dialog');
    expect(dialog).toHaveClass(
      'project-selection-dialog',
      'agent-elements-project-selection-dialog',
      'agent-elements-tool-card'
    );
    expect(dialog).toHaveAttribute('data-component', 'ProjectSelectionDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'project-selection-dialog');

    expect(screen.getByTestId('agent-elements-project-selection-dialog-header')).toHaveAttribute(
      'data-agent-elements-shell',
      'project-selection-dialog-header'
    );
    expect(screen.getByTestId('agent-elements-project-selection-dialog-suggested')).toHaveClass(
      'project-selection-suggested',
      'agent-elements-tool-card'
    );
    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('get-recent-workspaces');
    });

    expect(await screen.findByTestId('agent-elements-project-selection-dialog-recent')).toHaveAttribute(
      'data-agent-elements-shell',
      'project-selection-dialog-recent'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use This Project' }));
    expect(onSelectProject).toHaveBeenCalledWith('/workspace/smarty-code');

    const recentList = screen.getByTestId('agent-elements-project-selection-dialog-list');
    const dailyDriverRow = within(recentList).getByText('Daily Driver').closest('.project-selection-item');
    expect(dailyDriverRow).toHaveClass('agent-elements-project-selection-dialog-row');

    fireEvent.click(within(recentList).getByText('Daily Driver'));
    expect(dailyDriverRow).toHaveAttribute('data-selected', 'true');
    expect(dailyDriverRow).not.toHaveClass('text-white');

    fireEvent.click(screen.getByRole('button', { name: 'Use Selected Project' }));
    expect(onSelectProject).toHaveBeenCalledWith('/workspace/daily-driver');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('preserves browse, create, and cancel behavior inside the Agent Elements shell', async () => {
    const onSelectProject = vi.fn();
    const onCancel = vi.fn();

    render(
      <ProjectSelectionDialog
        isOpen={true}
        fileName="notes.md"
        onSelectProject={onSelectProject}
        onCancel={onCancel}
      />
    );

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('get-recent-workspaces');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Browse for Project...' }));
    await waitFor(() => {
      expect(onSelectProject).toHaveBeenCalledWith('/workspace/browsed-project');
    });
    expect(window.electronAPI.invoke).toHaveBeenCalledWith('dialog-show-open-dialog', {
      properties: ['openDirectory', 'createDirectory'],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create New Project...' }));
    await waitFor(() => {
      expect(onSelectProject).toHaveBeenCalledWith('/workspace/new-project');
    });
    expect(window.electronAPI.invoke).toHaveBeenCalledWith('dialog-show-open-dialog', {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Create New Project',
      buttonLabel: 'Create Project',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
