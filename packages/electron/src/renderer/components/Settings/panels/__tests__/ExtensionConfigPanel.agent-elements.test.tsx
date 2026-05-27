// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ExtensionConfigPanel } from '../ExtensionConfigPanel';

const extensionConfigPanelSourcePath = path.join(__dirname, '../ExtensionConfigPanel.tsx');

const manifest = {
  id: 'demo.extension',
  name: 'Demo Extension',
  version: '1.0.0',
  contributes: {},
  contributions: {
    configuration: {
      title: 'Demo configuration',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Enable formatter',
          default: false,
          order: 1,
        },
        mode: {
          type: 'string',
          description: 'Mode',
          default: 'compact',
          enum: ['compact', 'expanded'],
          enumDescriptions: ['Compact', 'Expanded'],
          order: 2,
        },
        label: {
          type: 'string',
          description: 'Label',
          default: 'Default label',
          placeholder: 'Label',
          order: 3,
        },
        limit: {
          type: 'number',
          description: 'Limit',
          default: 3,
          minimum: 1,
          maximum: 9,
          order: 4,
        },
        metadata: {
          type: 'object',
          description: 'Metadata',
          default: { sample: true },
          order: 5,
        },
      },
    },
  },
} as any;

describe('ExtensionConfigPanel Agent Elements shell', () => {
  beforeEach(() => {
    (window as any).electronAPI = {
      extensions: {
        getConfig: vi.fn((extensionId: string, scope: string) => {
          if (extensionId !== 'demo.extension') return Promise.resolve({});
          if (scope === 'user') {
            return Promise.resolve({ label: 'User label', limit: 4 });
          }
          if (scope === 'workspace') {
            return Promise.resolve({ mode: 'expanded' });
          }
          return Promise.resolve({});
        }),
        setConfig: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it('renders Agent Elements markers while preserving merged extension config behavior', async () => {
    const onConfigChange = vi.fn();

    render(
      <ExtensionConfigPanel
        extensionId="demo.extension"
        manifest={manifest}
        scope="project"
        workspacePath="/workspace"
        onConfigChange={onConfigChange}
      />,
    );

    expect(screen.getByTestId('agent-elements-extension-config-loading')).toHaveAttribute(
      'data-agent-elements-shell',
      'extension-config-loading',
    );

    const panel = await screen.findByTestId('agent-elements-extension-config-panel');
    expect(panel).toHaveAttribute('data-component', 'ExtensionConfigPanel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'extension-config-panel');
    expect(screen.getByTestId('agent-elements-extension-config-header')).toHaveTextContent('Demo configuration');
    expect(screen.getByTestId('agent-elements-extension-config-fields')).toHaveClass('agent-elements-extension-config-fields');

    expect(screen.getByLabelText('Enable formatter')).not.toBeChecked();
    expect(screen.getByLabelText('Mode')).toHaveValue('expanded');
    expect(screen.getByLabelText('Label')).toHaveValue('User label');
    expect(screen.getByLabelText('Limit')).toHaveValue(4);
    expect(screen.getByTestId('agent-elements-extension-config-unsupported-metadata')).toHaveTextContent('{"sample":true}');

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Workspace label' } });
    await waitFor(() => {
      expect((window as any).electronAPI.extensions.setConfig).toHaveBeenCalledWith(
        'demo.extension',
        'label',
        'Workspace label',
        'workspace',
        '/workspace',
      );
      expect(onConfigChange).toHaveBeenCalled();
    });
  });

  it('renders empty extension config with Agent Elements status chrome', () => {
    render(
      <ExtensionConfigPanel
        extensionId="empty.extension"
        manifest={{ contributions: { configuration: { properties: {} } } } as any}
        scope="user"
      />,
    );

    const empty = screen.getByTestId('agent-elements-extension-config-empty');
    expect(empty).toHaveAttribute('data-agent-elements-shell', 'extension-config-empty');
    expect(empty).toHaveTextContent('This extension has no configurable settings.');
  });

  it('keeps ExtensionConfigPanel visual chrome on Agent Elements aliases', () => {
    const source = readFileSync(extensionConfigPanelSourcePath, 'utf8');

    expect(source).toContain('agent-elements-extension-config-panel');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-foreground-muted');
    expect(source).toContain('--an-input-background');
    expect(source).toContain('--an-primary-color');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba\(/);
    expect(source).not.toMatch(/bg-white|text-white|rounded-lg|shadow-lg|transition-all/);
  });
});
