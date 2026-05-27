/**
 * FilesScopeDropdown - Title dropdown for Files Edited sidebar scope selection.
 *
 * Replaces the static "Files Edited" title with an interactive dropdown that:
 * - Shows the current scope mode as the title
 * - Displays context subtitle (session/workstream/worktree)
 * - Allows changing scope mode and session filter
 * - Contains display options (group by directory)
 */

import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import type { AgentFileScopeMode } from '../../store/atoms/projectState';
import { useFloatingMenu, FloatingPortal } from '../../hooks/useFloatingMenu';

interface FilesScopeDropdownProps {
  /** Current file scope mode */
  fileScopeMode: AgentFileScopeMode;
  /** Callback when file scope mode changes */
  onFileScopeModeChange: (mode: AgentFileScopeMode) => void;
  /** Whether this workstream has multiple sessions */
  hasMultipleSessions: boolean;
  /** The currently active/open session ID */
  activeSessionId: string | null;
  /** Whether filtering to current session only (true) or all sessions (false/null) */
  filterToCurrentSession: boolean;
  /** Callback when session filter changes */
  onFilterToCurrentSessionChange: (filterToCurrent: boolean) => void;
  /** Whether to group files by directory */
  groupByDirectory: boolean;
  /** Callback when group by directory changes */
  onGroupByDirectoryChange: (value: boolean) => void;
  /** Whether this is a worktree session */
  isWorktree: boolean;
  /** Number of sessions in the workstream */
  workstreamSessionCount: number;
  /** Name of the worktree (if applicable) */
  worktreeName?: string;
}

/** Label mapping for scope modes */
const SCOPE_MODE_LABELS: Record<AgentFileScopeMode, { title: string; description: string }> = {
  'current-changes': {
    title: 'Uncommitted Session Edits',
    description: 'Files edited by AI with uncommitted changes'
  },
  'session-files': {
    title: 'All Session Edits',
    description: 'All files touched by AI'
  },
  'all-changes': {
    title: 'All Uncommitted Files',
    description: 'All uncommitted files in repository'
  }
};

interface FilesScopeOptionProps {
  checked: boolean;
  children: React.ReactNode;
  description?: string;
  inputClassName?: string;
  label: string;
  name?: string;
  onChange: (checked: boolean) => void;
  shell: string;
  type: 'checkbox' | 'radio';
  value?: string;
}

const triggerBaseClass = [
  'files-scope-dropdown__trigger',
  'agent-elements-files-scope-dropdown-trigger',
  '-mx-2 -my-1 flex max-w-full cursor-pointer flex-col items-start gap-0',
  'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-transparent bg-transparent',
  'px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-left outline-none',
  'transition-[background-color,border-color,color] duration-150 ease-out',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]',
].join(' ');

const triggerOpenClass = 'border-[var(--an-border-color)] bg-[var(--an-background-tertiary)]';
const triggerClosedClass = 'hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)]';

const menuClass = [
  'files-scope-dropdown__menu',
  'agent-elements-files-scope-dropdown-menu',
  'nim-scrollbar z-[1000] min-w-[276px] max-w-[360px] overflow-hidden',
  'rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background)] p-[var(--an-spacing-xxs)] text-[13px] text-[var(--an-foreground)]',
  'shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]',
].join(' ');

const sectionClass = [
  'files-scope-dropdown__section',
  'agent-elements-files-scope-dropdown-section',
  'px-[var(--an-spacing-xxs)] py-[var(--an-spacing-xs)]',
].join(' ');

const dividedSectionClass = `${sectionClass} border-b border-[var(--an-border-color)]`;

const sectionHeaderClass = [
  'files-scope-dropdown__section-header',
  'agent-elements-files-scope-dropdown-section-header',
  'px-[var(--an-spacing-sm)] pb-[var(--an-spacing-xxs)] pt-[var(--an-spacing-xs)]',
  'text-[10px] font-medium text-[var(--an-foreground-subtle)]',
].join(' ');

const optionInputClass = [
  'mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--an-primary-color)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]',
].join(' ');

const inlineOptionInputClass = [
  'h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--an-primary-color)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]',
].join(' ');

function getOptionClass(checked: boolean): string {
  const stateClass = checked
    ? 'border-[color-mix(in_srgb,var(--an-primary-color)_24%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))]'
    : 'border-transparent bg-transparent hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)]';

  return [
    'files-scope-dropdown__option',
    'agent-elements-files-scope-dropdown-option',
    'flex cursor-pointer items-start gap-[var(--an-spacing-sm)] rounded-[calc(var(--an-tool-border-radius)_-_2px)]',
    'border px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-[var(--an-foreground)]',
    'transition-[background-color,border-color,color] duration-150 ease-out',
    stateClass,
  ].join(' ');
}

function FilesScopeOption({
  checked,
  children,
  description,
  inputClassName = optionInputClass,
  label,
  name,
  onChange,
  shell,
  type,
  value,
}: FilesScopeOptionProps) {
  return (
    <label
      className={getOptionClass(checked)}
      data-agent-elements-shell={shell}
      data-selected={checked ? 'true' : 'false'}
      data-value={value}
    >
      <input
        aria-label={label}
        checked={checked}
        className={inputClassName}
        name={name}
        onChange={(event) => onChange(event.target.checked)}
        type={type}
      />
      <span className="files-scope-dropdown__option-content flex min-w-0 flex-1 flex-col">
        <span className="files-scope-dropdown__option-title text-xs font-medium leading-snug text-[var(--an-foreground)]">
          {children}
        </span>
        {description ? (
          <span className="files-scope-dropdown__option-description mt-0.5 text-[10px] leading-snug text-[var(--an-foreground-subtle)]">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** Get context subtitle based on current state */
function getScopeContext(
  mode: AgentFileScopeMode,
  isWorktree: boolean,
  sessionCount: number,
  filterToCurrentSession: boolean,
  worktreeName?: string
): string {
  if (mode === 'all-changes') {
    if (isWorktree && worktreeName) {
      return `in worktree ${worktreeName}`;
    }
    return isWorktree ? 'in this Worktree' : 'in this Workspace';
  }

  if (filterToCurrentSession) {
    return 'in current Session';
  }

  if (sessionCount > 1) {
    return `in this Workstream (${sessionCount} sessions)`;
  }

  return 'in this Session';
}

export const FilesScopeDropdown: React.FC<FilesScopeDropdownProps> = ({
  fileScopeMode,
  onFileScopeModeChange,
  hasMultipleSessions,
  activeSessionId,
  filterToCurrentSession,
  onFilterToCurrentSessionChange,
  groupByDirectory,
  onGroupByDirectoryChange,
  isWorktree,
  workstreamSessionCount,
  worktreeName,
}) => {
  const menu = useFloatingMenu({ placement: 'bottom-start' });

  const currentLabel = SCOPE_MODE_LABELS[fileScopeMode];
  const contextSubtitle = getScopeContext(fileScopeMode, isWorktree, workstreamSessionCount, filterToCurrentSession, worktreeName);
  const menuId = 'files-scope-dropdown-menu';

  return (
    <div
      className="files-scope-dropdown agent-elements-files-scope-dropdown min-w-60 max-w-full text-[var(--an-foreground)]"
      data-agent-elements-shell="files-scope-dropdown"
      data-component="FilesScopeDropdown"
      data-testid="agent-elements-files-scope-dropdown"
    >
      <button
        ref={menu.refs.setReference}
        {...menu.getReferenceProps()}
        aria-controls={menu.isOpen ? menuId : undefined}
        aria-expanded={menu.isOpen}
        aria-haspopup="menu"
        onClick={() => menu.setIsOpen(!menu.isOpen)}
        data-testid="files-scope-dropdown"
        data-agent-elements-shell="files-scope-dropdown-trigger"
        type="button"
        className={`${triggerBaseClass} ${menu.isOpen ? triggerOpenClass : triggerClosedClass}`}
      >
        <div className="files-scope-dropdown__title-row flex max-w-full items-center gap-[var(--an-spacing-xs)]">
          <MaterialSymbol icon="description" size={16} className="shrink-0 text-[var(--an-foreground-muted)]" />
          <span className="files-scope-dropdown__title min-w-0 truncate text-sm font-medium leading-tight text-[var(--an-foreground)]">
            {currentLabel.title}
          </span>
          <MaterialSymbol
            icon="expand_more"
            size={16}
            className={`files-scope-dropdown__chevron shrink-0 text-[var(--an-foreground-muted)] transition-transform duration-150 ease-out ${
              menu.isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
        <span className="files-scope-dropdown__subtitle pl-5 text-xs leading-snug text-[var(--an-foreground-subtle)]">
          {contextSubtitle}
        </span>
      </button>

      {menu.isOpen && (
        <FloatingPortal>
          <div
            ref={menu.refs.setFloating}
            style={menu.floatingStyles}
            {...menu.getFloatingProps()}
            aria-label="Files edited scope"
            className={menuClass}
            data-agent-elements-shell="files-scope-dropdown-menu"
            data-component="FilesScopeDropdownMenu"
            data-testid="agent-elements-files-scope-dropdown-menu"
            id={menuId}
            role="menu"
          >
            <div
              className={dividedSectionClass}
              data-agent-elements-shell="files-scope-dropdown-section"
            >
              <div className={sectionHeaderClass}>
                Show Files
              </div>
              {(Object.entries(SCOPE_MODE_LABELS) as [AgentFileScopeMode, { title: string; description: string }][]).map(
                ([mode, { title, description }]) => {
                  const displayDescription = mode === 'all-changes' && isWorktree && worktreeName
                    ? `All uncommitted files in worktree ${worktreeName}`
                    : description;

                  return (
                    <FilesScopeOption
                      checked={fileScopeMode === mode}
                      key={mode}
                      label={title}
                      name="fileScopeMode"
                      onChange={() => {
                        onFileScopeModeChange(mode);
                      }}
                      shell="files-scope-dropdown-scope-mode"
                      type="radio"
                      value={mode}
                      description={displayDescription}
                    >
                      {title}
                    </FilesScopeOption>
                  );
                }
              )}
            </div>

            {hasMultipleSessions && fileScopeMode !== 'all-changes' && (
              <div
                className={dividedSectionClass}
                data-agent-elements-shell="files-scope-dropdown-section"
              >
                <div className={sectionHeaderClass}>
                  Scope
                </div>
                <FilesScopeOption
                  checked={!filterToCurrentSession}
                  inputClassName={inlineOptionInputClass}
                  label={`All sessions (${workstreamSessionCount})`}
                  name="sessionFilter"
                  onChange={() => onFilterToCurrentSessionChange(false)}
                  shell="files-scope-dropdown-session-filter"
                  type="radio"
                  value="all-sessions"
                >
                  <span>
                    All sessions ({workstreamSessionCount})
                  </span>
                </FilesScopeOption>
                <FilesScopeOption
                  checked={filterToCurrentSession}
                  inputClassName={inlineOptionInputClass}
                  label="Current session only"
                  name="sessionFilter"
                  onChange={() => onFilterToCurrentSessionChange(true)}
                  shell="files-scope-dropdown-session-filter"
                  type="radio"
                  value="current-session"
                >
                  Current session only
                </FilesScopeOption>
              </div>
            )}

            <div
              className={sectionClass}
              data-agent-elements-shell="files-scope-dropdown-section"
            >
              <div className={sectionHeaderClass}>
                Display
              </div>
              <FilesScopeOption
                checked={groupByDirectory}
                inputClassName={inlineOptionInputClass}
                label="Group by directory"
                onChange={(checked) => onGroupByDirectoryChange(checked)}
                shell="files-scope-dropdown-display-option"
                type="checkbox"
                value="group-by-directory"
              >
                Group by directory
              </FilesScopeOption>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
};

FilesScopeDropdown.displayName = 'FilesScopeDropdown';
