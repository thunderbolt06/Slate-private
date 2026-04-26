import { describe, it, expect } from 'vitest';
import { sanitizeImagePrompt } from '@/lib/media/image-prompt-sanitizer';

describe('sanitizeImagePrompt', () => {
  it('strips [YOUR NAME/COMPANY] style placeholders (NEW-002)', () => {
    const out = sanitizeImagePrompt(
      'A presentation slide titled "PRESENTATION BY [YOUR NAME/COMPANY] (e.g., QUANTUM TECH)" introducing AI.',
    );
    expect(out).not.toMatch(/\[YOUR/i);
    expect(out).not.toMatch(/quantum\s+tech/i);
  });

  it('rewrites stock/template framing into a neutral illustration', () => {
    const out = sanitizeImagePrompt(
      'A clean stock photo title slide for a business presentation about photosynthesis.',
    );
    expect(out).not.toMatch(/title\s+slide/i);
    expect(out).not.toMatch(/stock\s+photo/i);
    expect(out).toMatch(/illustration/i);
  });

  it('appends a no-text-overlay guardrail once', () => {
    const a = sanitizeImagePrompt('Diagram of the water cycle.');
    expect(a).toMatch(/text overlay|placeholder/i);
    const b = sanitizeImagePrompt(a);
    // Should not double-append.
    expect((b.match(/text overlay/gi) || []).length).toBeLessThanOrEqual(1);
  });

  it('passes safe prompts through untouched (besides guardrail)', () => {
    const out = sanitizeImagePrompt(
      'A labelled cross-section of a plant cell with nucleus, cytoplasm, and chloroplast.',
    );
    expect(out).toMatch(
      /labelled cross-section of a plant cell with nucleus, cytoplasm, and chloroplast/,
    );
  });

  it('handles empty / non-string input safely', () => {
    expect(sanitizeImagePrompt('')).toBe('');
    // @ts-expect-error – runtime guard for non-string input
    expect(sanitizeImagePrompt(null)).toBe(null);
  });
});
