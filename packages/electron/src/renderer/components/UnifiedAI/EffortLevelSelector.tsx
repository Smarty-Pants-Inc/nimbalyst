import React, { useState, useRef, useEffect } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import type { EffortLevel } from '../../utils/modelUtils';
import { EFFORT_LEVELS, DEFAULT_EFFORT_LEVEL } from '../../utils/modelUtils';

interface EffortLevelSelectorProps {
  level: EffortLevel;
  onLevelChange: (level: EffortLevel) => void;
}

export function EffortLevelSelector({ level, onLevelChange }: EffortLevelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const currentLevel = EFFORT_LEVELS.find(l => l.key === level) ?? EFFORT_LEVELS.find(l => l.key === DEFAULT_EFFORT_LEVEL)!;

  return (
    <div
      className="effort-level-selector agent-elements-effort-level-selector relative inline-block"
      data-agent-elements-shell="effort-level-selector"
      data-component="UnifiedAIEffortLevelSelector"
      data-effort-level={currentLevel.key}
      data-testid="agent-elements-effort-level-selector"
      ref={dropdownRef}
    >
      <button
        data-testid="effort-level-selector"
        className="effort-level-selector-trigger agent-elements-effort-level-trigger agent-elements-status-pill flex cursor-pointer items-center gap-[var(--an-spacing-xxs)] whitespace-nowrap rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)] text-[11px] font-medium text-[var(--an-foreground-muted)] outline-none transition-[background-color,border-color,color] duration-150 hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Effort level: ${currentLevel.label}`}
        type="button"
      >
        <MaterialSymbol icon="psychology" size={12} />
        <span>{currentLevel.label}</span>
        <MaterialSymbol icon="expand_more" size={14} className={`transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="effort-level-selector-menu agent-elements-effort-level-menu absolute bottom-full left-0 z-[1000] mb-[var(--an-spacing-xs)] min-w-[120px] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-xs)]"
          data-agent-elements-shell="effort-level-menu"
          data-testid="agent-elements-effort-level-menu"
          role="menu"
        >
          {EFFORT_LEVELS.map(l => (
            <button
              key={l.key}
              className={`effort-level-selector-option agent-elements-effort-level-option flex w-full cursor-pointer items-center justify-between gap-[var(--an-spacing-sm)] rounded-[calc(var(--an-tool-border-radius)_-_4px)] border-none px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-left text-xs transition-[background-color,color] duration-150 ${l.key === level ? 'bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]' : 'bg-transparent text-[var(--an-foreground)] hover:bg-[var(--an-background-tertiary)]'}`}
              data-effort-level={l.key}
              data-testid="agent-elements-effort-level-option"
              onClick={() => { onLevelChange(l.key); setIsOpen(false); }}
              aria-checked={l.key === level}
              role="menuitemradio"
              type="button"
            >
              <span>{l.label}</span>
              {l.key === level && (
                <span aria-hidden="true" className="shrink-0">
                  <MaterialSymbol icon="check" size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
