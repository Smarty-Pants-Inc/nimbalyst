import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getCursorCoordinates } from './typeaheadUtils';

export interface TypeaheadOption {
  id: string;
  label: string;
  description?: string | React.ReactElement;
  icon?: string | React.ReactElement;
  section?: string;
  data?: any;
  disabled?: boolean;
}

interface GenericTypeaheadProps {
  // The textarea/input element to attach to
  anchorElement: HTMLTextAreaElement | HTMLInputElement | null;

  // Options to display
  options: TypeaheadOption[];

  // Currently selected index (in visual order after grouping/sorting)
  selectedIndex: number | null;
  onSelectedIndexChange: (index: number | null) => void;

  // Called when the selected option changes (provides the actual option at visual index)
  onSelectedOptionChange?: (option: TypeaheadOption | null) => void;

  // Selection handler
  onSelect: (option: TypeaheadOption) => void;

  // Close handler
  onClose: () => void;

  // Positioning
  cursorPosition: number;

  // Styling
  className?: string;
  maxHeight?: number;
  minWidth?: number;
  maxWidth?: number;

  // Optional explicit section ordering (sections not listed sort after listed ones, alphabetically)
  sectionOrder?: string[];
}

const typeaheadRootClass =
  'generic-typeahead agent-elements-generic-typeahead agent-elements-tool-card z-[1000] flex flex-col overflow-hidden !gap-0 !p-0 [--agent-elements-card-block-padding:var(--an-spacing-sm)] [--agent-elements-card-inline-padding:var(--an-spacing-md)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_12%,transparent)]';

const typeaheadContentClass =
  'generic-typeahead-content agent-elements-generic-typeahead-content min-h-0 flex-1 overflow-y-auto overflow-x-hidden';

const typeaheadSectionClass =
  'generic-typeahead-section agent-elements-generic-typeahead-section py-[var(--an-spacing-xxs)] [&:not(:last-child)]:border-b [&:not(:last-child)]:border-[var(--an-border-color)]';

const typeaheadSectionHeaderClass =
  'generic-typeahead-section-header agent-elements-generic-typeahead-section-header px-[var(--agent-elements-card-inline-padding)] pb-[var(--an-spacing-xxs)] pt-[var(--an-spacing-xs)] text-[0.6875rem] font-medium uppercase text-[var(--an-foreground-subtle)]';

const typeaheadOptionBaseClass =
  'generic-typeahead-option agent-elements-generic-typeahead-option flex cursor-pointer items-center gap-[var(--an-spacing-sm)] px-[var(--agent-elements-card-inline-padding)] py-[var(--an-spacing-sm)] transition-[background-color,color,opacity] duration-150 ease-out';

const typeaheadOptionSelectedClass =
  'selected bg-[color-mix(in_srgb,var(--an-primary-color)_9%,var(--an-background))]';

const typeaheadOptionDisabledClass = 'disabled cursor-not-allowed opacity-50';

function getTypeaheadTestIdSegment(value: string | null, fallback: string): string {
  return (value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

export function GenericTypeahead({
  anchorElement,
  options,
  selectedIndex,
  onSelectedIndexChange,
  onSelectedOptionChange,
  onSelect,
  onClose,
  cursorPosition,
  className = '',
  maxHeight = 300,
  minWidth = 250,
  maxWidth = 600,
  sectionOrder
}: GenericTypeaheadProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  // Track whether mouse interaction is enabled.
  // This prevents auto-selection when the menu opens under the cursor.
  const [mouseInteractionEnabled, setMouseInteractionEnabled] = useState(false);

  // Disable mouse interaction when menu opens, then enable after a brief delay
  // This prevents the initial mouseenter from selecting the wrong item
  useEffect(() => {
    if (isPositioned) {
      setMouseInteractionEnabled(false);
      const timer = setTimeout(() => {
        setMouseInteractionEnabled(true);
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isPositioned]);

  // Only allow hover selection after mouse interaction is enabled
  const handleOptionMouseEnter = useCallback((index: number) => {
    if (mouseInteractionEnabled) {
      onSelectedIndexChange(index);
    }
  }, [mouseInteractionEnabled, onSelectedIndexChange]);

  // Calculate menu position based on cursor (viewport coordinates for portal)
  useEffect(() => {
    if (!anchorElement) return;

    // Reset positioned state when options change
    setIsPositioned(false);

    // Initial position calculation
    const calculatePosition = () => {
      try {
        const coords = getCursorCoordinates(
          anchorElement as HTMLTextAreaElement,
          cursorPosition
        );

        // Get menu dimensions
        const menuHeight = menuRef.current?.offsetHeight || maxHeight;
        const menuWidth = menuRef.current?.offsetWidth || minWidth;

        // Get textarea position in viewport
        const textareaRect = anchorElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate absolute viewport position
        // coords.left and coords.top are relative to textarea, so add textarea position
        let absoluteLeft = textareaRect.left + coords.left;
        let absoluteTop = textareaRect.top + coords.top - menuHeight - 2; // 2px gap above cursor

        // Ensure menu fits horizontally in viewport
        const padding = 10;
        if (absoluteLeft + menuWidth > viewportWidth - padding) {
          // Shift left to fit
          absoluteLeft = viewportWidth - menuWidth - padding;
        }
        if (absoluteLeft < padding) {
          // Ensure minimum padding from left edge
          absoluteLeft = padding;
        }

        // Ensure menu fits vertically in viewport
        if (absoluteTop < padding) {
          // Not enough space above, position below cursor
          absoluteTop = textareaRect.top + coords.top + 20; // 20px below cursor
        }
        if (absoluteTop + menuHeight > viewportHeight - padding) {
          // Shift up to fit
          absoluteTop = viewportHeight - menuHeight - padding;
        }

        setPosition({ top: absoluteTop, left: absoluteLeft });
        setIsPositioned(true);
      } catch (err) {
        console.error('[GenericTypeahead] Failed to calculate position:', err);
        // Fallback to below textarea
        const textareaRect = anchorElement.getBoundingClientRect();
        setPosition({
          top: textareaRect.bottom + 2,
          left: textareaRect.left
        });
        setIsPositioned(true);
      }
    };

    // Use requestAnimationFrame to ensure DOM has rendered
    const rafId = requestAnimationFrame(() => {
      calculatePosition();
    });

    return () => cancelAnimationFrame(rafId);
  }, [anchorElement, cursorPosition, options.length, maxHeight, minWidth]);

  // Scroll selected option into view
  useEffect(() => {
    if (selectedIndex === null || !menuRef.current) return;

    const selectedElement = menuRef.current.querySelector(
      `[data-option-index="${selectedIndex}"]`
    ) as HTMLElement;

    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorElement &&
        !anchorElement.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anchorElement, onClose]);

  // Handle option click - use mousedown to fire before blur closes the menu
  const handleOptionMouseDown = useCallback((e: React.MouseEvent, option: TypeaheadOption) => {
    e.preventDefault(); // Prevent blur from firing
    if (option.disabled) return;
    onSelect(option);
  }, [onSelect]);

  // Group options by section and create flat ordered list for navigation
  const { groupedOptions, flatOrderedOptions } = React.useMemo(() => {
    const hasSections = options.some(opt => opt.section);
    if (!hasSections) {
      return {
        groupedOptions: [{ section: null as string | null, options }],
        flatOrderedOptions: options
      };
    }

    const groups: Record<string, TypeaheadOption[]> = {};
    options.forEach(opt => {
      const section = opt.section || 'Other';
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(opt);
    });

    const sorted = Object.entries(groups)
      .sort(([a], [b]) => {
        if (sectionOrder) {
          const aIdx = sectionOrder.indexOf(a);
          const bIdx = sectionOrder.indexOf(b);
          // Listed sections come before unlisted ones
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
        }
        return a.localeCompare(b);
      })
      .map(([section, opts]) => ({ section: section as string | null, options: opts }));

    // Create flat array in visual order for navigation
    const flatOrdered = sorted.flatMap(group => group.options);

    return {
      groupedOptions: sorted,
      flatOrderedOptions: flatOrdered
    };
  }, [options, sectionOrder]);

  // Notify parent of the currently selected option (in visual order)
  useEffect(() => {
    if (onSelectedOptionChange) {
      const selectedOption = selectedIndex !== null ? flatOrderedOptions[selectedIndex] : null;
      onSelectedOptionChange(selectedOption ?? null);
    }
  }, [selectedIndex, flatOrderedOptions, onSelectedOptionChange]);

  if (options.length === 0) {
    return null;
  }

  const menuElement = (
    <div
      ref={menuRef}
      className={`${typeaheadRootClass} ${className}`}
      data-component="GenericTypeahead"
      data-agent-elements-shell="generic-typeahead"
      data-testid="agent-elements-generic-typeahead"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxHeight: `${maxHeight}px`,
        minWidth: `${minWidth}px`,
        maxWidth: `${maxWidth}px`,
        opacity: isPositioned ? 1 : 0,
        transition: 'opacity 150ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div className={typeaheadContentClass} data-agent-elements-shell="generic-typeahead-content">
        {groupedOptions.map(({ section, options: sectionOptions }, groupIndex) => (
          <div
            key={section || groupIndex}
            className={typeaheadSectionClass}
            data-agent-elements-shell="generic-typeahead-section"
            data-testid={`agent-elements-generic-typeahead-section-${getTypeaheadTestIdSegment(section, `group-${groupIndex}`)}`}
          >
            {section && (
              <div className={typeaheadSectionHeaderClass}>{section}</div>
            )}
            {sectionOptions.map((option) => {
              // Calculate visual index based on flat ordered list (matches navigation order)
              const visualIndex = flatOrderedOptions.findIndex(opt => opt.id === option.id);
              const isSelected = selectedIndex === visualIndex;
              const optionId = getTypeaheadTestIdSegment(option.id, `option-${visualIndex}`);

              return (
                <div
                  key={option.id}
                  data-option-index={visualIndex}
                  className={`${typeaheadOptionBaseClass} ${
                    isSelected ? typeaheadOptionSelectedClass : 'hover:bg-[var(--an-background-tertiary)]'
                  } ${option.disabled ? typeaheadOptionDisabledClass : ''}`}
                  data-agent-elements-shell="generic-typeahead-option"
                  data-disabled={option.disabled ? 'true' : 'false'}
                  data-selected={isSelected ? 'true' : 'false'}
                  data-testid={`agent-elements-generic-typeahead-option-${optionId}`}
                  onMouseDown={(e) => handleOptionMouseDown(e, option)}
                  onMouseEnter={() => handleOptionMouseEnter(visualIndex)}
                >
                  {option.icon && (
                    typeof option.icon === 'string' ? (
                      <span className="material-symbols-outlined generic-typeahead-option-icon agent-elements-generic-typeahead-option-icon shrink-0 text-lg text-[var(--an-foreground-muted)]">
                        {option.icon}
                      </span>
                    ) : (
                      <span className="generic-typeahead-option-icon agent-elements-generic-typeahead-option-icon shrink-0 text-lg text-[var(--an-foreground-muted)]">
                        {option.icon}
                      </span>
                    )
                  )}
                  <div className="generic-typeahead-option-text agent-elements-generic-typeahead-option-text flex min-w-0 flex-1 flex-col gap-[var(--an-spacing-xxs)]">
                    <div className="generic-typeahead-option-label agent-elements-generic-typeahead-option-label overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-[var(--an-foreground)]">
                      {option.label}
                    </div>
                    {option.description && (
                      <div className="generic-typeahead-option-description agent-elements-generic-typeahead-option-description break-words text-xs leading-snug text-[var(--an-foreground-subtle)]">
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return createPortal(menuElement, document.body);
}
