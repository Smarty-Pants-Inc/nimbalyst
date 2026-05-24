# Smarty Code Product Contract

Register: product
Status: active design context for the Nimbalyst fork
Source rider: `../../docs/agent-elements-app-redesign-rider.md`

## Product Purpose

Smarty Code is a daily-driver AI IDE for developers who want agentic coding,
project planning, file review, and workspace operations in one focused desktop
app. The fork should feel like its own product, not like an upstream Nimbalyst
skin, while keeping Nimbalyst's extension, theme, transcript, and workspace
architecture intact.

## Users

- Engineers running coding agents across real repositories.
- Agent supervisors reviewing tool calls, approvals, file edits, diffs,
  runtime health, and evidence.
- Extension authors who need stable theme variables, semantic DOM markers, and
  predictable host surfaces.

## Tone

Quiet, precise, dense when useful, and trustworthy under long sessions. The UI
should make agent state and file risk easy to scan without feeling like a
marketing site or a consumer chat app.

## Visual Source

The approved visual source is Agent Elements by 21st.dev, pinned in
`../../docs/agent-elements-source-reference.md`. Copy its compact tool rows,
muted borders, restrained surfaces, radii, markdown/code treatment, loaders,
and streaming motion. Adapt the transcript layout so every user, assistant,
system, subagent, and tool row is left-aligned with an identity row.

## Anti-References

Do not use AI Elements, assistant-ui, Prompt-Kit as a mixed visual dependency,
generic shadcn defaults unrelated to Agent Elements, right-aligned user chat
bubbles, decorative dashboards, nested cards, side-stripe accents, gradient
text, glassmorphism, or raw JSON as primary agent UX.

## Strategic Principles

1. The transcript is an event stream, not a log dump. Every known event type
   gets a readable component and progressive streaming state.
2. The source system is copied structurally. Agents compare source classes,
   tokens, spacing, padding, borders, radii, typography, icon geometry, and
   motion values before screenshots.
3. The fork stays upstream-intakeable. Keep style in fork-owned layers and
   adapters, preserve behavior modules, and avoid broad formatting churn.
4. `--nim-*` remains public compatibility. `--an-*` aliases are added from the
   same source values for Agent Elements-derived components.
5. UI chrome supports work. Controls use familiar product affordances, compact
   density, visible focus states, and copy/select behavior only where content is
   meant to be copied.
