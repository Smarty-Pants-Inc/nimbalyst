import { useEffect, useMemo, useRef } from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  FloatingPortal,
  autoUpdate,
  useDismiss,
  useRole,
  useInteractions,
} from '@floating-ui/react';
import { UnifiedDiffView, diffStats } from './UnifiedDiffView';

export type PopoverMode = 'peek' | 'pinned';

interface DiffPeekPopoverProps {
  anchorRect: DOMRect;
  filePath: string;
  mode: PopoverMode;
  diff: string;
  isBinary: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onPin: () => void;
  /** Optional. When provided, renders the "Open in editor" link in the header. */
  onOpenInEditor?: () => void;
  /** Controlled width in px. Falls back to a default when omitted. */
  width?: number;
  /** Controlled height in px. Falls back to a default when omitted. */
  height?: number;
  /** Called (debounced) when the user drags the resize handle. */
  onResize?: (size: { width: number; height: number }) => void;
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 380;
const RESIZE_DEBOUNCE_MS = 150;

const KBD_CLASS =
  'inline-block rounded-[var(--an-radius-xs)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-1 py-px mr-0.5 font-mono text-[9px] leading-none text-[var(--an-foreground-muted)]';

const DIFF_PEEK_CARD_GUTTERS =
  '[--agent-elements-card-block-padding:var(--an-spacing-sm)] [--agent-elements-card-inline-padding:var(--an-spacing-lg)]';

export function DiffPeekPopover({
  anchorRect,
  filePath,
  mode,
  diff,
  isBinary,
  loading,
  error,
  onClose,
  onPin,
  onOpenInEditor,
  width,
  height,
  onResize,
}: DiffPeekPopoverProps) {
  const virtualRef = useMemo(() => ({
    getBoundingClientRect: () => anchorRect,
  }), [anchorRect]);

  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    elements: { reference: virtualRef as unknown as Element },
    placement: 'right-start',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ['left-start', 'top-start', 'bottom-start'], padding: 8 }),
      shift({ padding: 8 }),
    ],
  });

  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  });
  const role = useRole(context, { role: 'dialog' });
  const { getFloatingProps } = useInteractions([dismiss, role]);

  const stats = useMemo(() => diffStats(diff), [diff]);
  const filename = filePath.split('/').pop() ?? filePath;
  const dir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';

  useEffect(() => {
    if (mode !== 'peek') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onPin();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, onPin]);

  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReportedRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!onResize) return;
    const node = refs.floating.current;
    if (!node) return;
    const initial = node.getBoundingClientRect();
    lastReportedRef.current = {
      width: Math.round(initial.width),
      height: Math.round(initial.height),
    };
    const observer = new ResizeObserver(() => {
      const rect = node.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      const last = lastReportedRef.current;
      if (last && last.width === w && last.height === h) return;
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        resizeTimerRef.current = null;
        lastReportedRef.current = { width: w, height: h };
        onResize({ width: w, height: h });
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
    };
  }, [onResize, refs.floating]);

  const sizedStyle: React.CSSProperties = {
    ...floatingStyles,
    width: width ?? DEFAULT_WIDTH,
    height: height ?? DEFAULT_HEIGHT,
  };

  const containerClass = `diff-peek-popover agent-elements-diff-peek-popover agent-elements-tool-card z-[1000] flex min-h-[160px] min-w-[320px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] resize flex-col overflow-hidden rounded-[var(--an-tool-border-radius)] border bg-[var(--an-tool-background)] text-[var(--an-tool-color)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_12%,transparent)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)] ${DIFF_PEEK_CARD_GUTTERS} ${
    mode === 'peek'
      ? 'border-dashed border-[var(--an-primary-color)]'
      : 'border-[var(--an-primary-color)]'
  }`;

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={sizedStyle}
        className={containerClass}
        data-testid="agent-elements-diff-peek-popover"
        data-component="DiffPeekPopover"
        data-agent-elements-shell="diff-peek-popover"
        data-agent-elements-card-padding="sectioned-symmetric"
        data-agent-elements-card-width="floating-popover"
        data-popover-mode={mode}
        {...getFloatingProps()}
      >
        <div
          className="diff-peek-header flex items-center gap-[var(--an-spacing-sm)] border-b border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)] text-xs"
          data-testid="agent-elements-diff-peek-header"
          data-agent-elements-shell="diff-peek-header"
        >
          <span
            className="flex flex-1 items-baseline gap-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono"
            title={filePath}
          >
            {dir && <span className="text-[11px] text-[var(--an-foreground-subtle)]">{dir}/</span>}
            <span className="font-semibold text-[var(--an-foreground)]">{filename}</span>
          </span>
          <span
            className="diff-peek-stats flex gap-1.5 font-mono text-[11px] font-semibold"
            data-testid="agent-elements-diff-peek-stats"
            data-agent-elements-shell="diff-peek-stats"
          >
            {stats.added > 0 && <span className="text-[var(--an-diff-added-text)]">+{stats.added}</span>}
            {stats.removed > 0 && <span className="text-[var(--an-diff-removed-text)]">−{stats.removed}</span>}
          </span>
          {mode === 'peek' && (
            <span
              className="diff-peek-mode rounded-[var(--an-radius-sm)] bg-[var(--an-background-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--an-foreground-subtle)]"
              data-testid="agent-elements-diff-peek-mode"
              data-agent-elements-shell="diff-peek-mode"
            >
              Peeking
            </span>
          )}
          {mode === 'pinned' && (
            <span
              className="diff-peek-mode rounded-[var(--an-radius-sm)] bg-[color-mix(in_srgb,var(--an-primary-color)_14%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--an-primary-color)]"
              data-testid="agent-elements-diff-peek-mode"
              data-agent-elements-shell="diff-peek-mode"
            >
              Pinned
            </span>
          )}
          {onOpenInEditor && (
            <button
              type="button"
              className="diff-peek-open-editor cursor-pointer rounded-[var(--an-radius-sm)] border-0 bg-transparent px-1 py-0.5 text-[11px] text-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
              data-testid="agent-elements-diff-peek-open-editor"
              data-agent-elements-shell="diff-peek-open-editor"
              onClick={(e) => { e.stopPropagation(); onOpenInEditor(); }}
            >
              Open in editor
            </button>
          )}
        </div>

        <div
          className="diff-peek-body flex-1 overflow-auto bg-[var(--an-background)]"
          data-agent-elements-shell="diff-peek-body"
        >
          <UnifiedDiffView diff={diff} isBinary={isBinary} loading={loading} error={error} />
        </div>

        <div
          className="diff-peek-footer flex gap-[var(--an-spacing-lg)] border-t border-[var(--an-border-color)] bg-[var(--an-tool-background)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)] text-[10px] text-[var(--an-foreground-subtle)]"
          data-testid="agent-elements-diff-peek-footer"
          data-agent-elements-shell="diff-peek-footer"
        >
          <span><kbd className={KBD_CLASS}>Esc</kbd> close</span>
          {mode === 'peek' && <span><kbd className={KBD_CLASS}>Enter</kbd> pin</span>}
        </div>
      </div>
    </FloatingPortal>
  );
}
