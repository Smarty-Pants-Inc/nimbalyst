/**
 * SuperFilesPanel - Shows Super Loop progress and .superloop/ files for a worktree.
 *
 * Since .superloop/ is gitignored, these files don't appear in the uncommitted files view.
 * This panel surfaces the loop's progress (phase, iteration, learnings, blockers)
 * and provides clickable links to open the .superloop/ files directly.
 */

import React, { useState, useEffect, useCallback, useId } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import {
  superProgressAtom,
  setSuperProgressAtom,
} from '../../store/atoms/superLoop';
import type { SuperLoop } from '../../../shared/types/superLoop';

interface SuperFilesPanelProps {
  worktreeId: string;
  worktreePath: string;
  onFileClick: (filePath: string) => void;
}

const SUPER_LOOP_FILES = [
  { name: 'IMPLEMENTATION_PLAN.md', icon: 'description' as const, label: 'Plan' },
  { name: 'task.md', icon: 'task' as const, label: 'Task' },
  { name: 'progress.json', icon: 'monitoring' as const, label: 'Progress' },
  { name: 'config.json', icon: 'settings' as const, label: 'Config' },
];

const panelClass = [
  'super-files-panel',
  'agent-elements-super-files-panel',
  'flex shrink-0 flex-col border-t border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] text-[var(--an-foreground)] [container-type:inline-size]',
].join(' ');

const headerClass = [
  'super-files-panel-header',
  'agent-elements-super-files-header',
  'flex min-h-[34px] w-full cursor-pointer items-center gap-[var(--an-spacing-sm)]',
  'border border-transparent bg-transparent px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)]',
  'text-left text-[var(--an-foreground-muted)] outline-none',
  'transition-[background-color,border-color,color] duration-150 ease-out',
  'hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const contentClass = [
  'super-files-panel-content',
  'agent-elements-super-files-content',
  'flex flex-col gap-[var(--an-spacing-md)] px-[var(--an-spacing-lg)]',
  'pb-[var(--an-spacing-md)] pt-[var(--an-spacing-xs)]',
].join(' ');

const infoRowClass = [
  'flex items-start gap-[var(--an-spacing-sm)] rounded-[calc(var(--an-tool-border-radius)_-_4px)]',
  'border border-[var(--an-border-color)] bg-[var(--an-background)]',
  'px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-xs leading-snug',
].join(' ');

const fileButtonClass = [
  'agent-elements-super-file-link',
  'flex cursor-pointer items-center gap-[var(--an-spacing-xxs)] rounded-[calc(var(--an-tool-border-radius)_-_4px)]',
  'border border-[var(--an-border-color)] bg-[var(--an-background)]',
  'px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)] text-[11px] font-medium text-[var(--an-primary-color)]',
  'outline-none transition-[background-color,border-color,color] duration-150 ease-out',
  'hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]',
].join(' ');

function getPhaseTone(phase: string): string {
  if (phase === 'completed') return 'success';
  if (phase === 'blocked' || phase === 'paused') return 'warning';
  if (phase === 'failed') return 'error';
  if (phase === 'planning' || phase === 'building' || phase === 'running') return 'running';
  return 'neutral';
}

function getFileTestId(fileName: string): string {
  return `agent-elements-super-file-link-${fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export const SuperFilesPanel: React.FC<SuperFilesPanelProps> = React.memo(({
  worktreeId,
  worktreePath,
  onFileClick,
}) => {
  const [loop, setLoop] = useState<SuperLoop | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const contentId = useId();

  const progress = useAtomValue(superProgressAtom(loop?.id ?? ''));
  const setProgress = useSetAtom(setSuperProgressAtom);

  // Load the super loop for this worktree
  useEffect(() => {
    let cancelled = false;

    async function loadLoop() {
      try {
        const result = await window.electronAPI.invoke('super-loop:get-by-worktree', worktreeId);
        if (!cancelled && result.success && result.loop) {
          setLoop(result.loop);
        }
      } catch (error) {
        console.error('[SuperFilesPanel] Failed to load super loop:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadLoop();
    return () => { cancelled = true; };
  }, [worktreeId]);

  // Load progress data when loop is available
  useEffect(() => {
    if (!loop) return;
    const loopId = loop.id;
    let cancelled = false;

    async function loadProgress() {
      // Only fetch if not already cached in the atom
      if (progress) return;

      try {
        const result = await window.electronAPI.invoke('super-loop:get-progress', loopId);
        if (!cancelled && result.success && result.progress) {
          setProgress({ loopId, progress: result.progress });
        }
      } catch (error) {
        console.error('[SuperFilesPanel] Failed to load progress:', error);
      }
    }

    loadProgress();
    return () => { cancelled = true; };
  }, [loop, progress, setProgress]);

  const handleToggle = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const handleFileClick = useCallback((fileName: string) => {
    const filePath = `${worktreePath}/.superloop/${fileName}`;
    onFileClick(filePath);
  }, [worktreePath, onFileClick]);

  // Don't render if loading or no loop exists
  if (isLoading || !loop) {
    return null;
  }

  const recentLearnings = progress?.learnings?.slice(-3) ?? [];
  const blockers = progress?.blockers ?? [];
  const phase = progress?.phase ?? loop.status;
  const currentIteration = progress?.currentIteration ?? loop.currentIteration;

  return (
    <section
      className={panelClass}
      data-agent-elements-shell="super-files-panel"
      data-blocker-count={blockers.length}
      data-component="SuperFilesPanel"
      data-loop-id={loop.id}
      data-phase={phase}
      data-testid="agent-elements-super-files-panel"
      data-worktree-id={worktreeId}
    >
      <button
        aria-controls={contentId}
        aria-expanded={!isCollapsed}
        className={headerClass}
        data-agent-elements-shell="super-files-header"
        data-testid="agent-elements-super-files-header"
        onClick={handleToggle}
        type="button"
      >
        <MaterialSymbol
          icon={isCollapsed ? 'chevron_right' : 'expand_more'}
          size={16}
          className="shrink-0"
        />
        <MaterialSymbol
          icon="orbit"
          size={16}
          className="shrink-0"
        />
        <span className="min-w-0 flex-1 text-xs font-medium leading-none text-[var(--an-foreground)]">
          Loop Progress
        </span>
        <PhaseBadge phase={phase} tone={getPhaseTone(phase)} />
        <span
          className="agent-elements-status-pill ml-auto font-mono"
          data-testid="agent-elements-super-files-iteration"
          data-tone="neutral"
        >
          {currentIteration}/{loop.maxIterations}
        </span>
      </button>

      {!isCollapsed && (
        <div
          className={contentClass}
          data-agent-elements-shell="super-files-content"
          data-testid="agent-elements-super-files-content"
          id={contentId}
        >
          {blockers.length > 0 && (
            <div className="agent-elements-super-files-blockers flex flex-col gap-[var(--an-spacing-xxs)]">
              {blockers.map((blocker, i) => (
                <div
                  key={i}
                  className={`${infoRowClass} text-[var(--an-warning)]`}
                  data-agent-elements-shell="super-files-blocker"
                >
                  <MaterialSymbol icon="warning" size={14} className="mt-px shrink-0" />
                  <span className="min-w-0 break-words">{blocker}</span>
                </div>
              ))}
            </div>
          )}

          {recentLearnings.length > 0 && (
            <div
              className="agent-elements-super-files-recent flex flex-col gap-[var(--an-spacing-xxs)]"
              data-testid="agent-elements-super-files-recent-list"
            >
              <span className="px-[var(--an-spacing-sm)] text-[11px] font-medium leading-none text-[var(--an-foreground-muted)]">
                Recent
              </span>
              {recentLearnings.map((learning, i) => (
                <div
                  key={i}
                  className={`${infoRowClass} text-[var(--an-foreground)]`}
                  data-agent-elements-shell="super-files-learning"
                >
                  <span className="shrink-0 font-mono text-[var(--an-foreground-muted)]">
                    #{learning.iteration}
                  </span>
                  <span className="min-w-0 break-words">{learning.summary}</span>
                </div>
              ))}
            </div>
          )}

          <div className="agent-elements-super-files-links flex flex-wrap gap-[var(--an-spacing-xs)]">
            {SUPER_LOOP_FILES.map((file) => (
              <button
                key={file.name}
                className={fileButtonClass}
                data-testid={getFileTestId(file.name)}
                onClick={() => handleFileClick(file.name)}
                title={`.superloop/${file.name}`}
                type="button"
              >
                <MaterialSymbol icon={file.icon} size={14} />
                <span>{file.label}</span>
              </button>
            ))}
          </div>

          {progress && (
            <details
              className="agent-elements-super-files-debug text-[11px]"
              data-agent-elements-shell="super-files-debug-payload"
            >
              <summary className="flex cursor-pointer list-none items-center gap-[var(--an-spacing-xxs)] rounded-[calc(var(--an-tool-border-radius)_-_4px)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-[var(--an-foreground-muted)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]">
                <MaterialSymbol icon="data_object" size={12} className="shrink-0" />
                <span>Debug payload</span>
              </summary>
              <pre className="m-0 mt-[var(--an-spacing-xs)] max-h-[200px] overflow-auto whitespace-pre-wrap break-words rounded-[calc(var(--an-tool-border-radius)_-_4px)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-sm)] font-mono text-[11px] leading-relaxed text-[var(--an-foreground-muted)]">
                {JSON.stringify(progress, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
});

SuperFilesPanel.displayName = 'SuperFilesPanel';

const PhaseBadge: React.FC<{ phase: string; tone: string }> = React.memo(({ phase, tone }) => {
  return (
    <span
      className="agent-elements-status-pill shrink-0"
      data-testid="agent-elements-super-files-phase"
      data-tone={tone}
    >
      {phase}
    </span>
  );
});

PhaseBadge.displayName = 'PhaseBadge';
