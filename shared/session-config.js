(function (root, factory) {
  const config = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = config;
  }

  if (root) {
    root.DDDSessionConfig = Object.assign({}, root.DDDSessionConfig || {}, config);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const WORLD_BOUNDS = Object.freeze({
    width: 2600,
    height: 1800,
  });

  const CLASS_LOADOUTS = Object.freeze({
    stealther: Object.freeze({
      name: "Stealther",
      weaponLabel: "Suppressed Sidearm",
      ammo: 12,
      shotRate: 0.25,
      reloadTime: 2.45,
      bulletSpeed: 600,
      damage: 20,
      pellets: 1,
      spread: 0.018,
      recoil: 0.72,
      soundRadius: 135,
      speed: 182,
      sprintSpeed: 268,
      medkits: 1,
      noiseCharges: 2,
      quietMultiplier: 0.48,
      cash: 60,
      hpCells: 2,
      shieldCells: 0,
      canUseShield: false,
      ability: "cloak",
      abilityCooldown: 14,
      abilityDuration: 3.8,
    }),
    breacher: Object.freeze({
      name: "Breacher",
      weaponLabel: "Shotgun",
      ammo: 6,
      shotRate: 0.54,
      reloadTime: 2.7,
      bulletSpeed: 560,
      damage: 11,
      pellets: 5,
      spread: 0.18,
      recoil: 1.15,
      soundRadius: 300,
      speed: 166,
      sprintSpeed: 246,
      medkits: 1,
      noiseCharges: 0,
      quietMultiplier: 0.62,
      cash: 0,
      hpCells: 3,
      shieldCells: 2,
      canUseShield: true,
      ability: "brace",
      abilityCooldown: 10,
      abilityDuration: 2.8,
    }),
    marksman: Object.freeze({
      name: "Marksman",
      weaponLabel: "Carbine",
      ammo: 20,
      shotRate: 0.36,
      reloadTime: 2.55,
      bulletSpeed: 690,
      damage: 29,
      pellets: 1,
      spread: 0.01,
      recoil: 0.84,
      soundRadius: 235,
      speed: 172,
      sprintSpeed: 252,
      medkits: 0,
      noiseCharges: 1,
      quietMultiplier: 0.56,
      cash: 90,
      hpCells: 2,
      shieldCells: 1,
      canUseShield: true,
      ability: "focus",
      abilityCooldown: 9,
      abilityDuration: 2.4,
    }),
  });

  const MOVEMENT_RECONCILIATION = Object.freeze({
    localSnapDistance: 84,
    localBlendMinMs: 80,
    localBlendMaxMs: 120,
    localCorrectionRate: 12,
    remoteInterpolationDelayMs: 120,
    remoteSampleTtlMs: 1000,
  });

  const MULTIPLAYER_AUTHORITY_MODE = "host";

  return {
    WORLD_BOUNDS,
    CLASS_LOADOUTS,
    MOVEMENT_RECONCILIATION,
    MULTIPLAYER_AUTHORITY_MODE,
  };
});
