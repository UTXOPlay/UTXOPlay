# Store interface dependencies

The store uses Motion (motion 14.6.0 and its resolved dependencies) under the MIT license for local UI transitions. Its notice is distributed at `public/licenses/motion.txt` and linked from About. Motion source: https://github.com/motiondivision/motion.

Lucide provides the existing icon set under the ISC license. React, CCC and other dependencies retain their upstream licenses in the installed packages and lockfile. Game-specific art, audio and source credits remain in each game's credits page and repository; see the independent [game repositories](README.md#independent-games) and About.

The interface loads no animation library from an external CDN. The new WebP covers are format-optimized versions of the existing store artwork; the source PNGs are retained.

The 0.7.0 arcade rules, Canvas renderers, SVG covers and synthesized sounds are original UTXOPlay code under [myelin-arcade/LICENSE](https://github.com/UTXOPlay/myelin-arcade/blob/main/LICENSE). No source or assets were copied from the genre references listed in `docs/arcade-release.md`. The Myelin logo was supplied by the site owner.

Neon Prospector (0.12.0) is an original deterministic implementation of the classic Gold Miner genre. [Lor3walker/gold-miner](https://github.com/Lor3walker/gold-miner), MIT, was inspected as a gameplay reference; its code, artwork and audio are not redistributed. New code uses [myelin-neon-miner/LICENSE](https://github.com/UTXOPlay/myelin-neon-miner/blob/main/LICENSE). The original AI-generated cover prompt and provenance are in `docs/neon-miner-art.json`. Store 0.13.0 adds original imagegen environments, ore, robot/claw and equipment sprites; prompts and encoding provenance are in `docs/neon-miner-ingame-art.json`. No reference-project artwork is redistributed.

Prism Breaker 0.15.0 adapts `Game.Math.intercept` from Jake Gordon and contributors'
[javascript-breakout](https://github.com/jakesgordon/javascript-breakout), revision
`eed59e2affa9423b93d2ac8ff93061bb88b33284`, under MIT. The adapted helper and full
code license ship in [myelin-prism-breaker game vendor directory](https://github.com/UTXOPlay/myelin-prism-breaker/tree/main/games/arcade/web/vendor). It serves the optional visual
Focus Lens; authoritative integer rules remain original UTXOPlay code. No
upstream sound, artwork or level layouts are redistributed. Original generated
artwork, prompts and processing records are in `docs/prism-breaker-art.json` and
the [Prism Breaker source artwork](https://github.com/UTXOPlay/myelin-prism-breaker/tree/main/assets/prism-breaker-source); the in-game credits link the upstream project and
license.
