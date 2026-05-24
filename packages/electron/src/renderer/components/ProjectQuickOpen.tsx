import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface ProjectItem {
  path: string;
  name: string;
  lastOpened?: number;
  isOpen: boolean;
  isCurrent: boolean;
}

interface ProjectQuickOpenProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkspacePath: string | null;
}

export const ProjectQuickOpen: React.FC<ProjectQuickOpenProps> = ({
  isOpen,
  onClose,
  currentWorkspacePath,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [mouseHasMoved, setMouseHasMoved] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLUListElement>(null);

  // Load projects when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadProjects = async () => {
      const [recentWorkspaces, openPaths] = await Promise.all([
        window.electronAPI.workspaceManager.getRecentWorkspaces(),
        window.electronAPI.workspaceManager.getOpenWorkspaces(),
      ]);

      const openSet = new Set(openPaths);

      const items: ProjectItem[] = recentWorkspaces.map((ws: any) => ({
        path: ws.path,
        name: ws.name || ws.path.split('/').pop() || ws.path,
        lastOpened: ws.lastOpened || ws.timestamp,
        isOpen: openSet.has(ws.path),
        isCurrent: ws.path === currentWorkspacePath,
      }));

      // Sort: current first, then open projects, then by lastOpened
      items.sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
        return (b.lastOpened || 0) - (a.lastOpened || 0);
      });

      setProjects(items);
    };

    loadProjects();
  }, [isOpen, currentWorkspacePath]);

  // Filter by search query
  const displayProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.path.toLowerCase().includes(query)
    );
  }, [searchQuery, projects]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setMouseHasMoved(false);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Track mouse movement
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseMove = () => setMouseHasMoved(true);
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsListRef.current) return;
    const items = resultsListRef.current.querySelectorAll('.project-quick-open-item');
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
          setSelectedIndex((prev) =>
            prev < displayProjects.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (displayProjects[selectedIndex]) {
            handleProjectSelect(displayProjects[selectedIndex]);
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
  }, [isOpen, selectedIndex, displayProjects, onClose]);

  const handleProjectSelect = async (project: ProjectItem) => {
    onClose();
    await window.electronAPI.workspaceManager.openWorkspace(project.path);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="project-quick-open-backdrop agent-elements-project-quick-open-backdrop fixed inset-0 z-[99998] nim-animate-fade-in bg-[color-mix(in_srgb,var(--nim-text)_36%,transparent)]"
        onClick={onClose}
        data-testid="agent-elements-project-quick-open-backdrop"
        data-agent-elements-shell="project-quick-open-backdrop"
      />
      <div
        className="project-quick-open-modal agent-elements-project-quick-open agent-elements-tool-card fixed top-[18%] left-1/2 -translate-x-1/2 w-[90vw] max-w-[640px] max-h-[62vh] !gap-0 !p-0 flex flex-col overflow-hidden rounded-[var(--an-border-radius)] z-[99999] bg-[var(--an-background)] border border-[var(--an-border-color)] shadow-[0_20px_60px_color-mix(in_srgb,var(--nim-text)_18%,transparent)]"
        data-testid="agent-elements-project-quick-open"
        data-component="ProjectQuickOpen"
        data-agent-elements-shell="project-quick-open"
      >
        <div
          className="project-quick-open-header agent-elements-project-quick-open-header p-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)]"
          data-testid="agent-elements-project-quick-open-header"
          data-agent-elements-shell="project-quick-open-header"
        >
          <div className="project-quick-open-title agent-elements-project-quick-open-title text-[12px] font-medium text-[var(--an-foreground-muted)] mb-2">
            Projects
          </div>
          <input
            ref={searchInputRef}
            type="text"
            className="project-quick-open-search agent-elements-project-quick-open-input w-full py-2 px-3 text-sm rounded-[var(--an-input-border-radius)] outline-none box-border bg-[var(--an-input-background)] border border-[var(--an-input-border-color)] text-[var(--an-input-color)] placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            data-testid="agent-elements-project-quick-open-input"
            data-agent-elements-shell="project-quick-open-input"
          />
        </div>

        <div
          className="project-quick-open-results agent-elements-project-quick-open-results flex-1 overflow-y-auto min-h-[200px] py-1"
          data-testid="agent-elements-project-quick-open-results"
          data-agent-elements-shell="project-quick-open-results"
        >
          {displayProjects.length === 0 && (
            <div
              className="project-quick-open-empty agent-elements-project-quick-open-empty p-10 text-center text-[var(--an-foreground-subtle)]"
              data-testid="agent-elements-project-quick-open-empty"
              data-agent-elements-shell="project-quick-open-empty"
            >
              {searchQuery ? 'No projects found' : 'No recent projects'}
            </div>
          )}
          {displayProjects.length > 0 && (
            <ul
              className={`project-quick-open-list agent-elements-project-quick-open-list list-none m-0 p-0 ${mouseHasMoved ? '' : 'pointer-events-none'}`}
              ref={resultsListRef}
              data-agent-elements-shell="project-quick-open-list"
            >
              {displayProjects.map((project, index) => (
                <li
                  key={project.path}
                  className={`project-quick-open-item agent-elements-project-quick-open-item flex items-center gap-3 mx-2 my-1 py-2.5 px-3 cursor-pointer rounded-[var(--an-tool-border-radius)] border transition-[background-color,border-color,box-shadow] duration-150 ease-out ${
                    index === selectedIndex
                      ? 'selected bg-[var(--an-background-tertiary)] border-[var(--an-tool-border-color)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--an-primary-color)_16%,transparent)]'
                      : 'border-transparent hover:bg-[var(--an-background-tertiary)] hover:border-[var(--an-tool-border-color)]'
                  }`}
                  onClick={() => handleProjectSelect(project)}
                  onMouseEnter={() => {
                    if (mouseHasMoved) {
                      setSelectedIndex(index);
                    }
                  }}
                  data-testid={`agent-elements-project-quick-open-item-${index}`}
                  data-agent-elements-shell="project-quick-open-result"
                  data-selected={index === selectedIndex ? 'true' : 'false'}
                  data-current={project.isCurrent ? 'true' : 'false'}
                  data-open={project.isOpen ? 'true' : 'false'}
                >
                  <div
                    className="project-quick-open-item-icon agent-elements-project-quick-open-item-icon shrink-0 flex items-center justify-center w-7 h-7 rounded-[8px] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-foreground-muted)]"
                    data-agent-elements-shell="project-quick-open-icon"
                  >
                    <MaterialSymbol
                      icon="folder"
                      size={16}
                      fill={project.isOpen}
                    />
                  </div>
                  <div className="project-quick-open-item-content agent-elements-project-quick-open-item-content flex-1 min-w-0">
                    <div
                      className="project-quick-open-item-name agent-elements-project-quick-open-item-name text-sm font-medium text-[var(--an-foreground)] flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap"
                      data-testid={`agent-elements-project-quick-open-item-name-${index}`}
                      data-agent-elements-shell="project-quick-open-item-name"
                    >
                      {project.name}
                      {project.isCurrent && (
                        <span
                          className="project-quick-open-badge agent-elements-status-pill shrink-0 text-[10px]"
                          data-agent-elements-shell="project-quick-open-current-badge"
                        >
                          Current
                        </span>
                      )}
                      {project.isOpen && !project.isCurrent && (
                        <span
                          className="project-quick-open-badge agent-elements-status-pill shrink-0 text-[10px]"
                          data-agent-elements-shell="project-quick-open-open-badge"
                        >
                          Open
                        </span>
                      )}
                    </div>
                    <div
                      className="project-quick-open-item-path agent-elements-project-quick-open-item-path text-xs text-[var(--an-foreground-subtle)] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap direction-rtl text-left"
                      data-agent-elements-shell="project-quick-open-item-path"
                    >
                      {project.path}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="project-quick-open-footer agent-elements-project-quick-open-footer flex justify-between py-2 px-4 border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)]"
          data-testid="agent-elements-project-quick-open-footer"
          data-agent-elements-shell="project-quick-open-footer"
        >
          <div className="flex gap-4">
            <span className="project-quick-open-hint agent-elements-project-quick-open-hint text-[11px] text-[var(--an-foreground-subtle)] flex items-center gap-1">
              <kbd className="agent-elements-project-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">
                Up/Down
              </kbd>{' '}
              Navigate
            </span>
            <span className="project-quick-open-hint agent-elements-project-quick-open-hint text-[11px] text-[var(--an-foreground-subtle)] flex items-center gap-1">
              <kbd className="agent-elements-project-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">
                Enter
              </kbd>{' '}
              Open
            </span>
            <span className="project-quick-open-hint agent-elements-project-quick-open-hint text-[11px] text-[var(--an-foreground-subtle)] flex items-center gap-1">
              <kbd className="agent-elements-project-quick-open-kbd py-0.5 px-1.5 rounded-[5px] font-mono text-[10px] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)]">
                Esc
              </kbd>{' '}
              Close
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
