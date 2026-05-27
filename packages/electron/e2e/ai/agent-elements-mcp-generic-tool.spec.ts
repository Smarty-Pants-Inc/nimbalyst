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

function toolResultMessage(toolId: string, result: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolId,
        content: [{ type: 'text', text: JSON.stringify(result) }],
      }],
    },
  });
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.writeFile(
    path.join(workspacePath, 'README.md'),
    '# Agent Elements MCP and generic proof\n',
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

test('renders MCP and generic structured tool results with Agent Elements chrome in the launched app', async () => {
  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Agent Elements MCP generic proof',
    provider: 'claude-code',
    model: 'claude-code:opus-1m',
  });

  await insertUserPrompt(page, sessionId, 'Render MCP and generic tool output.');

  const mcpToolId = `tool_mcp_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(mcpToolId, 'mcp__github__list_issues', {
      query: 'is:issue is:open label:agent-elements',
      limit: 2,
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(mcpToolId, {
      rows: [
        { title: 'Issue 42', status: 'open' },
        { title: 'Issue 43', status: 'triage' },
      ],
    }),
    { source: 'claude-code' },
  );

  const genericToolId = `tool_generic_${Date.now()}`;
  await insertMessage(
    page,
    sessionId,
    'output',
    toolUseMessage(genericToolId, 'workspace_summary', {
      includeFiles: true,
      includeStats: true,
    }),
    { source: 'claude-code' },
  );
  await insertMessage(
    page,
    sessionId,
    'input',
    toolResultMessage(genericToolId, {
      rows: [
        { title: 'Changed files', status: '3 modified' },
        { title: 'Proof harnesses', status: '2 launched' },
      ],
    }),
    { source: 'claude-code' },
  );

  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: 10_000 });
  await sessionItem.click();

  const transcript = page.locator('.rich-transcript-view');
  await expect(transcript).toBeVisible({ timeout: 10_000 });

  const mcpCard = page.locator('[data-testid="agent-elements-mcp-tool-card"]');
  await expect(mcpCard).toBeVisible({ timeout: 15_000 });
  await expect(mcpCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(mcpCard).toHaveAttribute('data-component', 'AgentMcpToolCard');
  await expect(mcpCard.locator('[data-testid="agent-elements-mcp-shell"]')).toContainText('github');
  await expect(mcpCard.locator('[data-testid="agent-elements-mcp-shell"]')).toContainText('list_issues');
  await expect(mcpCard.locator('[data-testid="agent-elements-mcp-args"]')).toContainText('agent-elements');
  await expect(mcpCard.locator('[data-testid="agent-elements-mcp-result"]')).toContainText('2 results: Issue 42 (open); Issue 43 (triage)');
  await expect(mcpCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"rows"');
  await expect(mcpCard.locator('[data-testid="agent-elements-debug-disclosure"]'))
    .toHaveAttribute('data-debug-only', 'true');

  const genericCard = page.locator('[data-testid="agent-elements-generic-tool-card"]');
  await expect(genericCard).toBeVisible({ timeout: 15_000 });
  await expect(genericCard).toHaveAttribute('data-tool-status', 'completed');
  await expect(genericCard).toHaveAttribute('data-component', 'AgentGenericToolCard');
  await expect(genericCard).toContainText('workspace_summary');
  await expect(genericCard.locator('[data-testid="agent-elements-generic-metadata"]')).toContainText('tool');
  await expect(genericCard.locator('[data-testid="agent-elements-generic-result"]')).toContainText(
    '2 results: Changed files (3 modified); Proof harnesses (2 launched)'
  );
  await expect(genericCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"includeFiles"');
  await expect(genericCard.locator('[data-testid="agent-elements-tool-primary"]')).not.toContainText('"rows"');

  const boundaries = page.locator('[data-testid="agent-elements-renderer-boundary"]');
  await expect(boundaries.nth(0)).toHaveAttribute('data-renderer-kind', 'mcp');
  await expect(boundaries.nth(1)).toHaveAttribute('data-renderer-kind', 'genericTool');
  await expect(page.locator('[data-testid="agent-elements-transcript-row"]').first())
    .toHaveAttribute('data-agent-align', 'left');
});
