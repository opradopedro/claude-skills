// Mundo "guindaste": canteiro de obra com um predio de concreto subindo ao lado. Primeiro um poste de madeira com
// roldana (e depois uma talha de 4 cabos) iça a viga; depois vem o guindaste de torre de treliça amarela: torre,
// lanca com carrinho, contralanca com blocos de concreto, cabine, e no fim a gaiola de ascensao com macacos
// hidraulicos que levanta o topo e encaixa um modulo novo de torre.
// Etapas: obra, mastro, pesado, talha, reto, lanca, tomba, contrapeso, cresce, sobe, final.
(() => {
const M = -1.0;                 // x da torre (e do poste)
const SH = 2.4, TW = 0.75;      // altura do modulo de torre e meia largura
const N0 = 5, NMAX = 7;         // modulos no inicio e depois de subir
const FH = 2.5;                 // altura do andar
const BX0 = 3.0, BX1 = 11.0, BZ = 3.0;   // predio: x de BX0 a BX1, z de -BZ a BZ
const PX = 0.8, PTOP = 9.4;     // roldana do poste
const VX = 0.8, VY0 = 0.22;     // viga no chao
const JL = 13.0, CJ = 5.6;      // lanca (a partir do eixo) e contralanca
const W3 = {};
const XS = (a, b, n) => [...Array(n + 1)].map((_, i) => lerp(a, b, i / n));

GERA.tijolo = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d');
  cx.fillStyle = '#b9b2a6'; cx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 16; r++) for (let i = -1; i < 9; i++) {
    const k = 0.78 + rnd(r * 17 + i * 3) * 0.32, px = i * 32 + (r % 2) * 16;
    cx.fillStyle = `rgb(${168 * k},${78 * k},${52 * k})`; cx.fillRect(px + 1.5, r * 16 + 1.5, 29, 13);
    cx.fillStyle = 'rgba(255,255,255,0.08)'; cx.fillRect(px + 1.5, r * 16 + 1.5, 29, 3);
  }
  return cv;
};
GERA.predios = () => {   // fachada de predio distante: janelas em grade, algumas acesas
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const cx = cv.getContext('2d');
  cx.fillStyle = '#9aa6b2'; cx.fillRect(0, 0, 256, 512);
  for (let r = 0; r < 32; r++) for (let i = 0; i < 8; i++) {
    const k = rnd(r * 13 + i * 7); cx.fillStyle = k > 0.85 ? '#e9e2c8' : `rgb(${70 + k * 50},${92 + k * 50},${118 + k * 50})`;
    cx.fillRect(i * 32 + 6, r * 16 + 4, 20, 9);
  }
  return cv;
};

const Y = new T3.Vector3(0, 1, 0);
// barra entre dois pontos (perfil quadrado, como cantoneira de trelica)
function barra(a, b, r, m, parent) {
  const A = new T3.Vector3(...a), B = new T3.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const me = new T3.Mesh(new T3.BoxGeometry(r * 2, L, r * 2), m); me.position.copy(A).addScaledVector(d, 0.5);
  me.quaternion.setFromUnitVectors(Y, d.normalize()); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me;
}
// cabo: cilindro fino de comprimento 1 que se estica entre dois pontos a cada quadro
function cabo(m, r = 0.028, parent = scene) {
  const me = new T3.Mesh(new T3.CylinderGeometry(r, r, 1, 6), m); me.castShadow = true; parent.add(me); return me;
}
function estica(me, a, b) {
  const A = new T3.Vector3(...a), B = new T3.Vector3(...b), d = B.clone().sub(A), L = Math.max(1e-3, d.length());
  me.position.copy(A).addScaledVector(d, 0.5); me.quaternion.setFromUnitVectors(Y, d.normalize()); me.scale.set(1, L, 1);
}
// viga I de aco (perfil extrudado ao longo de x)
function vigaI(L, m, parent) {
  const s = new T3.Shape(), b = 0.17, h = 0.22, tf = 0.035, tw = 0.025;
  s.moveTo(-b, -h); s.lineTo(b, -h); s.lineTo(b, -h + tf); s.lineTo(tw, -h + tf); s.lineTo(tw, h - tf); s.lineTo(b, h - tf); s.lineTo(b, h);
  s.lineTo(-b, h); s.lineTo(-b, h - tf); s.lineTo(-tw, h - tf); s.lineTo(-tw, -h + tf); s.lineTo(-b, -h + tf); s.closePath();
  const g = new T3.ExtrudeGeometry(s, { depth: L, bevelEnabled: false }); g.translate(0, 0, -L / 2); g.rotateY(Math.PI / 2);
  const me = new T3.Mesh(g, m); me.castShadow = me.receiveShadow = true; parent.add(me); return me;
}
// operario: manequim com capacete e colete
function operario(parent, colete = 0xff7a1a) {
  const g = grupo(parent), pele = mat(0xd9a07a, { roughness: 0.7 }), roupa = mat(colete, { roughness: 0.7 }), calca = mat(0x34465e, { roughness: 0.85 });
  const corpo = new T3.Mesh(new T3.CapsuleGeometry(0.17, 0.42, 6, 12), roupa); corpo.position.y = 1.12; corpo.castShadow = true; g.add(corpo);
  const faixa = new T3.Mesh(new T3.CylinderGeometry(0.176, 0.176, 0.05, 16), mat(0xeef3c8, { roughness: 0.3, emissive: 0x333322 })); faixa.position.y = 1.02; g.add(faixa);
  const cab = new T3.Mesh(new T3.SphereGeometry(0.14, 16, 12), pele); cab.position.y = 1.55; cab.castShadow = true; g.add(cab);
  const cap = new T3.Mesh(new T3.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffd21a, { roughness: 0.35 })); cap.position.y = 1.58; g.add(cap);
  const aba = new T3.Mesh(new T3.CylinderGeometry(0.2, 0.2, 0.02, 16), mat(0xffd21a, { roughness: 0.35 })); aba.position.y = 1.585; g.add(aba);
  g.bracos = [];
  for (const s of [-1, 1]) {
    const om = grupo(g); om.position.set(s * 0.22, 1.32, 0);
    const br = new T3.Mesh(new T3.CapsuleGeometry(0.055, 0.42, 4, 8), roupa); br.position.y = -0.24; br.castShadow = true; om.add(br); g.bracos.push(om);
    const pe = new T3.Mesh(new T3.CapsuleGeometry(0.07, 0.62, 4, 8), calca); pe.position.set(s * 0.09, 0.42, 0); pe.castShadow = true; g.add(pe);
  }
  return g;
}

function modulo(parent, m, y0) {   // um modulo de torre: 4 montantes, travessas e diagonais nas 4 faces
  const g = grupo(parent); g.position.y = y0; const r = 0.07, c = [[-TW, -TW], [TW, -TW], [TW, TW], [-TW, TW]];
  for (const [a, b] of c) barra([a, 0, b], [a, SH, b], r, m, g);
  for (let i = 0; i < 4; i++) { const [a1, b1] = c[i], [a2, b2] = c[(i + 1) % 4];
    barra([a1, 0.04, b1], [a2, 0.04, b2], 0.045, m, g); barra([a1, 0.04, b1], [a2, SH - 0.04, b2], 0.04, m, g); }
  return g;
}

function monta() {
  quintal({ zFundo: -9, zCasa: -46, xCasa: -10, escalaCasa: 1.4, arvores: [[-20, -44, 1.5], [-2, -45, 1.6], [16, -42, 1.4], [24, -38, 1.5], [-24, -30, 1.3]] });
  W3.ceu = scene.children.find(o => o.material && o.material.side === T3.BackSide);
  scene.fog.near = 60; scene.fog.far = 220;
  reflexos(0.55);
  sun.position.set(-22, 40, 30); sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 26, bottom: -14, near: 1, far: 140 }); sun.shadow.camera.updateProjectionMatrix();

  // ---------- canteiro: terra batida, cerca de tapume, predios ao longe ----------
  const chao = solid(-60, 60, -0.3, 0.02, -9, 60, tmat('terra2', { relevo: 2 }), 3);
  const tap = tmat('madeira', { relevo: 0.6, color: 0x9fb4c8 });
  uvMundo(box(40, 2.4, 0.12, tap, 0, 1.2, -9), 2.5);
  for (let i = 0; i < 9; i++) {
    const h = 18 + rnd(i * 3.3) * 26, w = 8 + rnd(i * 5.1) * 8, me = box(w, h, 8, tmat('predios', { semRelevo: true, roughness: 0.6 }), -50 + i * 13 + rnd(i) * 4, h / 2, -78 - rnd(i * 7) * 12);
    me.castShadow = false; uvMundo(me, 14);
  }
  // base do guindaste (sapata de concreto)
  W3.sapata = uvMundo(box(3.4, 0.6, 3.4, tmat('concreto', { relevo: 1 }), M, 0.3, 0), 1.6);
  // pilha de vigas, cones, betoneira simples
  const prim = mat(0xa8452a, { roughness: 0.55, metalness: 0.35 });
  for (let i = 0; i < 6; i++) { const v = vigaI(4.2, prim, scene); v.position.set(-5.2 + (i % 3) * 0.4, 0.22 + Math.floor(i / 3) * 0.45, 3.0); }
  for (const [cx, cz] of [[1.8, 4.6], [-3.2, 5.2], [2.6, -4.6]]) { const c = cyl(0.02, 0.2, 0.6, mat(0xff5a1a, { roughness: 0.5 }), 12); c.position.set(cx, 0.32, cz); const f = cyl(0.13, 0.15, 0.08, mat(0xf2f2f2), 12); f.position.set(cx, 0.36, cz); }
  uvMundo(box(3.4, 2.4, 2.2, mat(0xf2f2ee, { roughness: 0.7 }), -7.5, 1.22, -5.5), 1.5);
  box(3.0, 0.1, 2.4, mat(0x6b7480), -7.5, 2.46, -5.5);
  for (let i = 0; i < 2; i++) box(0.7, 0.55, 0.05, mat(0x6d97c4, { roughness: 0.2, metalness: 0.2 }), -8.3 + i * 1.5, 1.6, -4.38);

  // ---------- predio de concreto (andares que crescem) ----------
  W3.andares = [];
  const conc = tmat('concreto', { relevo: 1.2 }), tij = tmat('tijolo', { relevo: 1.5 }), ferro = mat(0x4b3c33, { roughness: 0.5, metalness: 0.5 });
  uvMundo(box(BX1 - BX0 + 0.4, 0.35, 2 * BZ + 0.4, conc, (BX0 + BX1) / 2, 0.17, 0), 2);
  for (let i = 0; i < 6; i++) {
    const g = grupo(); g.position.y = i * FH; W3.andares.push(g);
    for (const cx of [BX0 + 0.2, (BX0 * 2 + BX1) / 3, (BX0 + BX1 * 2) / 3, BX1 - 0.2]) for (const cz of [-BZ + 0.2, BZ - 0.2]) uvMundo(box(0.4, FH - 0.3, 0.4, conc, cx, 0.35 + (FH - 0.3) / 2, cz, g), 1.5);
    const laje = box(BX1 - BX0 + 0.3, 0.3, 2 * BZ + 0.3, conc, (BX0 + BX1) / 2, FH + 0.2, 0, g); uvMundo(laje, 2);
    // fechamento de tijolo nos andares de baixo (fundo e lado direito), frente aberta para ver dentro
    uvMundo(box(BX1 - BX0 - 0.2, FH - 0.3, 0.2, tij, (BX0 + BX1) / 2, 0.35 + (FH - 0.3) / 2, -BZ + 0.2, g), 1.4);
    uvMundo(box(0.2, FH - 0.3, 2 * BZ - 0.4, tij, BX1 - 0.2, 0.35 + (FH - 0.3) / 2, 0, g), 1.4);
    // esperas de ferro saindo dos pilares (so aparecem no andar mais alto)
    g.esperas = grupo(g);
    for (const cx of [BX0 + 0.2, (BX0 * 2 + BX1) / 3, (BX0 + BX1 * 2) / 3, BX1 - 0.2]) for (const cz of [-BZ + 0.2, BZ - 0.2]) for (const [dx, dz] of [[-0.1, -0.1], [0.1, 0.1], [0.1, -0.1], [-0.1, 0.1]]) {
      const e = cyl(0.018, 0.018, 0.9, ferro, 5, g.esperas); e.position.set(cx + dx, FH + 0.8, cz + dz); }
  }
  // viga ja colocada no teto e dois operarios la em cima
  W3.vigaTeto = vigaI(4.2, prim, scene);
  W3.topo1 = operario(scene); W3.topo2 = operario(scene, 0x2fcf6a);
  // fantasma do andar que nao cabe
  W3.fantasma = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(BX1 - BX0, FH, 2 * BZ)), new T3.LineBasicMaterial({ color: 0xff4b3e, transparent: true, opacity: 0, depthTest: false }));
  W3.fantasma.renderOrder = 8; scene.add(W3.fantasma);

  // ---------- poste de madeira com roldana (e talha) ----------
  const mad = tmat('madeira', { relevo: 1 }), corda = mat(0xcaa86a, { roughness: 0.9 }), aco = mat(0xb9c0c5, { roughness: 0.3, metalness: 0.85 });
  W3.poste = grupo();
  uvMundo(box(0.36, PTOP + 0.4, 0.36, mad, M, (PTOP + 0.4) / 2, 0, W3.poste), 1.5);
  uvMundo(box(PX - M + 0.4, 0.3, 0.3, mad, (M + PX) / 2 + 0.1, PTOP + 0.2, 0, W3.poste), 1.5);
  barra([M + 0.1, PTOP - 1.6, 0], [PX - 0.2, PTOP + 0.05, 0], 0.08, mad, W3.poste);
  for (const [gx, gz] of [[-7, 4], [-7, -4], [M, -7]]) { const c = cabo(corda, 0.02, W3.poste); estica(c, [M, PTOP, 0], [gx, 0, gz]); box(0.3, 0.3, 0.3, conc, gx, 0.15, gz, W3.poste); }
  W3.roldana = new T3.Mesh(new T3.TorusGeometry(0.22, 0.06, 10, 28), aco); W3.roldana.position.set(PX, PTOP - 0.1, 0); W3.poste.add(W3.roldana);
  // talha: bloco de cima (2 roldanas) e bloco de baixo
  W3.talhaCima = grupo(W3.poste); W3.talhaCima.position.set(PX, PTOP - 0.25, 0);
  box(0.62, 0.5, 0.22, mat(0x2d6fc2, { roughness: 0.4, metalness: 0.4 }), 0, 0, 0, W3.talhaCima);
  for (const dx of [-0.16, 0.16]) { const r = new T3.Mesh(new T3.TorusGeometry(0.13, 0.035, 8, 20), aco); r.position.set(dx, -0.05, 0.13); W3.talhaCima.add(r); }
  W3.talhaBaixo = grupo(W3.poste);
  box(0.62, 0.4, 0.22, mat(0x2d6fc2, { roughness: 0.4, metalness: 0.4 }), 0, 0, 0, W3.talhaBaixo);
  for (const dx of [-0.16, 0.16]) { const r = new T3.Mesh(new T3.TorusGeometry(0.13, 0.035, 8, 20), aco); r.position.set(dx, 0.02, 0.13); W3.talhaBaixo.add(r); }
  W3.cabosT = [...Array(4)].map(() => cabo(corda, 0.022, W3.poste));
  W3.puxa = cabo(corda, 0.026); W3.desce = cabo(corda, 0.026); W3.lingas = [cabo(corda, 0.02), cabo(corda, 0.02)];
  W3.viga = vigaI(4.2, prim, scene);
  W3.op = operario(scene); W3.op2 = operario(scene, 0xff7a1a);

  // ---------- guindaste de torre ----------
  const am = mat(0xf2b705, { roughness: 0.42, metalness: 0.35 }), amNovo = mat(0xf2b705, { roughness: 0.42, metalness: 0.35, emissive: 0x2fcf6a, emissiveIntensity: 0 });
  W3.amNovo = amNovo;
  W3.pivo = grupo(); W3.pivo.position.set(M + TW, 0.6, 0);
  W3.gc = grupo(W3.pivo); W3.gc.position.set(-(M + TW), -0.6, 0);
  W3.torre = grupo(W3.gc); W3.torre.position.set(M, 0.6, 0);
  W3.mods = [...Array(NMAX)].map((_, i) => modulo(W3.torre, i >= N0 ? amNovo : am, i * SH));
  W3.topo = grupo(W3.gc); W3.topo.position.x = M;
  const tp = W3.topo, cinza = mat(0x5a626c, { roughness: 0.5, metalness: 0.5 });
  box(1.9, 0.5, 1.9, am, 0, 0.25, 0, tp); cyl(1.0, 1.0, 0.18, cinza, 32, tp).position.y = 0.55;
  // lanca triangular
  const y0 = 0.8, y1 = 2.05, zb = 0.52, nP = 10, dx = (JL - TW) / nP;
  barra([TW, y0, -zb], [JL, y0, -zb], 0.06, am, tp); barra([TW, y0, zb], [JL, y0, zb], 0.06, am, tp); barra([TW, y1, 0], [JL - 0.4, y1 - 0.25, 0], 0.06, am, tp);
  for (let i = 0; i < nP; i++) {
    const xa = TW + i * dx, xb = xa + dx, yt = u => lerp(y1, y1 - 0.25, (u - TW) / (JL - TW));
    for (const s of [-1, 1]) { barra([xa, y0, s * zb], [xa + dx / 2, yt(xa + dx / 2), 0], 0.035, am, tp); barra([xa + dx / 2, yt(xa + dx / 2), 0], [Math.min(xb, JL), y0, s * zb], 0.035, am, tp); }
    barra([xa, y0, -zb], [xa, y0, zb], 0.03, am, tp);
  }
  barra([JL, y0, -zb], [JL - 0.4, y1 - 0.25, 0], 0.05, am, tp); barra([JL, y0, zb], [JL - 0.4, y1 - 0.25, 0], 0.05, am, tp); barra([JL, y0, -zb], [JL, y0, zb], 0.05, am, tp);
  // contralanca com passarela e guarda-corpo
  box(CJ, 0.18, 1.3, am, -TW - CJ / 2 + 0.3, y0, 0, tp);
  box(CJ - 0.3, 0.04, 1.1, mat(0x8d949b, { roughness: 0.6, metalness: 0.5 }), -TW - CJ / 2 + 0.3, y0 + 0.11, 0, tp);
  for (const s of [-1, 1]) { barra([-TW, y0 + 0.75, s * 0.62], [-TW - CJ + 0.3, y0 + 0.75, s * 0.62], 0.025, am, tp); for (let i = 0; i <= 5; i++) barra([-TW - i * (CJ - 0.3) / 5, y0, s * 0.62], [-TW - i * (CJ - 0.3) / 5, y0 + 0.75, s * 0.62], 0.02, am, tp); }
  // guincho (tambor e motor) na contralanca
  const tam = cyl(0.32, 0.32, 0.8, cinza, 20, tp); tam.rotation.x = Math.PI / 2; tam.position.set(-2.0, y0 + 0.45, 0);
  box(0.6, 0.5, 0.5, mat(0x2d6fc2, { roughness: 0.4, metalness: 0.3 }), -2.0, y0 + 0.38, 0.62, tp);
  // torre de topo (A) e tirantes
  const ap = [0, 4.6, 0];
  for (const [a, b] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) barra([a, 0.6, b], ap, 0.06, am, tp);
  barra([-0.6, 2.4, 0], [0.6, 2.4, 0], 0.04, am, tp);
  const tir = mat(0x3a3f45, { roughness: 0.4, metalness: 0.7 });
  barra(ap, [8.0, y1 - 0.15, 0], 0.03, tir, tp); barra(ap, [4.0, y1 - 0.08, 0], 0.03, tir, tp); barra(ap, [-TW - CJ + 0.5, y0 + 0.15, 0], 0.03, tir, tp);
  // cabine
  W3.cab = grupo(tp); W3.cab.position.set(1.15, 0.15, 1.15);
  box(1.1, 1.25, 1.2, mat(0xf4f4f0, { roughness: 0.5 }), 0, 0.6, 0, W3.cab);
  const vidro = mat(0x6d97c4, { roughness: 0.08, metalness: 0.4 });
  box(1.12, 0.6, 1.0, vidro, 0, 0.75, 0.02, W3.cab); box(0.9, 0.65, 0.04, vidro, 0, 0.75, 0.6, W3.cab);
  // carrinho e moitao
  W3.carro = grupo(tp); W3.carro.position.y = y0 - 0.12;
  box(0.95, 0.22, 1.24, cinza, 0, 0, 0, W3.carro);
  for (const sx of [-0.32, 0.32]) for (const sz of [-zb, zb]) { const r = cyl(0.09, 0.09, 0.08, mat(0x222428), 12, W3.carro); r.rotation.x = Math.PI / 2; r.position.set(sx, 0.16, sz); }
  W3.moitao = grupo(tp);
  const mo = box(0.55, 0.7, 0.32, am, 0, 0, 0, W3.moitao);
  for (const yy of [-0.12, 0.12]) box(0.56, 0.1, 0.33, mat(0xd22d22, { roughness: 0.45 }), 0, yy, 0, W3.moitao);
  const gancho = new T3.Mesh(new T3.TorusGeometry(0.16, 0.05, 8, 20, Math.PI * 1.5), mat(0x3a3f45, { metalness: 0.8, roughness: 0.3 })); gancho.position.set(0, -0.55, 0); gancho.rotation.z = Math.PI * 0.75; W3.moitao.add(gancho);
  W3.cabosH = [cabo(tir, 0.025, tp), cabo(tir, 0.025, tp)];
  // carga do moitao: a viga (lanca) e o feixe pesado (tomba)
  W3.vigaH = vigaI(4.2, prim, W3.moitao); W3.vigaH.position.y = -1.3;
  W3.lingasH = [cabo(corda, 0.02, W3.moitao), cabo(corda, 0.02, W3.moitao)];
  W3.feixe = grupo(W3.moitao); W3.feixe.position.y = -1.6;
  for (let i = 0; i < 6; i++) { const v = vigaI(4.2, prim, W3.feixe); v.position.set(0, -(Math.floor(i / 3)) * 0.45, (i % 3 - 1) * 0.36); }
  for (const s of [-1, 1]) estica(cabo(corda, 0.025, W3.feixe), [0, 1.0, 0], [s * 1.6, 0.25, 0]);
  // contrapeso: blocos de concreto
  W3.blocos = [...Array(4)].map((_, i) => { const b = box(0.48, 1.5, 1.2, conc, -TW - CJ + 0.75 + i * 0.52, y0 + 0.85, 0, tp); uvMundo(b, 1); return b; });
  // gaiola de ascensao com macacos hidraulicos
  W3.gaiola = grupo(tp); const lar = mat(0xd2451e, { roughness: 0.45, metalness: 0.35 }), cromo = mat(0xe8edf0, { roughness: 0.12, metalness: 0.95 });
  { const g = W3.gaiola, w = TW + 0.28, c = [[-w, -w], [w, -w], [w, w], [-w, w]], h0 = -SH * 1.15;
    for (const [a, b] of c) barra([a, h0, b], [a, 0, b], 0.07, lar, g);
    for (const yy of [h0, h0 * 0.5, -0.05]) for (let i = 0; i < 4; i++) { if (i === 1 && yy < -0.1) continue; const [a1, b1] = c[i], [a2, b2] = c[(i + 1) % 4]; barra([a1, yy, b1], [a2, yy, b2], 0.05, lar, g); }
    for (const s of [-1, 1]) { const bm = box(0.9, 0.12, 0.12, lar, 0, h0 * 0.5, s * (w + 0.25), g); bm.scale.x = 1; box(0.06, -h0, 0.06, lar, 0, h0 * 0.5, s * (w + 0.3), g); }
    // trilho e carrinho por onde o modulo novo entra (lado +x)
    barra([w, h0 + 0.1, -0.55], [w + 3.2, h0 + 0.1, -0.55], 0.05, lar, g); barra([w, h0 + 0.1, 0.55], [w + 3.2, h0 + 0.1, 0.55], 0.05, lar, g);
    W3.camisa = []; W3.haste = [];
    for (const s of [-1, 1]) { const cm = cyl(0.13, 0.13, 1.2, lar, 14, g); cm.position.set(-w - 0.05, h0 * 0.5 - 0.1, s * 0.5); W3.camisa.push(cm);
      const hs = cyl(0.07, 0.07, 1, cromo, 12, g); W3.haste.push(hs); }
    W3.h0 = h0; W3.gw = w; }
  W3.y0 = y0;
  W3.poeira = new T3.InstancedMesh(new T3.SphereGeometry(0.09, 6, 5), new T3.MeshBasicMaterial({ color: 0xb59a78, transparent: true, opacity: 0.7, depthWrite: false }), 80); W3.poeira.renderOrder = 5; scene.add(W3.poeira);
}

const ETAPAS = ['obra', 'mastro', 'pesado', 'talha', 'reto', 'lanca', 'tomba', 'contrapeso', 'cresce', 'sobe', 'final'];

// quanto o topo subiu e quantos modulos ja entraram na etapa "sobe" (2 ciclos)
function ciclo(S) {
  if (S.s < 9) return { ins: 0, L: 0, desliza: -1, u: 0 };
  if (S.s > 9) return { ins: 2, L: 0, desliza: -1, u: 0 };
  let ins = 0, L = 0, desliza = -1, u = 0;
  for (let c = 0; c < 2; c++) {
    const kc = (S.k - 0.08 - c * 0.42) / 0.42;
    if (kc <= 0) break;
    if (kc >= 1) { ins++; continue; }
    if (kc < 0.4) L = SH * ease(kc / 0.4);
    else if (kc < 0.85) { L = SH; desliza = ins; u = ease((kc - 0.4) / 0.4); }
    else { ins++; L = 0; }
    break;
  }
  return { ins, L, desliza, u };
}

function atualiza(t, ctx) {
  const s = Math.max(0, ETAPAS.indexOf(ctx.p.etapa)), k = ctx.lt, S = { s, k }; W3.S = S;
  const C = ciclo(S), nMods = N0 + C.ins, MT = nMods * SH + 0.6;
  W3.C = C;
  // ---------- predio ----------
  const nAnd = s < 8 ? 3 : s === 8 ? 3 + 2 * ease((k - 0.08) / 0.6) : s === 9 ? 5 : 6;
  W3.andares.forEach((g, i) => {
    const f = clamp(nAnd - i); g.visible = f > 0.01;
    g.scale.y = Math.max(0.01, f); g.position.y = i * FH;
    g.esperas.visible = i === Math.ceil(nAnd) - 1;
  });
  const topoPredio = Math.max(3, Math.ceil(nAnd - 0.001)) * FH + 0.35;
  W3.fantasma.position.set((BX0 + BX1) / 2, 5 * FH + 0.35 + FH / 2, 0);
  W3.fantasma.material.opacity = s === 8 ? clamp((k - 0.62) * 5) * (0.6 + 0.4 * Math.sin(t * 12)) : s === 9 ? 0.9 * (1 - clamp((k - 0.9) * 10)) : 0;
  W3.fantasma.material.color.set(s === 9 ? (C.ins >= 2 ? 0x2fcf6a : 0xffffff) : 0xff4b3e);
  // operarios no teto (a partir do guindaste)
  W3.topo1.visible = W3.topo2.visible = s >= 5;
  W3.topo1.position.set(7.9, topoPredio, 1.6); W3.topo1.rotation.y = -0.6; W3.topo2.position.set(5.0, topoPredio, -1.2); W3.topo2.rotation.y = 0.5;
  W3.topo1.bracos.forEach(b => b.rotation.x = -2.6 + Math.sin(t * 3) * 0.2);
  W3.vigaTeto.visible = s >= 6 && s <= 7 || (s === 5 && k > 0.93);
  W3.vigaTeto.position.set(7.0, 3 * FH + 0.35 + 0.22, 0.6);

  // sapata do guindaste: concretada junto com a torre
  W3.sapata.visible = s >= 5; W3.sapata.position.y = 0.3 - (s === 5 ? 1 - ease(k / 0.08) : 0) * 0.62;
  // ---------- poste e talha (etapas 1 a 4; some no comeco da 5) ----------
  const posteOn = s >= 1 && s <= 4 || (s === 5 && k < 0.2);
  W3.poste.visible = posteOn;
  W3.poste.position.y = s === 1 ? -(1 - ease(k * 3)) * 12 : s === 5 ? -ease(k / 0.2) * 14 : 0;
  const talha = s >= 3 && !(s === 5 && k > 0.1);
  W3.roldana.visible = !talha; W3.talhaCima.visible = W3.talhaBaixo.visible = talha && s <= 4;
  W3.cabosT.forEach(c => c.visible = talha && s <= 4);
  // altura da viga
  let vy = VY0, balanco = 0;
  if (s === 1) vy = VY0 + 0.55 * ease((k - 0.35) / 0.5);
  if (s === 2) vy = k < 0.45 ? VY0 + 0.55 - 0.15 * ease(k / 0.45) : VY0 + 0.4 * Math.max(0, 1 - (k - 0.45) / 0.06) + Math.abs(Math.sin((k - 0.45) * 40)) * 0.08 * Math.max(0, 1 - (k - 0.45) * 6);
  if (s === 3) vy = VY0 + (PTOP - 1.9 - VY0) * ease((k - 0.3) / 0.65);
  if (s === 4 || s === 5) { vy = PTOP - 1.9; balanco = Math.sin(t * 1.6) * 0.04; }
  const vigaPoste = s >= 0 && s <= 4 || (s === 5 && k < 0.04);
  W3.viga.visible = vigaPoste; W3.viga.position.set(VX, vy, 0.0); W3.viga.rotation.z = balanco;
  // cabos do poste: lingas da viga ate o gancho, gancho ate a roldana / talha
  const gy = vy + 1.0, cimaY = PTOP - 0.25;
  W3.lingas.forEach((c, i) => { c.visible = vigaPoste && s >= 1; estica(c, [VX + (i ? 1.4 : -1.4), vy + 0.22, 0], [VX, gy, 0]); });
  W3.desce.visible = s >= 1 && s <= 2 || (s === 0 && false);
  estica(W3.desce, [PX, PTOP - 0.32, 0], [VX, gy, 0]);
  if (talha && s <= 4) {
    W3.talhaBaixo.position.set(PX, gy + 0.2, 0);
    W3.cabosT.forEach((c, i) => { const xx = PX + [-0.29, -0.03, 0.03, 0.29][i]; estica(c, [xx, cimaY - 0.15, 0.13], [xx, gy + 0.3, 0.13]); });
  }
  // operario puxando
  const opOn = s >= 1 && s <= 4;
  W3.op.visible = opOn; W3.op2.visible = s === 2;
  const tensao = s === 1 ? ease((k - 0.25) * 3) : s === 2 ? 1 : s === 3 ? 0.3 : 0.2;
  const opX = -3.6 - (s === 3 ? ease((k - 0.3) / 0.65) * 1.2 : s === 4 ? 1.2 : 0), opZ = 1.6;
  W3.op.position.set(opX - (s === 2 && k > 0.45 ? -0.5 * ease((k - 0.45) * 5) : 0), 0, opZ);
  W3.op.rotation.set(0, Math.PI / 2 - 0.25, 0);
  W3.op.rotation.z = 0; W3.op.children[0].rotation.x = 0;
  W3.op.rotation.x = 0;
  const incl = s === 2 && k > 0.45 ? 0.5 * ease((k - 0.45) * 5) : -0.32 * tensao;
  W3.op.rotation.z = 0; W3.op.quaternion.setFromEuler(new T3.Euler(0, Math.PI / 2 - 0.25, 0)); W3.op.rotateX(incl);
  W3.op.bracos.forEach(b => b.rotation.x = -1.3 - 0.2 * Math.sin(t * 4) * (s <= 2 ? 1 : 0.3));
  W3.op2.position.set(opX - 0.9, 0, opZ + 0.5); W3.op2.quaternion.setFromEuler(new T3.Euler(0, Math.PI / 2 - 0.25, 0)); W3.op2.rotateX(-0.35 + (k > 0.45 ? 0.75 * ease((k - 0.45) * 5) : 0)); W3.op2.bracos.forEach(b => b.rotation.x = -1.3);
  const maos = new T3.Vector3(0, 1.05, 0.42).applyQuaternion(W3.op.quaternion).add(W3.op.position);
  W3.puxa.visible = opOn; estica(W3.puxa, [maos.x, maos.y, maos.z], [PX - (talha ? 0.29 : 0.22), PTOP - 0.15, 0.13]);

  // ---------- guindaste ----------
  const crane = s >= 5;
  W3.gc.visible = crane;
  // montagem na etapa 5: modulos sobem um a um, depois a lanca entra
  const monta5 = s === 5 ? clamp((k - 0.04) / 0.32) : 1;
  W3.mods.forEach((m, i) => {
    const naTorre = i < nMods, fm = s === 5 ? clamp(monta5 * (N0 + 1) - i) : 1;
    m.visible = crane && (naTorre && fm > 0.01 || i === C.desliza + N0 && C.desliza >= 0);
    m.position.y = i * SH + (naTorre ? (1 - ease(fm)) * 6 : 0);
    m.position.x = 0;
    if (i === C.desliza + N0 && C.desliza >= 0) { m.position.y = (N0 + C.desliza) * SH; m.position.x = lerp(3.1, 0, C.u); }
  });
  const ftopo = s === 5 ? clamp(monta5 * (N0 + 1) - N0) : 1;
  W3.topo.position.y = MT + C.L + (1 - ease(ftopo)) * 8;
  W3.topo.visible = crane && ftopo > 0.01;
  W3.amNovo.emissiveIntensity = s === 9 ? 0.45 + 0.25 * Math.sin(t * 6) : 0;
  // gaiola e macacos
  W3.gaiola.visible = s === 9;
  if (s === 9) for (let i = 0; i < 2; i++) { const L = Math.max(0.05, C.L + 0.3), y = W3.h0 * 0.5 - 0.7; estica(W3.haste[i], [-W3.gw - 0.05, y, i ? 0.5 : -0.5], [-W3.gw - 0.05, y - L, i ? 0.5 : -0.5]); }
  // carrinho e moitao (coordenadas locais do topo)
  let cx = VX - M, hy = vy + 1.0;   // gancho no mundo
  let carga = 'viga';
  if (s === 5) {
    const r = clamp((k - 0.42) / 0.33), d = clamp((k - 0.78) / 0.15);
    cx = lerp(VX - M, 7.0 - M, ease(r)); hy = lerp(PTOP - 1.9 + 1.0, 3 * FH + 0.35 + 1.25, ease(d));
    if (k > 0.93) carga = 'nada';
  } else if (s === 6) {
    cx = lerp(7.0 - M, JL - 0.6, ease((k - 0.12) / 0.4)); hy = lerp(3 * FH + 0.35 + 2.4, 3 * FH + 0.35 + 3.4, ease(k / 0.3)); carga = 'feixe';
  } else if (s === 7) { cx = JL - 0.6; hy = 3 * FH + 0.35 + 3.4; carga = 'feixe'; }
  else if (s === 8) { cx = lerp(JL - 0.6, 3.0 - M, ease(k * 2)); hy = MT + 0.8 - 2.2; carga = 'nada'; }
  else if (s === 9) { cx = 3.0 - M; hy = MT + C.L + 0.8 - 2.2; carga = 'nada'; }
  else if (s === 10) { cx = lerp(3.0 - M, 9.0 - M, ease(k * 1.5)); hy = MT + 0.8 - 5 + Math.sin(t) * 0.2; carga = 'viga'; }
  W3.carro.position.x = cx;
  const hl = hy - W3.topo.position.y;   // altura local do topo do moitao
  W3.moitao.position.set(cx, hl, 0);
  W3.cabosH.forEach((c, i) => estica(c, [cx + (i ? 0.18 : -0.18), W3.y0 - 0.2, 0], [cx + (i ? 0.18 : -0.18), hl + 0.3, 0]));
  W3.vigaH.visible = carga === 'viga'; W3.feixe.visible = carga === 'feixe';
  W3.lingasH.forEach((c, i) => { c.visible = carga === 'viga'; estica(c, [i ? 1.4 : -1.4, -1.3 + 0.22, 0], [0, -0.6, 0]); });
  W3.feixe.scale.setScalar(s === 6 ? Math.max(0.01, back(clamp(k / 0.12))) : 1);
  // tombamento: pivo no pe da frente da torre
  let tomb = 0;
  if (s === 6) tomb = -0.2 * ease((k - 0.5) / 0.4) + (k > 0.55 ? Math.sin(t * 22) * 0.006 : 0);
  if (s === 7) tomb = -0.2 * (1 - ease((k - 0.25) / 0.4));
  W3.pivo.rotation.z = tomb;
  W3.moitao.rotation.z = -tomb;
  // blocos do contrapeso caem um a um
  W3.blocos.forEach((b, i) => {
    const f = s < 7 ? 0 : s === 7 ? clamp((k - 0.05 - i * 0.07) / 0.18) : 1;
    b.visible = f > 0.001; b.position.y = W3.y0 + 0.85 + (1 - f * f) * 7;
  });
  // giro lento no final
  W3.topo.rotation.y = s === 10 ? -ease(k) * 0.5 : 0;
  // poeira no tombamento e nos blocos
  { const m4 = new T3.Matrix4(); let n = 0;
    const ef = s === 6 ? clamp((k - 0.5) * 3) : s === 7 ? clamp((k - 0.05) * 4) * (1 - clamp((k - 0.6) * 3)) : 0;
    if (ef > 0.01) for (let i = 0; i < 80; i++) { const u = (ef * 0.8 + rnd(i) * 0.4) % 1, a = rnd(i * 3.3) * 6.28, r = 0.4 + u * (1.2 + rnd(i * 5) * 1.5);
      m4.makeTranslation(M + Math.cos(a) * r * 1.4, 0.15 + u * 0.8 * rnd(i * 2), Math.sin(a) * r * 1.2); W3.poeira.setMatrixAt(n++, m4); }
    W3.poeira.count = n; W3.poeira.instanceMatrix.needsUpdate = true; W3.poeira.material.opacity = 0.6 * ef; }
  // luz de fim de tarde no final
  const ouro = s === 10 ? ease(k * 1.5) : 0;
  sun.color.set(0xfff0d8).lerp(new T3.Color(0xffc27a), ouro); sun.intensity = lerp(2.8, 2.5, ouro);
  hemi.intensity = lerp(1.05, 0.85, ouro);
}

const CAM = {
  obra: { x: 3.0, y: 5.0, d: 28, a: 0.3, h: 3.0 },
  mastro: { x: -1.2, y: 4.4, d: 20, a: 0.2, h: 1.2 },
  pesado: { x: -1.4, y: 2.0, d: 15.5, a: 0.22, h: 0.8 },
  talha: { x: -0.6, y: 5.2, d: 17, a: 0.15, h: 0.6 },
  reto: { x: 2.6, y: 6.4, d: 22, a: -0.28, h: 1.0 },
  lanca: { x: 4.0, y: 8.6, d: 30, a: 0.32, h: 2.0 },
  tomba: { x: 5.2, y: 9.0, d: 34, a: 0.06, h: 0.6 },
  contrapeso: { x: -1.5, y: 11.0, d: 30, a: -0.2, h: 1.0 },
  cresce: { x: 4.2, y: 9.6, d: 31, a: 0.36, h: 1.4 },
  sobe: { x: -0.4, y: 13.6, d: 19, a: -0.5, h: 0.5 },
  final: { x: 4.0, y: 10.5, d: 36, a: -0.18, h: 3.0 },
};
function camera(t, ctx) {
  cameraPadrao(t, ctx, { x: 0, y: 6, d: 25, a: 0, h: 2, zFoco: 0 }, p => CAM[p.etapa] || {});
}

function seta(cx, cy, ang, s, cor = '#ffd23a') {
  if (s <= 0.01) return;
  x.save(); x.translate(cx, cy); x.rotate(ang); x.scale(s, s); x.fillStyle = cor; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(0, 60); x.lineTo(40, 12); x.lineTo(15, 12); x.lineTo(15, -50); x.lineTo(-15, -50); x.lineTo(-15, 12); x.lineTo(-40, 12); x.closePath(); x.stroke(); x.fill(); x.restore();
}
function tracejado(pts, cor, al) {
  if (al <= 0.01) return;
  x.save(); x.globalAlpha = al; x.strokeStyle = cor; x.lineWidth = 7; x.setLineDash([22, 16]); x.lineCap = 'round';
  x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = 8; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); x.restore();
}
function mundoTela(obj, px, py, pz) { const v = new T3.Vector3(px, py, pz).applyMatrix4(obj.matrixWorld).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; }

function overlay(t, ctx) {
  const S = W3.S, p = ctx.p, k = ctx.lt;
  const rot = (px, py, pz, txt, s, cor = 'rgba(255,255,255,0.93)', fg = COL.ink, tam = 34) => { const [a, b] = proj(px, py, pz); pill(a, b, txt, cor, fg, tam, back(s)); };
  const ev = tipo => { const e = ST.eventos.find(e => e.tipo === tipo && e.t >= ctx.t0 - 0.3 && e.t < ctx.t1); return e ? clamp((t - e.t) * 3) : clamp((k - 0.55) * 3); };
  if (p.ruim) pill(W / 2, H * 0.14, p.ruim, COL.red, '#fff', 58, back(ev('erro')));
  if (p.bom) pill(W / 2, H * 0.14, p.bom, COL.green, '#fff', 58, back(ev('certo')));
  const roof = 3 * FH + 0.35;
  if (S.s === 0) {
    rot(VX, 1.0, 0, 'STEEL BEAM', clamp((k - 0.15) * 4));
    const al = clamp((k - 0.35) * 3);
    tracejado(XS(0, 1, 24).map(u => proj(lerp(VX, 7, u), lerp(0.7, roof + 0.6, u) + Math.sin(u * Math.PI) * 4.5, 0)), '#ffd23a', al);
    rot(7, roof + 1.3, 0, 'UP HERE', clamp((k - 0.55) * 4), 'rgba(255,210,58,0.96)');
  }
  if (S.s === 1) rot(PX, PTOP + 0.8, 0, 'PULLEY', clamp((k - 0.25) * 4));
  if (S.s === 2) rot(VX - 0.6, 1.35, 0, '2,500 LB', clamp((k - 0.15) * 4), COL.red, '#fff', 40);
  if (S.s === 3) { rot(PX + 1.5, PTOP - 1.0, 0, '4 ROPES', clamp((k - 0.3) * 4)); }
  if (S.s === 4) {
    const al = clamp((k - 0.2) * 3), vy = PTOP - 1.9;
    tracejado(XS(0, 1, 20).map(u => proj(lerp(VX + 1.2, 7, u), vy + 0.2 - (vy - roof - 0.4) * u * u, 0)), '#ff4b3e', al);
    const [a, b] = proj(4.6, vy - 0.3, 0); if (al > 0.3) { x.save(); x.strokeStyle = COL.red; x.lineWidth = 14; x.lineCap = 'round'; const r = 34 * back(clamp((k - 0.4) * 4)); x.beginPath(); x.moveTo(a - r, b - r); x.lineTo(a + r, b + r); x.moveTo(a + r, b - r); x.lineTo(a - r, b + r); x.stroke(); x.restore(); }
  }
  if (S.s === 5) {
    const tp = W3.topo; tp.updateMatrixWorld();
    if (k > 0.3) { const [a, b] = mundoTela(tp, 9.5, 2.9, 0); pill(a, b, 'JIB', 'rgba(255,255,255,0.93)', COL.ink, 32, back(clamp((k - 0.32) * 4))); }
    if (k > 0.42) { const [a, b] = mundoTela(tp, W3.carro.position.x, -0.5, 0); pill(a + 120, b, 'TROLLEY', 'rgba(255,210,58,0.96)', COL.ink, 32, back(clamp((k - 0.45) * 4))); }
    rot(M, 6.0, 0, 'TOWER', clamp((k - 0.2) * 4) * (1 - clamp((k - 0.7) * 4)));
  }
  if (S.s === 6) {
    const tp = W3.topo; tp.updateMatrixWorld(); const [qa, qb] = mundoTela(W3.moitao, 0, -2.4, 0); pill(qa - 190, qb + 30, 'HEAVY LOAD', COL.red, '#fff', 32, back(clamp((k - 0.2) * 4)));
  }
  if (S.s === 7) {
    const tp = W3.topo; tp.updateMatrixWorld();
    const [a, b] = mundoTela(tp, -TW - CJ + 1.5, 3.4, 0); pill(a, b, 'CONCRETE BLOCKS', 'rgba(255,255,255,0.93)', COL.ink, 30, back(clamp((k - 0.35) * 4)));
    const ga = back(clamp((k - 0.62) * 4));
    const [c1, d1] = mundoTela(tp, -TW - CJ + 1.5, -0.6, 0); seta(c1, d1 + 40, 0, 0.8 * ga, '#ffffff');
    const [c2, d2] = mundoTela(W3.moitao, 0, -2.6, 0); seta(c2, d2 + 80, 0, 0.8 * ga, '#ffffff');
    const [c3, d3] = mundoTela(tp, 0, -0.5, 0); pill(c3, d3 + 70, 'BALANCED', COL.green, '#fff', 30, ga);
  }
  if (S.s === 8) rot((BX0 + BX1) / 2, 5 * FH + 0.35 + FH * 0.5, 2.8, 'NO ROOM', clamp((k - 0.66) * 4), COL.red, '#fff', 34);
  if (S.s === 9) {
    const tp = W3.topo; tp.updateMatrixWorld(); const C = W3.C;
    const [a, b] = mundoTela(tp, -W3.gw - 0.05, W3.h0 * 0.5 - 0.6, 0); pill(a - 150, b, 'HYDRAULIC JACKS', 'rgba(255,255,255,0.93)', COL.ink, 34, back(clamp((k - 0.12) * 5)) * (1 - clamp((k - 0.5) * 5)));
    if (C.desliza >= 0) { const m = W3.mods[N0 + C.desliza]; m.updateMatrixWorld(); const [qa, qb] = mundoTela(m, 0, SH / 2, 0); pill(qa + 40, qb + 40, 'NEW SECTION', COL.green, '#fff', 30, back(clamp(C.u * 4))); }
  }
}
MUNDO = { monta, atualiza, camera, overlay };
})();
