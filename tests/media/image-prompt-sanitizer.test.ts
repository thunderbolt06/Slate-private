import { describe, it, expect } from 'vitest';
import { sanitizeImagePrompt } from '@/lib/media/image-prompt-sanitizer';

describe('sanitizeImagePrompt', () => {
  it('strips bracketed YOUR-NAME-style placeholders (NEW-002)', () => {
    const out = sanitizeImagePrompt(
      'A logo for [YOUR NAME/COMPANY], (e.g., QUANTUM TECH), in vivid blue.',
    );
    expect(out).not.toContain('[');
    expect(out).not.toContain(']');
    expect(out).not.toContain('e.g.');
    expect(out).not.toContain('YOUR NAME');
    expect(out).not.toContain('QUANTUM TECH');
    expect(out).toContain('vivid blue');
  });

  it('appends a negative directive about placeholder text', () => {
    const out = sanitizeImagePrompt('A clean infographic of the water cycle.');
    expect(out.toLowerCase()).toContain('no placeholder text');
  });

  it('does not stack the negative directive when the prompt already says it', () => {
    const out = sanitizeImagePrompt(
      'A circuit diagram, no placeholder text whatsoever.',
    );
    const matches = out.match(/no placeholder text/gi) ?? [];
    expect(matches.length).toBe(1);
  });

  it('strips angle-bracket style placeholders', () => {
    const out = sanitizeImagePrompt('A poster reading <YOUR_NAME> in red.');
    expect(out).not.toContain('<YOUR_NAME>');
  });

  it('strips handlebars-style and ALL-CAPS placeholders', () => {
    const out = sanitizeImagePrompt('Greeting card with {{userName}} and {COMPANY_NAME} on it.');
    expect(out).not.toContain('{{userName}}');
    expect(out).not.toContain('{COMPANY_NAME}');
  });

  it('handles empty input safely', () => {
    expect(sanitizeImagePrompt('')).toBe('');
  });
});
