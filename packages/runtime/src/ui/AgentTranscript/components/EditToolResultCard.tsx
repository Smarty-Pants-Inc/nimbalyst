import React from 'react';
import type { TranscriptViewMessage } from '../../../ai/server/transcript/TranscriptProjector';
import { DiffViewer } from './DiffViewer';
import { NewFilePreview } from './NewFilePreview';
import { toProjectRelative, shortenPath } from '../utils/pathResolver';
import { formatToolDisplayName } from '../utils/toolNameFormatter';
import { MaterialSymbol } from '../../icons/MaterialSymbol';
import '../../AgentElements/AgentElementsPrimitives.css';
import '../../AgentElements/AgentElementsToolRenderers.css';

const EDIT_TOOL_CARD_ROOT_CLASS =
  'rich-transcript-edit-card agent-elements-edit-tool-card agent-elements-tool-card';
const EDIT_TOOL_TITLE_CLASS =
  'rich-transcript-edit-card__title agent-elements-tool-title flex flex-wrap items-baseline gap-1';
const EDIT_TOOL_SEPARATOR_CLASS =
  'rich-transcript-edit-card__file-separator mx-1 text-[var(--an-foreground-subtle)]';
const EDIT_TOOL_FILE_LINK_CLASS =
  'rich-transcript-edit-card__file-link cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] text-[var(--an-primary-color)] no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]';
const EDIT_TOOL_FILE_TEXT_CLASS =
  'rich-transcript-edit-card__file font-normal text-[var(--an-tool-color-muted)]';
const EDIT_TOOL_META_CLASS =
  'rich-transcript-edit-card__meta agent-elements-tool-subtitle flex items-center gap-[var(--an-spacing-xs)]';
const EDIT_TOOL_OPEN_BUTTON_CLASS =
  'rich-transcript-edit-card__open-button flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-radius-sm)] border-0 bg-transparent p-0 text-[var(--an-foreground-muted)] motion-safe:transition-colors motion-safe:duration-150 hover:bg-[var(--an-background-secondary)] hover:text-[var(--an-primary-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]';
const EDIT_TOOL_INSTRUCTION_CLASS =
  'rich-transcript-edit-card__instruction whitespace-pre-wrap break-words rounded-[var(--an-radius-sm)] bg-[var(--an-background-tertiary)] p-[var(--an-spacing-sm)] text-[0.8rem] leading-[1.5] text-[var(--an-tool-color-muted)]';
const EDIT_TOOL_STACK_CLASS =
  'flex flex-col gap-[var(--an-spacing-sm)]';

/** Returns true if the edit represents a new file creation (content only, no diff) */
const isNewFileEdit = (edit: any): boolean => {
  if (!edit.content || typeof edit.content !== 'string') return false;
  if (edit.old_string || edit.new_string || edit.oldText || edit.newText) return false;
  if (Array.isArray(edit.replacements) && edit.replacements.length > 0) return false;
  return true;
};

interface EditToolResultCardProps {
  toolMessage: TranscriptViewMessage;
  edits: any[];
  workspacePath?: string;
  onOpenFile?: (filePath: string) => void;
  renderEmbeddedFile?: (params: { filePath: string; defaultExpanded?: boolean }) => React.ReactNode;
  /**
   * Host-provided predicate: returns true if `filePath` will be rendered
   * by `renderEmbeddedFile` so this card can suppress the redundant
   * diff/new-file view in favor of the inline preview. The host knows
   * its custom editor registry; the runtime does not, so we ask.
   */
  canEmbedFile?: (filePath: string) => boolean;
}

const resolveEditFilePath = (edit: any, toolMessage: TranscriptViewMessage): string | undefined => {
  if (!edit) return undefined;
  const tool = toolMessage.toolCall;
  return (
    edit.filePath ||
    edit.file_path ||
    edit.targetFilePath ||
    tool?.targetFilePath ||
    tool?.arguments?.file_path ||
    tool?.arguments?.filePath ||
    tool?.arguments?.path
  );
};

const getInstructionText = (toolMessage: TranscriptViewMessage): string => {
  const args = toolMessage.toolCall?.arguments;
  if (!args) return '';
  if (typeof args.instructions === 'string') return args.instructions;
  if (typeof args.instruction === 'string') return args.instruction;
  return '';
};

const truncateInstruction = (text: string, maxLength = 320) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
};

export const EditToolResultCard: React.FC<EditToolResultCardProps> = ({
  toolMessage,
  edits,
  workspacePath,
  onOpenFile,
  renderEmbeddedFile,
  canEmbedFile,
}) => {
  const isEmbeddable = (filePath?: string) =>
    typeof filePath === 'string' && !!canEmbedFile?.(filePath);
  const tool = toolMessage.toolCall;
  if (!tool || edits.length === 0) {
    return null;
  }

  const firstEditPath = resolveEditFilePath(edits[0], toolMessage);
  const displayPath = firstEditPath ? toProjectRelative(firstEditPath, workspacePath) : '';
  const prettyPath = displayPath ? shortenPath(displayPath, 64) : '';
  const toolDisplayName = formatToolDisplayName(tool.toolName || '') || tool.toolName || 'Edit';

  const instruction = truncateInstruction(getInstructionText(toolMessage));
  const allNewFiles = edits.every(isNewFileEdit);
  const statusLabel = toolMessage.isError ? 'Failed' : allNewFiles ? 'Created' : 'Applied';
  const statusClass = toolMessage.isError ? 'error' : 'success';
  const editCountLabel = allNewFiles
    ? `${edits[0].content.split('\n').length} lines`
    : edits.length === 1 ? '1 edit' : `${edits.length} edits`;
  const previewFilePaths = Array.from(new Set(
    edits
      .map((edit) => resolveEditFilePath(edit, toolMessage))
      .filter((filePath): filePath is string => !!filePath && isEmbeddable(filePath))
  ));

  const handleOpenFile = () => {
    if (firstEditPath && onOpenFile) {
      onOpenFile(firstEditPath);
    }
  };

  return (
    <div
      className={EDIT_TOOL_CARD_ROOT_CLASS}
      data-component="RichTranscriptAgentElementsEditCard"
      data-testid="rich-transcript-agent-elements-edit-card"
      data-agent-elements-shell="edit-tool-card"
    >
      <div className="rich-transcript-edit-card__header agent-elements-tool-header">
        <div className="rich-transcript-edit-card__icon agent-elements-tool-icon" aria-hidden="true">
          <MaterialSymbol icon={allNewFiles ? "note_add" : "edit"} size={16} />
        </div>
        <div className="rich-transcript-edit-card__details agent-elements-tool-title-group">
          <div className={EDIT_TOOL_TITLE_CLASS}>
            {toolDisplayName}
            {prettyPath && (
              <>
                <span className={EDIT_TOOL_SEPARATOR_CLASS}>·</span>
                {firstEditPath && onOpenFile ? (
                  <button
                    className={EDIT_TOOL_FILE_LINK_CLASS}
                    onClick={handleOpenFile}
                    aria-label={`Open ${prettyPath}`}
                    title={`Open ${firstEditPath}`}
                    type="button"
                  >
                    {prettyPath}
                  </button>
                ) : (
                  <span className={EDIT_TOOL_FILE_TEXT_CLASS}>{prettyPath}</span>
                )}
              </>
            )}
          </div>
          <div className={EDIT_TOOL_META_CLASS}>
            <span>{editCountLabel}</span>
            {instruction && <span className="rich-transcript-edit-card__meta-divider text-[var(--an-foreground-subtle)]">•</span>}
            {instruction && <span>Instruction</span>}
          </div>
        </div>
        {firstEditPath && onOpenFile && (
          <button
            className={EDIT_TOOL_OPEN_BUTTON_CLASS}
            onClick={handleOpenFile}
            title="Open file"
            aria-label="Open file"
            type="button"
          >
            <MaterialSymbol icon="open_in_new" size={14} />
          </button>
        )}
        <span
          className={`rich-transcript-edit-card__status rich-transcript-edit-card__status--${statusClass} agent-elements-status-pill`}
          data-tone={statusClass}
        >
          {statusLabel}
        </span>
      </div>

      {instruction && (
        <div className={EDIT_TOOL_INSTRUCTION_CLASS}>
          {instruction}
        </div>
      )}

      <div className={`rich-transcript-edit-card__diffs ${EDIT_TOOL_STACK_CLASS}`}>
        {edits.map((edit, idx) => {
          const absolutePath = resolveEditFilePath(edit, toolMessage);
          const relativePath = absolutePath ? toProjectRelative(absolutePath, workspacePath) : undefined;
          const shouldUseEmbeddedPreview = !!renderEmbeddedFile && isEmbeddable(absolutePath);

          if (shouldUseEmbeddedPreview) {
            return null;
          }

          if (isNewFileEdit(edit)) {
            return (
              <React.Fragment key={`new-${idx}`}>
                <NewFilePreview
                  content={edit.content}
                  filePath={relativePath || absolutePath}
                  maxHeight="18rem"
                  onOpenFile={onOpenFile}
                  absoluteFilePath={absolutePath}
                />
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={`edit-${idx}`}>
              <DiffViewer
                edit={edit}
                filePath={relativePath || absolutePath}
                maxHeight="18rem"
                onOpenFile={onOpenFile}
                absoluteFilePath={absolutePath}
              />
            </React.Fragment>
          );
        })}
      </div>

      {renderEmbeddedFile && previewFilePaths.length > 0 && (
        <div className={`rich-transcript-edit-card__previews ${EDIT_TOOL_STACK_CLASS}`}>
          {previewFilePaths.map((filePath) => (
            <React.Fragment key={filePath}>
              {renderEmbeddedFile({ filePath, defaultExpanded: allNewFiles })}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
