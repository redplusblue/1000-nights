# 1000 Nights

> *"At the end of a thousand nights, Jesus God, you'll be full of stuff, won't you?"*
> — Ray Bradbury

A public reading guide that assigns five pieces to each of 1,000 days. No login. No tracking. Just reading.

## What You Get Each Day

| Type | Source |
|------|--------|
| 📖 **Poem** | Classic poets — Shakespeare, Frost, Keats, Whitman, Dickinson, Neruda… |
| 📚 **Short Story** | Chekhov, Poe, O. Henry, Kafka, Maupassant, Borges… |
| 🖊️ **Literary Essay** | Orwell, Huxley, Montaigne, Emerson, Baldwin, Woolf… |
| 💻 **Tech Blog** | Paul Graham, Joel Spolsky, Dan Luu, Overreacted, ACM Queue… |
| 🌐 **Insightful Essay** | Aeon, Nautilus, Longreads, The Marginalian… |

All content links to free, publicly accessible pages.

## Usage

Visit the site and navigate to any day:

```
https://<user>.github.io/1000-nights/#/day/1
https://<user>.github.io/1000-nights/#/day/42
```

Toggle which content types you care about using the pill filters. The URL updates to reflect your preferences — share it with anyone.

```
# Poem + Tech only
https://<user>.github.io/1000-nights/#/day/42?poem=1&tech=1
```

## How It Works

- **`data/reading-list.json`** — 1,000 pre-generated, deduplicated day entries committed to the repo. Generated once via `scripts/generate-list.js`.
- **GitHub Actions** (`nightly.yml`) — runs on a cron, computes today's day number from `config.json`'s `startDate`, and posts a Discord embed with direct links.
- **No backend, no database.** State is calendar-derived. The site is fully static.

## Setup (for your own fork)

1. Fork this repo
2. Set `startDate` in `config.json` to today (or whenever you want Day 1 to be)
3. In GitHub repo settings → Secrets, add `DISCORD_WEBHOOK_URL`
4. Enable GitHub Pages from the `main` branch root
5. Done — the action fires nightly and the site is live

### Optional: Regenerate the reading list

```bash
npm install
node scripts/generate-list.js
```

This re-generates `data/reading-list.json` from the seed files. You can add entries to `scripts/seeds/tech-blogs.json` or `scripts/seeds/insight-essays.json` and re-run.

## Commit Convention

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Purpose |
|--------|---------|
| `feat:` | New feature |
| `data:` | Reading list or seed file changes |
| `ci:` | Workflow / GitHub Actions changes |
| `docs:` | Documentation |
| `style:` | CSS / visual changes |
| `fix:` | Bug fixes |
| `chore:` | Tooling, config |

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## License

MIT

---

###### *This project was created using AI with human oversight.*
