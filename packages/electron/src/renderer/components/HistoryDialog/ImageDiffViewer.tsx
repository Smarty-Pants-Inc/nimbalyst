import React, { useId, useState } from 'react';
import { nimAssetUrl } from '../../utils/assetUrl';

interface ImageDiffViewerProps {
  oldImagePath: string;
  newImagePath: string;
  filePath: string;
}

type ViewMode = 'side-by-side' | 'swipe' | 'onion-skin';

const rootClass =
  'image-diff-viewer agent-elements-image-diff-viewer flex h-full w-full flex-col overflow-hidden bg-[var(--an-background)] text-[var(--an-foreground)] @container/image-diff-viewer';
const controlsClass =
  'image-diff-controls agent-elements-image-diff-controls flex min-h-12 items-center gap-[var(--an-spacing-lg)] border-b border-[var(--an-border-color)] bg-[var(--an-background-secondary)] px-[var(--an-spacing-xxl)] py-[var(--an-spacing-sm)]';
const modeToggleClass =
  'image-diff-mode-toggle agent-elements-image-diff-mode-toggle flex gap-[var(--an-spacing-xxs)] rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] p-[var(--an-spacing-xxs)]';
const modeButtonBaseClass =
  'image-diff-mode-button cursor-pointer rounded-[calc(var(--an-input-border-radius)_-_4px)] border border-transparent px-3 py-1.5 text-[13px] font-medium transition-[background-color,border-color,color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-1';
const modeButtonActiveClass =
  'active border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-send-button-color)]';
const modeButtonIdleClass =
  'bg-transparent text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]';
const sliderContainerClass =
  'image-diff-slider-container ml-auto flex items-center gap-[var(--an-spacing-sm)] rounded-[var(--an-small-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)]';
const sliderLabelClass = 'text-[13px] font-medium text-[var(--an-foreground-muted)]';
const sliderClass =
  'image-diff-slider agent-elements-image-diff-slider h-4 w-[150px] cursor-pointer accent-[var(--an-primary-color)] focus-visible:outline-2 focus-visible:outline-[var(--an-focus-ring)] focus-visible:outline-offset-2';
const contentClass = 'image-diff-content nim-scrollbar flex flex-1 items-center justify-center overflow-auto bg-[var(--an-background)]';
const sideBySideClass =
  'image-diff-side-by-side agent-elements-image-diff-side-by-side flex h-full w-full gap-[var(--an-spacing-xxl)] p-[var(--an-spacing-xxl)] @max-[680px]/image-diff-viewer:flex-col';
const panelClass = 'image-diff-panel flex min-w-0 flex-1 flex-col gap-[var(--an-spacing-sm)]';
const labelClass = 'image-diff-label text-center text-[13px] font-medium text-[var(--an-foreground-muted)]';
const imageContainerClass =
  'image-diff-container nim-scrollbar flex flex-1 items-center justify-center overflow-auto rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xl)] [&_img]:block [&_img]:max-h-full [&_img]:max-w-full [&_img]:object-contain';
const stageClass =
  'w-full h-full flex items-center justify-center p-[var(--an-spacing-xxl)] bg-[var(--an-background)]';
const stageContainerClass =
  'relative inline-block max-h-full max-w-full rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-md)]';
const stageImageClass = 'block max-h-[calc(100vh-300px)] max-w-full object-contain';
const swipeDividerClass =
  "image-diff-swipe-divider agent-elements-image-diff-swipe-divider absolute bottom-0 top-0 z-10 w-0.5 cursor-ew-resize bg-[var(--an-primary-color)] before:absolute before:left-1/2 before:top-1/2 before:h-8 before:w-8 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:border-[color-mix(in_srgb,var(--an-primary-color)_35%,var(--an-border-color))] before:bg-[var(--an-primary-color)] before:shadow-[0_2px_8px_color-mix(in_srgb,var(--an-foreground)_18%,transparent)] before:content-['']";

function getModeButtonClass(mode: ViewMode, currentMode: ViewMode): string {
  return `${modeButtonBaseClass} ${mode === currentMode ? modeButtonActiveClass : modeButtonIdleClass}`;
}

export function ImageDiffViewer({
  oldImagePath,
  newImagePath,
  filePath
}: ImageDiffViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [swipePosition, setSwipePosition] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const positionSliderId = useId();
  const opacitySliderId = useId();

  return (
    <div
      className={rootClass}
      data-testid="agent-elements-image-diff-viewer"
      data-agent-elements-shell="image-diff-viewer"
      data-component="ImageDiffViewer"
      data-file-path={filePath}
      data-view-mode={viewMode}
    >
      <div
        className={controlsClass}
        data-testid="agent-elements-image-diff-controls"
        data-agent-elements-shell="image-diff-controls"
      >
        <div
          className={modeToggleClass}
          data-testid="agent-elements-image-diff-mode-toggle"
          data-agent-elements-shell="image-diff-mode-toggle"
          role="group"
          aria-label="Image diff view mode"
        >
          <button
            className={getModeButtonClass('side-by-side', viewMode)}
            onClick={() => setViewMode('side-by-side')}
            type="button"
            data-active={viewMode === 'side-by-side'}
          >
            Side by Side
          </button>
          <button
            className={getModeButtonClass('swipe', viewMode)}
            onClick={() => setViewMode('swipe')}
            type="button"
            data-active={viewMode === 'swipe'}
          >
            Swipe
          </button>
          <button
            className={getModeButtonClass('onion-skin', viewMode)}
            onClick={() => setViewMode('onion-skin')}
            type="button"
            data-active={viewMode === 'onion-skin'}
          >
            Overlay
          </button>
        </div>

        {viewMode === 'swipe' && (
          <div
            className={sliderContainerClass}
            data-agent-elements-shell="image-diff-position-control"
          >
            <label className={sliderLabelClass} htmlFor={positionSliderId}>Position</label>
            <input
              id={positionSliderId}
              type="range"
              min="0"
              max="100"
              value={swipePosition}
              onChange={(e) => setSwipePosition(Number(e.target.value))}
              className={sliderClass}
            />
          </div>
        )}

        {viewMode === 'onion-skin' && (
          <div
            className={sliderContainerClass}
            data-agent-elements-shell="image-diff-opacity-control"
          >
            <label className={sliderLabelClass} htmlFor={opacitySliderId}>Opacity</label>
            <input
              id={opacitySliderId}
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className={sliderClass}
            />
          </div>
        )}
      </div>

      <div className={contentClass}>
        {viewMode === 'side-by-side' && (
          <div
            className={sideBySideClass}
            data-testid="agent-elements-image-diff-side-by-side"
            data-agent-elements-shell="image-diff-side-by-side"
          >
            <div
              className={panelClass}
              data-testid="agent-elements-image-diff-panel-old"
              data-agent-elements-shell="image-diff-panel-old"
            >
              <div className={labelClass}>Old Version</div>
              <div className={imageContainerClass}>
                <img src={nimAssetUrl(oldImagePath)} alt="Old version" />
              </div>
            </div>
            <div
              className={panelClass}
              data-testid="agent-elements-image-diff-panel-new"
              data-agent-elements-shell="image-diff-panel-new"
            >
              <div className={labelClass}>New Version</div>
              <div className={imageContainerClass}>
                <img src={nimAssetUrl(newImagePath)} alt="New version" />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'swipe' && (
          <div
            className={`image-diff-swipe agent-elements-image-diff-swipe ${stageClass}`}
            data-testid="agent-elements-image-diff-swipe"
            data-agent-elements-shell="image-diff-swipe"
          >
            <div className={`image-diff-swipe-container ${stageContainerClass}`}>
              <img
                src={nimAssetUrl(newImagePath)}
                alt="New version"
                className={`image-diff-swipe-new ${stageImageClass}`}
              />
              <div
                className="image-diff-swipe-old-wrapper absolute left-[var(--an-spacing-md)] top-[var(--an-spacing-md)] h-[calc(100%_-_calc(var(--an-spacing-md)_*_2))] w-[calc(100%_-_calc(var(--an-spacing-md)_*_2))] overflow-hidden"
                data-testid="agent-elements-image-diff-swipe-old-wrapper"
                data-agent-elements-shell="image-diff-swipe-old-wrapper"
                style={{ clipPath: `inset(0 ${100 - swipePosition}% 0 0)` }}
              >
                <img
                  src={nimAssetUrl(oldImagePath)}
                  alt="Old version"
                  className={`image-diff-swipe-old ${stageImageClass}`}
                />
              </div>
              <div
                className={swipeDividerClass}
                data-testid="agent-elements-image-diff-swipe-divider"
                data-agent-elements-shell="image-diff-swipe-divider"
                style={{ left: `${swipePosition}%` }}
              />
            </div>
          </div>
        )}

        {viewMode === 'onion-skin' && (
          <div
            className={`image-diff-overlay agent-elements-image-diff-overlay ${stageClass}`}
            data-testid="agent-elements-image-diff-overlay"
            data-agent-elements-shell="image-diff-overlay"
          >
            <div className={`image-diff-overlay-container ${stageContainerClass}`}>
              <img
                src={nimAssetUrl(newImagePath)}
                alt="New version"
                className={`image-diff-overlay-new ${stageImageClass}`}
              />
              <img
                src={nimAssetUrl(oldImagePath)}
                alt="Old version"
                className={`image-diff-overlay-old absolute left-[var(--an-spacing-md)] top-[var(--an-spacing-md)] block mix-blend-difference ${stageImageClass}`}
                data-testid="agent-elements-image-diff-overlay-old"
                data-agent-elements-shell="image-diff-overlay-old"
                style={{ opacity: opacity / 100 }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
