import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import { diffLines } from 'diff';
import { generateUnifiedDiff } from '@nimbalyst/runtime';

export interface TextDiffNavigationState {
  currentIndex: number;
  totalGroups: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  addedLines: number;
  removedLines: number;
}

interface TextDiffViewerProps {
  oldText: string;
  newText: string;
  onNavigationStateChange?: (state: TextDiffNavigationState) => void;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
}

interface DiffLine {
  content: string;
  type: 'added' | 'removed' | 'unchanged';
  lineNumber?: number;
}

interface ChangeGroup {
  startIndex: number;
  endIndex: number;
  type: 'addition' | 'deletion' | 'modification';
}

const rootClass =
  'text-diff-viewer agent-elements-text-diff-viewer flex h-full w-full flex-col overflow-hidden bg-[var(--an-background)] p-[var(--an-spacing-md)] text-[var(--an-foreground)] @container/text-diff-viewer';
const panelsClass =
  'text-diff-panels agent-elements-text-diff-panels flex min-h-0 flex-1 gap-[var(--an-spacing-md)] overflow-hidden @max-[760px]/text-diff-viewer:flex-col';
const panelBaseClass =
  'text-diff-panel agent-elements-text-diff-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)]';
const headerBaseClass =
  'text-diff-header agent-elements-text-diff-header flex min-h-9 items-center border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-[13px] font-medium leading-5';
const contentClass =
  'text-diff-content agent-elements-text-diff-content nim-scrollbar min-h-0 flex-1 overflow-auto bg-[var(--an-background)]';
const linesClass =
  'text-diff-lines agent-elements-text-diff-lines font-mono text-xs leading-4 text-[var(--an-foreground)]';
const lineBaseClass =
  'text-diff-line agent-elements-text-diff-line flex min-h-5 min-w-0 transition-[background-color,color] duration-150 ease-out';
const lineNumberBaseClass =
  'text-diff-line-number agent-elements-text-diff-line-number w-12 shrink-0 border-r border-[var(--an-border-color)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)] text-right text-[11px] leading-4 select-none';
const lineContentBaseClass =
  'text-diff-line-content agent-elements-text-diff-line-content min-w-0 flex-1 whitespace-pre-wrap break-words px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)] leading-4 select-text';

function getDiffLineClass(type: DiffLine['type']): string {
  if (type === 'added') return `${lineBaseClass} cursor-pointer bg-[var(--an-diff-added-bg)] text-[var(--an-diff-added-text)]`;
  if (type === 'removed') return `${lineBaseClass} cursor-pointer bg-[var(--an-diff-removed-bg)] text-[var(--an-diff-removed-text)]`;
  return `${lineBaseClass} cursor-default text-[var(--an-foreground)]`;
}

function getLineNumberClass(type: DiffLine['type']): string {
  if (type === 'added') {
    return `${lineNumberBaseClass} bg-[color-mix(in_srgb,var(--an-diff-added-text)_10%,var(--an-background))] text-[var(--an-diff-added-text)]`;
  }
  if (type === 'removed') {
    return `${lineNumberBaseClass} bg-[color-mix(in_srgb,var(--an-diff-removed-text)_10%,var(--an-background))] text-[var(--an-diff-removed-text)]`;
  }
  return `${lineNumberBaseClass} bg-[var(--an-background-secondary)] text-[var(--an-foreground-subtle)]`;
}

export function TextDiffViewer({
  oldText,
  newText,
  onNavigationStateChange,
  onNavigatePrevious,
  onNavigateNext
}: TextDiffViewerProps) {
  const oldContentRef = useRef<HTMLDivElement>(null);
  const newContentRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const [currentChangeIndex, setCurrentChangeIndex] = React.useState(0);
  const currentChangeIndexRef = useRef(0);
  const changeGroupsRef = useRef<ChangeGroup[]>([]);

  const { oldLines, newLines, stats, changeGroups } = useMemo(() => {
    const changes = diffLines(oldText, newText);
    const oldLines: DiffLine[] = [];
    const newLines: DiffLine[] = [];
    const changeGroups: ChangeGroup[] = [];
    let oldLineNum = 1;
    let newLineNum = 1;
    let addedLines = 0;
    let removedLines = 0;

    changes.forEach((change) => {
      const lines = change.value.split('\n');
      // Remove last empty line if present
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      if (change.added) {
        const startIndex = newLines.length;
        lines.forEach((line) => {
          newLines.push({ content: line, type: 'added', lineNumber: newLineNum++ });
          addedLines++;
        });
        const endIndex = newLines.length - 1;

        // Merge with previous group if it's a modification (last group was a deletion)
        if (changeGroups.length > 0 && changeGroups[changeGroups.length - 1].type === 'deletion') {
          changeGroups[changeGroups.length - 1].type = 'modification';
        } else {
          changeGroups.push({ startIndex, endIndex, type: 'addition' });
        }
      } else if (change.removed) {
        const startIndex = oldLines.length;
        lines.forEach((line) => {
          oldLines.push({ content: line, type: 'removed', lineNumber: oldLineNum++ });
          removedLines++;
        });
        const endIndex = oldLines.length - 1;
        changeGroups.push({ startIndex, endIndex, type: 'deletion' });
      } else {
        lines.forEach((line) => {
          oldLines.push({ content: line, type: 'unchanged', lineNumber: oldLineNum++ });
          newLines.push({ content: line, type: 'unchanged', lineNumber: newLineNum++ });
        });
      }
    });

    return {
      oldLines,
      newLines,
      stats: { addedLines, removedLines },
      changeGroups
    };
  }, [oldText, newText]);

  // Keep refs in sync with state
  useEffect(() => {
    currentChangeIndexRef.current = currentChangeIndex;
  }, [currentChangeIndex]);

  useEffect(() => {
    changeGroupsRef.current = changeGroups;
  }, [changeGroups]);

  const handleScroll = useCallback((source: 'old' | 'new') => {
    if (syncingRef.current) return;

    const sourceEl = source === 'old' ? oldContentRef.current : newContentRef.current;
    const targetEl = source === 'old' ? newContentRef.current : oldContentRef.current;

    if (!sourceEl || !targetEl) return;

    syncingRef.current = true;
    targetEl.scrollTop = sourceEl.scrollTop;
    targetEl.scrollLeft = sourceEl.scrollLeft;

    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  const handleDownloadDiff = useCallback(() => {
    try {
      const unifiedDiff = generateUnifiedDiff(oldText, newText, 'a/document.md', 'b/document.md');

      const blob = new Blob([unifiedDiff], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `diff-${Date.now()}.patch`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate unified diff:', error);
    }
  }, [oldText, newText]);

  const scrollToChange = useCallback((index: number) => {
    const groups = changeGroupsRef.current;
    if (index < 0 || index >= groups.length) return;

    const group = groups[index];
    const targetRef = group.type === 'addition' ? newContentRef : oldContentRef;

    if (targetRef.current) {
      const lineElements = targetRef.current.querySelectorAll('.text-diff-line');
      const targetLine = lineElements[group.startIndex];

      if (targetLine) {
        targetLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    setCurrentChangeIndex(index);

    // Update parent state immediately
    if (onNavigationStateChange) {
      onNavigationStateChange({
        currentIndex: index,
        totalGroups: groups.length,
        canGoPrevious: index > 0,
        canGoNext: index < groups.length - 1,
        addedLines: stats.addedLines,
        removedLines: stats.removedLines
      });
    }
  }, [onNavigationStateChange, stats]);

  // Handle clicks on diff lines to update navigation index
  const handleLineClick = useCallback((lineIndex: number, isNewVersion: boolean) => {
    const groups = changeGroupsRef.current;

    // Find which change group contains this line
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];

      // Check if this line is in the current group
      const isInGroup = lineIndex >= group.startIndex && lineIndex <= group.endIndex;

      // For additions, check in new version; for deletions/modifications, check in old version
      const isCorrectVersion =
        (group.type === 'addition' && isNewVersion) ||
        (group.type === 'deletion' && !isNewVersion) ||
        (group.type === 'modification' && (isNewVersion || !isNewVersion));

      if (isInGroup && isCorrectVersion) {
        if (i !== currentChangeIndexRef.current) {
          scrollToChange(i);
        }
        return;
      }
    }
  }, [scrollToChange]);

  // Notify parent of navigation state changes
  useEffect(() => {
    if (onNavigationStateChange) {
      onNavigationStateChange({
        currentIndex: currentChangeIndex,
        totalGroups: changeGroups.length,
        canGoPrevious: currentChangeIndex > 0,
        canGoNext: currentChangeIndex < changeGroups.length - 1,
        addedLines: stats.addedLines,
        removedLines: stats.removedLines
      });
    }
  }, [currentChangeIndex, changeGroups.length, stats, onNavigationStateChange]);

  // Handle navigation requests from parent
  useEffect(() => {
    if (onNavigatePrevious) {
      // Store handler so parent can trigger it
      (window as any).__textDiffNavigatePrevious = () => {
        const currentIndex = currentChangeIndexRef.current;
        const groups = changeGroupsRef.current;

        if (currentIndex > 0) {
          scrollToChange(currentIndex - 1);
        }
      };
    }
    if (onNavigateNext) {
      (window as any).__textDiffNavigateNext = () => {
        const currentIndex = currentChangeIndexRef.current;
        const groups = changeGroupsRef.current;

        if (currentIndex < groups.length - 1) {
          scrollToChange(currentIndex + 1);
        }
      };
    }
  }, [scrollToChange, onNavigatePrevious, onNavigateNext]);

  const handlePreviousChange = useCallback(() => {
    if (currentChangeIndex > 0) {
      scrollToChange(currentChangeIndex - 1);
    }
  }, [currentChangeIndex, scrollToChange]);

  const handleNextChange = useCallback(() => {
    if (currentChangeIndex < changeGroups.length - 1) {
      scrollToChange(currentChangeIndex + 1);
    }
  }, [currentChangeIndex, changeGroups.length, scrollToChange]);

  return (
    <div
      className={rootClass}
      data-testid="agent-elements-text-diff-viewer"
      data-agent-elements-shell="text-diff-viewer"
      data-component="TextDiffViewer"
      data-change-groups={changeGroups.length}
    >
      <div
        className={panelsClass}
        data-testid="agent-elements-text-diff-panels"
        data-agent-elements-shell="text-diff-panels"
      >
        <div
          className={`${panelBaseClass} text-diff-old agent-elements-text-diff-panel-old`}
          data-testid="agent-elements-text-diff-panel-old"
          data-agent-elements-shell="text-diff-panel-old"
          role="region"
          aria-label="Old version text diff"
        >
          <div className={`${headerBaseClass} text-[var(--an-diff-removed-text)]`}>
            Old Version
          </div>
          <div
            className={contentClass}
            ref={oldContentRef}
            onScroll={() => handleScroll('old')}
          >
            <div className={linesClass}>
              {oldLines.map((line, index) => (
                <div
                  key={index}
                  className={getDiffLineClass(line.type)}
                  data-diff-line={line.type}
                  onClick={() => {
                    if (line.type !== 'unchanged') {
                      handleLineClick(index, false);
                    }
                  }}
                >
                  <span
                    className={getLineNumberClass(line.type)}
                    data-agent-elements-shell="text-diff-line-number"
                  >
                    {line.lineNumber}
                  </span>
                  <span
                    className={lineContentBaseClass}
                    data-agent-elements-shell="text-diff-line-content"
                  >
                    {line.content || ' '}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          className={`${panelBaseClass} text-diff-new agent-elements-text-diff-panel-new`}
          data-testid="agent-elements-text-diff-panel-new"
          data-agent-elements-shell="text-diff-panel-new"
          role="region"
          aria-label="New version text diff"
        >
          <div className={`${headerBaseClass} text-[var(--an-diff-added-text)]`}>
            New Version
          </div>
          <div
            className={contentClass}
            ref={newContentRef}
            onScroll={() => handleScroll('new')}
          >
            <div className={linesClass}>
              {newLines.map((line, index) => (
                <div
                  key={index}
                  className={getDiffLineClass(line.type)}
                  data-diff-line={line.type}
                  onClick={() => {
                    if (line.type !== 'unchanged') {
                      handleLineClick(index, true);
                    }
                  }}
                >
                  <span
                    className={getLineNumberClass(line.type)}
                    data-agent-elements-shell="text-diff-line-number"
                  >
                    {line.lineNumber}
                  </span>
                  <span
                    className={lineContentBaseClass}
                    data-agent-elements-shell="text-diff-line-content"
                  >
                    {line.content || ' '}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
