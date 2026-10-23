// Mundo "borracha": como a borracha apaga o lapis. Tres lugares na mesma cena:
// mesa (macro, x=0), grafite em camadas (x=60), fibras do papel ao microscopio (x=120) e fibras com tinta (x=240).
// Etapas: lapis, camadas, fibras, presas, chega, esfrega, farelo, tinta, final.
(() => {
const LOCAL = { mesa: new T3.Vector3(0, 0, 0), grafite: new T3.Vector3(60, 0, 0), micro: new T3.Vector3(120, 0, 0), tinta: new T3.Vector3(240, 0, 0) };
const ETAPA_LOCAL = { lapis: 'mesa', camadas: 'grafite', fibras: 'micro', presas: 'micro', chega: 'micro', esfrega: 'micro', farelo: 'micro', tinta: 'tinta', final: 'mesa' };
const W3 = {};
const PW = 768, PH = 1024, PAPEL = { w: 6, d: 8 };

function texRosa() {
  const n1 = fbm(41, 8), n2 = fbm(43, 64, 2);
  return pixels(256, (u, v) => { const k = 0.9 + n1(u, v) * 0.12 + n2(u, v) * 0.08; return [236 * k, 132 * k, 150 * k]; });
}
function texPapelBase() {
  const n1 = fbm(51, 16, 4);
  const cv = pixels(512, (u, v) => { const k = 0.93 + n1(u, v) * 0.07; return [250 * k, 248 * k, 242 * k]; });
  const out = document.createElement('canvas'); out.width = PW; out.height = PH; const o = out.getContext('2d');
  o.drawImage(cv, 0, 0, PW, PH);
  o.strokeStyle = 'rgba(120,160,210,0.45)'; o.lineWidth = 2;   // pauta azul de caderno
  for (let y = 120; y < PH; y += 64) { o.beginPath(); o.moveTo(0, y); o.lineTo(PW, y); o.stroke(); }
  o.strokeStyle = 'rgba(220,90,90,0.5)'; o.beginPath(); o.moveTo(90, 0); o.lineTo(90, PH); o.stroke();
  return out;
}
function fibras(centro, n, materialDe) {
  const g = grupo(); g.position.copy(centro);
  for (let i = 0; i < n; i++) {
    const a = rnd(i * 3.3) * Math.PI, cx = (rnd(i * 1.1) - 0.5) * 7, cz = (rnd(i * 2.2) - 0.5) * 5, L = 5 + rnd(i * 4.4) * 4;
    const pts = [...Array(6)].map((_, j) => { const s = (j / 5 - 0.5) * L; return new T3.Vector3(cx + Math.cos(a) * s + (rnd(i * 7 + j) - 0.5) * 0.5, 0.08 + rnd(i * 9 + j * 3) * 0.42, cz + Math.sin(a) * s + (rnd(i * 5 + j) - 0.5) * 0.5); });
    const me = new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3(pts), 40, 0.05 + rnd(i * 6.1) * 0.05, 8, false), materialDe(i));
    me.castShadow = me.receiveShadow = true; g.add(me);
  }
  const base = new T3.Mesh(new T3.PlaneGeometry(16, 12), mat(0xd8d2c4, { roughness: 1 })); base.rotation.x = -Math.PI / 2; base.receiveShadow = true; g.add(base);
  return g;
}
function plaquinha(r, m) { const me = new T3.Mesh(new T3.CylinderGeometry(r, r, 0.022, 6), m); me.castShadow = true; return me; }
function borrachaBloco(w, h, d, m) {
  const s = new T3.Shape(), r = Math.min(w, h) * 0.18;
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const geo = new T3.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: r * 0.4, bevelThickness: r * 0.4, bevelSegments: 4 }); geo.translate(0, 0, -d / 2);
  const me = new T3.Mesh(geo, m); me.castShadow = me.receiveShadow = true; return me;
}

function monta() {
  scene.add(sun.target);
  const baixo = new T3.DirectionalLight(0xffe8f0, 0.9); baixo.position.set(0, -4, 10); scene.add(baixo);  // clareia a sola da borracha
  const rosaTx = new T3.CanvasTexture(texRosa()); rosaTx.colorSpace = T3.SRGBColorSpace; rosaTx.wrapS = rosaTx.wrapT = T3.RepeatWrapping;
  const rosa = new T3.MeshStandardMaterial({ map: rosaTx, bumpMap: rosaTx, bumpScale: 1.5, roughness: 0.75 });
  const grafite = mat(0x6d727b, { roughness: 0.3, metalness: 0.55 });
  W3.rosa = rosa; W3.grafiteM = grafite;
  // ---- mesa: madeira, caderno, lapis e borracha ----
  const M = LOCAL.mesa;
  uvMundo(box(24, 0.4, 16, tmat('madeira', { relevo: 1.5 }), M.x, -0.2, M.z), 4);
  W3.papelBase = texPapelBase();
  const pc = document.createElement('canvas'); pc.width = PW; pc.height = PH; W3.papelCv = pc;
  const ptx = new T3.CanvasTexture(pc); ptx.colorSpace = T3.SRGBColorSpace; W3.papelTx = ptx;
  const branco = mat(0xf7f5ef, { roughness: 0.9 }), topo = new T3.MeshStandardMaterial({ map: ptx, roughness: 0.92 });
  box(PAPEL.w, 0.03, PAPEL.d, [branco, branco, topo, branco, branco, branco], M.x, 0.015, M.z);
  W3.lapis = grupo();
  const corpo = cyl(0.14, 0.14, 3.2, mat(0xf2c12e, { roughness: 0.45 }), 6, W3.lapis); corpo.position.y = 1.6 + 0.4;
  const ponta = cyl(0.14, 0.035, 0.4, mat(0xd9ab7a, { roughness: 0.8 }), 6, W3.lapis); ponta.position.y = 0.2 + 0.08; ponta.rotation.x = Math.PI;
  const grafPonta = cyl(0.035, 0.005, 0.1, grafite, 8, W3.lapis); grafPonta.position.y = 0.05; grafPonta.rotation.x = Math.PI;
  const anel = cyl(0.15, 0.15, 0.22, mat(0xc0c4c8, { metalness: 0.8, roughness: 0.3 }), 16, W3.lapis); anel.position.y = 3.71;
  const bor = cyl(0.14, 0.14, 0.25, rosa, 16, W3.lapis); bor.position.y = 3.93;
  W3.borMesa = borrachaBloco(1.3, 0.5, 0.65, rosa); scene.add(W3.borMesa);
  W3.farelosMesa = [...Array(10)].map((_, i) => { const f = cyl(0.04, 0.035, 0.22, mat(0xb08a90, { roughness: 0.9 }), 8); f.rotation.set(Math.PI / 2, rnd(i) * 3, 0); return f; });
  // ---- grafite em camadas ----
  const G = LOCAL.grafite;
  W3.placas = [...Array(12)].map((_, i) => {
    const pl = new T3.Mesh(new T3.CylinderGeometry(1.4, 1.4, 0.13, 6), grafite); pl.position.set(G.x, 0.1 + i * 0.17, G.z); pl.castShadow = pl.receiveShadow = true; scene.add(pl);
    // atomos de carbono na face de cima, em favo de mel
    const at = new T3.InstancedMesh(new T3.SphereGeometry(0.06, 8, 6), mat(0x5a5e66, { roughness: 0.3, metalness: 0.5 }), 40); let n = 0; const m4 = new T3.Matrix4();
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const px = (a + b * 0.5) * 0.36, pz = b * 0.31; if (Math.hypot(px, pz) < 1.2 && n < 40) { m4.makeTranslation(px, 0.075, pz); at.setMatrixAt(n++, m4); } }
    at.count = n; pl.add(at); return pl;
  });
  const chaoG = new T3.Mesh(new T3.CircleGeometry(6, 48), mat(0x23262c, { roughness: 0.9 })); chaoG.rotation.x = -Math.PI / 2; chaoG.position.copy(G); chaoG.receiveShadow = true; scene.add(chaoG);
  // ---- fibras do papel ao microscopio ----
  const fm = mat(0xf1ece0, { roughness: 0.75 });
  fibras(LOCAL.micro, 110, () => fm);
  W3.flocos = [...Array(150)].map((_, i) => {
    const f = plaquinha(0.07 + rnd(i * 2.1) * 0.1, grafite); scene.add(f);
    f.userData = { x: (rnd(i * 4.7) - 0.5) * 4.6, z: (rnd(i * 8.3) - 0.5) * 3.2, y: 0.52 + rnd(i * 1.9) * 0.12, rx: (rnd(i) - 0.5) * 0.5, rz: (rnd(i * 3) - 0.5) * 0.5, cai: rnd(i * 5.9), pega: rnd(i * 6.7) * 0.75 };
    return f;
  });
  W3.borMicro = borrachaBloco(6, 2, 3.6, rosa); scene.add(W3.borMicro);
  W3.farelos = [...Array(6)].map((_, i) => {
    const g = grupo(); const c = cyl(0.22, 0.2, 1.1, mat(0xc98a96, { roughness: 0.85 }), 14, g); c.rotation.z = Math.PI / 2;
    for (let j = 0; j < 8; j++) { const p = plaquinha(0.07, grafite); p.position.set((rnd(i * 9 + j) - 0.5) * 0.9, Math.cos(j * 2.4) * 0.2, Math.sin(j * 2.4) * 0.2); p.rotation.set(j, j * 2, 0); g.add(p); }
    return g;
  });
  // ---- fibras com tinta de caneta ----
  W3.fibraTinta = mat(0xf1ece0, { roughness: 0.6 });
  fibras(LOCAL.tinta, 110, () => W3.fibraTinta);
  W3.gotasTinta = [...Array(26)].map(() => { const m = new T3.Mesh(new T3.SphereGeometry(0.12, 12, 8), mat(0x1f3fa8, { roughness: 0.1, transparent: true, opacity: 0.85 })); scene.add(m); return m; });
  W3.borTinta = borrachaBloco(6, 2, 3.6, rosa); scene.add(W3.borTinta);
}

function desenhaPapel(escrito, apagado, borX) {
  const cv = W3.papelCv, o = cv.getContext('2d');
  o.drawImage(W3.papelBase, 0, 0);
  o.save(); o.font = 'italic 700 115px "DejaVu Serif", serif'; o.textBaseline = 'alphabetic';
  const txt = 'graphite', w = o.measureText(txt).width, x0 = (PW - w) / 2, base = 600; W3.txt = { x0, w, base };
  o.beginPath(); o.rect(x0 - 10, 0, (w + 20) * escrito, PH); o.clip();
  o.fillStyle = 'rgba(70,72,78,0.88)'; o.fillText(txt, x0, base);
  o.globalCompositeOperation = 'destination-out';   // grao do grafite: falhas pequenas no traco
  for (let i = 0; i < 1400; i++) { o.fillStyle = `rgba(0,0,0,${0.3 + rnd(i) * 0.5})`; o.fillRect(x0 + rnd(i * 3.7) * w, base - 130 + rnd(i * 5.3) * 170, 2, 2); }
  o.restore();
  if (apagado > 0) {  // area ja apagada volta a ser papel limpo
    o.save(); o.beginPath(); o.rect(x0 - 20, base - 160, (w + 40) * apagado, 220); o.clip(); o.drawImage(W3.papelBase, 0, 0); o.restore();
  }
  W3.papelTx.needsUpdate = true;
}
// face de cima da caixa: linha 0 do canvas fica no fundo (z negativo), coluna 0 na esquerda
const paraMundo = (cx, cy) => new T3.Vector3(LOCAL.mesa.x - PAPEL.w / 2 + PAPEL.w * cx / PW, 0.04, LOCAL.mesa.z - PAPEL.d / 2 + PAPEL.d * cy / PH);

function atualiza(t, ctx) {
  const et = ctx.p.etapa, k = ctx.lt, idx = Object.keys(ETAPA_LOCAL).indexOf(et);
  const centro = LOCAL[ETAPA_LOCAL[et]];
  sun.position.set(centro.x - 10, 18, centro.z + 14); sun.target.position.copy(centro);
  scene.background = new T3.Color(ETAPA_LOCAL[et] === 'mesa' ? 0xcdbba3 : 0x14171f);
  // mesa: lapis escrevendo (lapis) e borracha apagando (final)
  const escrito = et === 'lapis' ? ease(k * 1.3) : 1, apagado = et === 'final' ? ease(k * 1.4 - 0.1) : 0;
  desenhaPapel(escrito, apagado);
  const T = W3.txt, ponta = paraMundo(T.x0 + T.w * escrito, T.base - 60 + Math.sin(t * 22) * 28);
  W3.lapis.visible = et === 'lapis';
  W3.lapis.position.copy(ponta); W3.lapis.rotation.set(-0.55, 0, -0.35);
  W3.borMesa.visible = et === 'final';
  const bx = T.x0 + (T.w + 20) * apagado + Math.sin(t * 14) * 25;
  W3.borMesa.position.copy(paraMundo(bx, T.base - 50)).add(new T3.Vector3(0, 0.3, 0)); W3.borMesa.rotation.set(0, 0.15, Math.sin(t * 14) * 0.05);
  W3.farelosMesa.forEach((f, i) => { f.visible = et === 'final' && apagado > i / 12; const p = paraMundo(T.x0 + T.w * (i / 10) + 30, T.base + 40 + rnd(i * 3) * 60); f.position.set(p.x, 0.07, p.z); });
  // grafite: as placas de cima escorregam como cartas
  W3.placas.forEach((pl, i) => {
    const ordem = 11 - i, ini = 0.15 + ordem * 0.12, s = et === 'camadas' ? ease((k - ini) * 3) : 0;
    pl.position.x = LOCAL.grafite.x + s * (2.6 + ordem * 0.4); pl.position.y = 0.1 + i * 0.17 - s * (i * 0.17 - 0.1 - ordem * 0.02) * 0.6; pl.rotation.z = -s * 0.08;
  });
  // flocos: caem (fibras), ficam (presas), sao arrancados (esfrega) e somem dentro da borracha (farelo)
  const mi = LOCAL.micro, ordemEt = ['fibras', 'presas', 'chega', 'esfrega', 'farelo'].indexOf(et);
  let borY = 9, borX = 0;
  if (et === 'chega') borY = lerp(9, 0.66 + 1.0, ease(k * 1.4));
  if (et === 'esfrega') { borY = 0.66 + 1.0; borX = Math.sin((t - ctx.t0) * 6) * 1.1 * ease(k * 4); }
  if (et === 'farelo') { borY = lerp(0.66 + 1.0, 3.0, ease(k * 2)); borX = 0; }
  W3.borMicro.visible = ordemEt >= 2; W3.borMicro.position.set(mi.x + borX, borY, mi.z);
  W3.borMicro.rotation.x = et === 'farelo' ? -1.0 * ease(k * 2) : 0; W3.borMicro.updateMatrixWorld();
  W3.flocos.forEach((f, i) => {
    const u = f.userData; f.visible = ordemEt >= 0;
    let y = u.y, xx = u.x, rx = u.rx, rz = u.rz;
    if (et === 'fibras') { const q = ease((k * 1.6 - u.cai * 0.9) * 2.5); y = lerp(4, u.y, q); rx += (1 - q) * 4; f.visible = q > 0; }
    const pegou = et === 'esfrega' ? k > u.pega : ordemEt >= 4;
    if (pegou) {  // grudado embaixo da borracha: acompanha a posicao e a inclinacao dela
      const q = W3.borMicro.localToWorld(new T3.Vector3(u.x, -1.17, u.z));
      const d = et === 'esfrega' ? ease(clamp((k - u.pega) * 12)) : 1;
      f.position.set(lerp(mi.x + u.x, q.x, d), lerp(u.y, q.y, d), lerp(mi.z + u.z, q.z, d)); f.rotation.set(W3.borMicro.rotation.x * d, i, 0); return;
    }
    f.position.set(mi.x + xx, y, mi.z + u.z); f.rotation.set(rx, i, rz);
  });
  W3.farelos.forEach((g, i) => {
    g.visible = et === 'farelo' && k > 0.25 + i * 0.05;
    const q = clamp((k - 0.25 - i * 0.05) * 1.6), dir = i % 2 ? 1 : -1;
    g.position.set(mi.x + dir * (0.5 + q * (1.5 + i * 0.3)), 0.75, mi.z + (rnd(i * 4) - 0.5) * 3); g.rotation.set(0, (rnd(i) - 0.5) * 0.6, -dir * q * 6);
  });
  // tinta: gotas azuis afundam e tingem as fibras; a borracha esfrega e nada sai
  const ti = LOCAL.tinta, kt = et === 'tinta' ? k : 0;
  W3.fibraTinta.color.set(0xf1ece0).lerp(new T3.Color(0x2a4fb8), ease(kt * 2.2 - 0.3));
  W3.gotasTinta.forEach((g, i) => {
    const q = clamp(kt * 2.2 - rnd(i * 3.1) * 0.5); g.visible = et === 'tinta' && q > 0 && q < 1;
    g.position.set(ti.x + (rnd(i * 2.3) - 0.5) * 4, lerp(3.5, -0.2, q), ti.z + (rnd(i * 6.1) - 0.5) * 3); g.scale.set(1, 1 + q, 1);
  });
  W3.borTinta.visible = et === 'tinta' && kt > 0.55;
  W3.borTinta.position.set(ti.x + Math.sin(t * 6) * 1.1 * ease((kt - 0.6) * 5), lerp(7, 1.66, ease((kt - 0.55) * 5)), ti.z);
}

// camera: [alvo relativo ao lugar, distancia, altura, angulo]; troca de lugar = corte seco com zoom
const CAM = {
  lapis: { y: 0.1, z: 0.4, d: 6.8, h: 4.2, a: 0.2 }, camadas: { y: 1.0, d: 8, h: 3.4, a: 0.5 }, fibras: { y: 0.4, d: 6.2, h: 3.4, a: 0.3 },
  presas: { y: 0.5, d: 4.2, h: 1.9, a: -0.25 }, chega: { y: 1.4, d: 12, h: 4.5, a: 0.2 }, esfrega: { y: 0.6, d: 11, h: 0.9, a: 0.12 },
  farelo: { y: 1.2, d: 10, h: 1.0, a: 0.3 }, tinta: { y: 0.6, d: 7, h: 3.4, a: 0.25 }, final: { y: 0.1, z: 0.4, d: 6.4, h: 4.2, a: -0.15 },
};
function camera(t, ctx) {
  const cfg = j => { const e = (ST.cenas[j].p || {}).etapa; const c = CAM[e]; return { ...c, z: c.z || 0, c: LOCAL[ETAPA_LOCAL[e]] }; };
  const cur = cfg(ctx.i), prev = cfg(Math.max(0, ctx.i - 1)), corte = prev.c !== cur.c;
  const k = corte ? 1 : ease((t - ctx.t0) / 1.4), L = (a, b) => lerp(a, b, k);
  const d = L(prev.d, cur.d) * (1 - 0.05 * ctx.lt), a = L(prev.a, cur.a) + ctx.lt * 0.08, h = L(prev.h, cur.h), y = L(prev.y, cur.y), z = L(prev.z, cur.z);
  const zoom = corte ? 1 + 0.6 * Math.max(0, 1 - (t - ctx.t0) / 0.35) : 1;
  cam.position.set(cur.c.x + Math.sin(a) * d * zoom, y + h * zoom, cur.c.z + z + Math.cos(a) * d * zoom);
  cam.lookAt(cur.c.x, y, cur.c.z + z); cam.updateMatrixWorld();
  W3.flash = corte && ctx.i > 0 ? Math.max(0, 1 - (t - ctx.t0) / 0.3) : 0;
}
function overlay(t, ctx) {
  if (W3.flash > 0) { x.fillStyle = `rgba(255,255,255,${0.7 * W3.flash})`; x.fillRect(0, 0, W, H); }
  const et = ctx.p.etapa;
  const rot = { camadas: 'Graphite', fibras: 'Paper fibers', tinta: 'Pen ink' }[et];
  if (rot) pill(W / 2, 260, rot, 'rgba(255,255,255,0.92)', COL.ink, 40, back((t - ctx.t0) * 3));
}
MUNDO = { monta, atualiza, camera, overlay };
})();
