import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';
import { MaterialSymbol } from '../icons/MaterialSymbol';
import { AgentStatusPill, AgentToolCard, type AgentStatusTone, type AgentToolStatus } from './AgentElementsPrimitives';
import './AgentElementsStreamEvents.css';

type StreamEventDivProps = Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'title'>;

interface DataTestIdAttribute {
  'data-testid'?: string;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function statusToTone(status: AgentToolStatus): AgentStatusTone {
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

export interface AgentProgressUpdate {
  id?: string;
  label: ReactNode;
  detail?: ReactNode;
  timestamp?: ReactNode;
  tone?: AgentStatusTone;
}

export interface AgentProgressCardProps extends StreamEventDivProps, DataTestIdAttribute {
  label: ReactNode;
  status?: AgentToolStatus;
  updates?: AgentProgressUpdate[];
  elapsedLabel?: ReactNode;
  debugPayload?: unknown;
}

export function AgentProgressCard({
  label,
  status = 'running',
  updates = [],
  elapsedLabel,
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-progress-card',
  ...rest
}: AgentProgressCardProps) {
  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-progress-card', className)}
      data-component="AgentProgressCard"
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon={status === 'running' ? 'progress_activity' : 'timeline'} size={14} />}
      status={status}
      title={status === 'running' ? 'Progress update' : 'Progress'}
      trailing={elapsedLabel ? <span className="agent-elements-stream-elapsed">{elapsedLabel}</span> : null}
    >
      <div className="agent-elements-progress-shell" data-testid="agent-elements-progress-shell">
        <div className="agent-elements-stream-heading">
          <span>{label}</span>
          <AgentStatusPill tone={statusToTone(status)}>{formatStatus(status)}</AgentStatusPill>
        </div>
        <div className="agent-elements-progress-updates" data-testid="agent-elements-progress-updates">
          {updates.length > 0 ? updates.map((update, index) => (
            <div
              className="agent-elements-progress-update"
              data-testid="agent-elements-progress-update"
              data-tone={update.tone ?? 'neutral'}
              key={update.id ?? index}
              style={{ '--agent-elements-stream-index': index } as CSSProperties}
            >
              <span className="agent-elements-progress-update-dot" aria-hidden="true" />
              <span className="agent-elements-progress-update-label">{update.label}</span>
              {update.detail ? <small>{update.detail}</small> : null}
              {update.timestamp ? <time>{update.timestamp}</time> : null}
            </div>
          )) : (
            <div className="agent-elements-progress-empty" data-testid="agent-elements-progress-empty">
              Waiting for the first update.
            </div>
          )}
        </div>
      </div>
    </AgentToolCard>
  );
}

export interface AgentStateKeyChange {
  key: string;
  before?: ReactNode;
  after?: ReactNode;
  summary?: ReactNode;
}

export interface AgentStateSnapshotCardProps extends StreamEventDivProps, DataTestIdAttribute {
  title?: string;
  namespace?: ReactNode;
  status?: AgentToolStatus;
  changedKeys?: AgentStateKeyChange[];
  summary?: ReactNode;
  defaultExpanded?: boolean;
  debugPayload?: unknown;
}

export function AgentStateSnapshotCard({
  title = 'State update',
  namespace,
  status = 'completed',
  changedKeys = [],
  summary,
  defaultExpanded = true,
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-state-snapshot-card',
  ...rest
}: AgentStateSnapshotCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasChanges = changedKeys.length > 0;

  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-state-snapshot-card', className)}
      data-component="AgentStateSnapshotCard"
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon="data_object" size={14} />}
      status={status}
      subtitle={namespace}
      title={title}
      trailing={<AgentStatusPill tone={statusToTone(status)}>{hasChanges ? `${changedKeys.length} changed` : formatStatus(status)}</AgentStatusPill>}
    >
      <div className="agent-elements-state-shell" data-testid="agent-elements-state-shell">
        <button
          aria-expanded={isExpanded}
          className="agent-elements-state-toggle"
          data-testid="agent-elements-state-toggle"
          disabled={!hasChanges}
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          <span>{summary ?? (hasChanges ? 'Changed state keys' : 'No state changes')}</span>
          {hasChanges ? <MaterialSymbol icon={isExpanded ? 'keyboard_arrow_down' : 'chevron_right'} size={16} /> : null}
        </button>
        {isExpanded && hasChanges ? (
          <dl className="agent-elements-state-key-list" data-testid="agent-elements-state-key-list">
            {changedKeys.map((change, index) => (
              <div className="agent-elements-state-key-row" data-testid="agent-elements-state-key-row" key={`${change.key}-${index}`}>
                <dt>{change.key}</dt>
                <dd>
                  {change.summary ? <span>{change.summary}</span> : null}
                  {change.before !== undefined || change.after !== undefined ? (
                    <span className="agent-elements-state-delta">
                      {change.before !== undefined ? <span data-state-edge="before">{change.before}</span> : null}
                      {change.after !== undefined ? <span data-state-edge="after">{change.after}</span> : null}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </AgentToolCard>
  );
}

export type AgentLifecycleKind = 'run' | 'task' | 'checkpoint' | 'custom';
export type AgentLifecycleStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

export interface AgentLifecycleEvent {
  id?: string;
  label: ReactNode;
  detail?: ReactNode;
  status?: AgentLifecycleStatus;
  timestamp?: ReactNode;
}

export interface AgentLifecycleCardProps extends StreamEventDivProps, DataTestIdAttribute {
  kind?: AgentLifecycleKind;
  name: ReactNode;
  status?: AgentLifecycleStatus;
  detail?: ReactNode;
  resumeId?: ReactNode;
  events?: AgentLifecycleEvent[];
  debugPayload?: unknown;
}

function lifecycleStatusToToolStatus(status: AgentLifecycleStatus): AgentToolStatus {
  if (status === 'running' || status === 'queued') return 'running';
  if (status === 'failed') return 'error';
  if (status === 'interrupted' || status === 'cancelled') return 'interrupted';
  return 'completed';
}

function getLifecycleIcon(kind: AgentLifecycleKind): string {
  if (kind === 'checkpoint') return 'flag';
  if (kind === 'task') return 'task_alt';
  if (kind === 'custom') return 'extension';
  return 'account_tree';
}

export function AgentLifecycleCard({
  kind = 'run',
  name,
  status = 'running',
  detail,
  resumeId,
  events = [],
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-lifecycle-card',
  ...rest
}: AgentLifecycleCardProps) {
  const toolStatus = lifecycleStatusToToolStatus(status);

  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-lifecycle-card', className)}
      data-component="AgentLifecycleCard"
      data-lifecycle-kind={kind}
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon={getLifecycleIcon(kind)} size={14} />}
      status={toolStatus}
      subtitle={detail}
      title={kind === 'checkpoint' ? 'Checkpoint' : kind === 'task' ? 'Task lifecycle' : 'Run lifecycle'}
      trailing={<AgentStatusPill tone={statusToTone(toolStatus)}>{status}</AgentStatusPill>}
    >
      <div className="agent-elements-lifecycle-shell" data-testid="agent-elements-lifecycle-shell">
        <div className="agent-elements-stream-heading">
          <span>{name}</span>
          {resumeId ? <span className="agent-elements-lifecycle-resume">resume {resumeId}</span> : null}
        </div>
        {events.length > 0 ? (
          <div className="agent-elements-lifecycle-events" data-testid="agent-elements-lifecycle-events">
            {events.map((event, index) => (
              <div
                className="agent-elements-lifecycle-event"
                data-lifecycle-status={event.status ?? 'completed'}
                data-testid="agent-elements-lifecycle-event"
                key={event.id ?? index}
                style={{ '--agent-elements-stream-index': index } as CSSProperties}
              >
                <span>{event.label}</span>
                {event.detail ? <small>{event.detail}</small> : null}
                {event.timestamp ? <time>{event.timestamp}</time> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </AgentToolCard>
  );
}

export interface AgentTurnSummaryUsage {
  input?: number;
  output?: number;
  total?: number;
}

export interface AgentTurnSummaryCardProps extends StreamEventDivProps, DataTestIdAttribute {
  durationLabel?: ReactNode;
  usage?: AgentTurnSummaryUsage;
  contextUsagePercent?: number;
  warnings?: ReactNode[];
  status?: AgentToolStatus;
  debugPayload?: unknown;
}

export function AgentTurnSummaryCard({
  durationLabel,
  usage,
  contextUsagePercent,
  warnings = [],
  status = 'completed',
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-turn-summary-card',
  ...rest
}: AgentTurnSummaryCardProps) {
  const contextLabel = contextUsagePercent === undefined ? null : `${Math.round(contextUsagePercent)}% context`;

  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-turn-summary-card', className)}
      data-component="AgentTurnSummaryCard"
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon="fact_check" size={14} />}
      status={status}
      title="Turn summary"
      trailing={<AgentStatusPill tone={warnings.length > 0 ? 'warning' : statusToTone(status)}>{warnings.length > 0 ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : formatStatus(status)}</AgentStatusPill>}
    >
      <div className="agent-elements-turn-summary-shell" data-testid="agent-elements-turn-summary-shell">
        <dl className="agent-elements-turn-summary-metrics" data-testid="agent-elements-turn-summary-metrics">
          {durationLabel ? (
            <div>
              <dt>Duration</dt>
              <dd>{durationLabel}</dd>
            </div>
          ) : null}
          {usage?.input !== undefined ? (
            <div>
              <dt>Input</dt>
              <dd>{usage.input.toLocaleString()}</dd>
            </div>
          ) : null}
          {usage?.output !== undefined ? (
            <div>
              <dt>Output</dt>
              <dd>{usage.output.toLocaleString()}</dd>
            </div>
          ) : null}
          {usage?.total !== undefined ? (
            <div>
              <dt>Total</dt>
              <dd>{usage.total.toLocaleString()}</dd>
            </div>
          ) : null}
          {contextLabel ? (
            <div>
              <dt>Context</dt>
              <dd>{contextLabel}</dd>
            </div>
          ) : null}
        </dl>
        {warnings.length > 0 ? (
          <div className="agent-elements-turn-summary-warnings" data-testid="agent-elements-turn-summary-warnings">
            {warnings.map((warning, index) => (
              <div className="agent-elements-turn-summary-warning" key={index}>
                <MaterialSymbol icon="warning" size={13} />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </AgentToolCard>
  );
}

export type AgentErrorKind = 'auth' | 'rate_limit' | 'context' | 'service' | 'unknown';

export interface AgentErrorAction {
  label: string;
  onClick?: () => void;
}

export interface AgentErrorCardProps extends StreamEventDivProps, DataTestIdAttribute {
  title: string;
  message: ReactNode;
  kind?: AgentErrorKind;
  detail?: ReactNode;
  actions?: AgentErrorAction[];
  debugPayload?: unknown;
}

function getErrorLabel(kind: AgentErrorKind): string {
  if (kind === 'auth') return 'Authentication';
  if (kind === 'rate_limit') return 'Rate limit';
  if (kind === 'context') return 'Context limit';
  if (kind === 'service') return 'Service error';
  return 'Error';
}

export function AgentErrorCard({
  title,
  message,
  kind = 'unknown',
  detail,
  actions = [],
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-error-card',
  ...rest
}: AgentErrorCardProps) {
  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-error-card', className)}
      data-component="AgentErrorCard"
      data-error-kind={kind}
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon={kind === 'auth' ? 'key' : kind === 'rate_limit' ? 'speed' : 'error'} size={14} />}
      status="error"
      subtitle={getErrorLabel(kind)}
      title={title}
      trailing={<AgentStatusPill tone="error">error</AgentStatusPill>}
    >
      <div className="agent-elements-error-shell" data-testid="agent-elements-error-shell">
        <div className="agent-elements-error-message" data-testid="agent-elements-error-message">
          {message}
        </div>
        {detail ? <div className="agent-elements-error-detail">{detail}</div> : null}
        {actions.length > 0 ? (
          <div className="agent-elements-error-actions" data-testid="agent-elements-error-actions">
            {actions.map((action) => (
              <button className="agent-elements-error-action" key={action.label} onClick={action.onClick} type="button">
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </AgentToolCard>
  );
}
