import React, { useState, useEffect } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { getFileName } from '../../utils/pathUtils';

export interface ProjectOption {
  path: string;
  name: string;
}

export interface ProjectSelectionDialogProps {
  isOpen: boolean;
  fileName: string;
  suggestedWorkspace?: string;
  onSelectProject: (projectPath: string) => void;
  onCancel: () => void;
}

const dialogButtonBase =
  'project-selection-button inline-flex items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-50';

export const ProjectSelectionDialog: React.FC<ProjectSelectionDialogProps> = ({
  isOpen,
  fileName,
  suggestedWorkspace,
  onSelectProject,
  onCancel
}) => {
  const [recentProjects, setRecentProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRecentProjects();
    }
  }, [isOpen]);

  const loadRecentProjects = async () => {
    try {
      const projects = await window.electronAPI.invoke('get-recent-workspaces');
      setRecentProjects(projects || []);

      // Pre-select suggested workspace if provided
      if (suggestedWorkspace) {
        setSelectedProject(suggestedWorkspace);
      }
    } catch (err) {
      console.error('Failed to load recent projects:', err);
      setRecentProjects([]);
    }
  };

  const handleBrowse = async () => {
    try {
      const result = await window.electronAPI.invoke('dialog-show-open-dialog', {
        properties: ['openDirectory', 'createDirectory']
      });

      if (!result.canceled && result.filePaths.length > 0) {
        onSelectProject(result.filePaths[0]);
      }
    } catch (err) {
      console.error('Failed to browse for project:', err);
    }
  };

  const handleCreateNew = async () => {
    try {
      const result = await window.electronAPI.invoke('dialog-show-open-dialog', {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Create New Project',
        buttonLabel: 'Create Project'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        onSelectProject(result.filePaths[0]);
      }
    } catch (err) {
      console.error('Failed to create new project:', err);
    }
  };

  const handleUseSuggested = () => {
    if (suggestedWorkspace) {
      onSelectProject(suggestedWorkspace);
    }
  };

  const handleUseSelected = () => {
    if (selectedProject) {
      onSelectProject(selectedProject);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="project-selection-dialog-overlay nim-overlay agent-elements-project-selection-dialog-backdrop bg-[color-mix(in_srgb,var(--nim-text)_36%,transparent)]"
      data-testid="agent-elements-project-selection-dialog-backdrop"
      data-agent-elements-shell="project-selection-dialog-backdrop"
      onClick={onCancel}
    >
      <div
        className="project-selection-dialog nim-modal agent-elements-project-selection-dialog agent-elements-tool-card w-[560px] max-w-[92vw] max-h-[82vh] !gap-0 !p-0 overflow-hidden rounded-[var(--an-border-radius)] bg-[var(--an-background)] border border-[var(--an-border-color)] shadow-[0_20px_60px_color-mix(in_srgb,var(--nim-text)_18%,transparent)]"
        data-testid="agent-elements-project-selection-dialog"
        data-component="ProjectSelectionDialog"
        data-agent-elements-shell="project-selection-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="project-selection-dialog-header agent-elements-project-selection-dialog-header p-[var(--an-spacing-xl)] border-b border-[var(--an-border-color)]"
          data-testid="agent-elements-project-selection-dialog-header"
          data-agent-elements-shell="project-selection-dialog-header"
        >
          <h2 className="project-selection-dialog-title m-0 text-sm font-medium text-[var(--an-foreground)]">
            Select a Project
          </h2>
          <p className="project-selection-dialog-message m-0 mt-1 max-w-[64ch] text-xs leading-relaxed text-[var(--an-foreground-muted)]">
            <span className="text-[var(--an-foreground-muted)]">For </span>
            <strong className="font-mono font-medium text-[var(--an-foreground)]">{fileName}</strong>
            <span className="text-[var(--an-foreground-muted)]">
              {' '}outside a known workspace{suggestedWorkspace ? ', with a likely folder detected.' : '.'}
            </span>
          </p>
        </div>

        <div className="project-selection-dialog-body agent-elements-project-selection-dialog-body overflow-y-auto p-[var(--an-spacing-xl)]">
          {suggestedWorkspace && (
            <div
              className="project-selection-suggested agent-elements-project-selection-dialog-suggested agent-elements-tool-card mb-4 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-md)]"
              data-testid="agent-elements-project-selection-dialog-suggested"
              data-agent-elements-shell="project-selection-dialog-suggested"
            >
              <h3 className="project-selection-section-title m-0 mb-2 text-xs font-medium text-[var(--an-foreground-muted)]">
                Suggested Project
              </h3>
              <div className="project-selection-suggested-item mb-3 flex items-start gap-2">
                <span
                  className="project-selection-project-icon mt-0.5 text-[var(--an-foreground-muted)]"
                  aria-hidden="true"
                >
                  <MaterialSymbol icon="folder_open" size={16} />
                </span>
                <div className="min-w-0">
                  <div className="project-selection-item-name truncate text-sm font-medium text-[var(--an-foreground)]">
                    {getFileName(suggestedWorkspace)}
                  </div>
                  <div className="project-selection-item-path mt-0.5 truncate font-mono text-xs text-[var(--an-foreground-subtle)]">
                    {suggestedWorkspace}
                  </div>
                </div>
              </div>
              <button
                className={`${dialogButtonBase} project-selection-button-primary w-full border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)] hover:bg-[var(--nim-primary-hover)] hover:border-[var(--nim-primary-hover)]`}
                data-agent-elements-shell="project-selection-dialog-suggested-action"
                onClick={handleUseSuggested}
              >
                <span aria-hidden="true">
                  <MaterialSymbol icon="check_circle" size={16} />
                </span>
                Use This Project
              </button>
            </div>
          )}

          {recentProjects.length > 0 && (
            <div
              className="project-selection-recent agent-elements-project-selection-dialog-recent mb-4"
              data-testid="agent-elements-project-selection-dialog-recent"
              data-agent-elements-shell="project-selection-dialog-recent"
            >
              <h3 className="project-selection-section-title m-0 mb-2 text-xs font-medium text-[var(--an-foreground-muted)]">
                Recent Projects
              </h3>
              <div
                className="project-selection-list agent-elements-project-selection-dialog-list mb-3 max-h-[300px] overflow-y-auto rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-1"
                data-testid="agent-elements-project-selection-dialog-list"
                data-agent-elements-shell="project-selection-dialog-list"
              >
                {recentProjects.map((project) => {
                  const isSelected = selectedProject === project.path;
                  return (
                    <div
                      key={project.path}
                      className={`project-selection-item agent-elements-project-selection-dialog-row flex cursor-pointer items-start gap-2 rounded-[var(--an-tool-border-radius)] border px-2.5 py-2 transition-[background-color,border-color,color] duration-150 ease-out ${
                        isSelected
                          ? 'selected border-[var(--an-primary-color)] bg-[color-mix(in_srgb,var(--an-primary-color)_10%,var(--an-background))]'
                          : 'border-transparent hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)]'
                      }`}
                      data-agent-elements-shell="project-selection-dialog-row"
                      data-selected={isSelected ? 'true' : 'false'}
                      onClick={() => setSelectedProject(project.path)}
                    >
                      <span
                        className={isSelected ? 'text-[var(--an-primary-color)]' : 'text-[var(--an-foreground-muted)]'}
                        aria-hidden="true"
                      >
                        <MaterialSymbol icon={isSelected ? 'radio_button_checked' : 'folder'} size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="project-selection-item-name truncate text-sm font-medium text-[var(--an-foreground)]">
                          {project.name}
                        </div>
                        <div className="project-selection-item-path mt-0.5 truncate font-mono text-xs text-[var(--an-foreground-subtle)]">
                          {project.path}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                className={`${dialogButtonBase} project-selection-button-primary w-full border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)] hover:bg-[var(--nim-primary-hover)] hover:border-[var(--nim-primary-hover)]`}
                data-agent-elements-shell="project-selection-dialog-selected-action"
                onClick={handleUseSelected}
                disabled={!selectedProject}
              >
                <span aria-hidden="true">
                  <MaterialSymbol icon="arrow_forward" size={16} />
                </span>
                Use Selected Project
              </button>
            </div>
          )}

          <div
            className="project-selection-actions agent-elements-project-selection-dialog-actions mb-4 grid grid-cols-2 gap-2"
            data-agent-elements-shell="project-selection-dialog-actions"
          >
            <button
              className={`${dialogButtonBase} project-selection-button-secondary border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] hover:bg-[var(--an-background-tertiary)]`}
              onClick={handleBrowse}
            >
              <span aria-hidden="true">
                <MaterialSymbol icon="folder_open" size={16} />
              </span>
              Browse for Project...
            </button>
            <button
              className={`${dialogButtonBase} project-selection-button-secondary border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] hover:bg-[var(--an-background-tertiary)]`}
              onClick={handleCreateNew}
            >
              <span aria-hidden="true">
                <MaterialSymbol icon="create_new_folder" size={16} />
              </span>
              Create New Project...
            </button>
          </div>
        </div>

        <div
          className="project-selection-footer agent-elements-project-selection-dialog-footer flex justify-end border-t border-[var(--an-border-color)] p-[var(--an-spacing-xl)]"
          data-agent-elements-shell="project-selection-dialog-footer"
        >
          <button
            className={`${dialogButtonBase} project-selection-button-cancel border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]`}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
