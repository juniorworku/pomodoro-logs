const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { Store, stamp } = require("../electron/store.cjs");
async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixel-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const vault = path.join(root, "vault");
  await fs.mkdir(vault);
  const store = new Store(path.join(root, "config"));
  await store.init();
  await store.save({ vault });
  return { store, root, vault };
}

test("append preserves existing daily notes and deduplicates recovered sessions", async (t) => {
  const { store } = await setup(t);
  const session = {
    id: "round-1",
    start: "2026-11-11T14:30:00",
    end: "2026-11-11T14:55:00",
    minutes: 25,
    tag: "#coding",
    note: "Built timer\nUI",
  };
  const file = await store.target(store.config.logs, "2026-11-11.md");
  await fs.writeFile(file, "# Existing day\nKeep this.");
  await store.log(session);
  await store.log(session);
  const text = await fs.readFile(file, "utf8");
  assert.ok(text.startsWith("# Existing day\nKeep this.\n"));
  assert.equal(text.match(/quiet:round-1/g).length, 1);
  assert.match(text, /14:30 - 14:55.*25m.*#coding.*Built timer UI/);
});
test("configuration validates intervals and rejects traversal and escaping symlinks", async (t) => {
  const { store, root, vault } = await setup(t);
  await assert.rejects(store.save({ logs: "../outside" }));
  await assert.rejects(store.save({ long: 0 }));
  await fs.symlink(root, path.join(vault, "linked"));
  await assert.rejects(store.target("linked", "test.md"), /escapes/);
  const file = await store.target(store.config.logs, "test.md");
  await fs.symlink(path.join(root, "outside.md"), file);
  await assert.rejects(store.target(store.config.logs, "test.md"), /symbolic/);
  await store.save({ work: 30, long: 20 });
  const again = new Store(path.join(root, "config"));
  await again.init();
  assert.equal(again.config.long, 20);
});
test("timer pauses, resumes, and measures deadlines across sleep without extending duration", async () => {
  const { fresh, toggle, seconds, complete } = await import("../src/timer.mjs");
  const c = { work: 25, rest: 5, long: 15 };
  let timer = fresh(c);
  timer = toggle(timer, 1000000, { id: "round", tag: "study", note: "notes" });
  assert.equal(seconds(timer, 1060000), 1440);
  timer = toggle(timer, 1060000, {});
  assert.equal(timer.deadline, null);
  assert.equal(seconds(timer, 9999999), 1440);
  timer = toggle(timer, 1120000, { tag: "ignored" });
  assert.equal(timer.tag, "study");
  assert.equal(timer.id, "round");
  assert.equal(seconds(timer, 9999999), 0);
  const result = complete(timer, c);
  assert.equal(result.session.minutes, 25);
  assert.equal(result.next.mode, "short");
  assert.equal(result.next.deadline, null);
});
test("every fourth focus unlocks long break, and breaks never create logs", async () => {
  const { fresh, toggle, complete } = await import("../src/timer.mjs");
  const c = { work: 25, rest: 5, long: 15 };
  let timer = toggle(fresh(c, "work", 3), Date.now(), {
    id: "fourth",
    tag: "study",
    note: "",
  });
  const done = complete(timer, c);
  assert.equal(done.next.mode, "long");
  assert.equal(done.next.remaining, 900);
  assert.equal(done.next.cycles, 4);
  timer = toggle(done.next, Date.now(), { id: "break" });
  assert.equal(complete(timer, c).session, null);
  assert.equal(complete(timer, c).next.mode, "work");
});
