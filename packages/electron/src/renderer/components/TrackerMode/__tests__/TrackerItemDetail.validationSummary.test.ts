import { describe, it, expect } from 'vitest';
import type { TranscriptViewMessage } from '@nimbalyst/runtime/ai/server/types';
import {
  buildLatestApprovalSummary,
  buildLatestValidationSummary,
  formatLatestApprovalSummary,
  formatLatestValidationSummary,
} from '../validationSummary';

type ToolCallView = NonNullable<TranscriptViewMessage['toolCall']>;
type PermissionPromptView = Extract<
  NonNullable<TranscriptViewMessage['interactivePrompt']>,
  { promptType: 'permission_request' }
>;

function makeToolMessage(
  overrides: Partial<ToolCallView>,
  messageOverrides: Partial<TranscriptViewMessage> = {},
): TranscriptViewMessage {
  return {
    id: 1,
    sequence: 1,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    type: 'tool_call',
    subagentId: null,
    ...messageOverrides,
    toolCall: {
      toolName: 'command_execution',
      toolDisplayName: 'Bash',
      status: 'completed',
      description: null,
      arguments: {},
      targetFilePath: null,
      mcpServer: null,
      mcpTool: null,
      providerToolCallId: 'tool-1',
      progress: [],
      ...overrides,
    },
  };
}

function makePermissionPrompt(overrides: Partial<PermissionPromptView>): TranscriptViewMessage {
  return {
    id: 10,
    sequence: 10,
    createdAt: new Date('2025-01-01T00:02:00Z'),
    type: 'interactive_prompt',
    subagentId: null,
    interactivePrompt: {
      promptType: 'permission_request',
      requestId: 'perm-1',
      status: 'pending',
      toolName: 'Edit',
      rawCommand: '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/TrackerItemDetail.tsx',
      pattern: 'Edit(*)',
      patternDisplayName: 'Edit TrackerItemDetail.tsx',
      isDestructive: false,
      warnings: [],
      ...overrides,
    },
  };
}

describe('buildLatestApprovalSummary', () => {
  it('returns the latest pending permission request with tool label and target path', () => {
    const messages: TranscriptViewMessage[] = [
      makePermissionPrompt({
        requestId: 'older',
        status: 'resolved',
        decision: 'allow',
        toolName: 'Bash',
        rawCommand: 'npm test -- TrackerItemDetail',
        patternDisplayName: 'Bash npm test',
      }),
      makePermissionPrompt({
        requestId: 'latest',
        status: 'pending',
        toolName: 'Edit',
        rawCommand: '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/TrackerItemDetail.tsx',
        patternDisplayName: 'Edit TrackerItemDetail.tsx',
      }),
    ];

    expect(buildLatestApprovalSummary(messages)).toEqual({
      state: 'pending',
      label: 'Edit',
      target: '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/TrackerItemDetail.tsx',
    });
  });

  it('returns the latest resolved permission decision', () => {
    const messages: TranscriptViewMessage[] = [
      makePermissionPrompt({
        requestId: 'denied',
        status: 'resolved',
        decision: 'deny',
        toolName: 'Write',
        rawCommand: '/forks/nimbalyst/package.json',
        patternDisplayName: 'Write package.json',
      }),
    ];

    expect(buildLatestApprovalSummary(messages)).toEqual({
      state: 'denied',
      label: 'Write',
      target: '/forks/nimbalyst/package.json',
    });
  });

  it('stays quiet when the linked session has no permission evidence', () => {
    expect(buildLatestApprovalSummary([
      makeToolMessage({ arguments: { command: 'npm test -- tracker' }, exitCode: 0, result: 'ok' }),
    ])).toEqual(null);
  });
});

describe('formatLatestApprovalSummary', () => {
  it('shows a compact pending approval label with the tool and target path', () => {
    expect(formatLatestApprovalSummary({
      state: 'pending',
      label: 'Edit',
      target: '/forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/TrackerItemDetail.tsx',
    })).toEqual('approval pending: Edit - /forks/nimbalyst/packages/electron/src/renderer/components/TrackerMode/TrackerItemDetail.tsx');
  });

  it('shows compact resolved allowed and denied states', () => {
    expect(formatLatestApprovalSummary({
      state: 'allowed',
      label: 'Bash',
      target: 'npm test -- TrackerItemDetail',
    })).toEqual('approval allowed: Bash - npm test -- TrackerItemDetail');

    expect(formatLatestApprovalSummary({
      state: 'denied',
      label: 'Write',
      target: '/forks/nimbalyst/package.json',
    })).toEqual('approval denied: Write - /forks/nimbalyst/package.json');
  });
});

describe('buildLatestValidationSummary', () => {
  it('returns the latest validation-like shell result with label, status, and exit code', () => {
    const messages: TranscriptViewMessage[] = [
      makeToolMessage({
        providerToolCallId: 'tool-older',
        arguments: { command: 'npm run lint', description: 'Run lint' },
        exitCode: 0,
        result: 'ok',
      }),
      makeToolMessage({
        providerToolCallId: 'tool-latest',
        arguments: { command: 'npm test -- --runInBand tracker', description: 'Tracker tests' },
        exitCode: 1,
        result: 'failed',
      }),
    ];

    expect(buildLatestValidationSummary(messages)).toEqual({
      label: 'Tracker tests',
      status: 'failed',
      exitCode: 1,
      command: 'npm test -- --runInBand tracker',
    });
  });

  it('marks a zero-exit validation command as passed when shell evidence is recent', () => {
    const messages: TranscriptViewMessage[] = [
      makeToolMessage({
        providerToolCallId: 'tool-pass',
        arguments: { command: 'npm run test:unit -- TrackerItemDetail', description: 'Tracker detail tests' },
        exitCode: 0,
        result: 'pass',
      }),
    ];

    expect(buildLatestValidationSummary(messages)).toEqual({
      label: 'Tracker detail tests',
      status: 'passed',
      exitCode: 0,
      command: 'npm run test:unit -- TrackerItemDetail',
    });
  });

  it('falls back to a quiet no-validation state when the session has no validation evidence', () => {
    const messages: TranscriptViewMessage[] = [
      makeToolMessage({
        toolName: 'read_file',
        toolDisplayName: 'Read File',
        arguments: { file_path: '/tmp/example.ts' },
      }),
      {
        id: 2,
        sequence: 2,
        createdAt: new Date('2025-01-02T00:01:00Z'),
        type: 'assistant_message',
        text: 'Done',
        subagentId: null,
      },
    ];

    expect(buildLatestValidationSummary(messages)).toEqual(null);
  });

  it('returns a stale summary when validation evidence is older than later transcript activity', () => {
    const messages: TranscriptViewMessage[] = [
      makeToolMessage(
        {
          providerToolCallId: 'tool-stale-pass',
          arguments: { command: 'npm run test:unit -- TrackerItemDetail', description: 'Tracker detail tests' },
          exitCode: 0,
          result: 'pass',
        },
        {
          createdAt: new Date('2025-01-01T00:00:00Z'),
        },
      ),
      {
        id: 2,
        sequence: 2,
        createdAt: new Date('2025-01-02T00:01:00Z'),
        type: 'assistant_message',
        text: 'Changed product code after validation ran',
        subagentId: null,
      },
    ];

    expect(buildLatestValidationSummary(messages)).toEqual({
      label: 'Tracker detail tests',
      status: 'stale',
      exitCode: 0,
      command: 'npm run test:unit -- TrackerItemDetail',
    });
  });

  it('formats stale validation evidence distinctly from no validation', () => {
    expect(formatLatestValidationSummary({
      label: 'Tracker detail tests',
      status: 'stale',
      exitCode: 0,
      command: 'npm run test:unit -- TrackerItemDetail',
    })).toContain('validation stale');
  });

});
