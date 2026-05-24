import type { TranscriptViewMessage } from '@nimbalyst/runtime/ai/server/types';

export interface LatestValidationSummary {
  label: string;
  status: 'passed' | 'failed' | 'stale';
  exitCode?: number;
  command?: string;
}

export interface LatestApprovalSummary {
  state: 'pending' | 'allowed' | 'denied' | 'cancelled';
  label: string;
  target?: string;
}

const VALIDATION_COMMAND_PATTERN = /\b(test|tests|vitest|jest|playwright|pytest|ruff|lint|typecheck|tsc|build|check|cargo test|go test|swift test)\b/i;
const SHELL_TOOL_NAMES = new Set([
  'bash',
  'command_execution',
  'execute',
  'shell',
  'sh',
  'zsh',
]);

export function buildLatestApprovalSummary(messages: TranscriptViewMessage[]): LatestApprovalSummary | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const prompt = messages[i]?.interactivePrompt;
    if (!prompt || prompt.promptType !== 'permission_request') continue;

    const decision = prompt.decision;
    const state: LatestApprovalSummary['state'] = prompt.status === 'pending'
      ? 'pending'
      : prompt.status === 'cancelled'
        ? 'cancelled'
        : decision === 'deny'
          ? 'denied'
          : 'allowed';
    const label = prompt.toolName || prompt.patternDisplayName || 'Tool approval';
    const target = prompt.rawCommand || prompt.patternDisplayName || undefined;

    return {
      state,
      label,
      ...(target ? { target } : {}),
    };
  }
  return null;
}

export function formatLatestApprovalSummary(approval: LatestApprovalSummary): string {
  return `approval ${approval.state}: ${approval.label}${approval.target ? ` - ${approval.target}` : ''}`;
}

export function formatLatestValidationSummary(validation: LatestValidationSummary): string {
  const exitText = typeof validation.exitCode === 'number' ? `, exit code ${validation.exitCode}` : '';
  const prefix = validation.status === 'stale' ? 'validation stale' : `Validation ${validation.status}`;
  return `${prefix}: ${validation.label}${exitText}`;
}

export function buildLatestValidationSummary(messages: TranscriptViewMessage[]): LatestValidationSummary | null {
  const latestActivityAt = messages.reduce<number | null>((latest, message) => {
    const timestamp = message.createdAt instanceof Date
      ? message.createdAt.getTime()
      : new Date(message.createdAt).getTime();
    if (Number.isNaN(timestamp)) return latest;
    return latest === null ? timestamp : Math.max(latest, timestamp);
  }, null);

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const toolCall = message?.toolCall;
    if (!toolCall) continue;

    const args = toolCall.arguments ?? {};
    const command = typeof args.command === 'string'
      ? args.command
      : typeof args.cmd === 'string'
        ? args.cmd
        : null;
    const description = typeof args.description === 'string'
      ? args.description
      : toolCall.description;
    const toolName = toolCall.toolName.toLowerCase();
    const isShellLike = SHELL_TOOL_NAMES.has(toolName)
      || toolCall.toolDisplayName.toLowerCase() === 'bash'
      || Boolean(command);
    const isValidationLike = Boolean(command && VALIDATION_COMMAND_PATTERN.test(command))
      || Boolean(description && VALIDATION_COMMAND_PATTERN.test(description));
    if (!isShellLike || !isValidationLike) continue;

    const exitCode = typeof toolCall.exitCode === 'number' ? toolCall.exitCode : undefined;
    let status: LatestValidationSummary['status'] | null = null;
    if (typeof exitCode === 'number') {
      status = exitCode === 0 ? 'passed' : 'failed';
    } else if (toolCall.isError || toolCall.status === 'error') {
      status = 'failed';
    } else if (toolCall.result && /\b(fail|failed|error)\b/i.test(toolCall.result)) {
      status = 'failed';
    } else if (toolCall.result && /\b(pass|passed|success|ok)\b/i.test(toolCall.result)) {
      status = 'passed';
    }
    if (!status) continue;

    const validationCreatedAt = message.createdAt instanceof Date
      ? message.createdAt.getTime()
      : new Date(message.createdAt).getTime();
    const isStale = latestActivityAt !== null
      && !Number.isNaN(validationCreatedAt)
      && latestActivityAt - validationCreatedAt > 24 * 60 * 60 * 1000;
    return {
      label: description || command || toolCall.toolDisplayName || 'Validation',
      status: isStale ? 'stale' : status,
      ...(typeof exitCode === 'number' ? { exitCode } : {}),
      ...(command ? { command } : {}),
    };
  }
  return null;
}
