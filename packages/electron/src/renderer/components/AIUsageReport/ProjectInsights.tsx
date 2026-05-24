import React, { useEffect, useState } from 'react';

interface ProjectUsageStats {
  workspaceId: string;
  sessionCount: number;
  totalTokens: number;
  lastActivity: number;
}

export const ProjectInsights: React.FC = () => {
  const [projects, setProjects] = useState<ProjectUsageStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await window.electronAPI.invoke('usage-analytics:get-usage-by-project');
        setProjects(data);
      } catch (error) {
        console.error('Failed to load project insights:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="project-insights-loading agent-elements-ai-usage-loading flex min-h-[400px] items-center justify-center text-base text-nim-muted">
        Loading...
      </div>
    );
  }

  return (
    <div
      className="project-insights agent-elements-ai-usage-projects flex flex-col gap-6"
      data-agent-elements-shell="ai-usage-projects"
    >
      <h3 className="m-0 text-base font-semibold leading-6 text-nim">Usage by Project</h3>

      {projects.length > 0 ? (
        <div className="project-list grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {projects.map((project, index) => (
            <div
              key={index}
              className="project-card agent-elements-ai-usage-project-card rounded-[10px] border border-nim bg-nim-secondary p-4"
              data-agent-elements-shell="ai-usage-project-card"
            >
              <div className="project-name mb-4 truncate text-base font-semibold text-nim">{project.workspaceId.split('/').pop() || project.workspaceId}</div>
              <div className="project-stats flex flex-col gap-2">
                <div className="project-stat flex justify-between gap-3 text-sm">
                  <span className="project-stat-label text-nim-muted">Sessions:</span>
                  <span className="project-stat-value font-medium text-nim">{project.sessionCount}</span>
                </div>
                <div className="project-stat flex justify-between gap-3 text-sm">
                  <span className="project-stat-label text-nim-muted">Tokens:</span>
                  <span className="project-stat-value font-medium text-nim">{project.totalTokens.toLocaleString()}</span>
                </div>
                <div className="project-stat flex justify-between gap-3 text-sm">
                  <span className="project-stat-label text-nim-muted">Last Active:</span>
                  <span className="project-stat-value font-medium text-nim">
                    {new Date(project.lastActivity).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-data agent-elements-ai-usage-empty flex min-h-[400px] items-center justify-center text-base text-nim-muted">No project data available</div>
      )}
    </div>
  );
};
