# my-blogs

Engineering stories by **Aryan Deshmukh**: real production bugs and the systems behind them,
told as a narrative with diagrams and the actual code.

**Read online:** <https://a-ryan-1.github.io/my-blogs/> · **RSS:** <https://a-ryan-1.github.io/my-blogs/feed.xml>

## Posts

| # | Post | Topics | Read |
|---|---|---|---|
| 1 | **The Water That Flowed Backwards**<br>One line of Go turned perfectly valid water-meter readings into impossible graphs. | distributed systems, IoT, MQTT, Go | [web](https://a-ryan-1.github.io/my-blogs/water-that-flowed-backwards/) · [markdown](water-that-flowed-backwards/post.md) |

## How this repo works

Posts are drafted elsewhere. This repo holds the finished versions as a small site of our own,
served by GitHub Pages straight from `main`. Publishing on Medium is done by hand and doesn't
involve this repo.

```
my-blogs/
├── index.html                    ← site home: list of posts (generated)
├── feed.xml                      ← RSS feed with full post content (generated)
├── posts.json                    ← post list: dates, tags, reading time
├── site.json                     ← site title, profile links, analytics code
├── tools/build-post.js           ← builds a post page, home page and feed
└── <post-slug>/
    ├── index.html                ← the post page (generated)
    ├── post.md                   ← markdown source
    └── diagrams/*.png
```

`build-post.js` turns `post.md` into the page:
- diagrams are published as PNG
- `*Figure N. …*` lines become image captions
- tables become aligned plain text
- the page gets a canonical link, a description and a preview image
- before building anything, the source goes through a leak scan for real names, hostnames,
  emails and commit hashes, and the build stops on any finding, because this repo is public

## Adding a post

```bash
npm install                                            # first time only
node tools/build-post.js "<source-post-folder>" <slug> # e.g. water-that-flowed-backwards
git add -A && git commit -m 'Add "<Title>"' && git push
```

The source folder needs a `post.md` and a `diagrams/` folder of `.png` files. GitHub Pages
redeploys within a minute or two.

Visitor stats use [GoatCounter](https://www.goatcounter.com): no cookies, free for personal
sites. Put the site code in `site.json` → `goatcounter` and rebuild to turn it on.

## License

Text and diagrams © Aryan Deshmukh. Please link back rather than republishing.
