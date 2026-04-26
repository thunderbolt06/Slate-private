import { describe, it, expect } from 'vitest';
import { sanitizeTextElementContent } from '@/lib/generation/text-content-sanitizer';

describe('sanitizeTextElementContent', () => {
  it('replaces \\longrightarrow with the unicode arrow (BUG-001)', () => {
    const out = sanitizeTextElementContent('<p>Mg + O₂\\longrightarrow MgO</p>');
    expect(out).toContain('→');
    expect(out).not.toContain('longrightarrow');
    expect(out).not.toContain('\\');
  });

  it('replaces a curated set of arrow and Greek commands', () => {
    const out = sanitizeTextElementContent(
      '<p>\\rightarrow \\Rightarrow \\alpha \\beta \\leq \\geq \\neq</p>',
    );
    expect(out).toBe('<p>→ ⇒ α β ≤ ≥ ≠</p>');
  });

  it('does not replace text fragments that just happen to contain a name', () => {
    // No backslash, no replacement.
    const out = sanitizeTextElementContent('<p>The pi day was alpha-tested.</p>');
    expect(out).toBe('<p>The pi day was alpha-tested.</p>');
  });

  it('does not partially match longer identifiers', () => {
    // \alphabetic should not be rewritten to "αbetic".
    const out = sanitizeTextElementContent('<p>\\alphabetical</p>');
    expect(out).toBe('<p>\\alphabetical</p>');
  });

  it('collapses stray newlines inside paragraph text (BUG-003)', () => {
    const out = sanitizeTextElementContent(
      '<p>Harnessing light energy to synthesize\n\nfood.</p>',
    );
    expect(out).toBe('<p>Harnessing light energy to synthesize food.</p>');
  });

  it('does not turn between-tag formatting into a literal paragraph break', () => {
    // The original bug was visible mid-sentence gaps. Both "<p>...</p>\n<p>..."
    // and "<p>...</p> <p>..." render identically in the browser, so collapsing
    // the newline to a space here is acceptable as long as the structure is
    // preserved (and the second <p> doesn't fold into the first).
    const out = sanitizeTextElementContent(
      '<p>Sentence one.</p>\n<p>Sentence two.</p>',
    );
    expect(out).toBe('<p>Sentence one.</p> <p>Sentence two.</p>');
    expect(out).toContain('</p>');
    expect(out).toContain('<p>Sentence two');
  });

  it('replaces bare LaTeX command names that lost their backslash (BUG-001)', () => {
    // Audit caught output like "Mg + O₂longrightarrowMg" — the JSON pipeline
    // sometimes drops the leading `\` and the bare command name leaks through.
    const out = sanitizeTextElementContent('<p>Mg + O₂longrightarrowMg</p>');
    expect(out).toBe('<p>Mg + O₂→Mg</p>');
  });

  it('does not match short bare command tokens that are real English words', () => {
    // `to`, `in`, `pi`, `alpha` are common English / context words. Without a
    // backslash they should stay as-is to avoid over-matching.
    const out = sanitizeTextElementContent(
      '<p>The pi day was alpha-tested in to school.</p>',
    );
    expect(out).toBe('<p>The pi day was alpha-tested in to school.</p>');
  });

  it('merges mid-sentence paragraph splits (BUG-003)', () => {
    // The AI sometimes ships a single sentence as two <p> tags; the resulting
    // paragraph gap mid-sentence reads as broken. We merge when the first
    // doesn't end with a sentence terminator AND the second starts lowercase.
    const out = sanitizeTextElementContent(
      '<p>Harnessing light energy to synthesize</p><p>food.</p>',
    );
    expect(out).toBe('<p>Harnessing light energy to synthesize food.</p>');
  });

  it('preserves genuine list items that start with a capital letter', () => {
    const out = sanitizeTextElementContent(
      '<p>Step 1</p><p>Step 2</p>',
    );
    // Capital starts → keep as separate paragraphs.
    expect(out).toContain('<p>Step 1</p>');
    expect(out).toContain('<p>Step 2</p>');
  });

  it('handles empty and non-string content gracefully', () => {
    expect(sanitizeTextElementContent('')).toBe('');
    // @ts-expect-error — runtime guard for non-string input
    expect(sanitizeTextElementContent(null)).toBe(null);
  });
});
