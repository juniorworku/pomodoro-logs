import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Settings, load, useSounds } from "./shared";
import { fresh, seconds, toggle, complete } from "./timer.mjs";
import type { Config, Timer, Session } from "./timer.mjs";
import "./style.css";
declare global {
  interface Window {
    desk: {
      config: () => Promise<Config>;
      chooseVault: () => Promise<Config | null>;
      saveConfig: (c: Config) => Promise<Config>;
      log: (s: Session) => Promise<void>;
      notify: () => Promise<void>;
    };
  }
}
const defaults: Config = {
  vault: "",
  logs: "Pomodoro Logs",
  work: 25,
  rest: 5,
  long: 15,
  sound: true,
};
function Tomato({ progress, active }: { progress: number; active: boolean }) {
  return (
    <div className={"tomato " + (active ? "ticking" : "")}>
      <svg
        viewBox="0 0 32 32"
        width="160"
        height="160"
        role="img"
        aria-label="Pixel tomato timer"
        shapeRendering="crispEdges"
      >
        <path fill="#263a2d" d="M14 2h4v4h7v3h-5v3h-8V9H7V6h7z" />
        <path fill="#ae4d39" d="M7 11h18v3h4v13h-4v3H7v-3H3V14h4z" />
        <path fill="#e07948" d="M8 12h7v3H9v7H6v-7h2z" />
        <path fill="#7d392d" d="M26 17h3v10h-4v3H10v-3h15z" />
        <path fill="#eff3b2" d="M10 19h3v3h-3zm10 0h3v3h-3z" />
        <path fill="#263a2d" d="M14 24h6v2h-6z" />
      </svg>
      <div
        className="mini-meter"
        aria-label={`${Math.round(progress * 100)} percent complete`}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} className={i < progress * 12 ? "lit" : ""} />
        ))}
      </div>
    </div>
  );
}
function App() {
  const [c, setC] = useState(defaults),
    [ready, setReady] = useState(false),
    [timer, setTimer] = useState<Timer>(() => load("timer", fresh(defaults))),
    [now, setNow] = useState(Date.now()),
    [settings, setSettings] = useState(false),
    [tag, setTag] = useState("coding"),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState("INSERT A LITTLE FOCUS INTO YOUR DAY."),
    [pending, setPending] = useState<Session[]>(() => load("pending", [])),
    [retry, setRetry] = useState(0);
  const syncing = useRef(false);
  const audio = useSounds();
  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  }
  useEffect(() => {
    void window.desk
      .config()
      .then((config) => {
        setC(config);
        if (!localStorage.getItem("timer")) setTimer(fresh(config));
        setReady(true);
      })
      .catch(fail);
    const clock = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("timer", JSON.stringify(timer));
  }, [timer, ready]);
  useEffect(
    () => localStorage.setItem("pending", JSON.stringify(pending)),
    [pending],
  );
  const left = seconds(timer, now),
    progress = 1 - left / (timer.minutes * 60);
  useEffect(() => {
    if (!ready || timer.deadline === null || left > 0) return;
    const result = complete(timer, c);
    if (result.session) {
      const next = [...pending, result.session];
      localStorage.setItem("pending", JSON.stringify(next));
      setPending(next);
    }
    localStorage.setItem("timer", JSON.stringify(result.next));
    setTimer(result.next);
    setStatus(
      timer.mode === "work"
        ? "LEVEL COMPLETE! YOUR BREAK IS READY."
        : "RESTORED! READY FOR ANOTHER ROUND.",
    );
    void window.desk.notify().catch(fail);
    if (c.sound) audio.play("done");
  }, [left, timer.deadline, ready]);
  useEffect(() => {
    if (!ready || !c.vault || !pending.length || syncing.current) return;
    syncing.current = true;
    void window.desk
      .log(pending[0])
      .then(() => {
        syncing.current = false;
        setPending((p) => p.slice(1));
        setStatus("SESSION SAVED TO YOUR OBSIDIAN VAULT.");
        setError("");
      })
      .catch((e) => {
        syncing.current = false;
        fail(e);
      });
  }, [pending, c.vault, ready, retry]);
  function control() {
    if (!ready) return;
    audio.unlock();
    setNow(Date.now());
    setTimer((t) =>
      toggle(t, Date.now(), { id: crypto.randomUUID(), tag, note }),
    );
  }
  function reset(mode = timer.mode) {
    setTimer(fresh(c, mode, timer.cycles));
    setNow(Date.now());
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettings(false);
      if (!settings && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        control();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  return (
    <div className="desktop">
      <div className="window pixel">
        <header className="titlebar">
          <span>[P] POMODORO LOGS</span>
          <button aria-label="Open settings" onClick={() => setSettings(true)}>
            SETUP [+]
          </button>
        </header>
        <main>
          <div className="intro">
            <span className="eyebrow">PLAYER ONE / FOCUS QUEST</span>
            <span className="badge">
              {String(timer.cycles).padStart(2, "0")} SESSIONS
            </span>
          </div>
          <h1>
            SMALL SESSIONS.
            <br />
            BIG ADVENTURES.
          </h1>
          <p className="subtitle">
            Work a little. Rest a little. Keep the good bits.
          </p>
          <div className="game pixel">
            <div className="tabs">
              {(["work", "short", "long"] as const).map((m) => (
                <button
                  key={m}
                  className={timer.mode === m ? "selected" : ""}
                  onClick={() => reset(m)}
                >
                  {m === "work"
                    ? "FOCUS"
                    : m === "short"
                      ? "SHORT BREAK"
                      : "LONG BREAK"}
                </button>
              ))}
            </div>
            <div className="timer-stage">
              <Tomato progress={progress} active={timer.deadline !== null} />
              <div>
                <p className="eyebrow">
                  {timer.deadline !== null
                    ? "▶ QUEST IN PROGRESS"
                    : timer.start
                      ? "Ⅱ QUEST PAUSED"
                      : "★ READY WHEN YOU ARE"}
                </p>
                <div className="clock" aria-label="Time remaining">
                  {String(Math.floor(left / 60)).padStart(2, "0")}:
                  {String(left % 60).padStart(2, "0")}
                </div>
                <div className="lives">
                  {Array.from({ length: 4 }, (_, i) => (
                    <span
                      key={i}
                      className={i < timer.cycles % 4 ? "filled" : ""}
                    >
                      ◆
                    </span>
                  ))}{" "}
                  <small>LONG BREAK EVERY 4 ROUNDS</small>
                </div>
              </div>
            </div>
            <div className="controls">
              <button className="primary" disabled={!ready} onClick={control}>
                {timer.deadline !== null
                  ? "Ⅱ PAUSE"
                  : timer.start
                    ? "▶ RESUME"
                    : timer.mode === "work"
                      ? "▶ START FOCUS"
                      : "▶ START BREAK"}
              </button>
              <button onClick={() => reset()}>↺ RESET</button>
              <button
                aria-label={c.sound ? "Mute sound" : "Enable sound"}
                onClick={() => {
                  audio.unlock();
                  const next = { ...c, sound: !c.sound };
                  void window.desk.saveConfig(next).then(setC).catch(fail);
                }}
              >
                {c.sound ? "SOUND: ON" : "SOUND: OFF"}
              </button>
            </div>
          </div>
          <section className="metadata">
            <label>
              SESSION TAG
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                maxLength={80}
                disabled={!!timer.start}
                list="tags"
              />
              <datalist id="tags">
                <option>coding</option>
                <option>study</option>
                <option>deep-work</option>
                <option>reading</option>
              </datalist>
            </label>
            <label>
              MISSION NOTE
              <input
                placeholder="What are we working on?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                disabled={!!timer.start}
              />
            </label>
          </section>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <div className="status pixel">
            <span className={"light " + (c.vault ? "on" : "")} />
            <span>
              {c.vault ? status : "NO VAULT YET. OPEN SETUP TO CONNECT."}
            </span>
            {pending.length > 0 && (
              <button onClick={() => setRetry((v) => v + 1)}>
                RETRY {pending.length} LOG(S)
              </button>
            )}
          </div>
          <footer>
            <span>CTRL / CMD + ENTER : START / PAUSE</span>
            <span>LOCAL FILES. ZERO CLOUD.</span>
          </footer>
        </main>
      </div>
      {settings && (
        <Settings
          config={c}
          onClose={() => setSettings(false)}
          onSave={async (config) => {
            setC(await window.desk.saveConfig(config));
            if (!timer.start) setTimer(fresh(config, timer.mode, timer.cycles));
          }}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
