import React, { useMemo } from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  const renderedParts = useMemo(() => {
    const raw = String(text || '');
    // Split on display math $$...$$ or \[...\] and inline math $...$ or \(...\)
    const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;
    const parts: Array<{ type: 'text' | 'math'; content: string; display: boolean }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: raw.slice(lastIndex, match.index), display: false });
      }
      const token = match[0];
      let expr = token;
      let display = false;
      if (token.startsWith('$$') && token.endsWith('$$')) {
        expr = token.slice(2, -2);
        display = true;
      } else if (token.startsWith('\\[') && token.endsWith('\\]')) {
        expr = token.slice(2, -2);
        display = true;
      } else if (token.startsWith('$') && token.endsWith('$')) {
        expr = token.slice(1, -1);
      } else if (token.startsWith('\\(') && token.endsWith('\\)')) {
        expr = token.slice(2, -2);
      }
      parts.push({ type: 'math', content: expr, display });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < raw.length) {
      parts.push({ type: 'text', content: raw.slice(lastIndex), display: false });
    }
    return parts;
  }, [text]);

  return (
    <span className={className}>
      {renderedParts.map((part, idx) => {
        if (part.type === 'text') {
          const lines = part.content.split('\n');
          return (
            <React.Fragment key={idx}>
              {lines.map((line, lIdx) => (
                <React.Fragment key={lIdx}>
                  {line}
                  {lIdx < lines.length - 1 && <br />}
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        }
        try {
          const html = katex.renderToString(part.content, {
            displayMode: part.display,
            throwOnError: false,
          });
          return (
            <span
              key={idx}
              className={part.display ? 'block my-2 overflow-x-auto' : 'inline-block align-middle'}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={idx}>{part.content}</span>;
        }
      })}
    </span>
  );
};
