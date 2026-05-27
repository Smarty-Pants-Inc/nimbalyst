import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MaterialSymbol, getProviderIcon } from '@nimbalyst/runtime';
import { useAlphaFeatures } from '../../hooks/useAlphaFeature';
import { AlphaBadge, SETTINGS_ALPHA_TOOLTIP } from '../common/AlphaBadge';

export type SettingsCategory =
  | 'agent-permissions'
  | 'claude-code'
  | 'claude'
  | 'openai'
  | 'openai-codex'
  | 'opencode'
  | 'copilot-cli'
  | 'smarty-server'
  | 'lmstudio'
  | 'notifications'
  | 'voice-mode'
  | 'sync'
  | 'themes'
  | 'advanced'
  | 'agent-features'
  | 'beta-features'
  | 'mcp-servers'
  | 'installed-extensions'
  | 'claude-plugins'
  | 'shared-links'
  | 'marketplace'
  | 'installed'
  | 'team'
  | 'tracker-config';

interface CategoryGroup {
  title: string;
  items: CategoryItem[];
  infoTooltip?: string;
}

interface CategoryItem {
  id: SettingsCategory;
  name: string;
  icon: React.ReactNode;
  badge?: string | number;
  isAlpha?: boolean;
  statusDot?: 'success' | 'warning' | 'error';
  hidden?: boolean;
}

export type SettingsScope = 'user' | 'project';

interface SettingsSidebarProps {
  selectedCategory: SettingsCategory;
  onSelectCategory: (category: SettingsCategory) => void;
  providerStatus?: Record<string, { enabled: boolean; testStatus?: string }>;
  scope?: SettingsScope;
}

const toShellId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  providerStatus = {},
  scope = 'user',
}) => {
  // Alpha feature flags drive Collaboration group visibility only.
  // Per-feature panels (Voice Mode, OpenCode, Copilot, Agent Features) are always visible
  // so users can discover and enable them; the panels themselves gate their controls.
  const alphaFeatures = useAlphaFeatures(['collaboration']);
  const getStatusDot = (providerId: string): 'success' | 'warning' | 'error' | undefined => {
    const status = providerStatus[providerId];
    if (!status) return undefined;
    if (status.enabled && status.testStatus === 'success') return 'success';
    if (status.enabled && status.testStatus === 'error') return 'error';
    return undefined;
  };

  const categoryGroups: CategoryGroup[] = [
    {
      title: 'Application',
      items: [
        {
          id: 'sync',
          name: 'Account & Sync',
          icon: <MaterialSymbol icon="account_circle" size={16} />,
        },
        {
          id: 'shared-links',
          name: 'Shared Links',
          icon: <MaterialSymbol icon="link" size={16} />,
        },
        {
          id: 'notifications',
          name: 'Notifications',
          icon: <MaterialSymbol icon="notifications" size={16} />,
        },
        {
          id: 'themes',
          name: 'Themes',
          icon: <MaterialSymbol icon="palette" size={16} />,
        },
        {
          id: 'advanced',
          name: 'Advanced',
          icon: <MaterialSymbol icon="settings" size={16} />,
        },
        {
          id: 'voice-mode',
          name: 'Voice Mode',
          icon: <MaterialSymbol icon="mic" size={16} />,
          isAlpha: true,
        },
        {
          id: 'agent-features',
          name: 'Agent Features',
          icon: <MaterialSymbol icon="science" size={16} />,
          isAlpha: true,
        },

        {
          id: 'beta-features',
          name: 'Beta Features',
          icon: <MaterialSymbol icon="biotech" size={16} />,
          hidden: true,
        },
      ],
    },
    {
      title: 'Agent Providers',
      infoTooltip: `Agents run in loops against your files to produce work. 
      
The have full MCP support with file system access, multi-file operations, and session persistence.

Best for complex coding tasks.`,
      items: [
        {
          id: 'claude-code',
          name: 'Claude Agent',
          icon: getProviderIcon('claude-code', { size: 16 }),
          statusDot: getStatusDot('claude-code'),
        },
        {
          id: 'openai-codex',
          name: 'OpenAI Codex',
          icon: getProviderIcon('openai', { size: 16 }),
          statusDot: getStatusDot('openai-codex'),
        },
        {
          id: 'opencode',
          name: 'OpenCode',
          icon: getProviderIcon('opencode', { size: 16 }),
          statusDot: getStatusDot('opencode'),
          isAlpha: true,
        },
        {
          id: 'copilot-cli',
          name: 'GitHub Copilot',
          icon: <MaterialSymbol icon="terminal" size={16} />,
          statusDot: getStatusDot('copilot-cli'),
          isAlpha: true,
        },
        {
          id: 'smarty-server',
          name: 'Smarty Server',
          icon: getProviderIcon('smarty-server', { size: 16 }),
          statusDot: getStatusDot('smarty-server'),
        },
      ],
    },
    {
      title: 'Chat Providers',
      infoTooltip: `Chat mode is a quicker, more focused tool that is limited to reading and writing your currently open file.

Uses direct API calls with files attached as context. Faster responses, simpler behavior. Includes local model support via LM Studio.

Best for quick edits and tasks that do not require multi-file operations.`,
      items: [
        {
          id: 'claude',
          name: 'Claude Chat',
          icon: getProviderIcon('claude', { size: 16 }),
          statusDot: getStatusDot('claude'),
        },
        {
          id: 'openai',
          name: 'OpenAI',
          icon: getProviderIcon('openai', { size: 16 }),
          statusDot: getStatusDot('openai'),
        },
        {
          id: 'lmstudio',
          name: 'LM Studio',
          icon: getProviderIcon('lmstudio', { size: 16 }),
          statusDot: getStatusDot('lmstudio'),
        },
      ],
    },
    {
      title: 'Project',
      items: [
        {
          id: 'agent-permissions',
          name: 'Agent Permissions',
          icon: <MaterialSymbol icon="shield" size={16} />,
        },
      ],
    },
    ...(alphaFeatures['collaboration'] ? [{
      title: 'Collaboration',
      items: [
        {
          id: 'team' as SettingsCategory,
          name: 'Team',
          icon: <MaterialSymbol icon="group" size={16} />,
          isAlpha: true,
        },
        {
          id: 'tracker-config' as SettingsCategory,
          name: 'Trackers',
          icon: <MaterialSymbol icon="assignment" size={16} />,
          isAlpha: true,
        },
      ],
    }] : []),
    {
      title: 'Extensions',
      items: [
        {
          id: 'marketplace',
          name: 'Marketplace',
          icon: <MaterialSymbol icon="storefront" size={16} />,
        },
        {
          id: 'installed-extensions',
          name: 'Installed',
          icon: <MaterialSymbol icon="extension" size={16} />,
        },
        {
          id: 'claude-plugins',
          name: 'Claude Plugins',
          icon: <MaterialSymbol icon="widgets" size={16} />,
        },
        {
          id: 'mcp-servers',
          name: 'MCP Servers',
          icon: <MaterialSymbol icon="dns" size={16} />,
        },
      ],
    },
  ];

  // Filter groups based on scope
  // Project scope: Show Project group, Agent/Chat Providers (for overrides), Extensions
  // User scope: Show Agent/Chat Providers, Application, Extensions (not Project)
  const filteredGroups = scope === 'project'
    ? [
        categoryGroups.find(g => g.title === 'Project'),
        categoryGroups.find(g => g.title === 'Collaboration'),
        categoryGroups.find(g => g.title === 'Agent Providers'),
        categoryGroups.find(g => g.title === 'Chat Providers'),
        categoryGroups.find(g => g.title === 'Extensions'),
      ].filter((g): g is CategoryGroup => g != null)
    : categoryGroups.filter(g => g.title !== 'Project' && g.title !== 'Collaboration');

  const [tooltip, setTooltip] = useState<{ text: string; top: number; left: number } | null>(null);

  const handleTooltipEnter = (event: React.MouseEvent<HTMLSpanElement>, text: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      text,
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  };

  const handleTooltipLeave = () => {
    setTooltip(null);
  };

  return (
    <div
      className="settings-sidebar agent-elements-settings-sidebar agent-elements-panel-sidebar w-[240px] shrink-0 overflow-y-auto border-r border-[var(--an-border-color)] bg-[var(--an-background)]"
      data-agent-elements-shell="settings-sidebar"
      data-component="SettingsSidebar"
      data-testid="agent-elements-settings-sidebar"
    >
      <div
        className="settings-sidebar-content agent-elements-settings-sidebar-content p-[var(--an-spacing-lg)]"
        data-agent-elements-shell="settings-sidebar-content"
        data-testid="agent-elements-settings-sidebar-content"
      >
        {filteredGroups.map((group) => {
          const groupId = toShellId(group.title);
          return (
            <div
              key={group.title}
              className="settings-sidebar-group agent-elements-settings-group mb-[var(--an-spacing-xl)]"
              data-agent-elements-shell="settings-group"
              data-settings-group={group.title}
              data-testid={`agent-elements-settings-group-${groupId}`}
            >
              <div
                className="settings-sidebar-group-title agent-elements-settings-group-title flex items-center gap-[var(--an-spacing-xs)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-[11px] font-semibold uppercase text-[var(--an-foreground-subtle)]"
                data-agent-elements-shell="settings-group-title"
              >
                {group.title}
                {group.infoTooltip && (
                  <span
                    className="settings-sidebar-group-info agent-elements-settings-group-info cursor-help text-[var(--an-foreground-subtle)] transition-[color] duration-150 ease-out hover:text-[var(--an-foreground-muted)]"
                    data-agent-elements-shell="settings-group-info"
                    onMouseEnter={(event) => handleTooltipEnter(event, group.infoTooltip!)}
                    onMouseLeave={handleTooltipLeave}
                  >
                    <MaterialSymbol icon="info" size={14} />
                  </span>
                )}
              </div>
              {group.items
                .filter((item) => !item.hidden)
                .map((item) => (
                  <div
                    key={item.id}
                    className={`settings-sidebar-item agent-elements-settings-nav-item flex cursor-pointer items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-radius-sm)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-sm transition-[background-color,color] duration-150 ease-out ${
                      selectedCategory === item.id
                        ? 'bg-[var(--an-background-tertiary)] text-[var(--an-foreground)]'
                        : 'text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-secondary)] hover:text-[var(--an-foreground)]'
                    }`}
                    data-agent-elements-shell="settings-nav-item"
                    data-settings-category={item.id}
                    data-selected={selectedCategory === item.id ? 'true' : 'false'}
                    data-testid={`agent-elements-settings-item-${item.id}`}
                    onClick={() => onSelectCategory(item.id)}
                  >
                    <span
                      className="settings-sidebar-item-icon agent-elements-settings-nav-icon flex h-5 w-5 shrink-0 items-center justify-center text-[var(--an-foreground-muted)]"
                      data-agent-elements-shell="settings-nav-icon"
                    >
                      {item.icon}
                    </span>
                    <span className="settings-sidebar-item-name agent-elements-settings-nav-label flex-1 truncate">{item.name}</span>
                    {item.isAlpha && <AlphaBadge size="xs" tooltip={SETTINGS_ALPHA_TOOLTIP} />}
                    {item.badge && (
                      <span
                        className="settings-sidebar-item-badge agent-elements-status-pill rounded-[var(--an-radius-xs)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-xs)] py-[var(--an-spacing-xxs)] text-[10px] font-medium text-[var(--an-foreground-muted)]"
                        data-agent-elements-shell="settings-nav-badge"
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.statusDot && (
                      <span
                        className={`settings-sidebar-item-status agent-elements-status-dot h-2 w-2 shrink-0 rounded-full ${
                          item.statusDot === 'success'
                            ? 'bg-[var(--an-success-color)]'
                            : item.statusDot === 'error'
                            ? 'bg-[var(--an-error-color)]'
                            : 'bg-[var(--an-warning-color)]'
                        }`}
                        data-agent-elements-shell="settings-nav-status"
                        data-tone={item.statusDot}
                      />
                    )}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
      {tooltip &&
        createPortal(
          <div
            className="settings-sidebar-tooltip agent-elements-settings-tooltip pointer-events-none fixed z-[10000] max-w-[280px] -translate-y-1/2 whitespace-pre-wrap rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-sm text-[var(--an-foreground)] shadow-[0_12px_30px_color-mix(in_srgb,var(--an-foreground)_12%,transparent)]"
            data-agent-elements-shell="settings-tooltip"
            style={{ top: `${tooltip.top}px`, left: `${tooltip.left}px` }}
          >
            {tooltip.text}
          </div>,
          document.body
        )}
    </div>
  );
};
