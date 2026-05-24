import type { HTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';
import { MaterialSymbol } from '../icons/MaterialSymbol';
import { AgentStatusPill, AgentToolCard, type AgentToolStatus } from './AgentElementsPrimitives';
import './AgentElementsToolRenderers.css';

type ToolCardDivProps = Omit<HTMLAttributes<HTMLDivElement>, 'results' | 'title'>;

interface DataTestIdAttribute {
  'data-testid'?: string;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function formatCount(value: number, label: string): string {
  return `${value} ${label}${value === 1 ? '' : 's'}`;
}

function statusToTone(status: AgentToolStatus) {
  if (status === 'running') return 'running';
  if (status === 'completed') return 'success';
  if (status === 'error') return 'error';
  if (status === 'interrupted') return 'warning';
  return 'neutral';
}

export interface AgentCommandToolCardProps extends ToolCardDivProps, DataTestIdAttribute {
  command: string;
  output?: ReactNode;
  cwd?: string;
  exitCode?: number;
  status?: AgentToolStatus;
  deniedReason?: ReactNode;
  debugPayload?: unknown;
}

export function AgentCommandToolCard({
  command,
  output,
  cwd,
  exitCode,
  status = 'idle',
  deniedReason,
  debugPayload,
  className,
  'data-testid': dataTestId = 'agent-elements-command-tool-card',
  ...rest
}: AgentCommandToolCardProps) {
  const completeLabel = status === 'running' ? 'Running command' : 'Ran command';
  const exitLabel = exitCode === undefined ? null : `exit ${exitCode}`;

  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-command-tool-card', className)}
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon={status === 'running' ? 'progress_activity' : 'terminal'} size={14} />}
      status={status}
      subtitle={cwd}
      title={completeLabel}
      trailing={exitLabel ? <AgentStatusPill tone={exitCode === 0 ? 'success' : 'error'}>{exitLabel}</AgentStatusPill> : null}
    >
      <div className="agent-elements-command-terminal" data-testid="agent-elements-command-terminal">
        <div className="agent-elements-command-line">
          <span className="agent-elements-command-prompt" aria-hidden="true">$</span>
          <span className="agent-elements-command-text">{command}</span>
        </div>
        {output ? <div className="agent-elements-command-output">{output}</div> : null}
        {deniedReason ? <div className="agent-elements-command-denied">{deniedReason}</div> : null}
      </div>
    </AgentToolCard>
  );
}

export type AgentDiffLineType = 'add' | 'remove' | 'context';

export interface AgentDiffLine {
  type: AgentDiffLineType;
  content: string;
  lineNumber?: number;
}

export type AgentEditStatus = 'pending_approval' | 'streaming' | 'completed' | 'no_op' | 'error';

export interface AgentEditToolCardProps extends ToolCardDivProps, DataTestIdAttribute {
  filePath: string;
  status?: AgentEditStatus;
  operation?: 'create' | 'edit' | 'delete' | 'read';
  diffLines?: AgentDiffLine[];
  summary?: ReactNode;
  addedLines?: number;
  removedLines?: number;
  debugPayload?: unknown;
  defaultExpanded?: boolean;
  approveLabel?: string;
  rejectLabel?: string;
  onApprove?: () => void;
  onReject?: () => void;
}

function getEditToolStatus(status: AgentEditStatus): AgentToolStatus {
  if (status === 'streaming') return 'running';
  if (status === 'error') return 'error';
  if (status === 'pending_approval') return 'interrupted';
  return 'completed';
}

function getEditLabel(status: AgentEditStatus, operation: AgentEditToolCardProps['operation']): string {
  if (status === 'pending_approval') return 'Edit requires approval';
  if (status === 'streaming') return 'Editing file';
  if (status === 'no_op') return 'No file changes';
  if (status === 'error') return 'Edit failed';
  if (operation === 'create') return 'Created file';
  if (operation === 'delete') return 'Deleted file';
  if (operation === 'read') return 'Read file';
  return 'Edited file';
}

export function AgentEditToolCard({
  filePath,
  status = 'completed',
  operation = 'edit',
  diffLines = [],
  summary,
  addedLines,
  removedLines,
  debugPayload,
  defaultExpanded = true,
  approveLabel = 'Approve',
  rejectLabel = 'Skip',
  onApprove,
  onReject,
  className,
  'data-testid': dataTestId = 'agent-elements-edit-tool-card',
  ...rest
}: AgentEditToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const canDecide = status === 'pending_approval' && decision === null;
  const hasDiff = diffLines.length > 0;
  const addCount = addedLines ?? diffLines.filter((line) => line.type === 'add').length;
  const removeCount = removedLines ?? diffLines.filter((line) => line.type === 'remove').length;

  const handleApprove = () => {
    if (!canDecide) return;
    setDecision('approved');
    onApprove?.();
  };

  const handleReject = () => {
    if (!canDecide) return;
    setDecision('rejected');
    onReject?.();
  };

  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-edit-tool-card', className)}
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon="description" size={14} />}
      status={getEditToolStatus(status)}
      subtitle={filePath}
      title={getEditLabel(status, operation)}
      trailing={
        hasDiff ? (
          <span className="agent-elements-edit-stats" data-testid="agent-elements-edit-stats">
            <span data-diff-tone="add">+{addCount}</span>
            <span data-diff-tone="remove">-{removeCount}</span>
          </span>
        ) : (
          <AgentStatusPill tone={statusToTone(getEditToolStatus(status))}>{status.replace('_', ' ')}</AgentStatusPill>
        )
      }
    >
      <div className="agent-elements-edit-panel" data-testid="agent-elements-edit-panel">
        <button
          aria-expanded={isExpanded}
          className="agent-elements-edit-header-button"
          data-testid="agent-elements-edit-toggle"
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          <MaterialSymbol icon={isExpanded ? 'keyboard_arrow_down' : 'chevron_right'} size={16} />
          <span>{filePath}</span>
        </button>
        {isExpanded ? (
          <div className="agent-elements-edit-body">
            {hasDiff ? (
              <pre className="agent-elements-diff" data-testid="agent-elements-diff">
                {diffLines.map((line, index) => (
                  <span
                    className="agent-elements-diff-line"
                    data-diff-line={line.type}
                    key={`${line.type}-${line.lineNumber ?? index}-${line.content}`}
                  >
                    <span className="agent-elements-diff-marker" aria-hidden="true">
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                    </span>
                    <span className="agent-elements-diff-content">{line.content}</span>
                  </span>
                ))}
              </pre>
            ) : (
              <div className="agent-elements-edit-summary">{summary ?? 'No diff preview available.'}</div>
            )}
          </div>
        ) : null}
        {status === 'pending_approval' ? (
          <div className="agent-elements-edit-approval" data-testid="agent-elements-edit-approval">
            <span>{decision === null ? 'Waiting for approval' : decision === 'approved' ? 'Approved' : 'Skipped'}</span>
            <div className="agent-elements-edit-approval-actions">
              <button disabled={!canDecide} onClick={handleReject} type="button">
                {rejectLabel}
              </button>
              <button disabled={!canDecide} onClick={handleApprove} type="button">
                {approveLabel}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AgentToolCard>
  );
}

export interface AgentSearchResult {
  title: string;
  path?: string;
  line?: number;
  excerpt?: ReactNode;
  metadata?: ReactNode;
}

export interface AgentSearchToolCardProps extends ToolCardDivProps, DataTestIdAttribute {
  query: string;
  source?: 'code' | 'files' | 'web' | 'mcp';
  status?: AgentToolStatus;
  results?: AgentSearchResult[];
  summary?: ReactNode;
  debugPayload?: unknown;
  defaultExpanded?: boolean;
}

export function AgentSearchToolCard({
  query,
  source = 'code',
  status = 'completed',
  results = [],
  summary,
  debugPayload,
  defaultExpanded = true,
  className,
  'data-testid': dataTestId = 'agent-elements-search-tool-card',
  ...rest
}: AgentSearchToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const resultCount = results.length;
  const title = status === 'running' ? 'Searching' : resultCount > 0 ? `Found ${formatCount(resultCount, 'result')}` : 'No matches';

  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-search-tool-card', className)}
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon={status === 'running' ? 'progress_activity' : 'search'} size={14} />}
      status={status}
      subtitle={source}
      title={title}
    >
      <div className="agent-elements-search-panel" data-testid="agent-elements-search-panel">
        <button
          aria-expanded={isExpanded}
          className="agent-elements-search-header"
          data-testid="agent-elements-search-toggle"
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          <span>Searched for</span>
          <strong>{query}</strong>
          <MaterialSymbol icon={isExpanded ? 'keyboard_arrow_down' : 'chevron_right'} size={16} />
        </button>
        {isExpanded ? (
          <div className="agent-elements-search-body">
            {resultCount > 0 ? (
              <div className="agent-elements-search-results" data-testid="agent-elements-search-results">
                {results.map((result, index) => (
                  <div className="agent-elements-search-result" data-testid="agent-elements-search-result" key={`${result.path ?? result.title}-${index}`}>
                    <MaterialSymbol icon="description" size={14} />
                    <div className="agent-elements-search-result-main">
                      <span className="agent-elements-search-result-title">{result.title}</span>
                      {result.path ? (
                        <span className="agent-elements-search-result-path">
                          {result.path}
                          {result.line ? `:${result.line}` : ''}
                        </span>
                      ) : null}
                      {result.excerpt ? <span className="agent-elements-search-result-excerpt">{result.excerpt}</span> : null}
                    </div>
                    {result.metadata ? <span className="agent-elements-search-result-meta">{result.metadata}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="agent-elements-search-empty" data-testid="agent-elements-search-empty">
                {summary ?? (status === 'running' ? 'Searching...' : 'No matching files found.')}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </AgentToolCard>
  );
}
