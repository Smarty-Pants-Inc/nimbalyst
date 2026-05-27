/**
 * UpdateSessionMetaWidget - Custom widget for the update_session_meta MCP tool.
 *
 * Shows session metadata transitions: what changed and the resulting state.
 * - Tags: kept (neutral), added (green), removed (red strikethrough)
 * - Phase: always shown as a transition arrow (old -> new)
 * - Name: shown with "Set" badge if newly set, or "Already set" note
 */

import React from 'react';
import { AgentStatusPill, AgentToolCard, type AgentStatusTone, type AgentToolStatus } from '../../../AgentElements/AgentElementsPrimitives';
import { MaterialSymbol } from '../../../icons/MaterialSymbol';
import type { CustomToolWidgetProps } from './index';

// ---------- Types ----------

interface MetaState {
  name: string | null;
  tags: string[];
  phase: string | null;
}

interface StructuredResult {
  summary: string;
  before: MetaState;
  after: MetaState;
}

// ---------- Helpers ----------

/** Try to extract a text string from the tool result, handling multiple storage shapes */
function getResultText(result: unknown): string | null {
  if (!result) return null;
  if (typeof result === 'string') return result;

  // Direct MCP content array: [{ type: "text", text: "..." }]
  if (Array.isArray(result)) {
    for (const block of result) {
      if (block && block.type === 'text' && block.text) return block.text as string;
    }
    return null;
  }

  const r = result as any;

  // Wrapped MCP content: { content: [{ type: "text", text: "..." }] }
  if (r.content && Array.isArray(r.content)) {
    for (const block of r.content) {
      if (block.type === 'text' && block.text) return block.text as string;
    }
  }

  // ToolResult.result may hold the raw content
  if (r.result != null) return getResultText(r.result);

  // ToolResult.output may hold the raw content
  if (r.output != null && typeof r.output === 'string') return r.output;

  // Already-parsed structured object (from canonical transcript path):
  // the transformer extracts inner text and parseToolResult() parses it back
  if (r.summary != null && typeof r.summary === 'string') return r.summary;

  return null;
}

function extractResult(tool: { result?: unknown }): StructuredResult | null {
  // Direct structured object: when the canonical transcript path extracts the inner
  // JSON text from MCP content arrays, parseToolResult() parses it back into a plain
  // object. Check for that shape first before trying the text extraction path.
  if (tool.result && typeof tool.result === 'object' && !Array.isArray(tool.result)) {
    const r = tool.result as any;
    if (r.before && r.after) {
      return r as StructuredResult;
    }
  }

  const text = getResultText(tool.result);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (parsed.before && parsed.after) {
      return parsed as StructuredResult;
    }
    // MCP content wrapper: { content: [{ type: "text", text: "{...}" }] }
    if (parsed.content && Array.isArray(parsed.content)) {
      const innerText = getResultText(parsed);
      if (innerText) {
        try {
          const inner = JSON.parse(innerText);
          if (inner.before && inner.after) return inner as StructuredResult;
        } catch { /* not JSON inner text */ }
      }
    }
    // Codex SDK wraps MCP results in { success, result, status }.
    if (parsed.result) {
      const inner = typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result;
      if (inner && inner.before && inner.after) {
        return inner as StructuredResult;
      }
    }
  } catch {
    // Not JSON - old format, can't show transitions
  }

  return null;
}

// ---------- Agent Elements shell helpers ----------

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function tagTestIdPart(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tag';
}

function phaseTone(phase: string | null): AgentStatusTone {
  if (phase === 'complete') return 'success';
  if (phase === 'validating') return 'warning';
  if (phase === 'implementing') return 'running';
  return 'neutral';
}

function tagTone(variant: 'kept' | 'added' | 'removed'): AgentStatusTone {
  if (variant === 'added') return 'success';
  if (variant === 'removed') return 'error';
  return 'neutral';
}

// ---------- Small components ----------

const PhaseBadge: React.FC<{ phase: string }> = ({ phase }) => {
  return (
    <AgentStatusPill
      className="agent-elements-session-meta-phase-badge"
      tone={phaseTone(phase)}
    >
      {phase}
    </AgentStatusPill>
  );
};

const TagPill: React.FC<{ tag: string; variant: 'kept' | 'added' | 'removed' }> = ({ tag, variant }) => {
  const prefix = variant === 'added' ? '+' : variant === 'removed' ? '-' : '';

  return (
    <span
      className={classNames(
        'agent-elements-status-pill agent-elements-session-meta-tag',
        variant === 'removed' && 'line-through'
      )}
      data-session-meta-tag-state={variant}
      data-testid={`agent-elements-session-meta-tag-${variant}-${tagTestIdPart(tag)}`}
      data-tone={tagTone(variant)}
    >
      {prefix && (
        <span className="font-semibold" aria-hidden="true">{prefix}</span>
      )}
      <span>#{tag}</span>
    </span>
  );
};

const Arrow: React.FC = () => (
  <span className="agent-elements-session-meta-arrow text-[var(--an-tool-color-muted)]" aria-hidden="true">
    {'\u2192'}
  </span>
);

const SessionMetaRow: React.FC<{
  label: string;
  testId: string;
  children: React.ReactNode;
}> = ({ label, testId, children }) => (
  <div
    className="agent-elements-session-meta-row grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-[var(--an-spacing-sm)]"
    data-agent-elements-shell="session-meta-row"
    data-testid={testId}
  >
    <span className="agent-elements-session-meta-label pt-px text-xs font-medium text-[var(--an-tool-color-muted)]">
      {label}
    </span>
    <div className="agent-elements-session-meta-value flex min-w-0 flex-wrap items-center gap-[var(--an-spacing-xs)] text-sm text-[var(--an-tool-color)]">
      {children}
    </div>
  </div>
);

const SessionMetaCard: React.FC<{
  status: AgentToolStatus;
  statusLabel: string;
  statusTone: AgentStatusTone;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ status, statusLabel, statusTone, subtitle, children }) => (
  <AgentToolCard
    className="agent-elements-session-meta-card"
    data-agent-elements-shell="session-meta-card"
    data-component="RichTranscriptAgentElementsSessionMeta"
    data-testid="agent-elements-session-meta-card"
    icon={<MaterialSymbol icon={status === 'running' ? 'progress_activity' : 'label'} size={14} />}
    status={status}
    subtitle={subtitle}
    title="Session Meta"
    trailing={<AgentStatusPill tone={statusTone}>{statusLabel}</AgentStatusPill>}
  >
    {children}
  </AgentToolCard>
);

// ---------- Main widget ----------

export const UpdateSessionMetaWidget: React.FC<CustomToolWidgetProps> = ({ message }) => {
  const tool = message.toolCall;
  if (!tool) return null;

  const data = extractResult(tool);
  if (!data) {
    // Fallback: show plain text for old-format tool results
    const fallbackText = getResultText(tool.result) ?? '';
    if (!fallbackText) {
      // No result yet (still running) - show compact card with args
      const args = tool.arguments as Record<string, any> | undefined;
      const name = args?.name;
      if (!name && !args?.add?.length && !args?.remove?.length && !args?.phase) return null;
      return (
        <SessionMetaCard
          status="running"
          statusLabel="Updating"
          statusTone="running"
          subtitle={name}
        />
      );
    }
    return (
      <SessionMetaCard
        status="completed"
        statusLabel="Updated"
        statusTone="success"
        subtitle="Legacy result"
      >
        <div
          className="agent-elements-session-meta-body whitespace-pre-wrap text-sm text-[var(--an-tool-color-muted)] select-text"
          data-agent-elements-shell="session-meta-body"
          data-testid="agent-elements-session-meta-body"
        >
          {fallbackText}
        </div>
      </SessionMetaCard>
    );
  }

  const { before, after } = data;

  // Compute tag transitions
  const beforeSet = new Set(before.tags);
  const afterSet = new Set(after.tags);
  const kept = after.tags.filter((t) => beforeSet.has(t));
  const added = after.tags.filter((t) => !beforeSet.has(t));
  const removed = before.tags.filter((t) => !afterSet.has(t));

  // Determine what changed
  const nameChanged = before.name !== after.name;
  const nameSkipped = !nameChanged && (tool.arguments as any)?.name && before.name;
  const phaseChanged = before.phase !== after.phase;
  const tagsChanged = added.length > 0 || removed.length > 0;
  const statusLabel = nameChanged || phaseChanged || tagsChanged ? 'Updated' : 'Current';
  const subtitle = data.summary || (nameChanged ? 'Session name changed' : phaseChanged ? 'Phase changed' : tagsChanged ? 'Tags changed' : 'No changes');

  return (
    <SessionMetaCard
      status="completed"
      statusLabel={statusLabel}
      statusTone={statusLabel === 'Current' ? 'neutral' : 'success'}
      subtitle={subtitle}
    >
      <div
        className="agent-elements-session-meta-body flex flex-col gap-[var(--an-spacing-xs)] select-text"
        data-agent-elements-shell="session-meta-body"
        data-testid="agent-elements-session-meta-body"
      >
        {/* Name row */}
        {(after.name || nameSkipped) && (
          <SessionMetaRow label="Name" testId="agent-elements-session-meta-name">
            {nameChanged && before.name ? (
              <>
                <span className="text-[var(--an-tool-color-muted)]">{before.name}</span>
                <Arrow />
                <span className="font-medium">{after.name}</span>
              </>
            ) : (
              <span className="font-medium">{after.name}</span>
            )}
            {nameChanged && (
              <AgentStatusPill tone="success">{before.name ? 'renamed' : 'set'}</AgentStatusPill>
            )}
            {nameSkipped && (
              <span className="text-xs italic text-[var(--an-tool-color-muted)]">
                (already set)
              </span>
            )}
          </SessionMetaRow>
        )}

        {/* Phase row */}
        {(after.phase || phaseChanged) && (
          <SessionMetaRow label="Phase" testId="agent-elements-session-meta-phase">
            {phaseChanged ? (
              <>
                {before.phase ? (
                  <PhaseBadge phase={before.phase} />
                ) : (
                  <span className="text-xs italic text-[var(--an-tool-color-muted)]">
                    none
                  </span>
                )}
                <Arrow />
                {after.phase ? (
                  <PhaseBadge phase={after.phase} />
                ) : (
                  <span className="text-xs italic text-[var(--an-tool-color-muted)]">
                    none
                  </span>
                )}
              </>
            ) : (
              after.phase && <PhaseBadge phase={after.phase} />
            )}
          </SessionMetaRow>
        )}

        {/* Tags row */}
        {(after.tags.length > 0 || removed.length > 0) && (
          <SessionMetaRow label="Tags" testId="agent-elements-session-meta-tags">
            <div className="flex min-w-0 flex-wrap gap-[var(--an-spacing-xxs)]">
              {kept.map((t) => (
                <TagPill key={`kept-${t}`} tag={t} variant="kept" />
              ))}
              {added.map((t) => (
                <TagPill key={`added-${t}`} tag={t} variant="added" />
              ))}
              {removed.map((t) => (
                <TagPill key={`removed-${t}`} tag={t} variant="removed" />
              ))}
            </div>
          </SessionMetaRow>
        )}

        {/* Empty state: nothing at all */}
        {!after.name && !after.phase && after.tags.length === 0 && removed.length === 0 && (
          <span className="text-xs italic text-[var(--an-tool-color-muted)]">
            No metadata set
          </span>
        )}
      </div>
    </SessionMetaCard>
  );
};

UpdateSessionMetaWidget.displayName = 'UpdateSessionMetaWidget';
