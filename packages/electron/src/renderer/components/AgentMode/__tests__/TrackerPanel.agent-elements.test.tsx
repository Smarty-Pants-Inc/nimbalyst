// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackerPanel } from '../TrackerPanel';

const mockState = vi.hoisted(() => {
  const tokens = {
    sessionRegistryAtom: 'sessionRegistryAtom',
    trackerPanelCollapsedAtom: 'trackerPanelCollapsedAtom',
    toggleTrackerPanelCollapsedAtom: 'toggleTrackerPanelCollapsedAtom',
    setWindowModeAtom: 'setWindowModeAtom',
    setTrackerModeLayoutAtom: 'setTrackerModeLayoutAtom',
  };

  return {
    tokens,
    atomValues: new Map<string, any>(),
    setAtomFns: new Map<string, any>(),
    defaultSetAtom: vi.fn(),
    setWindowMode: vi.fn(),
    setTrackerLayout: vi.fn(),
    toggleCollapsed: vi.fn(),
  };
});

vi.mock('jotai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jotai')>();

  return {
    ...actual,
    useAtomValue: vi.fn((atom: string) => mockState.atomValues.get(atom)),
    useSetAtom: vi.fn((atom: string) => mockState.setAtomFns.get(atom) ?? mockState.defaultSetAtom),
  };
});

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
      style,
    }: {
      icon: string;
      size?: number;
      className?: string;
      style?: React.CSSProperties;
    }) => ReactModule.createElement('span', { 'data-icon': icon, 'data-size': size, className, style }),
  };
});

vi.mock('@nimbalyst/runtime/plugins/TrackerPlugin/trackerDataAtoms', () => ({
  trackerItemByIdAtom: (itemId: string) => `trackerItem:${itemId}`,
}));

vi.mock('../../../store/atoms/sessions', () => ({
  sessionRegistryAtom: mockState.tokens.sessionRegistryAtom,
  workstreamSessionsAtom: (workstreamId: string) => `workstreamSessions:${workstreamId}`,
}));

vi.mock('../../../store/atoms/agentMode', () => ({
  trackerPanelCollapsedAtom: mockState.tokens.trackerPanelCollapsedAtom,
  toggleTrackerPanelCollapsedAtom: mockState.tokens.toggleTrackerPanelCollapsedAtom,
}));

vi.mock('../../../store/atoms/windowMode', () => ({
  setWindowModeAtom: mockState.tokens.setWindowModeAtom,
}));

vi.mock('../../../store/atoms/trackers', () => ({
  setTrackerModeLayoutAtom: mockState.tokens.setTrackerModeLayoutAtom,
}));

const sourcePath = resolve(__dirname, '../TrackerPanel.tsx');

function trackerItem(id: string, primaryType: string, title: string, status?: string) {
  return {
    id,
    primaryType,
    typeTags: [primaryType],
    archived: false,
    fields: {
      title,
      status,
    },
  };
}

function seedTrackerPanel({
  collapsed = false,
  parentLinks = ['bug-1', 'file:/workspace/src/app.ts', 'task-1'],
  childLinks = ['task-1', 'decision-1', 'missing-1'],
}: {
  collapsed?: boolean;
  parentLinks?: string[];
  childLinks?: string[];
} = {}) {
  mockState.atomValues.clear();
  mockState.setAtomFns.clear();
  mockState.defaultSetAtom.mockClear();
  mockState.setWindowMode.mockClear();
  mockState.setTrackerLayout.mockClear();
  mockState.toggleCollapsed.mockClear();

  mockState.atomValues.set(mockState.tokens.trackerPanelCollapsedAtom, collapsed);
  mockState.atomValues.set(mockState.tokens.sessionRegistryAtom, new Map([
    ['workstream-1', { linkedTrackerItemIds: parentLinks }],
    ['child-a', { linkedTrackerItemIds: childLinks }],
  ]));
  mockState.atomValues.set('workstreamSessions:workstream-1', ['child-a']);
  mockState.atomValues.set('trackerItem:bug-1', trackerItem('bug-1', 'bug', 'Fix sync status', 'in-progress'));
  mockState.atomValues.set('trackerItem:task-1', trackerItem('task-1', 'task', 'Polish AgentMode shell', 'to-do'));
  mockState.atomValues.set('trackerItem:decision-1', trackerItem('decision-1', 'decision', 'Keep left-aligned rows', 'decided'));
  mockState.atomValues.set('trackerItem:missing-1', null);

  mockState.setAtomFns.set(mockState.tokens.toggleTrackerPanelCollapsedAtom, mockState.toggleCollapsed);
  mockState.setAtomFns.set(mockState.tokens.setWindowModeAtom, mockState.setWindowMode);
  mockState.setAtomFns.set(mockState.tokens.setTrackerModeLayoutAtom, mockState.setTrackerLayout);
}

describe('AgentMode TrackerPanel Agent Elements shell', () => {
  beforeEach(() => {
    seedTrackerPanel();
  });

  it('does not render when the workstream has no linked tracker items', () => {
    seedTrackerPanel({ parentLinks: ['file:/workspace/src/app.ts'], childLinks: [] });

    const { container } = render(<TrackerPanel workstreamId="workstream-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('wraps linked tracker rows in Agent Elements chrome while preserving aggregation semantics', () => {
    render(<TrackerPanel workstreamId="workstream-1" />);

    const panel = screen.getByTestId('agent-elements-tracker-panel');
    expect(panel).toHaveClass('tracker-panel', 'agent-elements-tracker-panel');
    expect(panel).toHaveAttribute('data-component', 'TrackerPanel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'tracker-panel');
    expect(panel).toHaveAttribute('data-linked-count', '4');
    expect(panel).toHaveAttribute('data-workstream-id', 'workstream-1');

    const header = screen.getByTestId('tracker-panel-header');
    expect(header).toHaveClass('tracker-panel-header', 'agent-elements-tracker-panel-header');
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('agent-elements-tracker-panel-count')).toHaveTextContent('4');

    const content = screen.getByTestId('agent-elements-tracker-panel-content');
    expect(content).toHaveAttribute('data-agent-elements-shell', 'tracker-panel-content');
    expect(screen.queryByText('file:/workspace/src/app.ts')).not.toBeInTheDocument();

    const rows = screen.getAllByTestId('tracker-item-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute('data-tracker-id', 'bug-1');
    expect(rows[1]).toHaveAttribute('data-tracker-id', 'task-1');
    expect(rows[2]).toHaveAttribute('data-tracker-id', 'decision-1');
    expect(within(rows[0]).getByText('Fix sync status')).toBeInTheDocument();
    expect(within(rows[0]).getByText('in-progress')).toHaveClass('agent-elements-status-pill');
    expect(screen.queryByText('missing-1')).not.toBeInTheDocument();
  });

  it('preserves collapse and tracker navigation behavior', () => {
    seedTrackerPanel({ collapsed: true });

    render(<TrackerPanel workstreamId="workstream-1" />);

    const header = screen.getByTestId('tracker-panel-header');
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('agent-elements-tracker-panel-content')).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(mockState.toggleCollapsed).toHaveBeenCalledTimes(1);

    seedTrackerPanel({ collapsed: false });
    render(<TrackerPanel workstreamId="workstream-1" />);

    fireEvent.click(screen.getAllByTestId('tracker-item-row')[1]);

    expect(mockState.setTrackerLayout).toHaveBeenCalledWith({ selectedItemId: 'task-1' });
    expect(mockState.setWindowMode).toHaveBeenCalledWith('tracker');
  });

  it('keeps TrackerPanel source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('agent-elements-tracker-panel');
    expect(source).toContain('data-agent-elements-shell="tracker-panel"');
    expect(source).toContain('agent-elements-status-pill');
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim/);
    expect(source).not.toMatch(/bg-\[var\(--nim|text-\[var\(--nim|border-\[var\(--nim/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl|shadow-lg|tracking-wide|active:scale/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/<svg|<\/svg>|style=\{\{ backgroundColor/);
  });
});
