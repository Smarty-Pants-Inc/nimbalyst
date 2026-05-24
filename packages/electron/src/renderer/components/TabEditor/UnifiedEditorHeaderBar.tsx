/**
 * UnifiedEditorHeaderBar - Consistent header bar for all editor types
 *
 * Renders above all editor content (Markdown, Monaco, CSV, custom editors).
 * Features:
 * - Breadcrumb path navigation
 * - AI Sessions button (for files edited by AI)
 * - TOC button (for Markdown files only)
 * - Actions menu (View History, Toggle Source Mode, Set Document Type, etc.)
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSetAtom } from 'jotai';
import { $isHeadingNode } from '@lexical/rich-text';
import { $getRoot } from 'lexical';
import {
  $convertToEnhancedMarkdownString,
  $convertFromEnhancedMarkdownString,
  getEditorTransformers,
  wrapWithPrintStyles,
  applyTrackerTypeToMarkdown,
  getDefaultFrontmatterForType,
  getModelDefaults,
  getCurrentTrackerTypeFromMarkdown,
  removeTrackerTypeFromMarkdown,
  type TrackerTypeInfo,
} from '@nimbalyst/runtime';
import { $generateHtmlFromNodes } from '@lexical/html';
import { copyToClipboard, MaterialSymbol, ProviderIcon } from '@nimbalyst/runtime';
import { historyDialogFileAtom } from '../../store';
import { useFloatingMenu, FloatingPortal } from '../../hooks/useFloatingMenu';
import { getDocumentService } from '../../services/RendererDocumentService';
import { isWorktreePath } from '../../../shared/pathUtils';
import { CommonFileActions } from '../CommonFileActions';
import { FilePathBreadcrumb } from '../common/FilePathBreadcrumb';
import { dialogRef, DIALOG_IDS } from '../../dialogs';
import type { ShareDialogData } from '../../dialogs';
import { useLocalFileSharedDocLink } from '../../hooks/useCollabLocalOrigin';

// Built-in tracker types that support full-document mode
const TRACKER_TYPES: TrackerTypeInfo[] = [
  { type: 'plan', displayName: 'Plan', icon: 'flag', color: '#3b82f6' },
  { type: 'decision', displayName: 'Decision', icon: 'gavel', color: '#8b5cf6' },
];

// Editor reference type - can be LexicalEditor or any editor with similar interface
interface EditorLike {
  getEditorState: () => { read: (fn: () => void) => void };
  registerUpdateListener: (callback: () => void) => () => void;
  getElementByKey: (key: string) => HTMLElement | null;
  update: (fn: () => void) => void;
}

interface AISession {
  id: string;
  title: string;
  provider: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  worktreeId?: string | null;
  isCurrentWorkspace?: boolean;
}

const headerButtonClasses =
  'unified-header-button agent-elements-editor-header-button nim-btn-icon flex h-7 w-7 items-center justify-center rounded-[6px] border border-transparent bg-transparent p-0 text-nim-muted cursor-pointer transition-[background-color,color,border-color] duration-150 hover:bg-nim-hover hover:text-nim focus-visible:outline-2 focus-visible:outline-[var(--nim-primary)] focus-visible:outline-offset-1';
const activeHeaderButtonClasses =
  'active border-[var(--nim-border)] bg-nim-secondary text-nim';
const menuShellClasses =
  'agent-elements-tool-card rounded-[10px] border border-nim bg-nim-secondary p-1 text-[13px] shadow-[0_12px_32px_color-mix(in_srgb,var(--nim-text)_10%,transparent)] z-[10000]';
const menuItemClasses =
  'dropdown-item agent-elements-editor-header-menu-item flex w-full items-center gap-2.5 rounded-[8px] border-0 bg-transparent px-3 py-2 text-left text-[13px] leading-5 text-nim transition-[background-color,color] duration-150 cursor-pointer select-none hover:bg-nim-hover focus-visible:outline-2 focus-visible:outline-[var(--nim-primary)] focus-visible:outline-offset-2';
const menuIconClasses =
  'agent-elements-editor-header-menu-icon flex h-5 w-5 shrink-0 items-center justify-center text-nim-muted';
const menuSeparatorClasses =
  'dropdown-divider agent-elements-editor-header-menu-separator mx-2 my-1 h-px bg-[var(--nim-border)]';
const menuSectionLabelClasses =
  'dropdown-section-label px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-nim-faint';

const SessionItem: React.FC<{
  session: AISession;
  isLast?: boolean;
  onClick?: (id: string) => void;
  onOpenChat?: (id: string) => void;
  formatTime: (ts: number) => string;
}> = ({ session, isLast, onClick, onOpenChat, formatTime }) => (
  <div
    className={`ai-session-item agent-elements-editor-header-session-item flex items-center rounded-[8px] transition-[background-color,color] duration-150 ${isLast ? 'last:border-b-0' : ''} hover:bg-nim-hover`}
    role="none"
  >
    <button
      type="button"
      role="menuitem"
      className="agent-elements-editor-header-session-main flex min-w-0 flex-1 items-center gap-2.5 rounded-[8px] border-0 bg-transparent px-3 py-2 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--nim-primary)] focus-visible:outline-offset-2"
      onClick={() => onClick?.(session.id)}
    >
      <span className="agent-elements-editor-header-menu-icon flex h-5 w-5 shrink-0 items-center justify-center text-nim-muted"><ProviderIcon provider={session.provider} size={14} /></span>
      <span className="ai-session-title min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium leading-5 text-nim">{session.title}</span>
      <span className="ai-session-time shrink-0 text-xs text-nim-faint">{formatTime(session.updatedAt)}</span>
    </button>
    {onOpenChat && (
      <button
        type="button"
        role="menuitem"
        className="agent-elements-editor-header-session-chat flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-nim-faint cursor-pointer transition-[background-color,color] duration-150 hover:bg-nim-hover hover:text-nim focus-visible:outline-2 focus-visible:outline-[var(--nim-primary)] focus-visible:outline-offset-1"
        title="Open in Chat panel"
        onClick={() => onOpenChat(session.id)}
      >
        <MaterialSymbol icon="forum" size={14} />
      </button>
    )}
  </div>
);

interface TOCItem {
  text: string;
  level: number;
  key: string;
}

interface ExtensionMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
}

interface UnifiedEditorHeaderBarProps {
  filePath: string;
  fileName: string;
  workspaceId?: string;
  breadcrumbContent?: React.ReactNode;

  // Editor type info
  isMarkdown?: boolean;
  isCustomEditor?: boolean;
  extensionId?: string;

  // Lexical editor reference (for TOC extraction and markdown operations)
  lexicalEditor?: EditorLike;

  // Action callbacks
  onToggleSourceMode?: () => void;
  supportsSourceMode?: boolean;
  isSourceModeActive?: boolean;

  // Markdown-specific callbacks
  onToggleMarkdownMode?: () => void;  // Switch to Monaco for raw editing
  onDirtyChange?: (isDirty: boolean) => void;  // Mark document as dirty after changes

  // AI session callbacks
  onSwitchToAgentMode?: (planDocumentPath?: string, sessionId?: string) => void;
  onOpenSessionInChat?: (sessionId: string) => void;

  // Extension menu items (contributed by custom editors)
  extensionMenuItems?: ExtensionMenuItem[];
  extraActionItems?: ExtensionMenuItem[];
  onOpenExtensionSettings?: () => void;

  // Debug tree toggle (dev mode only)
  onToggleDebugTree?: () => void;

  // Signal that content changed (e.g., frontmatter injected), so document headers re-check
  onContentChanged?: () => void;

  // Visibility overrides for non-local editor shells
  showAIButton?: boolean;
  showShareLinkButton?: boolean;
  showSharedDocButton?: boolean;
  showHistoryAction?: boolean;
  showCommonFileActions?: boolean;
}

export const UnifiedEditorHeaderBar: React.FC<UnifiedEditorHeaderBarProps> = ({
  filePath,
  fileName,
  workspaceId,
  breadcrumbContent,
  isMarkdown = false,
  isCustomEditor = false,
  extensionId,
  lexicalEditor,
  onToggleSourceMode,
  supportsSourceMode = false,
  isSourceModeActive = false,
  onToggleMarkdownMode,
  onDirtyChange,
  onSwitchToAgentMode,
  onOpenSessionInChat,
  extensionMenuItems = [],
  extraActionItems = [],
  onOpenExtensionSettings,
  onToggleDebugTree,
  onContentChanged,
  showAIButton,
  showShareLinkButton = isMarkdown,
  showSharedDocButton = true,
  showHistoryAction = true,
  showCommonFileActions = true,
}) => {
  const openHistoryDialog = useSetAtom(historyDialogFileAtom);

  // Dropdown states
  const [showDocTypeSubmenu, setShowDocTypeSubmenu] = useState(false);

  // Menus use floating-ui for portal rendering + viewport overflow protection
  const aiSessionsMenu = useFloatingMenu({ placement: 'bottom-end' });
  const showAISessions = aiSessionsMenu.isOpen;
  const setShowAISessions = aiSessionsMenu.setIsOpen;
  const tocMenu = useFloatingMenu({ placement: 'bottom-end' });
  const showTOC = tocMenu.isOpen;
  const setShowTOC = tocMenu.setIsOpen;
  const actionsMenu = useFloatingMenu({ placement: 'bottom-end' });
  const showActionsMenu = actionsMenu.isOpen;
  const setShowActionsMenu = actionsMenu.setIsOpen;
  const sharedDocMenu = useFloatingMenu({ placement: 'bottom-end' });
  const sharedDocLink = useLocalFileSharedDocLink(workspaceId ?? '', filePath);

  // Dev mode check
  const isDevMode = import.meta.env.DEV;

  // AI Sessions state
  const [aiSessions, setAISessions] = useState<AISession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // TOC state
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);

  // Document type state (for markdown files)
  const [currentDocumentType, setCurrentDocumentType] = useState<string | null>(null);

  // Load AI sessions
  const loadAISessions = useCallback(async () => {
    if (!filePath || !workspaceId || !(window as any).electronAPI) return;

    setLoadingSessions(true);
    try {
      const sessions = await (window as any).electronAPI.invoke('sessions:get-by-file', workspaceId, filePath);
      setAISessions(sessions || []);
    } catch (error) {
      console.error('Failed to load AI sessions:', error);
      setAISessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [filePath, workspaceId]);

  // Load sessions when dropdown opens
  useEffect(() => {
    if (showAISessions && aiSessions.length === 0) {
      loadAISessions();
    }
  }, [showAISessions, aiSessions.length, loadAISessions]);

  // Extract TOC from Lexical editor
  const extractTOC = useCallback(() => {
    if (!lexicalEditor) return;
    if (typeof lexicalEditor.getEditorState !== 'function') return;

    try {
      lexicalEditor.getEditorState().read(() => {
        const root = $getRoot();
        const items: TOCItem[] = [];

        root.getChildren().forEach((node) => {
          if ($isHeadingNode(node)) {
            const level = parseInt(node.getTag().substring(1)); // h1 -> 1, h2 -> 2, etc.
            items.push({
              text: node.getTextContent(),
              level,
              key: node.getKey(),
            });
          }
        });

        setTocItems(items);
      });
    } catch (error) {
      console.error('[UnifiedHeaderBar] Failed to extract TOC:', error);
    }
  }, [lexicalEditor]);

  // Update TOC when editor content changes
  useEffect(() => {
    if (!lexicalEditor) return;
    if (typeof lexicalEditor.registerUpdateListener !== 'function') return;

    extractTOC();

    const unregister = lexicalEditor.registerUpdateListener(() => {
      extractTOC();
    });

    return () => {
      unregister();
    };
  }, [lexicalEditor, extractTOC]);

  // Detect current document type from editor content (markdown only)
  useEffect(() => {
    // Validate that lexicalEditor is actually a Lexical editor with the expected methods
    if (!lexicalEditor || !isMarkdown) return;
    if (typeof lexicalEditor.getEditorState !== 'function' ||
        typeof lexicalEditor.registerUpdateListener !== 'function') {
      // Not a valid Lexical editor (might be switching modes)
      return;
    }

    const detectDocumentType = () => {
      try {
        lexicalEditor.getEditorState().read(() => {
          const transformers = getEditorTransformers();
          const markdown = $convertToEnhancedMarkdownString(transformers);
          const detectedType = getCurrentTrackerTypeFromMarkdown(markdown);
          setCurrentDocumentType(detectedType);
        });
      } catch (error) {
        console.error('[UnifiedHeaderBar] Failed to detect document type:', error);
      }
    };

    detectDocumentType();

    const unregister = lexicalEditor.registerUpdateListener(() => {
      detectDocumentType();
    });

    return () => {
      unregister();
    };
  }, [lexicalEditor, isMarkdown]);

  // Handle copy as markdown
  const handleCopyAsMarkdown = useCallback(() => {
    if (!lexicalEditor || typeof lexicalEditor.getEditorState !== 'function') return;

    try {
      lexicalEditor.getEditorState().read(() => {
        const transformers = getEditorTransformers();
        const markdown = $convertToEnhancedMarkdownString(transformers);

        copyToClipboard(markdown).then(() => {
          console.log('[UnifiedHeaderBar] Markdown copied to clipboard');
        }).catch((err) => {
          console.error('[UnifiedHeaderBar] Failed to copy markdown:', err);
        });
      });
    } catch (error) {
      console.error('[UnifiedHeaderBar] Failed to convert to markdown:', error);
    }
    setShowActionsMenu(false);
  }, [lexicalEditor]);

  // Handle share link
  const handleShareLink = useCallback(() => {
    if (!filePath) return;
    setShowActionsMenu(false);
    dialogRef.current?.open<ShareDialogData>(DIALOG_IDS.SHARE, {
      contentType: 'file',
      filePath,
      title: fileName,
    });
  }, [filePath, fileName]);

  // Handle export to PDF
  const handleExportToPdf = useCallback(async () => {
    if (!lexicalEditor || typeof lexicalEditor.getEditorState !== 'function') return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    try {
      // Show save dialog first
      const defaultPath = fileName.replace(/\.(md|markdown|txt)$/i, '.pdf');
      const outputPath = await electronAPI.showSaveDialogPdf({ defaultPath });

      if (!outputPath) {
        // User cancelled
        return;
      }

      // Generate HTML from Lexical editor
      let html = '';
      lexicalEditor.getEditorState().read(() => {
        // Cast to LexicalEditor for $generateHtmlFromNodes
        const editorAsLexical = lexicalEditor as unknown as import('lexical').LexicalEditor;
        const content = $generateHtmlFromNodes(editorAsLexical);
        html = wrapWithPrintStyles(content, fileName);
      });

      // Export to PDF via main process
      const result = await electronAPI.exportHtmlToPdf({
        html,
        outputPath,
        pageSize: 'Letter',
        generateDocumentOutline: true,
        generateTaggedPDF: true,
      });

      if (result.success) {
        console.log('[UnifiedHeaderBar] PDF exported successfully:', outputPath);
      } else {
        console.error('[UnifiedHeaderBar] PDF export failed:', result.error);
        electronAPI.showErrorDialog('Export Failed', `Failed to export PDF: ${result.error}`);
      }
    } catch (error) {
      console.error('[UnifiedHeaderBar] Failed to export to PDF:', error);
    }
    setShowActionsMenu(false);
  }, [lexicalEditor, fileName]);

  // Handle set document type
  const handleSetDocumentType = useCallback((trackerType: string) => {
    if (!lexicalEditor || typeof lexicalEditor.update !== 'function') return;

    const isLegacy = trackerType === 'plan' || trackerType === 'decision';
    const modelDefaults = isLegacy ? undefined : getModelDefaults(trackerType);

    try {
      lexicalEditor.update(() => {
        const transformers = getEditorTransformers();
        const markdown = $convertToEnhancedMarkdownString(transformers);
        const updatedMarkdown = applyTrackerTypeToMarkdown(markdown, trackerType, modelDefaults);
        $convertFromEnhancedMarkdownString(updatedMarkdown, transformers);

        // Mark as dirty - autosave will handle saving
        if (onDirtyChange) {
          onDirtyChange(true);
        }
      });

      // Notify DocumentService so tracker UI updates immediately
      const documentService = getDocumentService();
      if (isLegacy) {
        const frontmatterKey = trackerType === 'plan' ? 'planStatus' : 'decisionStatus';
        const defaultData = getDefaultFrontmatterForType(trackerType);
        documentService.notifyFrontmatterChanged?.(filePath, { [frontmatterKey]: defaultData });
      } else {
        // Generic: top-level fields + trackerStatus only holds type
        const frontmatter: Record<string, any> = { ...(modelDefaults || {}), trackerStatus: { type: trackerType } };
        documentService.notifyFrontmatterChanged?.(filePath, frontmatter);
      }

      // Signal content changed so document header re-checks for frontmatter
      onContentChanged?.();
    } catch (error) {
      console.error('[UnifiedHeaderBar] Failed to apply document type:', error);
    }

    setShowDocTypeSubmenu(false);
    setShowActionsMenu(false);
  }, [lexicalEditor, onDirtyChange, filePath, onContentChanged]);

  // Handle remove document type
  const handleRemoveDocumentType = useCallback(() => {
    if (!lexicalEditor || typeof lexicalEditor.update !== 'function') return;

    try {
      lexicalEditor.update(() => {
        const transformers = getEditorTransformers();
        const markdown = $convertToEnhancedMarkdownString(transformers);
        const updatedMarkdown = removeTrackerTypeFromMarkdown(markdown);
        $convertFromEnhancedMarkdownString(updatedMarkdown, transformers);

        // Mark as dirty - autosave will handle saving
        if (onDirtyChange) {
          onDirtyChange(true);
        }
      });

      // Notify DocumentService so tracker UI updates immediately
      const documentService = getDocumentService();
      documentService.notifyFrontmatterChanged?.(filePath, {});

      // Signal content changed so document header re-checks for frontmatter
      onContentChanged?.();
    } catch (error) {
      console.error('[UnifiedHeaderBar] Failed to remove document type:', error);
    }

    setShowDocTypeSubmenu(false);
    setShowActionsMenu(false);
  }, [lexicalEditor, onDirtyChange, filePath, onContentChanged]);

  // Handle TOC item click
  const handleTOCItemClick = (key: string) => {
    if (!lexicalEditor) return;

    lexicalEditor.update(() => {
      const element = lexicalEditor.getElementByKey(key);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setShowTOC(false);
      }
    });
  };

  // Handle AI session actions
  const handleStartAgentSession = () => {
    if (onSwitchToAgentMode && filePath) {
      onSwitchToAgentMode(filePath);
    }
    setShowAISessions(false);
  };

  const handleLoadSessionInAgentMode = (sessionId: string) => {
    if (onSwitchToAgentMode) {
      onSwitchToAgentMode(undefined, sessionId);
    }
    setShowAISessions(false);
  };

  const handleLoadSessionInChat = (sessionId: string) => {
    if (onOpenSessionInChat) {
      onOpenSessionInChat(sessionId);
    }
    setShowAISessions(false);
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };
  const formatSharedTimestamp = (isoTimestamp: string): string => {
    const timestamp = new Date(isoTimestamp).getTime();
    if (Number.isNaN(timestamp)) return isoTimestamp;
    return `${new Date(timestamp).toLocaleString()} (${formatRelativeTime(timestamp)})`;
  };

  // Determine if we should show AI button (shown in both editor and agent modes)
  const shouldShowAIButton = showAIButton ?? Boolean(workspaceId);
  // Group sessions: current workspace first, then others
  const isInWorktree = workspaceId ? isWorktreePath(workspaceId) : false;
  const currentWorkspaceSessions = useMemo(() => aiSessions.filter(s => s.isCurrentWorkspace), [aiSessions]);
  const otherSessions = useMemo(() => aiSessions.filter(s => !s.isCurrentWorkspace), [aiSessions]);
  const hasGroupedSessions = currentWorkspaceSessions.length > 0 && otherSessions.length > 0;

  // Determine if we should show TOC button (Markdown only)
  const showTOCButton = isMarkdown && Boolean(lexicalEditor);

  return (
    <div
      className="unified-editor-header-bar agent-elements-editor-header-bar flex h-9 min-h-9 shrink-0 items-center justify-between border-b border-[var(--nim-border)] bg-[var(--nim-bg)] px-3"
      data-component="UnifiedEditorHeaderBar"
      data-testid="agent-elements-editor-header-bar"
      data-agent-elements-shell="editor-header-bar"
    >
      {/* Left: Breadcrumb Path */}
      {breadcrumbContent ?? <FilePathBreadcrumb filePath={filePath} workspacePath={workspaceId} />}

      {/* Right: Action Buttons */}
      <div className="unified-header-actions flex items-center gap-1">
        {/* AI Sessions Button */}
        {shouldShowAIButton && (
          <div className="unified-header-dropdown-container relative">
            <button
              ref={aiSessionsMenu.refs.setReference}
              data-testid="ai-sessions-button"
              data-agent-elements-shell="editor-header-ai-button"
              className={`${headerButtonClasses} agent-elements-editor-header-ai-button ${
                showAISessions ? activeHeaderButtonClasses : ''
              }`}
              type="button"
              onClick={() => {
                setShowAISessions(!showAISessions);
                if (!showAISessions) {
                  loadAISessions();
                }
              }}
              title="AI Sessions"
              {...aiSessionsMenu.getReferenceProps()}
            >
              <MaterialSymbol icon="auto_awesome" size={18} />
            </button>

            {showAISessions && (
              <FloatingPortal>
              <div
                ref={aiSessionsMenu.refs.setFloating}
                style={aiSessionsMenu.floatingStyles}
                className={`unified-header-ai-dropdown agent-elements-editor-header-ai-menu ${menuShellClasses} min-w-[300px] max-w-[400px] overflow-hidden`}
                data-component="UnifiedEditorHeaderBarAISessionsMenu"
                data-testid="agent-elements-editor-header-ai-menu"
                data-agent-elements-shell="editor-header-ai-menu"
                {...aiSessionsMenu.getFloatingProps()}
              >
                {/* Dropdown header */}
                <div className="ai-sessions-header border-b border-[var(--nim-border)] px-3 py-2">
                  <div className="ai-sessions-title text-[11px] font-semibold uppercase tracking-wide text-nim-muted">
                    AI Sessions that edited this file
                  </div>
                </div>

                {loadingSessions ? (
                  <div className="ai-sessions-loading p-4 text-center text-[13px] text-nim-muted">Loading sessions...</div>
                ) : aiSessions.length > 0 ? (
                  <div className="ai-sessions-list max-h-[300px] overflow-y-auto p-1">
                    {hasGroupedSessions ? (
                      <>
                        {/* Current workspace sessions */}
                        <div className="ai-sessions-group-header px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-nim-faint">
                          {isInWorktree ? 'This worktree' : 'This project'}
                        </div>
                        {currentWorkspaceSessions.map((session) => (
                          <SessionItem key={session.id} session={session} onClick={onSwitchToAgentMode ? handleLoadSessionInAgentMode : undefined} onOpenChat={onOpenSessionInChat ? handleLoadSessionInChat : undefined} formatTime={formatRelativeTime} />
                        ))}
                        {/* Other sessions */}
                        <div className="ai-sessions-group-header px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-nim-faint">
                          Other sessions
                        </div>
                        {otherSessions.map((session) => (
                          <SessionItem key={session.id} session={session} isLast onClick={onSwitchToAgentMode ? handleLoadSessionInAgentMode : undefined} onOpenChat={onOpenSessionInChat ? handleLoadSessionInChat : undefined} formatTime={formatRelativeTime} />
                        ))}
                      </>
                    ) : (
                      aiSessions.map((session) => (
                        <SessionItem key={session.id} session={session} isLast onClick={onSwitchToAgentMode ? handleLoadSessionInAgentMode : undefined} onOpenChat={onOpenSessionInChat ? handleLoadSessionInChat : undefined} formatTime={formatRelativeTime} />
                      ))
                    )}
                  </div>
                ) : (
                  <div className="ai-sessions-empty p-4 text-center text-[13px] text-nim-muted">No AI sessions have edited this file yet</div>
                )}

                {/* Start new session button - only shown when agent mode switch is available */}
                {onSwitchToAgentMode && (
                  <div className="ai-session-start-container border-t border-[var(--nim-border)] px-2 py-2">
                    <button
                      type="button"
                      role="menuitem"
                      className={`${menuItemClasses} ai-session-start-button font-medium text-nim-muted`}
                      onClick={handleStartAgentSession}
                    >
                      <span className={menuIconClasses}><MaterialSymbol icon="add" size={18} /></span>
                      Start new agent session
                    </button>
                  </div>
                )}
              </div>
              </FloatingPortal>
            )}
          </div>
        )}

        {/* TOC Button (Markdown only) */}
        {showTOCButton && (
          <div className="unified-header-dropdown-container relative">
            <button
              ref={tocMenu.refs.setReference}
              className={`${headerButtonClasses} agent-elements-editor-header-toc-button ${
                showTOC ? activeHeaderButtonClasses : ''
              }`}
              data-testid="agent-elements-editor-header-toc-button"
              data-agent-elements-shell="editor-header-toc-button"
              type="button"
              onClick={() => setShowTOC(!showTOC)}
              title="Table of Contents"
              {...tocMenu.getReferenceProps()}
            >
              <MaterialSymbol icon="format_list_bulleted" size={18} />
            </button>

            {showTOC && (
              <FloatingPortal>
              <div
                ref={tocMenu.refs.setFloating}
                style={tocMenu.floatingStyles}
                className={`unified-header-toc-dropdown agent-elements-editor-header-toc-menu ${menuShellClasses} max-h-[400px] min-w-[250px] max-w-[350px] overflow-y-auto overflow-hidden`}
                data-component="UnifiedEditorHeaderBarTOCMenu"
                data-testid="agent-elements-editor-header-toc-menu"
                data-agent-elements-shell="editor-header-toc-menu"
                {...tocMenu.getFloatingProps()}
              >
                {tocItems.length > 0 ? (
                  <ul className="toc-list m-0 list-none p-0">
                    {tocItems.map((item) => (
                      <li
                        key={item.key}
                        className="m-0 p-0"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          data-testid={`agent-elements-editor-header-toc-${item.key}`}
                          className={`toc-item agent-elements-editor-header-toc-item flex w-full items-center rounded-[8px] border-0 bg-transparent py-2 pr-3 text-left leading-snug text-nim cursor-pointer transition-[background-color,color] duration-150 hover:bg-nim-hover focus-visible:outline-2 focus-visible:outline-[var(--nim-primary)] focus-visible:outline-offset-2 ${
                            item.level === 1
                              ? 'toc-level-1 pl-3 text-sm font-semibold'
                              : item.level === 2
                              ? 'toc-level-2 pl-6 text-sm'
                              : item.level === 3
                              ? 'toc-level-3 pl-9 text-[13px]'
                              : item.level === 4
                              ? 'toc-level-4 pl-12 text-[13px]'
                              : 'toc-level-5 pl-[60px] text-xs text-nim-muted'
                          }`}
                          onClick={() => handleTOCItemClick(item.key)}
                        >
                          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item.text}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="toc-empty px-3 py-4 text-center text-[13px] text-nim-muted">No headings in document</div>
                )}
              </div>
              </FloatingPortal>
            )}
          </div>
        )}

        {/* Share Link Button (markdown files only) */}
        {showShareLinkButton && (
          <button
            className={`${headerButtonClasses} agent-elements-editor-header-share-button`}
            data-agent-elements-shell="editor-header-share-button"
            type="button"
            onClick={handleShareLink}
            title="Share Link"
          >
            <MaterialSymbol icon="share" size={18} />
          </button>
        )}

        {/* Shared Doc Button - local file is already linked to a team-shared doc */}
        {showSharedDocButton && sharedDocLink.binding && (
          <div className="unified-header-dropdown-container relative">
            <button
              ref={sharedDocMenu.refs.setReference}
              className={`unified-header-button nim-btn-icon w-7 h-7 rounded border-none bg-transparent cursor-pointer flex items-center justify-center transition-all duration-150 text-[var(--nim-text-muted)] hover:bg-[var(--nim-bg-hover)] hover:text-[var(--nim-text)] ${
                sharedDocMenu.isOpen ? 'active bg-[var(--nim-bg-tertiary)] text-[var(--nim-text)]' : ''
              }`}
              onClick={() => sharedDocMenu.setIsOpen(!sharedDocMenu.isOpen)}
              title="Shared to Team"
              {...sharedDocMenu.getReferenceProps()}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
                <path d="m8 17 4 4 4-4" />
                <path d="M12 12v9" />
              </svg>
            </button>

            {sharedDocMenu.isOpen && (
              <FloatingPortal>
                <div
                  ref={sharedDocMenu.refs.setFloating}
                  style={sharedDocMenu.floatingStyles}
                  className="min-w-[260px] overflow-hidden rounded-md z-[1000] py-1 bg-[var(--nim-bg)] border border-[var(--nim-border)] shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                  {...sharedDocMenu.getFloatingProps()}
                >
                  <div className="px-3 py-2 border-b border-[var(--nim-border)]">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nim-text-faint)]">
                      Shared Document
                    </div>
                    <div className="mt-1 text-[13px] text-[var(--nim-text)]">
                      Shared to team on {formatSharedTimestamp(sharedDocLink.binding.createdAt)}
                    </div>
                  </div>
                  <button
                    className="dropdown-item w-full py-2 px-3 border-none bg-transparent text-[13px] text-left cursor-pointer flex items-center gap-2.5 transition-colors duration-150 text-[var(--nim-text)] hover:bg-[var(--nim-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={sharedDocLink.busyAction !== null}
                    onClick={async () => {
                      const success = await sharedDocLink.reuploadToSharedDoc();
                      if (success) {
                        await sharedDocLink.refresh();
                        sharedDocMenu.setIsOpen(false);
                      }
                    }}
                  >
                    <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 5 17 10" />
                      <line x1="12" y1="5" x2="12" y2="16" />
                    </svg>
                    Re-upload to Shared Doc
                  </button>
                </div>
              </FloatingPortal>
            )}
          </div>
        )}

        {/* Actions Menu Button */}
        <div className="unified-header-dropdown-container relative">
          <button
            ref={actionsMenu.refs.setReference}
            className={`${headerButtonClasses} agent-elements-editor-header-actions-button ${
              showActionsMenu ? activeHeaderButtonClasses : ''
            }`}
            data-testid="agent-elements-editor-header-actions-button"
            data-agent-elements-shell="editor-header-actions-button"
            type="button"
            onClick={() => setShowActionsMenu(!showActionsMenu)}
            title="More actions"
            {...actionsMenu.getReferenceProps()}
          >
            <MaterialSymbol icon="more_horiz" size={18} />
          </button>

          {showActionsMenu && (
            <FloatingPortal>
            <div
              ref={actionsMenu.refs.setFloating}
              style={actionsMenu.floatingStyles}
              className={`unified-header-actions-dropdown agent-elements-editor-header-actions-menu ${menuShellClasses} min-w-[220px] overflow-visible`}
              data-component="UnifiedEditorHeaderBarActionsMenu"
              data-testid="agent-elements-editor-header-actions-menu"
              data-agent-elements-shell="editor-header-actions-menu"
              {...actionsMenu.getFloatingProps()}
            >
              {/* Toggle Source Mode */}
              {supportsSourceMode && onToggleSourceMode && (
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClasses}
                  onClick={() => {
                    onToggleSourceMode();
                    setShowActionsMenu(false);
                  }}
                >
                  <span className={menuIconClasses}><MaterialSymbol icon="code" size={18} /></span>
                  {isSourceModeActive ? 'Exit Source Mode' : 'Toggle Source Mode'}
                </button>
              )}

              {/* View History */}
              {showHistoryAction && (
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClasses}
                  data-testid="agent-elements-editor-header-action-history"
                  data-agent-elements-shell="editor-header-menu-item"
                  data-editor-header-action="history"
                  onClick={() => {
                    openHistoryDialog(filePath);
                    setShowActionsMenu(false);
                  }}
                >
                  <span className={menuIconClasses}><MaterialSymbol icon="history" size={18} /></span>
                  View History
                </button>
              )}

              {/* Markdown-specific actions */}
              {isMarkdown && (
                <>
                  {/* Toggle Markdown Mode - switch to Monaco */}
                  {onToggleMarkdownMode && (
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItemClasses}
                      onClick={() => {
                        onToggleMarkdownMode();
                        setShowActionsMenu(false);
                      }}
                    >
                      <span className={menuIconClasses}><MaterialSymbol icon="markdown" size={18} /></span>
                      Toggle Markdown Mode
                    </button>
                  )}

                  {/* Copy as Markdown */}
                  {lexicalEditor && (
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItemClasses}
                      onClick={handleCopyAsMarkdown}
                    >
                      <span className={menuIconClasses}><MaterialSymbol icon="content_copy" size={18} /></span>
                      Copy as Markdown
                    </button>
                  )}

                  {/* Export to PDF */}
                  {lexicalEditor && (
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItemClasses}
                      onClick={handleExportToPdf}
                    >
                      <span className={menuIconClasses}><MaterialSymbol icon="picture_as_pdf" size={18} /></span>
                      Export to PDF...
                    </button>
                  )}

                  {/* Set Document Type with submenu */}
                  {lexicalEditor && (
                    <div
                      className={`${menuItemClasses} dropdown-item-with-submenu relative`}
                      onMouseEnter={() => setShowDocTypeSubmenu(true)}
                      onMouseLeave={() => setShowDocTypeSubmenu(false)}
                      role="presentation"
                    >
                      <span className={menuIconClasses}><MaterialSymbol icon="article" size={18} /></span>
                      <span className="dropdown-item-label flex-1">Set Document Type</span>
                      <span className="dropdown-item-chevron ml-auto flex h-5 w-5 items-center justify-center text-sm text-nim-faint">
                        <MaterialSymbol icon="chevron_right" size={16} />
                      </span>

                      {showDocTypeSubmenu && (
                        <div className={`dropdown-submenu absolute right-full left-auto top-0 min-w-[180px] ${menuShellClasses}`}>
                          {TRACKER_TYPES.map((type) => (
                            <button
                              key={type.type}
                              type="button"
                              role="menuitem"
                              className={menuItemClasses}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetDocumentType(type.type);
                              }}
                            >
                              <span
                                className="material-symbols-outlined opacity-70"
                                style={{ color: type.color, fontSize: '18px' }}
                              >
                                {type.icon}
                              </span>
                              <span>{type.displayName}</span>
                              {currentDocumentType === type.type && (
                                <span className="dropdown-checkmark ml-auto text-sm text-[var(--nim-primary)]">&#10003;</span>
                              )}
                            </button>
                          ))}
                          {currentDocumentType && (
                            <>
                              <div className={menuSeparatorClasses} />
                              <button
                                type="button"
                                role="menuitem"
                                className={menuItemClasses}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveDocumentType();
                                }}
                              >
                                <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }}>
                                  close
                                </span>
                                <span>Remove Type</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Debug Tree (dev mode only) */}
              {isDevMode && isMarkdown && onToggleDebugTree && (
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClasses}
                  onClick={() => {
                    onToggleDebugTree();
                    setShowActionsMenu(false);
                  }}
                >
                  <span className={menuIconClasses}><MaterialSymbol icon="account_tree" size={18} /></span>
                  Toggle Debug Tree
                </button>
              )}

              {/* Extra shell-specific actions */}
              {extraActionItems.length > 0 && (
                <>
                  <div className={menuSeparatorClasses} />
                  {extraActionItems.map((item, index) => (
                    <button
                      key={`extra-action-${index}-${item.label}`}
                      type="button"
                      role="menuitem"
                      className={`${menuItemClasses} disabled:cursor-not-allowed disabled:opacity-50`}
                      disabled={item.disabled}
                      onClick={() => {
                        item.onClick();
                        setShowActionsMenu(false);
                      }}
                    >
                      {item.icon && (
                        <span className="material-symbols-outlined text-lg opacity-70">{item.icon}</span>
                      )}
                      {item.label}
                    </button>
                  ))}
                </>
              )}

              {/* Common file actions (Open in Default App, External Editor, Finder, Copy Path, Share) */}
              {showCommonFileActions && (
                <>
                  <div className={menuSeparatorClasses} />
                  <CommonFileActions
                    filePath={filePath}
                    fileName={fileName}
                    onClose={() => setShowActionsMenu(false)}
                    menuItemClass={menuItemClasses}
                    separatorClass={menuSeparatorClasses}
                    iconSize={16}
                    useButtons={true}
                  />
                </>
              )}

              {/* Extension Menu Items */}
              {extensionMenuItems.length > 0 && (
                <>
                  <div className={menuSeparatorClasses} />
                  <div className={menuSectionLabelClasses}>
                    {extensionId || 'Extension'}
                  </div>
                  {extensionMenuItems.map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      role="menuitem"
                      className={`${menuItemClasses} disabled:cursor-not-allowed disabled:opacity-50`}
                      disabled={item.disabled}
                      onClick={() => {
                        item.onClick();
                        setShowActionsMenu(false);
                      }}
                    >
                      {item.icon && (
                        <span className="material-symbols-outlined text-lg opacity-70">{item.icon}</span>
                      )}
                      {item.label}
                    </button>
                  ))}
                </>
              )}

              {/* Extension Settings Link */}
              {onOpenExtensionSettings && (
                <>
                  <div className={menuSeparatorClasses} />
                  <button
                    type="button"
                    role="menuitem"
                    className={`${menuItemClasses} settings-link text-[var(--nim-primary)]`}
                    onClick={() => {
                      onOpenExtensionSettings();
                      setShowActionsMenu(false);
                    }}
                  >
                    <span className={menuIconClasses}><MaterialSymbol icon="settings" size={18} /></span>
                    Extension Settings
                  </button>
                </>
              )}
            </div>
            </FloatingPortal>
          )}
        </div>
      </div>
    </div>
  );
};
