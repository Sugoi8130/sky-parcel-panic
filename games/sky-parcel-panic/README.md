# Sky Parcel Panic

Sky Parcel Panic is a separate FriendSDK v0.1.2 prototype starring the player's
verified Rare Friend. It is a colorful, SNES-inspired isometric delivery game and
does not share source, assets, saves or build output with Alien Angler.

## Run

```sh
pnpm install
pnpm run dev
```

Open the printed local URL. The playable preview uses the FriendSDK ownership
gate and requires a browser wallet on Robinhood mainnet (chain 4663) holding a
hardwired Rare Friends Generations NFT (generation 1 or higher).

## Demo rules

- A route lasts 45 seconds and asks for five successful deliveries.
- The route spans three connected districts: Postal Plaza, Bloom Market and
  Windmill Route. Ride through the east or west edge to move between them.
- Each district uses a wide open plaza layout with live, code-rendered direction
  signs at the exits. Sign labels automatically name the neighboring district.
- Drive with WASD or arrow keys. Hold Space, Shift or the on-screen BOOST button
  for a temporary speed increase.
- Pick up the sparkling parcel, then reach the highlighted house door.
- Pickup, delivery and traffic hitboxes are intentionally generous for fast,
  arcade-style play. The scooter also moves faster than the original prototype.
- Each pickup grants 25 points. Deliveries grant 100 points multiplied by the
  current combo and add three seconds to the clock.
- Delivering again within twelve seconds grows the combo, up to x5.
- Colliding with a runaway carrot or bird removes one heart, two seconds and 40
  points. The player receives brief collision protection after a hit.
- The run ends after five deliveries, when time expires, or when all hearts are
  lost. Reloading resets the session.

The game has no audio in this demo. Reduced-motion preferences disable camera
shake, pulsing markers and nonessential bobbing. Keyboard input is cleared when
the tab loses focus, the document is hidden or the FriendSDK runtime pauses play.

## SDK and economy scope

FriendSDK supplies wallet connection, Friend selection, fresh ownership checks,
canonical Friend artwork, sandboxing and the initial session read. The action
client's chance-game definition is a schema-only placeholder because SDK v0.1.2
still requires one for the runtime. Delivery Tickets and Route Results are not
presented, purchased or awarded by this game.

This prototype performs no RF transaction, wallet signature, random payout or
persistent save. A future economy could sell cosmetic scooters and trail effects
for simulated RF, but none is implemented in this build.

All environment artwork is drawn in code. Canonical Friend artwork is loaded
through FriendSDK under its supplied artwork permissions.

The floating town uses original 2:1 isometric tiles, layered pixel shadows,
animated water, market stalls, signposts and a working windmill. Screen-relative
steering is converted to isometric world movement, so the arrow pad still feels
natural on desktop and mobile.
