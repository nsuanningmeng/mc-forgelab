# MC ForgeLab Web — E2E Tests

Playwright end-to-end suite that locks in the v0.3.x regression points
(new-project ordering, build cancel, theme persistence, settings CRUD, project
deletion). Required to pass before any `v0.3.x` tag can ship — see the
`e2e-web` job in `.github/workflows/release.yml`.

## Running

```bash
# Headless (CI parity)
pnpm --filter @mc-forgelab/web test:e2e

# Headed (local visual debug)
pnpm --filter @mc-forgelab/web test:e2e:headed

# Interactive picker + step debug (Playwright Inspector)
pnpm --filter @mc-forgelab/web test:e2e:debug

# Single spec
pnpm --filter @mc-forgelab/web test:e2e new-project

# Root shortcut
pnpm playwright
```

The first run on a fresh checkout needs Playwright's browser binaries:

```bash
pnpm exec playwright install chromium
```

CI runs `playwright install --with-deps chromium` to also pull system libs.

## Isolation

`playwright.config.ts` creates a fresh temp directory per Playwright invocation:

- `MC_FORGELAB_WORKSPACE=<tmpdir>/mcfl-e2e-<timestamp>`
- `MC_FORGELAB_DB=<workspace>/db/mc-forgelab.sqlite`

Your local dev sqlite and artifacts are never touched. The temp directory is
not auto-cleaned between runs — wipe it manually if `$TMPDIR` fills up.

We use a **persistent on-disk sqlite** (not `:memory:`) on purpose: it matches
the production code path and surfaces real sqlite locking / WAL behavior.

## What each spec locks in

| Spec | Locks in |
|------|----------|
| `new-project.spec.ts` | v0.3.4 / v0.3.5 regression: selecting MC version before target must not crash; both orderings of the two dropdowns work. |
| `delete-project.spec.ts` | Project card delete (trash icon) propagates DELETE and removes the card. |
| `cancel-build.spec.ts` | `cancel-build-btn` cancels a running build; the SSE-driven UI status flips to `canceled`. |
| `model-profile-crud.spec.ts` | AI Provider + Model Profile create-list-delete flow stays wired to `/api/ai/...`. |
| `theme-toggle.spec.ts` | Theme switch updates `<html data-theme>` and persists to `localStorage["mcfl.theme"]` across reload. |

## Selectors

The SPA exposes `data-testid` on key interactive nodes. Patterns:

- Sidebar nav: `nav-<page-id>` (`nav-projects`, `nav-builds`, `nav-settings`, …)
- Projects page: `new-project-btn`
- Builds page: `start-build-btn`, `cancel-build-btn`
- Settings sections: `ai-providers-section`, `model-profiles-section`
- Theme chips: `theme-dark`, `theme-light`
- Provider form inputs: `#pf-displayName`, `#pf-baseUrl`, `#pf-defaultModel`,
  `#pf-apiKey`, `#pf-timeoutMs` (ids set in `ProviderForm.jsx`).

When adding a new spec, prefer `getByTestId` > `getByRole` > raw `locator`.
If a new flow needs a new testid, add it in the same PR and update this list.

## Known limitations / gotchas

1. **`workers: 1`** — the suite is serialized because tests share one sqlite
   DB. Splitting into per-spec DBs is parked for v0.3.7+.
2. **Native `<select>` on Windows Chromium** — `selectOption()` sometimes
   reports success without firing React's `onChange`. Always follow up with
   `toHaveValue(...)` to assert the bound state — `new-project.spec.ts` does.
   See memory `mcfl-native-select-styling`.
3. **`window.confirm` dialogs** — `delete-project.spec.ts` uses
   `page.once('dialog', ...)` because Playwright auto-dismisses by default.
   `model-profile-crud.spec.ts` skips the UI delete path in favor of an API
   delete for the same reason.
4. **Build duration** — even an empty Gradle build can take a few seconds
   before SSE flips status. Cancel-build asserts use a 15 s poll timeout to
   absorb CI variability.
5. **Default port 3000** — `playwright.config.ts` pins the dev server to
   `MC_FORGELAB_PORT=3000`. If something else is already on 3000, kill it or
   adjust `webServer.env` and `baseURL` in lock-step.
6. **Theme uses `data-theme` attribute, NOT a class** — see
   `apps/web/public/ui/lib/theme.js`. Assertions must use `toHaveAttribute`.
