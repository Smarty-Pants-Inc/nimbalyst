import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { getGitFileDiff } from '../GitFileDiffService';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nim-git-file-diff-test-'));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function mkdirp(target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function initCommittedRepo(target: string): Promise<void> {
  await mkdirp(target);
  git(target, ['init', '-q']);
  git(target, ['config', 'user.email', 'test@example.com']);
  git(target, ['config', 'user.name', 'Test User']);
  await fs.writeFile(path.join(target, 'tracked.txt'), 'base\n');
  git(target, ['add', 'tracked.txt']);
  git(target, ['commit', '-q', '-m', 'init']);
}

async function initCommittedNestedRepo(workspacePath: string, nestedName = 'nested'): Promise<string> {
  await initCommittedRepo(workspacePath);
  const nestedPath = path.join(workspacePath, nestedName);
  await mkdirp(nestedPath);
  git(nestedPath, ['init', '-q']);
  git(nestedPath, ['config', 'user.email', 'test@example.com']);
  git(nestedPath, ['config', 'user.name', 'Test User']);
  await fs.writeFile(path.join(nestedPath, 'nested-tracked.txt'), 'nested base\n');
  git(nestedPath, ['add', 'nested-tracked.txt']);
  git(nestedPath, ['commit', '-q', '-m', 'nested init']);
  git(workspacePath, ['add', nestedName]);
  git(workspacePath, ['commit', '-q', '-m', 'add nested repo']);
  return nestedPath;
}

describe('getGitFileDiff', () => {
  it('returns staged diffs', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);
    await fs.writeFile(path.join(workspacePath, 'tracked.txt'), 'staged\n');
    git(workspacePath, ['add', 'tracked.txt']);

    const result = await getGitFileDiff(workspacePath, {
      path: 'tracked.txt',
      group: 'staged',
    });

    expect(result.isBinary).toBe(false);
    expect(result.unifiedDiff).toContain('-base');
    expect(result.unifiedDiff).toContain('+staged');
  });

  it('returns unstaged and conflicted-group working tree diffs', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);
    await fs.writeFile(path.join(workspacePath, 'tracked.txt'), 'unstaged\n');

    for (const group of ['unstaged', 'conflicted'] as const) {
      const result = await getGitFileDiff(workspacePath, {
        path: 'tracked.txt',
        group,
      });

      expect(result.isBinary).toBe(false);
      expect(result.unifiedDiff).toContain('-base');
      expect(result.unifiedDiff).toContain('+unstaged');
    }
  });

  it('returns a working diff from the nested git root that owns the file', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const nestedPath = await initCommittedNestedRepo(workspacePath, 'forks/nimbalyst');
    await fs.writeFile(path.join(nestedPath, 'nested-tracked.txt'), 'nested changed\n');

    const result = await getGitFileDiff(workspacePath, {
      path: 'forks/nimbalyst/nested-tracked.txt',
      group: 'working',
    });

    expect(result.isBinary).toBe(false);
    expect(result.unifiedDiff).toContain('-nested base');
    expect(result.unifiedDiff).toContain('+nested changed');
  });

  it('synthesizes a unified diff for untracked files', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);
    await fs.writeFile(path.join(workspacePath, 'created.txt'), 'new file\n');

    const result = await getGitFileDiff(workspacePath, {
      path: 'created.txt',
      group: 'untracked',
    });

    expect(result.isBinary).toBe(false);
    expect(result.unifiedDiff).toContain('--- /dev/null');
    expect(result.unifiedDiff).toContain('+++ b/created.txt');
    expect(result.unifiedDiff).toContain('+new file');
  });

  it('returns an empty diff for missing or outside targets', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);

    expect(await getGitFileDiff(workspacePath, {
      path: 'missing.txt',
      group: 'working',
    })).toEqual({ unifiedDiff: '', isBinary: false });

    expect(await getGitFileDiff(workspacePath, {
      path: path.join(tmpRoot, 'outside.txt'),
      group: 'working',
    })).toEqual({ unifiedDiff: '', isBinary: false });
  });

  it('resolves read-only diffs against a related sibling worktree git root', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const worktreePath = path.join(tmpRoot, 'project_worktrees', 'bright-tide');
    await initCommittedRepo(workspacePath);
    git(workspacePath, ['worktree', 'add', '-q', '-b', 'bright-tide', worktreePath]);
    await fs.writeFile(path.join(worktreePath, 'tracked.txt'), 'worktree changed\n');

    const result = await getGitFileDiff(workspacePath, {
      path: path.join(worktreePath, 'tracked.txt'),
      group: 'working',
    });

    expect(result.isBinary).toBe(false);
    expect(result.unifiedDiff).toContain('-base');
    expect(result.unifiedDiff).toContain('+worktree changed');
  });
});
