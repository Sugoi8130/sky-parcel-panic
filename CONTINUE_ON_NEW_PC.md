# Continue on another computer

Install Codex and the FriendSDK kit, then paste this into a new Codex chat:

> Clone `https://github.com/Sugoi8130/sky-parcel-panic.git` into a new local project, read `AGENTS.md`, run the
> setup script, verify the existing tests, start the FriendSDK preview, and
> continue building Sky Parcel Panic without changing Alien Angler.

Codex can then run:

```powershell
git clone https://github.com/Sugoi8130/sky-parcel-panic.git
cd sky-parcel-panic
powershell -ExecutionPolicy Bypass -File scripts/setup-new-pc.ps1
pnpm run dev
```

