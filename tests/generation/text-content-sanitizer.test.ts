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

  it('replaces bare longrightarrow even without a backslash (BUG-001 legacy data)', () => {
    // Older courses lost the backslash during JSON parsing, so the rendered
    // text was "Mg+O₂longrightarrowMg" — we recover by recognising the bare
    // command name and inserting spacing so the equation can wrap.
    const out = sanitizeTextElementContent('<p>Mg+O₂longrightarrowMg</p>');
    expect(out).toContain('→');
    expect(out).not.toContain('longrightarrow');
    expect(out).toBe('<p>Mg+O₂ → Mg</p>');
  });

  it('does not replace text fragments that just happen to contain a name', () => {
    // No backslash, no replacement. Common-English-word names (pi, alpha,
    // to, in, etc.) are deliberately not in the bare-name fallback list.
    const out = sanitizeTextElementContent('<p>The pi day was alpha-tested.</p>');
    expect(out).toBe('<p>The pi day was alpha-tested.</p>');
  });

  it('does not partially match longer identifiers', () => {
    // \alphabetical should not be rewritten to "αbetical".
    const out = sanitizeTextElementContent('<p>\\alphabetical</p>');
    expect(out).toBe('<p>\\alphabetical</p>');
  });

  it('inserts spaces around operators when jammed against alphanumerics (NEW-008)', () => {
    const out = sanitizeTextElementContent('<p>5\\leq10 and 3\\geq2</p>');
    expect(out).toBe('<p>5 ≤ 10 and 3 ≥ 2</p>');
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
    // preserved.
    const out = sanitizeTextElementContent('<p>line one</p>\n<p>line two</p>');
    expect(out).toBe('<p>line one</p> <p>line two</p>');
    expect(out).toContain('</p>');
    expect(out).toContain('<p>line two');
  });

  it('handles empty and non-string content gracefully', () => {
    expect(sanitizeTextElementContent('')).toBe('');
    // @ts-expect-error — runtime guard for non-string input
    expect(sanitizeTextElementContent(null)).toBe(null);
  });
});
