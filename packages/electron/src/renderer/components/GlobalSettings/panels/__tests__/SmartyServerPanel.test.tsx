import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SmartyServerPanel } from '../SmartyServerPanel';

const sourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/SmartyServerPanel.tsx',
);
const chromeSourcePath = path.join(
  process.cwd(),
  'packages/electron/src/renderer/components/GlobalSettings/panels/providerPanelChrome.ts',
);
const legacyVisualChromePattern =
  /bg-nim|text-nim|border-nim|bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-|rgba\(|#[0-9a-fA-F]{3,8}\b|bg-white|rounded-lg|rounded-md|transition-all|text-white/;

function createProps(config: Record<string, any>) {
  return {
    config: {
      enabled: true,
      baseUrl: 'http://127.0.0.1:8788',
      defaultModel: 'smarty-server:smarty_coding_agent',
      testStatus: 'idle',
      ...config,
    } as any,
    apiKeys: {
      'smarty-server': '',
    },
    availableModels: [],
    loading: false,
    onToggle: vi.fn(),
    onApiKeyChange: vi.fn(),
    onModelToggle: vi.fn(),
    onSelectAllModels: vi.fn(),
    onTestConnection: vi.fn().mockResolvedValue(undefined),
    onConfigChange: vi.fn(),
  };
}

function renderPanel(config: Record<string, any>) {
  const props = createProps(config);
  return {
    props,
    ...render(<SmartyServerPanel {...props} />),
  };
}

describe('SmartyServerPanel runtime health display', () => {
  it('uses the Agent Elements provider-panel shell while preserving settings callbacks and runtime health IDs', () => {
    const { props } = renderPanel({
      runtimeHealth: {
        runtime: 'ready',
        localMode: { localOnly: true },
        modelBackend: {
          backend: 'cliproxyapi',
          selectedModel: 'gpt-5.5',
        },
        cliProxy: { reachable: true },
        langSmithTracing: { enabled: true, project: 'smarty-code-dev' },
        workspace: { path: '/Users/paulbettner/Projects/workspaces/smarty-code' },
        optionalCapabilities: [
          { id: 'browser', label: 'Browser automation', status: 'degraded' },
          { id: 'shell', label: 'Shell execution', status: 'ready' },
        ],
        recovery: { cliProxy: 'Restart CLIProxyAPI from Settings.' },
      },
    });

    const panel = screen.getByTestId('agent-elements-smarty-server-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'smarty-server-panel');
    expect(panel).toHaveClass('agent-elements-settings-panel');
    expect(screen.getByTestId('agent-elements-smarty-server-header')).toHaveClass('agent-elements-settings-panel-header');
    expect(screen.getByTestId('agent-elements-smarty-server-connection-section')).toHaveAttribute('data-section', 'connection');

    fireEvent.click(within(screen.getByTestId('agent-elements-smarty-server-enable-toggle')).getByRole('checkbox', { hidden: true }));
    expect(props.onToggle).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByTestId('smarty-server-base-url'), {
      target: { value: 'http://127.0.0.1:8799' },
    });
    expect(props.onConfigChange).toHaveBeenCalledWith({ baseUrl: 'http://127.0.0.1:8799' });

    fireEvent.change(screen.getByTestId('smarty-server-assistant-id'), {
      target: { value: 'daily_driver' },
    });
    expect(props.onConfigChange).toHaveBeenCalledWith({ defaultModel: 'smarty-server:daily_driver' });

    fireEvent.change(screen.getByTestId('smarty-server-api-key'), {
      target: { value: 'local-runtime-key' },
    });
    expect(props.onApiKeyChange).toHaveBeenCalledWith('smarty-server', 'local-runtime-key');

    fireEvent.click(screen.getByTestId('smarty-server-test-connection'));
    expect(props.onTestConnection).toHaveBeenCalled();

    const health = screen.getByTestId('smarty-server-runtime-health');
    expect(health).toHaveClass('agent-elements-tool-card');
    expect(health).toHaveAttribute('data-agent-elements-card-padding', 'symmetric-inline');
    expect(health).toHaveAttribute('data-agent-elements-card-width', 'section-row');
    expect(health).toHaveAttribute('data-local-only', 'true');
    expect(health).toHaveAttribute('data-degraded-count', '1');
    expect(screen.getByTestId('smarty-server-health-runtime')).toHaveTextContent('ready');
    expect(screen.getByTestId('smarty-server-health-local-mode')).toHaveTextContent('local-only');
    expect(screen.getByTestId('smarty-server-health-backend')).toHaveTextContent('cliproxyapi');
    expect(screen.getByTestId('smarty-server-health-model')).toHaveTextContent('gpt-5.5');
    expect(screen.getByTestId('smarty-server-health-cliproxy')).toHaveTextContent('ready');
    expect(screen.getByTestId('smarty-server-health-tracing')).toHaveTextContent('enabled smarty-code-dev');
    expect(screen.getByTestId('smarty-server-health-workspace')).toHaveTextContent('/Users/paulbettner/Projects/workspaces/smarty-code');
    expect(screen.getByTestId('smarty-server-optional-capability')).toHaveAttribute('data-capability-id', 'browser');
    expect(screen.getByTestId('smarty-server-health-recovery')).toHaveTextContent('Restart CLIProxyAPI from Settings.');
  });

  it('renders the last successful runtime health snapshot after settings resume', () => {
    renderPanel({
      lastSuccessfulRuntimeHealth: {
        runtime: 'ready',
        localMode: { localOnly: true },
        modelBackend: {
          backend: 'cliproxyapi',
          selectedModel: 'gpt-5.5',
        },
        cliProxy: { reachable: true },
        langSmithTracing: { enabled: false },
      },
    });

    expect(screen.getByTestId('smarty-server-health-runtime').textContent).toBe('ready');
    expect(screen.getByTestId('smarty-server-health-local-mode').textContent).toBe('local-only');
    expect(screen.getByTestId('smarty-server-health-backend').textContent).toBe('cliproxyapi');
    expect(screen.getByTestId('smarty-server-health-model').textContent).toBe('gpt-5.5');
    expect(screen.getByTestId('smarty-server-health-cliproxy').textContent).toBe('ready');
  });

  it('renders explicit non-local-only health instead of unknown', () => {
    renderPanel({
      runtimeHealth: {
        runtime: 'ready',
        localMode: { localOnly: false },
        modelBackend: { selectedModel: 'remote-dev-model' },
        cliProxy: { reachable: true },
        langSmithTracing: { enabled: false },
      },
    });

    expect(screen.getByTestId('smarty-server-runtime-health').getAttribute('data-local-only')).toBe('false');
    expect(screen.getByTestId('smarty-server-health-local-mode').textContent).toBe('not-local-only');
  });

  it('keeps Smarty Server visual chrome on Agent Elements aliases instead of legacy visual tokens', () => {
    const panelSource = readFileSync(sourcePath, 'utf8');
    const chromeSource = readFileSync(chromeSourcePath, 'utf8');
    const source = `${panelSource}\n${chromeSource}`;

    expect(panelSource).toContain("import { createProviderPanelChrome, getProviderTestButtonClass } from './providerPanelChrome';");
    expect(panelSource).toContain('const chrome = createProviderPanelChrome({');
    expect(panelSource).toContain('chrome.header');
    expect(panelSource).toContain('chrome.section');
    expect(panelSource).toContain('chrome.input');
    expect(panelSource).toContain('getProviderTestButtonClass(config.testStatus, chrome)');
    expect(source).toContain('--agent-elements-card-inline-padding');
    expect(source).not.toMatch(legacyVisualChromePattern);
  });
});
