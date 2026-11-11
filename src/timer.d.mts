export type Timer = {
  mode: "work" | "short" | "long";
  minutes: number;
  remaining: number;
  deadline: number | null;
  start: string;
  id: string;
  tag: string;
  note: string;
  cycles: number;
};
export type Config = {
  vault: string;
  logs: string;
  work: number;
  rest: number;
  long: number;
  sound: boolean;
};
export type Session = {
  id: string;
  start: string;
  end: string;
  minutes: number;
  tag: string;
  note: string;
};
export function fresh(c: Config, mode?: Timer["mode"], cycles?: number): Timer;
export function seconds(t: Timer, now: number): number;
export function toggle(
  t: Timer,
  now: number,
  meta: { id: string; tag: string; note: string },
): Timer;
export function complete(
  t: Timer,
  c: Config,
): { session: Session | null; next: Timer };
