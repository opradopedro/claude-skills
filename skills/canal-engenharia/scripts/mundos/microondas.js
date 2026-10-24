// Mundo "microondas": como o micro-ondas esquenta a comida (e por que nao e "de dentro para fora").
// Cinco lugares na mesma cena: cozinha (x=0), micro-ondas em raio X (x=60), moleculas de agua (x=120),
// batata cortada ao meio (x=180) e a tela da porta de perto (x=240).
// Etapas: cozinha, abre, magnetron, ondas, molecula, gira, calor, batata, porta, final.
(() => {
const LOCAL = { cozinha: new T3.Vector3(0, 0, 0), raiox: new T3.Vector3(60, 0, 0), agua: new T3.Vector3(120, 0, 0), batata: new T3.Vector3(180, 0, 0), porta: new T3.Vector3(240, 0, 0) };
const ETAPA_LOCAL = { cozinha: 'cozinha', abre: 'cozinha', magnetron: 'raiox', ondas: 'raiox', molecula: 'agua', gira: 'agua', calor: 'agua', batata: 'batata', porta: 'porta', final: 'cozinha' };
const W3 = {};
const MW = 2.8, MH = 1.6, MD = 1.9, CAV = 1.9;   // micro-ondas: largura, altura, profundidade; largura da cavidade (o resto e o painel)
const BANCADA = 2.3;                              // altura do tampo onde ele fica

const vidro = (cor, op) => new T3.MeshStandardMaterial({ color: cor, roughness: 0.2, metalness: 0.1, transparent: true, opacity: op, depthWrite: false });
const brilho = (cor, op = 0.9) => new T3.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, depthWrite: false, blending: T3.AdditiveBlending });
function contorno(geo, cor, op, parent) {
  const l = new T3.LineSegments(new T3.EdgesGeometry(geo, 25), new T3.LineBasicMaterial({ color: cor, transparent: true, opacity: op }));
  parent.add(l); return l;
}
function texTela(furo = 7, passo = 16, tam = 512) {   // chapa perfurada da porta (furos pretos num fundo metalico)
  const cv = document.createElement('canvas'); cv.width = cv.height = tam; const c2 = cv.getContext('2d');
  c2.fillStyle = '#8d939b'; c2.fillRect(0, 0, tam, tam);
  for (let j = 0; j < tam / passo; j++) for (let i = 0; i < tam / passo + 1; i++) {
    c2.fillStyle = '#07080a'; c2.beginPath(); c2.arc(i * passo + (j % 2) * passo / 2, j * passo + passo / 2, furo / 2, 0, 7); c2.fill();
  }
  const tx = new T3.CanvasTexture(cv); tx.wrapS = tx.wrapT = T3.RepeatWrapping; tx.colorSpace = T3.SRGBColorSpace; return tx;
}
function texAzulejo() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c2 = cv.getContext('2d');
  c2.fillStyle = '#cfc8bb'; c2.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const k = 0.9 + rnd(i * 5 + j * 11) * 0.1, g = c2.createLinearGradient(0, j * 64, 0, j * 64 + 62);
    g.addColorStop(0, `rgb(${92 * k},${140 * k},${132 * k})`); g.addColorStop(1, `rgb(${70 * k},${116 * k},${110 * k})`);
    c2.fillStyle = g; c2.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); c2.fillStyle = 'rgba(255,255,255,0.25)'; c2.fillRect(i * 64 + 5, j * 64 + 5, 54, 3);
  }
  const tx = new T3.CanvasTexture(cv); tx.wrapS = tx.wrapT = T3.RepeatWrapping; tx.colorSpace = T3.SRGBColorSpace; return tx;
}
let GLOW = null;
function pontosBrilho(n, cor, tam) {   // fita de pontos luminosos (linha do WebGL tem 1 px; assim a onda tem corpo)
  if (!GLOW) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c2 = cv.getContext('2d'), g = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c2.fillStyle = g; c2.fillRect(0, 0, 64, 64); GLOW = new T3.CanvasTexture(cv);
  }
  const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(new Float32Array(n * 3), 3));
  return new T3.Points(geo, new T3.PointsMaterial({ color: cor, size: tam, map: GLOW, transparent: true, depthWrite: false, blending: T3.AdditiveBlending }));
}
function tigela(parent) {
  const g = grupo(parent);
  const pts = [[0, 0], [0.32, 0], [0.42, 0.06], [0.52, 0.32], [0.55, 0.4], [0.5, 0.4], [0.47, 0.33], [0.38, 0.1], [0, 0.1]].map(([a, b]) => new T3.Vector2(a, b));
  const me = new T3.Mesh(new T3.LatheGeometry(pts, 40), mat(0xf2f0ea, { roughness: 0.35 })); me.castShadow = me.receiveShadow = true; g.add(me);
  W3.sopaMat = mat(0xd8752c, { roughness: 0.4 });
  const sopa = cyl(0.47, 0.47, 0.02, W3.sopaMat, 40, g); sopa.position.y = 0.32;
  return g;
}
// micro-ondas inteiro; "transparente" deixa a carcaca de vidro e mostra magnetron, guia de onda e cavidade
function microondas(parent, transparente) {
  const g = grupo(parent);
  const corpo = transparente ? vidro(0xcfd8e4, 0.1) : mat(0xe9e9e6, { roughness: 0.4, metalness: 0.2 });
  const cx = -MW / 2 + CAV / 2;
  if (transparente) {
    const c = new T3.Mesh(new T3.BoxGeometry(MW, MH, MD), corpo); c.position.y = MH / 2; g.add(c); contorno(c.geometry, 0xd6e6ff, 0.6, c);
    const cav = new T3.Mesh(new T3.BoxGeometry(CAV - 0.1, MH - 0.2, MD - 0.2), vidro(0x8a96a8, 0.12)); cav.position.set(cx, MH / 2, 0); g.add(cav); contorno(cav.geometry, 0xaab8cc, 0.5, cav);
  } else {
    box(MW, 0.08, MD, corpo, 0, MH - 0.04, 0, g); box(MW, 0.08, MD, corpo, 0, 0.04, 0, g); box(0.08, MH, MD, corpo, -MW / 2 + 0.04, MH / 2, 0, g);
    box(0.08, MH, MD, corpo, MW / 2 - 0.04, MH / 2, 0, g); box(MW, MH, 0.08, corpo, 0, MH / 2, -MD / 2 + 0.04, g);
    box(0.06, MH - 0.1, MD - 0.1, corpo, -MW / 2 + CAV + 0.03, MH / 2, 0, g);
    const interno = mat(0xc9ccd1, { roughness: 0.5, metalness: 0.4 });
    box(CAV - 0.12, MH - 0.16, 0.02, interno, cx, MH / 2, -MD / 2 + 0.09, g);
    // painel com botoes e visor
    const pn = mat(0x2a2d33, { roughness: 0.35 }); box(MW - CAV - 0.1, MH - 0.12, 0.04, pn, MW / 2 - (MW - CAV) / 2, MH / 2, MD / 2 - 0.02, g);
    W3.visor = box(0.6, 0.18, 0.02, new T3.MeshBasicMaterial({ color: 0x46ff8a }), MW / 2 - (MW - CAV) / 2, MH - 0.3, MD / 2 + 0.01, g);
    for (let i = 0; i < 9; i++) box(0.16, 0.1, 0.03, mat(0x8a8f98), MW / 2 - (MW - CAV) / 2 + ((i % 3) - 1) * 0.22, MH - 0.6 - Math.floor(i / 3) * 0.17, MD / 2 + 0.01, g);
  }
  // prato giratorio e tigela
  W3[transparente ? 'pratoRx' : 'prato'] = grupo(g);
  const prato = W3[transparente ? 'pratoRx' : 'prato']; prato.position.set(cx, 0.12, 0);
  cyl(0.72, 0.72, 0.03, vidro(0xe8f4ff, 0.55), 48, prato);
  tigela(prato).position.y = 0.02;
  return g;
}
function moleculaAgua(m_o, m_h) {
  const g = new T3.Group();
  const o = new T3.Mesh(new T3.SphereGeometry(0.42, 28, 20), m_o); o.castShadow = true; g.add(o);
  const ang = 104.5 / 2 * Math.PI / 180;
  for (const s of [-1, 1]) { const h = new T3.Mesh(new T3.SphereGeometry(0.26, 24, 16), m_h); h.position.set(Math.sin(ang) * 0.5 * s, -Math.cos(ang) * 0.5, 0); h.castShadow = true; g.add(h); }
  return g;
}

function monta() {
  scene.add(sun.target);
  // ================= cozinha =================
  const C = LOCAL.cozinha;
  const az = texAzulejo(); az.repeat.set(7, 3);
  box(20, 8, 0.3, new T3.MeshStandardMaterial({ map: az, roughness: 0.3 }), C.x, 4, -1.4);
  uvMundo(box(20, 0.2, 12, tmat('madeira', { color: 0x8f6a4a, relevo: 1 }), C.x, -0.1, 4), 2.2);
  const arm = mat(0xf1ede4, { roughness: 0.5 }), tampo = tmat('rocha', { color: 0x9a9690, relevo: 0.4 });
  box(16, BANCADA - 0.1, 1.8, arm, C.x, (BANCADA - 0.1) / 2, -0.4);
  uvMundo(box(16.2, 0.1, 2.0, tampo, C.x, BANCADA - 0.05, -0.35), 2.5);
  for (let i = -3; i <= 3; i++) box(0.04, 0.9, 0.03, mat(0xb8a98e), C.x + i * 2.2, 1.3, 0.52);
  box(16, 1.8, 0.9, arm, C.x, 6.3, -0.9);
  W3.mo = microondas(scene, false); W3.mo.position.set(C.x, BANCADA, -0.25);
  W3.porta = grupo(W3.mo); W3.porta.position.set(-MW / 2, 0, MD / 2);
  const tela = texTela(); tela.repeat.set(4, 2.4);
  const telaMat = new T3.MeshStandardMaterial({ map: tela, roughness: 0.5, metalness: 0.4, transparent: true, opacity: 0.82 });
  box(CAV, MH, 0.08, mat(0xe9e9e6, { roughness: 0.4, metalness: 0.2 }), CAV / 2, MH / 2, 0.04, W3.porta).material = [mat(0xe9e9e6), mat(0xe9e9e6), mat(0xe9e9e6), mat(0xe9e9e6), telaMat, mat(0xe9e9e6)];
  W3.luzDentro = new T3.PointLight(0xffd9a0, 0, 4, 1.4); W3.luzDentro.position.set(-MW / 2 + CAV / 2, MH - 0.3, 0.1); W3.mo.add(W3.luzDentro);
  const caneca = cyl(0.17, 0.15, 0.36, mat(0x2f6fd6, { roughness: 0.4 })); caneca.position.set(C.x + 2.6, BANCADA + 0.18, 0);
  const pao = new T3.Mesh(new T3.SphereGeometry(0.3, 20, 12), mat(0xc98b45, { roughness: 0.8 })); pao.scale.set(1.4, 0.7, 1); pao.position.set(C.x - 2.5, BANCADA + 0.18, 0.1); pao.castShadow = true; scene.add(pao);
  const teto = new T3.PointLight(0xffe2b8, 14, 30, 1.4); teto.position.set(C.x, 7, 4); scene.add(teto);
  // vapor que sobe da tigela
  W3.vapor = [...Array(24)].map((_, i) => { const n = new T3.Mesh(new T3.SphereGeometry(0.12, 10, 8), new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); scene.add(n); return n; });

  // ================= raio X =================
  const R = LOCAL.raiox;
  const chao = new T3.Mesh(new T3.CircleGeometry(14, 64), mat(0x141820, { roughness: 0.9 })); chao.rotation.x = -Math.PI / 2; chao.position.set(R.x, 0, 0); chao.receiveShadow = true; scene.add(chao);
  const grade = new T3.GridHelper(24, 24, 0x2c3a4e, 0x1d2634); grade.position.set(R.x, 0.005, 0); scene.add(grade);
  W3.rx = microondas(scene, true); W3.rx.position.set(R.x, 0.6, 0);
  box(MW + 0.6, 0.6, MD + 0.6, mat(0x232a36, { roughness: 0.8 }), R.x, 0.3, 0);
  // magnetron: bloco com aletas de resfriamento e antena, no compartimento do painel
  const mg = grupo(W3.rx); mg.position.set(MW / 2 - (MW - CAV) / 2, MH / 2 + 0.1, -0.1); W3.magnetron = mg;
  const cobre = mat(0xc47a3c, { roughness: 0.3, metalness: 0.6 }), aco = mat(0xaeb6c0, { roughness: 0.3, metalness: 0.6 });
  box(0.5, 0.5, 0.5, aco, 0, 0, 0, mg);
  for (let i = 0; i < 7; i++) box(0.7, 0.03, 0.7, mat(0xcfd5dc, { metalness: 0.6, roughness: 0.3 }), 0, -0.24 + i * 0.08, 0, mg);
  const ant = cyl(0.06, 0.06, 0.3, cobre, 12, mg); ant.rotation.z = Math.PI / 2; ant.position.set(-0.4, 0.1, 0);
  W3.magMat = aco;
  // guia de onda ate a cavidade
  box(0.5, 0.28, 0.5, vidro(0xffd24a, 0.35), -0.55, 0.1, 0, mg);
  // ondas: fitas brilhantes que saem da guia e quicam nas paredes de metal
  W3.ondas = [...Array(5)].map((_, i) => { const l = pontosBrilho(700, i % 2 ? 0xffd84a : 0xff9a2a, 0.09); W3.rx.add(l); return l; });
  W3.brilhoCav = new T3.PointLight(0xffc860, 0, 5, 1.4); W3.brilhoCav.position.set(-MW / 2 + CAV / 2, MH / 2, 0.2); W3.rx.add(W3.brilhoCav);

  // ================= moleculas de agua =================
  const A = LOCAL.agua;
  const fundoA = new T3.Mesh(new T3.PlaneGeometry(60, 60), mat(0x10223a, { roughness: 1 })); fundoA.position.set(A.x, 0, -6); scene.add(fundoA);
  W3.oMat = mat(0xe0453a, { roughness: 0.35, emissive: 0x000000 }); W3.hMat = mat(0xf4f6f8, { roughness: 0.35 });
  W3.mols = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) {
    const m = moleculaAgua(W3.oMat, W3.hMat); m.position.set(A.x + (i - 2) * 1.55 + (rnd(i + j * 7) - 0.5) * 0.4, 2.6 + (j - 1.5) * 1.5 + (rnd(i * 3 + j) - 0.5) * 0.3, (rnd(i * 5 + j * 2) - 0.5) * 1.5);
    m.userData.p0 = m.position.clone(); m.userData.fase = rnd(i * 11 + j * 3) * 0.5; m.userData.base = rnd(i * 13 + j * 5) * Math.PI * 2;
    scene.add(m); W3.mols.push(m);
  }
  // seta do campo (vira de lado a cada meia onda)
  W3.seta = grupo(); W3.seta.position.set(A.x, 5.6, 0.5); W3.seta.scale.setScalar(0.8);
  const sm = brilho(0xffd24a, 0.85);
  const haste = new T3.Mesh(new T3.BoxGeometry(5, 0.18, 0.05), sm); W3.seta.add(haste);
  const ponta = new T3.Mesh(new T3.ConeGeometry(0.4, 0.8, 3), sm); ponta.rotation.z = -Math.PI / 2; ponta.position.x = 2.8; W3.seta.add(ponta);
  W3.luzA = new T3.PointLight(0xff7a2a, 0, 20, 1.2); W3.luzA.position.set(A.x, 3, 4); scene.add(W3.luzA);

  // ================= batata cortada =================
  const B = LOCAL.batata;
  uvMundo(box(10, 0.3, 8, tmat('madeira', { color: 0xb88a5e, relevo: 1 }), B.x, -0.15, 0), 3);
  const casca = mat(0xa6773e, { roughness: 0.85 });
  const metade = new T3.Mesh(new T3.SphereGeometry(1.6, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2), casca); metade.scale.set(1.25, 0.8, 1); metade.rotation.x = -Math.PI / 2; metade.position.set(B.x, 1.55, -0.2); metade.castShadow = true; scene.add(metade);
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; W3.corteCv = cv;
  W3.corteTx = new T3.CanvasTexture(cv); W3.corteTx.colorSpace = T3.SRGBColorSpace;
  const face = new T3.Mesh(new T3.CircleGeometry(1.6, 64), new T3.MeshStandardMaterial({ map: W3.corteTx, roughness: 0.7 }));
  face.scale.set(1.25, 1, 1); face.position.set(B.x, 1.55, -0.19); face.rotation.z = 0; scene.add(face);

  // ================= tela da porta de perto =================
  const P = LOCAL.porta;
  const tela2 = texTela(26, 52, 512); tela2.repeat.set(2, 3.3);
  const chapa = new T3.Mesh(new T3.PlaneGeometry(6, 10), new T3.MeshStandardMaterial({ map: tela2, color: 0xd8dde4, roughness: 0.4, metalness: 0.15, side: T3.DoubleSide }));
  chapa.position.set(P.x, 4, 0); chapa.rotation.y = Math.PI / 2; scene.add(chapa);
  const fundoP = new T3.Mesh(new T3.PlaneGeometry(80, 40), mat(0x0d1119)); fundoP.position.set(P.x, 4, -12); scene.add(fundoP);
  W3.ondaPorta = pontosBrilho(900, 0xffc83a, 0.35); scene.add(W3.ondaPorta);
  W3.raios = [...Array(9)].map((_, i) => { const r = new T3.Mesh(new T3.BoxGeometry(6, 0.05, 0.05), brilho(0xfff6d8, 0.7)); scene.add(r); return r; });
}

// ---------- quadro ----------
function desenhaCorte(prof) {   // face da batata: miolo claro, anel quente de "prof" (0..1 do raio) vindo da casca
  const c2 = W3.corteCv.getContext('2d'), g = c2.createRadialGradient(256, 256, 0, 256, 256, 256);
  const ini = clamp(1 - prof);
  g.addColorStop(0, '#f3e3a6'); g.addColorStop(Math.max(0, ini - 0.08), '#f3e3a6');
  g.addColorStop(Math.min(0.97, ini + 0.02), '#ff9a3c'); g.addColorStop(0.97, '#ff5a22'); g.addColorStop(1, '#8a5a2c');
  c2.fillStyle = g; c2.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) { c2.fillStyle = 'rgba(255,255,255,0.08)'; c2.fillRect(rnd(i) * 512, rnd(i * 3) * 512, 2, 2); }
  W3.corteTx.needsUpdate = true;
}
function ondaQuicando(l, i, t, forca) {   // caminho em zigue-zague dentro da cavidade, com a onda andando por ele
  const p = l.geometry.attributes.position, n = p.count, cx = -MW / 2 + CAV / 2, hw = CAV / 2 - 0.12, hh = MH / 2 - 0.15, hd = MD / 2 - 0.15;
  const fase = t * 6 + i * 1.3, ang = 0.6 + i * 0.37;
  for (let k = 0; k < n; k++) {
    const s = k / (n - 1), d = s * 12;
    // bola de bilhar 3D: reflexo nas paredes por "dobra" (triangle wave)
    const tri = (v, a) => { const m = ((v % (4 * a)) + 4 * a) % (4 * a); return m < 2 * a ? m - a : 3 * a - m; };
    let px = tri(-d * Math.cos(ang) + hw + 0.4, hw), py = tri(d * Math.sin(ang * 1.7) * 0.6 + i * 0.3, hh), pz = tri(d * Math.sin(ang) * 0.8 + i * 0.5, hd);
    const amp = 0.06 * Math.sin(d * 9 - fase);
    const vis = s < forca ? 1 : 0;
    p.setXYZ(k, cx + px, MH / 2 + py + amp * vis, pz + amp * 0.5);
  }
  l.geometry.setDrawRange(0, Math.max(2, Math.floor(n * forca)));
  p.needsUpdate = true;
}
function atualiza(t, ctx) {
  const et = ctx.p.etapa, k = ctx.lt, lugar = ETAPA_LOCAL[et], centro = LOCAL[lugar];
  sun.position.set(centro.x - 6, 14, centro.z + 12); sun.target.position.set(centro.x, 2, 0);
  scene.background = new T3.Color({ cozinha: 0xe6dfd2, raiox: 0x0e1118, agua: 0x0c1a2e, batata: 0x2a2320, porta: 0x0d1119 }[lugar]);
  hemi.intensity = lugar === 'cozinha' || lugar === 'batata' ? 0.95 : 0.55;
  // ---- cozinha ----
  let abre = 0, ligado = 0;
  if (et === 'cozinha') ligado = 1;
  if (et === 'abre') abre = ease(k * 2.2) * 1.7;
  if (et === 'final') { abre = 1.7 * (1 - ease((k - 0.2) * 2.5)); }
  W3.porta.rotation.y = -abre;
  W3.luzDentro.intensity = ligado ? 5 : abre > 0.1 ? 3 : 0;
  W3.prato.rotation.y = ligado ? t * 1.2 : 0;
  W3.visor.material.color.set(ligado ? 0x46ff8a : 0x1d5a35);
  W3.vapor.forEach((n, i) => {
    const vida = (t * 0.4 + rnd(i * 2.9)) % 1, on = et === 'abre' || et === 'final';
    n.position.set(LOCAL.cozinha.x - MW / 2 + CAV / 2 + (rnd(i) - 0.5) * 0.6 + Math.sin(vida * 6 + i) * 0.1, BANCADA + 0.6 + vida * 1.6, -0.25 + (rnd(i * 3) - 0.5) * 0.5);
    n.scale.setScalar(0.6 + vida * 2); n.material.opacity = on ? 0.3 * Math.sin(vida * Math.PI) : 0;
  });
  // ---- raio X: ondas ----
  const ondasOn = et === 'magnetron' ? clamp((k - 0.35) * 2) : et === 'ondas' ? 1 : 0;
  W3.ondas.forEach((l, i) => { l.visible = ondasOn > 0; if (ondasOn > 0) ondaQuicando(l, i, t, et === 'magnetron' ? ondasOn * (0.3 + i * 0.05) : 1); });
  W3.magMat.emissive = new T3.Color(et === 'magnetron' ? 0x553300 : 0x000000);
  W3.brilhoCav.intensity = et === 'ondas' ? 4 + Math.sin(t * 20) : et === 'magnetron' ? 3 * ondasOn : 0;
  W3.pratoRx.rotation.y = t * 1.2;
  W3.sopaMat.emissive = new T3.Color(0x000000);
  // ---- moleculas ----
  const freq = et === 'molecula' ? 0.6 : et === 'gira' ? lerp(0.8, 3.2, ease(k * 1.5)) : et === 'calor' ? 3.2 : 0.6;
  const campo = Math.sign(Math.sin(t * Math.PI * freq + 0.001));
  W3.seta.rotation.z = campo > 0 ? 0 : Math.PI; W3.seta.visible = et !== 'calor' || true;
  const calor = et === 'calor' ? ease(k * 2) : 0;
  W3.mols.forEach((m, i) => {
    const alinhar = et === 'molecula' ? ease(k * 2 - m.userData.fase) : 1;
    const alvo = campo > 0 ? -Math.PI / 2 : Math.PI / 2;   // o lado negativo (oxigenio) aponta contra o campo
    const atraso = Math.sin(t * Math.PI * freq - m.userData.fase * 3) * 0.35;
    m.rotation.z = lerp(m.userData.base, alvo + (et === 'molecula' ? 0 : atraso), alinhar);
    m.rotation.y = Math.sin(t * 1.3 + i) * 0.3;
    const sac = calor * 0.14; m.position.set(m.userData.p0.x + (rnd(t * 37 + i) - 0.5) * sac, m.userData.p0.y + (rnd(t * 41 + i * 3) - 0.5) * sac, m.userData.p0.z);
  });
  W3.oMat.emissive = new T3.Color(0xff4a10).multiplyScalar(calor * 0.6);
  W3.luzA.intensity = calor * 60;
  // ---- batata: o anel quente cresce ate ~2,5 cm (de 1,6 de raio = 0,3) e o calor anda para dentro ----
  if (et === 'batata') desenhaCorte(lerp(0.05, 0.32, ease(k * 2)) + 0.5 * clamp((k - 0.6) * 2.5));
  else if (!W3.corteFeito) { desenhaCorte(0.05); W3.corteFeito = true; }
  // ---- porta: onda grande bate e volta; luz (raios finos) atravessa ----
  if (et === 'porta') {
    const P = LOCAL.porta, p = W3.ondaPorta.geometry.attributes.position, n = p.count;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1), z = lerp(7, 0.15, s);
      const vai = (t * 3) % 2 < 1 ? 1 : -1, amp = 1.1;
      p.setXYZ(i, P.x + z, 4 + amp * Math.sin(z * 1.6 - t * 6), 0.6);
    }
    p.needsUpdate = true; W3.ondaPorta.visible = true;
    W3.raios.forEach((r, i) => { r.visible = k > 0.45; r.position.set(P.x - 3 + ((t * 4 + i * 0.7) % 6) * 0, 1.8 + i * 0.55, 0.2); r.material.opacity = 0.5 + 0.3 * Math.sin(t * 9 + i); });
  } else { W3.ondaPorta.visible = false; W3.raios.forEach(r => (r.visible = false)); }
}

const CAM = {
  cozinha: { y: BANCADA + 0.9, d: 7.5, h: 0.4, a: 0.25 }, abre: { y: BANCADA + 0.8, d: 5.0, h: 0.6, a: 0.05 },
  magnetron: { y: 1.5, d: 6.8, h: 1.8, a: 0.7 }, ondas: { y: 1.4, d: 5.6, h: 1.4, a: -0.35 },
  molecula: { y: 3.2, d: 13, h: 0.3, a: 0.0 }, gira: { y: 3.0, d: 9.5, h: 0.6, a: 0.25 }, calor: { y: 2.8, d: 8, h: 0.4, a: -0.2 },
  batata: { y: 1.5, d: 7.6, h: 1.4, a: 0.18 }, porta: { y: 4.0, d: 12, h: 0.3, a: 0.75 }, final: { y: BANCADA + 0.8, d: 6.5, h: 0.5, a: 0.18 },
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
  const et = ctx.p.etapa, s = back((t - ctx.t0) * 3), s2 = back((t - ctx.t0) * 3 - 0.6), branco = 'rgba(255,255,255,0.92)';
  if (et === 'cozinha') { const e = E.since(t, 'erro'); if (e >= 0) pill(W / 2, 300, 'Inside out?  ✗', COL.red, '#fff', 46, back(e * 3)); }
  if (et === 'magnetron') { const R = LOCAL.raiox, [px, py] = proj(R.x + MW / 2 - (MW - CAV) / 2, 0.6 + MH + 0.3, 0); pill(px - 60, py - 60, 'Magnetron', branco, COL.ink, 42, s); }
  if (et === 'ondas') pill(W / 2, 300, 'Bouncing waves', COL.yellow, COL.ink, 44, s);
  if (et === 'molecula') { pill(W / 2, 300, 'Water molecule', branco, COL.ink, 44, s); }
  if (et === 'gira') pill(W / 2, 300, 'Billions of flips / s', COL.yellow, COL.ink, 42, s);
  if (et === 'calor') pill(W / 2, 300, 'Friction = HEAT', COL.red, '#fff', 44, s);
  if (et === 'batata') { pill(W / 2, 300, '~1 inch deep', COL.red, '#fff', 44, s); }
  if (et === 'porta') { pill(W / 2, 300, 'Wave: 12 cm', COL.yellow, COL.ink, 42, s); pill(W / 2, 400, 'Holes: 1-2 mm', branco, COL.ink, 42, s2); }
}
MUNDO = { monta, atualiza, camera, overlay };
})();
