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

function toolResultMessage(toolId: string, text: string): string {
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
  await fs.writeFile(
    path.join(workspacePath, 'README.md'),
    '# Agent Elements session metadata proof\n',
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

test('renders session metadata tool updates with Agent Elements chrome in the launched app', async () => {
  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Agent Elements session meta proof',
    provider: 'claude-code',
    model: 'claude-code:opus-1m',
  });

  await insertUserPrompt(page, sessionId, 'Update the session metadata.');

  const metaToolId = `tool_session_meta_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(metaToolId, 'mcp__nimbalyst-session-naming__update_session_meta', {
      name: 'Implementation pass',
      add: ['agent-elements'],
      remove: ['old'],
      phase: 'implementing',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(metaToolId, JSON.stringify({
      summary: 'Set name, changed phase, updated tags',
      before: {
        name: 'Planning pass',
        tags: ['old', 'ux'],
        phase: 'planning',
      },
      after: {
        name: 'Implementation pass',
        tags: ['ux', 'agent-elements'],
        phase: 'implementing',
      },
    })),
    { source: 'claude-code' },
  );

  const legacyToolId = `tool_session_meta_legacy_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(legacyToolId, 'name_session', {
      name: 'Legacy session title',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(legacyToolId, 'Session named: Legacy session title'),
    { source: 'claude-code' },
  );

  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: 10_000 });
  await sessionItem.click();

  const transcript = page.locator('.rich-transcript-view');
  await expect(transcript).toBeVisible({ timeout: 10_000 });

  const metaCards = page.locator('[data-testid="agent-elements-session-meta-card"]');
  await expect(metaCards).toHaveCount(2, { timeout: 15_000 });

  const structuredCard = metaCards.filter({ hasText: 'Implementation pass' }).first();
  await expect(structuredCard).toBeVisible();
  await expect(structuredCard).toHaveAttribute('data-agent-elements-shell', 'session-meta-card');
  await expect(structuredCard).toHaveAttribute('data-component', 'RichTranscriptAgentElementsSessionMeta');
  await expect(structuredCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(structuredCard.locator('[data-testid="agent-elements-session-meta-body"]'))
    .toHaveAttribute('data-agent-elements-shell', 'session-meta-body');
  await expect(structuredCard.locator('[data-testid="agent-elements-session-meta-name"]')).toContainText('Planning pass');
  await expect(structuredCard.locator('[data-testid="agent-elements-session-meta-name"]')).toContainText('Implementation pass');
  await expect(structuredCard.locator('[data-testid="agent-elements-session-meta-phase"]')).toContainText('planning');
  await expect(structuredCard.locator('[data-testid="agent-elements-session-meta-phase"]')).toContainText('implementing');
  await expect(structuredCard.locator('[data-testid="agent-elements-session-meta-tag-added-agent-elements"]'))
    .toHaveAttribute('data-session-meta-tag-state', 'added');
  await expect(structuredCard.locator('[data-testid="agent-elements-session-meta-tag-removed-old"]'))
    .toHaveAttribute('data-session-meta-tag-state', 'removed');
  await expect(structuredCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"before"');
  await expect(structuredCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"after"');

  const legacyCard = metaCards.filter({ hasText: 'Legacy result' }).first();
  await expect(legacyCard).toBeVisible();
  await expect(legacyCard).toHaveAttribute('data-agent-elements-shell', 'session-meta-card');
  await expect(legacyCard.locator('[data-testid="agent-elements-session-meta-body"]')).toContainText(
    'Session named: Legacy session title'
  );

  await expect(page.locator('[data-testid="agent-elements-transcript-row"]').first())
    .toHaveAttribute('data-agent-align', 'left');
});
