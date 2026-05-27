// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type Node,
  type NodeProps,
  type Viewport,
} from '@xyflow/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type BookTab = {
  id: string;
  title: string;
  icon: string;
  shortcut?: string;
  active?: boolean;
  unread?: boolean;
};

type ShelfBook = {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'blocked';
  tabs: BookTab[];
};

const SPINE_WIDTH = 52;
const SLOT_SIZE = 28;

function makeBooks(count = 10): ShelfBook[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `book-${index}`,
    title: `Workstream ${index + 1}`,
    status: index % 4 === 0 ? 'running' : index % 7 === 0 ? 'blocked' : 'idle',
    tabs: Array.from({ length: 8 }, (_tab, tabIndex) => ({
      id: `book-${index}-tab-${tabIndex}`,
      title: `Tab ${tabIndex + 1}`,
      icon: tabIndex % 2 === 0 ? 'terminal' : 'article',
      shortcut: tabIndex < 5 ? `Cmd+${tabIndex + 1}` : undefined,
      active: tabIndex === 0,
      unread: tabIndex === 2,
    })),
  }));
}

function BookshelfSpike({
  books,
  activeBookId,
  revealShortcuts = false,
  reduceMotion = false,
  onOpenBook,
  mountCounter,
}: {
  books: ShelfBook[];
  activeBookId: string;
  revealShortcuts?: boolean;
  reduceMotion?: boolean;
  onOpenBook: (bookId: string) => void;
  mountCounter: { bodyMounts: number };
}) {
  const activeIndex = Math.max(0, books.findIndex((book) => book.id === activeBookId));
  const activeBook = books[activeIndex] ?? books[0];
  const leftBooks = books.slice(0, activeIndex);
  const rightBooks = books.slice(activeIndex + 1);

  return (
    <section
      className="agent-elements-bookshelf-spike"
      data-testid="bookshelf-spike"
      data-source-owner="workstream-session-editor-props"
      data-active-book-id={activeBook.id}
      data-motion={reduceMotion ? 'reduced' : 'spine-flow'}
    >
      <div
        data-testid="bookshelf-left-stack"
        data-region="left-spine-stack"
        style={{ width: leftBooks.length * SPINE_WIDTH }}
      >
        {leftBooks.map((book) => (
          <BookSpine
            key={book.id}
            book={book}
            revealShortcuts={revealShortcuts}
            reduceMotion={reduceMotion}
            onOpenBook={onOpenBook}
          />
        ))}
      </div>
      <div data-testid="bookshelf-open-region" data-region="open-book-body">
        <BookSpine
          book={activeBook}
          revealShortcuts={revealShortcuts}
          reduceMotion={reduceMotion}
          onOpenBook={onOpenBook}
          active
        />
        <OpenBookBody book={activeBook} mountCounter={mountCounter} />
      </div>
      <div
        data-testid="bookshelf-right-stack"
        data-region="right-spine-stack"
        style={{ width: rightBooks.length * SPINE_WIDTH }}
      >
        {rightBooks.map((book) => (
          <BookSpine
            key={book.id}
            book={book}
            revealShortcuts={revealShortcuts}
            reduceMotion={reduceMotion}
            onOpenBook={onOpenBook}
          />
        ))}
      </div>
    </section>
  );
}

function BookSpine({
  book,
  active = false,
  revealShortcuts,
  reduceMotion,
  onOpenBook,
}: {
  book: ShelfBook;
  active?: boolean;
  revealShortcuts: boolean;
  reduceMotion: boolean;
  onOpenBook: (bookId: string) => void;
}) {
  return (
    <article
      className="agent-elements-bookshelf-spine"
      data-testid={`bookshelf-spine-${book.id}`}
      data-spine-width={SPINE_WIDTH}
      data-active={active ? 'true' : 'false'}
      data-status={book.status}
      data-motion={reduceMotion ? 'none' : 'transform-opacity'}
      style={{ width: SPINE_WIDTH }}
    >
      <button
        type="button"
        data-testid={`bookshelf-spine-header-${book.id}`}
        data-region="pinned-spine-header"
        aria-label={`Open ${book.title}`}
        onClick={() => onOpenBook(book.id)}
      >
        {book.title}
      </button>
      <div
        data-testid={`bookshelf-tab-slots-${book.id}`}
        data-region="scrollable-tab-slot-middle"
        role="tablist"
        aria-orientation="vertical"
      >
        {book.tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-testid={`bookshelf-tab-slot-${tab.id}`}
            data-slot-size={SLOT_SIZE}
            data-active={tab.active ? 'true' : 'false'}
            data-unread={tab.unread ? 'true' : 'false'}
            style={{ width: SLOT_SIZE, height: SLOT_SIZE }}
          >
            {revealShortcuts && tab.shortcut ? tab.shortcut : tab.icon}
          </button>
        ))}
      </div>
      <footer data-testid={`bookshelf-spine-footer-${book.id}`} data-region="pinned-spine-footer">
        {book.status}
      </footer>
    </article>
  );
}

function OpenBookBody({ book, mountCounter }: { book: ShelfBook; mountCounter: { bodyMounts: number } }) {
  React.useEffect(() => {
    mountCounter.bodyMounts += 1;
  }, [mountCounter]);

  return (
    <main data-testid="bookshelf-open-body" data-book-id={book.id}>
      {book.title}
    </main>
  );
}

type CanvasCardKind = 'transcript' | 'editor' | 'files';

type CanvasCardData = {
  title: string;
  kind: CanvasCardKind;
  reduceMotion: boolean;
  mountCounts: Map<string, number>;
  onExitFocus: (id: string) => void;
};

type CanvasCardNode = Node<CanvasCardData, 'canvas-card'>;

function makeCanvasNodes(count = 20): CanvasCardNode[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${index}`,
    type: 'canvas-card',
    position: {
      x: (index % 5) * 260,
      y: Math.floor(index / 5) * 190,
    },
    width: 220,
    height: 140,
    selected: index === 0,
    zIndex: index === 0 ? 2 : 1,
    data: {
      title: `Agent card ${index + 1}`,
      kind: index % 3 === 0 ? 'transcript' : index % 3 === 1 ? 'editor' : 'files',
      reduceMotion: false,
      mountCounts: new Map(),
      onExitFocus: () => undefined,
    },
  }));
}

function getFitViewport(nodes: CanvasCardNode[], viewportWidth: number, viewportHeight: number): Viewport {
  const right = Math.max(...nodes.map((node) => node.position.x + (node.width ?? 220)));
  const bottom = Math.max(...nodes.map((node) => node.position.y + (node.height ?? 140)));
  const zoom = Math.min(viewportWidth / (right + 80), viewportHeight / (bottom + 80), 1);

  return {
    x: Math.round((viewportWidth - right * zoom) / 2),
    y: Math.round((viewportHeight - bottom * zoom) / 2),
    zoom: Number(zoom.toFixed(2)),
  };
}

function CanvasCard({ id, data, selected }: NodeProps<CanvasCardNode>) {
  React.useEffect(() => {
    data.mountCounts.set(id, (data.mountCounts.get(id) ?? 0) + 1);
  }, [data.mountCounts, id]);

  return (
    <section
      className="agent-elements-canvas-card"
      data-testid={`canvas-card-${id}`}
      data-card-kind={data.kind}
      data-selected={selected ? 'true' : 'false'}
      data-motion={data.reduceMotion ? 'none' : 'transform-opacity'}
    >
      <button
        type="button"
        data-testid={`canvas-card-focus-${id}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            data.onExitFocus(id);
          }
        }}
      >
        {data.title}
      </button>
    </section>
  );
}

const nodeTypes = { 'canvas-card': CanvasCard };

function CanvasSpike({
  reduceMotion = false,
  mountCounts,
  onExitFocus,
}: {
  reduceMotion?: boolean;
  mountCounts: Map<string, number>;
  onExitFocus: (id: string) => void;
}) {
  const [viewport, setViewport] = React.useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [nodes, setNodes] = React.useState<CanvasCardNode[]>(() =>
    makeCanvasNodes().map((node) => ({
      ...node,
      data: {
        ...node.data,
        reduceMotion,
        mountCounts,
        onExitFocus,
      },
    })),
  );

  const updateViewport = (nextViewport: Viewport) => setViewport(nextViewport);

  return (
    <section
      className="agent-elements-canvas-spike"
      data-testid="canvas-spike"
      data-node-count={nodes.length}
      data-viewport={`${viewport.x},${viewport.y},${viewport.zoom}`}
      data-motion={reduceMotion ? 'reduced' : 'pan-zoom'}
    >
      <div data-testid="canvas-toolbar">
        <button
          type="button"
          data-testid="canvas-pan"
          onClick={() => updateViewport({ ...viewport, x: viewport.x - 120 })}
        >
          Pan
        </button>
        <button
          type="button"
          data-testid="canvas-zoom"
          onClick={() => updateViewport({ ...viewport, zoom: Number((viewport.zoom + 0.2).toFixed(2)) })}
        >
          Zoom
        </button>
        <button
          type="button"
          data-testid="canvas-fit"
          onClick={() => updateViewport(getFitViewport(nodes, 1200, 780))}
        >
          Fit
        </button>
        <button
          type="button"
          data-testid="canvas-drag-card"
          onClick={() =>
            setNodes((current) =>
              applyNodeChanges(
                [{ id: 'card-3', type: 'position', position: { x: 720, y: 360 }, dragging: false }],
                current,
              ) as CanvasCardNode[],
            )
          }
        >
          Drag card
        </button>
        <button
          type="button"
          data-testid="canvas-select-card"
          onClick={() =>
            setNodes((current) =>
              current.map((node) => ({
                ...node,
                selected: node.id === 'card-5',
                zIndex: node.id === 'card-5' ? 10 : 1,
              }))
            )
          }
        >
          Select card
        </button>
      </div>
      <ReactFlowProvider initialWidth={1200} initialHeight={780}>
        <ReactFlow<CanvasCardNode>
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          viewport={viewport}
          onViewportChange={setViewport}
          nodesDraggable
          nodesFocusable
          elementsSelectable
          fitView
        />
      </ReactFlowProvider>
    </section>
  );
}

describe('Bookshelf presentation-mode acceptance spike', () => {
  it('proves the Prowl-inspired shelf anatomy without a parallel state owner', () => {
    const onOpenBook = vi.fn();
    const books = makeBooks(10);
    const mountCounter = { bodyMounts: 0 };

    const { rerender } = render(
      <BookshelfSpike
        books={books}
        activeBookId="book-4"
        onOpenBook={onOpenBook}
        mountCounter={mountCounter}
      />,
    );

    const shelf = screen.getByTestId('bookshelf-spike');
    expect(shelf).toHaveAttribute('data-source-owner', 'workstream-session-editor-props');
    expect(shelf).toHaveAttribute('data-active-book-id', 'book-4');
    expect(screen.getByTestId('bookshelf-left-stack')).toHaveAttribute('data-region', 'left-spine-stack');
    expect(screen.getByTestId('bookshelf-right-stack')).toHaveAttribute('data-region', 'right-spine-stack');
    expect(screen.getByTestId('bookshelf-open-region')).toHaveAttribute('data-region', 'open-book-body');
    expect(screen.getAllByTestId(/^bookshelf-spine-book-/)).toHaveLength(10);

    const activeSpine = screen.getByTestId('bookshelf-spine-book-4');
    expect(activeSpine).toHaveAttribute('data-spine-width', String(SPINE_WIDTH));
    expect(activeSpine).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('bookshelf-spine-header-book-4')).toHaveAttribute('data-region', 'pinned-spine-header');
    expect(screen.getByTestId('bookshelf-spine-footer-book-4')).toHaveAttribute('data-region', 'pinned-spine-footer');
    expect(screen.getByTestId('bookshelf-tab-slots-book-4')).toHaveAttribute(
      'data-region',
      'scrollable-tab-slot-middle',
    );
    expect(screen.getByTestId('bookshelf-tab-slots-book-4')).toHaveAttribute('aria-orientation', 'vertical');

    const firstSlot = screen.getByTestId('bookshelf-tab-slot-book-4-tab-0');
    expect(firstSlot).toHaveAttribute('data-slot-size', String(SLOT_SIZE));

    rerender(
      <BookshelfSpike
        books={books}
        activeBookId="book-4"
        revealShortcuts
        onOpenBook={onOpenBook}
        mountCounter={mountCounter}
      />,
    );

    expect(screen.getByTestId('bookshelf-tab-slot-book-4-tab-0')).toHaveAttribute('data-slot-size', String(SLOT_SIZE));
    expect(screen.getByTestId('bookshelf-tab-slot-book-4-tab-0')).toHaveTextContent('Cmd+1');

    rerender(
      <BookshelfSpike
        books={books}
        activeBookId="book-5"
        onOpenBook={onOpenBook}
        mountCounter={mountCounter}
      />,
    );

    expect(screen.getByTestId('bookshelf-open-body')).toHaveAttribute('data-book-id', 'book-5');
    expect(mountCounter.bodyMounts).toBe(1);

    fireEvent.click(screen.getByTestId('bookshelf-spine-header-book-2'));
    expect(onOpenBook).toHaveBeenCalledWith('book-2');
  });

  it('proves the reduced-motion shelf path keeps the same layout anatomy', () => {
    render(
      <BookshelfSpike
        books={makeBooks(10)}
        activeBookId="book-1"
        reduceMotion
        onOpenBook={vi.fn()}
        mountCounter={{ bodyMounts: 0 }}
      />,
    );

    expect(screen.getByTestId('bookshelf-spike')).toHaveAttribute('data-motion', 'reduced');
    for (const spine of screen.getAllByTestId(/^bookshelf-spine-book-/)) {
      expect(spine).toHaveAttribute('data-motion', 'none');
      expect(spine).toHaveAttribute('data-spine-width', String(SPINE_WIDTH));
    }
  });
});

describe('Canvas presentation-mode acceptance spike', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
      if (this.classList.contains('react-flow')) {
        return {
          x: 0,
          y: 0,
          width: 1200,
          height: 780,
          top: 0,
          left: 0,
          right: 1200,
          bottom: 780,
          toJSON: () => undefined,
        } as DOMRect;
      }

      return {
        x: 0,
        y: 0,
        width: 220,
        height: 140,
        top: 0,
        left: 0,
        right: 220,
        bottom: 140,
        toJSON: () => undefined,
      } as DOMRect;
    });
  });

  it('uses @xyflow/react custom nodes for the 20-card stress path and preserves mounted children on viewport changes', async () => {
    const mountCounts = new Map<string, number>();
    const onExitFocus = vi.fn();

    render(<CanvasSpike mountCounts={mountCounts} onExitFocus={onExitFocus} />);

    const canvas = screen.getByTestId('canvas-spike');
    expect(canvas).toHaveAttribute('data-node-count', '20');
    expect(await screen.findByTestId('canvas-card-card-0')).toHaveAttribute('data-card-kind', 'transcript');
    expect(await screen.findByTestId('canvas-card-card-1')).toHaveAttribute('data-card-kind', 'editor');
    expect(await screen.findByTestId('canvas-card-card-2')).toHaveAttribute('data-card-kind', 'files');

    const initialMounts = new Map(mountCounts);

    fireEvent.click(screen.getByTestId('canvas-pan'));
    expect(screen.getByTestId('canvas-spike')).toHaveAttribute('data-viewport', '-120,0,1');
    fireEvent.click(screen.getByTestId('canvas-zoom'));
    expect(screen.getByTestId('canvas-spike')).toHaveAttribute('data-viewport', '-120,0,1.2');
    fireEvent.click(screen.getByTestId('canvas-fit'));
    expect(screen.getByTestId('canvas-spike').getAttribute('data-viewport')).not.toBe('-120,0,1.2');

    expect(mountCounts.get('card-0')).toBe(initialMounts.get('card-0'));
    expect(mountCounts.get('card-10')).toBe(initialMounts.get('card-10'));

    fireEvent.click(screen.getByTestId('canvas-drag-card'));
    const movedCard = screen.getByTestId('canvas-card-card-3').closest('.react-flow__node');
    expect(movedCard).toHaveStyle({ transform: 'translate(720px,360px)' });

    fireEvent.click(screen.getByTestId('canvas-select-card'));
    expect(screen.getByTestId('canvas-card-card-5')).toHaveAttribute('data-selected', 'true');

    const focusButton = within(screen.getByTestId('canvas-card-card-5')).getByTestId('canvas-card-focus-card-5');
    focusButton.focus();
    expect(focusButton).toHaveFocus();
    fireEvent.keyDown(focusButton, { key: 'Escape' });
    expect(onExitFocus).toHaveBeenCalledWith('card-5');
  });

  it('proves the reduced-motion canvas path keeps transform-based card identity', async () => {
    const mountCounts = new Map<string, number>();
    render(<CanvasSpike reduceMotion mountCounts={mountCounts} onExitFocus={vi.fn()} />);

    expect(screen.getByTestId('canvas-spike')).toHaveAttribute('data-motion', 'reduced');
    expect(await screen.findByTestId('canvas-card-card-0')).toHaveAttribute('data-motion', 'none');
    expect(await screen.findByTestId('canvas-card-card-19')).toHaveAttribute('data-motion', 'none');
  });
});
