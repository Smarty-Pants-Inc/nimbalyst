import React, { useState, useEffect, useCallback } from 'react';
import type { ExtensionManifest, ConfigurationProperty } from '@nimbalyst/runtime';

interface ExtensionConfigPanelProps {
  extensionId: string;
  manifest: ExtensionManifest;
  scope: 'user' | 'project';
  workspacePath?: string;
  onConfigChange?: () => void;
}

const panelClass =
  'extension-config-panel agent-elements-extension-config-panel flex flex-col gap-[var(--an-spacing-xl)] text-[var(--an-foreground)]';
const statusShellClass =
  'agent-elements-tool-card extension-config-status-card [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)] text-center text-sm text-[var(--an-foreground-muted)]';
const fieldShellClass =
  'config-field agent-elements-extension-config-field rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]';
const fieldLabelClass =
  'config-field-label text-sm font-medium text-[var(--an-foreground)]';
const fieldInputClass =
  'rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-sm text-[var(--an-input-color)] outline-none transition-[background-color,border-color,color] duration-150 ease-out placeholder:text-[var(--an-input-placeholder-color)] focus:border-[var(--an-input-focus-border)] focus:ring-2 focus:ring-[var(--an-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60';
const fieldHintClass =
  'config-field-hint text-xs text-[var(--an-foreground-subtle)]';

/**
 * Renders a dynamic configuration panel for an extension based on its
 * configuration contribution in the manifest.
 */
export const ExtensionConfigPanel: React.FC<ExtensionConfigPanelProps> = ({
  extensionId,
  manifest,
  scope,
  workspacePath,
  onConfigChange,
}) => {
  const config = manifest.contributions?.configuration;
  const properties = config?.properties ?? {};
  const hasConfigurableProperties = !!config && Object.keys(properties).length > 0;

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(hasConfigurableProperties);
  const [saving, setSaving] = useState(false);

  // Load configuration values
  useEffect(() => {
    if (!hasConfigurableProperties) return;
    loadConfig();
  }, [extensionId, scope, workspacePath]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const userConfig = await window.electronAPI.extensions.getConfig(extensionId, 'user');

      // If in project scope, also get workspace config which overrides user
      let workspaceConfig: Record<string, unknown> = {};
      if (scope === 'project' && workspacePath) {
        workspaceConfig = await window.electronAPI.extensions.getConfig(extensionId, 'workspace', workspacePath);
      }

      // Merge configs: defaults < user < workspace
      const merged: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(properties)) {
        // Start with default
        merged[key] = prop.default;
        // Override with user value if present
        if (userConfig[key] !== undefined) {
          merged[key] = userConfig[key];
        }
        // Override with workspace value if in project scope
        if (scope === 'project' && workspaceConfig[key] !== undefined) {
          merged[key] = workspaceConfig[key];
        }
      }

      setValues(merged);
    } catch (err) {
      console.error('Failed to load extension config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = useCallback(async (key: string, value: unknown) => {
    setSaving(true);
    try {
      const apiScope = scope === 'project' ? 'workspace' : 'user';
      await window.electronAPI.extensions.setConfig(
        extensionId,
        key,
        value,
        apiScope,
        scope === 'project' ? workspacePath : undefined
      );

      setValues(prev => ({ ...prev, [key]: value }));
      onConfigChange?.();
    } catch (err) {
      console.error('Failed to save extension config:', err);
    } finally {
      setSaving(false);
    }
  }, [extensionId, scope, workspacePath, onConfigChange]);

  if (!config || Object.keys(properties).length === 0) {
    return (
      <div
        className={`extension-config-empty agent-elements-extension-config-empty ${statusShellClass}`}
        data-agent-elements-shell="extension-config-empty"
        data-testid="agent-elements-extension-config-empty"
      >
        <p>This extension has no configurable settings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`extension-config-loading agent-elements-extension-config-loading ${statusShellClass}`}
        data-agent-elements-shell="extension-config-loading"
        data-testid="agent-elements-extension-config-loading"
      >
        <p>Loading configuration...</p>
      </div>
    );
  }

  // Sort properties by order
  const sortedProperties = Object.entries(properties).sort(
    ([, a], [, b]) => (a.order ?? 1000) - (b.order ?? 1000)
  );

  return (
    <div
      className={panelClass}
      data-agent-elements-shell="extension-config-panel"
      data-component="ExtensionConfigPanel"
      data-testid="agent-elements-extension-config-panel"
    >
      {config.title && (
        <div
          className="extension-config-header agent-elements-extension-config-header"
          data-agent-elements-shell="extension-config-header"
          data-testid="agent-elements-extension-config-header"
        >
          <h4 className="text-base font-semibold text-[var(--an-foreground)]">{config.title}</h4>
        </div>
      )}
      <div
        className="extension-config-fields agent-elements-extension-config-fields flex flex-col gap-[var(--an-spacing-lg)]"
        data-agent-elements-shell="extension-config-fields"
        data-testid="agent-elements-extension-config-fields"
      >
        {sortedProperties.map(([key, prop]) => (
          <ConfigField
            key={key}
            propertyKey={key}
            property={prop}
            value={values[key]}
            onChange={(value) => handleChange(key, value)}
            disabled={saving}
          />
        ))}
      </div>
    </div>
  );
};

interface ConfigFieldProps {
  propertyKey: string;
  property: ConfigurationProperty;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

const ConfigField: React.FC<ConfigFieldProps> = ({
  propertyKey,
  property,
  value,
  onChange,
  disabled,
}) => {
  const { type, description, placeholder } = property;

  // Render based on property type
  switch (type) {
    case 'boolean':
      return (
        <div
          className={`${fieldShellClass} config-field-boolean`}
          data-agent-elements-shell="extension-config-field"
          data-field-type="boolean"
          data-testid={`agent-elements-extension-config-field-${propertyKey}`}
        >
          <label className="config-field-toggle flex cursor-pointer items-center gap-[var(--an-spacing-md)]">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded-[var(--an-radius-xs)] border-[var(--an-input-border-color)] accent-[var(--an-primary-color)]"
            />
            <span className={fieldLabelClass}>{description || propertyKey}</span>
          </label>
        </div>
      );

    case 'string':
      // If has enum, render as select
      if (property.enum && property.enum.length > 0) {
        return (
          <div
            className={`${fieldShellClass} config-field-select`}
            data-agent-elements-shell="extension-config-field"
            data-field-type="select"
            data-testid={`agent-elements-extension-config-field-${propertyKey}`}
          >
            <label className="config-field-label-block flex flex-col gap-[var(--an-spacing-xs)]">
              <span className={fieldLabelClass}>{description || propertyKey}</span>
              <select
                value={String(value ?? '')}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className={fieldInputClass}
              >
                {property.enum.map((opt, idx) => (
                  <option key={String(opt)} value={String(opt)}>
                    {property.enumDescriptions?.[idx] ?? String(opt)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        );
      }

      // Regular text input
      return (
        <div
          className={`${fieldShellClass} config-field-text`}
          data-agent-elements-shell="extension-config-field"
          data-field-type="text"
          data-testid={`agent-elements-extension-config-field-${propertyKey}`}
        >
          <label className="config-field-label-block flex flex-col gap-[var(--an-spacing-xs)]">
            <span className={fieldLabelClass}>{description || propertyKey}</span>
            <input
              type="text"
              value={String(value ?? '')}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              pattern={property.pattern}
              disabled={disabled}
              className={fieldInputClass}
            />
          </label>
        </div>
      );

    case 'number':
      return (
        <div
          className={`${fieldShellClass} config-field-number`}
          data-agent-elements-shell="extension-config-field"
          data-field-type="number"
          data-testid={`agent-elements-extension-config-field-${propertyKey}`}
        >
          <label className="config-field-label-block flex flex-col gap-[var(--an-spacing-xs)]">
            <span className={fieldLabelClass}>{description || propertyKey}</span>
            <input
              type="number"
              value={value !== undefined ? Number(value) : ''}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
              min={property.minimum}
              max={property.maximum}
              placeholder={placeholder}
              disabled={disabled}
              className={fieldInputClass}
            />
          </label>
        </div>
      );

    default:
      // Fallback for unsupported types
      return (
        <div
          className={`${fieldShellClass} config-field-unsupported flex flex-col gap-[var(--an-spacing-xs)]`}
          data-agent-elements-shell="extension-config-field"
          data-field-type="unsupported"
          data-testid={`agent-elements-extension-config-unsupported-${propertyKey}`}
        >
          <span className={fieldLabelClass}>{description || propertyKey}</span>
          <span className="config-field-value font-mono text-sm text-[var(--an-foreground-muted)]">{JSON.stringify(value)}</span>
          <span className={fieldHintClass}>Type "{type}" not supported in UI</span>
        </div>
      );
  }
};

export default ExtensionConfigPanel;
