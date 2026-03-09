const path = require("path");
const { pathToFileURL } = require("url");
const { test, expect } = require("playwright/test");

function projectUrl(file) {
  return pathToFileURL(path.join(__dirname, "..", file)).toString();
}

async function openRaid(page, raidClass = "stealther") {
  await page.goto(projectUrl("index.html"));

  await expect(page).toHaveTitle(/Dead Drop District/i);
  await expect(page.locator("#start-overlay")).toHaveClass(/is-visible/);
  await expect(page.locator("#start-button")).toBeVisible();

  await page.locator(`[data-class="${raidClass}"]`).click();
  await page.locator("#start-button").click();

  await expect(page.locator("#start-overlay")).not.toHaveClass(/is-visible/);
}

test("prototype boots and enters a raid", async ({ page }) => {
  await openRaid(page, "breacher");

  await expect(page.locator("#ammo-value")).toContainText("6 / 6");
  await expect(page.locator("#medkit-value")).toContainText("1");
});

test("classes apply distinct starting loadouts", async ({ page }) => {
  const expectations = [
    { raidClass: "stealther", ammo: "12 / 12", med: "1", noise: "2", cash: "$60" },
    { raidClass: "breacher", ammo: "6 / 6", med: "1", noise: "0", cash: "$0" },
    { raidClass: "marksman", ammo: "20 / 20", med: "0", noise: "1", cash: "$90" },
  ];

  for (const expectation of expectations) {
    await openRaid(page, expectation.raidClass);
    await expect(page.locator("#ammo-value")).toContainText(expectation.ammo);
    await expect(page.locator("#medkit-value")).toContainText(expectation.med);
    await expect(page.locator("#noise-value")).toContainText(expectation.noise);
    await expect(page.locator("#cash-value")).toContainText(expectation.cash);
    await page.reload();
  }
});

test("doors and windows create real openings in building collision", async ({ page }) => {
  await openRaid(page, "stealther");

  const result = await page.evaluate(() => {
    const building = buildings.find((entry) => entry.id === "service");
    const doorX = building.door.x + building.door.w * 0.5;
    const doorOuterY = building.y + building.h + 20;
    const doorInnerY = building.y + building.h - 36;
    const window = building.windows[0];
    const windowX = window.x + window.w * 0.5;
    const windowOuterY = building.y - 20;
    const windowInnerY = building.y + 36;

    building.door.open = false;
    window.broken = false;
    const closedDoorBlocked = lineBlocked(doorX, doorOuterY, doorX, doorInnerY);
    const closedWindowBlocked = lineBlocked(windowX, windowOuterY, windowX, windowInnerY);

    building.door.open = true;
    window.broken = true;
    const openDoorBlocked = lineBlocked(doorX, doorOuterY, doorX, doorInnerY);
    const brokenWindowBlocked = lineBlocked(windowX, windowOuterY, windowX, windowInnerY);

    return { closedDoorBlocked, openDoorBlocked, closedWindowBlocked, brokenWindowBlocked };
  });

  expect(result.closedDoorBlocked).toBeTruthy();
  expect(result.closedWindowBlocked).toBeTruthy();
  expect(result.openDoorBlocked).toBeFalsy();
  expect(result.brokenWindowBlocked).toBeFalsy();
});
