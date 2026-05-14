import { describe, it, expect } from 'vitest';
import { cleanHtml } from '@/lib/scanner/tools/html-clean';

describe('cleanHtml', () => {
  it('returns empty input unchanged', () => {
    expect(cleanHtml('')).toBe('');
  });

  it('strips HTML comments', () => {
    const input = '<p>hi</p><!-- <script src="http://evil.com/x.js"></script> --><p>bye</p>';
    const out = cleanHtml(input);
    expect(out).not.toContain('evil.com');
    expect(out).toContain('<p>hi</p>');
    expect(out).toContain('<p>bye</p>');
  });

  it('strips multi-line comments', () => {
    const input = '<div>before</div>\n<!--\n  example: <script src="http://foo">\n-->\n<div>after</div>';
    const out = cleanHtml(input);
    expect(out).not.toContain('foo');
    expect(out).toContain('before');
    expect(out).toContain('after');
  });

  it('removes <script> body but preserves the opening tag attributes', () => {
    const input = '<script src="https://cdn.example.com/app.js">var leaked = "secret";</script>';
    const out = cleanHtml(input);
    expect(out).toContain('<script src="https://cdn.example.com/app.js">');
    expect(out).toContain('</script>');
    expect(out).not.toContain('secret');
  });

  it('removes <style> body', () => {
    const input = '<style>body::before{content:"http://example.com"}</style>';
    const out = cleanHtml(input);
    expect(out).toContain('<style>');
    expect(out).toContain('</style>');
    expect(out).not.toContain('example.com');
  });

  it('removes <pre>, <code>, <samp> bodies — docs/blog FP source', () => {
    const input = `
      <h1>How to load scripts</h1>
      <p>Avoid mixed content like this:</p>
      <pre><code>&lt;script src="http://insecure.example.com/lib.js"&gt;&lt;/script&gt;</code></pre>
      <p>End of example.</p>
    `;
    const out = cleanHtml(input);
    expect(out).not.toContain('insecure.example.com');
    expect(out).toContain('How to load scripts');
    expect(out).toContain('End of example.');
  });

  it('preserves <script src> tags between separate scripts', () => {
    const input = `
      <script src="http://cdn.bad/a.js">var a = 1;</script>
      <script>var b = 2;</script>
      <script src="https://cdn.ok/c.js"></script>
    `;
    const out = cleanHtml(input);
    expect(out).toContain('http://cdn.bad/a.js');
    expect(out).toContain('https://cdn.ok/c.js');
    expect(out).not.toMatch(/var a = 1/);
    expect(out).not.toMatch(/var b = 2/);
  });

  it('is case-insensitive on tag names', () => {
    const input = '<SCRIPT>alert(1)</SCRIPT><Style>body{}</Style>';
    const out = cleanHtml(input);
    expect(out).not.toContain('alert(1)');
    expect(out).not.toContain('body{}');
  });

  it('handles tags with attributes on the closing region', () => {
    const input = '<pre class="example">leak text http://leak.com leak</pre>';
    const out = cleanHtml(input);
    expect(out).toContain('<pre class="example">');
    expect(out).toContain('</pre>');
    expect(out).not.toContain('leak.com');
  });

  it('leaves unmatched/self-closing fragments alone', () => {
    // No matching </script>; we don't try to repair malformed HTML.
    const input = '<script src="https://cdn.example.com/a.js" defer></script><div>kept</div>';
    const out = cleanHtml(input);
    expect(out).toContain('cdn.example.com/a.js');
    expect(out).toContain('<div>kept</div>');
  });

  it('returns input unchanged when over the byte cap', () => {
    const huge = '<p>x</p>' + 'a'.repeat(5_000_001);
    const out = cleanHtml(huge);
    expect(out).toBe(huge);
  });

  it('falls back to original when cleaning collapses the document', () => {
    // Page is essentially nothing but <code>; stripping it would leave
    // almost nothing, which would surprise downstream modules.
    const body = '<code>' + 'x'.repeat(2_000) + '</code>';
    const out = cleanHtml(body);
    expect(out).toBe(body);
  });

  it('skips fallback for short documents where collapse is plausible', () => {
    // For very short inputs the fraction heuristic is bypassed —
    // tiny test fixtures shouldn't surprise-revert.
    const input = '<code>example</code>';
    const out = cleanHtml(input);
    expect(out).toBe('<code></code>');
  });

  it('strips both comments and code blocks in the same pass', () => {
    const input = `
      <!-- TODO: remove the http://old-cdn.local fallback -->
      <h2>Examples</h2>
      <pre>fetch('http://docs-example.com')</pre>
      <p>Live link: <a href="https://real.example.com">real</a></p>
    `;
    const out = cleanHtml(input);
    expect(out).not.toContain('old-cdn.local');
    expect(out).not.toContain('docs-example.com');
    expect(out).toContain('real.example.com');
  });
});
