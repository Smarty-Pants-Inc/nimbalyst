// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommonFileActions } from '../CommonFileActions';

const fileActions = {
  hasExternalEditor: false,
  externalEditorName: undefined,
  isShareable: false,
  openInDefaultApp: vi.fn(),
  openInExternalEditor: vi.fn(),
  revealInFinder: vi.fn(),
  copyFilePath: vi.fn(),
  shareLink: vi.fn(),
};

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({ icon, size }: { icon: string; size?: number }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size }),
  };
});

vi.mock('@nimbalyst/runtime/store', () => ({
  store: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('jotai', async () => {
  const actual = await vi.importActual<typeof import('jotai')>('jotai');
  return {
    ...actual,
    useAtomValue: vi.fn(() => false),
  };
});

vi.mock('../../hooks/useFileActions', () => ({
  useFileActions: () => fileActions,
}));

vi.mock('../../store/atoms/collabDocuments', () => ({
  registerDocumentInIndex: vi.fn(),
  pendingCollabDocumentAtom: {},
  workspaceHasTeamAtom: {},
}));

vi.mock('../../store/atoms/windowMode', () => ({
  setWindowModeAtom: {},
}));

vi.mock('../../store/atoms/openProjects', () => ({
  activeWorkspacePathAtom: {},
}));

vi.mock('../CustomEditors', () => ({
  customEditorRegistry: {
    findRegistrationForFile: vi.fn(() => null),
  },
}));

describe('CommonFileActions element semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps legacy div rows unchanged when button rendering is not requested', () => {
    render(
      <CommonFileActions
        filePath="/workspace/notes.md"
        fileName="notes.md"
        onClose={vi.fn()}
        menuItemClass="legacy-menu-item"
        separatorClass="legacy-separator"
      />
    );

    const firstAction = screen.getByText('Open in Default App').closest('.legacy-menu-item');
    expect(firstAction).toBeInTheDocument();
    expect(firstAction?.tagName).toBe('DIV');
    expect(firstAction).not.toHaveAttribute('role');
  });

  it('renders explicit menu buttons for floating menu consumers', () => {
    render(
      <CommonFileActions
        filePath="/workspace/notes.md"
        fileName="notes.md"
        onClose={vi.fn()}
        menuItemClass="agent-elements-file-context-menu-item"
        separatorClass="agent-elements-file-context-menu-separator"
        useButtons
      />
    );

    const firstAction = screen.getByText('Open in Default App').closest('button');
    expect(firstAction).toBeInTheDocument();
    expect(firstAction).toHaveAttribute('type', 'button');
    expect(firstAction).toHaveAttribute('role', 'menuitem');
  });
});
