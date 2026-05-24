import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { usePostHog } from 'posthog-js/react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { getFileName, getRelativeDir } from '../utils/pathUtils';
import { revealFolderAtom } from '../store';
import { KeyboardShortcuts, getShortcutDisplay } from '../../shared/KeyboardShortcuts';

interface FileItem {
  path: string;
  name: string;
  type?: 'file' | 'directory';
  lastOpened?: Date;
  isRecent?: boolean;
  matches?: Array<{
    line: number;
    text: string;
    start: number;
    end: number;
  }>;
  isFileNameMatch?: boolean;
  isContentMatch?: boolean;
}

// QuickOpen works in all modes (Editor, Agent, Files)
interface QuickOpenProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  currentFilePath?: string | null;
  onFileSelect: (filePath: string) => void;
  /** Callback when a folder is selected -- switches to files mode and reveals in tree */
  onFolderSelect?: (folderPath: string) => void;
  /** If true, immediately trigger content search mode when opened */
  startInContentSearchMode?: boolean;
  /** Callback to show sessions that edited a file (opens Session Quick Open with @path) */
  onShowFileSessions?: (filePath: string) => void;
}

export const QuickOpen: React.FC<QuickOpenProps> = ({
  isOpen,
  onClose,
  workspacePath,
  currentFilePath,
  onFileSelect,
  onFolderSelect,
  startInContentSearchMode = false,
  onShowFileSessions,
}) => {
  const posthog = usePostHog();
  const revealFolder = useSetAtom(revealFolderAtom);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isContentSearch, setIsContentSearch] = useState(false);
  const [contentSearchTriggered, setContentSearchTriggered] = useState(false);
  const [mouseHasMoved, setMouseHasMoved] = useState(false);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const resultsListRef = useRef<HTMLUListElement>(null);

  // Convert recent files to FileItems (excluding current file)
  const recentFileItems: FileItem[] = recentFiles
    .filter(path => path !== currentFilePath)
    .map(path => ({
      path,
      name: getFileName(path),
      isRecent: true,
    }));

  // Combined list of files to display
  const displayFiles = searchQuery ? searchResults : recentFileItems;
  const mode = startInContentSearchMode ? 'content' : 'file';

  // Search for files in the workspace (name search only)
  const searchFiles = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsContentSearch(false);
      return;
    }

    setIsSearching(true);

    try {
      // Use electron API to search files (check both window.electronAPI and window.electron)
      const api = (window as any).electronAPI || (window as any).electron;
      if (!api) {
        console.error('Electron API not available');
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      if (!workspacePath) {
        console.error('No workspace path available');
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      // Get file name matches
      if (!api.searchWorkspaceFileNames) {
        console.error('searchWorkspaceFileNames method not available');
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      const fileNameResults = await api.searchWorkspaceFileNames(workspacePath, query);

      // Process and display file name results
      if (Array.isArray(fileNameResults)) {
        const processedFileNames = fileNameResults
          .map((result: any) => ({
            path: result.path,
            name: getFileName(result.path),
            type: result.type as 'file' | 'directory' | undefined,
            isRecent: recentFiles.includes(result.path),
            matches: result.matches || [],
            isFileNameMatch: result.isFileNameMatch || false,
            isContentMatch: false,
          }));

        setSearchResults(processedFileNames);
        setIsSearching(false);

        // Track workspace search analytics (file name search)
        try {
          const resultCount = processedFileNames.length;
          const queryLength = query.length;
          let queryLengthCategory = 'short';
          if (queryLength > 20) queryLengthCategory = 'long';
          else if (queryLength > 10) queryLengthCategory = 'medium';

          let resultCountBucket = '0';
          if (resultCount > 0) {
            if (resultCount <= 10) resultCountBucket = '1-10';
            else if (resultCount <= 50) resultCountBucket = '11-50';
            else if (resultCount <= 100) resultCountBucket = '51-100';
            else resultCountBucket = '100+';
          }

          posthog?.capture('workspace_search_used', {
            resultCount: resultCountBucket,
            queryLength: queryLengthCategory,
            searchType: 'file_name',
          });
        } catch (error) {
          console.error('Error tracking workspace_search_used event:', error);
        }
      } else {
        console.warn('Results is not an array:', fileNameResults);
        setSearchResults([]);
        setIsSearching(false);
      }
    } catch (error) {
      console.error('Error searching files:', error);
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [workspacePath, recentFiles]);

  // Search file contents (triggered manually)
  const searchFileContents = useCallback(async () => {
    if (!searchQuery.trim() || contentSearchTriggered) {
      return; // Don't search if already triggered or no query
    }

    setContentSearchTriggered(true);
    setIsSearching(true);

    try {
      const api = (window as any).electronAPI || (window as any).electron;
      if (!api || !api.searchWorkspaceFileContent) {
        setIsSearching(false);
        return;
      }

      const contentResults = await api.searchWorkspaceFileContent(workspacePath, searchQuery);

      // Merge content results with existing file name results
      if (Array.isArray(contentResults)) {
        setSearchResults(prevResults => {
          const mergedResults = [...prevResults];

          // Process content results
          for (const contentResult of contentResults) {
            const existingIndex = mergedResults.findIndex(r => r.path === contentResult.path);

            if (existingIndex >= 0) {
              // File already in results from name match, add content matches
              mergedResults[existingIndex].matches = contentResult.matches || [];
              mergedResults[existingIndex].isContentMatch = true;
            } else {
              // New file found only by content
              mergedResults.push({
                path: contentResult.path,
                name: getFileName(contentResult.path),
                isRecent: recentFiles.includes(contentResult.path),
                matches: contentResult.matches || [],
                isFileNameMatch: false,
                isContentMatch: true,
              });
            }
          }

          // Sort merged results: prioritize file name matches over content matches
          mergedResults.sort((a, b) => {
            // File name matches come first
            if (a.isFileNameMatch && !b.isFileNameMatch) return -1;
            if (!a.isFileNameMatch && b.isFileNameMatch) return 1;

            // Then sort by number of matches (more matches = higher priority)
            const aMatchCount = a.matches?.length || 0;
            const bMatchCount = b.matches?.length || 0;
            if (aMatchCount !== bMatchCount) {
              return bMatchCount - aMatchCount;
            }

            // Finally, sort alphabetically by file name
            return a.name.localeCompare(b.name);
          });

          return mergedResults;
        });

        // Track workspace search analytics (content search)
        try {
          const queryLength = searchQuery.length;
          let queryLengthCategory = 'short';
          if (queryLength > 20) queryLengthCategory = 'long';
          else if (queryLength > 10) queryLengthCategory = 'medium';

          const resultCount = contentResults.length;
          let resultCountBucket = '0';
          if (resultCount > 0) {
            if (resultCount <= 10) resultCountBucket = '1-10';
            else if (resultCount <= 50) resultCountBucket = '11-50';
            else if (resultCount <= 100) resultCountBucket = '51-100';
            else resultCountBucket = '100+';
          }

          posthog?.capture('workspace_search_used', {
            resultCount: resultCountBucket,
            queryLength: queryLengthCategory,
            searchType: 'content',
          });
        } catch (error) {
          console.error('Error tracking workspace_search_used event:', error);
        }
      }
      setIsSearching(false);
    } catch (error) {
      console.error('Error in content search:', error);
      setIsSearching(false);
    }
  }, [workspacePath, searchQuery, contentSearchTriggered, recentFiles, posthog]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Reset content search trigger when query changes (but keep it if in content search mode)
    if (!startInContentSearchMode) {
      setContentSearchTriggered(false);
    }

    if (searchQuery) {
      searchTimeoutRef.current = setTimeout(() => {
        searchFiles(searchQuery);
        // If in content search mode, also trigger content search after file name search
        if (startInContentSearchMode) {
          // Content search will be triggered after searchFiles completes
          // We need to call it separately since contentSearchTriggered is already true
          const api = (window as any).electronAPI || (window as any).electron;
          if (api?.searchWorkspaceFileContent) {
            api.searchWorkspaceFileContent(workspacePath, searchQuery)
              .then((contentResults: any[]) => {
                if (Array.isArray(contentResults)) {
                  setSearchResults(prevResults => {
                    const mergedResults = [...prevResults];
                    for (const contentResult of contentResults) {
                      const existingIndex = mergedResults.findIndex(r => r.path === contentResult.path);
                      if (existingIndex >= 0) {
                        mergedResults[existingIndex].matches = contentResult.matches || [];
                        mergedResults[existingIndex].isContentMatch = true;
                      } else {
                        mergedResults.push({
                          path: contentResult.path,
                          name: getFileName(contentResult.path),
                          isRecent: recentFiles.includes(contentResult.path),
                          matches: contentResult.matches || [],
                          isFileNameMatch: false,
                          isContentMatch: true,
                        });
                      }
                    }
                    mergedResults.sort((a, b) => {
                      if (a.isFileNameMatch && !b.isFileNameMatch) return -1;
                      if (!a.isFileNameMatch && b.isFileNameMatch) return 1;
                      const aMatchCount = a.matches?.length || 0;
                      const bMatchCount = b.matches?.length || 0;
                      if (aMatchCount !== bMatchCount) return bMatchCount - aMatchCount;
                      return a.name.localeCompare(b.name);
                    });
                    return mergedResults;
                  });
                }
              })
              .catch((error: any) => {
                console.error('Error in content search:', error);
              });
          }
        }
      }, 150);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchFiles, startInContentSearchMode, workspacePath, recentFiles]);

  // Load recent files when modal opens.
  //
  // Pass the explicit `workspacePath` so the main process scopes the recent
  // list to THIS workspace, not whichever workspace the window state last
  // tracked. With the multi-project rail (#188) a single window can have
  // multiple workspaces pinned; without the explicit scope, Quick Open
  // returned recent files from other pinned workspaces. See #301.
  useEffect(() => {
    if (isOpen && window.electronAPI?.getRecentWorkspaceFiles) {
      window.electronAPI.getRecentWorkspaceFiles(workspacePath)
        .then(files => {
          setRecentFiles(files || []);
        })
        .catch(error => {
          console.error('[QuickOpen] Failed to load recent files:', error);
          setRecentFiles([]);
        });
    }
  }, [isOpen, workspacePath]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setSearchResults([]);
      // If starting in content search mode, mark as triggered so we search contents immediately
      setContentSearchTriggered(startInContentSearchMode);
      setIsContentSearch(startInContentSearchMode);
      setMouseHasMoved(false);
      setTimeout(() => searchInputRef.current?.focus(), 100);

      // Build file name cache in background
      const api = (window as any).electronAPI || (window as any).electron;
      if (api?.buildQuickOpenCache && workspacePath) {
        api.buildQuickOpenCache(workspacePath).catch((error: any) => {
          console.error('Failed to build quick open cache:', error);
        });
      }
    }
  }, [isOpen, workspacePath, startInContentSearchMode]);

  // Track mouse movement to distinguish between mouse hover and mouse at rest
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseMove = () => {
      setMouseHasMoved(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsListRef.current) return;

    const items = resultsListRef.current.querySelectorAll('.quick-open-item');
    const selectedItem = items[selectedIndex] as HTMLElement;

    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < displayFiles.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          e.preventDefault();
          if (displayFiles[selectedIndex]) {
            handleItemSelect(displayFiles[selectedIndex].path, displayFiles[selectedIndex].type);
          }
          break;
        case 'Tab':
          e.preventDefault();
          if (searchQuery && !contentSearchTriggered) {
            searchFileContents();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, displayFiles, searchQuery, contentSearchTriggered, onClose, searchFileContents]);

  const handleItemSelect = (filePath: string, fileType?: 'file' | 'directory') => {
    if (fileType === 'directory') {
      // Switch to files mode and reveal the folder in the file tree
      if (onFolderSelect) {
        onFolderSelect(filePath);
      }
      revealFolder(filePath);
      onClose();
      return;
    }
    onFileSelect(filePath);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="quick-open-backdrop agent-elements-quick-open-backdrop fixed inset-0 z-[99998] nim-animate-fade-in bg-[color-mix(in_srgb,var(--nim-text)_36%,transparent)]"
        onClick={onClose}
        data-testid="agent-elements-quick-open-backdrop"
        data-agent-elements-shell="quick-open-backdrop"
      />
      <div
        className="quick-open-modal agent-elements-quick-open agent-elements-tool-card fixed top-[18%] left-1/2 -translate-x-1/2 w-[90vw] max-w-[640px] max-h-[62vh] !gap-0 !p-0 flex flex-col overflow-hidden rounded-[var(--an-border-radius)] z-[99999] bg-[var(--an-background)] border border-[var(--an-border-color)] shadow-[0_20px_60px_color-mix(in_srgb,var(--nim-text)_18%,transparent)]"
        data-testid="agent-elements-quick-open"
        data-component="QuickOpen"
        data-agent-elements-shell="quick-open"
        data-mode={mode}
      >
        <div
          className="quick-open-header agent-elements-quick-open-header p-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)]"
          data-testid="agent-elements-quick-open-header"
          data-agent-elements-shell="quick-open-header"
        >
          <div className="quick-open-title agent-elements-quick-open-title text-[12px] font-medium text-[var(--an-foreground-muted)] mb-2">
            {startInContentSearchMode ? 'Search in Files' : 'Open File'}
          </div>
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              className="quick-open-search agent-elements-quick-open-input nim-input text-sm rounded-[var(--an-input-border-radius)] border-[var(--an-input-border-color)] bg-[var(--an-input-background)] text-[var(--an-input-color)] placeholder:text-[var(--an-input-placeholder-color)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
              placeholder={startInContentSearchMode ? "Search in file contents..." : "Search files..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="agent-elements-quick-open-input"
              data-agent-elements-shell="quick-open-input"
            />
            {isSearching && (
              <div
                className="quick-open-searching agent-elements-quick-open-searching absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--an-foreground-subtle)]"
                data-agent-elements-shell="quick-open-searching"
              >
                {contentSearchTriggered ? 'Searching file contents...' : 'Searching...'}
              </div>
            )}
            {!isSearching && searchQuery && !contentSearchTriggered && !startInContentSearchMode && (
              <button
                className="quick-open-content-search-hint agent-elements-quick-open-content-search absolute right-3 top-1/2 -translate-y-1/2 text-xs flex items-center gap-1 px-2 py-1 rounded-[6px] cursor-pointer border border-transparent transition-colors duration-150 bg-transparent text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-primary-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)]"
                onClick={() => searchFileContents()}
                title="Search in file contents"
                data-testid="agent-elements-quick-open-content-search"
                data-agent-elements-shell="quick-open-content-search"
            >
              <kbd
                className="agent-elements-quick-open-kbd px-1.5 py-0.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]"
              >
                Tab
              </kbd>
              Search in file contents
            </button>
          )}
          </div>
        </div>

        <div
          className="quick-open-results agent-elements-quick-open-results flex-1 overflow-y-auto min-h-[200px] py-1"
          data-testid="agent-elements-quick-open-results"
          data-agent-elements-shell="quick-open-results"
        >
          {displayFiles.length === 0 ? (
            <div
              className="quick-open-empty agent-elements-quick-open-empty p-10 text-center text-[var(--an-foreground-subtle)]"
              data-testid="agent-elements-quick-open-empty"
              data-agent-elements-shell="quick-open-empty"
            >
              {searchQuery ? 'No files found' : 'No recent files'}
            </div>
          ) : (
            <ul
              className={`quick-open-list list-none m-0 p-0 ${mouseHasMoved ? '' : 'pointer-events-none'}`}
              ref={resultsListRef}
            >
              {displayFiles.map((file, index) => (
                <li
                  key={`${file.path}-${index}`}
                  className={`quick-open-item agent-elements-quick-open-item relative group mx-2 my-1 px-3 py-2.5 cursor-pointer rounded-[var(--an-tool-border-radius)] border transition-[background-color,border-color,box-shadow] duration-150 ease-out ${
                    index === selectedIndex ? 'selected bg-[var(--an-background-tertiary)] border-[var(--an-tool-border-color)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--an-primary-color)_16%,transparent)]' : 'border-transparent hover:bg-[var(--an-background-tertiary)] hover:border-[var(--an-tool-border-color)]'
                  } ${file.isContentMatch ? 'content-match' : ''} ${file.isFileNameMatch ? 'name-match' : ''}`}
                  onClick={() => handleItemSelect(file.path, file.type)}
                  onMouseEnter={() => {
                    if (mouseHasMoved) {
                      setSelectedIndex(index);
                    }
                  }}
                  data-testid={`agent-elements-quick-open-item-${index}`}
                  data-agent-elements-shell="quick-open-result"
                  data-selected={index === selectedIndex ? 'true' : 'false'}
                  data-file-type={file.type ?? 'file'}
                  data-recent={file.isRecent ? 'true' : 'false'}
                  data-name-match={file.isFileNameMatch ? 'true' : 'false'}
                  data-content-match={file.isContentMatch ? 'true' : 'false'}
                >
                  {onShowFileSessions && (
                    <button
                      className={`quick-open-show-sessions agent-elements-quick-open-show-sessions absolute right-3 top-2.5 p-1 rounded-[6px] transition-all duration-100 border border-transparent cursor-pointer bg-transparent text-[var(--an-foreground-subtle)] hover:text-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--an-input-focus-outline)] ${
                        index === selectedIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const relativePath = file.path.startsWith(workspacePath)
                          ? file.path.slice(workspacePath.length + 1)
                          : file.path;
                        onShowFileSessions(relativePath);
                      }}
                      title="Show sessions that edited this file"
                      data-testid={`agent-elements-quick-open-show-sessions-${index}`}
                      data-agent-elements-shell="quick-open-show-sessions"
                    >
                      <MaterialSymbol icon="history" size={16} />
                    </button>
                  )}
                  <div
                    className={`quick-open-item-name agent-elements-quick-open-item-name text-sm font-medium flex items-center gap-2 text-[var(--an-foreground)] ${file.isContentMatch ? 'mb-1' : ''}`}
                    data-testid={`agent-elements-quick-open-item-name-${index}`}
                    data-agent-elements-shell="quick-open-item-name"
                  >
                    {file.type === 'directory' && (
                      <MaterialSymbol icon="folder" size={16} className="text-[var(--an-foreground-subtle)] shrink-0" />
                    )}
                    {file.type === 'directory' ? file.name + '/' : file.name}
                    {file.isRecent && !searchQuery && (
                      <span className="quick-open-badge agent-elements-status-pill text-[10px]" data-agent-elements-shell="quick-open-badge">Recent</span>
                    )}
                    {/*{file.isFileNameMatch && (*/}
                    {/*  <span className="quick-open-badge name-badge nim-badge-success text-[10px]">Name</span>*/}
                    {/*)}*/}
                    {file.matches && file.matches.length > 0 && (
                      <span
                        className="quick-open-badge content-badge agent-elements-status-pill text-[10px] px-1.5 py-0.5 rounded-[6px] text-[var(--nim-bg)] font-semibold bg-[var(--an-primary-color)]"
                        data-agent-elements-shell="quick-open-match-badge"
                      >
                        {file.matches.length} match{file.matches.length > 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>
                  <div
                    className="quick-open-item-path agent-elements-quick-open-item-path text-xs mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[var(--an-foreground-subtle)]"
                    data-agent-elements-shell="quick-open-item-path"
                  >
                    {getRelativeDir(file.path, workspacePath)}
                  </div>
                  {file.matches && file.matches.length > 0 && (
                    <div
                      className="quick-open-item-matches agent-elements-quick-open-matches mt-2 rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] p-2"
                      data-agent-elements-shell="quick-open-matches"
                    >
                      {file.matches.slice(0, 2).map((match, i) => (
                        <div
                          key={i}
                          className="quick-open-match text-xs leading-snug mb-1 block overflow-hidden text-ellipsis whitespace-nowrap text-[var(--an-foreground-muted)]"
                        >
                          <span
                            className="quick-open-line-number mr-2 font-medium text-[var(--an-foreground-subtle)]"
                          >
                            Line {match.line}:
                          </span>
                          <span className="quick-open-match-text">
                            {match.text.substring(0, match.start)}
                            <mark
                              className="px-0.5 rounded font-semibold bg-[var(--nim-highlight-bg)] text-[var(--nim-highlight-text)]"
                            >
                              {match.text.substring(match.start, match.end)}
                            </mark>
                            {match.text.substring(match.end)}
                          </span>
                        </div>
                      ))}
                      {file.matches.length > 2 && (
                        <div
                          className="quick-open-more-matches text-[11px] italic mt-1 text-[var(--an-foreground-subtle)]"
                        >
                          ...and {file.matches.length - 2} more match{file.matches.length - 2 > 1 ? 'es' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="quick-open-footer agent-elements-quick-open-footer px-4 py-2 flex justify-between border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)]"
          data-testid="agent-elements-quick-open-footer"
          data-agent-elements-shell="quick-open-footer"
        >
          <div className="flex gap-4">
            <span
              className="quick-open-hint agent-elements-quick-open-hint text-[11px] flex items-center gap-1 text-[var(--an-foreground-subtle)]"
            >
              <kbd
                className="agent-elements-quick-open-kbd px-1.5 py-0.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]"
              >
                ↑↓
              </kbd>
              Navigate
            </span>
            <span
              className="quick-open-hint agent-elements-quick-open-hint text-[11px] flex items-center gap-1 text-[var(--an-foreground-subtle)]"
            >
              <kbd
                className="agent-elements-quick-open-kbd px-1.5 py-0.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]"
              >
                Enter
              </kbd>
              Open
            </span>
            {searchQuery && !contentSearchTriggered && !startInContentSearchMode && (
              <span
                className="quick-open-hint agent-elements-quick-open-hint text-[11px] flex items-center gap-1 text-[var(--an-foreground-subtle)]"
              >
                <kbd
                  className="agent-elements-quick-open-kbd px-1.5 py-0.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]"
                >
                  Tab
                </kbd>
                Search in file contents
              </span>
            )}
            <span
              className="quick-open-hint agent-elements-quick-open-hint text-[11px] flex items-center gap-1 text-[var(--an-foreground-subtle)]"
            >
              <kbd
                className="agent-elements-quick-open-kbd px-1.5 py-0.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]"
              >
                Esc
              </kbd>
              Close
            </span>
          </div>
          {!startInContentSearchMode && (
            <span
              className="quick-open-hint agent-elements-quick-open-hint text-[11px] flex items-center gap-1 text-[var(--an-foreground-subtle)]"
            >
              <kbd
                className="agent-elements-quick-open-kbd px-1.5 py-0.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]"
              >
                {getShortcutDisplay(KeyboardShortcuts.window.contentSearch)}
              </kbd>
              Content search
            </span>
          )}
        </div>
      </div>
    </>
  );
};
