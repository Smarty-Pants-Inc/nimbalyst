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

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

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

function toolResultMessage(toolId: string, content: unknown[]): string {
  return JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolId,
        content,
      }],
    },
  });
}

async function writePng(filePath: string): Promise<void> {
  await fs.writeFile(filePath, Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64'));
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.writeFile(
    path.join(workspacePath, 'README.md'),
    '# Agent Elements visual tool proof\n',
    'utf8',
  );
  await fs.mkdir(path.join(workspacePath, 'artifacts'), { recursive: true });
  await writePng(path.join(workspacePath, 'artifacts', 'before.png'));
  await writePng(path.join(workspacePath, 'artifacts', 'after.png'));

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

test('renders screenshot and display-to-user tool widgets with Agent Elements chrome in the launched app', async () => {
  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Agent Elements visual widgets proof',
    provider: 'claude-code',
    model: 'claude-code:opus-1m',
  });

  const beforePath = path.join(workspacePath, 'artifacts', 'before.png');
  const afterPath = path.join(workspacePath, 'artifacts', 'after.png');
  const screenshotToolId = `tool_screenshot_${Date.now()}`;
  const displayToolId = `tool_display_${Date.now()}`;

  await insertUserPrompt(page, sessionId, 'Show the screenshot and visual display widgets.');
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(screenshotToolId, 'mcp__nimbalyst-mcp__capture_editor_screenshot', {
      file_path: path.join(workspacePath, 'artifacts', 'mockup.html'),
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(screenshotToolId, [{
      type: 'image',
      data: ONE_PIXEL_PNG_BASE64,
      mimeType: 'image/png',
    }]),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(displayToolId, 'display_to_user', {
      items: [
        {
          description: 'Latency by phase',
          chart: {
            chartType: 'bar',
            data: [
              { phase: 'Plan', ms: 12 },
              { phase: 'Build', ms: 42 },
            ],
            xAxisKey: 'phase',
            yAxisKey: 'ms',
          },
        },
        { description: 'Before state', image: { path: beforePath } },
        { description: 'After state', image: { path: afterPath } },
      ],
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(displayToolId, [{
      type: 'text',
      text: 'Displayed 3 item(s): chart and image gallery',
    }]),
    { source: 'claude-code' },
  );

  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: 10_000 });
  await sessionItem.click();

  const transcript = page.locator('.rich-transcript-view');
  await expect(transcript).toBeVisible({ timeout: 10_000 });

  const screenshotCard = page.locator('[data-testid="agent-elements-editor-screenshot-card"]');
  await expect(screenshotCard).toBeVisible({ timeout: 15_000 });
  await expect(screenshotCard).toHaveAttribute('data-agent-elements-shell', 'editor-screenshot-card');
  await expect(screenshotCard.locator('[data-testid="agent-elements-editor-screenshot-status"]')).toHaveText('Captured');
  const screenshotPreview = screenshotCard.locator('[data-testid="agent-elements-editor-screenshot-preview"]');
  await expect(screenshotPreview).toBeVisible();
  await screenshotPreview.click();
  await expect(page.locator('[data-testid="agent-elements-editor-screenshot-lightbox"]')).toBeVisible();
  await page.locator('[data-testid="agent-elements-editor-screenshot-lightbox-close"]').click();
  await expect(page.locator('[data-testid="agent-elements-editor-screenshot-lightbox"]')).toHaveCount(0);

  const visualCard = page.locator('[data-testid="agent-elements-visual-display-card"]');
  await expect(visualCard).toBeVisible({ timeout: 15_000 });
  await expect(visualCard).toHaveAttribute('data-agent-elements-shell', 'visual-display-card');
  await expect(visualCard.locator('[data-testid="agent-elements-visual-display-status"]')).toHaveText('Rendered');

  const chart = visualCard.locator('[data-testid="agent-elements-visual-display-chart"]');
  await expect(chart).toBeVisible();
  await expect(chart).toHaveAttribute('data-chart-type', 'bar');
  await expect(chart).toContainText('Latency by phase');

  const gallery = visualCard.locator('[data-testid="agent-elements-visual-display-gallery"]');
  await expect(gallery).toBeVisible();
  await expect(gallery).toHaveAttribute('data-image-count', '2');
  await expect(gallery.locator('[data-testid="agent-elements-visual-display-image-loading"]')).toHaveCount(0);

  await gallery.locator('[data-testid="agent-elements-visual-display-image-card-0"]').click();
  const lightbox = page.locator('[data-testid="agent-elements-visual-display-lightbox"]');
  await expect(lightbox).toBeVisible();
  await expect(page.locator('[data-testid="agent-elements-visual-display-lightbox-count"]')).toHaveText('1 / 2');
  await page.locator('[data-testid="agent-elements-visual-display-lightbox-next"]').click();
  await expect(page.locator('[data-testid="agent-elements-visual-display-lightbox-count"]')).toHaveText('2 / 2');
  await expect(page.locator('[data-testid="agent-elements-visual-display-lightbox-caption"]')).toHaveText('After state');
  await page.locator('[data-testid="agent-elements-visual-display-lightbox-close"]').click();
  await expect(lightbox).toHaveCount(0);
});
