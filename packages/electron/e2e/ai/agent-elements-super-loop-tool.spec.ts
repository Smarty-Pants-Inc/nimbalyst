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
    '# Agent Elements Super Loop proof\n',
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

test('renders Super Loop progress widgets with Agent Elements chrome in the launched app', async () => {
  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Agent Elements Super Loop proof',
    provider: 'claude-code',
    model: 'claude-code:opus-1m',
  });

  await insertUserPrompt(page, sessionId, 'Show Super Loop progress.');

  const snapshotToolId = `tool_super_snapshot_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(snapshotToolId, 'SuperProgressSnapshot', {
      timing: 'iteration-end',
      iterationNumber: 3,
      superLoopId: 'super-loop-agent-elements',
      capturedAt: Date.now(),
      progress: {
        currentIteration: 3,
        phase: 'building',
        status: 'blocked',
        completionSignal: false,
        userFeedback: 'Keep the transcript compact.',
        blockers: ['Need launched proof for custom widgets.'],
        learnings: [{
          iteration: 3,
          summary: 'Session metadata cards render without raw JSON.',
          filesChanged: ['packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/UpdateSessionMetaWidget.tsx'],
        }],
      },
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(snapshotToolId, 'Captured Super Loop progress snapshot'),
    { source: 'claude-code' },
  );

  const updateToolId = `tool_super_update_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(updateToolId, 'super_loop_progress_update', {
      phase: 'building',
      status: 'completed',
      completionSignal: true,
      currentIteration: 4,
      blockers: [],
      learnings: [{
        iteration: 4,
        summary: 'Launched proofs can reuse the Claude Code raw-row fixture pattern.',
        filesChanged: ['packages/electron/e2e/ai/agent-elements-super-loop-tool.spec.ts'],
      }],
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(updateToolId, 'Recorded Super Loop progress update'),
    { source: 'claude-code' },
  );

  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: 10_000 });
  await sessionItem.click();

  const transcript = page.locator('.rich-transcript-view');
  await expect(transcript).toBeVisible({ timeout: 10_000 });

  const snapshotCard = page.locator('[data-testid="agent-elements-super-progress-snapshot-card"]');
  await expect(snapshotCard).toBeVisible({ timeout: 15_000 });
  await expect(snapshotCard).toHaveAttribute('data-agent-elements-shell', 'super-progress-snapshot-card');
  await expect(snapshotCard).toHaveAttribute('data-component', 'RichTranscriptAgentElementsSuperProgressSnapshot');
  await expect(snapshotCard).toHaveAttribute('data-tool-status', 'interrupted');
  await expect(snapshotCard.locator('[data-testid="agent-elements-super-progress-snapshot-body"]'))
    .toHaveAttribute('data-agent-elements-shell', 'super-progress-snapshot-body');
  await expect(snapshotCard.locator('[data-testid="agent-elements-super-progress-snapshot-phase"]')).toContainText('building');
  await expect(snapshotCard.locator('[data-testid="agent-elements-super-progress-snapshot-status"]')).toContainText('blocked');
  await expect(snapshotCard.locator('[data-testid="agent-elements-super-progress-snapshot-feedback"]'))
    .toContainText('Keep the transcript compact.');
  await expect(snapshotCard.locator('[data-testid="agent-elements-super-progress-snapshot-blocker-0"]'))
    .toContainText('Need launched proof for custom widgets.');
  await expect(snapshotCard.locator('[data-testid="agent-elements-super-progress-snapshot-learning-0"]'))
    .toContainText('Session metadata cards render without raw JSON.');
  await expect(snapshotCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"superLoopId"');
  await expect(snapshotCard.locator('[data-testid="agent-elements-debug-disclosure"]'))
    .toHaveAttribute('data-debug-only', 'true');

  const updateCard = page.locator('[data-testid="agent-elements-super-loop-progress-card"]');
  await expect(updateCard).toBeVisible({ timeout: 15_000 });
  await expect(updateCard).toHaveAttribute('data-agent-elements-shell', 'super-loop-progress-card');
  await expect(updateCard).toHaveAttribute('data-component', 'RichTranscriptAgentElementsSuperLoopProgress');
  await expect(updateCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(updateCard.locator('[data-testid="agent-elements-super-loop-progress-body"]'))
    .toHaveAttribute('data-agent-elements-shell', 'super-loop-progress-body');
  await expect(updateCard.locator('[data-testid="agent-elements-super-loop-progress-phase"]')).toContainText('building');
  await expect(updateCard.locator('[data-testid="agent-elements-super-loop-progress-status"]')).toContainText('completed');
  await expect(updateCard.locator('[data-testid="agent-elements-super-loop-progress-completion"]')).toContainText('complete');
  await expect(updateCard.locator('[data-testid="agent-elements-super-loop-progress-learning"]'))
    .toContainText('Launched proofs can reuse the Claude Code raw-row fixture pattern.');
  await expect(updateCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"learnings"');

  await expect(page.locator('[data-testid="agent-elements-transcript-row"]').first())
    .toHaveAttribute('data-agent-align', 'left');
});
