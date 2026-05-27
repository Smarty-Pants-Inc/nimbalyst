import React, { useState } from 'react';
import {
  FloatingPortal,
  flip,
  offset,
  shift,
  useFloating,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react';

interface AlphaBadgeProps {
  /**
   * `xs` and `sm` render the lowercase word "alpha" as a pill (sidebar rows / panel headers).
   * `dot` renders just the Greek α character — for tight spots like square icon buttons.
   */
  size?: 'xs' | 'sm' | 'dot';
  className?: string;
  tooltip?: string;
}

const DEFAULT_TOOLTIP = 'Alpha feature — may change or be removed.';
export const SETTINGS_ALPHA_TOOLTIP =
  'Alpha features may be incomplete, and shared data may be lost.\n\nTeam features are free during alpha and will be part of a Nimbalyst Team subscription in the future.';

const PILL_BASE = 'agent-elements-alpha-badge inline-flex items-center font-medium lowercase bg-[var(--an-background-tertiary)] border border-[var(--an-border-color)]';

const SIZE_CLASSES: Record<NonNullable<AlphaBadgeProps['size']>, string> = {
  xs: `${PILL_BASE} px-2 py-px rounded-[var(--an-small-border-radius)] text-[10px] text-[var(--an-foreground-subtle)]`,
  sm: `${PILL_BASE} px-2.5 py-0.5 rounded-[var(--an-small-border-radius)] text-[11px] text-[var(--an-foreground-muted)] align-middle`,
  dot: 'agent-elements-alpha-badge inline-flex items-center justify-center text-[10px] leading-none font-semibold text-[var(--an-foreground-subtle)]',
};

export const AlphaBadge: React.FC<AlphaBadgeProps> = ({
  size = 'xs',
  className = '',
  tooltip = DEFAULT_TOOLTIP,
}) => {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: tooltipOpen,
    onOpenChange: setTooltipOpen,
    placement: 'top',
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const hover = useHover(context, { delay: { open: 250, close: 0 }, move: false });
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, role]);

  return (
    <>
      <span
        ref={refs.setReference}
        data-testid="alpha-badge"
        data-agent-elements-shell="alpha-badge"
        data-agent-elements-size={size}
        aria-label="Alpha feature"
        className={`${SIZE_CLASSES[size]} ${className}`.trim()}
        {...getReferenceProps()}
      >
        {size === 'dot' ? 'α' : 'alpha'}
      </span>
      {tooltipOpen && tooltip && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            className="help-tooltip agent-elements-alpha-tooltip pointer-events-none z-[10002] max-w-[320px] px-3 py-2.5 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-xs leading-normal text-[var(--an-foreground-muted)] shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)] whitespace-pre-wrap"
            data-testid="agent-elements-alpha-tooltip"
            data-agent-elements-shell="alpha-tooltip"
            style={floatingStyles}
            {...getFloatingProps()}
          >
            <div className="mb-1 text-[13px] font-semibold text-[var(--an-foreground)]">Alpha</div>
            {tooltip}
          </div>
        </FloatingPortal>
      )}
    </>
  );
};
