# Digital Garden: Obsidian Vault Sync Plan

**Goal:** Serve the digital garden from this personal website at
`https://pepo.dev/garden/`, synced straight from the Obsidian vault, and retire
the Digital Garden plugin, the `PePoDev/digital-garden` repo, and the Vercel
site at `garden.pepo.dev`.

**Publishing workflow after cutover:** write in Obsidian, set
`dg-publish: true`, and let obsidian-git push as it already does. The site
picks the note up on its next hourly deploy, or right away with
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
  build job: download that artifact, then withastro/action builds dist/
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
    removed. One note's `candidate-id` stayed public under the plugin; it no
    longer does.
  - Only the attachments that published notes embed are copied. That is 412
    of the 482 files in `Attachments/`.
  - Code is found with the same CommonMark parser Astro renders with
    (`satteri`), so nothing inside code is rewritten and nothing outside it
    escapes the rewrites.
  - Every converted note is parsed again before it is written. If it would
    still publish a comment, a raw wikilink, or a link into the vault, that
    note is skipped with a CI warning; the rest of the garden still deploys.
  - Logs print counts only.
  - `pnpm test:garden` checks these rules against a fake vault.
- **URLs are preserved.** Every old permalink maps 1:1:
  `garden.pepo.dev/<path>` becomes `pepo.dev/garden/<path>`. All 89 Knowledge
  URLs were checked against the old site. The 5 old `/blog/*` notes redirect to
  their `/blog/` posts (`astro.config.mjs` `redirects`).
- **The site renders:**
  - a note tree with a filter
  - breadcrumbs
  - "Last tended" dates from vault git history
  - callouts, including foldable ones
  - responsive WebP images
  - table of contents
  - backlinks ("Linked from")
  - a desktop **Garden** app (an iframe of `/garden/`)
  - a website-mode **Garden** section with the 3 most recently tended notes

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
- [ ] **2. Merge this branch and watch the first deploy.** Run
  `gh run watch -R PePoDev/pepodev.github.io`. The "Sync published garden notes"
  step should log `Garden: 90 notes, 412 attachments, …`. The first run
  optimizes all 412 images, which can take a few minutes; later runs reuse
  Astro's image cache.
- [ ] **3. Spot-check production.** Check `/garden/`,
  `/garden/knowledge/technical/kubernetes/cks/`, the desktop Garden app, and the
  website-mode Garden section.

## Cutover from the plugin

- [ ] **4. Redirect `garden.pepo.dev` to `pepo.dev/garden/` with a 301 or 308.**
  - **Recommended: Cloudflare.** The `pepo.dev` DNS is already on Cloudflare,
    so this needs no Vercel project.
    1. In DNS, make the `garden` record **proxied**. An originless
       `AAAA garden 100::` record is the usual placeholder.
    2. In Rules → Redirect Rules, create a rule that matches the wildcard
       `https://garden.pepo.dev/*` and targets `https://pepo.dev/garden/${1}`.
       Set the status to 301 and turn on "Preserve query string".
    3. Remove `garden.pepo.dev` from the Vercel project, then delete or pause
       the project.
  - **Or keep Vercel just for redirects.** Replace the `digital-garden` repo
    contents with a `vercel.json` like the one below, plus an empty
    `public/index.html`. Drop the legacy `routes` key, because Vercel rejects
    it alongside `redirects`.
    ```json
    {
      "framework": null,
      "installCommand": "",
      "outputDirectory": "public",
      "redirects": [
        { "source": "/", "destination": "https://pepo.dev/garden/", "permanent": true },
        { "source": "/:path*", "destination": "https://pepo.dev/garden/:path*", "permanent": true }
      ]
    }
    ```
  - **Verify:** run
    `curl -sI https://garden.pepo.dev/knowledge/business/financial/` and expect
    a 301 or 308 to `https://pepo.dev/garden/knowledge/business/financial/`.
- [ ] **5. Stop the plugin.** In Obsidian, disable and uninstall the Digital
  Garden plugin. Keep the `dg-publish` properties: the sync reads them.
- [ ] **6. Archive `PePoDev/digital-garden`.**
  - Its history still contains every note it ever published, plus the
    `candidate-id` value in
    `Knowledge/Technical/Cloud/Google Cloud/Google Cloud.md`.
  - Archiving keeps that history public. Delete the repo instead if you want
    it gone, and consider removing `candidate-id` from the note itself.
  - Check its Discussions first: Giscus comments were keyed to garden URLs and
    do not move over.

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
- **Not ported from the old garden:**
  - full-text search (the tree filter matches titles and folders)
  - graph view
  - link hover previews
  - note transclusion (`![[Note]]` renders as a link)
  - image sizes (`![[img.png|300]]` renders full width)
  - callouts inside list items, and lazy (unprefixed) callout lines
  - the Atom feed
  - Giscus comments

  Add any of these if you miss them; Pagefind would cover search.
- **Local preview.** Run `pnpm garden:sync` with `GARDEN_VAULT` set to your
  vault, then `pnpm dev`. Synced content is gitignored, so `garden.spec.ts`
  skips until you sync.
