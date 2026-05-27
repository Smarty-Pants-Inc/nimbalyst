/**
 * Custom widget for the display_visual MCP tool
 *
 * Renders visual content inline in the AI transcript.
 * Supports:
 * - Charts (bar, line, pie, area, scatter) using Recharts
 * - Image galleries with file path loading
 */

import React, { useState } from 'react';
import { FullscreenModal } from '../FullscreenModal';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ErrorBar
} from 'recharts';
import type { CustomToolWidgetProps } from './index';
import type { TranscriptViewMessage } from '../../../../ai/server/transcript/TranscriptProjector';
type ToolCall = NonNullable<TranscriptViewMessage['toolCall']>;
import { AgentStatusPill, AgentToolCard, type AgentStatusTone, type AgentToolStatus } from '../../../AgentElements/AgentElementsPrimitives';
import { MaterialSymbol } from '../../../icons/MaterialSymbol';
import { ImageDisplay, type ImageContent, type VisualDisplayReadFile } from './VisualDisplayImageDisplay';

const DEFAULT_CHART_COLORS = [
  'var(--an-primary-color)',
  'var(--an-success-color)',
  'var(--an-warning-color)',
  'var(--an-diff-removed-text)',
  'var(--an-foreground-muted)',
  'color-mix(in srgb, var(--an-primary-color) 70%, var(--an-success-color))',
  'color-mix(in srgb, var(--an-primary-color) 70%, var(--an-warning-color))',
  'color-mix(in srgb, var(--an-success-color) 70%, var(--an-diff-removed-text))',
];

const CHART_GRID_STROKE = 'var(--an-tool-border-color)';
const CHART_AXIS_STROKE = 'var(--an-tool-color-muted)';
const CHART_ERROR_STROKE = 'var(--an-tool-color-muted)';

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/**
 * Render error bar component based on configuration
 * Supports both symmetric (errorKey) and asymmetric (errorKeyLower/errorKeyUpper) error bars
 */
function renderErrorBar(errorBars: ErrorBarConfig | undefined) {
  if (!errorBars) return null;

  // Validate that we have either symmetric or asymmetric error data
  const hasSymmetric = !!errorBars.errorKey;
  const hasAsymmetric = !!(errorBars.errorKeyLower && errorBars.errorKeyUpper);

  if (!hasSymmetric && !hasAsymmetric) {
    console.warn('[VisualDisplayWidget] Error bars configured but no error data keys provided');
    return null;
  }

  const strokeWidth = errorBars.strokeWidth ?? 2;
  if (hasSymmetric) {
    // Symmetric error bars
    return <ErrorBar dataKey={errorBars.errorKey!} stroke={CHART_ERROR_STROKE} strokeWidth={strokeWidth} />;
  } else {
    // Asymmetric error bars (lower and upper bounds)
    return (
      <>
        <ErrorBar dataKey={errorBars.errorKeyLower!} direction="y" stroke={CHART_ERROR_STROKE} strokeWidth={strokeWidth} />
        <ErrorBar dataKey={errorBars.errorKeyUpper!} direction="y" stroke={CHART_ERROR_STROKE} strokeWidth={strokeWidth} />
      </>
    );
  }
}

// Error bar configuration
interface ErrorBarConfig {
  dataKey?: string; // For multi-series charts, specify which series to add error bars to
  errorKey?: string; // Symmetric error values
  errorKeyLower?: string; // Lower error values (asymmetric)
  errorKeyUpper?: string; // Upper error values (asymmetric)
  strokeWidth?: number; // Line width
}

// Chart configuration for rendering
interface ChartConfig {
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  data: Record<string, unknown>[];
  xAxisKey: string;
  yAxisKey: string | string[];
  colors?: string[];
  errorBars?: ErrorBarConfig;
}

interface ChartContent {
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  data: Record<string, unknown>[];
  xAxisKey: string;
  yAxisKey: string | string[];
  colors?: string[];
  errorBars?: ErrorBarConfig;
}

interface DisplayItem {
  description: string;
  image?: ImageContent;
  chart?: ChartContent;
}

interface DisplayArgs {
  items: DisplayItem[];
}

/**
 * Type guard to check if value is DisplayArgs
 */
function isDisplayArgs(value: unknown): value is DisplayArgs {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;

  if (!obj.items || !Array.isArray(obj.items) || obj.items.length === 0) {
    return false;
  }

  // Validate each item
  for (const item of obj.items) {
    if (!item || typeof item !== 'object') return false;
    const typedItem = item as Record<string, unknown>;

    // Check description
    if (!typedItem.description || typeof typedItem.description !== 'string') return false;

    const hasImage = !!typedItem.image;
    const hasChart = !!typedItem.chart;

    // Must have exactly one content type
    if (!hasImage && !hasChart) return false;
    if (hasImage && hasChart) return false;

    // Validate image content
    if (hasImage) {
      const image = typedItem.image as Record<string, unknown>;
      if (!image || typeof image !== 'object' || !image.path || typeof image.path !== 'string') {
        return false;
      }
    }

    // Validate chart content
    if (hasChart) {
      const chart = typedItem.chart as Record<string, unknown>;
      if (!chart || typeof chart !== 'object') return false;
      if (!chart.chartType || !chart.data || !chart.xAxisKey || !chart.yAxisKey) {
        return false;
      }
      if (!Array.isArray(chart.data)) return false;
    }
  }

  return true;
}

/**
 * Extract display items from tool arguments
 */
function extractDisplayItems(tool: ToolCall): DisplayItem[] | null {
  if (!tool?.arguments) return null;

  if (!isDisplayArgs(tool.arguments)) {
    return null;
  }

  return tool.arguments.items;
}

/**
 * Check if the tool result indicates an error
 */
function isToolError(result: unknown, message: { isError?: boolean }): boolean {
  if (message.isError) return true;
  if (typeof result === 'object' && result !== null && 'isError' in result) {
    return (result as { isError?: boolean }).isError === true;
  }
  return false;
}

/**
 * Make technical error messages more user-friendly
 * Handles various error formats from MCP server and Claude Code SDK
 */
function formatErrorMessage(rawMessage: string): string {
  // Handle "items[N].image.path file does not exist: /path" format (from Claude Code SDK)
  const fileNotExistMatch = rawMessage.match(/items\[\d+\]\.image\.path file does not exist:\s*"?([^"]+)"?/);
  if (fileNotExistMatch) {
    const filePath = fileNotExistMatch[1];
    return `File not found at "${filePath}". Please verify the file exists and the path is correct.`;
  }

  // Handle "items[N].image.path must be..." format
  const pathValidationMatch = rawMessage.match(/items\[\d+\]\.image\.path\s+(.*)/);
  if (pathValidationMatch) {
    return pathValidationMatch[1]; // Return just the validation message without the prefix
  }

  // Handle "Error: items[N]..." prefix - strip the technical prefix
  const errorPrefixMatch = rawMessage.match(/^Error:\s*items\[\d+\]\.?\s*(.*)/);
  if (errorPrefixMatch) {
    return errorPrefixMatch[1];
  }

  return rawMessage;
}

/**
 * Extract error message from tool result
 * Server returns errors in format: { content: [{ type: 'text', text: 'Error: ...' }], isError: true }
 * Claude Code SDK may also return errors as plain strings
 */
function extractErrorMessage(result: unknown): string | null {
  let rawMessage: string | null = null;

  if (!result || typeof result !== 'object') {
    // If result is a string, use it directly
    if (typeof result === 'string') {
      rawMessage = result;
    }
  } else {
    const resultObj = result as Record<string, unknown>;

    // Handle MCP-style content array response
    if (Array.isArray(resultObj.content)) {
      for (const item of resultObj.content) {
        if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
          rawMessage = item.text;
          break;
        }
      }
    }

    // Handle simple text response
    if (!rawMessage && typeof resultObj.text === 'string') {
      rawMessage = resultObj.text;
    }

    // Handle error message field
    if (!rawMessage && typeof resultObj.error === 'string') {
      rawMessage = resultObj.error;
    }

    if (!rawMessage && typeof resultObj.message === 'string') {
      rawMessage = resultObj.message;
    }

    // Last resort: if result is truthy and we couldn't extract a message,
    // try to stringify it (but only if it looks like it might contain useful info)
    if (!rawMessage) {
      try {
        const stringified = JSON.stringify(resultObj);
        // Only return if it's not just "{}" or similar
        if (stringified && stringified.length > 2 && stringified !== '{}') {
          rawMessage = stringified;
        }
      } catch {
        // Ignore stringify errors
      }
    }
  }

  if (!rawMessage) {
    return null;
  }

  // Format the message to be more user-friendly
  return formatErrorMessage(rawMessage);
}

/**
 * Error boundary for visual rendering
 */
class VisualErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode; context?: string },
  { hasError: boolean; errorMessage: string | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const context = this.props.context || 'unknown';
    console.error(`[VisualDisplayWidget] Rendering error in ${context}:`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface ChartTooltipPayload {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  value?: unknown;
}

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="agent-elements-visual-display-tooltip rounded-[var(--an-radius-sm)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-xs leading-[1.35] text-[var(--an-tool-color)]">
      {label !== undefined ? (
        <div className="font-medium text-[var(--an-tool-color)]">{label}</div>
      ) : null}
      <div className="mt-[var(--an-spacing-xxs)] flex flex-col gap-[var(--an-spacing-xxs)]">
        {payload.map((entry, index) => (
          <div
            className="flex items-center gap-[var(--an-spacing-xs)] text-[var(--an-tool-color-muted)]"
            key={`${entry.dataKey ?? entry.name ?? index}`}
          >
            <span
              className="agent-elements-visual-display-tooltip-swatch inline-block h-2 w-2 rounded-[var(--an-radius-xs)]"
              data-color-index={index % DEFAULT_CHART_COLORS.length}
            />
            <span>{entry.name ?? entry.dataKey}</span>
            <span className="font-medium text-[var(--an-tool-color)]">{String(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Render a bar chart
 */
function renderBarChart(config: ChartConfig, colors: string[]) {
  const yKeys = Array.isArray(config.yAxisKey) ? config.yAxisKey : [config.yAxisKey];

  // Determine which series to attach error bars to
  const errorBarDataKey = config.errorBars?.dataKey || yKeys[0];

  return (
    <BarChart data={config.data}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
      <XAxis dataKey={config.xAxisKey} stroke={CHART_AXIS_STROKE} tick={{ fontSize: 12 }} />
      <YAxis stroke={CHART_AXIS_STROKE} tick={{ fontSize: 12 }} />
      <Tooltip content={<ChartTooltipContent />} />
      {yKeys.length > 1 && <Legend />}
      {yKeys.map((key, index) => (
        <Bar key={key} dataKey={key} fill={colors[index % colors.length]} isAnimationActive={false}>
          {key === errorBarDataKey && renderErrorBar(config.errorBars)}
        </Bar>
      ))}
    </BarChart>
  );
}

/**
 * Render a line chart
 */
function renderLineChart(config: ChartConfig, colors: string[]) {
  const yKeys = Array.isArray(config.yAxisKey) ? config.yAxisKey : [config.yAxisKey];

  // Determine which series to attach error bars to
  const errorBarDataKey = config.errorBars?.dataKey || yKeys[0];

  return (
    <LineChart data={config.data}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
      <XAxis dataKey={config.xAxisKey} stroke={CHART_AXIS_STROKE} tick={{ fontSize: 12 }} />
      <YAxis stroke={CHART_AXIS_STROKE} tick={{ fontSize: 12 }} />
      <Tooltip content={<ChartTooltipContent />} />
      {yKeys.length > 1 && <Legend />}
      {yKeys.map((key, index) => (
        <Line
          key={key}
          type="monotone"
          dataKey={key}
          stroke={colors[index % colors.length]}
          strokeWidth={2}
          dot={{ fill: colors[index % colors.length], strokeWidth: 0, r: 3 }}
          isAnimationActive={false}
        >
          {key === errorBarDataKey && renderErrorBar(config.errorBars)}
        </Line>
      ))}
    </LineChart>
  );
}

/**
 * Render a pie chart
 */
function renderPieChart(config: ChartConfig, colors: string[]) {
  const yKey = Array.isArray(config.yAxisKey) ? config.yAxisKey[0] : config.yAxisKey;

  return (
    <PieChart>
      <Pie
        data={config.data}
        dataKey={yKey}
        nameKey={config.xAxisKey}
        cx="50%"
        cy="50%"
        outerRadius="70%"
        label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
        labelLine={{ stroke: CHART_AXIS_STROKE }}
        isAnimationActive={false}
      >
        {config.data.map((_, index) => (
          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
        ))}
      </Pie>
      <Tooltip content={<ChartTooltipContent />} />
    </PieChart>
  );
}

/**
 * Render an area chart
 */
function renderAreaChart(config: ChartConfig, colors: string[]) {
  const yKeys = Array.isArray(config.yAxisKey) ? config.yAxisKey : [config.yAxisKey];

  // Determine which series to attach error bars to
  const errorBarDataKey = config.errorBars?.dataKey || yKeys[0];

  return (
    <AreaChart data={config.data}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
      <XAxis dataKey={config.xAxisKey} stroke={CHART_AXIS_STROKE} tick={{ fontSize: 12 }} />
      <YAxis stroke={CHART_AXIS_STROKE} tick={{ fontSize: 12 }} />
      <Tooltip content={<ChartTooltipContent />} />
      {yKeys.length > 1 && <Legend />}
      {yKeys.map((key, index) => (
        <Area
          key={key}
          type="monotone"
          dataKey={key}
          stroke={colors[index % colors.length]}
          fill={colors[index % colors.length]}
          fillOpacity={0.3}
          isAnimationActive={false}
        >
          {key === errorBarDataKey && renderErrorBar(config.errorBars)}
        </Area>
      ))}
    </AreaChart>
  );
}

/**
 * Render a scatter chart
 */
function renderScatterChart(config: ChartConfig, colors: string[]) {
  const yKey = Array.isArray(config.yAxisKey) ? config.yAxisKey[0] : config.yAxisKey;

  return (
    <ScatterChart>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
      <XAxis dataKey={config.xAxisKey} stroke={CHART_AXIS_STROKE} tick={{ fontSize: 12 }} name={config.xAxisKey} />
      <YAxis dataKey={yKey} stroke={CHART_AXIS_STROKE} tick={{ fontSize: 12 }} name={yKey} />
      <Tooltip content={<ChartTooltipContent />} cursor={{ strokeDasharray: '3 3' }} />
      <Scatter data={config.data} fill={colors[0]} isAnimationActive={false}>
        {config.data.map((_, index) => (
          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
        ))}
        {renderErrorBar(config.errorBars)}
      </Scatter>
    </ScatterChart>
  );
}

/**
 * Component for displaying a single image with loading state
 */
/**
 * Render a chart item
 */
const ChartItemRenderer: React.FC<{
  item: DisplayItem;
}> = ({ item }) => {
  if (!item.chart) return null;

  const chartConfig: ChartConfig = {
    chartType: item.chart.chartType,
    data: item.chart.data,
    xAxisKey: item.chart.xAxisKey,
    yAxisKey: item.chart.yAxisKey,
    colors: item.chart.colors,
    errorBars: item.chart.errorBars
  };

  const colors = chartConfig.colors?.length ? chartConfig.colors : DEFAULT_CHART_COLORS;

  const renderChart = () => {
    switch (chartConfig.chartType) {
      case 'bar':
        return renderBarChart(chartConfig, colors);
      case 'line':
        return renderLineChart(chartConfig, colors);
      case 'pie':
        return renderPieChart(chartConfig, colors);
      case 'area':
        return renderAreaChart(chartConfig, colors);
      case 'scatter':
        return renderScatterChart(chartConfig, colors);
      default:
        return null;
    }
  };

  const errorFallback = (
    <div
      className="agent-elements-visual-display-chart-error rounded-[var(--an-spacing-xs)] border border-[color-mix(in_srgb,var(--an-diff-removed-text)_30%,transparent)] bg-[var(--an-diff-removed-bg)] p-[var(--an-spacing-sm)]"
      data-testid="agent-elements-visual-display-chart-error"
    >
      <p className="mb-[var(--an-spacing-xs)] text-sm text-[var(--an-tool-color-muted)]">{item.description}</p>
      <p className="text-sm text-[var(--an-diff-removed-text)]">
        Failed to render {chartConfig.chartType} chart. Check that data contains valid "{chartConfig.xAxisKey}" and "{Array.isArray(chartConfig.yAxisKey) ? chartConfig.yAxisKey.join(', ') : chartConfig.yAxisKey}" fields.
      </p>
    </div>
  );

  return (
    <VisualErrorBoundary fallback={errorFallback} context={`${chartConfig.chartType} chart`}>
      <div
        className="agent-elements-visual-display-chart overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-sm)]"
        data-chart-type={chartConfig.chartType}
        data-testid="agent-elements-visual-display-chart"
        role="img"
        aria-label={`${chartConfig.chartType} chart: ${item.description}`}
      >
        <p className="mb-[var(--an-spacing-sm)] text-sm font-medium text-[var(--an-tool-color)]">{item.description}</p>
        <div className="agent-elements-visual-display-chart-frame h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </div>
    </VisualErrorBoundary>
  );
};

/**
 * Lightbox component that renders full-screen over the entire app
 */
const Lightbox: React.FC<{
  images: DisplayItem[];
  selectedIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  readFile?: VisualDisplayReadFile;
}> = ({ images, selectedIndex, onClose, onNavigate, readFile }) => {
  return (
    <FullscreenModal
      isOpen={true}
      onClose={onClose}
      ariaLabel="Image lightbox"
      contentClassName="agent-elements-visual-display-lightbox max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] p-[var(--an-spacing-md)]"
    >
      <button
        className="agent-elements-visual-display-lightbox-close absolute right-[var(--an-spacing-sm)] top-[var(--an-spacing-sm)] z-10 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-radius-sm)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] p-0 text-[var(--an-tool-color-muted)] transition-colors duration-200 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-tool-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline,var(--an-tool-border-color))]"
        data-testid="agent-elements-visual-display-lightbox-close"
        onClick={onClose}
        aria-label="Close image lightbox"
        type="button"
      >
        <span aria-hidden="true">
          <MaterialSymbol icon="close" size={18} />
        </span>
      </button>
      <div
        className="agent-elements-visual-display-lightbox-image max-h-[calc(90vh-5rem)] max-w-full overflow-hidden rounded-[var(--an-tool-border-radius)]"
        data-agent-elements-shell="visual-display-lightbox"
        data-testid="agent-elements-visual-display-lightbox"
      >
        <ImageDisplay
          image={images[selectedIndex].image!}
          description={images[selectedIndex].description}
          readFile={readFile}
        />
      </div>
      <div
        className="agent-elements-visual-display-lightbox-caption max-w-full rounded-[var(--an-spacing-xs)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-center font-mono text-sm text-[var(--an-tool-color-muted)]"
        data-testid="agent-elements-visual-display-lightbox-caption"
      >
        {images[selectedIndex].description}
      </div>
      {images.length > 1 && (
        <div className="agent-elements-visual-display-lightbox-controls flex items-center gap-[var(--an-spacing-sm)]">
          <button
            className="agent-elements-visual-display-lightbox-prev inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-radius-sm)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] p-0 text-[var(--an-tool-color-muted)] transition-colors duration-200 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-tool-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline,var(--an-tool-border-color))]"
            data-testid="agent-elements-visual-display-lightbox-prev"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((selectedIndex - 1 + images.length) % images.length);
            }}
            aria-label="Previous image"
            type="button"
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="arrow_back" size={18} />
            </span>
          </button>
          <span
            className="agent-elements-visual-display-lightbox-count min-w-12 text-center font-mono text-sm text-[var(--an-tool-color-muted)]"
            data-testid="agent-elements-visual-display-lightbox-count"
          >
            {selectedIndex + 1} / {images.length}
          </span>
          <button
            className="agent-elements-visual-display-lightbox-next inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--an-radius-sm)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] p-0 text-[var(--an-tool-color-muted)] transition-colors duration-200 hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-tool-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline,var(--an-tool-border-color))]"
            data-testid="agent-elements-visual-display-lightbox-next"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((selectedIndex + 1) % images.length);
            }}
            aria-label="Next image"
            type="button"
          >
            <span aria-hidden="true">
              <MaterialSymbol icon="arrow_forward" size={18} />
            </span>
          </button>
        </div>
      )}
    </FullscreenModal>
  );
};

/**
 * Render an image gallery with lightbox support
 */
const ImageGallery: React.FC<{
  images: DisplayItem[];
  readFile?: VisualDisplayReadFile;
}> = ({ images, readFile }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const imagePaths = images.map(img => img.image?.path).filter(Boolean);
  const errorFallback = (
    <div
      className="agent-elements-visual-display-gallery-error rounded-[var(--an-spacing-xs)] border border-[color-mix(in_srgb,var(--an-diff-removed-text)_30%,transparent)] bg-[var(--an-diff-removed-bg)] p-[var(--an-spacing-sm)]"
      data-testid="agent-elements-visual-display-gallery-error"
    >
      <p className="text-sm text-[var(--an-diff-removed-text)]">
        Failed to render image gallery ({images.length} image{images.length !== 1 ? 's' : ''}).
        {imagePaths.length > 0 && (
          <span className="mt-[var(--an-spacing-xxs)] block text-xs text-[var(--an-tool-color-muted)]">
            Paths: {imagePaths.slice(0, 3).join(', ')}{imagePaths.length > 3 ? `, ...and ${imagePaths.length - 3} more` : ''}
          </span>
        )}
      </p>
    </div>
  );

  const isSingleImage = images.length === 1;

  return (
    <VisualErrorBoundary fallback={errorFallback} context="image gallery">
      <div
        className="agent-elements-visual-display-gallery overflow-hidden rounded-[var(--an-tool-border-radius)]"
        data-image-count={images.length}
        data-testid="agent-elements-visual-display-gallery"
      >
        <div className={`grid gap-[var(--an-spacing-sm)] ${isSingleImage ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]'}`}>
          {images.map((item, index) => (
            <button
              key={index}
              className={classNames(
                'agent-elements-visual-display-image-card group cursor-pointer overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-secondary)] p-0 text-left transition-colors duration-200 hover:border-[var(--an-primary-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline,var(--an-tool-border-color))]',
                isSingleImage ? 'max-w-full' : 'aspect-square',
              )}
              data-testid={`agent-elements-visual-display-image-card-${index}`}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              <div className={`${isSingleImage ? 'max-h-96' : 'w-full h-full'} overflow-hidden`}>
                <ImageDisplay image={item.image!} description={item.description} readFile={readFile} />
              </div>
              <div className="agent-elements-visual-display-image-caption truncate bg-[var(--an-background-secondary)] p-[var(--an-spacing-xs)] text-xs text-[var(--an-tool-color-muted)]">{item.description}</div>
            </button>
          ))}
        </div>
        {selectedIndex !== null && (
          <Lightbox
            images={images}
            selectedIndex={selectedIndex}
            onClose={() => setSelectedIndex(null)}
            onNavigate={setSelectedIndex}
            readFile={readFile}
          />
        )}
      </div>
    </VisualErrorBoundary>
  );
};

/**
 * Group items into segments: consecutive images are grouped together, charts are individual
 */
type ItemSegment =
  | { type: 'chart'; item: DisplayItem }
  | { type: 'images'; items: DisplayItem[] };

function groupItemsIntoSegments(items: DisplayItem[]): ItemSegment[] {
  const segments: ItemSegment[] = [];
  let currentImageGroup: DisplayItem[] = [];

  for (const item of items) {
    // Defensive check: ensure image items have valid path
    if (item.image && item.image.path) {
      currentImageGroup.push(item);
    } else if (item.chart) {
      // Flush any pending image group
      if (currentImageGroup.length > 0) {
        segments.push({ type: 'images', items: currentImageGroup });
        currentImageGroup = [];
      }
      // Add chart as individual segment
      segments.push({ type: 'chart', item });
    }
  }

  // Flush remaining images
  if (currentImageGroup.length > 0) {
    segments.push({ type: 'images', items: currentImageGroup });
  }

  return segments;
}

export const VisualDisplayWidget: React.FC<CustomToolWidgetProps> = ({ message, readFile }) => {
  const tool = message.toolCall;

  if (!tool) {
    console.warn('[VisualDisplayWidget] No tool call in message');
    return null;
  }

  const items = extractDisplayItems(tool);

  // Only show full-widget error if we truly can't extract items
  // (server validation error). Don't let hasError flag override successful item extraction.
  if (!items) {
    const hasError = isToolError(tool.result, message);

    // Extract detailed error message from server response
    const serverErrorMessage = extractErrorMessage(tool.result);

    // Try to extract path information from tool arguments for better error context
    const args = tool.arguments as unknown as DisplayArgs | undefined;
    const pathInfo = Array.isArray(args?.items)
      ? args.items.map((item, i) => item.image?.path ? `items[${i}].image.path: "${item.image.path}"` : null)
        .filter(Boolean)
        .join(', ')
      : null;

    // Determine the appropriate error message to display
    let displayErrorMessage: string;
    if (serverErrorMessage) {
      // Server provided an error message - use it directly
      displayErrorMessage = serverErrorMessage;
    } else if (hasError) {
      // Server indicated error but no message extracted - show what we can
      displayErrorMessage = 'Server rejected the request';
      if (pathInfo) {
        displayErrorMessage += `\n\nProvided paths: ${pathInfo}`;
      }
      // Also include raw result for debugging
      if (tool.result) {
        try {
          const resultStr = typeof tool.result === 'string'
            ? tool.result
            : JSON.stringify(tool.result);
          if (resultStr && resultStr !== '{}' && resultStr !== 'null') {
            displayErrorMessage += `\n\nRaw result: ${resultStr.substring(0, 500)}`;
          }
        } catch {
          // Ignore stringify errors
        }
      }
    } else {
      // No server error but couldn't parse items
      displayErrorMessage = 'Invalid visual configuration: items array is missing or malformed';
      if (pathInfo) {
        displayErrorMessage += `\n\nProvided paths: ${pathInfo}`;
      }
    }

    // Log for debugging - use console.log for expected server-side validation rejections,
    // console.error only for unexpected failures (no items and no server error)
    const isExpectedValidationError = hasError && serverErrorMessage;
    if (isExpectedValidationError) {
      console.log('[VisualDisplayWidget] Server rejected request:', {
        serverErrorMessage,
        toolName: tool.toolName
      });
    } else {
      console.error('[VisualDisplayWidget] Unexpected display failure:', {
        hasError,
        hasItems: !!items,
        serverErrorMessage,
        toolName: tool.toolName,
        toolResult: tool.result,
        toolArguments: tool.arguments
      });
    }

    return (
      <AgentToolCard
        className="visual-display-widget agent-elements-visual-display-card"
        data-agent-elements-shell="visual-display-error-card"
        data-component="RichTranscriptAgentElementsVisualDisplay"
        data-testid="agent-elements-visual-display-card"
        icon={<MaterialSymbol icon="insert_chart" size={16} />}
        status="error"
        title="Visual Display"
        trailing={(
          <AgentStatusPill tone="error">
            <span data-testid="agent-elements-visual-display-status">Error</span>
          </AgentStatusPill>
        )}
      >
        <div
          className="agent-elements-visual-display-error whitespace-pre-wrap rounded-[var(--an-spacing-xs)] border border-[color-mix(in_srgb,var(--an-diff-removed-text)_30%,transparent)] bg-[var(--an-diff-removed-bg)] p-[var(--an-spacing-sm)] text-sm text-[var(--an-diff-removed-text)] select-text"
          data-testid="agent-elements-visual-display-error"
          role="img"
          aria-label="Visual content error"
        >
          {displayErrorMessage}
        </div>
      </AgentToolCard>
    );
  }

  // If we have items, render them regardless of error flags
  // Individual images will handle their own errors gracefully

  const segments = groupItemsIntoSegments(items);

  // Summarize content for error message
  const chartCount = items.filter(i => i.chart).length;
  const imageCount = items.filter(i => i.image).length;
  const contentSummary = [
    chartCount > 0 ? `${chartCount} chart${chartCount !== 1 ? 's' : ''}` : null,
    imageCount > 0 ? `${imageCount} image${imageCount !== 1 ? 's' : ''}` : null
  ].filter(Boolean).join(' and ');

  const errorFallback = (
    <AgentToolCard
      className="visual-display-widget agent-elements-visual-display-card"
      data-agent-elements-shell="visual-display-error-card"
      data-component="RichTranscriptAgentElementsVisualDisplay"
      data-testid="agent-elements-visual-display-card"
      icon={<MaterialSymbol icon="insert_chart" size={16} />}
      status="error"
      title="Visual Display"
      trailing={(
        <AgentStatusPill tone="error">
          <span data-testid="agent-elements-visual-display-status">Error</span>
        </AgentStatusPill>
      )}
    >
      <div
        className="agent-elements-visual-display-error rounded-[var(--an-spacing-xs)] border border-[color-mix(in_srgb,var(--an-diff-removed-text)_30%,transparent)] bg-[var(--an-diff-removed-bg)] p-[var(--an-spacing-sm)] text-sm text-[var(--an-diff-removed-text)] select-text"
        data-testid="agent-elements-visual-display-error"
      >
        Failed to render visual content ({contentSummary || 'unknown content'}).
      </div>
    </AgentToolCard>
  );

  return (
    <VisualErrorBoundary fallback={errorFallback} context="main widget">
      <AgentToolCard
        className="visual-display-widget agent-elements-visual-display-card"
        data-agent-elements-shell="visual-display-card"
        data-component="RichTranscriptAgentElementsVisualDisplay"
        data-testid="agent-elements-visual-display-card"
        icon={<MaterialSymbol icon={chartCount > 0 ? 'insert_chart' : 'image'} size={16} />}
        status={tool.status === 'running' ? 'running' : 'completed'}
        subtitle={contentSummary || `${items.length} visual item${items.length === 1 ? '' : 's'}`}
        title="Visual Display"
        trailing={(
          <AgentStatusPill tone={tool.status === 'running' ? 'running' : 'success'}>
            <span data-testid="agent-elements-visual-display-status">
              {tool.status === 'running' ? 'Rendering' : 'Rendered'}
            </span>
          </AgentStatusPill>
        )}
        role="img"
        aria-label={`${items.length} visual item(s)`}
      >
      <div className="agent-elements-visual-display-body flex flex-col gap-[var(--an-spacing-sm)]" data-testid="agent-elements-visual-display-body">
        {segments.map((segment, index) => {
          if (segment.type === 'chart') {
            return (
              <ChartItemRenderer
                key={index}
                item={segment.item}
              />
            );
          } else {
            return (
              <ImageGallery
                key={index}
                images={segment.items}
                readFile={readFile}
              />
            );
          }
        })}
      </div>
      </AgentToolCard>
    </VisualErrorBoundary>
  );
};
