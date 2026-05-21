import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DeepAgentsACPProtocol } from '../DeepAgentsACPProtocol';

function fixturePath(): string {
  return path.join(__dirname, 'fixtures', 'mockDeepAgentsAcpAgent.mjs');
}

describe('DeepAgentsACPProtocol', () => {
  it('defaults to the Nimbalyst Python launcher with explicit OpenAI-compatible dependencies', () => {
    const launch = DeepAgentsACPProtocol.resolveDefaultLaunchCommand();

    expect(launch.command).toBe('uv');
    expect(launch.args).toContain('deepagents-acp');
    expect(launch.args).toContain('langchain-openai');
    expect(launch.args[launch.args.length - 1]).toMatch(/deepagents_acp_launcher\.py$/);
  });

  it('sets DeepAgents model/mode config and routes ACP file writes through Nimbalyst callbacks', async () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'deepagents-acp-protocol-'));
    const callbackEvents: Array<{ type: string; path: string; sessionId: string | undefined }> = [];
    const permissionRequests: any[] = [];
    const protocol = new DeepAgentsACPProtocol('explicit-token', {
      command: process.execPath,
      args: [fixturePath()],
      onPermissionRequest: async (request) => {
        permissionRequests.push(request);
        return { decision: 'allow', scope: 'session' };
      },
      onBeforeFileWrite: async (filePath, sessionId) => {
        callbackEvents.push({ type: 'before', path: filePath, sessionId });
      },
      onTurnFilesEdited: async (filePaths, sessionId) => {
        for (const filePath of filePaths) {
          callbackEvents.push({ type: 'turn', path: filePath, sessionId });
        }
      },
    });

    try {
      const nimbalystSessionId = 'nimbalyst-session-1';
      const session = await protocol.createSession({
        workspacePath,
        permissionMode: 'ask',
        model: 'openai:gpt-5.4',
      });

      const events: any[] = [];
      for await (const event of protocol.sendMessage(session, {
        content: 'Apply the DeepAgents ACP edit',
        sessionId: nimbalystSessionId,
      })) {
        events.push(event);
      }

      const targetPath = path.join(workspacePath, 'deepagents-target.txt');
      expect(events.some((event) => event.type === 'text' && event.content.includes('model=openai:gpt-5.4;mode=ask_before_edits'))).toBe(true);
      expect(permissionRequests).toHaveLength(1);
      expect(permissionRequests[0]).toEqual(expect.objectContaining({
        nimbalystSessionId,
        workspacePath,
        toolName: 'Write',
      }));
      expect(fs.readFileSync(targetPath, 'utf-8')).toBe('after from deepagents acp\n');
      expect(callbackEvents).toEqual([
        { type: 'before', path: targetPath, sessionId: nimbalystSessionId },
        { type: 'turn', path: targetPath, sessionId: nimbalystSessionId },
      ]);
    } finally {
      protocol.destroy();
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('passes explicit CLIProxyAPI base URL and token to the child process environment', async () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'deepagents-acp-env-'));
    const protocol = new DeepAgentsACPProtocol('explicit-token', {
      command: process.execPath,
      args: [fixturePath()],
    });
    protocol.setBaseUrl('http://127.0.0.1:8317/v1');

    try {
      const session = await protocol.createSession({
        workspacePath,
        permissionMode: 'ask',
        model: 'openai:gpt-5.4',
      });
      const events: any[] = [];
      for await (const event of protocol.sendMessage(session, {
        content: 'Report launch environment',
        sessionId: 'nimbalyst-env-session',
      })) {
        events.push(event);
      }

      expect(events.some((event) => event.type === 'text' && event.content.includes('base=http://127.0.0.1:8317/v1;key=present;'))).toBe(true);
    } finally {
      protocol.destroy();
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('denies ACP permission requests when no permission handler is installed', async () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'deepagents-acp-deny-'));
    const protocol = new DeepAgentsACPProtocol('', {
      command: process.execPath,
      args: [fixturePath()],
    });

    try {
      const session = await protocol.createSession({
        workspacePath,
        permissionMode: 'ask',
        model: 'openai:gpt-5.4',
      });
      const events: any[] = [];
      for await (const event of protocol.sendMessage(session, {
        content: 'Attempt edit without handler',
        sessionId: 'nimbalyst-session-2',
      })) {
        events.push(event);
      }

      expect(fs.existsSync(path.join(workspacePath, 'deepagents-target.txt'))).toBe(false);
      expect(events.some((event) => event.type === 'tool_call' && event.toolCall?.result?.success === false)).toBe(true);
    } finally {
      protocol.destroy();
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });
});
