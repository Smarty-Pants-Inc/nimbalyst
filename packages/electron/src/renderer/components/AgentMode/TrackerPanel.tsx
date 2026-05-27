/**
 * TrackerPanel - Collapsible panel showing tracker items linked to the workstream.
 *
 * Aggregates linkedTrackerItemIds from all sessions in the workstream and
 * displays them as clickable rows. Clicking navigates to the item in Tracker mode.
 * Collapse state is persisted at the project level via agentModeLayoutAtom.
 */

import React, { useCallback, useId, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { trackerItemByIdAtom } from '@nimbalyst/runtime/plugins/TrackerPlugin/trackerDataAtoms';
import { sessionRegistryAtom, workstreamSessionsAtom } from '../../store/atoms/sessions';
import { trackerPanelCollapsedAtom, toggleTrackerPanelCollapsedAtom } from '../../store/atoms/agentMode';
import { setWindowModeAtom } from '../../store/atoms/windowMode';
import { setTrackerModeLayoutAtom } from '../../store/atoms/trackers';

interface TrackerPanelProps {
  /** The workstream ID - tracker items from all child sessions will be shown */
  workstreamId: string;
}

const TYPE_ICONS: Record<string, string> = {
  bug: 'bug_report',
  task: 'task_alt',
  plan: 'description',
  idea: 'lightbulb',
  decision: 'gavel',
  feature: 'star',
};

const TYPE_ACCENTS: Record<string, string> = {
  bug: 'var(--an-diff-removed-text)',
  task: 'var(--an-primary-color)',
  plan: 'color-mix(in srgb, var(--an-primary-color) 68%, var(--an-foreground-muted))',
  idea: 'color-mix(in srgb, var(--an-primary-color) 48%, var(--an-foreground))',
  decision: 'color-mix(in srgb, var(--an-primary-color) 76%, var(--an-foreground-muted))',
  feature: 'var(--an-diff-added-text)',
};

const panelClass = [
  'tracker-panel',
  'agent-elements-tracker-panel',
  'flex shrink-0 flex-col border-t border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] text-[var(--an-foreground)] [container-type:inline-size]',
].join(' ');

const headerClass = [
  'tracker-panel-header',
  'agent-elements-tracker-panel-header',
  'flex min-h-[34px] w-full cursor-pointer items-center gap-[var(--an-spacing-sm)]',
  'border border-transparent bg-transparent px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)]',
  'text-left text-[var(--an-foreground-muted)] outline-none',
  'transition-[background-color,border-color,color] duration-150 ease-out',
  'hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const contentClass = [
  'tracker-panel-content',
  'agent-elements-tracker-panel-content',
  'nim-scrollbar max-h-[200px] overflow-y-auto px-[var(--an-spacing-lg)]',
  'pb-[var(--an-spacing-md)] pt-[var(--an-spacing-xs)]',
].join(' ');

const rowClass = [
  'tracker-item-row',
  'agent-elements-tracker-item-row',
  'flex w-full cursor-pointer items-center gap-[var(--an-spacing-sm)]',
  'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-transparent bg-transparent',
  'px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-left outline-none',
  'transition-[background-color,border-color,color] duration-150 ease-out',
  'hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]',
].join(' ');

function getStatusTone(status: string | undefined): string {
  if (!status) return 'neutral';
  if (['done', 'decided', 'implemented', 'completed'].includes(status)) return 'success';
  if (['in-progress', 'in_review', 'in-review', 'proposed'].includes(status)) return 'running';
  if (['blocked', 'rejected'].includes(status)) return 'warning';
  return 'neutral';
}

export const TrackerPanel: React.FC<TrackerPanelProps> = React.memo(({
  workstreamId,
}) => {
  const isCollapsed = useAtomValue(trackerPanelCollapsedAtom);
  const toggleCollapsed = useSetAtom(toggleTrackerPanelCollapsedAtom);
  const setWindowMode = useSetAtom(setWindowModeAtom);
  const setTrackerLayout = useSetAtom(setTrackerModeLayoutAtom);
  const contentId = useId();

  // Aggregate linked tracker item IDs across all sessions in the workstream
  const sessionRegistry = useAtomValue(sessionRegistryAtom);
  const workstreamSessions = useAtomValue(workstreamSessionsAtom(workstreamId));

  const linkedItemIds = useMemo(() => {
    const ids = new Set<string>();
    // Include parent workstream's linked items
    const parentMeta = sessionRegistry.get(workstreamId);
    // console.log('[TrackerPanel] workstreamId:', workstreamId, 'parentMeta linked:', parentMeta?.linkedTrackerItemIds, 'childSessions:', workstreamSessions.length);
    if (parentMeta?.linkedTrackerItemIds) {
      for (const id of parentMeta.linkedTrackerItemIds) {
        if (!id.startsWith('file:')) ids.add(id);
      }
    }
    // Include all child sessions' linked items
    for (const sessionId of workstreamSessions) {
      const meta = sessionRegistry.get(sessionId);
      if (meta?.linkedTrackerItemIds) {
        for (const id of meta.linkedTrackerItemIds) {
          if (!id.startsWith('file:')) ids.add(id);
        }
      }
    }
    return Array.from(ids);
  }, [sessionRegistry, workstreamId, workstreamSessions]);

  const handleToggle = useCallback(() => {
    toggleCollapsed();
  }, [toggleCollapsed]);

  const handleNavigate = useCallback((itemId: string) => {
    setTrackerLayout({ selectedItemId: itemId });
    setWindowMode('tracker');
  }, [setTrackerLayout, setWindowMode]);

  // Don't render if no linked tracker items
  if (linkedItemIds.length === 0) {
    return null;
  }

  return (
    <section
      className={panelClass}
      data-agent-elements-shell="tracker-panel"
      data-component="TrackerPanel"
      data-linked-count={linkedItemIds.length}
      data-testid="agent-elements-tracker-panel"
      data-workstream-id={workstreamId}
    >
      <button
        aria-controls={contentId}
        aria-expanded={!isCollapsed}
        className={headerClass}
        onClick={handleToggle}
        data-testid="tracker-panel-header"
        data-agent-elements-shell="tracker-panel-header"
        type="button"
      >
        <MaterialSymbol
          icon={isCollapsed ? 'chevron_right' : 'expand_more'}
          size={16}
          className="shrink-0"
        />
        <MaterialSymbol
          icon="widgets"
          size={16}
          className="shrink-0"
        />
        <span className="tracker-panel-title min-w-0 flex-1 text-xs font-medium leading-none text-[var(--an-foreground)]">
          Trackers
        </span>
        <span
          className="tracker-panel-count agent-elements-status-pill ml-auto font-mono"
          data-testid="agent-elements-tracker-panel-count"
          data-tone="neutral"
        >
          {linkedItemIds.length}
        </span>
      </button>

      {!isCollapsed && (
        <div
          className={contentClass}
          data-agent-elements-shell="tracker-panel-content"
          data-testid="agent-elements-tracker-panel-content"
          id={contentId}
        >
          <div className="agent-elements-tracker-panel-list flex flex-col gap-[var(--an-spacing-xxs)]">
            {linkedItemIds.map((itemId) => (
              <TrackerItemRow
                key={itemId}
                itemId={itemId}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

TrackerPanel.displayName = 'TrackerPanel';

interface TrackerItemRowProps {
  itemId: string;
  onNavigate: (itemId: string) => void;
}

const TrackerItemRow: React.FC<TrackerItemRowProps> = React.memo(({ itemId, onNavigate }) => {
  const item = useAtomValue(trackerItemByIdAtom(itemId));

  const handleClick = useCallback(() => {
    onNavigate(itemId);
  }, [onNavigate, itemId]);

  if (!item) return null;

  const accentColor = TYPE_ACCENTS[item.primaryType] || 'var(--an-foreground-muted)';
  const icon = TYPE_ICONS[item.primaryType] || 'label';
  const title = (item.fields.title as string) || 'Untitled';
  const status = item.fields.status as string;

  return (
    <button
      className={rowClass}
      onClick={handleClick}
      title={`${item.primaryType}: ${title}`}
      data-agent-elements-shell="tracker-panel-item"
      data-testid="tracker-item-row"
      data-tracker-id={itemId}
      data-tracker-status={status || undefined}
      data-tracker-type={item.primaryType}
      style={{ '--tracker-accent': accentColor } as React.CSSProperties}
      type="button"
    >
      <MaterialSymbol
        icon={icon}
        size={14}
        className="shrink-0 text-[var(--tracker-accent)]"
      />
      <span className="min-w-0 flex-1 truncate text-xs leading-snug text-[var(--an-foreground)]">
        {title}
      </span>
      {status && (
        <span
          className="agent-elements-status-pill shrink-0 border border-[color-mix(in_srgb,var(--tracker-accent)_18%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--tracker-accent)_12%,var(--an-background))] text-[var(--tracker-accent)]"
          data-tone={getStatusTone(status)}
        >
          {status}
        </span>
      )}
    </button>
  );
});

TrackerItemRow.displayName = 'TrackerItemRow';
