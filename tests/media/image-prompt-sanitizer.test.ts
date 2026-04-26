import { describe, it, expect } from 'vitest';
import {
  sanitizeImagePrompt,
  withDefaultNegativePrompt,
} from '@/lib/media/image-prompt-sanitizer';

describe('sanitizeImagePrompt (NEW-002)', () => {
  it('rewrites slide-template framing to "illustration"', () => {
    const out = sanitizeImagePrompt('A title slide about photosynthesis');
    expect(out.toLowerCase()).toContain('illustration about photosynthesis');
    expect(out.toLowerCase()).not.toContain('title slide');
  });

  it('strips bracketed placeholder copy from the user-supplied portion', () => {
    const out = sanitizeImagePrompt('Cover with [YOUR NAME/COMPANY] header');
    // The user-text portion (before the suffix) must no longer contain the
    // placeholder. The suffix itself enumerates examples in quotes — that's
    // intentional, so we only check the prefix.
    const userPortion = out.split('Educational illustration only')[0];
    expect(userPortion).not.toContain('[YOUR NAME/COMPANY]');
    expect(userPortion).not.toContain('[YOUR NAME]');
    expect(userPortion).toContain('Cover with');
    expect(userPortion).toContain('header');
  });

  it('appends a no-placeholder guard suffix', () => {
    const out = sanitizeImagePrompt('A diagram of the water cycle');
    expect(out).toContain('no placeholder copy');
    expect(out).toContain('PRESENTATION BY');
  });

  it('does not append the guard suffix twice if already present', () => {
    const once = sanitizeImagePrompt('A diagram');
    const twice = sanitizeImagePrompt(once);
    const occurrences = twice.split('no placeholder copy').length - 1;
    expect(occurrences).toBe(1);
  });

  it('handles empty / non-string input', () => {
    expect(sanitizeImagePrompt('')).toBe('');
    // @ts-expect-error runtime guard
    expect(sanitizeImagePrompt(null)).toBe(null);
  });
});

describe('withDefaultNegativePrompt (NEW-002)', () => {
  it('returns the hardened default when no user negative prompt given', () => {
    const out = withDefaultNegativePrompt();
    expect(out).toContain('placeholder text');
    expect(out).toContain('[YOUR NAME]');
  });

  it('merges user-provided negative prompt with the default', () => {
    const out = withDefaultNegativePrompt('blurry, low resolution');
    expect(out.startsWith('blurry, low resolution')).toBe(true);
    expect(out).toContain('placeholder text');
  });

  it('falls back to default when user prompt is whitespace only', () => {
    const out = withDefaultNegativePrompt('   ');
    expect(out).toContain('placeholder text');
    expect(out.startsWith(' ')).toBe(false);
  });
});
