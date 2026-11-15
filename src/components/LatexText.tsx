import React from 'react';
import katex from 'katex';

interface LatexTextProps {
  text: string;
  className?: string;
}

type MathSegment =
  | { kind: 'text'; value: string }
  | { kind: 'inline'; value: string }
  | { kind: 'display'; value: string };

/**
 * Splits text into plain text, inline math ($...$ or \(...\)), and display math ($$...$$ or \[...\]).
 */
export function parseLatexSegments(input: string): MathSegment[] {
  if (!input) return [];

  // Match $$...$$, \[...\], \(...\), or single-line $...$ (avoiding escaped \$)
  const tokenRegex =
    /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|(?<!\\)\$(?!\s)([^$\n]+?)(?<!\s|\\)\$|(?<!\\)\$([^$\n]{1})\$(?!\$))/g;

  const segments: MathSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        kind: 'text',
        value: input.slice(lastIndex, match.index),
      });
    }

    const token = match[0];
    if (token.startsWith('$$') && token.endsWith('$$')) {
      segments.push({
        kind: 'display',
        value: token.slice(2, -2).trim(),
      });
    } else if (token.startsWith('\\[') && token.endsWith('\\]')) {
      segments.push({
        kind: 'display',
        value: token.slice(2, -2).trim(),
      });
    } else if (token.startsWith('\\(') && token.endsWith('\\)')) {
      segments.push({
        kind: 'inline',
        value: token.slice(2, -2).trim(),
      });
    } else if (token.startsWith('$') && token.endsWith('$')) {
      segments.push({
        kind: 'inline',
        value: token.slice(1, -1).trim(),
      });
    } else {
      segments.push({ kind: 'text', value: token });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({
      kind: 'text',
      value: input.slice(lastIndex),
    });
  }

  return segments;
}

function renderKatexHtml(expr: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expr, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return expr;
  }
}

export const LatexText: React.FC<LatexTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  const segments = parseLatexSegments(text);

  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.kind === 'text') {
          return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
        }
        if (seg.kind === 'display') {
          const html = renderKatexHtml(seg.value, true);
          return (
            <span
              key={idx}
              className="block my-2 overflow-x-auto text-center"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        const html = renderKatexHtml(seg.value, false);
        return (
          <span
            key={idx}
            className="inline-block align-middle mx-0.5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
};
