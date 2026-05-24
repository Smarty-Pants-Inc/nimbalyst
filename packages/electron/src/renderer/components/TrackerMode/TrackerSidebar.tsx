import React from 'react';
import { useAtomValue } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import type { TrackerItemType } from '@nimbalyst/runtime';
import { trackerItemCountByTypeAtom } from '@nimbalyst/runtime/plugins/TrackerPlugin';
import type { TrackerDataModel } from '@nimbalyst/runtime/plugins/TrackerPlugin/models';
import type { TrackerFilterChip } from '../../store/atoms/trackers';
import type { ViewMode } from './TrackerMainView';
import { WorkspaceSummaryHeader } from '../WorkspaceSummaryHeader';
import { AlphaBadge } from '../common/AlphaBadge';

interface TrackerSidebarProps {
  workspacePath?: string;
  workspaceName?: string;
  trackerTypes: TrackerDataModel[];
  selectedType: string | 'all';
  activeFilters: TrackerFilterChip[];
  viewMode: ViewMode;
  onSelectType: (type: string | 'all') => void;
  onToggleFilter: (filter: TrackerFilterChip) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

const FILTER_CHIPS: { id: TrackerFilterChip; label: string; icon: string }[] = [
  { id: 'mine', label: 'Mine', icon: 'person' },
  { id: 'unassigned', label: 'Unassigned', icon: 'person_off' },
  { id: 'high-priority', label: 'High Priority', icon: 'priority_high' },
  { id: 'recently-updated', label: 'Recent', icon: 'schedule' },
  { id: 'archived', label: 'Archived', icon: 'archive' },
];

/** Small component so each sidebar row subscribes to its own atom */
function SidebarTypeCount({ type }: { type: TrackerItemType }) {
  const count = useAtomValue(trackerItemCountByTypeAtom(type));
  return <>{count}</>;
}

const viewToggleButtonClass =
  'agent-elements-tracker-view-button inline-flex h-7 w-8 items-center justify-center rounded-[var(--an-input-border-radius)] transition-[background-color,color,box-shadow] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

const activeViewToggleClass =
  'bg-[var(--an-background-tertiary)] text-[var(--an-foreground)] shadow-[inset_0_0_0_1px_var(--an-border-color)]';

const inactiveViewToggleClass =
  'text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-secondary)] hover:text-[var(--an-foreground)]';

const trackerTypeRowBaseClass =
  'agent-elements-tracker-type-row w-full flex items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-input-border-radius)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-sm)] text-sm transition-[background-color,color,box-shadow] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

const trackerTypeRowActiveClass =
  'bg-[var(--an-background-tertiary)] text-[var(--an-foreground)] shadow-[inset_0_0_0_1px_var(--an-border-color)]';

const trackerTypeRowInactiveClass =
  'text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]';

export const TrackerSidebar: React.FC<TrackerSidebarProps> = ({
  workspacePath,
  workspaceName,
  trackerTypes,
  selectedType,
  activeFilters,
  viewMode,
  onSelectType,
  onToggleFilter,
  onViewModeChange,
}) => {
  return (
    <div
      className="tracker-sidebar agent-elements-tracker-sidebar h-full w-full flex flex-col overflow-hidden border-r border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground)] [container-type:inline-size]"
      data-component="TrackerSidebar"
      data-agent-elements-shell="tracker-sidebar"
      data-testid="tracker-sidebar"
    >
      {workspacePath && (
        <WorkspaceSummaryHeader
          workspacePath={workspacePath}
          workspaceName={workspaceName}
          actions={
            <div
              className="agent-elements-tracker-sidebar-view-toggle inline-flex items-center gap-0.5 rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-0.5"
              data-agent-elements-shell="tracker-sidebar-view-toggle"
              data-testid="agent-elements-tracker-sidebar-view-toggle"
            >
              <button
                type="button"
                className={`${viewToggleButtonClass} ${
                  viewMode === 'list' ? activeViewToggleClass : inactiveViewToggleClass
                }`}
                onClick={() => onViewModeChange('list')}
                title="List view"
                data-agent-elements-shell="tracker-sidebar-view-list"
                data-testid="tracker-view-mode-list"
              >
                <MaterialSymbol icon="view_list" size={16} />
              </button>
              <button
                type="button"
                className={`${viewToggleButtonClass} ${
                  viewMode === 'table' ? activeViewToggleClass : inactiveViewToggleClass
                }`}
                onClick={() => onViewModeChange('table')}
                title="Table view"
                data-agent-elements-shell="tracker-sidebar-view-table"
                data-testid="tracker-view-mode-table"
              >
                <MaterialSymbol icon="table_rows" size={16} />
              </button>
              <button
                type="button"
                className={`${viewToggleButtonClass} relative ${
                  viewMode === 'kanban' ? activeViewToggleClass : inactiveViewToggleClass
                }`}
                onClick={() => onViewModeChange('kanban')}
                title="Kanban view (alpha)"
                data-agent-elements-shell="tracker-sidebar-view-kanban"
                data-testid="tracker-view-mode-kanban"
              >
                <MaterialSymbol icon="view_kanban" size={16} />
                <AlphaBadge size="dot" className="absolute -top-1 -right-1 pointer-events-none" />
              </button>
            </div>
          }
        />
      )}
      <div
        className="agent-elements-tracker-sidebar-header border-b border-[var(--an-border-color)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-[11px] font-medium leading-none text-[var(--an-foreground-muted)]"
        data-agent-elements-shell="tracker-sidebar-header"
        data-testid="agent-elements-tracker-sidebar-header"
      >
        Trackers
      </div>

      <div className="flex-1 overflow-y-auto">
        <div
          className="agent-elements-tracker-filter-section border-b border-[var(--an-border-color)] px-[var(--an-spacing-md)] py-[var(--an-spacing-md)]"
          data-agent-elements-shell="tracker-filter-section"
        >
          <div className="mb-[var(--an-spacing-xs)] px-[var(--an-spacing-xxs)] text-[11px] font-medium leading-none text-[var(--an-foreground-subtle)]">
            Filters
          </div>
          <div className="flex flex-wrap gap-[var(--an-spacing-xs)]">
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilters.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  data-testid={`tracker-filter-${chip.id}`}
                  data-agent-elements-shell="tracker-filter-chip"
                  className={`agent-elements-tracker-filter-chip inline-flex h-7 items-center gap-[var(--an-spacing-xxs)] rounded-[var(--an-input-border-radius)] border px-2.5 text-[11px] font-medium transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] ${
                    isActive
                      ? 'border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-send-button-color)]'
                      : 'border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]'
                  }`}
                  onClick={() => onToggleFilter(chip.id)}
                >
                  <MaterialSymbol icon={chip.icon} size={13} />
                  {chip.label}
                </button>
              );
            })}
          </div>
          {activeFilters.length > 0 && (
            <button
              type="button"
              className="agent-elements-tracker-clear-filters mt-[var(--an-spacing-sm)] rounded-[var(--an-input-border-radius)] px-[var(--an-spacing-xs)] py-[var(--an-spacing-xxs)] text-[11px] font-medium text-[var(--an-foreground-subtle)] transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
              onClick={() => activeFilters.forEach(f => onToggleFilter(f))}
              data-agent-elements-shell="tracker-clear-filters"
              data-testid="agent-elements-tracker-clear-filters"
            >
              Clear filters
            </button>
          )}
        </div>

        <div
          className="agent-elements-tracker-types-section px-[var(--an-spacing-md)] py-[var(--an-spacing-md)]"
          data-agent-elements-shell="tracker-types-section"
        >
          <div className="mb-[var(--an-spacing-xs)] px-[var(--an-spacing-xxs)] text-[11px] font-medium leading-none text-[var(--an-foreground-subtle)]">
            Types
          </div>

          <button
            type="button"
            className={`${trackerTypeRowBaseClass} ${
              selectedType === 'all'
                ? trackerTypeRowActiveClass
                : trackerTypeRowInactiveClass
            }`}
            onClick={() => onSelectType('all')}
            data-agent-elements-shell="tracker-type-row"
            data-testid="agent-elements-tracker-type-all"
          >
            <MaterialSymbol icon="checklist" size={16} />
            <span className="flex-1 text-left truncate">All</span>
          </button>

          {trackerTypes.map((tracker) => (
            <button
              key={tracker.type}
              type="button"
              data-testid="tracker-type-button"
              data-tracker-type={tracker.type}
              data-agent-elements-shell="tracker-type-row"
              className={`${trackerTypeRowBaseClass} ${
                selectedType === tracker.type
                  ? trackerTypeRowActiveClass
                  : trackerTypeRowInactiveClass
              }`}
              onClick={() => onSelectType(tracker.type)}
            >
              <span style={{ color: tracker.color }}>
                <MaterialSymbol icon={tracker.icon} size={16} />
              </span>
              <span className="flex-1 text-left truncate">{tracker.displayNamePlural}</span>
              <span
                className="min-w-[20px] text-right text-[11px] font-medium text-[var(--an-foreground-subtle)]"
                data-agent-elements-shell="tracker-type-count"
                data-testid="agent-elements-tracker-type-count"
              >
                <SidebarTypeCount type={tracker.type as TrackerItemType} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
