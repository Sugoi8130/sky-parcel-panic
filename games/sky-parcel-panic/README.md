# Sky Parcel Panic

Sky Parcel Panic is a standalone FriendSDK v0.1.3 game starring the player's
verified Rare Friend. It is a colorful, SNES-inspired isometric delivery arcade
game and does not share source, assets, saves, or build output with Alien Angler.

## Run locally

Requirements: Node.js 22+ and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Open the printed local URL. The FriendSDK ownership gate requires a browser
wallet on Robinhood mainnet (chain 4663) holding a hardwired Rare Friends
Generations NFT, generation 1 or higher.

## How to play

- Choose one of four worlds, each containing three connected scenes.
- Complete five deliveries during a five-minute route.
- Drive with WASD or arrow keys. Hold Space, Shift, or the touch BOOST button
  for a temporary speed increase.
- Pick up the sparkling parcel, follow the named exit signs, and reach the
  highlighted Rare Friend recipient.
- Deliver again within twelve seconds to grow the combo up to x5.
- Avoid moving carrots and birds. A collision removes one heart, two seconds,
  and 40 points, with brief protection after the hit.
- Collect the ten small RF coins scattered through each scene. Each awards a
  random 0.05-0.10 simulated route RF and restores 18 boost.
- A Star Core has an 18% chance to appear for a route. It grants twelve seconds
  of free boost and hazard immunity.
- Finishing with at least 3:00, 2:00, or 1:00 remaining earns S, A, or B rank;
  slower completions earn C. Rank bonuses are 120, 80, 50, and 25 simulated RF.

The four worlds are Postal Route, Forest Canopy, Coral Cove, and Cosmic Station.
Every delivery recipient is randomly selected from other Rare Friends available
in the connected wallet. Recipients celebrate when a parcel arrives.

## Courier Closet and simulated economy

The session starts with 1,400 simulated RF and no purchased cosmetics. The
Courier Closet contains five headgear items, three scooters, three boost trails,
and three head pets priced from 90 to 280 RF. Purchased items can be equipped
immediately and rank rewards feed back into the same session wallet.

All RF balances, route coins, rewards, and purchases are simulated. There is no
on-chain RF transfer, wallet signature, redeemable payout, or persistent save.
The `game.json` chance definition is a schema-only placeholder required by
FriendSDK v0.1.3; Delivery Tickets and Route Results are not shown or used.

## Accessibility and audio

Three original chiptune route tracks are selected randomly each session. RF coin,
Star Core, and delivery actions have dedicated sound cues. The HUD includes a
mute toggle. Reduced-motion mode disables camera shake, pulsing markers, and
nonessential bobbing. Keyboard input clears when the tab loses focus, the
document is hidden, or FriendSDK pauses play.

## Verification

```sh
pnpm run build
pnpm run check
pnpm run test
```

The browser test covers the five-minute route contract, map transitions, coin and
Star Core rules, cosmetics, wallet Friend recipients, audio controls, delivery,
and reduced-motion behavior.

FriendSDK supplies wallet connection, Friend selection, ownership checks,
canonical Friend artwork, sandboxing, and session initialization. Environment,
item, interface, and audio assets are original to Sky Parcel Panic.
