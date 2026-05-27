/**
 * Compatibility widget for legacy file_change tool rows.
 *
 * The current live Codex file_change path is handled by AsyncEditToolResultCard
 * when diff lookup is available. This renderer still supports older/custom
 * transcript rows that carry path snapshots directly on the tool payload.
 */

import React, { useCallback, useState } from 'react';
import { useAtomValue } from 'jotai';
import { AgentStatusPill, AgentToolCard, type AgentStatusTone, type AgentToolStatus } from '../../../AgentElements/AgentElementsPrimitives';
import { MaterialSymbol } from '../../../icons/MaterialSymbol';
import { interactiveWidgetHostAtom } from '../../../../store/atoms/interactiveWidgetHost';
import type { CustomToolWidgetProps } from './index';
import { useElapsedTimeRef } from './useElapsedTime';

const MAX_VISIBLE_LINES = 25;

interface FileChange {
  path: string;
  kind?: unknown;
}

interface FileSnapshot {
  content: string | null;
  error?: string;
  isBinary?: boolean;
  truncated?: boolean;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function parseToolResult(result: unknown): Record<string, unknown> | null {
  if (!result) return null;
  if (typeof result === 'object' && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  if (typeof result !== 'string') return null;
  try {
    const parsed = JSON.parse(result);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function extractChanges(tool: { arguments?: unknown; result?: unknown }): FileChange[] {
  const args = tool.arguments && typeof tool.arguments === 'object'
    ? tool.arguments as Record<string, unknown>
    : null;
  const result = parseToolResult(tool.result);
  const changes = args?.changes ?? result?.changes;
  if (!Array.isArray(changes)) return [];
  return changes.filter((change): change is FileChange => (
    !!change &&
    typeof change === 'object' &&
    typeof (change as { path?: unknown }).path === 'string'
  ));
}

function extractSnapshots(tool: { result?: unknown }): Record<string, FileSnapshot> {
  const result = parseToolResult(tool.result);
  if (result?.fileSnapshots && typeof result.fileSnapshots === 'object' && !Array.isArray(result.fileSnapshots)) {
    return result.fileSnapshots as Record<string, FileSnapshot>;
  }
  return {};
}

function isToolRunning(tool: { result?: unknown }): boolean {
  return tool.result === undefined || tool.result === null;
}

function isToolError(result: unknown, message: { isError?: boolean }): boolean {
  if (message.isError) return true;
  const parsed = parseToolResult(result);
  if (parsed?.success === false) return true;
  if (parsed?.status === 'failed') return true;
  return false;
}

function getBasename(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

function getRelativePath(filePath: string, workspacePath?: string): string {
  if (!workspacePath) return filePath;
  if (filePath.startsWith(workspacePath)) {
    const relative = filePath.slice(workspacePath.length);
    return relative.startsWith('/') ? relative.slice(1) : relative;
  }
  return filePath;
}

function getRawKind(kind: unknown): string {
  if (typeof kind === 'string') return kind;
  if (kind && typeof kind === 'object' && typeof (kind as { type?: unknown }).type === 'string') {
    return (kind as { type: string }).type;
  }
  return 'update';
}

function getNormalizedKind(kind: unknown): 'create' | 'delete' | 'update' {
  switch (getRawKind(kind)) {
    case 'add':
    case 'create':
    case 'new':
      return 'create';
    case 'delete':
    case 'remove':
      return 'delete';
    case 'update':
    default:
      return 'update';
  }
}

function getKindLabel(kind: unknown): string {
  switch (getNormalizedKind(kind)) {
    case 'create':
      return 'Created';
    case 'delete':
      return 'Deleted';
    case 'update':
      return 'Updated';
  }
}

function getKindTone(kind: unknown): AgentStatusTone {
  switch (getNormalizedKind(kind)) {
    case 'create':
      return 'success';
    case 'delete':
      return 'error';
    case 'update':
      return 'neutral';
  }
}

function getKindIcon(kind: unknown): string {
  switch (getNormalizedKind(kind)) {
    case 'create':
      return 'note_add';
    case 'delete':
      return 'delete';
    case 'update':
      return 'edit';
  }
}

function getKindDotClass(kind: unknown): string {
  switch (getNormalizedKind(kind)) {
    case 'create':
      return 'bg-[var(--an-diff-added-text)]';
    case 'delete':
      return 'bg-[var(--an-diff-removed-text)]';
    case 'update':
      return 'bg-[var(--an-tool-color-muted)]';
  }
}

function getSummary(changes: FileChange[]): string {
  if (changes.length === 0) return 'No file changes';
  if (changes.length === 1) {
    const change = changes[0];
    return `${getKindLabel(change.kind)} ${getBasename(change.path)}`;
  }
  const kinds = new Set(changes.map((change) => getNormalizedKind(change.kind)));
  if (kinds.size === 1) {
    return `${getKindLabel(changes[0].kind)} ${changes.length} files`;
  }
  return `Changed ${changes.length} files`;
}

function countLines(text: string): number {
  return text.split('\n').length;
}

function truncateLines(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n');
}

function getToolStatus(running: boolean, hasError: boolean): AgentToolStatus {
  if (hasError) return 'error';
  if (running) return 'running';
  return 'completed';
}

function getStatusTone(status: AgentToolStatus): AgentStatusTone {
  if (status === 'error') return 'error';
  if (status === 'running') return 'running';
  return 'success';
}

function getStatusLabel(status: AgentToolStatus): string {
  if (status === 'error') return 'Failed';
  if (status === 'running') return 'Running';
  return 'Changed';
}

const LoadingDots: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={classNames('agent-elements-file-change-loading-dots inline-flex items-center gap-[var(--an-spacing-xxs)]', className)}
    data-testid="agent-elements-file-change-loading-dots"
  >
    <span className="agent-elements-file-change-loading-dot h-1.5 w-1.5 rounded-full bg-[var(--an-tool-color-muted)] animate-pulse [animation-delay:0s]" />
    <span className="agent-elements-file-change-loading-dot h-1.5 w-1.5 rounded-full bg-[var(--an-tool-color-muted)] animate-pulse [animation-delay:0.2s]" />
    <span className="agent-elements-file-change-loading-dot h-1.5 w-1.5 rounded-full bg-[var(--an-tool-color-muted)] animate-pulse [animation-delay:0.4s]" />
  </span>
);

const FileNotice: React.FC<{
  children: React.ReactNode;
  tone?: AgentStatusTone;
  testId?: string;
}> = ({ children, tone = 'neutral', testId }) => (
  <div
    className={classNames(
      'agent-elements-file-change-notice rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)]',
      'bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-xs italic',
      tone === 'error' ? 'text-[var(--an-diff-removed-text)]' : 'text-[var(--an-tool-color-muted)]'
    )}
    data-testid={testId}
  >
    {children}
  </div>
);

const FileChangeStatus: React.FC<{
  status: AgentToolStatus;
  elapsedRef?: (node: HTMLElement | null) => void;
}> = ({ status, elapsedRef }) => (
  <AgentStatusPill tone={getStatusTone(status)}>
    {status === 'running' ? (
      <>
        <LoadingDots />
        <span>Running</span>
        {elapsedRef ? <span ref={elapsedRef} className="tabular-nums" /> : null}
      </>
    ) : (
      getStatusLabel(status)
    )}
  </AgentStatusPill>
);

export const FileChangeWidget: React.FC<CustomToolWidgetProps> = ({
  message,
  isExpanded,
  onToggle,
  workspacePath,
  readFile,
  sessionId,
}) => {
  const host = useAtomValue(interactiveWidgetHostAtom(sessionId));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [liveContent, setLiveContent] = useState<Record<string, { content: string | null; error?: string }>>({});
  const [loadingLive, setLoadingLive] = useState<Set<string>>(new Set());

  const tool = message.toolCall;
  const running = tool ? isToolRunning(tool) : false;
  const elapsedRef = useElapsedTimeRef(running ? message.createdAt.getTime() : undefined);

  if (!tool) return null;

  const changes = extractChanges(tool);
  const snapshots = extractSnapshots(tool);
  const hasError = isToolError(tool.result, message);
  const status = getToolStatus(running, hasError);
  const summary = getSummary(changes);

  const handleFileClick = useCallback(async (filePath: string) => {
    if (selectedFile === filePath) {
      setSelectedFile(null);
      setContentExpanded(false);
      return;
    }
    setSelectedFile(filePath);
    setContentExpanded(false);

    const snapshot = snapshots[filePath];
    const needsLiveRead = !snapshot && readFile && !liveContent[filePath];
    if (needsLiveRead) {
      setLoadingLive((prev) => new Set(prev).add(filePath));
      try {
        const result = await readFile(filePath);
        setLiveContent((prev) => ({
          ...prev,
          [filePath]: {
            content: result.success ? result.content ?? null : null,
            error: result.success ? undefined : result.error,
          },
        }));
      } catch {
        setLiveContent((prev) => ({
          ...prev,
          [filePath]: { content: null, error: 'Failed to read file' },
        }));
      } finally {
        setLoadingLive((prev) => {
          const next = new Set(prev);
          next.delete(filePath);
          return next;
        });
      }
    }
  }, [selectedFile, snapshots, readFile, liveContent]);

  const handlePathClick = useCallback((event: React.MouseEvent, filePath: string) => {
    event.stopPropagation();
    host?.openFile(filePath);
  }, [host]);

  if (!isExpanded) {
    return (
      <button
        className={classNames(
          'file-change-widget agent-elements-file-change-card agent-elements-tool-card',
          'w-full cursor-pointer transition-colors hover:border-[var(--an-input-focus-border,var(--an-tool-border-color))]'
        )}
        data-agent-elements-shell="file-change-card"
        data-component="RichTranscriptAgentElementsFileChange"
        data-testid="agent-elements-file-change-card"
        data-tool-status={status}
        onClick={onToggle}
        type="button"
      >
        <span className="agent-elements-tool-header w-full">
          <span className="agent-elements-tool-icon" aria-hidden="true">
            <MaterialSymbol icon="difference" size={16} />
          </span>
          <span className="agent-elements-tool-title-group text-left">
            <span
              className="agent-elements-tool-title"
              data-testid="agent-elements-file-change-summary"
            >
              {summary}
            </span>
            {changes.length > 1 ? (
              <code className="agent-elements-tool-subtitle font-mono" data-testid="agent-elements-file-change-files">
                {changes.map((change) => getBasename(change.path)).join(', ')}
              </code>
            ) : null}
          </span>
          <span className="agent-elements-tool-trailing inline-flex items-center gap-[var(--an-spacing-xs)]">
            <FileChangeStatus status={status} elapsedRef={status === 'running' ? elapsedRef : undefined} />
            <MaterialSymbol icon="chevron_right" size={14} />
          </span>
        </span>
      </button>
    );
  }

  let selectedContent: string | null = null;
  let selectedIsBinary = false;
  let selectedTruncated = false;
  let selectedError: string | undefined;
  let selectedIsLive = false;
  let selectedIsLoading = false;

  if (selectedFile) {
    const snapshot = snapshots[selectedFile];
    if (snapshot) {
      selectedContent = snapshot.content;
      selectedIsBinary = !!snapshot.isBinary;
      selectedTruncated = !!snapshot.truncated;
      selectedError = snapshot.error;
    } else if (liveContent[selectedFile]) {
      selectedContent = liveContent[selectedFile].content;
      selectedError = liveContent[selectedFile].error;
      selectedIsLive = true;
    }
    selectedIsLoading = loadingLive.has(selectedFile);
  }

  const selectedChange = selectedFile
    ? changes.find((change) => change.path === selectedFile)
    : null;
  const selectedChangeKind = getNormalizedKind(selectedChange?.kind);
  const lineCount = selectedContent ? countLines(selectedContent) : 0;
  const needsTruncation = lineCount > MAX_VISIBLE_LINES;
  const displayContent = selectedContent && needsTruncation && !contentExpanded
    ? truncateLines(selectedContent, MAX_VISIBLE_LINES)
    : selectedContent;
  const hiddenLineCount = lineCount - MAX_VISIBLE_LINES;

  return (
    <AgentToolCard
      className="file-change-widget agent-elements-file-change-card"
      data-agent-elements-shell="file-change-card"
      data-component="RichTranscriptAgentElementsFileChange"
      data-testid="agent-elements-file-change-card"
      icon={<MaterialSymbol icon="difference" size={16} />}
      onClick={onToggle}
      status={status}
      subtitle={summary}
      title="File Changes"
      trailing={(
        <span className="agent-elements-file-change-header-actions inline-flex items-center gap-[var(--an-spacing-xs)]">
          <FileChangeStatus status={status} elapsedRef={status === 'running' ? elapsedRef : undefined} />
          <button
            aria-label="Collapse file changes"
            className={classNames(
              'agent-elements-file-change-collapse inline-flex h-6 w-6 items-center justify-center',
              'rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-transparent',
              'text-[var(--an-tool-color-muted)] transition-colors hover:text-[var(--an-tool-color)]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline,var(--an-tool-border-color))]'
            )}
            data-testid="agent-elements-file-change-collapse"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            type="button"
          >
            <MaterialSymbol icon="expand_less" size={14} />
          </button>
        </span>
      )}
    >
      <div
        className="agent-elements-file-change-body flex flex-col gap-[var(--an-spacing-sm)]"
        data-agent-elements-shell="file-change-body"
        data-testid="agent-elements-file-change-body"
        onClick={(event) => event.stopPropagation()}
      >
        {changes.length > 0 ? (
          <div className="agent-elements-file-change-list flex flex-col gap-[var(--an-spacing-xs)]">
            {changes.map((change, index) => {
              const relativePath = getRelativePath(change.path, workspacePath);
              const isSelected = selectedFile === change.path;
              return (
                <div
                  className={classNames(
                    'agent-elements-file-change-row grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-[var(--an-spacing-xs)]',
                    'rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)]',
                    isSelected && 'border-[var(--an-input-focus-border,var(--an-tool-border-color))]'
                  )}
                  data-agent-elements-shell="file-change-row"
                  key={`${change.path}-${index}`}
                >
                  <button
                    className="agent-elements-file-change-row-main flex min-w-0 items-center gap-[var(--an-spacing-xs)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-left"
                    data-testid={`agent-elements-file-change-row-${index}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFileClick(change.path);
                    }}
                    type="button"
                  >
                    <span
                      className={classNames('agent-elements-file-change-kind-dot h-2 w-2 shrink-0 rounded-full', getKindDotClass(change.kind))}
                      data-file-kind={getRawKind(change.kind)}
                    />
                    <MaterialSymbol icon={getKindIcon(change.kind)} size={14} />
                    <code className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[var(--an-tool-color)]">
                      {relativePath}
                    </code>
                  </button>
                  <AgentStatusPill tone={getKindTone(change.kind)}>
                    {getKindLabel(change.kind)}
                  </AgentStatusPill>
                  <button
                    aria-label={`Open ${relativePath}`}
                    className={classNames(
                      'agent-elements-file-change-open mr-[var(--an-spacing-xs)] inline-flex h-6 w-6 items-center justify-center',
                      'rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-transparent',
                      'text-[var(--an-tool-color-muted)] transition-colors hover:text-[var(--an-tool-color)]',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline,var(--an-tool-border-color))]'
                    )}
                    data-testid={`agent-elements-file-change-open-${index}`}
                    onClick={(event) => handlePathClick(event, change.path)}
                    title={`Open ${relativePath}`}
                    type="button"
                  >
                    <MaterialSymbol icon="open_in_new" size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        {selectedFile ? (
          <div
            className="agent-elements-file-change-content-shell flex flex-col gap-[var(--an-spacing-xs)]"
            data-testid="agent-elements-file-change-content-shell"
          >
            {selectedIsLoading ? (
              <div className="flex items-center justify-center rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)] py-[var(--an-spacing-md)]">
                <LoadingDots />
              </div>
            ) : null}

            {!selectedIsLoading && selectedIsBinary ? (
              <FileNotice testId="agent-elements-file-change-binary">Binary file, content cannot be displayed</FileNotice>
            ) : null}

            {!selectedIsLoading && !selectedIsBinary && selectedChangeKind === 'delete' && !selectedContent ? (
              <FileNotice testId="agent-elements-file-change-deleted">File was deleted</FileNotice>
            ) : null}

            {!selectedIsLoading && selectedError && !selectedContent ? (
              <FileNotice tone="error" testId="agent-elements-file-change-error">{selectedError}</FileNotice>
            ) : null}

            {!selectedIsLoading && !selectedContent && !selectedIsBinary && !selectedError && selectedChangeKind !== 'delete' ? (
              <FileNotice testId="agent-elements-file-change-unavailable">Snapshot unavailable</FileNotice>
            ) : null}

            {!selectedIsLoading && displayContent ? (
              <div className="agent-elements-file-change-content-frame overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)]">
                {selectedIsLive ? (
                  <div
                    className="border-b border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-xs text-[var(--an-tool-color-muted)]"
                    data-testid="agent-elements-file-change-live-notice"
                  >
                    Showing current file (no snapshot available)
                  </div>
                ) : null}
                {selectedTruncated ? (
                  <div
                    className="border-b border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-xs text-[var(--an-tool-color-muted)]"
                    data-testid="agent-elements-file-change-truncated-notice"
                  >
                    File truncated at 100KB
                  </div>
                ) : null}
                <pre
                  className="m-0 max-h-80 overflow-auto whitespace-pre-wrap break-words bg-[var(--an-code-background)] p-[var(--an-spacing-sm)] font-mono text-xs leading-[1.45] text-[var(--an-code-color)] select-text"
                  data-testid="agent-elements-file-change-content"
                >
                  {displayContent}
                </pre>
                {needsTruncation ? (
                  <button
                    className={classNames(
                      'agent-elements-file-change-show-more block w-full border-t border-[var(--an-tool-border-color)]',
                      'bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]',
                      'text-center text-xs text-[var(--an-tool-color-muted)] transition-colors hover:text-[var(--an-tool-color)]'
                    )}
                    data-testid="agent-elements-file-change-show-more"
                    onClick={() => setContentExpanded(!contentExpanded)}
                    type="button"
                  >
                    {contentExpanded
                      ? 'Show less'
                      : `Show ${hiddenLineCount} more line${hiddenLineCount === 1 ? '' : 's'}`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {running && changes.length === 0 ? (
          <div className="flex items-center justify-center rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)] py-[var(--an-spacing-md)]">
            <LoadingDots />
          </div>
        ) : null}
      </div>
    </AgentToolCard>
  );
};
