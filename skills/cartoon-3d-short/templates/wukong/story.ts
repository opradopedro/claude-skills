// Wukong test short: shot table, cameras and lens blur, all timed to voice/words.json (forced alignment).
export const FPS = 30;
export const TOTAL = 1146; // 38.2 s = voice length; nothing plays after the narration
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const F = (s: number) => Math.round(s * FPS);

// word onsets used by the picture (seconds, words.json)
export const W = {
  stone: 3.32, ordinary: 5.14, moonlight: 9.55, cracked: 13.01, open: 13.45, monkey: 15.21, opened: 16.73, eyes: 17.21,
  beams: 18.15, shot: 19.58, heaven: 20.56, jade: 21.88, froze: 23.62, laughed: 26.06, leapt: 26.92, waterfall: 28.56,
  hidden: 29.84, kingdom: 30.14, monkeyKing: 33.03, king: 33.35, born: 33.75, heaven2: 35.13, idea: 36.61, coming: 37.75,
};

export type Light = "day" | "golden";
export type Place = "peak" | "cave" | "heaven";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(4.75), light: "day", place: "peak" },
  { id: 2, a: F(4.75), b: F(6.65), light: "day", place: "peak" },
  { id: 3, a: F(6.65), b: F(10.7), light: "golden", place: "peak" },
  { id: 4, a: F(10.7), b: F(14.4), light: "day", place: "peak" },
  { id: 5, a: F(14.4), b: F(16.5), light: "day", place: "peak" },
  { id: 6, a: F(16.5), b: F(21.6), light: "day", place: "peak" },
  { id: 7, a: F(21.6), b: F(25.1), light: "day", place: "heaven" },
  { id: 8, a: F(25.1), b: F(29.35), light: "day", place: "peak" },
  { id: 9, a: F(29.35), b: F(31.6), light: "day", place: "cave" },
  { id: 10, a: F(31.6), b: F(34.85), light: "day", place: "cave" },
  { id: 11, a: F(34.85), b: TOTAL, light: "golden", place: "heaven" },
];
/** crossfade length (frames) INTO a shot */
export const XFADE: Record<number, number> = { 3: 10, 4: 10, 11: 10 };
export const FLASH_AT = F(14.4) - 4; // white flash hides the cut from the cracking stone to the monkey
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  const s = shotAt(f), x = XFADE[s.id];
  if (x && f < s.a + x && s.id > 1) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: smooth((f - s.a + 1) / x) }];
  return [{ id: s.id, alpha: 1 }];
};

// ---------------- world anchors ----------------
export const EGG: V3 = [0, 0, 0];          // stone egg on the summit (ground y = 0)
export const FALL_X = 15;                  // waterfall sheet plane (x), summit edge at x ~ 9
export const HEAVEN_Y = 420;               // heaven floor height
export const CAVE: V3 = [0, -260, 0];      // hidden kingdom origin (far below the cloud sea, own lighting)
/** monkey leap: summit edge -> through the waterfall */
export const leapAt = (t: number): { p: V3; roll: number; u: number } => {
  const u = clamp01((t - 26.95) / 1.75);
  const x = 3.2 + (FALL_X + 1.5 - 3.2) * u, y = 0 + 5.2 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (1 - 0.25 * u) - 1.2 * u * u;
  return { p: [x, y, 1.6], roll: -0.5 * Math.sin(Math.PI * u), u };
};

// ---------------- cameras ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Key = { f: number; pos: V3; look: V3; fov?: number; roll?: number };
const L = (a: number, b: number, u: number) => a + (b - a) * u;
const L3 = (a: V3, b: V3, u: number): V3 => [L(a[0], b[0], u), L(a[1], b[1], u), L(a[2], b[2], u)];
const H = HEAVEN_Y, C = CAVE;
const KEYS: Record<number, Key[]> = {
  1: [ // aerial over the cloud sea gliding in to the summit stone
    { f: 0, pos: [-38, 22, 70], look: [0, -2, 0], fov: 42 },
    { f: F(4.75), pos: [-6.5, 3.2, 11.5], look: [0, 0.9, 0], fov: 38, roll: 0.02 },
  ],
  2: [{ f: F(4.75), pos: [2.8, 1.4, 4.6], look: [0, 1.0, 0], fov: 34 }, { f: F(6.65), pos: [2.1, 1.3, 3.5], look: [0, 1.0, 0], fov: 33 }],
  3: [ // time passing: slow orbit, sun low behind the stone
    { f: F(6.65), pos: [-2.2, 1.5, -6.2], look: [0, 1.15, 0], fov: 36 },
    { f: F(10.7), pos: [1.6, 1.3, -6.0], look: [0, 1.1, 0], fov: 34 },
  ],
  4: [{ f: F(10.7), pos: [0.6, 1.25, 4.4], look: [0, 1.0, 0], fov: 34 }, { f: F(13.3), pos: [0.4, 1.15, 3.2], look: [0, 1.0, 0], fov: 33 },
    { f: F(14.4), pos: [0.3, 1.1, 2.7], look: [0, 1.0, 0], fov: 34 }],
  5: [{ f: F(14.4), pos: [-0.8, 0.55, 4.2], look: [0, 0.95, 0], fov: 36, roll: -0.03 }, { f: F(16.5), pos: [-0.5, 0.75, 3.1], look: [0, 1.0, 0], fov: 35, roll: -0.03 }],
  6: [ // face close-up, eyes open, beams fire, tilt up the beams to the sky
    { f: F(16.5), pos: [0.15, 1.12, 1.75], look: [0, 1.06, 0], fov: 32 },
    { f: F(18.0), pos: [0.12, 1.1, 1.45], look: [0, 1.06, 0], fov: 32 },
    { f: F(19.5), pos: [2.0, 1.4, 5.0], look: [0, 6.0, -0.6], fov: 48 },
    { f: F(21.6), pos: [2.6, 1.8, 6.5], look: [0, 40, -5], fov: 52 },
  ],
  7: [ // the Jade Palace on its clouds; the beams punch through the floor
    { f: F(21.6), pos: [10, H + 3.5, 26], look: [0, H + 4, 0], fov: 42 },
    { f: F(23.4), pos: [5, H + 2.4, 13], look: [0, H + 2.3, 2], fov: 38 },
    { f: F(25.1), pos: [4, H + 2.0, 9.5], look: [0, H + 1.7, 3], fov: 36 },
  ],
  8: [ // laugh on the summit, then side-on leap through the waterfall
    { f: F(25.1), pos: [2.4, 1.05, 5.4], look: [0.2, 0.8, 1.25], fov: 34 },
    { f: F(26.6), pos: [2.1, 1.0, 4.6], look: [0.2, 0.8, 1.25], fov: 34, roll: 0.02 },
    { f: F(26.9), pos: [3.5, 3.4, 11.5], look: [9.5, 2.6, 1.6], fov: 46 },
    { f: F(29.35), pos: [7.0, 3.2, 10.5], look: [14.5, 2.2, 1.6], fov: 46 },
  ],
  9: [ // inside: the hidden kingdom revealed
    { f: F(29.35), pos: [C[0] + 0, C[1] + 2.0, C[2] + 17.4], look: [C[0], C[1] + 2.0, C[2]], fov: 46 },
    { f: F(31.6), pos: [C[0] - 2, C[1] + 2.6, C[2] + 7.5], look: [C[0], C[1] + 1.6, C[2] - 5], fov: 40 },
  ],
  10: [ // the Monkey King on his stone throne
    { f: F(31.6), pos: [C[0] + 0.4, C[1] + 1.9, C[2] - 1.0], look: [C[0], C[1] + 1.6, C[2] - 8], fov: 38 },
    { f: F(34.85), pos: [C[0] + 0.2, C[1] + 1.85, C[2] - 4.4], look: [C[0], C[1] + 1.65, C[2] - 8], fov: 36 },
  ],
  11: [ // heaven at sunset, unaware
    { f: F(34.85), pos: [-14, H + 6, 30], look: [0, H + 4, 0], fov: 40 },
    { f: TOTAL, pos: [-6, H + 3.2, 15], look: [0, H + 3, 0], fov: 38 },
  ],
};
/** smootherstep between neighbouring keys (every move is a glide; holds still push in) */
export const camAt = (id: number, f: number): Cam => {
  const ks = KEYS[id];
  let i = 0;
  while (i < ks.length - 2 && f >= ks[i + 1].f) i++;
  const a = ks[i], b = ks[Math.min(i + 1, ks.length - 1)];
  const u = b.f === a.f ? 0 : glide((f - a.f) / (b.f - a.f));
  let pos = L3(a.pos, b.pos, u), look = L3(a.look, b.look, u);
  let roll = L(a.roll ?? 0, b.roll ?? 0, u);
  const fov = L(a.fov ?? 40, b.fov ?? 40, u);
  if (id === 8 && f >= F(26.9)) { // track the leap side-on, waterfall ahead
    const lp = leapAt(f / FPS).p;
    pos = [lp[0] - 2.4, 1.6 + 0.55 * lp[1], lp[2] + 6.2]; look = [lp[0] + 1.4, 1.2 + 0.6 * lp[1], lp[2]];
  }
  // one impact kick when the stone splits: flips sign every frame, gone in 6 frames
  const k = f - F(W.open);
  if (id === 4 && k >= 0 && k < 6) { const s = (k % 2 ? -1 : 1) * 0.06 * (1 - k / 6); pos = [pos[0] + s * 0.4, pos[1] + s * 0.25, pos[2]]; roll += s * 0.3; }
  return { pos, look, fov, roll };
};

// ---------------- lens blur (px at 1080 wide) ----------------
export const dofAt = (f: number): { cInf: number } => {
  const s = shotAt(f);
  const m: Record<number, number> = { 1: 0, 2: 12, 3: 9, 4: 13, 5: 11, 6: 13, 7: 6, 8: 9, 9: 0, 10: 10, 11: 0 };
  let c = m[s.id];
  if (s.id === 6 && f > F(19.4)) c = 0;
  if (s.id === 8 && f > F(26.9)) c = 0;
  return { cInf: c };
};
export const T = F;
