/**
 * TerminalBottomPanel - Slide-up bottom panel for terminal tabs
 *
 * Similar to TrackerBottomPanel but contains multiple terminal instances
 * in a tabbed interface. Terminals are stored in a dedicated terminal store
 * separate from AI sessions.
 *
 * Uses Jotai atoms for all state: terminal list, active terminal, panel
 * visibility, and panel height. No props needed for panel state.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { store } from '@nimbalyst/runtime/store';
import { TerminalPanel } from '../Terminal/TerminalPanel';
import { TerminalTab } from './TerminalTab';
import { usePostHog } from 'posthog-js/react';
import {
  terminalListAtom,
  activeTerminalIdAtom,
  terminalPanelVisibleAtom,
  terminalPanelHeightAtom,
  terminalPanelHydratedAtom,
  closeTerminalPanelAtom,
  loadTerminals,
  setActiveTerminal,
  removeTerminalFromList,
  initTerminalListeners,
  setTerminalCommandRunning,
  terminalCommandRunningAtom,
  type TerminalInstance,
} from '../../store/atoms/terminals';
import { selectedWorkstreamAtom, sessionWorktreeIdAtom } from '../../store/atoms/sessions';

interface TerminalBottomPanelProps {
  workspacePath: string;
  minHeight?: number;
  maxHeight?: number;
}

function toAgentElementsId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

/**
 * Wrapper component that subscribes to command running state for a terminal
 * This isolates re-renders to just the affected tab when running state changes
 */
interface TerminalTabWrapperProps {
  terminal: TerminalInstance;
  isActive: boolean;
  isActiveWorktree: boolean;
  terminalIndex: number;
  terminalCount: number;
  onSelect: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onCloseToRight: () => void;
}

const TerminalTabWrapper: React.FC<TerminalTabWrapperProps> = ({
  terminal,
  isActiveWorktree,
  ...props
}) => {
  const isCommandRunning = useAtomValue(terminalCommandRunningAtom(terminal.id));

  return (
    <TerminalTab
      terminal={terminal}
      isCommandRunning={isCommandRunning}
      isActiveWorktree={isActiveWorktree}
      {...props}
    />
  );
};

export const TerminalBottomPanel: React.FC<TerminalBottomPanelProps> = ({
  workspacePath,
  minHeight = 150,
  maxHeight = 600,
}) => {
  // Panel state from Jotai atoms
  const visible = useAtomValue(terminalPanelVisibleAtom);
  const height = useAtomValue(terminalPanelHeightAtom);
  const panelStateHydrated = useAtomValue(terminalPanelHydratedAtom);
  const closePanel = useSetAtom(closeTerminalPanelAtom);

  // Terminal list state from Jotai atoms
  const terminals = useAtomValue(terminalListAtom);
  const activeTerminalId = useAtomValue(activeTerminalIdAtom);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef<number>(0);
  const resizeStartHeight = useRef<number>(0);
  const posthog = usePostHog();

  // Get the currently viewed worktree ID from the selected workstream
  const selectedWorkstream = useAtomValue(selectedWorkstreamAtom(workspacePath));
  const selectedSessionWorktreeId = useAtomValue(
    sessionWorktreeIdAtom(selectedWorkstream?.id ?? '')
  );
  // The active worktree is the worktree ID of the currently viewed session
  // This is used to highlight terminal tabs that belong to the viewed worktree
  const activeWorktreeId = selectedWorkstream?.type === 'worktree'
    ? selectedSessionWorktreeId
    : null;

  // Load terminals and set up IPC listeners on mount
  useEffect(() => {
    // Initial load
    loadTerminals(workspacePath);

    // Listen for external terminal creation (e.g., from worktree button)
    const handleTerminalCreated = (event: Event) => {
      const customEvent = event as CustomEvent<{ terminalId: string }>;
      if (customEvent.detail?.terminalId) {
        loadTerminals(workspacePath);
      }
    };

    window.addEventListener('terminal:created', handleTerminalCreated);

    // Set up IPC listeners for terminal list changes
    const cleanupListeners = initTerminalListeners(workspacePath);

    // Listen for command running state changes
    const unsubscribeCommandRunning = window.electronAPI.terminal.onCommandRunning?.((data) => {
      setTerminalCommandRunning(data.terminalId, data.isRunning);
    });

    return () => {
      window.removeEventListener('terminal:created', handleTerminalCreated);
      cleanupListeners();
      unsubscribeCommandRunning?.();
    };
  }, [workspacePath]);

  // Track analytics and persist visibility when panel visibility changes
  useEffect(() => {
    if (!panelStateHydrated) return;
    if (visible && posthog) {
      posthog.capture('terminal_panel_opened', {
        terminalCount: terminals.length,
      });
    }
    // Persist visibility state per-workspace
    window.electronAPI.terminal.setPanelVisible(workspacePath, visible);
  }, [visible, workspacePath, posthog, terminals.length, panelStateHydrated]);

  // Create new terminal
  const handleCreateTerminal = useCallback(async () => {
    try {
      const result = await window.electronAPI.terminal.create(workspacePath, {
        cwd: workspacePath,
        title: `Terminal ${terminals.length + 1}`,
        source: 'panel',
      });

      if (result.success && result.instance) {
        // Reload from backend to get the new terminal
        await loadTerminals(workspacePath);
      }
    } catch (error: unknown) {
      console.error('[TerminalBottomPanel] Failed to create terminal:', error);
    }
  }, [workspacePath, terminals.length]);

  // Switch to terminal tab
  const handleSelectTerminal = useCallback(async (terminalId: string) => {
    setActiveTerminal(terminalId);
    await window.electronAPI.terminal.setActive(workspacePath, terminalId);
  }, [workspacePath]);

  // Close terminal tab
  const handleCloseTerminal = useCallback(async (terminalId: string) => {
    try {
      await window.electronAPI.terminal.delete(workspacePath, terminalId);

      // Optimistically remove from atom
      removeTerminalFromList(terminalId);

      // If we closed the active terminal, the atom helper updates active too
      const currentActive = store.get(activeTerminalIdAtom);
      if (currentActive) {
        await window.electronAPI.terminal.setActive(workspacePath, currentActive);
      }
    } catch (error: unknown) {
      console.error('[TerminalBottomPanel] Failed to close terminal:', error);
    }
  }, [workspacePath]);

  // Helper to delete multiple terminals in parallel
  const deleteTerminals = useCallback(async (terminalIds: string[]): Promise<void> => {
    // Optimistically remove all from atom state first
    for (const id of terminalIds) {
      removeTerminalFromList(id);
    }

    // Then delete from backend in parallel
    await Promise.all(
      terminalIds.map(id =>
        window.electronAPI.terminal.delete(workspacePath, id).catch((err: unknown) => {
          console.error(`[TerminalBottomPanel] Failed to delete terminal ${id}:`, err);
        })
      )
    );
  }, [workspacePath]);

  // Close all terminals except the specified one
  const handleCloseOthers = useCallback(async (terminalId: string) => {
    try {
      const terminalIds = terminals.filter(t => t.id !== terminalId).map(t => t.id);
      await deleteTerminals(terminalIds);

      setActiveTerminal(terminalId);
      await window.electronAPI.terminal.setActive(workspacePath, terminalId);
    } catch (error: unknown) {
      console.error('[TerminalBottomPanel] Failed to close other terminals:', error);
    }
  }, [workspacePath, terminals, deleteTerminals]);

  // Close all terminals
  const handleCloseAll = useCallback(async () => {
    try {
      const terminalIds = terminals.map(t => t.id);
      await deleteTerminals(terminalIds);

      setActiveTerminal(undefined);
      await window.electronAPI.terminal.setActive(workspacePath, undefined);
    } catch (error: unknown) {
      console.error('[TerminalBottomPanel] Failed to close all terminals:', error);
    }
  }, [workspacePath, terminals, deleteTerminals]);

  // Close terminals to the right of the specified one
  const handleCloseToRight = useCallback(async (terminalId: string) => {
    try {
      const terminalIndex = terminals.findIndex(t => t.id === terminalId);
      if (terminalIndex === -1) return;

      const terminalIds = terminals.slice(terminalIndex + 1).map(t => t.id);
      await deleteTerminals(terminalIds);

      // If active terminal was to the right, switch to the clicked one
      const activeIndex = terminals.findIndex(t => t.id === activeTerminalId);
      if (activeIndex > terminalIndex) {
        setActiveTerminal(terminalId);
        await window.electronAPI.terminal.setActive(workspacePath, terminalId);
      }
    } catch (error: unknown) {
      console.error('[TerminalBottomPanel] Failed to close terminals to the right:', error);
    }
  }, [workspacePath, terminals, activeTerminalId, deleteTerminals]);

  // Close panel
  const handleClose = useCallback(() => {
    closePanel();
  }, [closePanel]);

  // Resize handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = height;
  }, [height]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaY = resizeStartY.current - e.clientY;
    const newHeight = Math.min(
      Math.max(resizeStartHeight.current + deltaY, minHeight),
      maxHeight
    );
    store.set(terminalPanelHeightAtom, newHeight);
  }, [isResizing, minHeight, maxHeight]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      // Persist height per-workspace
      window.electronAPI.terminal.setPanelHeight(workspacePath, height);
    }
  }, [isResizing, height, workspacePath]);

  // Add/remove resize listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
    return undefined;
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Handle terminal exit
  const handleTerminalExit = useCallback((terminalId: string, exitCode: number) => {
    // Update terminal metadata or show indicator
    console.log(`[TerminalBottomPanel] Terminal ${terminalId} exited with code ${exitCode}`);
  }, []);

  return (
    <div
      className="terminal-bottom-panel-container agent-elements-terminal-bottom-panel agent-elements-panel-shell relative shrink-0 flex flex-col border-t border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)]"
      data-agent-elements-shell="terminal-bottom-panel"
      data-component="TerminalBottomPanel"
      data-testid="agent-elements-terminal-bottom-panel"
      style={{ height: visible ? `${height}px` : '0px', display: visible ? 'flex' : 'none' }}
    >
      <div
        className="terminal-bottom-panel-resize-handle agent-elements-terminal-resize-handle absolute top-0 left-0 right-0 z-10 h-1 cursor-ns-resize bg-transparent transition-colors duration-150 hover:bg-[var(--an-primary-color)]"
        data-agent-elements-shell="terminal-resize-handle"
        data-testid="agent-elements-terminal-resize-handle"
        onMouseDown={handleMouseDown}
      />
      <div
        className="terminal-bottom-panel agent-elements-terminal-panel flex h-full flex-col overflow-hidden bg-[var(--an-background)]"
        data-agent-elements-shell="terminal-panel"
      >
        <div
          className="terminal-bottom-panel-header agent-elements-terminal-header flex h-8 shrink-0 items-center justify-between border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-sm)]"
          data-agent-elements-shell="terminal-header"
          data-testid="agent-elements-terminal-header"
        >
          <div
            className="terminal-bottom-panel-tabs agent-elements-terminal-tabs flex min-w-0 flex-1 items-center gap-[var(--an-spacing-xxs)] overflow-x-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-[var(--an-radius-xs)] [&::-webkit-scrollbar-thumb]:bg-[var(--an-background-tertiary)]"
            data-agent-elements-shell="terminal-tabs"
            data-testid="agent-elements-terminal-tabs"
          >
            {terminals.map((terminal, index) => (
              <TerminalTabWrapper
                key={terminal.id}
                terminal={terminal}
                isActive={activeTerminalId === terminal.id}
                isActiveWorktree={!!activeWorktreeId && terminal.worktreeId === activeWorktreeId}
                terminalIndex={index}
                terminalCount={terminals.length}
                onSelect={() => handleSelectTerminal(terminal.id)}
                onClose={() => handleCloseTerminal(terminal.id)}
                onCloseOthers={() => handleCloseOthers(terminal.id)}
                onCloseAll={handleCloseAll}
                onCloseToRight={() => handleCloseToRight(terminal.id)}
              />
            ))}
            <button
              className="terminal-bottom-panel-new-tab agent-elements-terminal-icon-button flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-radius-sm)] border-none bg-transparent p-0 text-[var(--an-foreground-muted)] transition-colors duration-150 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]"
              data-agent-elements-shell="terminal-new-tab"
              data-testid="agent-elements-terminal-new-tab"
              onClick={handleCreateTerminal}
              title="New Terminal"
            >
              <MaterialSymbol icon="add" size={16} />
            </button>
          </div>
          <button
            className="terminal-bottom-panel-close agent-elements-terminal-icon-button ml-2 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-radius-sm)] border-none bg-transparent p-0 text-[var(--an-foreground-muted)] transition-colors duration-150 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]"
            data-agent-elements-shell="terminal-close-panel"
            data-testid="agent-elements-terminal-close-panel"
            onClick={handleClose}
            title="Close panel"
          >
            <MaterialSymbol icon="close" size={18} />
          </button>
        </div>
        <div
          className="terminal-bottom-panel-content agent-elements-terminal-content flex min-h-0 flex-1 flex-col overflow-hidden"
          data-agent-elements-shell="terminal-content"
          data-testid="agent-elements-terminal-content"
        >
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              className="terminal-bottom-panel-terminal agent-elements-terminal-host flex-1 flex flex-col min-h-0"
              data-agent-elements-shell="terminal-host"
              data-terminal-id={terminal.id}
              data-testid={`agent-elements-terminal-host-${toAgentElementsId(terminal.id)}`}
              style={{ display: activeTerminalId === terminal.id ? 'flex' : 'none' }}
            >
              <TerminalPanel
                terminalId={terminal.id}
                workspacePath={workspacePath}
                isActive={activeTerminalId === terminal.id}
                panelVisible={visible}
                onExit={(exitCode) => handleTerminalExit(terminal.id, exitCode)}
              />
            </div>
          ))}
          {terminals.length === 0 && (
            <div
              className="terminal-bottom-panel-empty agent-elements-terminal-empty agent-elements-tool-card flex flex-1 flex-col items-center justify-center gap-[var(--an-spacing-lg)] bg-[var(--an-background)] text-sm text-[var(--an-foreground-muted)]"
              data-agent-elements-shell="terminal-empty-state"
              data-testid="agent-elements-terminal-empty"
            >
              <p>No terminals open</p>
              <button
                className="agent-elements-terminal-empty-action flex cursor-pointer items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-sm)] text-[13px] text-[var(--an-foreground)] transition-colors duration-150 hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)]"
                data-agent-elements-shell="terminal-empty-new-tab"
                data-testid="agent-elements-terminal-empty-new-tab"
                onClick={handleCreateTerminal}
              >
                <MaterialSymbol icon="terminal" size={16} />
                New Terminal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TerminalBottomPanel;
