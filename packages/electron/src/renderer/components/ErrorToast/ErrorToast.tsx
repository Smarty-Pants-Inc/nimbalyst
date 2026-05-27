import React, { useEffect, useState, useCallback, useRef } from 'react';
import { copyToClipboard, MaterialSymbol } from '@nimbalyst/runtime';
import { errorNotificationService, type ErrorNotification } from '../../services/ErrorNotificationService';

const severityStyles: Record<ErrorNotification['severity'], string> = {
  error:
    'border-[color-mix(in_srgb,var(--an-error-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-error-color)_7%,var(--an-background))] text-[var(--an-error-color)]',
  warning:
    'border-[color-mix(in_srgb,var(--an-warning-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-warning-color)_7%,var(--an-background))] text-[var(--an-warning-color)]',
  info:
    'border-[color-mix(in_srgb,var(--an-info-color)_34%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--an-info-color)_7%,var(--an-background))] text-[var(--an-info-color)]',
};

const severityIcons: Record<ErrorNotification['severity'], string> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};

export function ErrorToastContainer() {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleDismiss = useCallback((id: string) => {
    // Clear any pending timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setNotifications(prev => prev.filter(n => n.id !== id));
    errorNotificationService.dismiss(id);
  }, []);

  const startDismissTimer = useCallback((notification: ErrorNotification) => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss(notification.id);
      }, notification.duration);
      timersRef.current.set(notification.id, timer);
    }
  }, [handleDismiss]);

  const pauseDismissTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const resumeDismissTimer = useCallback((notification: ErrorNotification) => {
    startDismissTimer(notification);
  }, [startDismissTimer]);

  useEffect(() => {
    // Pick up any notifications that were fired before this component mounted
    const existing = errorNotificationService.getAll();
    if (existing.length > 0) {
      setNotifications(existing);
      existing.forEach(startDismissTimer);
    }

    const unsubscribe = errorNotificationService.addListener((notification) => {
      setNotifications(prev => [...prev, notification]);
      startDismissTimer(notification);
    });

    return () => {
      unsubscribe();
      // Clean up all timers on unmount
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [startDismissTimer]);

  const handleCopyDetails = useCallback((notification: ErrorNotification) => {
    const details = `
# ${notification.title}

**Severity:** ${notification.severity}
**Time:** ${new Date(notification.timestamp).toLocaleString()}

## Message
${notification.message}

${notification.details ? `
## Details
${notification.details}
` : ''}

${notification.stack ? `
## Stack Trace
\`\`\`
${notification.stack}
\`\`\`
` : ''}

${notification.context ? `
## Context
\`\`\`json
${JSON.stringify(notification.context, null, 2)}
\`\`\`
` : ''}
`.trim();

    copyToClipboard(details);
  }, []);

  const handleActionClick = useCallback((notification: ErrorNotification) => {
    if (notification.action) {
      notification.action.onClick();
      handleDismiss(notification.id);
    }
  }, [handleDismiss]);

  if (notifications.length === 0) return null;

  return (
    <div
      className="error-toast-container agent-elements-error-toast-container fixed right-5 top-10 z-[10000] flex max-w-[min(500px,calc(100vw-32px))] flex-col gap-[var(--an-spacing-lg)] pointer-events-none [container-type:inline-size]"
      data-component="ErrorToastContainer"
      data-agent-elements-shell="error-toast-container"
      data-testid="agent-elements-error-toast-container"
    >
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`error-toast error-toast--${notification.severity} agent-elements-error-toast agent-elements-tool-card pointer-events-auto flex flex-col gap-[var(--an-spacing-md)] rounded-[var(--an-tool-border-radius)] border p-[var(--an-spacing-xl)] text-[var(--an-foreground)] shadow-[0_16px_48px_color-mix(in_srgb,var(--an-foreground)_16%,transparent)] transition-[opacity,transform] duration-200 ease-out ${severityStyles[notification.severity]}`}
          role="alert"
          data-agent-elements-shell="error-toast"
          data-severity={notification.severity}
          onMouseEnter={() => pauseDismissTimer(notification.id)}
          onMouseLeave={() => resumeDismissTimer(notification)}
        >
          <div
            className="error-toast-header agent-elements-error-toast-header flex items-start gap-[var(--an-spacing-md)]"
            data-agent-elements-shell="error-toast-header"
          >
            <div
              className="error-toast-icon agent-elements-error-toast-icon agent-elements-status-pill flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-current bg-[color-mix(in_srgb,currentColor_10%,transparent)]"
              data-agent-elements-shell="error-toast-icon"
              data-testid="agent-elements-error-toast-icon"
            >
              <MaterialSymbol icon={severityIcons[notification.severity]} size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="error-toast-title agent-elements-error-toast-title text-sm font-semibold leading-5 text-[var(--an-foreground)]">
                {notification.title}
              </div>
              <div
                className="error-toast-message agent-elements-error-toast-message mt-[var(--an-spacing-xs)] select-text text-[13px] leading-5 text-[var(--an-foreground-muted)]"
                data-agent-elements-shell="error-toast-message"
                data-testid="agent-elements-error-toast-message"
              >
                {notification.message}
              </div>
            </div>
            {notification.dismissible && (
              <button
                className="error-toast-close agent-elements-error-toast-close flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border-none bg-transparent p-0 text-[var(--an-foreground-muted)] transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss(notification.id);
                }}
                aria-label="Dismiss notification"
                type="button"
              >
                <MaterialSymbol icon="close" size={15} />
              </button>
            )}
          </div>

          {(notification.action || notification.details || notification.stack || notification.context) && (
            <div
              className="error-toast-actions agent-elements-error-toast-actions flex flex-wrap gap-[var(--an-spacing-sm)]"
              data-agent-elements-shell="error-toast-actions"
              data-testid="agent-elements-error-toast-actions"
            >
              {notification.action && (
                <button
                  className="error-toast-action-btn agent-elements-error-toast-action cursor-pointer rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-xs font-medium text-[var(--an-foreground)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:border-[var(--an-primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                  onClick={() => handleActionClick(notification)}
                >
                  {notification.action.label}
                </button>
              )}
              {(notification.details || notification.stack || notification.context) && (
                <button
                  className="error-toast-copy-btn agent-elements-error-toast-copy cursor-pointer rounded-[var(--an-input-border-radius)] border border-[var(--an-send-button-bg)] bg-[var(--an-send-button-bg)] px-[var(--an-spacing-lg)] py-[var(--an-spacing-sm)] text-xs font-medium text-[var(--an-send-button-color)] transition-colors duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--an-primary-color)_88%,var(--an-foreground))] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
                  onClick={() => handleCopyDetails(notification)}
                >
                  Copy Details
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
