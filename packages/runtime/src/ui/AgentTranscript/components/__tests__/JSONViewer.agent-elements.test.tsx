import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JSONViewer } from '../JSONViewer';

const jsonViewerSourcePath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentTranscript/components/JSONViewer.tsx',
);
const primitivesCssPath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentElements/AgentElementsPrimitives.css',
);

describe('JSONViewer Agent Elements shell', () => {
  beforeEach(() => {
    document.getElementById('json-viewer-styles')?.remove();
  });

  it('renders debug JSON inside a selectable Agent Elements shell', () => {
    render(
      <JSONViewer
        data={{
          ok: true,
          count: 2,
          path: '/repo/src/app.ts',
          nested: { value: null },
        }}
      />,
    );

    const viewer = screen.getByTestId('agent-elements-json-viewer');
    expect(viewer).toHaveClass('json-viewer');
    expect(viewer).toHaveClass('agent-elements-json-viewer');
    expect(viewer).toHaveClass('agent-elements-debug-payload');
    expect(viewer).toHaveAttribute('data-agent-elements-shell', 'json-viewer');
    expect(viewer).toHaveAttribute('data-component', 'JSONViewer');
    expect(viewer).toHaveAttribute('data-debug-only', 'true');
    expect(viewer).not.toHaveAttribute('style');
    expect(viewer).toHaveTextContent('"ok"');
    expect(viewer).toHaveTextContent('true');
    expect(viewer).toHaveTextContent('"path"');
    expect(viewer).toHaveTextContent('/repo/src/app.ts');
    expect(viewer).toHaveTextContent('null');
    expect(screen.getByText('"ok"')).toHaveClass('json-key');
    expect(screen.getByText('true')).toHaveClass('json-boolean');
    expect(screen.getByText('null')).toHaveClass('json-null');
    expect(document.getElementById('json-viewer-styles')).toBeNull();
  });

  it('keeps JSONViewer styling in Agent Elements source-owned CSS, not injected hardcoded syntax styles', () => {
    const source = fs.readFileSync(jsonViewerSourcePath, 'utf8');
    const primitivesCss = fs.readFileSync(primitivesCssPath, 'utf8');

    expect(source).not.toContain('document.createElement');
    expect(source).not.toContain('injectJSONViewerStyles');
    expect(source).not.toContain('useEffect');
    expect(source).not.toContain('style={{');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(source).not.toContain('--nim-');

    expect(primitivesCss).toContain('.agent-elements-json-viewer');
    expect(primitivesCss).toContain('.agent-elements-json-viewer .json-key');
    expect(primitivesCss).toContain('color: var(--an-code-color);');
    expect(primitivesCss).toContain('background: var(--an-code-background);');
    expect(primitivesCss).toContain('user-select: text;');
  });
});
