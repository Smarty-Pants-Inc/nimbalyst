import type { HTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';
import { MaterialSymbol } from '../icons/MaterialSymbol';
import {
  AgentStatusPill,
  AgentToolCard,
  agentToolStatusToTone,
  type AgentElementsCardAttributes,
  type AgentToolStatus,
} from './AgentElementsPrimitives';
import './AgentElementsTodoPlan.css';

export type AgentTodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type AgentPlanStepStatus = AgentTodoStatus | 'blocked';
export type AgentPlanStatus =
  | 'draft'
  | 'streaming'
  | 'awaiting_approval'
  | 'approved'
  | 'completed'
  | 'rejected';

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

interface DataTestIdAttribute {
  'data-testid'?: string;
}

export interface AgentTodoItem {
  id?: string;
  content: ReactNode;
  status: AgentTodoStatus;
  activeForm?: ReactNode;
}

export interface AgentTodoListProps extends HTMLAttributes<HTMLDivElement>, DataTestIdAttribute, AgentElementsCardAttributes {
  items: AgentTodoItem[];
  isStreaming?: boolean;
  emptyLabel?: ReactNode;
}

function getTodoIcon(status: AgentTodoStatus): string | null {
  if (status === 'completed') return 'check';
  if (status === 'in_progress') return 'arrow_forward';
  if (status === 'cancelled') return 'close';
  return null;
}

export function AgentTodoList({
  items,
  isStreaming = false,
  emptyLabel = 'No todos yet.',
  className,
  'data-agent-elements-card-padding': dataCardPadding = 'content-owned',
  'data-agent-elements-card-width': dataCardWidth = 'bridge-fill',
  'data-testid': dataTestId = 'agent-elements-todo-list',
  ...rest
}: AgentTodoListProps) {
  const visibleItems = items.length > 0;

  return (
    <div
      {...rest}
      className={classNames('agent-elements-todo-list', className)}
      data-agent-elements-card-padding={dataCardPadding}
      data-agent-elements-card-width={dataCardWidth}
      data-component="AgentTodoList"
      data-testid={dataTestId}
      data-todo-streaming={isStreaming ? 'true' : 'false'}
    >
      {visibleItems ? (
        items.map((todo, index) => (
          <div
            className="agent-elements-todo-item"
            data-todo-status={todo.status}
            data-testid="agent-elements-todo-item"
            key={todo.id ?? index}
          >
            <span className="agent-elements-todo-status-icon" aria-hidden="true">
              {getTodoIcon(todo.status) ? (
                <MaterialSymbol icon={getTodoIcon(todo.status)!} size={10} />
              ) : null}
            </span>
            <span className="agent-elements-todo-content">
              {todo.activeForm && todo.status === 'in_progress' ? todo.activeForm : todo.content}
            </span>
          </div>
        ))
      ) : (
        <div className="agent-elements-todo-empty" data-testid="agent-elements-todo-empty">
          {isStreaming ? 'Updating todos...' : emptyLabel}
        </div>
      )}
    </div>
  );
}

export interface AgentTodoCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'>, DataTestIdAttribute, AgentElementsCardAttributes {
  items: AgentTodoItem[];
  isStreaming?: boolean;
  emptyLabel?: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  status?: AgentToolStatus;
  debugPayload?: unknown;
}

function getTodoCardStatus(status: AgentToolStatus | undefined, isStreaming: boolean): AgentToolStatus {
  if (status) return status;
  return isStreaming ? 'running' : 'completed';
}

function getTodoCardTrailingLabel(status: AgentToolStatus, countLabel: string): string {
  if (status === 'running') return 'Updating';
  if (status === 'error') return 'Needs attention';
  if (status === 'interrupted') return 'Interrupted';
  return countLabel;
}

export function AgentTodoCard({
  items,
  isStreaming = false,
  emptyLabel,
  title = 'Todo list',
  subtitle,
  status,
  debugPayload,
  className,
  'data-agent-elements-card-padding': dataCardPadding = 'symmetric-inline',
  'data-agent-elements-card-width': dataCardWidth = 'bridge-fill',
  'data-testid': dataTestId = 'agent-elements-todo-card',
  ...rest
}: AgentTodoCardProps) {
  const cardStatus = getTodoCardStatus(status, isStreaming);
  const visibleCount = items.length;
  const countLabel = visibleCount === 1 ? '1 item' : `${visibleCount} items`;

  return (
    <AgentToolCard
      {...rest}
      className={classNames('agent-elements-todo-card', className)}
      data-agent-elements-card-padding={dataCardPadding}
      data-agent-elements-card-width={dataCardWidth}
      data-testid={dataTestId}
      debugPayload={debugPayload}
      icon={<MaterialSymbol icon={cardStatus === 'running' ? 'progress_activity' : 'checklist'} size={14} />}
      status={cardStatus}
      subtitle={subtitle ?? countLabel}
      title={title}
      trailing={<AgentStatusPill tone={agentToolStatusToTone(cardStatus)}>{getTodoCardTrailingLabel(cardStatus, countLabel)}</AgentStatusPill>}
    >
      <AgentTodoList
        className="agent-elements-todo-card-list"
        data-agent-elements-card-padding="content-owned"
        data-agent-elements-card-width="card-content"
        emptyLabel={emptyLabel}
        isStreaming={isStreaming}
        items={items}
      />
    </AgentToolCard>
  );
}

export interface AgentPlanStep {
  id?: string;
  label: ReactNode;
  status: AgentPlanStepStatus;
}

export interface AgentPlanCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'>, DataTestIdAttribute, AgentElementsCardAttributes {
  title: ReactNode;
  summary?: ReactNode;
  steps?: AgentPlanStep[];
  fileName?: string;
  status?: AgentPlanStatus;
  defaultExpanded?: boolean;
  approveLabel?: string;
  approved?: boolean;
  onApprove?: () => void;
}

function getPlanStatusLabel(status: AgentPlanStatus): string {
  switch (status) {
    case 'streaming':
      return 'Planning';
    case 'awaiting_approval':
      return 'Review';
    case 'approved':
      return 'Approved';
    case 'completed':
      return 'Complete';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Draft';
  }
}

function normalizePlanStepStatus(status: AgentPlanStepStatus): AgentTodoStatus {
  return status === 'blocked' ? 'cancelled' : status;
}

export function AgentPlanCard({
  title,
  summary,
  steps = [],
  fileName = 'plan-working.md',
  status = 'draft',
  defaultExpanded = false,
  approveLabel = 'Approve',
  approved = false,
  onApprove,
  className,
  'data-agent-elements-card-padding': dataCardPadding = 'symmetric-inline',
  'data-agent-elements-card-width': dataCardWidth = 'bridge-fill',
  'data-testid': dataTestId = 'agent-elements-plan-card',
  ...rest
}: AgentPlanCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isLocallyApproved, setIsLocallyApproved] = useState(false);
  const approvalComplete = approved || isLocallyApproved || status === 'approved';
  const canApprove = status === 'awaiting_approval' && !approvalComplete;

  const handleApprove = () => {
    if (!canApprove) return;
    setIsLocallyApproved(true);
    onApprove?.();
  };

  return (
    <section
      {...rest}
      className={classNames('agent-elements-plan-card', className)}
      data-agent-elements-card-padding={dataCardPadding}
      data-agent-elements-card-width={dataCardWidth}
      data-component="AgentPlanCard"
      data-plan-status={status}
      data-testid={dataTestId}
    >
      <header className="agent-elements-plan-header">
        <span className="agent-elements-plan-file">
          <MaterialSymbol icon={status === 'streaming' ? 'progress_activity' : 'description'} size={14} />
          <span>{fileName}</span>
        </span>
        <span className="agent-elements-plan-status">{getPlanStatusLabel(status)}</span>
        <button
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse plan' : 'Expand plan'}
          className="agent-elements-plan-toggle"
          data-testid="agent-elements-plan-toggle"
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          <MaterialSymbol icon={isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={16} />
        </button>
      </header>
      <div className="agent-elements-plan-body">
        <div className="agent-elements-plan-title">{title}</div>
        {summary ? (
          <div
            className={classNames(
              'agent-elements-plan-summary',
              !isExpanded && 'agent-elements-plan-summary-collapsed'
            )}
            data-testid="agent-elements-plan-summary"
          >
            {summary}
          </div>
        ) : null}
        {steps.length > 0 ? (
          <AgentTodoList
            className="agent-elements-plan-steps"
            items={steps.map((step) => ({
              ...step,
              content: step.label,
              status: normalizePlanStepStatus(step.status),
            }))}
          />
        ) : null}
      </div>
      <footer className="agent-elements-plan-footer">
        <button
          className="agent-elements-plan-secondary-action"
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          {isExpanded ? 'Hide detailed plan' : 'Read detailed plan'}
        </button>
        {canApprove ? (
          <button
            className="agent-elements-plan-approve"
            data-testid="agent-elements-plan-approve"
            onClick={handleApprove}
            type="button"
          >
            {approveLabel}
          </button>
        ) : null}
      </footer>
    </section>
  );
}
