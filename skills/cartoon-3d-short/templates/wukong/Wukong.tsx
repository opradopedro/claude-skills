// Wukong test short: the bridge short's post chain (ink -> lens blur -> bloom -> neutral tone map -> grade) on our own
// world, plus word-synced captions (each word appears 1 frame before the voice says it).
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { TOTAL, FLASH_AT, SHOTS, layersAt, dofAt, FPS } from "./story";
import WORDS from "./words.json";

export const WUKONG_FRAMES = TOTAL;
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass, setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
const fwd = new THREE.Vector3();
const Inner: React.FC<{ id: number }> = ({ id }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(), []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);
  // no dispose on unmount: the composer already releases its passes (calling it twice threw at the crossfades)
  const post = useMemo(() => (
    <EffectComposer multisampling={4}>
      <primitive object={fx.ink} dispose={null} />
      <primitive object={fx.lens.pre} dispose={null} />
      <primitive object={fx.lens.main} dispose={null} />
      <primitive object={fx.bloom} dispose={null} />
      <primitive object={fx.tone} dispose={null} />
      <primitive object={fx.grade} dispose={null} />
    </EffectComposer>
  ), [fx]);
  const cam = camera as THREE.PerspectiveCamera;
  const target = world.update(id, f, cam, scene);
  noInkFallback(world.root);
  cam.getWorldDirection(fwd);
  fx.lens.focus = Math.max(0.3, target.clone().sub(cam.position).dot(fwd));
  fx.lens.cInf = dofAt(f).cInf;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  return (<><primitive object={world.root} dispose={null} />{post}</>);
};
const dpr = () => (getInputProps() as { dpr?: number }).dpr;
const ShotView: React.FC<{ id: number; alpha: number }> = ({ id, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} {...(dpr() ? { dpr: dpr() } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.1, far: 1500 }}>
      <Inner id={id} />
    </ThreeCanvas>
  </AbsoluteFill>
);

// ---------------- captions ----------------
type Wd = { w: string; s: number; e: number };
const KEY = /^(stone|monkey|golden|heaven|gods|froze|waterfall|kingdom|king|jade|palace|cracked|laughed|beams)$/i;
const LEAD = 1 / FPS;
const chunks = (() => {
  const out: Wd[][] = []; let cur: Wd[] = [];
  for (const w of WORDS as Wd[]) {
    cur.push(w);
    if (cur.length === 3 || /[.,!?]$/.test(w.w)) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
})();
const Captions: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  let ch: Wd[] | null = null;
  for (let i = 0; i < chunks.length; i++) {
    const a = chunks[i][0].s - LEAD, nxt = i + 1 < chunks.length ? chunks[i + 1][0].s - LEAD : Infinity;
    const end = Math.min(nxt, chunks[i][chunks[i].length - 1].e + 0.6);
    if (t >= a && t < end) { ch = chunks[i]; break; }
  }
  if (!ch) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 1180 }}>
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", justifyContent: "center", maxWidth: 940 }}>
        {ch.map((w, i) => {
          const on = t >= w.s - LEAD, k = Math.min(1, Math.max(0, (t - (w.s - LEAD)) * FPS / 3));
          const clean = w.w.replace(/[.,!?]/g, "");
          return (
            <span key={i} style={{ visibility: on ? "visible" : "hidden", fontFamily: "Inter, 'Inter Display', sans-serif", fontWeight: 900, fontSize: 92,
              letterSpacing: 1, textTransform: "uppercase", color: KEY.test(clean) ? "#ffd23a" : "#ffffff",
              WebkitTextStroke: "14px #120c16", paintOrder: "stroke fill", transform: `scale(${0.85 + 0.15 * k})`, display: "inline-block",
              textShadow: "0 8px 0 rgba(18,12,22,0.55)" }}>{clean}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const WukongShort: React.FC = () => {
  const f = useCurrentFrame();
  const flash = f >= FLASH_AT && f < FLASH_AT + 8 ? [0.4, 0.8, 1, 1, 0.8, 0.55, 0.3, 0.12][f - FLASH_AT] : 0;
  const noCaps = (getInputProps() as { noCaps?: boolean }).noCaps;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} alpha={l.alpha} />)}
      {flash > 0 && <AbsoluteFill style={{ background: "#fff8e0", opacity: flash }} />}
      {!noCaps && <Captions />}
    </AbsoluteFill>
  );
};
