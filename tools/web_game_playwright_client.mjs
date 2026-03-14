import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const args = {
    url: null,
    iterations: 3,
    pauseMs: 250,
    headless: true,
    screenshotDir: "output/web-game",
    actionsFile: null,
    actionsJson: null,
    clickSelector: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--url" && next) {
      args.url = next;
      index += 1;
    } else if (arg === "--iterations" && next) {
      args.iterations = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--pause-ms" && next) {
      args.pauseMs = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--headless" && next) {
      args.headless = next !== "0" && next !== "false";
      index += 1;
    } else if (arg === "--screenshot-dir" && next) {
      args.screenshotDir = next;
      index += 1;
    } else if (arg === "--actions-file" && next) {
      args.actionsFile = next;
      index += 1;
    } else if (arg === "--actions-json" && next) {
      args.actionsJson = next;
      index += 1;
    } else if (arg === "--click-selector" && next) {
      args.clickSelector = next;
      index += 1;
    }
  }

  if (!args.url) {
    throw new Error("--url is required");
  }
  if (!args.actionsJson && !args.actionsFile) {
    throw new Error("--actions-json or --actions-file is required");
  }
  return args;
}

const buttonNameToKey = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  space: "Space",
};

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

async function getCanvas(page) {
  const handle = await page.evaluateHandle(() => {
    let best = null;
    let bestArea = 0;
    for (const canvas of document.querySelectorAll("canvas")) {
      const area = (canvas.width || canvas.clientWidth || 0) * (canvas.height || canvas.clientHeight || 0);
      if (area > bestArea) {
        bestArea = area;
        best = canvas;
      }
    }
    return best;
  });
  return handle.asElement();
}

async function stepActions(page, canvas, steps) {
  for (const step of steps) {
    const buttons = Array.isArray(step.buttons) ? step.buttons : [];
    for (const button of buttons) {
      if (button === "left_mouse_button") {
        const box = await canvas.boundingBox();
        if (!box) {
          continue;
        }
        const x = typeof step.mouse_x === "number" ? step.mouse_x : box.width / 2;
        const y = typeof step.mouse_y === "number" ? step.mouse_y : box.height / 2;
        await page.mouse.move(box.x + x, box.y + y);
        await page.mouse.down({ button: "left" });
      } else if (buttonNameToKey[button]) {
        await page.keyboard.down(buttonNameToKey[button]);
      }
    }

    const frames = Math.max(1, step.frames || 1);
    for (let frame = 0; frame < frames; frame += 1) {
      await page.evaluate(() => window.advanceTime?.(1000 / 60));
    }

    for (const button of buttons) {
      if (button === "left_mouse_button") {
        await page.mouse.up({ button: "left" });
      } else if (buttonNameToKey[button]) {
        await page.keyboard.up(buttonNameToKey[button]);
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const actionPayload = args.actionsFile
    ? JSON.parse(fs.readFileSync(args.actionsFile, "utf8"))
    : JSON.parse(args.actionsJson);
  const steps = actionPayload.steps || [];
  ensureDir(args.screenshotDir);

  const browser = await chromium.launch({
    headless: args.headless,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage();
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push({ type: "console.error", text: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    errors.push({ type: "pageerror", text: String(error) });
  });

  await page.goto(args.url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  if (args.clickSelector) {
    await page.click(args.clickSelector, { timeout: 5000 });
    await page.waitForTimeout(250);
  }

  const canvas = await getCanvas(page);
  for (let index = 0; index < args.iterations; index += 1) {
    await stepActions(page, canvas, steps);
    await page.waitForTimeout(args.pauseMs);

    await canvas.screenshot({ path: path.join(args.screenshotDir, `shot-${index}.png`) });
    const text = await page.evaluate(() => window.render_game_to_text?.() || null);
    if (text) {
      fs.writeFileSync(path.join(args.screenshotDir, `state-${index}.json`), text);
    }
    if (errors.length) {
      fs.writeFileSync(path.join(args.screenshotDir, `errors-${index}.json`), JSON.stringify(errors, null, 2));
      break;
    }
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
