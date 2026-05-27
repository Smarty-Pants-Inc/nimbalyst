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

function toolUseMessage(toolId: string, input: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      id: `msg_${toolId}`,
      content: [{
        type: 'tool_use',
        id: toolId,
        name: 'Bash',
        input,
      }],
    },
  });
}

function toolResultMessage(toolId: string, output: string, isError = false): string {
  return JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolId,
        is_error: isError,
        content: [{ type: 'text', text: output }],
      }],
    },
  });
}

function nimbalystToolUseMessage(toolId: string, input: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'nimbalyst_tool_use',
    id: toolId,
    name: 'Bash',
    input,
  });
}

function nimbalystToolResultMessage(toolId: string, output: string, isError = false): string {
  return JSON.stringify({
    type: 'nimbalyst_tool_result',
    tool_use_id: toolId,
    result: output,
    is_error: isError,
  });
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.writeFile(
    path.join(workspacePath, 'README.md'),
    '# Agent Elements Bash proof\n',
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

test('renders Bash running, success, and error rows with Agent Elements shell chrome in the launched app', async () => {
  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Agent Elements Bash proof',
    provider: 'claude-code',
    model: 'claude-code:opus-1m',
  });

  await insertUserPrompt(page, sessionId, 'Render shell command output.');

  const runningToolId = `tool_bash_running_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(runningToolId, {
      command: 'sleep 10',
      description: 'Long-running command',
    }),
    { source: 'claude-code' },
  );

  const successToolId = `tool_bash_success_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(successToolId, {
      command: 'npm test -- --runInBand',
      description: 'Run green command',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(successToolId, 'build passed\n3 tests passed'),
    { source: 'claude-code' },
  );

  const errorToolId = `tool_bash_error_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    nimbalystToolUseMessage(errorToolId, {
      command: 'npm run failing-test',
      description: 'Run failing command',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'output',
    nimbalystToolResultMessage(errorToolId, 'tests failed\nexit code 1', true),
    { source: 'claude-code' },
  );

  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: 10_000 });
  await sessionItem.click();

  const transcript = page.locator('.rich-transcript-view');
  await expect(transcript).toBeVisible({ timeout: 10_000 });

  const bashShells = page.locator('[data-testid="rich-transcript-agent-elements-bash-shell"]');
  await expect(bashShells).toHaveCount(3, { timeout: 15_000 });

  const runningShell = bashShells.filter({ hasText: 'Long-running command' });
  await expect(runningShell).toHaveAttribute('data-component', 'RichTranscriptAgentElementsBashShell');
  await expect(runningShell).toHaveAttribute('data-agent-elements-shell', 'tool-card');
  await expect(runningShell).toHaveAttribute('data-bash-status', 'running');
  await expect(runningShell).toHaveAttribute('data-bash-state', 'collapsed');
  await expect(runningShell.locator('.animate-spin')).toBeVisible();
  await expect(runningShell).toContainText('sleep 10');

  const successShell = bashShells.filter({ hasText: 'Run green command' });
  await expect(successShell).toHaveAttribute('data-bash-status', 'success');
  await successShell.click();
  await expect(successShell).toHaveAttribute('data-bash-state', 'expanded');
  await expect(successShell).toContainText('Terminal');
  await expect(successShell).toContainText('npm test -- --runInBand');
  await expect(successShell).toContainText('build passed');
  await expect(successShell.locator('[aria-label="Copy command"]')).toBeVisible();

  const errorShell = bashShells.filter({ hasText: 'Run failing command' });
  await expect(errorShell).toHaveAttribute('data-bash-status', 'error');
  await errorShell.click();
  await expect(errorShell).toHaveAttribute('data-bash-state', 'expanded');
  await expect(errorShell).toContainText('tests failed');
  await expect(errorShell.locator('pre.text-nim-error')).toBeVisible();

  await expect(page.locator('[data-testid="agent-elements-transcript-row"]').first())
    .toHaveAttribute('data-agent-align', 'left');
});
