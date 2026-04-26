/**
 * Sanitize AI-generated HTML content for TextElements.
 *
 * Three classes of issues this guards against:
 *
 * 1. Inline LaTeX commands. The AI is told not to put LaTeX in text content,
 *    but it still slips in commands like `\longrightarrow` which then render
 *    as the literal string "longrightarrow" because TextElement is plain HTML
 *    rendered via dangerouslySetInnerHTML, not KaTeX. We swap a curated set of
 *    common math commands for their Unicode equivalents.
 *
 * 2. Bare command names without the leading backslash. Some content arrives
 *    with the `\` already stripped (older courses generated before the JSON
 *    parser handled `\l`-style LaTeX escapes cleanly, plus the occasional
 *    model that emits raw words like `longrightarrow` directly). For a small
 *    set of unambiguous, LaTeX-only command names we also replace bare
 *    occurrences. Common short names like `to`, `pi`, `in`, `times`, `cup`,
 *    `cap`, `mu`, `nu`, `xi` etc. are intentionally NOT in the bare-name
 *    fallback because they appear in normal English prose.
 *
 * 3. Stray `\n\n` and `\n` inside paragraph text. The AI sometimes emits
 *    literal newlines mid-sentence, which combined with the prompt's "split
 *    each line into a separate <p>" guidance produces large mid-sentence
 *    paragraph gaps. We collapse those to a single space inside text nodes.
 *    Newlines that sit between tags are formatting whitespace and stay
 *    untouched.
 *
 * After replacement, we also ensure that mathematical/operator characters
 * have a single space separating them from adjacent ASCII letters or digits,
 * so that `Mg+O₂→MgO` renders as `Mg+O₂ → MgO` and the equation can wrap on
 * the spaces instead of overflowing the panel (NEW-008).
 */

const LATEX_COMMAND_REPLACEMENTS: Record<string, string> = {
  // Arrows
  longrightarrow: '→',
  longleftarrow: '←',
  longleftrightarrow: '↔',
  Longrightarrow: '⇒',
  Longleftarrow: '⇐',
  Longleftrightarrow: '⇔',
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

// Bare-name fallback: command names that never appear in normal English. For
// these we replace even without the leading backslash. We also do NOT require
// a non-letter on the right, because the AI may emit them jammed against the
// next token (e.g. "longrightarrowMg" — the user-visible bug). Common short
// names like `to`, `pi`, `in`, `mu`, `xi` are excluded because they ARE
// English words.
const BARE_LATEX_REPLACEMENTS: Record<string, string> = {
  longrightarrow: '→',
  longleftarrow: '←',
  longleftrightarrow: '↔',
  Longrightarrow: '⇒',
  Longleftarrow: '⇐',
  Longleftrightarrow: '⇔',
  leftrightarrow: '↔',
  Leftrightarrow: '⇔',
  rightarrow: '→',
  leftarrow: '←',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  mapsto: '↦',
  infty: '∞',
  ldots: '…',
  cdots: '⋯',
  nabla: '∇',
};

const BARE_NAMES = Object.keys(BARE_LATEX_REPLACEMENTS).sort(
  (a, b) => b.length - a.length,
);
// `(^|[^A-Za-z\\])` — must follow start-of-string or a non-letter, non-`\`.
// We deliberately omit a right-side word boundary: `longrightarrowMg` should
// match the bare name even though `M` immediately follows.
const BARE_LATEX_RE = new RegExp(
  `(^|[^A-Za-z\\\\])(${BARE_NAMES.join('|')})`,
  'g',
);

// Operator characters we may have just inserted. Used to ensure these are
// space-separated from neighbouring letters or digits so the equation can
// wrap instead of overflowing the panel. We use Unicode property escapes so
// subscripts/superscripts in chemistry equations (e.g. `O₂`) count as digits.
const OPERATOR_CHARS = '→←↔⇒⇐⇔↑↓⇑⇓↦≤≥≠≈≡±∓×÷·…⋯∞∂∇∀∃∈∉⊂⊃∪∩';
const OPERATOR_BEFORE_RE = new RegExp(
  `([\\p{L}\\p{N}])([${OPERATOR_CHARS}])`,
  'gu',
);
const OPERATOR_AFTER_RE = new RegExp(
  `([${OPERATOR_CHARS}])([\\p{L}\\p{N}])`,
  'gu',
);

function replaceInlineLatexCommands(html: string): string {
  let out = html.replace(LATEX_COMMAND_RE, (_match, name: string) => {
    return LATEX_COMMAND_REPLACEMENTS[name] ?? _match;
  });
  out = out.replace(BARE_LATEX_RE, (_match, prefix: string, name: string) => {
    return `${prefix}${BARE_LATEX_REPLACEMENTS[name]}`;
  });
  // Re-space operators that ended up jammed against alphanumerics. `Mg→Mg`
  // becomes `Mg → Mg`; `Mg → Mg` (already spaced) is unchanged.
  out = out.replace(OPERATOR_BEFORE_RE, '$1 $2');
  out = out.replace(OPERATOR_AFTER_RE, '$1 $2');
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
  return out;
}
