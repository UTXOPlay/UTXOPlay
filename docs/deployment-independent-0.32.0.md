# Independent games production cutover — 0.32.0

Deployed to https://store.utxoplay.io on 2026-10-26 at 03:50:07 UTC. The store runs independently of eight game services covering all thirteen curated games. All nine containers passed health checks. The eight previous native containers are stopped and retained for rollback; twelve unrelated running containers retained their original IDs.

## No game-version regression

Before deployment, all 225 game files in the previous production release matched the complete `b1423e6` migration baseline by SHA-256. For each of the six Rust runtimes, the deployed release's `game.rs`, `session.rs`, `main.rs`, Cargo manifest and Cargo lockfile matched the extracted repository. Teeworlds' service and OpenStrike's service/practice modules also matched exactly. Older store-image version numbers on the native containers represented their last rules release, not obsolete gameplay.

The new standalone images contain the committed browser build and host plus the **exact existing native executables**. Both bridge/verifier pairs for realtime games were retained together. The native artifact hashes were verified again inside every new running container. No game rules, application profiles, account directories, saved state formats or signing authorities were changed.

| Repository | Deployed source revision | Image |
| --- | --- | --- |
| `myelin-chess` | `e984005ec11b` | `myelin-chess:independent-e984005e` |
| `myelin-sling` | `4d747157b4c7` | `myelin-sling:independent-4d747157` |
| `myelin-teeworlds` | `788060d6382d` | `myelin-teeworlds:independent-788060d6` |
| `myelin-openstrike` | `9b946eb6f3d8` | `myelin-openstrike:independent-9b946eb6` |
| `myelin-arcade` | `077a198c81e1` | `myelin-arcade:independent-077a198c` |
| `myelin-neon-miner` | `a73dfb40fcc6` | `myelin-neon-miner:independent-a73dfb40` |
| `myelin-prism-breaker` | `004cc047777f` | `myelin-prism-breaker:independent-004cc047` |
| `myelin-atelier` | `278c834dc556` | `myelin-atelier:independent-278c834d` |
| `UTXOPlay` | `a00e08193a1c` | `utxoplay:0.32.0` |

The store image has neither `/app/games` nor `/app/bin`. Game hosts own assets, APIs, online chess membership and item pricing. The public gateway uses the private `utxoplay-games` network; private native ports bind only to loopback inside their game containers. No game runtime ports were published.

## Data and recovery

Release directory: `/data/utxoplay/releases/20261026-independent-0.32.0`.

Stopped-writer backup: `/data/utxoplay/backups/independent-0.32.0-20261026-034919`.

The backup contains a SQLite backup that passed `quick_check`, a verified archive of all shared platform/game data, original container definitions and native artifact hashes. The release contains source revisions, distribution hashes, build logs, native artifact hashes and the exact deployment definitions. Environment files and original container metadata are private server-side files and are not committed.

All existing native data mounts remain at their original paths. One pre-existing chess room was imported into `/data/utxoplay/shared/chess-rooms/rooms.sqlite`; IDs, player seats and timestamps were compared against the store database and matched exactly. The original table remains available for rollback. The standalone UI uses seat labels; historical profile names remain in the store.

Production Compose definitions are `games.compose.json` (project `utxoplay-independent`) and `store.compose.json` (project `utxoplay`) in the release directory. Each game's `deploy/PreservedRuntime.Dockerfile` records how the source-independent image was assembled with its retained native artifacts. For future rule changes, follow the game repository's profile compatibility requirements rather than replacing binaries blindly.

For rollback, first stop the current store and game writers and back up their current data. Reconcile any chess memberships created after cutover from the game-owned room database into the retained store table; do not overwrite newer records with the pre-cutover backup. Stop the eight new game containers, start the retained `utxoplay-*` native containers, and recreate only the store using the 0.31.0 release's Compose file with project `utxoplay`. Restore routing and image together. The old images, sources and data have not been deleted.

## Acceptance

The nine images were first started with isolated staging data. All thirteen games passed browser checks at 1920×1080, 2560×1080, 2560×1440, 3840×2160, 390×844 and 844×390. No page errors, failed asset requests or horizontal overflow occurred. The actual store iframe handshake and all nine item cards passed.

After cutover, the same checks passed through the public HTTPS origin. Sixty-eight served HTML, JavaScript and CSS artifacts matched the committed builds by SHA-256. All thirteen authenticated state endpoints worked; all eleven Rust-backed game routes verified native replay. All nine item listings loaded. A session established before cutover retained the same account and byte-equivalent JSON state for all thirteen games after cutover.

Public integration tests additionally passed:

- Chess: two signing identities, SSE position updates, four-ply checkmate, native replay and export.
- OpenStrike: two-account duel, authenticated WebSocket input, elimination, verified Myelin export, account isolation, invalid-input rejection and logout revocation.
- Teeworlds: two-account realtime match, eight input acknowledgements (59 ms median in this run), all 3,000 ticks, verified Myelin proof and identical exports for both players.

These tests used disposable identities. They did not submit payments or blockchain transactions. Existing production accounts, libraries, purchases, game saves and signing keys were preserved.
