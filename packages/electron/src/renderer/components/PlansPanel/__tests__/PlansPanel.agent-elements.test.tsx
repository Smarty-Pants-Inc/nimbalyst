// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanFilters } from '../PlanFilters';
import { PlanListItem, type PlanData } from '../PlanListItem';
import { PlansPanel } from '../PlansPanel';

const plansPanelSourcePath = resolve(__dirname, '../PlansPanel.tsx');
const planListItemSourcePath = resolve(__dirname, '../PlanListItem.tsx');
const planFiltersSourcePath = resolve(__dirname, '../PlanFilters.tsx');

const samplePlan: PlanData = {
  id: 'plan-1',
  title: 'Agent UX Redesign',
  status: 'in-development',
  owner: 'paul',
  priority: 'high',
  progress: 42,
  path: '/workspace/docs/agent-ux.md',
  lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000),
  tags: ['ux', 'agent'],
  planType: 'feature',
};

const mockDocumentService = {
  listDocumentMetadata: vi.fn(),
  watchDocumentMetadata: vi.fn(),
  getDocumentByPath: vi.fn(),
  openDocument: vi.fn(),
};

describe('PlansPanel Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'documentService', {
      configurable: true,
      value: mockDocumentService,
    });
  });

  it('renders plan rows with Agent Elements markers while preserving click behavior', () => {
    const onClick = vi.fn();
    render(<PlanListItem plan={samplePlan} isActive onClick={onClick} />);

    const row = screen.getByText('Agent UX Redesign').closest('.plan-list-item');
    expect(row).toHaveClass('agent-elements-plan-list-item', 'active');
    expect(row).toHaveAttribute('data-component', 'PlanListItem');
    expect(row).toHaveAttribute('data-agent-elements-shell', 'plan-list-item');
    expect(row).toHaveAttribute('data-plan-status', 'in-development');
    expect(row).toHaveAttribute('data-plan-priority', 'high');

    expect(screen.getByTestId('agent-elements-plan-status-badge')).toHaveAttribute(
      'data-plan-status',
      'in-development',
    );
    expect(screen.getByTestId('agent-elements-plan-progress')).toHaveAttribute('aria-valuenow', '42');

    fireEvent.click(row!);
    expect(onClick).toHaveBeenCalledWith(samplePlan);
  });

  it('renders filters with Agent Elements controls while preserving callbacks', () => {
    const onSearchChange = vi.fn();
    const onStatusChange = vi.fn();
    const onPriorityChange = vi.fn();
    const onHideCompletedChange = vi.fn();

    render(
      <PlanFilters
        searchTerm="agent"
        onSearchChange={onSearchChange}
        statusFilter="all"
        onStatusChange={onStatusChange}
        priorityFilter="all"
        onPriorityChange={onPriorityChange}
        hideCompleted={false}
        onHideCompletedChange={onHideCompletedChange}
      />,
    );

    expect(screen.getByTestId('agent-elements-plan-filters')).toHaveAttribute(
      'data-agent-elements-shell',
      'plan-filters',
    );

    fireEvent.change(screen.getByPlaceholderText('Search plans...'), { target: { value: 'runtime' } });
    expect(onSearchChange).toHaveBeenCalledWith('runtime');

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onSearchChange).toHaveBeenCalledWith('');

    fireEvent.change(screen.getByLabelText('Plan status'), { target: { value: 'completed' } });
    expect(onStatusChange).toHaveBeenCalledWith('completed');

    fireEvent.change(screen.getByLabelText('Plan priority'), { target: { value: 'high' } });
    expect(onPriorityChange).toHaveBeenCalledWith('high');

    fireEvent.click(screen.getByLabelText('Hide completed'));
    expect(onHideCompletedChange).toHaveBeenCalledWith(true);
  });

  it('loads plan metadata inside the shell and preserves document open behavior', async () => {
    mockDocumentService.listDocumentMetadata.mockResolvedValue([
      {
        id: 'doc-1',
        path: samplePlan.path,
        lastModified: samplePlan.lastUpdated,
        frontmatter: {
          planStatus: {
            planId: samplePlan.id,
            title: samplePlan.title,
            status: samplePlan.status,
            owner: samplePlan.owner,
            priority: samplePlan.priority,
            progress: samplePlan.progress,
            tags: samplePlan.tags,
            planType: samplePlan.planType,
          },
        },
      },
      {
        id: 'agent-doc',
        path: '/workspace/agents/hidden.md',
        lastModified: new Date(),
        frontmatter: {
          planStatus: { title: 'Hidden Agent Plan' },
        },
      },
    ]);
    mockDocumentService.watchDocumentMetadata.mockReturnValue(vi.fn());
    mockDocumentService.getDocumentByPath.mockResolvedValue({ id: 'doc-1' });
    mockDocumentService.openDocument.mockResolvedValue(undefined);

    const onPlanSelect = vi.fn();
    render(<PlansPanel currentFilePath={samplePlan.path} onPlanSelect={onPlanSelect} />);

    const panel = await screen.findByTestId('agent-elements-plans-panel');
    expect(panel).toHaveAttribute('data-agent-elements-shell', 'plans-panel');
    expect(await screen.findByText('Agent UX Redesign')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Agent Plan')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Agent UX Redesign'));

    await waitFor(() => {
      expect(mockDocumentService.getDocumentByPath).toHaveBeenCalledWith(samplePlan.path);
      expect(mockDocumentService.openDocument).toHaveBeenCalledWith('doc-1', { path: samplePlan.path });
      expect(onPlanSelect).toHaveBeenCalledWith(samplePlan.path);
    });
  });

  it('keeps PlansPanel source on Agent Elements-compatible visual rules', () => {
    const source = [
      readFileSync(plansPanelSourcePath, 'utf8'),
      readFileSync(planListItemSourcePath, 'utf8'),
      readFileSync(planFiltersSourcePath, 'utf8'),
    ].join('\n');

    expect(source).toContain('agent-elements-plans-panel');
    expect(source).toContain('agent-elements-plan-list-item');
    expect(source).toContain('agent-elements-plan-filters');
    expect(source).not.toMatch(/#[0-9A-Fa-f]{3,8}|rgba\(/);
    expect(source).not.toMatch(/bg-nim|text-nim|border-nim|border-l-\[3px\]|tracking-tighter/);
    expect(source).not.toMatch(/rounded-md|rounded-lg|shadow-lg|backdrop-blur|text-white|text-black/);
  });
});
