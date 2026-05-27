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
  insertUserPrompt,
} from '../utils/interactivePromptTestHelpers';
import { switchToAgentMode } from '../utils/testHelpers';

test.describe.configure({ mode: 'serial' });

let electronApp: ElectronApplication;
let page: Page;
let workspacePath: string;

async function enableToolRows(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const settings = await (window as any).electronAPI.aiGetSettings();
    await (window as any).electronAPI.aiSaveSettings({
      ...settings,
      showToolCalls: true,
    });
  });
}

function toolUseMessage(toolId: string, name: string, input: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      id: `msg_${toolId}`,
      content: [{
        type: 'tool_use',
        id: toolId,
        name,
        input,
      }],
    },
  });
}

function toolResultMessage(toolId: string, result: Record<string, unknown> | string): string {
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  return JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolId,
        content: [{ type: 'text', text }],
      }],
    },
  });
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.mkdir(path.join(workspacePath, 'docs'), { recursive: true });
  await fs.writeFile(
    path.join(workspacePath, 'docs', 'agent-elements-plan.md'),
    '# Agent Elements todo and plan proof\n',
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

test('renders todo and plan tool rows with Agent Elements chrome in the launched app', async () => {
  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Agent Elements todo plan proof',
    provider: 'claude-code',
    model: 'claude-code:opus-1m',
  });

  await insertUserPrompt(page, sessionId, 'Render todo and plan updates without raw JSON.');

  const todoToolId = `tool_todo_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(todoToolId, 'TodoWrite', {
      todos: [
        { id: 'todo-1', content: 'Replace raw todo JSON', status: 'completed' },
        { id: 'todo-2', content: 'Bridge plan rows into Agent Elements', status: 'in_progress' },
        { id: 'todo-3', content: 'Verify launched preview gutters', status: 'pending' },
      ],
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(todoToolId, {
      todos: [
        { content: 'Replace raw todo JSON', status: 'completed' },
        { content: 'Bridge plan rows into Agent Elements', status: 'in_progress' },
        { content: 'Verify launched preview gutters', status: 'pending' },
      ],
    }),
    { source: 'claude-code' },
  );

  const runningTodoToolId = `tool_todo_running_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(runningTodoToolId, 'todo_list', {
      items: [
        { text: 'Stream todo updates progressively', status: 'active' },
      ],
    }),
    { source: 'claude-code' },
  );

  const planToolId = `tool_plan_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(planToolId, 'update_plan', {
      title: 'Agent Elements launched todo and plan proof',
      status: 'awaiting_approval',
      file_path: 'docs/agent-elements-plan.md',
      summary: 'The launched app should show first-class todo and plan components.',
      steps: [
        { step: 'Add launched proof coverage', status: 'completed' },
        { step: 'Check todo and plan renderer boundaries', status: 'in_progress' },
        { step: 'Keep raw payloads debug-only', status: 'pending' },
      ],
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(planToolId, 'Plan updated.'),
    { source: 'claude-code' },
  );

  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: 10_000 });
  await sessionItem.click();

  const transcript = page.locator('.rich-transcript-view');
  await expect(transcript).toBeVisible({ timeout: 10_000 });

  const rendererBoundaries = page.locator('[data-testid="agent-elements-renderer-boundary"]');
  await expect(rendererBoundaries).toHaveCount(3, { timeout: 15_000 });
  await expect(rendererBoundaries.nth(0)).toHaveAttribute('data-renderer-kind', 'todo');
  await expect(rendererBoundaries.nth(1)).toHaveAttribute('data-renderer-kind', 'todo');
  await expect(rendererBoundaries.nth(2)).toHaveAttribute('data-renderer-kind', 'plan');

  const todoCards = page.locator('[data-testid="agent-elements-todo-card"]');
  await expect(todoCards).toHaveCount(2);
  await expect(todoCards.first()).toHaveAttribute('data-component', 'AgentToolCard');
  await expect(todoCards.first()).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
  await expect(todoCards.first()).toHaveAttribute('data-agent-elements-card-width', 'bridge-fill');

  const todoLists = page.locator('[data-testid="agent-elements-todo-list"]');
  await expect(todoLists.first()).toHaveAttribute('data-component', 'AgentTodoList');
  await expect(todoLists.first()).toHaveAttribute('data-agent-elements-card-width', 'card-content');
  await expect(todoLists.first()).toHaveAttribute('data-todo-streaming', 'false');
  await expect(todoLists.first()).toContainText('Replace raw todo JSON');
  await expect(todoLists.first()).toContainText('Bridge plan rows into Agent Elements');
  await expect(todoLists.first()).not.toContainText('"todos"');

  const runningTodo = todoLists.nth(1);
  await expect(runningTodo).toHaveAttribute('data-todo-streaming', 'true');
  await expect(runningTodo).toContainText('Stream todo updates progressively');

  const planCard = page.locator('[data-testid="agent-elements-plan-card"]');
  await expect(planCard).toBeVisible({ timeout: 15_000 });
  await expect(planCard).toHaveAttribute('data-component', 'AgentPlanCard');
  await expect(planCard).toHaveAttribute('data-plan-status', 'awaiting_approval');
  await expect(planCard).toContainText('Agent Elements launched todo and plan proof');
  await expect(planCard).toContainText('docs/agent-elements-plan.md');
  await expect(planCard).toContainText('Add launched proof coverage');
  await expect(planCard).toContainText('Keep raw payloads debug-only');
  await expect(planCard.locator('[data-testid="agent-elements-plan-approve"]')).toBeVisible();
  await expect(planCard.locator('[data-testid="agent-elements-plan-summary"]')).not.toContainText('"steps"');

  await expect(page.locator('[data-testid="agent-elements-transcript-row"]').first())
    .toHaveAttribute('data-agent-align', 'left');
});
