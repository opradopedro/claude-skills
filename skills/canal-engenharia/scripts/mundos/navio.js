// Mundo "navio": mar aberto com ondas (malha que se adensa no centro, espuma nas cristas) e um porta-conteineres em
// escala 1:10 (casco por secoes com proa afinada, pintura antiincrustante, superestrutura, tampas de porao, pontes de
// peacao). Conteineres de 40 pes num InstancedMesh, recolocados a cada quadro (pilhas que crescem, caem no mar).
// Serve dois roteiros:
//  - YB014 (por que os conteineres nao caem): abertura, mito, canto, trava (bancada de perto com cantoneira e twist lock,
//    em escala real, longe do navio), bloco, lashing, peso, onda, queda, fim.
//  - YB015 (navio que nao tomba): porto, estreito, vira, largo, alto, lastro (corte), rola, antirol (corte), teste, final.
// O corte e um plano de clipping em z = ZC (entre dois "bays") com a secao do casco desenhada na frente: costado,
// porao com conteineres, fundo duplo com tanques de lastro e tanque anti-rolagem em U.
(() => {
const W3 = {};
const CL = 1.22, CW = 0.244, CH = 0.26;            // conteiner de 40 pes (12,2 x 2,44 x 2,6 m) em escala 1:10
const PASSO = CL + 0.11;                            // um bay + vao da ponte de peacao
const L = 22;
const CASCOS = {
  largo: { B: 3.2, D: 1.9, T: 1.05, bays: 11, tiers: 10 },
  estreito: { B: 1.3, D: 2.1, T: 1.25, bays: 11, tiers: 8 },
};
const ZB0 = -5.6;                                   // centro do primeiro bay (a superestrutura fica atras dele)
const ZC = ZB0 + 5 * PASSO + PASSO / 2;             // corte no vao entre o bay 5 e o 6
const DET = new T3.Vector3(0, 4, -62);              // bancada do twist lock (escala real, atras do navio)
const COR = [0xc0392b, 0x2a6fb5, 0x2f8a4e, 0xe0a12a, 0x8d939a, 0x1f4f7a, 0xd8642a, 0x7a3f8f, 0xc9c1b2, 0x2a9a9a, 0xa83250, 0x4a6b3a];
const Y = new T3.Vector3(0, 1, 0);
const XS = (a, b, n) => [...Array(n + 1)].map((_, i) => lerp(a, b, i / n));

// chapa corrugada de conteiner: cinza claro (a cor vem de cada instancia), trilhos escuros em cima e embaixo
GERA.conteiner = () => {
  const n1 = fbm(51, 8);
  return pixels(256, (u, v) => {
    const cor = 0.8 + 0.2 * Math.sin(u * Math.PI * 2 * 22), borda = v < 0.06 || v > 0.94 ? 0.55 : 1, quina = u < 0.03 || u > 0.97 ? 0.6 : 1;
    const k = cor * borda * quina * (0.88 + n1(u, v) * 0.2) * (0.97 + rnd(u * 733 + v * 911) * 0.06);
    return [235 * k, 235 * k, 235 * k];
  });
};
GERA.chapa = () => {   // convés e tampas: aço pintado gasto
  const n1 = fbm(61, 6), n2 = fbm(63, 32, 2);
  return pixels(256, (u, v) => { const k = 0.8 + n1(u, v) * 0.3 + n2(u, v) * 0.1; return [118 * k, 128 * k, 120 * k]; });
};

function barra(a, b, r, m, parent) {
  const A = new T3.Vector3(...a), B = new T3.Vector3(...b), d = B.clone().sub(A), Lb = d.length();
  const me = new T3.Mesh(new T3.CylinderGeometry(r, r, Lb, 8), m); me.position.copy(A).addScaledVector(d, 0.5);
  me.quaternion.setFromUnitVectors(Y, d.normalize()); me.castShadow = true; parent.add(me); return me;
}

// ---------------- casco ----------------
// meia secao (x >= 0) do fundo ao convés, com a cor de cada trecho (antiincrustante, faixa preta, costado)
function meiaSecao(c) {
  const { B, D, T } = c, r = Math.min(0.32, B * 0.12), pts = [];
  pts.push([0, 0], [B / 2 - r, 0]);
  for (let i = 1; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push([B / 2 - r + Math.cos(a) * r, r + Math.sin(a) * r]); }
  for (const y of [T * 0.5, T - 0.06, T + 0.1, (T + D) / 2, D]) pts.push([B / 2, y]);
  return pts;
}
function forma(c, z) {   // largura relativa e fundo levantado ao longo do comprimento (proa afinada, popa levantada)
  const u = (z + L / 2) / L;
  let wf = 1, bf = 0, flare = 0;
  if (u > 0.8) { const b = (u - 0.8) / 0.2; wf = 1 - Math.pow(b, 1.7) * 0.97; bf = Math.pow(b, 2.4) * c.D * 0.62; flare = b; }
  if (u < 0.1) { const s = (0.1 - u) / 0.1; wf = 1 - s * s * 0.22; bf = Math.pow(s, 1.4) * c.T * 0.85; }
  return { wf, bf, flare };
}
function casco(c, cores) {
  const meia = meiaSecao(c), loop = [];
  for (let i = meia.length - 1; i >= 0; i--) loop.push([-meia[i][0], meia[i][1]]);
  for (let i = 1; i < meia.length; i++) loop.push(meia[i]);
  const corDe = y => y < c.T - 0.06 + 1e-4 ? cores.fundo : y < c.T + 0.1 + 1e-4 ? cores.faixa : cores.costado;
  // duplica o vertice onde a cor muda (normais suaves dentro de cada faixa, borda nitida entre elas)
  const pl = [];
  for (let k = 0; k < loop.length; k++) {
    const [px, py] = loop[k], ant = k > 0 ? loop[k - 1] : null, prox = k < loop.length - 1 ? loop[k + 1] : null;
    const cA = ant ? corDe((ant[1] + py) / 2) : null, cB = prox ? corDe((prox[1] + py) / 2) : null;
    if (cA !== null && cB !== null && cA !== cB) { pl.push([px, py, cA]); pl.push([px, py, cB]); } else pl.push([px, py, cA ?? cB]);
  }
  const NZ = 70, pos = [], col = [], idx = [], nP = pl.length;
  const ponto = (p, z) => { const f = forma(c, z), yy = f.bf + p[1] * (c.D - f.bf) / c.D, wl = f.wf + (1 - f.wf) * 0.22 * f.flare * Math.pow(yy / c.D, 2);
    return [p[0] * wl, yy - c.T, z]; };
  for (let s = 0; s <= NZ; s++) {
    const z = -L / 2 + s / NZ * L;
    for (const p of pl) { pos.push(...ponto(p, z)); const cc = new T3.Color(p[2]); col.push(cc.r, cc.g, cc.b); }
  }
  for (let s = 0; s < NZ; s++) for (let k = 0; k < nP - 1; k++) {
    const a = s * nP + k, b = a + 1, d = a + nP, e = d + 1;
    if (pl[k][0] === pl[k + 1][0] && pl[k][1] === pl[k + 1][1]) continue;
    idx.push(a, d, b, b, d, e);
  }
  // convés (tira entre as bordas de cada estacao) e espelho de popa
  const base = pos.length / 3, deck = new T3.Color(cores.conves);
  for (let s = 0; s <= NZ; s++) {
    const z = -L / 2 + s / NZ * L, l = ponto(pl[0], z), r = ponto(pl[nP - 1], z);
    pos.push(...l, ...r); col.push(deck.r, deck.g, deck.b, deck.r, deck.g, deck.b);
  }
  for (let s = 0; s < NZ; s++) { const a = base + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const b2 = pos.length / 3, popa = new T3.Color(cores.costado);
  for (const p of pl) { pos.push(...ponto(p, -L / 2)); col.push(popa.r, popa.g, popa.b); }
  for (let k = 1; k < nP - 1; k++) idx.push(b2, b2 + k + 1, b2 + k);
  const b3 = pos.length / 3;
  for (const p of pl) { pos.push(...ponto(p, L / 2)); col.push(popa.r, popa.g, popa.b); }
  for (let k = 1; k < nP - 1; k++) idx.push(b3, b3 + k, b3 + k + 1);
  const g = new T3.BufferGeometry();
  g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const me = new T3.Mesh(g, new T3.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.15, side: T3.DoubleSide, clippingPlanes: [W3.corte] }));
  me.castShadow = me.receiveShadow = true;
  return me;
}

// superestrutura (ponte de comando), tampas de porao, pontes de peacao, mastro de proa
function equipa(nav, c, nome) {
  const cm = o => mat(o, { roughness: 0.55, clippingPlanes: [W3.corte] });
  const dy = c.D - c.T, zS = ZB0 - CL / 2 - 0.85, wS = Math.min(c.B * 0.86, 2.6);
  const g = grupo(nav);
  box(wS, 1.55, 1.1, cm(0xf1f1ec), 0, dy + 0.78, zS, g);
  box(Math.min(c.B * 1.02, 3.3), 0.3, 0.9, cm(0xf6f6f2), 0, dy + 1.7, zS + 0.05, g);
  for (let i = 0; i < 4; i++) box(wS + 0.01, 0.07, 1.11, cm(0x2a3640), 0, dy + 0.38 + i * 0.32, zS, g);
  box(Math.min(c.B * 1.02, 3.3) + 0.01, 0.12, 0.91, mat(0x1d2a35, { roughness: 0.15, metalness: 0.4, clippingPlanes: [W3.corte] }), 0, dy + 1.72, zS + 0.05, g);
  box(0.5, 0.75, 0.55, cm(0xf1f1ec), 0, dy + 2.2, zS - 0.25, g);
  box(0.51, 0.18, 0.56, cm(0x1f4f7a), 0, dy + 2.4, zS - 0.25, g);
  box(0.06, 0.7, 0.06, cm(0xf1f1ec), 0, dy + 2.2, zS + 0.3, g);
  // mastro de proa
  box(0.03, 0.5, 0.03, cm(0xf1f1ec), 0, dy + 0.25, L / 2 - 1.6, g);
  // tampas e pontes de peacao
  const chapa = tmat('chapa', { relevo: 0.8, clippingPlanes: [W3.corte] }), aco = cm(0x8a9298);
  W3.lbridges = W3.lbridges || {}; W3.lbridges[nome] = [];
  for (let b = 0; b < c.bays; b++) {
    const z = ZB0 + b * PASSO, f = forma(c, z + CL / 2), w = c.B * f.wf * 0.9;
    uvMundo(box(w, 0.08, CL + 0.04, chapa, 0, dy + 0.04, z, g), 1.5);
    if (b < c.bays - 1 && nome === 'largo') { const zl = z + PASSO / 2; box(w, 0.04, 0.05, aco, 0, dy + 0.36, zl, g);
      for (const xx of XS(-w / 2, w / 2, 4)) box(0.04, 0.36, 0.05, aco, xx, dy + 0.18, zl, g); W3.lbridges[nome].push(zl); }
  }
  return g;
}

// posicoes de todos os conteineres de um casco (local do navio), com cor e peso
function arranjo(c, nome) {
  const out = [], dy = c.D - c.T + 0.09;
  for (let b = 0; b < c.bays; b++) {
    const z = ZB0 + b * PASSO, w = c.B * forma(c, z + CL / 2).wf, n = Math.max(1, Math.floor((w - 0.06) / (CW + 0.012)));
    for (let r = 0; r < n; r++) for (let tr = 0; tr < c.tiers; tr++) {
      const x0 = (r - (n - 1) / 2) * (CW + 0.012), sd = b * 131 + r * 17 + tr * 7 + (nome === 'estreito' ? 999 : 0);
      out.push({ x: x0, y: dy + tr * CH + CH / 2, z, b, r, n, tr, cor: COR[Math.floor(rnd(sd) * COR.length)], peso: tr < 3 ? 1 : tr < 6 ? 0.5 : 0 });
    }
  }
  return out;
}

// ---------------- mar ----------------
function oceano() {
  const N = 230, S = 300, g = new T3.PlaneGeometry(2, 2, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getZ(i), X = Math.sign(u) * u * u * S, Z = Math.sign(v) * v * v * S; p.setXYZ(i, X, 0, Z); uv.setXY(i, X / 7, Z / 7); }
  W3.ox = Float32Array.from({ length: p.count }, (_, i) => p.getX(i)); W3.oz = Float32Array.from({ length: p.count }, (_, i) => p.getZ(i));
  g.setAttribute('color', new T3.Float32BufferAttribute(new Float32Array(p.count * 3).fill(1), 3));
  const ag = textura('agua', GERA.agua);
  const m = new T3.MeshStandardMaterial({ color: 0x1b5a80, vertexColors: true, roughness: 0.16, metalness: 0.05, bumpMap: ag.bump, bumpScale: 0.6, clippingPlanes: [W3.corte] });
  const me = new T3.Mesh(g, m); me.receiveShadow = true; scene.add(me); W3.mar = me;
}
function onda(X, Z, t, A) {
  const f = A / (1 + Math.sqrt(X * X + Z * Z) / 70);
  return f * (0.55 * Math.sin(0.42 * X + 0.12 * Z + 1.15 * t) + 0.3 * Math.sin(-0.21 * X + 0.55 * Z + 1.6 * t + 1.3) + 0.15 * Math.sin(0.95 * X - 0.62 * Z + 2.4 * t));
}
function atualizaMar(t, A) {
  const g = W3.mar.geometry, p = g.attributes.position, c = g.attributes.color, a = p.array, ca = c.array, esp = new T3.Color(0xe9f2f6), az = new T3.Color(1, 1, 1);
  for (let i = 0; i < p.count; i++) {
    const X = W3.ox[i], Z = W3.oz[i], h = onda(X, Z, t, A); a[i * 3 + 1] = h;
    const f = A > 0.15 ? Math.pow(clamp((h / (A / (1 + Math.sqrt(X * X + Z * Z) / 70)) - 0.62) * 2.8), 2) * 0.6 : 0;
    // a cor multiplica o azul do material: espuma clareia ate quase branco
    ca[i * 3] = 1 + f * 4.2; ca[i * 3 + 1] = 1 + f * 1.9; ca[i * 3 + 2] = 1 + f * 1.1;
  }
  p.needsUpdate = true; c.needsUpdate = true; g.computeVertexNormals();
}

// ---------------- bancada do twist lock (escala real, metros) ----------------
function bancada() {
  const g = grupo(); g.position.copy(DET); W3.det = g;
  const chapa = tmat('chapa', { relevo: 0.8 });
  uvMundo(box(12, 0.2, 12, chapa, 0, -2.69, 0, g), 2);
  const corrug = c => new T3.MeshStandardMaterial({ map: textura('conteiner', GERA.conteiner).tx, bumpMap: textura('conteiner', GERA.conteiner).bump, bumpScale: 3, color: c, roughness: 0.6, metalness: 0.2 });
  const caixa = (cor, y0, z0) => {   // conteiner de 2,44 x 2,59 visto pela quina (x = largura, z = comprimento)
    const c = grupo(g); c.position.set(0, y0, z0);
    const m = corrug(cor), quina = mat(cor, { roughness: 0.55, metalness: 0.25 });
    const w = box(2.3, 2.45, 5.8, m, -1.22, 1.295, -2.95, c); w.material = m;
    for (const zz of [0, -5.9]) box(0.15, 2.59 - 0.24, 0.15, quina, -0.075, 1.295, zz - 0.075, c);
    box(0.15, 0.16, 5.9 - 0.17, quina, -0.075, 2.51, -2.95 - 0.085, c); box(0.15, 0.16, 5.9 - 0.17, quina, -0.075, 0.08, -2.95 - 0.085, c);
    box(2.44 - 0.19, 0.16, 0.15, quina, -1.22 - 0.095, 2.51, -0.075, c); box(2.44 - 0.19, 0.16, 0.15, quina, -1.22 - 0.095, 0.08, -0.075, c);
    return c;
  };
  W3.cxBaixo = caixa(0x2a6fb5, -2.59, 0);
  W3.cxCima = caixa(0xc0392b, 0, 0);
  // cantoneiras (corner castings): bloco de aço com furo oval; ficam semitransparentes na hora da trava
  W3.castMat = mat(0x5b5f63, { roughness: 0.45, metalness: 0.6, transparent: true, opacity: 1 });
  const furo = mat(0x0c0d0e, { roughness: 0.9 });
  const casting = (parent, y, topo) => {
    const c = grupo(parent); c.position.set(-0.09, y, -0.081);
    box(0.178, 0.118, 0.162, W3.castMat, 0, 0, 0, c);
    const f = cyl(0.031, 0.031, 0.004, furo, 24, c); f.scale.set(2, 1, 1); f.position.y = topo ? 0.06 : -0.06;
    const fl = cyl(0.03, 0.03, 0.004, furo, 24, c); fl.rotation.x = Math.PI / 2; fl.scale.set(1.6, 1, 1); fl.position.z = 0.082;
    const fs = cyl(0.03, 0.03, 0.004, furo, 24, c); fs.rotation.z = Math.PI / 2; fs.scale.set(1, 1, 1.4); fs.position.x = 0.09;
    return c;
  };
  W3.castB = casting(W3.cxBaixo, 2.59 - 0.059, true);
  W3.castC = casting(W3.cxCima, 0.059, false);
  // twist lock: placa do meio, cone de cima e de baixo (ovais) e alavanca
  const tl = grupo(g); W3.tl = tl;
  const zinco = mat(0xc9ccc4, { roughness: 0.35, metalness: 0.75, emissive: 0x000000 });
  W3.tlMat = zinco;
  const placa = box(0.15, 0.026, 0.13, zinco, 0, 0, 0, tl);
  W3.cones = [];
  for (const s of [1, -1]) {
    const cg = grupo(tl); cg.position.y = s * 0.013;
    const cone = new T3.Mesh(new T3.CylinderGeometry(s > 0 ? 0.018 : 0.028, s > 0 ? 0.028 : 0.018, 0.062, 24), zinco);
    cone.scale.set(1.95, 1, 1); cone.position.y = s * 0.031; cone.castShadow = true; cg.add(cone); W3.cones.push(cg);
  }
  const al = grupo(tl); W3.alavanca = al; al.position.set(0.075, 0, 0);
  box(0.16, 0.014, 0.022, zinco, 0.08, 0, 0, al);
  const pega = cyl(0.016, 0.016, 0.05, mat(0xe0b020, { roughness: 0.5 }), 12, al); pega.rotation.z = Math.PI / 2; pega.position.set(0.17, 0, 0);
  // pilha ao fundo (escala real) para o fundo do quadro nao ficar vazio
  for (let i = 0; i < 9; i++) { const cc = box(2.44, 2.59, 12.2, corrug(COR[(i * 5) % COR.length]), -4.2 - (i % 3) * 2.5, -1.3 + Math.floor(i / 3) * 2.6, -9, g); cc.castShadow = false; }
}

// ---------------- secao do corte (desenhada na frente do plano) ----------------
function retang(w, h, m, parent, x0, y0, z) {   // ancorado no canto de baixo-esquerda
  const g = new T3.PlaneGeometry(1, 1); g.translate(0.5, 0.5, 0);
  const me = new T3.Mesh(g, m); me.scale.set(w, h, 1); me.position.set(x0, y0, z); parent.add(me); return me;
}
function secao(nav) {
  const c = CASCOS.largo, g = grupo(nav); g.position.z = ZC + 0.012; W3.secao = g;
  const meia = meiaSecao(c), wf = forma(c, ZC).wf, T = c.T;
  const aco = mat(0x23303d, { roughness: 0.6, side: T3.DoubleSide }), porao = mat(0x9ea8b2, { roughness: 0.9, side: T3.DoubleSide });
  const ext = new T3.Shape(), int = new T3.Path(), e = 0.07;
  const full = []; for (let i = meia.length - 1; i >= 0; i--) full.push([-meia[i][0] * wf, meia[i][1]]); for (let i = 1; i < meia.length; i++) full.push([meia[i][0] * wf, meia[i][1]]);
  full.forEach(([px, py], i) => i ? ext.lineTo(px, py - T) : ext.moveTo(px, py - T));
  // casca interna (costado duplo): afastada e e do fundo
  const inner = full.map(([px, py]) => [Math.sign(px) * Math.max(0, Math.abs(px) - e), Math.max(e, py) ]);
  inner[0][1] = c.D - 0.001; inner[inner.length - 1][1] = c.D - 0.001;
  inner.forEach(([px, py], i) => i ? int.lineTo(px, py - T) : int.moveTo(px, py - T));
  ext.holes.push(int);
  const casca = new T3.Mesh(new T3.ShapeGeometry(ext, 12), aco); g.add(casca);
  const xi = c.B / 2 * wf - e;
  // fundo duplo: 3 tanques de lastro, com agua que sobe
  const fundo = 0.36, tq = mat(0x56606b, { roughness: 0.8, side: T3.DoubleSide });
  retang(2 * xi, fundo - e, tq, g, -xi, e - T, -0.002);
  W3.lastro = [];
  const agua = new T3.MeshStandardMaterial({ color: 0x2f8fd6, roughness: 0.2, emissive: 0x0b3352, side: T3.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const x0 = -xi + 0.02 + i * (2 * xi - 0.04) / 3, w = (2 * xi - 0.04) / 3 - 0.03;
    W3.lastro.push(retang(w, fundo - e - 0.04, agua, g, x0 + 0.015, e + 0.02 - T, 0.001));
  }
  for (const xx of [-xi + (2 * xi) / 3, -xi + 2 * (2 * xi) / 3]) retang(0.03, fundo - e, aco, g, xx - 0.015, e - T, 0.002);
  retang(2 * xi, 0.03, aco, g, -xi, fundo - T, 0.002);
  // tanques laterais (asas) ligados por um duto: tanque anti-rolagem em U
  const asa = 0.34, yA0 = fundo + 0.03, yA1 = c.D - 0.06;
  W3.asas = [];
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -xi : xi - asa;
    retang(asa, yA1 - yA0, tq, g, x0, yA0 - T, -0.002);
    retang(0.03, yA1 - yA0, aco, g, s < 0 ? x0 + asa : x0 - 0.03, yA0 - T, 0.002);
    W3.asas.push(retang(asa - 0.04, 1, agua, g, x0 + 0.02, yA0 + 0.02 - T, 0.001));
  }
  W3.duto = retang(2 * xi - 2 * asa, 0.1, agua, g, -xi + asa, yA0 - T, 0.001);
  W3.dutoAco = retang(2 * xi - 2 * asa, 0.03, aco, g, -xi + asa, yA0 + 0.1 - T, 0.002);
  // porao com conteineres vistos de frente (portas)
  retang(2 * (xi - asa) - 0.06, yA1 - yA0 - 0.12, porao, g, -xi + asa + 0.03, yA0 + 0.13 - T, -0.003);
  const nR = Math.floor((2 * (xi - asa) - 0.1) / (CW + 0.01)), nT = Math.floor((yA1 - yA0 - 0.16) / (CH + 0.006));
  for (let r = 0; r < nR; r++) for (let tr = 0; tr < nT; tr++) {
    const x0 = (r - (nR - 1) / 2) * (CW + 0.01) - CW / 2, y0 = yA0 + 0.15 + tr * (CH + 0.006) - T;
    const mm = mat(COR[Math.floor(rnd(r * 13 + tr * 5 + 3) * COR.length)], { roughness: 0.7, side: T3.DoubleSide });
    retang(CW, CH, mm, g, x0, y0, 0.0);
    retang(0.012, CH * 0.8, mat(0x000000, { transparent: true, opacity: 0.25 }), g, x0 + CW / 2 - 0.006, y0 + CH * 0.1, 0.001);
  }
  g.visible = false;
}

// ---------------- porto (YB015, primeira cena) ----------------
function porto() {
  const g = grupo(); W3.porto = g;
  const cais = tmat('concreto', { relevo: 1 });
  uvMundo(box(9, 1.4, 34, cais, -7.6, 0.1, -1, g), 2);
  const pilhas = new T3.InstancedMesh(new T3.BoxGeometry(CW, CH, CL), new T3.MeshStandardMaterial({ map: textura('conteiner', GERA.conteiner).tx, roughness: 0.6, metalness: 0.2 }), 420);
  const m4 = new T3.Matrix4(); let n = 0;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 12; j++) for (let k = 0; k < 4; k++) {
    if (n >= 420 || rnd(i * 7 + j * 3 + k) > 0.92 - k * 0.04) continue;
    m4.makeTranslation(-11.2 + i * (CW * 2 + 0.3) + (j % 2) * (CW + 0.02), 0.8 + k * CH + CH / 2, -12 + Math.floor(j / 2) * (CL + 0.15) * 2.1);
    pilhas.setMatrixAt(n, m4); pilhas.setColorAt(n, new T3.Color(COR[Math.floor(rnd(i * 5 + j * 11 + k) * COR.length)])); n++;
  }
  pilhas.count = n; pilhas.castShadow = pilhas.receiveShadow = true; g.add(pilhas);
  // guindaste de cais (portainer) estilizado
  const vm = mat(0x2f6db0, { roughness: 0.5, metalness: 0.3 });
  for (const zc of [-4, 5]) {
    for (const zz of [zc - 1.6, zc + 1.6]) for (const xx of [-6.8, -4.0]) box(0.25, 5.5, 0.25, vm, xx, 3.5, zz, g);
    for (const xx of [-6.8, -4.0]) box(0.4, 0.5, 3.6, vm, xx, 6.2, zc, g);
    box(10, 0.45, 0.45, vm, -2.6, 6.6, zc - 1.0, g); box(10, 0.45, 0.45, vm, -2.6, 6.6, zc + 1.0, g);
    box(0.9, 0.6, 0.8, mat(0xf1f1ec), -1.0, 6.1, zc, g);
  }
  g.visible = false;
}

// ---------------- monta ----------------
function monta() {
  gl.localClippingEnabled = true;
  ST.legendaY = 0.72;   // o navio ocupa o meio do quadro: legenda mais baixa
  W3.corte = new T3.Plane(new T3.Vector3(0, 0, -1), 1000);
  const ceu = new T3.Mesh(new T3.SphereGeometry(190, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new T3.MeshBasicMaterial({ map: textura('ceu', GERA.ceu).tx, side: T3.BackSide, fog: false }));
  ceu.material.map.repeat.set(3, 1); ceu.position.y = -2; scene.add(ceu); W3.ceu = ceu;
  scene.fog = new T3.Fog(0xc9dbe8, 45, 185);
  reflexos(0.75);
  scene.add(sun.target);
  sun.shadow.mapSize.set(2048, 2048);
  oceano();
  // dois navios: largo (porta-conteineres de verdade) e estreito (o primeiro, que vira)
  W3.nav = {};
  for (const nome of ['largo', 'estreito']) {
    const c = CASCOS[nome], nav = grupo();
    nav.add(casco(c, nome === 'largo' ? { fundo: 0x9c2f26, faixa: 0x1b1d20, costado: 0x1d3b5c, conves: 0x6f7a72 } : { fundo: 0x9c2f26, faixa: 0x1b1d20, costado: 0x2d5a40, conves: 0x6f7a72 }));
    equipa(nav, c, nome);
    const arr = arranjo(c, nome);
    const im = new T3.InstancedMesh(new T3.BoxGeometry(CW, CH, CL), new T3.MeshStandardMaterial({ map: textura('conteiner', GERA.conteiner).tx, bumpMap: textura('conteiner', GERA.conteiner).bump, bumpScale: 1.2, roughness: 0.62, metalness: 0.2, clippingPlanes: [W3.corte] }), arr.length);
    im.castShadow = im.receiveShadow = true; nav.add(im);
    arr.forEach((a, i) => im.setColorAt(i, new T3.Color(a.cor)));
    W3.nav[nome] = { g: nav, c, arr, im };
  }
  // conteineres soltos (caem no mar) e respingos
  W3.soltos = new T3.InstancedMesh(new T3.BoxGeometry(CW, CH, CL), new T3.MeshStandardMaterial({ map: textura('conteiner', GERA.conteiner).tx, roughness: 0.62, metalness: 0.2 }), 40);
  W3.soltos.castShadow = true; W3.soltos.count = 0; scene.add(W3.soltos);
  W3.gotas = new T3.InstancedMesh(new T3.SphereGeometry(0.026, 6, 4), new T3.MeshStandardMaterial({ color: 0xf2f7fa, roughness: 0.3, transparent: true, opacity: 0.8 }), 900);
  W3.gotas.count = 0; scene.add(W3.gotas);
  // barras de peacao (so no largo): instanciadas, em X nas pontas de cada pilha, nos vaos entre bays
  { const n = W3.nav.largo, c = n.c, dy = c.D - c.T + 0.09, rods = [[], []];
    for (const zl of W3.lbridges.largo) {
      const b = Math.round((zl - PASSO / 2 - ZB0) / PASSO), w = c.B * forma(c, ZB0 + b * PASSO + CL / 2).wf, nr = Math.max(1, Math.floor((w - 0.06) / (CW + 0.012)));
      for (const lado of [0, 1]) for (let r = 0; r < nr; r++) {
        const x0 = (r - (nr - 1) / 2) * (CW + 0.012), zf = zl + (lado ? 0.04 : -0.04);
        rods[lado].push([[x0 - CW / 2 + 0.02, dy + 0.27, zf], [x0 + CW / 2 - 0.02, dy + 2 * CH, zf]], [[x0 + CW / 2 - 0.02, dy + 0.27, zf], [x0 - CW / 2 + 0.02, dy + 2 * CH, zf]]);
      }
    }
    W3.rodMat = new T3.MeshStandardMaterial({ color: 0xd8dcdf, roughness: 0.3, metalness: 0.8, emissive: 0x000000, clippingPlanes: [W3.corte] });
    W3.rods = rods.map(lista => {   // [0] = face de vante de cada bay, [1] = face de re do bay seguinte
      const im = new T3.InstancedMesh(new T3.CylinderGeometry(0.009, 0.009, 1, 5), W3.rodMat, lista.length), m4 = new T3.Matrix4(), q = new T3.Quaternion();
      lista.forEach(([a, b], i) => { const A = new T3.Vector3(...a), B = new T3.Vector3(...b), d = B.clone().sub(A), Lr = d.length(); q.setFromUnitVectors(Y, d.normalize());
        m4.compose(A.clone().lerp(B, 0.5), q, new T3.Vector3(1, Lr, 1)); im.setMatrixAt(i, m4); });
      im.castShadow = true; n.g.add(im); return im; }); }
  // agua em corte: parede azul no plano do corte (so nas cenas de corte)
  { const gm = new T3.PlaneGeometry(140, 22, 1, 8); gm.translate(0, -11, 0); const cor = [], p = gm.attributes.position, a = new T3.Color(0x3a8cc4), b = new T3.Color(0x08243d);
    for (let i = 0; i < p.count; i++) { const c = a.clone().lerp(b, Math.pow(clamp(-p.getY(i) / 9), 0.7)); cor.push(c.r, c.g, c.b); }
    gm.setAttribute('color', new T3.Float32BufferAttribute(cor, 3));
    W3.parede = new T3.Mesh(gm, new T3.MeshBasicMaterial({ vertexColors: true, fog: false })); W3.parede.position.z = ZC + 0.004; scene.add(W3.parede); }
  secao(W3.nav.largo.g);
  bancada();
  porto();
}

// ---------------- estado por etapa (sem estado guardado: tudo de t e da etapa) ----------------
const ROT_CUR = ['abertura', 'mito', 'canto', 'trava', 'bloco', 'lashing', 'peso', 'onda', 'queda', 'fim'];
function pose(et, k, t, dur) {
  // devolve: navio, rolagem (rad), mar (amplitude), corte, camadas visiveis, G/M para o overlay
  const S = { nome: 'largo', roll: 0, A: 0.12, corte: false, tiers: 6, tempestade: 0, cheg: 0, afunda: 0, lastro: 0, antirol: 0, G: 0.82, ouro: 0 };
  const sec = k * dur;
  const bal = (amp, w, fase = 0) => amp * Math.sin(t * w + fase);
  switch (et) {
    // YB014
    case 'abertura': Object.assign(S, { tiers: 6, A: 0.32, tempestade: 1, roll: bal(0.16, 1.15) }); break;
    case 'mito': Object.assign(S, { tiers: 6, A: 0.2, tempestade: 0.6, roll: bal(0.06, 1.1) }); break;
    case 'bloco': Object.assign(S, { tiers: 6, A: 0.2, tempestade: 0.4, roll: 0.22 * Math.sin(sec * 1.3) * ease(k * 3) }); break;
    case 'lashing': Object.assign(S, { tiers: 6, A: 0.12, tempestade: 0.2, roll: bal(0.03, 1.0) }); break;
    case 'peso': Object.assign(S, { tiers: 6, A: 0.1, roll: bal(0.025, 1.0) }); break;
    case 'onda': Object.assign(S, { tiers: 6, A: 0.4, tempestade: 1, roll: 0.52 * Math.sin(sec * 1.1 - 0.4) * ease(k * 2.5) }); break;
    case 'queda': Object.assign(S, { tiers: 6, A: 0.42, tempestade: 1, roll: -0.5 * ease(clamp(k * 2.2)) + 0.08 * Math.sin(sec * 1.4) * ease(k * 2) }); break;
    case 'fim': Object.assign(S, { tiers: 6, A: 0.1, ouro: ease(k * 1.4), roll: bal(0.03, 0.9) }); break;
    // YB015
    case 'porto': Object.assign(S, { nome: 'estreito', tiers: 0, A: 0.06, cheg: 3 }); break;
    case 'estreito': Object.assign(S, { nome: 'estreito', tiers: Math.min(8, 8 * ease((k - 0.25) / 0.5)), A: 0.07, cheg: 0.6 * (1 - ease(k / 0.28)), roll: bal(0.02, 1.0) }); break;
    case 'vira': { const v = ease(clamp((k - 0.25) / 0.6)); Object.assign(S, { nome: 'estreito', tiers: 8, A: 0.08 + 0.4 * ease(k * 3), roll: -(0.12 * Math.sin(sec * 2.2) * (1 - v) + v * 2.75), afunda: v * 0.55 }); break; }
    case 'largo': Object.assign(S, { tiers: 2, A: 0.2, roll: 0.36 * Math.exp(-sec * 0.22) * Math.cos(sec * 0.95), G: 1.0 }); break;
    case 'alto': { const tt = 2 + 8 * ease(k / 0.45), v = ease(clamp((k - 0.45) / 0.5)); Object.assign(S, { tiers: tt, A: 0.18, roll: -v * 0.78 + 0.03 * Math.sin(t * 1.3), G: lerp(0.7, 1.95, ease(k / 0.45)) }); break; }
    case 'lastro': { const f = ease(clamp((k - 0.08) / 0.55)); Object.assign(S, { tiers: 10, A: 0.06, corte: true, lastro: f, roll: -0.78 * (1 - ease(clamp((k - 0.3) / 0.6))), G: lerp(1.95, 0.85, f) }); break; }
    case 'rola': Object.assign(S, { tiers: 10, A: 0.42, tempestade: 1, lastro: 1, G: 0.85, roll: (0.12 + 0.36 * k) * Math.sin(sec * 1.6) }); break;
    case 'antirol': Object.assign(S, { tiers: 10, A: 0.08, corte: true, lastro: 1, antirol: 1, G: 0.85, roll: 0.42 * Math.exp(-sec * 0.42) * Math.sin(sec * 1.6) }); break;
    case 'teste': { const emp = ease(clamp(k / 0.3)), solta = Math.max(0, sec - 0.3 * dur); Object.assign(S, { tiers: 10, A: 0.12, lastro: 1, G: 0.85,
      roll: k < 0.3 ? 0.52 * emp : 0.52 * Math.exp(-solta * 0.55) * Math.cos(solta * 1.9) }); break; }
    case 'final': Object.assign(S, { tiers: 10, A: 0.1, lastro: 1, ouro: ease(k * 1.4), roll: bal(0.03, 0.9) }); break;
    default: break;
  }
  return S;
}

// conteineres que caem: (indice no arranjo, atraso, direcao)
function caidos(et, nav) {
  if (et === 'queda') return nav.arr.map((a, i) => [a, i]).filter(([a]) => a.r === a.n - 1 && a.tr >= 3 && (a.b === 6 || a.b === 7)).map(([a, i], j) => ({ i, d: 0.38 + (a.tr - 3) * 0.04 + (a.b - 6) * 0.07 }));
  if (et === 'vira') return nav.arr.map((a, i) => [a, i]).filter(([a]) => a.tr >= 6 && (a.b % 3 === 1) && (a.r === 0 || a.r === a.n - 1)).map(([a, i]) => ({ i, d: 0.55 + rnd(i) * 0.15 }));
  return [];
}

function atualiza(t, ctx) {
  const p = ctx.p, et = p.etapa, k = ctx.lt, dur = ctx.t1 - ctx.t0;
  const S = pose(et, k, t, dur); W3.S = S; W3.et = et;
  const det = et === 'canto' || et === 'trava';
  atualizaMar(t, S.A);
  // clima: tempestade escurece, fim dourado
  const tp = S.tempestade, ouro = S.ouro;
  scene.fog.color.set(0xc9dbe8).lerp(new T3.Color(0x7d8b97), tp * 0.85).lerp(new T3.Color(0xf2c99a), ouro * 0.6);
  scene.fog.near = lerp(45, 22, tp); scene.fog.far = lerp(185, 110, tp);
  W3.ceu.material.color.set(0xffffff).lerp(new T3.Color(0x7e8892), tp * 0.75).lerp(new T3.Color(0xffd2a0), ouro * 0.55);
  sun.color.set(0xfff0d8).lerp(new T3.Color(0xffbf7a), ouro); sun.intensity = lerp(2.8, 1.25, tp) * lerp(1, 0.92, ouro);
  hemi.intensity = lerp(1.05, 0.8, tp); W3.mar.material.color.set(0x1b5a80).lerp(new T3.Color(0x2b4a5c), tp * 0.7);
  // sol e sombra seguem o foco
  const foco = det ? DET : new T3.Vector3(0, 0, 0);
  sun.position.set(foco.x - 12, foco.y + 20, foco.z + 15); sun.target.position.copy(foco); sun.target.updateMatrixWorld();
  const sc = det ? 3 : 14; Object.assign(sun.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc, near: 1, far: 70 }); sun.shadow.camera.updateProjectionMatrix();
  // corte
  W3.corte.constant = S.corte ? ZC : 1000;
  W3.secao.visible = S.corte; W3.parede.visible = S.corte;
  // navios
  for (const nome in W3.nav) {
    const n = W3.nav[nome], on = nome === S.nome && !det;
    n.g.visible = on; if (!on) continue;
    const heave = onda(0, 0, t, S.A) * 0.7 - S.afunda;
    n.g.position.set(S.cheg * 18, heave, 0); if (S.cheg > 2) n.g.visible = false;
    n.g.rotation.set(S.corte ? 0 : 0.012 * Math.sin(t * 0.9) * (1 + S.A * 4), 0, S.roll);
    n.g.updateMatrixWorld(true);
    // conteineres: camadas visiveis, pilhas que caem
    const m4 = new T3.Matrix4(), q = new T3.Quaternion(), v = new T3.Vector3(), um = new T3.Vector3(1, 1, 1), zero = new T3.Vector3(0, 0, 0);
    const cai = caidos(et, n), caiSet = new Map(cai.map(c => [c.i, c]));
    const tiers = S.tiers, c0n = n.c;
    n.arr.forEach((a, i) => {
      let y = a.y, s = 1;
      if (a.tr >= Math.ceil(tiers)) s = 0;
      else if (a.tr === Math.ceil(tiers) - 1 && tiers % 1 > 0) { const f = clamp((tiers % 1) * 1.7 - a.b / c0n.bays * 0.7); y += (1 - ease(f)) * 1.6; if (f <= 0) s = 0; }
      const c = caiSet.get(i);
      if (c && k > c.d) s = 0;
      if (et === 'lashing' && a.b > 5) s = 0;   // bays da frente somem para mostrar a face peada
      m4.compose(v.set(a.x, y, a.z), q.identity(), s ? um : zero); n.im.setMatrixAt(i, m4);
    });
    n.im.instanceMatrix.needsUpdate = true;
    // peso: pinta pesados de escuro e leves de claro
    if (nome === 'largo') {
      const fp = et === 'peso' ? ease(clamp((k - 0.15) * 3)) : 0, c0 = new T3.Color(), cP = new T3.Color(0x7a2418), cL = new T3.Color(0xf3e7c9);
      if (fp > 0 || W3.pintado) { n.arr.forEach((a, i) => { c0.set(a.cor); if (fp > 0) c0.lerp(a.tr < 3 ? cP : a.tr >= 4 ? cL : c0.clone(), fp * 0.8); n.im.setColorAt(i, c0); }); n.im.instanceColor.needsUpdate = true; W3.pintado = fp > 0; }
      // barras de peacao brilham na cena delas
      const br = et === 'lashing' ? 0.5 + 0.35 * Math.sin(t * 5) : 0; W3.rodMat.emissive.setRGB(br, br * 0.8, 0); W3.rodMat.color.set(br > 0 ? 0xffd23a : 0xd8dcdf);
      W3.rods[0].visible = S.tiers >= 2; W3.rods[1].visible = S.tiers >= 2 && et !== 'lashing';
    }
    // soltos: caem em mundo a partir da pose no instante da quebra
    let ns = 0, ng = 0;
    const g4 = new T3.Matrix4();
    for (const c of cai) {
      if (k <= c.d) continue;
      const a = n.arr[c.i], tq = c.d * dur, dt = (k - c.d) * dur;
      const S0 = pose(et, c.d, ctx.t0 + tq, dur), base = new T3.Object3D();
      base.position.set(0, onda(0, 0, ctx.t0 + tq, S0.A) * 0.7 - S0.afunda, 0); base.rotation.set(0, 0, S0.roll); base.updateMatrixWorld();
      const p0 = new T3.Vector3(a.x, a.y, a.z).applyMatrix4(base.matrixWorld), lado = Math.sign(p0.x) || -1;
      const vx = lado * (1.2 + rnd(c.i) * 0.8), vy = 0.6 + rnd(c.i * 3) * 0.5;
      let px = p0.x + vx * dt, py = p0.y + vy * dt - 4.9 * dt * dt, rz = S0.roll + lado * -1.8 * dt, rx = (rnd(c.i * 7) - 0.5) * dt;
      const sup = onda(px, a.z, t, S.A);
      if (py < sup - 0.08) { // no mar: flutua meio afundado e balanca
        const tImp = (vy + Math.sqrt(vy * vy + 2 * 4.9 * Math.max(0, p0.y - sup + 0.08))) / 9.8, di = dt - tImp;
        px = p0.x + vx * tImp + vx * 0.25 * (1 - Math.exp(-di)); py = sup - 0.06 - 0.05 * Math.min(1, di) + 0.02 * Math.sin(t * 2 + c.i);
        rz = S0.roll + lado * -1.8 * tImp + 0.1 * Math.sin(t * 1.3 + c.i); rx = (rnd(c.i * 7) - 0.5) * tImp;
        // respingo
        if (di < 1.2) for (let j = 0; j < 30 && ng < 900; j++) {
          const ang = rnd(c.i * 31 + j) * 6.28, vel = 0.8 + rnd(c.i * 17 + j) * 1.6, up = 1.6 + rnd(c.i * 5 + j) * 2.2;
          const gx = px + Math.cos(ang) * vel * di, gz = a.z + Math.sin(ang) * vel * di * 1.6, gy = sup + up * di - 4.9 * di * di;
          if (gy > sup - 0.1) { const es = 0.6 + rnd(c.i * 3 + j) * (1.4 - di); g4.makeScale(es, es, es).setPosition(gx, gy, gz); W3.gotas.setMatrixAt(ng++, g4); }
        }
      }
      q.setFromEuler(new T3.Euler(rx, 0, rz)); m4.compose(v.set(px, py, a.z), q, um); W3.soltos.setMatrixAt(ns, m4);
      W3.soltos.setColorAt(ns, new T3.Color(a.cor)); ns++;
    }
    W3.soltos.count = ns; W3.soltos.instanceMatrix.needsUpdate = true; if (W3.soltos.instanceColor) W3.soltos.instanceColor.needsUpdate = true;
    W3.gotas.count = ng; W3.gotas.instanceMatrix.needsUpdate = true;
  }
  if (det) { W3.soltos.count = 0; W3.gotas.count = 0; }
  // corte: lastro e tanque anti-rolagem
  if (S.corte) {
    W3.lastro.forEach(m => m.scale.y = Math.max(0.001, (0.36 - 0.07 - 0.04) * S.lastro));
    const sec = k * dur, ar = S.antirol, h0 = 0.55, osc = ar ? 0.32 * Math.exp(-sec * 0.42) * Math.sin(sec * 1.6 - 1.35) : 0;
    W3.asas.forEach((m, i) => { m.visible = ar > 0; m.scale.y = Math.max(0.02, h0 + (i ? -osc : osc)); });
    W3.duto.visible = W3.dutoAco.visible = ar > 0;
  }
  // bancada do twist lock
  W3.det.visible = det;
  if (det) {
    // trava: o twist lock desce no furo, o conteiner de cima pousa, a alavanca gira 90 graus e os cones viram
    const yCast = 0;  // topo do conteiner de baixo = y 0 do grupo
    let ytl = 0.4, ycx = 3.4, giro = 0, puxa = 0, xr = 0;
    if (et === 'canto') { ytl = 0.55 + Math.sin(t * 1.6) * 0.02; ycx = 4.5; }
    else {
      ytl = lerp(0.42, 0.013, ease(clamp(k / 0.22)));
      ycx = lerp(2.4, 0.026, ease(clamp((k - 0.22) / 0.3)));
      giro = ease(clamp((k - 0.56) / 0.18));
      puxa = k > 0.8 ? Math.max(0, Math.sin((k - 0.8) * 40)) * 0.012 * (1 - clamp((k - 0.95) * 20)) : 0;
      xr = clamp((k - 0.12) * 5) * (1 - clamp((k - 0.9) * 10));
    }
    W3.tl.position.set(-0.09, yCast + ytl, -0.081);
    W3.cxCima.position.y = ycx + puxa;
    W3.cones.forEach(c => c.rotation.y = giro * Math.PI / 2);
    W3.alavanca.rotation.y = -giro * Math.PI / 2;
    W3.castMat.opacity = 1 - 0.68 * xr; W3.castMat.depthWrite = xr < 0.1;
    const brilho = giro > 0.98 ? 0.35 + 0.2 * Math.sin(t * 8) : 0; W3.tlMat.emissive.setRGB(0, brilho, brilho * 0.4);
    W3.castMat.emissive = W3.castMat.emissive || new T3.Color(); W3.castMat.emissive.setRGB(et === 'canto' ? 0.25 + 0.2 * Math.sin(t * 5) : 0, et === 'canto' ? 0.18 + 0.14 * Math.sin(t * 5) : 0, 0);
  }
  W3.porto.visible = et === 'porto' || et === 'estreito';
}

// ---------------- camera ----------------
// [x, y, z, d, a, h]: olha para (x, y, z) de uma distancia d, angulo a em torno do eixo y (0 = de frente pela proa) e altura h
const CAM = {
  abertura: [0, 1.2, 0, 33, 0.78, 6.0], mito: [0.6, 1.6, 3.2, 9.5, 0.62, 1.8],
  canto: [-0.1, 0.0, 0, 1.25, 0.62, 0.42], trava: [-0.1, 0.05, 0, 1.15, 0.5, 0.18],
  bloco: [0, 1.4, 4, 14, 0.12, 1.2], lashing: [0.35, 1.05, ZB0 + 5 * PASSO + CL / 2, 4.0, 0.5, 0.45],
  peso: [-0.6, 1.6, 2.0, 9.5, 0.55, 1.4], onda: [0, 1.0, 4, 17, 0.12, 1.8], queda: [0.8, 1.0, 2.5, 15, 0.5, 2.0],
  fim: [0, 1.6, 0, 34, -0.68, 8.5],
  porto: [-5, 1.0, 0, 38, 0.9, 9.0], estreito: [0, 1.6, 2, 20, 0.55, 2.5], vira: [0, 0.8, 4, 17, 0.12, 1.4],
  largo: [0, 0.5, 4, 14, 0.08, 0.9], alto: [0, 1.6, 4, 17, 0.1, 1.0], lastro: [0, 0.7, ZC, 9, 0.0, 0.4],
  rola: [0, 1.0, 4, 17, 0.14, 1.8], antirol: [0, 0.7, ZC, 9, 0.0, 0.4], teste: [0, 1.0, 4, 16, 0.1, 1.2],
  final: [0, 1.6, 0, 36, -0.7, 8.5],
};
const DETS = new Set(['canto', 'trava']), CORTES = new Set(['lastro', 'antirol']);
function camera(t, ctx) {
  const de = j => { const p = ST.cenas[j].p || {}; const v = (CAM[p.etapa] || CAM.abertura).slice(); if (DETS.has(p.etapa)) { v[0] += DET.x; v[1] += DET.y; v[2] += DET.z; } return v; };
  const ant = ST.cenas[Math.max(0, ctx.i - 1)].p || {}, cur = ctx.p;
  const corte = DETS.has(ant.etapa) !== DETS.has(cur.etapa) || CORTES.has(ant.etapa) !== CORTES.has(cur.etapa);   // navio <-> bancada ou corte: corte seco
  const prev = de(Math.max(0, ctx.i - 1)), now = de(ctx.i), k = corte ? 1 : ease((t - ctx.t0) / 1.5);
  const v = now.map((c, j) => lerp(prev[j], c, k));
  const giro = cur.etapa === 'fim' || cur.etapa === 'final' ? ctx.lt * 0.5 : cur.etapa === 'abertura' ? -ctx.lt * 0.3 : 0;
  const ang = v[4] + giro + Math.sin(t * 0.2) * 0.012, d = v[3] * (1 - 0.03 * ctx.lt);
  cam.position.set(v[0] + Math.sin(ang) * d, v[1] + v[5], v[2] + Math.cos(ang) * d);
  cam.near = DETS.has(cur.etapa) ? 0.02 : 0.1; cam.updateProjectionMatrix();
  cam.lookAt(v[0], v[1], v[2]); cam.updateMatrixWorld();
}

// ---------------- overlay ----------------
function seta(x0, y0, x1, y1, cor, s = 1, larg = 14) {
  if (s <= 0.01) return;
  const ang = Math.atan2(y1 - y0, x1 - x0), Lx = Math.hypot(x1 - x0, y1 - y0) * s;
  x.save(); x.translate(x0, y0); x.rotate(ang); x.fillStyle = cor; x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(0, -larg / 2); x.lineTo(Lx - 34, -larg / 2); x.lineTo(Lx - 34, -larg * 1.8); x.lineTo(Lx, 0); x.lineTo(Lx - 34, larg * 1.8); x.lineTo(Lx - 34, larg / 2); x.lineTo(0, larg / 2); x.closePath();
  x.stroke(); x.fill(); x.restore();
}
function marca(px, py, letra, cor, s = 1) {   // ponto G / B / M: circulo com letra
  if (s <= 0.01) return;
  x.save(); x.translate(px, py); x.scale(s, s);
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.arc(3, 5, 34, 0, 7); x.fill();
  x.fillStyle = cor; x.beginPath(); x.arc(0, 0, 34, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#fff'; x.stroke();
  x.fillStyle = '#fff'; x.font = `900 40px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(letra, 0, 2); x.restore();
}
function local(g, px, py, pz) { const v = new T3.Vector3(px, py, pz).applyMatrix4(g.matrixWorld).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; }
function arco(cx, cy, r, a0, a1, cor, txt, s) {
  if (s <= 0.01) return;
  x.save(); x.globalAlpha = s; x.strokeStyle = cor; x.lineWidth = 8; x.setLineDash([18, 12]);
  x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.sin(a0) * r, cy - Math.cos(a0) * r); x.stroke();
  x.setLineDash([]); x.lineWidth = 10; x.beginPath(); x.arc(cx, cy, r * 0.8, -Math.PI / 2 + a0, -Math.PI / 2 + a1, a1 < a0); x.stroke(); x.restore();
  pill(cx + Math.sin((a0 + a1) / 2) * r * 0.8, cy - Math.cos((a0 + a1) / 2) * r * 0.8 - 70, txt, cor, COL.ink, 44, s);
}

function overlay(t, ctx) {
  const p = ctx.p, k = ctx.lt, S = W3.S, et = p.etapa;
  const ev = tipo => { const e = ST.eventos.find(e => e.tipo === tipo && e.t >= ctx.t0 - 0.3 && e.t < ctx.t1); return e ? clamp((t - e.t) * 3) : clamp((k - 0.55) * 3); };
  if (p.ruim) pill(W / 2, H * 0.14, p.ruim, COL.red, '#fff', 54, back(ev('erro')));
  if (p.bom) pill(W / 2, H * 0.14, p.bom, COL.green, '#fff', 58, back(ev('certo')));
  const nav = W3.nav[S.nome], g = nav.g, c = nav.c;
  const rot = (px, py, pz, txt, s, cor = 'rgba(255,255,255,0.94)', fg = COL.ink, tam = 34) => { const [a, b] = local(g, px, py, pz); pill(a, b, txt, cor, fg, tam, back(s)); };
  const dy = c.D - c.T + 0.09;
  if (et === 'abertura') rot(0, dy + 6 * CH + 0.5, 1.5, '6 HIGH ON DECK', clamp((k - 0.5) * 4));
  if (et === 'mito') {
    const [a, b] = local(g, CW * 2, dy + 3 * CH, 3.2 + 0.0);
    for (const [txt, dyy, d0] of [['GLUE', -90, 0.25], ['WELDING', 60, 0.55]]) {
      const s = back(clamp((k - d0) * 4)); if (s < 0.02) continue;
      pill(a, b + dyy, txt, 'rgba(255,255,255,0.94)', COL.ink, 40, s);
      x.save(); x.strokeStyle = COL.red; x.lineWidth = 12; x.lineCap = 'round'; x.globalAlpha = clamp((k - d0 - 0.1) * 5);
      x.beginPath(); x.moveTo(a - 110 * s, b + dyy - 34); x.lineTo(a + 110 * s, b + dyy + 34); x.stroke(); x.restore();
    }
  }
  if (et === 'canto') {
    W3.det.updateMatrixWorld(true);
    const [a, b] = local(W3.det, -0.09, 0.0, -0.08); pill(a - 40, b + 210, 'CORNER CASTING', 'rgba(255,210,58,0.96)', COL.ink, 38, back(clamp((k - 0.2) * 4)));
    seta(a - 40, b + 160, a - 10, b + 40, '#ffd23a', clamp((k - 0.3) * 4));
  }
  if (et === 'trava') {
    W3.det.updateMatrixWorld(true);
    const [a, b] = local(W3.det, -0.09 + 0.25, 0.013, -0.081);
    if (k > 0.5) pill(a + 40, b + 120, k < 0.76 ? 'TURN 90°' : 'LOCKED', k < 0.76 ? 'rgba(255,255,255,0.94)' : COL.green, k < 0.76 ? COL.ink : '#fff', 38, back(clamp((k - 0.52) * 5)));
  }
  if (et === 'bloco') {
    // pontos amarelos nas quinas de uma pilha: as travas
    const al = clamp((k - 0.1) * 3);
    if (al > 0) { x.save(); x.globalAlpha = al;
      const b0 = 5, xs = [-1, 1];
      const nr = nav.arr.filter(a => a.b === b0 && a.tr === 0).length, r0 = Math.floor(nr / 2);
      const a0 = nav.arr.find(a => a.b === b0 && a.r === r0 && a.tr === 0);
      for (let tr = 0; tr <= 6; tr++) for (const s of xs) {
        const [px, py] = local(g, a0.x + s * CW / 2, dy + tr * CH, a0.z + CL / 2);
        x.fillStyle = '#ffd23a'; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 4; x.beginPath(); x.arc(px, py, Math.max(0, 11 * back(clamp((k - 0.1 - tr * 0.04) * 5))), 0, 7); x.fill(); x.stroke();
      }
      const [qa, qb] = local(g, a0.x, dy + 6 * CH + 0.25, a0.z + CL / 2); pill(qa, qb - 40, 'ONE BLOCK', COL.green, '#fff', 40, back(clamp((k - 0.4) * 4)));
      x.restore(); }
  }
  if (et === 'peso') {
    const [h1, h2] = local(g, c.B / 2, dy + CH * 1.2, 2.6), [l1, l2] = local(g, c.B / 2, dy + CH * 5.3, 2.6);
    pill(Math.min(h1, W - 170), h2, 'HEAVY', '#7a2418', '#fff', 40, back(clamp((k - 0.3) * 4)));
    pill(Math.min(l1, W - 170), l2, 'LIGHT', '#f3e7c9', COL.ink, 40, back(clamp((k - 0.45) * 4)));
  }
  if (et === 'onda' || et === 'teste') {
    const [cx, cy] = local(g, 0, -c.T * 0.3, c.B > 2 ? L / 2 - 2 : 0);
    const ang = -S.roll, s = clamp((k - (et === 'teste' ? 0.08 : 0.35)) * 4) * (et === 'teste' ? 1 - clamp((k - 0.5) * 4) : 1);
    arco(cx, cy - 40, 360, 0, et === 'teste' ? -0.52 * ease(clamp(k / 0.3)) : -0.52, '#ffd23a', '30°', s);
  }
  if (et === 'queda') {
    const a = nav.arr.find(a => a.r === a.n - 1 && a.tr === 4 && a.b === 6);
    if (k > 0.05 && k < 0.42) {
      const [qa, qb] = local(g, a.x + CW / 2, a.y, a.z);
      const s = back(clamp((k - 0.06) * 6));
      pill(qa + 40, qb - 70, 'DECLARED 10 t', 'rgba(255,255,255,0.94)', COL.ink, 32, s);
      pill(qa + 40, qb + 10, 'ACTUAL 25 t', COL.red, '#fff', 36, back(clamp((k - 0.18) * 6)));
    }
  }
  if (et === 'estreito' || et === 'vira' || et === 'largo' || et === 'alto' || et === 'lastro' || et === 'antirol') {
    // G (centro de gravidade) e M (metacentro)
    const Mloc = S.nome === 'estreito' ? -c.T + 0.95 : -c.T + 1.75;
    const Gloc = S.nome === 'estreito' ? c.D - c.T + 0.75 : -c.T + S.G;
    const s = et === 'estreito' ? clamp((k - 0.75) * 5) : et === 'vira' ? 1 - clamp((k - 0.35) * 4) : 1;
    if (s > 0.01) {
      const [ga, gb] = local(g, 0, Gloc, S.corte ? ZC + 0.05 : L / 2 - 3);
      const [ma, mb] = local(g, 0, Mloc, S.corte ? ZC + 0.05 : L / 2 - 3);
      marca(ma, mb, 'M', '#2fa35a', back(s));
      marca(ga, gb, 'G', '#d6402f', back(s));
      if (et === 'largo') {
        // empuxo: B anda para o lado que afunda e empurra para cima; G puxa para baixo
        const [wa, wb] = local(g, -Math.sin(S.roll) * 2.6, -c.T * 0.62, L / 2 - 3);
        seta(wa, wb, wa, wb - 260, '#3fb0ff', clamp((k - 0.2) * 3)); marca(wa, wb, 'B', '#2f7fd6', back(clamp((k - 0.2) * 4)));
        seta(ga, gb + 40, ga, gb + 260, '#ff6a50', clamp((k - 0.3) * 3));
      }
      if (et === 'alto' || et === 'lastro') {
        const acima = Gloc > Mloc;
        pill(W / 2, H * 0.9, acima ? 'G ABOVE M = TIPS' : 'G BELOW M = STABLE', acima ? COL.red : COL.green, '#fff', 40, back(clamp((et === 'alto' ? k - 0.4 : k - 0.5) * 4)));
      }
      if (et === 'vira' && k < 0.35) pill(W / 2, H * 0.9, 'G ABOVE M', COL.red, '#fff', 40, back(clamp((k - 0.05) * 4)));
    }
    if (et === 'lastro') rot(0, -c.T + 0.17, ZC + 0.05, 'SEAWATER BALLAST', clamp((k - 0.15) * 4), 'rgba(255,255,255,0.94)', COL.ink, 32);
    if (et === 'antirol') {
      const [a, b] = local(g, c.B / 2 - 0.2, 0.15, ZC + 0.05); pill(a - 30, b - 140, 'SLOSHING WATER', 'rgba(255,255,255,0.94)', COL.ink, 32, back(clamp((k - 0.15) * 4)));
    }
  }
  if (et === 'porto') { const s = clamp((k - 0.3) * 4); if (s > 0) { const [a, b] = proj(-12, 3.0, -8); pill(a, b, 'THOUSANDS OF BOXES', 'rgba(255,255,255,0.94)', COL.ink, 34, back(s)); } }
}
MUNDO = { monta, atualiza, camera, overlay };
})();
