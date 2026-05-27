import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from 'react';
import { ProviderIcon } from '@nimbalyst/runtime';
import { getRelativeTimeString } from '../utils/dateFormatting';

interface PromptItem {
  id: string;
  sessionId: string;
  content: string;
  createdAt: number;
  sessionTitle: string;
  provider: string;
  parentSessionId?: string | null;
}

const extractPromptText = (content: string): string => {
  try {
    const parsed = JSON.parse(content);
    if (parsed.prompt) return parsed.prompt;
  } catch {
    // Not JSON, return as-is
  }
  return content;
};

const truncatePrompt = (text: string, maxLength = 120): string => {
  const extracted = extractPromptText(text);
  if (extracted.length <= maxLength) return extracted;
  return extracted.substring(0, maxLength) + '...';
};

interface PromptRowProps {
  prompt: PromptItem;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
}

const PromptRow = memo<PromptRowProps>(({ prompt, index, isSelected, onSelect, onHover }) => {
  return (
    <li
      className={`prompt-quick-open-item agent-elements-prompt-quick-open-item mx-2 my-1 py-3 px-3 cursor-pointer rounded-[var(--an-tool-border-radius)] border transition-[background-color,border-color,box-shadow] duration-150 ease-out flex items-start gap-3 ${
        isSelected
          ? 'selected bg-[var(--an-background-tertiary)] border-[var(--an-tool-border-color)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--an-primary-color)_16%,transparent)]'
          : 'border-transparent hover:bg-[var(--an-background-tertiary)] hover:border-[var(--an-tool-border-color)]'
      }`}
      onClick={() => onSelect(index)}
      onMouseEnter={() => onHover(index)}
      data-testid={`agent-elements-prompt-quick-open-item-${index}`}
      data-agent-elements-shell="prompt-quick-open-result"
      data-selected={isSelected ? 'true' : 'false'}
      data-provider={prompt.provider || 'claude'}
      data-workstream={prompt.parentSessionId ? 'true' : 'false'}
    >
      <div className="prompt-quick-open-item-content agent-elements-prompt-quick-open-item-content flex-1 min-w-0">
        <div
          className="prompt-quick-open-item-text agent-elements-prompt-quick-open-item-text text-sm text-[var(--an-foreground)] leading-[1.4] mb-1 overflow-hidden text-ellipsis line-clamp-2"
          data-testid={`agent-elements-prompt-quick-open-item-text-${index}`}
          data-agent-elements-shell="prompt-quick-open-item-text"
        >
          {truncatePrompt(prompt.content)}
        </div>
        <div
          className="prompt-quick-open-item-meta agent-elements-prompt-quick-open-item-meta text-xs text-[var(--an-foreground-subtle)] flex items-center gap-2"
          data-agent-elements-shell="prompt-quick-open-item-meta"
        >
          <span className="prompt-quick-open-session-title agent-elements-prompt-quick-open-session-title flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
            <span
              className="prompt-quick-open-item-icon agent-elements-prompt-quick-open-item-icon shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-[6px] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground-muted)]"
              data-agent-elements-shell="prompt-quick-open-provider-icon"
            >
              <ProviderIcon provider={prompt.provider || 'claude'} size={12} />
            </span>
            {prompt.sessionTitle}
            {prompt.parentSessionId && (
              <span
                className="prompt-quick-open-badge workstream-badge agent-elements-status-pill shrink-0 text-[10px]"
                data-agent-elements-shell="prompt-quick-open-workstream-badge"
              >
                In Workstream
              </span>
            )}
          </span>
          <span
            className="prompt-quick-open-time agent-elements-prompt-quick-open-time shrink-0 ml-auto"
            data-agent-elements-shell="prompt-quick-open-time"
          >
            {getRelativeTimeString(prompt.createdAt)}
          </span>
        </div>
      </div>
    </li>
  );
});

interface PromptQuickOpenProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  onSessionSelect: (sessionId: string, messageTimestamp?: number) => void;
  /** Pre-fill the search input when the modal opens (e.g. from Session Quick Open Tab switch) */
  initialSearchQuery?: string;
}

export const PromptQuickOpen: React.FC<PromptQuickOpenProps> = ({
  isOpen,
  onClose,
  workspacePath,
  onSessionSelect,
  initialSearchQuery,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allPrompts, setAllPrompts] = useState<PromptItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mouseHasMoved, setMouseHasMoved] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLUListElement>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

  // Filter prompts in-memory by content (fast, no database query)
  const displayPrompts = useMemo(() => {
    if (!searchQuery.trim()) {
      return allPrompts;
    }
    const query = searchQuery.toLowerCase();
    return allPrompts.filter(prompt => {
      const promptText = extractPromptText(prompt.content);
      return promptText.toLowerCase().includes(query);
    });
  }, [searchQuery, allPrompts]);

  // Reset list + flip loading flag synchronously before paint so the empty state
  // never flashes "No recent prompts" while the IPC call is in flight.
  useLayoutEffect(() => {
    if (isOpen && workspacePath) {
      setAllPrompts([]);
      setIsLoading(true);
    }
  }, [isOpen, workspacePath]);

  // Load all prompts from canonical transcript events when modal opens
  useEffect(() => {
    if (isOpen && workspacePath) {
      window.electronAPI.ai
        .listUserPrompts(workspacePath)
        .then((result: { success: boolean; prompts: PromptItem[] }) => {
          if (result.success) {
            setAllPrompts(result.prompts);
          }
        })
        .catch(() => {
          // Silently fail - prompts list will remain empty
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, workspacePath]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialSearchQuery || '');
      setSelectedIndex(0);
      setMouseHasMoved(false);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Track mouse movement to distinguish between mouse hover and mouse at rest
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseMove = () => {
      setMouseHasMoved(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsListRef.current) return;

    const items = resultsListRef.current.querySelectorAll('.prompt-quick-open-item');
    const selectedItem = items[selectedIndex] as HTMLElement;

    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const prompt = displayPrompts[selectedIndex];
        if (prompt) {
          handleCopyPrompt(prompt);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < displayPrompts.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          e.preventDefault();
          if (displayPrompts[selectedIndex]) {
            handlePromptSelect(displayPrompts[selectedIndex].sessionId, displayPrompts[selectedIndex].createdAt);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, displayPrompts, onClose]);

  // Clear any pending "copied" feedback timer on unmount or modal close
  useEffect(() => {
    if (!isOpen) {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = null;
      }
      setCopiedPromptId(null);
    }
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const handlePromptSelect = (sessionId: string, createdAt: number) => {
    onSessionSelect(sessionId, createdAt);
    onClose();
  };

  const handleCopyPrompt = (prompt: PromptItem) => {
    const text = extractPromptText(prompt.content);
    void navigator.clipboard.writeText(text);
    setCopiedPromptId(prompt.id);
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    copiedTimeoutRef.current = setTimeout(() => {
      setCopiedPromptId(null);
      copiedTimeoutRef.current = null;
    }, 1200);
  };

  // Stable callbacks for PromptRow so React.memo can bail out on unchanged rows.
  // Latest values are read through refs so the callback identities never change.
  const displayPromptsRef = useRef(displayPrompts);
  displayPromptsRef.current = displayPrompts;
  const mouseHasMovedRef = useRef(mouseHasMoved);
  mouseHasMovedRef.current = mouseHasMoved;
  const handlePromptSelectRef = useRef(handlePromptSelect);
  handlePromptSelectRef.current = handlePromptSelect;

  const onRowSelect = useCallback((index: number) => {
    const prompt = displayPromptsRef.current[index];
    if (prompt) {
      handlePromptSelectRef.current(prompt.sessionId, prompt.createdAt);
    }
  }, []);

  const onRowHover = useCallback((index: number) => {
    if (mouseHasMovedRef.current) {
      setSelectedIndex(index);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="prompt-quick-open-backdrop agent-elements-prompt-quick-open-backdrop fixed inset-0 z-[99998] nim-animate-fade-in bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)]"
        onClick={onClose}
        data-testid="agent-elements-prompt-quick-open-backdrop"
        data-agent-elements-shell="prompt-quick-open-backdrop"
      />
      <div
        className="prompt-quick-open-modal agent-elements-prompt-quick-open agent-elements-tool-card fixed top-[18%] left-1/2 -translate-x-1/2 w-[90vw] max-w-[700px] max-h-[62vh] !gap-0 !p-0 flex flex-col overflow-hidden rounded-[var(--an-border-radius)] z-[99999] bg-[var(--an-background)] border border-[var(--an-border-color)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)]"
        data-testid="agent-elements-prompt-quick-open"
        data-component="PromptQuickOpen"
        data-agent-elements-shell="prompt-quick-open"
      >
        {copiedPromptId && (
          <div
            className="prompt-quick-open-copied-toast agent-elements-prompt-quick-open-copied-toast absolute top-2 left-1/2 -translate-x-1/2 z-10"
            data-testid="prompt-quick-open-copied-toast"
            data-agent-elements-shell="prompt-quick-open-copied-toast"
          >
            <span
              className="agent-elements-status-pill"
              data-testid="agent-elements-prompt-quick-open-copied-toast"
            >
              Copied to clipboard
            </span>
          </div>
        )}
        <div
          className="prompt-quick-open-header agent-elements-prompt-quick-open-header p-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)]"
          data-testid="agent-elements-prompt-quick-open-header"
          data-agent-elements-shell="prompt-quick-open-header"
        >
          <div className="prompt-quick-open-title agent-elements-prompt-quick-open-title text-[12px] font-medium text-[var(--an-foreground-muted)] mb-2">
            Prompts
          </div>
          <input
            ref={searchInputRef}
            type="text"
            className="prompt-quick-open-search agent-elements-prompt-quick-open-input w-full py-2 px-3 text-sm rounded-[var(--an-input-border-radius)] outline-none box-border bg-[var(--an-input-background)] border border-[var(--an-input-border-color)] text-[var(--an-input-color)] placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            placeholder="Search your prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="agent-elements-prompt-quick-open-input"
            data-agent-elements-shell="prompt-quick-open-input"
          />
        </div>

        <div
          className="prompt-quick-open-results agent-elements-prompt-quick-open-results flex-1 overflow-y-auto min-h-[200px] py-1"
          data-testid="agent-elements-prompt-quick-open-results"
          data-agent-elements-shell="prompt-quick-open-results"
        >
          {displayPrompts.length === 0 ? (
            <div
              className="prompt-quick-open-empty agent-elements-prompt-quick-open-empty p-10 text-center text-[var(--an-foreground-subtle)]"
              data-testid="agent-elements-prompt-quick-open-empty"
              data-agent-elements-shell="prompt-quick-open-empty"
            >
              {isLoading
                ? 'Loading…'
                : searchQuery
                  ? 'No prompts found'
                  : 'No recent prompts'}
            </div>
          ) : (
            <ul
              className={`prompt-quick-open-list agent-elements-prompt-quick-open-list list-none m-0 p-0 ${mouseHasMoved ? '' : 'pointer-events-none'}`}
              ref={resultsListRef}
              data-agent-elements-shell="prompt-quick-open-list"
            >
              {displayPrompts.map((prompt, index) => (
                <PromptRow
                  key={prompt.id}
                  prompt={prompt}
                  index={index}
                  isSelected={index === selectedIndex}
                  onSelect={onRowSelect}
                  onHover={onRowHover}
                />
              ))}
            </ul>
          )}
        </div>

        <div
          className="prompt-quick-open-footer agent-elements-prompt-quick-open-footer py-2 px-4 border-t border-[var(--an-border-color)] flex gap-4 bg-[var(--an-background-secondary)]"
          data-testid="agent-elements-prompt-quick-open-footer"
          data-agent-elements-shell="prompt-quick-open-footer"
        >
          <span className="prompt-quick-open-hint agent-elements-prompt-quick-open-hint text-[11px] text-[var(--an-foreground-subtle)] flex items-center gap-1">
            <kbd className="agent-elements-prompt-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">Up/Down</kbd> Navigate
          </span>
          <span className="prompt-quick-open-hint agent-elements-prompt-quick-open-hint text-[11px] text-[var(--an-foreground-subtle)] flex items-center gap-1">
            <kbd className="agent-elements-prompt-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">Enter</kbd> Open
          </span>
          <span className="prompt-quick-open-hint agent-elements-prompt-quick-open-hint text-[11px] text-[var(--an-foreground-subtle)] flex items-center gap-1">
            <kbd className="agent-elements-prompt-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">{isMac ? '⌘' : 'Ctrl'}</kbd>
            <kbd className="agent-elements-prompt-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">Enter</kbd> Copy
          </span>
          <span className="prompt-quick-open-hint agent-elements-prompt-quick-open-hint text-[11px] text-[var(--an-foreground-subtle)] flex items-center gap-1">
            <kbd className="agent-elements-prompt-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">Esc</kbd> Close
          </span>
        </div>
      </div>
    </>
  );
};
