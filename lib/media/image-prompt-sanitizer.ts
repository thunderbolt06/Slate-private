/**
 * Sanitize image generation prompts to avoid stock-template / placeholder-text
 * outputs (NEW-002).
 *
 * Educational image generators consistently produce slides with hardcoded
 * placeholder text — "PRESENTATION BY [YOUR NAME/COMPANY] (e.g., QUANTUM
 * TECH)", "Click to add title", "Your subtitle here" — when the upstream
 * prompt contains framing words like "presentation slide" or "title slide".
 *
 * The outline-generator system prompt already discourages this, but the model
 * still slips it in. This sanitizer is the last line of defense at the API
 * boundary: it strips template-framing words from the prompt and appends an
 * explicit negative directive. Adapters that support a separate negative
 * prompt also get a hardened default.
 */

const TEMPLATE_FRAMING_PATTERNS: ReadonlyArray<{ re: RegExp; replacement: string }> = [
  { re: /\b(?:powerpoint|ppt)\s+(?:slide|cover|title)s?\b/gi, replacement: 'illustration' },
  { re: /\b(?:title|cover|presentation|business|corporate)\s+slides?\b/gi, replacement: 'illustration' },
  { re: /\bslide\s+(?:cover|title|template|deck)\b/gi, replacement: 'illustration' },
  { re: /\bstock\s+(?:photo|image|template)\b/gi, replacement: 'illustration' },
  { re: /\b(?:slide|deck)\s+template\b/gi, replacement: 'illustration' },
];

const PLACEHOLDER_TEXT_PATTERNS: ReadonlyArray<RegExp> = [
  /\[\s*YOUR\s+NAME(?:\s*\/\s*COMPANY)?\s*\]/gi,
  /\[\s*YOUR\s+COMPANY\s*\]/gi,
  /\[\s*COMPANY\s+NAME\s*\]/gi,
  /\[\s*TITLE\s+HERE\s*\]/gi,
  /\[\s*SUBTITLE\s+HERE\s*\]/gi,
  /\[\s*CLICK\s+TO\s+ADD[^\]]*\]/gi,
  /\blorem\s+ipsum\b/gi,
];

const NEGATIVE_GUARD_SUFFIX =
  ' Educational illustration only. No slide chrome, no header/footer text, ' +
  'no placeholder copy like "[YOUR NAME]", "[YOUR COMPANY]", "PRESENTATION BY", ' +
  '"Title here", "Subtitle here", or "Click to add". No watermarks, no signature.';

const NEGATIVE_PROMPT_DEFAULT =
  'placeholder text, [YOUR NAME], [YOUR COMPANY], PRESENTATION BY, ' +
  'title here, subtitle here, click to add, lorem ipsum, watermark, ' +
  'stock photo template, powerpoint slide chrome, slide deck cover, ' +
  'unfilled template fields';

/** Strip and rewrite slide-template framing words from a prompt. */
function stripTemplateFraming(prompt: string): string {
  let out = prompt;
  for (const { re, replacement } of TEMPLATE_FRAMING_PATTERNS) {
    out = out.replace(re, replacement);
  }
  for (const re of PLACEHOLDER_TEXT_PATTERNS) {
    out = out.replace(re, '');
  }
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

/** Apply the full sanitization: strip framing, append negative guard suffix. */
export function sanitizeImagePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') return prompt;
  const stripped = stripTemplateFraming(prompt);
  // Avoid re-appending the suffix if the caller already passed one in.
  if (stripped.includes('No placeholder copy') || stripped.includes('no placeholder copy')) {
    return stripped;
  }
  return `${stripped}${stripped.endsWith('.') ? '' : '.'}${NEGATIVE_GUARD_SUFFIX}`;
}

/** Merge user-provided negative prompt with our hardened default. */
export function withDefaultNegativePrompt(userNegativePrompt?: string): string {
  if (!userNegativePrompt || !userNegativePrompt.trim()) {
    return NEGATIVE_PROMPT_DEFAULT;
  }
  return `${userNegativePrompt.trim()}, ${NEGATIVE_PROMPT_DEFAULT}`;
}
