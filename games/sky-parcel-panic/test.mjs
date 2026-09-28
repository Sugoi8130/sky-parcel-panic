import assert from "node:assert/strict";
import { testGame } from "@rarefriends/friendsdk/testing";

await testGame("./games/sky-parcel-panic", {
  width: 960,
  height: 720,
  timeout: 45_000,
  screenshot: "../../outputs/sky-parcel-panic-demo.png",
  check: async ({ game, page }) => {
    for (const name of ["Play POSTAL ROUTE", "Play FOREST CANOPY", "Play CORAL COVE", "Play COSMIC STATION", "Play Random Map"])
      assert.equal(await game.getByRole("button", { name }).isVisible(), true, `${name} should be available on the opening screen`);
    await page.screenshot({ path: "../../outputs/sky-parcel-panic-map-select.png" });
    await game.getByRole("button", { name: "Play FOREST CANOPY" }).click();
    const canvas = game.getByRole("img", { name: /Sky Parcel Panic town/ });
    await game.getByRole("region", { name: "Sky Parcel Panic game" }).focus();
    for (let attempt = 0; attempt < 80 && !await canvas.getAttribute("data-parcel-x"); attempt++) await page.waitForTimeout(50);
    assert(await canvas.getAttribute("data-layout-id"), "the randomized route should expose a layout id");
    assert.equal(await canvas.getAttribute("data-route-seconds"), "300", "each route should use a five-minute countdown");
    assert.equal(await canvas.getAttribute("data-power-buff-spawn-rate"), "0.18", "the Star Core should keep its rare 18% route spawn rate");
    assert.equal(await canvas.getAttribute("data-power-buff-duration"), "12", "the Star Core should grant a 12-second power window");
    assert(await canvas.getAttribute("data-parcel-x"), "the randomized route should expose its first parcel");
    assert.equal(await canvas.getAttribute("data-headgear"), "none", "a new player should start without free headgear");
    assert.equal(await canvas.getAttribute("data-pet"), "none", "a new player should start without a free pet");
    await game.getByRole("button", { name: "Shop" }).click();
    assert.equal(await game.getByRole("dialog", { name: "Courier Closet" }).isVisible(), true, "the cosmetic shop should open from the HUD");
    assert.equal(await game.getByRole("button", { name: "Buy LEAF CAP for 90 RF" }).isVisible(), true, "the former starter cap should now need to be purchased");
    assert.equal(await game.getByRole("button", { name: "Select PARTY POP HAT" }).isVisible(), true, "the new party hat should appear with the headgear cosmetics");
    assert.equal(await game.getByRole("button", { name: "Select COURIER HELMET" }).isVisible(), true, "the new courier helmet should appear with the headgear cosmetics");
    await game.getByRole("button", { name: "Select PARTY POP HAT" }).click();
    await game.getByRole("button", { name: "Buy PARTY POP HAT for 130 RF" }).click();
    await game.getByRole("button", { name: "Select COURIER HELMET" }).click();
    await game.getByRole("button", { name: "Buy COURIER HELMET for 190 RF" }).click();
    await game.getByRole("button", { name: "PETS", exact: true }).click();
    assert.equal(await game.getByRole("button", { name: "Select CLOUD CHICK" }).isVisible(), true, "Cloud Chick should appear in the pet category");
    assert.equal(await game.getByRole("button", { name: "Select STAR SLIME" }).isVisible(), true, "Star Slime should appear in the pet category");
    assert.equal(await game.getByRole("button", { name: "Select PARCEL PUP" }).isVisible(), true, "Parcel Pup should have its own pet category");
    await game.getByRole("button", { name: "Select CLOUD CHICK" }).click();
    await game.getByRole("button", { name: "Buy CLOUD CHICK for 190 RF" }).click();
    await game.getByRole("button", { name: "Select PARCEL PUP" }).click();
    await game.getByRole("button", { name: "Buy PARCEL PUP for 260 RF" }).click();
    await game.getByRole("button", { name: "Select STAR SLIME" }).click();
    await game.getByRole("button", { name: "Buy STAR SLIME for 230 RF" }).click();
    await page.screenshot({ path: "../../outputs/sky-parcel-panic-cosmetic-shop.png" });
    await game.getByRole("button", { name: "SCOOTER", exact: true }).click();
    await game.getByRole("button", { name: "Select MOSS RUNNER" }).click();
    await game.getByRole("button", { name: "Buy MOSS RUNNER for 180 RF" }).click();
    await game.getByRole("button", { name: "BOOST TRAIL", exact: true }).click();
    await game.getByRole("button", { name: "Select FIREFLIES" }).click();
    await game.getByRole("button", { name: "Buy FIREFLIES for 140 RF" }).click();
    assert.equal(await game.getByLabel("80 RF available").isVisible(), true, "the demo wallet should pay for all five new cosmetics and the remaining Forest Courier pieces");
    await game.getByRole("button", { name: "BACK TO ROUTE" }).click();
    await page.waitForTimeout(100);
    assert.equal(await canvas.getAttribute("data-headgear"), "courier-helmet", "the purchased courier helmet should be equipped in game");
    assert.equal(await canvas.getAttribute("data-scooter-skin"), "moss-runner", "the purchased scooter skin should be equipped in game");
    assert.equal(await canvas.getAttribute("data-boost-trail"), "fireflies", "the purchased boost trail should be equipped in game");
    assert.equal(await canvas.getAttribute("data-pet"), "star-slime", "the purchased Star Slime should sit on the courier in game");

    await page.keyboard.down("ArrowRight");
    await page.keyboard.down("Space");
    await page.waitForTimeout(220);
    assert.equal(await canvas.getAttribute("data-boosting"), "true", "holding boost should activate the scooter boost effect");
    await page.screenshot({ path: "../../outputs/sky-parcel-panic-boost-effect.png" });
    await page.keyboard.up("Space");
    await page.keyboard.up("ArrowRight");

    const attributeNumber = async name => Number(await canvas.getAttribute(`data-${name}`));
    const releaseMovement = async () => {
      for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) await page.keyboard.up(key);
    };
    const driveTo = async (prefix, label, stopWhen = async () => false) => {
      for (let attempt = 0; attempt < 180; attempt++) {
        if (await stopWhen()) { await releaseMovement(); return; }
        const [x, y, targetX, targetY] = await Promise.all([
          attributeNumber("player-x"), attributeNumber("player-y"),
          attributeNumber(`${prefix}-x`), attributeNumber(`${prefix}-y`),
        ]);
        assert([x, y, targetX, targetY].every(Number.isFinite), `${label} should expose a valid randomized target`);
        const dx = targetX - x, dy = targetY - y;
        if (Math.hypot(dx, dy) < 18) { await page.waitForTimeout(120); await releaseMovement(); return; }
        const screenX = dx - dy, screenY = dx + dy;
        const pressed = [];
        if (screenX > 6) pressed.push("ArrowRight"); else if (screenX < -6) pressed.push("ArrowLeft");
        if (screenY > 6) pressed.push("ArrowDown"); else if (screenY < -6) pressed.push("ArrowUp");
        for (const key of pressed) await page.keyboard.down(key);
        await page.waitForTimeout(75);
        for (const key of pressed) await page.keyboard.up(key);
      }
      await releaseMovement();
      assert.fail(`scooter should reach the randomized ${label}`);
    };

    assert.equal(await canvas.getAttribute("data-total-coins"), "30", "each selected world should scatter 10 RF coins across each of its three scenes");
    assert.equal(await canvas.getAttribute("data-total-districts"), "3", "each playable world should contain three connected scenes");
    assert.equal(await canvas.getAttribute("data-selected-map"), "1", "the selected Forest map should remain active for the whole run");
    assert(Number(await canvas.getAttribute("data-visible-coins")) >= 8, "the current map should contain many RF coins");
    const visibleHazards = Number(await canvas.getAttribute("data-visible-hazards"));
    assert(visibleHazards >= 5 && visibleHazards <= 8, "each scene should contain between 5 and 8 randomized hazards");
    assert(Number(await canvas.getAttribute("data-hazard-min-range")) >= 80, "every hazard should use the wider movement range");
    assert(Number(await canvas.getAttribute("data-hazard-max-range")) <= 135, "hazard movement should remain within its designed maximum range");
    assert(Number(await canvas.getAttribute("data-coin-spread-x")) >= 220, "RF coins should span most of the map width");
    assert(Number(await canvas.getAttribute("data-coin-spread-y")) >= 60, "RF coins should span both the near and far halves of the map");
    assert(Number(await canvas.getAttribute("data-hazard-spread-x")) >= 160, "hazards should be split across distant map regions");

    const firstX = await attributeNumber("player-x");
    await driveTo("coin", "nearest RF coin", async () => Number(await canvas.getAttribute("data-collected-coins")) >= 1);
    assert(Number(await canvas.getAttribute("data-collected-coins")) >= 1, "driving over a randomized RF coin should collect it");
    assert.equal(await canvas.getAttribute("data-coin-boost"), "18", "each RF coin should restore a fixed 18 boost");
    assert.equal(await canvas.getAttribute("data-last-coin-boost"), "18", "collecting a coin should apply its boost restoration");
    const collectedRf = Number(await canvas.getAttribute("data-rf"));
    assert(collectedRf >= 0.05, "each spinning coin should award at least 0.05 route RF");
    assert.notEqual(await attributeNumber("player-x"), firstX, "keyboard controls should move the scooter on the isometric plaza");

    await driveTo("parcel", "parcel pickup", async () => Boolean(await canvas.getAttribute("data-target-x")));
    await game.getByText("▣ PARCEL ON BOARD", { exact: true }).waitFor();
    const receiverId = await canvas.getAttribute("data-receiver-id");
    assert(receiverId && /^\d+$/.test(receiverId), "receiver should be a verified Friend supplied by the wallet runtime");
    assert.equal(await game.getByText(/RUNNING · FOREST CANOPY · ROOTWOOD CLEARING/).isVisible(), true);
    await page.screenshot({ path: "../../outputs/sky-parcel-panic-navigation-review.png" });

    await driveTo("gate", "scene exit");
    await page.keyboard.down("ArrowRight");
    for (let attempt = 0; attempt < 65 && Number(await canvas.getAttribute("data-district")) === 0; attempt++) await page.waitForTimeout(100);
    await page.keyboard.up("ArrowRight");
    assert.equal(await canvas.getAttribute("data-district"), "1", "crossing the east edge should enter Mooncap Grove");
    await driveTo("target", "delivery stop", async () => await game.locator(".delivery-pips").getAttribute("aria-label") === "1 of 5 deliveries");
    await page.waitForTimeout(250);
    await page.screenshot({ path: "../../outputs/sky-parcel-panic-ingame-review.png" });
    const deliveryLabel = await game.locator(".delivery-pips").getAttribute("aria-label");
    const endX = await canvas.getAttribute("data-player-x"), endY = await canvas.getAttribute("data-player-y");
    assert.equal(deliveryLabel, "1 of 5 deliveries", `delivery should complete in Mooncap Grove; player ended at ${endX},${endY}`);
    await page.screenshot({ path: "../../outputs/sky-parcel-panic-delivery-celebration.png" });

    await game.getByRole("button", { name: "How to play" }).click();
    assert.equal(await game.getByRole("dialog", { name: "How to play" }).isVisible(), true);
    await game.getByRole("button", { name: "BACK TO ROUTE" }).click();
  }
});
