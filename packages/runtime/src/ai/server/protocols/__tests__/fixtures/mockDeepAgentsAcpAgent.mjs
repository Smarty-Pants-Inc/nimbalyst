#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import {
  AgentSideConnection,
  PROTOCOL_VERSION,
  ndJsonStream,
} from '@agentclientprotocol/sdk';

class MockDeepAgentsAcpAgent {
  constructor(connection) {
    this.connection = connection;
    this.sessions = new Map();
  }

  async initialize() {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: true,
      },
    };
  }

  async newSession(params) {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, { cwd: params.cwd, config: {} });
    return {
      sessionId,
      configOptions: [
        {
          id: 'model',
          name: 'Model',
          category: 'model',
          type: 'select',
          currentValue: 'openai:gpt-5.4',
          options: [{ value: 'openai:gpt-5.4', name: 'GPT-5.4' }],
        },
      ],
    };
  }

  async loadSession(params) {
    if (!this.sessions.has(params.sessionId)) {
      throw new Error(`Unknown session: ${params.sessionId}`);
    }
    return {};
  }

  async setSessionMode() {
    return {};
  }

  async setSessionConfigOption(params) {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Unknown session: ${params.sessionId}`);
    }
    session.config[params.configId] = params.value;
    return {};
  }

  async prompt(params) {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Unknown session: ${params.sessionId}`);
    }

    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: `model=${session.config.model};mode=${session.config.mode};base=${process.env.NIMBALYST_CLI_PROXY_BASE_URL || ''};key=${process.env.NIMBALYST_CLI_PROXY_API_KEY ? 'present' : 'missing'};`,
        },
      },
    });

    const targetPath = path.join(session.cwd, 'deepagents-target.txt');
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-1',
        title: `acp_fs.write_text_file (${path.basename(targetPath)})`,
        kind: 'edit',
        status: 'pending',
        locations: [{ path: targetPath }],
        rawInput: { path: targetPath, content: 'after from deepagents acp\n' },
      },
    });

    const permission = await this.connection.requestPermission({
      sessionId: params.sessionId,
      toolCall: {
        toolCallId: 'tool-1',
        title: `acp_fs.write_text_file (${path.basename(targetPath)})`,
        kind: 'edit',
        status: 'pending',
        locations: [{ path: targetPath }],
        rawInput: { path: targetPath, content: 'after from deepagents acp\n' },
      },
      options: [
        { optionId: 'approved-for-session', name: 'Approve for session', kind: 'allow_always' },
        { optionId: 'approved', name: 'Approve once', kind: 'allow_once' },
        { optionId: 'abort', name: 'Reject', kind: 'reject_once' },
      ],
    });

    if (permission.outcome.outcome !== 'selected' || permission.outcome.optionId === 'abort') {
      await this.connection.sessionUpdate({
        sessionId: params.sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tool-1',
          status: 'failed',
          rawOutput: { error: 'User denied DeepAgents ACP edit' },
        },
      });
      return { stopReason: 'cancelled', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } };
    }

    await this.connection.writeTextFile({
      sessionId: params.sessionId,
      path: targetPath,
      content: 'after from deepagents acp\n',
    });

    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-1',
        status: 'completed',
        rawOutput: { path: targetPath },
      },
    });

    return { stopReason: 'end_turn', usage: { inputTokens: 3, outputTokens: 7, totalTokens: 10 } };
  }

  async cancel() {
    return;
  }
}

const stream = ndJsonStream(
  Writable.toWeb(process.stdout),
  Readable.toWeb(process.stdin),
);

new AgentSideConnection((connection) => new MockDeepAgentsAcpAgent(connection), stream);
