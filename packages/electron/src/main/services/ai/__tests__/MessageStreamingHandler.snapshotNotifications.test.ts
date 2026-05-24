import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  provider,
  safeSend,
  sessionFileTracker,
  historyManager,
  stateManager,
  onAgentMessageBatch,
} = vi.hoisted(() => ({
  provider: {
    initialize: vi.fn(),
    registerToolHandler: vi.fn(),
    sendMessage: vi.fn(),
  },
  safeSend: vi.fn(),
  sessionFileTracker: {
    trackToolExecution: vi.fn(),
    trackUserMessage: vi.fn(),
  },
  historyManager: {
    createTag: vi.fn(),
    createSnapshot: vi.fn(),
  },
  stateManager: {
    startSession: vi.fn(),
    updateActivity: vi.fn(),
    endSession: vi.fn(),
  },
  onAgentMessageBatch: vi.fn(() => vi.fn()),
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(() => ({
      isDestroyed: vi.fn(() => false),
      webContents: { send: vi.fn() },
    })),
    getAllWindows: vi.fn(() => []),
  },
}));

vi.mock('@nimbalyst/runtime/ai/server', () => ({
  ProviderFactory: {
    getProvider: vi.fn(() => provider),
    createProvider: vi.fn(() => provider),
  },
  ModelRegistry: {
    getModelsForProvider: vi.fn(async () => []),
  },
  isAgentProvider: vi.fn(() => true),
  onAgentMessageBatch,
}));

vi.mock('@nimbalyst/runtime/ai/server/SessionStateManager', () => ({
  getSessionStateManager: vi.fn(() => stateManager),
}));

vi.mock('@nimbalyst/runtime/ai/server/utils/errorDetection', () => ({
  isBedrockToolSearchError: vi.fn(() => false),
}));

vi.mock('@nimbalyst/runtime', () => ({
  AISessionsRepository: {
    get: vi.fn(async () => null),
  },
}));

vi.mock('../tools', () => ({
  toolRegistry: {
    getAll: vi.fn(() => []),
  },
}));

vi.mock('../../SoundNotificationService', () => ({
  SoundNotificationService: {
    getInstance: vi.fn(() => ({
      playCompletionSound: vi.fn(),
    })),
  },
}));

vi.mock('../../NotificationService', () => ({
  notificationService: {
    showNotification: vi.fn(),
    showBlockedNotification: vi.fn(),
  },
}));

vi.mock('../../../tray/TrayManager', () => ({
  TrayManager: {
    getInstance: vi.fn(() => ({
      onPromptCreated: vi.fn(),
    })),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    ai: {
      error: vi.fn(),
      info: vi.fn(),
    },
    main: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

vi.mock('../../../window/WindowManager', () => ({
  windowStates: new Map(),
  findWindowByWorkspace: vi.fn(() => null),
  documentServices: new Map(),
}));

vi.mock('../../SessionFileTracker', () => ({
  sessionFileTracker,
}));

vi.mock('../../CodexEditWindowRegistry', () => ({
  codexEditWindowRegistry: {
    clearSession: vi.fn(),
  },
  shouldOpenCodexEditWindow: vi.fn(() => false),
}));

vi.mock('../../ToolCallMatcher', () => ({
  toolCallMatcher: {
    matchSession: vi.fn(async () => 0),
  },
  unwrapShellCommand: vi.fn((command: string) => command),
}));

vi.mock('../../FeatureUsageService.ts', () => ({
  FeatureUsageService: {
    getInstance: vi.fn(() => ({
      recordUsage: vi.fn(),
    })),
  },
  FEATURES: {
    AI_PROMPT_SUBMITTED: 'AI_PROMPT_SUBMITTED',
    SESSION_COMPLETED: 'SESSION_COMPLETED',
    SESSION_COMPLETED_WITH_TOOLS: 'SESSION_COMPLETED_WITH_TOOLS',
  },
}));

vi.mock('../../../HistoryManager', () => ({
  historyManager,
}));

vi.mock('../../../file/WorkspaceEventBus', () => ({
  addGitignoreBypass: vi.fn(),
}));

vi.mock('../../SyncManager', () => ({
  getSyncProvider: vi.fn(() => null),
  isDesktopTrulyAway: vi.fn(() => false),
}));

vi.mock('../../AgentWorkflowService', () => ({
  getAgentWorkflowService: vi.fn(() => null),
}));

vi.mock('../../../utils/store', () => ({
  shouldShowCommunityPopup: vi.fn(() => false),
  markCommunityPopupShown: vi.fn(),
  wasCommunityPopupShownThisLaunch: vi.fn(() => false),
  incrementCompletedSessionsWithTools: vi.fn(() => 0),
}));

vi.mock('../aiServiceUtils', () => ({
  safeSend,
  previewForLog: vi.fn((value: string) => value),
  bucketMessageLength: vi.fn(() => 'small'),
  bucketResponseTime: vi.fn(() => 'fast'),
  bucketChunkCount: vi.fn(() => 'small'),
  bucketContentLength: vi.fn(() => 'small'),
  categorizeAIError: vi.fn(() => 'unknown'),
  attachMentionedFiles: vi.fn(async (message: string) => ({
    enhancedMessage: message,
    attachedFiles: [],
  })),
  tagFileBeforeEdit: vi.fn(),
  detectConfiguredAIProvider: vi.fn(() => null),
  detectNimbalystSlashCommand: vi.fn(() => null),
  readFileContentOrNull: vi.fn(async () => null),
  getFileExtensionForAnalytics: vi.fn(() => 'ts'),
}));

vi.mock('../childSessionTakeover', () => ({
  disableParentNotificationsAfterDirectTakeover: vi.fn(),
}));

vi.mock('../providerListenerRegistry', () => ({
  installScopedProviderListener: vi.fn(),
}));

vi.mock('../providerRuntimeConfig', () => ({
  buildProviderRuntimeConfig: vi.fn(async () => ({})),
}));

vi.mock('../../RepositoryManager', () => ({
  getQueuedPromptsStore: vi.fn(() => ({
    listPending: vi.fn(async () => []),
  })),
}));

describe('MessageStreamingHandler snapshot file notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('notifies the renderer when live pre/post edit snapshots update session files', async () => {
    async function* streamChunks() {
      yield {
        type: 'pre_edit_snapshot',
        preEditSnapshot: {
          toolUseId: 'tool-1',
          authoritative: true,
          entries: [{ path: 'src/changed.ts', kind: 'update', content: 'before' }],
        },
      };
      yield {
        type: 'post_edit_snapshot',
        postEditSnapshot: {
          toolUseId: 'tool-1',
          entries: [{ path: 'src/changed.ts', content: 'after' }],
        },
      };
      yield { type: 'complete' };
    }

    provider.sendMessage.mockImplementation(streamChunks);

    const service = {
      sessionManager: {
        loadSession: vi.fn(async () => ({
          id: 'session-1',
          provider: 'smarty-server',
          model: 'smarty-local',
          messages: [],
          workspacePath: '/workspace/project',
          title: 'Test session',
        })),
        addMessage: vi.fn(),
        updateSessionTitle: vi.fn(),
      },
      analytics: { sendEvent: vi.fn() },
      sendMessageHandler: null,
      processingQueuedPromptIds: new Set<string>(),
      matchDebounceTimers: new Map<string, ReturnType<typeof setTimeout>>(),
      sessionsProcessingQueue: new Set<string>(),
      documentContextService: {
        prepareContext: vi.fn(() => ({
          documentContext: {},
          userMessageAdditions: {},
        })),
      },
      hooklessWatcher: {
        ensureForSession: vi.fn(),
        getEntry: vi.fn(() => null),
        scheduleStop: vi.fn(),
        stopForSession: vi.fn(),
      },
      getApiKeyForProvider: vi.fn(),
      getEffectiveProviderSettings: vi.fn(() => ({})),
      buildClaudeCodeRuntimeConfig: vi.fn(),
      continueQueuedPromptChain: vi.fn(),
      runAutoContextCommand: vi.fn(),
      createToolHandler: vi.fn(() => ({})),
      inferWorktreePathFromFilePath: vi.fn(() => null),
      inferWorktreePathFromCommand: vi.fn(() => null),
      adoptWorktreeForSession: vi.fn(),
    };

    const { MessageStreamingHandler } = await import('../MessageStreamingHandler');
    const handler = new MessageStreamingHandler(service as any);
    const event = { sender: { id: 1 } } as any;

    await handler.handle(event, 'edit this file', undefined, 'session-1', '/workspace/project');

    expect(sessionFileTracker.trackToolExecution).toHaveBeenCalledWith(
      'session-1',
      '/workspace/project',
      'file_change',
      { changes: [{ path: '/workspace/project/src/changed.ts', kind: 'update' }] },
      undefined,
      'tool-1',
      null,
    );
    expect(historyManager.createSnapshot).toHaveBeenCalledWith(
      '/workspace/project/src/changed.ts',
      'after',
      'ai-edit',
      'AI edit (session: session-1)',
      { sessionId: 'session-1', toolUseId: 'tool-1' },
    );

    const updateCalls = safeSend.mock.calls.filter(([, channel]) => channel === 'session-files:updated');
    expect(updateCalls).toEqual([
      [event, 'session-files:updated', 'session-1'],
      [event, 'session-files:updated', 'session-1'],
    ]);
  });

  it('still tracks live session files when a pre-edit tag already exists', async () => {
    async function* streamChunks() {
      yield {
        type: 'pre_edit_snapshot',
        preEditSnapshot: {
          toolUseId: 'tool-1',
          authoritative: true,
          entries: [{ path: 'src/changed.ts', kind: 'update', content: 'before' }],
        },
      };
      yield { type: 'complete' };
    }

    provider.sendMessage.mockImplementation(streamChunks);
    historyManager.createTag.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "document_history_pending_tags_pkey"'),
    );

    const service = {
      sessionManager: {
        loadSession: vi.fn(async () => ({
          id: 'session-1',
          provider: 'smarty-server',
          model: 'smarty-local',
          messages: [],
          workspacePath: '/workspace/project',
          title: 'Test session',
        })),
        addMessage: vi.fn(),
        updateSessionTitle: vi.fn(),
      },
      analytics: { sendEvent: vi.fn() },
      sendMessageHandler: null,
      processingQueuedPromptIds: new Set<string>(),
      matchDebounceTimers: new Map<string, ReturnType<typeof setTimeout>>(),
      sessionsProcessingQueue: new Set<string>(),
      documentContextService: {
        prepareContext: vi.fn(() => ({
          documentContext: {},
          userMessageAdditions: {},
        })),
      },
      hooklessWatcher: {
        ensureForSession: vi.fn(),
        getEntry: vi.fn(() => null),
        scheduleStop: vi.fn(),
        stopForSession: vi.fn(),
      },
      getApiKeyForProvider: vi.fn(),
      getEffectiveProviderSettings: vi.fn(() => ({})),
      buildClaudeCodeRuntimeConfig: vi.fn(),
      continueQueuedPromptChain: vi.fn(),
      runAutoContextCommand: vi.fn(),
      createToolHandler: vi.fn(() => ({})),
      inferWorktreePathFromFilePath: vi.fn(() => null),
      inferWorktreePathFromCommand: vi.fn(() => null),
      adoptWorktreeForSession: vi.fn(),
    };

    const { MessageStreamingHandler } = await import('../MessageStreamingHandler');
    const handler = new MessageStreamingHandler(service as any);
    const event = { sender: { id: 1 } } as any;

    await handler.handle(event, 'edit this file', undefined, 'session-1', '/workspace/project');

    expect(sessionFileTracker.trackToolExecution).toHaveBeenCalledWith(
      'session-1',
      '/workspace/project',
      'file_change',
      { changes: [{ path: '/workspace/project/src/changed.ts', kind: 'update' }] },
      undefined,
      'tool-1',
      null,
    );
    expect(safeSend).toHaveBeenCalledWith(event, 'session-files:updated', 'session-1');
  });

  it('maps resumed virtual pre/post edit snapshot paths into the workspace before notifying session files', async () => {
    const service = {
      sessionManager: {
        loadSession: vi.fn(async () => ({
          id: 'session-1',
          provider: 'smarty-server',
          model: 'smarty-local',
          messages: [],
          workspacePath: '/workspace/project',
          title: 'Test session',
        })),
      },
      hooklessWatcher: {
        getEntry: vi.fn(() => null),
        scheduleStop: vi.fn(),
      },
      inferWorktreePathFromFilePath: vi.fn(() => null),
      inferWorktreePathFromCommand: vi.fn(() => null),
      adoptWorktreeForSession: vi.fn(),
    };

    const { MessageStreamingHandler } = await import('../MessageStreamingHandler');
    const handler = new MessageStreamingHandler(service as any);
    const event = { sender: { id: 1 } } as any;
    const virtualPath = '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts';
    const workspacePath = '/workspace/project/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts';

    await handler.handleResumedProviderChunks(event, 'session-1', '/workspace/project', [
      {
        type: 'pre_edit_snapshot',
        preEditSnapshot: {
          toolUseId: 'tool-1',
          authoritative: true,
          entries: [{ path: virtualPath, kind: 'update', content: 'before' }],
        },
      },
      {
        type: 'post_edit_snapshot',
        postEditSnapshot: {
          toolUseId: 'tool-1',
          entries: [{ path: virtualPath, content: 'after' }],
        },
      },
      { type: 'complete' },
    ] as any);

    expect(historyManager.createTag).toHaveBeenCalledWith(
      '/workspace/project',
      workspacePath,
      'ai-edit-pending-session-1-tool-1',
      'before',
      'session-1',
      'tool-1',
      { replaceSpeculative: true },
    );
    expect(sessionFileTracker.trackToolExecution).toHaveBeenCalledWith(
      'session-1',
      '/workspace/project',
      'file_change',
      { changes: [{ path: workspacePath, kind: 'update' }] },
      undefined,
      'tool-1',
      expect.any(Object),
    );
    expect(historyManager.createSnapshot).toHaveBeenCalledWith(
      workspacePath,
      'after',
      'ai-edit',
      'AI edit (session: session-1)',
      { sessionId: 'session-1', toolUseId: 'tool-1' },
    );

    const updateCalls = safeSend.mock.calls.filter(([, channel]) => channel === 'session-files:updated');
    expect(updateCalls).toEqual([
      [event, 'session-files:updated', 'session-1'],
      [event, 'session-files:updated', 'session-1'],
    ]);
  });

  it('still tracks resumed session files when a pre-edit tag already exists', async () => {
    historyManager.createTag.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "document_history_pending_tags_pkey"'),
    );

    const service = {
      sessionManager: {
        loadSession: vi.fn(async () => ({
          id: 'session-1',
          provider: 'smarty-server',
          model: 'smarty-local',
          messages: [],
          workspacePath: '/workspace/project',
          title: 'Test session',
        })),
      },
      hooklessWatcher: {
        getEntry: vi.fn(() => null),
        scheduleStop: vi.fn(),
      },
      inferWorktreePathFromFilePath: vi.fn(() => null),
      inferWorktreePathFromCommand: vi.fn(() => null),
      adoptWorktreeForSession: vi.fn(),
    };

    const { MessageStreamingHandler } = await import('../MessageStreamingHandler');
    const handler = new MessageStreamingHandler(service as any);
    const event = { sender: { id: 1 } } as any;

    await handler.handleResumedProviderChunks(event, 'session-1', '/workspace/project', [
      {
        type: 'pre_edit_snapshot',
        preEditSnapshot: {
          toolUseId: 'tool-1',
          authoritative: true,
          entries: [{ path: 'src/changed.ts', kind: 'update', content: 'before' }],
        },
      },
      { type: 'complete' },
    ] as any);

    expect(sessionFileTracker.trackToolExecution).toHaveBeenCalledWith(
      'session-1',
      '/workspace/project',
      'file_change',
      { changes: [{ path: '/workspace/project/src/changed.ts', kind: 'update' }] },
      undefined,
      'tool-1',
      expect.any(Object),
    );
    expect(safeSend).toHaveBeenCalledWith(event, 'session-files:updated', 'session-1');
  });

  it('ends resumed sessions and stops the watcher when a resumed stream returns an error', async () => {
    const stopForSession = vi.fn();
    const service = {
      sessionManager: {
        loadSession: vi.fn(async () => ({
          id: 'session-1',
          provider: 'smarty-server',
          model: 'smarty-local',
          messages: [],
          workspacePath: '/workspace/project',
          title: 'Test session',
        })),
      },
      hooklessWatcher: {
        getEntry: vi.fn(() => null),
        scheduleStop: vi.fn(),
        stopForSession,
      },
      inferWorktreePathFromFilePath: vi.fn(() => null),
      inferWorktreePathFromCommand: vi.fn(() => null),
      adoptWorktreeForSession: vi.fn(),
    };

    const { MessageStreamingHandler } = await import('../MessageStreamingHandler');
    const handler = new MessageStreamingHandler(service as any);
    const event = { sender: { id: 1 } } as any;

    await handler.handleResumedProviderChunks(event, 'session-1', '/workspace/project', [
      { type: 'error', error: 'resumed stream closed unexpectedly' },
    ] as any);

    expect(safeSend).toHaveBeenCalledWith(event, 'ai:error', {
      sessionId: 'session-1',
      message: 'resumed stream closed unexpectedly',
      isAuthError: false,
      isBedrockToolError: false,
      isServerError: false,
      isCodexAuthRequired: false,
    });
    expect(stateManager.updateActivity).toHaveBeenCalledWith({
      sessionId: 'session-1',
      status: 'error',
    });
    expect(stateManager.endSession).toHaveBeenCalledWith('session-1');
    expect(stopForSession).toHaveBeenCalledWith('session-1');
  });
});
