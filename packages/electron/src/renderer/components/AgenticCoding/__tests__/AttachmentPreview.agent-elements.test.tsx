// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AttachmentPreview,
  ProcessingAttachmentPreview,
} from '../AttachmentPreview';
import { AttachmentPreviewList } from '../AttachmentPreviewList';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../AttachmentPreview.tsx');
const listSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../AttachmentPreviewList.tsx');

const imageAttachment = {
  id: 'image-1',
  filename: 'mockup.png',
  filepath: '/workspace/assets/mockup.png',
  mimeType: 'image/png',
  size: 153600,
  type: 'image' as const,
  addedAt: 1,
};

const documentAttachment = {
  id: 'doc-1',
  filename: 'notes.md',
  filepath: '/workspace/docs/notes.md',
  mimeType: 'text/markdown',
  size: 4096,
  type: 'document' as const,
  addedAt: 2,
};

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');

  return {
    MaterialSymbol: ({ icon, size }: { icon: string; size?: number }) =>
      ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size }, icon),
    getFileIcon: (filename: string) =>
      ReactModule.createElement('span', { 'data-file-icon': filename }, 'description'),
  };
});

vi.mock('../../../hooks/useFloatingMenu', async () => {
  const actual = await vi.importActual<typeof import('../../../hooks/useFloatingMenu')>(
    '../../../hooks/useFloatingMenu',
  );

  return {
    ...actual,
    FloatingPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    virtualElement: (x: number, y: number) => ({
      getBoundingClientRect: () => ({
        x,
        y,
        width: 0,
        height: 0,
        top: y,
        left: x,
        right: x,
        bottom: y,
      }),
    }),
    useFloatingMenu: (options: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) => ({
      isOpen: options.open ?? false,
      setIsOpen: options.onOpenChange ?? vi.fn(),
      refs: {
        setReference: vi.fn(),
        setFloating: vi.fn(),
        setPositionReference: vi.fn(),
      },
      floatingStyles: { position: 'fixed', left: 24, top: 36 },
      getReferenceProps: () => ({}),
      getFloatingProps: () => ({}),
      context: {},
    }),
  };
});

describe('AttachmentPreview Agent Elements shell', () => {
  it('renders processing attachments with Agent Elements-compatible loading chrome', () => {
    render(<ProcessingAttachmentPreview filename="large-screenshot.png" />);

    const preview = screen.getByTestId('agent-elements-attachment-processing');
    expect(preview).toHaveClass('attachment-preview', 'agent-elements-attachment-preview');
    expect(preview).toHaveAttribute('data-component', 'ProcessingAttachmentPreview');
    expect(preview).toHaveAttribute('data-agent-elements-shell', 'attachment-processing');
    expect(preview).toHaveTextContent('large-screenshot.png');
    expect(preview).toHaveTextContent('Processing');
  });

  it('renders image attachments, preserves asset URLs, and opens an Agent Elements image modal', () => {
    const onRemove = vi.fn();
    render(<AttachmentPreview attachment={imageAttachment} onRemove={onRemove} />);

    const preview = screen.getByTestId('agent-elements-attachment-preview');
    expect(preview).toHaveClass('attachment-preview', 'agent-elements-attachment-preview');
    expect(preview).toHaveAttribute('data-component', 'AttachmentPreview');
    expect(preview).toHaveAttribute('data-agent-elements-shell', 'attachment-preview');
    expect(preview).toHaveAttribute('data-attachment-type', 'image');

    const image = screen.getByRole('img', { name: 'mockup.png' }) as HTMLImageElement;
    expect(image.src).toContain('nim-asset://local/');
    expect(image.src).not.toContain('/workspace/assets/mockup.png');

    fireEvent.click(screen.getByTestId('agent-elements-attachment-thumbnail'));
    const modal = screen.getByTestId('agent-elements-attachment-modal');
    expect(modal).toHaveAttribute('data-agent-elements-shell', 'attachment-image-modal');
    expect(screen.getByTestId('agent-elements-attachment-modal-caption')).toHaveTextContent('mockup.png');

    fireEvent.click(screen.getByRole('button', { name: 'Remove attachment' }));
    expect(onRemove).toHaveBeenCalledWith('image-1');
  });

  it('uses a Floating UI Agent Elements context menu for document conversion', () => {
    const onConvertToText = vi.fn();
    render(
      <AttachmentPreview
        attachment={documentAttachment}
        onRemove={vi.fn()}
        onConvertToText={onConvertToText}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId('agent-elements-attachment-preview'), {
      clientX: 80,
      clientY: 120,
    });

    const menu = screen.getByTestId('agent-elements-attachment-context-menu');
    expect(menu).toHaveAttribute('data-agent-elements-shell', 'attachment-context-menu');
    expect(menu).toHaveAttribute('role', 'menu');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Insert as text' }));
    expect(onConvertToText).toHaveBeenCalledWith(documentAttachment);
  });

  it('renders the attachment list with Agent Elements shell metadata and preserves ordering', () => {
    const onRemove = vi.fn();
    render(
      <AttachmentPreviewList
        attachments={[imageAttachment, documentAttachment]}
        onRemove={onRemove}
        processingAttachments={[{ id: 'processing-1', filename: 'large.mov' }]}
      />,
    );

    const list = screen.getByTestId('agent-elements-attachment-preview-list');
    expect(list).toHaveClass('attachment-preview-list', 'agent-elements-attachment-preview-list');
    expect(list).toHaveAttribute('data-component', 'AttachmentPreviewList');
    expect(list).toHaveAttribute('data-agent-elements-shell', 'attachment-preview-list');
    expect(list).toHaveAttribute('data-attachment-count', '2');
    expect(list).toHaveAttribute('data-processing-count', '1');

    const itemText = list.textContent ?? '';
    expect(itemText.indexOf('large.mov')).toBeLessThan(itemText.indexOf('mockup.png'));
    expect(itemText.indexOf('mockup.png')).toBeLessThan(itemText.indexOf('notes.md'));

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove attachment' })[0]);
    expect(onRemove).toHaveBeenCalledWith('image-1');
  });

  it('keeps the source constrained to Agent Elements-compatible attachment styling', () => {
    const source = readFileSync(sourcePath, 'utf8');
    const listSource = readFileSync(listSourcePath, 'utf8');

    expect(source).toContain('agent-elements-attachment-preview');
    expect(source).toContain('data-agent-elements-shell="attachment-preview"');
    expect(listSource).toContain('agent-elements-attachment-preview-list');
    expect(listSource).toContain('data-agent-elements-shell="attachment-preview-list"');
    expect(source).toContain('useFloatingMenu');
    expect(source).toContain('FloatingPortal');
    expect(source).toContain('virtualElement');
    expect(source).toContain('MaterialSymbol');
    expect(source).toContain('nimAssetUrl');
    expect(`${source}\n${listSource}`).not.toMatch(/bg-nim|text-nim|border-nim|var\(--nim/);
    expect(`${source}\n${listSource}`).not.toMatch(/bg-black|bg-white|text-white|rgba\(|#[0-9a-fA-F]{3,8}\b/);
    expect(`${source}\n${listSource}`).not.toMatch(/rounded-md|rounded-lg|rounded-xl|rounded-2xl/);
    expect(`${source}\n${listSource}`).not.toMatch(/transition-all|active:scale|backdrop-blur|<svg/);
  });
});
