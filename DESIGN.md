---
version: alpha
name: Smarty Code Agent Elements Product UI
description: Agent Elements-derived product interface for the Smarty Code Nimbalyst fork.
colors:
  primary: "#2563EB"
  primary-hover: "#1D4ED8"
  background: "#FFFFFF"
  background-secondary: "#F5F5F5"
  background-tertiary: "#F8F8F8"
  foreground: "#1A1A1A"
  foreground-muted: "#737373"
  foreground-subtle: "#A3A3A3"
  border: "#E4E4E7"
  success: "#15803D"
  warning: "#B45309"
  error: "#B91C1C"
  info: "#2563EB"
  code-background: "#1E1E1E"
  code-foreground: "#D4D4D4"
  diff-added-bg: "#EAF8EF"
  diff-added-text: "#15803D"
  diff-removed-bg: "#FDECEC"
  diff-removed-text: "#B91C1C"
typography:
  ui-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  ui-xs:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: 0
  ui-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: 0.875rem
    fontWeight: 450
    lineHeight: 1.35
    letterSpacing: 0
  mono-code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.333
    letterSpacing: 0
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  agent-base: 16px
  agent-tool: 10px
spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 10px
  lg: 12px
  xl: 14px
  xxl: 16px
components:
  transcript-row:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.md}"
    padding: 0px
  transcript-identity-row:
    textColor: "{colors.foreground-muted}"
    typography: "{typography.ui-xs}"
    padding: 4px
  transcript-subtle-metadata:
    textColor: "{colors.foreground-subtle}"
    typography: "{typography.ui-xs}"
    padding: 4px
  agent-tool-card:
    backgroundColor: "{colors.background-secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.agent-tool}"
    padding: 10px
  agent-tool-card-bordered:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground-muted}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.agent-tool}"
    padding: 10px
  border-swatch:
    backgroundColor: "{colors.border}"
    textColor: "{colors.foreground}"
    typography: "{typography.ui-xs}"
    rounded: "{rounded.xs}"
    padding: 2px
  agent-input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.agent-base}"
    padding: 12px
  primary-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    typography: "{typography.ui-label}"
    rounded: "{rounded.sm}"
    padding: 8px
  primary-action-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.background}"
    typography: "{typography.ui-label}"
    rounded: "{rounded.sm}"
    padding: 8px
  markdown-code:
    backgroundColor: "{colors.code-background}"
    textColor: "{colors.code-foreground}"
    typography: "{typography.mono-code}"
    rounded: "{rounded.agent-tool}"
    padding: 8px
  status-success:
    backgroundColor: "{colors.diff-added-bg}"
    textColor: "{colors.success}"
    typography: "{typography.ui-xs}"
    rounded: "{rounded.sm}"
    padding: 4px
  status-warning:
    backgroundColor: "{colors.background-tertiary}"
    textColor: "{colors.warning}"
    typography: "{typography.ui-xs}"
    rounded: "{rounded.sm}"
    padding: 4px
  status-error:
    backgroundColor: "{colors.diff-removed-bg}"
    textColor: "{colors.error}"
    typography: "{typography.ui-xs}"
    rounded: "{rounded.sm}"
    padding: 4px
  status-info:
    backgroundColor: "{colors.background-tertiary}"
    textColor: "{colors.info}"
    typography: "{typography.ui-xs}"
    rounded: "{rounded.sm}"
    padding: 4px
  diff-added-line:
    backgroundColor: "{colors.diff-added-bg}"
    textColor: "{colors.diff-added-text}"
    typography: "{typography.mono-code}"
    rounded: "{rounded.xs}"
    padding: 4px
  diff-removed-line:
    backgroundColor: "{colors.diff-removed-bg}"
    textColor: "{colors.diff-removed-text}"
    typography: "{typography.mono-code}"
    rounded: "{rounded.xs}"
    padding: 4px
---

## Overview

Smarty Code is a work-focused AI IDE. The interface should feel calm under
long-running agent streams: compact identity rows, quiet borders, restrained
color, and progressive event rendering. Agent Elements by 21st.dev is the
approved visual reference; this fork copies its component density and motion
while adapting the transcript into a left-aligned product layout.

## Colors

Use a restrained product palette. Primary blue is reserved for current
selection, primary actions, and focus or active states. Surfaces use tinted
neutrals and low-contrast borders. Status colors are semantic only: success for
completed edits, warning for risky states, error for failures, and info for
runtime or provider status.

The implementation must keep existing `--nim-*` variables and add
Agent Elements-compatible `--an-*` aliases from the same semantic source. Do not
maintain independent Nimbalyst and Agent Elements palettes.

## Typography

Use the system sans stack for product UI and the system mono stack for code,
terminal output, JSON debug disclosures, and diff content. Keep UI text fixed
size, not viewport scaled. Transcript and tool content should primarily use
14px text with compact 12px metadata and labels.

## Layout

All transcript messages are left-aligned. Role, agent name, provider/model,
status, and timestamp metadata belong in a compact identity row. User content
must not be rendered as a right-aligned chat bubble.

App surfaces should favor dense full-height panels, tabs, sidebars, toolbars,
and split panes. Cards are only for repeated items, dialogs, and framed tool
output. Avoid nested cards.

## Elevation & Depth

Use flat surfaces, 1px borders, subtle background hierarchy, and focus rings.
Avoid heavy shadows, glass effects, and decorative depth. Diff/code/tool cards
may use a bounded framed surface so long as content remains scannable.

## Shapes

Agent transcript and composer primitives may use Agent Elements' 16px base
radius where copied directly. Tool cards and code blocks use 10px. Dense app
chrome, settings rows, tabs, and list items should generally stay at 4px to 8px
unless a source-reference row justifies a copied Agent Elements radius.

## Components

Core components:

- `AgentTranscriptRow`: left-aligned shell with identity row and copyable
  content body.
- `AgentToolCard`: Agent Elements-derived shell for status, detail, progress,
  result, error, and debug disclosure.
- `TodoTool`, `PlanTool`, `BashTool`, `EditTool`, `SearchTool`, `McpTool`,
  `ThinkingTool`, `QuestionTool`, `SubagentTool`, and `GenericTool`: copied or
  derived from Agent Elements registry items.
- `RawPayloadDisclosure`: collapsed debug surface only, never primary UI.
- `AgentInput`: Agent Elements-derived composer adapted to Nimbalyst provider,
  model, mode, attachment, and voice controls.

Every meaningful exported React component root keeps a semantic class name and
important controls keep `data-testid` markers. Content that users may copy uses
selectable text; chrome stays non-selectable.

## Do's and Don'ts

Do copy Agent Elements spacing, muted chrome, borders, radii, markdown/code
treatment, shimmer, loaders, compact tool rows, and streaming state language.

Do validate light, dark, compact panel, long path, long word, focus, hover,
active, disabled, streaming, completed, interrupted, and error states.

Don't mix AI Elements, assistant-ui, Prompt-Kit, or generic shadcn visual
defaults into this milestone.

Don't use side-stripe accents, gradient text, glassmorphism, decorative motion,
right-aligned user bubbles, one-off palettes, or raw JSON as the primary display
for known event types.
