# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page, dependency-free browser simulator of fifteen chaotic attractors (Lorenz, Rössler, Chua, …) plus a "Custom" playground, with live Lyapunov/divergence/Kaplan–Yorke diagnostics. Deployed to <https://chaos.vfmod.com>.

## Commands

There is no package.json, no dependency install, no test suite and no linter.

```bash
node build-guide.js         # the only build step: regenerates guide.html from Readme.md
node --check app.js         # syntax check (CI does this for app.js attractors.js md.js build-guide.js analytics.js)
```

To run the app: open [index.html](index.html) directly in a browser (`file://` works), or serve the directory over http — which is what the published site does, and the only way to exercise the extensionless URLs and the reference page's ⟳ Refresh button.

### Checking a change

There is no test runner, but the app is smoke-testable headlessly, which beats guessing:

```bash
chrome --headless=new --disable-gpu --virtual-time-budget=3000 --dump-dom <url>
```

Append an inline `<script>` to a throwaway copy of `index.html` to assert against the real page: top-level `const`s in a classic script are visible to later scripts, so `ui`, `sim`, `readLibrary()`, `importSystems()` and friends are all reachable. Two things to know: headless does not drive `requestAnimationFrame`, so step the simulation by hand with `advance(n)`; and stub `HTMLAnchorElement.prototype.click` before calling `exportLibrary()`, or the download hangs the run.

## The `file://` constraint

The project promises that double-clicking `index.html` works. This is the reason behind most of the architecture, and breaking it is a real regression:

- **No ES modules, no bundler.** Scripts load as plain `<script src>` and communicate through globals — `attractors.js` defines `ATTRACTORS` and `FAMILIES`; `app.js` consumes them. `md.js` is a UMD wrapper so Node and the browser share one converter.
- **No runtime `fetch()` of local files.** That is why `guide.html` is generated and committed rather than rendering `Readme.md` at load time.
- **No external assets.** The favicon is an inline data-URI SVG.
- **Links carry a fallback.** The site is served extensionless (`/`, `/guide`), which needs a server to resolve. Static links are written in the site form with a `data-file` attribute holding the filename; the boot code in [app.js](app.js) and in the guide's inline script swaps it in when `location.protocol === "file:"`. Dynamic links go through `guideUrl()`. Any new cross-page link needs one of the two.

## Architecture

```
index.html      simulator markup; app.js binds to elements by id
attractors.js   the catalogue — one plain object per system, knows nothing about rendering
app.js          integrator, camera, canvas renderer, diagnostics, all UI wiring (§1–§10 in-file)
styles.css      CSS custom properties on :root and [data-theme="light"]; also styles guide.html
md.js           the Markdown subset used by Readme.md → HTML, shared by build and browser
build-guide.js  Readme.md → guide.html (page shell + inline script are literals in this file)
analytics.js    the GA tag for both pages; no-ops on file://, localhost and private IPs
```

`app.js` is one long file split by `/* §N ---- */` banners: setup → numerics (rk4, Benettin λ₁, ∇·F) → simulation/runners → camera → scene renderer → diagnostic plots → number formatting → UI build → §8b custom-equation editor → §8c persistence and the saved library → main loop. Follow those sections when adding code.

### Hot-loop performance contract

Thousands of integration steps per second must allocate nothing:

- Vector fields are `f(x, y, z, p, out)` — they *write into* `out`, never return an array. Every attractor's `f` and the compiled custom field follow this.
- Trail points live in a fixed-capacity ring buffer (`Trail`) of typed arrays; projection buffers are grown, not reallocated per frame.
- Rendering quantises segments into `colour × opacity` buckets and strokes one `Path2D` per bucket, not one stroke per segment.

Keep new work inside these patterns; a per-frame allocation shows up as GC stutter in the animation.

### Adding an attractor

Add one object to `ATTRACTORS` in [attractors.js](attractors.js). The field guide is the file's header comment; the object key is both the internal id and the URL hash (`index.html#lorenz`). `family` must be one of the ids in `FAMILIES` (`classic` / `modern` / `minimal` / `custom`). `view` framing values can be rough — auto-fit corrects them. Nothing in `app.js` needs editing.

### Custom-equation editor (§8b of app.js)

User expressions are normalised (typographic `−`, `×`, `²`, `^` → JS), compiled with `new Function`, and **test-fired on a probe point before being swapped into the render loop** — keep that guard. Any identifier that is not `x`/`y`/`z` and not a `Math` name automatically becomes a parameter with a slider.

Three sources feed the editor — the built-in `seeds`, the working draft, and the saved library — and all three go through `loadSystem()`, so a system that came from a file is sanitised in exactly one place. Imports additionally pass `normaliseSystem()`, which runs `compileField()` on the expressions and rejects the entry with a reason rather than importing something that cannot run.

### What persists (§8c of app.js)

Four `localStorage` keys, all optional — every write is wrapped, because private mode and quota errors must not break the session:

| key | holds |
| --- | --- |
| `attractors-theme` | dark / light, shared with `guide.html` |
| `attractors-settings` | the preference half of `ui`, validated on read against `SETTINGS` bounds |
| `attractors-custom` | the editor's working draft |
| `attractors-library` | systems saved by name; also the export payload |

**Parameter values are deliberately not persisted.** Every attractor opens at its published values — the reference quotes λ₁ figures that assume exactly that. Add preferences to `SETTINGS` (key → allowed range or allowed strings) and they are validated, reset and saved for free; `UI_DEFAULTS` is the frozen snapshot "Reset settings" restores.

Settings save on `change`, not `input`, so dragging a slider stores once on release. Anything that changes a setting *programmatically* fires no event and must call `saveSettings()` itself — `setGhosts()` and the wheel handler's auto-untick of auto-fit both do.

### Theme

Both pages share `localStorage['attractors-theme']` and `data-theme` on `<html>`. Canvas colours must be read from CSS custom properties via `cssVar()`/`readTheme()` rather than hardcoded, so light mode and the CVD-checked series palette keep working.

### Readme.md → guide.html coupling

`Readme.md` is both the project README and the source of the reference page. Heading text determines anchors (ASCII slugger in `md.js`), and `GUIDE_SECTION` in [app.js](app.js) hard-codes anchors such as `the-classics`, `the-wider-zoo`, `minimal-and-unusual`, `5-the-playground` for the info-panel deep links. Renaming those headings breaks the links.

**After editing `Readme.md`, run `node build-guide.js` and commit `guide.html`.** CI regenerates it for the deployed site but only emits a warning if the committed copy has drifted — a stale committed copy is wrong for anyone opening the file from disk.

`md.js` is deliberately a subset, not a general Markdown engine: it handles headings, paragraphs, GFM tables, fenced code, lists, blockquotes, rules and inline emphasis/code/links, and passes anything else through as a paragraph. If the Readme needs new syntax, extend `md.js`.

## Deployment

[.github/workflows/pages.yml](.github/workflows/pages.yml) publishes to GitHub Pages on push to `main`. It syntax-checks the scripts, regenerates `guide.html`, then assembles `_site` by copying **an explicit list of files** and writing `CNAME` (`chaos.vfmod.com`) and `.nojekyll`. Any new file that the site needs must be added to that `cp` line (and to the `node --check` loop, if it is a script) or it will 404 in production.

Pages resolves `/guide` to `guide.html` itself, with no configuration — that is what the canonical URLs point at, so keep new pages at the repo root and link them without the extension.
