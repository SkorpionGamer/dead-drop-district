/** @type {import('playwright').PlaywrightTestConfig} */
module.exports = {
  testDir: "./tests",
  timeout: 30000,
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
};
