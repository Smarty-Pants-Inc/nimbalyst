import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { usePostHog } from 'posthog-js/react';

interface ExtensionPluginCommand {
  extensionId: string;
  extensionName: string;
  pluginName: string;
  pluginNamespace: string;
  commandName: string;
  description: string;
}

const suggestionsClass = [
  'slash-command-suggestions',
  'agent-elements-slash-command-suggestions',
  'flex w-full max-w-4xl flex-col items-start gap-[var(--an-spacing-xs)]',
  'px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] mx-auto',
].join(' ');

const labelClass = [
  'slash-command-suggestions-label',
  'text-[11px] font-medium leading-none text-[var(--an-foreground-subtle)]',
].join(' ');

const pillsClass = [
  'slash-command-suggestions-pills',
  'flex w-full flex-wrap justify-start gap-[var(--an-spacing-xs)]',
].join(' ');

const chipClass = [
  'slash-command-pill',
  'agent-elements-slash-command-chip',
  'inline-flex cursor-pointer items-center gap-[var(--an-spacing-xxs)]',
  'rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background-secondary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)]',
  'text-[13px] font-medium text-[var(--an-foreground-muted)] outline-none',
  'transition-[background-color,border-color,color] duration-150 ease-out',
  'hover:border-[var(--an-border-color-strong)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const expandClass = [
  'slash-command-pill',
  'slash-command-expand-pill',
  'agent-elements-slash-command-expand',
  'inline-flex cursor-pointer items-center gap-[var(--an-spacing-xxs)]',
  'rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xxs)]',
  'text-[13px] font-medium text-[var(--an-foreground-subtle)] outline-none',
  'transition-[background-color,border-color,color] duration-150 ease-out',
  'hover:border-[var(--an-border-color-strong)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]',
].join(' ');

const tooltipClass = [
  'slash-command-tooltip',
  'agent-elements-slash-command-tooltip',
  'absolute bottom-[calc(100%+var(--an-spacing-xs))] left-1/2 z-[100]',
  'min-w-[200px] max-w-[320px] -translate-x-1/2 whitespace-normal text-center',
  'rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)]',
  'bg-[var(--an-background)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]',
  'text-xs font-normal leading-relaxed text-[var(--an-foreground-muted)]',
  'pointer-events-none invisible opacity-0',
  'transition-[opacity,visibility,background-color,border-color,color] duration-150 ease-out',
  'group-hover:visible group-hover:opacity-100',
].join(' ');

export interface SlashCommandSuggestionsProps {
  /** Session provider - only shows for claude-code */
  provider: string;
  /** Whether the session has any messages */
  hasMessages: boolean;
  /** Workspace path for loading commands */
  workspacePath: string;
  /** Session ID (unused but kept for consistency) */
  sessionId?: string;
  /** Callback when a command is selected */
  onCommandSelect: (command: string) => void;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * SlashCommandSuggestions displays pill buttons for installed extension plugin commands
 * when a Claude Code session is empty.
 *
 * Shows commands from enabled extensions via their Claude plugins.
 * Shows a random selection of up to 3 commands initially, with a "(+X)" pill
 * to expand and show all available commands.
 *
 * Clicking a pill populates the input with the slash command.
 */
export const SlashCommandSuggestions: React.FC<SlashCommandSuggestionsProps> = ({
  provider,
  hasMessages,
  workspacePath,
  onCommandSelect
}) => {
  const posthog = usePostHog();
  const [extensionCommands, setExtensionCommands] = useState<ExtensionPluginCommand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show for claude-code provider with empty session
  const shouldShow = provider === 'claude-code' && !hasMessages;

  // Fetch commands from extension plugins
  useEffect(() => {
    if (!shouldShow || !workspacePath) {
      setIsLoading(false);
      return;
    }

    const fetchExtensionCommands = async () => {
      setIsLoading(true);
      try {
        const commands = await window.electronAPI.extensions.getClaudePluginCommands();
        setExtensionCommands(commands);
      } catch (error) {
        console.error('[SlashCommandSuggestions] Failed to load extension commands:', error);
        setExtensionCommands([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExtensionCommands();
  }, [shouldShow, workspacePath]);

  // Unified command type for display
  type UnifiedCommand = {
    type: 'extension';
    name: string;
    description: string;
    sourceId: string;
    sourceName: string;
  };

  // Convert and shuffle extension commands
  const allCommands = useMemo((): UnifiedCommand[] => {
    const unified: UnifiedCommand[] = [];

    // Extension plugin commands are namespaced: pluginNamespace:commandName
    for (const cmd of extensionCommands) {
      unified.push({
        type: 'extension',
        name: `${cmd.pluginNamespace}:${cmd.commandName}`,
        description: cmd.description,
        sourceId: cmd.extensionId,
        sourceName: cmd.extensionName,
      });
    }

    return shuffleArray(unified);
  }, [extensionCommands]);

  // Get commands to display based on expanded state
  const displayCommands = useMemo(() => {
    if (isExpanded || allCommands.length <= 3) {
      return allCommands;
    }
    return allCommands.slice(0, 3);
  }, [allCommands, isExpanded]);

  // Calculate how many additional commands are hidden
  const hiddenCount = allCommands.length - 3;

  const handleCommandClick = useCallback((cmd: UnifiedCommand) => {
    // Track the suggestion click in analytics.
    // PRIVACY NOTE: It's safe to send commandName and sourceId because this component
    // only displays commands from built-in extensions.
    posthog?.capture('slash_command_suggestion_clicked', {
      commandName: cmd.name,
      extensionId: cmd.sourceId,
      commandType: cmd.type,
    });

    onCommandSelect(`/${cmd.name} `);
  }, [onCommandSelect, posthog]);

  const handleExpandClick = useCallback(() => {
    setIsExpanded(true);
  }, []);

  // Don't render if not applicable or no commands
  if (!shouldShow || isLoading || displayCommands.length === 0) {
    return null;
  }

  return (
    <div
      className={suggestionsClass}
      data-testid="agent-elements-slash-command-suggestions"
      data-agent-elements-shell="slash-command-suggestions"
      data-component="UnifiedAISlashCommandSuggestions"
    >
      <div className={labelClass}>
        Try a command:
      </div>
      <div className={pillsClass}>
        {displayCommands.map((cmd) => (
          <div key={cmd.name} className="slash-command-pill-wrapper group relative inline-flex">
            <button
              type="button"
              className={chipClass}
              data-testid="agent-elements-slash-command-chip"
              data-agent-elements-shell="slash-command-chip"
              data-command-name={cmd.name}
              onClick={() => handleCommandClick(cmd)}
            >
              <span className="slash-command-pill-icon font-semibold text-[var(--an-primary-color)]">/</span>
              <span className="slash-command-pill-name whitespace-nowrap">{cmd.name}</span>
            </button>
            {cmd.description && (
              <div
                className={tooltipClass}
                role="tooltip"
                data-agent-elements-shell="slash-command-tooltip"
              >
                {cmd.description}
              </div>
            )}
          </div>
        ))}
        {!isExpanded && hiddenCount > 0 && (
          <button
            type="button"
            className={expandClass}
            data-testid="agent-elements-slash-command-expand"
            data-agent-elements-shell="slash-command-expand"
            onClick={handleExpandClick}
          >
            <span className="slash-command-pill-name whitespace-nowrap">+{hiddenCount}</span>
          </button>
        )}
      </div>
    </div>
  );
};
