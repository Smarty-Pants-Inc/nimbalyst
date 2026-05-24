// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkspaceSummaryHeader, generateWorkspaceAccentColor } from '../WorkspaceSummaryHeader';

const sourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../WorkspaceSummaryHeader.tsx'
);

describe('WorkspaceSummaryHeader Agent Elements shell', () => {
  it('renders Agent Elements header chrome while preserving title, subtitle, path, actions, and accent controls', () => {
    const workspacePath = '/Users/paulbettner/Projects/smarty-code/forks/nimbalyst';

    render(
      <WorkspaceSummaryHeader
        workspacePath={workspacePath}
        workspaceName="Nimbalyst"
        subtitle={<span data-testid="workspace-summary-subtitle-content">Editor</span>}
        actions={<button type="button">Refresh</button>}
        headerClassName="custom-header-class"
        actionsClassName="custom-actions-class"
      />
    );

    const accent = screen.getByTestId('workspace-summary-header-accent');
    expect(accent).toHaveClass('workspace-color-accent', 'agent-elements-workspace-summary-header-accent');
    expect(accent).toHaveAttribute('data-agent-elements-shell', 'workspace-summary-header-accent');
    expect(accent).toHaveStyle({ backgroundColor: generateWorkspaceAccentColor(workspacePath) });

    const header = screen.getByTestId('workspace-summary-header');
    expect(header).toHaveClass('workspace-summary-header', 'agent-elements-workspace-summary-header', 'custom-header-class');
    expect(header).toHaveAttribute('data-component', 'WorkspaceSummaryHeader');
    expect(header).toHaveAttribute('data-agent-elements-shell', 'workspace-summary-header');
    expect(header.className).not.toMatch(/border-\[var\(--nim|bg-\[var\(--nim|text-\[var\(--nim|tracking-tight|opacity-70|opacity-75/);

    expect(screen.getByText('Nimbalyst')).toHaveClass('agent-elements-workspace-summary-header-name');
    expect(screen.getByTestId('workspace-summary-subtitle-content').parentElement).toHaveClass(
      'agent-elements-workspace-summary-header-subtitle'
    );

    const actions = screen.getByTestId('workspace-summary-header-actions');
    expect(actions).toHaveClass('agent-elements-workspace-summary-header-actions', 'custom-actions-class');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();

    const path = screen.getByTestId('workspace-summary-header-path');
    expect(path).toHaveClass('agent-elements-workspace-summary-header-path');
    expect(path).toHaveTextContent('/Users/paulbettner/Projects/smarty-code/forks/nimbalyst');
    expect(path).toHaveAttribute('title', '/Users/paulbettner/Projects/smarty-code/forks/nimbalyst');
  });

  it('preserves fallback naming and hidden accent behavior', () => {
    render(
      <WorkspaceSummaryHeader
        workspacePath="/tmp/example-workspace"
        showAccent={false}
      />
    );

    expect(screen.queryByTestId('workspace-summary-header-accent')).not.toBeInTheDocument();
    expect(screen.getByText('example-workspace')).toBeInTheDocument();
  });

  it('keeps source styling constrained to Agent Elements-compatible header tokens', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-workspace-summary-header');
    expect(source).toContain('data-agent-elements-shell="workspace-summary-header"');
    expect(source).toContain('generateWorkspaceAccentColor');
    expect(source).not.toMatch(/border-\[var\(--nim|bg-\[var\(--nim|text-\[var\(--nim/);
    expect(source).not.toMatch(/tracking-tight|opacity-70|opacity-75|text-white/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl|transition-all/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
  });
});
