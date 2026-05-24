// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImageViewer } from '../ImageViewer';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../ImageViewer.tsx');

describe('ImageViewer Agent Elements shell', () => {
  it('renders standalone image files in an Agent Elements editor shell while preserving asset URL and dimensions', async () => {
    render(
      <ImageViewer
        filePath="file:///workspace/assets/mockup image.png"
        fileName="mockup image.png"
      />,
    );

    const shell = await screen.findByTestId('agent-elements-image-viewer');
    expect(shell).toHaveClass('image-viewer', 'agent-elements-image-viewer');
    expect(shell).toHaveAttribute('data-component', 'ImageViewer');
    expect(shell).toHaveAttribute('data-agent-elements-shell', 'image-viewer');

    const canvas = screen.getByTestId('agent-elements-image-viewer-canvas');
    expect(canvas).toHaveAttribute('data-agent-elements-shell', 'image-viewer-canvas');

    const image = screen.getByRole('img', { name: 'mockup image.png' }) as HTMLImageElement;
    expect(image).toHaveClass('image-viewer-image', 'agent-elements-image-viewer-image');
    expect(image.src).toContain('nim-asset://local/');
    expect(image.src).not.toContain('file:///workspace');

    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 1440 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 900 });
    fireEvent.load(image);

    const infoBar = screen.getByTestId('agent-elements-image-viewer-info');
    expect(infoBar).toHaveAttribute('data-agent-elements-shell', 'image-viewer-info');
    expect(infoBar).toHaveTextContent('mockup image.png');
    expect(infoBar).toHaveTextContent('1440 x 900');
  });

  it('renders loading and error states with Agent Elements-compatible chrome', async () => {
    const { rerender } = render(<ImageViewer filePath="" fileName="broken.png" />);

    const loading = screen.getByTestId('agent-elements-image-viewer-loading');
    expect(loading).toHaveAttribute('data-agent-elements-shell', 'image-viewer-loading');
    expect(loading).toHaveTextContent('Loading image');

    rerender(<ImageViewer filePath="/workspace/assets/broken.png" fileName="broken.png" />);
    const image = await screen.findByRole('img', { name: 'broken.png' });
    fireEvent.error(image);

    const error = screen.getByTestId('agent-elements-image-viewer-error');
    expect(error).toHaveClass('image-viewer-error', 'agent-elements-image-viewer-error');
    expect(error).toHaveAttribute('data-agent-elements-shell', 'image-viewer-error');
    expect(error).toHaveTextContent('Failed to load image');
    expect(error).toHaveTextContent('broken.png');
  });

  it('keeps the source constrained to Agent Elements-compatible image viewer styling', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-image-viewer');
    expect(source).toContain('data-agent-elements-shell="image-viewer"');
    expect(source).toContain('nimAssetUrl');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(source).not.toMatch(/text-white|bg-white|bg-black|tracking-|active:scale|transition-all/);
    expect(source).not.toMatch(/rgba\(|#[0-9a-fA-F]{3,8}\b|📷/);
  });
});
