import React, { useState, useCallback } from 'react';
import { copyToClipboard, MaterialSymbol } from '@nimbalyst/runtime';

interface DiffErrorDetails {
  originalMarkdown: string;
  prompt: string;
  aiResponse: string;
  replacements: Array<{
    oldText: string;
    newText: string;
  }>;
  errorMessage: string;
  timestamp: string;
  filePath?: string;
}

interface ErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  details?: DiffErrorDetails | string;
}

const errorDialogButtonBase =
  'inline-flex items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

const errorDialogCodeBlockClass =
  'm-0 rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-code-color)_18%,var(--an-border-color))] bg-[var(--an-code-background)] p-[var(--an-spacing-sm)] font-mono text-xs leading-relaxed text-[var(--an-code-color)] overflow-x-auto whitespace-pre-wrap break-words select-text';

const errorDialogSectionHeaderClass =
  'section-header agent-elements-error-dialog-section-header w-full border-none px-[var(--agent-elements-card-inline-padding)] py-[var(--an-spacing-md)] text-left text-sm font-medium text-[var(--an-foreground)] flex items-center gap-2 cursor-pointer transition-[background-color,color] duration-150 ease-out bg-[var(--an-background)] hover:bg-[var(--an-background-tertiary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--an-input-focus-outline)]';

const errorDialogSectionContentClass =
  'section-content agent-elements-error-dialog-section-content bg-[var(--an-background-secondary)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]';

export function ErrorDialog({ isOpen, onClose, title, message, details }: ErrorDialogProps) {
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['error']));

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  const handleCopyDetails = useCallback(() => {
    if (!details) return;

    if (typeof details === 'string') {
      copyToClipboard(details).then(() => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      });
      return;
    }

    const debugInfo = {
      error: {
        message: details.errorMessage,
        timestamp: details.timestamp,
        filePath: details.filePath
      },
      prompt: details.prompt,
      aiResponse: details.aiResponse,
      replacements: details.replacements,
      documentContent: details.originalMarkdown
    };

    const text = `## Error Details

**Error Message:** ${details.errorMessage}
**Timestamp:** ${details.timestamp}
**File:** ${details.filePath || 'Unknown'}

## Debugging Information

\`\`\`json
${JSON.stringify(debugInfo, null, 2)}
\`\`\`

## Document Content at Time of Error

\`\`\`markdown
${details.originalMarkdown}
\`\`\`

## Prompt Sent to AI

${details.prompt}

## AI Response

${details.aiResponse}

## Attempted Replacements

${details.replacements.map((r, i) => `
### Replacement ${i + 1}
**Old Text:**
\`\`\`
${r.oldText}
\`\`\`

**New Text:**
\`\`\`
${r.newText}
\`\`\`
`).join('\n')}`;

    copyToClipboard(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  }, [details]);

  if (!isOpen) return null;

  return (
    <div
      className="error-dialog-overlay nim-overlay agent-elements-error-dialog-backdrop bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)]"
      data-testid="agent-elements-error-dialog-backdrop"
      data-agent-elements-shell="error-dialog-backdrop"
      onClick={onClose}
    >
      <div
        className="error-dialog nim-modal agent-elements-error-dialog agent-elements-tool-card flex max-h-[80vh] w-[90%] max-w-[800px] flex-col !gap-0 !p-0 [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)] overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)]"
        data-testid="agent-elements-error-dialog"
        data-component="ErrorDialog"
        data-agent-elements-shell="error-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="error-dialog-header nim-modal-header agent-elements-error-dialog-header flex items-center justify-between gap-3 border-b border-[var(--an-border-color)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-testid="agent-elements-error-dialog-header"
          data-agent-elements-shell="error-dialog-header"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="error-icon agent-elements-error-dialog-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-error-color)_30%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-error-color)_10%,var(--an-background))] text-[var(--an-error-color)]"
              data-agent-elements-shell="error-dialog-icon"
              aria-hidden="true"
            >
              <MaterialSymbol icon="warning" size={18} />
            </span>
            <h2 className="m-0 min-w-0 truncate text-sm font-medium text-[var(--an-foreground)]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="error-dialog-close nim-btn-icon agent-elements-error-dialog-close inline-flex h-8 w-8 items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            data-testid="agent-elements-error-dialog-close"
            data-agent-elements-shell="error-dialog-close"
            aria-label="Close error dialog"
            onClick={onClose}
          >
            <MaterialSymbol icon="close" size={18} />
          </button>
        </div>

        <div
          className="error-dialog-content nim-modal-body agent-elements-error-dialog-content flex-1 overflow-y-auto px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-agent-elements-shell="error-dialog-content"
        >
          <div
            className="error-dialog-message agent-elements-error-dialog-message mb-5 flex items-start gap-3 rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-error-color)_28%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-error-color)_8%,var(--an-background))] p-[var(--agent-elements-card-inline-padding)]"
            data-testid="agent-elements-error-dialog-message"
            data-agent-elements-shell="error-dialog-message"
          >
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--an-input-border-radius)] bg-[color-mix(in_srgb,var(--an-error-color)_12%,transparent)] text-[var(--an-error-color)]"
              aria-hidden="true"
            >
              <MaterialSymbol icon="error" size={16} />
            </span>
            <p className="m-0 text-sm leading-relaxed text-[var(--an-error-color)]">{message}</p>
          </div>

          {typeof details === 'string' && details && (
            <div
              className="error-dialog-details agent-elements-error-dialog-details mt-5"
              data-agent-elements-shell="error-dialog-details"
            >
              <pre
                className={`error-dialog-message-details agent-elements-error-dialog-string-details ${errorDialogCodeBlockClass}`}
                data-testid="agent-elements-error-dialog-string-details"
                data-agent-elements-shell="error-dialog-string-details"
              >
                {details}
              </pre>
            </div>
          )}

          {details && typeof details !== 'string' && (
            <div
              className="error-dialog-details agent-elements-error-dialog-details mt-5"
              data-agent-elements-shell="error-dialog-details"
            >
              <div
                className="error-dialog-actions agent-elements-error-dialog-actions mb-4 flex justify-end"
                data-testid="agent-elements-error-dialog-actions"
                data-agent-elements-shell="error-dialog-actions"
              >
                <button
                  type="button"
                  className={`error-dialog-copy-btn nim-btn-primary ${errorDialogButtonBase} !border-[var(--an-primary-color)] !bg-[var(--an-primary-color)] !text-[var(--an-background)] hover:!border-[color-mix(in_srgb,var(--an-primary-color)_86%,var(--an-foreground))] hover:!bg-[color-mix(in_srgb,var(--an-primary-color)_86%,var(--an-foreground))]`}
                  onClick={handleCopyDetails}
                >
                  <MaterialSymbol icon={copyFeedback ? 'check' : 'content_copy'} size={16} />
                  {copyFeedback ? 'Copied!' : 'Copy Debug Info'}
                </button>
              </div>

              <div
                className="error-dialog-sections agent-elements-error-dialog-sections overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]"
                data-testid="agent-elements-error-dialog-sections"
                data-agent-elements-shell="error-dialog-sections"
              >
                <div className="error-section agent-elements-error-dialog-section border-b border-[var(--an-border-color)] last:border-b-0">
                  <button
                    type="button"
                    className={`${errorDialogSectionHeaderClass} ${expandedSections.has('error') ? 'expanded' : ''}`}
                    onClick={() => toggleSection('error')}
                  >
                    <span className={`section-arrow text-xs transition-transform duration-150 ease-out ${expandedSections.has('error') ? 'rotate-90' : ''}`}>
                      <MaterialSymbol icon="chevron_right" size={16} />
                    </span>
                    Error Details
                  </button>
                  {expandedSections.has('error') && (
                    <div className={errorDialogSectionContentClass}>
                      <div className="error-field mb-2 text-[13px] text-[var(--an-foreground)]">
                        <strong className="mr-2 font-semibold">Message:</strong> {details.errorMessage}
                      </div>
                      <div className="error-field mb-2 text-[13px] text-[var(--an-foreground)]">
                        <strong className="mr-2 font-semibold">Time:</strong> {details.timestamp}
                      </div>
                      {details.filePath && (
                        <div className="error-field mb-2 text-[13px] text-[var(--an-foreground)]">
                          <strong className="mr-2 font-semibold">File:</strong> {details.filePath}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="error-section agent-elements-error-dialog-section border-b border-[var(--an-border-color)] last:border-b-0">
                  <button
                    type="button"
                    className={`${errorDialogSectionHeaderClass} ${expandedSections.has('prompt') ? 'expanded' : ''}`}
                    onClick={() => toggleSection('prompt')}
                  >
                    <span className={`section-arrow text-xs transition-transform duration-150 ease-out ${expandedSections.has('prompt') ? 'rotate-90' : ''}`}>
                      <MaterialSymbol icon="chevron_right" size={16} />
                    </span>
                    Prompt
                  </button>
                  {expandedSections.has('prompt') && (
                    <div className={errorDialogSectionContentClass}>
                      <pre className={`code-block ${errorDialogCodeBlockClass}`}>{details.prompt}</pre>
                    </div>
                  )}
                </div>

                <div className="error-section agent-elements-error-dialog-section border-b border-[var(--an-border-color)] last:border-b-0">
                  <button
                    type="button"
                    className={`${errorDialogSectionHeaderClass} ${expandedSections.has('response') ? 'expanded' : ''}`}
                    onClick={() => toggleSection('response')}
                  >
                    <span className={`section-arrow text-xs transition-transform duration-150 ease-out ${expandedSections.has('response') ? 'rotate-90' : ''}`}>
                      <MaterialSymbol icon="chevron_right" size={16} />
                    </span>
                    AI Response
                  </button>
                  {expandedSections.has('response') && (
                    <div className={errorDialogSectionContentClass}>
                      <pre className={`code-block ${errorDialogCodeBlockClass}`}>{details.aiResponse}</pre>
                    </div>
                  )}
                </div>

                <div className="error-section agent-elements-error-dialog-section border-b border-[var(--an-border-color)] last:border-b-0">
                  <button
                    type="button"
                    className={`${errorDialogSectionHeaderClass} ${expandedSections.has('replacements') ? 'expanded' : ''}`}
                    onClick={() => toggleSection('replacements')}
                  >
                    <span className={`section-arrow text-xs transition-transform duration-150 ease-out ${expandedSections.has('replacements') ? 'rotate-90' : ''}`}>
                      <MaterialSymbol icon="chevron_right" size={16} />
                    </span>
                    Attempted Replacements ({details.replacements.length})
                  </button>
                  {expandedSections.has('replacements') && (
                    <div className={errorDialogSectionContentClass}>
                      {details.replacements.map((r, i) => (
                        <div key={i} className="replacement-item mb-4 border-b border-[var(--an-border-color)] pb-4 last:mb-0 last:border-b-0 last:pb-0">
                          <h4 className="m-0 mb-3 text-[13px] font-semibold text-[var(--an-foreground-muted)]">Replacement {i + 1}</h4>
                          <div className="replacement-diff grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
                            <div className="diff-old text-xs">
                              <strong className="mb-1 block font-semibold text-[var(--an-foreground-muted)]">Old Text:</strong>
                              <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--an-input-border-radius)] border border-[var(--an-diff-removed-border)] bg-[var(--an-diff-removed-bg)] p-2 font-mono text-[11px] leading-snug text-[var(--an-diff-removed-text)] select-text">{r.oldText}</pre>
                            </div>
                            <div className="diff-new text-xs">
                              <strong className="mb-1 block font-semibold text-[var(--an-foreground-muted)]">New Text:</strong>
                              <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--an-input-border-radius)] border border-[var(--an-diff-added-border)] bg-[var(--an-diff-added-bg)] p-2 font-mono text-[11px] leading-snug text-[var(--an-diff-added-text)] select-text">{r.newText}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="error-section agent-elements-error-dialog-section border-b border-[var(--an-border-color)] last:border-b-0">
                  <button
                    type="button"
                    className={`${errorDialogSectionHeaderClass} ${expandedSections.has('document') ? 'expanded' : ''}`}
                    onClick={() => toggleSection('document')}
                  >
                    <span className={`section-arrow text-xs transition-transform duration-150 ease-out ${expandedSections.has('document') ? 'rotate-90' : ''}`}>
                      <MaterialSymbol icon="chevron_right" size={16} />
                    </span>
                    Document Content
                  </button>
                  {expandedSections.has('document') && (
                    <div className={errorDialogSectionContentClass}>
                      <pre className={`code-block document-content max-h-[300px] overflow-y-auto ${errorDialogCodeBlockClass}`}>
                        {details.originalMarkdown}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              <div className="error-dialog-help agent-elements-error-dialog-help mt-5 rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--an-info-color)_32%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-info-color)_7%,var(--an-background))] p-[var(--agent-elements-card-inline-padding)]">
                <p className="m-0 mb-2 text-[13px] font-semibold text-[var(--an-foreground)]"><strong>What to do next:</strong></p>
                <ul className="m-0 pl-5">
                  <li className="text-[13px] leading-relaxed text-[var(--an-foreground-muted)]">Check if the document was modified after the AI started processing</li>
                  <li className="text-[13px] leading-relaxed text-[var(--an-foreground-muted)]">Verify that the text the AI is trying to replace exists exactly as shown</li>
                  <li className="text-[13px] leading-relaxed text-[var(--an-foreground-muted)]">Try making the request again with the current document state</li>
                  <li className="text-[13px] leading-relaxed text-[var(--an-foreground-muted)]">If the problem persists, copy the debug info and report the issue</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div
          className="error-dialog-footer nim-modal-footer agent-elements-error-dialog-footer flex justify-end border-t border-[var(--an-border-color)] px-[var(--agent-elements-card-inline-padding)] py-[var(--agent-elements-card-block-padding)]"
          data-agent-elements-shell="error-dialog-footer"
        >
          <button
            type="button"
            className={`error-dialog-ok-btn nim-btn-secondary ${errorDialogButtonBase} !border-[var(--an-border-color)] !bg-[var(--an-background)] !text-[var(--an-foreground-muted)] hover:!bg-[var(--an-background-tertiary)] hover:!text-[var(--an-foreground)]`}
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
