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

  it('replaces \\longrightarrow when an uppercase element symbol follows (BUG-001)', () => {
    // Chemistry equations like `Mg + O₂\longrightarrowMgO` previously
    // rendered as "longrightarrow" because the lookahead rejected any
    // following letter. Capital letters are now allowed.
    const out = sanitizeTextElementContent('<p>Mg + O₂\\longrightarrowMgO</p>');
    expect(out).toBe('<p>Mg + O₂→MgO</p>');
  });

  it('collapses stray newlines inside paragraph text (BUG-003)', () => {
    const out = sanitizeTextElementContent(
      '<p>Harnessing light energy to synthesize\n\nfood.</p>',
    );
    expect(out).toBe('<p>Harnessing light energy to synthesize food.</p>');
  });

  it('preserves separate paragraphs when each ends with terminating punctuation', () => {
    // Sentence-terminated paragraphs are intentional and must not be merged.
    const out = sanitizeTextElementContent(
      '<p>Line one.</p>\n<p>Line two.</p>',
    );
    expect(out).toContain('<p>Line one.</p>');
    expect(out).toContain('<p>Line two.</p>');
  });

  it('handles empty and non-string content gracefully', () => {
    expect(sanitizeTextElementContent('')).toBe('');
    // @ts-expect-error — runtime guard for non-string input
    expect(sanitizeTextElementContent(null)).toBe(null);
  });

  it('replaces bare arrow command names without backslash (BUG-001)', () => {
    // The AI sometimes emits the command name with no leading backslash
    // (e.g. JSON parsing strips it), leaving "longrightarrow" in the output.
    const out = sanitizeTextElementContent('<p>Mg + O₂longrightarrowMgO</p>');
    expect(out).toBe('<p>Mg + O₂→MgO</p>');
  });

  it('replaces bare arrow names anywhere they appear (BUG-001)', () => {
    const out = sanitizeTextElementContent('<p>A rightarrow B</p>');
    expect(out).toBe('<p>A → B</p>');
  });

  it('does not strip ambiguous short commands without a backslash', () => {
    // "to", "in", "pi", "div", "times" are valid English words; never strip
    // these unless they are escaped.
    const out = sanitizeTextElementContent(
      '<p>Try to find pi in this division of times.</p>',
    );
    expect(out).toBe('<p>Try to find pi in this division of times.</p>');
  });

  it('merges continuation paragraphs split mid-sentence (BUG-003)', () => {
    // The AI sometimes emits two <p> tags that are really one sentence.
    // Without merging, the default <p> margin renders as a paragraph gap
    // mid-thought.
    const out = sanitizeTextElementContent(
      '<p>Harnessing light energy to synthesize</p><p>food.</p>',
    );
    expect(out).toBe('<p>Harnessing light energy to synthesize food.</p>');
  });

  it('does not merge paragraphs that end with sentence punctuation', () => {
    const out = sanitizeTextElementContent(
      '<p>First sentence.</p><p>Second sentence.</p>',
    );
    expect(out).toBe('<p>First sentence.</p><p>Second sentence.</p>');
  });

  it('merges chains of three continuation paragraphs (BUG-003)', () => {
    const out = sanitizeTextElementContent(
      '<p>Organisms that</p><p>create their own</p><p>energy from light.</p>',
    );
    expect(out).toBe('<p>Organisms that create their own energy from light.</p>');
  });
});
