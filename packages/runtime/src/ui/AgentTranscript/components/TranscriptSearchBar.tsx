import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MaterialSymbol } from '../../icons/MaterialSymbol';
import type { TranscriptViewMessage } from '../../../ai/server/transcript/TranscriptProjector';

const SEARCH_ROOT_CLASS =
  'transcript-search-bar agent-elements-transcript-search-bar sticky top-0 z-10 border-b border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] px-3 py-2';
const SEARCH_CONTENT_CLASS =
  'transcript-search-bar-content agent-elements-transcript-search-bar-content mx-auto flex max-w-4xl items-center gap-2';
const SEARCH_INPUT_CLASS =
  'transcript-search-input agent-elements-transcript-search-input min-w-0 flex-1 rounded-[var(--an-radius-sm)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-2.5 py-1.5 text-sm text-[var(--an-input-color)] outline-none motion-safe:transition-colors motion-safe:duration-150 placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]';
const SEARCH_BUTTON_CLASS =
  'transcript-search-button agent-elements-transcript-search-button inline-flex h-8 w-8 items-center justify-center rounded-[var(--an-radius-sm)] border border-[var(--an-tool-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] cursor-pointer motion-safe:transition-colors motion-safe:duration-150 hover:bg-[var(--an-background-secondary)] hover:border-[var(--an-primary-color)] hover:text-[var(--an-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-40';
const SEARCH_CASE_BUTTON_CLASS = `${SEARCH_BUTTON_CLASS} transcript-search-case-button min-w-8 px-2 text-xs font-semibold font-mono data-[active=true]:bg-[var(--an-primary-color)] data-[active=true]:border-[var(--an-primary-color)] data-[active=true]:text-[var(--an-button-primary-text)]`;
const SEARCH_CLOSE_BUTTON_CLASS = `${SEARCH_BUTTON_CLASS} transcript-search-close-button ml-1`;

// Augment the HighlightRegistry interface to add Map-like methods
// (TypeScript's lib.dom.d.ts has the interface but not the full Map extension without DOM.Iterable)
declare global {
  interface HighlightRegistry {
    set(name: string, highlight: Highlight): this;
    delete(name: string): boolean;
    get(name: string): Highlight | undefined;
    has(name: string): boolean;
    clear(): void;
  }
}

const getHighlightRegistry = (): HighlightRegistry | null => {
  return typeof CSS !== 'undefined' && CSS.highlights ? CSS.highlights : null;
};

// Inject search highlight styles once
const injectHighlightStyles = () => {
  const styleId = 'transcript-search-highlight-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* CSS Custom Highlight API styles */
    ::highlight(transcript-search) {
      background-color: color-mix(in srgb, var(--an-warning) 35%, transparent);
    }
    ::highlight(transcript-search-current) {
      background-color: var(--an-warning);
    }
  `;
  document.head.appendChild(style);
};

/**
 * TranscriptSearchBar - Find-in-page search UI for agent transcript messages.
 *
 * Uses the CSS Custom Highlight API for highlighting, which is specifically designed
 * for "find-on-page over virtualized documents" (per MDN). This API:
 * - Doesn't modify the DOM structure
 * - Works efficiently with virtualized lists
 * - Automatically handles elements being added/removed from DOM
 *
 * Features:
 * - Searches message content data to find all matches
 * - Works with virtualized lists (VList) where most messages aren't in DOM
 * - Uses CSS Custom Highlight API for efficient text highlighting
 * - Scrolls to message containing current match
 * - Supports case-sensitive and case-insensitive search modes
 */

interface SearchMatch {
  messageIndex: number;
  offset: number;
  length: number;
}

interface TranscriptSearchBarProps {
  isVisible: boolean;
  messages: TranscriptViewMessage[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onScrollToMessage: (index: number) => void;
}

export const TranscriptSearchBar: React.FC<TranscriptSearchBarProps> = ({
  isVisible,
  messages,
  containerRef,
  onClose,
  onScrollToMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [highlightedMessageIndices, setHighlightedMessageIndices] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Inject highlight styles on mount
  useEffect(() => {
    injectHighlightStyles();
  }, []);

  // Navigate to next match
  const goToNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    const nextIndex = (currentIndex + 1) % matches.length;
    setCurrentIndex(nextIndex);
    onScrollToMessage(matches[nextIndex].messageIndex);
  }, [matches, currentIndex, onScrollToMessage]);

  // Navigate to previous match
  const goToPrevMatch = useCallback(() => {
    if (matches.length === 0) return;
    const prevIndex = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prevIndex);
    onScrollToMessage(matches[prevIndex].messageIndex);
  }, [matches, currentIndex, onScrollToMessage]);

  // Focus input when search bar becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isVisible]);

  // Listen for Cmd+G navigation events from parent
  useEffect(() => {
    if (!isVisible) return;

    const handleNext = () => goToNextMatch();
    const handlePrev = () => goToPrevMatch();

    window.addEventListener('transcript-search-next', handleNext);
    window.addEventListener('transcript-search-prev', handlePrev);

    return () => {
      window.removeEventListener('transcript-search-next', handleNext);
      window.removeEventListener('transcript-search-prev', handlePrev);
    };
  }, [isVisible, goToNextMatch, goToPrevMatch]);

  // Clear highlights using CSS Custom Highlight API
  const clearHighlights = useCallback(() => {
    const highlights = getHighlightRegistry();
    highlights?.delete('transcript-search');
    highlights?.delete('transcript-search-current');
  }, []);

  // Clear state when component becomes hidden
  useEffect(() => {
    if (!isVisible) {
      clearHighlights();
      setSearchQuery('');
      setMatches([]);
      setCurrentIndex(0);
      setHighlightedMessageIndices(new Set());
    }
  }, [isVisible, clearHighlights]);

  // Search for matches in message data (not DOM)
  const performSearch = useCallback(
    (query: string) => {
      if (!query) {
        clearHighlights();
        setMatches([]);
        setCurrentIndex(0);
        setHighlightedMessageIndices(new Set());
        return;
      }

      const newMatches: SearchMatch[] = [];
      const messageIndicesWithMatches = new Set<number>();
      const searchRegex = new RegExp(
        query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        caseSensitive ? 'g' : 'gi'
      );

      // Search through user and assistant messages only (skip tool messages for now)
      messages.forEach((message, messageIndex) => {
        // Skip tool messages - their content is in collapsed UI elements
        if (message.type === 'tool_call' || message.type === 'interactive_prompt' || message.type === 'subagent') return;

        const content = message.text || '';
        let match: RegExpExecArray | null;

        searchRegex.lastIndex = 0;
        while ((match = searchRegex.exec(content))) {
          newMatches.push({
            messageIndex,
            offset: match.index,
            length: match[0].length,
          });
          messageIndicesWithMatches.add(messageIndex);
        }
      });

      setMatches(newMatches);
      setHighlightedMessageIndices(messageIndicesWithMatches);
      setCurrentIndex(newMatches.length > 0 ? 0 : -1);

      // Scroll to first match
      if (newMatches.length > 0) {
        onScrollToMessage(newMatches[0].messageIndex);
      }
    },
    [messages, caseSensitive, clearHighlights, onScrollToMessage]
  );

  // Update highlights using CSS Custom Highlight API
  const updateHighlights = useCallback(() => {
    if (!containerRef.current || !searchQuery || matches.length === 0) return;
    const highlights = getHighlightRegistry();
    if (!highlights || typeof Highlight === 'undefined') return;

    // Clear existing highlights
    highlights.delete('transcript-search');
    highlights.delete('transcript-search-current');
    const allRanges: Range[] = [];
    const currentRanges: Range[] = [];

    // Track which match index we're on globally
    let globalMatchCounter = 0;

    // Find all rendered message elements and create Range objects for highlights
    const messageElements = containerRef.current.querySelectorAll('.rich-transcript-message');

    messageElements.forEach((messageElement) => {
      const key = messageElement.getAttribute('data-message-index');
      if (!key) return;

      const messageIndex = parseInt(key, 10);
      if (isNaN(messageIndex) || !highlightedMessageIndices.has(messageIndex)) return;

      // Find the message content area (not the header with timestamp, sender, etc.)
      const contentElement = messageElement.querySelector('.rich-transcript-message-content') || messageElement;

      // Find text matches within this element
      const searchRegex = new RegExp(
        searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        caseSensitive ? 'g' : 'gi'
      );

      // Walk text nodes in the message content only
      const walker = document.createTreeWalker(
        contentElement,
        NodeFilter.SHOW_TEXT,
        null
      );

      let textNode: Node | null;

      while ((textNode = walker.nextNode())) {
        const text = textNode.textContent || '';
        if (text.length === 0) continue;

        let match: RegExpExecArray | null;
        searchRegex.lastIndex = 0;

        while ((match = searchRegex.exec(text))) {
          try {
            const range = document.createRange();
            range.setStart(textNode, match.index);
            range.setEnd(textNode, match.index + match[0].length);

            const isCurrentMatchHighlight = globalMatchCounter === currentIndex;

            if (isCurrentMatchHighlight) {
              currentRanges.push(range);
            } else {
              allRanges.push(range);
            }

            globalMatchCounter++;
          } catch {
            // Range creation can fail if offsets are invalid
          }
        }
      }
    });

    // Register the highlights with the CSS Custom Highlight API
    if (allRanges.length > 0) {
      const highlight = new Highlight(...allRanges);
      highlights.set('transcript-search', highlight);
    }

    if (currentRanges.length > 0) {
      const currentHighlight = new Highlight(...currentRanges);
      highlights.set('transcript-search-current', currentHighlight);
    }
  }, [containerRef, searchQuery, matches, currentIndex, highlightedMessageIndices, caseSensitive]);

  // Perform search when query or case sensitivity changes (debounced)
  // Note: we intentionally exclude performSearch from deps to avoid re-running on every render
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 100);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, caseSensitive]);

  // Update highlights when matches or currentIndex changes
  // Note: we intentionally exclude updateHighlights from deps to avoid infinite loops
  useEffect(() => {
    if (isVisible && searchQuery && matches.length > 0) {
      const timeoutId = setTimeout(() => {
        updateHighlights();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, searchQuery, matches, currentIndex]);

  // Watch for scroll and DOM changes to update highlights
  useEffect(() => {
    if (!isVisible || !searchQuery || !containerRef.current || matches.length === 0) return;

    let rafId: number | null = null;

    // Throttled update using requestAnimationFrame
    const throttledUpdate = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        updateHighlights();
        rafId = null;
      });
    };

    // Update highlights on scroll (VList re-renders elements when scrolling)
    const scrollContainer = containerRef.current.querySelector('.rich-transcript-vlist') || containerRef.current;
    scrollContainer.addEventListener('scroll', throttledUpdate, { passive: true });

    // Watch for VList rendering new message elements (not scroll button or other UI changes)
    const vlistInner = scrollContainer.firstElementChild;
    if (!vlistInner) return;

    const observer = new MutationObserver((mutations) => {
      // Only update if message elements were added/removed, not other UI elements
      const hasMessageChange = mutations.some(mutation => {
        return Array.from(mutation.addedNodes).some(node =>
          node instanceof HTMLElement && node.classList?.contains('rich-transcript-message')
        ) || Array.from(mutation.removedNodes).some(node =>
          node instanceof HTMLElement && node.classList?.contains('rich-transcript-message')
        );
      });
      if (hasMessageChange) {
        throttledUpdate();
      }
    });

    observer.observe(vlistInner, {
      childList: true,
    });

    return () => {
      scrollContainer.removeEventListener('scroll', throttledUpdate);
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, searchQuery, matches.length]);

  // Cleanup highlights on unmount
  useEffect(() => {
    return () => {
      const highlights = getHighlightRegistry();
      highlights?.delete('transcript-search');
      highlights?.delete('transcript-search-current');
    };
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isVisible) {
    return null;
  }

  const matchCount = matches.length;
  const displayIndex = matchCount > 0 ? currentIndex + 1 : 0;

  return (
    <div
      className={SEARCH_ROOT_CLASS}
      data-testid="agent-elements-transcript-search-bar"
      data-component="TranscriptSearchBar"
      data-agent-elements-shell="transcript-search-bar"
    >
      <div className={SEARCH_CONTENT_CLASS}>
        <input
          ref={inputRef}
          type="text"
          className={SEARCH_INPUT_CLASS}
          placeholder="Find in transcript..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div
          className="transcript-search-match-counter agent-elements-transcript-search-counter min-w-20 whitespace-nowrap text-center text-xs text-[var(--an-foreground-muted)]"
          data-testid="agent-elements-transcript-search-counter"
        >
          {matchCount > 0 ? `${displayIndex} of ${matchCount}` : 'No matches'}
        </div>

        <button
          className={SEARCH_BUTTON_CLASS}
          onClick={goToPrevMatch}
          disabled={matchCount === 0}
          aria-label="Previous transcript search match"
          title="Previous match (Shift+Enter or Cmd+Shift+G)"
        >
          <MaterialSymbol icon="keyboard_arrow_up" size={18} />
        </button>

        <button
          className={SEARCH_BUTTON_CLASS}
          onClick={goToNextMatch}
          disabled={matchCount === 0}
          aria-label="Next transcript search match"
          title="Next match (Enter or Cmd+G)"
        >
          <MaterialSymbol icon="keyboard_arrow_down" size={18} />
        </button>

        <button
          className={SEARCH_CASE_BUTTON_CLASS}
          onClick={() => setCaseSensitive(!caseSensitive)}
          aria-label={caseSensitive ? 'Case sensitive transcript search' : 'Case insensitive transcript search'}
          aria-pressed={caseSensitive}
          title={caseSensitive ? 'Case sensitive' : 'Case insensitive'}
          data-active={caseSensitive ? 'true' : 'false'}
        >
          Aa
        </button>

        <button
          className={SEARCH_CLOSE_BUTTON_CLASS}
          onClick={onClose}
          aria-label="Close transcript search"
          title="Close (Escape)"
        >
          <MaterialSymbol icon="close" size={18} />
        </button>
      </div>
    </div>
  );
};
