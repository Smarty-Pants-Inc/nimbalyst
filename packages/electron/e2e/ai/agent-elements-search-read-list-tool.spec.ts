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

function toolResultMessage(toolId: string, result: Record<string, unknown>, options?: { isError?: boolean }): string {
  return JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolId,
        content: [{ type: 'text', text: JSON.stringify(result) }],
        ...(options?.isError ? { is_error: true } : {}),
      }],
    },
  });
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.mkdir(path.join(workspacePath, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(workspacePath, 'src', 'app.ts'),
    'export function renderAgentElements() { return "agent-elements"; }\n',
    'utf8',
  );
  await fs.writeFile(
    path.join(workspacePath, 'src', 'registry.ts'),
    'export function AgentElementsEventRenderer() { return null; }\n',
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

test('renders search read and list tool results with Agent Elements chrome in the launched app', async () => {
  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Agent Elements search read list proof',
    provider: 'claude-code',
    model: 'claude-code:opus-1m',
  });

  await insertUserPrompt(page, sessionId, 'Search, read, and list source files.');

  const grepToolId = `tool_grep_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(grepToolId, 'Grep', {
      pattern: 'AgentElementsEventRenderer',
      path: 'packages/runtime/src',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(grepToolId, {
      matches: [{
        path: 'packages/runtime/src/ui/AgentElements/AgentElementsRendererRegistry.tsx',
        line: 214,
        text: 'export function AgentElementsEventRenderer',
      }],
    }),
    { source: 'claude-code' },
  );

  const runningSearchToolId = `tool_running_grep_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(runningSearchToolId, 'Grep', {
      pattern: 'PendingRenderer',
      path: 'packages/runtime/src',
    }),
    { source: 'claude-code' },
  );

  const emptySearchToolId = `tool_empty_grep_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(emptySearchToolId, 'Grep', {
      pattern: 'MissingRenderer',
      path: 'packages/runtime/src',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(emptySearchToolId, { matches: [] }),
    { source: 'claude-code' },
  );

  const oversizedContent = `${'a'.repeat(260)}\nSECOND_LINE_NOT_PRIMARY`;
  const oversizedReadToolId = `tool_oversized_read_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(oversizedReadToolId, 'Read', {
      file_path: '/repo/src/oversized.ts',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(oversizedReadToolId, {
      path: '/repo/src/oversized.ts',
      content: oversizedContent,
    }),
    { source: 'claude-code' },
  );

  const erroredReadToolId = `tool_errored_read_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(erroredReadToolId, 'Read', {
      file_path: '/repo/src/missing.ts',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(erroredReadToolId, {
      error: 'File not found',
      status: 'error',
    }, { isError: true }),
    { source: 'claude-code' },
  );

  const readToolId = `tool_read_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(readToolId, 'Read', {
      file_path: '/repo/src/app.ts',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(readToolId, {
      path: '/repo/src/app.ts',
      content: 'export const value = 1;\nexport const next = 2;',
    }),
    { source: 'claude-code' },
  );

  const listToolId = `tool_list_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(listToolId, 'list', {
      path: '/repo/src',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(listToolId, {
      files: [
        { path: '/repo/src/app.ts', type: 'file' },
        { path: '/repo/src/components', type: 'directory' },
      ],
    }),
    { source: 'claude-code' },
  );

  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: 10_000 });
  await sessionItem.click();

  const transcript = page.locator('.rich-transcript-view');
  await expect(transcript).toBeVisible({ timeout: 10_000 });

  const searchCards = page.locator('[data-testid="agent-elements-search-tool-card"]');
  await expect(searchCards).toHaveCount(7, { timeout: 15_000 });

  const grepCard = searchCards.filter({ hasText: 'AgentElementsRendererRegistry.tsx' }).first();
  await expect(grepCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(grepCard.locator('[data-testid="agent-elements-search-results"]'))
    .toContainText('export function AgentElementsEventRenderer');
  await expect(grepCard.locator('[data-testid="agent-elements-search-results"]')).toContainText(':214');
  await expect(grepCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"matches"');
  await expect(grepCard.locator('[data-testid="agent-elements-debug-disclosure"]'))
    .toHaveAttribute('data-debug-only', 'true');

  const readCard = searchCards.filter({ hasText: '/repo/src/app.ts' }).first();
  await expect(readCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(readCard.locator('[data-testid="agent-elements-search-results"]')).toContainText('app.ts');
  await expect(readCard.locator('[data-testid="agent-elements-search-results"]')).toContainText('export const value = 1;');
  await expect(readCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"content"');

  const listCard = searchCards.filter({ hasText: '/repo/src/components' }).first();
  await expect(listCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(listCard.locator('[data-testid="agent-elements-search-results"]')).toContainText('/repo/src/app.ts');
  await expect(listCard.locator('[data-testid="agent-elements-search-results"]')).toContainText('/repo/src/components');
  await expect(listCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"files"');

  const runningCard = searchCards.filter({ hasText: 'PendingRenderer' }).first();
  await expect(runningCard).toHaveAttribute('data-tool-status', 'running');
  await expect(runningCard).toContainText('Searching');
  await expect(runningCard.locator('[data-testid="agent-elements-search-empty"]')).toContainText('Searching...');

  const emptyCard = searchCards.filter({ hasText: 'MissingRenderer' }).first();
  await expect(emptyCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(emptyCard).toContainText('No matches');
  await expect(emptyCard.locator('[data-testid="agent-elements-search-empty"]')).toContainText('No matching files found.');
  await expect(emptyCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"matches"');

  const oversizedReadCard = searchCards.filter({ hasText: '/repo/src/oversized.ts' }).first();
  await expect(oversizedReadCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(oversizedReadCard.locator('[data-testid="agent-elements-search-results"]')).toContainText('oversized.ts');
  await expect(oversizedReadCard.locator('[data-testid="agent-elements-search-results"]')).toContainText('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  await expect(oversizedReadCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('SECOND_LINE_NOT_PRIMARY');
  await expect(oversizedReadCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"content"');

  const erroredReadCard = searchCards.filter({ hasText: '/repo/src/missing.ts' }).first();
  await expect(erroredReadCard).toHaveAttribute('data-tool-status', 'error');
  await expect(erroredReadCard).toContainText('Search failed');
  await expect(erroredReadCard.locator('[data-testid="agent-elements-search-empty"]')).toContainText('error File not found; status error');
  await expect(erroredReadCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"error"');

  await expect(page.locator('[data-testid="agent-elements-renderer-boundary"][data-renderer-kind="search"]'))
    .toHaveCount(7);
  await expect(page.locator('[data-testid="agent-elements-transcript-row"]').first())
    .toHaveAttribute('data-agent-align', 'left');
});
