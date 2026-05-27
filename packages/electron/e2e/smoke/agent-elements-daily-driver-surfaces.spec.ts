import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ACTIVE_EDITOR_SELECTOR,
  ACTIVE_FILE_TAB_SELECTOR,
  createTempWorkspace,
  dismissProjectTrustToast,
  launchElectronApp,
  waitForAppReady,
} from '../helpers';
import {
  dismissAPIKeyDialog,
  createNewAgentSession,
  openFileFromTree,
  PLAYWRIGHT_TEST_SELECTORS,
  switchToAgentMode,
  switchToFilesMode,
} from '../utils/testHelpers';

test.describe.configure({ mode: 'serial' });

let electronApp: ElectronApplication;
let page: Page;
let workspacePath: string;

async function seedSmartyServerSettings(page: Page, workspacePath: string): Promise<void> {
  await page.evaluate(async ({ workspacePath }) => {
    const electronAPI = (window as any).electronAPI;
    const settings = await electronAPI.aiGetSettings();
    const runtimeHealth = {
      runtime: 'ready',
      workspace: { path: workspacePath },
      modelBackend: {
        backend: 'local',
        selectedModel: 'gpt-5.5',
      },
      cliProxy: {
        reachable: true,
      },
      langSmithTracing: {
        enabled: false,
      },
      localMode: {
        localOnly: true,
      },
      optionalCapabilities: [
        {
          id: 'browser',
          label: 'Browser tools',
          status: 'unavailable',
        },
      ],
      recovery: {
        cliProxy: 'CLIProxyAPI is optional for this local proof.',
      },
    };

    await electronAPI.aiSaveSettings({
      ...settings,
      providerSettings: {
        ...(settings.providerSettings || {}),
        'smarty-server': {
          ...(settings.providerSettings?.['smarty-server'] || {}),
          enabled: true,
          baseUrl: 'http://127.0.0.1:8788',
          defaultModel: 'smarty-server:smarty_coding_agent',
          testStatus: 'success',
          testMessage: 'Connected',
          runtimeHealth,
          runtimeHealthCheckedAt: '2026-05-26T00:00:00.000Z',
          lastSuccessfulRuntimeHealth: runtimeHealth,
          lastSuccessfulRuntimeHealthCheckedAt: '2026-05-26T00:00:00.000Z',
        },
      },
      apiKeys: {
        ...(settings.apiKeys || {}),
        'smarty-server': 'playwright-smarty-server-key',
      },
    });
  }, { workspacePath });
}

async function launchDailyDriverApp(): Promise<{ app: ElectronApplication; firstPage: Page }> {
  const app = await launchElectronApp({
    workspace: workspacePath,
    permissionMode: 'allow-all',
    recordVideo: false,
    env: {
      NIMBALYST_NO_FOCUS: '1',
      PLAYWRIGHT_TEST: 'true',
    },
  });
  const firstPage = await app.firstWindow();
  await waitForAppReady(firstPage);
  await dismissProjectTrustToast(firstPage);
  await dismissAPIKeyDialog(firstPage);
  return { app, firstPage };
}

async function ensureActiveAgentSession(page: Page): Promise<void> {
  await switchToAgentMode(page);

  const agentMode = page.locator(PLAYWRIGHT_TEST_SELECTORS.agentMode);
  const chatInput = page.locator(PLAYWRIGHT_TEST_SELECTORS.agentChatInput);
  if (await chatInput.isVisible({ timeout: 1500 }).catch(() => false)) {
    return;
  }

  const sessionItems = agentMode.locator(PLAYWRIGHT_TEST_SELECTORS.anySessionItem);
  if (await sessionItems.first().isVisible({ timeout: 1000 }).catch(() => false)) {
    await sessionItems.first().click();
  }

  if (!(await chatInput.isVisible({ timeout: 1500 }).catch(() => false))) {
    await createNewAgentSession(page);
  }

  await expect(chatInput).toBeVisible({ timeout: 5000 });
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.writeFile(path.join(workspacePath, 'README.md'), '# Daily Driver Proof\n\nAgent Elements surface proof.\n', 'utf8');
  await fs.mkdir(path.join(workspacePath, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspacePath, 'src', 'app.ts'), 'export const dailyDriver = true;\n', 'utf8');

  const seeded = await launchDailyDriverApp();
  await seedSmartyServerSettings(seeded.firstPage, workspacePath);
  await seeded.app.close();

  const relaunched = await launchDailyDriverApp();
  electronApp = relaunched.app;
  page = relaunched.firstPage;
});

test.afterAll(async () => {
  await electronApp?.close();
  await fs.rm(workspacePath, { recursive: true, force: true }).catch(() => undefined);
});

test('keeps primary daily-driver app surfaces on Agent Elements shells in a launched app', async () => {
  await expect(page.locator('[data-agent-elements-shell="navigation-gutter"]')).toBeVisible();
  await expect(page.locator(PLAYWRIGHT_TEST_SELECTORS.filesModeButton)).toHaveAttribute('data-agent-elements-shell', 'navigation-gutter-button');
  await expect(page.locator(PLAYWRIGHT_TEST_SELECTORS.agentModeButton)).toHaveAttribute('data-agent-elements-shell', 'navigation-gutter-button');

  await openFileFromTree(page, 'README.md');
  await expect(page.locator(ACTIVE_FILE_TAB_SELECTOR)).toContainText('README.md');
  await expect(page.locator(ACTIVE_FILE_TAB_SELECTOR).locator('..')).toHaveAttribute('data-agent-elements-shell', 'tab');
  await expect(page.locator(ACTIVE_EDITOR_SELECTOR)).toContainText('Daily Driver Proof');

  await ensureActiveAgentSession(page);
  await expect(page.locator('[data-testid="agent-elements-agent-mode"]')).toBeVisible();
  await expect(page.locator('[data-testid="agent-elements-agent-mode"]')).toHaveAttribute('data-agent-elements-shell', 'agent-mode');
  await expect(page.locator(PLAYWRIGHT_TEST_SELECTORS.sessionHistory)).toBeVisible();
  await expect(page.locator(PLAYWRIGHT_TEST_SELECTORS.agentChatInput)).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('terminal:show')));
  await expect(page.locator('[data-testid="agent-elements-terminal-bottom-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="agent-elements-terminal-bottom-panel"]')).toHaveAttribute('data-agent-elements-shell', 'terminal-bottom-panel');
  const emptyTerminalAction = page.locator('[data-testid="agent-elements-terminal-empty-new-tab"]');
  if (await emptyTerminalAction.isVisible().catch(() => false)) {
    await emptyTerminalAction.click();
  }
  await expect(page.locator('[data-testid="agent-elements-terminal-header"]')).toBeVisible();

  await page.locator('[data-testid="gutter-user-button"]').click();
  await expect(page.locator('[data-testid="user-menu-popover"]')).toBeVisible();
  await expect(page.locator('[data-testid="user-menu-popover"]')).toHaveAttribute('data-agent-elements-shell', 'user-menu-popover');
  await page.locator('[data-testid="user-menu-user-settings"]').click();

  await expect(page.locator('[data-testid="agent-elements-settings-view"]')).toBeVisible();
  await expect(page.locator('[data-testid="agent-elements-settings-sidebar"]')).toBeVisible();
  await expect(page.locator('[data-testid="agent-elements-settings-item-smarty-server"]')).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('[data-testid="agent-elements-smarty-server-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="agent-elements-smarty-server-panel"]')).toHaveAttribute('data-agent-elements-shell', 'smarty-server-panel');
  await expect(page.locator('[data-testid="agent-elements-smarty-server-connection-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="smarty-server-runtime-health"]')).toHaveAttribute('data-runtime', 'ready');
  await expect(page.locator('[data-testid="smarty-server-runtime-health"]')).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
  await expect(page.locator('[data-testid="smarty-server-runtime-health"]')).toHaveAttribute('data-agent-elements-card-width', 'section-row');
  await expect(page.locator('[data-testid="smarty-server-health-workspace"]')).toContainText(workspacePath);

  await page.locator('[data-testid="agent-elements-settings-scope-project"]').click();
  await expect(page.locator('[data-testid="agent-elements-settings-item-agent-permissions"]')).toBeVisible();
  await page.locator('[data-testid="agent-elements-settings-item-agent-permissions"]').click();
  await expect(page.locator('[data-testid="agent-elements-project-permissions-panel"]')).toBeVisible();

  await switchToFilesMode(page);
  await expect(page.locator(PLAYWRIGHT_TEST_SELECTORS.workspaceSidebar)).toBeVisible();
  await expect(page.locator('[data-testid="agent-elements-settings-view"]')).not.toBeVisible();
});
