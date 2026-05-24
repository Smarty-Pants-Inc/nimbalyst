/**
 * PlanListItem - Individual plan item in the sidebar plans list
 */

import React from 'react';

export interface PlanData {
  id: string;
  title: string;
  status: string;
  owner: string;
  priority: string;
  progress: number;
  path: string;
  lastUpdated: Date;
  tags?: string[];
  planType?: string;
}

interface PlanListItemProps {
  plan: PlanData;
  isActive?: boolean;
  onClick: (plan: PlanData) => void;
}

function getStatusTone(status: string): string {
  const statusTones: Record<string, string> = {
    'completed': 'success',
    'in-progress': 'warning',
    'in-development': 'warning',
    'active': 'success',
    'cancelled': 'error',
    'blocked': 'error',
    'draft': 'muted',
    'ready-for-development': 'info',
    'in-review': 'info',
    'rejected': 'error',
  };
  return statusTones[status.toLowerCase()] || 'muted';
}

function getPriorityTone(priority: string): string {
  const priorityTones: Record<string, string> = {
    'critical': 'error',
    'high': 'error',
    'medium': 'warning',
    'low': 'muted',
  };
  return priorityTones[priority.toLowerCase()] || 'muted';
}

function getPlanTypeIcon(planType?: string): string {
  const icons: Record<string, string> = {
    'feature': 'add_circle',
    'bug-fix': 'bug_report',
    'refactor': 'construction',
    'system-design': 'architecture',
    'research': 'science',
  };
  return icons[planType?.toLowerCase() || ''] || 'description';
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return 'now';
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PlanListItem({ plan, isActive, onClick }: PlanListItemProps): JSX.Element {
  const statusTone = getStatusTone(plan.status);
  const priorityTone = getPriorityTone(plan.priority);
  const planTypeIcon = getPlanTypeIcon(plan.planType);
  const safeProgress = Math.max(0, Math.min(100, plan.progress));

  return (
    <button
      type="button"
      className={`plan-list-item agent-elements-plan-list-item w-full border-b border-[var(--an-border-color)] bg-transparent px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-left transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] ${isActive ? 'active bg-[var(--an-background-tertiary)] shadow-[inset_0_0_0_1px_var(--an-border-color)]' : ''}`}
      data-component="PlanListItem"
      data-agent-elements-shell="plan-list-item"
      data-plan-status={plan.status}
      data-plan-priority={plan.priority}
      data-plan-type={plan.planType || 'plan'}
      onClick={() => onClick(plan)}
    >
      <div className="plan-list-item-header agent-elements-plan-list-item-header mb-[var(--an-spacing-xs)] flex items-start gap-[var(--an-spacing-xs)]">
        <span
          className="plan-priority-indicator agent-elements-plan-priority-indicator min-w-4 shrink-0 text-[11px] font-semibold leading-5 text-[var(--an-foreground-subtle)]"
          title={`Priority: ${plan.priority}`}
          data-agent-elements-shell="plan-priority"
          data-plan-priority={plan.priority}
          data-priority-tone={priorityTone}
        >
          {plan.priority === 'critical' && '!!!'}
          {plan.priority === 'high' && '!!'}
          {plan.priority === 'medium' && '!'}
        </span>
        <span
          className="material-symbols-outlined plan-type-icon agent-elements-plan-type-icon mt-px shrink-0 text-base leading-5 text-[var(--an-foreground-subtle)]"
          title={plan.planType || 'plan'}
          data-agent-elements-shell="plan-type-icon"
        >
          {planTypeIcon}
        </span>
        <div className="plan-list-item-title agent-elements-plan-title line-clamp-2 flex-1 overflow-hidden text-ellipsis text-[13px] font-medium leading-snug text-[var(--an-foreground)]">
          {plan.title}
        </div>
      </div>

      {plan.progress > 0 && (
        <div
          className="plan-progress-bar agent-elements-plan-progress mb-[var(--an-spacing-xs)] h-1 overflow-hidden rounded-[var(--an-input-border-radius)] bg-[var(--an-background-tertiary)]"
          data-testid="agent-elements-plan-progress"
          role="progressbar"
          aria-label={`${plan.title} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safeProgress}
        >
          <div
            className="plan-progress-fill h-full bg-[var(--an-primary-color)] transition-[width] duration-200 ease-out"
            style={{ width: `${safeProgress}%` }}
          />
        </div>
      )}

      <div className="plan-list-item-footer agent-elements-plan-footer flex items-center justify-between gap-[var(--an-spacing-sm)]">
        <span className="plan-updated-time agent-elements-plan-updated-time text-[11px] text-[var(--an-foreground-subtle)]">
          {formatDate(plan.lastUpdated)}
        </span>
        <span
          className="plan-status-badge agent-elements-plan-status-badge whitespace-nowrap rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-xs)] py-0.5 text-[10px] font-medium capitalize text-[var(--an-foreground-muted)]"
          data-testid="agent-elements-plan-status-badge"
          data-agent-elements-shell="plan-status-badge"
          data-plan-status={plan.status}
          data-status-tone={statusTone}
        >
          {plan.status.replace('-', ' ')}
        </span>
      </div>
    </button>
  );
}
