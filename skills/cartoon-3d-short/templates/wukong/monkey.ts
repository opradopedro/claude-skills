// Our own cartoon monkey (and the two gods) in the house style: bean head, plum ink, flat fills with a painted
// crescent, deadpan face library from toon.ts. Clearly an ANIMAL: brown fur, tan heart-shaped face mask, round
// ears, muzzle with nostrils, a long curled tail, tan hands and feet. Design space 600 x 1000, soles at y = 975.
import { Pen, INK, blobPts, headBlob, faceFront, Expr, mul, shade, bodyFront, Outfit } from "./toon";

type P2 = [number, number];
export type MPose = "crouch" | "stand" | "cheer" | "laugh" | "leap" | "sit";
export type MOpts = { pose: MPose; expr: Expr; lid?: number; fur?: string; crown?: boolean; cape?: boolean; look?: number; bob?: number; seed?: number; small?: boolean };

const FACE = "#f3cf9f";
const SH: [number, number, number] = [0.72, 0.68, 0.78];
const LIGHT = (-120 * Math.PI) / 180;

const limb = (p: Pen, pts: P2[], w: number, col: string) => p.line(pts, col, w);
/** quadratic bend a -> (near k) -> b */
const bend = (a: P2, k: P2, b: P2, n = 8): P2[] => {
  const c: P2 = [2 * k[0] - (a[0] + b[0]) / 2, 2 * k[1] - (a[1] + b[1]) / 2], out: P2[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, s = 1 - t; out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]); }
  return out;
};

export const drawMonkey = (p: Pen, o: MOpts) => {
  const fur = o.fur ?? "#9a5f2e", furD = mul(fur, SH), bob = o.bob ?? 0;
  const pose = o.pose;
  p.ol = 8;
  // body anchors (design units)
  const crouch = pose === "crouch" || pose === "sit";
  const hipY = (crouch ? 900 : pose === "leap" ? 700 : 770) - bob;
  const neckY = hipY - (crouch ? 175 : 190);
  const cx = 300;
  const hc = neckY - 105, ha = 112;
  // ---- tail (behind everything) ----
  const tail: P2[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, ang = -0.2 + t * 3.9;
    const r = 30 + 140 * (1 - t) ** 0.6;
    tail.push([cx + 70 + 150 * t + r * 0.45 * Math.sin(ang), hipY - 10 - 260 * t + r * 0.4 * Math.cos(ang) * t]);
  }
  limb(p, tail, 20, fur);
  // ---- legs ----
  const legW = 30;
  if (pose === "crouch") {
    for (const s of [-1, 1]) {
      limb(p, bend([cx + s * 40, hipY - 10], [cx + s * 110, hipY - 80], [cx + s * 70, 960]), legW, fur);
      p.ell(cx + s * 78, 962, 40, 17, FACE, 7);
    }
  } else if (pose === "sit") {
    for (const s of [-1, 1]) {
      limb(p, bend([cx + s * 45, hipY - 10], [cx + s * 120, hipY + 5], [cx + s * 95, 965]), legW, fur);
      p.ell(cx + s * 105, 965, 40, 17, FACE, 7);
    }
  } else if (pose === "leap") {
    for (const s of [-1, 1]) {
      limb(p, bend([cx + s * 40, hipY], [cx + s * 95, hipY + 60], [cx + s * 40 + 60, hipY + 150]), legW, fur);
      p.ell(cx + s * 40 + 70, hipY + 155, 40, 17, FACE, 7);
    }
  } else {
    for (const s of [-1, 1]) {
      limb(p, bend([cx + s * 42, hipY - 10], [cx + s * 78, hipY + 100], [cx + s * 66, 958]), legW, fur);
      p.ell(cx + s * 80, 962, 44, 17, FACE, 7);
    }
  }
  // ---- cape (behind the torso) ----
  if (o.cape) {
    const cape: P2[] = [[cx - 95, neckY + 10], [cx + 95, neckY + 10], [cx + 150, hipY + 70], [cx - 150, hipY + 70]];
    p.shadedFill(cape, "#c8342e", "#8e2230", LIGHT, 150);
    p.poly(cape, null, 8);
  }
  // ---- torso: pear, tan belly ----
  const torso = blobPts(cx, (neckY + hipY) / 2 + 8, { a: 92, b: (hipY - neckY) / 2 + 22, nTop: 2.1, nBot: 2.4, egg: 0.22, asym: 0, rot: 0, noise: 0.01, seed: (o.seed ?? 1) + 5 });
  p.shadedFill(torso, fur, furD, LIGHT, 100);
  p.inkRing(torso, 7, 13);
  p.ell(cx, (neckY + hipY) / 2 + 22, 54, (hipY - neckY) / 2 - 12, FACE, 0);
  // ---- arms ----
  const sh: P2[] = [[cx - 72, neckY + 40], [cx + 72, neckY + 40]];
  const hand = (x: number, y: number) => p.ell(x, y, 22, 20, FACE, 7);
  const armW = 26;
  if (pose === "cheer") {
    for (const s of [-1, 1]) { const h: P2 = [cx + s * 175, neckY - 220]; limb(p, bend(sh[s < 0 ? 0 : 1], [cx + s * 175, neckY - 30], h), armW, fur); hand(...h); }
  } else if (pose === "laugh") {
    const h1: P2 = [cx - 40, hipY - 70], h2: P2 = [cx + 210, neckY - 150];
    limb(p, bend(sh[0], [cx - 150, neckY + 120], h1), armW, fur); hand(...h1);
    limb(p, bend(sh[1], [cx + 190, neckY + 20], h2), armW, fur); hand(...h2);
  } else if (pose === "leap") {
    for (const s of [-1, 1]) { const h: P2 = [cx + 110 + s * 50, neckY - 170 + s * 30]; limb(p, bend(sh[s < 0 ? 0 : 1], [cx + s * 60 + 80, neckY - 40], h), armW, fur); hand(...h); }
  } else if (pose === "crouch") {
    for (const s of [-1, 1]) { const h: P2 = [cx + s * 40, hipY - 60]; limb(p, bend(sh[s < 0 ? 0 : 1], [cx + s * 150, neckY + 110], h), armW, fur); hand(...h); }
  } else if (pose === "sit") {
    for (const s of [-1, 1]) { const h: P2 = [cx + s * 150, hipY - 20]; limb(p, bend(sh[s < 0 ? 0 : 1], [cx + s * 150, neckY + 90], h), armW, fur); hand(...h); }
  } else {
    for (const s of [-1, 1]) { const h: P2 = [cx + s * 130, hipY + 30]; limb(p, bend(sh[s < 0 ? 0 : 1], [cx + s * 125, neckY + 120], h), armW, fur); hand(...h); }
  }
  // ---- ears (behind head) ----
  for (const s of [-1, 1]) {
    p.ell(cx + s * (ha + 8), hc + 4, 38, 42, fur, 8);
    p.ell(cx + s * (ha + 10), hc + 6, 21, 25, mul(FACE, [0.95, 0.85, 0.85]), 0);
  }
  // ---- head ----
  const H = headBlob(o.seed ?? 3, ha, 0);
  H.b = ha * 0.93; H.egg = -0.06;
  const hp = blobPts(cx, hc, H);
  p.shadedFill(hp, fur, furD, LIGHT, ha);
  // fur tuft on the crown
  const tuft: P2[] = [[cx - 30, hc - H.b + 16], [cx - 14, hc - H.b - 16], [cx - 2, hc - H.b + 6], [cx + 14, hc - H.b - 22], [cx + 30, hc - H.b + 16]];
  p.poly(tuft, fur, 8);
  p.inkRing(hp, 8, 15);
  // heart-shaped face mask: two eye lobes + muzzle
  const W = 2 * ha, u = W / 100;
  p.g.save();
  p.g.beginPath();
  p.g.ellipse(cx - 14 * u, hc - 2 * u, 22 * u, 21 * u, 0, 0, Math.PI * 2);
  p.g.ellipse(cx + 14 * u, hc - 2 * u, 22 * u, 21 * u, 0, 0, Math.PI * 2);
  p.g.ellipse(cx, hc + 21 * u, 30 * u, 19 * u, 0, 0, Math.PI * 2);
  p.g.fillStyle = FACE; p.g.fill("nonzero");
  p.g.restore();
  // nostrils
  p.dot(cx - 4 * u, hc + 12 * u, 1.9 * u); p.dot(cx + 4 * u, hc + 12 * u, 1.9 * u);
  faceFront(p, cx, hc - 2 * u, W, o.expr, 0, o.look ?? 0, o.lid ?? 0, false, FACE);
  // ---- crown ----
  if (o.crown) {
    const y0 = hc - H.b + 24, pts: P2[] = [[cx - 62, y0], [cx - 70, y0 - 70], [cx - 34, y0 - 34], [cx, y0 - 86], [cx + 34, y0 - 34], [cx + 70, y0 - 70], [cx + 62, y0]];
    p.shadedFill(pts, "#f2c23a", "#c8902a", LIGHT, 70);
    p.poly(pts, null, 7);
    p.ell(cx, y0 - 22, 11, 11, "#d8343a", 3);
  }
};

/** gods: robed, stout, white beard for the Jade Emperor */
export const EMPEROR: Outfit = { jacket: "#e0a72c", pants: "#b8402f", boots: "#3a2a3a", hat: "hair", hair: "#2a1d26", moustache: "#f4f1ea", buttons: "#c8342e", sash: "#c8342e", build: "stout" };
export const GENERAL: Outfit = { jacket: "#3f7fa8", pants: "#2c3e57", boots: "#2a2230", hat: "cap", cap: "#c8342e", belt: "#e8c45a", buttons: "#e8c45a" };
export const drawGod = (p: Pen, o: Outfit, expr: Expr, lid: number, seed: number, facing: -1 | 0 | 1 = 0) =>
  bodyFront(p, o, { mode: "stand", expr, blink: lid, seed, facing });

export const furTones = ["#9a5f2e", "#8a5530", "#a8693a", "#7d4c2a", "#b07443"];
export { INK, shade };
