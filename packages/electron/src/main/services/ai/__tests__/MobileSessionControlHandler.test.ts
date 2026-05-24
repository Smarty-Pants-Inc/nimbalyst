import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getProvider,
  createProvider,
  sessionsGet,
  messagesCreate,
  notifySend,
  provider,
  rollbackExecutingPrompts,
  triggerQueuedPromptProcessing,
  handleResumedProviderChunks,
  canHandleResumedProviderChunks,
  getOrCreateProviderForSession,
} = vi.hoisted(() => ({
  getProvider: vi.fn(),
  createProvider: vi.fn(),
  sessionsGet: vi.fn(),
  messagesCreate: vi.fn(async () => undefined),
  notifySend: vi.fn(),
  provider: {
    resolveToolPermission: vi.fn(),
    resolveAskUserQuestion: vi.fn(),
    rejectAskUserQuestion: vi.fn(),
    resolveExitPlanModeConfirmation: vi.fn(),
    abort: vi.fn(),
    interruptCurrentTurn: vi.fn(),
    interruptSession: vi.fn(),
  },
  rollbackExecutingPrompts: vi.fn(async () => 0),
  triggerQueuedPromptProcessing: vi.fn(async () => true),
  handleResumedProviderChunks: vi.fn(async () => undefined),
  canHandleResumedProviderChunks: vi.fn(() => true),
  getOrCreateProviderForSession: vi.fn(async () => null),
}));

vi.mock('electron', () => ({
  __esModule: true,
  BrowserWindow: {
    getAllWindows: vi.fn(() => [
      {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: notifySend,
        },
      },
    ]),
  },
  ipcMain: {
    listenerCount: vi.fn(() => 0),
    emit: vi.fn(),
  },
}));

vi.mock('@nimbalyst/runtime/ai/server', () => ({
  AI_PROVIDER_TYPES: ['claude-code', 'smarty-server'],
  ProviderFactory: {
    getProvider,
    createProvider,
  },
}));

vi.mock('@nimbalyst/runtime/storage/repositories/AISessionsRepository', () => ({
  AISessionsRepository: {
    get: sessionsGet,
    updateMetadata: vi.fn(),
  },
}));

vi.mock('@nimbalyst/runtime/storage/repositories/AgentMessagesRepository', () => ({
  AgentMessagesRepository: {
    create: messagesCreate,
  },
}));

vi.mock('../../../mcp/tools/codexToolCallResolver', () => ({
  resolveRequestUserInputPromptTargets: vi.fn((promptId: string) => ({
    waiterPromptIds: [promptId],
    rawPromptId: undefined,
  })),
}));

vi.mock('../../../tray/TrayManager', () => ({
  TrayManager: {
    getInstance: vi.fn(() => ({
      onPromptResolved: vi.fn(),
    })),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    ai: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

import { initMobileSessionControlHandler } from '../MobileSessionControlHandler';

function createHarness(callbackOverrides: Partial<Parameters<typeof initMobileSessionControlHandler>[2]> = {}) {
  let onMessage: ((message: any) => void) | undefined;
  const syncProvider = {
    onSessionControlMessage: vi.fn((callback: (message: any) => void) => {
      onMessage = callback;
      return vi.fn();
    }),
  };

  initMobileSessionControlHandler(
    syncProvider as any,
    vi.fn(() => null),
    {
      triggerQueuedPromptProcessing,
      rollbackExecutingPrompts,
      handleResumedProviderChunks,
      canHandleResumedProviderChunks,
      getOrCreateProviderForSession,
      ...callbackOverrides,
    },
  );

  if (!onMessage) {
    throw new Error('mobile session control handler did not subscribe');
  }

  return {
    send(message: any) {
      onMessage?.(message);
    },
  };
}

async function flushAsyncHandlers(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

describe('MobileSessionControlHandler provider routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionsGet.mockResolvedValue({
      id: 'session-smarty',
      provider: 'smarty-server',
      model: 'smarty-server:smarty_coding_agent',
      workspacePath: '/workspace',
      providerSessionId: 'lg-thread-1',
      messages: [],
      createdAt: 0,
      updatedAt: 0,
    });
    getProvider.mockImplementation((providerType: string, sessionId: string) => {
      return providerType === 'smarty-server' && sessionId === 'session-smarty'
        ? provider
        : null;
    });
    provider.resolveAskUserQuestion.mockReturnValue(true);
    provider.resolveToolPermission.mockResolvedValue([]);
    getOrCreateProviderForSession.mockResolvedValue(null);
    canHandleResumedProviderChunks.mockReturnValue(true);
  });

  it('routes mobile tool permission responses through the session provider', async () => {
    const harness = createHarness();

    harness.send({
      type: 'prompt_response',
      sessionId: 'session-smarty',
      payload: {
        promptType: 'tool_permission',
        promptId: 'approval-1',
        response: {
          decision: 'allow',
          scope: 'once',
        },
      },
    });
    await flushAsyncHandlers();

    expect(sessionsGet).toHaveBeenCalledWith('session-smarty');
    expect(getProvider).toHaveBeenCalledWith('smarty-server', 'session-smarty');
    expect(getProvider).not.toHaveBeenCalledWith('claude-code', 'session-smarty');
    expect(provider.resolveToolPermission).toHaveBeenCalledWith(
      'approval-1',
      { decision: 'allow', scope: 'once' },
      'session-smarty',
      'mobile',
      {
        workspacePath: '/workspace',
        permissionsPath: '/workspace',
      },
    );
  });

  it('recreates a missing Smarty Server provider before resolving mobile tool permissions', async () => {
    getProvider.mockReturnValue(null);
    getOrCreateProviderForSession.mockResolvedValue(provider as any);
    const harness = createHarness();

    harness.send({
      type: 'prompt_response',
      sessionId: 'session-smarty',
      payload: {
        promptType: 'tool_permission',
        promptId: 'approval-after-restart',
        response: {
          decision: 'allow',
          scope: 'once',
        },
      },
    });
    await flushAsyncHandlers();

    expect(getOrCreateProviderForSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-smarty',
        provider: 'smarty-server',
      }),
      'smarty-server',
    );
    expect(provider.resolveToolPermission).toHaveBeenCalledWith(
      'approval-after-restart',
      { decision: 'allow', scope: 'once' },
      'session-smarty',
      'mobile',
      {
        workspacePath: '/workspace',
        permissionsPath: '/workspace',
      },
    );
  });

  it('does not consume Smarty Server allow approvals when resumed chunks cannot be processed', async () => {
    canHandleResumedProviderChunks.mockReturnValue(false);
    const harness = createHarness();

    harness.send({
      type: 'prompt_response',
      sessionId: 'session-smarty',
      payload: {
        promptType: 'tool_permission',
        promptId: 'approval-no-window',
        response: {
          decision: 'allow',
          scope: 'once',
        },
      },
    });
    await flushAsyncHandlers();

    expect(canHandleResumedProviderChunks).toHaveBeenCalledWith('session-smarty', '/workspace');
    expect(provider.resolveToolPermission).not.toHaveBeenCalled();
    expect(notifySend).not.toHaveBeenCalledWith('ai:toolPermissionResponse', expect.anything());
  });

  it('hands Smarty Server resumed approval chunks back to AIService processing', async () => {
    provider.resolveToolPermission.mockResolvedValue([
      {
        type: 'tool_call',
        toolCall: {
          id: 'approval-1',
          name: 'edit_file',
          arguments: { path: 'src/file.ts' },
        },
      },
    ]);
    const harness = createHarness();

    harness.send({
      type: 'prompt_response',
      sessionId: 'session-smarty',
      payload: {
        promptType: 'tool_permission',
        promptId: 'approval-1',
        response: {
          decision: 'allow',
          scope: 'once',
        },
      },
    });
    await flushAsyncHandlers();

    expect(handleResumedProviderChunks).toHaveBeenCalledWith(
      'session-smarty',
      '/workspace',
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool_call' }),
      ]),
    );
  });

  it('does not acknowledge mobile tool permissions when provider recreation fails', async () => {
    getProvider.mockReturnValue(null);
    getOrCreateProviderForSession.mockResolvedValue(null);
    const harness = createHarness();

    harness.send({
      type: 'prompt_response',
      sessionId: 'session-smarty',
      payload: {
        promptType: 'tool_permission',
        promptId: 'approval-no-provider',
        response: {
          decision: 'allow',
          scope: 'once',
        },
      },
    });
    await flushAsyncHandlers();

    expect(provider.resolveToolPermission).not.toHaveBeenCalled();
    expect(notifySend).not.toHaveBeenCalledWith('ai:toolPermissionResponse', expect.anything());
  });

  it('does not acknowledge mobile tool permissions when provider resolution throws', async () => {
    provider.resolveToolPermission.mockRejectedValue(new Error('resume failed'));
    const harness = createHarness();

    harness.send({
      type: 'prompt_response',
      sessionId: 'session-smarty',
      payload: {
        promptType: 'tool_permission',
        promptId: 'approval-throws',
        response: {
          decision: 'allow',
          scope: 'once',
        },
      },
    });
    await flushAsyncHandlers();

    expect(provider.resolveToolPermission).toHaveBeenCalled();
    expect(notifySend).not.toHaveBeenCalledWith('ai:toolPermissionResponse', expect.anything());
  });

  it('persists mobile RequestUserInput responses with the session provider as source', async () => {
    const harness = createHarness();

    harness.send({
      type: 'prompt_response',
      sessionId: 'session-smarty',
      payload: {
        promptType: 'request_user_input',
        promptId: 'input-1',
        response: {
          answers: { choice: 'ship' },
        },
      },
    });
    await flushAsyncHandlers();

    expect(sessionsGet).toHaveBeenCalledWith('session-smarty');
    expect(messagesCreate).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-smarty',
      source: 'smarty-server',
      direction: 'output',
    }));
  });

  it('routes mobile AskUserQuestion responses through the session provider', async () => {
    const harness = createHarness();

    harness.send({
      type: 'prompt_response',
      sessionId: 'session-smarty',
      payload: {
        promptType: 'ask_user_question',
        promptId: 'question-1',
        response: {
          answers: { ready: 'yes' },
        },
      },
    });
    await flushAsyncHandlers();

    expect(sessionsGet).toHaveBeenCalledWith('session-smarty');
    expect(getProvider).toHaveBeenCalledWith('smarty-server', 'session-smarty');
    expect(getProvider).not.toHaveBeenCalledWith('claude-code', 'session-smarty');
    expect(provider.resolveAskUserQuestion).toHaveBeenCalledWith(
      'question-1',
      { ready: 'yes' },
      'session-smarty',
      'mobile',
    );
  });

  it('persists mobile AskUserQuestion fallback rows with the session provider as source', async () => {
    provider.resolveAskUserQuestion.mockReturnValue(false);
    const harness = createHarness();

    harness.send({
      type: 'prompt_response',
      sessionId: 'session-smarty',
      payload: {
        promptType: 'ask_user_question',
        promptId: 'question-fallback',
        response: {
          answers: { ready: 'yes' },
        },
      },
    });
    await flushAsyncHandlers();

    expect(messagesCreate).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-smarty',
      source: 'smarty-server',
      direction: 'output',
    }));
  });


  it('routes mobile ExitPlanMode responses through the session provider', async () => {
    const harness = createHarness();

    harness.send({
      type: 'prompt_response',
      sessionId: 'session-smarty',
      payload: {
        promptType: 'exit_plan_mode',
        promptId: 'plan-1',
        response: {
          approved: true,
          feedback: 'proceed',
          startNewSession: false,
        },
      },
    });
    await flushAsyncHandlers();

    expect(sessionsGet).toHaveBeenCalledWith('session-smarty');
    expect(getProvider).toHaveBeenCalledWith('smarty-server', 'session-smarty');
    expect(getProvider).not.toHaveBeenCalledWith('claude-code', 'session-smarty');
    expect(provider.resolveExitPlanModeConfirmation).toHaveBeenCalledWith(
      'plan-1',
      {
        approved: true,
        clearContext: false,
        feedback: 'proceed',
      },
      'session-smarty',
      'mobile',
    );
  });

  it('cancels mobile smarty-server sessions through graceful interruption', async () => {
    const harness = createHarness();

    harness.send({
      type: 'cancel',
      sessionId: 'session-smarty',
      payload: {},
    });
    await flushAsyncHandlers();

    expect(sessionsGet).toHaveBeenCalledWith('session-smarty');
    expect(getProvider).toHaveBeenCalledWith('smarty-server', 'session-smarty');
    expect(getProvider).not.toHaveBeenCalledWith('claude-code', 'session-smarty');
    expect(rollbackExecutingPrompts).toHaveBeenCalledWith('session-smarty');
    expect(provider.interruptSession).toHaveBeenCalledWith('session-smarty', {
      workspacePath: '/workspace',
    });
    expect(provider.interruptCurrentTurn).not.toHaveBeenCalled();
    expect(provider.abort).not.toHaveBeenCalled();
    expect(notifySend).toHaveBeenCalledWith('ai:sessionCancelled', {
      sessionId: 'session-smarty',
    });
  });

  it('recreates a missing Smarty Server provider before mobile cancel', async () => {
    getProvider.mockReturnValue(null);
    getOrCreateProviderForSession.mockResolvedValue(provider as any);
    const harness = createHarness();

    harness.send({
      type: 'cancel',
      sessionId: 'session-smarty',
      payload: {},
    });
    await flushAsyncHandlers();

    expect(getOrCreateProviderForSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-smarty',
        provider: 'smarty-server',
      }),
      'smarty-server',
    );
    expect(rollbackExecutingPrompts).toHaveBeenCalledWith('session-smarty');
    expect(provider.interruptSession).toHaveBeenCalledWith('session-smarty', {
      workspacePath: '/workspace',
    });
  });
});
