import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { MarkdownRenderer } from './MarkdownRenderer';

const COLLAPSE_THRESHOLD = 30;
const COLLAPSED_LINES = 20;

const NEW_FILE_PREVIEW_ROOT_CLASS =
  'new-file-preview agent-elements-new-file-preview flex flex-col overflow-hidden rounded-[var(--an-tool-border-radius)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] text-[var(--an-tool-color)]';
const NEW_FILE_PREVIEW_HEADER_CLASS =
  'agent-elements-new-file-preview-header flex shrink-0 items-center gap-[var(--an-spacing-sm)] border-b border-[var(--an-tool-border-color)] bg-[var(--an-background-tertiary)] px-[var(--an-spacing-md)] py-[var(--an-spacing-sm)] text-[0.7rem] font-medium text-[var(--an-tool-color-muted)]';
const NEW_FILE_PREVIEW_PATH_BUTTON_CLASS =
  'agent-elements-new-file-preview-path min-w-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left font-mono text-[var(--an-primary-color)] no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]';
const NEW_FILE_PREVIEW_ACTION_BUTTON_CLASS =
  'agent-elements-new-file-preview-action rounded-[var(--an-radius-sm)] border border-[var(--an-tool-border-color)] bg-[var(--an-tool-background)] px-[var(--an-spacing-md)] py-[var(--an-spacing-xs)] text-xs font-medium text-[var(--an-primary-color)] cursor-pointer motion-safe:transition-colors motion-safe:duration-150 hover:bg-[var(--an-background-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]';
const NEW_FILE_PREVIEW_COLLAPSE_BUTTON_CLASS =
  'agent-elements-new-file-preview-collapse border-0 bg-transparent px-[var(--an-spacing-sm)] py-[var(--an-spacing-xs)] text-xs text-[var(--an-foreground-muted)] cursor-pointer motion-safe:transition-colors motion-safe:duration-150 hover:text-[var(--an-tool-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-input-focus-outline)]';

const extensionToLanguage: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  py: 'python', rb: 'ruby', rs: 'rust', go: 'go',
  java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  css: 'css', scss: 'scss', less: 'less',
  html: 'html', xml: 'xml', svg: 'svg',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  sql: 'sql', graphql: 'graphql',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  dockerfile: 'docker',
};

const markdownExtensions = new Set(['md', 'mdx', 'markdown']);

/** Strip YAML frontmatter (---\n...\n---) from markdown content */
function stripFrontmatter(text: string): string {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  return text.slice(end + 4).trimStart();
}

function getFileInfo(filePath?: string): { language: string; isMarkdown: boolean } {
  if (!filePath) return { language: '', isMarkdown: false };
  const filename = filePath.split('/').pop()?.toLowerCase() || '';
  if (filename === 'dockerfile') return { language: 'docker', isMarkdown: false };
  if (filename === 'makefile') return { language: 'makefile', isMarkdown: false };
  const ext = filename.split('.').pop() || '';
  if (markdownExtensions.has(ext)) return { language: 'markdown', isMarkdown: true };
  return { language: extensionToLanguage[ext] || '', isMarkdown: false };
}

interface NewFilePreviewProps {
  content: string;
  filePath?: string;
  maxHeight?: string;
  onOpenFile?: (filePath: string) => void;
  absoluteFilePath?: string;
}

export const NewFilePreview: React.FC<NewFilePreviewProps> = ({
  content,
  filePath,
  maxHeight = '18rem',
  onOpenFile,
  absoluteFilePath,
}) => {
  const lines = content.split('\n');
  const lineCount = lines.length;
  const isLong = lineCount > COLLAPSE_THRESHOLD;
  const [isCollapsed, setIsCollapsed] = useState(isLong);
  const { language, isMarkdown } = getFileInfo(filePath);

  const displayContent = isCollapsed ? lines.slice(0, COLLAPSED_LINES).join('\n') : content;

  const pathToOpen = absoluteFilePath || filePath;
  const isClickable = !!(onOpenFile && pathToOpen);

  const handleOpenFile = (e: React.MouseEvent) => {
    if (isClickable) {
      e.preventDefault();
      onOpenFile!(pathToOpen!);
    }
  };

  return (
    <div
      className={NEW_FILE_PREVIEW_ROOT_CLASS}
      data-testid="agent-elements-new-file-preview"
      data-component="NewFilePreview"
      data-agent-elements-shell="new-file-preview"
    >
      {/* File header */}
      {filePath && (
        <div className={NEW_FILE_PREVIEW_HEADER_CLASS}>
          {isClickable ? (
            <button
              className={NEW_FILE_PREVIEW_PATH_BUTTON_CLASS}
              onClick={handleOpenFile}
              aria-label={`Open ${filePath}`}
              title={`Open ${pathToOpen}`}
              type="button"
            >
              {filePath}
            </button>
          ) : (
            <span className="agent-elements-new-file-preview-path min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono">{filePath}</span>
          )}
          <span
            className="ml-auto shrink-0 text-[var(--an-foreground-subtle)]"
            data-testid="agent-elements-new-file-preview-line-count"
          >
            {lineCount} lines
          </span>
        </div>
      )}

      {/* Content - constrained when collapsed, full height when expanded */}
      <div className="relative" style={isCollapsed ? { maxHeight, overflow: 'hidden' } : undefined}>
        {isMarkdown ? (
          <div className="p-[var(--an-spacing-md)]">
            <MarkdownRenderer content={stripFrontmatter(displayContent)} />
          </div>
        ) : (
          <div className="markdown-content agent-elements-new-file-preview-code text-[var(--an-code-color)]">
            <SyntaxHighlighter
              style={{} as any}
              customStyle={{
                backgroundColor: 'var(--an-code-background)',
                color: 'var(--an-code-color)',
                padding: 'var(--an-spacing-sm) var(--an-spacing-md)',
                margin: 0,
                fontSize: '0.8125rem',
                lineHeight: '1.5',
              }}
              language={language || undefined}
              PreTag="div"
              codeTagProps={{
                style: {
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 'inherit',
                  background: 'none',
                },
              }}
            >
              {displayContent}
            </SyntaxHighlighter>
          </div>
        )}

        {/* Gradient fade when collapsed */}
        {isCollapsed && (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2"
            style={{
              height: '4rem',
              background: 'linear-gradient(to bottom, transparent, var(--an-tool-background))',
            }}
          >
            <button
              onClick={() => setIsCollapsed(false)}
              className={NEW_FILE_PREVIEW_ACTION_BUTTON_CLASS}
              aria-label={`Show all ${lineCount} lines`}
              type="button"
            >
              Show all {lineCount} lines
            </button>
          </div>
        )}
      </div>

      {/* Collapse button when expanded and file is long */}
      {!isCollapsed && isLong && (
        <div className="flex justify-center border-t border-[var(--an-tool-border-color)] py-[var(--an-spacing-xs)]">
          <button
            onClick={() => setIsCollapsed(true)}
            className={NEW_FILE_PREVIEW_COLLAPSE_BUTTON_CLASS}
            aria-label="Collapse new file preview"
            type="button"
          >
            Collapse
          </button>
        </div>
      )}
    </div>
  );
};
