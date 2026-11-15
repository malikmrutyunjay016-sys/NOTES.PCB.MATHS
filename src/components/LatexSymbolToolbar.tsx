import React, { useState } from 'react';
import katex from 'katex';

interface LatexSymbolToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (nextValue: string) => void;
}

interface LatexButtonItem {
  label: string;
  latex: string;
  snippet: string;
  title: string;
  cursorOffset?: number;
}

type CategoryKey = 'equations' | 'greek' | 'operators' | 'science';

const CATEGORIES: Array<{ key: CategoryKey; label: string }> = [
  { key: 'equations', label: 'Equations & Structures' },
  { key: 'greek', label: 'Greek Letters' },
  { key: 'operators', label: 'Operators & Relations' },
  { key: 'science', label: 'Units & Chemistry' },
];

const ITEMS_BY_CATEGORY: Record<CategoryKey, LatexButtonItem[]> = {
  equations: [
    {
      label: 'a/b',
      latex: '\\frac{a}{b}',
      snippet: '\\frac{a}{b}',
      title: 'Fraction: \\frac{a}{b}',
    },
    {
      label: 'xⁿ',
      latex: 'x^{n}',
      snippet: '^{n}',
      title: 'Superscript / Power: x^{n}',
    },
    {
      label: 'xᵢ',
      latex: 'x_{i}',
      snippet: '_{i}',
      title: 'Subscript: x_{i}',
    },
    {
      label: '√x',
      latex: '\\sqrt{x}',
      snippet: '\\sqrt{x}',
      title: 'Square root: \\sqrt{x}',
    },
    {
      label: 'ⁿ√x',
      latex: '\\sqrt[n]{x}',
      snippet: '\\sqrt[n]{x}',
      title: 'nth root: \\sqrt[n]{x}',
    },
    {
      label: '∑',
      latex: '\\sum_{i=1}^{n}',
      snippet: '\\sum_{i=1}^{n} ',
      title: 'Summation: \\sum_{i=1}^{n}',
    },
    {
      label: '∏',
      latex: '\\prod_{i=1}^{n}',
      snippet: '\\prod_{i=1}^{n} ',
      title: 'Product: \\prod_{i=1}^{n}',
    },
    {
      label: '∫',
      latex: '\\int_{a}^{b} f(x)\\,dx',
      snippet: '\\int_{a}^{b} f(x)\\,dx',
      title: 'Definite Integral: \\int_{a}^{b} f(x)\\,dx',
    },
    {
      label: 'lim',
      latex: '\\lim_{x \\to \\infty}',
      snippet: '\\lim_{x \\to \\infty} ',
      title: 'Limit: \\lim_{x \\to \\infty}',
    },
    {
      label: 'dy/dx',
      latex: '\\frac{dy}{dx}',
      snippet: '\\frac{dy}{dx}',
      title: 'Derivative: \\frac{dy}{dx}',
    },
    {
      label: '∂f/∂x',
      latex: '\\frac{\\partial f}{\\partial x}',
      snippet: '\\frac{\\partial f}{\\partial x}',
      title: 'Partial Derivative: \\frac{\\partial f}{\\partial x}',
    },
    {
      label: 'v⃗',
      latex: '\\vec{v}',
      snippet: '\\vec{v}',
      title: 'Vector: \\vec{v}',
    },
    {
      label: '[2×2]',
      latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}',
      snippet: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}',
      title: '2x2 Matrix',
    },
    {
      label: '{cases}',
      latex: '\\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases}',
      snippet: '\\begin{cases} a & \\text{if } x \\ge 0 \\\\ b & \\text{if } x < 0 \\end{cases}',
      title: 'Piecewise cases',
    },
  ],
  greek: [
    { label: 'α', latex: '\\alpha', snippet: '\\alpha', title: 'Alpha (\\alpha)' },
    { label: 'β', latex: '\\beta', snippet: '\\beta', title: 'Beta (\\beta)' },
    { label: 'γ', latex: '\\gamma', snippet: '\\gamma', title: 'Gamma (\\gamma)' },
    { label: 'δ', latex: '\\delta', snippet: '\\delta', title: 'Delta (\\delta)' },
    { label: 'ε', latex: '\\varepsilon', snippet: '\\varepsilon', title: 'Epsilon (\\varepsilon)' },
    { label: 'θ', latex: '\\theta', snippet: '\\theta', title: 'Theta (\\theta)' },
    { label: 'λ', latex: '\\lambda', snippet: '\\lambda', title: 'Lambda (\\lambda)' },
    { label: 'μ', latex: '\\mu', snippet: '\\mu', title: 'Mu (\\mu)' },
    { label: 'π', latex: '\\pi', snippet: '\\pi', title: 'Pi (\\pi)' },
    { label: 'ρ', latex: '\\rho', snippet: '\\rho', title: 'Rho (\\rho)' },
    { label: 'σ', latex: '\\sigma', snippet: '\\sigma', title: 'Sigma (\\sigma)' },
    { label: 'τ', latex: '\\tau', snippet: '\\tau', title: 'Tau (\\tau)' },
    { label: 'φ', latex: '\\phi', snippet: '\\phi', title: 'Phi (\\phi)' },
    { label: 'ω', latex: '\\omega', snippet: '\\omega', title: 'Omega (\\omega)' },
    { label: 'Δ', latex: '\\Delta', snippet: '\\Delta', title: 'Capital Delta (\\Delta)' },
    { label: 'Σ', latex: '\\Sigma', snippet: '\\Sigma', title: 'Capital Sigma (\\Sigma)' },
    { label: 'Ω', latex: '\\Omega', snippet: '\\Omega', title: 'Capital Omega (\\Omega)' },
    { label: '∞', latex: '\\infty', snippet: '\\infty', title: 'Infinity (\\infty)' },
  ],
  operators: [
    { label: '±', latex: '\\pm', snippet: '\\pm', title: 'Plus-Minus (\\pm)' },
    { label: '×', latex: '\\times', snippet: '\\times', title: 'Multiply (\\times)' },
    { label: '÷', latex: '\\div', snippet: '\\div', title: 'Divide (\\div)' },
    { label: '·', latex: '\\cdot', snippet: '\\cdot', title: 'Dot product (\\cdot)' },
    { label: '≤', latex: '\\leq', snippet: '\\leq', title: 'Less or equal (\\leq)' },
    { label: '≥', latex: '\\geq', snippet: '\\geq', title: 'Greater or equal (\\geq)' },
    { label: '≠', latex: '\\neq', snippet: '\\neq', title: 'Not equal (\\neq)' },
    { label: '≈', latex: '\\approx', snippet: '\\approx', title: 'Approximately (\\approx)' },
    { label: '≡', latex: '\\equiv', snippet: '\\equiv', title: 'Equivalent / Congruence (\\equiv)' },
    { label: '∝', latex: '\\propto', snippet: '\\propto', title: 'Proportional to (\\propto)' },
    { label: '→', latex: '\\to', snippet: '\\to', title: 'Arrow (\\to)' },
    { label: '⇒', latex: '\\Rightarrow', snippet: '\\Rightarrow', title: 'Implies (\\Rightarrow)' },
    { label: '⇔', latex: '\\Leftrightarrow', snippet: '\\Leftrightarrow', title: 'If and only if (\\Leftrightarrow)' },
    { label: '∈', latex: '\\in', snippet: '\\in', title: 'Element of (\\in)' },
    { label: '⊂', latex: '\\subset', snippet: '\\subset', title: 'Subset (\\subset)' },
    { label: '∪', latex: '\\cup', snippet: '\\cup', title: 'Union (\\cup)' },
    { label: '∩', latex: '\\cap', snippet: '\\cap', title: 'Intersection (\\cap)' },
    { label: '∀', latex: '\\forall', snippet: '\\forall', title: 'For all (\\forall)' },
    { label: '∃', latex: '\\exists', snippet: '\\exists', title: 'There exists (\\exists)' },
    { label: '∇', latex: '\\nabla', snippet: '\\nabla', title: 'Nabla / Del (\\nabla)' },
  ],
  science: [
    { label: '°', latex: '^{\\circ}', snippet: '^{\\circ}', title: 'Degree symbol' },
    { label: '°C', latex: '^{\\circ}\\text{C}', snippet: '^{\\circ}\\text{C}', title: 'Degrees Celsius' },
    { label: '⇌', latex: '\\rightleftharpoons', snippet: '\\rightleftharpoons', title: 'Equilibrium reaction arrows' },
    { label: '⟶', latex: '\\longrightarrow', snippet: '\\longrightarrow', title: 'Reaction arrow' },
    { label: 'Ω', latex: '\\,\\Omega', snippet: '\\,\\Omega', title: 'Ohms (\\Omega)' },
    { label: 'μF', latex: '\\,\\mu\\text{F}', snippet: '\\,\\mu\\text{F}', title: 'Microfarad' },
    { label: 'm/s²', latex: '\\text{ m/s}^{2}', snippet: '\\text{ m/s}^{2}', title: 'Acceleration unit' },
    { label: 'H₂O', latex: '\\text{H}_{2}\\text{O}', snippet: '\\text{H}_{2}\\text{O}', title: 'Chemical subscript formula' },
    { label: 'log₁₀', latex: '\\log_{10}(x)', snippet: '\\log_{10}(x)', title: 'Log base 10' },
    { label: 'ln', latex: '\\ln(x)', snippet: '\\ln(x)', title: 'Natural logarithm' },
  ],
};

function isInsideMathDelimiter(text: string, cursorPos: number): boolean {
  const before = text.slice(0, cursorPos);
  // Check block delimiters $$ ... $$
  const blockMatches = before.match(/(?<!\\)\$\$/g);
  if (blockMatches && blockMatches.length % 2 === 1) {
    return true;
  }
  // Remove all $$ before checking single $
  const cleaned = before.replace(/(?<!\\)\$\$/g, '');
  const inlineMatches = cleaned.match(/(?<!\\)\$/g);
  if (inlineMatches && inlineMatches.length % 2 === 1) {
    return true;
  }
  // Check \( ... \) or \[ ... \]
  const lastOpenParen = before.lastIndexOf('\\(');
  const lastCloseParen = before.lastIndexOf('\\)');
  if (lastOpenParen > lastCloseParen) return true;
  const lastOpenBracket = before.lastIndexOf('\\[');
  const lastCloseBracket = before.lastIndexOf('\\]');
  if (lastOpenBracket > lastCloseBracket) return true;

  return false;
}

export const LatexSymbolToolbar: React.FC<LatexSymbolToolbarProps> = ({
  textareaRef,
  value,
  onChange,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('equations');

  const insertAtCursor = (rawSnippet: string, forceDelimiter?: 'inline' | 'display') => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selectedText = value.slice(start, end);

    let insertion = '';
    let nextCursorPos = start;

    if (forceDelimiter === 'inline') {
      const inner = selectedText || 'x';
      insertion = `$${inner}$`;
      nextCursorPos = selectedText ? start + insertion.length : start + 1 + inner.length;
    } else if (forceDelimiter === 'display') {
      const inner = selectedText || 'y = f(x)';
      const needsLeadingNewline = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
      insertion = `${needsLeadingNewline}$$\n${inner}\n$$`;
      nextCursorPos = start + insertion.length - 3;
    } else {
      const insideMath = isInsideMathDelimiter(value, start);
      insertion = insideMath ? rawSnippet : `$${rawSnippet}$`;
      nextCursorPos = start + insertion.length;
    }

    const updated = value.slice(0, start) + insertion + value.slice(end);
    onChange(updated);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
      }
    });
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Category Selector & Math Wrap Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-stone-50 border-b border-stone-200">
        <div className="flex flex-wrap items-center gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeCategory === cat.key
                  ? 'bg-stone-900 text-amber-300'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => insertAtCursor('', 'inline')}
            title="Wrap selection or insert inline LaTeX math ($...$)"
            className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-amber-50 hover:border-amber-400 text-[11px] font-mono font-semibold text-stone-800 whitespace-nowrap shrink-0 transition-colors"
          >
            $ Inline Math $
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor('', 'display')}
            title="Wrap selection or insert centered display equation ($$...$$)"
            className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-amber-50 hover:border-amber-400 text-[11px] font-mono font-semibold text-stone-800 whitespace-nowrap shrink-0 transition-colors"
          >
            $$ Equation Block $$
          </button>
        </div>
      </div>

      {/* Symbol / Template Grid */}
      <div className="p-2 flex flex-wrap items-center gap-1.5 bg-white">
        {ITEMS_BY_CATEGORY[activeCategory].map((item, idx) => {
          let previewHtml = '';
          try {
            previewHtml = katex.renderToString(item.latex, {
              displayMode: false,
              throwOnError: false,
              strict: false,
              trust: false,
            });
          } catch {
            previewHtml = '';
          }

          return (
            <button
              key={`${activeCategory}-${idx}`}
              type="button"
              title={item.title}
              onClick={() => insertAtCursor(item.snippet)}
              className="min-h-[32px] px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50/70 hover:bg-amber-50 hover:border-amber-400 text-stone-900 text-xs transition-colors flex items-center justify-center shrink-0"
            >
              {previewHtml ? (
                <span
                  className="pointer-events-none leading-none"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <span className="font-mono">{item.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
