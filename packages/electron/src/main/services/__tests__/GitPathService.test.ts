import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  findGitRootForFile,
  resolveGitDiffTarget,
  resolveGitFileTarget,
} from '../GitPathService';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nim-git-path-test-'));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function mkdirp(target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
}

async function touchFile(target: string): Promise<void> {
  await mkdirp(path.dirname(target));
  await fs.writeFile(target, '');
}

async function makeGitRepo(target: string): Promise<void> {
  await mkdirp(path.join(target, '.git'));
  await fs.writeFile(path.join(target, '.git', 'HEAD'), 'ref: refs/heads/main\n');
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
  await fs.writeFile(path.join(target, 'README.md'), 'base\n');
  git(target, ['add', 'README.md']);
  git(target, ['commit', '-q', '-m', 'init']);
}

async function addRealWorktree(repoPath: string, worktreePath: string, branchName: string): Promise<void> {
  await mkdirp(path.dirname(worktreePath));
  git(repoPath, ['worktree', 'add', '-q', '-b', branchName, worktreePath]);
}

describe('findGitRootForFile', () => {
  it('returns workspace root when workspace is a git repo', async () => {
    const workspace = path.join(tmpRoot, 'ws');
    await makeGitRepo(workspace);
    const file = path.join(workspace, 'src', 'app.ts');
    await touchFile(file);

    expect(findGitRootForFile(file, workspace)).toBe(path.resolve(workspace));
  });

  it('returns the nested repo root when workspace root has no .git but a subdir does', async () => {
    const workspace = path.join(tmpRoot, 'super');
    await mkdirp(workspace);
    const nested = path.join(workspace, 'project-a');
    await makeGitRepo(nested);
    const file = path.join(nested, 'src', 'main.ts');
    await touchFile(file);

    expect(findGitRootForFile(file, workspace)).toBe(path.resolve(nested));
  });

  it('returns the deepest nested repo when both workspace and inner subdir are git repos', async () => {
    const workspace = path.join(tmpRoot, 'monorepo');
    await makeGitRepo(workspace);
    const sub = path.join(workspace, 'vendor', 'thirdparty');
    await makeGitRepo(sub);
    const file = path.join(sub, 'lib.ts');
    await touchFile(file);

    expect(findGitRootForFile(file, workspace)).toBe(path.resolve(sub));
  });

  it('returns null when workspace contains no git repos at all', async () => {
    const workspace = path.join(tmpRoot, 'nogit');
    await mkdirp(workspace);
    const file = path.join(workspace, 'notes.md');
    await touchFile(file);

    expect(findGitRootForFile(file, workspace)).toBeNull();
  });

  it('returns null when file is outside the workspace boundary', async () => {
    const workspace = path.join(tmpRoot, 'ws');
    await makeGitRepo(workspace);
    const sibling = path.join(tmpRoot, 'other', 'file.txt');
    await touchFile(sibling);

    expect(findGitRootForFile(sibling, workspace)).toBeNull();
  });

  it('handles relative file paths by resolving against the workspace', async () => {
    const workspace = path.join(tmpRoot, 'ws');
    await makeGitRepo(workspace);
    const file = path.join(workspace, 'a', 'b.ts');
    await touchFile(file);

    expect(findGitRootForFile('a/b.ts', workspace)).toBe(path.resolve(workspace));
  });

  it('does not match a sibling directory whose path is a string-prefix of the workspace', async () => {
    const workspace = path.join(tmpRoot, 'foo');
    await makeGitRepo(workspace);
    const sibling = path.join(tmpRoot, 'foo2', 'inside.ts');
    await touchFile(sibling);

    expect(findGitRootForFile(sibling, workspace)).toBeNull();
  });
});

describe('resolveGitFileTarget', () => {
  it('keeps workspace-root files relative to the workspace repo', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const filePath = path.join(workspacePath, 'src', 'index.ts');
    await makeGitRepo(workspacePath);
    await touchFile(filePath);

    expect(resolveGitFileTarget(workspacePath, filePath, 'workspaceOnly')).toEqual({
      filePath: 'src/index.ts',
      absolutePath: filePath,
      gitWorkspacePath: workspacePath,
      gitFilePath: 'src/index.ts',
    });
    expect(resolveGitDiffTarget(workspacePath, filePath)).toEqual({
      gitWorkspacePath: workspacePath,
      gitFilePath: 'src/index.ts',
    });
  });

  it('resolves sibling worktree files only for the related-worktree policy', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const worktreePath = path.join(tmpRoot, 'project_worktrees', 'bright-tide');
    const filePath = path.join(worktreePath, 'packages', 'runtime', 'src', 'widget.tsx');
    await initCommittedRepo(workspacePath);
    await addRealWorktree(workspacePath, worktreePath, 'bright-tide');
    await touchFile(filePath);

    expect(resolveGitFileTarget(workspacePath, filePath, 'workspaceOnly')).toBeNull();
    expect(resolveGitFileTarget(workspacePath, filePath, 'workspaceOrRelatedWorktree')).toEqual({
      filePath,
      absolutePath: filePath,
      gitWorkspacePath: worktreePath,
      gitFilePath: 'packages/runtime/src/widget.tsx',
    });
    expect(resolveGitDiffTarget(workspacePath, filePath)).toEqual({
      gitWorkspacePath: worktreePath,
      gitFilePath: 'packages/runtime/src/widget.tsx',
    });
  });

  it('rejects convention-matching sibling worktree paths without a git root', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const worktreePath = path.join(tmpRoot, 'project_worktrees', 'not-a-worktree');
    const filePath = path.join(worktreePath, 'src', 'not-owned.ts');
    await makeGitRepo(workspacePath);
    await touchFile(filePath);

    expect(resolveGitFileTarget(workspacePath, filePath, 'workspaceOrRelatedWorktree')).toBeNull();
    expect(resolveGitDiffTarget(workspacePath, filePath)).toBeNull();
  });

  it('rejects convention-matching sibling paths when only a nested unrelated git root exists', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const worktreePath = path.join(tmpRoot, 'project_worktrees', 'not-related');
    const unrelatedRepo = path.join(worktreePath, 'nested-repo');
    const filePath = path.join(unrelatedRepo, 'src', 'not-owned.ts');
    await makeGitRepo(workspacePath);
    await makeGitRepo(unrelatedRepo);
    await touchFile(filePath);

    expect(resolveGitFileTarget(workspacePath, filePath, 'workspaceOrRelatedWorktree')).toBeNull();
    expect(resolveGitDiffTarget(workspacePath, filePath)).toBeNull();
  });

  it('rejects convention-matching sibling paths whose root is a standalone git repo', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const siblingRepo = path.join(tmpRoot, 'project_worktrees', 'standalone-clone');
    const filePath = path.join(siblingRepo, 'src', 'not-owned.ts');
    await makeGitRepo(workspacePath);
    await makeGitRepo(siblingRepo);
    await touchFile(filePath);

    expect(resolveGitFileTarget(workspacePath, filePath, 'workspaceOrRelatedWorktree')).toBeNull();
    expect(resolveGitDiffTarget(workspacePath, filePath)).toBeNull();
  });

  it('rejects convention-matching linked worktrees from an unrelated git repository', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const unrelatedRepo = path.join(tmpRoot, 'unrelated');
    const worktreePath = path.join(tmpRoot, 'project_worktrees', 'not-related');
    const filePath = path.join(worktreePath, 'src', 'not-owned.ts');
    await initCommittedRepo(workspacePath);
    await initCommittedRepo(unrelatedRepo);
    await addRealWorktree(unrelatedRepo, worktreePath, 'not-related');
    await touchFile(filePath);

    expect(resolveGitFileTarget(workspacePath, filePath, 'workspaceOrRelatedWorktree')).toBeNull();
    expect(resolveGitDiffTarget(workspacePath, filePath)).toBeNull();
  });

  it('resolves parent project files from a related worktree workspace', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const worktreePath = path.join(tmpRoot, 'project_worktrees', 'bright-tide');
    const projectFilePath = path.join(workspacePath, 'README.md');
    await initCommittedRepo(workspacePath);
    await addRealWorktree(workspacePath, worktreePath, 'bright-tide');

    expect(resolveGitFileTarget(worktreePath, projectFilePath, 'workspaceOnly')).toBeNull();
    expect(resolveGitFileTarget(worktreePath, projectFilePath, 'workspaceOrRelatedWorktree')).toEqual({
      filePath: projectFilePath,
      absolutePath: projectFilePath,
      gitWorkspacePath: workspacePath,
      gitFilePath: 'README.md',
    });
    expect(resolveGitDiffTarget(worktreePath, projectFilePath)).toEqual({
      gitWorkspacePath: workspacePath,
      gitFilePath: 'README.md',
    });
  });

  it('rejects parent project files from an unrelated convention-matching worktree workspace', async () => {
    const workspacePath = path.join(tmpRoot, 'project');
    const unrelatedRepo = path.join(tmpRoot, 'unrelated');
    const unrelatedWorktreePath = path.join(tmpRoot, 'project_worktrees', 'not-related');
    const projectFilePath = path.join(workspacePath, 'README.md');
    await initCommittedRepo(workspacePath);
    await initCommittedRepo(unrelatedRepo);
    await addRealWorktree(unrelatedRepo, unrelatedWorktreePath, 'not-related');

    expect(resolveGitFileTarget(unrelatedWorktreePath, projectFilePath, 'workspaceOrRelatedWorktree')).toBeNull();
    expect(resolveGitDiffTarget(unrelatedWorktreePath, projectFilePath)).toBeNull();
  });
});
