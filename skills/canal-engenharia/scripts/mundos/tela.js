// Mundo "tela": como a tela do celular mostra cores (subpixels RGB) e como sente o dedo (grade capacitiva).
// Tres lugares na mesma cena: a mesa com o celular (x=0), os pixels de perto (x=60) e as camadas da tela explodidas (x=120).
// Etapas: mesa, pixel, amarelo, branco, dedo, grade, rouba, cruza, luva, final.
(() => {
const LOCAL = { mesa: new T3.Vector3(0, 0, 0), pixels: new T3.Vector3(60, 0, 0), camadas: new T3.Vector3(120, 0, 0) };
const ETAPA_LOCAL = { mesa: 'mesa', pixel: 'pixels', amarelo: 'pixels', branco: 'pixels', dedo: 'mesa', grade: 'camadas', rouba: 'camadas', cruza: 'camadas', luva: 'camadas', final: 'mesa' };
const W3 = {};
const N = 14;                 // pixels por lado no zoom
const CW = 4.2, CL = 8.4;     // celular: largura e comprimento (escala de maquete)
const TOQUE = { x: 0.7, z: -0.9 };   // onde o dedo encosta (coordenadas locais da tela explodida)

const vidro = (cor, op) => new T3.MeshStandardMaterial({ color: cor, roughness: 0.08, metalness: 0.1, transparent: true, opacity: op, depthWrite: false });
let GLOW = null;
function glowTex() {
  if (GLOW) return GLOW;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c2 = cv.getContext('2d'), g = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c2.fillStyle = g; c2.fillRect(0, 0, 64, 64); return (GLOW = new T3.CanvasTexture(cv));
}
// papel de parede: por do sol com montanhas e icones de app
function papel() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 1024; const c2 = cv.getContext('2d');
  const g = c2.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, '#2b1b5e'); g.addColorStop(0.35, '#7a2f8f'); g.addColorStop(0.6, '#ff6a3d'); g.addColorStop(0.78, '#ffc24a'); g.addColorStop(1, '#ffe7a0');
  c2.fillStyle = g; c2.fillRect(0, 0, 512, 1024);
  const sol = c2.createRadialGradient(256, 640, 10, 256, 640, 150); sol.addColorStop(0, '#fffbe8'); sol.addColorStop(0.45, '#ffe680'); sol.addColorStop(1, 'rgba(255,200,80,0)');
  c2.fillStyle = sol; c2.beginPath(); c2.arc(256, 640, 150, 0, 7); c2.fill();
  const serra = (y0, amp, cor, seed) => { c2.fillStyle = cor; c2.beginPath(); c2.moveTo(0, 1024); for (let xx = 0; xx <= 512; xx += 16) c2.lineTo(xx, y0 - amp * (0.5 + 0.5 * Math.sin(xx * 0.02 + seed) * Math.cos(xx * 0.007 + seed * 2))); c2.lineTo(512, 1024); c2.fill(); };
  serra(760, 110, '#5a2a6e', 1); serra(840, 90, '#3a1d4e', 4); serra(930, 60, '#24133a', 7);
  const cores = ['#34c759', '#0a84ff', '#ff375f', '#ffd60a', '#5e5ce6', '#ff9f0a', '#64d2ff', '#bf5af2'];
  for (let i = 0; i < 8; i++) { const cx = 70 + (i % 4) * 124, cy = 120 + Math.floor(i / 4) * 130; c2.fillStyle = cores[i]; c2.beginPath(); c2.roundRect(cx - 40, cy - 40, 80, 80, 20); c2.fill(); c2.fillStyle = 'rgba(255,255,255,0.85)'; c2.beginPath(); c2.arc(cx, cy, 16, 0, 7); c2.fill(); }
  c2.fillStyle = 'rgba(255,255,255,0.92)'; c2.font = '700 64px system-ui'; c2.textAlign = 'center'; c2.fillText('9:41', 256, 400);
  return cv;
}
function arredondado(w, l, r, h) {
  const s = new T3.Shape(); s.roundRect ? null : null;
  s.moveTo(-w / 2 + r, -l / 2); s.lineTo(w / 2 - r, -l / 2); s.quadraticCurveTo(w / 2, -l / 2, w / 2, -l / 2 + r); s.lineTo(w / 2, l / 2 - r); s.quadraticCurveTo(w / 2, l / 2, w / 2 - r, l / 2);
  s.lineTo(-w / 2 + r, l / 2); s.quadraticCurveTo(-w / 2, l / 2, -w / 2, l / 2 - r); s.lineTo(-w / 2, -l / 2 + r); s.quadraticCurveTo(-w / 2, -l / 2, -w / 2 + r, -l / 2);
  const geo = new T3.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 });
  geo.rotateX(-Math.PI / 2); return geo;   // deitado: espessura em y, comprimento em z
}
function dedo(luva) {
  const g = new T3.Group();
  const pele = luva ? tmat('cerca', { color: 0x8a3b3b, relevo: 4 }) : mat(0xe0a383, { roughness: 0.55 });
  const d = new T3.Mesh(new T3.CapsuleGeometry(luva ? 0.62 : 0.5, 3.4, 8, 24), pele); d.position.y = 2.2; d.castShadow = true; g.add(d);
  if (!luva) { const u = new T3.Mesh(new T3.SphereGeometry(0.36, 20, 12), mat(0xf4d6cc, { roughness: 0.25 })); u.scale.set(1, 0.4, 1.3); u.position.set(0, 0.75, 0.35); g.add(u); }
  g.rotation.x = 0.45; g.rotation.z = -0.35;
  return g;
}

function monta() {
  scene.add(sun.target);
  const tx = new T3.CanvasTexture(papel()); tx.colorSpace = T3.SRGBColorSpace; W3.papelCv = tx.image;
  // ================= mesa =================
  const M = LOCAL.mesa;
  uvMundo(box(30, 0.4, 20, tmat('madeira', { color: 0x9c6b44, relevo: 1.2 }), M.x, -0.2, 0), 4);
  const parede = new T3.Mesh(new T3.PlaneGeometry(60, 30), mat(0x6f8fa8, { roughness: 1 })); parede.position.set(M.x, 10, -9); scene.add(parede);
  W3.cel = grupo(); W3.cel.position.set(M.x, 0.35, 0.5); W3.cel.rotation.y = 0.12;
  const corpo = new T3.Mesh(arredondado(CW, CL, 0.6, 0.32), mat(0x1b1d22, { roughness: 0.3, metalness: 0.6 })); corpo.castShadow = corpo.receiveShadow = true; W3.cel.add(corpo);
  W3.telaMat = new T3.MeshBasicMaterial({ map: tx });
  const tela = new T3.Mesh(new T3.PlaneGeometry(CW - 0.3, CL - 0.3), W3.telaMat); tela.rotation.x = -Math.PI / 2; tela.position.y = 0.39; W3.cel.add(tela);
  box(1.0, 0.02, 0.22, mat(0x050505), 0, 0.4, -CL / 2 + 0.55, W3.cel);
  // objetos da mesa: caneca, planta, fone
  const caneca = cyl(0.75, 0.65, 1.6, mat(0xf2ede4, { roughness: 0.4 })); caneca.position.set(M.x - 4.6, 0.8, -2.2);
  const cafe = cyl(0.66, 0.66, 0.05, mat(0x3a2216, { roughness: 0.2 })); cafe.position.set(M.x - 4.6, 1.5, -2.2);
  const vaso = cyl(0.8, 0.6, 1.4, mat(0xb5653e)); vaso.position.set(M.x + 5.2, 0.7, -3.4);
  for (let i = 0; i < 7; i++) { const f = new T3.Mesh(new T3.IcosahedronGeometry(0.7 + rnd(i) * 0.4, 1), tmat('folhas', { relevo: 3 })); f.position.set(M.x + 5.2 + (rnd(i * 3) - 0.5) * 1.6, 2.0 + rnd(i * 7) * 1.4, -3.4 + (rnd(i * 5) - 0.5) * 1.2); f.castShadow = true; scene.add(f); }
  W3.luzTela = new T3.PointLight(0xffa36a, 6, 8, 1.5); W3.luzTela.position.set(M.x, 1.5, 0.5); scene.add(W3.luzTela);
  W3.dedoMesa = dedo(false); W3.dedoMesa.scale.setScalar(0.9); scene.add(W3.dedoMesa);

  // ================= pixels de perto =================
  const P = LOCAL.pixels;
  const fundo = new T3.Mesh(new T3.PlaneGeometry(80, 80), new T3.MeshBasicMaterial({ color: 0x050608 })); fundo.position.set(P.x, 0, -0.3); scene.add(fundo);
  const c2 = W3.papelCv.getContext('2d', { willReadFrequently: true });
  W3.amostra = []; // cor do papel de parede na borda do sol (tem branco, amarelo e laranja)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const d = c2.getImageData(96 + i * 14, 500 + j * 12, 1, 1).data; W3.amostra.push([d[0] / 255, d[1] / 255, d[2] / 255]); }
  const sub = new T3.BoxGeometry(0.26, 0.82, 0.08), cores = [new T3.Color(1, 0.12, 0.1), new T3.Color(0.1, 1, 0.25), new T3.Color(0.15, 0.35, 1)];
  W3.subs = new T3.InstancedMesh(sub, new T3.MeshBasicMaterial({ color: 0xffffff }), N * N * 3);
  W3.halo = new T3.InstancedMesh(new T3.PlaneGeometry(1.0, 1.6), new T3.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: T3.AdditiveBlending, color: 0xffffff }), N * N * 3);
  const m4 = new T3.Matrix4();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) {
    const id = (j * N + i) * 3 + c, px = P.x + (i - (N - 1) / 2) * 1.0 + (c - 1) * 0.31, py = 6 + ((N - 1) / 2 - j) * 1.0;
    m4.makeTranslation(px, py, 0); W3.subs.setMatrixAt(id, m4);
    m4.makeTranslation(px, py, 0.06); W3.halo.setMatrixAt(id, m4);
  }
  W3.cores = cores; scene.add(W3.subs); scene.add(W3.halo);
  W3.centro = Math.floor(N / 2) * N + Math.floor(N / 2);

  // ================= camadas da tela explodidas =================
  const C = LOCAL.camadas;
  const chao = new T3.Mesh(new T3.CircleGeometry(20, 64), mat(0x10141c, { roughness: 0.9 })); chao.rotation.x = -Math.PI / 2; chao.position.set(C.x, -0.6, 0); chao.receiveShadow = true; scene.add(chao);
  W3.ex = grupo(); W3.ex.position.set(C.x, 0, 0);
  const disp = new T3.Mesh(new T3.PlaneGeometry(CW, CL), W3.telaMat); disp.rotation.x = -Math.PI / 2; W3.ex.add(disp);
  box(CW + 0.1, 0.3, CL + 0.1, mat(0x1b1d22, { metalness: 0.5, roughness: 0.35 }), 0, -0.16, 0, W3.ex);
  // grade: linhas em x (linhas) e em z (colunas), condutor transparente (ITO) desenhado em ciano
  W3.linhas = []; W3.colunas = [];
  const YG = 1.4, fio = (L) => new T3.BoxGeometry(L, 0.035, 0.035);
  for (let i = 0; i < 12; i++) { const z = -CL / 2 + 0.35 + i * (CL - 0.7) / 11; const me = new T3.Mesh(fio(CW), new T3.MeshBasicMaterial({ color: 0x38d8ff, transparent: true, opacity: 0.85 })); me.position.set(0, YG, z); W3.ex.add(me); W3.linhas.push(me); }
  for (let i = 0; i < 7; i++) { const xx = -CW / 2 + 0.3 + i * (CW - 0.6) / 6; const me = new T3.Mesh(new T3.BoxGeometry(0.035, 0.035, CL), new T3.MeshBasicMaterial({ color: 0x38d8ff, transparent: true, opacity: 0.85 })); me.position.set(xx, YG + 0.06, 0); W3.ex.add(me); W3.colunas.push(me); }
  const placa = new T3.Mesh(new T3.BoxGeometry(CW, 0.02, CL), vidro(0x9fe6ff, 0.12)); placa.position.y = YG - 0.03; W3.ex.add(placa);
  W3.vidro = new T3.Mesh(new T3.BoxGeometry(CW + 0.1, 0.12, CL + 0.1), vidro(0xdff6ff, 0.18)); W3.vidro.position.y = 2.6; W3.ex.add(W3.vidro);
  W3.vidroBorda = new T3.LineSegments(new T3.EdgesGeometry(W3.vidro.geometry), new T3.LineBasicMaterial({ color: 0xcff4ff, transparent: true, opacity: 0.7 })); W3.vidro.add(W3.vidroBorda);
  // cargas: faiscas paradas sobre a grade
  const g = new T3.BufferGeometry(), nc = 260, pos = new Float32Array(nc * 3);
  for (let i = 0; i < nc; i++) { const lin = i % 2 === 0; pos.set(lin ? [(rnd(i) - 0.5) * CW, YG + 0.05, W3.linhas[i % 12].position.z] : [W3.colunas[i % 7].position.x, YG + 0.1, (rnd(i * 3) - 0.5) * CL], i * 3); }
  g.setAttribute('position', new T3.BufferAttribute(pos, 3)); W3.cargaBase = pos.slice();
  W3.cargas = new T3.Points(g, new T3.PointsMaterial({ color: 0x8ff0ff, size: 0.22, map: glowTex(), transparent: true, depthWrite: false, blending: T3.AdditiveBlending }));
  W3.ex.add(W3.cargas);
  W3.dedoEx = dedo(false); W3.ex.add(W3.dedoEx);
  W3.luva = dedo(true); W3.ex.add(W3.luva);
  W3.alvo = new T3.Mesh(new T3.RingGeometry(0.25, 0.4, 32), new T3.MeshBasicMaterial({ color: 0xffd23a, transparent: true, depthWrite: false, side: T3.DoubleSide }));
  W3.alvo.rotation.x = -Math.PI / 2; W3.alvo.position.set(TOQUE.x, YG + 0.2, TOQUE.z); W3.ex.add(W3.alvo);
  W3.luzEx = new T3.PointLight(0x7fe8ff, 4, 14, 1.4); W3.luzEx.position.set(0, 3, 2); W3.ex.add(W3.luzEx);
}

function maisPerto(arr, v, eixo) { let b = 0; arr.forEach((m, i) => { if (Math.abs(m.position[eixo] - v) < Math.abs(arr[b].position[eixo] - v)) b = i; }); return b; }
function atualiza(t, ctx) {
  const et = ctx.p.etapa, k = ctx.lt, lugar = ETAPA_LOCAL[et], centro = LOCAL[lugar];
  sun.position.set(centro.x - 6, 16, centro.z + 10); sun.target.position.set(centro.x, 0, 0);
  scene.background = new T3.Color({ mesa: 0x6f8fa8, pixels: 0x050608, camadas: 0x0b0f16 }[lugar]);
  hemi.intensity = lugar === 'mesa' ? 0.9 : 0.5; sun.intensity = lugar === 'mesa' ? 2.4 : 1.4;
  // ---- mesa: dedo desce na etapa "dedo" ----
  const dm = W3.dedoMesa; dm.visible = et === 'dedo';
  const desce = et === 'dedo' ? ease(k * 1.4) : 0;
  dm.position.set(LOCAL.mesa.x + 0.6, 0.45 + lerp(3.5, 0, desce), 0.2 + lerp(2.5, 0, desce));
  // ---- pixels ----
  const foco = et === 'amarelo' || et === 'branco', resto = foco ? lerp(1, 0.12, ease(k * 3)) : 1;
  const cor = new T3.Color();
  for (let p = 0; p < N * N; p++) for (let c = 0; c < 3; c++) {
    let v = W3.amostra[p][c] * resto;
    if (foco && p === W3.centro) v = et === 'amarelo' ? (c < 2 ? 1 : 0.04) : 1;
    if (et === 'pixel') v *= 0.85 + 0.15 * Math.sin(t * 3 + p * 0.7 + c);
    cor.copy(W3.cores[c]).multiplyScalar(0.05 + 0.95 * v);
    W3.subs.setColorAt(p * 3 + c, cor);
    W3.halo.setColorAt(p * 3 + c, cor.clone().multiplyScalar((foco && p === W3.centro ? 0.35 : 0.4) * v));
  }
  W3.subs.instanceColor.needsUpdate = true; W3.halo.instanceColor.needsUpdate = true;
  // ---- camadas ----
  const camadas = lugar === 'camadas';
  const abre = et === 'grade' ? ease(k * 1.6) : camadas ? 1 : 0;
  W3.vidro.position.y = lerp(1.6, 2.6, abre);
  const comLuva = et === 'luva';
  const toca = et === 'rouba' ? ease(k * 2.2) : et === 'cruza' ? 1 : comLuva ? ease(k * 2.4) : 0;
  const posDedo = (g, on) => { g.visible = on; g.position.set(TOQUE.x + lerp(1.6, 0, toca), 2.66 + 0.55 + lerp(3, 0, toca), TOQUE.z + lerp(2.2, 0, toca)); };
  posDedo(W3.dedoEx, et === 'rouba' || et === 'cruza' || et === 'grade'); if (et === 'grade') W3.dedoEx.visible = false;
  posDedo(W3.luva, comLuva);
  const tocou = (et === 'rouba' && k > 0.45) || et === 'cruza';
  // as cargas perto do toque sobem para o dedo
  const p = W3.cargas.geometry.attributes.position, b = W3.cargaBase;
  for (let i = 0; i < p.count; i++) {
    const bx = b[i * 3], bz = b[i * 3 + 2], d = Math.hypot(bx - TOQUE.x, bz - TOQUE.z);
    let yy = b[i * 3 + 1] + 0.04 * Math.sin(t * 5 + i), xx = bx, zz = bz;
    if (tocou && d < 1.6) { const f = ((t * 0.9 + rnd(i)) % 1); xx = lerp(bx, TOQUE.x, f); zz = lerp(bz, TOQUE.z, f); yy = lerp(yy, 3.0, f * f); }
    p.setXYZ(i, xx, yy, zz);
  }
  p.needsUpdate = true;
  W3.cargas.material.size = 0.2 + 0.05 * Math.sin(t * 7);
  const li = maisPerto(W3.linhas, TOQUE.z, 'z'), co = maisPerto(W3.colunas, TOQUE.x, 'x');
  W3.linhas.forEach((m, i) => { const on = et === 'cruza' && i === li; m.material.color.set(on ? 0xffd23a : 0x38d8ff); m.material.opacity = tocou && i === li ? 0.95 : 0.6 + 0.2 * Math.sin(t * 4 + i); m.scale.set(1, on ? 3 : 1, on ? 3 : 1); });
  W3.colunas.forEach((m, i) => { const on = et === 'cruza' && i === co; m.material.color.set(on ? 0xffd23a : 0x38d8ff); m.material.opacity = tocou && i === co ? 0.95 : 0.6 + 0.2 * Math.sin(t * 4 + i * 2); m.scale.set(on ? 3 : 1, on ? 3 : 1, 1); });
  W3.alvo.visible = et === 'cruza'; W3.alvo.scale.setScalar(1 + 0.25 * Math.sin(t * 8));
}

const CAM = {
  mesa: { y: 0.6, d: 13, h: 7.5, a: 0.0 }, pixel: { y: 6, d: 15, h: 0.3, a: 0.02 }, amarelo: { y: 6, d: 7.5, h: 0.2, a: 0.0 }, branco: { y: 6, d: 7.0, h: 0.2, a: 0.08 },
  dedo: { y: 0.8, d: 10.5, h: 6.5, a: 0.25 }, grade: { y: 1.4, d: 12, h: 5.5, a: 0.5 }, rouba: { y: 2.6, d: 10.5, h: 3.6, a: 0.75 },
  cruza: { y: 2.0, d: 11, h: 7.0, a: 0.25 }, luva: { y: 2.8, d: 10.5, h: 3.4, a: 0.95 }, final: { y: 0.6, d: 13.5, h: 7, a: -0.12 },
};
function camera(t, ctx) {
  const cfg = j => { const e = (ST.cenas[j].p || {}).etapa; return { ...CAM[e], c: LOCAL[ETAPA_LOCAL[e]] }; };
  const cur = cfg(ctx.i), prev = cfg(Math.max(0, ctx.i - 1)), corte = prev.c !== cur.c;
  const k = corte ? 1 : ease((t - ctx.t0) / 1.4), L = (a, b) => lerp(a, b, k);
  let d = L(prev.d, cur.d) * (1 - 0.06 * ctx.lt), a = L(prev.a, cur.a) + ctx.lt * 0.06, h = L(prev.h, cur.h), y = L(prev.y, cur.y);
  // primeira cena: zoom continuo ate a tela encher o quadro (vira o corte para os pixels)
  if ((ST.cenas[ctx.i].p || {}).etapa === 'mesa' && ctx.i === 0) { const z = ease(ctx.lt); d *= lerp(1, 0.28, z); h *= lerp(1, 0.28, z); }
  const zoom = corte ? 1 + 0.6 * Math.max(0, 1 - (t - ctx.t0) / 0.35) : 1;
  cam.position.set(cur.c.x + Math.sin(a) * d * zoom, y + h * zoom, cur.c.z + 0.5 + Math.cos(a) * d * zoom);
  cam.lookAt(cur.c.x, y, cur.c.z + 0.5); cam.updateMatrixWorld();
  W3.flash = corte && ctx.i > 0 ? Math.max(0, 1 - (t - ctx.t0) / 0.3) : 0;
}
function overlay(t, ctx) {
  if (W3.flash > 0) { x.fillStyle = `rgba(255,255,255,${0.7 * W3.flash})`; x.fillRect(0, 0, W, H); }
  const et = ctx.p.etapa, s = back((t - ctx.t0) * 3), s2 = back((t - ctx.t0) * 3 - 0.7), branco = 'rgba(255,255,255,0.92)';
  const bola = (cor, rot) => { const r = 70 * s2; if (r <= 1) return; x.save(); x.shadowColor = cor; x.shadowBlur = 60; x.fillStyle = cor; x.beginPath(); x.arc(W / 2, 1460, r, 0, 7); x.fill(); x.restore(); pill(W / 2, 1600, rot, branco, COL.ink, 40, s2); };
  if (et === 'pixel') { pill(270, 300, 'Red', '#ff3b30', '#fff', 42, s); pill(W / 2, 300, 'Green', '#22c55e', '#fff', 42, back((t - ctx.t0) * 3 - 0.3)); pill(810, 300, 'Blue', '#2f6bff', '#fff', 42, back((t - ctx.t0) * 3 - 0.6)); }
  if (et === 'amarelo') { pill(W / 2, 300, 'Red + Green', branco, COL.ink, 44, s); bola('#ffe23a', 'Yellow'); }
  if (et === 'branco') { pill(W / 2, 300, 'All three', branco, COL.ink, 44, s); bola('#ffffff', 'White'); }
  if (et === 'grade') { pill(W / 2, 300, 'Invisible wire grid', '#38d8ff', COL.ink, 42, s); }
  if (et === 'rouba') { pill(W / 2, 300, 'Finger steals charge', COL.yellow, COL.ink, 42, s); }
  if (et === 'cruza') { pill(W / 2, 300, 'Row + column = touch', COL.yellow, COL.ink, 42, s); }
  if (et === 'luva') { const e = Math.max(0, (t - ctx.t0) - 0.9); if (e > 0) pill(W / 2, 300, 'Nothing  ✗', COL.red, '#fff', 46, back(e * 3)); }
}
MUNDO = { monta, atualiza, camera, overlay };
})();
