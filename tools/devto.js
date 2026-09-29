#!/usr/bin/env node
/**
 * Cross-post a built post to dev.to as an unpublished draft, pointing back to this site.
 *
 * Usage: node tools/devto.js <slug> [--dry-run]
 *
 * Run build-post.js first: this reads <slug>/post.md and the posts.json entry it wrote.
 * The API key (dev.to → Settings → Extensions → DEV Community API Keys) is read from
 * ~/.config/my-blogs/devto_api_key, outside the repo on purpose, or from DEVTO_API_KEY.
 * The first run creates the draft and records its id in posts.json; later runs update it.
 * Publishing stays a manual click on dev.to.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
const KEY_FILE = path.join(os.homedir(), '.config/my-blogs/devto_api_key');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const slug = args.find((a) => !a.startsWith('--'));
if (!slug) {
  console.error('usage: devto.js <slug> [--dry-run]');
  process.exit(1);
}

const manifestPath = path.join(ROOT, 'posts.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entry = manifest.find((p) => p.slug === slug && p.title);
if (!entry) {
  console.error(`no built post "${slug}" in posts.json — run build-post.js first`);
  process.exit(1);
}

const url = `${site.url}/${slug}/`;
const md = fs.readFileSync(path.join(ROOT, slug, 'post.md'), 'utf8');

// dev.to shows title and description itself, so drop the H1, the dek and the rule after it.
// Relative image paths must become absolute URLs on this site.
const bodyMarkdown = md
  .replace(/^#\s+.+\n+/, '')
  .replace(/^\*.+\*\s*\n+/, '')
  .replace(/^---\s*\n+/, '')
  .replace(/\]\((?!https?:)(diagrams\/[^)]+)\)/g, `](${url}$1)`)
  + `\n\n---\n\n*Originally published at [${site.url.replace(/^https?:\/\//, '')}](${url}).*\n`;

// dev.to tags: at most 4, lowercase alphanumeric only.
const tags = (entry.tags || []).map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean).slice(0, 4);

const article = {
  title: entry.title,
  body_markdown: bodyMarkdown,
  published: false,
  description: entry.dek.length > 150 ? `${entry.dek.slice(0, 147).replace(/\s+\S*$/, '')}…` : entry.dek,
  canonical_url: url,
  tags,
};

if (dryRun) {
  console.log(JSON.stringify({ ...article, body_markdown: `${bodyMarkdown.slice(0, 300)}… (${bodyMarkdown.length} chars)` }, null, 2));
  process.exit(0);
}

const key = process.env.DEVTO_API_KEY || (fs.existsSync(KEY_FILE) && fs.readFileSync(KEY_FILE, 'utf8').trim());
if (!key) {
  console.error(`no dev.to API key: put it in ${KEY_FILE} (chmod 600) or set DEVTO_API_KEY`);
  process.exit(1);
}

(async () => {
  const existing = entry.devto && entry.devto.id;
  const res = await fetch(existing ? `https://dev.to/api/articles/${existing}` : 'https://dev.to/api/articles', {
    method: existing ? 'PUT' : 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/vnd.forem.api-v1+json' },
    body: JSON.stringify({ article }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`dev.to responded ${res.status}: ${JSON.stringify(data)}`);
    process.exit(1);
  }
  entry.devto = { id: data.id, url: data.url };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${existing ? 'updated' : 'created'} dev.to draft ${data.id} → https://dev.to/dashboard (preview, then publish there)`);
})();
