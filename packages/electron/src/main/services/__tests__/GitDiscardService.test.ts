import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  discardGitChangesForFiles,
  resolveGitDiscardCandidates,
} from '../GitDiscardService';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nim-git-discard-test-'));
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
  await fs.writeFile(path.join(target, 'unchanged.txt'), 'still clean\n');
  git(target, ['add', 'tracked.txt', 'unchanged.txt']);
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

describe('resolveGitDiscardCandidates', () => {
  it('normalizes absolute and relative paths under the workspace', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await mkdirp(path.join(workspacePath, 'src'));

    expect(resolveGitDiscardCandidates(workspacePath, [
      'src/index.ts',
      path.join(workspacePath, 'src', 'other.ts'),
    ])).toEqual({
      candidates: [
        {
          filePath: 'src/index.ts',
          absolutePath: path.join(workspacePath, 'src', 'index.ts'),
          gitWorkspacePath: workspacePath,
          gitFilePath: 'src/index.ts',
        },
        {
          filePath: 'src/other.ts',
          absolutePath: path.join(workspacePath, 'src', 'other.ts'),
          gitWorkspacePath: workspacePath,
          gitFilePath: 'src/other.ts',
        },
      ],
      errors: [],
    });
  });

  it('rejects paths outside the workspace with a destructive-operation error', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const outsidePath = path.join(tmpRoot, 'outside.txt');
    await mkdirp(workspacePath);

    const result = resolveGitDiscardCandidates(workspacePath, [outsidePath, '../escape.txt']);

    expect(result.candidates).toEqual([]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map(error => error.error)).toEqual([
      'file must be inside the workspace root',
      'file must be inside the workspace root',
    ]);
  });

  it('rejects the workspace root itself as a file discard target', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await mkdirp(workspacePath);

    expect(resolveGitDiscardCandidates(workspacePath, [workspacePath])).toEqual({
      candidates: [],
      errors: [
        {
          filePath: workspacePath,
          absolutePath: workspacePath,
          error: 'file must be inside the workspace root',
        },
      ],
    });
  });

  it('rejects sibling worktree files because discard is destructive', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const worktreePath = path.join(tmpRoot, 'project_worktrees', 'bright-tide');
    const filePath = path.join(worktreePath, 'packages', 'runtime', 'src', 'widget.tsx');
    await mkdirp(path.dirname(filePath));
    await fs.writeFile(filePath, 'export const widget = true;\n');

    const result = resolveGitDiscardCandidates(workspacePath, [filePath]);

    expect(result.candidates).toEqual([]);
    expect(result.errors).toEqual([
      {
        filePath,
        absolutePath: filePath,
        error: 'file must be inside the workspace root',
      },
    ]);
  });
});

describe('discardGitChangesForFiles', () => {
  it('restores tracked working-tree changes from git', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);
    await fs.writeFile(path.join(workspacePath, 'tracked.txt'), 'changed\n');

    const result = await discardGitChangesForFiles(workspacePath, [
      path.join(workspacePath, 'tracked.txt'),
    ]);

    expect(result.success).toBe(true);
    expect(result.discarded).toEqual([
      {
        filePath: 'tracked.txt',
        absolutePath: path.join(workspacePath, 'tracked.txt'),
        kind: 'tracked',
      },
    ]);
    expect(await fs.readFile(path.join(workspacePath, 'tracked.txt'), 'utf8')).toBe('base\n');
    expect(git(workspacePath, ['status', '--porcelain=v1'])).toBe('');
  });

  it('removes untracked files after git reports them as untracked', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);
    const untrackedPath = path.join(workspacePath, 'created.txt');
    await fs.writeFile(untrackedPath, 'new\n');

    const result = await discardGitChangesForFiles(workspacePath, ['created.txt']);

    expect(result.success).toBe(true);
    expect(result.discarded).toEqual([
      {
        filePath: 'created.txt',
        absolutePath: untrackedPath,
        kind: 'untracked',
      },
    ]);
    await expect(fs.access(untrackedPath)).rejects.toThrow();
    expect(git(workspacePath, ['status', '--porcelain=v1'])).toBe('');
  });

  it('removes staged new files without leaving them in the index', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);
    const stagedNewPath = path.join(workspacePath, 'staged-new.txt');
    await fs.writeFile(stagedNewPath, 'new\n');
    git(workspacePath, ['add', 'staged-new.txt']);

    const result = await discardGitChangesForFiles(workspacePath, ['staged-new.txt']);

    expect(result.success).toBe(true);
    expect(result.discarded).toEqual([
      {
        filePath: 'staged-new.txt',
        absolutePath: stagedNewPath,
        kind: 'tracked',
      },
    ]);
    await expect(fs.access(stagedNewPath)).rejects.toThrow();
    expect(git(workspacePath, ['status', '--porcelain=v1'])).toBe('');
  });

  it('handles tracked, untracked, and unchanged files in one request', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);
    await fs.writeFile(path.join(workspacePath, 'tracked.txt'), 'changed\n');
    await fs.writeFile(path.join(workspacePath, 'created.txt'), 'new\n');

    const result = await discardGitChangesForFiles(workspacePath, [
      'tracked.txt',
      'created.txt',
      'unchanged.txt',
    ]);

    expect(result.success).toBe(true);
    expect(result.discarded.map(file => [file.filePath, file.kind])).toEqual([
      ['tracked.txt', 'tracked'],
      ['created.txt', 'untracked'],
    ]);
    expect(result.skipped).toEqual([
      {
        filePath: 'unchanged.txt',
        absolutePath: path.join(workspacePath, 'unchanged.txt'),
        reason: 'unchanged or not tracked by git status',
      },
    ]);
    expect(result.errors).toEqual([]);
    expect(git(workspacePath, ['status', '--porcelain=v1'])).toBe('');
  });

  it('hard-stops validation errors before touching valid candidates', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);
    await fs.writeFile(path.join(workspacePath, 'tracked.txt'), 'changed\n');

    const result = await discardGitChangesForFiles(workspacePath, [
      'tracked.txt',
      path.join(tmpRoot, 'outside.txt'),
    ]);

    expect(result.success).toBe(false);
    expect(result.discarded).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.error).toBe('file must be inside the workspace root');
    expect(await fs.readFile(path.join(workspacePath, 'tracked.txt'), 'utf8')).toBe('changed\n');
  });

  it('refuses to recursively remove directories that may contain ignored files', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);
    await fs.writeFile(path.join(workspacePath, '.gitignore'), '*.log\n');
    git(workspacePath, ['add', '.gitignore']);
    git(workspacePath, ['commit', '-q', '-m', 'ignore logs']);
    await mkdirp(path.join(workspacePath, 'scratch'));
    await fs.writeFile(path.join(workspacePath, 'scratch', 'visible.txt'), 'untracked\n');
    await fs.writeFile(path.join(workspacePath, 'scratch', 'ignored.log'), 'ignored-local\n');

    const result = await discardGitChangesForFiles(workspacePath, ['scratch']);

    expect(result.success).toBe(false);
    expect(result.discarded).toEqual([]);
    expect(result.errors).toEqual([
      {
        filePath: 'scratch',
        absolutePath: path.join(workspacePath, 'scratch'),
        error: 'refusing to remove a directory; select files instead',
      },
    ]);
    expect(await fs.readFile(path.join(workspacePath, 'scratch', 'visible.txt'), 'utf8')).toBe('untracked\n');
    expect(await fs.readFile(path.join(workspacePath, 'scratch', 'ignored.log'), 'utf8')).toBe('ignored-local\n');
  });

  it('hard-stops mixed untracked-directory errors before touching tracked candidates', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);
    await fs.writeFile(path.join(workspacePath, 'tracked.txt'), 'changed\n');
    await mkdirp(path.join(workspacePath, 'scratch'));
    await fs.writeFile(path.join(workspacePath, 'scratch', 'visible.txt'), 'untracked\n');

    const result = await discardGitChangesForFiles(workspacePath, [
      'tracked.txt',
      'scratch',
    ]);

    expect(result.success).toBe(false);
    expect(result.discarded).toEqual([]);
    expect(result.errors).toEqual([
      {
        filePath: 'scratch',
        absolutePath: path.join(workspacePath, 'scratch'),
        error: 'refusing to remove a directory; select files instead',
      },
    ]);
    expect(await fs.readFile(path.join(workspacePath, 'tracked.txt'), 'utf8')).toBe('changed\n');
    expect(await fs.readFile(path.join(workspacePath, 'scratch', 'visible.txt'), 'utf8')).toBe('untracked\n');
  });

  it('refuses tracked-file-to-directory replacements before git restore can delete local contents', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    await initCommittedRepo(workspacePath);
    const trackedPath = path.join(workspacePath, 'tracked.txt');
    await fs.rm(trackedPath);
    await mkdirp(trackedPath);
    await fs.writeFile(path.join(trackedPath, 'local.txt'), 'local directory contents\n');

    const result = await discardGitChangesForFiles(workspacePath, ['tracked.txt']);

    expect(result.success).toBe(false);
    expect(result.discarded).toEqual([]);
    expect(result.errors).toEqual([
      {
        filePath: 'tracked.txt',
        absolutePath: trackedPath,
        error: 'refusing to remove a directory; select files instead',
      },
    ]);
    expect(await fs.readFile(path.join(trackedPath, 'local.txt'), 'utf8')).toBe('local directory contents\n');
  });

  it('restores tracked files from their nested git root', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const nestedPath = await initCommittedNestedRepo(workspacePath, 'forks/nimbalyst');
    const nestedFilePath = path.join(nestedPath, 'nested-tracked.txt');
    await fs.writeFile(nestedFilePath, 'nested changed\n');

    const result = await discardGitChangesForFiles(workspacePath, [
      'forks/nimbalyst/nested-tracked.txt',
    ]);

    expect(result.success).toBe(true);
    expect(result.discarded).toEqual([
      {
        filePath: 'forks/nimbalyst/nested-tracked.txt',
        absolutePath: nestedFilePath,
        kind: 'tracked',
      },
    ]);
    expect(await fs.readFile(nestedFilePath, 'utf8')).toBe('nested base\n');
    expect(git(nestedPath, ['status', '--porcelain=v1'])).toBe('');
  });

  it('removes untracked files from their nested git root', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const nestedPath = await initCommittedNestedRepo(workspacePath, 'forks/nimbalyst');
    const nestedUntrackedPath = path.join(nestedPath, 'nested-created.txt');
    await fs.writeFile(nestedUntrackedPath, 'nested new\n');

    const result = await discardGitChangesForFiles(workspacePath, [
      path.join(workspacePath, 'forks/nimbalyst/nested-created.txt'),
    ]);

    expect(result.success).toBe(true);
    expect(result.discarded).toEqual([
      {
        filePath: 'forks/nimbalyst/nested-created.txt',
        absolutePath: nestedUntrackedPath,
        kind: 'untracked',
      },
    ]);
    await expect(fs.access(nestedUntrackedPath)).rejects.toThrow();
    expect(git(nestedPath, ['status', '--porcelain=v1'])).toBe('');
  });
});
