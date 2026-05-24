import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as path from 'path';

const { addFileLink, addGitignoreBypass, documentServices } = vi.hoisted(() => ({
  addFileLink: vi.fn(async (link: any) => ({ id: 'link-1', ...link })),
  addGitignoreBypass: vi.fn(),
  documentServices: new Map<string, { refreshFileMetadata: ReturnType<typeof vi.fn> }>(),
}));

vi.mock('@nimbalyst/runtime', () => ({
  SessionFilesRepository: { addFileLink },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    main: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

vi.mock('../../file/FileWatcher', () => ({
  startFileWatcher: vi.fn(),
}));

vi.mock('../../file/WorkspaceEventBus', () => ({
  addGitignoreBypass,
}));

vi.mock('../../window/WindowManager', () => ({
  documentServices,
}));

import { SessionFileTracker } from '../SessionFileTracker';

describe('SessionFileTracker', () => {
  beforeEach(() => {
    addFileLink.mockClear();
    addGitignoreBypass.mockClear();
    documentServices.clear();
  });

  it('tracks LangGraph write_file as a create edit link', async () => {
    const tracker = new SessionFileTracker();
    const workspace = '/workspace/project';
    const fakeWindow = { isDestroyed: () => false };
    documentServices.set(workspace, { refreshFileMetadata: vi.fn() });

    await tracker.trackToolExecution(
      'session-1',
      workspace,
      'write_file',
      { file_path: 'src/created.ts', content: 'export const created = true;\n' },
      { success: true },
      'langgraph-write-1',
      fakeWindow as any,
    );

    const absolutePath = path.resolve(workspace, 'src/created.ts');
    expect(addGitignoreBypass).toHaveBeenCalledWith(workspace, absolutePath);
    expect(addFileLink).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      workspaceId: workspace,
      filePath: absolutePath,
      linkType: 'edited',
      metadata: expect.objectContaining({
        toolName: 'write_file',
        operation: 'create',
        toolUseId: 'langgraph-write-1',
      }),
    }));
  });

  it('tracks LangGraph edit_file as an edit link', async () => {
    const tracker = new SessionFileTracker();
    const workspace = '/workspace/project';
    const fakeWindow = { isDestroyed: () => false };
    documentServices.set(workspace, { refreshFileMetadata: vi.fn() });

    await tracker.trackToolExecution(
      'session-1',
      workspace,
      'edit_file',
      { file_path: '/workspace/project/src/existing.ts', old_string: 'a', new_string: 'b' },
      { success: true },
      'langgraph-edit-1',
      fakeWindow as any,
    );

    expect(addFileLink).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      workspaceId: workspace,
      filePath: '/workspace/project/src/existing.ts',
      linkType: 'edited',
      metadata: expect.objectContaining({
        toolName: 'edit_file',
        operation: 'edit',
        toolUseId: 'langgraph-edit-1',
      }),
    }));
  });

  it('tracks LangGraph read_file as a read link', async () => {
    const tracker = new SessionFileTracker();
    const workspace = '/workspace/project';

    await tracker.trackToolExecution(
      'session-1',
      workspace,
      'read_file',
      { file_path: 'README.md' },
      'contents',
      'langgraph-read-1',
      null,
    );

    expect(addFileLink).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      workspaceId: workspace,
      filePath: path.resolve(workspace, 'README.md'),
      linkType: 'read',
      metadata: expect.objectContaining({
        toolName: 'read_file',
        bytesRead: 'contents'.length,
      }),
    }));
  });

  it('maps LangGraph virtual absolute read_file paths into the workspace', async () => {
    const tracker = new SessionFileTracker();
    const workspace = '/workspace/project';

    await tracker.trackToolExecution(
      'session-1',
      workspace,
      'read_file',
      { file_path: '/README.md' },
      'contents',
      'langgraph-read-virtual-1',
      null,
    );

    expect(addFileLink).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      workspaceId: workspace,
      filePath: path.resolve(workspace, 'README.md'),
      linkType: 'read',
      metadata: expect.objectContaining({
        toolName: 'read_file',
        bytesRead: 'contents'.length,
      }),
    }));
  });

  it('does not persist escaping LangGraph virtual absolute paths', async () => {
    const tracker = new SessionFileTracker();
    const workspace = '/workspace/project';

    await tracker.trackToolExecution(
      'session-1',
      workspace,
      'read_file',
      { file_path: '/../outside.md' },
      'contents',
      'langgraph-read-escape-1',
      null,
    );

    expect(addFileLink).not.toHaveBeenCalled();
    expect(addGitignoreBypass).not.toHaveBeenCalled();
  });

  it('maps file_change virtual absolute paths into the workspace', async () => {
    const tracker = new SessionFileTracker();
    const workspace = '/Users/paulbettner/Projects/workspaces/smarty-code/daily-driver-m1';
    const virtualPath = '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts';
    const workspacePath = path.resolve(workspace, 'forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts');
    const fakeWindow = { isDestroyed: () => false };
    documentServices.set(workspace, { refreshFileMetadata: vi.fn() });

    await tracker.trackToolExecution(
      'session-1',
      workspace,
      'file_change',
      { changes: [{ path: virtualPath, kind: 'update' }] },
      { success: true },
      'langgraph-file-change-1',
      fakeWindow as any,
    );

    expect(addGitignoreBypass).toHaveBeenCalledWith(workspace, workspacePath);
    expect(addGitignoreBypass).not.toHaveBeenCalledWith(workspace, virtualPath);
    expect(addFileLink).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      workspaceId: workspace,
      filePath: workspacePath,
      linkType: 'edited',
      metadata: expect.objectContaining({
        toolName: 'file_change',
        operation: 'edit',
        toolUseId: 'langgraph-file-change-1',
      }),
    }));
  });
});
