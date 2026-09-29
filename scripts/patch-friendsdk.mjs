import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../node_modules/@rarefriends/friendsdk/dist/", import.meta.url);

async function patch(file, edits) {
  const url = new URL(file, root);
  let source = await readFile(url, "utf8");
  for (const [before, after] of edits) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) throw new Error(`FriendSDK ${file} changed; companion bridge patch needs review.`);
    source = source.replace(before, after);
  }
  await writeFile(url, source);
}

await patch("game-session.d.ts", [[
  "    friendId: bigint;\n    client: GameClient;",
  "    friendId: bigint;\n    /** Verified Friend IDs discovered in the connected wallet by the trusted host. */\n    ownedFriendIds: readonly bigint[];\n    client: GameClient;",
]]);

await patch("game-session.js", [[
  "            setSession({ friendId: event.data.friendId, client: connection.client });",
  "            const supplied = Array.isArray(event.data.ownedFriendIds) && event.data.ownedFriendIds.every((id) => typeof id === \"bigint\" && id > 0n)\n                ? event.data.ownedFriendIds : [];\n            const ownedFriendIds = Object.freeze([...new Set([event.data.friendId, ...supplied])]);\n            setSession({ friendId: event.data.friendId, ownedFriendIds, client: connection.client });",
]]);

await patch("game-host.js", [
  [
    "friend: { ...friend, kind: \"owned\", walletAddress: checked.walletAddress }, definition:",
    "friend: { ...friend, kind: \"owned\", walletAddress: checked.walletAddress }, ownedFriendIds: picker?.friends.map(value => value.id), definition:",
  ],
  [
    "friend: { ...friend, kind: \"owned\", walletAddress: checked.walletAddress }, client:",
    "friend: { ...friend, kind: \"owned\", walletAddress: checked.walletAddress }, ownedFriendIds: picker?.friends.map(value => value.id), client:",
  ],
  [
    "function EmbeddedSession({ friend, client, definition, live, frameUrl, picker })",
    "function EmbeddedSession({ friend, ownedFriendIds, client, definition, live, frameUrl, picker })",
  ],
  [
    "{ type: \"friendsdk:init\", documentId, handshakeId, friendId: friend.id, mode: activeClient.mode }",
    "{ type: \"friendsdk:init\", documentId, handshakeId, friendId: friend.id, ownedFriendIds: ownedFriendIds ?? [friend.id], mode: activeClient.mode }",
  ],
  [
    "sandbox: \"allow-scripts\", referrerPolicy: \"no-referrer\"",
    "sandbox: \"allow-scripts\", allow: \"fullscreen\", allowFullScreen: true, referrerPolicy: \"no-referrer\"",
  ],
]);

console.log("FriendSDK wallet companion bridge and fullscreen permission ready.");
