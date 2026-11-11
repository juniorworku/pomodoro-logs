export function fresh(config, mode = "work", cycles = 0) {
  const minutes =
    config[mode === "short" ? "rest" : mode === "long" ? "long" : "work"];
  return {
    mode,
    minutes,
    remaining: minutes * 60,
    deadline: null,
    start: "",
    id: "",
    tag: "",
    note: "",
    cycles,
  };
}
export function seconds(timer, now) {
  return timer.deadline === null
    ? timer.remaining
    : Math.max(0, Math.ceil((timer.deadline - now) / 1000));
}
export function toggle(timer, now, metadata) {
  if (timer.deadline !== null)
    return { ...timer, remaining: seconds(timer, now), deadline: null };
  return {
    ...timer,
    deadline: now + timer.remaining * 1000,
    start: timer.start || new Date(now).toISOString(),
    id: timer.id || metadata.id,
    tag: timer.start ? timer.tag : metadata.tag,
    note: timer.start ? timer.note : metadata.note,
  };
}
export function complete(timer, config) {
  const cycles = timer.cycles + (timer.mode === "work" ? 1 : 0);
  const session =
    timer.mode === "work"
      ? {
          id: timer.id,
          start: timer.start,
          end: new Date(timer.deadline).toISOString(),
          minutes: timer.minutes,
          tag: timer.tag,
          note: timer.note,
        }
      : null;
  const next =
    timer.mode === "work" ? (cycles % 4 === 0 ? "long" : "short") : "work";
  return { session, next: fresh(config, next, cycles) };
}
