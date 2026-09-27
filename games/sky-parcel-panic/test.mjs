import assert from "node:assert/strict";
import { testGame } from "@rarefriends/friendsdk/testing";

await testGame("./games/sky-parcel-panic", {
  width: 960,
  height: 720,
  timeout: 45_000,
  screenshot: "../../outputs/sky-parcel-panic-demo.png",
  check: async ({ game, page }) => {
    await game.getByRole("button", { name: "START DELIVERY RUN" }).click();
    const canvas = game.getByRole("img", { name: /Sky Parcel Panic town/ });
    const firstX = Number(await canvas.getAttribute("data-player-x"));
    await game.getByRole("region", { name: "Sky Parcel Panic game" }).focus();
    await page.keyboard.down("ArrowRight");
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(500);
    const secondY = Number(await canvas.getAttribute("data-player-y"));
    assert(secondY < 350, "keyboard controls should move the scooter on the isometric plaza");
    await page.waitForTimeout(1200);
    await page.keyboard.up("ArrowRight");
    await page.keyboard.up("ArrowUp");
    await game.getByText("▣ PARCEL ON BOARD", { exact: true }).waitFor();
    const receiverId = await canvas.getAttribute("data-receiver-id");
    assert(receiverId && /^\d+$/.test(receiverId), "receiver should be a verified Friend supplied by the wallet runtime");
    const collectedRf = Number(await canvas.getAttribute("data-rf"));
    assert(collectedRf >= 0.05 && collectedRf <= 0.10, "a spinning coin should award between 0.05 and 0.10 route RF");
    assert.equal(await game.getByText(/RUNNING · POSTAL PLAZA/).isVisible(), true);
    await page.screenshot({ path: "../../outputs/sky-parcel-panic-navigation-review.png" });

    await page.keyboard.down("ArrowRight");
    for (let attempt = 0; attempt < 65 && Number(await canvas.getAttribute("data-district")) === 0; attempt++) await page.waitForTimeout(100);
    assert.equal(await canvas.getAttribute("data-district"), "1", "crossing the east edge should enter Bloom Market");
    await page.waitForTimeout(250);
    await page.screenshot({ path: "../../outputs/sky-parcel-panic-ingame-review.png" });
    await page.keyboard.up("ArrowRight");
    await page.keyboard.down("ArrowRight");
    for (let attempt = 0; attempt < 36 && Number(await canvas.getAttribute("data-player-y")) > 390; attempt++) await page.waitForTimeout(100);
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(250);
    const deliveryLabel = await game.locator(".delivery-pips").getAttribute("aria-label");
    const endX = await canvas.getAttribute("data-player-x"), endY = await canvas.getAttribute("data-player-y");
    assert.equal(deliveryLabel, "1 of 5 deliveries", `delivery should complete at Bloom Market; player ended at ${endX},${endY}`);
    await page.screenshot({ path: "../../outputs/sky-parcel-panic-delivery-celebration.png" });

    await game.getByRole("button", { name: "How to play" }).click();
    assert.equal(await game.getByRole("dialog", { name: "How to play" }).isVisible(), true);
    await game.getByRole("button", { name: "BACK TO ROUTE" }).click();
  }
});
