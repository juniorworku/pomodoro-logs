const { _electron: electron } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
(async () => {
  const project = path.resolve(__dirname, "..");
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "pixel-ui-"));
  const vault = path.join(temp, "vault");
  await fs.mkdir(vault);
  let app;
  try {
    app = await electron.launch({
      executablePath: path.join(project, "node_modules/electron/dist/electron"),
      args: [
        ...(process.env.PIXEL_TEST_NO_SANDBOX ? ["--no-sandbox"] : []),
        project,
      ],
      env: { ...process.env, XDG_CONFIG_HOME: path.join(temp, "config") },
      timeout: 30000,
    });
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.evaluate(() => document.fonts.check("16px VT323")),
      true,
    );
    await app.evaluate(({ dialog }, vault) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [vault],
      });
    }, vault);
    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "CHOOSE FOLDER..." }).click();
    await page.getByText(vault, { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(async () => (await window.desk.config()).vault),
      "",
    );
    await page.getByRole("button", { name: "SAVE SETTINGS" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    assert.equal(
      await page.evaluate(() => typeof window.desk.tasks),
      "undefined",
    );
    await page.getByRole("button", { name: "▶ START FOCUS" }).click();
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem("timer")).deadline !== null,
    );
    await page.getByRole("button", { name: "Ⅱ PAUSE" }).click();
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem("timer")).deadline === null,
    );
    await page.getByRole("button", { name: "↺ RESET" }).click();
    await page.getByRole("button", { name: "LONG BREAK", exact: true }).click();
    assert.equal(
      await page.getByLabel("Time remaining").textContent(),
      "15:00",
    );
    await page
      .getByRole("button", { name: "SHORT BREAK", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Time remaining").textContent(),
      "05:00",
    );
    await page.getByRole("button", { name: "FOCUS", exact: true }).click();
    await page.getByRole("button", { name: "Mute sound" }).click();
    await page.getByRole("button", { name: "Enable sound" }).waitFor();
    await page.getByLabel("SESSION TAG").fill("coding");
    await page.getByLabel("MISSION NOTE").fill("Build one small thing.");
    if (process.env.PIXEL_SCREENSHOT_DIR)
      await page.screenshot({
        path: path.join(process.env.PIXEL_SCREENSHOT_DIR, "pomodoro-logs.png"),
        fullPage: true,
      });
    await page.evaluate(() => {
      localStorage.setItem(
        "timer",
        JSON.stringify({
          mode: "work",
          minutes: 1,
          remaining: 1,
          deadline: Date.now() + 600,
          start: new Date(Date.now() - 60000).toISOString(),
          id: "smoke-completion",
          tag: "coding",
          note: "Pixel smoke session",
          cycles: 3,
        }),
      );
    });
    await page.reload();
    await page
      .getByText("SESSION SAVED TO YOUR OBSIDIAN VAULT.", { exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("Time remaining").textContent(),
      "15:00",
    );
    const files = await fs.readdir(path.join(vault, "Pomodoro Logs"));
    const text = await fs.readFile(
      path.join(vault, "Pomodoro Logs", files[0]),
      "utf8",
    );
    assert.match(text, /#coding.*Pixel smoke session/);
    await page.reload();
    assert.equal(
      (
        await fs.readFile(path.join(vault, "Pomodoro Logs", files[0]), "utf8")
      ).match(/quiet:smoke-completion/g).length,
      1,
    );

    assert.deepEqual(errors, []);
    console.log(
      "PASS: standalone Electron flow, native-picker bridge, bundled font, Markdown sync, and zero renderer errors.",
    );
  } finally {
    if (app) await app.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
