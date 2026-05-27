import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createTempWorkspace,
  launchElectronApp,
  TEST_TIMEOUTS,
  waitForAppReady,
} from '../helpers';
import {
  cleanupTestSessions,
  createTestSession,
  insertUserPrompt,
} from '../utils/interactivePromptTestHelpers';
import { switchToAgentMode } from '../utils/testHelpers';

test.describe.configure({ mode: 'serial' });

let electronApp: ElectronApplication;
let page: Page;
let workspacePath: string;

async function addSessionFileLink(
  page: Page,
  sessionId: string,
  filePath: string,
  operation: 'create' | 'edit',
): Promise<void> {
  const result = await page.evaluate(
    async ({ sessionId, workspacePath, filePath, operation }) => {
      return await (window as any).electronAPI.invoke(
        'session-files:add-link',
        sessionId,
        workspacePath,
        filePath,
        'edited',
        {
          operation,
          linesAdded: operation === 'create' ? 8 : 3,
          linesRemoved: operation === 'create' ? 0 : 1,
          source: 'agent-elements-e2e',
        },
      );
    },
    { sessionId, workspacePath, filePath, operation },
  );

  expect(result.success, result.error).toBe(true);
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.mkdir(path.join(workspacePath, 'src'), { recursive: true });
  await fs.mkdir(path.join(workspacePath, 'docs'), { recursive: true });
  await fs.writeFile(
    path.join(workspacePath, 'README.md'),
    '# Agent Elements Files Edited proof\n',
    'utf8',
  );
  await fs.writeFile(
    path.join(workspacePath, 'src', 'agent.ts'),
    'export const status = "initial";\n',
    'utf8',
  );

  execSync('git init', { cwd: workspacePath, stdio: 'pipe' });
  execSync('git config user.email "test@example.com"', { cwd: workspacePath, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: workspacePath, stdio: 'pipe' });
  execSync('git add .', { cwd: workspacePath, stdio: 'pipe' });
  execSync('git commit -m "Initial commit"', { cwd: workspacePath, stdio: 'pipe' });

  await fs.writeFile(
    path.join(workspacePath, 'src', 'agent.ts'),
    [
      'export const status = "edited";',
      'export const checklist = ["render", "select", "peek"];',
      '',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(workspacePath, 'docs', 'agent-notes.md'),
    '# Agent notes\n\n- Files Edited should render as Agent Elements chrome.\n',
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
  await switchToAgentMode(page);
});

test.afterAll(async () => {
  if (page) {
    await cleanupTestSessions(page, workspacePath);
  }
  await electronApp?.close();
  await fs.rm(workspacePath, { recursive: true, force: true }).catch(() => undefined);
});

test('renders session Files Edited rows with Agent Elements sidebar chrome in the launched app', async () => {
  const editedPath = path.join(workspacePath, 'src', 'agent.ts');
  const createdPath = path.join(workspacePath, 'docs', 'agent-notes.md');

  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Agent Elements Files Edited proof',
    provider: 'smarty-server',
    model: 'smarty-server:smarty_coding_agent',
  });

  await insertUserPrompt(page, sessionId, 'Show the files edited by this agent run.');
  await addSessionFileLink(page, sessionId, editedPath, 'edit');
  await addSessionFileLink(page, sessionId, createdPath, 'create');

  await expect
    .poll(async () => {
      return await page.evaluate(async ({ sessionId }) => {
        const result = await (window as any).electronAPI.invoke(
          'session-files:get-by-session',
          sessionId,
          'edited',
        );
        return result?.files?.length ?? 0;
      }, { sessionId });
    }, { timeout: TEST_TIMEOUTS.MEDIUM })
    .toBe(2);

  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: TEST_TIMEOUTS.MEDIUM });
  await sessionItem.click();

  const agentModeSidebar = page.locator('[data-testid="agent-elements-agent-mode-files-edited-sidebar"]');
  await expect(agentModeSidebar).toBeVisible({ timeout: TEST_TIMEOUTS.VERY_LONG });
  await expect(agentModeSidebar).toHaveAttribute('data-agent-elements-shell', 'agent-mode-files-edited');
  await expect(agentModeSidebar.locator('[data-testid="agent-elements-files-edited-header"]'))
    .toHaveAttribute('data-agent-elements-shell', 'files-edited-header');
  await expect(agentModeSidebar.locator('[data-testid="agent-elements-files-edited-content"]'))
    .toHaveAttribute('data-agent-elements-shell', 'files-edited-content');

  const runtimeSidebar = agentModeSidebar.locator('[data-testid="agent-elements-files-edited-sidebar"]');
  await expect(runtimeSidebar).toBeVisible({ timeout: TEST_TIMEOUTS.VERY_LONG });
  await expect(runtimeSidebar).toHaveAttribute('data-agent-elements-shell', 'files-edited');

  const rows = runtimeSidebar.locator('[data-testid="files-edited-file-row"]');
  await expect(rows).toHaveCount(2, { timeout: TEST_TIMEOUTS.VERY_LONG });

  const editedRow = rows.filter({ hasText: 'agent.ts' });
  await expect(editedRow).toHaveAttribute('data-agent-elements-shell', 'file-row');
  await expect(editedRow).toHaveAttribute('data-file-operation', 'edit');
  await expect(editedRow.locator('[data-testid="files-edited-file-status"]')).toHaveText('Edited');
  await expect(editedRow.locator('[data-testid="files-edited-file-checkbox"]')).toBeVisible();
  await expect(editedRow.locator('[data-testid="files-edited-file-peek"]')).toBeVisible();

  const createdRow = rows.filter({ hasText: 'agent-notes.md' });
  await expect(createdRow).toHaveAttribute('data-file-operation', 'create');
  await expect(createdRow.locator('[data-testid="files-edited-file-status"]')).toHaveText('Created');
  await expect(createdRow.locator('[data-testid="files-edited-file-checkbox"]')).toBeVisible();

  await expect(runtimeSidebar.locator('[data-testid="files-edited-select-all"]')).toBeVisible();
});
