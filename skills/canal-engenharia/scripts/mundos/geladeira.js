// Mundo "geladeira": como a geladeira "faz frio" (ela tira calor). Dois lugares na mesma cena:
// a cozinha de verdade (x=0) e a geladeira em raio X com o circuito do gas refrigerante (x=60).
// Etapas: cozinha, calor, circuito, compressor, serpentina, valvula, evapora, ciclo, atras, final.
(() => {
const LOCAL = { cozinha: new T3.Vector3(0, 0, 0), raiox: new T3.Vector3(60, 0, 0) };
const ETAPA_LOCAL = { cozinha: 'cozinha', calor: 'raiox', circuito: 'raiox', compressor: 'raiox', serpentina: 'raiox', valvula: 'raiox',
  evapora: 'raiox', ciclo: 'raiox', atras: 'raiox', final: 'cozinha' };
const W3 = {};
const GW = 2.0, GH = 4.0, GD = 1.8;   // geladeira: largura, altura, profundidade (frente em z = +GD/2)
const QUENTE = new T3.Color(0xff3b1f), MORNO = new T3.Color(0xff9a2e), GELO = new T3.Color(0x2f8cff), FRIO = new T3.Color(0x8fd8ff), CINZA = new T3.Color(0x9fb4c8);

// ---------- texturas proprias ----------
function texAzulejo() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c2 = cv.getContext('2d');
  c2.fillStyle = '#d9d4cb'; c2.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) {
    const px = i * 64 + (j % 2) * 32, py = j * 32, k = 0.94 + rnd(i * 7 + j * 13) * 0.08;
    for (const ox of [0, -256]) {
      const g = c2.createLinearGradient(0, py, 0, py + 30); g.addColorStop(0, `rgb(${250 * k},${249 * k},${245 * k})`); g.addColorStop(1, `rgb(${232 * k},${231 * k},${226 * k})`);
      c2.fillStyle = g; c2.fillRect(px + ox + 2, py + 2, 60, 28);
      c2.fillStyle = 'rgba(255,255,255,0.6)'; c2.fillRect(px + ox + 4, py + 4, 56, 2);
    }
  }
  const tx = new T3.CanvasTexture(cv); tx.wrapS = tx.wrapT = T3.RepeatWrapping; tx.colorSpace = T3.SRGBColorSpace; return tx;
}
function texInox() {
  const n1 = fbm(61, 64, 3);
  const cv = pixels(256, (u, v) => { const k = 0.86 + n1(u * 0.05, v) * 0.1 + rnd(u * 3100 + v * 17) * 0.04; return [214 * k, 218 * k, 222 * k]; });
  const tx = new T3.CanvasTexture(cv); tx.colorSpace = T3.SRGBColorSpace; return tx;
}
const vidro = (cor, op) => new T3.MeshStandardMaterial({ color: cor, roughness: 0.2, metalness: 0.1, transparent: true, opacity: op, depthWrite: false });
function contorno(geo, cor, op, parent) {
  const l = new T3.LineSegments(new T3.EdgesGeometry(geo, 25), new T3.LineBasicMaterial({ color: cor, transparent: true, opacity: op }));
  parent.add(l); return l;
}

// ---------- comida (as mesmas pecas na cozinha e no raio X) ----------
function comida(parent, opaco) {
  const m = (c, o = {}) => opaco ? mat(c, o) : vidro(c, 0.85);
  const g = grupo(parent);
  const garrafa = (px, pz, cor) => { const b = cyl(0.11, 0.11, 0.55, m(cor, { roughness: 0.15 }), 16, g); b.position.set(px, 2.38, pz); const t = cyl(0.04, 0.06, 0.12, m(0xf4f4f4), 12, g); t.position.set(px, 2.71, pz); };
  garrafa(-0.6, 0.35, 0x3b9a4a); garrafa(-0.35, 0.3, 0xd9831f);
  box(0.32, 0.5, 0.3, m(0xf2f2ee), 0.45, 2.36, 0.15, g);                         // leite
  box(0.32, 0.12, 0.3, m(0x2f6fd6), 0.45, 2.66, 0.15, g);
  for (let i = 0; i < 4; i++) { const ma = new T3.Mesh(new T3.SphereGeometry(0.13, 18, 12), m(i % 2 ? 0xd6322a : 0xe8b22a, { roughness: 0.4 })); ma.position.set(-0.55 + i * 0.27, 1.43, 0.35 - (i % 2) * 0.12); ma.castShadow = true; g.add(ma); }
  const bolo = cyl(0.36, 0.36, 0.3, m(0xf1d6b0), 28, g); bolo.position.set(0.4, 1.47, 0.0);
  const cob = cyl(0.37, 0.37, 0.08, m(0xd2436a), 28, g); cob.position.set(0.4, 1.64, 0.0);
  box(0.9, 0.2, 0.5, m(0xcfe8ff), 0, 0.72, 0.25, g);                               // gaveta de verduras
  for (let i = 0; i < 3; i++) { const f = new T3.Mesh(new T3.IcosahedronGeometry(0.12, 1), m(0x4fb34a)); f.position.set(-0.25 + i * 0.25, 0.9, 0.25); g.add(f); }
  box(0.6, 0.3, 0.45, m(0xe9eef4), -0.3, 3.15, 0.1, g); box(0.4, 0.2, 0.4, m(0xc95b3a), 0.4, 3.1, 0.15, g);   // congelador
  return g;
}

// ---------- circuito do gas refrigerante (coordenadas locais: centro da base da geladeira) ----------
function serp(x0, x1, y0, dy, n, z) {  // serpentina: n fileiras horizontais
  const p = []; let a = x0, b = x1;
  for (let k = 0; k < n; k++) { const y = y0 + dy * k; p.push(new T3.Vector3(a, y, z), new T3.Vector3(b, y, z)); [a, b] = [b, a]; }
  return p;
}
const ZC = -GD / 2 - 0.14, ZE = -GD / 2 + 0.12;  // serpentina de tras (fora) e evaporador (na parede interna do congelador)
function trechos() {
  const comp = new T3.Vector3(0.45, 0.62, -0.55);
  const cond = serp(0.78, -0.78, 3.55, -0.36, 8, ZC);           // de cima para baixo, termina em x = 0.78
  const ult = cond[cond.length - 1];
  const capi = [];                                               // tubo capilar: espiral fina antes de subir
  for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 6; capi.push(new T3.Vector3(0.1 + Math.cos(a) * 0.12 - i * 0.02, 0.42 + Math.sin(a) * 0.12, ZC + 0.02)); }
  const evap = serp(-0.72, 0.72, 2.78, 0.26, 4, ZE);             // de baixo para cima, termina em x = -0.72 (4 fileiras)
  return [
    { nome: 'quente', r: 0.045, pts: [comp, new T3.Vector3(0.45, 0.62, ZC), new T3.Vector3(0.86, 1.2, ZC), new T3.Vector3(0.9, 3.4, ZC), cond[0]], cor: u => QUENTE.clone() },
    { nome: 'serpentina', r: 0.045, pts: cond, cor: u => QUENTE.clone().lerp(MORNO, u) },
    { nome: 'valvula', r: 0.022, pts: [ult, new T3.Vector3(0.5, 0.55, ZC), ...capi, new T3.Vector3(-0.85, 0.42, ZE - 0.05), new T3.Vector3(-0.88, 2.6, ZE), evap[0]], cor: u => MORNO.clone().lerp(GELO, clamp(u * 2.2 - 0.3)) },
    { nome: 'evaporador', r: 0.045, pts: evap, cor: u => GELO.clone().lerp(FRIO, u) },
    { nome: 'volta', r: 0.045, pts: [evap[evap.length - 1], new T3.Vector3(-0.9, 3.65, ZE), new T3.Vector3(-0.92, 1.0, ZE - 0.1), new T3.Vector3(0.2, 0.55, -0.55), comp], cor: u => FRIO.clone().lerp(CINZA, u) },
  ];
}
function tubo(tr, parent) {
  const curva = new T3.CatmullRomCurve3(tr.pts, false, 'centripetal');
  const N = Math.max(40, tr.pts.length * 18), R = 10, geo = new T3.TubeGeometry(curva, N, tr.r, R, false);
  const cores = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < geo.attributes.position.count; i++) { const c = tr.cor(Math.floor(i / (R + 1)) / N); cores.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new T3.BufferAttribute(cores, 3));
  const m = new T3.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.35, emissive: tr.cor(0.5), emissiveIntensity: 0.25 });
  const me = new T3.Mesh(geo, m); me.castShadow = true; parent.add(me);
  return { me, m, curva, len: curva.getLength(), tr };
}

function monta() {
  scene.add(sun.target);
  // ================= cozinha =================
  const C = LOCAL.cozinha;
  const az = texAzulejo(); az.repeat.set(5, 3);
  const parede = new T3.MeshStandardMaterial({ map: az, roughness: 0.35 });
  box(22, 9, 0.3, parede, C.x, 4.5, -1.35);
  for (const s of [-1, 1]) box(0.3, 9, 10, mat(0xe9e2d3), C.x + s * 11, 4.5, 3.5);
  uvMundo(box(22, 0.2, 12, tmat('madeira', { color: 0xc9a27a, relevo: 1 }), C.x, -0.1, 4.5), 2.2);
  // armarios e bancada dos dois lados
  const arm = mat(0x2f4a5c, { roughness: 0.55 }), tampo = tmat('concreto', { color: 0xf2efe8, relevo: 0.3 });
  for (const s of [-1, 1]) {
    box(4.6, 2.2, 1.6, arm, C.x + s * 3.9, 1.1, -0.45);
    uvMundo(box(4.8, 0.12, 1.75, tampo, C.x + s * 3.9, 2.26, -0.4), 2);
    box(4.6, 1.8, 0.9, arm, C.x + s * 3.9, 6.3, -0.85);
    for (let k = 0; k < 2; k++) box(0.5, 0.05, 0.05, mat(0xc8c8c8, { metalness: 0.7, roughness: 0.3 }), C.x + s * 3.9 + (k - 0.5) * 2.2, 1.8, 0.37);
  }
  { const v = box(0.9, 0.9, 0.1, vidro(0xa6d2ff, 0.5), C.x + 4.6, 2.85, -0.9); v.castShadow = false; }
  const caneca = cyl(0.14, 0.12, 0.3, mat(0xd9532c, { roughness: 0.5 })); caneca.position.set(C.x - 4.4, 2.47, -0.2);
  // geladeira de verdade, inox, porta com dobradica na esquerda
  const inox = new T3.MeshStandardMaterial({ map: texInox(), roughness: 0.32, metalness: 0.65 });
  const interno = mat(0xf6f7f8, { roughness: 0.6 });
  const g = grupo(); g.position.set(C.x, 0, 0); W3.gelaCozinha = g;
  box(GW, GH, 0.06, inox, 0, GH / 2, -GD / 2 + 0.03, g);
  for (const s of [-1, 1]) box(0.06, GH, GD, inox, s * (GW / 2 - 0.03), GH / 2, 0, g);
  box(GW, 0.06, GD, inox, 0, GH - 0.03, 0, g); box(GW, 0.25, GD, inox, 0, 0.125, 0, g);
  box(GW - 0.12, GH - 0.3, 0.03, interno, 0, GH / 2 + 0.1, -GD / 2 + 0.08, g);
  for (const y of [1.25, 2.05]) box(GW - 0.14, 0.03, GD - 0.3, vidro(0xdff1ff, 0.5), 0, y, 0, g);
  box(GW - 0.14, 0.05, GD - 0.2, interno, 0, 2.95, 0, g);
  comida(g, true);
  W3.luzGela = new T3.PointLight(0xe8f4ff, 0, 6, 1.2); W3.luzGela.position.set(0, 3.2, 0.5); g.add(W3.luzGela);
  W3.porta = grupo(g); W3.porta.position.set(-GW / 2, 0, GD / 2);
  box(GW, GH - 0.3, 0.12, inox, GW / 2, GH / 2 + 0.1, 0.06, W3.porta);
  box(GW - 0.2, GH - 0.5, 0.05, interno, GW / 2, GH / 2 + 0.1, -0.03, W3.porta);
  box(0.07, 1.6, 0.1, mat(0x30343a, { metalness: 0.6, roughness: 0.3 }), GW - 0.18, 2.4, 0.2, W3.porta);
  box(GW - 0.02, 0.02, 0.13, mat(0x2a2d31), GW / 2, 2.9, 0.06, W3.porta);   // risco entre congelador e geladeira
  // nevoa fria que escorre quando a porta abre
  W3.nevoa = [...Array(40)].map((_, i) => { const n = new T3.Mesh(new T3.SphereGeometry(0.25 + rnd(i) * 0.25, 10, 8), new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); scene.add(n); return n; });
  const teto = new T3.PointLight(0xffe2b8, 18, 40, 1.4); teto.position.set(C.x, 8, 4); scene.add(teto);

  // ================= geladeira em raio X =================
  const T = LOCAL.raiox;
  const chao = new T3.Mesh(new T3.CircleGeometry(16, 64), mat(0x161a22, { roughness: 0.9 })); chao.rotation.x = -Math.PI / 2; chao.position.set(T.x, 0, 0); chao.receiveShadow = true; scene.add(chao);
  const rx = grupo(); rx.position.copy(T); W3.rx = rx;
  const casca = new T3.Mesh(new T3.BoxGeometry(GW, GH, GD), vidro(0xbfd8ef, 0.1)); casca.position.y = GH / 2; rx.add(casca);
  contorno(casca.geometry, 0xcfe6ff, 0.7, casca);
  const div = new T3.Mesh(new T3.BoxGeometry(GW - 0.05, 0.08, GD - 0.05), vidro(0xcfe6ff, 0.25)); div.position.y = 2.95; rx.add(div); contorno(div.geometry, 0xcfe6ff, 0.5, div);
  for (const y of [1.25, 2.05]) { const p = new T3.Mesh(new T3.BoxGeometry(GW - 0.1, 0.02, GD - 0.3), vidro(0xcfe6ff, 0.18)); p.position.y = y; rx.add(p); }
  comida(rx, true);
  // compressor: a "bomba" preta no fundo de baixo
  W3.compressor = grupo(rx); W3.compressor.position.set(0.45, 0.32, -0.55);
  const cp = cyl(0.26, 0.28, 0.42, mat(0x22252b, { roughness: 0.35, metalness: 0.5 }), 28, W3.compressor);
  const dom = new T3.Mesh(new T3.SphereGeometry(0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), cp.material); dom.position.y = 0.21; W3.compressor.add(dom);
  W3.compMat = cp.material;
  W3.tubos = trechos().map(tr => tubo(tr, rx));
  W3.total = W3.tubos.reduce((s, t) => s + t.len, 0);
  // bolinhas do gas correndo pelo circuito
  const bg = new T3.SphereGeometry(0.055, 10, 8);
  W3.gotas = [...Array(90)].map(() => { const me = new T3.Mesh(bg, new T3.MeshBasicMaterial({ color: 0xffffff })); rx.add(me); return me; });
  // calor: particulas vermelhas (da comida para o evaporador, da serpentina para o ar)
  const pg = new T3.SphereGeometry(0.07, 10, 8);
  const brilho = cor => new T3.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.9, depthWrite: false, blending: T3.AdditiveBlending });
  W3.calorDentro = [...Array(36)].map(() => { const me = new T3.Mesh(pg, brilho(0xff3a12)); rx.add(me); return me; });
  W3.calorFora = [...Array(60)].map(() => { const me = new T3.Mesh(pg, brilho(0xff4a14)); rx.add(me); return me; });
  // piso de estudio com grade fraca e um fundo em degrade para dar profundidade
  const grade = new T3.GridHelper(30, 30, 0x2c3a4e, 0x1f2938); grade.position.set(T.x, 0.005, 0); scene.add(grade);
  const fundo = new T3.Mesh(new T3.CircleGeometry(9, 48), new T3.MeshBasicMaterial({ color: 0x1b2a40, transparent: true, opacity: 0.55, depthWrite: false }));
  fundo.position.set(T.x, 0.01, 0); fundo.rotation.x = -Math.PI / 2; scene.add(fundo);
  const rim = new T3.DirectionalLight(0x9cc8ff, 1.2); rim.position.set(T.x + 6, 6, -8); rim.target = rx; scene.add(rim);
  W3.brilhoComp = new T3.PointLight(0xff5a2a, 0, 4, 1.5); W3.brilhoComp.position.set(0.45, 0.6, -0.9); rx.add(W3.brilhoComp);
  W3.brilhoFrio = new T3.PointLight(0x5ab0ff, 0, 4, 1.5); W3.brilhoFrio.position.set(0, 3.3, -0.4); rx.add(W3.brilhoFrio);
}

// ponto do circuito inteiro em u (0..1, por comprimento) e a cor do gas ali
function noCircuito(u) {
  let s = u * W3.total;
  for (const t of W3.tubos) { if (s <= t.len) { const k = s / t.len; return { p: t.curva.getPointAt(k), c: t.tr.cor(k), nome: t.tr.nome }; } s -= t.len; }
  const t = W3.tubos.at(-1); return { p: t.curva.getPointAt(1), c: t.tr.cor(1), nome: t.tr.nome };
}
const FOCO = { compressor: 'quente', serpentina: 'serpentina', valvula: 'valvula', evapora: 'evaporador' };

function atualiza(t, ctx) {
  const et = ctx.p.etapa, k = ctx.lt, lugar = ETAPA_LOCAL[et], centro = LOCAL[lugar];
  sun.position.set(centro.x - 6, 14, centro.z + 12); sun.target.position.set(centro.x, 1.5, 0);
  scene.background = new T3.Color(lugar === 'cozinha' ? 0xe9e2d3 : 0x0e1118);
  hemi.intensity = lugar === 'cozinha' ? 0.9 : 0.55; sun.intensity = lugar === 'cozinha' ? 2.0 : 1.6;
  // ---- cozinha: porta abre no comeco e fecha no fim ----
  let abre = 0;
  if (et === 'cozinha') abre = ease((k - 0.15) * 2.5) * 1.9;
  if (et === 'final') abre = 1.9 * (1 - ease((k - 0.35) * 2.2));
  W3.porta.rotation.y = -abre;
  W3.luzGela.intensity = 6 * clamp(abre);
  W3.nevoa.forEach((n, i) => {
    const vida = ((t * 0.35 + rnd(i * 3.7)) % 1), a = clamp(abre - 0.5) * (1 - vida) * 0.35;
    n.position.set(LOCAL.cozinha.x + (rnd(i * 1.3) - 0.5) * 1.6, 2.6 - vida * 2.5 - rnd(i) * 0.3, GD / 2 + 0.2 + vida * 1.2 + rnd(i * 2.1) * 0.3);
    n.scale.setScalar(0.6 + vida * 1.4); n.material.opacity = a;
  });
  // ---- raio X ----
  const foco = FOCO[et], todos = ['circuito', 'ciclo', 'calor', 'atras'].includes(et);
  W3.tubos.forEach(tb => {
    const on = todos || tb.tr.nome === foco || (et === 'evapora' && tb.tr.nome === 'valvula' && false);
    tb.m.emissiveIntensity = on ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 6)) : 0.08;
    tb.m.opacity = 1;
  });
  const vel = et === 'ciclo' ? 0.09 : 0.05, mostra = et !== 'calor';
  W3.gotas.forEach((gt, i) => {
    const u = ((i / W3.gotas.length) + t * vel) % 1, q = noCircuito(u);
    gt.visible = mostra; gt.position.copy(q.p); gt.material.color.copy(q.c).multiplyScalar(1.25);
    const destaque = !foco || q.nome === foco; gt.scale.setScalar(destaque ? 1.15 : 0.6);
  });
  const quente = 0.5 + 0.5 * Math.sin(t * 3);
  W3.compMat.emissive = new T3.Color(et === 'compressor' ? 0x5a1206 : 0x000000);
  W3.compressor.position.y = 0.32 + (et === 'compressor' ? Math.sin(t * 60) * 0.006 : 0);
  W3.brilhoComp.intensity = ['compressor', 'serpentina', 'atras', 'ciclo'].includes(et) ? 3 + quente * 2 : 0;
  W3.brilhoFrio.intensity = ['valvula', 'evapora', 'ciclo'].includes(et) ? 3 : 0;
  // calor da comida subindo ate o evaporador (o gas gelado "bebe" esse calor)
  const dentro = ['calor', 'evapora', 'ciclo'].includes(et);
  W3.calorDentro.forEach((p, i) => {
    const vida = (t * 0.45 + rnd(i * 5.1)) % 1, ox = (rnd(i * 2.3) - 0.5) * 1.4, oy = 1.4 + rnd(i * 1.9) * 1.3, oz = 0.1 + rnd(i * 3.3) * 0.4;
    p.visible = dentro;
    p.position.set(lerp(ox, ox * 0.6, vida), lerp(oy, 3.1, ease(vida)), lerp(oz, ZE + 0.05, ease(vida)));
    p.material.opacity = 0.9 * Math.sin(vida * Math.PI); p.scale.setScalar(0.7 + 0.5 * Math.sin(vida * Math.PI));
  });
  // calor saindo da serpentina de tras para a cozinha (sobe ondulando)
  const fora = ['calor', 'serpentina', 'atras', 'ciclo'].includes(et);
  W3.calorFora.forEach((p, i) => {
    const vida = (t * 0.3 + rnd(i * 7.7)) % 1, ox = (rnd(i * 4.1) - 0.5) * 1.6;
    p.visible = fora;
    p.position.set(ox + Math.sin(vida * 9 + i) * 0.12, 0.6 + vida * 4.2 + rnd(i) * 0.3, ZC - 0.15 - vida * 1.1);
    p.material.opacity = 0.75 * Math.sin(vida * Math.PI); p.scale.setScalar(0.6 + vida * 1.2);
  });
}

// camera: [alvo y, distancia, altura, angulo]; troca de lugar = corte seco com zoom
const CAM = {
  cozinha: { y: 2.3, d: 9.5, h: 0.6, a: 0.12 }, calor: { y: 2.1, d: 7.0, h: 1.1, a: 0.95 }, circuito: { y: 2.0, d: 6.6, h: 0.9, a: 2.35 },
  compressor: { y: 0.75, d: 4.0, h: 0.8, a: 2.5 }, serpentina: { y: 2.1, d: 6.0, h: 0.4, a: 2.85 }, valvula: { y: 0.55, d: 3.2, h: 0.5, a: 3.4 },
  evapora: { y: 2.9, d: 5.0, h: 0.5, a: 0.55 }, ciclo: { y: 2.0, d: 7.2, h: 1.4, a: 1.9 }, atras: { y: 2.3, d: 6.6, h: 0.3, a: 3.05 },
  final: { y: 2.3, d: 9.0, h: 0.5, a: 0.08 },
};
function camera(t, ctx) {
  const cfg = j => { const e = (ST.cenas[j].p || {}).etapa; return { ...CAM[e], c: LOCAL[ETAPA_LOCAL[e]] }; };
  const cur = cfg(ctx.i), prev = cfg(Math.max(0, ctx.i - 1)), corte = prev.c !== cur.c;
  const k = corte ? 1 : ease((t - ctx.t0) / 1.4), L = (a, b) => lerp(a, b, k);
  const d = L(prev.d, cur.d) * (1 - 0.06 * ctx.lt), a = L(prev.a, cur.a) + ctx.lt * 0.08, h = L(prev.h, cur.h), y = L(prev.y, cur.y);
  const zoom = corte ? 1 + 0.6 * Math.max(0, 1 - (t - ctx.t0) / 0.35) : 1;
  cam.position.set(cur.c.x + Math.sin(a) * d * zoom, y + h * zoom, cur.c.z + Math.cos(a) * d * zoom);
  cam.lookAt(cur.c.x, y, cur.c.z); cam.updateMatrixWorld();
  W3.flash = corte && ctx.i > 0 ? Math.max(0, 1 - (t - ctx.t0) / 0.3) : 0;
}
function overlay(t, ctx) {
  if (W3.flash > 0) { x.fillStyle = `rgba(255,255,255,${0.7 * W3.flash})`; x.fillRect(0, 0, W, H); }
  const et = ctx.p.etapa, s = back((t - ctx.t0) * 3), s2 = back((t - ctx.t0) * 3 - 0.6), T = LOCAL.raiox, branco = 'rgba(255,255,255,0.92)';
  const em = (px, py, pz) => proj(T.x + px, py, T.z + pz);
  if (et === 'cozinha') { const e = E.since(t, 'erro'); if (e >= 0) pill(W / 2, 300, 'Makes cold?  ✗', COL.red, '#fff', 46, back(e * 3)); }
  if (et === 'calor') { pill(W / 2, 300, 'It moves heat', COL.yellow, COL.ink, 46, s); }
  if (et === 'circuito') { pill(W / 2, 300, 'Refrigerant loop', branco, COL.ink, 44, s); }
  if (et === 'compressor') { const [px, py] = em(0.45, 0.2, -0.55); pill(px, Math.min(H - 420, py + 90), 'Compressor', branco, COL.ink, 42, s); pill(W / 2, 300, 'Squeezed = HOT', COL.red, '#fff', 44, s2); }
  if (et === 'serpentina') { pill(W / 2, 300, 'Heat goes out', COL.red, '#fff', 44, s); }
  if (et === 'valvula') { pill(W / 2, 300, 'Tiny tube', branco, COL.ink, 44, s); pill(W / 2, 400, 'ICE COLD', '#2f8cff', '#fff', 44, s2); }
  if (et === 'evapora') { pill(W / 2, 300, 'Soaks up heat', '#2f8cff', '#fff', 44, s); }
  if (et === 'atras') { pill(W / 2, 300, "Your food's heat", COL.red, '#fff', 44, s); }
}
MUNDO = { monta, atualiza, camera, overlay };
})();
