/**
 * TrackerToolWidget - Custom widget for tracker MCP tools.
 *
 * Handles tracker list/get/create/update/link results with a compact Agent
 * Elements shell. Structured payloads remain debug-only.
 */

import React from 'react';
import { AgentStatusPill, AgentToolCard, type AgentStatusTone, type AgentToolStatus } from '../../../AgentElements/AgentElementsPrimitives';
import { MaterialSymbol } from '../../../icons/MaterialSymbol';
import type { CustomToolWidgetProps } from './index';

interface TrackerItem {
  id: string;
  type: string;
  typeTags?: string[];
  title: string;
  status?: string;
  priority?: string;
  tags?: string[];
  owner?: string;
  dueDate?: string;
}

interface StructuredCreated {
  action: 'created';
  item: TrackerItem;
}

interface StructuredUpdated {
  action: 'updated';
  id: string;
  type: string;
  typeTags?: string[];
  title: string;
  changes: Record<string, { from: unknown; to: unknown }>;
}

interface StructuredListed {
  action: 'listed';
  filters: Record<string, string>;
  count: number;
  items: TrackerItem[];
}

interface StructuredRetrieved {
  action: 'retrieved';
  item: TrackerItem;
}

interface StructuredLinked {
  action: 'linked';
  trackerId: string;
  type: string;
  title: string;
  linkedCount: number;
}

interface StructuredLinkedFile {
  action: 'linked_file';
  filePath: string;
  linkedCount: number;
}

type StructuredResult =
  | StructuredCreated
  | StructuredUpdated
  | StructuredListed
  | StructuredRetrieved
  | StructuredLinked
  | StructuredLinkedFile;

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function getResultText(result: unknown): string | null {
  if (!result) return null;
  if (typeof result === 'string') return result;
  if (Array.isArray(result)) {
    for (const block of result) {
      if (
        block &&
        typeof block === 'object' &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string'
      ) {
        return (block as { text: string }).text;
      }
    }
    return null;
  }

  if (typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  if (Array.isArray(record.content)) {
    for (const block of record.content) {
      if (
        block &&
        typeof block === 'object' &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string'
      ) {
        return (block as { text: string }).text;
      }
    }
  }
  if (record.result != null) return getResultText(record.result);
  if (typeof record.output === 'string') return record.output;
  if (typeof record.summary === 'string') return record.summary;
  return null;
}

function extractStructured(tool: { result?: unknown }): { structured: StructuredResult; summary: string } | null {
  if (tool.result && typeof tool.result === 'object' && !Array.isArray(tool.result)) {
    const record = tool.result as Record<string, unknown>;
    if (record.structured && typeof record.summary === 'string') {
      return { structured: record.structured as StructuredResult, summary: record.summary };
    }
  }

  const text = getResultText(tool.result);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { structured?: StructuredResult; summary?: string };
    if (parsed.structured && typeof parsed.summary === 'string') {
      return { structured: parsed.structured, summary: parsed.summary };
    }
  } catch {
    return null;
  }
  return null;
}

function navigateToTrackerItem(itemId: string): void {
  window.dispatchEvent(
    new CustomEvent('nimbalyst:navigate-tracker-item', { detail: { itemId } })
  );
}

function getBaseName(toolName: string): string {
  return toolName.replace(/^mcp__[^_]+__/, '');
}

function getToolLabel(toolName: string): string {
  const base = getBaseName(toolName);
  switch (base) {
    case 'tracker_list':
      return 'Tracker List';
    case 'tracker_get':
      return 'Tracker Get';
    case 'tracker_create':
      return 'Tracker Create';
    case 'tracker_update':
      return 'Tracker Update';
    case 'tracker_link_session':
      return 'Tracker Link';
    case 'tracker_link_file':
      return 'File Link';
    default:
      return 'Tracker';
  }
}

function actionLabel(action: StructuredResult['action'], toolName: string): string {
  switch (action) {
    case 'created':
      return 'Tracker Created';
    case 'updated':
      return 'Tracker Updated';
    case 'listed':
      return 'Tracker List';
    case 'retrieved':
      return 'Tracker Item';
    case 'linked':
      return 'Tracker Linked';
    case 'linked_file':
      return 'File Linked';
    default:
      return getToolLabel(toolName);
  }
}

function actionIcon(action?: StructuredResult['action']): string {
  switch (action) {
    case 'created':
      return 'add_task';
    case 'updated':
      return 'edit_note';
    case 'listed':
      return 'view_list';
    case 'retrieved':
      return 'fact_check';
    case 'linked':
    case 'linked_file':
      return 'link';
    default:
      return 'track_changes';
  }
}

function statusTone(status?: string): AgentStatusTone {
  if (!status) return 'neutral';
  const normalized = status.toLowerCase();
  if (normalized === 'done' || normalized === 'completed' || normalized === 'closed') return 'success';
  if (normalized === 'in-progress' || normalized === 'active' || normalized === 'running') return 'running';
  if (normalized === 'blocked' || normalized === 'triage') return 'warning';
  if (normalized === 'failed' || normalized === 'error') return 'error';
  return 'neutral';
}

function priorityTone(priority?: string): AgentStatusTone {
  if (!priority) return 'neutral';
  const normalized = priority.toLowerCase();
  if (normalized === 'critical') return 'error';
  if (normalized === 'high') return 'warning';
  return 'neutral';
}

function toolStatus(isError: boolean, hasResult: boolean): AgentToolStatus {
  if (isError) return 'error';
  return hasResult ? 'completed' : 'running';
}

function normalizeTagList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'none';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    return value.length === 0 ? 'none' : value.map((entry) => String(entry)).join(', ');
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length === 0 ? 'object' : `${keys.length} field${keys.length === 1 ? '' : 's'}`;
  }
  const stringValue = String(value);
  return stringValue.length > 120 ? `${stringValue.slice(0, 117)}...` : stringValue;
}

function humanizeFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}

const TrackerRow: React.FC<{
  className?: string;
  icon: string;
  label: string;
  testId?: string;
  children: React.ReactNode;
}> = ({ className, icon, label, testId, children }) => (
  <div
    className={classNames(
      'agent-elements-tracker-tool-row grid grid-cols-[1rem_4.75rem_minmax(0,1fr)] items-start gap-[var(--an-spacing-xs)] text-sm text-[var(--an-tool-color)]',
      className
    )}
    data-agent-elements-shell="tracker-tool-row"
    data-testid={testId}
  >
    <span className="agent-elements-tracker-tool-row-icon mt-0.5 text-[var(--an-tool-color-muted)]" aria-hidden="true">
      <MaterialSymbol icon={icon} size={14} />
    </span>
    <span className="agent-elements-tracker-tool-row-label text-xs font-medium text-[var(--an-tool-color-muted)]">
      {label}
    </span>
    <span className="agent-elements-tracker-tool-row-value min-w-0 break-words select-text">
      {children}
    </span>
  </div>
);

const TrackerStatusPill: React.FC<{
  children: React.ReactNode;
  className?: string;
  testId?: string;
  tone?: AgentStatusTone;
}> = ({ children, className, testId, tone = 'neutral' }) => (
  <span className={classNames('agent-elements-tracker-tool-pill', className)} data-testid={testId}>
    <AgentStatusPill tone={tone}>
      {children}
    </AgentStatusPill>
  </span>
);

const TypeBadges: React.FC<{ itemType: string; typeTags?: string[]; testId?: string }> = ({ itemType, typeTags, testId }) => {
  const secondary = (typeTags ?? []).filter((tag) => tag !== itemType);
  return (
    <span className="agent-elements-tracker-tool-type-badges inline-flex min-w-0 flex-wrap gap-[var(--an-spacing-xs)]" data-testid={testId}>
      <TrackerStatusPill className="agent-elements-tracker-tool-type-pill">
        {itemType}
      </TrackerStatusPill>
      {secondary.map((tag) => (
        <TrackerStatusPill className="agent-elements-tracker-tool-type-tag" key={tag}>
          {tag}
        </TrackerStatusPill>
      ))}
    </span>
  );
};

const TagPill: React.FC<{ tag: string; variant?: 'kept' | 'added' | 'removed'; testId?: string }> = ({ tag, variant = 'kept', testId }) => {
  const tone: AgentStatusTone = variant === 'added' ? 'success' : variant === 'removed' ? 'error' : 'neutral';
  const prefix = variant === 'added' ? '+' : variant === 'removed' ? '-' : '';
  return (
    <TrackerStatusPill
      className={classNames(
        'agent-elements-tracker-tool-tag',
        variant === 'removed' && 'line-through'
      )}
      testId={testId}
      tone={tone}
    >
      {prefix ? <span className="agent-elements-tracker-tool-tag-prefix">{prefix}</span> : null}
      <span>{`#${tag}`}</span>
    </TrackerStatusPill>
  );
};

const ClickableTitle: React.FC<{ title: string; itemId: string; testId?: string }> = ({ title, itemId, testId }) => (
  <button
    className="agent-elements-tracker-tool-title-button min-w-0 border-0 bg-transparent p-0 text-left text-sm font-medium text-[var(--an-tool-color)] underline-offset-2 transition-colors hover:text-[var(--an-foreground)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline,var(--an-tool-border-color))]"
    data-testid={testId}
    onClick={() => navigateToTrackerItem(itemId)}
    type="button"
  >
    {title}
  </button>
);

const ChangeArrow: React.FC = () => (
  <span className="agent-elements-tracker-tool-arrow text-xs text-[var(--an-tool-color-muted)]" aria-hidden="true">
    -&gt;
  </span>
);

const ChangeValue: React.FC<{ muted?: boolean; removed?: boolean; children: React.ReactNode }> = ({ muted, removed, children }) => (
  <span
    className={classNames(
      'agent-elements-tracker-tool-change-value text-sm',
      muted ? 'text-[var(--an-tool-color-muted)]' : 'text-[var(--an-tool-color)]',
      removed && 'line-through'
    )}
  >
    {children}
  </span>
);

function renderItemRows(item: TrackerItem) {
  return (
    <>
      <TrackerRow icon="category" label="Type" testId="agent-elements-tracker-tool-type">
        <TypeBadges itemType={item.type} typeTags={item.typeTags} />
      </TrackerRow>
      <TrackerRow icon="title" label="Title" testId="agent-elements-tracker-tool-title">
        <ClickableTitle itemId={item.id} title={item.title} />
      </TrackerRow>
      {(item.status || item.priority) ? (
        <TrackerRow icon="flag" label="State">
          <span className="inline-flex min-w-0 flex-wrap gap-[var(--an-spacing-xs)]">
            {item.status ? (
              <TrackerStatusPill testId="agent-elements-tracker-tool-status" tone={statusTone(item.status)}>
                {item.status}
              </TrackerStatusPill>
            ) : null}
            {item.priority ? (
              <TrackerStatusPill testId="agent-elements-tracker-tool-priority" tone={priorityTone(item.priority)}>
                {item.priority}
              </TrackerStatusPill>
            ) : null}
          </span>
        </TrackerRow>
      ) : null}
      {Array.isArray(item.tags) && item.tags.length > 0 ? (
        <TrackerRow icon="sell" label="Tags">
          <span className="inline-flex min-w-0 flex-wrap gap-[var(--an-spacing-xs)]">
            {item.tags.map((tag, index) => (
              <TagPill key={tag} tag={tag} testId={`agent-elements-tracker-tool-tag-${index}`} />
            ))}
          </span>
        </TrackerRow>
      ) : null}
      {item.owner ? (
        <TrackerRow icon="person" label="Owner">
          {item.owner}
        </TrackerRow>
      ) : null}
    </>
  );
}

function renderStructuredBody(structured: StructuredResult) {
  switch (structured.action) {
    case 'created':
      return renderItemRows(structured.item);
    case 'retrieved':
      return renderItemRows(structured.item);
    case 'updated':
      return <UpdatedBody data={structured} />;
    case 'listed':
      return <ListedBody data={structured} />;
    case 'linked':
      return (
        <TrackerRow icon="link" label="Linked">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-xs)]">
            <TypeBadges itemType={structured.type} />
            <ClickableTitle itemId={structured.trackerId} title={structured.title} />
            <span className="text-xs text-[var(--an-tool-color-muted)]">
              {structured.linkedCount} session{structured.linkedCount === 1 ? '' : 's'}
            </span>
          </span>
        </TrackerRow>
      );
    case 'linked_file':
      return (
        <TrackerRow icon="attach_file" label="File">
          <span className="font-mono text-xs">{structured.filePath}</span>
          <span className="ml-[var(--an-spacing-xs)] text-xs text-[var(--an-tool-color-muted)]">
            {structured.linkedCount} total link{structured.linkedCount === 1 ? '' : 's'}
          </span>
        </TrackerRow>
      );
    default:
      return null;
  }
}

const SPECIAL_CHANGE_KEYS = new Set([
  'status',
  'priority',
  'title',
  'owner',
  'archived',
  'progress',
  'tags',
  'description',
]);

const UpdatedBody: React.FC<{ data: StructuredUpdated }> = ({ data }) => {
  const changedKeys = Object.keys(data.changes);
  const tagChange = data.changes.tags;
  const tagDiff = tagChange ? getTagDiff(tagChange.from, tagChange.to) : null;
  const otherChangedKeys = changedKeys.filter((key) => !SPECIAL_CHANGE_KEYS.has(key));

  if (changedKeys.length === 0) {
    return (
      <span className="agent-elements-tracker-tool-empty text-sm italic text-[var(--an-tool-color-muted)]">
        No changes recorded
      </span>
    );
  }

  return (
    <>
      <TrackerRow icon="title" label="Title" testId="agent-elements-tracker-tool-title">
        <ClickableTitle itemId={data.id} title={data.title} />
      </TrackerRow>
      {data.changes.status ? (
        <TrackerRow icon="flag" label="Status" testId="agent-elements-tracker-tool-status">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-xs)]">
            <TrackerStatusPill tone={statusTone(String(data.changes.status.from || 'none'))}>
              {String(data.changes.status.from || 'none')}
            </TrackerStatusPill>
            <ChangeArrow />
            <TrackerStatusPill tone={statusTone(String(data.changes.status.to))}>
              {String(data.changes.status.to)}
            </TrackerStatusPill>
          </span>
        </TrackerRow>
      ) : null}
      {data.changes.priority ? (
        <TrackerRow icon="priority_high" label="Priority" testId="agent-elements-tracker-tool-priority">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-xs)]">
            <TrackerStatusPill tone={priorityTone(String(data.changes.priority.from || 'none'))}>
              {String(data.changes.priority.from || 'none')}
            </TrackerStatusPill>
            <ChangeArrow />
            <TrackerStatusPill tone={priorityTone(String(data.changes.priority.to))}>
              {String(data.changes.priority.to)}
            </TrackerStatusPill>
          </span>
        </TrackerRow>
      ) : null}
      {data.changes.title ? (
        <TrackerRow icon="edit" label="Name">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-xs)]">
            <ChangeValue muted removed>{formatChangeValue(data.changes.title.from)}</ChangeValue>
            <ChangeArrow />
            <ChangeValue>{formatChangeValue(data.changes.title.to)}</ChangeValue>
          </span>
        </TrackerRow>
      ) : null}
      {data.changes.owner ? (
        <TrackerRow icon="person" label="Owner">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-xs)]">
            <ChangeValue muted>{formatChangeValue(data.changes.owner.from)}</ChangeValue>
            <ChangeArrow />
            <ChangeValue>{formatChangeValue(data.changes.owner.to)}</ChangeValue>
          </span>
        </TrackerRow>
      ) : null}
      {data.changes.archived !== undefined ? (
        <TrackerRow icon="archive" label="Archive">
          {data.changes.archived.to ? 'archived' : 'unarchived'}
        </TrackerRow>
      ) : null}
      {data.changes.progress !== undefined ? (
        <TrackerRow icon="percent" label="Progress">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-xs)]">
            <ChangeValue muted>{formatChangeValue(data.changes.progress.from)}%</ChangeValue>
            <ChangeArrow />
            <ChangeValue>{formatChangeValue(data.changes.progress.to)}%</ChangeValue>
          </span>
        </TrackerRow>
      ) : null}
      {tagDiff && (tagDiff.kept.length > 0 || tagDiff.added.length > 0 || tagDiff.removed.length > 0) ? (
        <TrackerRow icon="sell" label="Tags">
          <span className="inline-flex min-w-0 flex-wrap gap-[var(--an-spacing-xs)]">
            {tagDiff.kept.map((tag) => <TagPill key={`kept-${tag}`} tag={tag} />)}
            {tagDiff.added.map((tag) => <TagPill key={`added-${tag}`} tag={tag} variant="added" />)}
            {tagDiff.removed.map((tag) => <TagPill key={`removed-${tag}`} tag={tag} variant="removed" />)}
          </span>
        </TrackerRow>
      ) : null}
      {data.changes.description ? (
        <TrackerRow icon="notes" label="Details">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-xs)]">
            <ChangeValue muted>{formatDescriptionLength(data.changes.description.from)}</ChangeValue>
            <ChangeArrow />
            <ChangeValue>{formatDescriptionLength(data.changes.description.to)}</ChangeValue>
          </span>
        </TrackerRow>
      ) : null}
      {otherChangedKeys.map((key) => (
        <TrackerRow icon="sync_alt" key={key} label={humanizeFieldName(key)}>
          <span className="inline-flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-xs)]">
            <ChangeValue muted removed>{formatChangeValue(data.changes[key].from)}</ChangeValue>
            <ChangeArrow />
            <ChangeValue>{formatChangeValue(data.changes[key].to)}</ChangeValue>
          </span>
        </TrackerRow>
      ))}
    </>
  );
};

function getTagDiff(fromValue: unknown, toValue: unknown) {
  const fromTags = normalizeTagList(fromValue);
  const toTags = normalizeTagList(toValue);
  const fromSet = new Set(fromTags);
  const toSet = new Set(toTags);
  return {
    kept: toTags.filter((tag) => fromSet.has(tag)),
    added: toTags.filter((tag) => !fromSet.has(tag)),
    removed: fromTags.filter((tag) => !toSet.has(tag)),
  };
}

function formatDescriptionLength(value: unknown): string {
  return `${typeof value === 'string' ? value.length : 0} chars`;
}

const ListedBody: React.FC<{ data: StructuredListed }> = ({ data }) => {
  if (data.items.length === 0) {
    return (
      <span
        className="agent-elements-tracker-tool-empty text-sm italic text-[var(--an-tool-color-muted)]"
        data-testid="agent-elements-tracker-tool-empty"
      >
        No items found
      </span>
    );
  }

  return (
    <div className="agent-elements-tracker-tool-list flex flex-col gap-[var(--an-spacing-xs)]">
      {data.items.map((item, index) => (
        <div
          className="agent-elements-tracker-tool-list-row flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-xs)] border-t border-[var(--an-tool-border-color)] pt-[var(--an-spacing-xs)] first:border-t-0 first:pt-0"
          data-testid={`agent-elements-tracker-tool-item-${index}`}
          key={item.id}
        >
          <TypeBadges itemType={item.type} typeTags={item.typeTags} />
          <ClickableTitle itemId={item.id} title={item.title} />
          {item.status ? <TrackerStatusPill tone={statusTone(item.status)}>{item.status}</TrackerStatusPill> : null}
          {item.priority ? <TrackerStatusPill tone={priorityTone(item.priority)}>{item.priority}</TrackerStatusPill> : null}
        </div>
      ))}
    </div>
  );
};

function structuredSubtitle(structured: StructuredResult): string | undefined {
  switch (structured.action) {
    case 'created':
    case 'retrieved':
      return structured.item.id;
    case 'updated':
      return structured.id;
    case 'listed':
      return `${structured.count} item${structured.count === 1 ? '' : 's'}`;
    case 'linked':
      return `${structured.linkedCount} session${structured.linkedCount === 1 ? '' : 's'}`;
    case 'linked_file':
      return `${structured.linkedCount} link${structured.linkedCount === 1 ? '' : 's'}`;
    default:
      return undefined;
  }
}

function structuredTrailing(structured: StructuredResult) {
  switch (structured.action) {
    case 'created':
    case 'retrieved':
      return <TypeBadges itemType={structured.item.type} typeTags={structured.item.typeTags} />;
    case 'updated':
      return <TypeBadges itemType={structured.type} typeTags={structured.typeTags} />;
    case 'listed':
      return (
        <TrackerStatusPill testId="agent-elements-tracker-tool-count">
          {structured.count} item{structured.count === 1 ? '' : 's'}
        </TrackerStatusPill>
      );
    case 'linked':
      return <TypeBadges itemType={structured.type} />;
    case 'linked_file':
      return <TrackerStatusPill>file</TrackerStatusPill>;
    default:
      return null;
  }
}

function fallbackBody(resultText: string | null, args: Record<string, unknown>) {
  if (!resultText) {
    return (
      <span className="agent-elements-tracker-tool-pending text-sm text-[var(--an-tool-color-muted)]">
        Waiting for tracker result...
      </span>
    );
  }

  const trimmed = resultText.trim();
  const displayText = trimmed.startsWith('{') || trimmed.startsWith('[')
    ? 'Structured tracker result is available in debug details.'
    : resultText;

  return (
    <div className="agent-elements-tracker-tool-fallback flex flex-col gap-[var(--an-spacing-xs)]">
      {args.title ? (
        <TrackerRow icon="title" label="Title">
          {String(args.title)}
        </TrackerRow>
      ) : null}
      <div className="agent-elements-tracker-tool-fallback-text max-h-52 overflow-y-auto whitespace-pre-wrap text-sm text-[var(--an-tool-color)] select-text">
        {displayText}
      </div>
    </div>
  );
}

export const TrackerToolWidget: React.FC<CustomToolWidgetProps> = ({ message }) => {
  const tool = message.toolCall;
  if (!tool) return null;

  const args = (tool.arguments || {}) as Record<string, unknown>;
  const resultRecord = tool.result && typeof tool.result === 'object' && !Array.isArray(tool.result)
    ? tool.result as Record<string, unknown>
    : null;
  const isError = Boolean(
    (message as { isError?: boolean }).isError ||
    tool.isError === true ||
    tool.status === 'error' ||
    resultRecord?.isError === true
  );
  const parsed = extractStructured(tool);
  const resultText = getResultText(tool.result);
  const hasResult = tool.result !== undefined && tool.result !== null && tool.result !== '';
  const status = toolStatus(isError, hasResult);
  const title = parsed && !isError ? actionLabel(parsed.structured.action, tool.toolName) : getToolLabel(tool.toolName);

  return (
    <AgentToolCard
      className="agent-elements-tracker-tool-card"
      data-agent-elements-shell="tracker-tool-card"
      data-component="RichTranscriptAgentElementsTrackerTool"
      data-testid="agent-elements-tracker-tool-card"
      debugPayload={{
        toolName: tool.toolName,
        arguments: args,
        result: tool.result,
      }}
      icon={<MaterialSymbol icon={parsed && !isError ? actionIcon(parsed.structured.action) : 'track_changes'} size={14} />}
      status={status}
      subtitle={parsed && !isError ? structuredSubtitle(parsed.structured) : undefined}
      title={title}
      trailing={parsed && !isError ? structuredTrailing(parsed.structured) : args.type ? (
        <TypeBadges itemType={String(args.type)} />
      ) : null}
    >
      <div
        className="agent-elements-tracker-tool-body flex flex-col gap-[var(--an-spacing-sm)]"
        data-agent-elements-shell="tracker-tool-body"
        data-testid="agent-elements-tracker-tool-body"
      >
        {isError ? (
          <TrackerRow className="text-[var(--an-diff-removed-text)]" icon="error" label="Error">
            {resultText ?? 'Tracker tool failed'}
          </TrackerRow>
        ) : parsed ? (
          renderStructuredBody(parsed.structured)
        ) : (
          fallbackBody(resultText, args)
        )}
      </div>
    </AgentToolCard>
  );
};

TrackerToolWidget.displayName = 'TrackerToolWidget';
