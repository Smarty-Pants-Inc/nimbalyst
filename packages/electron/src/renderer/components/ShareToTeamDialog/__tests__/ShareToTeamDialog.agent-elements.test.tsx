// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareToTeamDialog } from '../ShareToTeamDialog';

const sourcePath = resolve(__dirname, '../ShareToTeamDialog.tsx');

const mockState = vi.hoisted(() => ({
  sharedDocuments: [] as Array<{
    documentId: string;
    title: string;
    documentType: string;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  }>,
  activeWorkspacePath: '/workspace',
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === 'shared-documents') return mockState.sharedDocuments;
    if (atom === 'active-workspace-path') return mockState.activeWorkspacePath;
    return undefined;
  }),
}));

vi.mock('../../../store/atoms/collabDocuments', () => ({
  sharedDocumentsAtom: 'shared-documents',
}));

vi.mock('../../../store/atoms/openProjects', () => ({
  activeWorkspacePathAtom: 'active-workspace-path',
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
      'aria-hidden': ariaHidden,
    }: {
      icon: string;
      size?: number;
      className?: string;
      'aria-hidden'?: boolean | 'true' | 'false';
    }) =>
      ReactModule.createElement('span', {
        'data-icon': icon,
        'data-size': size,
        className,
        'aria-hidden': ariaHidden,
      }),
  };
});

function installElectronApi(state: unknown = {}) {
  const api = {
    invoke: vi.fn().mockResolvedValue(state),
  };

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: api,
  });

  return api;
}

describe('ShareToTeamDialog Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.activeWorkspacePath = '/workspace';
    mockState.sharedDocuments = [
      {
        documentId: 'doc-1',
        title: 'Engineering/Design Reviews/plan.md',
        documentType: 'markdown',
        createdBy: 'user-1',
        createdAt: 1,
        updatedAt: 2,
      },
    ];
  });

  it('renders an Agent Elements share-to-team shell while preserving persisted folder state and overlay close behavior', async () => {
    const api = installElectronApi({
      collabTree: {
        customFolders: ['Archive'],
        lastSharedFolder: 'Engineering/Design Reviews',
      },
    });
    const onClose = vi.fn();

    const { rerender } = render(
      <ShareToTeamDialog
        isOpen={false}
        onClose={onClose}
        fileName="closed.md"
        sourceRelPath="docs/closed.md"
        onConfirm={vi.fn()}
      />
    );

    expect(screen.queryByTestId('agent-elements-share-to-team-dialog')).not.toBeInTheDocument();

    rerender(
      <ShareToTeamDialog
        isOpen={true}
        onClose={onClose}
        fileName="plan.md"
        sourceRelPath="docs/plan.md"
        onConfirm={vi.fn()}
      />
    );

    const backdrop = screen.getByTestId('agent-elements-share-to-team-backdrop');
    expect(backdrop).toHaveClass('share-to-team-overlay', 'agent-elements-share-to-team-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'share-to-team-backdrop');

    const dialog = screen.getByTestId('agent-elements-share-to-team-dialog');
    expect(dialog).toHaveClass('share-to-team-dialog', 'agent-elements-share-to-team-dialog', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'ShareToTeamDialog');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'share-to-team-dialog');

    expect(screen.getByTestId('agent-elements-share-to-team-header')).toHaveTextContent('Share to Team');
    expect(screen.getByTestId('agent-elements-share-to-team-source')).toHaveTextContent('docs/plan.md');
    expect(screen.getByTestId('agent-elements-share-to-team-name-field')).toHaveAttribute(
      'data-agent-elements-shell',
      'share-to-team-name-field'
    );
    expect(screen.getByTestId('agent-elements-share-to-team-tree')).toHaveAttribute(
      'data-agent-elements-shell',
      'share-to-team-tree'
    );
    expect(screen.getByTestId('agent-elements-share-to-team-summary')).toHaveAttribute(
      'data-agent-elements-shell',
      'share-to-team-summary'
    );
    expect(screen.getByTestId('agent-elements-share-to-team-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'share-to-team-actions'
    );

    await waitFor(() => {
      expect(api.invoke).toHaveBeenCalledWith('workspace:get-state', '/workspace');
      expect(screen.getByText('Design Reviews')).toBeInTheDocument();
      expect(screen.getByText('last used')).toHaveAttribute('data-agent-elements-shell', 'share-to-team-badge');
    });

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('preserves shared-name editing, root folder creation, selection, and confirm payloads', async () => {
    const api = installElectronApi({ collabTree: { customFolders: [], lastSharedFolder: '' } });
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ShareToTeamDialog
        isOpen={true}
        onClose={onClose}
        fileName="plan.md"
        sourceRelPath="docs/plan.md"
        onConfirm={onConfirm}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('agent-elements-share-to-team-dialog')).toBeInTheDocument();
      expect(api.invoke).toHaveBeenCalledWith('workspace:get-state', '/workspace');
      expect(screen.getByText('last used')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('agent-elements-share-to-team-name-input'), {
      target: { value: 'team-plan.md' },
    });
    fireEvent.click(screen.getByRole('button', { name: /new folder/i }));

    const folderInput = screen.getByPlaceholderText('Folder name');
    expect(folderInput).toHaveClass('agent-elements-share-to-team-new-folder-input');
    fireEvent.change(folderInput, { target: { value: 'Design' } });
    fireEvent.keyDown(folderInput, { key: 'Enter' });

    expect(screen.getByText('Design')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('agent-elements-share-to-team-summary')).toHaveTextContent('Design /');
      expect(screen.getByTestId('agent-elements-share-to-team-summary')).toHaveTextContent('team-plan.md');
    });

    fireEvent.click(screen.getByRole('button', { name: /^Share to Team$/i }));

    expect(onConfirm).toHaveBeenCalledWith({ folderPath: 'Design', sharedName: 'team-plan.md' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('removes old modal chrome in favor of Agent Elements source markers and tokenized visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-share-to-team-dialog');
    expect(source).toContain('data-agent-elements-shell="share-to-team-dialog"');
    expect(source).not.toMatch(/bg-black\/60|rounded-xl|shadow-2xl|text-white|text-\[#0f1115\]/);
    expect(source).not.toMatch(/tracking-wider|w-0\.5|bg-\[var\(--nim-primary\)\]\/20/);
  });
});
