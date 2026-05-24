// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AIInput } from '../AIInput';

vi.mock('jotai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jotai')>();
  return {
    ...actual,
    useAtomValue: vi.fn((atom: { key?: string }) => {
    if (atom?.key === 'sessionRegistry') return new Map();
    return [];
    }),
    useSetAtom: vi.fn(() => vi.fn()),
  };
});

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
    }: {
      icon: string;
      size?: number;
      className?: string;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className }),
    readClipboard: vi.fn(async () => ''),
  };
});

vi.mock('../../../store', () => ({
  fileMentionOptionsAtom: (workspacePath: string) => ({ key: 'fileMentionOptions', workspacePath }),
  searchFileMentionAtom: { key: 'searchFileMention' },
  sessionMentionOptionsAtom: (workspacePath: string) => ({ key: 'sessionMentionOptions', workspacePath }),
  searchSessionMentionAtom: { key: 'searchSessionMention' },
  sessionRegistryAtom: { key: 'sessionRegistry' },
}));

vi.mock('../../../store/atoms/voiceModeState', () => ({
  pendingVoiceCommandAtom: { key: 'pendingVoiceCommand' },
  voiceActiveSessionIdAtom: { key: 'voiceActiveSessionId' },
}));

vi.mock('../VoiceModeButton.tsx', () => ({
  registerPendingVoiceCommandSetter: vi.fn(() => vi.fn()),
}));

vi.mock('../../../hooks/useAIInputUndo', () => ({
  useAIInputUndo: () => ({
    pushSnapshot: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    clear: vi.fn(),
    getUndoCount: vi.fn(() => 0),
  }),
}));

vi.mock('../interactivePrompts', () => ({
  MemoryPromptIndicator: () => <div data-testid="mock-memory-prompt" />,
  MemorySaveButton: ({ onSave, disabled }: { onSave: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onSave} disabled={disabled}>
      Save memory
    </button>
  ),
  useMemoryMode: () => ({
    isMemoryMode: false,
    memoryTarget: 'project',
    isSaving: false,
    enterMemoryMode: vi.fn(),
    exitMemoryMode: vi.fn(),
    toggleMemoryTarget: vi.fn(),
    setMemoryTarget: vi.fn(),
    saveToMemory: vi.fn(async () => true),
  }),
  shouldActivateMemoryMode: vi.fn(() => false),
  getMemoryContent: vi.fn((value: string) => value),
}));

vi.mock('../../AgenticCoding/AttachmentPreviewList', () => ({
  AttachmentPreviewList: () => <div data-testid="mock-attachment-preview-list" />,
}));

vi.mock('../../Typeahead/GenericTypeahead', () => ({
  GenericTypeahead: () => <div data-testid="mock-typeahead" />,
}));

vi.mock('../../Typeahead/slashCommandAutocomplete', () => ({
  buildSlashCommandOptions: vi.fn(() => []),
  fetchSlashCommandEntries: vi.fn(async () => []),
}));

vi.mock('../../../help', () => ({
  HelpTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../PendingVoiceCommand', () => ({
  PendingVoiceCommand: () => null,
}));

vi.mock('../MockupAnnotationIndicator', () => ({
  MockupAnnotationIndicator: () => null,
}));

vi.mock('../TextSelectionIndicator', () => ({
  TextSelectionIndicator: () => null,
}));

vi.mock('../EditorContextIndicator', () => ({
  EditorContextIndicator: () => null,
}));

const sourcePath = resolve(__dirname, '../AIInput.tsx');

describe('UnifiedAI AIInput Agent Elements shell', () => {
  it('wraps the composer in Agent Elements input-bar chrome and preserves click/keyboard send behavior', () => {
    const onSend = vi.fn();
    const onChange = vi.fn();

    render(
      <AIInput
        value="Ship the composer shell"
        onChange={onChange}
        onSend={onSend}
        testId="composer-textarea"
      />,
    );

    const shell = screen.getByTestId('agent-elements-ai-input');
    expect(shell).toHaveClass('ai-chat-input', 'agent-elements-ai-input');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'ai-input');
    expect(shell).toHaveAttribute('data-component', 'UnifiedAIInput');
    expect(shell).toHaveAttribute('data-input-state', 'idle');
    expect(shell).toHaveAttribute('data-memory-mode', 'false');

    expect(screen.getByTestId('agent-elements-ai-input-resize-handle')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-ai-input-field-shell')).toHaveAttribute('data-drag-active', 'false');

    const textarea = screen.getByTestId('composer-textarea');
    expect(textarea).toHaveClass('agent-elements-ai-input-field');
    expect(textarea).toHaveAttribute('aria-label', 'Message composer');

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Ship the composer shell');

    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    expect(onSend).toHaveBeenCalledTimes(2);
  });

  it('preserves cancel behavior while using Agent Elements stop-button treatment', () => {
    const onCancel = vi.fn();

    render(
      <AIInput
        value="Cancel this run"
        onChange={vi.fn()}
        onSend={vi.fn()}
        onCancel={onCancel}
        isLoading
        testId="composer-textarea"
      />,
    );

    const shell = screen.getByTestId('agent-elements-ai-input');
    expect(shell).toHaveAttribute('data-input-state', 'loading');

    const cancel = screen.getByRole('button', { name: /cancel request/i });
    expect(cancel).toHaveClass('agent-elements-ai-input-stop');
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByTestId('composer-textarea'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('keeps AIInput source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-ai-input');
    expect(source).toContain('data-agent-elements-shell');
    expect(source).toContain('MaterialSymbol');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/bg-red|text-white|hover:.*scale|transition-all/);
    expect(source).not.toMatch(/<svg|<path/);
  });
});
