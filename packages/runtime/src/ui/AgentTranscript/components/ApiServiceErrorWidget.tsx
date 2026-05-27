import React, { useState } from 'react';
import { AgentStatusPill, AgentToolCard } from '../../AgentElements';
import { SPECIAL_STATUS_BODY_CLASS } from './SpecialStatusWidgetChrome';

const LIST_CLASS = 'm-0 flex list-disc flex-col gap-[var(--an-spacing-xs)] pl-5 text-[0.8125rem] leading-relaxed text-[var(--an-tool-color-muted)] select-text';
const LINK_CLASS = 'text-[var(--an-primary-color)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]';
const COPY_BUTTON_CLASS = 'ml-1 cursor-pointer border-0 bg-transparent p-0 text-[0.75rem] text-[var(--an-foreground-subtle)] underline-offset-2 hover:text-[var(--an-tool-color-muted)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]';

interface ApiServiceErrorInfo {
  /** The HTTP status the upstream API returned (500, 529, etc.). */
  status: number | null;
  /** The 'error.type' value from the API response if present. */
  errorType: string | null;
  /** The 'error.message' value from the API response if present. */
  errorMessage: string | null;
  /** The 'request_id' from the API response. The only handle Anthropic
   *  support has to look up the server-side trace. */
  requestId: string | null;
  /** The full text we were given, kept available behind a "Show details"
   *  disclosure for users escalating to support. */
  raw: string;
}

/**
 * Parse a terminal-style upstream API error of the shape:
 *
 *   API Error: 500 {"type":"error","error":{"type":"api_error",
 *   "message":"Internal server error"},"request_id":"req_..."}
 *   Claude may be experiencing issues. Check https://status.anthropic.com
 *
 * Tolerates the response being JSON-only, line-wrapped, or wrapped in
 * extra Claude-Code style framing. Returns null fields when a piece is
 * absent rather than throwing - downstream rendering handles each case.
 */
export function parseApiServiceError(content: string): ApiServiceErrorInfo {
  const statusMatch = content.match(/\b(?:API\s+Error:\s*)?(\d{3})\b/);
  const status = statusMatch && /^5\d\d$/.test(statusMatch[1])
    ? parseInt(statusMatch[1], 10)
    : null;

  // Try to find an embedded JSON object first; fall back to loose regex.
  let errorType: string | null = null;
  let errorMessage: string | null = null;
  let requestId: string | null = null;

  const jsonMatch = content.match(/\{[\s\S]*"error"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      const errObj = obj && obj.error ? obj.error : obj;
      if (errObj) {
        errorType = typeof errObj.type === 'string' ? errObj.type : null;
        errorMessage = typeof errObj.message === 'string' ? errObj.message : null;
      }
      if (typeof obj.request_id === 'string') requestId = obj.request_id;
    } catch {
      // ignore parse errors, fall through to regex
    }
  }
  if (errorType == null) {
    const typeMatch = content.match(/"type"\s*:\s*"([a-z_]+)"/);
    if (typeMatch && typeMatch[1] !== 'error') errorType = typeMatch[1];
  }
  if (errorMessage == null) {
    const msgMatch = content.match(/"message"\s*:\s*"([^"]+)"/);
    if (msgMatch) errorMessage = msgMatch[1];
  }
  if (requestId == null) {
    const ridMatch = content.match(/req_[A-Za-z0-9]{8,}/);
    if (ridMatch) requestId = ridMatch[0];
  }

  return { status, errorType, errorMessage, requestId, raw: content };
}

/**
 * Returns true if `content` looks like an upstream API service error from
 * Claude (api_error, overloaded_error) where the right user action is
 * "retry / check status page / escalate with request_id", not "file a
 * Nimbalyst bug". Conservative on purpose - we'd rather miss a borderline
 * case and render the raw error than mis-classify a real client bug as
 * "just a service hiccup".
 */
export function isApiServiceError(content: string): boolean {
  if (!content) return false;
  // Signal 1: explicit Anthropic error type token.
  if (/"type"\s*:\s*"(api_error|overloaded_error)"/.test(content)) return true;
  // Signal 2: 5xx status with a request_id, which is Anthropic's correlation
  // id format. Together these distinguish upstream errors from generic
  // 500 strings that might appear elsewhere in transcript text.
  if (/\b5\d\d\b/.test(content) && /req_[A-Za-z0-9]{8,}/.test(content)) return true;
  // Signal 3: the Claude-Code framing string, which the CLI prints after
  // the JSON and which agents commonly echo back into the transcript.
  if (/status\.(anthropic|claude)\.com/.test(content) && /\b5\d\d\b/.test(content)) return true;
  return false;
}

interface ApiServiceErrorWidgetProps {
  content: string;
}

/**
 * Human-readable surface for upstream Claude API service errors that the
 * CLI / SDK forwards verbatim into the transcript. Explains what the error
 * means, points the user at the status page, surfaces the request_id for
 * support escalation, and keeps the raw payload available behind a
 * disclosure so it can still be copy-pasted into a bug report when one is
 * genuinely warranted. See the related anthropics/claude-code issue
 * cluster (40+ duplicate reports) for the user-confusion shape this
 * widget is intended to neutralise.
 */
export const ApiServiceErrorWidget: React.FC<ApiServiceErrorWidgetProps> = ({ content }) => {
  const [copied, setCopied] = useState(false);
  const info = parseApiServiceError(content);

  const isOverloaded = info.errorType === 'overloaded_error';
  const title = isOverloaded
    ? 'The Claude API is temporarily overloaded'
    : 'The Claude API returned a temporary error';

  const copyRequestId = async () => {
    if (!info.requestId) return;
    try {
      await navigator.clipboard.writeText(info.requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be denied in iframes / sandboxed contexts; the
      // request id is also selectable on the inline code element.
    }
  };

  const subtitle = info.status != null
    ? `HTTP ${info.status}${info.errorType ? ` / ${info.errorType}` : ''}`
    : info.errorType ?? 'upstream service error';

  return (
    <AgentToolCard
      className="api-service-error-widget"
      data-agent-elements-shell="api-service-error"
      data-component="ApiServiceErrorWidget"
      data-testid="agent-elements-api-service-error-widget"
      debugPayload={info.raw}
      icon={<span className="text-[var(--an-warning-color)]">!</span>}
      status="error"
      subtitle={subtitle}
      title={title}
      trailing={<AgentStatusPill tone="warning">Upstream</AgentStatusPill>}
    >
      <div className={SPECIAL_STATUS_BODY_CLASS}>
        {isOverloaded
          ? 'This is an upstream capacity error on the API side, not a bug in Nimbalyst. The API will accept new requests once load eases. Retrying in a minute usually works; switching to a less-loaded model also helps.'
          : 'This is a transient upstream error on the API side, not a bug in Nimbalyst. Most cases clear within a few minutes.'}
      </div>

      <ul className={LIST_CLASS}>
        <li>
          Check the status page at{' '}
          <a
            href="https://status.claude.com"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            status.claude.com
          </a>{' '}
          for an active incident on your model.
        </li>
        <li>Retry the request. Transient {info.errorType || 'api_error'} responses usually clear on the next attempt.</li>
        <li>If your model is listed as degraded, try a different one from Settings until the incident resolves.</li>
        {info.requestId && (
          <li>
            If the error keeps firing for more than a few minutes on the same prompt and model,
            include the request id when contacting support:{' '}
            <code className="req-id agent-elements-api-service-request-id rounded-[var(--an-spacing-xs)] bg-[var(--an-background-tertiary)] px-1.5 py-0.5 font-mono text-[0.75rem] text-[var(--an-tool-color)] select-all">
              {info.requestId}
            </code>{' '}
            <button
              type="button"
              onClick={copyRequestId}
              className={COPY_BUTTON_CLASS}
            >
              {copied ? 'copied' : 'copy'}
            </button>
          </li>
        )}
      </ul>
    </AgentToolCard>
  );
};
