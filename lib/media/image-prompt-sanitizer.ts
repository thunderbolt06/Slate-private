/**
 * Server-side guardrail for image-generation prompts.
 *
 * NEW-002: Even with prompt instructions telling the outline AI to avoid
 * stock-template imagery, the model occasionally still emits prompts like
 * "presentation slide titled '[YOUR NAME/COMPANY]'…". The image generator
 * then dutifully renders unfilled-template boilerplate ("PRESENTATION BY
 * [YOUR NAME/COMPANY] (e.g., QUANTUM TECH)") into the final slide image.
 *
 * This module is the last line of defence: it runs on every image prompt
 * before it leaves our servers, strips the most obvious template phrases,
 * and appends an explicit instruction to the model to omit any placeholder
 * copy.
 */

const TEMPLATE_PHRASES: Array<RegExp> = [
  /\[\s*your\s+(?:name|company|brand|logo|title|subtitle|text)\s*[^\]]*\]/gi,
  /\[\s*(?:title|subtitle|company|brand|logo|name)\s+here\s*\]/gi,
  /\[\s*click\s+to\s+(?:add|edit)[^\]]*\]/gi,
  /\[\s*lorem\s+ipsum[^\]]*\]/gi,
  /\(\s*e\.?g\.?,?\s*(?:quantum\s+tech|acme|company\s+name|your\s+brand)[^)]*\)/gi,
  /\bplaceholder\s+(?:text|copy|name|title)\b/gi,
  /\blorem\s+ipsum\b/gi,
];

const TEMPLATE_KEYWORDS: Array<RegExp> = [
  /\b(?:powerpoint\s+)?(?:title|cover|business)\s+slide\b/gi,
  /\bpresentation\s+(?:slide|template|deck|cover)\b/gi,
  /\bstock\s+(?:photo|image|template)\b/gi,
  /\b(?:slide|deck)\s+template\b/gi,
];

const APPEND_GUARDRAIL =
  ' Do not include any text overlay, placeholder copy, watermark, ' +
  '"YOUR NAME"/"YOUR COMPANY" boilerplate, slide chrome, or template-style ' +
  'header/footer in the image.';

export function sanitizeImagePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') return prompt;
  let out = prompt;
  for (const re of TEMPLATE_PHRASES) {
    out = out.replace(re, '');
  }
  for (const re of TEMPLATE_KEYWORDS) {
    out = out.replace(re, 'illustration');
  }
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
  // Only append the guardrail once per prompt.
  if (!/no\s+placeholder|no\s+text\s+overlay|do\s+not\s+include\s+any\s+text/i.test(out)) {
    out = `${out}${APPEND_GUARDRAIL}`;
  }
  return out;
}
