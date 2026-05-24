import React, { useSyncExternalStore, useCallback } from 'react';

interface MockupAnnotationIndicatorProps {
  /** Current document file path */
  currentFilePath?: string;
  /** Timestamp of the last user message in the session (or null if no messages) */
  lastUserMessageTimestamp: number | null;
}

// Store for mockup annotation state
// This allows React to properly subscribe to changes
let listeners: Set<() => void> = new Set();
let snapshotVersion = 0;

function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  // Also listen for the custom event
  const handleEvent = () => {
    snapshotVersion++;
    callback();
  };
  window.addEventListener('mockup-annotation-changed', handleEvent);

  return () => {
    listeners.delete(callback);
    window.removeEventListener('mockup-annotation-changed', handleEvent);
  };
}

function getSnapshot(): number {
  return snapshotVersion;
}

/**
 * Notify listeners that mockup annotation state has changed
 */
export function notifyMockupAnnotationChanged(): void {
  snapshotVersion++;
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new CustomEvent('mockup-annotation-changed'));
}

/**
 * Get the current mockup file path from window globals
 */
export function getMockupFilePath(): string | undefined {
  return (window as any).__mockupFilePath;
}

/**
 * Clear mockup annotations for a specific file (when switching away from it)
 * Only clears if the current mockup file path matches the specified path.
 */
export function clearMockupAnnotationsForFile(filePath: string): void {
  const currentMockupFilePath = (window as any).__mockupFilePath;
  if (currentMockupFilePath === filePath) {
    delete (window as any).__mockupFilePath;
    delete (window as any).__mockupSelectedElement;
    delete (window as any).__mockupDrawing;
    delete (window as any).__mockupDrawingPaths;
    delete (window as any).__mockupAnnotationTimestamp;
    notifyMockupAnnotationChanged();
  }
}

/**
 * Indicator that shows when there are new mockup annotations
 * that haven't been sent with a prompt yet.
 *
 * Shows "+ mockup annotations" between attachments and the prompt box.
 */
export const MockupAnnotationIndicator: React.FC<MockupAnnotationIndicatorProps> = ({
  currentFilePath,
  lastUserMessageTimestamp
}) => {
  // Subscribe to annotation changes using React 18's useSyncExternalStore
  // This ensures the component re-renders when the external state changes
  useSyncExternalStore(subscribe, getSnapshot);

  // Read current state directly from window globals
  // This ensures we always have the latest values
  const mockupFilePath = (window as any).__mockupFilePath as string | undefined;
  const annotationTimestamp = (window as any).__mockupAnnotationTimestamp as number | null;
  const hasDrawing = !!(window as any).__mockupDrawing;
  const hasSelection = !!(window as any).__mockupSelectedElement;
  const hasAnnotations = hasDrawing || hasSelection;

  // Determine if we should show the indicator
  const shouldShow = useCallback((): boolean => {
    // Must have a mockup file path (indicates a mockup is currently open/active)
    if (!mockupFilePath) {
      return false;
    }

    // Mockup annotations must be from the current file
    // (hide if we switched to a different tab)
    if (currentFilePath && mockupFilePath !== currentFilePath) {
      return false;
    }

    // Must have annotations
    if (!hasAnnotations) {
      return false;
    }

    // Must have a timestamp
    if (!annotationTimestamp) {
      return false;
    }

    // If no user messages yet, show the indicator (new session)
    if (!lastUserMessageTimestamp) {
      return true;
    }

    // Show if annotations were made after the last prompt
    return annotationTimestamp > lastUserMessageTimestamp;
  }, [hasAnnotations, annotationTimestamp, mockupFilePath, currentFilePath, lastUserMessageTimestamp]);

  if (!shouldShow()) {
    return null;
  }

  const tooltipText = 'Annotations drawn on your mockup will be included with your prompt';
  const chipClass = [
    'mockup-annotation-indicator',
    'agent-elements-context-chip',
    'agent-elements-mockup-annotation-indicator',
    'mb-[var(--an-spacing-xs)] flex items-center gap-[var(--an-spacing-xs)]',
    'rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[var(--an-border-color)]',
    'bg-[var(--an-background-secondary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]',
    'text-xs text-[var(--an-foreground-muted)]',
  ].join(' ');

  return (
    <div
      className={chipClass}
      data-tooltip={tooltipText}
      data-agent-elements-shell="mockup-context-chip"
      data-component="UnifiedAIMockupAnnotationIndicator"
      title={tooltipText}
    >
      <span>+ mockup annotations</span>
    </div>
  );
};
