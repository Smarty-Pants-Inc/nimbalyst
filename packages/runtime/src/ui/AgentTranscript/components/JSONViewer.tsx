import React from 'react';
import '../../AgentElements/AgentElementsPrimitives.css';

interface JSONViewerProps {
  data: unknown;
  maxHeight?: string;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function maxHeightClass(maxHeight: string): string {
  switch (maxHeight) {
    case '12rem':
      return 'agent-elements-json-viewer--max-12rem';
    case '20rem':
      return 'agent-elements-json-viewer--max-20rem';
    case '24rem':
      return 'agent-elements-json-viewer--max-24rem';
    case '16rem':
    default:
      return 'agent-elements-json-viewer--max-16rem';
  }
}

function quoted(value: string): string {
  return JSON.stringify(value);
}

export const JSONViewer: React.FC<JSONViewerProps> = ({ data, maxHeight = '16rem' }) => {
  const formatJSON = (obj: unknown): JSX.Element => {
    let keyCounter = 0;
    const getUniqueKey = (prefix: string) => `${prefix}-${keyCounter++}`;

    const renderValue = (value: unknown, indent = 0): JSX.Element[] => {
      const indentStr = '  '.repeat(indent);
      const elements: JSX.Element[] = [];

      if (value === null) {
        elements.push(<span key={getUniqueKey('null')} className="json-null">null</span>);
      } else if (typeof value === 'boolean') {
        elements.push(<span key={getUniqueKey('bool')} className="json-boolean">{String(value)}</span>);
      } else if (typeof value === 'number') {
        elements.push(<span key={getUniqueKey('num')} className="json-number">{value}</span>);
      } else if (typeof value === 'string') {
        elements.push(<span key={getUniqueKey('str')} className="json-string">{quoted(value)}</span>);
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          elements.push(<span key={getUniqueKey('arr')}>[]</span>);
        } else {
          elements.push(<span key={getUniqueKey('arr-open')} className="json-bracket">[</span>);
          elements.push(<br key={getUniqueKey('br')} />);
          value.forEach((item, idx) => {
            elements.push(<span key={getUniqueKey('indent')}>{indentStr}  </span>);
            elements.push(...renderValue(item, indent + 1));
            if (idx < value.length - 1) {
              elements.push(<span key={getUniqueKey('comma')} className="json-punctuation">,</span>);
            }
            elements.push(<br key={getUniqueKey('br')} />);
          });
          elements.push(<span key={getUniqueKey('indent')}>{indentStr}</span>);
          elements.push(<span key={getUniqueKey('arr-close')} className="json-bracket">]</span>);
        }
      } else if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const keys = Object.keys(record);
        if (keys.length === 0) {
          elements.push(<span key={getUniqueKey('obj')}>{'{}'}</span>);
        } else {
          elements.push(<span key={getUniqueKey('obj-open')} className="json-bracket">{'{'}</span>);
          elements.push(<br key={getUniqueKey('br')} />);
          keys.forEach((key, idx) => {
            elements.push(<span key={getUniqueKey('indent')}>{indentStr}  </span>);
            elements.push(<span key={getUniqueKey('key')} className="json-key">{quoted(key)}</span>);
            elements.push(<span key={getUniqueKey('colon')} className="json-punctuation">: </span>);
            elements.push(...renderValue(record[key], indent + 1));
            if (idx < keys.length - 1) {
              elements.push(<span key={getUniqueKey('comma')} className="json-punctuation">,</span>);
            }
            elements.push(<br key={getUniqueKey('br')} />);
          });
          elements.push(<span key={getUniqueKey('indent')}>{indentStr}</span>);
          elements.push(<span key={getUniqueKey('obj-close')} className="json-bracket">{'}'}</span>);
        }
      } else if (typeof value === 'undefined') {
        elements.push(<span key={getUniqueKey('undefined')} className="json-null">undefined</span>);
      } else {
        elements.push(<span key={getUniqueKey('fallback')} className="json-string">{String(value)}</span>);
      }

      return elements;
    };

    return <>{renderValue(obj)}</>;
  };

  return (
    <pre
      className={classNames(
        'json-viewer agent-elements-json-viewer agent-elements-debug-payload',
        maxHeightClass(maxHeight),
      )}
      data-agent-elements-shell="json-viewer"
      data-component="JSONViewer"
      data-debug-only="true"
      data-testid="agent-elements-json-viewer"
    >
      {formatJSON(data)}
    </pre>
  );
};
