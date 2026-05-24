import { execFileSync } from 'child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { isWorktreePath, resolveProjectPath } from '../utils/workspaceDetection';

export type GitFileTargetPolicy = 'workspaceOnly' | 'workspaceOrRelatedWorktree';

export interface GitFileTarget {
  filePath: string;
  absolutePath: string;
  gitWorkspacePath: string;
  gitFilePath: string;
}

export function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const rel = relative(rootPath, candidatePath);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Find the git repository root that owns a file path.
 *
 * Walks up from the file's parent directory looking for a `.git` entry
 * (directory or worktree-link file). Stops at `boundary` so a file outside
 * the workspace cannot be matched against an unrelated repo somewhere higher
 * up the filesystem.
 */
export function findGitRootForFile(filePath: string, boundary: string): string | null {
  const boundaryAbs = resolve(boundary);
  const fileAbs = isAbsolute(filePath) ? filePath : resolve(boundaryAbs, filePath);

  const boundaryWithSep = boundaryAbs.endsWith('/') || boundaryAbs.endsWith('\\')
    ? boundaryAbs
    : boundaryAbs + (process.platform === 'win32' ? '\\' : '/');
  if (fileAbs !== boundaryAbs && !fileAbs.startsWith(boundaryWithSep)) {
    return null;
  }

  let dir = dirname(fileAbs);
  while (true) {
    try {
      if (existsSync(join(dir, '.git'))) {
        return dir;
      }
    } catch {
      // Ignore filesystem errors and continue walking up.
    }

    if (dir === boundaryAbs) {
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    if (!parent.startsWith(boundaryWithSep) && parent !== boundaryAbs) {
      break;
    }
    dir = parent;
  }

  return null;
}

function isGitWorktreeLink(rootPath: string): boolean {
  try {
    const gitPath = join(rootPath, '.git');
    return lstatSync(gitPath).isFile()
      && readFileSync(gitPath, 'utf8').trimStart().startsWith('gitdir:');
  } catch {
    return false;
  }
}

function gitCommonDir(rootPath: string): string | null {
  try {
    const output = execFileSync('git', ['-C', rootPath, 'rev-parse', '--git-common-dir'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!output) {
      return null;
    }
    return realpathSync(resolve(rootPath, output));
  } catch {
    return null;
  }
}

function sharesGitCommonDir(workspacePath: string, candidateRoot: string): boolean {
  const workspaceCommonDir = gitCommonDir(workspacePath);
  const candidateCommonDir = gitCommonDir(candidateRoot);
  return workspaceCommonDir !== null
    && candidateCommonDir !== null
    && workspaceCommonDir === candidateCommonDir;
}

function resolveChildWorktreeRoot(workspacePath: string, absolutePath: string): string | null {
  const worktreeParent = `${workspacePath}_worktrees`;
  const rel = relative(worktreeParent, absolutePath);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    return null;
  }

  const [worktreeName] = rel.split(/[\\/]/);
  if (!worktreeName) {
    return null;
  }

  const worktreeRoot = join(worktreeParent, worktreeName);
  if (!isGitWorktreeLink(worktreeRoot)) {
    return null;
  }

  if (!sharesGitCommonDir(workspacePath, worktreeRoot)) {
    return null;
  }

  if (!isPathInsideRoot(worktreeRoot, absolutePath)) {
    return null;
  }

  return worktreeRoot;
}

function resolveRelatedGitRoot(workspacePath: string, absolutePath: string): string | null {
  const childWorktreeRoot = resolveChildWorktreeRoot(workspacePath, absolutePath);
  if (childWorktreeRoot) {
    return childWorktreeRoot;
  }

  if (!isWorktreePath(workspacePath) || !isGitWorktreeLink(workspacePath)) {
    return null;
  }

  const projectPath = resolveProjectPath(workspacePath);
  if (!isPathInsideRoot(projectPath, absolutePath)) {
    return null;
  }

  const gitRoot = findGitRootForFile(absolutePath, projectPath);
  if (!gitRoot || !sharesGitCommonDir(workspacePath, gitRoot)) {
    return null;
  }

  return gitRoot;
}

export function resolveGitFileTarget(
  workspacePath: string,
  filePath: string,
  policy: GitFileTargetPolicy
): GitFileTarget | null {
  const resolvedWorkspacePath = resolve(workspacePath);
  const absolutePath = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(resolvedWorkspacePath, filePath);
  const insideWorkspace = isPathInsideRoot(resolvedWorkspacePath, absolutePath);

  if (!insideWorkspace) {
    if (
      policy !== 'workspaceOrRelatedWorktree'
      || !isAbsolute(filePath)
    ) {
      return null;
    }

    const gitWorkspacePath = resolveRelatedGitRoot(resolvedWorkspacePath, absolutePath);
    if (!gitWorkspacePath) {
      return null;
    }

    return {
      filePath,
      absolutePath,
      gitWorkspacePath,
      gitFilePath: relative(gitWorkspacePath, absolutePath).replace(/\\/g, '/'),
    };
  }

  const workspaceRelativePath = relative(resolvedWorkspacePath, absolutePath).replace(/\\/g, '/');
  const gitWorkspacePath = findGitRootForFile(absolutePath, resolvedWorkspacePath) ?? resolvedWorkspacePath;

  return {
    filePath: workspaceRelativePath,
    absolutePath,
    gitWorkspacePath,
    gitFilePath: relative(gitWorkspacePath, absolutePath).replace(/\\/g, '/'),
  };
}

export function resolveGitDiffTarget(
  workspacePath: string,
  filePath: string
): { gitWorkspacePath: string; gitFilePath: string } | null {
  const target = resolveGitFileTarget(workspacePath, filePath, 'workspaceOrRelatedWorktree');
  if (!target) {
    return null;
  }

  return {
    gitWorkspacePath: target.gitWorkspacePath,
    gitFilePath: target.gitFilePath,
  };
}
