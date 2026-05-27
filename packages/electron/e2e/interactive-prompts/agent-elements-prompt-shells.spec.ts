import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
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
  insertMessage,
  insertPendingAskUserQuestion,
  insertPendingToolPermission,
  insertUserPrompt,
  INTERACTIVE_PROMPT_SELECTORS,
} from '../utils/interactivePromptTestHelpers';
import { switchToAgentMode } from '../utils/testHelpers';

test.describe.configure({ mode: 'serial' });

let electronApp: ElectronApplication;
let page: Page;
let workspacePath: string;

async function expectAgentElementsShell(locator: ReturnType<Page['locator']>, shell: string): Promise<void> {
  await expect(locator).toBeVisible({ timeout: TEST_TIMEOUTS.VERY_LONG });
  await expect(locator).toHaveAttribute('data-agent-elements-shell', shell);
  await expect(locator).toHaveClass(/agent-elements-tool-card/);
  await expect(locator.locator('.agent-elements-tool-primary')).toBeVisible();
}

async function insertNimbalystToolUse(
  page: Page,
  sessionId: string,
  id: string,
  name: string,
  input: Record<string, unknown>,
): Promise<void> {
  await insertMessage(
    page,
    sessionId,
    'output',
    JSON.stringify({ type: 'nimbalyst_tool_use', id, name, input }),
    { source: 'claude-code' },
  );
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.writeFile(
    path.join(workspacePath, 'README.md'),
    '# Agent Elements prompt shell proof\n',
    'utf8',
  );
  await fs.mkdir(path.join(workspacePath, 'docs'), { recursive: true });
  await fs.writeFile(
    path.join(workspacePath, 'docs', 'plan.md'),
    '# Plan\n\n- Keep prompt shells readable.\n',
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

test('renders durable prompt and approval rows with Agent Elements shells in the launched app', async () => {
  const sessionId = await createTestSession(page, workspacePath, {
    title: 'Agent Elements prompt shell proof',
    provider: 'smarty-server',
    model: 'smarty-server:smarty_coding_agent',
  });

  await insertUserPrompt(page, sessionId, 'Render every durable prompt shell.');
  await insertPendingAskUserQuestion(page, sessionId, [{
    question: 'Which review lane should run next?',
    header: 'Review Lane',
    options: [
      { label: 'Thermo', description: 'Run maintainability review' },
      { label: 'Launch', description: 'Run launched Electron proof' },
    ],
    multiSelect: false,
  }]);
  await insertNimbalystToolUse(page, sessionId, 'prompt-shell-rui-1', 'PromptForUserInput', {
    title: 'Select validation lanes',
    intro: 'Choose the proof lanes to run before closing this slice.',
    fields: [
      {
        type: 'multiSelect',
        id: 'lanes',
        label: 'Validation lanes',
        items: [
          { id: 'focused', title: 'Focused E2E', subtitle: 'Launched app prompt shell proof', defaultChecked: true },
          { id: 'typecheck', title: 'Typecheck', subtitle: 'Electron workspace types' },
        ],
      },
    ],
  });
  await insertPendingToolPermission(
    page,
    sessionId,
    'Bash',
    'git diff --check',
    'Bash(git diff:*)',
    { warnings: ['Review before approving shell commands.'] },
  );
  await insertNimbalystToolUse(page, sessionId, 'prompt-shell-exit-plan-1', 'ExitPlanMode', {
    planFilePath: path.join(workspacePath, 'docs', 'plan.md'),
  });

  await page.waitForTimeout(1000);
  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await expect(sessionItem).toBeVisible({ timeout: TEST_TIMEOUTS.MEDIUM });
  await sessionItem.click();

  const transcript = page.locator('.rich-transcript-view');
  await expect(transcript).toBeVisible({ timeout: TEST_TIMEOUTS.VERY_LONG });

  const askQuestion = page.locator(INTERACTIVE_PROMPT_SELECTORS.askUserQuestionWidget);
  await expectAgentElementsShell(askQuestion, 'question-card');
  await expect(askQuestion).toHaveAttribute('data-state', 'pending');
  await expect(askQuestion.locator(INTERACTIVE_PROMPT_SELECTORS.askUserQuestionOption)).toHaveCount(2);
  await expect(askQuestion.locator(INTERACTIVE_PROMPT_SELECTORS.askUserQuestionSubmitButton)).toBeDisabled();

  const requestInput = page.locator(INTERACTIVE_PROMPT_SELECTORS.requestUserInputWidget);
  await expectAgentElementsShell(requestInput, 'input-card');
  await expect(requestInput).toHaveAttribute('data-state', 'pending');
  await expect(requestInput.locator(INTERACTIVE_PROMPT_SELECTORS.requestUserInputMultiSelectRow)).toHaveCount(2);
  await expect(requestInput.locator(INTERACTIVE_PROMPT_SELECTORS.requestUserInputSubmitButton)).toBeEnabled();

  const toolPermission = page.locator(INTERACTIVE_PROMPT_SELECTORS.toolPermissionWidget);
  await expectAgentElementsShell(toolPermission, 'approval-card');
  await expect(toolPermission).toHaveAttribute('data-approval-state', 'pending');
  await expect(toolPermission.locator(INTERACTIVE_PROMPT_SELECTORS.toolPermissionDenyButton)).toBeVisible();
  await expect(toolPermission.locator(INTERACTIVE_PROMPT_SELECTORS.toolPermissionAllowOnceButton)).toBeVisible();
  await expect(toolPermission.locator('[data-testid="tool-permission-command"]')).toContainText('git diff --check');

  const exitPlan = page.locator(INTERACTIVE_PROMPT_SELECTORS.exitPlanModeWidget);
  await expectAgentElementsShell(exitPlan, 'plan-approval-card');
  await expect(exitPlan).toHaveAttribute('data-exit-plan-state', 'pending');
  await expect(exitPlan.locator(INTERACTIVE_PROMPT_SELECTORS.exitPlanModeApproveButton)).toBeVisible();
  await expect(exitPlan.locator(INTERACTIVE_PROMPT_SELECTORS.exitPlanModeDenyButton)).toBeVisible();
  await expect(exitPlan).toContainText('docs/plan.md');
});
