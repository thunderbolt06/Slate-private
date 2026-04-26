import { describe, it, expect } from 'vitest';
import { sanitizeImagePrompt } from '@/lib/media/image-providers';

// The sanitizer appends a fixed directive that itself names the patterns we
// guard against (so the image model knows what to avoid). Tests should only
// inspect the user-supplied portion — everything before the directive split.
function userPart(out: string): string {
  return out.split('Render a finished')[0];
}

describe('sanitizeImagePrompt (NEW-002)', () => {
  it('strips bracketed placeholder phrases', () => {
    const out = sanitizeImagePrompt('A title slide with [YOUR NAME/COMPANY] at the top');
    expect(userPart(out)).not.toMatch(/\[YOUR NAME/i);
    expect(out).toContain('A title slide with');
  });

  it('strips angle-bracket placeholders', () => {
    const out = sanitizeImagePrompt('Hero image with <YOUR LOGO> centered');
    expect(userPart(out)).not.toContain('<YOUR LOGO>');
    expect(out).toContain('Hero image with');
  });

  it('strips parenthetical "e.g., QUANTUM TECH" template fillers', () => {
    const out = sanitizeImagePrompt(
      'A corporate-style infographic (e.g., QUANTUM TECH) with three columns',
    );
    expect(userPart(out)).not.toContain('QUANTUM TECH');
    expect(out).toContain('A corporate-style infographic');
    expect(out).toContain('three columns');
  });

  it('strips lorem ipsum filler', () => {
    const out = sanitizeImagePrompt('A diagram with lorem ipsum dolor sit amet. captioned below');
    expect(userPart(out).toLowerCase()).not.toContain('lorem ipsum');
  });

  it('appends a no-placeholder directive', () => {
    const out = sanitizeImagePrompt('A water cycle diagram');
    expect(out).toContain('placeholder text');
  });

  it('does not double-append the directive on a second pass', () => {
    const once = sanitizeImagePrompt('A water cycle diagram');
    const twice = sanitizeImagePrompt(once);
    const matches = twice.match(/placeholder text/gi) ?? [];
    expect(matches.length).toBe(1);
  });

  it('leaves a clean prompt mostly intact', () => {
    const out = sanitizeImagePrompt('A colorful diagram of photosynthesis');
    expect(out.startsWith('A colorful diagram of photosynthesis')).toBe(true);
  });

  it('handles empty / non-string input safely', () => {
    expect(sanitizeImagePrompt('')).toBe('');
    // @ts-expect-error — runtime guard for non-string input
    expect(sanitizeImagePrompt(null)).toBe(null);
  });
});
