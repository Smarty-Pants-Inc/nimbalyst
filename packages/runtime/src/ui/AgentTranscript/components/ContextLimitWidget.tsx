import React, { useState } from 'react';
import { AgentStatusPill, AgentToolCard } from '../../AgentElements';
import {
  SPECIAL_STATUS_ACTIONS_CLASS,
  SPECIAL_STATUS_BODY_CLASS,
  SPECIAL_STATUS_INLINE_PRIMARY_BUTTON_CLASS,
} from './SpecialStatusWidgetChrome';

interface ContextLimitWidgetProps {
  sessionId?: string;
  isLastMessage?: boolean; // Only show compact button on the last message
  onCompact?: () => void; // Callback to trigger /compact command
}

export const ContextLimitWidget: React.FC<ContextLimitWidgetProps> = ({ sessionId, isLastMessage = false, onCompact }) => {
  const [isCompacting, setIsCompacting] = useState(false);

  const handleCompact = () => {
    setIsCompacting(true);
    onCompact?.();
  };

  return (
    <AgentToolCard
      className="context-limit-widget"
      data-agent-elements-shell="context-limit"
      data-component="ContextLimitWidget"
      data-testid="agent-elements-context-limit-widget"
      icon={<span className="context-limit-icon text-[var(--an-diff-removed-text)]">!</span>}
      status="error"
      title="Context limit exceeded"
      trailing={<AgentStatusPill tone="error">Action needed</AgentStatusPill>}
      footer={isLastMessage ? (
        <div className={`context-limit-actions ${SPECIAL_STATUS_ACTIONS_CLASS}`} data-interactive="true">
          <button
            onClick={handleCompact}
            disabled={isCompacting}
            className={`compact-button ${SPECIAL_STATUS_INLINE_PRIMARY_BUTTON_CLASS}`}
          >
            {isCompacting ? 'Compacting...' : 'Compact'}
          </button>
        </div>
      ) : undefined}
    >
      <div className={`context-limit-message ${SPECIAL_STATUS_BODY_CLASS}`}>
        {isLastMessage
          ? 'This conversation has grown too large for the model\'s context window. Compact the conversation history to continue.'
          : 'This conversation exceeded the model\'s context window at this point.'}
      </div>
    </AgentToolCard>
  );
};
