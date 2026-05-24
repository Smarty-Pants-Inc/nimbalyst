/**
 * TranscriptWriter -- shared service for writing canonical transcript events.
 *
 * Provider adapters call this to produce canonical events. It owns sequence
 * assignment, searchable flag decisions, and stateful row updates.
 */

import type {
  ITranscriptEventStore,
  TranscriptEvent,
  TranscriptEventType,
  UserMessagePayload,
  AssistantMessagePayload,
  SystemMessagePayload,
  ToolCallPayload,
  ToolProgressPayload,
  InteractivePromptPayload,
  SubagentPayload,
  TurnEndedPayload,
} from './types';

export class TranscriptWriter {
  private seededSequence: number | null = null;

  // Tracks the most recently written canonical event for the current session
  // so streaming assistant_message chunks can be coalesced into a single row
  // instead of producing one event per token. Loaded lazily from the store on
  // the first call so we coalesce across batches (each `processNewMessages`
  // call constructs a fresh writer).
  private lastEventBySession = new Map<string, LastEventState | null>();
  private lastAssistantByCoalesceKey = new Map<string, LastEventState>();

  constructor(
    private store: ITranscriptEventStore,
    private provider: string,
  ) {}

  /**
   * Seed the in-memory sequence counter for bulk operations.
   * When seeded, insertEvent uses and increments the counter instead of
   * querying the DB each time. Safe during single-threaded bulk transforms.
   */
  seedSequence(startSequence: number): void {
    this.seededSequence = startSequence;
  }

  // ---------------------------------------------------------------------------
  // Message events (non-stateful)
  // ---------------------------------------------------------------------------

  async appendUserMessage(
    sessionId: string,
    text: string,
    options?: {
      mode?: 'agent' | 'planning';
      inputType?: 'user' | 'system_message';
      attachments?: UserMessagePayload['attachments'];
      createdAt?: Date;
    },
  ): Promise<TranscriptEvent> {
    const payload: UserMessagePayload = {
      mode: options?.mode ?? 'agent',
      inputType: options?.inputType ?? 'user',
      ...(options?.attachments ? { attachments: options.attachments } : {}),
    };

    return this.insertEvent(sessionId, {
      eventType: 'user_message',
      searchableText: text,
      searchable: true,
      payload: payload as unknown as Record<string, unknown>,
      createdAt: options?.createdAt,
    });
  }

  async appendAssistantMessage(
    sessionId: string,
    text: string,
    options?: {
      mode?: 'agent' | 'planning';
      createdAt?: Date;
      thinking?: string;
      thinkingSignature?: string;
      model?: string;
      coalesceKey?: string;
    },
  ): Promise<TranscriptEvent> {
    const mode = options?.mode ?? 'agent';
    const coalesceKey = normalizeCoalesceKey(options?.coalesceKey);
    const hasExtras =
      options?.thinking !== undefined ||
      options?.thinkingSignature !== undefined ||
      options?.model !== undefined;

    // Coalesce streaming chunks: if the previous event in this session is
    // also an assistant_message with the same mode/subagent, append to it
    // rather than inserting a new row. ACP and similar streaming protocols
    // emit one chunk per token; without this we'd persist thousands of
    // single-token events per session.
    //
    // Skip coalescing when the new chunk carries thinking/model metadata --
    // those need to land on their own event so the renderer can place them
    // in the correct part of the turn.
    const last = hasExtras ? null : await this.loadLastEvent(sessionId);
    if (this.canCoalesceAssistant(last, mode, coalesceKey)) {
      return this.updateAssistantMessageText(sessionId, last, text);
    }

    if (!hasExtras && coalesceKey) {
      const keyed = await this.loadLastAssistantByCoalesceKey(sessionId, coalesceKey);
      if (this.canCoalesceAssistant(keyed, mode, coalesceKey)) {
        return this.updateAssistantMessageText(sessionId, keyed, text);
      }
    }

    const payload: AssistantMessagePayload = {
      mode,
      ...(coalesceKey !== undefined ? { coalesceKey } : {}),
      ...(options?.thinking !== undefined ? { thinking: options.thinking } : {}),
      ...(options?.thinkingSignature !== undefined
        ? { thinkingSignature: options.thinkingSignature }
        : {}),
      ...(options?.model !== undefined ? { model: options.model } : {}),
    };

    return this.insertEvent(sessionId, {
      eventType: 'assistant_message',
      searchableText: text,
      searchable: true,
      payload: payload as unknown as Record<string, unknown>,
      createdAt: options?.createdAt,
    });
  }

  async appendSystemMessage(
    sessionId: string,
    text: string,
    options?: {
      systemType?: SystemMessagePayload['systemType'];
      statusCode?: string;
      isAuthError?: boolean;
      reminderKind?: string;
      searchable?: boolean;
      createdAt?: Date;
    },
  ): Promise<TranscriptEvent> {
    const payload: SystemMessagePayload = {
      systemType: options?.systemType ?? 'status',
      ...(options?.statusCode ? { statusCode: options.statusCode } : {}),
      ...(options?.isAuthError ? { isAuthError: true } : {}),
      ...(options?.reminderKind ? { reminderKind: options.reminderKind } : {}),
    };

    return this.insertEvent(sessionId, {
      eventType: 'system_message',
      searchableText: text,
      searchable: options?.searchable ?? true,
      payload: payload as unknown as Record<string, unknown>,
      createdAt: options?.createdAt,
    });
  }

  // ---------------------------------------------------------------------------
  // Tool call events (stateful -- create then update)
  // ---------------------------------------------------------------------------

  async createToolCall(
    sessionId: string,
    params: {
      toolName: string;
      toolDisplayName: string;
      description?: string | null;
      arguments: Record<string, unknown>;
      targetFilePath?: string | null;
      mcpServer?: string | null;
      mcpTool?: string | null;
      providerToolCallId?: string | null;
      subagentId?: string | null;
      createdAt?: Date;
    },
  ): Promise<TranscriptEvent> {
    const payload: ToolCallPayload = {
      toolName: params.toolName,
      toolDisplayName: params.toolDisplayName,
      status: 'running',
      description: params.description ?? null,
      arguments: params.arguments,
      targetFilePath: params.targetFilePath ?? null,
      mcpServer: params.mcpServer ?? null,
      mcpTool: params.mcpTool ?? null,
    };

    return this.insertEvent(sessionId, {
      eventType: 'tool_call',
      searchableText: null,
      searchable: false,
      payload: payload as unknown as Record<string, unknown>,
      providerToolCallId: params.providerToolCallId ?? null,
      subagentId: params.subagentId ?? null,
      createdAt: params.createdAt,
    });
  }

  async updateToolCall(
    eventId: number,
    update: {
      status: 'completed' | 'error';
      result?: string;
      isError?: boolean;
      exitCode?: number;
      durationMs?: number;
      changes?: Array<{ path: string; patch: string }>;
    },
  ): Promise<void> {
    const existing = await this.store.getEventById(eventId);
    if (!existing) {
      throw new Error(`TranscriptWriter: event ${eventId} not found`);
    }
    await this.store.mergeEventPayload(eventId, update as unknown as Record<string, unknown>);
  }

  async appendToolProgress(
    sessionId: string,
    params: {
      parentEventId: number;
      toolName: string;
      elapsedSeconds: number;
      progressContent: string;
      subagentId?: string | null;
      createdAt?: Date;
    },
  ): Promise<TranscriptEvent> {
    const payload: ToolProgressPayload = {
      toolName: params.toolName,
      elapsedSeconds: params.elapsedSeconds,
      progressContent: params.progressContent,
    };

    return this.insertEvent(sessionId, {
      eventType: 'tool_progress',
      searchableText: null,
      searchable: false,
      payload: payload as unknown as Record<string, unknown>,
      parentEventId: params.parentEventId,
      subagentId: params.subagentId ?? null,
      createdAt: params.createdAt,
    });
  }

  // ---------------------------------------------------------------------------
  // Interactive prompt events (stateful -- create then update)
  // ---------------------------------------------------------------------------

  async createInteractivePrompt(
    sessionId: string,
    payload: InteractivePromptPayload,
    options?: {
      subagentId?: string | null;
      providerToolCallId?: string | null;
      createdAt?: Date;
    },
  ): Promise<TranscriptEvent> {
    return this.insertEvent(sessionId, {
      eventType: 'interactive_prompt',
      searchableText: null,
      searchable: false,
      payload: payload as unknown as Record<string, unknown>,
      subagentId: options?.subagentId ?? null,
      providerToolCallId: options?.providerToolCallId ?? payload.requestId,
      createdAt: options?.createdAt,
    });
  }

  async updateInteractivePrompt(
    eventId: number,
    update: Partial<InteractivePromptPayload>,
  ): Promise<void> {
    const existing = await this.store.getEventById(eventId);
    if (!existing) {
      throw new Error(`TranscriptWriter: event ${eventId} not found`);
    }
    await this.store.mergeEventPayload(eventId, update as unknown as Record<string, unknown>);
  }

  // ---------------------------------------------------------------------------
  // Subagent events (stateful -- create then update)
  // ---------------------------------------------------------------------------

  async createSubagent(
    sessionId: string,
    params: {
      subagentId: string;
      agentType: string;
      teammateName?: string | null;
      teamName?: string | null;
      teammateMode?: string | null;
      model?: string | null;
      color?: string | null;
      isBackground?: boolean;
      prompt: string;
      createdAt?: Date;
    },
  ): Promise<TranscriptEvent> {
    const payload: SubagentPayload = {
      agentType: params.agentType,
      status: 'running',
      teammateName: params.teammateName ?? null,
      teamName: params.teamName ?? null,
      teammateMode: params.teammateMode ?? null,
      model: params.model ?? null,
      color: params.color ?? null,
      isBackground: params.isBackground ?? false,
      prompt: params.prompt,
    };

    return this.insertEvent(sessionId, {
      eventType: 'subagent',
      searchableText: null,
      searchable: false,
      payload: payload as unknown as Record<string, unknown>,
      subagentId: params.subagentId,
      createdAt: params.createdAt,
    });
  }

  async updateSubagent(
    eventId: number,
    update: {
      status: 'completed';
      resultSummary?: string;
      toolCallCount?: number;
      durationMs?: number;
    },
  ): Promise<void> {
    const existing = await this.store.getEventById(eventId);
    if (!existing) {
      throw new Error(`TranscriptWriter: event ${eventId} not found`);
    }
    await this.store.mergeEventPayload(eventId, update as unknown as Record<string, unknown>);
  }

  // ---------------------------------------------------------------------------
  // Turn boundary
  // ---------------------------------------------------------------------------

  async recordTurnEnded(
    sessionId: string,
    params: {
      contextFill: TurnEndedPayload['contextFill'];
      contextWindow: number;
      cumulativeUsage: TurnEndedPayload['cumulativeUsage'];
      contextCompacted?: boolean;
      subagentId?: string | null;
      createdAt?: Date;
    },
  ): Promise<TranscriptEvent> {
    const payload: TurnEndedPayload = {
      contextFill: params.contextFill,
      contextWindow: params.contextWindow,
      cumulativeUsage: params.cumulativeUsage,
      contextCompacted: params.contextCompacted ?? false,
    };

    return this.insertEvent(sessionId, {
      eventType: 'turn_ended',
      searchableText: null,
      searchable: false,
      payload: payload as unknown as Record<string, unknown>,
      subagentId: params.subagentId ?? null,
      createdAt: params.createdAt,
    });
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async insertEvent(
    sessionId: string,
    fields: {
      eventType: TranscriptEventType;
      searchableText: string | null;
      searchable: boolean;
      payload: Record<string, unknown>;
      parentEventId?: number | null;
      providerToolCallId?: string | null;
      subagentId?: string | null;
      createdAt?: Date;
    },
  ): Promise<TranscriptEvent> {
    // When seeded (bulk transform), use in-memory counter to avoid N round-trips.
    // Otherwise query DB for safe concurrent writes.
    let sequence: number;
    if (this.seededSequence != null) {
      sequence = this.seededSequence++;
    } else {
      sequence = await this.store.getNextSequence(sessionId);
    }

    const event = await this.store.insertEvent({
      sessionId,
      sequence,
      createdAt: fields.createdAt ?? new Date(),
      eventType: fields.eventType,
      searchableText: fields.searchableText,
      searchable: fields.searchable,
      payload: fields.payload,
      parentEventId: fields.parentEventId ?? null,
      subagentId: fields.subagentId ?? null,
      provider: this.provider,
      providerToolCallId: fields.providerToolCallId ?? null,
    });

    // Refresh the coalesce-anchor for this session so the next call sees
    // whatever we just wrote (including non-assistant events that should
    // break the assistant_message coalesce chain).
    this.lastEventBySession.set(sessionId, this.toLastEventState(event));
    this.cacheCoalesceBoundary(sessionId, event);

    return event;
  }

  private async loadLastEvent(sessionId: string): Promise<LastEventState | null> {
    if (this.lastEventBySession.has(sessionId)) {
      return this.lastEventBySession.get(sessionId) ?? null;
    }

    const tail = await this.store.getTailEvents(sessionId, 1);
    const event = tail[tail.length - 1] ?? null;
    const state: LastEventState | null = event ? this.toLastEventState(event) : null;
    this.lastEventBySession.set(sessionId, state);
    if (event) {
      this.cacheCoalesceBoundary(sessionId, event);
    }
    return state;
  }

  private async loadLastAssistantByCoalesceKey(
    sessionId: string,
    coalesceKey: string,
  ): Promise<LastEventState | null> {
    const cacheKey = sessionCoalesceCacheKey(sessionId, coalesceKey);
    const cached = this.lastAssistantByCoalesceKey.get(cacheKey);
    if (cached) return cached;

    const tail = await this.store.getTailEvents(sessionId, 256);
    for (let i = tail.length - 1; i >= 0; i -= 1) {
      const event = tail[i];
      if (event.eventType !== 'assistant_message') break;
      if (event.provider !== this.provider) continue;
      if (extractCoalesceKey(event.payload) !== coalesceKey) continue;
      const state = this.toLastEventState(event);
      this.lastAssistantByCoalesceKey.set(cacheKey, state);
      return state;
    }
    return null;
  }

  private canCoalesceAssistant(
    last: LastEventState | null,
    mode: 'agent' | 'planning',
    coalesceKey: string | undefined,
  ): last is LastEventState {
    if (!last) return false;
    if (last.eventType !== 'assistant_message') return false;
    if (last.provider !== this.provider) return false;
    if (last.subagentId !== null) return false;
    if (last.mode !== mode) return false;
    if (coalesceKey !== undefined || last.coalesceKey !== undefined) {
      return last.coalesceKey === coalesceKey;
    }
    return true;
  }

  private async updateAssistantMessageText(
    sessionId: string,
    target: LastEventState,
    text: string,
  ): Promise<TranscriptEvent> {
    const mergedText = (target.searchableText ?? '') + text;
    await this.store.updateEventText(target.id, mergedText);
    target.searchableText = mergedText;

    const refreshed = await this.store.getEventById(target.id);
    const refreshedState = refreshed ? this.toLastEventState(refreshed) : target;
    if (refreshedState.coalesceKey) {
      this.lastAssistantByCoalesceKey.set(
        sessionCoalesceCacheKey(sessionId, refreshedState.coalesceKey),
        refreshedState,
      );
    }

    const last = await this.loadLastEvent(sessionId);
    if (last?.id === refreshedState.id) {
      this.lastEventBySession.set(sessionId, refreshedState);
    }

    return refreshed ?? this.toTranscriptEvent(sessionId, refreshedState);
  }

  private cacheCoalesceBoundary(sessionId: string, event: TranscriptEvent): void {
    if (event.eventType !== 'assistant_message') {
      this.clearAssistantCoalesceCacheForSession(sessionId);
      return;
    }
    const coalesceKey = extractCoalesceKey(event.payload);
    if (!coalesceKey) return;
    this.lastAssistantByCoalesceKey.set(
      sessionCoalesceCacheKey(sessionId, coalesceKey),
      this.toLastEventState(event),
    );
  }

  private clearAssistantCoalesceCacheForSession(sessionId: string): void {
    const prefix = `${sessionId}\0`;
    for (const key of this.lastAssistantByCoalesceKey.keys()) {
      if (key.startsWith(prefix)) {
        this.lastAssistantByCoalesceKey.delete(key);
      }
    }
  }

  private toLastEventState(event: TranscriptEvent): LastEventState {
    return {
      id: event.id,
      provider: event.provider,
      eventType: event.eventType,
      searchableText: event.searchableText,
      mode: (event.payload as { mode?: 'agent' | 'planning' })?.mode,
      coalesceKey: extractCoalesceKey(event.payload),
      subagentId: event.subagentId,
    };
  }

  private toTranscriptEvent(sessionId: string, state: LastEventState): TranscriptEvent {
    // Fallback used only when the store can't return the refreshed event.
    return {
      id: state.id,
      sessionId,
      sequence: 0,
      createdAt: new Date(),
      eventType: state.eventType,
      searchableText: state.searchableText,
      searchable: true,
      payload: {
        mode: state.mode,
        ...(state.coalesceKey ? { coalesceKey: state.coalesceKey } : {}),
      } as Record<string, unknown>,
      parentEventId: null,
      subagentId: state.subagentId,
      provider: this.provider,
      providerToolCallId: null,
    };
  }
}

interface LastEventState {
  id: number;
  provider: string;
  eventType: TranscriptEventType;
  searchableText: string | null;
  mode: 'agent' | 'planning' | undefined;
  coalesceKey: string | undefined;
  subagentId: string | null;
}

function normalizeCoalesceKey(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function extractCoalesceKey(payload: Record<string, unknown>): string | undefined {
  const value = (payload as { coalesceKey?: unknown })?.coalesceKey;
  return typeof value === 'string' ? normalizeCoalesceKey(value) : undefined;
}

function sessionCoalesceCacheKey(sessionId: string, coalesceKey: string): string {
  return `${sessionId}\0${coalesceKey}`;
}
