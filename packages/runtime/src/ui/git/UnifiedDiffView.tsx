import { useMemo, type ReactNode } from 'react';

interface UnifiedDiffViewProps {
  diff: string;
  isBinary?: boolean;
  loading?: boolean;
  error?: string | null;
}

type LineKind = 'add' | 'del' | 'ctx' | 'hunk' | 'meta';

interface DiffLine {
  kind: LineKind;
  text: string;
  oldLine?: number;
  newLine?: number;
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function parseUnifiedDiff(diff: string): DiffLine[] {
  const out: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const raw of diff.split('\n')) {
    if (raw.startsWith('@@')) {
      const match = raw.match(HUNK_RE);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[3], 10);
        inHunk = true;
      }
      out.push({ kind: 'hunk', text: raw });
      continue;
    }

    if (!inHunk) {
      if (raw === '') continue;
      out.push({ kind: 'meta', text: raw });
      continue;
    }

    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      out.push({ kind: 'add', text: raw.slice(1), newLine });
      newLine++;
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      out.push({ kind: 'del', text: raw.slice(1), oldLine });
      oldLine++;
    } else if (raw.startsWith(' ')) {
      out.push({ kind: 'ctx', text: raw.slice(1), oldLine, newLine });
      oldLine++;
      newLine++;
    } else if (raw.startsWith('\\')) {
      out.push({ kind: 'meta', text: raw });
    }
  }

  return out;
}

const PLACEHOLDER_BASE =
  'unified-diff-placeholder flex min-h-[120px] items-center justify-center p-[var(--an-spacing-xxl)] text-center text-xs italic text-[var(--an-foreground-subtle)]';

function renderPlaceholder(state: 'loading' | 'error' | 'binary' | 'empty', children: ReactNode) {
  const stateClass =
    state === 'error'
      ? 'not-italic text-[var(--an-diff-removed-text)]'
      : '';

  return (
    <div
      className={`${PLACEHOLDER_BASE} ${stateClass}`}
      data-testid="agent-elements-unified-diff-placeholder"
      data-component="UnifiedDiffViewPlaceholder"
      data-agent-elements-shell="unified-diff-placeholder"
      data-state={state}
    >
      {children}
    </div>
  );
}

export function UnifiedDiffView({ diff, isBinary, loading, error }: UnifiedDiffViewProps) {
  const lines = useMemo(() => (diff ? parseUnifiedDiff(diff) : []), [diff]);

  if (loading) {
    return renderPlaceholder('loading', 'Loading diff...');
  }
  if (error) {
    return renderPlaceholder('error', error);
  }
  if (isBinary) {
    return renderPlaceholder('binary', 'Binary file');
  }
  if (!diff || lines.length === 0) {
    return renderPlaceholder('empty', 'No textual changes');
  }

  const visibleLines = lines.filter((line) => line.kind !== 'meta');

  return (
    <div
      className="unified-diff-view agent-elements-unified-diff-view pb-1.5 font-mono text-xs leading-normal text-[var(--an-foreground-muted)]"
      data-testid="agent-elements-unified-diff-view"
      data-component="UnifiedDiffView"
      data-agent-elements-shell="unified-diff-view"
    >
      {visibleLines.map((line, i) => {
        if (line.kind === 'hunk') {
          return (
            <div
              key={i}
              className="unified-diff-line agent-elements-unified-diff-line mt-1 flex min-h-[18px] whitespace-pre bg-[color-mix(in_srgb,var(--an-primary-color)_8%,transparent)]"
              data-testid={`agent-elements-unified-diff-line-${i}`}
              data-agent-elements-shell="unified-diff-line"
              data-line-kind={line.kind}
            >
              <span
                className="flex flex-none select-none pr-1 text-[11px] text-[var(--an-foreground-subtle)]"
                data-testid="agent-elements-unified-diff-gutter"
              />
              <span
                className="flex-1 px-2 py-0 font-medium text-[var(--an-primary-color)]"
                data-testid="agent-elements-unified-diff-code"
              >
                {line.text}
              </span>
            </div>
          );
        }
        const lineBg =
          line.kind === 'add'
            ? 'bg-[var(--an-diff-added-bg)]'
            : line.kind === 'del'
              ? 'bg-[var(--an-diff-removed-bg)]'
              : '';
        const textColor =
          line.kind === 'add'
            ? 'text-[var(--an-diff-added-text)]'
            : line.kind === 'del'
              ? 'text-[var(--an-diff-removed-text)]'
              : 'text-[var(--an-foreground-muted)]';
        const signColor =
          line.kind === 'add'
            ? 'text-[var(--an-diff-added-text)] opacity-100'
            : line.kind === 'del'
              ? 'text-[var(--an-diff-removed-text)] opacity-100'
              : 'opacity-65';
        const sign = line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' ';
        return (
          <div
            key={i}
            className={`unified-diff-line agent-elements-unified-diff-line flex min-h-[18px] whitespace-pre ${lineBg}`}
            data-testid={`agent-elements-unified-diff-line-${i}`}
            data-agent-elements-shell="unified-diff-line"
            data-line-kind={line.kind}
          >
            <span
              className="flex flex-none select-none border-r border-[var(--an-border-color)] bg-[var(--an-tool-background)] pr-1 text-[11px] text-[var(--an-foreground-subtle)]"
              data-testid="agent-elements-unified-diff-gutter"
            >
              <span
                className="inline-block w-[38px] px-1 py-0 text-right opacity-70"
                data-testid="agent-elements-unified-diff-old-line"
              >
                {line.oldLine ?? ''}
              </span>
              <span
                className="inline-block w-[38px] px-1 py-0 text-right opacity-70"
                data-testid="agent-elements-unified-diff-new-line"
              >
                {line.newLine ?? ''}
              </span>
              <span
                className={`inline-block w-[14px] text-center font-semibold ${signColor}`}
                data-testid="agent-elements-unified-diff-sign"
              >
                {sign}
              </span>
            </span>
            <span
              className={`flex-1 px-2 py-0 ${textColor}`}
              data-testid="agent-elements-unified-diff-code"
            >
              {line.text || ' '}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function diffStats(diff: string): { added: number; removed: number } {
  if (!diff) return { added: 0, removed: 0 };
  let added = 0;
  let removed = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+') && !raw.startsWith('+++')) added++;
    else if (raw.startsWith('-') && !raw.startsWith('---')) removed++;
  }
  return { added, removed };
}
