import React, { useEffect, useState } from 'react';
import { localAssetUrl } from '../../../../utils/localAssetUrl';
import { MaterialSymbol } from '../../../icons/MaterialSymbol';
import { GifPlayer } from './GifPlayer';

export interface ImageContent {
  path: string;
}

export type VisualDisplayReadFile = (
  path: string,
) => Promise<{ success: boolean; content?: string; error?: string }>;

export const ImageDisplay: React.FC<{
  image: ImageContent;
  description?: string;
  readFile?: VisualDisplayReadFile;
}> = ({ image, description, readFile }) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadImage = async () => {
      try {
        if (readFile) {
          const result = await readFile(image.path);
          if (result.success && result.content) {
            if (result.content.startsWith('data:')) {
              setImageData(result.content);
            } else {
              const ext = image.path.split('.').pop()?.toLowerCase();
              const mimeTypes: Record<string, string> = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'svg': 'image/svg+xml',
                'bmp': 'image/bmp',
              };
              const mimeType = mimeTypes[ext || ''] || 'image/png';
              setImageData(`data:${mimeType};base64,${result.content}`);
            }
            setLoading(false);
            return;
          } else if (result.error) {
            console.error('[VisualDisplayWidget] Failed to read image file:', {
              path: image.path,
              error: result.error,
            });
            setError(`Failed to load image: ${result.error}`);
            setLoading(false);
            return;
          }
        }

        // Electron renderer runs with webSecurity enabled, so use the app asset
        // scheme instead of direct file:// paths when available.
        setImageData(localAssetUrl(image.path));
        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[VisualDisplayWidget] Image load exception:', {
          path: image.path,
          error: errorMessage,
        });
        setError(`Failed to load image: ${errorMessage}`);
        setLoading(false);
      }
    };

    loadImage();
  }, [image.path, readFile]);

  if (loading) {
    return (
      <div
        className="agent-elements-visual-display-image-loading flex items-center justify-center gap-[var(--an-spacing-xs)] rounded-[var(--an-spacing-xs)] border border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)] p-[var(--an-spacing-md)] text-sm text-[var(--an-tool-color-muted)]"
        data-testid="agent-elements-visual-display-image-loading"
      >
        <span aria-hidden="true">
          <MaterialSymbol icon="hourglass_empty" size={16} />
        </span>
        <span>Loading image</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="agent-elements-visual-display-image-error flex flex-col gap-[var(--an-spacing-xs)] rounded-[var(--an-spacing-xs)] border border-[color-mix(in_srgb,var(--an-diff-removed-text)_30%,transparent)] bg-[var(--an-diff-removed-bg)] p-[var(--an-spacing-md)] text-sm text-[var(--an-diff-removed-text)]"
        data-testid="agent-elements-visual-display-image-error"
      >
        <span>{error}</span>
        <span className="break-all font-mono text-xs text-[var(--an-tool-color-muted)] select-text">{image.path}</span>
      </div>
    );
  }

  const isGif = image.path.toLowerCase().endsWith('.gif');

  return (
    <div className="agent-elements-visual-display-image-shell overflow-hidden rounded-[var(--an-spacing-xs)]">
      {isGif && imageData ? (
        <GifPlayer
          src={imageData}
          alt={description || 'Animated GIF'}
          className="max-w-full"
        />
      ) : (
        <img
          src={imageData || ''}
          alt={description || 'Image'}
          className="agent-elements-visual-display-image block h-auto max-w-full"
          onError={() => {
            console.error('[VisualDisplayWidget] Image element failed to load:', {
              path: image.path,
              src: imageData?.substring(0, 100) + (imageData && imageData.length > 100 ? '...' : ''),
            });
            setError(`Failed to render image from: ${image.path}`);
          }}
        />
      )}
    </div>
  );
};
