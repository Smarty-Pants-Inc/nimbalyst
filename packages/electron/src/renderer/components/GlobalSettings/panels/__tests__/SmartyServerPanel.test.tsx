import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SmartyServerPanel } from '../SmartyServerPanel';

function renderPanel(config: Record<string, any>) {
  return render(
    <SmartyServerPanel
      config={{
        enabled: true,
        baseUrl: 'http://127.0.0.1:8788',
        defaultModel: 'smarty-server:smarty_coding_agent',
        testStatus: 'idle',
        ...config,
      } as any}
      apiKeys={{}}
      availableModels={[]}
      loading={false}
      onToggle={vi.fn()}
      onApiKeyChange={vi.fn()}
      onModelToggle={vi.fn()}
      onSelectAllModels={vi.fn()}
      onTestConnection={vi.fn()}
      onConfigChange={vi.fn()}
    />,
  );
}

describe('SmartyServerPanel runtime health display', () => {
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
});
