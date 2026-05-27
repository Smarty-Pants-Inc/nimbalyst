// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedEditorHeaderBar } from '../UnifiedEditorHeaderBar';

const testState = vi.hoisted(() => ({
  electronInvoke: vi.fn(),
  headings: [] as Array<{
    __heading: true;
    getTag: () => string;
    getTextContent: () => string;
    getKey: () => string;
  }>,
  openHistoryDialog: vi.fn(),
  openShareDialog: vi.fn(),
}));

vi.mock('@lexical/rich-text', () => ({
  $isHeadingNode: (node: { __heading?: boolean }) => Boolean(node.__heading),
}));

vi.mock('lexical', () => ({
  $getRoot: () => ({
    getChildren: () => testState.headings,
  }),
}));

vi.mock('@lexical/html', () => ({
  $generateHtmlFromNodes: () => '<p>Generated HTML</p>',
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    $convertFromEnhancedMarkdownString: vi.fn(),
    $convertToEnhancedMarkdownString: vi.fn(() => '# Heading'),
    applyTrackerTypeToMarkdown: vi.fn((markdown: string) => markdown),
    copyToClipboard: vi.fn(() => Promise.resolve()),
    getCurrentTrackerTypeFromMarkdown: vi.fn(() => null),
    getDefaultFrontmatterForType: vi.fn(() => ({})),
    getEditorTransformers: vi.fn(() => []),
    getModelDefaults: vi.fn(() => ({})),
    removeTrackerTypeFromMarkdown: vi.fn((markdown: string) => markdown),
    wrapWithPrintStyles: vi.fn((content: string) => content),
    MaterialSymbol: ({
      icon,
      size,
      className,
    }: {
      icon: string;
      size?: number;
      className?: string;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
    ProviderIcon: ({ provider, size }: { provider: string; size?: number }) =>
      ReactModule.createElement('span', { 'data-provider-icon': provider, 'data-size': size }),
  };
});

vi.mock('jotai', async () => {
  const actual = await vi.importActual<typeof import('jotai')>('jotai');
  return {
    ...actual,
    useSetAtom: () => testState.openHistoryDialog,
  };
});

vi.mock('../../../store', async () => {
  const { atom } = await vi.importActual<typeof import('jotai')>('jotai');
  return {
    historyDialogFileAtom: atom<string | null>(null),
  };
});

vi.mock('../../../services/RendererDocumentService', () => ({
  getDocumentService: () => ({
    notifyFrontmatterChanged: vi.fn(),
  }),
}));

vi.mock('../../../dialogs', () => ({
  DIALOG_IDS: { SHARE: 'share' },
  dialogRef: {
    current: {
      open: testState.openShareDialog,
    },
  },
}));

vi.mock('../../common/FilePathBreadcrumb', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    FilePathBreadcrumb: ({ filePath }: { filePath: string }) =>
      ReactModule.createElement('div', { 'data-testid': 'mock-file-path-breadcrumb' }, filePath),
  };
});

vi.mock('../../CommonFileActions', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    CommonFileActions: ({
      menuItemClass,
      separatorClass,
      onClose,
      useButtons,
    }: {
      menuItemClass: string;
      separatorClass: string;
      onClose: () => void;
      useButtons?: boolean;
    }) => ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.createElement('div', {
        className: separatorClass,
        'data-testid': 'mock-header-common-file-actions-separator',
      }),
      ReactModule.createElement(
        useButtons ? 'button' : 'div',
        {
          type: useButtons ? 'button' : undefined,
          role: useButtons ? 'menuitem' : undefined,
          className: menuItemClass,
          'data-testid': 'mock-header-common-file-action',
          'data-use-buttons': String(Boolean(useButtons)),
          onClick: onClose,
        },
        'Open in Default App'
      )
    ),
  };
});

function createLexicalEditor() {
  return {
    getEditorState: () => ({
      read: (fn: () => void) => fn(),
    }),
    registerUpdateListener: () => () => undefined,
    getElementByKey: () => ({
      scrollIntoView: vi.fn(),
    }) as unknown as HTMLElement,
    update: (fn: () => void) => fn(),
  };
}

function renderHeader(overrides: Partial<React.ComponentProps<typeof UnifiedEditorHeaderBar>> = {}) {
  const props: React.ComponentProps<typeof UnifiedEditorHeaderBar> = {
    filePath: '/workspace/docs/plan.md',
    fileName: 'plan.md',
    workspaceId: '/workspace',
    isMarkdown: true,
    lexicalEditor: createLexicalEditor(),
    onToggleSourceMode: vi.fn(),
    supportsSourceMode: true,
    onToggleMarkdownMode: vi.fn(),
    onSwitchToAgentMode: vi.fn(),
    onOpenSessionInChat: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<UnifiedEditorHeaderBar {...props} />),
  };
}

describe('UnifiedEditorHeaderBar Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.headings = [
      {
        __heading: true,
        getTag: () => 'h2',
        getTextContent: () => 'Implementation Notes',
        getKey: () => 'heading-1',
      },
    ];
    testState.electronInvoke.mockResolvedValue([
      {
        id: 'session-1',
        title: 'Refactor editor menu',
        provider: 'smarty-server',
        updatedAt: Date.now(),
        createdAt: Date.now(),
        messageCount: 4,
        isCurrentWorkspace: true,
      },
    ]);
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: testState.electronInvoke,
        showSaveDialogPdf: vi.fn(),
        exportHtmlToPdf: vi.fn(),
        showErrorDialog: vi.fn(),
      },
    });
  });

  it('renders the header and actions menu with Agent Elements chrome while preserving action behavior', () => {
    renderHeader();

    const root = screen.getByTestId('agent-elements-editor-header-bar');
    expect(root).toHaveClass('unified-editor-header-bar', 'agent-elements-editor-header-bar');
    expect(root).toHaveAttribute('data-component', 'UnifiedEditorHeaderBar');
    expect(root.className).not.toMatch(/text-white|bg-white|bg-black|scale-/);

    fireEvent.click(screen.getByTestId('agent-elements-editor-header-actions-button'));

    const menu = screen.getByTestId('agent-elements-editor-header-actions-menu');
    expect(menu).toHaveClass('unified-header-actions-dropdown', 'agent-elements-editor-header-actions-menu', 'agent-elements-tool-card');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'editor-header-actions-menu');
    expect(menu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(menu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');
    expect(menu.className).toContain('--agent-elements-card-inline-padding');
    expect(menu.className).toContain('--agent-elements-card-block-padding');
    expect(menu.className).not.toMatch(/border-nim|bg-nim|text-nim|--nim-|rgba|rounded-md|backdrop.*blur|text-white|bg-white|bg-black/);

    const history = screen.getByTestId('agent-elements-editor-header-action-history');
    expect(history.tagName).toBe('BUTTON');
    expect(history).toHaveAttribute('type', 'button');
    expect(history).toHaveAttribute('role', 'menuitem');
    expect(history).toHaveClass('agent-elements-editor-header-menu-item');

    const commonAction = screen.getByTestId('mock-header-common-file-action');
    expect(commonAction.tagName).toBe('BUTTON');
    expect(commonAction).toHaveClass('agent-elements-editor-header-menu-item');
    expect(commonAction).toHaveAttribute('data-use-buttons', 'true');

    fireEvent.click(history);
    expect(testState.openHistoryDialog).toHaveBeenCalledWith('/workspace/docs/plan.md');
  });

  it('renders AI sessions and table of contents menus through Agent Elements shells', async () => {
    renderHeader();

    const aiButton = screen.getByTestId('ai-sessions-button');
    expect(aiButton).toHaveClass('agent-elements-editor-header-ai-button');
    expect(aiButton).toHaveAttribute('data-agent-elements-shell', 'editor-header-ai-button');

    fireEvent.click(aiButton);

    const aiMenu = await screen.findByTestId('agent-elements-editor-header-ai-menu');
    expect(aiMenu).toHaveClass('unified-header-ai-dropdown', 'agent-elements-editor-header-ai-menu', 'agent-elements-tool-card');
    expect(aiMenu).toHaveAttribute('data-agent-elements-shell', 'editor-header-ai-menu');
    expect(aiMenu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(aiMenu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');
    expect(aiMenu.className).toContain('--agent-elements-card-inline-padding');
    expect(aiMenu.className).toContain('--agent-elements-card-block-padding');
    expect(aiMenu.className).not.toMatch(/border-nim|bg-nim|text-nim|--nim-|rgba|rounded-md|backdrop.*blur|text-white|bg-white|bg-black/);
    await waitFor(() => expect(within(aiMenu).getByText('Refactor editor menu')).toBeInTheDocument());
    expect(testState.electronInvoke).toHaveBeenCalledWith('sessions:get-by-file', '/workspace', '/workspace/docs/plan.md');

    fireEvent.click(screen.getByTestId('agent-elements-editor-header-toc-button'));

    const tocMenu = screen.getByTestId('agent-elements-editor-header-toc-menu');
    expect(tocMenu).toHaveClass('unified-header-toc-dropdown', 'agent-elements-editor-header-toc-menu', 'agent-elements-tool-card');
    expect(tocMenu).toHaveAttribute('data-agent-elements-shell', 'editor-header-toc-menu');
    expect(tocMenu).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(tocMenu).toHaveAttribute('data-agent-elements-card-width', 'floating-menu');
    expect(tocMenu.className).toContain('--agent-elements-card-inline-padding');
    expect(tocMenu.className).toContain('--agent-elements-card-block-padding');
    expect(tocMenu.className).not.toMatch(/border-nim|bg-nim|text-nim|--nim-|rgba|rounded-md|backdrop.*blur|text-white|bg-white|bg-black/);

    const tocItem = screen.getByTestId('agent-elements-editor-header-toc-heading-1');
    expect(tocItem.tagName).toBe('BUTTON');
    expect(tocItem).toHaveClass('agent-elements-editor-header-toc-item');
    expect(within(tocItem).getByText('Implementation Notes')).toBeInTheDocument();
  });

  it('keeps editor header floating menu source on shared Agent Elements gutters', async () => {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const source = await readFile(
      join(process.cwd(), 'packages/electron/src/renderer/components/TabEditor/UnifiedEditorHeaderBar.tsx'),
      'utf8'
    );

    expect(source).toContain('data-agent-elements-card-padding="symmetric-inline"');
    expect(source).toContain('data-agent-elements-card-width="floating-menu"');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).toContain('--agent-elements-card-block-padding');
    expect(source).not.toMatch(/agent-elements-tool-card[^'"]*(?:border-nim|bg-nim|text-nim|p-1|rounded-\[10px\]|--nim-)/);
    expect(source).not.toMatch(/shadow-\[[^\]]*rgba|shadow-\[[^\]]*--nim-text/);
  });
});
