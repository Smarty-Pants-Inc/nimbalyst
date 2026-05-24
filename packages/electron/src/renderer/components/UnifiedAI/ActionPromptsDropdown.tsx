import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { usePostHog } from 'posthog-js/react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { FloatingPortal, useFloatingMenu } from '../../hooks/useFloatingMenu';
import {
  actionPromptsAtomFamily,
  type ActionPrompt,
} from '../../store/atoms/actionPrompts';

interface ActionPromptsDropdownProps {
  workspacePath: string;
  /**
   * Called with the action body when the user picks an action whose config is
   * `launch: same-session` (or has no config at all). The composer should
   * replace its draft with this string and push an undo snapshot.
   */
  onInsert: (body: string) => void;
  /**
   * Called when the user picks an action whose config is `launch: new-session`.
   * If omitted, the dropdown falls back to the same-session insert path so
   * the action still does something useful.
   */
  onLaunchNewSession?: (action: ActionPrompt) => void | Promise<void>;
}

function firstLinePreview(body: string, maxLen = 80): string {
  const firstLine = body.split('\n').find((line) => line.trim().length > 0) ?? '';
  const trimmed = firstLine.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen - 1) + '…';
}

export function ActionPromptsDropdown({ workspacePath, onInsert, onLaunchNewSession }: ActionPromptsDropdownProps) {
  const state = useAtomValue(actionPromptsAtomFamily(workspacePath));
  const setState = useSetAtom(actionPromptsAtomFamily(workspacePath));
  const posthog = usePostHog();

  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const menu = useFloatingMenu({
    placement: 'top-end',
    offsetPx: 6,
    constrainHeight: false,
  });

  // First-load fetch when the workspace changes. We always (re)load on mount
  // for the current workspace so the dropdown reflects fresh state without
  // relying on a broadcast that only fires on subsequent changes.
  useEffect(() => {
    if (!workspacePath) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await window.electronAPI?.invoke?.('action-prompts:list', { workspacePath });
        if (cancelled || !result) return;
        setState({
          actions: result.actions ?? [],
          diagnostics: result.diagnostics ?? [],
          filePath: result.filePath ?? null,
          fileExists: result.fileExists ?? false,
          loaded: true,
        });
      } catch (err) {
        console.error('[ActionPromptsDropdown] Failed to load action prompts:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspacePath, setState]);

  const actions = state.actions;
  const hasActions = actions.length > 0;
  const showSeedCta = state.loaded && !state.fileExists;

  // Reset highlight when opening or when the list changes.
  useEffect(() => {
    if (menu.isOpen) {
      setHighlightedIndex(0);
    }
  }, [menu.isOpen, actions.length]);

  const handleSelect = useCallback(
    (action: ActionPrompt) => {
      const isLauncher = action.config?.launch === 'new-session';
      if (isLauncher && onLaunchNewSession) {
        void onLaunchNewSession(action);
        menu.setIsOpen(false);
        try {
          posthog?.capture('action_prompt_launched_new_session', {
            actionCount: actions.length,
            bodyLength: action.body.length,
            model: action.config?.model ?? null,
            foreground: action.config?.foreground ?? true,
            autoSubmit: action.config?.autoSubmit ?? true,
            worktree: action.config?.worktree ?? false,
          });
        } catch {
          // analytics is best-effort
        }
        return;
      }

      onInsert(action.body);
      menu.setIsOpen(false);
      try {
        posthog?.capture('action_prompt_inserted', {
          actionCount: actions.length,
          bodyLength: action.body.length,
        });
      } catch {
        // analytics is best-effort
      }
    },
    [onInsert, onLaunchNewSession, menu, posthog, actions.length]
  );

  const handleSeed = useCallback(async () => {
    try {
      await window.electronAPI?.invoke?.('action-prompts:open-file', { workspacePath });
      // Refresh list — the file watcher will also broadcast, but we kick a
      // refresh now so the dropdown reflects the seeded content immediately.
      const result = await window.electronAPI?.invoke?.('action-prompts:list', { workspacePath });
      if (result) {
        setState({
          actions: result.actions ?? [],
          diagnostics: result.diagnostics ?? [],
          filePath: result.filePath ?? null,
          fileExists: result.fileExists ?? false,
          loaded: true,
        });
      }
    } catch (err) {
      console.error('[ActionPromptsDropdown] Failed to seed ai-actions.md:', err);
    } finally {
      menu.setIsOpen(false);
    }
  }, [workspacePath, setState, menu]);

  const handleEditFile = useCallback(async () => {
    try {
      await window.electronAPI?.invoke?.('action-prompts:open-file', { workspacePath });
    } catch (err) {
      console.error('[ActionPromptsDropdown] Failed to open ai-actions.md:', err);
    } finally {
      menu.setIsOpen(false);
    }
  }, [workspacePath, menu]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!hasActions) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % actions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + actions.length) % actions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const action = actions[highlightedIndex];
        if (action) handleSelect(action);
      }
    },
    [hasActions, actions, highlightedIndex, handleSelect]
  );

  // Scroll the highlighted item into view as the user navigates with arrows.
  useEffect(() => {
    if (!menu.isOpen) return;
    const el = itemRefs.current[highlightedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, menu.isOpen]);

  const buttonLabel = useMemo(() => 'Actions', []);
  const triggerClass = [
    'action-prompts-dropdown-button',
    'agent-elements-action-prompts-trigger',
    'agent-elements-status-pill',
    'flex items-center gap-[var(--an-spacing-xs)] whitespace-nowrap',
    'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[var(--an-border-color)]',
    'bg-[var(--an-background-secondary)] px-[var(--an-spacing-sm)] py-[3px]',
    'text-[11px] font-medium text-[var(--an-foreground-muted)] outline-none',
    'cursor-pointer transition-[background-color,border-color,color] duration-150',
    'hover:border-[var(--an-border-color-strong)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
    'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
  ].join(' ');

  const panelClass = [
    'action-prompts-dropdown-panel',
    'agent-elements-action-prompts-menu',
    'z-[1000] min-w-[260px] max-w-[360px]',
    'rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]',
    'bg-[var(--an-background)] p-[var(--an-spacing-xxs)]',
  ].join(' ');

  const itemClass = (isHighlighted: boolean) => [
    'action-prompts-dropdown-item',
    'agent-elements-action-prompts-item',
    'flex w-full flex-col items-start gap-[var(--an-spacing-xxs)]',
    'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border-none px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]',
    'cursor-pointer text-left text-[var(--an-foreground)]',
    'transition-[background-color,color] duration-150',
    isHighlighted ? 'bg-[var(--an-background-tertiary)]' : 'bg-transparent',
  ].join(' ');

  return (
    <>
      <button
        ref={menu.refs.setReference as React.RefCallback<HTMLButtonElement>}
        {...menu.getReferenceProps()}
        type="button"
        data-testid="action-prompts-dropdown"
        className={triggerClass}
        onClick={() => menu.setIsOpen(!menu.isOpen)}
        aria-label={`${buttonLabel} (${actions.length})`}
        aria-haspopup="menu"
        aria-expanded={menu.isOpen}
        data-agent-elements-shell="action-prompts-trigger"
        data-component="UnifiedAIActionPromptsDropdown"
      >
        <MaterialSymbol icon="bolt" size={12} />
        <span>{buttonLabel}</span>
        <MaterialSymbol
          icon="expand_more"
          size={14}
          className={`shrink-0 transition-transform duration-150 ${menu.isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {menu.isOpen && (
        <FloatingPortal>
          <div
            ref={menu.refs.setFloating as React.RefCallback<HTMLDivElement>}
            style={menu.floatingStyles}
            {...menu.getFloatingProps()}
            onKeyDown={handleKeyDown}
            tabIndex={-1}
            data-testid="action-prompts-dropdown-panel"
            className={panelClass}
            role="menu"
            data-agent-elements-shell="action-prompts-menu"
            data-component="UnifiedAIActionPromptsDropdownMenu"
            data-action-count={actions.length}
          >
            <div className="action-prompts-dropdown-header flex items-center justify-between px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-[10px] font-medium text-[var(--an-foreground-subtle)]">
              <span>{state.fileExists ? 'From ai-actions.md' : 'Action prompts'}</span>
              {state.fileExists && (
                <span className="text-[10px] text-[var(--an-foreground-subtle)]">
                  {actions.length}
                </span>
              )}
            </div>

            {showSeedCta && (
              <div className="agent-elements-action-prompts-empty flex flex-col gap-[var(--an-spacing-sm)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-sm)]">
                <p className="text-xs leading-snug text-[var(--an-foreground-muted)]">
                  No <code className="rounded-[var(--an-radius-xs)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xxs)] text-[var(--an-foreground)]">ai-actions.md</code> in this workspace yet. Seed it with a few example
                  prompts you can edit.
                </p>
                <button
                  type="button"
                  className="agent-elements-action-prompts-seed cursor-pointer rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-left text-[11px] font-medium text-[var(--an-foreground)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-border-color-strong)] hover:bg-[var(--an-background-tertiary)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
                  onClick={handleSeed}
                  data-testid="action-prompts-seed-button"
                >
                  Create ai-actions.md with examples
                </button>
              </div>
            )}

            {state.fileExists && !hasActions && (
              <div className="agent-elements-action-prompts-empty px-[var(--an-spacing-sm)] py-[var(--an-spacing-md)] text-xs leading-snug text-[var(--an-foreground-muted)]">
                <code className="rounded-[var(--an-radius-xs)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xxs)] text-[var(--an-foreground)]">ai-actions.md</code> has no <code className="rounded-[var(--an-radius-xs)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xxs)] text-[var(--an-foreground)]">## Heading</code> sections yet. Open the file
                and add one to get started.
              </div>
            )}

            {hasActions && (
              <div className="action-prompts-dropdown-list max-h-[320px] overflow-y-auto py-[var(--an-spacing-xs)]">
                {actions.map((action, idx) => {
                  const isLauncher = action.config?.launch === 'new-session';
                  const launcherSubtitle = isLauncher
                    ? `Opens new session${action.config?.model ? ` · ${action.config.model}` : ''}`
                    : null;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      onClick={() => handleSelect(action)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      data-testid={`action-prompt-item-${action.id}`}
                      data-action-launch={isLauncher ? 'new-session' : 'same-session'}
                      className={itemClass(idx === highlightedIndex)}
                      role="menuitem"
                      data-highlighted={idx === highlightedIndex}
                      data-action-prompt-id={action.id}
                    >
                      <span className="flex min-w-0 flex-1 flex-col items-start gap-[var(--an-spacing-xxs)]">
                        <span className="text-[12px] font-medium leading-tight">{action.label}</span>
                        <span className="w-full truncate text-[11px] leading-tight text-[var(--an-foreground-muted)]">
                          {launcherSubtitle ?? firstLinePreview(action.body)}
                        </span>
                      </span>
                      {isLauncher && (
                        <MaterialSymbol
                          icon="open_in_new"
                          size={14}
                          className="mt-0.5 shrink-0 text-[var(--an-foreground-subtle)]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="action-prompts-dropdown-footer mt-[var(--an-spacing-xs)] border-t border-[var(--an-border-color)] pt-[var(--an-spacing-xs)]">
              <button
                type="button"
                className="agent-elements-action-prompts-edit flex w-full cursor-pointer items-center gap-[var(--an-spacing-xs)] rounded-[calc(var(--an-tool-border-radius)_-_4px)] border-none bg-transparent px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-left text-[11px] text-[var(--an-foreground-muted)] transition-[background-color,color] duration-150 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
                onClick={handleEditFile}
                data-testid="action-prompts-edit-link"
                role="menuitem"
              >
                <MaterialSymbol icon="edit" size={12} />
                <span>{state.fileExists ? 'Edit actions…' : 'Open ai-actions.md…'}</span>
              </button>
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
