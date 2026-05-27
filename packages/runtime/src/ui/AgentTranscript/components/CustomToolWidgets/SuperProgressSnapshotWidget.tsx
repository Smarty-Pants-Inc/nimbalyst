/**
 * SuperProgressSnapshotWidget - Displays a progress.json snapshot in the chat transcript.
 *
 * Injected by SuperLoopService at the start and end of each Super Loop iteration.
 * Shows formatted progress data (phase, status, learnings, blockers) with debug-only JSON.
 */

import React from 'react';
import { AgentStatusPill, AgentToolCard, type AgentStatusTone, type AgentToolStatus } from '../../../AgentElements/AgentElementsPrimitives';
import { MaterialSymbol } from '../../../icons/MaterialSymbol';
import type { CustomToolWidgetProps } from './index';

interface ProgressSnapshot {
  timing: 'iteration-start' | 'iteration-end';
  iterationNumber: number;
  superLoopId: string;
  progress: {
    currentIteration: number;
    phase: string;
    status: string;
    completionSignal: boolean;
    learnings: Array<{ iteration: number; summary: string; filesChanged: string[] }>;
    blockers: string[];
    userFeedback?: string;
  };
  capturedAt: number;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function phaseTone(phase: string): AgentStatusTone {
  if (phase === 'building') return 'running';
  if (phase === 'planning') return 'neutral';
  return 'neutral';
}

function statusTone(status: string): AgentStatusTone {
  if (status === 'completed') return 'success';
  if (status === 'blocked') return 'warning';
  if (status === 'running') return 'running';
  return 'neutral';
}

function toolStatus(status: string): AgentToolStatus {
  if (status === 'completed') return 'completed';
  if (status === 'blocked') return 'interrupted';
  if (status === 'running') return 'running';
  return 'idle';
}

const SnapshotRow: React.FC<{
  className?: string;
  icon: string;
  label: string;
  testId: string;
  children: React.ReactNode;
}> = ({ className, icon, label, testId, children }) => (
  <div
    className={classNames(
      'agent-elements-super-progress-snapshot-row grid grid-cols-[1rem_4.5rem_minmax(0,1fr)] items-start gap-[var(--an-spacing-xs)] text-sm text-[var(--an-tool-color)]',
      className
    )}
    data-agent-elements-shell="super-progress-snapshot-row"
    data-testid={testId}
  >
    <span className="agent-elements-super-progress-snapshot-row-icon mt-0.5 text-[var(--an-tool-color-muted)]" aria-hidden="true">
      <MaterialSymbol icon={icon} size={14} />
    </span>
    <span className="agent-elements-super-progress-snapshot-row-label text-xs font-medium text-[var(--an-tool-color-muted)]">
      {label}
    </span>
    <span className="agent-elements-super-progress-snapshot-row-value min-w-0 break-words select-text">
      {children}
    </span>
  </div>
);

export const SuperProgressSnapshotWidget: React.FC<CustomToolWidgetProps> = ({ message }) => {
  const tool = message.toolCall;
  if (!tool?.arguments) return null;

  const snapshot = tool.arguments as unknown as ProgressSnapshot;
  const { timing, iterationNumber, progress } = snapshot;

  if (!progress) return null;

  const isStart = timing === 'iteration-start';
  const timingLabel = isStart ? 'Iteration Start' : 'Iteration End';
  const status = toolStatus(progress.status);

  return (
    <AgentToolCard
      className="agent-elements-super-progress-snapshot-card"
      data-agent-elements-shell="super-progress-snapshot-card"
      data-component="RichTranscriptAgentElementsSuperProgressSnapshot"
      data-testid="agent-elements-super-progress-snapshot-card"
      debugPayload={progress}
      icon={<MaterialSymbol icon={isStart ? 'play_arrow' : 'stop_circle'} size={14} />}
      status={status}
      subtitle={`iteration ${progress.currentIteration}`}
      title={`${timingLabel} #${iterationNumber}`}
      trailing={(
        <div className="agent-elements-super-progress-snapshot-badges flex min-w-0 flex-wrap justify-end gap-[var(--an-spacing-xs)]">
          <span
            className="agent-elements-super-progress-snapshot-phase"
            data-testid="agent-elements-super-progress-snapshot-phase"
          >
            <AgentStatusPill
              tone={phaseTone(progress.phase)}
            >
              {progress.phase}
            </AgentStatusPill>
          </span>
          <span
            className="agent-elements-super-progress-snapshot-status"
            data-testid="agent-elements-super-progress-snapshot-status"
          >
            <AgentStatusPill
              tone={statusTone(progress.status)}
            >
              {progress.status}
            </AgentStatusPill>
          </span>
          {progress.completionSignal ? (
            <AgentStatusPill tone="success">complete</AgentStatusPill>
          ) : null}
        </div>
      )}
    >
      <div
        className="agent-elements-super-progress-snapshot-body flex flex-col gap-[var(--an-spacing-sm)]"
        data-agent-elements-shell="super-progress-snapshot-body"
        data-testid="agent-elements-super-progress-snapshot-body"
      >
        {progress.userFeedback ? (
          <SnapshotRow
            icon="forum"
            label="Feedback"
            testId="agent-elements-super-progress-snapshot-feedback"
          >
            {progress.userFeedback}
          </SnapshotRow>
        ) : null}

        {progress.blockers.length > 0 ? (
          <div className="agent-elements-super-progress-snapshot-blockers flex flex-col gap-[var(--an-spacing-xs)]">
            {progress.blockers.map((blocker, index) => (
              <SnapshotRow
                className="text-[var(--an-warning-color,var(--an-tool-color))]"
                icon="report"
                key={`${blocker}-${index}`}
                label="Blocker"
                testId={`agent-elements-super-progress-snapshot-blocker-${index}`}
              >
                {blocker}
              </SnapshotRow>
            ))}
          </div>
        ) : null}

        {progress.learnings.length > 0 ? (
          <div className="agent-elements-super-progress-snapshot-learnings flex flex-col gap-[var(--an-spacing-xs)]">
            <span className="agent-elements-super-progress-snapshot-section-label text-xs font-medium text-[var(--an-tool-color-muted)]">
              Learnings ({progress.learnings.length})
            </span>
            {progress.learnings.map((learning, index) => (
              <SnapshotRow
                icon="psychology"
                key={`${learning.iteration}-${index}`}
                label={`#${learning.iteration}`}
                testId={`agent-elements-super-progress-snapshot-learning-${index}`}
              >
                {learning.summary}
              </SnapshotRow>
            ))}
          </div>
        ) : null}

        {progress.blockers.length === 0 && progress.learnings.length === 0 && !progress.userFeedback ? (
          <span className="agent-elements-super-progress-snapshot-empty text-sm italic text-[var(--an-tool-color-muted)]">
            No learnings or blockers recorded yet
          </span>
        ) : null}
      </div>
    </AgentToolCard>
  );
};

SuperProgressSnapshotWidget.displayName = 'SuperProgressSnapshotWidget';
