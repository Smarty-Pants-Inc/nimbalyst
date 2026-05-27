import React, { useMemo } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { useFloatingMenu, FloatingPortal, virtualElement } from '../hooks/useFloatingMenu';

const floatingMenuCardGutters = '[--agent-elements-card-block-padding:var(--an-spacing-xs)] [--agent-elements-card-inline-padding:var(--an-spacing-xs)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';

export type FileTreeFilter = 'all' | 'markdown' | 'known' | 'git-uncommitted' | 'git-worktree' | 'ai-read' | 'ai-written';

interface FileTreeFilterMenuProps {
  x: number;
  y: number;
  currentFilter: FileTreeFilter;
  showIcons: boolean;
  showGitStatus: boolean;
  enableAutoScroll: boolean;
  onFilterChange: (filter: FileTreeFilter) => void;
  onShowIconsChange: (showIcons: boolean) => void;
  onShowGitStatusChange: (showGitStatus: boolean) => void;
  onEnableAutoScrollChange: (enableAutoScroll: boolean) => void;
  hasActiveClaudeSession: boolean;
  claudeSessionFileCounts: { read: number; written: number };
  isGitRepo: boolean;
  gitUncommittedCount: number;
  isGitWorktree: boolean;
  gitWorktreeCount: number;
  onClose: () => void;
}

interface FilterMenuRowProps {
  icon: string;
  label: string;
  onClick: () => void;
  action: string;
  selected?: boolean;
  disabled?: boolean;
  count?: number;
  role?: 'menuitem' | 'menuitemradio' | 'menuitemcheckbox';
  checked?: boolean;
}

function FilterMenuSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="filter-menu-section-label nim-section-label agent-elements-file-tree-filter-menu-section px-3 pb-1 pt-2 text-[11px] font-medium uppercase text-[var(--an-foreground-subtle)]"
      data-agent-elements-shell="file-tree-filter-menu-section"
    >
      {children}
    </div>
  );
}

function FilterMenuHint({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="filter-menu-hint agent-elements-file-tree-filter-menu-hint px-3 pb-1.5 text-[11px] text-[var(--an-foreground-subtle)]"
      data-agent-elements-shell="file-tree-filter-menu-hint"
    >
      {children}
    </div>
  );
}

function FilterMenuRow({
  icon,
  label,
  onClick,
  action,
  selected = false,
  disabled = false,
  count,
  role = 'menuitem',
  checked,
}: FilterMenuRowProps) {
  const checkedValue = role === 'menuitem' ? undefined : Boolean(checked ?? selected);
  const stateClass = selected
    ? 'active border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))]'
    : 'border-transparent bg-transparent';
  const enabledClass = disabled
    ? 'disabled cursor-not-allowed opacity-60'
    : 'cursor-pointer hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)]';

  return (
    <button
      type="button"
      className={`filter-menu-item agent-elements-file-tree-filter-menu-item relative flex w-full items-center gap-2.5 rounded-[var(--an-tool-border-radius)] border px-3 py-2 text-left text-[13px] text-[var(--an-foreground)] transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] ${stateClass} ${enabledClass}`}
      onClick={onClick}
      disabled={disabled}
      role={role}
      aria-checked={checkedValue}
      aria-disabled={disabled || undefined}
      data-agent-elements-shell="file-tree-filter-menu-item"
      data-filter-action={action}
      data-selected={selected ? 'true' : 'false'}
    >
      <span
        className="agent-elements-file-tree-filter-menu-icon flex h-5 w-5 shrink-0 items-center justify-center text-[var(--an-foreground-muted)]"
        data-agent-elements-shell="file-tree-filter-menu-icon"
      >
        <MaterialSymbol icon={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof count === 'number' && count > 0 ? (
        <span
          className="filter-menu-pill agent-elements-file-tree-filter-menu-pill rounded-full bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))] px-2 text-[11px] font-semibold leading-[18px] text-[var(--an-primary-color)]"
          data-agent-elements-shell="file-tree-filter-menu-pill"
        >
          {count}
        </span>
      ) : null}
      {selected ? (
        <span
          className="filter-menu-check agent-elements-file-tree-filter-menu-check flex h-4 w-4 shrink-0 items-center justify-center text-[var(--an-primary-color)]"
          data-agent-elements-shell="file-tree-filter-menu-check"
          aria-hidden="true"
        >
          <MaterialSymbol icon="check" size={16} />
        </span>
      ) : null}
    </button>
  );
}

export function FileTreeFilterMenu({
  x,
  y,
  currentFilter,
  showIcons,
  showGitStatus,
  enableAutoScroll,
  onFilterChange,
  onShowIconsChange,
  onShowGitStatusChange,
  onEnableAutoScrollChange,
  hasActiveClaudeSession,
  claudeSessionFileCounts,
  isGitRepo,
  gitUncommittedCount,
  isGitWorktree,
  gitWorktreeCount,
  onClose
}: FileTreeFilterMenuProps) {
  const reference = useMemo(() => virtualElement(x, y), [x, y]);
  const menu = useFloatingMenu({
    placement: 'right-start',
    reference,
    open: true,
    onOpenChange: (open) => { if (!open) onClose(); },
  });

  const handleFilterSelect = (filter: FileTreeFilter, disabled?: boolean) => {
    if (disabled) {
      return;
    }
    onFilterChange(filter);
    onClose();
  };

  return (
    <FloatingPortal>
      <div
        ref={menu.refs.setFloating}
        style={menu.floatingStyles}
        {...menu.getFloatingProps()}
        className={`file-tree-filter-menu agent-elements-file-tree-filter-menu agent-elements-tool-card z-[10000] min-w-[220px] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[13px] text-[var(--an-foreground)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)] ${floatingMenuCardGutters}`}
        role="menu"
        aria-label="File tree filters"
        data-testid="agent-elements-file-tree-filter-menu"
        data-component="FileTreeFilterMenu"
        data-agent-elements-shell="file-tree-filter-menu"
        data-agent-elements-card-padding="symmetric-inline"
        data-agent-elements-card-width="floating-menu"
      >
        <FilterMenuSectionLabel>Show Files</FilterMenuSectionLabel>

        <FilterMenuRow
          icon="folder_open"
          label="All Files"
          action="all"
          role="menuitemradio"
          selected={currentFilter === 'all'}
          onClick={() => handleFilterSelect('all')}
        />

        <FilterMenuRow
          icon="description"
          label="Markdown Only"
          action="markdown"
          role="menuitemradio"
          selected={currentFilter === 'markdown'}
          onClick={() => handleFilterSelect('markdown')}
        />

        <FilterMenuRow
          icon="filter_list"
          label="Known Files"
          action="known"
          role="menuitemradio"
          selected={currentFilter === 'known'}
          onClick={() => handleFilterSelect('known')}
        />

        <FilterMenuSectionLabel>Git</FilterMenuSectionLabel>

        <FilterMenuRow
          icon="difference"
          label="Uncommitted Changes"
          action="git-uncommitted"
          role="menuitemradio"
          selected={currentFilter === 'git-uncommitted'}
          disabled={!isGitRepo}
          count={gitUncommittedCount}
          onClick={() => handleFilterSelect('git-uncommitted', !isGitRepo)}
        />

        {isGitWorktree && (
          <FilterMenuRow
            icon="account_tree"
            label="Worktree Changes"
            action="git-worktree"
            role="menuitemradio"
            selected={currentFilter === 'git-worktree'}
            count={gitWorktreeCount}
            onClick={() => handleFilterSelect('git-worktree')}
          />
        )}

        {!isGitRepo && (
          <FilterMenuHint>Not a git repository.</FilterMenuHint>
        )}

        <FilterMenuSectionLabel>Claude Agent Session</FilterMenuSectionLabel>

        <FilterMenuRow
          icon="visibility"
          label="Files Read"
          action="ai-read"
          role="menuitemradio"
          selected={currentFilter === 'ai-read'}
          disabled={!hasActiveClaudeSession}
          count={claudeSessionFileCounts.read}
          onClick={() => handleFilterSelect('ai-read', !hasActiveClaudeSession)}
        />

        <FilterMenuRow
          icon="edit_note"
          label="Files Written"
          action="ai-written"
          role="menuitemradio"
          selected={currentFilter === 'ai-written'}
          disabled={!hasActiveClaudeSession}
          count={claudeSessionFileCounts.written}
          onClick={() => handleFilterSelect('ai-written', !hasActiveClaudeSession)}
        />

        {!hasActiveClaudeSession && (
          <FilterMenuHint>Open a Claude Agent session to enable these filters.</FilterMenuHint>
        )}

        <div
          className="filter-menu-separator agent-elements-file-tree-filter-menu-separator mx-2 my-1 h-px bg-[var(--an-border-color)]"
          data-agent-elements-shell="file-tree-filter-menu-separator"
        />

        <FilterMenuRow
          icon={showIcons ? 'check_box' : 'check_box_outline_blank'}
          label="Show Icons"
          action="show-icons"
          role="menuitemcheckbox"
          checked={showIcons}
          onClick={() => onShowIconsChange(!showIcons)}
        />

        <FilterMenuRow
          icon={showGitStatus ? 'check_box' : 'check_box_outline_blank'}
          label="Show Git Status"
          action="show-git-status"
          role="menuitemcheckbox"
          checked={showGitStatus}
          onClick={() => onShowGitStatusChange(!showGitStatus)}
        />

        <FilterMenuRow
          icon={enableAutoScroll ? 'check_box' : 'check_box_outline_blank'}
          label="Auto-Scroll to Active File"
          action="auto-scroll"
          role="menuitemcheckbox"
          checked={enableAutoScroll}
          onClick={() => onEnableAutoScrollChange(!enableAutoScroll)}
        />
      </div>
    </FloatingPortal>
  );
}
