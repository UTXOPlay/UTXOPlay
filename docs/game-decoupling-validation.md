# Repository separation validation

Validated locally on 2026-10-26 with Node 22.23.1, Rust 1.97.1 and Chromium. The source baseline is `b1423e6`; all data directories used for gameplay checks were disposable. No production service or database was changed.

- Store: 64 unit/integration tests passed and Vite production build passed without a `games/` directory, game build tools or game dependencies.
- Eight game packages built independently. Each package's JavaScript unit tests and isolated host tests passed. Host tests cover standalone cookie persistence, account isolation, injected account headers, invalid gateway credentials, origin checks and route rejection.
- All 45 Rust tests passed across Chess, Skyward, Arcade, Miner, Prism and Atelier. Thirty native source/manifest/lockfile files were compared byte-for-byte with the source baseline. Native profile inputs and dependency revisions were retained.
- 324 native/browser conformance tapes and complete campaigns passed: 111 Arcade tapes, 98 Atelier tapes including all 24 Lumen Weave networks, 66 Miner tapes including two full 60-sector campaigns, and 49 Prism tapes including the 24-sector campaign.
- Real Teeworlds acceptance passed: two-player rooms, account isolation, input bounds, native replay, Myelin sealing, independent verification, tamper rejection and restart persistence.
- Real OpenStrike acceptance passed: native live/replay equality, elimination and full-duration results, real Myelin record/export/verification, forged result and tampered export rejection. Three practice-bot policy tests also passed.
- Real Chess completed a four-ply online checkmate with two independent identities, preserved seats and the exact native head across host/runtime restart, rejected stale heads and verified the exported replay offline. Personal and online games remained separate. The room importer passed repeatability, membership preservation and conflict rejection checks.
- All thirteen games returned usable state through both independent hosts and the store gateway. All nine in-game item listings loaded with native account balances.
- All thirteen browser games reached ready state without page errors or HTTP errors. Each was checked at 1920×1080, 2560×1080, 2560×1440, 3840×2160, 390×844 and 844×390; no horizontal overflow was found. The actual store iframe loading handshake and all nine item cards passed.
- Gateway tests use a synthetic game ID absent from the curated catalog, proving new services do not need game-specific store code. They cover credential/cookie isolation on asset requests, upstream redirect rejection, authenticated HTTP, public/account-specific item catalogs and live SSE/WebSocket revocation after logout.

Docker recipes and migration procedures are supplied, but production deployment, production data cutover, actual wallet-device acceptance and mainnet payment flows were not executed as part of this source migration. The existing deployment continues to use its old service layout until the documented cutover is performed.
