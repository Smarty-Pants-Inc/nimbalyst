/**
 * IPC handlers for action prompts (ai-actions.md).
 *
 * Channels:
 *   action-prompts:list         (request/response)  list actions for a workspace
 *   action-prompts:open-file    (request/response)  ensure file exists, then ask the renderer to open it in a tab
 *   action-prompts:changed      (broadcast)         action list changed for a workspace
 */

import { BrowserWindow } from 'electron';
import { getActionPromptService } from '../services/ActionPromptService';
import { findWindowByWorkspace } from '../window/WindowManager';
import { safeHandle } from '../utils/ipcRegistry';

const broadcastSubscribed = new Set<string>();

function broadcastChanged(workspacePath: string, payload: Awaited<ReturnType<ReturnType<typeof getActionPromptService>['list']>>) {
  const window = findWindowByWorkspace(workspacePath);
  if (window && !window.isDestroyed()) {
    window.webContents.send('action-prompts:changed', { workspacePath, ...payload });
  }
}

function ensureChangeBroadcast(workspacePath: string) {
  if (broadcastSubscribed.has(workspacePath)) return;
  broadcastSubscribed.add(workspacePath);
  const service = getActionPromptService(workspacePath);
  service.onChange(async () => {
    try {
      const result = await service.list();
      broadcastChanged(workspacePath, result);
    } catch (err) {
      console.error('[ActionPromptHandlers] Failed to broadcast changed list:', err);
    }
  });
}

export function registerActionPromptHandlers() {
  safeHandle('action-prompts:list', async (_event, payload: { workspacePath: string }) => {
    const workspacePath = payload?.workspacePath;
    if (!workspacePath) {
      throw new Error('action-prompts:list requires workspacePath');
    }
    const service = getActionPromptService(workspacePath);
    const result = await service.list();
    ensureChangeBroadcast(workspacePath);
    return result;
  });

  safeHandle('action-prompts:open-file', async (event, payload: { workspacePath: string }) => {
    const workspacePath = payload?.workspacePath;
    if (!workspacePath) {
      throw new Error('action-prompts:open-file requires workspacePath');
    }
    const service = getActionPromptService(workspacePath);
    const filePath = await service.ensureFileExists();

    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.webContents.send('open-document', { path: filePath });
    }
    return { filePath };
  });
}
