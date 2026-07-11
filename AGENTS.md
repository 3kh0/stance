# AGENTS.md

Instructions for coding agents working on **Stance** — an open-source Polymarket trading terminal (paper + live CLOB). Human-oriented docs live in `README.md`.

## Stack

| Layer                     | Choice                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| Runtime / package manager | **Bun** (not npm/pnpm/yarn)                                                     |
| Framework                 | **Nuxt 4** + **Vue 3** (`<script setup lang="ts">`)                             |
| Styling                   | **Tailwind CSS v4** via `@tailwindcss/vite`, design tokens in `app/assets/css/` |
| Lint / format             | **oxlint** + **oxfmt** (not ESLint/Prettier)                                    |
| Types                     | TypeScript + `vue-tsc` via `nuxt typecheck`                                     |
| Charts                    | d3 + `lightweight-charts`                                                       |
| Live trading              | `@polymarket/clob-client-v2`, browser wallet (EIP-1193), Polygon                |

Stance is **stateless**: no app database, no server-side auth. Nitro routes proxy Polymarket upstreams; paper balances, positions, watchlist, and theme live in **browser `localStorage`**.

## Setup

```bash
bun install
bun run dev
```

Optional production origin (OG/Twitter URLs):

```bash
# maps to runtimeConfig.public.siteUrl
NUXT_PUBLIC_SITE_URL=https://your-domain.example
```

## Commands

Use **Bun** for all scripts. Match CI (`.github/workflows/ci.yml`):

```bash
bun run dev          # Nuxt dev server
bun run build        # Production build
bun run preview      # Preview production build
bun run generate     # Static generation
bun run lint         # oxlint
bun run lint:fix     # oxlint --fix
bun run fmt          # oxfmt (in-place)
bun run fmt:check    # oxfmt --check
bun run typecheck    # nuxt typecheck
bun run all          # fmt + lint
```

Before finishing a change that touches app or server code, run at least:

```bash
bun run fmt && bun run lint && bun run typecheck
```

For larger UI/API changes, also run `bun run build`.

## Repository layout

```tree
app/                 # Nuxt app (Vue UI)
  assets/css/        # Tailwind entry, themes, fonts, animations
  components/        # Auto-imported Vue components (domain subfolders: crypto/, event/, sports/, …)
  composables/       # Auto-imported composables (useX.ts)
  layouts/           # App chrome
  pages/             # File-based routes
  plugins/           # Client plugins
  types/             # Shared TS types
  utils/             # Pure helpers (no Nuxt auto-magic assumed for side effects)
public/              # Static assets + PWA icons
server/
  api/               # Nitro API routes → /api/*
  middleware/        # Server middleware
  routes/            # Non-/api routes (e.g. OG images)
  utils/             # Proxy helpers, validation, upstream URLs
scripts/             # Ad-hoc scripts (if any)
nuxt.config.ts       # Modules, PWA, image, runtimeConfig
```

`CLAUDE.md` is a symlink to this file — keep a single source of truth.

## Architecture (read this before big changes)

### Two trading modes, one UI

- **Paper** (`AccountKind: "paper"`): simulated balance/positions via `app/utils/paperLedger.ts` + `useAccount`. No wallet required. Prices come from real Polymarket data.
- **Live** (`AccountKind: "polymarket"`): on-chain CLOB orders; wallet linked through `useWallet` (Polygon `137`). Credentials/wallet linkage stored on the account object in localStorage.

Account state: `useAccount` + `app/utils/accountStorage.ts` + keys in `app/utils/constants.ts`. There are **legacy PaperMarket storage keys** — preserve migration paths when touching persistence.

### Server = thin proxy + aggregation

- Prefer existing helpers in `server/utils/proxyGamma.ts` (`proxyUpstream`, `coerce*`, `require*`) and `proxyImpit.ts` (browser-like fetches when plain `$fetch` is blocked).
- Upstream bases: Gamma, CLOB, Data API, Bridge, Relayer (see `proxyGamma.ts`).
- Validate/coerce query params; never trust client input for addresses, chain IDs, amounts, or slugs.
- Map upstream failures to clear `createError` status codes (502/504 patterns already exist). Default upstream timeout is ~10s.

### Client data flow

- Pages/composables call `/api/*` (and some direct WebSockets for order books / crypto prices).
- Feeds: `useMarketFeed`, sports/esports/elections/crypto composables, pagination helpers.
- Client-only heavy UI uses `.client.vue` (e.g. advanced charts) so SSR stays light.

### UI / design system

- Theme tokens: CSS variables in `app/assets/css/main.css` and `themes.css` (`--color-bg`, `--color-yes`, `--color-no`, etc.). Prefer tokens over hard-coded grays/greens/reds.
- Font: **Open Sauce One**; dense terminal feel (~13px body, tabular nums).
- Dark-first; multiple themes via `data-theme` + `useTheme`.
- Mobile: bottom tab bar, bottom sheets; desktop: sidebar. Keep both usable.

## Coding conventions

### General

- **TypeScript** everywhere new code is added. Prefer existing types under `app/types/`.
- Follow local patterns: short, dense code is normal here (oxfmt `printWidth` is **320** — do not reformat the whole repo to narrow lines).
- Prefer composables for shared reactive logic; pure functions in `utils/`.
- Nuxt auto-imports components/composables — do not add redundant imports for those unless needed for types or clarity.
- Path alias: `~/` → `app/` (and Nuxt conventions).
- Keep components focused; domain folders under `components/` already group by feature.

### Vue / Nuxt

- Use `<script setup lang="ts">`.
- Prefer `useState` for client-shared session state (accounts, wallet) already established in composables.
- SSR-safe: guard `window` / `localStorage` / `ethereum` (see `useAccount`, `useWallet`).
- Naming: `useThing.ts` composables; PascalCase components; Nitro handlers `name.get.ts` / `name.post.ts`.

### Server routes

- One default export: `defineEventHandler`.
- Coerce inputs with shared helpers; reject invalid addresses/slugs early.
- Log upstream failures with URL + status; avoid leaking raw secrets into logs.
- Do not introduce a database or server sessions without an explicit product decision — the app is designed to stay stateless.

### Styling

- Tailwind utility classes + CSS variables for brand colors.
- Reuse existing class patterns (`pm-page`, `pm-container`, surface/border tokens) rather than inventing a parallel design language.
- Icons: `@nuxt/icon` / Iconify sets already in the project (lucide, mdi, crypto, simple-icons).

### Formatting & lint

- Formatter: **oxfmt** (2-space indent, no tabs, print width 320).
- Linter: **oxlint** with typescript/vue/unicorn/import plugins; correctness rules are errors.
- Ignore build outputs: `.nuxt`, `.output`, `dist`, `node_modules`.
- Prefer fixing lint issues over disabling rules; if a disable is required, keep it line-scoped with a short reason (see existing `oxlint-disable-next-line` usage).

## Safety rails (important)

These areas can lose users money or wipe local state — treat carefully:

1. **Live trading / CLOB / bridge / relayer** (`useWallet`, polymarket API routes, order placement): preserve signature types, funder vs signer distinction, chain ID checks, and amount validation. No “simplify by skipping confirmation.”
2. **Paper ledger** (`paperLedger.ts`): balance/position math must stay consistent with fees/payouts UI.
3. **Account storage** (`accountStorage.ts`, constants keys): validate before write; keep legacy key migration; never silently change storage schema without a versioned migration.
4. **Proxy routes**: only proxy intended Polymarket surfaces; validate path segments on catch-all proxies (`clob/[...path]`, `relayer/[...path]`).
5. **PWA caching**: `/api/*` is NetworkOnly — do not cache authenticated or highly dynamic trading data in the service worker.
6. **Secrets**: never hardcode API keys or private keys. Wallet keys never leave the user’s browser/extension.

## What not to do

- Do not switch package managers or add npm lockfiles.
- Do not replace oxlint/oxfmt with ESLint/Prettier without a deliberate repo-wide decision.
- Do not add a backend database, user auth server, or store private keys server-side.
- Do not rebrand or claim affiliation with Polymarket.
- Do not expand GPLv3 compliance surface carelessly — this project is **GNU GPLv3** (`LICENSE`).
- Do not commit `node_modules`, `.nuxt`, `.output`, `.vercel`, or local env files.
- Avoid drive-by refactors unrelated to the task; match surrounding style.

## PR / change checklist

1. Scope is clear; trading/storage paths get extra review.
2. `bun run fmt:check && bun run lint && bun run typecheck` pass.
3. `bun run build` for non-trivial changes.
4. UI: spot-check mobile + desktop if layout/nav/trading chrome changed.
5. Paper mode still works without a wallet; live mode still requires wallet + Polygon where applicable.
6. Summarize **why** in the PR, not only what files changed.

## Quick orientation by task

| Task                                 | Start here                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Market grid / categories / home feed | `useMarketFeed`, `pages/*.vue`, `components/MarketGrid.vue`                        |
| Event detail / trade panel           | `pages/event/[slug].vue`, `useEventPage*`, `components/event/*`                    |
| Sports                               | `pages/sports/**`, `useSports*`, `components/sports/*`, `server/api/sports.get.ts` |
| Esports                              | `pages/esports/**`, `useEsports*`, `server/api/esports*`                           |
| Crypto                               | `pages/crypto.vue`, `components/crypto/*`, `useCryptoPrice*`                       |
| Portfolio                            | `pages/portfolio.vue`, `components/portfolio/*`                                    |
| Paper balance / fills                | `useAccount`, `paperLedger.ts`, `accountStorage.ts`                                |
| Wallet connect                       | `useWallet.ts`                                                                     |
| New API proxy                        | `server/api/…` + `server/utils/proxyGamma.ts`                                      |
| Themes / tokens                      | `app/assets/css/themes.css`, `main.css`, `useTheme.ts`                             |
| SEO / share cards                    | `useEventSeo`, `server/routes/og/**`, `NUXT_PUBLIC_SITE_URL`                       |

## Product context

Stance is a **trading terminal for Polymarket prediction markets**: browse markets, paper-trade risk-free, or place real CLOB orders with a connected wallet. Prioritize clarity of prices/odds, reliability of order/position state, and a dense but readable terminal UI.
