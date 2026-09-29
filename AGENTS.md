# Sky Parcel Panic — Codex handoff

This repository contains only Sky Parcel Panic. It is intentionally separate
from Alien Angler. Never replace, merge, delete, or edit Alien Angler while
working in this repository.

## Start here

1. Use Node.js 22 or newer.
2. Run `pnpm install` from the repository root. The postinstall script applies
   the small FriendSDK companion-roster bridge required by this game.
3. Run `pnpm run check` and `pnpm run test` before changing gameplay.
4. Run `pnpm run dev` for the local FriendSDK preview.

## Important files

- `games/sky-parcel-panic/index.tsx`: gameplay, rendering, map transitions,
  wallet-owned receiver roster, RF coins, scoring, collisions and controls.
- `games/sky-parcel-panic/style.css`: HUD, overlays and responsive controls.
- `games/sky-parcel-panic/assets/`: the three original pixel-art districts.
- `games/sky-parcel-panic/test.mjs`: full FriendSDK browser smoke test.
- `scripts/patch-friendsdk.mjs`: extends FriendSDK v0.1.3 so the trusted host
  passes verified owned Friend IDs to the sandboxed game.

## Current design rules

- The selected wallet-owned Rare Friend is the courier.
- Each parcel randomly chooses another verified Friend from the wallet as the
  receiver. Avoid repeating the previous receiver when alternatives exist.
- Receivers use canonical FriendSDK sprites and celebrate after delivery.
- Small spinning RF coins are playful route collectibles. Each grants a random
  `0.05` to `0.10` route RF; this is demo state, not an on-chain transfer.
- The world has Postal Plaza, Bloom Market and Windmill Route.
- Keep the SNES-inspired, colorful, crisp pixel-art presentation.
- Preserve keyboard, touch, reduced-motion and FriendSDK pause behavior.

## Verification

Run all three commands before handing off a change:

```powershell
pnpm run build
pnpm run check
pnpm run test
```

