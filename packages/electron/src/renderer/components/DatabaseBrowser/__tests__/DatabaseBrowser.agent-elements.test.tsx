// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseBrowser } from '../DatabaseBrowser';

const copyToClipboardMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('virtua', () => ({
  VList: ({ children, className, style }: React.PropsWithChildren<{ className?: string; style?: React.CSSProperties }>) => (
    <div className={className} style={style} data-testid="database-browser-virtual-list">
      {children}
    </div>
  ),
}));

vi.mock('@nimbalyst/runtime', () => ({
  copyToClipboard: copyToClipboardMock,
}));

const browserSourcePath = resolve(__dirname, '../DatabaseBrowser.tsx');

function installElectronApi() {
  const invoke = vi.fn(async (channel: string, ...args: any[]) => {
    switch (channel) {
      case 'database:getTables':
        return { success: true, tables: ['ai_sessions', 'document_history'] };
      case 'database:getDashboardStats':
        return {
          success: true,
          tableStats: [],
          totalSize: '64 kB',
          totalSizeBytes: 65536,
          basicStats: {
            ai_sessions_count: '1',
            history_count: '0',
            database_size: '64 kB',
          },
          backupStatus: null,
          walStats: null,
        };
      case 'database:getTableSchema':
        return {
          success: true,
          columns: [
            { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null },
            { column_name: 'name', data_type: 'text', is_nullable: 'YES', column_default: null },
            { column_name: 'payload', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
          ],
        };
      case 'database:getTableData':
        return {
          success: true,
          rows: [
            { id: 1, name: 'Alice', payload: { status: 'active' } },
            { id: 2, name: 'Bob', payload: null },
          ],
          totalCount: 2,
          limit: args[1] ?? 100,
          offset: args[2] ?? 0,
        };
      case 'database:getPrimaryKeys':
        return { success: true, primaryKeys: ['id'] };
      case 'database:executeQuery':
        return {
          success: true,
          rows: [{ id: 3, name: 'Query result' }],
          rowCount: 1,
        };
      case 'database:updateCell':
        return { success: true };
      default:
        return { success: false, error: `Unexpected channel ${channel}` };
    }
  });

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { invoke },
  });

  return { invoke };
}

describe('DatabaseBrowser Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyToClipboardMock.mockClear();
    localStorage.clear();
    installElectronApi();
  });

  it('renders the browser shell with Agent Elements markers while preserving table loading and modal edit behavior', async () => {
    const { invoke } = installElectronApi();

    render(<DatabaseBrowser />);

    const browser = await screen.findByTestId('agent-elements-database-browser');
    expect(browser).toHaveClass('agent-elements-database-browser');
    expect(screen.getByTestId('agent-elements-database-browser-sidebar')).toBeInTheDocument();
    expect(screen.getAllByTestId('agent-elements-database-browser-table-item')).toHaveLength(2);
    expect(invoke).toHaveBeenCalledWith('database:getTables');

    fireEvent.click(screen.getByText('ai_sessions'));

    expect(await screen.findByText('Table: ai_sessions')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-database-browser-table-view')).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('database:getTableSchema', 'ai_sessions');
    expect(invoke).toHaveBeenCalledWith('database:getTableData', 'ai_sessions', 100, 0, undefined, undefined);
    expect(invoke).toHaveBeenCalledWith('database:getPrimaryKeys', 'ai_sessions');

    fireEvent.keyDown(screen.getByRole('button', { name: 'name' }), { key: 'Enter' });
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('database:getTableData', 'ai_sessions', 100, 0, 'name', 'asc');
    });

    fireEvent.keyDown(screen.getByRole('button', { name: 'Alice' }), { key: 'Enter' });

    const modal = await screen.findByTestId('agent-elements-database-browser-cell-modal');
    expect(modal).toBeInTheDocument();
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Alicia' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'database:updateCell',
        'ai_sessions',
        [{ column: 'id', value: 1 }],
        'name',
        'Alicia'
      );
    });
  });

  it('preserves SQL query execution inside the Agent Elements shell', async () => {
    const { invoke } = installElectronApi();

    render(<DatabaseBrowser />);

    const queryHeader = await screen.findByRole('button', { name: /SQL Query/i });
    fireEvent.keyDown(queryHeader, { key: 'Enter' });
    fireEvent.change(screen.getByPlaceholderText('Enter SELECT query... (Cmd+Enter to execute)'), {
      target: { value: 'select id, name from ai_sessions' },
    });
    fireEvent.click(screen.getByText('Execute'));

    expect(await screen.findByTestId('agent-elements-database-browser-query-results')).toBeInTheDocument();
    expect(screen.getByText('Query Results (1 rows)')).toBeInTheDocument();
    expect(screen.getByText('Query result')).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('database:executeQuery', 'select id, name from ai_sessions');
  });

  it('preserves column visibility persistence inside the Agent Elements table shell', async () => {
    render(<DatabaseBrowser />);

    fireEvent.click(await screen.findByText('ai_sessions'));
    await screen.findByTestId('agent-elements-database-browser-table-view');

    fireEvent.click(screen.getByText('Columns'));
    fireEvent.click(screen.getByLabelText('payload'));

    expect(localStorage.getItem('database-browser-hidden-columns')).toBe(
      JSON.stringify({ ai_sessions: ['payload'] })
    );
  });

  it('keeps DatabaseBrowser source on Agent Elements-compatible visual rules', () => {
    const source = readFileSync(browserSourcePath, 'utf8');

    expect(source).toContain('agent-elements-database-browser');
    expect(source).toContain('agent-elements-database-browser-sidebar');
    expect(source).toContain('agent-elements-database-browser-query-panel');
    expect(source).toContain('agent-elements-database-browser-table-view');
    expect(source).toContain('agent-elements-database-browser-query-results');
    expect(source).toContain('agent-elements-database-browser-cell-modal');

    expect(source).not.toMatch(/rounded-md|rounded-lg|rounded-xl/);
    expect(source).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}\b|rgba\(/);
    expect(source).not.toMatch(/bg-white|text-white|bg-black|hover:scale|tracking-\[/);
    expect(source).not.toMatch(/--nim-accent|--nim-surface|text-nim-fg|<svg/);
  });
});
