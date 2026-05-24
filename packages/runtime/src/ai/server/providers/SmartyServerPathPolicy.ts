import * as path from 'path';

export interface LangGraphActionPathScope {
  referencedPaths: string[];
  permissionPathKeys: string[];
  outsidePaths: string[];
  sensitivePaths: string[];
  warnings: string[];
}

export function classifyLangGraphActionPaths(
  args: Record<string, unknown>,
  workspacePath: string,
): LangGraphActionPathScope {
  const referencedPaths = extractReferencedPaths(args);
  const permissionPathKeys: string[] = [];
  const outsidePaths: string[] = [];
  const sensitivePaths: string[] = [];
  const warnings: string[] = [];
  const workspaceRoot = path.resolve(workspacePath);

  for (const rawPath of referencedPaths) {
    const hostCandidate = path.isAbsolute(rawPath)
      ? path.resolve(rawPath)
      : path.resolve(workspaceRoot, rawPath);
    const virtualCandidate = resolveKnownVirtualWorkspacePath(workspaceRoot, rawPath);
    const resolvedWorkspacePath = isPathInside(workspaceRoot, hostCandidate)
      ? hostCandidate
      : virtualCandidate;
    const insideWorkspace = Boolean(resolvedWorkspacePath);
    permissionPathKeys.push(permissionPathKey(workspaceRoot, rawPath, resolvedWorkspacePath));
    if (!insideWorkspace) {
      outsidePaths.push(rawPath);
    }
    if (isSensitivePath(rawPath)) {
      sensitivePaths.push(rawPath);
    }
  }

  if (outsidePaths.length > 0) {
    warnings.push(`Path is outside the active workspace/worktree: ${outsidePaths.join(', ')}`);
  }
  if (sensitivePaths.length > 0) {
    warnings.push(`Path touches sensitive project or credential material: ${sensitivePaths.join(', ')}`);
  }

  return {
    referencedPaths,
    permissionPathKeys: [...new Set(permissionPathKeys)].sort(),
    outsidePaths,
    sensitivePaths,
    warnings,
  };
}

export function resolveToolFilePath(
  args: Record<string, unknown> | undefined,
  workspacePath: string,
): string | null {
  if (!args) return null;
  const filePath = extractReferencedPaths(args)[0];
  if (!filePath) return null;
  const workspaceRoot = path.resolve(workspacePath);
  if (path.isAbsolute(filePath)) {
    const hostPath = path.resolve(filePath);
    if (isPathInside(workspaceRoot, hostPath)) {
      return hostPath;
    }
    return resolveKnownVirtualWorkspacePath(workspaceRoot, filePath);
  }
  const relativePath = path.resolve(workspaceRoot, filePath);
  return isPathInside(workspaceRoot, relativePath) ? relativePath : null;
}

function extractReferencedPaths(args: Record<string, unknown>): string[] {
  const candidates = [args.file_path, args.path, args.filePath];
  const referencedPaths = candidates.filter((value): value is string => typeof value === 'string' && value.length > 0);
  const command = args.command;
  if (typeof command === 'string') {
    referencedPaths.push(...extractAbsolutePathsFromShellCommand(command));
  }
  return [...new Set(referencedPaths)];
}

function extractAbsolutePathsFromShellCommand(command: string): string[] {
  const paths = new Set<string>();
  const absolutePathPattern = /(^|[\s"'=])((?:\/[^\s"'`$;&|<>()[\]{}]+)+)/g;
  for (const match of command.matchAll(absolutePathPattern)) {
    const rawPath = match[2]?.replace(/[.,:]+$/, '');
    if (rawPath) {
      paths.add(rawPath);
    }
  }
  return [...paths];
}

function permissionPathKey(
  workspaceRoot: string,
  rawPath: string,
  resolvedWorkspacePath: string | null,
): string {
  if (!resolvedWorkspacePath) {
    return `outside:${rawPath.replace(/\\/g, '/')}`;
  }
  const relative = path.relative(workspaceRoot, resolvedWorkspacePath).replace(/\\/g, '/');
  return relative || '.';
}

function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const basename = path.basename(normalized);
  return basename.startsWith('.env')
    || basename.includes('secret')
    || basename.includes('credential')
    || basename.includes('token')
    || normalized.includes('/.ssh/')
    || normalized.includes('/.gnupg/')
    || normalized.includes('/.aws/')
    || normalized.includes('/.config/op/')
    || normalized.includes('/1password/');
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveVirtualWorkspacePath(workspaceRoot: string, virtualPath: string): string | null {
  const candidate = path.resolve(workspaceRoot, virtualWorkspaceRelativePath(virtualPath));
  return isPathInside(workspaceRoot, candidate) ? candidate : null;
}

function resolveKnownVirtualWorkspacePath(workspaceRoot: string, virtualPath: string): string | null {
  if (!path.isAbsolute(virtualPath)) return null;
  const candidate = resolveVirtualWorkspacePath(workspaceRoot, virtualPath);
  if (!candidate) return null;
  if (isVirtualWorkspacePath(virtualPath)) return candidate;
  if (isKnownLangGraphVirtualPath(virtualPath)) return candidate;
  const firstSegment = virtualWorkspaceRelativePath(virtualPath).split(/[\\/]/)[0];
  if (!firstSegment) return null;
  if (REAL_ABSOLUTE_PATH_FIRST_SEGMENTS.has(firstSegment.toLowerCase())) return null;
  return candidate;
}

const REAL_ABSOLUTE_PATH_FIRST_SEGMENTS = new Set([
  'applications',
  'bin',
  'dev',
  'etc',
  'home',
  'library',
  'opt',
  'private',
  'proc',
  'sbin',
  'system',
  'tmp',
  'users',
  'usr',
  'var',
  'volumes',
]);

function isVirtualWorkspacePath(virtualPath: string): boolean {
  const normalized = virtualPath.replace(/^[/\\]+/, '');
  return normalized === 'workspace'
    || normalized.startsWith('workspace/')
    || normalized.startsWith('workspace\\');
}

function isKnownLangGraphVirtualPath(virtualPath: string): boolean {
  const normalized = virtualPath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
  return normalized === 'tmp/runtime' || normalized.startsWith('tmp/runtime/');
}

function virtualWorkspaceRelativePath(virtualPath: string): string {
  const normalized = virtualPath.replace(/^[/\\]+/, '');
  if (normalized === 'workspace') {
    return '';
  }
  if (normalized.startsWith('workspace/') || normalized.startsWith('workspace\\')) {
    return normalized.slice('workspace'.length + 1);
  }
  return normalized;
}
