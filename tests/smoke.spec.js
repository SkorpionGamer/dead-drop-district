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

test("deterministic hooks expose readable game state", async ({ page }) => {
  await openRaid(page, "stealther");

  const payload = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  expect(payload.mode).toBe("running");
  expect(payload.coordinateSystem).toMatch(/origin top-left/i);
  expect(payload.player?.ammo).toBeGreaterThan(0);

  const advanced = await page.evaluate(() => JSON.parse(window.advanceTime(250)));
  expect(advanced.mode).toBe("running");
  expect(advanced.objective?.progress).toMatch(/\d+\/\d+/);
});

test("authoritative bridge exports collision-aware world state and strict input frames", async ({ page }) => {
  await openRaid(page, "stealther");

  const result = await page.evaluate(() => {
    const startingAmmo = window.__raidRuntime.getState().player.ammo;
    shootPlayer();
    const frame = window.__raidRuntime.getLocalInputFrame();
    const world = exportWorldState();
    return {
      hasLegacyState: Object.prototype.hasOwnProperty.call(frame, "state"),
      hasSpawn: Boolean(frame.spawn && Number.isFinite(frame.spawn.x) && Number.isFinite(frame.spawn.y)),
      hasSeed: Boolean(frame.seed && typeof frame.seed === "object"),
      shootPressed: Boolean(frame.shootPressed),
      startingAmmo,
      ammoAfterShot: window.__raidRuntime.getState().player.ammo,
      collisionCount: Array.isArray(world.collision) ? world.collision.length : 0,
      bounds: world.bounds,
      extractionZone: world.extractionZone,
      requiredLoot: world.requiredLoot,
      nextLevelId: world.nextLevelId,
      doorGeometryComplete: Array.isArray(world.doors) && world.doors.every((door) => Number.isFinite(door.x) && Number.isFinite(door.w)),
      windowGeometryComplete:
        Array.isArray(world.windows) && world.windows.every((windowEntry) => Number.isFinite(windowEntry.y) && Number.isFinite(windowEntry.h)),
    };
  });

  expect(result.hasLegacyState).toBeFalsy();
  expect(result.hasSpawn).toBeTruthy();
  expect(result.hasSeed).toBeTruthy();
  expect(result.shootPressed).toBeTruthy();
  expect(result.ammoAfterShot).toBeLessThan(result.startingAmmo);
  expect(result.collisionCount).toBeGreaterThan(0);
  expect(result.bounds?.width).toBeGreaterThan(0);
  expect(result.bounds?.height).toBeGreaterThan(0);
  expect(result.extractionZone?.w).toBeGreaterThan(0);
  expect(result.requiredLoot).toBeGreaterThanOrEqual(0);
  expect(typeof result.nextLevelId).toBe("string");
  expect(result.doorGeometryComplete).toBeTruthy();
  expect(result.windowGeometryComplete).toBeTruthy();
});

test("combat snapshots keep stable ids for enemy bullets", async ({ page }) => {
  await openRaid(page, "stealther");

  const result = await page.evaluate(() => {
    const enemy = window.__raidRuntime.getState().enemies.find((entry) => !entry.hidden) || window.__raidRuntime.getState().enemies[0];
    fireBullet(enemy, 0, 390, true, enemy.damage || 1, {
      ownerEnemyId: enemy.id,
      ownerFaction: enemy.faction || "security",
    });
    const snapshot = window.__raidRuntime.getCombatSnapshot();
    const latest = snapshot.enemyBullets[snapshot.enemyBullets.length - 1] || null;
    return {
      bulletId: latest?.bulletId || null,
      ownerEnemyId: latest?.ownerEnemyId || null,
      count: snapshot.enemyBullets.length,
    };
  });

  expect(result.count).toBeGreaterThan(0);
  expect(typeof result.bulletId).toBe("string");
  expect(result.bulletId.length).toBeGreaterThan(0);
  expect(typeof result.ownerEnemyId).toBe("string");
});

test("live-session host authority still applies specimen melee damage", async ({ page }) => {
  await openRaid(page, "stealther");

  const result = await page.evaluate(() => {
    window.__raidRuntime.setSocketStatus("live");
    const state = window.__raidRuntime.getState();
    const beforeHp = state.player.hp;
    applySpecimenMeleeHit(
      { kind: "specimen", fireRate: 0.6, cellDamage: 1, aimAngle: 0, justAlerted: false, cooldown: 0 },
      { ...state.player, faction: "raid", isLocal: true }
    );
    return {
      beforeHp,
      afterHp: state.player.hp,
    };
  });

  expect(result.afterHp).toBeLessThan(result.beforeHp);
});

test("live-session host authority still advances host enemy AI", async ({ page }) => {
  await openRaid(page, "stealther");

  const result = await page.evaluate(() => {
    window.__raidRuntime.setSocketStatus("live");
    const state = window.__raidRuntime.getState();
    state.spawnGrace = 0;
    state.enemyBullets = [];
    const enemy = state.enemies[0];
    enemy.dead = false;
    enemy.hidden = false;
    enemy.kind = "guard";
    enemy.state = "hunt";
    enemy.faction = enemy.faction || "security";
    enemy.x = state.player.x + 60;
    enemy.y = state.player.y;
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.aimAngle = Math.PI;
    enemy.viewRange = 420;
    enemy.viewCone = Math.PI * 2;
    enemy.fireRate = 0.5;
    enemy.cooldown = 0;
    enemy.braceTimer = 0;
    enemy.flinchTimer = 0;
    enemy.wounded = false;
    enemy.woundedSeverity = 0;
    enemy.strafeBias = 1;
    state.player.invisible = false;
    state.player.quietMode = false;
    const beforeX = enemy.x;
    const beforeY = enemy.y;
    const beforeCooldown = enemy.cooldown;
    updateEnemies(1 / 60);
    return {
      enemyBulletCount: state.enemyBullets.length,
      cooldown: enemy.cooldown,
      muzzleFlash: enemy.muzzleFlash,
      moved: enemy.x !== beforeX || enemy.y !== beforeY,
      cooldownChanged: enemy.cooldown !== beforeCooldown,
    };
  });

  expect(result.enemyBulletCount > 0 || result.moved || result.cooldownChanged || result.muzzleFlash > 0).toBeTruthy();
});

test("live-session host authority keeps heat and specimen release active", async ({ page }) => {
  await openRaid(page, "stealther");

  const result = await page.evaluate(() => {
    window.__raidRuntime.setSocketStatus("live");
    const state = window.__raidRuntime.getState();
    state.heat = 1;
    state.heatScore = 0;
    state.lastHeatTrigger = "";
    registerHeat(0.8, "test heat");
    const specimen = state.enemies[0];
    specimen.kind = "specimen";
    specimen.hidden = true;
    specimen.contained = true;
    specimen.releaseHeat = 1;
    const shouldRelease = shouldReleaseSpecimen(specimen);
    return {
      heatScore: state.heatScore,
      shouldRelease,
    };
  });

  expect(result.heatScore).toBeGreaterThan(0);
  expect(result.shouldRelease).toBeTruthy();
});

test("live-session host authority keeps publishing combat snapshots", async ({ page }) => {
  await openRaid(page, "stealther");

  const result = await page.evaluate(() => {
    window.__raidRuntime.setSocketStatus("live");
    const beforeSeed = window.__raidRuntime.getCombatSnapshot();
    applyCombatSnapshot({
      levelId: window.__raidRuntime.getState().levelId,
      enemies: window.__raidRuntime.getState().enemies.map((enemy) => ({ ...enemy })),
      bullets: [],
      enemyBullets: [],
    });
    const afterSeed = window.__raidRuntime.getCombatSnapshot();
    return {
      beforeSeedEnemyCount: beforeSeed?.enemies?.length || 0,
      afterSeedIsNull: afterSeed === null,
      seedReady: Boolean(window.__raidRuntime.getState().serverCombatSeedReady),
    };
  });

  expect(result.beforeSeedEnemyCount).toBeGreaterThan(0);
  expect(result.seedReady).toBeFalsy();
  expect(result.afterSeedIsNull).toBeFalsy();
});

test("classes apply distinct starting loadouts", async ({ page }) => {
  const expectations = [
    { raidClass: "stealther", ammo: "12 / 12", med: "1", noise: "2", cash: "$60", hpCells: 2, shieldCells: 0 },
    { raidClass: "breacher", ammo: "6 / 6", med: "1", noise: "0", cash: "$0", hpCells: 3, shieldCells: 2 },
    { raidClass: "marksman", ammo: "20 / 20", med: "0", noise: "1", cash: "$90", hpCells: 2, shieldCells: 1 },
  ];

  for (const expectation of expectations) {
    await openRaid(page, expectation.raidClass);
    await expect(page.locator("#ammo-value")).toContainText(expectation.ammo);
    await expect(page.locator("#medkit-value")).toContainText(expectation.med);
    await expect(page.locator("#noise-value")).toContainText(expectation.noise);
    await expect(page.locator("#cash-value")).toContainText(expectation.cash);
    await expect(page.locator("#health-cells .cell")).toHaveCount(expectation.hpCells);
    await expect(page.locator("#shield-cells .cell")).toHaveCount(expectation.shieldCells);
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
    const targetWindow = building.windows[0];
    building.door.open = false;
    const closedDoorBlocked = lineBlocked(doorX, doorOuterY, doorX, doorInnerY);
    building.door.open = true;
    const openDoorBlocked = lineBlocked(doorX, doorOuterY, doorX, doorInnerY);
    targetWindow.broken = false;
    const closedWindowPresent = getWorldObstacles().some((obstacle) => obstacle.id === targetWindow.id);
    targetWindow.broken = true;
    const openedWindowPresent = getWorldObstacles().some((obstacle) => obstacle.id === targetWindow.id);

    return { closedDoorBlocked, openDoorBlocked, closedWindowPresent, openedWindowPresent };
  });

  expect(result.closedDoorBlocked).toBeTruthy();
  expect(result.openDoorBlocked).toBeFalsy();
  expect(result.closedWindowPresent).toBeTruthy();
  expect(result.openedWindowPresent).toBeFalsy();
});

test("extracting from freight quarter opens the next-stage breach hold", async ({ page }) => {
  await openRaid(page, "stealther");

  const result = await page.evaluate(() => {
    const state = window.__raidRuntime.getState();
    state.loot.forEach((loot) => {
      if (loot.type === "core") {
        loot.collected = true;
      }
    });
    state.lootCollected = state.requiredLoot;
    state.player.x = extractionZone.x + extractionZone.w * 0.5;
    state.player.y = extractionZone.y + extractionZone.h * 0.5;
    interact();

    return {
      levelId: window.__raidRuntime.getState().levelId,
      breachVisible: document.querySelector("#breach-overlay")?.classList.contains("is-visible"),
      title: document.querySelector(".brand-mark h1")?.textContent,
      status: document.querySelector("#status-text")?.textContent,
    };
  });

  expect(result.levelId).toBe("freight");
  expect(result.breachVisible).toBeTruthy();
  expect(result.title).toBe("Freight Quarter");
  expect(result.status).toMatch(/administrative complex/i);
});

test("reactor boss building door and window open real entry lines", async ({ page }) => {
  await openRaid(page, "breacher");

  const result = await page.evaluate(() => {
    beginLevel("reactor", { preservePlayer: true, preserveRunState: true });
    const state = window.__raidRuntime.getState();
    state.running = true;

    const building = buildings.find((entry) => entry.id === "reactor-core");
    const doorX = building.door.x + building.door.w * 0.5;
    const doorOuterY = building.y + building.h + 24;
    const doorInnerY = building.y + building.h - 42;
    const breachWindow = building.windows.find((windowEntry) => windowEntry.id === "reactor-core-east-slit") || building.windows[0];

    building.door.open = false;
    breachWindow.broken = false;
    const closedDoorBlocked = lineBlocked(doorX, doorOuterY, doorX, doorInnerY);
    const closedWindowPresent = getWorldObstacles().some((obstacle) => obstacle.id === breachWindow.id);

    building.door.open = true;
    breachWindow.broken = true;
    const openDoorBlocked = lineBlocked(doorX, doorOuterY, doorX, doorInnerY);
    const brokenWindowPresent = getWorldObstacles().some((obstacle) => obstacle.id === breachWindow.id);

    return {
      levelId: window.__raidRuntime.getState().levelId,
      closedDoorBlocked,
      openDoorBlocked,
      closedWindowPresent,
      brokenWindowPresent,
    };
  });

  expect(result.levelId).toBe("reactor");
  expect(result.closedDoorBlocked).toBeTruthy();
  expect(result.openDoorBlocked).toBeFalsy();
  expect(result.closedWindowPresent).toBeTruthy();
  expect(result.brokenWindowPresent).toBeFalsy();
});
