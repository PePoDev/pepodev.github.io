# Desktop and Website Mode Switching Design

Date: 2026-07-28

## Context

The home page currently renders only the interactive desktop shell. Repository
history contains an older conventional portfolio, but its content and routes
are stale. The new normal website mode will therefore be a fresh, linear
presentation of the current portfolio data rather than a restoration of the
old implementation.

## Goals

- Keep desktop mode as the default for first-time visitors.
- Let visitors switch instantly between desktop and normal website modes.
- Expose the switch in the desktop taskbar and the website header.
- Persist the selected mode across reloads and future visits.
- Render both experiences statically and keep client JavaScript limited to mode
  state and interaction.
- Preserve existing desktop windows, preferences, media state, responsive
  behavior, blog deep links, and keyboard interactions.

## Non-goals

- Recreating the historical bento-grid site or restoring its removed routes.
- Moving desktop apps, games, music, or customization into website mode.
- Changing the current light/dark theme behavior.
- Replacing the responsive mobile launcher behavior inside desktop mode.
- Giving each mode a separate URL.

## Architecture

Both shells will be server-rendered on `/`:

- The existing `#desktop` remains the desktop shell.
- A new `WebsiteMode.astro` component renders a sibling `#website` shell.
- `document.documentElement.dataset.siteMode` is the authoritative active mode.
- Responsive state in `data-viewport-mode` remains separate and continues to
  describe the desktop shell's viewport behavior.

An inline initializer in the page head reads `pepodev.viewMode` before paint.
Only `desktop` and `website` are accepted; missing, malformed, or inaccessible
storage falls back to `desktop`. A `?blog=<slug>` deep link temporarily forces
desktop mode so existing shared desktop-blog URLs remain usable, without
overwriting the visitor's saved preference.

A small shared controller owns all runtime transitions. It will:

1. Validate the requested mode.
2. Set `data-site-mode`.
3. Set `hidden`, `inert`, and `aria-hidden` on the inactive shell.
4. Update every mode switch's accessible label and pressed state.
5. Persist explicit visitor selections to `pepodev.viewMode`.
6. Dispatch a mode-change event for desktop effects that need to suspend or
   resume.

The switch changes presentation only. It does not reset open windows, icon
positions, music, theme, or desktop preferences.

## Components and Layout

### Shared mode switch

A reusable mode-switch button will render in:

- The desktop taskbar.
- The normal website header.

The button label describes the action, such as "Switch to website mode" or
"Switch to desktop mode." Its icon and text may differ by placement, but both
instances use the same controller and keyboard-accessible button behavior.

### Normal website shell

`WebsiteMode.astro` will render a responsive, document-style page with:

1. A header containing the site identity, section navigation, resume link, and
   mode switch.
2. A hero introducing PePoDev and the current engineering focus.
3. An About section.
4. A Work section sourced from current experience data.
5. A Projects section sourced from current project data.
6. A Blog section showing recent entries from the current Astro content
   collection and linking to existing `/blog/` routes.
7. Contact and social links sourced from current social-link data.
8. A footer.

Website mode will not reuse desktop window markup or app-only scripts. It may
reuse current structured data and small presentational helpers so both modes
remain consistent without coupling the website layout to the window manager.

The layout will use semantic landmarks, heading order, visible focus states,
responsive navigation, and the existing design tokens where they fit. It will
remain a single readable column on small screens and use wider section grids on
larger screens.

## Styling and Initial Render

Mode visibility rules will live in shared CSS so the inactive shell is not
painted while JavaScript initializes. The server-rendered default is desktop;
the early head initializer can select website mode before the body renders.

Website styles will be isolated from stable desktop selectors. The normal page
will scroll naturally, while desktop mode retains its fixed full-viewport
layout. Switching back to desktop restores its existing viewport and window
state.

The desktop particle canvas will stop requesting animation frames while website
mode is active and resume only when desktop mode is active and background
effects are enabled. Music state remains unchanged.

## Error Handling

- Storage reads and writes are wrapped in `try`/`catch`.
- Unknown stored or requested values resolve to desktop mode.
- If a switch is rendered before the controller initializes, normal button
  behavior is deferred until initialization without mutating other desktop
  state.
- A section with no source entries is omitted; it does not block the rest of
  the website shell.
- Existing `?blog=` links remain desktop deep links even when website mode was
  previously selected.

## Testing

Playwright coverage in `tests/e2e/desktop.spec.ts` will be added test-first:

- A first visit defaults to visible desktop mode and a hidden website shell.
- The taskbar switch activates website mode and updates accessibility state.
- The website-header switch returns to desktop mode.
- Website mode persists across a reload.
- Invalid stored state falls back to desktop.
- A stored website preference does not hide a `?blog=` desktop deep link.
- Website mode exposes its core navigation and links.

Tests will assert user-visible shell state and accessible controls rather than
private CSS classes or storage implementation details where possible.

Completion requires a fresh successful `pnpm build` and `pnpm test:e2e` run,
plus inspection of the generated home page for both server-rendered shells.

## Documentation

The README remains the project's source of truth. Implementation will add the
new `pepodev.viewMode` key and mode-switching invariant without replacing the
user's existing README edits.
