import { existsSync } from 'fs';
import { lstat, rm } from 'fs/promises';
import { resolve } from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { resolveGitFileTarget } from './GitPathService';

export interface GitDiscardFileResult {
  filePath: string;
  absolutePath: string;
  kind?: 'tracked' | 'untracked';
  reason?: string;
  error?: string;
}

export interface GitDiscardChangesResult {
  success: boolean;
  discarded: GitDiscardFileResult[];
  skipped: GitDiscardFileResult[];
  errors: GitDiscardFileResult[];
}

interface GitDiscardCandidate {
  filePath: string;
  absolutePath: string;
  gitWorkspacePath: string;
  gitFilePath: string;
}

type GitDiscardPlannedAction =
  | { type: 'skip'; candidate: GitDiscardCandidate; reason: string }
  | { type: 'tracked'; candidate: GitDiscardCandidate; git: SimpleGit; repoHasCommits: boolean }
  | { type: 'untracked'; candidate: GitDiscardCandidate };

export function resolveGitDiscardCandidates(
  workspacePath: string,
  files: string[]
): {
  candidates: GitDiscardCandidate[];
  errors: GitDiscardFileResult[];
} {
  const resolvedWorkspacePath = resolve(workspacePath);
  const candidatesByPath = new Map<string, GitDiscardCandidate>();
  const errors: GitDiscardFileResult[] = [];

  for (const file of files) {
    if (typeof file !== 'string' || file.trim().length === 0) {
      errors.push({
        filePath: String(file),
        absolutePath: '',
        error: 'file path is required',
      });
      continue;
    }

    const target = resolveGitFileTarget(resolvedWorkspacePath, file, 'workspaceOnly');
    if (!target) {
      errors.push({
        filePath: file,
        absolutePath: resolve(resolvedWorkspacePath, file),
        error: 'file must be inside the workspace root',
      });
      continue;
    }

    if (!candidatesByPath.has(target.filePath)) {
      candidatesByPath.set(target.filePath, {
        filePath: target.filePath,
        absolutePath: target.absolutePath,
        gitWorkspacePath: target.gitWorkspacePath,
        gitFilePath: target.gitFilePath,
      });
    }
  }

  return {
    candidates: Array.from(candidatesByPath.values()),
    errors,
  };
}

async function hasCommits(git: SimpleGit): Promise<boolean> {
  try {
    await git.revparse(['HEAD']);
    return true;
  } catch {
    return false;
  }
}

async function gitPathExistsInIndex(git: SimpleGit, filePath: string): Promise<boolean> {
  try {
    await git.raw(['ls-files', '--error-unmatch', '--', filePath]);
    return true;
  } catch {
    return false;
  }
}

async function gitPathExistsInHead(git: SimpleGit, filePath: string): Promise<boolean> {
  try {
    const output = await git.raw(['ls-tree', '-r', '--name-only', 'HEAD', '--', filePath]);
    return output.split('\n').some(line => line.trim() === filePath);
  } catch {
    return false;
  }
}

function statusOutputIsOnlyUntracked(statusOutput: string): boolean {
  const lines = statusOutput.split('\n').filter(line => line.trim().length > 0);
  return lines.length > 0 && lines.every(line => line.startsWith('?? '));
}

function discardFileResult(
  candidate: GitDiscardCandidate,
  extra: Omit<GitDiscardFileResult, 'filePath' | 'absolutePath'>
): GitDiscardFileResult {
  return {
    filePath: candidate.filePath,
    absolutePath: candidate.absolutePath,
    ...extra,
  };
}

export async function discardGitChangesForFiles(
  workspacePath: string,
  files: string[]
): Promise<GitDiscardChangesResult> {
  const resolvedWorkspacePath = resolve(workspacePath);
  const { candidates, errors } = resolveGitDiscardCandidates(resolvedWorkspacePath, files);
  const result: GitDiscardChangesResult = {
    success: errors.length === 0,
    discarded: [],
    skipped: [],
    errors: [...errors],
  };

  if (candidates.length === 0) {
    result.success = result.errors.length === 0;
    return result;
  }
  if (errors.length > 0) {
    return result;
  }

  const repoStateByRoot = new Map<string, { git: SimpleGit; repoHasCommits: boolean }>();
  const plannedActions: GitDiscardPlannedAction[] = [];

  for (const candidate of candidates) {
    try {
      let repoState = repoStateByRoot.get(candidate.gitWorkspacePath);
      if (!repoState) {
        const git: SimpleGit = simpleGit(candidate.gitWorkspacePath);
        repoState = { git, repoHasCommits: await hasCommits(git) };
        repoStateByRoot.set(candidate.gitWorkspacePath, repoState);
      }
      const { git, repoHasCommits } = repoState;

      const statusOutput = await git.raw([
        'status',
        '--porcelain=v1',
        '--untracked-files=all',
        '--',
        candidate.gitFilePath,
      ]);

      if (!statusOutput.trim()) {
        plannedActions.push({
          type: 'skip',
          candidate,
          reason: 'unchanged or not tracked by git status',
        });
        continue;
      }

      if (existsSync(candidate.absolutePath)) {
        const stats = await lstat(candidate.absolutePath);
        if (stats.isDirectory()) {
          result.errors.push(discardFileResult(candidate, {
            error: 'refusing to remove a directory; select files instead',
          }));
          continue;
        }
      }

      const tracked = await gitPathExistsInIndex(git, candidate.gitFilePath)
        || (repoHasCommits && await gitPathExistsInHead(git, candidate.gitFilePath));

      if (tracked) {
        plannedActions.push({ type: 'tracked', candidate, git, repoHasCommits });
        continue;
      }

      if (!existsSync(candidate.absolutePath)) {
        plannedActions.push({
          type: 'skip',
          candidate,
          reason: 'missing untracked file',
        });
        continue;
      }

      if (!statusOutputIsOnlyUntracked(statusOutput)) {
        result.errors.push(discardFileResult(candidate, {
          error: 'refusing to remove a path that git did not report as untracked',
        }));
        continue;
      }

      plannedActions.push({ type: 'untracked', candidate });
    } catch (error) {
      result.errors.push(discardFileResult(candidate, {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  if (result.errors.length > 0) {
    result.success = false;
    return result;
  }

  for (const action of plannedActions) {
    try {
      if (action.type === 'skip') {
        result.skipped.push(discardFileResult(action.candidate, {
          reason: action.reason,
        }));
        continue;
      }

      if (action.type === 'tracked') {
        if (action.repoHasCommits) {
          await action.git.raw(['restore', '--staged', '--worktree', '--', action.candidate.gitFilePath]);
        } else {
          await action.git.raw(['rm', '--cached', '--ignore-unmatch', '--', action.candidate.gitFilePath]);
          if (existsSync(action.candidate.absolutePath)) {
            await rm(action.candidate.absolutePath, { force: false });
          }
        }
        result.discarded.push(discardFileResult(action.candidate, { kind: 'tracked' }));
        continue;
      }

      await rm(action.candidate.absolutePath, { force: false });
      result.discarded.push(discardFileResult(action.candidate, { kind: 'untracked' }));
    } catch (error) {
      result.errors.push(discardFileResult(action.candidate, {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  result.success = result.errors.length === 0;
  return result;
}
