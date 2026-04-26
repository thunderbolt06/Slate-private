/**
 * Sanitize an AI-authored image generation prompt before it is sent to the
 * image-generation provider.
 *
 * NEW-002: The outline planner sometimes embeds template-like bracket
 * placeholders ("[YOUR NAME/COMPANY]", "(e.g., QUANTUM TECH)") inside the
 * image prompt. The image model takes the literal text, renders it onto the
 * canvas, and ships an unfinished-template look to the user.
 *
 * We strip the most common placeholder patterns and append a short negative
 * directive so any residual template text the model might invent on its own
 * is suppressed.
 */

const PLACEHOLDER_PATTERNS: RegExp[] = [
  // [YOUR NAME], [YOUR/COMPANY], [PLACEHOLDER], [INSERT TEXT] etc.
  /\[\s*(?:YOUR|INSERT|ADD|ENTER|TYPE|REPLACE|FILL|CLIENT|COMPANY|BRAND|NAME|TITLE|TEXT|HEADLINE|SUBTITLE|DATE|LOGO|PLACEHOLDER)[^\]]*\]/gi,
  // (e.g., XYZ), (i.e., ABC) — example annotations meant for the writer, not the model
  /\(\s*(?:e\.g\.?|i\.e\.?|eg|ie|example|such as)[^)]*\)/gi,
  // {{handlebars}} / {mustache} placeholders
  /\{\{[^}]+\}\}/g,
  /\{[A-Z_]{3,}\}/g,
  // Markdown-style fill prompts: <YOUR_NAME>
  /<\s*(?:YOUR|INSERT|ADD|PLACEHOLDER|COMPANY|BRAND|NAME)[^>]*>/gi,
];

const NEGATIVE_DIRECTIVE =
  'No placeholder text, no template fields, no bracketed labels, no example captions visible in the image.';

export function sanitizeImagePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') return prompt;
  let cleaned = prompt;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Collapse the whitespace artifacts left behind by the strips.
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();

  if (cleaned.toLowerCase().includes('placeholder text')) return cleaned;
  return `${cleaned} ${NEGATIVE_DIRECTIVE}`.trim();
}
