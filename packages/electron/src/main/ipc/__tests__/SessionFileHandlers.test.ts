import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handlers, getFilesBySession } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  getFilesBySession: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(() => null),
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    }),
  },
}));

vi.mock('@nimbalyst/runtime', () => ({
  SessionFilesRepository: {
    addFileLink: vi.fn(),
    getFilesBySession,
    getFilesBySessionMany: vi.fn(),
    getSessionsByFile: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    main: {
      error: vi.fn(),
    },
  },
}));

vi.mock('../../services/ToolCallMatcher', () => ({
  toolCallMatcher: {
    getMatchesForSession: vi.fn(),
    matchSession: vi.fn(),
    getDiffsForToolCall: vi.fn(),
  },
}));

vi.mock('../../HistoryManager', () => ({
  historyManager: {
    getLatestSnapshotContent: vi.fn(),
  },
}));

describe('SessionFileHandlers', () => {
  beforeEach(async () => {
    vi.resetModules();
    handlers.clear();
    getFilesBySession.mockReset();

    const { setupSessionFileHandlers } = await import('../SessionFileHandlers');
    setupSessionFileHandlers();
  });

  it('fetches fresh edited rows after an initial empty read', async () => {
    const getBySession = handlers.get('session-files:get-by-session');
    expect(getBySession).toBeTypeOf('function');

    const sessionId = 'session-1';
    const rows: any[] = [];
    getFilesBySession.mockImplementation(async () => [...rows]);

    const first = await getBySession!({ sender: {} }, sessionId, 'edited');
    expect(first).toEqual({ success: true, files: [] });

    rows.push({
      id: 'link-1',
      sessionId,
      workspaceId: '/workspace/project',
      filePath: '/workspace/project/src/changed.ts',
      linkType: 'edited',
      createdAt: '2026-05-23T05:00:00.000Z',
      metadata: { toolName: 'file_change', operation: 'edit' },
    });

    const second = await getBySession!({ sender: {} }, sessionId, 'edited');

    expect(getFilesBySession).toHaveBeenCalledTimes(2);
    expect(second).toEqual({ success: true, files: rows });
  });

  it('does not join stale in-flight edited queries during session file updates', async () => {
    const getBySession = handlers.get('session-files:get-by-session');
    expect(getBySession).toBeTypeOf('function');

    const sessionId = 'session-1';
    const rows = [{
      id: 'link-1',
      sessionId,
      workspaceId: '/workspace/project',
      filePath: '/workspace/project/src/changed.ts',
      linkType: 'edited',
      createdAt: '2026-05-23T05:00:00.000Z',
      metadata: { toolName: 'file_change', operation: 'edit' },
    }];
    let resolveFirst: ((files: any[]) => void) | null = null;
    getFilesBySession
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(async () => rows);

    const first = getBySession!({ sender: {} }, sessionId, 'edited');
    const second = getBySession!({ sender: {} }, sessionId, 'edited');

    resolveFirst!([]);
    await expect(first).resolves.toEqual({ success: true, files: [] });
    await expect(second).resolves.toEqual({ success: true, files: rows });
    expect(getFilesBySession).toHaveBeenCalledTimes(2);
  });

  it('fetches fresh all-link rows after an initial empty read', async () => {
    const getBySession = handlers.get('session-files:get-by-session');
    expect(getBySession).toBeTypeOf('function');

    const sessionId = 'session-1';
    const rows: any[] = [];
    getFilesBySession.mockImplementation(async () => [...rows]);

    await expect(getBySession!({ sender: {} }, sessionId)).resolves.toEqual({
      success: true,
      files: [],
    });

    rows.push({
      id: 'link-1',
      sessionId,
      workspaceId: '/workspace/project',
      filePath: '/workspace/project/src/readme.md',
      linkType: 'read',
      createdAt: '2026-05-23T05:00:00.000Z',
      metadata: { toolName: 'read_file' },
    });

    await expect(getBySession!({ sender: {} }, sessionId)).resolves.toEqual({
      success: true,
      files: rows,
    });
    expect(getFilesBySession).toHaveBeenCalledTimes(2);
  });

  it('keeps the short cache for read-only link-type queries', async () => {
    const getBySession = handlers.get('session-files:get-by-session');
    expect(getBySession).toBeTypeOf('function');

    const sessionId = 'session-1';
    const rows = [{
      id: 'link-1',
      sessionId,
      workspaceId: '/workspace/project',
      filePath: '/workspace/project/src/readme.md',
      linkType: 'read',
      createdAt: '2026-05-23T05:00:00.000Z',
      metadata: { toolName: 'read_file' },
    }];
    getFilesBySession.mockImplementation(async () => rows);

    await expect(getBySession!({ sender: {} }, sessionId, 'read')).resolves.toEqual({
      success: true,
      files: rows,
    });
    await expect(getBySession!({ sender: {} }, sessionId, 'read')).resolves.toEqual({
      success: true,
      files: rows,
    });
    expect(getFilesBySession).toHaveBeenCalledTimes(1);
  });
});
