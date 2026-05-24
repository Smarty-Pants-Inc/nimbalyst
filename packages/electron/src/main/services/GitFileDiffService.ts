import { existsSync } from 'fs';
import simpleGit, { SimpleGit } from 'simple-git';
import { resolveGitFileTarget } from './GitPathService';

export type GitFileDiffGroup = 'staged' | 'unstaged' | 'untracked' | 'conflicted' | 'working';

export interface GitFileDiffResult {
  unifiedDiff: string;
  isBinary: boolean;
  truncated?: boolean;
}

export interface GitFileDiffRequest {
  path: string;
  group: GitFileDiffGroup;
}

async function hasCommits(git: SimpleGit): Promise<boolean> {
  try {
    await git.revparse(['HEAD']);
    return true;
  } catch {
    return false;
  }
}

function diffResult(diff: string): GitFileDiffResult {
  return {
    unifiedDiff: diff,
    isBinary: /\bBinary files\b/.test(diff),
  };
}

async function synthesizeUntrackedDiff(
  git: SimpleGit,
  gitFilePath: string
): Promise<GitFileDiffResult> {
  try {
    const diff = await git.raw(['diff', '--no-index', '--', '/dev/null', gitFilePath]);
    return diffResult(diff);
  } catch (err) {
    const diff = (err as { stdout?: string })?.stdout ?? '';
    if (diff) {
      return diffResult(diff);
    }
    throw err;
  }
}

export async function getGitFileDiff(
  workspacePath: string,
  request: GitFileDiffRequest
): Promise<GitFileDiffResult> {
  const target = resolveGitFileTarget(workspacePath, request.path, 'workspaceOrRelatedWorktree');
  if (!target) {
    return { unifiedDiff: '', isBinary: false };
  }

  const git: SimpleGit = simpleGit(target.gitWorkspacePath);
  const repoHasCommits = await hasCommits(git);

  if (request.group === 'staged') {
    return diffResult(await git.diff(['--cached', '--', target.gitFilePath]));
  }

  if (request.group === 'unstaged' || request.group === 'conflicted') {
    return diffResult(await git.diff(['--', target.gitFilePath]));
  }

  if (request.group === 'working') {
    if (repoHasCommits) {
      const diff = await git.diff(['HEAD', '--', target.gitFilePath]);
      if (diff.trim().length > 0) {
        return diffResult(diff);
      }
    }

    if (!existsSync(target.absolutePath)) {
      return { unifiedDiff: '', isBinary: false };
    }
    return synthesizeUntrackedDiff(git, target.gitFilePath);
  }

  if (request.group === 'untracked') {
    if (!existsSync(target.absolutePath)) {
      return { unifiedDiff: '', isBinary: false };
    }
    return synthesizeUntrackedDiff(git, target.gitFilePath);
  }

  return { unifiedDiff: '', isBinary: false };
}
