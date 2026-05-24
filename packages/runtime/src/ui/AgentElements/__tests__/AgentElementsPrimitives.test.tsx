import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  AgentStatusPill,
  AgentToolCard,
  AgentTranscriptRow,
} from '../AgentElementsPrimitives';
import {
  AgentPlanCard,
  AgentTodoList,
} from '../AgentElementsTodoPlan';
import {
  AgentCommandToolCard,
  AgentEditToolCard,
  AgentSearchToolCard,
} from '../AgentElementsToolRenderers';
import {
  AgentMcpToolCard,
  AgentQuestionCard,
  AgentSubagentCard,
  AgentThinkingCard,
} from '../AgentElementsFrameworkEvents';
import {
  AgentErrorCard,
  AgentLifecycleCard,
  AgentProgressCard,
  AgentStateSnapshotCard,
  AgentTurnSummaryCard,
} from '../AgentElementsStreamEvents';
import {
  AgentErrorMessage,
  AgentExtensionEventCard,
  AgentGenericToolCard,
  AgentMarkdown,
  AgentUserMessageBody,
} from '../AgentElementsMessages';
import {
  AgentElementsEventRenderer,
  type AgentElementsRendererModel,
  getAgentElementsRendererDescriptor,
  knownAgentElementsRendererKinds,
} from '../AgentElementsRendererRegistry';

const cssPath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentElements/AgentElementsPrimitives.css'
);
const todoPlanCssPath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentElements/AgentElementsTodoPlan.css'
);
const toolRenderersCssPath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentElements/AgentElementsToolRenderers.css'
);
const frameworkEventsCssPath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentElements/AgentElementsFrameworkEvents.css'
);
const streamEventsCssPath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentElements/AgentElementsStreamEvents.css'
);
const messagesCssPath = path.join(
  process.cwd(),
  'packages/runtime/src/ui/AgentElements/AgentElementsMessages.css'
);
const rendererFixtureDataPath = path.resolve(
  process.cwd(),
  '..',
  '..',
  'docs/agent-elements/renderer-fixture-data.json'
);

interface RendererFixture {
  id: string;
  actor?: {
    role?: NonNullable<AgentElementsRendererModel['actor']>['role'];
    name?: string;
  };
  primary: {
    kind: string;
    title?: string;
    body?: string;
    attachments?: string[];
  };
}

function readRendererFixtureData(): RendererFixture[] {
  const parsed = JSON.parse(fs.readFileSync(rendererFixtureDataPath, 'utf8')) as { fixtures: RendererFixture[] };
  return parsed.fixtures;
}

function fixtureToModel(fixture: RendererFixture): AgentElementsRendererModel {
  const attachmentModels = fixture.primary.attachments?.map((attachment) => ({
    name: path.basename(attachment),
    detail: attachment,
    kind: 'file' as const,
  }));

  return {
    kind: fixture.primary.kind,
    title: fixture.primary.title,
    body: fixture.primary.body,
    actor: fixture.actor,
    attachments: attachmentModels,
    rawPayload: {
      fixtureId: fixture.id,
      hidden: `raw-fixture-json-${fixture.id}`,
    },
  };
}

describe('Agent Elements primitives', () => {
  it('renders every transcript role as a left-aligned identity row', () => {
    render(
      <AgentTranscriptRow
        role="user"
        name="Paul"
        metadata="smarty-server"
        status={<AgentStatusPill tone="running">streaming</AgentStatusPill>}
      >
        <p>Update the validation view.</p>
      </AgentTranscriptRow>
    );

    const row = screen.getByTestId('agent-elements-transcript-row');
    expect(row).toHaveClass('agent-elements-transcript-row');
    expect(row).toHaveAttribute('data-agent-role', 'user');
    expect(row).toHaveAttribute('data-agent-align', 'left');
    expect(row).toHaveAttribute('data-component', 'AgentTranscriptRow');
    expect(screen.getByTestId('agent-elements-identity-row')).toHaveTextContent('Paul');
    expect(screen.getByTestId('agent-elements-identity-row')).toHaveTextContent('smarty-server');
    expect(screen.getByTestId('agent-elements-transcript-content')).toHaveClass('agent-elements-transcript-content');
    expect(screen.getByTestId('agent-elements-transcript-content')).toHaveTextContent('Update the validation view.');
  });

  it('keeps raw payloads inside an explicit debug-only disclosure', () => {
    render(
      <AgentToolCard
        title="write_todos"
        subtitle="3 tasks"
        status="completed"
        debugPayload={{ hidden: 'raw-json-payload' }}
      >
        <p>Updated 3 todo items.</p>
      </AgentToolCard>
    );

    const card = screen.getByTestId('agent-elements-tool-card');
    expect(card).toHaveClass('agent-elements-tool-card');
    expect(card).toHaveAttribute('data-tool-status', 'completed');
    expect(card).toHaveAttribute('data-component', 'AgentToolCard');
    expect(screen.getByTestId('agent-elements-tool-primary')).toHaveTextContent('Updated 3 todo items.');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('raw-json-payload');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
    expect(screen.getByTestId('agent-elements-debug-payload')).toHaveTextContent('raw-json-payload');
  });

  it('anchors the visual layer in Agent Elements tokens and product UI constraints', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('text-align: left;');
    expect(css).toContain('align-items: flex-start;');
    expect(css).toContain('container-type: inline-size;');
    expect(css).toContain('border-radius: var(--an-tool-border-radius);');
    expect(css).toContain('background: var(--an-tool-background);');
    expect(css).toContain('padding: var(--an-spacing-md);');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).not.toMatch(/margin-left:\s*auto|float:\s*right|justify-content:\s*flex-end|background-clip:\s*text/i);
  });
});

describe('Agent Elements todo and plan renderers', () => {
  it('renders todo statuses without primary raw JSON', () => {
    render(
      <AgentTodoList
        isStreaming
        items={[
          { content: 'Map todo events', status: 'completed' },
          { content: 'Build inline renderer', activeForm: 'Building inline renderer', status: 'in_progress' },
          { content: 'Wire live transcript later', status: 'pending' },
        ]}
      />
    );

    const list = screen.getByTestId('agent-elements-todo-list');
    expect(list).toHaveAttribute('data-component', 'AgentTodoList');
    expect(list).toHaveAttribute('data-todo-streaming', 'true');
    expect(screen.getAllByTestId('agent-elements-todo-item')).toHaveLength(3);
    expect(screen.getByText('Map todo events')).toBeInTheDocument();
    expect(screen.getByText('Building inline renderer')).toBeInTheDocument();
    expect(list).not.toHaveTextContent('"status"');
  });

  it('renders plan approval and disclosure controls with product affordances', () => {
    const onApprove = vi.fn();
    render(
      <AgentPlanCard
        fileName="plan-agent-elements.md"
        onApprove={onApprove}
        status="awaiting_approval"
        steps={[
          { label: 'Copy Agent Elements structure', status: 'completed' },
          { label: 'Validate reduced motion', status: 'in_progress' },
        ]}
        summary="1. Copy todo and plan source structure. 2. Keep all rows left aligned."
        title="Agent Elements todo and plan renderers"
      />
    );

    const card = screen.getByTestId('agent-elements-plan-card');
    expect(card).toHaveAttribute('data-component', 'AgentPlanCard');
    expect(card).toHaveAttribute('data-plan-status', 'awaiting_approval');
    expect(screen.getByText('plan-agent-elements.md')).toBeInTheDocument();
    expect(screen.getByText('Agent Elements todo and plan renderers')).toBeInTheDocument();
    expect(screen.getByTestId('agent-elements-plan-toggle')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByTestId('agent-elements-plan-toggle'));
    expect(screen.getByTestId('agent-elements-plan-toggle')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByTestId('agent-elements-plan-approve'));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('agent-elements-plan-approve')).not.toBeInTheDocument();
  });

  it('copies Agent Elements todo and plan style constraints', () => {
    const css = fs.readFileSync(todoPlanCssPath, 'utf8');

    expect(css).toContain('Derived from Agent Elements by 21st.dev todo-tool and plan-tool (MIT)');
    expect(css).toContain('width: 14px;');
    expect(css).toContain('height: 14px;');
    expect(css).toContain('gap: var(--an-spacing-sm);');
    expect(css).toContain('border: 1px solid var(--an-tool-border-color);');
    expect(css).toContain('border-radius: var(--an-tool-border-radius);');
    expect(css).toContain('max-height: 94px;');
    expect(css).toContain('transition: background-color 150ms');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).not.toMatch(/margin-left:\s*auto|float:\s*right|justify-content:\s*flex-end|background-clip:\s*text/i);
  });
});

describe('Agent Elements command, edit, and search renderers', () => {
  it('renders shell command output as terminal content with debug payload isolated', () => {
    render(
      <AgentCommandToolCard
        command="npm test"
        cwd="/workspace/forks/nimbalyst"
        debugPayload={{ hidden: 'raw-command-json' }}
        exitCode={0}
        output="PASS AgentElementsToolRenderers"
        status="completed"
      />
    );

    const card = screen.getByTestId('agent-elements-command-tool-card');
    expect(card).toHaveAttribute('data-component', 'AgentToolCard');
    expect(screen.getByTestId('agent-elements-command-terminal')).toHaveTextContent('$');
    expect(screen.getByTestId('agent-elements-command-terminal')).toHaveTextContent('npm test');
    expect(screen.getByTestId('agent-elements-command-terminal')).toHaveTextContent('PASS AgentElementsToolRenderers');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('raw-command-json');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
  });

  it('renders file edits with diff lines and primitive-local approval controls', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <AgentEditToolCard
        filePath="packages/runtime/src/ui/AgentElements/AgentElementsToolRenderers.tsx"
        onApprove={onApprove}
        onReject={onReject}
        status="pending_approval"
        diffLines={[
          { type: 'context', content: 'export function AgentEditToolCard() {' },
          { type: 'remove', content: 'return <JSONViewer value={payload} />;' },
          { type: 'add', content: 'return <AgentEditToolCard diffLines={diffLines} />;' },
        ]}
      />
    );

    expect(screen.getByTestId('agent-elements-edit-tool-card')).toHaveAttribute('data-tool-status', 'interrupted');
    expect(screen.getByTestId('agent-elements-edit-stats')).toHaveTextContent('+1');
    expect(screen.getByTestId('agent-elements-edit-stats')).toHaveTextContent('-1');
    expect(screen.getByTestId('agent-elements-diff')).toHaveTextContent('AgentEditToolCard');
    expect(screen.getByTestId('agent-elements-diff')).not.toHaveTextContent('"payload"');
    expect(screen.getByTestId('agent-elements-edit-toggle')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByText('Approve'));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onReject).not.toHaveBeenCalled();
    expect(screen.getByTestId('agent-elements-edit-approval')).toHaveTextContent('Approved');
  });

  it('renders search results as a compact result list', () => {
    render(
      <AgentSearchToolCard
        query="JSONViewer"
        results={[
          {
            title: 'RichTranscriptView.tsx',
            path: 'packages/runtime/src/ui/AgentTranscript/components/RichTranscriptView.tsx',
            line: 211,
            excerpt: 'Replace JSONViewer fallback for known tool rows.',
            metadata: 'code',
          },
          {
            title: 'MessageSegment.tsx',
            path: 'packages/runtime/src/ui/AgentTranscript/components/MessageSegment.tsx',
            line: 54,
            excerpt: 'Debug payload remains in a disclosure.',
            metadata: 'code',
          },
        ]}
        source="code"
        status="completed"
      />
    );

    expect(screen.getByTestId('agent-elements-search-tool-card')).toHaveAttribute('data-tool-status', 'completed');
    expect(screen.getByTestId('agent-elements-search-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('agent-elements-search-results')).toHaveTextContent('RichTranscriptView.tsx');
    expect(screen.getAllByTestId('agent-elements-search-result')).toHaveLength(2);
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('"query"');
  });

  it('copies Agent Elements command/edit/search style constraints', () => {
    const css = fs.readFileSync(toolRenderersCssPath, 'utf8');

    expect(css).toContain('Derived from Agent Elements by 21st.dev bash-tool, edit-tool, search-tool');
    expect(css).toContain('border-radius: var(--an-tool-border-radius);');
    expect(css).toContain('border: 1px solid var(--an-tool-border-color);');
    expect(css).toContain('min-height: 28px;');
    expect(css).toContain('max-height: 200px;');
    expect(css).toContain('transition: background-color 150ms');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).not.toMatch(/margin-left:\s*auto|float:\s*right|justify-content:\s*flex-end|background-clip:\s*text/i);
  });
});

describe('Agent Elements framework event renderers', () => {
  it('renders reasoning content as a collapsed thinking card', () => {
    render(
      <AgentThinkingCard
        content="Need to preserve the Daily Driver event contract before live wiring."
        detail="smarty-server"
        status="running"
      />
    );

    const card = screen.getByTestId('agent-elements-thinking-card');
    expect(card).toHaveAttribute('data-tool-status', 'running');
    expect(card).toHaveAttribute('data-component', 'AgentThinkingCard');
    expect(screen.getByTestId('agent-elements-thinking-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('agent-elements-thinking-content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('agent-elements-thinking-toggle'));
    expect(screen.getByTestId('agent-elements-thinking-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('agent-elements-thinking-content')).toHaveTextContent('Daily Driver event contract');
  });

  it('renders MCP tool identity and structured result without primary raw JSON', () => {
    render(
      <AgentMcpToolCard
        args={[
          { key: 'query', value: 'open pull requests' },
          { key: 'limit', value: '5' },
        ]}
        debugPayload={{ hidden: 'raw-mcp-json' }}
        result="Found 3 open pull requests."
        status="completed"
        toolName="mcp__github__search_pull_requests"
      />
    );

    expect(screen.getByTestId('agent-elements-mcp-tool-card')).toHaveAttribute('data-tool-status', 'completed');
    expect(screen.getByTestId('agent-elements-mcp-tool-card')).toHaveAttribute('data-component', 'AgentMcpToolCard');
    expect(screen.getByTestId('agent-elements-mcp-shell')).toHaveTextContent('github');
    expect(screen.getByTestId('agent-elements-mcp-shell')).toHaveTextContent('search_pull_requests');
    expect(screen.getByTestId('agent-elements-mcp-args')).toHaveTextContent('open pull requests');
    expect(screen.getByTestId('agent-elements-mcp-result')).toHaveTextContent('Found 3 open pull requests.');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('raw-mcp-json');
  });

  it('renders pending question prompts with option selection and response history', () => {
    const onSubmit = vi.fn();
    render(
      <AgentQuestionCard
        description="This should preserve the future integration lane."
        onSubmit={onSubmit}
        options={[
          { id: 'bridge', label: 'Use bridge slice', description: 'Record exact overlap files first.' },
          { id: 'wait', label: 'Wait for merge' },
        ]}
        question="How should live transcript wiring proceed?"
        responseHistory={[{ label: 'Previous answer: isolate renderers first', timestamp: '12:04Z' }]}
      />
    );

    expect(screen.getByTestId('agent-elements-question-card')).toHaveAttribute('data-tool-status', 'interrupted');
    expect(screen.getByTestId('agent-elements-question-card')).toHaveAttribute('data-component', 'AgentQuestionCard');
    expect(screen.getByTestId('agent-elements-question-title')).toHaveTextContent('live transcript wiring');
    expect(screen.getAllByTestId('agent-elements-question-option')).toHaveLength(2);
    expect(screen.getByTestId('agent-elements-question-history')).toHaveTextContent('isolate renderers first');

    fireEvent.click(screen.getAllByTestId('agent-elements-question-option')[0]);
    fireEvent.click(screen.getByText('Submit'));
    expect(onSubmit).toHaveBeenCalledWith({ selectedIds: ['bridge'], text: '' });
  });

  it('renders subagent nested activity with progressive event rows', () => {
    render(
      <AgentSubagentCard
        elapsedLabel="11s"
        items={[
          { title: 'Read bridge ledger', detail: 'daily-driver-agent-ux-bridge.md', kind: 'tool', status: 'completed' },
          { title: 'Streamed update', detail: 'preserved accepted contracts', kind: 'message', status: 'running' },
          { title: 'Checkpoint', detail: 'runtime identity UI accepted', kind: 'checkpoint', status: 'completed' },
        ]}
        name="Daily Driver reviewer"
        status="running"
        summary="3 nested events"
      />
    );

    expect(screen.getByTestId('agent-elements-subagent-card')).toHaveAttribute('data-tool-status', 'running');
    expect(screen.getByTestId('agent-elements-subagent-card')).toHaveAttribute('data-component', 'AgentSubagentCard');
    expect(screen.getByTestId('agent-elements-subagent-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByTestId('agent-elements-subagent-item')).toHaveLength(3);
    expect(screen.getByTestId('agent-elements-subagent-list')).toHaveTextContent('runtime identity UI accepted');
  });

  it('copies Agent Elements framework event style constraints', () => {
    const css = fs.readFileSync(frameworkEventsCssPath, 'utf8');

    expect(css).toContain('Derived from Agent Elements by 21st.dev thinking-tool, mcp-tool');
    expect(css).toContain('min-height: 28px;');
    expect(css).toContain('max-height: 175px;');
    expect(css).toContain('border: 1px solid var(--an-tool-border-color);');
    expect(css).toContain('border-radius: var(--an-tool-border-radius);');
    expect(css).toContain('animation-delay: calc(var(--agent-elements-item-index, 0) * 80ms);');
    expect(css).toContain('transition: background-color 150ms');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).not.toMatch(/margin-left:\s*auto|float:\s*right|justify-content:\s*flex-end|background-clip:\s*text/i);
  });
});

describe('Agent Elements stream, state, and status event renderers', () => {
  it('renders progress updates with progressive rows and debug payload isolated', () => {
    render(
      <AgentProgressCard
        debugPayload={{ hidden: 'raw-progress-json' }}
        elapsedLabel="18s"
        label="Applying workspace checks"
        status="running"
        updates={[
          { label: 'Started typecheck', detail: '@nimbalyst/runtime', timestamp: '12:31Z', tone: 'running' },
          { label: 'Renderer fixtures passed', detail: '15 tests', timestamp: '12:32Z', tone: 'success' },
        ]}
      />
    );

    expect(screen.getByTestId('agent-elements-progress-card')).toHaveAttribute('data-tool-status', 'running');
    expect(screen.getByTestId('agent-elements-progress-card')).toHaveAttribute('data-component', 'AgentProgressCard');
    expect(screen.getByTestId('agent-elements-progress-shell')).toHaveTextContent('Applying workspace checks');
    expect(screen.getAllByTestId('agent-elements-progress-update')).toHaveLength(2);
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('raw-progress-json');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
  });

  it('renders LangGraph/LangChain state snapshots as changed-key rows', () => {
    render(
      <AgentStateSnapshotCard
        changedKeys={[
          { key: 'messages', summary: '2 messages appended', before: '4', after: '6' },
          { key: 'next', summary: 'route changed to reviewer' },
        ]}
        namespace="graph:daily-driver"
        title="LangGraph values update"
      />
    );

    expect(screen.getByTestId('agent-elements-state-snapshot-card')).toHaveAttribute('data-component', 'AgentStateSnapshotCard');
    expect(screen.getByTestId('agent-elements-state-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByTestId('agent-elements-state-key-row')).toHaveLength(2);
    expect(screen.getByTestId('agent-elements-state-key-list')).toHaveTextContent('messages');
    expect(screen.getByTestId('agent-elements-state-key-list')).toHaveTextContent('2 messages appended');
  });

  it('renders lifecycle, checkpoint, and task metadata without primary raw JSON', () => {
    render(
      <AgentLifecycleCard
        debugPayload={{ hidden: 'raw-lifecycle-json' }}
        detail="thread run"
        events={[
          { label: 'Queued', detail: 'waiting for approval', status: 'queued', timestamp: '12:30Z' },
          { label: 'Checkpoint saved', detail: 'resume-42', status: 'completed', timestamp: '12:31Z' },
        ]}
        kind="checkpoint"
        name="Daily Driver final proof"
        resumeId="resume-42"
        status="interrupted"
      />
    );

    const card = screen.getByTestId('agent-elements-lifecycle-card');
    expect(card).toHaveAttribute('data-component', 'AgentLifecycleCard');
    expect(card).toHaveAttribute('data-lifecycle-kind', 'checkpoint');
    expect(card).toHaveAttribute('data-tool-status', 'interrupted');
    expect(screen.getAllByTestId('agent-elements-lifecycle-event')).toHaveLength(2);
    expect(screen.getByTestId('agent-elements-lifecycle-events')).toHaveTextContent('resume-42');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('raw-lifecycle-json');
  });

  it('renders turn summary metrics and context warnings', () => {
    render(
      <AgentTurnSummaryCard
        contextUsagePercent={86.2}
        durationLabel="1m 12s"
        usage={{ input: 18420, output: 2110, total: 20530 }}
        warnings={['Context usage is high.']}
      />
    );

    expect(screen.getByTestId('agent-elements-turn-summary-card')).toHaveAttribute('data-component', 'AgentTurnSummaryCard');
    expect(screen.getByTestId('agent-elements-turn-summary-metrics')).toHaveTextContent('18,420');
    expect(screen.getByTestId('agent-elements-turn-summary-metrics')).toHaveTextContent('86% context');
    expect(screen.getByTestId('agent-elements-turn-summary-warnings')).toHaveTextContent('Context usage is high.');
  });

  it('renders provider/runtime errors with action buttons and selectable details', () => {
    const onRetry = vi.fn();
    render(
      <AgentErrorCard
        actions={[{ label: 'Retry', onClick: onRetry }]}
        detail="The configured provider returned 429 after the retry window."
        kind="rate_limit"
        message="Wait before sending another request."
        title="Provider rate limit"
      />
    );

    expect(screen.getByTestId('agent-elements-error-card')).toHaveAttribute('data-component', 'AgentErrorCard');
    expect(screen.getByTestId('agent-elements-error-card')).toHaveAttribute('data-error-kind', 'rate_limit');
    expect(screen.getByTestId('agent-elements-error-message')).toHaveTextContent('Wait before sending another request.');
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('copies Agent Elements stream event style constraints', () => {
    const css = fs.readFileSync(streamEventsCssPath, 'utf8');

    expect(css).toContain('Derived from Agent Elements by 21st.dev generic-tool, error-message');
    expect(css).toContain('min-height: 28px;');
    expect(css).toContain('border: 1px solid var(--an-tool-border-color);');
    expect(css).toContain('border-radius: var(--an-tool-border-radius);');
    expect(css).toContain('animation-delay: calc(var(--agent-elements-stream-index, 0) * 60ms);');
    expect(css).toContain('transition: background-color 150ms');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('user-select: text');
    expect(css).not.toMatch(/margin-left:\s*auto|float:\s*right|justify-content:\s*flex-end|background-clip:\s*text/i);
  });
});

describe('Agent Elements message and generic event renderers', () => {
  it('renders user message bodies with attachments in the left-aligned transcript row', () => {
    render(
      <AgentTranscriptRow role="user" name="Paul">
        <AgentUserMessageBody
          attachments={[
            { name: 'daily-driver-agent-ux-bridge.md', detail: 'coordination', kind: 'file' },
            { name: 'proof-summary.png', detail: '48 KB', kind: 'image', thumbnailUrl: 'data:image/png;base64,abc' },
          ]}
          content="Keep the bridge quiet and only use it when it changes integration work."
          isPartial
        />
      </AgentTranscriptRow>
    );

    expect(screen.getByTestId('agent-elements-transcript-row')).toHaveAttribute('data-agent-align', 'left');
    expect(screen.getByTestId('agent-elements-user-message-body')).toHaveAttribute('data-component', 'AgentUserMessageBody');
    expect(screen.getByTestId('agent-elements-user-message-text')).toHaveTextContent('Keep the bridge quiet');
    expect(screen.getAllByTestId('agent-elements-user-attachment')).toHaveLength(2);
    expect(screen.getByTestId('agent-elements-user-attachments')).toHaveTextContent('daily-driver-agent-ux-bridge.md');
    expect(screen.getByTestId('agent-elements-user-message-body')).toHaveAttribute('data-streaming', 'true');
    expect(screen.getByTestId('agent-elements-user-message-body')).not.toHaveTextContent('"attachments"');
  });

  it('renders assistant markdown blocks with streaming state and selectable code', () => {
    render(
      <AgentMarkdown
        blocks={[
          { type: 'paragraph', content: 'The runtime adapter remains isolated.' },
          { type: 'list', items: ['Preserve event contracts', 'Avoid raw JSON primary UI'] },
          { type: 'code', language: 'ts', content: 'export const ok = true;' },
        ]}
        isStreaming
      />
    );

    expect(screen.getByTestId('agent-elements-markdown')).toHaveAttribute('data-component', 'AgentMarkdown');
    expect(screen.getByTestId('agent-elements-markdown')).toHaveAttribute('data-streaming', 'true');
    expect(screen.getByTestId('agent-elements-markdown')).toHaveTextContent('The runtime adapter remains isolated.');
    expect(screen.getByTestId('agent-elements-markdown-list')).toHaveTextContent('Preserve event contracts');
    expect(screen.getByTestId('agent-elements-markdown-code')).toHaveTextContent('export const ok = true;');
    expect(screen.getByTestId('agent-elements-markdown')).not.toHaveTextContent('"type"');
  });

  it('renders system and provider errors as typed message cards without primary raw payloads', () => {
    render(
      <AgentErrorMessage
        debugPayload={{ hidden: 'raw-system-error-json' }}
        detail="CLIProxyAPI returned a degraded runtime state."
        kind="service_error"
        message="Runtime health is degraded."
        title="Runtime health"
      />
    );

    const card = screen.getByTestId('agent-elements-error-message-card');
    expect(card).toHaveAttribute('data-component', 'AgentErrorMessage');
    expect(card).toHaveAttribute('data-error-kind', 'service_error');
    expect(screen.getByTestId('agent-elements-error-message-body')).toHaveTextContent('Runtime health is degraded.');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('raw-system-error-json');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
  });

  it('renders generic structured tools with metadata chips and collapsed debug payloads', () => {
    render(
      <AgentGenericToolCard
        debugPayload={{ hidden: 'raw-generic-json' }}
        metadata={[
          { label: 'source', value: 'extension' },
          { label: 'records', value: 12 },
        ]}
        result="Generated a compact extension summary."
        status="completed"
        summary="A known generic record rendered as summary chips."
        title="Extension summary"
      />
    );

    expect(screen.getByTestId('agent-elements-generic-tool-card')).toHaveAttribute('data-component', 'AgentGenericToolCard');
    expect(screen.getByTestId('agent-elements-generic-summary')).toHaveTextContent('A known generic record');
    expect(screen.getAllByTestId('agent-elements-generic-metadata-chip')).toHaveLength(2);
    expect(screen.getByTestId('agent-elements-generic-result')).toHaveTextContent('Generated a compact extension summary.');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('raw-generic-json');
  });

  it('renders extension/custom events through a supported generic surface', () => {
    render(
      <AgentExtensionEventCard
        eventName="workspace.validation.stale"
        metadata={[{ label: 'workspace', value: 'nimbalyst' }]}
        source="TrackerMode"
        status="running"
        summary="Validation status changed to stale."
      />
    );

    expect(screen.getByTestId('agent-elements-extension-event-card')).toHaveAttribute('data-component', 'AgentExtensionEventCard');
    expect(screen.getByTestId('agent-elements-extension-event-card')).toHaveAttribute('data-extension-event', 'workspace.validation.stale');
    expect(screen.getByTestId('agent-elements-extension-source')).toHaveTextContent('TrackerMode');
    expect(screen.getByTestId('agent-elements-extension-event-card')).not.toHaveTextContent('"eventName"');
  });

  it('copies Agent Elements message and generic renderer style constraints', () => {
    const css = fs.readFileSync(messagesCssPath, 'utf8');

    expect(css).toContain('Derived from Agent Elements by 21st.dev user-message, markdown, error-message, and generic-tool');
    expect(css).toContain('text-align: left;');
    expect(css).toContain('border: 1px solid var(--an-tool-border-color);');
    expect(css).toContain('border-radius: var(--an-tool-border-radius);');
    expect(css).toContain('border-radius: var(--an-message-border-radius);');
    expect(css).toContain('max-width: min(100%, var(--an-max-width));');
    expect(css).toContain('animation-delay: calc(var(--agent-elements-message-index, 0) * 60ms);');
    expect(css).toContain('transition: background-color 150ms');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('user-select: text');
    expect(css).not.toMatch(/margin-left:\s*auto|float:\s*right|justify-content:\s*flex-end|background-clip:\s*text/i);
  });
});

describe('Agent Elements renderer registry', () => {
  it('routes normalized event models to first-class renderers and debug-only unknown fallbacks', () => {
    expect(knownAgentElementsRendererKinds).toEqual([
      'userMessage',
      'assistantMessage',
      'thinking',
      'systemStatus',
      'toolLifecycle',
      'toolProgress',
      'bash',
      'fileEdit',
      'search',
      'mcp',
      'genericTool',
      'humanInput',
      'plan',
      'todo',
      'subagent',
      'stateUpdate',
      'checkpointTaskDebug',
      'extensionEvent',
      'turnSummary',
    ]);

    for (const kind of knownAgentElementsRendererKinds) {
      expect(getAgentElementsRendererDescriptor({ kind, title: kind }).fallbackClass).toBe('known');
    }

    const { rerender } = render(
      <AgentElementsEventRenderer
        model={{
          kind: 'todo',
          title: 'Todos updated',
          status: 'running',
          todos: [
            { content: 'Create renderer registry', status: 'completed' },
            { content: 'Keep live transcript wiring isolated', status: 'in_progress' },
          ],
        }}
      />
    );

    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-component', 'AgentElementsEventRenderer');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'todo');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-fallback-class', 'known');
    expect(screen.getByTestId('agent-elements-todo-list')).toHaveTextContent('Create renderer registry');
    expect(screen.getByTestId('agent-elements-todo-list')).not.toHaveTextContent('"todos"');

    rerender(
      <AgentElementsEventRenderer
        model={{
          kind: 'workspace.unrecognized',
          title: 'Unsupported workspace event',
          body: 'A readable unsupported-event warning stays visible.',
          rawPayload: { hidden: 'raw-unknown-json' },
        }}
      />
    );

    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-renderer-kind', 'unsupported');
    expect(screen.getByTestId('agent-elements-renderer-boundary')).toHaveAttribute('data-fallback-class', 'unsupported');
    expect(screen.getByTestId('agent-elements-generic-tool-card')).toHaveTextContent('Unsupported event');
    expect(screen.getByTestId('agent-elements-tool-primary')).toHaveTextContent('A readable unsupported-event warning');
    expect(screen.getByTestId('agent-elements-tool-primary')).not.toHaveTextContent('raw-unknown-json');
    expect(screen.getByTestId('agent-elements-debug-disclosure')).toHaveAttribute('data-debug-only', 'true');
  });

  it('renders one generated fixture per registry kind through the registry boundary', () => {
    const fixtures = readRendererFixtureData();
    const fixturesByKind = new Map<string, RendererFixture>();
    for (const fixture of fixtures) {
      if (!fixturesByKind.has(fixture.primary.kind)) {
        fixturesByKind.set(fixture.primary.kind, fixture);
      }
    }

    expect([...fixturesByKind.keys()].sort()).toEqual([...knownAgentElementsRendererKinds].sort());

    for (const kind of knownAgentElementsRendererKinds) {
      const fixture = fixturesByKind.get(kind);
      expect(fixture, `Missing generated fixture for ${kind}`).toBeDefined();
      if (!fixture) continue;

      const rawMarker = `raw-fixture-json-${fixture.id}`;
      const { unmount } = render(<AgentElementsEventRenderer model={fixtureToModel(fixture)} />);
      const boundary = screen.getByTestId('agent-elements-renderer-boundary');

      expect(boundary).toHaveAttribute('data-renderer-kind', kind);
      expect(boundary).toHaveAttribute('data-fallback-class', 'known');
      expect(boundary).not.toHaveTextContent('Unsupported event');

      for (const primaryRegion of [
        ...screen.queryAllByTestId('agent-elements-tool-primary'),
        ...screen.queryAllByTestId('agent-elements-transcript-content'),
        ...screen.queryAllByTestId('agent-elements-todo-list'),
        ...screen.queryAllByTestId('agent-elements-plan-card'),
      ]) {
        expect(primaryRegion).not.toHaveTextContent(rawMarker);
      }

      unmount();
    }
  });
});
