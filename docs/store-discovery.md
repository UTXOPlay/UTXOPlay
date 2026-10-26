# Store discovery — 0.35.0

The featured section starts with a Fisher–Yates shuffled deck of all curated games. Every game appears once before a new shuffled cycle. The first game differs from the last displayed game when session storage is available; blocked storage still permits random discovery. Catalog refreshes retain the current selection and order, prune removed games and append newly eligible games. Search, filters and creator collections do not reshuffle the hero. Navigation remains user-controlled.

Cards now use compact 16:9 artwork, title, price and a 44px launch icon. Desktop hover waits 180ms before displaying genre, a short description and session facts inside the artwork. Keyboard focus offers the same preview and Escape dismisses it. This overlay does not reflow the grid or cover adjacent cards. Clicking the card opens the existing full details dialog, which retains developer/publisher links, controls and launch actions. Touch opens that dialog directly, without sticky hover or a second tap. The same card component serves discovery, library and creator collections; library cards retain last-played dates.

At 1920px and larger, the bounded content area fits five 266px cards per row (approximately 221px tall), replacing two large information-heavy cards. At 390px, two 171px cards fit per row (approximately 175px tall). Artwork uses its native crop without geometric stretching, and reduced-motion preferences disable image movement/transitions.

## Design references

- [Valve: A Refreshed Steam Store Home Page](https://store.steampowered.com/news/posts/?enddate=1782408060&feed=mygames), June 4, 2026: its Capsule Hover section moves short descriptions and relevant information into a hover view; its motion preferences offer static alternatives.
- [Steamworks: Store Graphical Assets](https://partner.steamgames.com/doc/store/assets/standard): artwork-centered capsules emphasize recognizable game identity.

The store adopts the progressive information disclosure pattern while keeping previews inside cards to avoid overlapping neighbors. It does not imply Steam reviews, personalization or gameplay footage that this catalog does not supply.

## Verification and deployment

`npm test` passes 65 tests, including deck coverage, uniqueness, vendor exclusion, repeated-first prevention and varying starts. `npm run build` passes. `tests/store-discovery-browser.mjs` checks a complete 14-game cycle, refresh behavior, stable hero during filtering, hover without layout shifts, keyboard/Escape/dialog behavior, preserved credits and touch details. Layout checks cover 1920×1080, 2560×1080, 2560×1440, 3840×2160, 390×844 and 844×390, with no horizontal overflow and 44px launch targets.

This is a store-only presentation release. No game runtime, database schema or saved rule/profile changes are required. Back up SQLite with its online backup API, retain the previous store image/Compose definition, and recreate only `store` with `--no-deps`. Rollback uses the previous store Compose definition with current shared data.

## Production acceptance

Implementation `15ca710` is deployed as `utxoplay:0.35.0-15ca710` at `/data/utxoplay/releases/20261026-discovery-0.35.0-15ca710`. The store is healthy. Public HTML and entry JS/CSS match the local build by SHA-256, and all 14 curated games remain listed. The full browser checks passed again against public HTTPS, including all six viewports; results are in `docs/acceptance/store-discovery.json`. A previously established disposable guest session survived the rollout and the new compact launch icon successfully opened BotStrike through the ready iframe handshake.

All 21 other running containers retained their IDs and images. The verified online SQLite backup is `/data/utxoplay/backups/platform-before-discovery-0.35.0-15ca710.sqlite`. The previous store Compose definition is `/data/utxoplay/releases/20261026-botstrike-0.34.0/store.compose.json`; recreate only its store service under project `utxoplay` to roll back, preserving current shared data.
