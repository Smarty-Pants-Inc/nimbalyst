import type { ReactNode } from 'react';
import {
  AgentToolCard,
  AgentTranscriptRow,
  type AgentEventRole,
  type AgentToolStatus,
} from './AgentElementsPrimitives';
import {
  AgentPlanCard,
  AgentTodoList,
  type AgentPlanStatus,
  type AgentPlanStep,
  type AgentTodoItem,
} from './AgentElementsTodoPlan';
import {
  AgentCommandToolCard,
  AgentEditToolCard,
  AgentSearchToolCard,
  type AgentDiffLine,
  type AgentEditStatus,
  type AgentSearchResult,
} from './AgentElementsToolRenderers';
import {
  AgentMcpToolCard,
  AgentQuestionCard,
  AgentSubagentCard,
  AgentThinkingCard,
  type AgentMcpArgument,
  type AgentQuestionAnswer,
  type AgentQuestionOption,
  type AgentSubagentItem,
} from './AgentElementsFrameworkEvents';
import {
  AgentErrorCard,
  AgentLifecycleCard,
  AgentProgressCard,
  AgentStateSnapshotCard,
  AgentTurnSummaryCard,
  type AgentErrorAction,
  type AgentErrorKind,
  type AgentLifecycleEvent,
  type AgentLifecycleKind,
  type AgentLifecycleStatus,
  type AgentProgressUpdate,
  type AgentStateKeyChange,
  type AgentTurnSummaryUsage,
} from './AgentElementsStreamEvents';
import {
  AgentErrorMessage,
  AgentExtensionEventCard,
  AgentGenericToolCard,
  AgentMarkdown,
  AgentUserMessageBody,
  type AgentErrorMessageKind,
  type AgentMarkdownBlock,
  type AgentMetadataChip,
  type AgentUserAttachment,
} from './AgentElementsMessages';

export const knownAgentElementsRendererKinds = [
  'userMessage',
  'assistantMessage',
  'thinking',
  'systemStatus',
  'toolLifecycle',
  'toolProgress',
  'bash',
  'fileEdit',
  'search',
  'mcp',
  'genericTool',
  'humanInput',
  'plan',
  'todo',
  'subagent',
  'stateUpdate',
  'checkpointTaskDebug',
  'extensionEvent',
  'turnSummary',
] as const;

export type AgentElementsRendererKind = typeof knownAgentElementsRendererKinds[number];
export type AgentElementsFallbackClass =
  | 'known'
  | 'supported-generic'
  | 'unsupported'
  | 'debug-only';

export interface AgentElementsRendererActor {
  role?: AgentEventRole;
  name?: string;
  metadata?: ReactNode;
}

export interface AgentElementsRendererModel {
  kind: AgentElementsRendererKind | string;
  title?: string;
  body?: ReactNode;
  summary?: ReactNode;
  detail?: ReactNode;
  status?: string;
  actor?: AgentElementsRendererActor;
  rawPayload?: unknown;
  metadata?: AgentMetadataChip[];
  attachments?: AgentUserAttachment[];
  markdownBlocks?: AgentMarkdownBlock[];
  todos?: AgentTodoItem[];
  planSteps?: AgentPlanStep[];
  command?: string;
  output?: ReactNode;
  cwd?: string;
  exitCode?: number;
  deniedReason?: ReactNode;
  filePath?: string;
  editStatus?: AgentEditStatus;
  diffLines?: AgentDiffLine[];
  query?: string;
  source?: ReactNode;
  eventName?: string;
  searchSource?: 'code' | 'files' | 'web' | 'mcp';
  searchResults?: AgentSearchResult[];
  toolName?: string;
  serverName?: string;
  displayName?: string;
  args?: AgentMcpArgument[];
  result?: ReactNode;
  error?: ReactNode;
  options?: AgentQuestionOption[];
  questionKind?: 'single' | 'multi' | 'text';
  questionInteractionMode?: 'interactive' | 'display';
  responseHistory?: AgentQuestionAnswer[];
  subagentItems?: AgentSubagentItem[];
  namespace?: ReactNode;
  changedKeys?: AgentStateKeyChange[];
  progressUpdates?: AgentProgressUpdate[];
  lifecycleKind?: AgentLifecycleKind;
  lifecycleStatus?: AgentLifecycleStatus;
  lifecycleEvents?: AgentLifecycleEvent[];
  resumeId?: ReactNode;
  usage?: AgentTurnSummaryUsage;
  contextUsagePercent?: number;
  warnings?: ReactNode[];
  actions?: AgentErrorAction[];
  durationLabel?: ReactNode;
  elapsedLabel?: ReactNode;
  isStreaming?: boolean;
  hiddenBySetting?: boolean;
}

export interface AgentElementsRendererDescriptor {
  rendererKind: AgentElementsRendererKind | 'supported-generic' | 'unsupported' | 'debug-only';
  fallbackClass: AgentElementsFallbackClass;
  componentName: string;
}

export interface AgentElementsEventRendererProps {
  model: AgentElementsRendererModel;
}

const rendererComponentNames: Record<AgentElementsRendererKind, string> = {
  userMessage: 'AgentTranscriptRow + AgentUserMessageBody',
  assistantMessage: 'AgentTranscriptRow + AgentMarkdown',
  thinking: 'AgentThinkingCard',
  systemStatus: 'AgentErrorMessage',
  toolLifecycle: 'AgentToolCard',
  toolProgress: 'AgentProgressCard',
  bash: 'AgentCommandToolCard',
  fileEdit: 'AgentEditToolCard',
  search: 'AgentSearchToolCard',
  mcp: 'AgentMcpToolCard',
  genericTool: 'AgentGenericToolCard',
  humanInput: 'AgentQuestionCard',
  plan: 'AgentPlanCard',
  todo: 'AgentTodoList',
  subagent: 'AgentSubagentCard',
  stateUpdate: 'AgentStateSnapshotCard',
  checkpointTaskDebug: 'AgentLifecycleCard',
  extensionEvent: 'AgentExtensionEventCard',
  turnSummary: 'AgentTurnSummaryCard',
};

const knownKindSet = new Set<string>(knownAgentElementsRendererKinds);

function isKnownKind(kind: string): kind is AgentElementsRendererKind {
  return knownKindSet.has(kind);
}

function hasReadableGenericContent(model: AgentElementsRendererModel): boolean {
  return Boolean(model.title || model.summary || model.body || model.eventName || model.source);
}

export function getAgentElementsRendererDescriptor(model: AgentElementsRendererModel): AgentElementsRendererDescriptor {
  if (isKnownKind(model.kind)) {
    return {
      rendererKind: model.kind,
      fallbackClass: 'known',
      componentName: rendererComponentNames[model.kind],
    };
  }

  if (model.kind === 'debug' || model.kind === 'rawDebug') {
    return {
      rendererKind: 'debug-only',
      fallbackClass: 'debug-only',
      componentName: 'AgentGenericToolCard',
    };
  }

  if (hasReadableGenericContent(model) && (model.eventName || model.source || model.metadata?.length)) {
    return {
      rendererKind: 'supported-generic',
      fallbackClass: 'supported-generic',
      componentName: 'AgentGenericToolCard',
    };
  }

  return {
    rendererKind: 'unsupported',
    fallbackClass: 'unsupported',
    componentName: 'AgentGenericToolCard',
  };
}

function text(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function content(value: ReactNode, fallback: ReactNode): ReactNode {
  return value === undefined || value === null || value === '' ? fallback : value;
}

function toolStatus(value: string | undefined, fallback: AgentToolStatus = 'completed'): AgentToolStatus {
  if (value === 'idle' || value === 'running' || value === 'completed' || value === 'error' || value === 'interrupted') {
    return value;
  }
  if (value === 'pending' || value === 'awaiting_approval' || value === 'cancelled' || value === 'denied') return 'interrupted';
  if (value === 'failed' || value === 'failure') return 'error';
  if (value === 'streaming' || value === 'starting' || value === 'queued') return 'running';
  if (value === 'success' || value === 'finished' || value === 'approved' || value === 'resumed') return 'completed';
  return fallback;
}

function planStatus(value: string | undefined): AgentPlanStatus {
  if (
    value === 'draft' ||
    value === 'streaming' ||
    value === 'awaiting_approval' ||
    value === 'approved' ||
    value === 'completed' ||
    value === 'rejected'
  ) {
    return value;
  }
  if (value === 'running') return 'streaming';
  if (value === 'pending') return 'awaiting_approval';
  return 'draft';
}

function lifecycleStatus(value: string | undefined): AgentLifecycleStatus {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled' ||
    value === 'interrupted'
  ) {
    return value;
  }
  if (value === 'error' || value === 'failure') return 'failed';
  if (value === 'pending') return 'queued';
  return 'running';
}

function errorMessageKind(value: string | undefined): AgentErrorMessageKind {
  if (
    value === 'info' ||
    value === 'warning' ||
    value === 'auth_required' ||
    value === 'rate_limit' ||
    value === 'service_error' ||
    value === 'tool_error'
  ) {
    return value;
  }
  if (value === 'auth') return 'auth_required';
  if (value === 'context') return 'service_error';
  return 'service_error';
}

function errorKind(value: string | undefined): AgentErrorKind {
  if (value === 'auth' || value === 'rate_limit' || value === 'context' || value === 'service' || value === 'unknown') {
    return value;
  }
  if (value === 'auth_required') return 'auth';
  if (value === 'service_error') return 'service';
  return 'unknown';
}

function questionStatus(value: string | undefined): 'pending' | 'answered' | 'approved' | 'denied' | 'cancelled' | 'expired' {
  if (value === 'pending' || value === 'answered' || value === 'approved' || value === 'denied' || value === 'cancelled' || value === 'expired') {
    return value;
  }
  if (value === 'completed' || value === 'resumed') return 'answered';
  if (value === 'interrupted' || value === 'running') return 'pending';
  return 'pending';
}

function actorFor(
  model: AgentElementsRendererModel,
  fallbackRole: AgentEventRole,
  fallbackName: string
): { role: AgentEventRole; name: string; metadata?: ReactNode } {
  return {
    role: model.actor?.role ?? fallbackRole,
    name: model.actor?.name ?? fallbackName,
    metadata: model.actor?.metadata,
  };
}

function markdownBlocks(model: AgentElementsRendererModel): AgentMarkdownBlock[] {
  if (model.markdownBlocks) return model.markdownBlocks;
  if (model.body === undefined || model.body === null || model.body === '') return [];
  return [{ type: 'paragraph', content: model.body }];
}

function renderKnownModel(kind: AgentElementsRendererKind, model: AgentElementsRendererModel) {
  switch (kind) {
    case 'userMessage': {
      const actor = actorFor(model, 'user', 'User');
      return (
        <AgentTranscriptRow metadata={actor.metadata} name={actor.name} role={actor.role}>
          <AgentUserMessageBody
            attachments={model.attachments}
            content={model.body}
            isPartial={model.isStreaming}
          />
        </AgentTranscriptRow>
      );
    }
    case 'assistantMessage': {
      const actor = actorFor(model, 'assistant', 'Smarty Code');
      return (
        <AgentTranscriptRow metadata={actor.metadata} name={actor.name} role={actor.role}>
          <AgentMarkdown blocks={markdownBlocks(model)} isStreaming={model.isStreaming ?? model.status === 'streaming'} />
        </AgentTranscriptRow>
      );
    }
    case 'thinking':
      return (
        <AgentThinkingCard
          content={model.body}
          debugPayload={model.rawPayload}
          detail={model.detail}
          hiddenBySetting={model.hiddenBySetting}
          status={toolStatus(model.status)}
        />
      );
    case 'systemStatus':
      return (
        <AgentErrorMessage
          debugPayload={model.rawPayload}
          detail={model.detail}
          kind={errorMessageKind(model.status)}
          message={content(model.body, model.summary ?? 'System status update.')}
          status={toolStatus(model.status, 'completed')}
          title={text(model.title, 'System status')}
        />
      );
    case 'toolLifecycle':
      return (
        <AgentToolCard
          debugPayload={model.rawPayload}
          status={toolStatus(model.status, 'running')}
          subtitle={model.detail}
          title={text(model.title, 'Tool call')}
        >
          {content(model.body, model.summary ?? 'Tool event received.')}
        </AgentToolCard>
      );
    case 'toolProgress':
      return (
        <AgentProgressCard
          debugPayload={model.rawPayload}
          elapsedLabel={model.elapsedLabel}
          label={content(model.body, model.title ?? 'Progress update')}
          status={toolStatus(model.status, 'running')}
          updates={model.progressUpdates}
        />
      );
    case 'bash':
      return (
        <AgentCommandToolCard
          command={model.command ?? text(model.title, 'command')}
          cwd={model.cwd}
          debugPayload={model.rawPayload}
          deniedReason={model.deniedReason}
          exitCode={model.exitCode}
          output={model.output ?? model.body}
          status={toolStatus(model.status, model.exitCode && model.exitCode !== 0 ? 'error' : 'completed')}
        />
      );
    case 'fileEdit':
      return (
        <AgentEditToolCard
          debugPayload={model.rawPayload}
          diffLines={model.diffLines}
          filePath={model.filePath ?? text(model.title, 'unknown-file')}
          status={model.editStatus ?? (model.status === 'pending' ? 'pending_approval' : undefined)}
          summary={model.body}
        />
      );
    case 'search':
      return (
        <AgentSearchToolCard
          debugPayload={model.rawPayload}
          query={model.query ?? text(model.title, 'search')}
          results={model.searchResults}
          source={model.searchSource}
          status={toolStatus(model.status)}
          summary={model.body}
        />
      );
    case 'mcp':
      return (
        <AgentMcpToolCard
          args={model.args}
          debugPayload={model.rawPayload}
          displayName={model.displayName}
          error={model.error}
          result={model.result ?? model.body}
          serverName={model.serverName}
          status={toolStatus(model.status)}
          toolName={model.toolName ?? text(model.title, 'mcp__unknown__tool')}
        />
      );
    case 'genericTool':
      return (
        <AgentGenericToolCard
          debugPayload={model.rawPayload}
          metadata={model.metadata}
          result={model.result ?? model.body}
          status={toolStatus(model.status)}
          summary={model.summary}
          title={text(model.title, 'Structured tool')}
        />
      );
    case 'humanInput':
      return (
        <AgentQuestionCard
          debugPayload={model.rawPayload}
          description={model.detail}
          interactionMode={model.questionInteractionMode ?? 'display'}
          kind={model.questionKind}
          options={model.options}
          question={content(model.body, model.title ?? 'Human input required')}
          responseHistory={model.responseHistory}
          status={questionStatus(model.status)}
        />
      );
    case 'plan':
      return (
        <AgentPlanCard
          fileName={model.filePath}
          status={planStatus(model.status)}
          steps={model.planSteps}
          summary={model.body}
          title={text(model.title, 'Plan update')}
        />
      );
    case 'todo':
      return (
        <AgentTodoList
          isStreaming={model.isStreaming ?? toolStatus(model.status, 'completed') === 'running'}
          items={model.todos ?? [{ content: content(model.body, model.title ?? 'Todo update'), status: 'pending' }]}
        />
      );
    case 'subagent':
      return (
        <AgentSubagentCard
          debugPayload={model.rawPayload}
          elapsedLabel={model.elapsedLabel}
          items={model.subagentItems}
          name={content(model.body, model.title ?? 'Subagent')}
          status={toolStatus(model.status, 'running')}
          summary={model.summary}
        />
      );
    case 'stateUpdate':
      return (
        <AgentStateSnapshotCard
          changedKeys={model.changedKeys}
          debugPayload={model.rawPayload}
          namespace={model.namespace ?? model.source}
          status={toolStatus(model.status)}
          summary={model.summary ?? model.body}
          title={text(model.title, 'State update')}
        />
      );
    case 'checkpointTaskDebug':
      return (
        <AgentLifecycleCard
          debugPayload={model.rawPayload}
          detail={model.detail}
          events={model.lifecycleEvents}
          kind={model.lifecycleKind ?? 'checkpoint'}
          name={content(model.body, model.title ?? 'Lifecycle event')}
          resumeId={model.resumeId}
          status={model.lifecycleStatus ?? lifecycleStatus(model.status)}
        />
      );
    case 'extensionEvent':
      return (
        <AgentExtensionEventCard
          debugPayload={model.rawPayload}
          eventName={model.eventName ?? text(model.title, 'extension.event')}
          metadata={model.metadata}
          source={model.source ?? 'extension'}
          status={toolStatus(model.status, 'running')}
          summary={model.summary ?? model.body}
        />
      );
    case 'turnSummary':
      return (
        <AgentTurnSummaryCard
          contextUsagePercent={model.contextUsagePercent}
          debugPayload={model.rawPayload}
          durationLabel={model.durationLabel}
          status={toolStatus(model.status)}
          usage={model.usage}
          warnings={model.warnings}
        />
      );
  }
}

function renderFallback(model: AgentElementsRendererModel, descriptor: AgentElementsRendererDescriptor) {
  if (descriptor.fallbackClass === 'debug-only') {
    return (
      <AgentGenericToolCard
        debugPayload={model.rawPayload ?? model.body}
        metadata={[{ label: 'event', value: model.kind }]}
        result="Raw debug payload is available in the disclosure."
        status="completed"
        summary="Debug event collapsed by default."
        title="Debug event"
      />
    );
  }

  if (descriptor.fallbackClass === 'supported-generic') {
    return (
      <AgentGenericToolCard
        debugPayload={model.rawPayload}
        metadata={model.metadata ?? [{ label: 'event', value: model.eventName ?? model.kind }]}
        result={model.result ?? model.body ?? 'Structured custom event.'}
        status={toolStatus(model.status)}
        summary={model.summary ?? model.detail}
        title={text(model.title ?? model.eventName, 'Custom event')}
      />
    );
  }

  return (
    <AgentGenericToolCard
      debugPayload={model.rawPayload}
      metadata={[{ label: 'event', value: model.kind }]}
      result={content(model.body, 'This event needs a first-class renderer before it can close coverage.')}
      status="interrupted"
      summary="Renderer not registered for this normalized event model."
      title="Unsupported event"
    />
  );
}

export function AgentElementsEventRenderer({ model }: AgentElementsEventRendererProps) {
  const descriptor = getAgentElementsRendererDescriptor(model);
  const child = descriptor.fallbackClass === 'known'
    ? renderKnownModel(descriptor.rendererKind as AgentElementsRendererKind, model)
    : renderFallback(model, descriptor);

  return (
    <div
      className="agent-elements-renderer-boundary"
      data-component="AgentElementsEventRenderer"
      data-fallback-class={descriptor.fallbackClass}
      data-renderer-kind={descriptor.rendererKind}
      data-testid="agent-elements-renderer-boundary"
    >
      {child}
    </div>
  );
}
