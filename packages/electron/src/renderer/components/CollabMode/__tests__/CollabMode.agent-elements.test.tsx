// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollabMode } from '../CollabMode';

const collabModeSourcePath = resolve(__dirname, '../CollabMode.tsx');

const mockState = vi.hoisted(() => ({
  pendingDoc: null as null | { documentId: string; initialContent?: string; documentType?: string },
  sharedDocuments: [] as Array<{
    documentId: string;
    title: string;
    documentType: string;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  }>,
  tabs: [] as Array<{ id: string; filePath: string; fileName: string }>,
  activeTabId: null as string | null,
  addTab: vi.fn(() => 'tab-created'),
  removeTab: vi.fn(),
  switchTab: vi.fn(),
  updateTab: vi.fn(),
  openCollabDocumentViaIPC: vi.fn(async () => 'tab-created'),
  initSharedDocuments: vi.fn(),
  storeGet: vi.fn(),
  storeSet: vi.fn(),
  electronInvoke: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn((atom: string) => {
    if (atom === 'pending-collab-document') return mockState.pendingDoc;
    if (atom === 'shared-documents') return mockState.sharedDocuments;
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
  store: {
    get: mockState.storeGet,
    set: mockState.storeSet,
  },
}));

vi.mock('../../../store/atoms/collabDocuments', () => ({
  pendingCollabDocumentAtom: 'pending-collab-document',
  sharedDocumentsAtom: 'shared-documents',
  initSharedDocuments: mockState.initSharedDocuments,
}));

vi.mock('../../../contexts/TabsContext', async () => {
  const ReactModule = await import('react');
  return {
    TabsProvider: ({ children, workspacePath, disablePersistence }: any) => (
      <div
        data-testid="mock-tabs-provider"
        data-workspace-path={workspacePath}
        data-disable-persistence={String(disablePersistence)}
      >
        {children}
      </div>
    ),
    useTabsActions: () => ({
      addTab: mockState.addTab,
      removeTab: mockState.removeTab,
      switchTab: mockState.switchTab,
      updateTab: mockState.updateTab,
    }),
    useTabs: () => ({
      tabs: mockState.tabs,
      activeTabId: mockState.activeTabId,
    }),
  };
});

vi.mock('../CollabSidebar', () => ({
  CollabSidebar: ({ workspacePath, onDocumentSelect, activeDocumentId }: any) => (
    <div
      data-testid="mock-collab-sidebar"
      data-workspace-path={workspacePath}
      data-active-document-id={activeDocumentId ?? ''}
    >
      <button
        type="button"
        data-testid="mock-open-collab-document"
        onClick={() => onDocumentSelect(mockState.sharedDocuments[0], 'seed content')}
      />
    </div>
  ),
}));

vi.mock('../../TabManager/TabManager', () => ({
  TabManager: ({ children, onTabClose, isActive }: any) => (
    <div data-testid="mock-tab-manager" data-active={String(isActive)}>
      <button type="button" data-testid="mock-close-collab-tab" onClick={() => onTabClose('tab-1')} />
      {children}
    </div>
  ),
}));

vi.mock('../../TabContent/TabContent', () => ({
  TabContent: ({ onTabClose, onGetContentReady }: any) => (
    <div data-testid="mock-tab-content">
      <button type="button" data-testid="mock-tab-content-close" onClick={() => onTabClose('tab-1')} />
      <button
        type="button"
        data-testid="mock-content-ready"
        onClick={() => onGetContentReady('tab-1', () => 'live collab content')}
      />
    </div>
  ),
}));

vi.mock('../../ChatSidebar', () => ({
  ChatSidebar: ({ workspacePath, width, onWidthChange, onFileOpen, getDocumentContext }: any) => (
    <div data-testid="mock-chat-sidebar" data-workspace-path={workspacePath} data-width={width}>
      <button type="button" data-testid="mock-chat-width" onClick={() => onWidthChange(420)} />
      <button type="button" data-testid="mock-chat-open-file" onClick={() => onFileOpen('/workspace/demo/file.md')} />
      <button
        type="button"
        data-testid="mock-chat-context"
        onClick={async () => {
          const context = await getDocumentContext();
          (window as any).__collabDocumentContext = context;
        }}
      />
    </div>
  ),
}));

vi.mock('../../../utils/collabDocumentOpener', () => ({
  openCollabDocumentViaIPC: mockState.openCollabDocumentViaIPC,
}));

vi.mock('../../../services/ErrorNotificationService', () => ({
  errorNotificationService: {
    showError: vi.fn(),
  },
}));

describe('CollabMode Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockState.pendingDoc = null;
    mockState.sharedDocuments = [
      {
        documentId: 'doc-1',
        title: 'Team Plan',
        documentType: 'markdown',
        createdBy: 'user-1',
        createdAt: 1,
        updatedAt: 2,
      },
    ];
    mockState.tabs = [];
    mockState.activeTabId = null;
    mockState.storeGet.mockImplementation((atom: string) => {
      if (atom === 'shared-documents') return mockState.sharedDocuments;
      return undefined;
    });
    mockState.electronInvoke.mockResolvedValue({
      collabLayout: { sidebarWidth: 260, chatWidth: 390 },
      openCollabDocumentIds: [],
    });
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: mockState.electronInvoke,
        updateMcpDocumentState: vi.fn(),
      },
    });
    delete (window as any).__collabDocumentContext;
  });

  it('wraps the empty shared-document workspace in Agent Elements chrome without changing provider setup', async () => {
    render(<CollabMode workspacePath="/workspace/demo" isActive onFileOpen={vi.fn()} />);

    const root = screen.getByTestId('agent-elements-collab-mode');
    expect(root).toHaveClass('collab-mode', 'agent-elements-collab-mode');
    expect(root).toHaveAttribute('data-component', 'CollabMode');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'collab-mode');
    expect(root).toHaveAttribute('data-active', 'true');

    expect(screen.getByTestId('mock-tabs-provider')).toHaveAttribute('data-workspace-path', '/workspace/demo');
    expect(screen.getByTestId('mock-tabs-provider')).toHaveAttribute('data-disable-persistence', 'true');
    expect(screen.getByTestId('mock-collab-sidebar')).toHaveAttribute('data-workspace-path', '/workspace/demo');

    expect(screen.getByTestId('agent-elements-collab-resize-handle')).toHaveAttribute(
      'data-agent-elements-shell',
      'collab-resize-handle'
    );
    expect(screen.getByTestId('agent-elements-collab-resize-grip')).toHaveAttribute(
      'data-agent-elements-shell',
      'collab-resize-grip'
    );

    const emptyState = screen.getByTestId('agent-elements-collab-empty-state');
    expect(emptyState).toHaveClass('collab-empty-state', 'agent-elements-collab-empty-state');
    expect(emptyState).toHaveAttribute('data-agent-elements-shell', 'collab-empty-state');
    expect(screen.getByTestId('agent-elements-collab-empty-card')).toHaveClass('agent-elements-tool-card');
    expect(screen.getByText('Select a shared document')).toHaveClass('agent-elements-collab-empty-title');
    expect(screen.getByText('Choose a document from the sidebar to start collaborating')).toHaveClass(
      'agent-elements-collab-empty-description'
    );

    await waitFor(() => {
      expect(mockState.initSharedDocuments).toHaveBeenCalledWith('/workspace/demo');
    });
  });

  it('preserves collab tab, chat, active-document, and persisted layout wiring inside the shell', async () => {
    const onFileOpen = vi.fn();
    mockState.tabs = [
      {
        id: 'tab-1',
        filePath: 'collab://org:org-1:doc:doc-1',
        fileName: 'Team Plan',
      },
    ];
    mockState.activeTabId = 'tab-1';

    render(<CollabMode workspacePath="/workspace/demo" isActive onFileOpen={onFileOpen} />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-chat-sidebar')).toHaveAttribute('data-width', '390');
    });

    expect(screen.getByTestId('mock-collab-sidebar')).toHaveAttribute('data-active-document-id', 'doc-1');
    expect(screen.getByTestId('mock-tab-manager')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('mock-tab-content')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mock-close-collab-tab'));
    expect(mockState.removeTab).toHaveBeenCalledWith('tab-1');

    fireEvent.click(screen.getByTestId('mock-content-ready'));
    fireEvent.click(screen.getByTestId('mock-chat-context'));
    await waitFor(() => {
      expect((window as any).__collabDocumentContext).toEqual({
        filePath: 'collab://org:org-1:doc:doc-1',
        fileType: 'collab-markdown',
        content: 'live collab content',
      });
    });

    fireEvent.click(screen.getByTestId('mock-chat-width'));
    await waitFor(() => {
      expect(mockState.electronInvoke).toHaveBeenCalledWith('workspace:update-state', '/workspace/demo', {
        collabLayout: { sidebarWidth: 260, chatWidth: 420 },
      });
    });

    fireEvent.click(screen.getByTestId('mock-chat-open-file'));
    expect(onFileOpen).toHaveBeenCalledWith('/workspace/demo/file.md');
  });

  it('keeps CollabMode source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(collabModeSourcePath, 'utf8');

    expect(source).toContain('agent-elements-collab-mode');
    expect(source).toContain('data-agent-elements-shell="collab-mode"');
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/bg-white|text-white|bg-black|hover:scale|tracking-/);
    expect(source).not.toMatch(/--nim-accent|--nim-surface|text-nim-fg|bg-nim-secondary|text-nim-muted|text-nim-faint|<svg/);
  });
});
