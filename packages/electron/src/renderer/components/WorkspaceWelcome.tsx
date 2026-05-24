import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface WorkspaceWelcomeProps {
  workspaceName: string;
}

// Try to import the icon if it exists in the build
let iconUrl: string | undefined;
try {
  iconUrl = new URL('/icon.png', import.meta.url).href;
} catch {
  // Icon not available in this build
  iconUrl = undefined;
}

export function WorkspaceWelcome({ workspaceName }: WorkspaceWelcomeProps) {
  const tips = [
    {
      icon: 'article',
      text: 'Open Markdown files from the sidebar',
    },
    {
      icon: 'smart_toy',
      text: 'Edit files directly or use the agent on the right side',
    },
    {
      icon: 'cloud_done',
      text: 'Files are automatically saved as you work',
    },
  ];

  return (
    <div
      className="workspace-welcome agent-elements-workspace-welcome flex h-full w-full items-center justify-center bg-[var(--an-background)] px-8 py-10 text-[var(--an-foreground)] [container-type:inline-size]"
      data-testid="agent-elements-workspace-welcome"
      data-component="WorkspaceWelcome"
      data-agent-elements-shell="workspace-welcome"
    >
      <div
        className="workspace-welcome-content agent-elements-workspace-welcome-content flex w-full max-w-[560px] flex-col gap-[var(--an-spacing-xl)] text-left"
        data-testid="agent-elements-workspace-welcome-content"
        data-agent-elements-shell="workspace-welcome-content"
      >
        <div className="workspace-welcome-header flex items-start gap-3">
          <div
            className="workspace-welcome-icon agent-elements-workspace-welcome-icon inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]"
            data-testid="agent-elements-workspace-welcome-icon"
            data-agent-elements-shell="workspace-welcome-icon"
            aria-hidden={iconUrl ? undefined : true}
          >
            {iconUrl ? (
              <img
                src={iconUrl}
                alt="Nimbalyst"
                className="h-7 w-7 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <MaterialSymbol icon="code_blocks" size={20} />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="workspace-welcome-title m-0 text-lg font-medium leading-snug text-[var(--an-foreground)]">
              {workspaceName}
            </h1>
            <p className="m-0 mt-1 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
              Choose a file or workspace to start working.
            </p>
          </div>
        </div>

        <div
          className="workspace-welcome-tips agent-elements-workspace-welcome-tips agent-elements-tool-card rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-workspace-welcome-tips"
          data-agent-elements-shell="workspace-welcome-tips"
        >
          <h2 className="m-0 mb-[var(--an-spacing-lg)] text-sm font-medium leading-snug text-[var(--an-foreground)]">
            Quick tips
          </h2>
          <ul className="m-0 flex list-none flex-col gap-[var(--an-spacing-md)] p-0 text-[var(--an-foreground-muted)]">
            {tips.map((tip) => (
              <li
                key={tip.text}
                className="agent-elements-workspace-welcome-tip flex items-start gap-3 text-sm leading-relaxed"
                data-testid="agent-elements-workspace-welcome-tip"
                data-agent-elements-shell="workspace-welcome-tip"
              >
                <span
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-primary-color)]"
                  aria-hidden="true"
                >
                  <MaterialSymbol icon={tip.icon} size={15} />
                </span>
                <span className="select-text">{tip.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
