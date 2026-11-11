const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const stamp = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const clean = (s, max = 2000) => {
  if (typeof s !== "string" || s.length > max) throw Error("Invalid text");
  return s.replace(/[\r\n]/g, " ").replace(/<!--/g, "&lt;!--");
};
class Store {
  constructor(configDir) {
    this.dir = configDir;
    this.queue = Promise.resolve();
  }
  serial(fn) {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  }
  async init() {
    await fs.mkdir(this.dir, { recursive: true });
    try {
      this.config = JSON.parse(
        await fs.readFile(path.join(this.dir, "config.json"), "utf8"),
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      this.config = {
        vault: "",
        logs: "Pomodoro Logs",
        long: 15,
        work: 25,
        rest: 5,
        sound: true,
      };
    }
    return this.config;
  }
  async save(input) {
    const c = { ...this.config, ...input };
    for (const k of ["logs"]) {
      if (
        typeof c[k] !== "string" ||
        !c[k].trim() ||
        path.isAbsolute(c[k]) ||
        c[k].split(/[\\/]/).some((x) => x === ".." || x === "." || !x)
      )
        throw Error("Use a relative subfolder without traversal.");
    }
    for (const k of ["work", "rest", "long"])
      if (!Number.isFinite(c[k]) || c[k] < 1 || c[k] > 180)
        throw Error("Intervals must be between 1 and 180 minutes.");
    if (c.vault) {
      c.vault = await fs.realpath(c.vault);
      if (!(await fs.stat(c.vault)).isDirectory())
        throw Error("Choose a directory");
    }
    await this.serial(async () => {
      const tmp = path.join(this.dir, "config.tmp");
      await fs.writeFile(tmp, JSON.stringify(c, null, 2));
      await fs.rename(tmp, path.join(this.dir, "config.json"));
      this.config = c;
    });
    return c;
  }
  async target(folder, name) {
    if (!this.config.vault)
      throw Error("Choose an Obsidian vault in Settings first.");
    const base = await fs.realpath(this.config.vault);
    let current = base;
    for (const piece of folder.split(/[\\/]/)) {
      if (!piece || piece === ".." || piece === "." || path.isAbsolute(piece))
        throw Error("Invalid folder");
      current = path.join(current, piece);
      try {
        await fs.mkdir(current);
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
      const actual = await fs.realpath(current);
      if (!actual.startsWith(base + path.sep))
        throw Error("Folder escapes the selected vault");
      current = actual;
    }
    const file = path.join(current, name);
    try {
      if ((await fs.lstat(file)).isSymbolicLink())
        throw Error("Refusing symbolic-link note");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return file;
  }
  async read(file) {
    try {
      return await fs.readFile(file, "utf8");
    } catch (e) {
      if (e.code === "ENOENT") return "";
      throw e;
    }
  }
  async log(session) {
    return this.serial(async () => {
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(session.id))
        throw Error("Invalid session");
      const start = new Date(session.start),
        end = new Date(session.end);
      if (
        !Number.isFinite(+start) ||
        !Number.isFinite(+end) ||
        end < start ||
        !Number.isFinite(session.minutes) ||
        session.minutes < 1 ||
        session.minutes > 180
      )
        throw Error("Invalid session");
      const file = await this.target(
        this.config.logs,
        stamp(end).slice(0, 10) + ".md",
      );
      const old = await this.read(file);
      if (old.includes(`<!-- quiet:${session.id} -->`)) return;
      const tag =
        clean(session.tag, 80)
          .replace(/^#+/, "")
          .replace(/[^\p{L}\p{N}_/-]/gu, "-") || "focus";
      await fs.appendFile(
        file,
        `${old && !old.endsWith("\n") ? "\n" : ""}- [x] ${stamp(start).slice(11)} - ${stamp(end).slice(11)} | **Duration:** ${session.minutes}m | **Type:** #${tag} | **Notes:** ${clean(session.note)} [duration:: ${session.minutes}] [type:: ${tag}] <!-- quiet:${session.id} -->\n`,
      );
    });
  }
}
module.exports = { Store, stamp };
