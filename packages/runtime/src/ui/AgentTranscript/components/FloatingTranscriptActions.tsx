/**
 * FloatingTranscriptActions - Floating action buttons for AgentTranscriptPanel
 *
 * Provides two floating buttons in the top-right corner of the transcript:
 * 1. Prompts menu (TOC icon) - Dropdown showing all user prompts in the session
 * 2. Toggle history button - Shows/hides the file history sidebar
 *
 * This component follows the same design pattern as FloatingDocumentActionsPlugin
 * in the TabEditor, with consistent styling, positioning, and interaction patterns.
 */
import React, { useState, useMemo } from 'react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import type { PromptMarker } from '../types';
import { formatShortTime } from '../../../utils/dateUtils';
import { MaterialSymbol } from '../../icons/MaterialSymbol';

const FLOATING_ACTION_BUTTON_CLASS =
  'floating-transcript-button agent-elements-floating-transcript-button pointer-events-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--an-radius-sm)] border border-[var(--an-tool-border-color)] bg-[var(--an-background)] text-[12px] font-medium text-[var(--an-foreground-muted)] cursor-pointer motion-safe:transition-colors motion-safe:duration-150 hover:bg-[var(--an-background-secondary)] hover:text-[var(--an-tool-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]';
const FLOATING_ICON_BUTTON_CLASS = `${FLOATING_ACTION_BUTTON_CLASS} w-9`;
const FLOATING_PHASE_BUTTON_CLASS = `${FLOATING_ACTION_BUTTON_CLASS} px-2.5`;
const FLOATING_MENU_CLASS =
  'agent-elements-floating-transcript-menu max-h-[min(500px,calc(100vh-24px))] overflow-y-auto rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-background)] p-1 text-[13px] text-[var(--an-tool-color)] z-[1000] pointer-events-auto outline-none';
const FLOATING_MENU_ITEM_CLASS =
  'agent-elements-floating-transcript-menu-item flex w-full items-start gap-2 rounded-[calc(var(--an-tool-border-radius)-4px)] border-0 bg-transparent px-2.5 py-2 text-left text-[var(--an-tool-color)] cursor-pointer motion-safe:transition-colors motion-safe:duration-150 hover:bg-[var(--an-background-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--an-input-focus-outline)]';
const FLOATING_PHASE_ITEM_CLASS =
  'agent-elements-floating-transcript-menu-item flex w-full items-center gap-2 rounded-[calc(var(--an-tool-border-radius)-4px)] border-0 bg-transparent px-2.5 py-2 text-left text-[0.8125rem] cursor-pointer motion-safe:transition-colors motion-safe:duration-150 hover:bg-[var(--an-background-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--an-input-focus-outline)]';

// =============================================================================
// PromptsMenuButton - Standalone prompts menu dropdown
// =============================================================================

interface PromptsMenuButtonProps {
  prompts: PromptMarker[];
  onNavigateToPrompt: (marker: PromptMarker) => void;
  /** Optional class name for the container */
  className?: string;
  /** Optional class name for the button */
  buttonClassName?: string;
}

/**
 * Standalone prompts menu button with dropdown.
 * Can be used independently (e.g., in mobile header) or as part of FloatingTranscriptActions.
 */
export const PromptsMenuButton: React.FC<PromptsMenuButtonProps> = ({
  prompts,
  onNavigateToPrompt,
  className,
  buttonClassName,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: showMenu,
    onOpenChange: setShowMenu,
    placement: 'bottom-end',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ['top-end', 'bottom-start', 'top-start'], padding: 8 }),
      shift({ padding: 8 }),
    ],
  });
  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  });
  const role = useRole(context, { role: 'menu' });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  // Handle prompt selection
  const handlePromptClick = (marker: PromptMarker) => {
    onNavigateToPrompt(marker);
    setShowMenu(false);
  };

  // Truncate prompt text for display
  const truncatePrompt = (text: string, maxLength: number = 80): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const dropdownContent = showMenu ? (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        className={`floating-transcript-prompts-dropdown ${FLOATING_MENU_CLASS} min-w-80 max-w-[480px]`}
        data-testid="agent-elements-prompts-menu"
        data-component="PromptsMenuButton"
        data-agent-elements-shell="prompts-menu"
        {...getFloatingProps()}
      >
        {prompts.length > 0 ? (
          <ul className="prompts-list list-none m-0 p-0">
            {prompts.map((prompt) => (
              <li
                key={prompt.id}
                className="prompts-item"
                title={prompt.promptText}
              >
                <button
                  type="button"
                  role="menuitem"
                  className={FLOATING_MENU_ITEM_CLASS}
                  onClick={() => handlePromptClick(prompt)}
                >
                  <span className="prompts-item-number min-w-8 pt-0.5 text-right text-[11px] font-semibold text-[var(--an-foreground-subtle)]">#{prompt.id}</span>
                  <span className="prompts-item-text flex-1 overflow-hidden text-ellipsis line-clamp-2 text-[13px] leading-snug text-[var(--an-tool-color)]">
                    {truncatePrompt(prompt.promptText)}
                  </span>
                  <span className="prompts-item-timestamp whitespace-nowrap pt-0.5 text-[11px] text-[var(--an-foreground-subtle)]">
                    {formatShortTime(prompt.timestamp)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="prompts-empty px-4 py-6 text-center text-[13px] text-[var(--an-foreground-subtle)]">No prompts in this session</div>
        )}
      </div>
    </FloatingPortal>
  ) : null;

  return (
    <div
      className={className || 'prompts-menu-container agent-elements-prompts-menu-container inline-flex'}
      data-agent-elements-shell="prompts-menu-button"
    >
      <button
        ref={refs.setReference}
        className={buttonClassName || `${FLOATING_ICON_BUTTON_CLASS} relative`}
        aria-label="Prompts Menu"
        aria-expanded={showMenu}
        title="Show prompts in this session"
        {...getReferenceProps({
          onClick: () => setShowMenu(open => !open),
        })}
      >
        <MaterialSymbol icon="format_list_bulleted" size={18} />
        {prompts.length > 0 && (
          <span className="prompts-badge absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[var(--an-primary-color)] px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-[var(--an-send-button-color)]">{prompts.length}</span>
        )}
      </button>
      {dropdownContent}
    </div>
  );
};

// =============================================================================
// FloatingTranscriptActions - Container with prompts menu + history toggle
// =============================================================================

/** Phase column definition for the kanban board */
export interface PhaseColumn {
  value: string;
  label: string;
  color: string;
}

interface FloatingTranscriptActionsProps {
  prompts: PromptMarker[];
  /** Whether the sidebar is collapsed (only used if onToggleSidebar is provided) */
  isSidebarCollapsed?: boolean;
  /** Optional: Toggle sidebar visibility. If not provided, the toggle button is hidden. */
  onToggleSidebar?: () => void;
  onNavigateToPrompt: (marker: PromptMarker) => void;
  /** Current session phase for the kanban board */
  currentPhase?: string | null;
  /** Available phase columns */
  phaseColumns?: PhaseColumn[];
  /** Callback when phase is changed. If not provided, the phase button is hidden. */
  onSetPhase?: (phase: string | null) => void;
  /**
   * Whether the transcript find-in-page search bar is currently visible.
   * The search bar is a `sticky top-0` element occupying ~44px at the top of
   * the same container these floating actions sit in. When it is visible,
   * shift the actions down so the phase pill no longer overlaps the search
   * bar's right-side controls on narrow widths. See #309.
   */
  searchBarVisible?: boolean;
}

export const FloatingTranscriptActions: React.FC<FloatingTranscriptActionsProps> = ({
  prompts,
  isSidebarCollapsed,
  onToggleSidebar,
  onNavigateToPrompt,
  currentPhase,
  phaseColumns,
  onSetPhase,
  searchBarVisible = false,
}) => {
  const [showPhaseMenu, setShowPhaseMenu] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: showPhaseMenu,
    onOpenChange: setShowPhaseMenu,
    placement: 'bottom-end',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ['top-end', 'bottom-start', 'top-start'], padding: 8 }),
      shift({ padding: 8 }),
    ],
  });
  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  });
  const role = useRole(context, { role: 'menu' });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  const currentPhaseCol = phaseColumns?.find(c => c.value === currentPhase);
  const phaseMenu = useMemo(() => {
    if (!showPhaseMenu || !phaseColumns) return null;

    return (
      <FloatingPortal>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          className={`floating-transcript-phase-menu ${FLOATING_MENU_CLASS} min-w-[160px] max-h-[min(320px,calc(100vh-24px))]`}
          data-testid="agent-elements-phase-menu"
          data-component="FloatingTranscriptActions"
          data-agent-elements-shell="phase-menu"
          {...getFloatingProps()}
        >
          {phaseColumns.map((col) => (
            <button
              key={col.value}
              type="button"
              role="menuitem"
              className={`${FLOATING_PHASE_ITEM_CLASS} ${currentPhase === col.value ? 'text-[var(--an-primary-color)]' : 'text-[var(--an-tool-color)]'}`}
              onClick={() => {
                onSetPhase?.(col.value);
                setShowPhaseMenu(false);
              }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[var(--floating-transcript-phase-color)]"
                style={{ '--floating-transcript-phase-color': col.color } as React.CSSProperties}
              />
              {col.label}
              {currentPhase === col.value && <MaterialSymbol icon="check" size={14} className="ml-auto" />}
            </button>
          ))}
          {currentPhase && (
            <>
              <div className="my-1 h-px bg-[var(--an-tool-border-color)]" />
              <button
                type="button"
                role="menuitem"
                className={`${FLOATING_PHASE_ITEM_CLASS} text-[var(--an-foreground-muted)]`}
                onClick={() => {
                  onSetPhase?.(null);
                  setShowPhaseMenu(false);
                }}
              >
                <MaterialSymbol icon="close" size={14} />
                Remove from board
              </button>
            </>
          )}
        </div>
      </FloatingPortal>
    );
  }, [currentPhase, floatingStyles, getFloatingProps, onSetPhase, phaseColumns, refs.setFloating, showPhaseMenu]);

  return (
    <div
      className={`floating-transcript-actions agent-elements-floating-transcript-actions absolute right-3 flex gap-2 z-[100] pointer-events-none motion-safe:transition-[top,opacity] motion-safe:duration-150 ${
        searchBarVisible ? 'top-14' : 'top-1.5'
      }`}
      data-testid="agent-elements-floating-transcript-actions"
      data-component="FloatingTranscriptActions"
      data-agent-elements-shell="floating-transcript-actions"
      data-search-bar-visible={searchBarVisible ? 'true' : 'false'}
    >
      {/* Phase Picker Button */}
      {onSetPhase && phaseColumns && (
        <div className="inline-flex">
          <button
            ref={refs.setReference}
            className={FLOATING_PHASE_BUTTON_CLASS}
            aria-label="Set phase"
            aria-expanded={showPhaseMenu}
            title={currentPhase ? `Phase: ${currentPhaseCol?.label || currentPhase}` : 'Set kanban phase'}
            {...getReferenceProps({
              onClick: () => setShowPhaseMenu(open => !open),
            })}
          >
            {currentPhaseCol ? (
              <>
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-[var(--floating-transcript-phase-color)]"
                  style={{ '--floating-transcript-phase-color': currentPhaseCol.color } as React.CSSProperties}
                />
                <span>{currentPhaseCol.label}</span>
              </>
            ) : (
              <>
                <MaterialSymbol icon="view_kanban" size={16} />
                <span className="text-[var(--an-foreground-subtle)]">Phase</span>
              </>
            )}
          </button>
        </div>
      )}
      {phaseMenu}

      {/* Prompts Menu Button */}
      <PromptsMenuButton
        prompts={prompts}
        onNavigateToPrompt={onNavigateToPrompt}
      />

      {/* Toggle History Button - only shown if onToggleSidebar is provided */}
      {onToggleSidebar && (
        <button
          className={FLOATING_ICON_BUTTON_CLASS}
          onClick={onToggleSidebar}
          aria-label={isSidebarCollapsed ? 'Show file history' : 'Hide file history'}
          title={isSidebarCollapsed ? 'Show file history' : 'Hide file history'}
        >
          {isSidebarCollapsed ? (
            <MaterialSymbol icon="schedule" size={20} />
          ) : (
            <MaterialSymbol icon="chevron_right" size={20} />
          )}
        </button>
      )}
    </div>
  );
};
