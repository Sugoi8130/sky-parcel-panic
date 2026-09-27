# Sky Parcel Panic

A colorful SNES-inspired delivery game starring the player's wallet-owned Rare
Friend, built with [FriendSDK](https://github.com/spokesz/friendsdk).

The courier races through three floating-island districts, collects tiny
spinning RF coins, dodges lively hazards and delivers parcels to other randomly
selected Rare Friends verified in the same wallet.

## Continue with Codex on a new computer

After installing Codex and the FriendSDK kit, paste this into a new chat:

> Clone `https://github.com/Sugoi8130/sky-parcel-panic.git` into a new local
> project, read `AGENTS.md`, run `scripts/setup-new-pc.ps1`, verify the tests,
> start the FriendSDK preview, and continue building Sky Parcel Panic without
> changing Alien Angler.

The repository's `AGENTS.md` contains the durable project context and safety
rules. See `CONTINUE_ON_NEW_PC.md` for the manual equivalent.

## Local development

```powershell
pnpm install
pnpm run dev
```

Quality checks:

```powershell
pnpm run build
pnpm run check
pnpm run test
```

The current RF coin counter is demo gameplay state and does not transfer tokens
on-chain.
