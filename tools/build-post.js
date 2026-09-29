#!/usr/bin/env node
/**
 * Build one post into an import-friendly page, then refresh the site index.
 *
 * Usage: node tools/build-post.js <source-post-folder> <slug>
 *
 * The source folder holds post.md and diagrams/*.png. The output page is
 * deliberately plain so Medium's importer (medium.com/p/import) reads it cleanly:
 * PNG images (Medium cannot render SVG), captions as <figcaption>, and tables
 * turned into preformatted text (Medium has no tables).
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const SITE = 'https://a-ryan-1.github.io/my-blogs';
const ROOT = path.resolve(__dirname, '..');

const [srcDir, slug] = process.argv.slice(2);
if (!srcDir || !slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('usage: build-post.js <source-post-folder> <slug: lowercase-with-dashes>');
  process.exit(1);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const md = fs.readFileSync(path.join(srcDir, 'post.md'), 'utf8');
const title = md.match(/^#\s+(.+)$/m)[1].trim();
const dekMatch = md.match(/^#\s+.+\n+\*(.+)\*\s*$/m);
const dek = dekMatch ? dekMatch[1].trim() : '';

// Body: everything after the title and dek, which go into the page header instead.
let bodyMd = md.replace(/^#\s+.+\n+/, '');
if (dekMatch) bodyMd = bodyMd.replace(/^\*.+\*\s*\n+/, '').replace(/^---\s*\n+/, '');

// Tables become aligned plain text in a code block.
bodyMd = bodyMd.replace(/((?:^\|.*\|\s*\n)+)/gm, (table) => {
  const rows = table.trim().split('\n')
    .filter((r) => !/^\|[\s|:-]+\|$/.test(r.trim()))
    .map((r) => r.trim().slice(1, -1).split('|').map((c) => c.trim().replace(/`/g, '')));
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] || '').length)));
  const lines = rows.map((r) => r.map((c, i) => c.padEnd(widths[i])).join('   ').trimEnd());
  lines.splice(1, 0, widths.map((w) => '-'.repeat(w)).join('   '));
  return '```text\n' + lines.join('\n') + '\n```\n';
});

marked.setOptions({ gfm: true, breaks: false });
let body = marked.parse(bodyMd);

// Image paragraph + following "*Figure N — …*" paragraph → <figure> with caption, PNG source.
body = body.replace(
  /<p><img src="([^"]+?)(?:\.svg|\.png)" alt="([^"]*)"\s*\/?><\/p>\s*<p><em>(Figure[\s\S]*?)<\/em><\/p>/g,
  (_, base, alt, cap) => `<figure>\n<img src="${base}.png" alt="${alt}">\n<figcaption>${cap}</figcaption>\n</figure>`
);
body = body.replace(/src="([^"]+)\.svg"/g, 'src="$1.png"');

const url = `${SITE}/${slug}/`;
const hasFirstFigure = /src="diagrams\/01-[^"]+\.png"/.exec(body);
const ogImage = hasFirstFigure ? `${url}${hasFirstFigure[0].slice(5, -1)}` : '';

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(dek)}">
<meta name="author" content="Aryan Deshmukh">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(dek)}">
<meta property="og:url" content="${url}">
${ogImage ? `<meta property="og:image" content="${ogImage}">\n` : ''}<style>
  :root { --fg: #1a1a1a; --muted: #5f5f5f; --bg: #fff; --code: #f4f4f2; --rule: #e4e4e0; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #e8e6e1; --muted: #a09d96; --bg: #161616; --code: #232322; --rule: #333; }
  }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 19px/1.7 Georgia, "Times New Roman", serif; }
  article { max-width: 700px; margin: 0 auto; padding: 48px 16px 96px; }
  h1, h2, h3 { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.25; }
  h1 { font-size: 2.2em; margin: 0 0 .3em; }
  .dek { color: var(--muted); font-size: 1.15em; margin: 0 0 2em; }
  h2 { margin-top: 2em; }
  img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  figure { margin: 2em 0; }
  figcaption { color: var(--muted); font-size: .85em; text-align: center; margin-top: .6em; }
  pre { background: var(--code); padding: 14px 16px; overflow-x: auto; font-size: .78em; line-height: 1.5; border-radius: 4px; }
  code { font-family: Menlo, Consolas, monospace; font-size: .9em; }
  pre code { font-size: 1em; }
  blockquote { margin: 1.6em 0; padding-left: 1em; border-left: 3px solid var(--fg); font-style: italic; }
  hr { border: 0; border-top: 1px solid var(--rule); margin: 2.5em 0; }
  a { color: inherit; }
</style>
</head>
<body>
<article>
<header>
<h1>${esc(title)}</h1>
${dek ? `<p class="dek">${esc(dek)}</p>\n` : ''}</header>
${body}
</article>
</body>
</html>
`;

// Write the post folder: page, markdown source, PNG diagrams only.
const outDir = path.join(ROOT, slug);
fs.mkdirSync(path.join(outDir, 'diagrams'), { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), page);
// Only PNGs are published, so the markdown copy points at them too.
fs.writeFileSync(path.join(outDir, 'post.md'), md.replace(/(\]\(diagrams\/[^)]+)\.svg\)/g, '$1.png)'));
const srcDiagrams = path.join(srcDir, 'diagrams');
const pngs = fs.existsSync(srcDiagrams) ? fs.readdirSync(srcDiagrams).filter((f) => f.endsWith('.png')) : [];
for (const f of pngs) fs.copyFileSync(path.join(srcDiagrams, f), path.join(outDir, 'diagrams', f));

// Every PNG the page references must exist.
const missing = [...page.matchAll(/src="(diagrams\/[^"]+)"/g)].map((m) => m[1])
  .filter((p) => !fs.existsSync(path.join(outDir, p)));
if (missing.length) {
  console.error(`missing images: ${missing.join(', ')}`);
  process.exit(1);
}

// Refresh the site index from every post folder.
const posts = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, 'index.html')))
  .map((d) => {
    const html = fs.readFileSync(path.join(ROOT, d.name, 'index.html'), 'utf8');
    return {
      slug: d.name,
      title: (html.match(/<title>([^<]*)<\/title>/) || [])[1] || d.name,
      dek: (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '',
    };
  });
const index = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aryan Deshmukh — Blog</title>
<style>
  :root { --fg: #1a1a1a; --muted: #5f5f5f; --bg: #fff; }
  @media (prefers-color-scheme: dark) { :root { --fg: #e8e6e1; --muted: #a09d96; --bg: #161616; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 18px/1.6 Georgia, serif; }
  main { max-width: 700px; margin: 0 auto; padding: 48px 16px; }
  h1 { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  li { margin-bottom: 1.4em; } a { color: inherit; font-weight: bold; } p { color: var(--muted); margin: .2em 0 0; }
</style>
</head>
<body>
<main>
<h1>Aryan Deshmukh — Blog</h1>
<ul>
${posts.map((p) => `<li><a href="${p.slug}/">${p.title}</a><p>${p.dek}</p></li>`).join('\n')}
</ul>
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'index.html'), index);

console.log(`built ${slug}/ (${pngs.length} diagrams) → ${url}`);
