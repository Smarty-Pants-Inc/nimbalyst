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

function toolResultMessage(
  toolId: string,
  result: Record<string, unknown> | string,
  options: { isError?: boolean } = {},
): string {
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  return JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolId,
        content: [{ type: 'text', text }],
        ...(options.isError ? { is_error: true } : {}),
      }],
    },
  });
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.writeFile(
    path.join(workspacePath, 'README.md'),
    '# Agent Elements tracker tool proof\n',
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

test('renders tracker tool variants with Agent Elements chrome in the launched app', async () => {
  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Agent Elements tracker proof',
    provider: 'claude-code',
    model: 'claude-code:opus-1m',
  });

  await insertUserPrompt(page, sessionId, 'Create and update tracker items.');

  const createToolId = `tool_tracker_create_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(createToolId, 'tracker_create', {
      type: 'task',
      title: 'Replace tracker transcript chrome',
      tags: ['agent-elements'],
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(createToolId, {
      structured: {
        action: 'created',
        item: {
          id: 'task_agent_elements_tracker',
          type: 'task',
          typeTags: ['task', 'daily-driver'],
          title: 'Replace tracker transcript chrome',
          status: 'active',
          priority: 'high',
          tags: ['agent-elements', 'transcript'],
          owner: 'Daily Driver',
        },
      },
      summary: 'Created tracker item',
    }),
    { source: 'claude-code' },
  );

  const updateToolId = `tool_tracker_update_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(updateToolId, 'tracker_update', {
      id: 'bug_agent_elements_tracker',
      status: 'in-progress',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(updateToolId, {
      structured: {
        action: 'updated',
        id: 'bug_agent_elements_tracker',
        type: 'bug',
        typeTags: ['bug'],
        title: 'Fix tracker widget spacing',
        changes: {
          status: { from: 'to-do', to: 'in-progress' },
          priority: { from: 'medium', to: 'high' },
          tags: { from: 'alpha, beta', to: ['beta', 'gamma'] },
        },
      },
      summary: 'Updated tracker item',
    }),
    { source: 'claude-code' },
  );

  const listToolId = `tool_tracker_list_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(listToolId, 'tracker_list', {
      type: 'bug',
      status: 'active',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(listToolId, {
      structured: {
        action: 'listed',
        filters: { type: 'bug', status: 'active' },
        count: 2,
        items: [
          {
            id: 'bug_agent_elements_list_one',
            type: 'bug',
            typeTags: ['bug', 'ui'],
            title: 'Tracker list row uses Agent Elements chrome',
            status: 'active',
            priority: 'critical',
          },
          {
            id: 'task_agent_elements_list_two',
            type: 'task',
            title: 'Verify tracker list rows stay compact',
            status: 'triage',
            priority: 'medium',
          },
        ],
      },
      summary: 'Listed tracker items',
    }),
    { source: 'claude-code' },
  );

  const getToolId = `tool_tracker_get_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(getToolId, 'tracker_get', {
      id: 'decision_agent_elements_get',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(getToolId, {
      structured: {
        action: 'retrieved',
        item: {
          id: 'decision_agent_elements_get',
          type: 'decision',
          typeTags: ['decision', 'design'],
          title: 'Use Agent Elements tracker renderer',
          status: 'done',
          priority: 'high',
          tags: ['agent-elements', 'tracker'],
          owner: 'Paul',
        },
      },
      summary: 'Retrieved tracker item',
    }),
    { source: 'claude-code' },
  );

  const linkSessionToolId = `tool_tracker_link_session_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(linkSessionToolId, 'tracker_link_session', {
      trackerId: 'task_agent_elements_tracker',
      sessionId,
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(linkSessionToolId, {
      structured: {
        action: 'linked',
        trackerId: 'task_agent_elements_tracker',
        type: 'task',
        title: 'Replace tracker transcript chrome',
        linkedCount: 3,
      },
      summary: 'Linked session to tracker item',
    }),
    { source: 'claude-code' },
  );

  const linkFileToolId = `tool_tracker_link_file_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(linkFileToolId, 'tracker_link_file', {
      filePath: 'packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/TrackerToolWidget.tsx',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(linkFileToolId, {
      structured: {
        action: 'linked_file',
        filePath: 'packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/TrackerToolWidget.tsx',
        linkedCount: 4,
      },
      summary: 'Linked file to tracker context',
    }),
    { source: 'claude-code' },
  );

  const pendingToolId = `tool_tracker_pending_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(pendingToolId, 'tracker_get', {
      id: 'bug_agent_elements_pending',
    }),
    { source: 'claude-code' },
  );

  const errorToolId = `tool_tracker_error_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(errorToolId, 'tracker_update', {
      id: 'bug_agent_elements_error',
      status: 'closed',
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(errorToolId, 'Tracker item not found: bug_agent_elements_error', { isError: true }),
    { source: 'claude-code' },
  );

  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: 10_000 });
  await sessionItem.click();

  const transcript = page.locator('.rich-transcript-view');
  await expect(transcript).toBeVisible({ timeout: 10_000 });

  const trackerCards = page.locator('[data-testid="agent-elements-tracker-tool-card"]');
  await expect(trackerCards).toHaveCount(8, { timeout: 15_000 });

  const createdCard = trackerCards.filter({ hasText: 'Replace tracker transcript chrome' }).first();
  await expect(createdCard).toBeVisible();
  await expect(createdCard).toHaveAttribute('data-agent-elements-shell', 'tracker-tool-card');
  await expect(createdCard).toHaveAttribute('data-component', 'RichTranscriptAgentElementsTrackerTool');
  await expect(createdCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(createdCard.locator('[data-testid="agent-elements-tracker-tool-type"]')).toContainText('daily-driver');
  await expect(createdCard.locator('[data-testid="agent-elements-tracker-tool-title"]')).toContainText('Replace tracker transcript chrome');
  await expect(createdCard.locator('[data-testid="agent-elements-tracker-tool-status"]')).toContainText('active');
  await expect(createdCard.locator('[data-testid="agent-elements-tracker-tool-priority"]')).toContainText('high');
  await expect(createdCard.locator('[data-testid="agent-elements-tracker-tool-tag-0"]')).toContainText('agent-elements');
  await expect(createdCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"structured"');
  await expect(createdCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"tags"');

  const updatedCard = trackerCards.filter({ hasText: 'Fix tracker widget spacing' }).first();
  await expect(updatedCard).toBeVisible();
  await expect(updatedCard).toHaveAttribute('data-agent-elements-shell', 'tracker-tool-card');
  await expect(updatedCard).toContainText('Tracker Updated');
  await expect(updatedCard.locator('[data-testid="agent-elements-tracker-tool-status"]')).toContainText('in-progress');
  await expect(updatedCard.locator('[data-testid="agent-elements-tracker-tool-priority"]')).toContainText('high');
  await expect(updatedCard).toContainText('#alpha');
  await expect(updatedCard).toContainText('#beta');
  await expect(updatedCard).toContainText('#gamma');
  await expect(updatedCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"structured"');
  await expect(updatedCard.locator('[data-testid="agent-elements-debug-disclosure"]'))
    .toHaveAttribute('data-debug-only', 'true');

  const listedCard = trackerCards.filter({ hasText: 'Tracker list row uses Agent Elements chrome' }).first();
  await expect(listedCard).toBeVisible();
  await expect(listedCard).toContainText('Tracker List');
  await expect(listedCard.locator('[data-testid="agent-elements-tracker-tool-count"]')).toContainText('2 items');
  await expect(listedCard.locator('[data-testid="agent-elements-tracker-tool-item-0"]')).toContainText('critical');
  await expect(listedCard.locator('[data-testid="agent-elements-tracker-tool-item-1"]')).toContainText('triage');
  await expect(listedCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"items"');

  const retrievedCard = trackerCards.filter({ hasText: 'Use Agent Elements tracker renderer' }).first();
  await expect(retrievedCard).toBeVisible();
  await expect(retrievedCard).toContainText('Tracker Item');
  await expect(retrievedCard.locator('[data-testid="agent-elements-tracker-tool-type"]')).toContainText('design');
  await expect(retrievedCard.locator('[data-testid="agent-elements-tracker-tool-status"]')).toContainText('done');
  await expect(retrievedCard.locator('[data-testid="agent-elements-tracker-tool-tag-0"]')).toContainText('agent-elements');
  await expect(retrievedCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"item"');

  const linkedCard = trackerCards.filter({ hasText: 'Tracker Linked' }).first();
  await expect(linkedCard).toBeVisible();
  await expect(linkedCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(linkedCard).toContainText('Replace tracker transcript chrome');
  await expect(linkedCard).toContainText('3 sessions');
  await expect(linkedCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"trackerId"');

  const fileLinkedCard = trackerCards.filter({ hasText: 'File Linked' }).first();
  await expect(fileLinkedCard).toBeVisible();
  await expect(fileLinkedCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(fileLinkedCard).toContainText('TrackerToolWidget.tsx');
  await expect(fileLinkedCard).toContainText('4 total links');
  await expect(fileLinkedCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"filePath"');

  const pendingCard = trackerCards.filter({ hasText: 'Waiting for tracker result...' }).first();
  await expect(pendingCard).toBeVisible();
  await expect(pendingCard).toHaveAttribute('data-tool-status', 'running');

  const errorCard = trackerCards.filter({ hasText: 'Tracker item not found: bug_agent_elements_error' }).first();
  await expect(errorCard).toBeVisible();
  await expect(errorCard).toHaveAttribute('data-tool-status', 'error');
  await expect(errorCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('is_error');

  await expect(page.locator('[data-testid="agent-elements-transcript-row"]').first())
    .toHaveAttribute('data-agent-align', 'left');

  await page.evaluate(() => {
    (window as any).__trackerNavigateEvent = null;
    window.addEventListener('nimbalyst:navigate-tracker-item', (event) => {
      (window as any).__trackerNavigateEvent = (event as CustomEvent).detail;
    }, { once: true });
  });
  await createdCard.getByRole('button', { name: 'Replace tracker transcript chrome' }).click();
  await expect.poll(async () => page.evaluate(() => (window as any).__trackerNavigateEvent?.itemId))
    .toBe('task_agent_elements_tracker');
});
