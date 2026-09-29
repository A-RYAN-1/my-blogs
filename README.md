# my-blogs

Engineering stories by **Aryan Deshmukh**: real production bugs and the systems behind them,
told as a narrative with diagrams and the actual code.

**Read online:** <https://a-ryan-1.github.io/my-blogs/> · **RSS:** <https://a-ryan-1.github.io/my-blogs/feed.xml>

## Posts

| # | Post | Topics | Read |
|---|---|---|---|
| 1 | **The Water That Flowed Backwards**<br>One line of Go turned perfectly valid water-meter readings into impossible graphs. | distributed systems, IoT, MQTT, Go | [web](https://a-ryan-1.github.io/my-blogs/water-that-flowed-backwards/) · [markdown](water-that-flowed-backwards/post.md) |

## How this repo works

Posts are drafted elsewhere. This repo only holds the finished, published versions. GitHub Pages
serves it straight from `main`, and each post page is kept deliberately plain so
[Medium's importer](https://medium.com/p/import) can pull it in cleanly. The GitHub Pages copy is
the original, and Medium and other platforms credit it as the source.

```
my-blogs/
├── index.html                    ← site home: list of posts (generated)
├── feed.xml                      ← RSS feed with full post content (generated)
├── posts.json                    ← post list: dates, tags, reading time, dev.to ids
├── site.json                     ← site title, profile links, analytics code
├── tools/build-post.js           ← builds a post page, home page and feed
├── tools/devto.js                ← cross-posts a post to dev.to as a draft
└── <post-slug>/
    ├── index.html                ← the published page (generated)
    ├── post.md                   ← markdown source, also used for dev.to / Hashnode
    └── diagrams/*.png
```

`build-post.js` turns `post.md` into the page and makes it Medium-friendly along the way:
- diagrams are published as PNG, because Medium cannot show SVG
- `*Figure N — …*` lines become image captions
- tables become aligned plain text, because Medium has no tables
- the page gets a canonical link, a description and a preview image
- before building anything, the source goes through a leak scan for real names, hostnames,
  emails and commit hashes, and the build stops on any finding, because this repo is public

## Publishing a new post

```bash
npm install                                            # first time only
node tools/build-post.js "<source-post-folder>" <slug> # e.g. water-that-flowed-backwards
git add -A && git commit -m 'Publish "<Title>"' && git push
```

The source folder needs a `post.md` and a `diagrams/` folder of `.png` files. GitHub Pages
redeploys within a minute or two. Then:

1. Open `https://a-ryan-1.github.io/my-blogs/<slug>/` and check it.
2. Import it at <https://medium.com/p/import> and tidy the draft (pull quotes, image widths, tags).
3. Publish.
4. Optionally cross-post to dev.to: `node tools/devto.js <slug>` creates an unpublished draft
   there with a canonical link back here (running it again updates the draft). It needs a dev.to
   API key in `~/.config/my-blogs/devto_api_key`, kept outside the repo.

Visitor stats use [GoatCounter](https://www.goatcounter.com): no cookies, free for personal
sites. Put the site code in `site.json` → `goatcounter` and rebuild to turn it on.

## License

Text and diagrams © Aryan Deshmukh. Please link back rather than republishing.
