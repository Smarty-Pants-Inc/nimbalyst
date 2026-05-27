import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import crypto from 'crypto';
import electron from 'electron';
import fs from 'fs/promises';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '../..');
const wrapperRoot = path.resolve(repoRoot, '../..');
const electronMain = path.join(packageRoot, 'out/main/index.js');
const rendererRoot = path.join(packageRoot, 'out/renderer');
const rendererIndex = path.join(rendererRoot, 'index.html');

const argv = process.argv.slice(2);
const args = new Set(argv);
const smokeMode = args.has('--smoke');
const captureArtifactsMode = args.has('--capture-artifacts');
const keepData = args.has('--keep-data');
const verbose = args.has('--verbose') || smokeMode || captureArtifactsMode;
const defaultArtifactDir = path.join(wrapperRoot, 'docs/agent-elements/visual-artifacts');
const artifactDir = path.resolve(valueAfter('--artifact-dir') ?? process.env.AGENT_ELEMENTS_PREVIEW_ARTIFACTS_DIR ?? defaultArtifactDir);

function valueAfter(name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function usage() {
  console.log([
    'Agent Elements preview harness',
    '',
    'Usage:',
    '  npm run agent-elements:preview --prefix packages/electron',
    '  npm run agent-elements:preview --prefix packages/electron -- --smoke',
    '  npm run agent-elements:preview --prefix packages/electron -- --capture-artifacts',
    '  npm run agent-elements:preview --prefix packages/electron -- --capture-artifacts --artifact-dir ../../docs/agent-elements/visual-artifacts',
    '',
    'Default mode opens an isolated Electron preview window and keeps it running.',
    'Smoke mode seeds the same preview rows, verifies they render, then closes.',
    'Capture mode seeds the same preview rows, writes running-app screenshots and a manifest, then closes.',
  ].join('\n'));
}

function log(message) {
  if (verbose) {
    console.log(`[agent-elements-preview] ${message}`);
  }
}

async function withTimeout(label, promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

if (args.has('--help') || args.has('-h')) {
  usage();
  process.exit(0);
}

async function assertBuiltAppExists() {
  const missing = [];
  for (const file of [electronMain, rendererIndex, path.join(packageRoot, 'out/worker.bundle.js')]) {
    try {
      await fs.access(file);
    } catch {
      missing.push(path.relative(repoRoot, file));
    }
  }

  if (missing.length > 0) {
    throw new Error([
      'Built Electron artifacts are missing:',
      ...missing.map((file) => `  - ${file}`),
      '',
      'Run this first:',
      '  npm run build --prefix packages/electron',
    ].join('\n'));
  }
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

async function startRendererServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const requestedPath = decodeURIComponent(url.pathname);
      const normalized = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
      const candidate = path.join(rendererRoot, normalized === '/' ? 'index.html' : normalized);
      const relative = path.relative(rendererRoot, candidate);
      const safeCandidate = !relative.startsWith('..') && !path.isAbsolute(relative)
        ? candidate
        : rendererIndex;

      const stat = await fs.stat(safeCandidate).catch(() => null);
      const filePath = stat?.isFile() ? safeCandidate : rendererIndex;
      const data = await fs.readFile(filePath);
      res.writeHead(200, { 'content-type': contentTypeFor(filePath) });
      res.end(data);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine renderer preview server address');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  if (!address || typeof address === 'string') {
    throw new Error('Unable to allocate a free local port');
  }
  return address.port;
}

async function waitForCdpEndpoint(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for CDP endpoint on port ${port}: ${lastError?.message ?? 'unknown error'}`);
}

async function findMainAppPage(browser, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        const url = page.url();
        if (url.startsWith('devtools://') || url === 'about:blank') continue;
        return page;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the main Electron window page');
}

async function waitForChildExit(child, timeoutMs = 5000) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function launchPreviewElectron({ launchArgs, env, cdpPort }) {
  const child = spawn(electron, launchArgs, {
    cwd: repoRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (verbose) {
    child.stdout?.on('data', (chunk) => process.stdout.write(String(chunk)));
    child.stderr?.on('data', (chunk) => process.stderr.write(String(chunk)));
  }

  try {
    await waitForCdpEndpoint(cdpPort);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    let mainPage;
    return {
      async firstWindow() {
        if (mainPage && !mainPage.isClosed()) return mainPage;
        mainPage = await findMainAppPage(browser);
        return mainPage;
      },
      async close() {
        await browser.close().catch(() => undefined);
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGTERM');
          await waitForChildExit(child, 10000);
        }
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
          await waitForChildExit(child, 5000);
        }
      },
      onExit(callback) {
        child.once('exit', callback);
      },
    };
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await waitForChildExit(child);
    }
    throw error;
  }
}

async function createPreviewWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nimbalyst-agent-elements-preview-'));
  await fs.mkdir(path.join(root, 'src', 'components'), { recursive: true });
  await fs.writeFile(path.join(root, 'README.md'), '# Agent Elements Preview\n\nSeed workspace for Smarty Code UI review.\n', 'utf8');
  await fs.writeFile(path.join(root, 'src', 'app.ts'), 'export const preview = "agent-elements";\n', 'utf8');
  await fs.writeFile(path.join(root, 'src', 'components', 'AgentPanel.tsx'), 'export function AgentPanel() { return null; }\n', 'utf8');
  return root;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function toolUseMessage(toolId, name, input) {
  return JSON.stringify({
    type: 'assistant',
    message: {
      id: `msg_${toolId}`,
      content: [{ type: 'tool_use', id: toolId, name, input }],
    },
  });
}

function toolResultMessage(toolId, result, options = {}) {
  return JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolId,
        content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }],
        ...(options.isError ? { is_error: true } : {}),
      }],
    },
  });
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function pngInfo(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('Captured artifact is not a PNG');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const appRailPopoverTargets = [
  {
    id: 'theme-toggle-menu',
    triggerSelector: '[data-testid="gutter-theme-button"]',
    popoverSelector: '[data-testid="agent-elements-theme-toggle-menu"]',
    expectedWidthIntent: 'floating-menu',
    expectedPaddingIntent: 'symmetric-inline',
    required: true,
  },
  {
    id: 'user-menu-popover',
    triggerSelector: '[data-testid="gutter-user-button"]',
    popoverSelector: '[data-testid="user-menu-popover"]',
    expectedWidthIntent: 'floating-popover',
    expectedPaddingIntent: 'symmetric-inline',
    required: true,
  },
  {
    id: 'trust-indicator-menu',
    triggerSelector: '[data-testid="gutter-permissions-button"]',
    popoverSelector: '[data-testid="agent-elements-trust-indicator-menu"]',
    expectedWidthIntent: 'floating-popover',
    expectedPaddingIntent: 'symmetric-inline',
    required: true,
  },
  {
    id: 'background-tasks-popover',
    triggerSelector: '[data-testid="gutter-background-tasks-button"]',
    popoverSelector: '[data-testid="background-tasks-popover"]',
    expectedWidthIntent: 'floating-popover',
    expectedPaddingIntent: 'sectioned-symmetric',
    required: true,
  },
  {
    id: 'sync-status-menu',
    triggerSelector: '[data-testid="gutter-sync-button"]',
    popoverSelector: '[data-testid="agent-elements-sync-status-menu"]',
    expectedWidthIntent: 'floating-popover',
    expectedPaddingIntent: 'symmetric-inline',
    required: false,
  },
  {
    id: 'claude-usage-popover',
    triggerSelector: '[data-testid="claude-usage-indicator"]',
    popoverSelector: '[data-testid="claude-usage-popover"]',
    expectedWidthIntent: 'floating-popover',
    expectedPaddingIntent: 'sectioned-symmetric',
    required: false,
  },
  {
    id: 'codex-usage-popover',
    triggerSelector: '[data-testid="codex-usage-indicator"]',
    popoverSelector: '[data-testid="codex-usage-popover"]',
    expectedWidthIntent: 'floating-popover',
    expectedPaddingIntent: 'sectioned-symmetric',
    required: false,
  },
  {
    id: 'extension-dev-menu',
    triggerSelector: '[data-testid="agent-elements-extension-dev-button"]',
    popoverSelector: '[data-testid="agent-elements-extension-dev-menu"]',
    expectedWidthIntent: 'floating-menu',
    expectedPaddingIntent: 'symmetric-inline',
    required: false,
  },
];

function assistantTextMessage(text) {
  return JSON.stringify({
    type: 'assistant',
    message: {
      content: [{ type: 'text', text }],
    },
  });
}

async function waitForAppReady(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('.workspace-sidebar', { timeout: 15000 });
}

async function switchToAgentMode(page) {
  const agentMode = page.locator('.agent-mode');
  if (await agentMode.isVisible().catch(() => false)) return;
  await page.locator('[data-testid="agent-mode-button"]').click();
  await page.waitForSelector('.agent-mode', { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function enableToolRows(page) {
  await page.evaluate(async () => {
    const settings = await window.electronAPI.aiGetSettings();
    await window.electronAPI.aiSaveSettings({ ...settings, showToolCalls: true });
  });
}

async function invokeTestHandler(page, channel, payload) {
  const result = await page.evaluate(
    async ({ channel: ipcChannel, payload: ipcPayload }) => window.electronAPI.invoke(ipcChannel, ipcPayload),
    { channel, payload },
  );
  if (!result?.success) {
    throw new Error(`${channel} failed: ${result?.error ?? 'unknown error'}`);
  }
  return result;
}

async function createSession(page, workspacePath) {
  const id = uuid();
  await invokeTestHandler(page, 'test:insert-session', {
    id,
    workspaceId: workspacePath,
    title: 'Agent Elements Preview',
    provider: 'claude-code',
    model: 'claude-code:opus-1m',
  });
  return id;
}

async function insertMessage(page, sessionId, direction, content, source = 'claude-code') {
  await invokeTestHandler(page, 'test:insert-message', {
    sessionId,
    direction,
    content,
    source,
  });
}

async function seedPreviewTranscript(page, workspacePath) {
  const sessionId = await createSession(page, workspacePath);
  await insertMessage(page, sessionId, 'input', JSON.stringify({
    prompt: 'Show me the current Agent Elements redesign surfaces.',
    options: {},
  }));
  await insertMessage(page, sessionId, 'output', assistantTextMessage(
    'This preview session is seeded with representative tool cards, structured results, progress states, and error states so the in-progress redesign can be reviewed in a running app.'
  ));

  const runningSearch = `preview_running_search_${Date.now()}`;
  await insertMessage(page, sessionId, 'output', toolUseMessage(runningSearch, 'Grep', {
    pattern: 'AgentElementsPreview',
    path: 'src',
  }));

  const search = `preview_search_${Date.now()}`;
  await insertMessage(page, sessionId, 'output', toolUseMessage(search, 'Grep', {
    pattern: 'AgentPanel',
    path: 'src',
  }));
  await insertMessage(page, sessionId, 'input', toolResultMessage(search, {
    matches: [{
      path: 'src/components/AgentPanel.tsx',
      line: 1,
      text: 'export function AgentPanel() { return null; }',
    }],
  }));

  const emptySearch = `preview_empty_search_${Date.now()}`;
  await insertMessage(page, sessionId, 'output', toolUseMessage(emptySearch, 'Grep', {
    pattern: 'MissingPreviewComponent',
    path: 'src',
  }));
  await insertMessage(page, sessionId, 'input', toolResultMessage(emptySearch, { matches: [] }));

  const errorRead = `preview_error_read_${Date.now()}`;
  await insertMessage(page, sessionId, 'output', toolUseMessage(errorRead, 'Read', {
    file_path: 'src/missing.ts',
  }));
  await insertMessage(page, sessionId, 'input', toolResultMessage(errorRead, {
    error: 'File not found',
    status: 'error',
  }, { isError: true }));

  const bash = `preview_bash_${Date.now()}`;
  await insertMessage(page, sessionId, 'output', toolUseMessage(bash, 'Bash', {
    command: 'npm run typecheck --workspace @nimbalyst/runtime',
    description: 'Run runtime typecheck',
  }));
  await insertMessage(page, sessionId, 'input', toolResultMessage(bash, 'typecheck passed\n0 errors'));

  const mcp = `preview_mcp_${Date.now()}`;
  await insertMessage(page, sessionId, 'output', toolUseMessage(mcp, 'mcp__github__list_issues', {
    query: 'is:issue is:open label:agent-elements',
    limit: 2,
  }));
  await insertMessage(page, sessionId, 'input', toolResultMessage(mcp, {
    rows: [
      { title: 'Replace raw JSON todo output', status: 'closed' },
      { title: 'Add first-class MCP result cards', status: 'in review' },
    ],
  }));

  const generic = `preview_generic_${Date.now()}`;
  await insertMessage(page, sessionId, 'output', toolUseMessage(generic, 'workspace_summary', {
    includeFiles: true,
    includeProofs: true,
  }));
  await insertMessage(page, sessionId, 'input', toolResultMessage(generic, {
    rows: [
      { title: 'Transcript rows', status: 'left aligned' },
      { title: 'Raw payloads', status: 'debug-only' },
    ],
  }));

  const tracker = `preview_tracker_${Date.now()}`;
  await insertMessage(page, sessionId, 'output', toolUseMessage(tracker, 'tracker_update', {
    id: 'NIM-UX-42',
    status: 'in-review',
  }));
  await insertMessage(page, sessionId, 'input', toolResultMessage(tracker, {
    id: 'NIM-UX-42',
    title: 'Agent Elements transcript renderer',
    type: 'task',
    status: 'in-review',
    priority: 'high',
    tags: ['agent-elements', 'preview'],
    changes: [
      { field: 'status', before: 'in-progress', after: 'in-review' },
    ],
  }));

  const superLoop = `preview_super_loop_${Date.now()}`;
  await insertMessage(page, sessionId, 'output', toolUseMessage(superLoop, 'super_loop_progress_update', {
    phase: 'validating',
    status: 'completed',
    completionSignal: true,
    currentIteration: 3,
    blockers: [],
    learnings: [{
      iteration: 3,
      summary: 'Preview harness should be an official milestone artifact.',
      filesChanged: ['packages/electron/scripts/agent-elements-preview.mjs'],
    }],
  }));
  await insertMessage(page, sessionId, 'input', toolResultMessage(superLoop, 'Recorded Super Loop progress update'));

  return sessionId;
}

async function selectSeededSession(page, sessionId) {
  const sessionItem = page.locator(`#session-list-item-${sessionId}`);
  await sessionItem.waitFor({ state: 'visible', timeout: 10000 });
  await sessionItem.click();
  await page.waitForSelector('.rich-transcript-view', { timeout: 10000 });
}

async function smokeCheck(page) {
  const checks = [
    ['search cards', '[data-testid="agent-elements-search-tool-card"]'],
    ['MCP card', '[data-testid="agent-elements-mcp-tool-card"]'],
    ['generic card', '[data-testid="agent-elements-generic-tool-card"]'],
    ['bash shell', '[data-testid="rich-transcript-agent-elements-bash-shell"]'],
    ['Super Loop progress card', '[data-testid="agent-elements-super-loop-progress-card"]'],
    ['left-aligned rows', '[data-testid="agent-elements-transcript-row"][data-agent-align="left"]'],
  ];
  for (const [label, selector] of checks) {
    await page.waitForSelector(selector, { timeout: 10000 });
    const count = await page.locator(selector).count();
    if (count < 1) throw new Error(`Preview smoke check did not render ${label}`);
  }
}

async function applyPreviewTheme(page, theme) {
  await page.evaluate((nextTheme) => {
    window.electronAPI.send('set-theme', nextTheme, nextTheme === 'dark');
  }, theme);
  await page.waitForFunction(
    (nextTheme) => document.documentElement.getAttribute('data-theme') === nextTheme,
    theme,
    { timeout: 5000 },
  );
  await page.waitForTimeout(250);
}

async function previewDomSummary(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };

    const toPxNumber = (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const wideDesktopParentMinWidth = 760;
    const wideDesktopMinRightGutter = 24;

    const bridgeEntries = Array.from(document.querySelectorAll('.agent-elements-live-bridge'))
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement?.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const component = element.getAttribute('data-component') ?? '';
        const marginLeft = toPxNumber(style.marginLeft);
        const marginRight = toPxNumber(style.marginRight);
        const leftGutter = parentRect ? rect.left - parentRect.left : 0;
        const rightGutter = parentRect ? parentRect.right - rect.right : 0;
        const gutterDeltaError = Math.abs((leftGutter - rightGutter) - (marginLeft - marginRight));
        return {
          component,
          widthMode: element.getAttribute('data-agent-elements-width'),
          paddingMode: element.getAttribute('data-agent-elements-padding'),
          width: rect.width,
          parentWidth: parentRect?.width ?? 0,
          parentFillRatio: parentRect && parentRect.width > 0 ? rect.width / parentRect.width : 0,
          leftGutter,
          rightGutter,
          marginLeft,
          marginRight,
          gutterDeltaError,
          wideDesktopRailTouch: element.getAttribute('data-agent-elements-width') === 'wide' &&
            (parentRect?.width ?? 0) >= wideDesktopParentMinWidth &&
            (parentRect ? parentRect.right - rect.right : 0) < wideDesktopMinRightGutter,
          wideLeftEdgeDrift: element.getAttribute('data-agent-elements-width') === 'wide' &&
            (parentRect?.width ?? 0) >= wideDesktopParentMinWidth &&
            Math.abs((parentRect ? rect.left - parentRect.left : 0) - marginLeft) > 1,
          overflowsParent: parentRect
            ? rect.left < parentRect.left - 0.5 || rect.right > parentRect.right + 0.5
            : false,
          cardLikeEvent: component !== 'rich-transcript-agent-elements-message-bridge' &&
            component !== 'rich-transcript-agent-elements-thinking-bridge',
        };
      });
    const fullBridgeWidths = bridgeEntries
      .filter((entry) => entry.widthMode === 'full')
      .map((entry) => entry.width);
    const wideBridgeWidths = bridgeEntries
      .filter((entry) => entry.widthMode === 'wide')
      .map((entry) => entry.width);
    const contentBridgeWidths = bridgeEntries
      .filter((entry) => entry.widthMode === 'content')
      .map((entry) => entry.width);
    const wideDesktopBridgeEntries = bridgeEntries.filter((entry) =>
      entry.widthMode === 'wide' && entry.parentWidth >= wideDesktopParentMinWidth
    );
    const cardLikeBridgeEntries = bridgeEntries.filter((entry) => entry.cardLikeEvent);
    const cardLikeBridgeWidths = cardLikeBridgeEntries.map((entry) => Math.round(entry.width));
    const distinctCardLikeBridgeWidths = [...new Set(cardLikeBridgeWidths)];

    const cardPaddingSelectors = [
      '.agent-elements-tool-card',
      '.agent-elements-bash-tool-card[data-bash-state="collapsed"]',
      '.agent-elements-plan-header',
      '.agent-elements-plan-body',
      '.agent-elements-plan-footer',
      '.agent-elements-error-message-shell',
      '.agent-elements-generic-shell',
      '.agent-elements-extension-shell',
      '.agent-elements-edit-header-button',
      '.agent-elements-search-header',
      '.agent-elements-edit-summary',
      '.agent-elements-search-empty',
      '.agent-elements-edit-approval',
      '.agent-elements-search-results',
      '.agent-elements-framework-row',
      '.agent-elements-thinking-content',
      '.agent-elements-mcp-body',
      '.agent-elements-question-copy',
      '.agent-elements-question-inputs',
      '.agent-elements-question-options-display',
      '.agent-elements-question-history',
      '.agent-elements-subagent-list',
      '.agent-elements-stream-heading',
      '.agent-elements-state-toggle',
      '.agent-elements-progress-updates',
      '.agent-elements-lifecycle-events',
      '.agent-elements-turn-summary-warnings',
      '.agent-elements-error-actions',
      '.agent-elements-state-key-list',
      '.agent-elements-turn-summary-metrics',
      '.agent-elements-progress-empty',
      '.agent-elements-error-message',
      '.agent-elements-error-detail',
    ];

    const cardPaddingEntries = Array.from(document.querySelectorAll(cardPaddingSelectors.join(',')))
      .filter(isVisible)
      .map((element) => {
        const style = window.getComputedStyle(element);
        const paddingLeft = toPxNumber(style.paddingLeft);
        const paddingRight = toPxNumber(style.paddingRight);
        return {
          className: element.getAttribute('class') ?? '',
          testId: element.getAttribute('data-testid') ?? '',
          paddingLeft,
          paddingRight,
          asymmetric: Math.abs(paddingLeft - paddingRight) > 0.5,
        };
      });
    const inlinePaddings = cardPaddingEntries.flatMap((entry) => [entry.paddingLeft, entry.paddingRight]);
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const explicitFullRailWidthIntents = new Set(['full-rail', 'page-section', 'app-shell']);
    const cardRootEntries = Array.from(document.querySelectorAll('.agent-elements-tool-card'))
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement?.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const className = element.getAttribute('class') ?? '';
        const classList = Array.from(element.classList);
        const semanticClass = classList.find((classToken) =>
          classToken.startsWith('agent-elements-') && classToken !== 'agent-elements-tool-card'
        ) ?? classList.find((classToken) => classToken !== 'agent-elements-tool-card') ?? '';
        const paddingLeft = toPxNumber(style.paddingLeft);
        const paddingRight = toPxNumber(style.paddingRight);
        const widthIntent = element.getAttribute('data-agent-elements-card-width') ?? '';
        const paddingIntent = element.getAttribute('data-agent-elements-card-padding') ?? '';
        const parentWidth = parentRect?.width ?? 0;
        const parentFillRatio = parentWidth > 0 ? rect.width / parentWidth : 0;
        const viewportFillRatio = viewportWidth > 0 ? rect.width / viewportWidth : 0;
        const visuallyFullRail = (
          parentWidth >= 760 &&
          parentFillRatio >= 0.96 &&
          rect.width >= 720
        ) || viewportFillRatio >= 0.92;
        return {
          semanticClass,
          className,
          testId: element.getAttribute('data-testid') ?? '',
          component: element.getAttribute('data-component') ?? '',
          widthIntent,
          paddingIntent,
          width: rect.width,
          parentWidth,
          parentFillRatio,
          viewportFillRatio,
          paddingLeft,
          paddingRight,
          asymmetric: Math.abs(paddingLeft - paddingRight) > 0.5,
          visuallyFullRail,
          unintentionalFullWidth: visuallyFullRail && !explicitFullRailWidthIntents.has(widthIntent),
        };
      });
    const floatingActions = document.querySelector('.agent-elements-floating-transcript-actions');
    const floatingActionsVisible = floatingActions ? isVisible(floatingActions) : false;
    const floatingActionsRect = floatingActionsVisible ? floatingActions.getBoundingClientRect() : null;
    const visibleCardRects = Array.from(document.querySelectorAll([
      '.agent-elements-live-bridge[data-agent-elements-width="wide"]',
      '.agent-elements-live-bridge[data-agent-elements-width="full"]',
      '.agent-elements-tool-card',
      '.agent-elements-plan-card',
      '.agent-elements-todo-list',
    ].join(',')))
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          className: element.getAttribute('class') ?? '',
          testId: element.getAttribute('data-testid') ?? '',
          component: element.getAttribute('data-component') ?? '',
          widthIntent: element.getAttribute('data-agent-elements-width') ??
            element.getAttribute('data-agent-elements-card-width') ?? '',
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
      });
    const hasPaintedCardAtOverlap = (element, overlapRect) => {
      const samplePoints = [
        [overlapRect.left + overlapRect.width / 2, overlapRect.top + overlapRect.height / 2],
        [overlapRect.left + Math.min(6, overlapRect.width / 2), overlapRect.top + overlapRect.height / 2],
        [overlapRect.right - Math.min(6, overlapRect.width / 2), overlapRect.top + overlapRect.height / 2],
      ];
      return samplePoints.some(([x, y]) =>
        document.elementsFromPoint(x, y).some((candidate) => candidate === element || element.contains(candidate))
      );
    };
    const overlapEntries = floatingActionsRect
      ? visibleCardRects
          .map((entry) => {
            const overlapWidth = Math.max(0, Math.min(floatingActionsRect.right, entry.right) - Math.max(floatingActionsRect.left, entry.left));
            const overlapHeight = Math.max(0, Math.min(floatingActionsRect.bottom, entry.bottom) - Math.max(floatingActionsRect.top, entry.top));
            const overlapRect = {
              top: Math.max(floatingActionsRect.top, entry.top),
              right: Math.min(floatingActionsRect.right, entry.right),
              bottom: Math.min(floatingActionsRect.bottom, entry.bottom),
              left: Math.max(floatingActionsRect.left, entry.left),
              width: overlapWidth,
              height: overlapHeight,
            };
            const paintedOverlap = overlapWidth > 1 && overlapHeight > 1 && hasPaintedCardAtOverlap(entry.element, overlapRect);
            const { element: _element, ...rest } = entry;
            return {
              ...rest,
              overlapWidth,
              overlapHeight,
              overlapArea: overlapWidth * overlapHeight,
              paintedOverlap,
            };
          })
          .filter((entry) => entry.paintedOverlap)
      : [];
    const summarizeCardRootEntry = (entry) => ({
      semanticClass: entry.semanticClass,
      testId: entry.testId,
      component: entry.component,
      widthIntent: entry.widthIntent,
      paddingIntent: entry.paddingIntent,
      width: Math.round(entry.width),
      parentWidth: Math.round(entry.parentWidth),
      parentFillRatio: Number(entry.parentFillRatio.toFixed(3)),
      viewportFillRatio: Number(entry.viewportFillRatio.toFixed(3)),
      paddingLeft: entry.paddingLeft,
      paddingRight: entry.paddingRight,
    });

    return {
      theme: document.documentElement.getAttribute('data-theme'),
      rowCount: document.querySelectorAll('[data-testid="agent-elements-transcript-row"][data-agent-align="left"]').length,
      searchCardCount: document.querySelectorAll('[data-testid="agent-elements-search-tool-card"]').length,
      mcpCardCount: document.querySelectorAll('[data-testid="agent-elements-mcp-tool-card"]').length,
      genericCardCount: document.querySelectorAll('[data-testid="agent-elements-generic-tool-card"]').length,
      bashCardCount: document.querySelectorAll('[data-testid="rich-transcript-agent-elements-bash-shell"]').length,
      trackerCardCount: document.querySelectorAll('[data-testid="agent-elements-tracker-tool-card"]').length,
      superLoopCardCount: document.querySelectorAll('[data-testid="agent-elements-super-loop-progress-card"]').length,
      bridgeWidthPolicy: {
        bridgeCount: bridgeEntries.length,
        fullCount: fullBridgeWidths.length,
        wideCount: wideBridgeWidths.length,
        contentCount: contentBridgeWidths.length,
        missingWidthCount: bridgeEntries.filter((entry) => entry.widthMode !== 'full' && entry.widthMode !== 'wide' && entry.widthMode !== 'content').length,
        missingPaddingCount: bridgeEntries.filter((entry) => entry.paddingMode !== 'aligned').length,
        fullCollapsedCount: fullBridgeWidths.filter((width) => width < 1).length,
        wideCollapsedCount: wideBridgeWidths.filter((width) => width < 1).length,
        contentCollapsedCount: contentBridgeWidths.filter((width) => width < 1).length,
        minFullWidth: fullBridgeWidths.length > 0 ? Math.min(...fullBridgeWidths) : 0,
        minWideWidth: wideBridgeWidths.length > 0 ? Math.min(...wideBridgeWidths) : 0,
        minContentWidth: contentBridgeWidths.length > 0 ? Math.min(...contentBridgeWidths) : 0,
        fullOverflowCount: bridgeEntries.filter((entry) => entry.widthMode === 'full' && entry.overflowsParent).length,
        wideOverflowCount: bridgeEntries.filter((entry) => entry.widthMode === 'wide' && entry.overflowsParent).length,
        fullGutterMismatchCount: bridgeEntries.filter((entry) =>
          entry.widthMode === 'full' && entry.gutterDeltaError > 1
        ).length,
        wideGutterMismatchCount: bridgeEntries.filter((entry) =>
          entry.widthMode === 'wide' && entry.gutterDeltaError > 1
        ).length,
        wideDesktopRailTouchCount: bridgeEntries.filter((entry) => entry.wideDesktopRailTouch).length,
        wideLeftEdgeDriftCount: bridgeEntries.filter((entry) => entry.wideLeftEdgeDrift).length,
        minWideRightGutter: wideDesktopBridgeEntries.length > 0
          ? Math.min(...wideDesktopBridgeEntries.map((entry) => entry.rightGutter))
          : 0,
        maxWideParentFillRatio: wideDesktopBridgeEntries.length > 0
          ? Math.max(...wideDesktopBridgeEntries.map((entry) => entry.parentFillRatio))
          : 0,
        wideLooksFullWidthCount: wideDesktopBridgeEntries.filter((entry) => entry.parentFillRatio > 0.88).length,
        maxFullGutterDeltaError: bridgeEntries
          .filter((entry) => entry.widthMode === 'full')
          .reduce((max, entry) => Math.max(max, entry.gutterDeltaError), 0),
        maxWideGutterDeltaError: bridgeEntries
          .filter((entry) => entry.widthMode === 'wide')
          .reduce((max, entry) => Math.max(max, entry.gutterDeltaError), 0),
      },
      eventCardWidthPolicy: {
        cardBridgeCount: cardLikeBridgeEntries.length,
        wideCardBridgeCount: cardLikeBridgeEntries.filter((entry) => entry.widthMode === 'wide').length,
        contentCardBridgeCount: cardLikeBridgeEntries.filter((entry) => entry.widthMode === 'content').length,
        fullCardBridgeCount: cardLikeBridgeEntries.filter((entry) => entry.widthMode === 'full').length,
        distinctVisibleWidthCount: distinctCardLikeBridgeWidths.length,
        minVisibleWidth: cardLikeBridgeWidths.length > 0 ? Math.min(...cardLikeBridgeWidths) : 0,
        maxVisibleWidth: cardLikeBridgeWidths.length > 0 ? Math.max(...cardLikeBridgeWidths) : 0,
        maxVisibleWidthDelta: cardLikeBridgeWidths.length > 0
          ? Math.max(...cardLikeBridgeWidths) - Math.min(...cardLikeBridgeWidths)
          : 0,
      },
      cardPaddingPolicy: {
        cardCount: cardPaddingEntries.length,
        asymmetricInlinePaddingCount: cardPaddingEntries.filter((entry) => entry.asymmetric).length,
        minInlinePadding: inlinePaddings.length > 0 ? Math.min(...inlinePaddings) : 0,
        maxInlinePadding: inlinePaddings.length > 0 ? Math.max(...inlinePaddings) : 0,
        zeroInlinePaddingSamples: cardPaddingEntries
          .filter((entry) => entry.paddingLeft < 1 || entry.paddingRight < 1)
          .slice(0, 8)
          .map(({ className, testId, paddingLeft, paddingRight }) => ({
            className,
            testId,
            paddingLeft,
            paddingRight,
          })),
      },
      cardRootPolicy: {
        cardCount: cardRootEntries.length,
        missingWidthIntentCount: cardRootEntries.filter((entry) => entry.widthIntent.length === 0).length,
        missingPaddingIntentCount: cardRootEntries.filter((entry) => entry.paddingIntent.length === 0).length,
        asymmetricInlinePaddingCount: cardRootEntries.filter((entry) => entry.asymmetric).length,
        unintentionalFullWidthCount: cardRootEntries.filter((entry) => entry.unintentionalFullWidth).length,
        widthIntentCounts: cardRootEntries.reduce((counts, entry) => {
          const key = entry.widthIntent || '(missing)';
          counts[key] = (counts[key] ?? 0) + 1;
          return counts;
        }, {}),
        paddingIntentCounts: cardRootEntries.reduce((counts, entry) => {
          const key = entry.paddingIntent || '(missing)';
          counts[key] = (counts[key] ?? 0) + 1;
          return counts;
        }, {}),
        missingWidthIntentSamples: cardRootEntries
          .filter((entry) => entry.widthIntent.length === 0)
          .slice(0, 8)
          .map(summarizeCardRootEntry),
        missingPaddingIntentSamples: cardRootEntries
          .filter((entry) => entry.paddingIntent.length === 0)
          .slice(0, 8)
          .map(summarizeCardRootEntry),
        asymmetricInlinePaddingSamples: cardRootEntries
          .filter((entry) => entry.asymmetric)
          .slice(0, 8)
          .map(summarizeCardRootEntry),
        unintentionalFullWidthSamples: cardRootEntries
          .filter((entry) => entry.unintentionalFullWidth)
          .slice(0, 8)
          .map(summarizeCardRootEntry),
      },
      floatingActionPolicy: {
        actionVisible: floatingActionsVisible,
        checkedCardCount: visibleCardRects.length,
        overlappingCardCount: overlapEntries.length,
        actionRect: floatingActionsRect ? {
          top: Math.round(floatingActionsRect.top),
          right: Math.round(floatingActionsRect.right),
          bottom: Math.round(floatingActionsRect.bottom),
          left: Math.round(floatingActionsRect.left),
          width: Math.round(floatingActionsRect.width),
          height: Math.round(floatingActionsRect.height),
        } : null,
        overlappedSamples: overlapEntries.slice(0, 8).map((entry) => ({
          className: entry.className,
          testId: entry.testId,
          component: entry.component,
          widthIntent: entry.widthIntent,
          top: Math.round(entry.top),
          right: Math.round(entry.right),
          bottom: Math.round(entry.bottom),
          left: Math.round(entry.left),
          width: Math.round(entry.width),
          height: Math.round(entry.height),
          overlapWidth: Math.round(entry.overlapWidth),
          overlapHeight: Math.round(entry.overlapHeight),
          overlapArea: Math.round(entry.overlapArea),
        })),
      },
    };
  });
}

async function closeAppRailPopover(page) {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(100);
}

async function collectAppRailPopoverPolicy(page) {
  const entries = [];

  for (const target of appRailPopoverTargets) {
    await closeAppRailPopover(page);

    const trigger = page.locator(target.triggerSelector).first();
    const triggerCount = await trigger.count();
    if (triggerCount === 0) {
      entries.push({
        id: target.id,
        status: 'trigger-missing',
        required: target.required,
        triggerSelector: target.triggerSelector,
        popoverSelector: target.popoverSelector,
      });
      continue;
    }

    if (!(await trigger.isVisible().catch(() => false))) {
      entries.push({
        id: target.id,
        status: 'trigger-hidden',
        required: target.required,
        triggerSelector: target.triggerSelector,
        popoverSelector: target.popoverSelector,
      });
      continue;
    }

    try {
      await trigger.click();
      await page.waitForSelector(target.popoverSelector, { state: 'visible', timeout: 3000 });
      const entry = await page.evaluate((targetInfo) => {
        const toPxNumber = (value) => {
          const parsed = Number.parseFloat(value);
          return Number.isFinite(parsed) ? parsed : 0;
        };
        const element = document.querySelector(targetInfo.popoverSelector);
        if (!element) {
          return {
            id: targetInfo.id,
            status: 'popover-missing',
            required: targetInfo.required,
            triggerSelector: targetInfo.triggerSelector,
            popoverSelector: targetInfo.popoverSelector,
          };
        }

        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement?.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        const paddingLeft = toPxNumber(style.paddingLeft);
        const paddingRight = toPxNumber(style.paddingRight);
        const widthIntent = element.getAttribute('data-agent-elements-card-width') ?? '';
        const paddingIntent = element.getAttribute('data-agent-elements-card-padding') ?? '';
        const parentWidth = parentRect?.width ?? 0;
        const parentFillRatio = parentWidth > 0 ? rect.width / parentWidth : 0;
        const viewportFillRatio = viewportWidth > 0 ? rect.width / viewportWidth : 0;
        const visuallyFullRail = (
          parentWidth >= 760 &&
          parentFillRatio >= 0.96 &&
          rect.width >= 720
        ) || viewportFillRatio >= 0.92;
        const explicitFullRailWidthIntents = new Set(['full-rail', 'page-section', 'app-shell']);

        return {
          id: targetInfo.id,
          status: rect.width > 0 && rect.height > 0 ? 'checked' : 'collapsed',
          required: targetInfo.required,
          triggerSelector: targetInfo.triggerSelector,
          popoverSelector: targetInfo.popoverSelector,
          widthIntent,
          paddingIntent,
          expectedWidthIntent: targetInfo.expectedWidthIntent,
          expectedPaddingIntent: targetInfo.expectedPaddingIntent,
          width: rect.width,
          height: rect.height,
          parentWidth,
          parentFillRatio,
          viewportFillRatio,
          paddingLeft,
          paddingRight,
          asymmetric: Math.abs(paddingLeft - paddingRight) > 0.5,
          missingWidthIntent: widthIntent.length === 0,
          missingPaddingIntent: paddingIntent.length === 0,
          unexpectedWidthIntent: Boolean(targetInfo.expectedWidthIntent) && widthIntent !== targetInfo.expectedWidthIntent,
          unexpectedPaddingIntent: Boolean(targetInfo.expectedPaddingIntent) && paddingIntent !== targetInfo.expectedPaddingIntent,
          visuallyFullRail,
          unintentionalFullWidth: visuallyFullRail && !explicitFullRailWidthIntents.has(widthIntent),
        };
      }, target);

      entries.push(entry);
    } catch (error) {
      entries.push({
        id: target.id,
        status: 'popover-timeout',
        required: target.required,
        triggerSelector: target.triggerSelector,
        popoverSelector: target.popoverSelector,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await closeAppRailPopover(page);

  const checkedEntries = entries.filter((entry) => entry.status === 'checked');
  const summarizeEntry = (entry) => ({
    id: entry.id,
    status: entry.status,
    required: entry.required,
    widthIntent: entry.widthIntent ?? '',
    paddingIntent: entry.paddingIntent ?? '',
    expectedWidthIntent: entry.expectedWidthIntent ?? '',
    expectedPaddingIntent: entry.expectedPaddingIntent ?? '',
    width: Math.round(entry.width ?? 0),
    height: Math.round(entry.height ?? 0),
    parentWidth: Math.round(entry.parentWidth ?? 0),
    parentFillRatio: Number((entry.parentFillRatio ?? 0).toFixed(3)),
    viewportFillRatio: Number((entry.viewportFillRatio ?? 0).toFixed(3)),
    paddingLeft: entry.paddingLeft ?? 0,
    paddingRight: entry.paddingRight ?? 0,
  });

  return {
    targetCount: entries.length,
    checkedCount: checkedEntries.length,
    requiredCount: entries.filter((entry) => entry.required).length,
    requiredMissingCount: entries.filter((entry) => entry.required && entry.status !== 'checked').length,
    missingWidthIntentCount: checkedEntries.filter((entry) => entry.missingWidthIntent).length,
    missingPaddingIntentCount: checkedEntries.filter((entry) => entry.missingPaddingIntent).length,
    unexpectedWidthIntentCount: checkedEntries.filter((entry) => entry.unexpectedWidthIntent).length,
    unexpectedPaddingIntentCount: checkedEntries.filter((entry) => entry.unexpectedPaddingIntent).length,
    asymmetricInlinePaddingCount: checkedEntries.filter((entry) => entry.asymmetric).length,
    unintentionalFullWidthCount: checkedEntries.filter((entry) => entry.unintentionalFullWidth).length,
    widthIntentCounts: checkedEntries.reduce((counts, entry) => {
      const key = entry.widthIntent || '(missing)';
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {}),
    paddingIntentCounts: checkedEntries.reduce((counts, entry) => {
      const key = entry.paddingIntent || '(missing)';
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {}),
    missingWidthIntentSamples: checkedEntries.filter((entry) => entry.missingWidthIntent).slice(0, 8).map(summarizeEntry),
    missingPaddingIntentSamples: checkedEntries.filter((entry) => entry.missingPaddingIntent).slice(0, 8).map(summarizeEntry),
    unexpectedWidthIntentSamples: checkedEntries.filter((entry) => entry.unexpectedWidthIntent).slice(0, 8).map(summarizeEntry),
    unexpectedPaddingIntentSamples: checkedEntries.filter((entry) => entry.unexpectedPaddingIntent).slice(0, 8).map(summarizeEntry),
    asymmetricInlinePaddingSamples: checkedEntries.filter((entry) => entry.asymmetric).slice(0, 8).map(summarizeEntry),
    unintentionalFullWidthSamples: checkedEntries.filter((entry) => entry.unintentionalFullWidth).slice(0, 8).map(summarizeEntry),
    entries: entries.map((entry) => entry.status === 'checked'
      ? summarizeEntry({ ...entry, status: entry.status })
      : {
          id: entry.id,
          status: entry.status,
          required: entry.required,
          triggerSelector: entry.triggerSelector,
          popoverSelector: entry.popoverSelector,
          error: entry.error,
        }),
  };
}

async function capturePreviewArtifacts(page, sessionId, workspacePath) {
  await fs.mkdir(artifactDir, { recursive: true });
  const captures = [
    {
      id: 'live-preview-agent-mode-dark',
      fileName: 'live-preview-agent-mode-dark.png',
      theme: 'dark',
      motion: 'normal',
      viewport: { width: 1440, height: 1000 },
    },
    {
      id: 'live-preview-agent-mode-light',
      fileName: 'live-preview-agent-mode-light.png',
      theme: 'light',
      motion: 'normal',
      viewport: { width: 1440, height: 1000 },
    },
    {
      id: 'live-preview-agent-mode-compact',
      fileName: 'live-preview-agent-mode-compact.png',
      theme: 'dark',
      motion: 'normal',
      viewport: { width: 900, height: 1000 },
    },
    {
      id: 'live-preview-agent-mode-reduced-motion',
      fileName: 'live-preview-agent-mode-reduced-motion.png',
      theme: 'dark',
      motion: 'reduced',
      viewport: { width: 1440, height: 1000 },
    },
  ];

  const rendered = [];
  for (const capture of captures) {
    log(`capturing ${capture.id}`);
    await page.setViewportSize(capture.viewport);
    await page.emulateMedia({ reducedMotion: capture.motion === 'reduced' ? 'reduce' : 'no-preference' });
    await applyPreviewTheme(page, capture.theme);
    await smokeCheck(page);
    const summary = await previewDomSummary(page);
    const outputPath = path.join(artifactDir, capture.fileName);
    const buffer = await page.screenshot({ path: outputPath, fullPage: false });
    const info = pngInfo(buffer);
    rendered.push({
      ...capture,
      path: path.relative(wrapperRoot, outputPath),
      bytes: buffer.length,
      sha256: sha256(buffer),
      purpose: 'human-review-running-app-layout-sanity-not-style-approval',
      sessionId,
      workspaceBasename: path.basename(workspacePath),
      domSummary: summary,
      image: info,
    });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await applyPreviewTheme(page, 'dark');
  await smokeCheck(page);
  const appRailPopoverPolicy = await collectAppRailPopoverPolicy(page);

  const manifest = {
    schemaVersion: 1,
    artifactKind: 'agent-elements-running-app-preview-pack',
    generatedAt: new Date().toISOString(),
    tasteAuthority: 'human',
    automatedUse: 'running-app-layout-sanity-and-progress-review-only',
    renderer: {
      url: process.env.ELECTRON_RENDERER_URL ?? null,
      main: path.relative(repoRoot, electronMain),
    },
    appRailPopoverPolicy,
    captures: rendered,
  };
  const manifestPath = path.join(artifactDir, 'live-preview-manifest.json');
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return {
    manifestPath,
    manifest: path.relative(wrapperRoot, manifestPath),
    captures: rendered,
  };
}

async function main() {
  log('checking built app artifacts');
  await assertBuiltAppExists();

  log('creating isolated preview workspace and profile');
  const workspacePath = await createPreviewWorkspace();
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'nimbalyst-agent-elements-preview-user-data-'));
  log('starting static renderer server');
  const rendererServer = await startRendererServer();
  const cdpPort = await getFreePort();

  const env = {
    ...process.env,
    ELECTRON_RENDERER_URL: rendererServer.url,
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    IS_DEV_MODE: 'true',
    PLAYWRIGHT: '1',
    PLAYWRIGHT_TEST: 'true',
    NIMBALYST_NO_FOCUS: '1',
    NIMBALYST_CDP_PORT: String(cdpPort),
    NIMBALYST_PERMISSION_MODE: 'allow-all',
    NIMBALYST_USER_DATA_DIR: userDataPath,
    NIMBALYST_USER_DATA_PATH: userDataPath,
  };

  const launchArgs = [electronMain, '--workspace', workspacePath];
  if (process.platform === 'linux' && process.getuid?.() === 0) {
    launchArgs.push('--no-sandbox');
  }

  log(`launching Electron preview app on CDP port ${cdpPort}`);
  const app = await withTimeout('Electron launch', launchPreviewElectron({ launchArgs, env, cdpPort }), 30000);

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await app.close().catch(() => undefined);
    await rendererServer.close().catch(() => undefined);
    if (!keepData) {
      await fs.rm(workspacePath, { recursive: true, force: true }).catch(() => undefined);
      await fs.rm(userDataPath, { recursive: true, force: true }).catch(() => undefined);
    }
  };

  process.once('SIGINT', async () => {
    await close();
    process.exit(0);
  });
  process.once('SIGTERM', async () => {
    await close();
    process.exit(0);
  });

  try {
    log('waiting for first window');
    const page = await withTimeout('first window', app.firstWindow(), 20000);
    log('waiting for app shell');
    await withTimeout('app ready', waitForAppReady(page), 20000);
    log('enabling tool rows');
    await withTimeout('tool row settings', enableToolRows(page), 10000);
    log('switching to Agent Mode');
    await withTimeout('Agent Mode switch', switchToAgentMode(page), 15000);
    log('seeding preview transcript');
    const sessionId = await withTimeout('preview transcript seed', seedPreviewTranscript(page, workspacePath), 20000);
    log('selecting seeded preview session');
    await withTimeout('preview session selection', selectSeededSession(page, sessionId), 15000);

    if (smokeMode) {
      log('running smoke checks');
      await withTimeout('preview smoke checks', smokeCheck(page), 20000);
      console.log('Agent Elements preview smoke passed.');
      await close();
      return;
    }

    if (captureArtifactsMode) {
      log('running smoke checks before capture');
      await withTimeout('preview smoke checks', smokeCheck(page), 20000);
      log('capturing running-app visual artifacts');
      const result = await withTimeout('preview artifact capture', capturePreviewArtifacts(page, sessionId, workspacePath), 45000);
      console.log(JSON.stringify({
        manifest: result.manifest,
        captures: result.captures.map((capture) => ({
          id: capture.id,
          path: capture.path,
          sha256: capture.sha256,
          viewport: capture.viewport,
          theme: capture.theme,
          motion: capture.motion,
        })),
      }, null, 2));
      await close();
      return;
    }

    console.log([
      'Agent Elements preview is running.',
      `Renderer: ${rendererServer.url}`,
      `Workspace: ${workspacePath}`,
      `User data: ${userDataPath}`,
      '',
      'The Electron window was shown inactive to avoid stealing focus.',
      'Close the window or press Ctrl-C here to stop the preview.',
    ].join('\n'));

    await new Promise((resolve) => {
      app.onExit(resolve);
    });
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
