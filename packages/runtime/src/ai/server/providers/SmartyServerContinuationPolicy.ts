import { isRecord } from './SmartyServerProviderUtils';

const VALIDATION_COMMAND_PATTERN = /\b(test|tests|vitest|jest|playwright|pytest|ruff|lint|typecheck|tsc|build|check|cargo test|go test|swift test)\b/i;

export function shouldContinueAfterStalledApprovalGatedTask(
  userMessage: string,
  assistantText: string,
  activity: {
    sawToolActivity: boolean;
    sawApprovalGatedToolActivity: boolean;
  },
): boolean {
  if (activity.sawApprovalGatedToolActivity) return false;

  const normalizedUserMessage = userMessage.toLowerCase();
  const normalizedAssistantText = assistantText.toLowerCase();
  const userForbidsApprovalGatedWork = /\bdo not\b.{0,80}\b(edit|write|run shell|shell command|run commands|execute|run tests|validation command)\b/.test(
    normalizedUserMessage,
  );
  if (userForbidsApprovalGatedWork) return false;

  const userAskedForApprovalGatedWork = /\b(ask for approval|approval before|approval-gated|tdd|run tests?|validation command|make .*diff|meaningful .*diff|edit|write|execute|shell command)\b/.test(
    normalizedUserMessage,
  );
  if (!userAskedForApprovalGatedWork) return false;

  return normalizedAssistantText.trim().length === 0
    || /\b(approval-gated|ready\b.{0,80}\bapproval|waiting\b.{0,80}\bapproval|awaiting\b.{0,80}\bapproval|need(?:s)?\b.{0,80}\bapproval|before\b.{0,80}\b(write|edit|run|execute)|once\b.{0,80}\bapproved|after\b.{0,80}\bapproval|next|reading|inspect(?:ing)?|found|confirmed|will|going to|need to|plan)\b/.test(
      normalizedAssistantText,
    );
}

export function shouldContinueAfterApprovedInterruptResume(
  assistantText: string,
  activity: {
    sawToolActivity: boolean;
    sawApprovalGatedToolActivity: boolean;
    sawApprovalGatedFileMutationToolActivity: boolean;
    sawFailedValidationToolResult: boolean;
    sawAssistantText: boolean;
  },
): boolean {
  if (!activity.sawToolActivity) return false;
  if (activity.sawFailedValidationToolResult) return true;
  if (activity.sawApprovalGatedFileMutationToolActivity) return false;
  if (!activity.sawAssistantText) return true;

  const normalizedAssistantText = assistantText.toLowerCase();
  if (assistantTextStatesNoRemainingWork(normalizedAssistantText)) return false;

  const textIndicatesIncompleteCodingWork = /\b(next|reading|inspect(?:ing)?|found|confirmed|will|going to|need to|plan|test|validation|fail(?:ed|ing)?|passing|edit|write|diff|changed files?)\b/.test(
    normalizedAssistantText,
  );
  if (textIndicatesIncompleteCodingWork) return true;

  return !activity.sawApprovalGatedToolActivity
    && /\b(looked|checked|reviewed|located|identified|source|test file|implementation)\b/.test(
      normalizedAssistantText,
    );
}

function assistantTextStatesNoRemainingWork(normalizedAssistantText: string): boolean {
  return /\b(already complete|already completed|task is complete|task remains complete|no (?:further|additional|remaining)\b.{0,80}\b(?:action|work|step|tool|approval-gated)|no .*approval-gated action remains|nothing remains|no continuation action|did not repeat)\b/.test(
    normalizedAssistantText,
  );
}

export function isApprovalGatedSmartyTool(toolName: string | undefined): boolean {
  return toolName === 'execute' || toolName === 'write_file' || toolName === 'edit_file';
}

export function isApprovalGatedFileMutationTool(
  toolName: string | undefined,
  toolArguments?: Record<string, unknown>,
): boolean {
  if (toolName === 'write_file' || toolName === 'edit_file') return true;
  if (toolName !== 'execute') return false;
  return isFileDeletingExecuteCommand(toolArguments);
}

export function isFailedValidationToolResult(
  toolName: string | undefined,
  result: unknown,
  toolArguments: Record<string, unknown> | undefined,
): boolean {
  if (toolName !== 'execute') return false;
  if (!containsValidationSignal([toolArguments, result])) return false;
  return hasFailedToolResult(result);
}

function containsValidationSignal(values: unknown[]): boolean {
  return values.some((value) => {
    if (typeof value === 'string') return VALIDATION_COMMAND_PATTERN.test(value);
    if (Array.isArray(value)) return containsValidationSignal(value);
    if (!isRecord(value)) return false;
    return containsValidationSignal([
      value.command,
      value.cmd,
      value.description,
      value.output,
      value.result,
      value.error,
    ]);
  });
}

function hasFailedToolResult(result: unknown): boolean {
  if (typeof result === 'string') {
    const exitCode = result.match(/\bexit code:\s*(\d+)\b/i)?.[1];
    return Boolean(exitCode && Number(exitCode) !== 0);
  }
  if (Array.isArray(result)) return result.some(hasFailedToolResult);
  if (!isRecord(result)) return false;

  const exitCode = numericField(result.exit_code) ?? numericField(result.exitCode);
  if (typeof exitCode === 'number' && exitCode !== 0) return true;
  if (result.success === false) return true;
  if (typeof result.status === 'string' && /^(error|failed|failure)$/i.test(result.status)) return true;
  if (result.error !== undefined && result.error !== null && result.error !== '') return true;

  return hasFailedToolResult(result.result) || hasFailedToolResult(result.output);
}

function isFileDeletingExecuteCommand(toolArguments: Record<string, unknown> | undefined): boolean {
  const command = typeof toolArguments?.command === 'string'
    ? toolArguments.command
    : typeof toolArguments?.cmd === 'string'
      ? toolArguments.cmd
      : '';
  return /(?:^|[;&]\s*)rm\s+(?:-[A-Za-z]+\s+)*(?:"[^"]+"|'[^']+'|[^\s;&|]+)/.test(command);
}

function numericField(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}
