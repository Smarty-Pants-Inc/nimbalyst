// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearMockupAnnotationsForFile,
  MockupAnnotationIndicator,
  notifyMockupAnnotationChanged,
} from '../MockupAnnotationIndicator';
import {
  clearTextSelection,
  setTextSelection,
  TextSelectionIndicator,
} from '../TextSelectionIndicator';
import { EditorContextIndicator } from '../EditorContextIndicator';
import { clearEditorContext, setEditorContext } from '../../../stores/editorContextStore';

const sourcePaths = [
  resolve(__dirname, '../MockupAnnotationIndicator.tsx'),
  resolve(__dirname, '../TextSelectionIndicator.tsx'),
  resolve(__dirname, '../EditorContextIndicator.tsx'),
];

describe('UnifiedAI inline context indicators Agent Elements shell', () => {
  afterEach(() => {
    cleanup();
    clearMockupAnnotationsForFile('/workspace/mockup.nim');
    clearTextSelection();
    clearEditorContext('/workspace/screen.tsx');
    for (const key of [
      '__mockupFilePath',
      '__mockupSelectedElement',
      '__mockupDrawing',
      '__mockupDrawingPaths',
      '__mockupAnnotationTimestamp',
    ]) {
      delete (window as unknown as Record<string, unknown>)[key];
    }
  });

  it('renders mockup annotation context as an Agent Elements chip when fresh', () => {
    Object.assign(window, {
      __mockupFilePath: '/workspace/mockup.nim',
      __mockupSelectedElement: { id: 'button' },
      __mockupAnnotationTimestamp: Date.now(),
    });
    notifyMockupAnnotationChanged();

    render(
      <MockupAnnotationIndicator
        currentFilePath="/workspace/mockup.nim"
        lastUserMessageTimestamp={Date.now() - 5000}
      />
    );

    const chip = screen.getByText('+ mockup annotations').closest('.mockup-annotation-indicator');
    expect(chip).toHaveClass('agent-elements-context-chip');
    expect(chip).toHaveAttribute('data-agent-elements-shell', 'mockup-context-chip');
    expect(chip).toHaveAttribute('data-component', 'UnifiedAIMockupAnnotationIndicator');
    expect(chip).toHaveAttribute(
      'title',
      'Annotations drawn on your mockup will be included with your prompt'
    );
  });

  it('renders selected editor text as an Agent Elements chip when fresh', () => {
    setTextSelection('selected function body', '/workspace/file.ts');

    render(
      <TextSelectionIndicator
        currentFilePath="/workspace/file.ts"
        lastUserMessageTimestamp={Date.now() - 5000}
      />
    );

    const chip = screen.getByText('+ selection').closest('.text-selection-indicator');
    expect(chip).toHaveClass('agent-elements-context-chip');
    expect(chip).toHaveAttribute('data-agent-elements-shell', 'text-selection-context-chip');
    expect(chip).toHaveAttribute('data-component', 'UnifiedAITextSelectionIndicator');
    expect(chip).toHaveAttribute(
      'title',
      'Selected text will be included: "selected function body"'
    );
  });

  it('renders extension editor context as an Agent Elements chip when fresh', () => {
    setEditorContext('/workspace/screen.tsx', {
      label: 'Screen: Login Page',
      description: 'Current mockup screen and selected component hierarchy',
    });

    render(
      <EditorContextIndicator
        currentFilePath="/workspace/screen.tsx"
        lastUserMessageTimestamp={Date.now() - 5000}
      />
    );

    const chip = screen.getByText('+ Screen: Login Page').closest('.editor-context-indicator');
    expect(chip).toHaveClass('agent-elements-context-chip');
    expect(chip).toHaveAttribute('data-agent-elements-shell', 'editor-context-chip');
    expect(chip).toHaveAttribute('data-component', 'UnifiedAIEditorContextIndicator');
    expect(chip).toHaveAttribute(
      'title',
      'Current mockup screen and selected component hierarchy'
    );
  });

  it('keeps inline context indicator sources on Agent Elements-compatible visual rules', () => {
    const source = sourcePaths.map((path) => readFileSync(path, 'utf8')).join('\n');

    expect(source).toContain('agent-elements-context-chip');
    expect(source).toContain('data-agent-elements-shell');
    expect(source).not.toMatch(/<style|style=\{\{/);
    expect(source).not.toMatch(/rgba\(|#(?:[0-9a-fA-F]{3}){1,2}\b/);
    expect(source).not.toMatch(/bg-nim|text-nim|bg-\[var\(--nim|text-\[var\(--nim|var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/text-white|uppercase|tracking-|hover:shadow|active:scale|transition-all/);
    expect(source).not.toMatch(/shadow-\[/);
  });
});
