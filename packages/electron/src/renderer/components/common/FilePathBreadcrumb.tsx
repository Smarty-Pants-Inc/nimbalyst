import React, { useCallback, useMemo } from 'react';
import { basename } from 'pathe';
import { useSetAtom } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';

import {
  openFileRequestAtom,
  revealFileAtom,
  revealFolderAtom,
  setWindowModeAtom,
} from '../../store';

interface BreadcrumbSegment {
  name: string;
  folderPath: string | null;
}

interface FilePathBreadcrumbProps {
  filePath: string;
  workspacePath?: string | null;
  className?: string;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function getBreadcrumbSegments(filePath: string, workspacePath?: string | null): BreadcrumbSegment[] {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedWorkspacePath = workspacePath ? normalizePath(workspacePath) : null;
  const isWithinWorkspace = Boolean(
    normalizedWorkspacePath &&
      (normalizedFilePath === normalizedWorkspacePath ||
        normalizedFilePath.startsWith(`${normalizedWorkspacePath}/`)),
  );

  let displayPath = normalizedFilePath;
  if (isWithinWorkspace && normalizedWorkspacePath) {
    displayPath = normalizedFilePath.slice(normalizedWorkspacePath.length).replace(/^\/+/, '');
  }

  const parts = displayPath.split('/').filter(Boolean);
  if (!parts.length) {
    return [{ name: basename(filePath), folderPath: null }];
  }

  const absolutePrefix = !isWithinWorkspace && normalizedFilePath.startsWith('/') ? '/' : '';
  return parts.map((name, index) => {
    const isFile = index === parts.length - 1;
    if (isFile) {
      return { name, folderPath: null };
    }

    const folderPath = isWithinWorkspace && normalizedWorkspacePath
      ? `${normalizedWorkspacePath}/${parts.slice(0, index + 1).join('/')}`
      : `${absolutePrefix}${parts.slice(0, index + 1).join('/')}`;

    return { name, folderPath };
  });
}

export const FilePathBreadcrumb: React.FC<FilePathBreadcrumbProps> = ({
  filePath,
  workspacePath,
  className = '',
}) => {
  const revealFolder = useSetAtom(revealFolderAtom);
  const revealFile = useSetAtom(revealFileAtom);
  const setOpenFileRequest = useSetAtom(openFileRequestAtom);
  const setWindowMode = useSetAtom(setWindowModeAtom);

  const breadcrumbSegments = useMemo(
    () => getBreadcrumbSegments(filePath, workspacePath),
    [filePath, workspacePath],
  );

  const handleBreadcrumbClick = useCallback((folderPath: string | null, targetFilePath?: string) => {
    if (folderPath) {
      setWindowMode('files');
      revealFolder(folderPath);
      return;
    }
    if (targetFilePath) {
      setOpenFileRequest({ path: targetFilePath, ts: Date.now() });
      revealFile(targetFilePath);
    }
  }, [revealFolder, revealFile, setOpenFileRequest, setWindowMode]);

  return (
    <div
      className={`unified-header-breadcrumb agent-elements-file-path-breadcrumb flex min-w-0 items-center gap-1.5 overflow-hidden text-[13px] text-[var(--an-foreground-muted)] ${className}`.trim()}
      data-testid="agent-elements-file-path-breadcrumb"
      data-agent-elements-shell="file-path-breadcrumb"
    >
      {breadcrumbSegments.map((segment, index) => {
        const isLast = index === breadcrumbSegments.length - 1;
        const isClickable = (!isLast && segment.folderPath) || (isLast && Boolean(filePath));
        const segmentClassName = `breadcrumb-segment agent-elements-file-path-breadcrumb-segment flex items-center gap-1 whitespace-nowrap ${
          isLast
            ? 'breadcrumb-filename text-[var(--an-foreground)] font-medium'
            : 'text-[var(--an-foreground-muted)]'
        } ${
          isClickable
            ? 'breadcrumb-clickable cursor-pointer rounded-[var(--an-small-border-radius)] px-1 py-0.5 -mx-1 -my-0.5 transition-colors duration-150 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]'
            : ''
        }`;
        const icon = (
          <MaterialSymbol
            icon={isLast ? 'description' : 'folder'}
            size={14}
            className={`breadcrumb-icon h-3.5 w-3.5 shrink-0 ${isLast ? 'opacity-80' : 'opacity-70'}`}
          />
        );
        const content = (
          <>
            {icon}
            {segment.name}
          </>
        );
        return (
          <React.Fragment key={`${segment.name}-${index}`}>
            {isClickable ? (
              <button
                type="button"
                className={`${segmentClassName} border-none bg-transparent font-inherit`}
                data-testid={isLast ? 'agent-elements-file-path-breadcrumb-file' : 'agent-elements-file-path-breadcrumb-folder'}
                data-agent-elements-shell={isLast ? 'file-path-breadcrumb-file' : 'file-path-breadcrumb-folder'}
                onClick={() => handleBreadcrumbClick(segment.folderPath, isLast ? filePath : undefined)}
                title={`Go to ${segment.name} in file tree`}
              >
                {content}
              </button>
            ) : (
              <span
                className={segmentClassName}
                data-testid={isLast ? 'agent-elements-file-path-breadcrumb-file' : 'agent-elements-file-path-breadcrumb-folder'}
                data-agent-elements-shell={isLast ? 'file-path-breadcrumb-file' : 'file-path-breadcrumb-folder'}
              >
                {content}
              </span>
            )}
            {!isLast && (
              <span
                className="breadcrumb-separator agent-elements-file-path-breadcrumb-separator text-[11px] text-[var(--an-foreground-subtle)]"
                data-agent-elements-shell="file-path-breadcrumb-separator"
              >
                /
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
