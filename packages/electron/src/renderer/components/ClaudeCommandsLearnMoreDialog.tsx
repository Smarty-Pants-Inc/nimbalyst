import React from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface ClaudeCommandsLearnMoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

interface CommandInfo {
  name: string;
  description: string;
}

interface CommandGroup {
  title: string;
  packageName: string;
  commands: CommandInfo[];
}

const COMMAND_GROUPS: CommandGroup[] = [
  {
    title: 'Core',
    packageName: 'Essential for all workflows',
    commands: [
      {
        name: '/track',
        description: 'Log bugs, ideas, tasks, and decisions with unique IDs',
      },
      {
        name: '/mockup',
        description: 'Create visual UI mockups you can draw on',
      },
    ],
  },
  {
    title: 'Developer',
    packageName: 'For software development',
    commands: [
      {
        name: '/analyze-code',
        description: 'Analyze code quality and suggest improvements',
      },
      {
        name: '/write-tests',
        description: 'Generate comprehensive tests for code',
      },
    ],
  },
  {
    title: 'Product Manager',
    packageName: 'For product planning',
    commands: [
      {
        name: '/roadmap',
        description: 'Generate product roadmap from plans and features',
      },
      {
        name: '/user-research',
        description: 'Document user research findings',
      },
    ],
  },
];

const overlayClass =
  'claude-commands-learn-more-overlay agent-elements-claude-commands-backdrop fixed inset-0 z-[10001] flex items-center justify-center overflow-y-auto bg-[color-mix(in_srgb,var(--an-foreground)_14%,transparent)] p-[var(--an-spacing-xxl)]';
const dialogClass =
  'claude-commands-learn-more-dialog agent-elements-claude-commands-dialog agent-elements-tool-card my-auto flex max-h-[85vh] w-[min(92vw,640px)] flex-col overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)]';
const headerClass =
  'claude-commands-learn-more-header agent-elements-claude-commands-header flex items-start justify-between gap-[var(--an-spacing-md)] border-b border-[var(--an-border-color)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]';
const headerIconClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]';
const closeButtonClass =
  'claude-commands-learn-more-close inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
const contentClass =
  'claude-commands-learn-more-content agent-elements-claude-commands-content nim-scrollbar flex flex-col gap-[var(--an-spacing-xl)] overflow-y-auto px-[var(--an-spacing-xxl)] py-[var(--an-spacing-xl)]';
const sectionClass =
  'claude-commands-learn-more-section space-y-[var(--an-spacing-sm)]';
const sectionTitleClass =
  'm-0 text-sm font-medium text-[var(--an-foreground)]';
const bodyTextClass =
  'm-0 select-text text-sm leading-relaxed text-[var(--an-foreground-muted)]';
const noteClass =
  'claude-commands-learn-more-note m-0 select-text text-xs italic leading-relaxed text-[var(--an-foreground-subtle)]';
const inlineCodeClass =
  'rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-1.5 py-0.5 font-mono text-xs text-[var(--an-foreground)]';
const folderClass =
  'claude-commands-folder-structure agent-elements-claude-commands-folder my-[var(--an-spacing-md)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)]';
const commandItemClass =
  'claude-commands-item agent-elements-claude-commands-item rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-md)]';
const settingsLinkClass =
  'claude-commands-learn-more-link cursor-pointer border-none bg-transparent p-0 text-[var(--an-primary-color)] underline transition-colors duration-150 ease-out hover:text-[var(--an-send-button-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
const footerClass =
  'claude-commands-learn-more-footer agent-elements-claude-commands-footer flex justify-end border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-lg)]';
const primaryButtonClass =
  'claude-commands-learn-more-btn inline-flex min-h-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-send-button-bg)] bg-[var(--an-send-button-bg)] px-5 py-2 text-sm font-medium text-[var(--an-send-button-color)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--an-send-button-bg)_82%,var(--an-foreground))] hover:bg-[color-mix(in_srgb,var(--an-send-button-bg)_88%,var(--an-foreground))] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';

export function ClaudeCommandsLearnMoreDialog({
  isOpen,
  onClose,
  onOpenSettings,
}: ClaudeCommandsLearnMoreDialogProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div
      className={overlayClass}
      onClick={onClose}
      data-component="ClaudeCommandsLearnMoreDialogBackdrop"
      data-testid="agent-elements-claude-commands-backdrop"
      data-agent-elements-shell="claude-commands-backdrop"
    >
      <div
        className={dialogClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="claude-commands-title"
        data-component="ClaudeCommandsLearnMoreDialog"
        data-testid="agent-elements-claude-commands-dialog"
        data-agent-elements-shell="claude-commands-dialog"
      >
        <div
          className={headerClass}
          data-testid="agent-elements-claude-commands-header"
          data-agent-elements-shell="claude-commands-header"
        >
          <div className="flex min-w-0 items-start gap-[var(--an-spacing-md)]">
            <span className={headerIconClass} aria-hidden="true" data-agent-elements-shell="claude-commands-icon">
              <MaterialSymbol icon="terminal" size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="claude-commands-title" className="m-0 text-base font-medium leading-snug text-[var(--an-foreground)]">
                Claude Commands for Nimbalyst
              </h2>
              <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                Slash commands for structured agent workflows.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={closeButtonClass}
            onClick={onClose}
            aria-label="Close"
            data-agent-elements-shell="claude-commands-close"
          >
            <MaterialSymbol icon="close" size={20} aria-hidden="true" />
          </button>
        </div>

        <div
          className={contentClass}
          data-testid="agent-elements-claude-commands-content"
          data-agent-elements-shell="claude-commands-content"
        >
          <section className={sectionClass}>
            <p className="claude-commands-learn-more-intro m-0 select-text text-sm leading-relaxed text-[var(--an-foreground)]">
              Installing Claude Commands adds slash commands that help Claude
              work better with Nimbalyst. These commands enable structured
              planning, visual mockups, issue tracking, and more.
            </p>
          </section>

          <section className={sectionClass}>
            <h3 className={sectionTitleClass}>
              The nimbalyst-local Folder
            </h3>
            <p className={bodyTextClass}>
              A{' '}
              <code className={inlineCodeClass}>
                nimbalyst-local
              </code>{' '}
              folder will be created in your project root to store working
              documents:
            </p>
            <div
              className={folderClass}
              data-testid="agent-elements-claude-commands-folder"
              data-agent-elements-shell="claude-commands-folder"
            >
              <pre className="m-0 select-text whitespace-pre font-mono text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                {`nimbalyst-local/
├── plans/        # Plan documents (.md)
├── tracker/      # Bugs, ideas, tasks (.md)
├── mockups/      # UI mockups (.mockup.html)
└── existing-screens/  # UI references`}
              </pre>
            </div>
            <p className={noteClass}>
              This folder is automatically added to{' '}
              <code className={inlineCodeClass}>
                .gitignore
              </code>{' '}
              to keep your repository clean and avoid merge conflicts.
            </p>
          </section>

          {COMMAND_GROUPS.map((group) => (
            <section
              key={group.title}
              className={sectionClass}
            >
              <h3 className={sectionTitleClass}>
                {group.title}
              </h3>
              <p className="claude-commands-group-subtitle m-0 text-xs text-[var(--an-foreground-subtle)]">
                {group.packageName}
              </p>
              <div className="claude-commands-list flex flex-col gap-[var(--an-spacing-sm)]">
                {group.commands.map((cmd) => (
                  <div
                    key={cmd.name}
                    className={commandItemClass}
                    data-testid="agent-elements-claude-commands-item"
                    data-agent-elements-shell="claude-commands-item"
                  >
                    <div className="claude-commands-item-header mb-1.5">
                      <code className="claude-commands-item-name select-text font-mono text-[13px] font-medium text-[var(--an-primary-color)]">
                        {cmd.name}
                      </code>
                    </div>
                    <p className="claude-commands-item-description m-0 select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                      {cmd.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className={sectionClass}>
            <p className={noteClass}>
              Commands work with Claude Code (the agentic coding feature). You
              can manage installed packages in{' '}
              <button
                type="button"
                className={settingsLinkClass}
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
              >
                Project Settings
              </button>
              .
            </p>
          </section>
        </div>

        <div
          className={footerClass}
          data-testid="agent-elements-claude-commands-footer"
          data-agent-elements-shell="claude-commands-footer"
        >
          <button
            type="button"
            className={primaryButtonClass}
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
