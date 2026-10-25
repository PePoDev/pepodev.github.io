# Digital Garden: Obsidian Vault Sync Plan

**Goal:** Serve the digital garden from this personal website at
`https://pepo.dev/garden/`, synced straight from the Obsidian vault.

**Publishing workflow:** write in Obsidian, set `dg-publish: true`, and let
obsidian-git push as it already does. The site picks the note up on its next
hourly deploy, or right away with
`gh workflow run deploy.yaml -R PePoDev/pepodev.github.io`.

---

## How it works

```
Obsidian vault ──obsidian-git (every ~3 min)──▶ PePoDev/obsidian-vault (private)
                                                     │  read-only deploy key
GitHub Actions deploy.yaml (push, hourly, manual)    │
  garden job ◀───────────────────────────────────────┘  (installs with --ignore-scripts)
    1. sparse, blob-less checkout: *.md, Attachments/, .obsidian/app.json
    2. node scripts/sync-garden.mjs --vault .vault
    3. upload src/content/garden + src/assets/garden (published notes only)
  build job: download that artifact, then pnpm build exports out/
  test job: Playwright against that export
  deploy job: GitHub Pages
```

- **Nothing from the vault is committed.** Synced notes and attachments are
  gitignored and rebuilt on every deploy, so unpublishing a note removes it on
  the next deploy, with no copy left in this public repo's history.
- **`scripts/sync-garden.mjs` is the privacy boundary.**
  - It publishes only notes with `dg-publish: true` in frontmatter at byte 0,
    as Obsidian reads it. `Blog/` is skipped because posts live in
    `src/content/blog`.
  - Links resolve the way Obsidian does: full path first, otherwise the same
    folder, otherwise the shortest path. Links to anything unpublished become
    plain text, and Waypoint list items for unpublished notes are dropped.
  - `%% comments %%`, HTML comments, and all frontmatter except the title are
    removed, so properties such as `candidate-id` never reach the site.
  - Only the attachments that published notes embed are copied. That is 412
    of the 482 files in `Attachments/`.
  - Code is found with the same CommonMark parser the site renders with
    (`satteri`), so nothing inside code is rewritten and nothing outside it
    escapes the rewrites.
  - Every converted note is parsed again before it is written. If it would
    still publish a comment, a raw wikilink, or a link into the vault, that
    note is skipped with a CI warning; the rest of the garden still deploys.
  - Logs print counts only.
  - `pnpm test:garden` checks these rules against a fake vault.
- **URLs are slugified vault paths.** For example,
  `Knowledge/Technical/Kubernetes/CKS.md` is served at
  `/garden/knowledge/technical/kubernetes/cks/`.
- **The site renders:**
  - a note tree with a filter
  - breadcrumbs
  - "Last tended" dates from vault git history
  - callouts, including foldable ones
  - responsive WebP images
  - table of contents
  - backlinks ("Linked from")
  - a desktop **Garden** app (an iframe of `/garden/`)
  - a numbered website-mode **Garden** section with the 5 most recently
    tended notes

## One-time setup

Until step 1 is done, deploys still succeed, but the garden ships empty: the
vault steps skip when the secret is missing.

- [ ] **1. Give the deploy workflow read-only access to the vault.**
  ```bash
  ssh-keygen -t ed25519 -N "" -C "pepo.dev garden read-only" -f vault_ro
  ```
  1. In `PePoDev/obsidian-vault`, go to Settings → Deploy keys → Add, paste
     `vault_ro.pub`, and leave "Allow write access" **unchecked**.
  2. In `PePoDev/pepodev.github.io`, go to Settings → Secrets and variables →
     Actions → New repository secret. Name it `VAULT_DEPLOY_KEY` and paste the
     contents of `vault_ro`.
  3. Delete `vault_ro` and `vault_ro.pub` locally.
- [ ] **2. Deploy and watch the run.** Run
  `gh workflow run deploy.yaml -R PePoDev/pepodev.github.io`, then
  `gh run watch -R PePoDev/pepodev.github.io`. The "Sync published garden notes"
  step should log `Garden: 90 notes, 412 attachments, …`. The first run
  optimizes all 412 images, which can take a few minutes (every build
  resizes them again; there is no image cache).
- [ ] **3. Spot-check production.** Check `/garden/`,
  `/garden/knowledge/technical/kubernetes/cks/`, the desktop Garden app, and the
  website-mode Garden section.

## Known gaps and follow-ups

- **Schedule pauses.** GitHub disables scheduled workflows in public repos
  after 60 days without commits, and emails before doing so. Run
  `gh workflow enable deploy.yaml` if that happens, or add the instant trigger
  below.
- **Instant publish (optional).** Add a workflow to the vault repo that calls
  `gh workflow run deploy.yaml --repo PePoDev/pepodev.github.io --ref main`.
  - Use a fine-grained token scoped to this repo with Actions: read and write
    only.
  - Gate it, for example on a `#publish` commit message, because obsidian-git
    pushes every few minutes and private-repo minutes are metered.
- **Not built yet:**
  - full-text search (the tree filter matches titles and folders)
  - graph view
  - link hover previews
  - note transclusion (`![[Note]]` renders as a link)
  - image sizes (`![[img.png|300]]` renders full width)
  - callouts inside list items, and lazy (unprefixed) callout lines
  - a garden feed

  Add any of these if you miss them; Pagefind would cover search.
- **Local preview.** Run `pnpm garden:sync` with `GARDEN_VAULT` set to your
  vault, then `pnpm dev`. Synced content is gitignored, so `garden.spec.ts`
  skips until you sync.
