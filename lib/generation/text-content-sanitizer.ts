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

// Sorted longest-first so `\longrightarrow` is matched before `\to` (alternation
// is greedy with the longer alternatives listed first). The lookahead is
// `(?![a-z])` rather than `(?![A-Za-z])` — we still want to skip continuations
// like `\alphabetical` (lowercase letter follows) but DO want to match cases
// where a chemical element symbol immediately follows the command, e.g.
// `\longrightarrowMg` in `Mg + O₂\longrightarrowMgO`. Without this, the
// chemistry equation rendered as literal text "longrightarrowMg".
const COMMAND_NAMES = Object.keys(LATEX_COMMAND_REPLACEMENTS).sort(
  (a, b) => b.length - a.length,
);
const LATEX_COMMAND_RE = new RegExp(
  `\\\\(${COMMAND_NAMES.join('|')})(?![a-z])`,
  'g',
);

// A subset of commands that are NOT English words (or any plausible
// identifier) and so are safe to replace even when the AI dropped the leading
// backslash. JSON parsing of poorly-escaped AI output sometimes strips the
// backslash entirely, leaving e.g. `Mg + O₂longrightarrowMgO` on screen with
// no `\` to anchor the regex. The arrow-command names below are
// unambiguous — they only ever come from LaTeX — so we strip them anywhere
// they appear. We deliberately exclude short/ambiguous names like `to`, `in`,
// `pi`, `mu`, `div`, `times`, `cup`, `cap` which collide with English.
const BARE_COMMAND_NAMES = [
  'Longleftrightarrow',
  'longleftrightarrow',
  'Longrightarrow',
  'Longleftarrow',
  'longrightarrow',
  'longleftarrow',
  'leftrightarrow',
  'Leftrightarrow',
  'rightarrow',
  'leftarrow',
  'Rightarrow',
  'Leftarrow',
  'mapsto',
];
const BARE_COMMAND_RE = new RegExp(`(${BARE_COMMAND_NAMES.join('|')})`, 'g');

function replaceInlineLatexCommands(html: string): string {
  let out = html.replace(LATEX_COMMAND_RE, (_match, name: string) => {
    return LATEX_COMMAND_REPLACEMENTS[name] ?? _match;
  });
  out = out.replace(BARE_COMMAND_RE, (_match, name: string) => {
    return LATEX_COMMAND_REPLACEMENTS[name] ?? _match;
  });
  return out;
}

/**
 * Join `<p>...</p><p>...</p>` pairs when the first paragraph does not end
 * with sentence-terminating punctuation. The AI sometimes splits a single
 * sentence across two paragraph tags ("...synthesize" / "food."), and the
 * default <p> margin makes the gap look like an unintentional break in the
 * middle of a thought.
 *
 * We loop until stable so a chain of three or more <p> tags collapses too.
 */
function mergeContinuationParagraphs(html: string): string {
  const SENTENCE_END = /[.!?:;,)\]"’”…»>]$/;
  const PAIR_RE = /<p\b([^>]*)>([\s\S]*?)<\/p>\s*<p\b[^>]*>/i;
  let out = html;
  for (let i = 0; i < 8; i++) {
    let changed = false;
    out = out.replace(PAIR_RE, (match, attrs1: string, inner: string) => {
      const trimmed = inner.replace(/\s+$/, '');
      if (!trimmed) return match;
      if (SENTENCE_END.test(trimmed)) return match;
      changed = true;
      // Drop the `</p><p ...>` boundary, leaving a single space so the two
      // text fragments reflow as one paragraph.
      return `<p${attrs1}>${trimmed} `;
    });
    if (!changed) break;
  }
  return out;
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
  out = mergeContinuationParagraphs(out);
  return out;
}
