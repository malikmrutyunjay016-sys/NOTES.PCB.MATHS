import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!content) {
    return <p className="text-stone-400 italic">No content available.</p>;
  }

  // Parse lines into logical blocks
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';
  let blockKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks ```
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        const fullCode = codeBuffer.join('\n');
        const currentIndex = blockKey++;
        elements.push(
          <div key={`code-${currentIndex}`} className="my-4 rounded-xl overflow-hidden border border-stone-800 bg-stone-950 text-stone-100 shadow-md">
            <div className="flex items-center justify-between px-4 py-2 bg-stone-900 border-b border-stone-800 text-xs font-mono text-stone-400">
              <span>{codeLang || 'code'}</span>
              <button
                onClick={() => copyToClipboard(fullCode, currentIndex)}
                className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                title="Copy code"
              >
                {copiedIndex === currentIndex ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-xs md:text-sm font-mono overflow-x-auto leading-relaxed">
              <code>{fullCode}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBuffer = [];
        codeLang = '';
      } else {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Dividers
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={blockKey++} className="my-6 border-stone-200" />);
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={blockKey++} className="text-2xl md:text-3xl font-serif font-bold text-stone-900 mt-6 mb-3 tracking-tight">
          {line.slice(2)}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={blockKey++} className="text-xl md:text-2xl font-serif font-bold text-stone-800 mt-5 mb-2.5 pb-1 border-b border-stone-100 tracking-tight">
          {line.slice(3)}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={blockKey++} className="text-lg md:text-xl font-sans font-semibold text-stone-800 mt-4 mb-2">
          {line.slice(4)}
        </h3>
      );
      continue;
    }
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={blockKey++} className="text-base font-sans font-semibold text-stone-700 mt-3 mb-1.5">
          {line.slice(5)}
        </h4>
      );
      continue;
    }

    // Blockquotes
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={blockKey++} className="border-l-4 border-amber-500 bg-amber-50/60 px-4 py-2.5 my-3 rounded-r-lg text-stone-700 italic text-sm">
          {formatInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Lists (unordered)
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const bulletText = line.trim().slice(2);
      elements.push(
        <li key={blockKey++} className="ml-5 list-disc text-stone-700 text-sm md:text-base leading-relaxed my-1">
          {formatInline(bulletText)}
        </li>
      );
      continue;
    }

    // Lists (ordered)
    const orderedMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (orderedMatch) {
      elements.push(
        <li key={blockKey++} className="ml-5 list-decimal text-stone-700 text-sm md:text-base leading-relaxed my-1">
          {formatInline(orderedMatch[2])}
        </li>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={blockKey++} className="h-2" />);
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={blockKey++} className="text-stone-700 text-sm md:text-base leading-relaxed my-1.5">
        {formatInline(line)}
      </p>
    );
  }

  return <div className={`prose-stone max-w-none ${className}`}>{elements}</div>;
};

// Helper for bold, code tags, equations, italic
function formatInline(text: string): React.ReactNode {
  // Split by inline code, bold, math, italic
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\$[^$]+\$)/g);

  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="px-1.5 py-0.5 rounded bg-stone-100 text-amber-700 font-mono text-xs md:text-sm font-medium">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-stone-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      return (
        <span key={index} className="font-mono bg-stone-100/90 text-stone-800 px-1 py-0.5 rounded text-xs md:text-sm tracking-wide">
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
}
