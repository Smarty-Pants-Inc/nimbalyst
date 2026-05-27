import React, { useState, useEffect } from 'react';
import { KeyboardShortcuts, getShortcutDisplay } from '../../../shared/KeyboardShortcuts';
import {
  getRegisteredKeybindings,
  subscribeToCommandRegistry,
  type RegisteredKeybinding,
} from '../../extensions/commands/ExtensionCommandRegistry';
import { getExtensionLoader, MaterialSymbol } from '@nimbalyst/runtime';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    label: string;
    shortcut: string;
  }>;
}

type TabId = 'general' | 'editor' | 'extensions';

const IS_MAC = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const keyboardShortcutTabs: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'general', label: 'General', icon: 'keyboard' },
  { id: 'editor', label: 'Editor Formatting', icon: 'format_bold' },
  { id: 'extensions', label: 'Extensions', icon: 'extension' },
];

/**
 * Convert a manifest key string like "ctrl+shift+g" to the display format
 * compatible with getShortcutDisplay (e.g., "Ctrl+Shift+G").
 */
function formatManifestKey(key: string): string {
  return key
    .split('+')
    .map(part => {
      const lower = part.toLowerCase();
      if (lower === 'ctrl') return 'Ctrl';
      if (lower === 'cmd') return 'Cmd';
      if (lower === 'shift') return 'Shift';
      if (lower === 'alt') return 'Alt';
      if (lower === 'option') return 'Option';
      // Single character keys get uppercased, multi-char stay as-is
      return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('+');
}

/**
 * Build extension shortcut groups from registered keybindings,
 * grouped by extension name.
 */
function buildExtensionShortcutGroups(keybindings: RegisteredKeybinding[]): ShortcutGroup[] {
  if (keybindings.length === 0) return [];

  // Group by extension ID
  const byExtension = new Map<string, RegisteredKeybinding[]>();
  for (const kb of keybindings) {
    const list = byExtension.get(kb.extensionId) ?? [];
    list.push(kb);
    byExtension.set(kb.extensionId, list);
  }

  // Resolve extension names
  const loader = getExtensionLoader();
  const groups: ShortcutGroup[] = [];

  for (const [extensionId, kbs] of byExtension) {
    const ext = loader.getExtension(extensionId);
    const title = ext?.manifest.name ?? extensionId;

    groups.push({
      title,
      shortcuts: kbs.map(kb => ({
        label: kb.commandTitle,
        shortcut: formatManifestKey(kb.key),
      })),
    });
  }

  return groups;
}

export function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [extensionGroups, setExtensionGroups] = useState<ShortcutGroup[]>([]);

  // Handle Escape key to close dialog
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Subscribe to extension keybinding changes
  useEffect(() => {
    function sync() {
      setExtensionGroups(buildExtensionShortcutGroups(getRegisteredKeybindings()));
    }
    sync();
    const unsubscribe = subscribeToCommandRegistry(sync);
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  // All general shortcuts are defined in: packages/electron/src/shared/KeyboardShortcuts.ts
  const generalShortcuts: ShortcutGroup[] = [
    {
      title: 'File',
      shortcuts: [
        { label: 'New File / New Session', shortcut: KeyboardShortcuts.file.newFile }, // shared/KeyboardShortcuts.ts:9 - Cmd+N
        { label: 'New Session (any mode)', shortcut: KeyboardShortcuts.file.newSessionGlobal }, // shared/KeyboardShortcuts.ts:11 - Cmd+Shift+N
        { label: 'Open File', shortcut: KeyboardShortcuts.file.open }, // shared/KeyboardShortcuts.ts:12 - Cmd+O
        { label: 'Open Folder', shortcut: KeyboardShortcuts.file.openFolder }, // shared/KeyboardShortcuts.ts:13 - Cmd+Shift+O
        { label: 'Save', shortcut: KeyboardShortcuts.file.save }, // shared/KeyboardShortcuts.ts:14 - Cmd+S
        { label: 'Close Tab', shortcut: KeyboardShortcuts.file.closeTab }, // shared/KeyboardShortcuts.ts:15 - Cmd+W
        { label: 'Reopen Closed Tab', shortcut: KeyboardShortcuts.file.reopenClosedTab }, // shared/KeyboardShortcuts.ts:16 - Cmd+Shift+T
        { label: 'Close Project', shortcut: KeyboardShortcuts.file.closeProject }, // shared/KeyboardShortcuts.ts:17 - Cmd+Shift+W
        { label: 'Quit', shortcut: KeyboardShortcuts.file.quit }, // shared/KeyboardShortcuts.ts:18 - Cmd+Q
      ],
    },
    {
      title: 'Edit',
      shortcuts: [
        { label: 'Undo', shortcut: KeyboardShortcuts.edit.undo }, // shared/KeyboardShortcuts.ts:23 - Cmd+Z
        { label: 'Redo', shortcut: KeyboardShortcuts.edit.redo }, // shared/KeyboardShortcuts.ts:24 - Cmd+Shift+Z
        { label: 'Cut', shortcut: KeyboardShortcuts.edit.cut }, // shared/KeyboardShortcuts.ts:25 - Cmd+X
        { label: 'Copy', shortcut: KeyboardShortcuts.edit.copy }, // shared/KeyboardShortcuts.ts:26 - Cmd+C
        { label: 'Paste', shortcut: KeyboardShortcuts.edit.paste }, // shared/KeyboardShortcuts.ts:28 - Cmd+V
        { label: 'Paste as Text', shortcut: KeyboardShortcuts.edit.pasteAsText }, // shared/KeyboardShortcuts.ts:29 - Cmd+Shift+V
        { label: 'Select All', shortcut: KeyboardShortcuts.edit.selectAll }, // shared/KeyboardShortcuts.ts:29 - Cmd+A
        { label: 'Find', shortcut: KeyboardShortcuts.edit.find }, // shared/KeyboardShortcuts.ts:30 - Cmd+F
        { label: 'Find Next', shortcut: KeyboardShortcuts.edit.findNext }, // shared/KeyboardShortcuts.ts:31 - Cmd+G
        { label: 'Find Previous', shortcut: KeyboardShortcuts.edit.findPrevious }, // shared/KeyboardShortcuts.ts:32 - Cmd+Shift+G
        { label: 'View Local History', shortcut: KeyboardShortcuts.edit.viewHistory }, // shared/KeyboardShortcuts.ts:34 - Cmd+Y
        { label: 'Approve Current Action', shortcut: KeyboardShortcuts.edit.approve }, // shared/KeyboardShortcuts.ts:35 - Cmd+Enter
        { label: 'Reject Current Action', shortcut: KeyboardShortcuts.edit.reject }, // shared/KeyboardShortcuts.ts:36 - Cmd+Shift+Backspace
        { label: 'Toggle Plan Mode (Claude Code)', shortcut: 'Shift+Tab' }, // AIInput.tsx - toggle between Plan/Agent mode
      ],
    },
    {
      title: 'View',
      shortcuts: [
        { label: 'Files Mode', shortcut: KeyboardShortcuts.view.filesMode }, // shared/KeyboardShortcuts.ts:42 - Cmd+E
        { label: 'Agent Mode', shortcut: KeyboardShortcuts.view.agentMode }, // shared/KeyboardShortcuts.ts:43 - Cmd+K
        { label: 'Session Kanban View', shortcut: KeyboardShortcuts.window.kanbanView }, // shared/KeyboardShortcuts.ts:81 - Cmd+Shift+K
        { label: 'Toggle AI Chat Panel', shortcut: KeyboardShortcuts.view.toggleAIChat }, // shared/KeyboardShortcuts.ts:46 - Cmd+Shift+A
        { label: 'Toggle Bottom Panel', shortcut: KeyboardShortcuts.view.toggleBottomPanel }, // shared/KeyboardShortcuts.ts:47 - Cmd+J
        { label: 'Toggle Terminal Panel', shortcut: KeyboardShortcuts.view.toggleTerminalPanel }, // shared/KeyboardShortcuts.ts:48 - Ctrl+`
        { label: 'Tracker Mode', shortcut: KeyboardShortcuts.view.trackerMode }, // shared/KeyboardShortcuts.ts:49 - Cmd+T
        { label: 'Shared Documents', shortcut: KeyboardShortcuts.view.collabMode }, // shared/KeyboardShortcuts.ts:50 - Cmd+D
        { label: 'Toggle Sidebar', shortcut: KeyboardShortcuts.view.toggleSidebar }, // shared/KeyboardShortcuts.ts:51 - Cmd+B
        { label: 'Navigate Back', shortcut: KeyboardShortcuts.view.navigateBack }, // shared/KeyboardShortcuts.ts:52 - Cmd+[
        { label: 'Navigate Forward', shortcut: KeyboardShortcuts.view.navigateForward }, // shared/KeyboardShortcuts.ts:53 - Cmd+]
        { label: 'Next Tab', shortcut: KeyboardShortcuts.view.nextTab }, // shared/KeyboardShortcuts.ts:56 - Cmd+Option+Right
        { label: 'Previous Tab', shortcut: KeyboardShortcuts.view.prevTab }, // shared/KeyboardShortcuts.ts:57 - Cmd+Option+Left
        { label: 'Actual Size', shortcut: KeyboardShortcuts.view.actualSize }, // shared/KeyboardShortcuts.ts:60 - Cmd+0
        { label: 'Zoom In', shortcut: KeyboardShortcuts.view.zoomIn }, // shared/KeyboardShortcuts.ts:61 - Cmd+Plus
        { label: 'Zoom Out', shortcut: KeyboardShortcuts.view.zoomOut }, // shared/KeyboardShortcuts.ts:62 - Cmd+-
        { label: 'Toggle Full Screen', shortcut: KeyboardShortcuts.view.toggleFullScreen }, // shared/KeyboardShortcuts.ts:70 - Ctrl+Cmd+F
      ],
    },
    {
      title: 'Window',
      shortcuts: [
        { label: 'Project Manager', shortcut: KeyboardShortcuts.window.workspaceManager }, // shared/KeyboardShortcuts.ts:75 - Cmd+P
        { label: 'Switch Project', shortcut: KeyboardShortcuts.window.projectQuickOpen }, // shared/KeyboardShortcuts.ts - Cmd+Shift+P
        { label: 'Session Quick Open', shortcut: KeyboardShortcuts.window.sessionQuickOpen }, // shared/KeyboardShortcuts.ts:77 - Cmd+L
        { label: 'Prompt Quick Open', shortcut: KeyboardShortcuts.window.promptQuickOpen }, // shared/KeyboardShortcuts.ts:78 - Cmd+Shift+L
        { label: 'Content Search', shortcut: KeyboardShortcuts.window.contentSearch }, // shared/KeyboardShortcuts.ts:79 - Cmd+Shift+F
        { label: 'New Worktree', shortcut: KeyboardShortcuts.window.newWorktree }, // shared/KeyboardShortcuts.ts:81 - Cmd+Alt+W
        { label: 'Settings', shortcut: KeyboardShortcuts.window.aiModels }, // shared/KeyboardShortcuts.ts:82 - Cmd+,
        { label: 'Minimize', shortcut: KeyboardShortcuts.window.minimize }, // shared/KeyboardShortcuts.ts:83 - Cmd+M
      ],
    },
  ];

  // Editor shortcuts are defined in: packages/runtime/src/editor/plugins/ShortcutsPlugin/shortcuts.ts
  const editorShortcuts: ShortcutGroup[] = [
    {
      title: 'Text Formatting',
      shortcuts: [
        { label: 'Bold', shortcut: IS_MAC ? '⌘+B' : 'Ctrl+B' }, // shortcuts.ts:48 - BOLD
        { label: 'Italic', shortcut: IS_MAC ? '⌘+I' : 'Ctrl+I' }, // shortcuts.ts:49 - ITALIC
        { label: 'Underline', shortcut: IS_MAC ? '⌘+U' : 'Ctrl+U' }, // shortcuts.ts:50 - UNDERLINE
        { label: 'Strikethrough', shortcut: IS_MAC ? '⌘+Shift+X' : 'Ctrl+Shift+X' }, // shortcuts.ts:31 - STRIKETHROUGH
        { label: 'Insert Link', shortcut: IS_MAC ? '⌘+K' : 'Ctrl+K' }, // shortcuts.ts:51 - INSERT_LINK
        { label: 'Clear Formatting', shortcut: IS_MAC ? '⌘+\\' : 'Ctrl+\\' }, // shortcuts.ts:45 - CLEAR_FORMATTING
      ],
    },
    {
      title: 'Paragraph Formatting',
      shortcuts: [
        { label: 'Normal Text', shortcut: IS_MAC ? '⌘+Opt+0' : 'Ctrl+Alt+0' }, // shortcuts.ts:16 - NORMAL
        { label: 'Heading 1', shortcut: IS_MAC ? '⌘+Opt+1' : 'Ctrl+Alt+1' }, // shortcuts.ts:17 - HEADING1
        { label: 'Heading 2', shortcut: IS_MAC ? '⌘+Opt+2' : 'Ctrl+Alt+2' }, // shortcuts.ts:18 - HEADING2
        { label: 'Heading 3', shortcut: IS_MAC ? '⌘+Opt+3' : 'Ctrl+Alt+3' }, // shortcuts.ts:19 - HEADING3
        { label: 'Numbered List', shortcut: IS_MAC ? '⌘+Shift+7' : 'Ctrl+Shift+7' }, // shortcuts.ts:20 - NUMBERED_LIST
        { label: 'Bullet List', shortcut: IS_MAC ? '⌘+Shift+8' : 'Ctrl+Shift+8' }, // shortcuts.ts:21 - BULLET_LIST
        { label: 'Check List', shortcut: IS_MAC ? '⌘+Shift+9' : 'Ctrl+Shift+9' }, // shortcuts.ts:22 - CHECK_LIST
        { label: 'Code Block', shortcut: IS_MAC ? '⌘+Opt+C' : 'Ctrl+Alt+C' }, // shortcuts.ts:23 - CODE_BLOCK
        { label: 'Quote', shortcut: IS_MAC ? '⌃+Shift+Q' : 'Ctrl+Shift+Q' }, // shortcuts.ts:24 - QUOTE
      ],
    },
    {
      title: 'Text Alignment',
      shortcuts: [
        { label: 'Left Align', shortcut: IS_MAC ? '⌘+Shift+L' : 'Ctrl+Shift+L' }, // shortcuts.ts:37 - LEFT_ALIGN
        { label: 'Center Align', shortcut: IS_MAC ? '⌘+Shift+E' : 'Ctrl+Shift+E' }, // shortcuts.ts:35 - CENTER_ALIGN
        { label: 'Right Align', shortcut: IS_MAC ? '⌘+Shift+R' : 'Ctrl+Shift+R' }, // shortcuts.ts:38 - RIGHT_ALIGN
        { label: 'Justify', shortcut: IS_MAC ? '⌘+Shift+J' : 'Ctrl+Shift+J' }, // shortcuts.ts:36 - JUSTIFY_ALIGN
        { label: 'Indent', shortcut: IS_MAC ? '⌘+]' : 'Ctrl+]' }, // shortcuts.ts:43 - INDENT
        { label: 'Outdent', shortcut: IS_MAC ? '⌘+[' : 'Ctrl+[' }, // shortcuts.ts:44 - OUTDENT
      ],
    },
    {
      title: 'Text Case & Size',
      shortcuts: [
        { label: 'Lowercase', shortcut: IS_MAC ? '⌃+Shift+1' : 'Ctrl+Shift+1' }, // shortcuts.ts:32 - LOWERCASE
        { label: 'Uppercase', shortcut: IS_MAC ? '⌃+Shift+2' : 'Ctrl+Shift+2' }, // shortcuts.ts:33 - UPPERCASE
        { label: 'Capitalize', shortcut: IS_MAC ? '⌃+Shift+3' : 'Ctrl+Shift+3' }, // shortcuts.ts:34 - CAPITALIZE
        { label: 'Increase Font Size', shortcut: IS_MAC ? '⌘+Shift+.' : 'Ctrl+Shift+.' }, // shortcuts.ts:28 - INCREASE_FONT_SIZE
        { label: 'Decrease Font Size', shortcut: IS_MAC ? '⌘+Shift+,' : 'Ctrl+Shift+,' }, // shortcuts.ts:29 - DECREASE_FONT_SIZE
        { label: 'Subscript', shortcut: IS_MAC ? '⌘+,' : 'Ctrl+,' }, // shortcuts.ts:41 - SUBSCRIPT
        { label: 'Superscript', shortcut: IS_MAC ? '⌘+.' : 'Ctrl+.' }, // shortcuts.ts:42 - SUPERSCRIPT
      ],
    },
  ];

  const shortcutGroups = activeTab === 'general'
    ? generalShortcuts
    : activeTab === 'editor'
    ? editorShortcuts
    : extensionGroups;

  return (
    <div
      className="keyboard-shortcuts-dialog-overlay nim-overlay agent-elements-keyboard-shortcuts-dialog-backdrop bg-[color-mix(in_srgb,var(--an-foreground)_36%,transparent)]"
      data-testid="agent-elements-keyboard-shortcuts-dialog-backdrop"
      data-agent-elements-shell="keyboard-shortcuts-dialog-backdrop"
      onClick={onClose}
    >
      <div
        className="keyboard-shortcuts-dialog agent-elements-keyboard-shortcuts-dialog agent-elements-tool-card flex h-[85vh] w-[90vw] max-w-[900px] flex-col overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)]"
        data-testid="agent-elements-keyboard-shortcuts-dialog"
        data-component="KeyboardShortcutsDialog"
        data-agent-elements-shell="keyboard-shortcuts-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="keyboard-shortcuts-dialog-header agent-elements-keyboard-shortcuts-dialog-header flex items-center justify-between gap-3 border-b border-[var(--an-border-color)] p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-keyboard-shortcuts-dialog-header"
          data-agent-elements-shell="keyboard-shortcuts-dialog-header"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="agent-elements-keyboard-shortcuts-dialog-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground-muted)]"
              data-agent-elements-shell="keyboard-shortcuts-dialog-icon"
              aria-hidden="true"
            >
              <MaterialSymbol icon="keyboard" size={18} />
            </span>
            <h2 className="m-0 min-w-0 truncate text-sm font-medium text-[var(--an-foreground)]">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            className="keyboard-shortcuts-dialog-close agent-elements-keyboard-shortcuts-dialog-close flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent p-0 text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            data-testid="agent-elements-keyboard-shortcuts-dialog-close"
            data-agent-elements-shell="keyboard-shortcuts-dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            <MaterialSymbol icon="close" size={18} />
          </button>
        </div>

        {/* Tab navigation */}
        <div
          className="agent-elements-keyboard-shortcuts-dialog-tabs flex gap-1 border-b border-[var(--an-border-color)] px-[var(--an-spacing-xl)] py-[var(--an-spacing-md)]"
          data-testid="agent-elements-keyboard-shortcuts-dialog-tabs"
          data-agent-elements-shell="keyboard-shortcuts-dialog-tabs"
        >
          {keyboardShortcutTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`agent-elements-keyboard-shortcuts-tab inline-flex items-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] ${
                activeTab === tab.id
                  ? 'border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground)]'
                  : 'text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]'
              }`}
              data-testid={`agent-elements-keyboard-shortcuts-tab-${tab.id}`}
              data-agent-elements-shell="keyboard-shortcuts-dialog-tab"
              aria-selected={activeTab === tab.id}
            >
              <MaterialSymbol icon={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className="keyboard-shortcuts-dialog-content agent-elements-keyboard-shortcuts-dialog-content grid flex-1 grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[var(--an-spacing-xl)] overflow-y-auto p-[var(--an-spacing-xl)] max-[900px]:grid-cols-1 max-[600px]:p-[var(--an-spacing-lg)]"
          data-agent-elements-shell="keyboard-shortcuts-dialog-content"
        >
          {shortcutGroups.length === 0 && activeTab === 'extensions' ? (
            <div
              className="agent-elements-keyboard-shortcuts-empty rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xl)] text-sm leading-relaxed text-[var(--an-foreground-muted)]"
              data-agent-elements-shell="keyboard-shortcuts-dialog-empty"
            >
              No extension keybindings registered. Extensions can contribute keybindings via their manifest.json.
            </div>
          ) : (
            shortcutGroups.map((group) => (
              <div
                key={group.title}
                className="keyboard-shortcuts-group agent-elements-keyboard-shortcuts-group flex flex-col gap-3 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]"
                data-testid={`agent-elements-keyboard-shortcuts-group-${group.title}`}
                data-agent-elements-shell="keyboard-shortcuts-dialog-group"
              >
                <div className="keyboard-shortcuts-group-title-row flex items-center justify-between gap-3">
                  <h3 className="keyboard-shortcuts-group-title m-0 text-xs font-medium text-[var(--an-foreground-muted)]">
                    {group.title}
                  </h3>
                  <span className="rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2 py-0.5 text-xs text-[var(--an-foreground-muted)]">
                    {group.shortcuts.length}
                  </span>
                </div>
                <div className="keyboard-shortcuts-list agent-elements-keyboard-shortcuts-list flex flex-col gap-1">
                  {group.shortcuts.map((item) => (
                    <div
                      key={item.label}
                      className="keyboard-shortcut-item agent-elements-keyboard-shortcut-item flex items-center justify-between gap-4 rounded-[var(--an-input-border-radius)] px-2 py-1.5 transition-[background-color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)]"
                      data-agent-elements-shell="keyboard-shortcuts-dialog-item"
                    >
                      <span className="keyboard-shortcut-label flex-1 text-sm text-[var(--an-foreground)]">
                        {item.label}
                      </span>
                      <kbd
                        className="keyboard-shortcut-key agent-elements-keyboard-shortcut-key min-w-[60px] whitespace-nowrap rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-2.5 py-1 text-center font-sans text-[13px] font-medium text-[var(--an-foreground)]"
                        data-testid="agent-elements-keyboard-shortcut-key"
                      >
                        {getShortcutDisplay(item.shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div
          className="agent-elements-keyboard-shortcuts-dialog-footer border-t border-[var(--an-border-color)] px-[var(--an-spacing-xl)] py-[var(--an-spacing-md)] text-xs text-[var(--an-foreground-muted)]"
          data-testid="agent-elements-keyboard-shortcuts-dialog-footer"
          data-agent-elements-shell="keyboard-shortcuts-dialog-footer"
        >
          Press <kbd className="mx-1 rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-1.5 py-0.5">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
