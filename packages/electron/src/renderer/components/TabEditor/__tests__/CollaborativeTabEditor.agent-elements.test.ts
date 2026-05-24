import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourcePath = resolve(__dirname, '../CollaborativeTabEditor.tsx');

function readSource() {
  return readFileSync(sourcePath, 'utf8');
}

describe('CollaborativeTabEditor Agent Elements shell', () => {
  it('keeps collaboration status and avatar chrome on Agent Elements tokens', () => {
    const source = readSource();

    expect(source).toContain('agent-elements-collab-status-bar');
    expect(source).toContain('data-agent-elements-shell="collab-status-bar"');
    expect(source).toContain('agent-elements-collab-status-dot');
    expect(source).toContain('data-status={status}');
    expect(source).toContain('agent-elements-collab-avatars');
    expect(source).toContain('agent-elements-collab-avatar');
    expect(source).toContain('agent-elements-collab-document');
    expect(source).toContain('MaterialSymbol icon="group"');

    const statusBarBlock = source.slice(
      source.indexOf('const CollabStatusBar'),
      source.indexOf('// ---------------------------------------------------------------------------', source.indexOf('const CollabStatusBar') + 1)
    );
    expect(statusBarBlock).not.toMatch(/style=\{\{|#fff|bg-white|bg-black|text-white|rounded-md|rounded-lg|rgba\(|backdrop.*blur|scale-/);
    expect(statusBarBlock).not.toMatch(/bg-green-500|bg-blue-500|bg-orange-500|bg-red-500|bg-yellow-500|bg-gray-500/);
  });
});
