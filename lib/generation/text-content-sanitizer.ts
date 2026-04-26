/**
 * Sanitize AI-generated HTML content for TextElements.
 *
 * Three classes of issues this guards against:
 *
 * 1. Inline LaTeX commands. The AI is told not to put LaTeX in text content,
 *    but it still slips in commands like `\longrightarrow` which then render
 *    as the literal string "longrightarrow" because TextElement is plain HTML
 *    rendered via dangerouslySetInnerHTML, not KaTeX. We swap a curated set of
 *    common math commands for their Unicode equivalents — both with and without
 *    the leading backslash, since some upstream JSON parsing strips the
 *    backslash and the bare "longrightarrow" word still leaks through.
 *
 * 2. Stray `\n\n` and `\n` inside paragraph text. The AI sometimes emits literal
 *    newlines in the middle of a sentence, and the prompt also encourages it to
 *    split lines into separate <p> tags — together this produces large mid-
 *    sentence paragraph gaps. We collapse these to a single space inside text
 *    nodes (we do not touch newlines that sit between tags).
 *
 * 3. Mid-sentence paragraph splits. Even after newline collapsing, the AI
 *    sometimes ships consecutive <p> tags that together form a single sentence
 *    (e.g. "<p>Harnessing light energy to synthesize</p><p>food.</p>"). When
 *    the first <p> doesn't end with sentence-terminating punctuation, we merge
 *    it with the next <p> using a single space.
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

// A subset of commands that are clearly not real English/Greek words and so
// are safe to replace even when the leading backslash is missing. The audit
// caught output like `Mg + O₂longrightarrowMg` (no backslash), suggesting the
// JSON pipeline upstream sometimes drops the `\`. We allow-list only the
// distinctive multi-letter command names — Greek letters and short tokens
// like `to`, `in`, `pi` are real words and would over-trigger.
const BARE_COMMANDS_SAFE_TO_REPLACE = [
  'longrightarrow',
  'longleftarrow',
  'longleftrightarrow',
  'leftrightarrow',
  'Longrightarrow',
  'Longleftarrow',
  'Longleftrightarrow',
  'Rightarrow',
  'Leftarrow',
  'Leftrightarrow',
  'rightarrow',
  'leftarrow',
  'mapsto',
  'Uparrow',
  'Downarrow',
  'infty',
  'partial',
  'nabla',
  'forall',
  'exists',
  'notin',
  'subset',
  'supset',
  'ldots',
  'cdots',
  'leq',
  'geq',
  'neq',
  'approx',
  'equiv',
  'cdot',
];
const BARE_COMMAND_RE = new RegExp(
  // Left side: not a letter and not a backslash, so we don't double-replace
  // commands that already had `\` (those are caught by LATEX_COMMAND_RE) and
  // don't truncate real words. Right side has no boundary because the failing
  // case is `O₂longrightarrowMg` — the AI has concatenated a chemical formula
  // directly onto the command, and the next char IS a letter. Limiting bare
  // matches to the distinctive multi-letter list above keeps this safe.
  `(^|[^A-Za-z\\\\])(${BARE_COMMANDS_SAFE_TO_REPLACE.sort((a, b) => b.length - a.length).join('|')})`,
  'g',
);

function replaceInlineLatexCommands(html: string): string {
  let out = html.replace(LATEX_COMMAND_RE, (_match, name: string) => {
    return LATEX_COMMAND_REPLACEMENTS[name] ?? _match;
  });
  out = out.replace(BARE_COMMAND_RE, (_match, prefix: string, name: string) => {
    return prefix + (LATEX_COMMAND_REPLACEMENTS[name] ?? name);
  });
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

// Visible text inside a <p> can include nested inline tags (<strong>, <em>,
// etc.). We only need to look at the *trailing* visible character of the first
// paragraph and the *leading* visible character of the second to decide
// whether the two should be merged.
function stripTagsAndDecode(inner: string): string {
  return inner
    .replace(/<[^>]*>/g, '')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ');
}

const SENTENCE_TERMINATORS = new Set([
  '.', '!', '?', ':', ';', '…', '。', '！', '？', '：', '；',
]);

/**
 * Merge consecutive `<p>` tags when the first paragraph doesn't end with a
 * sentence terminator AND the second begins with a lowercase letter — this is
 * the AI shipping a single sentence as two paragraphs ("Harnessing light
 * energy to synthesize" + "food."), which renders as a large mid-sentence gap.
 *
 * The lowercase-start guard avoids merging genuine list items like
 * "<p>Step 1</p><p>Step 2</p>".
 */
function mergeMidSentenceParagraphs(html: string): string {
  // Repeat until stable so 3+ consecutive splits collapse correctly.
  let prev = '';
  let current = html;
  let iterations = 0;
  while (prev !== current && iterations < 10) {
    prev = current;
    current = current.replace(
      /<p\b([^>]*)>([\s\S]*?)<\/p>(\s*)<p\b([^>]*)>([\s\S]*?)<\/p>/g,
      (match, attrs1: string, inner1: string, _gap: string, _attrs2: string, inner2: string) => {
        const firstText = stripTagsAndDecode(inner1).trimEnd();
        const secondText = stripTagsAndDecode(inner2).trimStart();
        if (!firstText || !secondText) return match;
        const lastChar = firstText[firstText.length - 1];
        const firstChar = secondText[0];
        if (SENTENCE_TERMINATORS.has(lastChar)) return match;
        // Only merge when the next chunk clearly continues a sentence.
        // ASCII-lowercase is sufficient for English content and avoids
        // collapsing genuine list items that start with capitals or digits.
        if (firstChar < 'a' || firstChar > 'z') return match;
        const trimmed1 = inner1.replace(/\s+$/, '');
        const trimmed2 = inner2.replace(/^\s+/, '');
        return `<p${attrs1}>${trimmed1} ${trimmed2}</p>`;
      },
    );
    iterations += 1;
  }
  return current;
}

export function sanitizeTextElementContent(content: string): string {
  if (!content || typeof content !== 'string') return content;
  let out = content;
  out = replaceInlineLatexCommands(out);
  out = collapseNewlinesInsideTextNodes(out);
  out = mergeMidSentenceParagraphs(out);
  return out;
}
