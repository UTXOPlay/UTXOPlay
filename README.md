# UTXOPlay

The browser game store at https://store.utxoplay.io. Source: https://github.com/UTXOPlay/UTXOPlay.

The store owns discovery, guest and wallet identity, libraries, creator profiles, reviews, vendor publishing and CKB purchases. All thirteen curated games are maintained and built in independent repositories. The store contains no game rules, native binaries, browser renderers, online chess rooms, or in-game pricing logic.

## Develop the store

Requires Node 22.23+ (including `node:sqlite`). No Rust compiler or game checkout is needed:

```sh
npm ci
npm test
npm run build
# Configure server-only game tokens before enabling game services.
RUNTIME_TOKEN=<random-server-secret-at-least-32-characters> npm start
```

For a store-only instance with no curated services, set `GAME_SERVICES_FILE` to a JSON file containing `{}`. The store still builds and serves marketplace features; unavailable curated games return an explicit error. `PUBLIC_ORIGIN` defaults to `http://127.0.0.1:8790`. For Vite development, use `PUBLIC_ORIGIN=http://127.0.0.1:5173` on the API server and `npm run dev` in another terminal.

## Independent games

| Repository | Games |
| --- | --- |
| [myelin-chess](https://github.com/UTXOPlay/myelin-chess) | The Quiet Board, including online tables and Stockfish |
| [myelin-sling](https://github.com/UTXOPlay/myelin-sling) | Skyward |
| [myelin-teeworlds](https://github.com/UTXOPlay/myelin-teeworlds) | Teeworlds |
| [myelin-openstrike](https://github.com/UTXOPlay/myelin-openstrike) | OpenStrike |
| [myelin-arcade](https://github.com/UTXOPlay/myelin-arcade) | Neon Coil, Starfall, Drift Run |
| [myelin-neon-miner](https://github.com/UTXOPlay/myelin-neon-miner) | Neon Prospector |
| [myelin-prism-breaker](https://github.com/UTXOPlay/myelin-prism-breaker) | Prism Breaker |
| [myelin-atelier](https://github.com/UTXOPlay/myelin-atelier) | Rune Foundry, Lumen Weave, Orbit Courier, Mosslight |

Each repository owns its native runtime, browser resources, game-specific API, tests, build and deployment instructions. Each can run without the store. Arcade and Atelier retain shared native engines to preserve their existing replay profiles.

`server/catalog.json` contains public listing data. `server/game-services.json` contains operator-controlled service registrations; URLs and tokens can be overridden by the environment variables named there. A service provides `/games/<id>/` assets and `/games/<id>/api/*`. The generic gateway supplies the authenticated account, enforces origin checks and session revocation, and proxies HTTP, SSE and optional WebSocket connections. It never exposes runtime credentials to the browser. Item catalogs, balances and prices come from the games' optional `api/items` endpoints.

After building the game repositories as siblings, `npm run dev:platform` starts their hosts and the store. `GAME_CHECKOUTS_ROOT` can select another parent directory. This optional launcher does not download or build games. For independently managed hosts, just use `npm start` in the store.

## Deployment and migration

Build the frontend and then `docker build -f deploy/Dockerfile -t utxoplay:0.32.0 .`. The image contains only the store. `deploy/compose.yml` connects it to the existing HTTPS proxy and the external `utxoplay-games` network. Build/start game images using each game's own deployment files. Preserve the existing store SQLite database, runtime account directories, signing authorities and matching native engine/verifier binaries.

**Existing installations must follow [the migration guide](docs/game-decoupling.md), including copying online chess membership to its new database before switching services.** This repository migration does not restart or alter the public deployment.

## Wallets and commerce

Guest and wallet libraries remain separate. CCC discovers native CKB, Bitcoin ECDSA and JoyID Passkey accounts. The server verifies a browser-bound, one-use challenge and binds the signature to the CKB lock. Wallet login does not submit blockchain transactions. JoyID temporary session keys are not supported.

Vendors publish games on their own HTTPS origins through scoped launch tickets. See [vendor hosting](vendor/README.md), [environment configuration](vendor/vendor.env.example) and [marketplace architecture](docs/marketplace-architecture.md). Free publication works without a settlement address. Paid publication requires the operator's actual `STORE_CKB_ADDRESS`; purchases split direct mainnet outputs 20% to the store and 80% to the vendor. The store does not hold private keys. Device-level wallet and funded payment acceptance remain separate operational checks.

## Verification

`npm test` covers store identity, publishing, settlement logic, reviews, UI state, static delivery and the generic game boundary. Game repositories test their own rules, rendering/input transforms, session replay and host adapters. Historical release reports in `docs/` describe their original deployment layouts; the migration guide defines the current repository/service boundary.
