import React from 'react';
import { AgentStatusPill, AgentToolCard } from '../../../AgentElements/AgentElementsPrimitives';
import { MaterialSymbol } from '../../../icons/MaterialSymbol';

interface Props {
  children: React.ReactNode;
  toolName?: string;
}

interface State {
  error: Error | null;
  showDetails: boolean;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

const ErrorActionButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  expanded?: boolean;
}> = ({ children, onClick, expanded }) => (
  <button
    aria-expanded={expanded}
    className={classNames(
      'agent-elements-tool-widget-error-action inline-flex min-h-[1.875rem] items-center gap-[var(--an-spacing-xs)]',
      'rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-transparent',
      'px-[var(--an-spacing-sm)] text-xs font-medium text-[var(--an-tool-color-muted)] transition-colors',
      'hover:border-[var(--an-input-focus-border,var(--an-tool-border-color))] hover:text-[var(--an-tool-color)]',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline,var(--an-tool-border-color))]'
    )}
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
);

export class ToolWidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      `[ToolWidgetErrorBoundary] Widget "${this.props.toolName ?? 'unknown'}" crashed:`,
      { error: error.message, stack: error.stack, componentStack: errorInfo.componentStack }
    );
  }

  private reset = (): void => {
    this.setState({ error: null, showDetails: false });
  };

  private toggleDetails = (): void => {
    this.setState((s) => ({ showDetails: !s.showDetails }));
  };

  private copyError = async (): Promise<void> => {
    const err = this.state.error;
    if (!err) return;
    const text = `Tool widget: ${this.props.toolName ?? 'unknown'}\n${err.name}: ${err.message}\n${err.stack ?? ''}`;
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // clipboard may be unavailable; swallow
    }
  };

  render(): React.ReactNode {
    const { error, showDetails } = this.state;
    if (!error) return this.props.children;

    const toolName = this.props.toolName ?? 'unknown tool';
    const details = error.stack ?? `${error.name}: ${error.message || 'Unknown error'}`;

    return (
      <AgentToolCard
        className="agent-elements-tool-widget-error-card"
        data-agent-elements-shell="tool-widget-error-card"
        data-component="RichTranscriptAgentElementsToolWidgetErrorBoundary"
        data-testid="agent-elements-tool-widget-error-card"
        icon={<MaterialSymbol icon="error" size={16} />}
        role="alert"
        status="error"
        subtitle={toolName}
        title="Widget failed to render"
        trailing={<AgentStatusPill tone="error">Error</AgentStatusPill>}
        footer={(
          <div
            className="agent-elements-tool-widget-error-actions flex flex-wrap items-center gap-[var(--an-spacing-xs)]"
            data-testid="agent-elements-tool-widget-error-actions"
          >
            <ErrorActionButton expanded={showDetails} onClick={this.toggleDetails}>
              {showDetails ? 'Hide details' : 'Show details'}
            </ErrorActionButton>
            <ErrorActionButton onClick={this.copyError}>Copy</ErrorActionButton>
            <ErrorActionButton onClick={this.reset}>Retry</ErrorActionButton>
          </div>
        )}
      >
        <div
          className="agent-elements-tool-widget-error-body flex flex-col gap-[var(--an-spacing-sm)]"
          data-agent-elements-shell="tool-widget-error-body"
          data-testid="agent-elements-tool-widget-error-body"
        >
          <div
            className="agent-elements-tool-widget-error-message rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-sm text-[var(--an-tool-color)] select-text"
            data-testid="agent-elements-tool-widget-error-message"
          >
          {error.message || 'Unknown error'}
          </div>
          {showDetails ? (
            <pre
              className="agent-elements-tool-widget-error-details max-h-[12.5rem] overflow-auto whitespace-pre-wrap rounded-[var(--an-tool-border-radius)] bg-[var(--an-code-background)] p-[var(--an-spacing-sm)] font-mono text-xs leading-[1.333] text-[var(--an-code-color)] select-text"
              data-testid="agent-elements-tool-widget-error-details"
            >
              {details}
            </pre>
          ) : null}
        </div>
      </AgentToolCard>
    );
  }
}
