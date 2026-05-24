import React, { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { MaterialSymbol } from '@nimbalyst/runtime';
import { useAlphaFeature } from '../../hooks/useAlphaFeature';
import type { SettingsCategory } from '../Settings/SettingsSidebar';
import type { SettingsScope } from '../Settings/SettingsView';
import { useFloatingMenu, FloatingPortal } from '../../hooks/useFloatingMenu';
import { AlphaBadge } from '../common/AlphaBadge';
import { stytchAuthAtom } from '../../store/atoms/stytchAuth';

interface UserMenuPopoverProps {
  onNavigateSettings: (scope: SettingsScope, category?: SettingsCategory) => void;
  onClose: () => void;
  /** Whether the user has a team or mobile sync configured for this workspace */
  isProjectConnected?: boolean;
  /** The anchor element to position the popover relative to */
  anchorEl: HTMLElement | null;
}

interface UserMenuItem {
  label: string;
  action: string;
  icon: string;
  alpha?: boolean;
  onClick: () => void;
}

export function UserMenuPopover({ onNavigateSettings, onClose, isProjectConnected = false, anchorEl }: UserMenuPopoverProps) {
  const authState = useAtomValue(stytchAuthAtom);

  const menu = useFloatingMenu({
    placement: 'right-end',
    open: true,
    onOpenChange: (open) => { if (!open) onClose(); },
  });

  // Set the anchor element as the position reference
  useEffect(() => {
    if (anchorEl) {
      menu.refs.setReference(anchorEl);
    }
  }, [anchorEl, menu.refs]);

  const isCollaborationEnabled = useAlphaFeature('collaboration');
  const email = authState?.user?.emails?.[0]?.email;
  const isSignedIn = authState?.isAuthenticated ?? false;

  const menuItems: UserMenuItem[] = [
    {
      label: 'User Settings',
      action: 'user-settings',
      icon: 'person',
      onClick: () => {
        onNavigateSettings('user');
        onClose();
      },
    },
    {
      label: 'Project Settings',
      action: 'project-settings',
      icon: 'folder',
      onClick: () => {
        onNavigateSettings('project');
        onClose();
      },
    },
    // Show Team Settings when connected AND collaboration alpha is enabled
    ...(isProjectConnected && isCollaborationEnabled ? [{
      label: 'Team Settings',
      action: 'team-settings',
      icon: 'group',
      alpha: true,
      onClick: () => {
        onNavigateSettings('project', 'team');
        onClose();
      },
    }] : []),
    // Sync Settings -- always available (login and mobile sync are GA features)
    {
      label: 'Sync Settings',
      action: 'sync-settings',
      icon: 'sync',
      onClick: () => {
        onNavigateSettings('user', 'sync');
        onClose();
      },
    },
  ];

  const menuShellClasses = [
    'user-menu-popover',
    'agent-elements-user-menu-popover',
    'agent-elements-tool-card',
    'z-50',
    'w-56',
    'overflow-hidden',
    'rounded-[var(--an-tool-border-radius)]',
    'border',
    'border-[var(--an-tool-border-color)]',
    'bg-[var(--an-tool-background)]',
    'p-1',
    'text-[13px]',
    'leading-5',
    'text-[var(--an-tool-color)]',
    'shadow-[0_12px_32px_color-mix(in_srgb,var(--an-foreground)_10%,transparent)]',
  ].join(' ');

  const menuItemClasses = [
    'agent-elements-user-menu-item',
    'flex',
    'w-full',
    'items-center',
    'gap-2.5',
    'rounded-[8px]',
    'border-0',
    'bg-transparent',
    'px-3',
    'py-2',
    'text-left',
    'text-[13px]',
    'leading-5',
    'text-[var(--an-tool-color)]',
    'transition-[background-color,color]',
    'duration-150',
    'cursor-pointer',
    'select-none',
    'hover:bg-[var(--an-background-tertiary)]',
    'focus-visible:outline-2',
    'focus-visible:outline-[var(--an-primary-color)]',
    'focus-visible:outline-offset-2',
  ].join(' ');

  const iconClasses = 'agent-elements-user-menu-icon flex h-5 w-5 shrink-0 items-center justify-center text-[var(--an-tool-color-muted)]';

  return (
    <FloatingPortal>
      <div
        ref={menu.refs.setFloating}
        style={menu.floatingStyles}
        {...menu.getFloatingProps()}
        className={menuShellClasses}
        data-component="UserMenuPopover"
        data-agent-elements-shell="user-menu-popover"
        data-testid="user-menu-popover"
      >
        <div className="py-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              className={menuItemClasses}
              onClick={item.onClick}
              role="menuitem"
              data-testid={`user-menu-${item.action}`}
              data-agent-elements-shell="user-menu-item"
              data-menu-action={item.action}
            >
              <span className={iconClasses}>
                <MaterialSymbol icon={item.icon} size={18} />
              </span>
              <span className="agent-elements-user-menu-label min-w-0 flex-1 truncate">{item.label}</span>
              {item.alpha && <AlphaBadge size="xs" />}
            </button>
          ))}
        </div>

        <div
          className="agent-elements-user-menu-separator mx-2 my-1 h-px bg-[var(--an-tool-border-color)]"
          data-agent-elements-shell="user-menu-separator"
        />
        <button
          className={[
            'agent-elements-user-menu-identity',
            'flex',
            'w-full',
            'items-center',
            'gap-2.5',
            'rounded-[8px]',
            'border-0',
            'bg-transparent',
            'px-3',
            'py-2.5',
            'text-left',
            'transition-[background-color,color]',
            'duration-150',
            'cursor-pointer',
            'select-none',
            'hover:bg-[var(--an-background-tertiary)]',
            'focus-visible:outline-2',
            'focus-visible:outline-[var(--an-primary-color)]',
            'focus-visible:outline-offset-2',
          ].join(' ')}
          onClick={() => {
            onNavigateSettings('user', 'sync');
            onClose();
          }}
          role="menuitem"
          data-testid="user-menu-identity"
          data-agent-elements-shell="user-menu-identity"
          data-menu-action="sync-identity"
          data-signed-in={isSignedIn ? 'true' : 'false'}
        >
          <div className="agent-elements-user-menu-avatar flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--an-primary-color)]">
            <span
              className="text-[12px] font-semibold leading-none text-[var(--an-background)]"
              data-agent-elements-shell="user-menu-avatar-initial"
            >
              {email ? email[0].toUpperCase() : '?'}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate text-[13px] leading-5 text-[var(--an-tool-color)]">
              {email ?? 'No account'}
            </span>
            <span className="text-[12px] leading-4 text-[var(--an-tool-color-muted)]">
              {isSignedIn ? 'Signed in' : 'Not signed in'}
            </span>
          </div>
        </button>
      </div>
    </FloatingPortal>
  );
}
