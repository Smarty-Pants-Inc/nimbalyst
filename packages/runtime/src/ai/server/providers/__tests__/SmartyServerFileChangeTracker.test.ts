import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import type { ProtocolEvent } from '../../protocols/ProtocolInterface';
import { SmartyServerFileChangeTracker } from '../SmartyServerFileChangeTracker';

describe('SmartyServerFileChangeTracker', () => {
  it('clears pending file changes for the session on cancellation cleanup', async () => {
    const tracker = new SmartyServerFileChangeTracker();
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'smarty-file-tracker-clear-'));
    try {
      const target = path.join(workspace, 'src', 'example.ts');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, 'before\n');

      const toolCall: ProtocolEvent = {
        type: 'tool_call',
        toolCall: {
          id: 'tool-1',
          name: 'edit_file',
          arguments: { file_path: target, old_string: 'before', new_string: 'after' },
        },
      };
      const preEdit = await tracker.buildChunksForEvent(toolCall, 'session-1', workspace);
      expect(preEdit.handled).toBe(true);

      tracker.clearSession('session-1');
      await fs.writeFile(target, 'after\n');

      const staleResult: ProtocolEvent = {
        type: 'tool_result',
        toolResult: {
          id: 'tool-1',
          name: 'edit_file',
          result: { success: true },
        },
      };
      const chunks = await tracker.buildChunksForEvent(staleResult, 'session-1', workspace);
      expect(chunks).toEqual({ handled: false, chunks: [] });
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });
});
