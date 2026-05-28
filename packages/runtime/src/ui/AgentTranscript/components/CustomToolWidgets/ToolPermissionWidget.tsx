/**
 * ToolPermissionWidget
 *
 * Interactive widget for tool permission requests.
 * Renders when Claude wants to use a tool that requires user approval.
 *
 * Uses InteractiveWidgetHost for operations that require access to atoms, callbacks, and analytics.
 * The host is read from interactiveWidgetHostAtom(sessionId) - no prop drilling needed.
 *
 * Message format (nimbalyst_tool_use):
 * {
 *   type: 'nimbalyst_tool_use',
 *   id: 'tool-session-12345-abc',
 *   name: 'ToolPermission',
 *   input: {
 *     requestId: 'tool-session-12345-abc',
 *     toolName: 'Bash',
 *     rawCommand: 'git status',
 *     pattern: 'Bash(git status:*)',
 *     patternDisplayName: 'git status commands',
 *     isDestructive: false,
 *     warnings: [],
 *     workspacePath: '/path/to/workspace',
 *   }
 * }
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import type { CustomToolWidgetProps } from './index';
import { interactiveWidgetHostAtom, getInteractiveWidgetHost } from '../../../../store/atoms/interactiveWidgetHost';
import type { PermissionScope } from './InteractiveWidgetHost';
import { unwrapShellCommand } from '../../utils/unwrapShellCommand';
import { AgentStatusPill, type AgentStatusTone } from '../../../AgentElements/AgentElementsPrimitives';
import type { AgentDiffLine } from '../../../AgentElements/AgentElementsToolRenderers';

/**
 * Get a human-readable display name for a tool pattern
 */
function getPatternDisplayName(pattern: string): string {
  // Handle compound commands - these get unique patterns and shouldn't be cached
  if (pattern.startsWith('Bash:compound:')) {
    return 'this compound command (one-time only)';
  }

  // Handle Bash patterns like "Bash(git commit:*)" -> "git commit commands"
  const bashMatch = pattern.match(/^Bash\(([^:]+):\*\)$/);
  if (bashMatch) {
    return `${bashMatch[1]} commands`;
  }
  if (pattern === 'Bash') {
    return 'Run shell commands';
  }

  // Handle WebFetch patterns like "WebFetch(domain:example.com)" -> "Fetch from example.com"
  const webfetchMatch = pattern.match(/^WebFetch\(domain:(.+)\)$/);
  if (webfetchMatch) {
    return `Fetch from ${webfetchMatch[1]}`;
  }
  if (pattern === 'WebFetch') {
    return 'Fetch any web page';
  }

  const displayNames: Record<string, string> = {
    'Edit': 'Edit files in project',
    'Write': 'Create files in project',
    'Read': 'Read files',
    'Glob': 'Search for files',
    'Grep': 'Search file contents',
    'WebSearch': 'Search the web',
    'Task': 'Run background tasks',
    'TodoWrite': 'Update task list',
  };

  if (displayNames[pattern]) {
    return displayNames[pattern];
  }

  // Handle MCP tools: mcp__server-name__tool_name -> "Server Name: Tool Name"
  if (pattern.toLowerCase().startsWith('mcp__')) {
    const parts = pattern.split('__');
    if (parts.length >= 3) {
      const serverName = parts[1]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      const mcpToolName = parts[2]
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `${serverName}: ${mcpToolName}`;
    }
  }

  return pattern;
}

type PermissionVisualState = 'pending' | 'granted' | 'denied' | 'cancelled';

const permissionCommandBlockClass =
  'max-h-[200px] overflow-x-auto rounded-[var(--an-input-border-radius)] bg-[var(--an-background-tertiary)] p-2';
const permissionCommandCodeClass =
  'font-mono text-xs text-[var(--an-foreground)] whitespace-pre-wrap break-all select-text';
const permissionSecondaryButtonClass =
  'cursor-pointer whitespace-nowrap rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-3 py-1.5 text-[11px] font-medium text-[var(--an-foreground)] transition-[background-color,border-color,color,opacity] duration-150 hover:bg-[var(--an-background-secondary)] disabled:cursor-not-allowed disabled:opacity-50';
const permissionPrimaryButtonClass =
  'cursor-pointer whitespace-nowrap rounded-[var(--an-input-border-radius)] border-none bg-[var(--an-primary-color)] px-3 py-1.5 text-[11px] font-medium text-[var(--an-button-primary-text)] transition-[background-color,border-color,color,opacity] duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const permissionSeparatorClass = 'w-px h-5 bg-[var(--an-border-color)] mx-1';

interface FilePermissionPreviewModel {
  filePath: string;
  operation: 'create' | 'edit';
  diffLines: AgentDiffLine[];
  title: string;
}

function getApprovalState(
  displayResult: { decision: 'allow' | 'deny'; scope: PermissionScope; cancelled?: boolean } | null | undefined,
  hasResponded: boolean
): PermissionVisualState {
  if (!displayResult && !hasResponded) return 'pending';
  if (displayResult?.cancelled) return 'cancelled';
  return displayResult?.decision === 'allow' ? 'granted' : 'denied';
}

function getApprovalTone(state: PermissionVisualState, isDestructive: boolean): AgentStatusTone {
  if (state === 'granted') return 'success';
  if (state === 'denied' || state === 'cancelled') return 'error';
  return isDestructive ? 'warning' : 'running';
}

function getApprovalLabel(state: PermissionVisualState): string {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  if (state === 'cancelled') return 'cancelled';
  return 'awaiting approval';
}

function PermissionStatusIcon({
  state,
  isDestructive,
}: {
  state: PermissionVisualState;
  isDestructive: boolean;
}) {
  const iconClassName = `agent-elements-tool-icon ${
    state === 'granted'
      ? 'text-[var(--an-success-color)]'
      : state === 'denied' || state === 'cancelled' || isDestructive
        ? 'text-[var(--an-error-color)]'
        : 'text-[var(--an-primary-color)]'
  }`;

  if (state === 'granted') {
    return (
      <span className={iconClassName}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M13.5 4.5L6 12l-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    );
  }

  if (state === 'denied' || state === 'cancelled') {
    return (
      <span className={iconClassName}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    );
  }

  if (isDestructive) {
    return (
      <span className={iconClassName}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 5.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M6.86 2.573L1.21 12.15c-.478.813.119 1.85 1.07 1.85h11.44c.951 0 1.548-1.037 1.07-1.85L9.14 2.573c-.477-.812-1.663-.812-2.14 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    );
  }

  return (
    <span className={iconClassName}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 7H3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M5.5 4L3.5 7l2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    </span>
  );
}

function parseRawCommandObject(rawCommand: string): Record<string, unknown> {
  if (!rawCommand.trim().startsWith('{')) return {};
  try {
    const parsed = JSON.parse(rawCommand);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function contentLines(content: string | undefined): string[] {
  if (!content) return [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.length > 0 ? lines : [''];
}

function buildFilePermissionPreview(
  toolName: string,
  rawCommand: string,
): FilePermissionPreviewModel | null {
  if (toolName !== 'write_file' && toolName !== 'edit_file') return null;

  const input = parseRawCommandObject(rawCommand);
  const filePath = stringField(input, ['file_path', 'filePath', 'path']);
  if (!filePath) return null;

  if (toolName === 'write_file') {
    const diffLines = contentLines(stringField(input, ['content'])).map((content, index) => ({
      type: 'add' as const,
      content,
      lineNumber: index + 1,
    }));
    return {
      filePath,
      operation: 'create',
      diffLines,
      title: 'Write file',
    };
  }

  const oldLines = contentLines(stringField(input, ['old_string', 'oldString']));
  const newLines = contentLines(stringField(input, ['new_string', 'newString']));
  return {
    filePath,
    operation: 'edit',
    diffLines: [
      ...oldLines.map((content, index) => ({
        type: 'remove' as const,
        content,
        lineNumber: index + 1,
      })),
      ...newLines.map((content, index) => ({
        type: 'add' as const,
        content,
        lineNumber: index + 1,
      })),
    ],
    title: 'Edit file',
  };
}

function FilePermissionPreview({ preview }: { preview: FilePermissionPreviewModel }) {
  const addCount = preview.diffLines.filter((line) => line.type === 'add').length;
  const removeCount = preview.diffLines.filter((line) => line.type === 'remove').length;

  return (
    <div
      className="agent-elements-edit-panel"
      data-permission-file-preview="true"
      data-testid="agent-elements-edit-tool-card"
    >
      <div className="agent-elements-edit-header-button">
        <span className="agent-elements-tool-title">{preview.title}</span>
        <span className="agent-elements-tool-subtitle">{preview.filePath}</span>
        <span className="agent-elements-edit-stats" data-testid="agent-elements-edit-stats">
          <span data-diff-tone="add">+{addCount}</span>
          <span data-diff-tone="remove">-{removeCount}</span>
        </span>
      </div>
      {preview.diffLines.length > 0 ? (
        <pre className="agent-elements-diff" data-testid="agent-elements-diff">
          {preview.diffLines.map((line, index) => (
            <span
              className="agent-elements-diff-line"
              data-diff-line={line.type}
              key={`${line.type}-${line.lineNumber ?? index}-${line.content}`}
            >
              <span className="agent-elements-diff-marker" aria-hidden="true">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </span>
              <span className="agent-elements-diff-content">{line.content}</span>
            </span>
          ))}
        </pre>
      ) : (
        <div className="agent-elements-edit-summary">No diff preview available.</div>
      )}
    </div>
  );
}

// ============================================================
// Widget Component
// ============================================================

export const ToolPermissionWidget: React.FC<CustomToolWidgetProps> = ({
  message,
  sessionId,
}) => {
  const toolCall = message.toolCall;
  if (!toolCall) return null;

  // Get host from atom (set by SessionTranscript)
  const host = useAtomValue(interactiveWidgetHostAtom(sessionId));

  // Parse tool call data
  const args = (toolCall.arguments || {}) as Record<string, any>;
  const requestId = (args.requestId || toolCall.providerToolCallId || '') as string;
  const toolName = (args.toolName || '') as string;
  const rawCommand = unwrapShellCommand((args.rawCommand || '') as string);
  const pattern = (args.pattern || toolName) as string;
  const patternDisplayName = (args.patternDisplayName || getPatternDisplayName(pattern)) as string;
  const isDestructive = (args.isDestructive || false) as boolean;
  const warnings: string[] = (args.warnings || []) as string[];
  const outsidePaths: string[] = Array.isArray(args.outsidePaths) ? args.outsidePaths : [];
  const sensitivePaths: string[] = Array.isArray(args.sensitivePaths) ? args.sensitivePaths : [];
  const workspacePath = (args.workspacePath || '') as string;
  const filePermissionPreview = buildFilePermissionPreview(toolName, rawCommand);

  const teammateName = (args.teammateName || '') as string;

  // Check if WebFetch request (for "All Domains" button)
  const isWebFetchRequest = toolName === 'WebFetch' || pattern.startsWith('WebFetch');

  // Parse result to determine completion state
  const rawResult = toolCall.result;
  const hasResult = rawResult !== undefined && rawResult !== null && rawResult !== '';

  // Parse completed state from result
  const completedState = useMemo(() => {
    if (!hasResult) return null;

    if (typeof rawResult === 'string') {
      try {
        const parsed = JSON.parse(rawResult);
        return {
          decision: parsed.decision as 'allow' | 'deny',
          scope: parsed.scope as PermissionScope,
          cancelled: parsed.cancelled || false,
        };
      } catch {
        // Try to infer from string
        const lower = rawResult.toLowerCase();
        if (lower.includes('allow')) {
          return { decision: 'allow' as const, scope: 'once' as PermissionScope, cancelled: false };
        }
        if (lower.includes('deny') || lower.includes('cancel')) {
          return { decision: 'deny' as const, scope: 'once' as PermissionScope, cancelled: lower.includes('cancel') };
        }
      }
    }
    return null;
  }, [rawResult, hasResult]);

  const isCompleted = hasResult && completedState !== null;
  const isPending = !isCompleted;

  // Local state for UI
  const [showTooltip, setShowTooltip] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [localResult, setLocalResult] = useState<{ decision: 'allow' | 'deny'; scope: PermissionScope; cancelled?: boolean } | null>(null);
  const [isAllowingAllDomains, setIsAllowingAllDomains] = useState(false);

  // All handlers read the host imperatively at click time so a stale-null
  // captured value from useAtomValue (e.g. caught during the brief gap
  // between SessionTranscript's effect cleanup and re-set) doesn't bail
  // the click before the live host can answer. See #276.
  const handleDeny = useCallback(async () => {
    const liveHost = host || getInteractiveWidgetHost(sessionId);
    if (!liveHost || hasResponded || !isPending) return;

    setIsSubmitting(true);
    setLocalResult({ decision: 'deny', scope: 'once' });
    setHasResponded(true);

    try {
      await liveHost.toolPermissionSubmit(requestId, { decision: 'deny', scope: 'once' });
    } catch (error) {
      console.error('[ToolPermissionWidget] Failed to deny:', error);
      setLocalResult(null);
      setHasResponded(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [host, sessionId, requestId, hasResponded, isPending]);

  // Handle allow once
  const handleAllowOnce = useCallback(async () => {
    const liveHost = host || getInteractiveWidgetHost(sessionId);
    if (!liveHost || hasResponded || !isPending) return;

    setIsSubmitting(true);
    setLocalResult({ decision: 'allow', scope: 'once' });
    setHasResponded(true);

    try {
      await liveHost.toolPermissionSubmit(requestId, { decision: 'allow', scope: 'once' });
    } catch (error) {
      console.error('[ToolPermissionWidget] Failed to allow once:', error);
      setLocalResult(null);
      setHasResponded(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [host, sessionId, requestId, hasResponded, isPending]);

  // Handle allow session
  const handleAllowSession = useCallback(async () => {
    const liveHost = host || getInteractiveWidgetHost(sessionId);
    if (!liveHost || hasResponded || !isPending) return;

    setIsSubmitting(true);
    setLocalResult({ decision: 'allow', scope: 'session' });
    setHasResponded(true);

    try {
      await liveHost.toolPermissionSubmit(requestId, { decision: 'allow', scope: 'session' });
    } catch (error) {
      console.error('[ToolPermissionWidget] Failed to allow session:', error);
      setLocalResult(null);
      setHasResponded(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [host, sessionId, requestId, hasResponded, isPending]);

  // Handle allow always
  const handleAllowAlways = useCallback(async () => {
    const liveHost = host || getInteractiveWidgetHost(sessionId);
    if (!liveHost || hasResponded || !isPending) return;

    setIsSubmitting(true);
    setLocalResult({ decision: 'allow', scope: 'always' });
    setHasResponded(true);

    try {
      await liveHost.toolPermissionSubmit(requestId, { decision: 'allow', scope: 'always' });
    } catch (error) {
      console.error('[ToolPermissionWidget] Failed to allow always:', error);
      setLocalResult(null);
      setHasResponded(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [host, sessionId, requestId, hasResponded, isPending]);

  // Handle allow all domains (WebFetch only)
  const handleAllowAllDomains = useCallback(async () => {
    const liveHost = host || getInteractiveWidgetHost(sessionId);
    if (!liveHost || hasResponded || !isPending) return;

    setIsAllowingAllDomains(true);
    setLocalResult({ decision: 'allow', scope: 'always-all' });
    setHasResponded(true);

    try {
      await liveHost.toolPermissionSubmit(requestId, { decision: 'allow', scope: 'always-all' });
    } catch (error) {
      console.error('[ToolPermissionWidget] Failed to allow all domains:', error);
      setLocalResult(null);
      setHasResponded(false);
      setIsAllowingAllDomains(false);
    }
  }, [host, sessionId, requestId, hasResponded, isPending]);

  // Determine display state
  const displayResult = localResult || completedState;
  const displayCancelled = displayResult?.cancelled || false;
  const approvalState = getApprovalState(displayResult, hasResponded);
  const shellClassName = `tool-permission-widget agent-elements-tool-card agent-elements-permission-tool-card ${
    isDestructive && approvalState === 'pending'
      ? 'border-[var(--an-error-color)] bg-[color-mix(in_srgb,var(--an-error-color)_5%,var(--an-background-secondary))]'
      : ''
  } ${approvalState === 'pending' ? '' : 'opacity-85'}`;
  const shellProps = {
    'data-component': 'RichTranscriptAgentElementsToolPermission',
    'data-agent-elements-shell': 'approval-card',
    'data-agent-elements-card-padding': 'symmetric-inline',
    'data-agent-elements-card-width': 'bridge-fill',
    'data-approval-state': approvalState,
    'data-approval-decision': displayResult?.decision ?? undefined,
    'data-destructive': isDestructive ? 'true' : 'false',
    'data-testid': 'tool-permission-widget',
  };

  // Show completed state
  if (displayResult || hasResponded) {
    const statusText = displayCancelled
      ? 'Permission Cancelled'
      : displayResult?.decision === 'allow'
        ? 'Permission Granted'
        : 'Permission Denied';

    const statusColor = displayCancelled
      ? 'text-[var(--an-foreground-muted)]'
      : displayResult?.decision === 'allow'
        ? 'text-[var(--an-success-color)]'
        : 'text-[var(--an-error-color)]';

    const scopeText = displayResult?.scope === 'always-all'
      ? 'All Domains'
      : displayResult?.scope === 'always'
        ? 'Always'
        : displayResult?.scope === 'session'
          ? 'This Session'
          : 'Once';

    return (
      <div
        {...shellProps}
        data-state={displayResult?.decision === 'allow' ? 'granted' : 'denied'}
        className={shellClassName}
      >
        <div className="agent-elements-tool-header">
          <PermissionStatusIcon state={approvalState} isDestructive={isDestructive} />
          <div className="agent-elements-tool-title-group">
            <span className="agent-elements-tool-title">
              {statusText}
              {teammateName && (
                <span className="ml-2 text-xs font-normal text-[var(--an-foreground-muted)]">
                  (from teammate: {teammateName})
                </span>
              )}
            </span>
            <span className="agent-elements-tool-subtitle">{patternDisplayName}</span>
          </div>
          <span className="agent-elements-tool-trailing">
            <AgentStatusPill
              className={statusColor}
              tone={getApprovalTone(approvalState, isDestructive)}
            >
              <span data-testid="tool-permission-status">{getApprovalLabel(approvalState)}</span>
            </AgentStatusPill>
          </span>
        </div>

        <div className="agent-elements-tool-primary">
          {filePermissionPreview ? (
            <FilePermissionPreview preview={filePermissionPreview} />
          ) : (
            <div className={permissionCommandBlockClass}>
              <code
                className={permissionCommandCodeClass}
                data-testid="tool-permission-command"
              >
                {rawCommand || toolName}
              </code>
            </div>
          )}
        </div>

        <div className="agent-elements-tool-footer">
          <span
            data-testid={displayResult?.decision === 'allow' ? 'tool-permission-granted' : 'tool-permission-denied'}
            className={`agent-elements-status-pill ${
              displayResult?.decision === 'allow'
                ? 'text-[var(--an-success-color)]'
                : 'text-[var(--an-foreground-muted)]'
            }`}
          >
            {scopeText}
          </span>
        </div>
      </div>
    );
  }

  // Previously: when `host` was null we rendered a button-less "Waiting..."
  // shell. That trapped users when SessionTranscript's host-attaching effect
  // re-ran (cleanup nulls the atom, the new effect re-sets it on the next
  // commit) and a permission request rendered during the gap, or when the
  // session was mounted in a context that hadn't installed a host yet.
  // The dialog had no controls to approve, deny, or cancel and stayed stuck
  // indefinitely. See #276.
  //
  // Fix: fall through to the full interactive UI even when `host` is null.
  // Click handlers read the host imperatively via getInteractiveWidgetHost
  // at click time, so a transient atom-null doesn't poison the click. When
  // `host` stays null at click time (rare; only if SessionTranscript truly
  // never mounted for this session), the buttons are visibly disabled with
  // a "Reconnecting to permission backend..." note instead of an invisible
  // no-op. See `hostUnavailable` below.

  // Show interactive UI for pending request
  return (
    <div
      {...shellProps}
      data-state="pending"
      className={shellClassName}
    >
      {/* Header */}
      <div className="agent-elements-tool-header">
        <PermissionStatusIcon state={approvalState} isDestructive={isDestructive} />
        <div className="agent-elements-tool-title-group">
          <span className="agent-elements-tool-title">
            Allow this tool?
            {teammateName && (
              <span className="ml-2 text-xs font-normal text-[var(--an-foreground-muted)]">
                (from teammate: {teammateName})
              </span>
            )}
          </span>
          <span className="agent-elements-tool-subtitle">{patternDisplayName}</span>
        </div>
        <span className="agent-elements-tool-trailing">
          <AgentStatusPill tone={getApprovalTone(approvalState, isDestructive)}>
            <span data-testid="tool-permission-status">{getApprovalLabel(approvalState)}</span>
          </AgentStatusPill>
        </span>
        <span
          className="relative flex items-center cursor-pointer text-[var(--an-foreground-subtle)] hover:text-[var(--an-foreground-muted)]"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 11V8M8 5.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {showTooltip && (
            <div className="absolute bottom-full right-0 z-[100] mb-2 w-[300px] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] p-3 text-[11px] leading-relaxed text-[var(--an-foreground-muted)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_12%,transparent)]">
              <div className="mb-2 font-semibold text-[var(--an-foreground)]">
                Permission Options
              </div>
              <div className="mb-2">
                <span className="font-semibold text-[var(--an-foreground)]">Deny:</span> Block this request
              </div>
              <div className="mb-2">
                <span className="font-semibold text-[var(--an-foreground)]">Allow Once:</span> Allow just this request
              </div>
              <div className="mb-2">
                <span className="font-semibold text-[var(--an-foreground)]">Session:</span> Allow{' '}
                <span className="rounded-[var(--an-input-border-radius)] bg-[var(--an-background-secondary)] px-1 py-0.5 font-mono text-[10px] text-[var(--an-foreground-subtle)]">
                  {patternDisplayName}
                </span> until you close the app
              </div>
              <div className="mb-0">
                <span className="font-semibold text-[var(--an-foreground)]">Always:</span> Save to{' '}
                <span className="rounded-[var(--an-input-border-radius)] bg-[var(--an-background-secondary)] px-1 py-0.5 font-mono text-[10px] text-[var(--an-foreground-subtle)]">
                  .claude/settings.local.json
                </span>
              </div>
              <div className="mt-2 border-t border-[var(--an-border-color)] pt-2 text-[var(--an-foreground-subtle)]">
                Pattern: <span className="rounded-[var(--an-input-border-radius)] bg-[var(--an-background-secondary)] px-1 py-0.5 font-mono text-[10px] text-[var(--an-foreground-subtle)]">{pattern}</span>
              </div>
            </div>
          )}
        </span>
      </div>

      <div className="agent-elements-tool-primary flex flex-col gap-2">
        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-[var(--an-warning-color)]">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-px">
                  <path d="M8 5.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {outsidePaths.length > 0 && (
          <div
            data-testid="tool-permission-outside-paths"
            className="rounded-[var(--an-input-border-radius)] border border-[var(--an-error-color)] bg-[color-mix(in_srgb,var(--an-error-color)_8%,transparent)] px-2 py-1.5 text-xs text-[var(--an-error-color)]"
          >
            <div className="font-semibold mb-1">Outside active workspace/worktree</div>
            {outsidePaths.map((outsidePath, i) => (
              <div key={i} className="font-mono text-[11px] break-all" data-testid="tool-permission-outside-path">
                {outsidePath}
              </div>
            ))}
          </div>
        )}

        {sensitivePaths.length > 0 && (
          <div
            data-testid="tool-permission-sensitive-paths"
            className="rounded-[var(--an-input-border-radius)] border border-[var(--an-warning-color)] bg-[color-mix(in_srgb,var(--an-warning-color)_8%,transparent)] px-2 py-1.5 text-xs text-[var(--an-warning-color)]"
          >
            <div className="font-semibold mb-1">Sensitive path</div>
            {sensitivePaths.map((sensitivePath, i) => (
              <div key={i} className="font-mono text-[11px] break-all">
                {sensitivePath}
              </div>
            ))}
          </div>
        )}

        {/* Operation display */}
        {filePermissionPreview ? (
          <FilePermissionPreview preview={filePermissionPreview} />
        ) : (
          <div className={permissionCommandBlockClass}>
            <code
              className={permissionCommandCodeClass}
              data-testid="tool-permission-command"
            >
              {rawCommand || toolName}
            </code>
          </div>
        )}

        {/* Host-unavailable note: shown when useAtomValue captured a null
            host. Click handlers fall back to getInteractiveWidgetHost at
            click time so a transient null does not stop the click, but the
            user gets a visible signal in case the host never attaches. */}
        {!host && (
          <div
            data-testid="tool-permission-host-reconnecting"
            className="rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-2 py-1.5 text-[11px] text-[var(--an-foreground-muted)]"
          >
            Reconnecting to permission backend. Buttons will work once the
            session view is fully loaded.
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--an-border-color)]">
          <button
            type="button"
            data-testid="tool-permission-deny"
            onClick={handleDeny}
            disabled={isSubmitting}
            className={permissionSecondaryButtonClass}
          >
            Deny
          </button>
          <button
            type="button"
            data-testid="tool-permission-allow-once"
            onClick={handleAllowOnce}
            disabled={isSubmitting}
            className={permissionSecondaryButtonClass}
          >
            Allow Once
          </button>
          <div className={permissionSeparatorClass} />
          <button
            type="button"
            data-testid="tool-permission-allow-session"
            onClick={handleAllowSession}
            disabled={isSubmitting}
            title={`Allow ${patternDisplayName} for this session`}
            className="cursor-pointer whitespace-nowrap rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-transparent px-3 py-1.5 text-[11px] font-medium text-[var(--an-primary-color)] transition-[background-color,border-color,color,opacity] duration-150 hover:bg-[color-mix(in_srgb,var(--an-primary-color)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Session
          </button>
          <button
            type="button"
            data-testid="tool-permission-allow-always"
            onClick={handleAllowAlways}
            disabled={isSubmitting}
            title={`Save ${patternDisplayName} to .claude/settings.local.json`}
            className={permissionPrimaryButtonClass}
          >
            Always
          </button>
          {isWebFetchRequest && (
            <>
              <div className={permissionSeparatorClass} />
              <button
                type="button"
                data-testid="tool-permission-allow-all-domains"
                onClick={handleAllowAllDomains}
                disabled={isSubmitting || isAllowingAllDomains}
                title="Allow fetching from any domain without asking"
                className={permissionPrimaryButtonClass}
              >
                {isAllowingAllDomains ? 'Saving...' : 'All Domains'}
              </button>
            </>
          )}
        </div>

        {/* Pattern info */}
        <div className="text-[11px] text-[var(--an-foreground-subtle)]">
          Session/Always will allow: <span className="rounded-[var(--an-input-border-radius)] bg-[var(--an-background-tertiary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--an-foreground-muted)]">{patternDisplayName}</span>
        </div>
      </div>
    </div>
  );
};
