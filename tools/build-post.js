#!/usr/bin/env node
/**
 * Build one post into an import-friendly page, then refresh the home page and RSS feed.
 *
 * Usage: node tools/build-post.js <source-post-folder> <slug> [--no-lint]
 *
 * The source folder holds post.md, diagrams/*.png and (optionally) PUBLISHING.md, whose
 * "**Tags** —" line supplies the tags. The page is deliberately plain so Medium's importer
 * (medium.com/p/import) reads it cleanly: PNG images (Medium cannot render SVG), captions as
 * <figcaption>, and tables turned into preformatted text (Medium has no tables). Byline and
 * footer sit outside <article> so the importer leaves them behind.
 *
 * The repo is public, so the source is run through the blog skill's leak linter first and
 * nothing is built if it reports an error.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
const LINT = process.env.LINT_POST
  || path.join(os.homedir(), '.claude/skills/technical-story-blog/tools/lint-post.js');

const args = process.argv.slice(2);
const noLint = args.includes('--no-lint');
const [srcDir, slug] = args.filter((a) => !a.startsWith('--'));
if (!srcDir || !slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('usage: build-post.js <source-post-folder> <slug: lowercase-with-dashes> [--no-lint]');
  process.exit(1);
}

// ---------- leak gate ----------
if (noLint) {
  console.warn('WARNING: --no-lint given, skipping the leak scan');
} else if (!fs.existsSync(LINT)) {
  console.error(`lint-post.js not found at ${LINT} (set LINT_POST, or pass --no-lint deliberately)`);
  process.exit(1);
} else {
  try {
    execFileSync('node', [LINT, srcDir], { stdio: 'inherit' });
  } catch {
    console.error('lint reported errors — fix them before publishing to a public repo');
    process.exit(1);
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// ---------- read the source ----------
const md = fs.readFileSync(path.join(srcDir, 'post.md'), 'utf8');
const title = md.match(/^#\s+(.+)$/m)[1].trim();
const dekMatch = md.match(/^#\s+.+\n+\*(.+)\*\s*$/m);
const dek = dekMatch ? dekMatch[1].trim() : '';

const pubPath = path.join(srcDir, 'PUBLISHING.md');
const tagLine = fs.existsSync(pubPath) ? (fs.readFileSync(pubPath, 'utf8').match(/^\*\*Tags\*\*\s*—\s*(.+)$/m) || [])[1] : '';
const tags = tagLine ? [...tagLine.matchAll(/`([^`]+)`/g)].map((m) => m[1]) : [];

// Reading time from prose words only, excluding fenced code (same rule as the preview).
const words = (md.replace(/```[\s\S]*?```/g, ' ').match(/\b[\w'’-]+\b/g) || []).length;
const minutes = Math.max(1, Math.round(words / 225));

// ---------- manifest: keep the first-publish date and any cross-post ids ----------
const manifestPath = path.join(ROOT, 'posts.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let entry = manifest.find((p) => p.slug === slug);
if (!entry) {
  entry = { slug, date: new Date().toISOString().slice(0, 10) };
  manifest.push(entry);
}
Object.assign(entry, { title, dek, tags, minutes });

// ---------- body ----------
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

const url = `${site.url}/${slug}/`;
const firstFigure = body.match(/src="(diagrams\/01-[^"]+\.png)"/);
const ogImage = firstFigure ? `${url}${firstFigure[1]}` : '';

// ---------- shared page parts ----------
const THEME = `
  :root { --fg: #1a1a1a; --muted: #5f5f5f; --bg: #fff; --code: #f4f4f2; --rule: #e4e4e0; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #e8e6e1; --muted: #a09d96; --bg: #161616; --code: #232322; --rule: #333; }
  }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 19px/1.7 Georgia, "Times New Roman", serif; }
  .wrap { max-width: 700px; margin: 0 auto; padding: 0 16px; }
  h1, h2, h3, .sans { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.25; }
  a { color: inherit; }
  .muted { color: var(--muted); }
  .site-footer { border-top: 1px solid var(--rule); margin-top: 48px; padding: 24px 0 64px; font-size: .8em; }
  .site-footer a { margin-right: 1.2em; }`;

const analytics = site.goatcounter
  ? `<script data-goatcounter="https://${site.goatcounter}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>\n`
  : '';

const footer = (home) => `<footer class="site-footer sans muted"><div class="wrap">
${home ? '' : `<a href="../">← All posts</a>`}${Object.entries(site.links).map(([k, v]) => `<a href="${v}">${k}</a>`).join('')}<a href="${home ? '' : '../'}feed.xml">RSS</a>
</div></footer>`;

// ---------- post page ----------
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(dek)}">
<meta name="author" content="${esc(site.author)}">
<link rel="canonical" href="${url}">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="${site.url}/feed.xml">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(dek)}">
<meta property="og:url" content="${url}">
<meta property="article:published_time" content="${entry.date}">
${ogImage ? `<meta property="og:image" content="${ogImage}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" media="(prefers-color-scheme: light)">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
<style>${THEME}
  article { padding-top: 48px; }
  h1 { font-size: 2.2em; margin: 0 0 .3em; }
  .dek { color: var(--muted); font-size: 1.15em; margin: 0 0 1.2em; }
  .byline { font-size: .8em; margin: 0 0 2.5em; }
  h2 { margin-top: 2em; }
  img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  figure { margin: 2em 0; }
  figcaption { color: var(--muted); font-size: .85em; text-align: center; margin-top: .6em; }
  pre { background: var(--code); padding: 14px 16px; overflow-x: auto; font-size: .78em; line-height: 1.5; border-radius: 4px; }
  pre code.hljs { background: none; padding: 0; }
  code { font-family: Menlo, Consolas, monospace; font-size: .9em; }
  pre code { font-size: 1em; }
  blockquote { margin: 1.6em 0; padding-left: 1em; border-left: 3px solid var(--fg); font-style: italic; }
  hr { border: 0; border-top: 1px solid var(--rule); margin: 2.5em 0; }
</style>
${analytics}</head>
<body>
<article class="wrap">
<header>
<h1>${esc(title)}</h1>
${dek ? `<p class="dek">${esc(dek)}</p>\n` : ''}</header>
<!-- body:start -->
${body}
<!-- body:end -->
</article>
<div class="wrap"><p class="byline sans muted">${esc(site.author)} · <time datetime="${entry.date}">${fmtDate(entry.date)}</time> · ${minutes} min read${tags.length ? ` · ${tags.map(esc).join(', ')}` : ''}</p></div>
${footer(false)}
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script>hljs.highlightAll();</script>
</body>
</html>
`;

// ---------- write the post folder: page, markdown source, PNG diagrams only ----------
const outDir = path.join(ROOT, slug);
fs.mkdirSync(path.join(outDir, 'diagrams'), { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), page);
// Only PNGs are published, so the markdown copy points at them too.
fs.writeFileSync(path.join(outDir, 'post.md'), md.replace(/(\]\(diagrams\/[^)]+)\.svg\)/g, '$1.png)'));
const srcDiagrams = path.join(srcDir, 'diagrams');
const pngs = fs.existsSync(srcDiagrams) ? fs.readdirSync(srcDiagrams).filter((f) => f.endsWith('.png')) : [];
for (const f of pngs) fs.copyFileSync(path.join(srcDiagrams, f), path.join(outDir, 'diagrams', f));

const missing = [...page.matchAll(/src="(diagrams\/[^"]+)"/g)].map((m) => m[1])
  .filter((p) => !fs.existsSync(path.join(outDir, p)));
if (missing.length) {
  console.error(`missing images: ${missing.join(', ')}`);
  process.exit(1);
}

// ---------- manifest, home page, feed ----------
manifest.sort((a, b) => b.date.localeCompare(a.date));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const posts = manifest.filter((p) => p.title);

fs.writeFileSync(path.join(ROOT, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.title)}</title>
<meta name="description" content="${esc(site.description)}">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="${site.url}/feed.xml">
<style>${THEME}
  main { padding-top: 48px; }
  .intro { margin-top: -.4em; }
  ul { list-style: none; padding: 0; margin-top: 2.5em; }
  li { margin-bottom: 2em; }
  li a { font-weight: bold; font-size: 1.1em; }
  li p { margin: .3em 0 0; }
  .meta { font-size: .75em; }
</style>
${analytics}</head>
<body>
<main class="wrap">
<h1>${esc(site.title)}</h1>
<p class="intro muted">${esc(site.description)}</p>
<ul>
${posts.map((p) => `<li><a href="${p.slug}/">${esc(p.title)}</a>
<p class="muted">${esc(p.dek)}</p>
<p class="meta sans muted">${fmtDate(p.date)} · ${p.minutes} min read</p></li>`).join('\n')}
</ul>
</main>
${footer(true)}
</body>
</html>
`);

const cdata = (s) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
const items = posts.map((p) => {
  const html = fs.readFileSync(path.join(ROOT, p.slug, 'index.html'), 'utf8');
  const postUrl = `${site.url}/${p.slug}/`;
  const content = (html.match(/<!-- body:start -->([\s\S]*?)<!-- body:end -->/) || [, ''])[1]
    .replace(/src="(?!https?:)([^"]+)"/g, (_, rel) => `src="${postUrl}${rel}"`);
  return `<item>
<title>${esc(p.title)}</title>
<link>${postUrl}</link>
<guid isPermaLink="true">${postUrl}</guid>
<pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>
<description>${esc(p.dek)}</description>
${(p.tags || []).map((t) => `<category>${esc(t)}</category>`).join('\n')}
<content:encoded>${cdata(content)}</content:encoded>
</item>`;
});
fs.writeFileSync(path.join(ROOT, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(site.title)}</title>
<link>${site.url}/</link>
<description>${esc(site.description)}</description>
<language>en</language>
<atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
</channel>
</rss>
`);

console.log(`built ${slug}/ (${pngs.length} diagrams, ${minutes} min read) → ${url}`);
