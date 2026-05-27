/**
 * ImageViewer - Simple image display component for standalone image files
 *
 * Displays image files (PNG, JPG, GIF, SVG, etc.) in the editor area.
 * Does not use Lexical - this is for viewing image files directly.
 */

import React, { useEffect, useState } from 'react';
import { nimAssetUrl } from '../utils/assetUrl';

interface ImageViewerProps {
  filePath: string;
  fileName: string;
}

const fallbackCardClassName =
  'agent-elements-tool-card flex max-w-[360px] flex-col items-center gap-[var(--an-spacing-md)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-center [--agent-elements-card-block-padding:var(--an-spacing-xl)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)]';

const loadingCardClassName =
  'agent-elements-tool-card flex items-center gap-[var(--an-spacing-md)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] [--agent-elements-card-block-padding:var(--an-spacing-lg)] [--agent-elements-card-inline-padding:var(--an-spacing-xl)]';

export const ImageViewer: React.FC<ImageViewerProps> = ({ filePath, fileName }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const loadImage = async () => {
      try {
        // Issue 146: route through `nim-asset://` so the renderer stays
        // same-origin (lets `webSecurity: true` stay on the main window).
        // The main-process handler validates the path against allowlisted
        // workspace + userData roots.
        const absolute = filePath.startsWith('file://')
          ? filePath.replace(/^file:\/\//, '')
          : filePath;
        setImageSrc(nimAssetUrl(absolute));
        setError(null);
      } catch (err) {
        setError('Failed to load image');
        console.error('Error loading image:', err);
      }
    };

    loadImage();
  }, [filePath]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  const handleImageError = () => {
    setError('Failed to load image');
  };

  if (error) {
    return (
      <div
        className="image-viewer-error agent-elements-image-viewer-error flex h-full w-full items-center justify-center bg-[var(--an-background)] p-[var(--an-spacing-xl)] text-[var(--an-foreground)]"
        data-testid="agent-elements-image-viewer-error"
        data-component="ImageViewer"
        data-agent-elements-shell="image-viewer-error"
        role="alert"
      >
        <div
          className={fallbackCardClassName}
          data-agent-elements-card-padding="symmetric-inline"
          data-agent-elements-card-width="bounded-fallback"
          data-testid="agent-elements-image-viewer-error-card"
        >
          <span
            className="material-symbols-outlined inline-flex h-9 w-9 items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[19px] text-[var(--an-foreground-muted)]"
            aria-hidden="true"
          >
            image_not_supported
          </span>
          <div className="text-sm font-medium leading-snug text-[var(--an-foreground)]">{error}</div>
          <div className="select-text break-all text-xs leading-relaxed text-[var(--an-foreground-muted)]">
            {fileName}
          </div>
        </div>
      </div>
    );
  }

  if (!imageSrc) {
    return (
      <div
        className="image-viewer-loading agent-elements-image-viewer-loading flex h-full w-full items-center justify-center bg-[var(--an-background)] p-[var(--an-spacing-xl)] text-[var(--an-foreground-muted)]"
        data-testid="agent-elements-image-viewer-loading"
        data-component="ImageViewer"
        data-agent-elements-shell="image-viewer-loading"
        aria-live="polite"
      >
        <div
          className={loadingCardClassName}
          data-agent-elements-card-padding="symmetric-inline"
          data-agent-elements-card-width="bounded-fallback"
          data-testid="agent-elements-image-viewer-loading-card"
        >
          <span
            className="material-symbols-outlined text-[18px] text-[var(--an-foreground-muted)]"
            aria-hidden="true"
          >
            image
          </span>
          <span className="text-sm leading-snug">Loading image</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="image-viewer agent-elements-image-viewer flex h-full w-full flex-col overflow-hidden bg-[var(--an-background)] text-[var(--an-foreground)]"
      data-testid="agent-elements-image-viewer"
      data-component="ImageViewer"
      data-agent-elements-shell="image-viewer"
    >
      {dimensions && (
        <div
          className="image-viewer-info agent-elements-image-viewer-info flex items-center gap-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xl)] py-[var(--an-spacing-md)] text-xs leading-snug text-[var(--an-foreground-muted)]"
          data-testid="agent-elements-image-viewer-info"
          data-agent-elements-shell="image-viewer-info"
        >
          <span className="select-text min-w-0 truncate" title={fileName}>
            {fileName}
          </span>
          <span>
            {dimensions.width} x {dimensions.height}
          </span>
        </div>
      )}

      <div
        className="image-viewer-canvas agent-elements-image-viewer-canvas flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[var(--an-background)] p-[var(--an-spacing-xl)]"
        data-testid="agent-elements-image-viewer-canvas"
        data-agent-elements-shell="image-viewer-canvas"
      >
        <img
          src={imageSrc}
          alt={fileName}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className="image-viewer-image agent-elements-image-viewer-image max-h-full max-w-full object-contain"
        />
      </div>
    </div>
  );
};
