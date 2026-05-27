import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createTempWorkspace,
  launchElectronApp,
  waitForAppReady,
} from '../helpers';
import {
  cleanupTestSessions,
  createTestSession,
  insertMessage,
} from '../utils/interactivePromptTestHelpers';
import { switchToAgentMode } from '../utils/testHelpers';

test.describe.configure({ mode: 'serial' });

let electronApp: ElectronApplication;
let page: Page;
let workspacePath: string;

function protocolEnvelope(
  seq: number,
  method: string,
  data: Record<string, unknown>,
  namespace: string[] = [],
): string {
  return JSON.stringify({
    seq,
    method,
    params: { namespace, data },
  });
}

function streamEnvelope(
  id: string,
  event: string,
  data: Record<string, unknown>,
  namespace: string[] = [],
): string {
  return JSON.stringify({ id, event, namespace, data });
}

async function enableToolRows(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const settings = await (window as any).electronAPI.aiGetSettings();
    await (window as any).electronAPI.aiSaveSettings({
      ...settings,
      showToolCalls: true,
    });
  });
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.writeFile(
    path.join(workspacePath, 'README.md'),
    '# Smarty Server transcript proof\n',
    'utf8',
  );

  electronApp = await launchElectronApp({
    workspace: workspacePath,
    permissionMode: 'allow-all',
    recordVideo: false,
    env: {
      NIMBALYST_NO_FOCUS: '1',
      PLAYWRIGHT_TEST: 'true',
    },
  });
  page = await electronApp.firstWindow();
  await waitForAppReady(page);
  await enableToolRows(page);
  await switchToAgentMode(page);
});

test.afterAll(async () => {
  if (page) {
    await cleanupTestSessions(page, workspacePath);
  }
  await electronApp?.close();
  await fs.rm(workspacePath, { recursive: true, force: true }).catch(() => undefined);
});

test('renders Smarty Server protocol and framework stream rows through Agent Elements in the launched app', async () => {
  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Smarty Server Agent Elements proof',
    provider: 'smarty-server',
    model: 'smarty-server:smarty_coding_agent',
  });

  await insertMessage(page, sessionId, 'input', JSON.stringify({ prompt: 'Render the Smarty Server stream.' }), {
    source: 'smarty-server',
  });
  await insertMessage(page, sessionId, 'output', protocolEnvelope(1, 'messages', {
    event: 'content-block-delta',
    messageId: 'msg-protocol-1',
    delta: {
      type: 'reasoning-delta',
      reasoning: 'Check the streamed protocol envelope before answering.',
    },
  }), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', protocolEnvelope(2, 'messages', {
    event: 'content-block-delta',
    messageId: 'msg-protocol-1',
    delta: {
      type: 'text-delta',
      text: 'Smarty Server protocol rows are live.',
    },
  }), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', streamEnvelope('evt-updates-1', 'updates', {
    plan: { status: 'running' },
    next: 'write_tests',
  }, ['planner']), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', streamEnvelope('evt-values-1', 'values', {
    currentStep: 'write_tests',
    attempts: 1,
  }, ['planner']), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', streamEnvelope('evt-output-1', 'output', {
    result: 'Test plan generated',
  }, ['planner']), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', streamEnvelope('evt-subagent-1', 'subagents', {
    name: 'researcher',
    status: 'running',
    taskInput: 'Inspect DeepAgents event streaming.',
    messages: [{ role: 'assistant', content: 'Reading subagent projection docs.' }],
    toolCalls: [{ id: 'tool-1', name: 'search_docs', status: 'finished' }],
    values: { documents: 3 },
  }, ['tools:call_researcher']), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', protocolEnvelope(3, 'lifecycle', {
    event: 'started',
    graph_name: 'researcher',
    summary: 'Subgraph started.',
  }, ['researcher:abc']), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', streamEnvelope('evt-checkpoint-1', 'checkpoints', {
    checkpoint: { id: 'checkpoint-42' },
    tasks: [{ id: 'task-1', name: 'Write tests', status: 'completed' }],
  }, ['planner']), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', streamEnvelope('evt-task-1', 'tasks', {
    name: 'Run focused tests',
    status: 'running',
  }, ['planner']), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', streamEnvelope('evt-debug-1', 'debug', {
    name: 'planner.trace',
    message: 'Planner selected test files',
  }, ['planner']), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', protocolEnvelope(4, 'custom:artifact', {
    eventName: 'artifact.created',
    summary: 'Report artifact created.',
    status: 'completed',
  }), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', protocolEnvelope(5, 'input', {
    event: 'request',
    question: 'Approve the proposed file edit?',
    options: [{ label: 'Approve' }, { label: 'Reject' }],
    status: 'pending',
  }), { source: 'smarty-server' });
  await insertMessage(page, sessionId, 'output', protocolEnvelope(6, 'messages', {
    event: 'message-finish',
    messageId: 'msg-usage-1',
    contextWindow: 3000,
    message: {
      content: [{ type: 'text', text: 'Finished with usage metadata.' }],
      usage_metadata: {
        input_tokens: 1200,
        output_tokens: 300,
        total_tokens: 1500,
        input_token_details: {
          cache_read: 100,
          cache_creation: 50,
        },
      },
    },
  }), { source: 'smarty-server' });

  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: 10_000 });
  await sessionItem.click();

  const transcript = page.locator('.rich-transcript-view');
  await expect(transcript).toBeVisible({ timeout: 10_000 });

  const assistantMessageBridge = page
    .locator('[data-testid="rich-transcript-agent-elements-message-bridge"]')
    .filter({ hasText: 'Smarty Server protocol rows are live.' })
    .first();
  await expect(assistantMessageBridge).toBeVisible();
  await expect(assistantMessageBridge.locator('[data-testid="agent-elements-transcript-row"]'))
    .toHaveAttribute('data-agent-align', 'left');
  await expect(assistantMessageBridge.locator('[data-testid="agent-elements-transcript-row"]'))
    .toHaveAttribute('data-agent-role', 'assistant');
  await expect(page.locator('[data-testid="agent-elements-renderer-boundary"][data-renderer-kind="thinking"]').first())
    .toContainText('Check the streamed protocol envelope');
  const stateUpdateRows = page.locator('[data-testid="agent-elements-renderer-boundary"][data-renderer-kind="stateUpdate"]');
  await expect(stateUpdateRows.filter({ hasText: 'Graph update' }).first()).toContainText('write_tests');
  await expect(stateUpdateRows.filter({ hasText: 'State values' }).first()).toContainText('currentStep');
  await expect(stateUpdateRows.filter({ hasText: 'State values' }).first()).toContainText('write_tests');
  await expect(stateUpdateRows.filter({ hasText: 'Final output' }).first()).toContainText('Test plan generated');
  await expect(page.locator('[data-testid="agent-elements-renderer-boundary"][data-renderer-kind="subagent"]').first())
    .toContainText('search_docs');
  const lifecycleRows = page.locator('[data-testid="agent-elements-renderer-boundary"][data-renderer-kind="checkpointTaskDebug"]');
  await expect(lifecycleRows.filter({ hasText: 'researcher' }).first()).toContainText('researcher');
  await expect(lifecycleRows.filter({ hasText: 'checkpoint-42' }).first()).toContainText('Write tests');
  await expect(lifecycleRows.filter({ hasText: 'Run focused tests' }).first()).toContainText('running');
  await expect(lifecycleRows.filter({ hasText: 'planner.trace' }).first()).toContainText('Planner selected test files');
  await expect(page.locator('[data-testid="agent-elements-renderer-boundary"][data-renderer-kind="extensionEvent"]').first())
    .toContainText('Report artifact created.');
  await expect(page.locator('[data-testid="agent-elements-renderer-boundary"][data-renderer-kind="humanInput"]').first())
    .toContainText('Approve the proposed file edit?');
  await expect(page.locator('[data-testid="agent-elements-renderer-boundary"][data-renderer-kind="turnSummary"]').first())
    .toContainText('1,500');

  await expect(page.locator('[data-testid="agent-elements-transcript-row"]').first())
    .toHaveAttribute('data-agent-align', 'left');
  await expect(page.locator('[data-testid="agent-elements-debug-disclosure"]').first())
    .toHaveAttribute('data-debug-only', 'true');
  await expect(page.locator('[data-testid="agent-elements-turn-summary-card"]').first())
    .not.toContainText('usage_metadata');
  await expect(page.locator('[data-testid="agent-elements-tool-primary"]').first())
    .not.toContainText('toolCalls');
});
