/**
 * PlanFilters - Search and filter controls for plans panel
 */

import React from 'react';

interface PlanFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  priorityFilter: string;
  onPriorityChange: (priority: string) => void;
  hideCompleted: boolean;
  onHideCompletedChange: (hide: boolean) => void;
}

export function PlanFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  hideCompleted,
  onHideCompletedChange
}: PlanFiltersProps): JSX.Element {
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'ready-for-development', label: 'Ready' },
    { value: 'in-development', label: 'In Dev' },
    { value: 'in-review', label: 'Review' },
    { value: 'completed', label: 'Done' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'rejected', label: 'Rejected' },
  ];

  const priorityOptions = [
    { value: 'all', label: 'All Priority' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  return (
    <div
      className="plan-filters agent-elements-plan-filters border-b border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-lg)]"
      data-component="PlanFilters"
      data-agent-elements-shell="plan-filters"
      data-testid="agent-elements-plan-filters"
    >
      <div className="plan-search-container agent-elements-plan-search relative mb-[var(--an-spacing-sm)]">
        <span className="plan-search-icon material-symbols-outlined pointer-events-none absolute left-[var(--an-spacing-sm)] top-1/2 -translate-y-1/2 text-lg text-[var(--an-foreground-subtle)]">
          search
        </span>
        <input
          type="text"
          className="plan-search-input agent-elements-plan-search-input w-full rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] py-[var(--an-spacing-sm)] pl-9 pr-8 text-[13px] text-[var(--an-foreground)] outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-[var(--an-foreground-subtle)] focus:border-[var(--an-primary-color)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
          placeholder="Search plans..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchTerm && (
          <button
            type="button"
            className="plan-search-clear agent-elements-plan-search-clear absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-1 text-[var(--an-foreground-subtle)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] [&_.material-symbols-outlined]:text-base"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      <div className="plan-filter-controls agent-elements-plan-filter-controls mb-[var(--an-spacing-sm)] flex gap-[var(--an-spacing-sm)]">
        <select
          aria-label="Plan status"
          className="plan-filter-select agent-elements-plan-filter-select flex-1 cursor-pointer rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-sm)] py-1.5 text-xs text-[var(--an-foreground)] outline-none transition-[border-color,box-shadow] duration-150 ease-out hover:border-[var(--an-primary-color)] focus:border-[var(--an-primary-color)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Plan priority"
          className="plan-filter-select agent-elements-plan-filter-select flex-1 cursor-pointer rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-sm)] py-1.5 text-xs text-[var(--an-foreground)] outline-none transition-[border-color,box-shadow] duration-150 ease-out hover:border-[var(--an-primary-color)] focus:border-[var(--an-primary-color)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
          value={priorityFilter}
          onChange={(e) => onPriorityChange(e.target.value)}
        >
          {priorityOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="plan-filter-options agent-elements-plan-filter-options flex items-center">
        <label className="plan-filter-checkbox agent-elements-plan-filter-checkbox flex cursor-pointer select-none items-center gap-[var(--an-spacing-xs)] text-xs text-[var(--an-foreground-muted)] transition-colors duration-150 ease-out hover:text-[var(--an-foreground)] [&_input]:cursor-pointer">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => onHideCompletedChange(e.target.checked)}
          />
          <span>Hide completed</span>
        </label>
      </div>
    </div>
  );
}
