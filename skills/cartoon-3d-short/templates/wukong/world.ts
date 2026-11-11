// Wukong test short: three places in one three.js scene, each its own group (only the shot's place is shown).
//  peak   : karst pillars over a sea of clouds, the summit with the stone egg, a cliff with a waterfall
//  cave   : the hidden kingdom behind the waterfall (rock bowl open to the sky, stone throne, peach trees, monkeys)
//  heaven : the Jade Palace on a cloud floor
// update(id, f, cam) poses everything for shot id at frame f (pure function of id + f).
import * as THREE from "three";
import { ctex, rng, rep, grassHD, cloudHD, CLOUD_DAY, CLOUD_GOLD } from "./paint";
import { Pen, fxBurst } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { cardShade, CARD_K } from "./cardshade";
import { drawMonkey, drawGod, EMPEROR, GENERAL, furTones, MOpts } from "./monkey";
import { FPS, SHOTS, ShotDef, camAt, W, EGG, FALL_X, HEAVEN_Y, CAVE, leapAt, clamp01, smooth, V3, T } from "./story";
import type { Expr } from "./toon";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
// ---------------- noise ----------------
const h3 = (x: number, y: number, z: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x: number, y: number, z: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t: number) => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => h3(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w) * 2 - 1;
};
const fbm = (x: number, y: number, z: number) => vnoise(x, y, z) * 0.6 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.12;
/** push every vertex along its (radial, horizontal) normal by noise; keeps the ink lines on real creases */
const rough = (g: THREE.BufferGeometry, amp: number, freq: number, seed: number, radial = true) => {
  const p = g.attributes.position as THREE.BufferAttribute, n = new THREE.Vector3();
  g.computeVertexNormals();
  const nn = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (radial) n.set(x, 0, z).normalize(); else n.set(nn.getX(i), nn.getY(i), nn.getZ(i));
    const d = amp * fbm(x * freq + seed, y * freq, z * freq - seed);
    p.setXYZ(i, x + n.x * d, y + n.y * d, z + n.z * d);
  }
  g.computeVertexNormals();
  return g;
};

// ---------------- painted textures ----------------
const blot = (g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, "0)"));
  g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
};
/** natural rock: warm grey with soft lighter/darker patches, faint strata and a few hairline cracks (never blocks) */
const rockTex = (key: string, base: string, light: string, dark: string) => ctex(key, 1024, 1024, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) {
    const x = r() * 1024, y = r() * 1024, rad = 60 + r() * 200;
    for (const [dx, dy] of [[0, 0], [1024, 0], [-1024, 0], [0, 1024], [0, -1024], [1024, 1024], [-1024, -1024], [1024, -1024], [-1024, 1024]]) blot(g, x + dx, y + dy, rad, r() > 0.5 ? light : dark);
  }
  g.lineCap = "round";
  for (let i = 0; i < 14; i++) { // strata
    const y0 = r() * 1024; g.strokeStyle = "rgba(60,50,60,0.10)"; g.lineWidth = 3 + r() * 5; g.beginPath();
    for (let x = -20; x <= 1044; x += 40) g.lineTo(x, y0 + 12 * Math.sin(x * 0.01 + i) + 6 * Math.sin(x * 0.037));
    g.stroke();
  }
  for (let i = 0; i < 26; i++) { // cracks
    let x = r() * 1024, y = r() * 1024; g.strokeStyle = "rgba(40,30,45,0.35)"; g.lineWidth = 2 + r() * 2; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 50; y += 10 + r() * 30; g.lineTo(x, y); }
    g.stroke();
  }
});
const ROCK = () => rockTex("rockA", "#a59a8c", "rgba(206,196,178,0.35)", "rgba(110,98,104,0.28)");
const EGGTEX = () => rockTex("eggS", "#c9c3b8", "rgba(236,230,218,0.45)", "rgba(150,140,140,0.25)");
const marble = () => ctex("marbleW", 512, 512, (g, r) => {
  g.fillStyle = "#efe8dc"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 30; i++) blot(g, r() * 512, r() * 512, 40 + r() * 90, r() > 0.5 ? "rgba(255,255,255,0.4)" : "rgba(200,190,180,0.25)");
  g.strokeStyle = "rgba(120,100,100,0.35)"; g.lineWidth = 3;
  for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  for (let y = 0; y < 512; y += 128) for (let x = (y / 128) % 2 ? 0 : 128; x < 512; x += 256) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 128); g.stroke(); }
});
const tiles = (col: string, dark: string) => ctex("tiles" + col, 512, 512, (g) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = dark; g.lineWidth = 10;
  for (let x = 16; x < 512; x += 42) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
});
const water = (bright: number) => ctex("waterfall" + bright, 256, 1024, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, "#7fc6d9"); gr.addColorStop(0.5, "#a9e0ec"); gr.addColorStop(1, "#7fc6d9");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 90; i++) {
    const x = r() * 256, y = r() * 1024, l = 80 + r() * 260, w = 2 + r() * 7;
    g.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * r() * bright})`;
    for (const dy of [0, -1024, 1024]) g.fillRect(x, y + dy, w, l);
  }
  for (let i = 0; i < 30; i++) { const x = r() * 256, y = r() * 1024; g.fillStyle = "rgba(60,130,160,0.25)"; for (const dy of [0, -1024, 1024]) g.fillRect(x, y + dy, 3, 120 + r() * 200); }
});
/** emissive crack lines on the egg (equirect uv), drawn up to progress k (0..1) */
const CRACKS: [number, number][][] = (() => {
  const r = rng(77), out: [number, number][][] = [];
  const main: [number, number][] = []; // ring round the egg a little above the middle
  for (let x = 0; x <= 1024; x += 32) main.push([x, 236 + (main.length % 2 ? 7 : -6) + (r() - 0.5) * 14]);
  out.push(main);
  for (let i = 0; i < 9; i++) { // branches up and down
    const s = main[2 + Math.floor(r() * (main.length - 4))], b: [number, number][] = [[s[0], s[1]]];
    const dir = r() > 0.5 ? 1 : -1;
    for (let k = 0; k < 5; k++) { const q = b[b.length - 1]; b.push([q[0] + (r() - 0.5) * 50, q[1] + dir * (14 + r() * 22)]); }
    out.push(b);
  }
  return out;
})();
const crackTex = (k: number, veins: number) => ctex(`crack_${k}_${veins}`, 1024, 512, (g) => {
  g.fillStyle = "#000"; g.fillRect(0, 0, 1024, 512);
  if (veins > 0) { // faint golden veins: the stone soaking up light
    g.strokeStyle = `rgba(255,200,90,${0.5 * veins})`; g.lineWidth = 3;
    for (const c of CRACKS.slice(1)) { g.beginPath(); c.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  }
  if (k <= 0) return;
  g.lineCap = "round"; g.lineJoin = "round";
  CRACKS.forEach((c, ci) => {
    const kk = ci === 0 ? clamp01(k * 1.6) : clamp01((k - 0.35) * 1.8);
    const n = Math.max(0, Math.floor(kk * (c.length - 1)));
    if (n < 1) return;
    for (const [w, col] of [[11, "rgba(255,170,40,0.55)"], [4, "#fff2b8"]] as const) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      if (ci === 0) { const mid = Math.floor((c.length - 1) / 2), lo = Math.max(0, mid - n), hi = Math.min(c.length - 1, mid + n); for (let i = lo; i <= hi; i++) (i === lo ? g.moveTo : g.lineTo).call(g, c[i][0], c[i][1]); }
      else c.slice(0, n + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
  });
});

// ---------------- materials ----------------
const mats = new Map<string, THREE.MeshLambertMaterial>();
const lam = (key: string, p: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(p())); mats.set(key, m); }
  return m;
};
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => {
  const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; return o;
};

// ---------------- character cards ----------------
const SU = 0.00216; // metres per design unit (1000 units = 2.16 m)
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const texCache = new Map<string, THREE.CanvasTexture>();
const cardTex = (key: string, k: number, draw: (p: Pen) => void, w = 600, h = 1000) => {
  const kk = `${k}|${key}`;
  let t = texCache.get(kk);
  if (t) { texCache.delete(kk); texCache.set(kk, t); } // LRU refresh
  if (!t) {
    while (texCache.size >= 40) { const [k0, t0] = texCache.entries().next().value!; texCache.delete(k0); t0.dispose(); }
    const cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const g = cv.getContext("2d")!; g.setTransform(k, 0, 0, k, 0, 0);
    draw(new Pen(g));
    t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    texCache.set(kk, t);
  }
  return t;
};
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
class Card {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial;
  constructor(parent: THREE.Object3D) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(BODY, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  show(t: THREE.Texture, x: number, y: number, z: number, s: number, cam: THREE.Vector3, roll = 0, mirror = false) {
    this.mat.map = t; this.dmat.map = t;
    this.mesh.position.set(x, y, z); this.mesh.scale.set(mirror ? -s : s, s, s);
    this.mesh.rotation.set(0, Math.atan2(cam.x - x, cam.z - z), roll);
    this.mesh.visible = true;
  }
}
/** unlit effect card (bursts, glows) */
class FxCard {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial;
  constructor(parent: THREE.Object3D, additive = false) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK); this.mesh.renderOrder = 3;
    parent.add(this.mesh);
  }
}
const glowTex = () => ctex("glowDot", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,230,160,0.8)"); gr.addColorStop(1, "rgba(255,180,60,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});

// ---------------- blinks ----------------
const LID = [0.5, 1, 1, 0.5];
const lidAt = (f: number, seed: number) => {
  let s = Math.round(10 + 40 * h3(seed, 1, 2));
  for (let n = 0; s <= f && n < 400; n++) { const k = f - s; if (k >= 0 && k < 4) return LID[k]; s += Math.round(18 + 50 * h3(seed, n, 7)); }
  return 0;
};

// ---------------- world ----------------
const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const SUN_SHOT: Record<number, { az?: number; el?: number }> = { 1: { az: 110, el: 40 }, 3: { az: 4, el: 6 }, 7: { az: 70, el: 42 }, 9: { az: 30, el: 72 }, 10: { az: 160, el: 70 }, 11: { az: 100, el: 24 } };

export class World {
  root = new THREE.Group();
  private peak = new THREE.Group(); private cave = new THREE.Group(); private heaven = new THREE.Group();
  private sun: THREE.DirectionalLight; private hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial; private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private clouds: { m: THREE.Mesh; i: number }[] = [];
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private egg: THREE.Mesh; private eggMat: THREE.MeshLambertMaterial; private shell = new THREE.Group();
  private falls: THREE.Texture[] = [];
  private beams: THREE.Mesh[] = []; private beamGlow: THREE.Mesh[] = [];
  private cards: Card[] = []; private fx: FxCard[] = [];
  private cloudFloor: THREE.Mesh; private seaMat: THREE.MeshBasicMaterial;

  constructor() {
    const R = this.root;
    R.add(this.peak, this.cave, this.heaven);
    this.cave.position.set(...CAVE); this.heaven.position.set(0, HEAVEN_Y, 0);
    // ---- sky + light ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunDisc.renderOrder = -0.5; this.sunDisc.layers.set(NOINK); this.sunDisc.frustumCulled = false; R.add(this.sunDisc);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.0);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, CLOUD_DAY)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, CLOUD_GOLD)) };

    const rockM = lam("rock", () => ({ map: rep(ROCK(), 3, 3) }));
    const rockBig = lam("rockBig", () => ({ map: rep(ROCK(), 6, 10) }));
    const grassM = lam("grass", () => ({ map: rep(grassHD(), 4, 4) }));
    const pineM = lam("pine", () => ({ color: "#3f7a4a" }));
    const barkM = lam("bark", () => ({ color: "#6b4a36" }));

    // ================= PEAK =================
    const P = this.peak;
    // summit pillar (top at y = 0, radius ~9), grass cap
    const sg = rough(new THREE.CylinderGeometry(8.6, 6.2, 70, 48, 24, true), 1.0, 0.18, 3);
    const summit = mesh(sg, rockBig); summit.position.y = -35.2; P.add(summit);
    const cap = mesh(rough(new THREE.CylinderGeometry(9.0, 8.7, 0.6, 48, 2), 0.35, 0.3, 9), grassM); cap.position.y = -0.3; P.add(cap);
    const ped = mesh(rough(new THREE.CylinderGeometry(1.25, 1.6, 0.35, 24, 2), 0.12, 1.2, 4), rockM); ped.position.y = 0.05; P.add(ped);
    // boulders on the summit
    for (const [x, z, r] of [[-4.5, -3.5, 0.8], [5.8, -2.0, 0.55], [-6.4, 3.0, 0.65], [6.0, -5.5, 0.9]] as const) {
      const b = mesh(rough(new THREE.IcosahedronGeometry(r, 2), r * 0.3, 1.5, x, false), rockM); b.position.set(x, r * 0.35, z); b.scale.y = 0.7; P.add(b);
    }
    // pines (flat layered, mountain style)
    const pine = (parent: THREE.Object3D, x: number, y: number, z: number, h: number) => {
      const t = mesh(new THREE.CylinderGeometry(0.06 * h, 0.1 * h, h * 0.8, 7), barkM); t.position.set(x, y + h * 0.4, z); parent.add(t);
      for (let i = 0; i < 3; i++) {
        const w = h * (0.55 - i * 0.13), c = mesh(new THREE.ConeGeometry(w, h * 0.22, 9), pineM);
        c.position.set(x + (i - 1) * 0.08 * h, y + h * (0.45 + i * 0.2), z); parent.add(c);
      }
    };
    pine(P, -6.0, 0, -6.5, 3.6); pine(P, -3.5, 0, -7.6, 3.0); pine(P, -7.2, 0, 1.0, 2.6);
    // karst pillars around (kept off the opening camera path)
    const r = rng(5);
    const pathA = V(-38, 22, 70), pathB = V(-6.5, 3.2, 11.5), seg = new THREE.Line3(pathA, pathB), tmp = new THREE.Vector3();
    let placed = 0;
    for (let i = 0; i < 120 && placed < 34; i++) {
      const a = r() * TAU, d = 28 + r() ** 0.7 * 240, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (x > 8 && x < 50 && Math.abs(z) < 30) continue; // waterfall cliff
      const A2 = new THREE.Vector2(pathA.x, pathA.z), B2 = new THREE.Vector2(pathB.x, pathB.z), P2 = new THREE.Vector2(x, z);
      const ab = B2.clone().sub(A2), tt = THREE.MathUtils.clamp(P2.clone().sub(A2).dot(ab) / ab.lengthSq(), 0, 1.6);
      if (A2.clone().addScaledVector(ab, tt).distanceTo(P2) < 34) continue;
      if (Math.hypot(x, z) < 60 && x < 0 && z > 0) continue;
      const top = -14 + r() * 26, rad = 5 + r() * 9, h = top + 60;
      const g = rough(new THREE.CylinderGeometry(rad * 0.85, rad * 1.1, h, 28, 14, true), rad * 0.18, 0.12, i);
      const m = mesh(g, rockBig, d < 90); m.position.set(x, top - h / 2, z); P.add(m);
      const c = mesh(rough(new THREE.SphereGeometry(rad * 0.9, 20, 10, 0, TAU, 0, Math.PI / 2), rad * 0.12, 0.25, i + 3, false), lam("moss", () => ({ color: "#5f9c4a" })), d < 90);
      c.scale.y = 0.35; c.position.set(x, top - 0.4, z); P.add(c);
      if (d < 140) for (let k = 0; k < 2; k++) pine(P, x + (r() - 0.5) * rad, top, z + (r() - 0.5) * rad, 2.5 + r() * 3);
      placed++;
    }
    // sea of clouds
    this.seaMat = new THREE.MeshBasicMaterial({ color: "#e9f0fa" });
    const sea = new THREE.Mesh(new THREE.CircleGeometry(1000, 48), this.seaMat); sea.rotation.x = -Math.PI / 2; sea.position.y = -16; sea.layers.set(NOINK); P.add(sea);
    for (let i = 0; i < 46; i++) {
      const a = r() * TAU, d = 14 + r() ** 0.8 * 320, w = 30 + r() * 70;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], transparent: true, depthWrite: false, color: new THREE.Color(1.05, 1.05, 1.05) }));
      m.position.set(Math.cos(a) * d, -15 + r() * 4 + w * 0.12, Math.sin(a) * d); m.scale.set(w, w / 2, 1); m.layers.set(NOINK); m.renderOrder = 2;
      this.clouds.push({ m, i }); P.add(m);
    }
    // cliff + waterfall: face plane through (FALL_X + .3, *, 1.6), normal (-.707, 0, .707)
    const cliff = new THREE.Group(); cliff.position.set(FALL_X + 0.6, 0, 1.6); cliff.rotation.y = -Math.PI / 4; P.add(cliff);
    const cg = rough(new THREE.BoxGeometry(34, 90, 16, 24, 40, 8), 1.2, 0.2, 11, false);
    const cm = mesh(cg, rockBig); cm.position.set(0, -26, -8.6); cliff.add(cm);
    const lip = mesh(rough(new THREE.BoxGeometry(34, 0.8, 16, 20, 1, 8), 0.3, 0.3, 2, false), grassM); lip.position.set(0, 19.2, -8.6); cliff.add(lip);
    pine(cliff, -9, 19.4, -6, 3.4); pine(cliff, 8, 19.4, -9, 4);
    for (let k = 0; k < 2; k++) {
      const t = water(1 + k).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); t.needsUpdate = true; this.falls.push(t);
      const wm = new THREE.MeshBasicMaterial({ map: t, transparent: k === 1, opacity: k ? 0.55 : 1, side: THREE.DoubleSide, depthWrite: k === 0 });
      const wf = new THREE.Mesh(new THREE.PlaneGeometry(7, 64), wm); wf.position.set(0, -12.4, 0.05 + k * 0.25); wf.layers.set(NOINK); cliff.add(wf);
    }
    // mist at the foot is the cloud sea itself; spray cloud at the lip
    // ---- stone egg + shell ----
    const eg = new THREE.SphereGeometry(1, 96, 64);
    this.eggMat = twoTone(new THREE.MeshLambertMaterial({ map: rep(EGGTEX(), 2, 1), emissive: new THREE.Color("#ffb23c"), emissiveMap: crackTex(0, 0), emissiveIntensity: 0 }));
    this.egg = mesh(eg, this.eggMat); this.egg.scale.set(0.8, 1.0, 0.8); this.egg.position.set(EGG[0], 0.97, EGG[2]); P.add(this.egg);
    const jag = (g: THREE.SphereGeometry, cut: number) => {
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.acos(clamp01((y + 1) / 2) * 2 - 1);
        if (Math.abs(th - cut) < 0.02) { const ph = Math.atan2(z, x); p.setY(i, y + 0.07 * (Math.abs(((ph * 8) / Math.PI) % 2 - 1) - 0.5)); }
      }
      g.computeVertexNormals(); return g;
    };
    const inner = lam("eggIn", () => ({ color: "#7d766f", side: THREE.BackSide }));
    const outer = lam("eggOut", () => ({ map: rep(EGGTEX(), 2, 1) }));
    const cut = Math.PI * 0.62;
    const bot = jag(new THREE.SphereGeometry(1, 64, 40, 0, TAU, cut, Math.PI - cut), cut);
    const botO = mesh(bot, outer), botI = mesh(bot, inner); for (const m of [botO, botI]) { m.scale.set(0.8, 1, 0.8); m.position.set(0, 0.97, 0); this.shell.add(m); }
    const top = jag(new THREE.SphereGeometry(1, 64, 40, 0, TAU, 0, cut), cut);
    const capG = new THREE.Group(); capG.add(mesh(top, outer), mesh(top, inner)); capG.scale.set(0.8, 1, 0.8);
    capG.position.set(-1.5, 0.42, 0.9); capG.rotation.set(0.3, 0.5, 1.75); this.shell.add(capG);
    for (let i = 0; i < 7; i++) { // chips on the ground
      const c = mesh(new THREE.TetrahedronGeometry(0.08 + 0.06 * h3(i, 2, 3), 0), outer); c.position.set(Math.cos(i * 2.1) * (0.9 + 0.5 * h3(i, 1, 1)), 0.05, Math.sin(i * 2.1) * (0.9 + 0.5 * h3(i, 4, 1))); this.shell.add(c);
    }
    P.add(this.shell);
    // ---- beams from the eyes ----
    for (let k = 0; k < 2; k++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 1.2), fog: false }));
      b.layers.set(NOINK); b.visible = false; R.add(b); this.beams.push(b);
      const gl = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.8, 0.25), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      gl.layers.set(NOINK); gl.visible = false; R.add(gl); this.beamGlow.push(gl);
    }

    // ================= CAVE (hidden kingdom) =================
    const Cv = this.cave;
    const floor = mesh(rough(new THREE.CircleGeometry(21, 64), 0.0, 0.2, 1), lam("caveFloor", () => ({ map: rep(ROCK(), 5, 5), color: "#d6c9b0" })));
    floor.rotation.x = -Math.PI / 2; Cv.add(floor);
    const grassPatch = mesh(new THREE.CircleGeometry(6, 40), grassM); grassPatch.rotation.x = -Math.PI / 2; grassPatch.position.set(0, 0.02, -2); Cv.add(grassPatch);
    const gap = 0.75;
    const dome = mesh(rough(new THREE.SphereGeometry(20, 64, 32, Math.PI / 2 + gap, TAU - 2 * gap, Math.PI * 0.2, Math.PI * 0.3), 1.6, 0.18, 21, false), lam("caveWall", () => ({ map: rep(ROCK(), 8, 4), side: THREE.DoubleSide })));
    Cv.add(dome);
    // the curtain of water closing the gap (seen from inside, lit from behind)
    const ct = water(2).clone(); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(5, 1.2); ct.needsUpdate = true; this.falls.push(ct);
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), new THREE.MeshBasicMaterial({ map: ct, side: THREE.DoubleSide, color: new THREE.Color(1.15, 1.15, 1.15) }));
    curtain.position.set(0, 10, 16.4); curtain.layers.set(NOINK); Cv.add(curtain);
    // stone throne
    const thr = new THREE.Group(); thr.position.set(0, 0, -8); Cv.add(thr);
    const blk = (w: number, h: number, d: number, x: number, y: number, z: number, s: number) => { const m = mesh(rough(new THREE.BoxGeometry(w, h, d, 6, 6, 6), 0.08, 1.4, s, false), rockM); m.position.set(x, y, z); thr.add(m); };
    blk(4.4, 0.6, 3.2, 0, 0.3, 0, 1); blk(3.4, 0.6, 2.6, 0, 0.9, -0.2, 2); blk(3.0, 2.6, 0.7, 0, 2.2, -1.2, 3); blk(0.7, 1.0, 2.2, -1.5, 1.6, -0.2, 4); blk(0.7, 1.0, 2.2, 1.5, 1.6, -0.2, 5);
    // peach trees
    const leaf = lam("leaf", () => ({ color: "#5aa34a" })), peach = lam("peach", () => ({ color: "#f39a86" }));
    for (const [x, z, s] of [[-8, -6, 1.2], [8.5, -5, 1.1], [-11, 4, 1.0], [11, 5, 1.2]] as const) {
      const t = mesh(new THREE.CylinderGeometry(0.18 * s, 0.3 * s, 3 * s, 8), barkM); t.position.set(x, 1.5 * s, z); Cv.add(t);
      const c = mesh(rough(new THREE.IcosahedronGeometry(2.2 * s, 2), 0.35 * s, 0.8, x, false), leaf); c.position.set(x, 3.6 * s, z); c.scale.y = 0.8; Cv.add(c);
      for (let i = 0; i < 9; i++) { const a = i * 2.4, e = 0.4 + 0.5 * h3(i, x, z); const p = mesh(new THREE.SphereGeometry(0.2 * s, 10, 8), peach, false);
        p.position.set(x + Math.cos(a) * 2.1 * s * Math.cos(e), 3.6 * s + 1.7 * s * Math.sin(e) - 0.4, z + Math.sin(a) * 2.1 * s * Math.cos(e)); Cv.add(p); }
    }
    for (let i = 0; i < 10; i++) { // boulders round the edge
      const a = Math.PI / 2 + gap + 0.2 + (i / 10) * (TAU - 2 * gap - 0.4), d = 15 + 2 * h3(i, 3, 3);
      const b = mesh(rough(new THREE.IcosahedronGeometry(1.2 + h3(i, 1, 9), 2), 0.35, 1.2, i, false), rockM); b.position.set(-Math.cos(a) * d, 0.4, Math.sin(a) * d); Cv.add(b);
    }

    // ================= HEAVEN =================
    const Hv = this.heaven;
    this.cloudFloor = new THREE.Mesh(new THREE.CircleGeometry(600, 48), new THREE.MeshBasicMaterial({ color: "#fbf6f0" }));
    this.cloudFloor.rotation.x = -Math.PI / 2; this.cloudFloor.layers.set(NOINK); Hv.add(this.cloudFloor);
    for (let i = 0; i < 40; i++) {
      const a = r() * TAU, d = 12 + r() ** 0.7 * 260, w = 18 + r() * 50;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], transparent: true, depthWrite: false }));
      if (Math.abs(Math.cos(a) * d) < 11 && Math.sin(a) * d > -10 && Math.sin(a) * d < 40) continue; // keep the palace front clear
      m.position.set(Math.cos(a) * d, w * 0.1 - 1.5, Math.sin(a) * d); m.scale.set(w, w / 2, 1); m.layers.set(NOINK); m.renderOrder = 2;
      this.clouds.push({ m, i }); Hv.add(m);
    }
    const mar = lam("marble", () => ({ map: rep(marble(), 4, 1) }));
    const red = lam("red", () => ({ color: "#c2392f" })), gold = lam("gold", () => ({ color: "#e6b43a" }));
    const jade = lam("jade", () => ({ map: rep(tiles("#2f9a74", "#1f6e52"), 8, 2) }));
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => { const o = mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); Hv.add(o); return o; };
    box(20, 1.2, 14, 0, 0.6, -2, mar);
    for (let i = 0; i < 4; i++) box(8 - i * 0.6, 0.3, 1.0, 0, 0.15 + i * 0.3, 5.5 - i * 0.5 + 1.5, mar);
    box(14, 4.8, 6, 0, 3.6, -3.5, lam("wall", () => ({ color: "#e9d9b8" })));
    box(2.4, 3.2, 0.2, 0, 2.8, -0.45, lam("door", () => ({ color: "#8e2a2a" })));
    for (const x of [-6.5, -4, -1.6, 1.6, 4, 6.5]) {
      const c = mesh(new THREE.CylinderGeometry(0.32, 0.36, 5.0, 16), red); c.position.set(x, 3.7, 0.9); Hv.add(c);
      const cb = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 16), gold); cb.position.set(x, 1.32, 0.9); Hv.add(cb);
    }
    box(15.6, 0.5, 0.6, 0, 6.3, 0.9, red); box(15.6, 0.25, 0.65, 0, 6.0, 0.9, gold);
    const roof = (w: number, d: number, h: number, y: number, z: number) => {
      const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); g.rotateY(Math.PI / 4);
      const m = mesh(g, jade); m.scale.set(w, h, d); m.position.set(0, y + h / 2, z); Hv.add(m);
      const ridge = mesh(new THREE.BoxGeometry(w * 0.3, 0.22, 0.22), gold); ridge.position.set(0, y + h - 0.05, z); Hv.add(ridge);
    };
    roof(19, 10, 2.6, 6.5, -1.5); box(10, 1.8, 5, 0, 9.6, -2, lam("wall", () => ({ color: "#e9d9b8" }))); roof(13, 7, 2.2, 10.4, -2);
    // gold pearls on the ridge ends
    for (const x of [-2.8, 2.8]) { const p = mesh(new THREE.SphereGeometry(0.35, 16, 10), gold); p.position.set(x, 12.7, -2); Hv.add(p); }
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private card(i: number) { while (this.cards.length <= i) this.cards.push(new Card(this.root)); return this.cards[i]; }
  private fxc(i: number, add = false) { while (this.fx.length <= i) this.fx.push(new FxCard(this.root, add)); return this.fx[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    this.peak.visible = s.place === "peak"; this.cave.visible = s.place === "cave"; this.heaven.visible = s.place === "heaven";
    // ---- light rig ----
    const sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.2 + 6, 10, s.place === "cave" ? 26 : 60);
    const fcs = id === 1 ? V(0, 0, 0) : focus;
    this.sun.position.copy(fcs).addScaledVector(sunDir, 200); this.sun.target.position.copy(fcs);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 420; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((hx, i) => untone(hx, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color);
    this.fog.near = s.place === "heaven" ? 40 : s.place === "cave" ? 60 : 70;
    this.fog.far = s.place === "heaven" ? 420 : s.place === "cave" ? 400 : 560;
    scene.fog = this.fog; scene.background = null;
    untone(s.light === "golden" ? "#f6c8a0" : "#e8eef8", this.seaMat.color);
    untone(s.light === "golden" ? "#ffd9b8" : "#fbf7f2", (this.cloudFloor.material as THREE.MeshBasicMaterial).color);
    this.sunDisc.visible = s.light === "golden";
    if (this.sunDisc.visible) { this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900); this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(2.2))); }
    for (const { m, i } of this.clouds) {
      m.lookAt(cam.position.x, m.position.y + (m.parent?.position.y ?? 0) , cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[s.light][i % 4];
    }
    for (const tx of this.falls) tx.offset.y = t * 1.6;
    // ---- egg ----
    const opened = id >= 5 || (id === 4 && f >= T(W.open));
    this.egg.visible = !opened; this.shell.visible = opened && s.place === "peak";
    let ck = 0, veins = 0, glow = 0;
    if (id === 3) { veins = Math.round(4 * smooth((t - W.moonlight + 0.6) / 1.2)) / 4; glow = 0.4 * veins; }
    if (id === 4) { veins = 1; ck = Math.round(24 * clamp01((t - 12.85) / (W.open - 12.85))) / 24; glow = 0.5 + 3.5 * ck; }
    this.eggMat.emissiveMap = crackTex(ck, veins); this.eggMat.emissiveIntensity = glow;
    // ---- cast ----
    for (const cd of this.cards) cd.mesh.visible = false;
    for (const fx of this.fx) fx.mesh.visible = false;
    for (const b of [...this.beams, ...this.beamGlow]) b.visible = false;
    let ci = 0, fi = 0;
    const camP = cam.position;
    const tierK = (x: number, y: number, z: number) => { const d = camP.distanceTo(tmpV.set(x, y + 0.7, z)); return d < 2.4 ? 4 : d < 5 ? 2.5 : d < 12 ? 1.2 : 0.6; };
    const monkey = (o: MOpts, x: number, y: number, z: number, sc2: number, roll = 0, mirror = false) => {
      const k = tierK(x, y, z), key = "m" + JSON.stringify(o);
      this.card(ci++).show(cardTex(key, k, (p) => drawMonkey(p, o)), x, y, z, sc2, camP, roll, mirror);
    };
    const god = (o: typeof EMPEROR, expr: Expr, lid: number, seed: number, x: number, y: number, z: number) => {
      const k = tierK(x, y, z);
      this.card(ci++).show(cardTex(`g${seed}${expr}${lid}`, k, (p) => drawGod(p, o, expr, lid, seed)), x, y + HEAVEN_Y, z, 1, camP);
    };
    const burst = (x: number, y: number, z: number, size: number, u: number, col = "#fff3b0") => {
      if (u <= 0 || u >= 1) return;
      const q = Math.round(u * 12) / 12, fc = this.fxc(fi++);
      fc.mat.map = cardTex(`burst${q}${col}`, 1, (p) => fxBurst(p, q, col), 500, 500); fc.mat.opacity = 1; fc.mat.blending = THREE.NormalBlending;
      fc.mesh.position.set(x, y, z); fc.mesh.quaternion.copy(cam.quaternion); fc.mesh.scale.set(size, size, 1); fc.mesh.visible = true;
    };
    const glowAt = (x: number, y: number, z: number, size: number, op: number) => {
      const fc = this.fxc(fi++); fc.mat.map = glowTex(); fc.mat.opacity = op; fc.mat.blending = THREE.AdditiveBlending;
      fc.mesh.position.set(x, y, z); fc.mesh.quaternion.copy(cam.quaternion); fc.mesh.scale.set(size, size, 1); fc.mesh.visible = true;
    };
    const MS = 0.6, MY = 0.42; // monkey card scale (1.3 m) and standing height inside the bottom shell
    const eyeY = MY + (975 - 473) * SU * MS, eyeDX = 29 * SU * MS;
    if (id === 4) burst(0, 1.1, 0.9, 2.6, (t - W.open) / 0.5);
    if (id === 5) {
      const up = smooth((t - 14.45) / 0.9);
      monkey({ pose: up < 0.5 ? "crouch" : "stand", expr: "neutral", lid: 1, seed: 3 }, 0, MY - 0.25 * (1 - up), 0, MS);
    }
    if (id === 6) {
      const open = t >= W.opened - 0.07, wide = t >= W.eyes;
      monkey({ pose: "stand", expr: wide ? "shock" : "neutral", lid: open ? (wide ? 0 : 0.5) : 1, seed: 3 }, 0, MY, 0, MS);
      const g = clamp01((t - W.beams + 0.1) / 0.45);
      if (g > 0) {
        const dir = V(0, 1, -0.12).normalize(), len = 4 + 600 * g ** 2;
        for (let k = 0; k < 2; k++) {
          const ex = (k ? 1 : -1) * eyeDX, o = V(ex, eyeY, 0.02);
          for (const [m, rad] of [[this.beams[k], 0.022], [this.beamGlow[k], 0.07]] as const) {
            m.visible = true; m.position.copy(o); m.quaternion.setFromUnitVectors(V(0, 1, 0), dir); m.scale.set(rad * (1 + 2 * g), len, rad * (1 + 2 * g));
          }
          glowAt(o.x, o.y, o.z + 0.03, 0.35 + 0.1 * Math.sin(t * 20), 0.9);
        }
      }
    }
    if (id === 7) {
      for (let k = 0; k < 2; k++) { // beams arriving through the cloud floor
        const x = -4.6 + k * 0.8, z = 8.5;
        for (const [m, rad] of [[this.beams[k], 0.35], [this.beamGlow[k], 1.1]] as const) { m.visible = true; m.position.set(x, HEAVEN_Y - 50, z); m.quaternion.identity(); m.scale.set(rad, 600, rad); }
        burst(x, HEAVEN_Y + 0.6, z, 5, ((t - 21.6) % 0.9) / 0.9);
      }
      const fr = t >= W.froze - 0.07;
      god(EMPEROR, fr ? "shock" : "stern", fr ? 0 : lidAt(f, 2), 2, -0.9, 1.2, 4.8);
      god(GENERAL, fr ? "shock" : "neutral", fr ? 0 : lidAt(f, 5), 5, 0.9, 1.2, 4.6);
    }
    if (id === 11) {
      god(EMPEROR, "smile", lidAt(f, 2), 2, -0.9, 1.2, 4.8);
      god(GENERAL, t > W.idea ? "grin" : "smile", lidAt(f, 5), 5, 0.9, 1.2, 4.6);
    }
    if (id === 8) {
      if (t < 26.9) monkey({ pose: "laugh", expr: t >= W.laughed - 0.07 ? "laugh" : "grin", lid: 0, seed: 3, bob: t >= W.laughed ? 4 * Math.round(3 * Math.abs(Math.sin((t - W.laughed) * 9))) : 0 }, 0.2, 0, 1.25, MS);
      else {
        const lp = leapAt(t);
        if (lp.p[0] < FALL_X + 0.6) monkey({ pose: lp.u < 0.05 ? "stand" : "leap", expr: "grin", lid: 0, seed: 3 }, lp.p[0], lp.p[1], lp.p[2], MS, lp.roll);
        if (lp.u > 0.82) burst(FALL_X + 0.9, 3.0, 1.4, 3.2, (lp.u - 0.82) / 0.18, "#e9fbff");
      }
    }
    if (id === 9 || id === 10) {
      const C = CAVE;
      const king = id === 10;
      monkey({ pose: "sit", expr: king && t > W.king - 0.07 ? "grin" : "smile", lid: lidAt(f, 3), seed: 3, crown: king && t > W.king - 0.07, cape: king }, C[0], C[1] + 1.2, C[2] - 8.1, MS);
      if (king && t > W.king - 0.07) glowAt(C[0], C[1] + 2.05, C[2] - 7.7, 1.1 * (1 - 0.6 * smooth((t - W.king) / 0.8)), 0.8);
      const spots: [number, number, number][] = [[-3.0, -5.0, 0.56], [3.0, -5.2, 0.55], [-4.6, -2.2, 0.58], [4.4, -2.0, 0.57], [-2.0, 0.6, 0.55], [2.3, 1.0, 0.56], [-6.4, -5.8, 0.52], [6.6, -6.2, 0.54], [0.3, 2.8, 0.53]];
      spots.forEach(([x, z, sc2], i) => {
        const cheer = id === 10 || t > W.kingdom + 0.2 * (i % 3);
        const bob = cheer ? 10 * Math.round(3 * Math.abs(Math.sin(t * 6 + i))) : 0;
        monkey({ pose: cheer ? "cheer" : "stand", expr: cheer ? (i % 2 ? "laugh" : "grin") : "smile", lid: cheer ? 0 : lidAt(f, 10 + i), fur: furTones[i % 5], seed: 10 + i, bob }, C[0] + x, C[1], C[2] + z, sc2, 0, i % 2 === 1);
      });
    }
    return focus;
  }
}
const tmpV = new THREE.Vector3();
