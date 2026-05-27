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
        name: 'super_loop_progress_update',
        input,
      }],
    },
  });
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.writeFile(
    path.join(workspacePath, 'README.md'),
    '# Agent Elements custom widget crash proof\n',
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

test('renders custom-widget crashes through the Agent Elements error shell in the launched app', async () => {
  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Agent Elements custom widget crash proof',
    provider: 'claude-code',
    model: 'claude-code:opus-1m',
  });

  await insertUserPrompt(page, sessionId, 'Render malformed custom widget output.');

  const toolId = `tool_widget_crash_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(toolId, {
      phase: 'building',
      status: 'blocked',
      completionSignal: false,
      currentIteration: 3,
    }),
    { source: 'claude-code' },
  );

  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: 10_000 });
  await sessionItem.click();

  const transcript = page.locator('.rich-transcript-view');
  await expect(transcript).toBeVisible({ timeout: 10_000 });

  const errorCard = page.locator('[data-testid="agent-elements-tool-widget-error-card"]');
  await expect(errorCard).toBeVisible({ timeout: 15_000 });
  await expect(errorCard).toHaveAttribute('data-component', 'RichTranscriptAgentElementsToolWidgetErrorBoundary');
  await expect(errorCard).toHaveAttribute('data-agent-elements-shell', 'tool-widget-error-card');
  await expect(errorCard).toHaveAttribute('data-tool-status', 'error');
  await expect(errorCard).toContainText('Widget failed to render');
  await expect(errorCard).toContainText('super_loop_progress_update');

  const message = errorCard.locator('[data-testid="agent-elements-tool-widget-error-message"]');
  await expect(message).toBeVisible();
  await expect(message).toContainText(/Cannot read|undefined|null/i);

  await expect(errorCard.locator('[data-testid="agent-elements-tool-widget-error-details"]')).toHaveCount(0);
  await errorCard.getByRole('button', { name: 'Show details' }).click();
  await expect(errorCard.locator('[data-testid="agent-elements-tool-widget-error-details"]')).toBeVisible();
  await expect(errorCard.locator('[data-testid="agent-elements-tool-widget-error-actions"]')).toBeVisible();

  await expect(page.locator('[data-testid="agent-elements-transcript-row"]').first())
    .toHaveAttribute('data-agent-align', 'left');
});
