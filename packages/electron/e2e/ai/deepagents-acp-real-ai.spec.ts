/**
 * Real-AI DeepAgents ACP E2E smoke.
 *
 * Gate: requires RUN_REAL_DEEPAGENTS_ACP=1 and explicit CLIProxyAPI settings
 * supplied to the Playwright process. The app receives those values through
 * Nimbalyst settings only; they are not inherited as provider env fallbacks.
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page, Locator } from '@playwright/test';
import {
  launchElectronApp,
  createTempWorkspace,
  waitForAppReady,
  dismissProjectTrustToast,
} from '../helpers';
import {
  PLAYWRIGHT_TEST_SELECTORS,
  switchToAgentMode,
  submitChatPrompt,
} from '../utils/testHelpers';
import * as fs from 'fs/promises';
import * as path from 'path';

test.skip(
  () => process.env.RUN_REAL_DEEPAGENTS_ACP !== '1',
  'Requires live CLIProxyAPI + RUN_REAL_DEEPAGENTS_ACP=1',
);

test.skip(
  () => !process.env.NIMBALYST_E2E_CLI_PROXY_API_KEY,
  'Requires NIMBALYST_E2E_CLI_PROXY_API_KEY for explicit settings injection',
);

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

let electronApp: ElectronApplication;
let page: Page;
let workspacePath: string;

async function waitForTurnComplete(panel: Locator): Promise<void> {
  const cancelButton = panel.locator('.ai-chat-cancel-button');
  await expect(cancelButton).toBeVisible({ timeout: 30_000 });
  await expect(cancelButton).toHaveCount(0, { timeout: 120_000 });
}

test.beforeAll(async () => {
  workspacePath = await createTempWorkspace();
  await fs.writeFile(
    path.join(workspacePath, 'README.md'),
    '# DeepAgents ACP smoke\n\nSeed file.\n',
    'utf8',
  );

  electronApp = await launchElectronApp({
    workspace: workspacePath,
    permissionMode: 'allow-all',
    env: {
      PLAYWRIGHT_TEST: 'true',
      NIMBALYST_NO_FOCUS: '1',
      NIMBALYST_E2E_CLI_PROXY_BASE_URL: '',
      NIMBALYST_E2E_CLI_PROXY_API_KEY: '',
    },
  });
  page = await electronApp.firstWindow();
  await waitForAppReady(page);
  await dismissProjectTrustToast(page);
});

test.afterAll(async () => {
  await electronApp?.close();
  await fs.rm(workspacePath, { recursive: true, force: true }).catch(() => undefined);
});

test('DeepAgents ACP model picker, prompt, edit tracking, and cancel smoke', async () => {
  const baseUrl = process.env.NIMBALYST_E2E_CLI_PROXY_BASE_URL || 'http://127.0.0.1:8317/v1';
  const apiKey = process.env.NIMBALYST_E2E_CLI_PROXY_API_KEY!;

  await page.evaluate(
    async ({ baseUrl, apiKey }) => {
      const electronAPI = (window as any).electronAPI;
      await electronAPI.invoke('ai:saveSettings', {
        providerSettings: {
          'deepagents-acp': { enabled: true, baseUrl },
        },
        apiKeys: {
          'deepagents-acp': apiKey,
        },
      });
    },
    { baseUrl, apiKey },
  );

  await switchToAgentMode(page);
  const sessionPanel = page.locator(PLAYWRIGHT_TEST_SELECTORS.activeSession);
  await expect(sessionPanel).toBeVisible({ timeout: 10_000 });

  const modelPicker = sessionPanel.locator('[data-testid="model-picker"]');
  await expect(modelPicker).toBeVisible({ timeout: 10_000 });
  await modelPicker.click();

  const deepAgentsOption = page
    .locator('.model-selector-provider-group', { hasText: 'DeepAgents' })
    .locator('.model-selector-option', { hasText: /GPT 5\.4 Mini|GPT 5\.4|GPT 5\.5/i })
    .first();
  await expect(deepAgentsOption).toBeVisible({ timeout: 20_000 });
  await deepAgentsOption.click();
  await expect(modelPicker).toContainText(/GPT 5\.4 Mini|GPT 5\.4|GPT 5\.5/i, { timeout: 5_000 });

  await submitChatPrompt(
    page,
    'Reply exactly OK. Do not read files. Do not write files. Do not use tools.',
  );
  await waitForTurnComplete(sessionPanel);
  await expect(sessionPanel.getByText(/\bOK\b/).last()).toBeVisible({ timeout: 10_000 });

  const targetFileName = 'deepagents-acp-smoke.txt';
  const targetPath = path.join(workspacePath, targetFileName);
  const expectedContent = 'deepagents acp wrote this through nimbalyst';
  await fs.rm(targetPath, { force: true });

  await submitChatPrompt(
    page,
    `Create a file at the absolute path \`${targetPath}\` with exactly this content: ${expectedContent}\nAfter writing, reply exactly done.`,
  );
  await waitForTurnComplete(sessionPanel);

  await expect.poll(
    async () => fs.readFile(targetPath, 'utf8').catch(() => ''),
    { timeout: 30_000, message: 'DeepAgents ACP did not create the smoke file' },
  ).toContain(expectedContent);

  await expect.poll(
    async () =>
      page.evaluate(async () => {
        const electronAPI = (window as any).electronAPI;
        const sessions = await electronAPI.aiGetSessions();
        const sid = sessions?.[0]?.id;
        if (!sid) return [];
        const result = await electronAPI.invoke('session-files:get-by-session', sid, 'edited');
        return (result?.files ?? []).map((file: any) => file.filePath ?? file.file_path);
      }),
    { timeout: 60_000, message: 'session-files tracker did not register DeepAgents ACP edit' },
  ).toEqual(expect.arrayContaining([expect.stringContaining(targetFileName)]));

  await submitChatPrompt(
    page,
    'Start a long response and keep going until cancelled. Do not use tools.',
  );
  const cancelButton = sessionPanel.locator('.ai-chat-cancel-button');
  await expect(cancelButton).toBeVisible({ timeout: 30_000 });
  await cancelButton.click();
  await expect(cancelButton).toHaveCount(0, { timeout: 30_000 });
});
