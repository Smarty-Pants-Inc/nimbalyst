import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { MaterialSymbol } from '../icons/MaterialSymbol';
import { AgentStatusPill, AgentToolCard, type AgentToolStatus } from './AgentElementsPrimitives';
import './AgentElementsFrameworkEvents.css';

type EventCardDivProps = Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'onSubmit' | 'title'>;

interface DataTestIdAttribute {
  'data-testid'?: string;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function statusToTone(status: AgentToolStatus) {
  if (status === 'running') return 'running';
  if (status === 'completed') return 'success';
  if (status === 'error') return 'error';
  if (status === 'interrupted') return 'warning';
  return 'neutral';
}

function formatStatus(status: AgentToolStatus): string {
  if (status === 'idle') return 'idle';
  return status;
}

export interface AgentThinkingCardProps extends EventCardDivProps, DataTestIdAttribute {
  content?: ReactNode;
  status?: AgentToolStatus;
  detail?: ReactNode;
  hiddenBySetting?: boolean;
  defaultExpanded?: boolean;
  debugPayload?: unknown;
}

export function AgentThinkingCard({
  content,
  status = 'completed',
  detail,
  hiddenBySetting = false,
  defaultExpanded = false,
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-thinking-card',
  ...rest
}: AgentThinkingCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasContent = content !== undefined && content !== null && !hiddenBySetting;
  const isRunning = status === 'running';

  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-thinking-card', className)}
      data-component="AgentThinkingCard"
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon={isRunning ? 'psychology' : 'lightbulb'} size={14} />}
      status={status}
      subtitle={detail}
      title={isRunning ? 'Thinking' : 'Thought'}
      trailing={<AgentStatusPill tone={statusToTone(status)}>{formatStatus(status)}</AgentStatusPill>}
    >
      <div className="agent-elements-thinking-shell" data-testid="agent-elements-thinking-shell">
        <button
          aria-expanded={isExpanded}
          className="agent-elements-framework-row"
          data-testid="agent-elements-thinking-toggle"
          disabled={!hasContent}
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          <span className="agent-elements-framework-label">
            {hiddenBySetting ? 'Reasoning hidden by setting' : isRunning ? 'Streaming reasoning' : 'Reasoning available'}
          </span>
          {hasContent ? <MaterialSymbol icon={isExpanded ? 'keyboard_arrow_down' : 'chevron_right'} size={16} /> : null}
        </button>
        {isExpanded && hasContent ? (
          <div className="agent-elements-thinking-content" data-testid="agent-elements-thinking-content">
            {content}
          </div>
        ) : null}
      </div>
    </AgentToolCard>
  );
}

export interface AgentMcpArgument {
  key: string;
  value: ReactNode;
}

export interface AgentMcpToolCardProps extends EventCardDivProps, DataTestIdAttribute {
  toolName: string;
  serverName?: string;
  displayName?: string;
  args?: AgentMcpArgument[];
  result?: ReactNode;
  error?: ReactNode;
  status?: AgentToolStatus;
  defaultExpanded?: boolean;
  debugPayload?: unknown;
}

function parseMcpIdentity(toolName: string, serverName?: string) {
  const match = toolName.match(/^mcp__(.+?)__(.+)$/);
  if (!match) {
    return { server: serverName ?? 'mcp', tool: toolName };
  }
  return { server: serverName ?? match[1], tool: match[2] };
}

export function AgentMcpToolCard({
  toolName,
  serverName,
  displayName,
  args = [],
  result,
  error,
  status = 'completed',
  defaultExpanded = true,
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-mcp-tool-card',
  ...rest
}: AgentMcpToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const identity = useMemo(() => parseMcpIdentity(toolName, serverName), [serverName, toolName]);
  const title = status === 'running' ? `Running ${displayName ?? identity.tool}` : displayName ?? identity.tool;
  const hasBody = args.length > 0 || result !== undefined || error !== undefined;

  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-mcp-tool-card', className)}
      data-component="AgentMcpToolCard"
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon="hub" size={14} />}
      status={status}
      subtitle={`${identity.server} / ${identity.tool}`}
      title={title}
      trailing={<AgentStatusPill tone={statusToTone(status)}>{formatStatus(status)}</AgentStatusPill>}
    >
      <div className="agent-elements-mcp-shell" data-testid="agent-elements-mcp-shell">
        <button
          aria-expanded={isExpanded}
          className="agent-elements-framework-row"
          data-testid="agent-elements-mcp-toggle"
          disabled={!hasBody}
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          <span className="agent-elements-mcp-identity">
            <span>{identity.server}</span>
            <span>{identity.tool}</span>
          </span>
          {hasBody ? <MaterialSymbol icon={isExpanded ? 'keyboard_arrow_down' : 'chevron_right'} size={16} /> : null}
        </button>
        {isExpanded && hasBody ? (
          <div className="agent-elements-mcp-body">
            {args.length > 0 ? (
              <dl className="agent-elements-mcp-args" data-testid="agent-elements-mcp-args">
                {args.map((arg) => (
                  <div className="agent-elements-mcp-arg" key={arg.key}>
                    <dt>{arg.key}</dt>
                    <dd>{arg.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {result !== undefined ? (
              <div className="agent-elements-mcp-result" data-testid="agent-elements-mcp-result">
                {result}
              </div>
            ) : null}
            {error !== undefined ? (
              <div className="agent-elements-mcp-error" data-testid="agent-elements-mcp-error">
                {error}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AgentToolCard>
  );
}

export interface AgentQuestionOption {
  id: string;
  label: ReactNode;
  description?: ReactNode;
}

export interface AgentQuestionAnswer {
  label: ReactNode;
  timestamp?: ReactNode;
}

export interface AgentQuestionCardProps extends EventCardDivProps, DataTestIdAttribute {
  question: ReactNode;
  description?: ReactNode;
  options?: AgentQuestionOption[];
  kind?: 'single' | 'multi' | 'text';
  status?: 'pending' | 'answered' | 'approved' | 'denied' | 'cancelled' | 'expired';
  responseHistory?: AgentQuestionAnswer[];
  interactionMode?: 'interactive' | 'display';
  allowSkip?: boolean;
  submitLabel?: string;
  skipLabel?: string;
  onSubmit?: (answer: { selectedIds: string[]; text: string }) => void;
  onSkip?: () => void;
  debugPayload?: unknown;
}

export function AgentQuestionCard({
  question,
  description,
  options = [],
  kind = 'single',
  status = 'pending',
  responseHistory = [],
  interactionMode,
  allowSkip = true,
  submitLabel = 'Submit',
  skipLabel = 'Skip',
  onSubmit,
  onSkip,
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-question-card',
  ...rest
}: AgentQuestionCardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [text, setText] = useState('');
  const isPending = status === 'pending';
  const resolvedInteractionMode = interactionMode ?? (onSubmit || onSkip ? 'interactive' : 'display');
  const isInteractive = isPending && resolvedInteractionMode === 'interactive' && Boolean(onSubmit || onSkip);
  const isDisplayOnly = isPending && !isInteractive;
  const canSubmit = kind === 'text' ? text.trim().length > 0 : selectedIds.length > 0;

  const toggleOption = (id: string) => {
    if (!isPending) return;
    setSelectedIds((current) => {
      if (kind === 'single') return current.includes(id) ? [] : [id];
      return current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    });
  };

  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-question-card', className)}
      data-component="AgentQuestionCard"
      data-display-only={isDisplayOnly ? 'true' : undefined}
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon="help" size={14} />}
      status={isPending ? 'interrupted' : 'completed'}
      title={isPending ? 'Question' : 'Question answered'}
      trailing={<AgentStatusPill tone={isPending ? 'warning' : 'success'}>{status}</AgentStatusPill>}
    >
      <div className="agent-elements-question-shell" data-testid="agent-elements-question-shell">
        <div className="agent-elements-question-copy">
          <div className="agent-elements-question-title" data-testid="agent-elements-question-title">{question}</div>
          {description ? <div className="agent-elements-question-description">{description}</div> : null}
        </div>
        {isInteractive ? (
          <div className="agent-elements-question-inputs">
            {kind === 'text' ? (
              <textarea
                className="agent-elements-question-textarea"
                data-testid="agent-elements-question-textarea"
                onChange={(event) => setText(event.target.value)}
                value={text}
              />
            ) : (
              <div className="agent-elements-question-options" data-testid="agent-elements-question-options">
                {options.map((option, index) => (
                  <button
                    aria-pressed={selectedIds.includes(option.id)}
                    className="agent-elements-question-option"
                    data-testid="agent-elements-question-option"
                    key={option.id}
                    onClick={() => toggleOption(option.id)}
                    type="button"
                  >
                    <span className="agent-elements-question-option-badge">{String.fromCharCode(65 + index)}</span>
                    <span className="agent-elements-question-option-copy">
                      <span>{option.label}</span>
                      {option.description ? <small>{option.description}</small> : null}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="agent-elements-question-actions">
              {allowSkip && onSkip ? (
                <button onClick={onSkip} type="button">
                  {skipLabel}
                </button>
              ) : null}
              {onSubmit ? (
                <button
                  disabled={!canSubmit}
                  onClick={() => onSubmit({ selectedIds, text })}
                  type="button"
                >
                  {submitLabel}
                </button>
              ) : null}
            </div>
          </div>
        ) : isDisplayOnly && options.length > 0 ? (
          <div
            className="agent-elements-question-options agent-elements-question-options-display"
            data-interactive="false"
            data-testid="agent-elements-question-options"
            role="list"
          >
            {options.map((option, index) => (
              <div
                className="agent-elements-question-option agent-elements-question-option-static"
                data-testid="agent-elements-question-option-display"
                key={option.id}
                role="listitem"
              >
                <span className="agent-elements-question-option-badge">{String.fromCharCode(65 + index)}</span>
                <span className="agent-elements-question-option-copy">
                  <span>{option.label}</span>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {responseHistory.length > 0 ? (
          <div className="agent-elements-question-history" data-testid="agent-elements-question-history">
            {responseHistory.map((answer, index) => (
              <div className="agent-elements-question-history-row" key={index}>
                <span>{answer.label}</span>
                {answer.timestamp ? <span>{answer.timestamp}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </AgentToolCard>
  );
}

export interface AgentSubagentItem {
  id?: string;
  title: ReactNode;
  detail?: ReactNode;
  kind?: 'tool' | 'message' | 'value' | 'checkpoint' | 'task';
  status?: AgentToolStatus;
}

export interface AgentSubagentCardProps extends EventCardDivProps, DataTestIdAttribute {
  name: ReactNode;
  summary?: ReactNode;
  status?: AgentToolStatus;
  elapsedLabel?: ReactNode;
  items?: AgentSubagentItem[];
  defaultExpanded?: boolean;
  maxVisibleItems?: number;
  debugPayload?: unknown;
}

export function AgentSubagentCard({
  name,
  summary,
  status = 'running',
  elapsedLabel,
  items = [],
  defaultExpanded = true,
  maxVisibleItems = 5,
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-subagent-card',
  ...rest
}: AgentSubagentCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasItems = items.length > 0;

  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-subagent-card', className)}
      data-component="AgentSubagentCard"
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon="account_tree" size={14} />}
      status={status}
      subtitle={summary}
      title={status === 'running' ? 'Running subagent' : status === 'error' ? 'Subagent failed' : 'Subagent'}
      trailing={elapsedLabel ? <span className="agent-elements-subagent-elapsed">{elapsedLabel}</span> : null}
    >
      <div
        className="agent-elements-subagent-shell"
        data-overflow={items.length > maxVisibleItems ? 'true' : 'false'}
        data-testid="agent-elements-subagent-shell"
        style={{ '--agent-elements-visible-items': maxVisibleItems } as CSSProperties}
      >
        <button
          aria-expanded={isExpanded}
          className="agent-elements-framework-row"
          data-testid="agent-elements-subagent-toggle"
          disabled={!hasItems}
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          <span className="agent-elements-framework-label">{name}</span>
          <AgentStatusPill tone={statusToTone(status)}>{formatStatus(status)}</AgentStatusPill>
          {hasItems ? <MaterialSymbol icon={isExpanded ? 'keyboard_arrow_down' : 'chevron_right'} size={16} /> : null}
        </button>
        {isExpanded && hasItems ? (
          <div className="agent-elements-subagent-list" data-testid="agent-elements-subagent-list">
            {items.map((item, index) => (
              <div
                className="agent-elements-subagent-item"
                data-subagent-item-kind={item.kind ?? 'tool'}
                data-tool-status={item.status ?? 'completed'}
                data-testid="agent-elements-subagent-item"
                key={item.id ?? index}
                style={{ '--agent-elements-item-index': index } as CSSProperties}
              >
                <MaterialSymbol icon={item.kind === 'message' ? 'chat' : item.kind === 'checkpoint' ? 'flag' : 'build'} size={13} />
                <span>{item.title}</span>
                {item.detail ? <small>{item.detail}</small> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </AgentToolCard>
  );
}
