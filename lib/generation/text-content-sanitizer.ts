/**
 * Sanitize AI-generated HTML content for TextElements.
 *
 * Two classes of issues this guards against:
 *
 * 1. Inline LaTeX commands. The AI is told not to put LaTeX in text content,
 *    but it still slips in commands like `\longrightarrow` which then render
 *    as the literal string "longrightarrow" because TextElement is plain HTML
 *    rendered via dangerouslySetInnerHTML, not KaTeX. We swap a curated set of
 *    common math commands for their Unicode equivalents.
 *
 * 2. Stray `\n\n` and `\n` inside paragraph text. The AI sometimes emits literal
 *    newlines in the middle of a sentence, and the prompt also encourages it to
 *    split lines into separate <p> tags — together this produces large mid-
 *    sentence paragraph gaps. We collapse these to a single space inside text
 *    nodes (we do not touch newlines that sit between tags).
 */

const LATEX_COMMAND_REPLACEMENTS: Record<string, string> = {
  // Arrows
  longrightarrow: '→', // →
  longleftarrow: '←', // ←
  longleftrightarrow: '↔', // ↔
  Longrightarrow: '⇒', // ⇒
  Longleftarrow: '⇐', // ⇐
  Longleftrightarrow: '⇔', // ⇔
  rightarrow: '→',
  leftarrow: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  Leftrightarrow: '⇔',
  to: '→',
  uparrow: '↑',
  downarrow: '↓',
  Uparrow: '⇑',
  Downarrow: '⇓',
  mapsto: '↦',
  // Comparison & misc operators
  leq: '≤',
  geq: '≥',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  pm: '±',
  mp: '∓',
  times: '×',
  div: '÷',
  cdot: '·',
  ldots: '…',
  cdots: '⋯',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  forall: '∀',
  exists: '∃',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  supset: '⊃',
  cup: '∪',
  cap: '∩',
  // Greek (lowercase)
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  // Greek (uppercase)
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
};

// Word-boundary on the right so `\alpha2` doesn't match. Sorted longest-first
// to avoid `\to` swallowing `\torrent`-style false positives — the (?![A-Za-z])
// guard already handles that, but ordering keeps the regex deterministic.
const COMMAND_NAMES = Object.keys(LATEX_COMMAND_REPLACEMENTS).sort(
  (a, b) => b.length - a.length,
);
const LATEX_COMMAND_RE = new RegExp(
  `\\\\(${COMMAND_NAMES.join('|')})(?![A-Za-z])`,
  'g',
);

function replaceInlineLatexCommands(html: string): string {
  return html.replace(LATEX_COMMAND_RE, (_match, name: string) => {
    return LATEX_COMMAND_REPLACEMENTS[name] ?? _match;
  });
}

/**
 * Collapse stray newlines that appear inside text nodes (between tags).
 * Newlines between tags (e.g. "</p>\n<p>") are formatting whitespace and
 * stay untouched. Newlines inside content become a single space so a
 * mid-sentence "synthesize\n\nfood" reads as "synthesize food".
 */
function collapseNewlinesInsideTextNodes(html: string): string {
  return html.replace(/>([^<]*)</g, (_match, inner: string) => {
    const cleaned = inner.replace(/[\r\n]+/g, ' ').replace(/[ \t]{2,}/g, ' ');
    return `>${cleaned}<`;
  });
}

export function sanitizeTextElementContent(content: string): string {
  if (!content || typeof content !== 'string') return content;
  let out = content;
  out = replaceInlineLatexCommands(out);
  out = collapseNewlinesInsideTextNodes(out);
  return out;
}
