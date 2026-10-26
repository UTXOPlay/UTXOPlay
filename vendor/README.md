# UTXOPlay vendor hosting

UTXOPlay lists your game; you operate its web client and Myelin game runtime. Free listing and free launches cost nothing. Paid access uses CKB mainnet: one purchase, no scheduled entitlement expiry, 80% to your receive address and 20% to the Store in the same transaction. You remain responsible for keeping purchased games available and handling support and refunds.

## Start with a free listing

1. Sign in at [Studio](https://store.utxoplay.io/developers), choose **Publish a game**, and save its title, description, controls and HTTPS game URL.
2. Supply your public adapter origin, for example `https://play.example.com`. The game must use the same origin, for example `https://play.example.com/game`. Use a dedicated origin per game with this reference adapter.
3. Generate the project launch key. Copy the environment snippet from Studio into a server-only environment file, outside your web root. The key is shown once; the Store stores its SHA-256 hash. Never include this key, the runtime token or session secret in frontend JavaScript.
4. Run your own Myelin game runtime privately. It must implement the game HTTP contract described below. Myelin is an execution/session runtime, not a generic HTTP game server: integrating a new game's rules and client is still your responsibility.
5. Run the adapter, expose it through HTTPS, then choose **Save & check connection**. Choose **Free to play** and **Publish free**. A successful configuration check publishes immediately; there is no listing charge or deposit.

## Install and run

Requires Node 22.23+ and a separately built Myelin game runtime. Pin a reviewed UTXOPlay release/commit in your deployment.

```sh
git clone https://github.com/UTXOPlay/UTXOPlay.git
cd UTXOPlay
npm ci --omit=dev
# Copy vendor.env.example to a private location and fill in your Studio values.
chmod 600 /private/path/vendor.env
node --env-file=/private/path/vendor.env vendor/adapter.mjs
```

Keep `BIND=127.0.0.1`, or put the adapter and runtime on a private container network. Terminate HTTPS on port 443, forwarding HTTP and WebSocket upgrades to port 8800. Example Caddy configuration:

```caddyfile
play.example.com {
  reverse_proxy 127.0.0.1:8800
}
```

Do not expose the private Myelin runtime port. Do not serve the web root through a second unauthenticated static host for a paid game. The adapter protects game files and API calls, but cannot prevent a vendor from intentionally distributing their own game elsewhere.

Generate two independent random secrets for `MYELIN_RUNTIME_TOKEN` and `VENDOR_SESSION_SECRET`, for example with `openssl rand -hex 32`. The first must match the runtime's configured token. Use a process supervisor and back up your game state and Myelin authority keys. Backups and monitoring are the vendor's responsibility.

## Runtime and browser contract

The reference adapter supports `GET /api/state`, `GET /api/export`, and the game's `POST /api/new`, `POST /api/action`, `POST /api/replay` interfaces. It forwards JSON and injects `X-Runtime-Token` and the authenticated, project-scoped `X-UTXOPlay-Account`. Implement authorization and account isolation in the runtime; never use a client-supplied player ID as authority. The exact action/state payloads remain game-specific.

It also forwards `/api/socket` for the existing Teeworlds/OpenStrike style room protocol, with cookie/origin checks, a 4 KiB client-frame limit and 120 messages/second. This is not a universal multiplayer SDK. Match your client to your game's protocol and replay verifier.

The web root is mounted at the game URL path. Use absolute `/api/...` requests, or `<game-path>/api/...`. Include your own styles, audio and scripts in the web root; first-party Store shell assets and iframe integrations are not automatically available on your domain.

## Launch protocol

- The public `GET /.well-known/utxoplay.json` manifest reports `utxoplay.vendor.v1`, project ID, verification token, SHA-256 key fingerprint, game/launch URLs and runtime name/version/status. The adapter probes the private runtime before reporting `ready`.
- The Store checks public HTTPS/DNS, matching project configuration and runtime readiness. It does **not** attest the running binary, certify game security, verify ownership of supplied art or guarantee uptime.
- After checking access, the Store creates a project-scoped, single-use ticket, valid for two minutes. The browser POSTs it to `/utxoplay/launch`; tickets are never put into URLs.
- Your server redeems it with `POST https://store.utxoplay.io/api/vendor/redeem`, JSON `{ "ticket": "..." }`, and `Authorization: Bearer <vendor key>`.
- A successful response contains `player`, `projectId` and `expires`. The player ID is an opaque project-scoped hash, not the wallet address. The reference adapter signs an HttpOnly, Secure, SameSite=Lax cookie valid for at most 24 hours. Each new launch rechecks Store access. An existing vendor session can last until its expiry.
- Rotating a launch key invalidates the old key immediately. Install the new key on your server and recheck the connection. Existing vendor sessions last until expiry; rotating the vendor session secret revokes those cookies.

## Paid release and receipts

Choose **Paid access**, provide a CKB mainnet receive address, one-time CKB price, support URL and refund-policy URL. Check the displayed minimum price before publishing. Each output must contain enough CKB for its cell: two standard 61 CKB outputs imply a minimum total price of 305 CKB for the 20/80 split. Other lock scripts may require more. Studio calculates the minimum from both actual receive scripts.

Store settlement must be configured before paid publication or new checkout. An unset Store address leaves free publication available and paid drafts saved. Wallet login and free publishing never request a payment.

The buyer reviews the immutable quote and network fee before signing. The Store waits for 24 canonical mainnet confirmations and checks the exact transaction, recipients and amounts. There is no Store custody account or withdrawal step: both shares arrive directly in the sale transaction. **Sales & receipts** counts confirmed vendor shares; **Purchases** lets players resume the original transaction or follow confirmation without paying twice.

Draft edits do not change the live release until republished. Changing a price or payout address affects new quotes, not existing receipts. Existing free grants and paid purchases remain valid. Unlisting stops discovery and new purchases; keep hosting for existing owners. Access is account-bound, not a transferable NFT. A no-expiry entitlement does not guarantee a vendor will host forever; disclose your availability and refund terms honestly.

Refunds are handled directly with the vendor under their published policy. This release does not implement automatic refunds, escrow, disputes, subscriptions, tips or Fiber mainnet settlement. An on-chain reorganization suspends paid access until the transaction is confirmed again. Never request a second manual payment to repair an unresolved receipt.
