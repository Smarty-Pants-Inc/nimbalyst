// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ImageDiffViewer } from '../ImageDiffViewer';

const sourcePath = resolve(__dirname, '../ImageDiffViewer.tsx');

function renderViewer() {
  return render(
    <ImageDiffViewer
      oldImagePath="/workspace/assets/logo-old.png"
      newImagePath="/workspace/assets/logo-new.png"
      filePath="/workspace/assets/logo.png"
    />
  );
}

describe('ImageDiffViewer Agent Elements shell', () => {
  it('renders side-by-side image history with Agent Elements chrome while preserving image asset URLs', () => {
    renderViewer();

    const root = screen.getByTestId('agent-elements-image-diff-viewer');
    expect(root).toHaveClass('image-diff-viewer', 'agent-elements-image-diff-viewer');
    expect(root).toHaveAttribute('data-agent-elements-shell', 'image-diff-viewer');
    expect(root).toHaveAttribute('data-file-path', '/workspace/assets/logo.png');
    expect(root).toHaveAttribute('data-view-mode', 'side-by-side');

    const controls = screen.getByTestId('agent-elements-image-diff-controls');
    expect(controls).toHaveAttribute('data-agent-elements-shell', 'image-diff-controls');

    const modeToggle = screen.getByTestId('agent-elements-image-diff-mode-toggle');
    expect(modeToggle).toHaveAttribute('data-agent-elements-shell', 'image-diff-mode-toggle');
    expect(within(modeToggle).getByRole('button', { name: 'Side by Side' })).toHaveAttribute('data-active', 'true');

    expect(screen.getByTestId('agent-elements-image-diff-side-by-side')).toHaveAttribute(
      'data-agent-elements-shell',
      'image-diff-side-by-side'
    );
    expect(screen.getByTestId('agent-elements-image-diff-panel-old')).toHaveTextContent('Old Version');
    expect(screen.getByTestId('agent-elements-image-diff-panel-new')).toHaveTextContent('New Version');

    const oldImage = screen.getByAltText('Old version');
    const newImage = screen.getByAltText('New version');
    expect(oldImage).toHaveAttribute('src', expect.stringContaining('nim-asset://local/'));
    expect(newImage).toHaveAttribute('src', expect.stringContaining('nim-asset://local/'));
  });

  it('preserves swipe and overlay mode controls with token-backed sliders', () => {
    renderViewer();

    const modeToggle = screen.getByTestId('agent-elements-image-diff-mode-toggle');
    fireEvent.click(within(modeToggle).getByRole('button', { name: 'Swipe' }));

    const root = screen.getByTestId('agent-elements-image-diff-viewer');
    expect(root).toHaveAttribute('data-view-mode', 'swipe');
    expect(screen.getByTestId('agent-elements-image-diff-swipe')).toHaveAttribute(
      'data-agent-elements-shell',
      'image-diff-swipe'
    );

    const positionSlider = screen.getByLabelText('Position');
    expect(positionSlider).toHaveClass('image-diff-slider', 'agent-elements-image-diff-slider');
    fireEvent.change(positionSlider, { target: { value: '35' } });
    expect(screen.getByTestId('agent-elements-image-diff-swipe-old-wrapper')).toHaveStyle({
      clipPath: 'inset(0 65% 0 0)',
    });
    expect(screen.getByTestId('agent-elements-image-diff-swipe-divider')).toHaveStyle({ left: '35%' });

    fireEvent.click(within(modeToggle).getByRole('button', { name: 'Overlay' }));

    expect(root).toHaveAttribute('data-view-mode', 'onion-skin');
    expect(screen.getByTestId('agent-elements-image-diff-overlay')).toHaveAttribute(
      'data-agent-elements-shell',
      'image-diff-overlay'
    );

    const opacitySlider = screen.getByLabelText('Opacity');
    fireEvent.change(opacitySlider, { target: { value: '25' } });
    expect(screen.getByTestId('agent-elements-image-diff-overlay-old')).toHaveStyle({ opacity: '0.25' });
  });

  it('removes legacy image diff chrome in favor of Agent Elements tokenized rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-image-diff-viewer');
    expect(source).toContain('data-agent-elements-shell="image-diff-viewer"');
    expect(source).toContain('--an-background');
    expect(source).toContain('--an-border-color');
    expect(source).toContain('--an-input-border-radius');
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim|--nim-/);
    expect(source).not.toMatch(/text-white|transition-all|rounded-md|rounded-lg|rounded-xl|rgba\(|rgb\(/);
  });
});
