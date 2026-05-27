import type { HTMLAttributes, ReactNode } from 'react';
import './AgentElementsPrimitives.css';

export type AgentEventRole = 'user' | 'assistant' | 'system' | 'tool' | 'subagent';
export type AgentStatusTone = 'neutral' | 'running' | 'success' | 'warning' | 'error';
export type AgentToolStatus = 'idle' | 'running' | 'completed' | 'error' | 'interrupted';

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function formatDebugPayload(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export function agentToolStatusToTone(status: AgentToolStatus): AgentStatusTone {
  if (status === 'running') return 'running';
  if (status === 'completed') return 'success';
  if (status === 'error') return 'error';
  if (status === 'interrupted') return 'warning';
  return 'neutral';
}

export interface AgentStatusPillProps {
  tone?: AgentStatusTone;
  children: ReactNode;
  className?: string;
}

interface DataTestIdAttribute {
  'data-testid'?: string;
}

interface DataComponentAttribute {
  'data-component'?: string;
}

export interface AgentElementsCardAttributes {
  'data-agent-elements-card-padding'?: string;
  'data-agent-elements-card-width'?: string;
}

export function AgentStatusPill({
  tone = 'neutral',
  children,
  className,
}: AgentStatusPillProps) {
  return (
    <span
      className={classNames('agent-elements-status-pill', className)}
      data-tone={tone}
      data-component="AgentStatusPill"
    >
      {children}
    </span>
  );
}

export interface AgentTranscriptRowProps extends HTMLAttributes<HTMLDivElement>, DataTestIdAttribute {
  role: AgentEventRole;
  name: string;
  metadata?: ReactNode;
  status?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function AgentTranscriptRow({
  role,
  name,
  metadata,
  status,
  icon,
  actions,
  children,
  className,
  'data-testid': dataTestId = 'agent-elements-transcript-row',
  ...rest
}: AgentTranscriptRowProps) {
  return (
    <article
      {...rest}
      className={classNames('agent-elements-transcript-row', className)}
      data-agent-align="left"
      data-agent-role={role}
      data-component="AgentTranscriptRow"
      data-testid={dataTestId}
    >
      <header
        className="agent-elements-identity-row"
        data-testid="agent-elements-identity-row"
      >
        <span className="agent-elements-role-icon" aria-hidden="true">
          {icon ?? <span className="agent-elements-role-dot" />}
        </span>
        <span className="agent-elements-role-name">{name}</span>
        {metadata ? <span className="agent-elements-role-metadata">{metadata}</span> : null}
        {status ? <span className="agent-elements-role-status">{status}</span> : null}
        {actions ? <span className="agent-elements-row-actions">{actions}</span> : null}
      </header>
      <div
        className="agent-elements-transcript-content"
        data-testid="agent-elements-transcript-content"
      >
        {children}
      </div>
    </article>
  );
}

export interface AgentToolCardProps extends HTMLAttributes<HTMLDivElement>, DataTestIdAttribute, DataComponentAttribute, AgentElementsCardAttributes {
  title: string;
  subtitle?: ReactNode;
  status?: AgentToolStatus;
  icon?: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
  debugPayload?: unknown;
  defaultDebugOpen?: boolean;
  children?: ReactNode;
}

export function AgentToolCard({
  title,
  subtitle,
  status = 'idle',
  icon,
  trailing,
  footer,
  debugPayload,
  defaultDebugOpen = false,
  children,
  className,
  'data-agent-elements-card-padding': dataCardPadding = 'symmetric-inline',
  'data-agent-elements-card-width': dataCardWidth = 'bridge-fill',
  'data-component': dataComponent = 'AgentToolCard',
  'data-testid': dataTestId = 'agent-elements-tool-card',
  ...rest
}: AgentToolCardProps) {
  return (
    <section
      {...rest}
      className={classNames('agent-elements-tool-card', className)}
      data-agent-elements-card-padding={dataCardPadding}
      data-agent-elements-card-width={dataCardWidth}
      data-component={dataComponent}
      data-testid={dataTestId}
      data-tool-status={status}
    >
      <div className="agent-elements-tool-header">
        <span className="agent-elements-tool-icon" aria-hidden="true">
          {icon ?? <span className="agent-elements-tool-status-dot" />}
        </span>
        <div className="agent-elements-tool-title-group">
          <span className="agent-elements-tool-title">{title}</span>
          {subtitle ? <span className="agent-elements-tool-subtitle">{subtitle}</span> : null}
        </div>
        {trailing ? <span className="agent-elements-tool-trailing">{trailing}</span> : null}
      </div>
      {children ? (
        <div
          className="agent-elements-tool-primary"
          data-testid="agent-elements-tool-primary"
        >
          {children}
        </div>
      ) : null}
      {debugPayload !== undefined ? (
        <details
          className="agent-elements-debug-disclosure"
          data-debug-only="true"
          data-testid="agent-elements-debug-disclosure"
          open={defaultDebugOpen}
        >
          <summary>Debug payload</summary>
          <pre
            className="agent-elements-debug-payload"
            data-testid="agent-elements-debug-payload"
          >
            {formatDebugPayload(debugPayload)}
          </pre>
        </details>
      ) : null}
      {footer ? <div className="agent-elements-tool-footer">{footer}</div> : null}
    </section>
  );
}
