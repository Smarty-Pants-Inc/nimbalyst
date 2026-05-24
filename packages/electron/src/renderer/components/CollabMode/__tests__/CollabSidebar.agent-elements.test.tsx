// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollabSidebar } from '../CollabSidebar';

const collabSidebarSourcePath = resolve(__dirname, '../CollabSidebar.tsx');

const mockState = vi.hoisted(() => ({
  sharedDocuments: [] as Array<{
    documentId: string;
    title: string;
    documentType: string;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  }>,
  teamSyncStatus: 'connected' as 'connected' | 'connecting' | 'syncing' | 'disconnected' | 'error',
  activeTeamOrgId: 'org-1' as string | null,
  removeSharedDocument: vi.fn(),
  updateSharedDocumentTitle: vi.fn(),
  registerDocumentInIndex: vi.fn(),
  electronInvoke: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === 'shared-documents') return mockState.sharedDocuments;
    if (atom === 'team-sync-status') return mockState.teamSyncStatus;
    if (atom === 'active-team-org-id') return mockState.activeTeamOrgId;
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
    }) =>
      ReactModule.createElement('span', {
        'data-icon': icon,
        'data-size': size,
        className,
      }),
  };
});

vi.mock('../../../store/atoms/collabDocuments', () => ({
  sharedDocumentsAtom: 'shared-documents',
  teamSyncStatusAtom: 'team-sync-status',
  activeTeamOrgIdAtom: 'active-team-org-id',
  removeSharedDocument: mockState.removeSharedDocument,
  updateSharedDocumentTitle: mockState.updateSharedDocumentTitle,
  registerDocumentInIndex: mockState.registerDocumentInIndex,
  buildSharedDocumentDeepLink: (documentId: string, orgId: string) => `nimbalyst://doc/${documentId}?orgId=${orgId}`,
}));

vi.mock('../../WorkspaceSummaryHeader', async () => {
  const ReactModule = await import('react');
  return {
    WorkspaceSummaryHeader: ({
      workspacePath,
      subtitle,
      actions,
      actionsClassName,
    }: {
      workspacePath: string;
      subtitle?: React.ReactNode;
      actions?: React.ReactNode;
      actionsClassName?: string;
    }) => (
      <header data-testid="workspace-summary-header" data-path={workspacePath}>
        <div data-testid="workspace-summary-subtitle">{subtitle}</div>
        <div data-testid="workspace-summary-actions" className={actionsClassName}>{actions}</div>
      </header>
    ),
  };
});

vi.mock('../../InputModal', async () => {
  const ReactModule = await import('react');
  return {
    InputModal: ({
      isOpen,
      title,
      defaultValue,
      confirmLabel,
      onConfirm,
      onCancel,
    }: {
      isOpen: boolean;
      title: string;
      defaultValue?: string;
      confirmLabel: string;
      onConfirm: (value: string) => void;
      onCancel: () => void;
    }) => isOpen ? (
      <div data-testid={`input-modal-${title}`}>
        <button type="button" onClick={() => onConfirm(defaultValue || 'Created')}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
  };
});

vi.mock('../../../hooks/useFloatingMenu', async () => {
  const ReactModule = await import('react');
  return {
    FloatingPortal: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement('div', { 'data-testid': 'floating-portal' }, children),
    virtualElement: (x: number, y: number) => ({
      getBoundingClientRect: () => ({
        x,
        y,
        width: 0,
        height: 0,
        top: y,
        left: x,
        right: x,
        bottom: y,
      }),
    }),
    useFloatingMenu: () => ({
      isOpen: true,
      setIsOpen: vi.fn(),
      refs: {
        setFloating: vi.fn(),
        setReference: vi.fn(),
        setPositionReference: vi.fn(),
      },
      floatingStyles: { position: 'fixed', left: 24, top: 28 },
      getReferenceProps: () => ({}),
      getFloatingProps: () => ({ role: 'menu' }),
      context: {},
    }),
  };
});

describe('CollabSidebar Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.teamSyncStatus = 'connected';
    mockState.activeTeamOrgId = 'org-1';
    mockState.sharedDocuments = [
      {
        documentId: 'doc-1',
        title: 'Specs/API Spec',
        documentType: 'markdown',
        createdBy: 'user-1',
        createdAt: 1,
        updatedAt: 2,
      },
      {
        documentId: 'doc-2',
        title: 'Roadmap',
        documentType: 'markdown',
        createdBy: 'user-1',
        createdAt: 3,
        updatedAt: 4,
      },
    ];
    mockState.electronInvoke.mockResolvedValue({
      collabTree: {
        expandedFolders: ['Specs'],
        customFolders: ['Archive'],
      },
    });
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: mockState.electronInvoke,
      },
    });
  });

  it('renders shared documents with Agent Elements markers while preserving selection and tree behavior', async () => {
    const onDocumentSelect = vi.fn();
    render(
      <CollabSidebar
        workspacePath="/workspace/demo"
        activeDocumentId="doc-1"
        onDocumentSelect={onDocumentSelect}
      />,
    );

    const sidebar = screen.getByTestId('collab-sidebar');
    expect(sidebar).toHaveClass('collab-sidebar', 'agent-elements-collab-sidebar');
    expect(sidebar).toHaveAttribute('data-component', 'CollabSidebar');
    expect(sidebar).toHaveAttribute('data-agent-elements-shell', 'collab-sidebar');

    expect(screen.getByTestId('agent-elements-collab-sync-status')).toHaveAttribute('data-sync-status', 'connected');
    expect(screen.getByTestId('agent-elements-collab-doc-tree')).toHaveAttribute(
      'data-agent-elements-shell',
      'collab-document-tree',
    );

    const apiSpec = await screen.findByRole('button', { name: /api spec/i });
    expect(apiSpec).toHaveClass('file-tree-file', 'agent-elements-collab-tree-row', 'active');
    expect(apiSpec).toHaveAttribute('data-collab-node-type', 'document');
    expect(apiSpec).toHaveAttribute('data-active', 'true');

    const specs = screen.getByRole('button', { name: /specs/i });
    expect(specs).toHaveClass('file-tree-directory', 'agent-elements-collab-tree-row');
    expect(specs).toHaveAttribute('data-collab-node-type', 'folder');
    expect(specs).toHaveAttribute('data-expanded', 'true');

    const roadmap = screen.getByRole('button', { name: /roadmap/i });
    fireEvent.click(roadmap);
    expect(onDocumentSelect).toHaveBeenCalledWith(mockState.sharedDocuments[1]);

    expect(mockState.electronInvoke).toHaveBeenCalledWith('workspace:get-state', '/workspace/demo');
    await waitFor(() => {
      expect(mockState.electronInvoke).toHaveBeenCalledWith(
        'workspace:update-state',
        '/workspace/demo',
        expect.objectContaining({
          collabTree: expect.objectContaining({
            expandedFolders: expect.arrayContaining(['Specs']),
          }),
        }),
      );
    });
  });

  it('renders the document context menu through Floating UI with Agent Elements action rows', async () => {
    render(
      <CollabSidebar
        workspacePath="/workspace/demo"
        activeDocumentId="doc-1"
        onDocumentSelect={vi.fn()}
      />,
    );

    const apiSpec = await screen.findByRole('button', { name: /api spec/i });
    fireEvent.contextMenu(apiSpec, { clientX: 24, clientY: 28 });

    const portal = screen.getByTestId('floating-portal');
    const menu = within(portal).getByTestId('agent-elements-collab-context-menu');
    expect(menu).toHaveClass('agent-elements-collab-context-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-component', 'CollabSidebarContextMenu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'collab-context-menu');

    expect(within(menu).getByTestId('agent-elements-collab-context-open')).toHaveAttribute(
      'data-collab-action',
      'open',
    );
    expect(within(menu).getByTestId('agent-elements-collab-context-rename')).toHaveAttribute(
      'data-collab-action',
      'rename',
    );
    expect(within(menu).getByTestId('agent-elements-collab-context-delete')).toHaveAttribute(
      'data-collab-action',
      'delete',
    );
  });

  it('keeps CollabSidebar source on Agent Elements-compatible visual and positioning rules', () => {
    const source = readFileSync(collabSidebarSourcePath, 'utf8');

    expect(source).toContain('agent-elements-collab-sidebar');
    expect(source).toContain('agent-elements-collab-tree-row');
    expect(source).toContain('agent-elements-collab-context-menu');
    expect(source).toContain('data-agent-elements-shell="collab-sidebar"');
    expect(source).toContain('useFloatingMenu');
    expect(source).toContain('FloatingPortal');
    expect(source).toContain('virtualElement');

    expect(source).not.toMatch(/bg-(green|blue|yellow|gray|red)-500/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl/);
    expect(source).not.toMatch(/shadow-lg|backdrop-blur/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/bg-white|text-white|bg-black|hover:scale|tracking-/);
    expect(source).not.toMatch(/--nim-accent|--nim-surface|text-nim-fg|<svg/);
  });
});
