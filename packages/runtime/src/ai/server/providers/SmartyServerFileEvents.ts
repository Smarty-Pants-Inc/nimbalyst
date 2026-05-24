import { promises as fs } from 'fs';
import * as path from 'path';
import type { StreamChunk, ToolResult } from '../types';
import { isRecord } from './SmartyServerProviderUtils';

export interface PendingFileChange {
  toolUseId: string;
  path: string;
  kind: 'add' | 'update';
  beforeContent: string;
}

export async function readTextFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export function fileChangeKey(sessionId: string, toolUseId: string): string {
  return `${sessionId}:${toolUseId}`;
}

export function approvedFileActionKey(sessionId: string, toolName: string | undefined, filePath: string): string {
  return `${sessionId}:${toolName || 'unknown'}:${path.normalize(filePath)}`;
}

export function extractRawEventRunIdentity(metadata: Record<string, unknown> | undefined): {
  runId?: string;
  threadId?: string;
} {
  const runId = typeof metadata?.runId === 'string' && metadata.runId
    ? metadata.runId
    : undefined;
  const threadId = typeof metadata?.threadId === 'string' && metadata.threadId
    ? metadata.threadId
    : undefined;
  return {
    ...(runId ? { runId } : {}),
    ...(threadId ? { threadId } : {}),
  };
}

export function buildFileChangeToolChunk(
  toolUseId: string,
  filePath: string,
  kind: 'add' | 'update',
  result?: ToolResult,
): StreamChunk {
  const change = { path: filePath, kind };
  return {
    type: 'tool_call',
    toolCall: {
      id: toolUseId,
      name: 'file_change',
      arguments: { changes: [change] },
      toolUseId,
      ...(result ? { result: { ...result, changes: [change] } } : {}),
    },
  };
}

export function isFailedToolResult(result: unknown): boolean {
  return isRecord(result) && (result.success === false || result.status === 'error' || 'error' in result);
}
