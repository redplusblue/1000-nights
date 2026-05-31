# Architecture — 1000 Nights

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     GitHub Repository                   │
│                                                         │
│  data/reading-list.json  ←  scripts/generate-list.js   │
│  config.json                scripts/seeds/*.json        │
│                                                         │
│  index.html + style.css + app.js  (static site)        │
│                                                         │
│  .github/workflows/nightly.yml  (cron job)              │
└─────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
  GitHub Pages              GitHub Actions
  (static hosting)          (nightly cron)
         │                          │
         ▼                          ▼
  Browser reads             Computes day N
  reading-list.json         from startDate
  and renders day N         ──────────────▶  Discord Webhook
```

## Components

### `data/reading-list.json`

The single source of truth. Generated once by `scripts/generate-list.js` and committed.
Shape:

```jsonc
[
  {
    "day": 1,
    "poem":    { "title": "...", "author": "...", "url": "...", "source": "poetrydb" },
    "story":   { "title": "...", "author": "...", "url": "...", "source": "gutenberg" },
    "essay":   { "title": "...", "author": "...", "url": "...", "source": "wikisource" },
    "tech":    { "title": "...", "author": "...", "url": "...", "source": "paulgraham" },
    "insight": { "title": "...", "author": "...", "url": "...", "source": "aeon" }
  },
  // ... 999 more
]
```

### `config.json`

```jsonc
{
  "startDate": "YYYY-MM-DD",  // Day 1 corresponds to this date
  "title": "1000 Nights"
}
```

### `app.js` — Hash Router

- Reads `#/day/N` from `window.location.hash`
- Parses query params (e.g. `?poem=1&tech=1`) for filter state
- Fetches `data/reading-list.json` (cached by browser after first load)
- Fetches `config.json` to compute today's day (for the landing page)
- Renders the day view with filtered cards
- Updates hash on filter toggle — no page reload

### `scripts/generate-list.js`

One-time script. Run locally with Node.js.

1. Reads `scripts/seeds/tech-blogs.json` and `scripts/seeds/insight-essays.json`
2. Fetches poem list from PoetryDB API (filtered to canonical authors)
3. Fetches story list from Gutendex API (filtered to curated author list)
4. Fetches essay list from Wikisource / Gutenberg (curated list in script)
5. Fisher-Yates shuffles each pool independently
6. Zips into 1,000 entries (each type drawn without repeat)
7. Writes `data/reading-list.json`

### `.github/workflows/nightly.yml`

Scheduled GitHub Action. Uses only `bash`, `jq`, and `curl` — no Node runtime in CI.

```
trigger: cron (configurable time)
  │
  ├─ read config.json → startDate
  ├─ compute dayNumber = ⌊(today - startDate) / 86400⌋ + 1
  ├─ read data/reading-list.json → entry[dayNumber - 1]
  └─ POST Discord embed to $DISCORD_WEBHOOK_URL
```

## URL Design

| URL | Meaning |
|-----|---------|
| `/#/` | Landing — shows today's day, links to `/#/day/N` |
| `/#/day/42` | Day 42, all 5 content types shown |
| `/#/day/42?poem=1&tech=1` | Day 42, poem + tech only |
| `/#/day/42?story=1&essay=1&insight=1` | Day 42, story + essay + insight only |

Query params are additive opt-in — omitting a param hides that type.

## Data Flow (Runtime)

```
User visits /#/day/42?poem=1&tech=1
         │
         ▼
    app.js boots
         │
         ├─ fetch data/reading-list.json  (cached after first load)
         ├─ parse hash → day = 42
         ├─ parse params → show = {poem, tech}
         │
         └─ render:
              Day 42 of 1,000
              [Poem card]   [Tech card]
              [← Day 41]   [Day 43 →]
```

## No-Repeat Guarantee

Each content pool is shuffled independently before zipping:

```
poems[0..399]   → shuffled → poems[0], poems[1], ... poems[999]  (with wrap if needed)
stories[0..249] → shuffled → stories[0], stories[1], ...
essays[0..299]  → shuffled → ...
tech[0..199]    → shuffled → ...
insight[0..249] → shuffled → ...
```

If any pool is shorter than 1,000, a second shuffle pass fills remaining slots from a different subset. The generation script asserts zero URL duplicates before writing.

## Extending the Reading List

To add new tech posts or insightful essays:

1. Add entries to `scripts/seeds/tech-blogs.json` or `scripts/seeds/insight-essays.json`
2. Run `node scripts/generate-list.js` locally
3. Commit with `data: add N new tech/insight entries`
