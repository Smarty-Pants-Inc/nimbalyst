import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { MaterialSymbol } from '../icons/MaterialSymbol';
import { AgentStatusPill, AgentToolCard, type AgentStatusTone, type AgentToolStatus } from './AgentElementsPrimitives';
import './AgentElementsMessages.css';

type MessageDivProps = Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'title'>;

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

export type AgentUserAttachmentKind = 'file' | 'image' | 'link';

export interface AgentUserAttachment {
  id?: string;
  name: ReactNode;
  detail?: ReactNode;
  kind?: AgentUserAttachmentKind;
  thumbnailUrl?: string;
  alt?: string;
}

export interface AgentUserMessageBodyProps extends MessageDivProps, DataTestIdAttribute {
  content?: ReactNode;
  attachments?: AgentUserAttachment[];
  isPartial?: boolean;
}

function getAttachmentIcon(kind?: AgentUserAttachmentKind): string {
  if (kind === 'image') return 'image';
  if (kind === 'link') return 'link';
  return 'draft';
}

export function AgentUserMessageBody({
  content,
  attachments = [],
  isPartial = false,
  className,
  'data-testid': dataTestId = 'agent-elements-user-message-body',
  ...rest
}: AgentUserMessageBodyProps) {
  const hasContent = content !== undefined && content !== null && content !== '';

  return (
    <div
      {...rest}
      className={classNames('agent-elements-user-message-body', className)}
      data-component="AgentUserMessageBody"
      data-streaming={isPartial ? 'true' : 'false'}
      data-testid={dataTestId}
    >
      {attachments.length > 0 ? (
        <div className="agent-elements-user-attachments" data-testid="agent-elements-user-attachments">
          {attachments.map((attachment, index) => (
            <div
              className="agent-elements-user-attachment"
              data-attachment-kind={attachment.kind ?? 'file'}
              data-testid="agent-elements-user-attachment"
              key={attachment.id ?? index}
              style={{ '--agent-elements-message-index': index } as CSSProperties}
            >
              {attachment.thumbnailUrl ? (
                <img
                  alt={attachment.alt ?? 'Attachment preview'}
                  className="agent-elements-user-attachment-thumb"
                  loading="lazy"
                  src={attachment.thumbnailUrl}
                />
              ) : (
                <span className="agent-elements-user-attachment-icon" aria-hidden="true">
                  <MaterialSymbol icon={getAttachmentIcon(attachment.kind)} size={14} />
                </span>
              )}
              <span className="agent-elements-user-attachment-name">{attachment.name}</span>
              {attachment.detail ? <small>{attachment.detail}</small> : null}
            </div>
          ))}
        </div>
      ) : null}
      {hasContent ? (
        <div className="agent-elements-user-message-text" data-testid="agent-elements-user-message-text">
          {content}
        </div>
      ) : (
        <div className="agent-elements-user-message-empty" data-testid="agent-elements-user-message-empty">
          Empty message
        </div>
      )}
    </div>
  );
}

export type AgentMarkdownBlock =
  | { type: 'paragraph'; content: ReactNode }
  | { type: 'heading'; content: ReactNode; level?: 2 | 3 | 4 }
  | { type: 'list'; items: ReactNode[] }
  | { type: 'code'; content: ReactNode; language?: string }
  | { type: 'quote'; content: ReactNode };

export interface AgentMarkdownProps extends MessageDivProps, DataTestIdAttribute {
  blocks: AgentMarkdownBlock[];
  isStreaming?: boolean;
  emptyLabel?: ReactNode;
}

function renderMarkdownBlock(block: AgentMarkdownBlock, index: number) {
  const style = { '--agent-elements-message-index': index } as CSSProperties;

  if (block.type === 'heading') {
    const Heading = block.level === 4 ? 'h4' : block.level === 3 ? 'h3' : 'h2';
    return (
      <Heading className="agent-elements-markdown-heading" data-testid="agent-elements-markdown-heading" key={index} style={style}>
        {block.content}
      </Heading>
    );
  }

  if (block.type === 'list') {
    return (
      <ul className="agent-elements-markdown-list" data-testid="agent-elements-markdown-list" key={index} style={style}>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === 'code') {
    return (
      <pre className="agent-elements-markdown-code" data-testid="agent-elements-markdown-code" key={index} style={style}>
        {block.language ? <span className="agent-elements-markdown-code-language">{block.language}</span> : null}
        <code>{block.content}</code>
      </pre>
    );
  }

  if (block.type === 'quote') {
    return (
      <blockquote className="agent-elements-markdown-quote" data-testid="agent-elements-markdown-quote" key={index} style={style}>
        {block.content}
      </blockquote>
    );
  }

  return (
    <p className="agent-elements-markdown-paragraph" data-testid="agent-elements-markdown-paragraph" key={index} style={style}>
      {block.content}
    </p>
  );
}

export function AgentMarkdown({
  blocks,
  isStreaming = false,
  emptyLabel = 'No message content yet.',
  className,
  'data-testid': dataTestId = 'agent-elements-markdown',
  ...rest
}: AgentMarkdownProps) {
  return (
    <div
      {...rest}
      className={classNames('agent-elements-markdown', className)}
      data-component="AgentMarkdown"
      data-streaming={isStreaming ? 'true' : 'false'}
      data-testid={dataTestId}
    >
      {blocks.length > 0 ? blocks.map(renderMarkdownBlock) : (
        <p className="agent-elements-markdown-empty" data-testid="agent-elements-markdown-empty">
          {emptyLabel}
        </p>
      )}
      {isStreaming ? (
        <span className="agent-elements-markdown-streaming" data-testid="agent-elements-markdown-streaming">
          streaming
        </span>
      ) : null}
    </div>
  );
}

export type AgentErrorMessageKind = 'info' | 'warning' | 'auth_required' | 'rate_limit' | 'service_error' | 'tool_error';

export interface AgentErrorMessageProps extends MessageDivProps, DataTestIdAttribute {
  kind?: AgentErrorMessageKind;
  title: string;
  message: ReactNode;
  detail?: ReactNode;
  status?: AgentToolStatus;
  debugPayload?: unknown;
}

function errorKindToTone(kind: AgentErrorMessageKind): AgentStatusTone {
  if (kind === 'info') return 'neutral';
  if (kind === 'warning') return 'warning';
  return 'error';
}

export function AgentErrorMessage({
  kind = 'service_error',
  title,
  message,
  detail,
  status = 'error',
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-error-message-card',
  ...rest
}: AgentErrorMessageProps) {
  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-error-message-card', className)}
      data-component="AgentErrorMessage"
      data-error-kind={kind}
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon={kind === 'auth_required' ? 'lock' : 'error'} size={14} />}
      status={status}
      title={title}
      trailing={<AgentStatusPill tone={errorKindToTone(kind)}>{kind.replace(/_/g, ' ')}</AgentStatusPill>}
    >
      <div className="agent-elements-error-message-shell" data-testid="agent-elements-error-message-shell">
        <div className="agent-elements-error-message-body" data-testid="agent-elements-error-message-body">
          {message}
        </div>
        {detail ? (
          <div className="agent-elements-error-message-detail" data-testid="agent-elements-error-message-detail">
            {detail}
          </div>
        ) : null}
      </div>
    </AgentToolCard>
  );
}

export interface AgentMetadataChip {
  label: ReactNode;
  value: ReactNode;
}

export interface AgentGenericToolCardProps extends MessageDivProps, DataTestIdAttribute {
  title: string;
  summary?: ReactNode;
  result?: ReactNode;
  metadata?: AgentMetadataChip[];
  status?: AgentToolStatus;
  emptyLabel?: ReactNode;
  debugPayload?: unknown;
}

export function AgentGenericToolCard({
  title,
  summary,
  result,
  metadata = [],
  status = 'completed',
  emptyLabel = 'No structured output.',
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-generic-tool-card',
  ...rest
}: AgentGenericToolCardProps) {
  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-generic-tool-card', className)}
      data-component="AgentGenericToolCard"
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon="view_list" size={14} />}
      status={status}
      title={title}
      trailing={<AgentStatusPill tone={statusToTone(status)}>{status}</AgentStatusPill>}
    >
      <div className="agent-elements-generic-shell" data-testid="agent-elements-generic-shell">
        {summary ? (
          <div className="agent-elements-generic-summary" data-testid="agent-elements-generic-summary">
            {summary}
          </div>
        ) : null}
        {metadata.length > 0 ? (
          <dl className="agent-elements-generic-metadata" data-testid="agent-elements-generic-metadata">
            {metadata.map((chip, index) => (
              <div className="agent-elements-generic-metadata-chip" data-testid="agent-elements-generic-metadata-chip" key={index}>
                <dt>{chip.label}</dt>
                <dd>{chip.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="agent-elements-generic-result" data-testid="agent-elements-generic-result">
          {result ?? emptyLabel}
        </div>
      </div>
    </AgentToolCard>
  );
}

export interface AgentExtensionEventCardProps extends MessageDivProps, DataTestIdAttribute {
  source: ReactNode;
  eventName: string;
  summary?: ReactNode;
  metadata?: AgentMetadataChip[];
  status?: AgentToolStatus;
  debugPayload?: unknown;
}

export function AgentExtensionEventCard({
  source,
  eventName,
  summary,
  metadata = [],
  status = 'running',
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-extension-event-card',
  ...rest
}: AgentExtensionEventCardProps) {
  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-extension-event-card', className)}
      data-component="AgentExtensionEventCard"
      data-extension-event={eventName}
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon="extension" size={14} />}
      status={status}
      subtitle={<span className="agent-elements-extension-source" data-testid="agent-elements-extension-source">{source}</span>}
      title={eventName}
      trailing={<AgentStatusPill tone={statusToTone(status)}>{status}</AgentStatusPill>}
    >
      <div className="agent-elements-extension-shell" data-testid="agent-elements-extension-shell">
        {summary ? (
          <div className="agent-elements-extension-summary" data-testid="agent-elements-extension-summary">
            {summary}
          </div>
        ) : null}
        {metadata.length > 0 ? (
          <dl className="agent-elements-generic-metadata" data-testid="agent-elements-extension-metadata">
            {metadata.map((chip, index) => (
              <div className="agent-elements-generic-metadata-chip" data-testid="agent-elements-generic-metadata-chip" key={index}>
                <dt>{chip.label}</dt>
                <dd>{chip.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </AgentToolCard>
  );
}
