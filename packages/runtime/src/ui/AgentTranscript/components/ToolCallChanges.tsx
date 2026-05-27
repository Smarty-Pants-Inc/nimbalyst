/**
 * ToolCallChanges - Shows file changes caused by a tool call.
 *
 * Renders a collapsible file changes section with:
 * - Compact summary header showing file count and +/- stats
 * - DiffViewer for edit operations (old_string/new_string)
 * - NewFilePreview for create operations (full content)
 * - Compact file entry for bash/unknown operations (path + stats only)
 */

import React, { useState, useEffect, useRef } from 'react';
import type { ToolCallDiffResult } from './CustomToolWidgets';
import { DiffViewer } from './DiffViewer';
import { NewFilePreview } from './NewFilePreview';
import { toProjectRelative } from '../utils/pathResolver';
import { MaterialSymbol } from '../../icons/MaterialSymbol';

interface ToolCallChangesProps {
  toolCallItemId: string;
  toolCallTimestamp?: number;
  getToolCallDiffs: (
    toolCallItemId: string,
    toolCallTimestamp?: number
  ) => Promise<ToolCallDiffResult[] | null>;
  isExpanded: boolean;
  workspacePath?: string;
  onOpenFile?: (filePath: string) => void;
  renderEmbeddedFile?: (params: { filePath: string; defaultExpanded?: boolean }) => React.ReactNode;
  /**
   * Host-provided predicate: returns true if `filePath` will be rendered
   * by `renderEmbeddedFile` so this row can show the inline preview
   * instead of the regular diff/new-file view. The host owns the custom
   * editor registry; the runtime asks.
   */
  canEmbedFile?: (filePath: string) => boolean;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function getOperationBadge(operation: string): { label: string; colorClass: string; bgClass: string; dotClass: string; icon: string } {
  switch (operation) {
    case 'create':
      return {
        label: 'Created',
        colorClass: 'text-[var(--an-diff-added-text)]',
        bgClass: 'bg-[var(--an-diff-added-bg)]',
        dotClass: 'bg-[var(--an-diff-added-text)]',
        icon: 'note_add',
      };
    case 'delete':
      return {
        label: 'Deleted',
        colorClass: 'text-[var(--an-diff-removed-text)]',
        bgClass: 'bg-[var(--an-diff-removed-bg)]',
        dotClass: 'bg-[var(--an-diff-removed-text)]',
        icon: 'delete',
      };
    case 'bash':
      return {
        label: 'Shell',
        colorClass: 'text-[var(--an-foreground-muted)]',
        bgClass: 'bg-[var(--an-background-tertiary)]',
        dotClass: 'bg-[var(--an-foreground-muted)]',
        icon: 'terminal',
      };
    default:
      return {
        label: 'Edited',
        colorClass: 'text-[var(--an-primary-color)]',
        bgClass: 'bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-tool-background))]',
        dotClass: 'bg-[var(--an-primary-color)]',
        icon: 'edit',
      };
  }
}

export const ToolCallChanges: React.FC<ToolCallChangesProps> = ({
  toolCallItemId,
  toolCallTimestamp,
  getToolCallDiffs,
  isExpanded,
  workspacePath,
  onOpenFile,
  renderEmbeddedFile,
  canEmbedFile,
}) => {
  const [diffs, setDiffs] = useState<ToolCallDiffResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [changesExpanded, setChangesExpanded] = useState(false);
  const fetchedRef = useRef(false);

  // Reset fetch state when tool call identity changes
  useEffect(() => {
    fetchedRef.current = false;
    setDiffs(null);
  }, [toolCallItemId, toolCallTimestamp]);

  // Fetch diffs when the parent tool card is expanded
  useEffect(() => {
    if (!isExpanded || fetchedRef.current || !toolCallItemId) return;
    fetchedRef.current = true;
    setIsLoading(true);
    getToolCallDiffs(toolCallItemId, toolCallTimestamp)
      .then(result => setDiffs(result))
      .catch(() => setDiffs(null))
      .finally(() => setIsLoading(false));
  }, [isExpanded, toolCallItemId, toolCallTimestamp, getToolCallDiffs]);

  // Don't render anything if not expanded or no diffs
  if (!isExpanded) return null;
  if (isLoading) return null; // Don't show loading state - it's fast enough
  if (!diffs || diffs.length === 0) return null;

  // Compute summary stats
  const totalAdded = diffs.reduce((sum, d) => sum + (d.linesAdded ?? 0), 0);
  const totalRemoved = diffs.reduce((sum, d) => sum + (d.linesRemoved ?? 0), 0);
  const fileCount = diffs.length;
  const summaryParts = [`${fileCount} file${fileCount !== 1 ? 's' : ''} changed`];
  if (totalAdded > 0) summaryParts.push(`+${totalAdded}`);
  if (totalRemoved > 0) summaryParts.push(`-${totalRemoved}`);
  const summary = summaryParts.join(' ');

  return (
    <div
      className="tool-call-changes agent-elements-tool-call-changes mt-2 overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] text-[var(--an-tool-color)]"
      data-agent-elements-shell="tool-call-changes"
      data-testid="agent-elements-tool-call-changes"
    >
      {/* Header */}
      <button
        className="agent-elements-tool-call-changes-toggle flex w-full cursor-pointer items-center justify-between gap-[var(--an-spacing-sm)] border-0 border-b border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-left text-[var(--an-tool-color)] motion-safe:transition-colors motion-safe:duration-150 hover:bg-[var(--an-background-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--an-input-focus-outline)]"
        onClick={() => setChangesExpanded(!changesExpanded)}
        type="button"
        aria-expanded={changesExpanded}
        data-testid="agent-elements-tool-call-changes-toggle"
      >
        <div className="flex min-w-0 items-center gap-[var(--an-spacing-xs)]">
          <span aria-hidden="true" className="shrink-0 text-[var(--an-foreground-muted)]">
            <MaterialSymbol icon="description" size={15} />
          </span>
          <span className="text-[0.75rem] font-medium leading-none text-[var(--an-tool-color)]">
            File changes
          </span>
          <span
            className="min-w-0 truncate text-[0.6875rem] leading-none text-[var(--an-foreground-muted)]"
            data-testid="agent-elements-tool-call-changes-summary"
          >
            {summary}
          </span>
        </div>
        <span
          aria-hidden="true"
          className={classNames(
            'shrink-0 text-[var(--an-foreground-muted)] motion-safe:transition-transform motion-safe:duration-150',
            changesExpanded && 'rotate-90',
          )}
        >
          <MaterialSymbol icon="chevron_right" size={16} />
        </span>
      </button>

      {/* Expanded content */}
      {changesExpanded && (
        <div className="agent-elements-tool-call-changes-list flex flex-col">
          {diffs.map((diff, idx) => {
            const relPath = toProjectRelative(diff.filePath, workspacePath);
            const badge = getOperationBadge(diff.operation);
            const hasDiffContent = diff.diffs.length > 0;
            const hasNewContent = !hasDiffContent && !!diff.content;
            const shouldUseEmbeddedPreview =
              !!renderEmbeddedFile && !!canEmbedFile?.(diff.filePath);

            return (
              <div
                key={`${diff.filePath}-${idx}`}
                className="agent-elements-tool-call-changes-file border-t border-[var(--an-tool-border-color)] first:border-t-0"
                data-testid="agent-elements-tool-call-changes-file-row"
                data-operation={diff.operation}
              >
                {/* File header row - always shown */}
                <div className="flex items-center gap-[var(--an-spacing-xs)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]">
                  <span
                    className={classNames('h-2 w-2 shrink-0 rounded-full', badge.dotClass)}
                    aria-hidden="true"
                  />
                  {onOpenFile ? (
                    <button
                      className="min-w-0 flex-1 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left font-mono text-[0.75rem] text-[var(--an-tool-color-muted)] hover:text-[var(--an-primary-color)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]"
                      onClick={() => onOpenFile(diff.filePath)}
                      title={`Open ${relPath}`}
                      type="button"
                    >
                      <code>{relPath}</code>
                    </button>
                  ) : (
                    <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[0.75rem] text-[var(--an-tool-color-muted)]">
                      {relPath}
                    </code>
                  )}
                  {/* Line count stats */}
                  {(diff.linesAdded != null || diff.linesRemoved != null) && (
                    <span className="shrink-0 font-mono text-[0.6875rem] text-[var(--an-foreground-muted)]">
                      {diff.linesAdded != null && diff.linesAdded > 0 && (
                        <span className="text-[var(--an-diff-added-text)]">+{diff.linesAdded}</span>
                      )}
                      {diff.linesAdded != null && diff.linesAdded > 0 && diff.linesRemoved != null && diff.linesRemoved > 0 && ' '}
                      {diff.linesRemoved != null && diff.linesRemoved > 0 && (
                        <span className="text-[var(--an-diff-removed-text)]">-{diff.linesRemoved}</span>
                      )}
                    </span>
                  )}
                  <span className={classNames(
                    'inline-flex shrink-0 items-center gap-1 rounded-[var(--an-radius-sm)] px-1.5 py-0.5 text-[0.625rem] font-medium leading-none',
                    badge.colorClass,
                    badge.bgClass,
                  )}>
                    <span aria-hidden="true" className="inline-flex">
                      <MaterialSymbol icon={badge.icon} size={12} />
                    </span>
                    {badge.label}
                  </span>
                  {diff.debugInfo && process.env.NODE_ENV !== 'production' && (
                    <span
                      className="shrink-0 cursor-help text-[0.625rem] text-[var(--an-foreground-muted)] opacity-60 motion-safe:transition-opacity motion-safe:duration-150 hover:opacity-100"
                      title={diff.debugInfo}
                    >
                      (i)
                    </span>
                  )}
                </div>

                {/* Diff content */}
                {shouldUseEmbeddedPreview && (
                  <div className="px-[var(--an-spacing-sm)] pb-[var(--an-spacing-sm)]">
                    {renderEmbeddedFile?.({ filePath: diff.filePath, defaultExpanded: diff.operation === 'create' })}
                  </div>
                )}

                {!shouldUseEmbeddedPreview && hasDiffContent && (
                  <div className="px-[var(--an-spacing-sm)] pb-[var(--an-spacing-sm)]">
                    {diff.diffs.map((d, dIdx) => (
                      <DiffViewer
                        key={`diff-${dIdx}`}
                        edit={{ old_string: d.oldString, new_string: d.newString }}
                        filePath={relPath}
                        maxHeight="16rem"
                        onOpenFile={onOpenFile}
                        absoluteFilePath={diff.filePath}
                      />
                    ))}
                  </div>
                )}

                {/* New file content */}
                {!shouldUseEmbeddedPreview && hasNewContent && (
                  <div className="px-[var(--an-spacing-sm)] pb-[var(--an-spacing-sm)]">
                    <NewFilePreview
                      content={diff.content!}
                      filePath={relPath}
                      maxHeight="16rem"
                      onOpenFile={onOpenFile}
                      absoluteFilePath={diff.filePath}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
