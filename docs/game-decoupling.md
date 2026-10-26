# Independent game services

The migration uses the complete thirteen-game source at `b1423e6` on `codex/myelin-arcade-collection`, rather than the older four-game `main`. The decoupled store supersedes that source snapshot on `main`. The existing four repositories were transferred from Myelin-Labs to UTXOPlay with their Git history. Four additional repositories contain the extracted runtimes and source provenance. The Myelin engine itself remains in Myelin-Labs; dependency revisions are unchanged.

## Boundary

The store keeps listing metadata and promotional images, identity, purchases, libraries and community data. Games own executable rules, rendering, assets, native builds, room membership and item economies. There are no submodules or npm dependencies from the store to game repositories. An unavailable game does not prevent the store from building or starting.

Every configured service serves `/games/<id>/` and an authenticated `/games/<id>/api/` namespace. Requests from the store use `X-Runtime-Token` and a server-selected `X-UTXOPlay-Account`. The host also supports its own signed guest cookie for standalone play. Standalone guest identities are separate from store identities. Game account IDs and existing native session directories retain their formats.

The store forwards game HTTP responses, SSE and configured WebSocket routes, but does not interpret game actions. Asset requests do not forward user cookies, credentials, upstream cookies or redirects. A game cannot choose the upstream destination; only the operator's service configuration can. Browser writes and upgrades remain origin-checked. Closing a session also terminates existing SSE/WebSocket access.

Hosts provide optional `api/items` endpoints with display metadata, current account balances, ownership and prices. The store renders these records and links back to the game; it neither imports game code nor purchases in-game items.

## Prepare and switch an existing deployment

1. Back up the platform SQLite database with SQLite's backup API. Stop game writers before copying their account stores and authority keys. Retain the matching engine/verifier release artifacts and the current deployment definition for rollback.
2. Build each game repository and its standalone host. Use the original `DATA_DIR` for that game's native process. Arcade, Prism, Miner and Atelier keep their original native route prefixes and account directory layouts. Do not merge, reset, rename or regenerate native state.
3. Copy the old online chess room membership into the Chess host's separate database, while the old chess room writer is stopped:

   ```sh
   # Run from myelin-chess; use your actual backed-up database paths.
   node tools/import-store-rooms.mjs /backup/platform.sqlite /data/chess-rooms/rooms.sqlite
   ```

   Set `ROOMS_DATA_DIR=/data/chess-rooms` on the new Chess host. The importer is transactional, reads the source in read-only mode, preserves room IDs/seats/timestamps, skips identical rows and rejects conflicting rows. The native room account derivation remains `sha256("utxoplay:chess:room:" + roomId)`, so the same native game data restores existing online boards. Keep the source table for rollback; do not drop it. Historical display names remain in the store; the standalone room UI uses seat labels.
4. Create the shared private network once: `docker network create --internal utxoplay-games`. Each game repository supplies a compose file. Start the game services on it; their private native ports are bound only to loopback inside each container. The host port is 8080 on the private network. Use HTTPS before exposing a standalone host publicly and set its `GAME_ORIGIN` to that exact origin.
5. Set per-game service URLs and tokens in the store environment (see `server/game-services.json`), and set the corresponding stable `RUNTIME_TOKEN` on each game. The existing common token is supported as a migration fallback. Never put secrets in committed JSON, Docker build arguments, frontend bundles or URLs.
6. Build the store image and switch the store only after all thirteen game pages, state endpoints and exports pass against the prepared services. Verify an existing online chess invitation, both player seats, SSE updates, both realtime games, item inventory and account separation. Do not point the new gateway at the old bare native ports: it expects the standalone game host.
7. Keep the old images and deployment definition until acceptance completes. Roll back both service URLs and the store image together if needed. New chess room memberships after cutover live in the new database; reconcile those records before rolling back to a store-owned room writer.

The initial source migration published these recipes without changing production. The subsequent authorized production cutover is recorded in [the 0.32.0 deployment report](deployment-independent-0.32.0.md). It retained the exact native binaries and did not execute mainnet transactions.

## Local integration

Build each game's Node package and native artifacts using its README. Host ports default to 8881–8888 and native ports to 8781–8788. `npm run dev:platform` in the store launches built sibling checkouts. Its disposable/local layout is `data/standalone/<repository>`; production data is never used implicitly. To reuse a local saved game, start the corresponding host with an explicit `DATA_DIR` instead.

Store unit tests require no game source or running game service. Independent host tests use simulated native transports to exercise identity and routing. Native tests and browser/native conformance checks live with each game.
