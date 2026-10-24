// Mundo "ponte": rio em corte transversal (margens, agua, lodo, rocha) e o pilar da ponte no meio.
// O rio corre para a camera (+z); o corte fica em z = Z1 e tudo o que esta no leito encosta nele.
// Etapas: rio, despejo, lavado, ensecadeira, seco, afunda, estacas, remove, erosao, riprap, final.
(() => {
const X0 = -34, X1 = 34, Z1 = 2.0, ZF = -140;
const WS = -1.4, BED = -4, MT = -2.6, RT = -7.5, BOT = -15;   // nivel da agua, leito, topo do lodo nas margens, rocha
const ZS = Z1 - 3.4;                                           // fundo da ensecadeira (e da fatia de lodo que sofre erosao)
const XC = 2.4, XM = 3.4;                                      // paredes da ensecadeira e meio do rio (fundo plano)
const ZD0 = Z1 - 2.8;                                          // fundo do tabuleiro e da estrada
const W3 = {};
const leito = x => { const a = Math.abs(x); return a >= 6 ? 0 : a <= 4 ? BED : BED + (a - 4) * 2; };

GERA.lama = () => geraTerra(0x4f4438, 12, 70, [0.72, 1.12]);
GERA.chapa = () => { const n1 = fbm(41, 8); return pixels(256, (u, v) => {
  const s = Math.sin(u * Math.PI * 2 * 6), k = 0.62 + 0.38 * (s * 0.5 + 0.5), r = clamp((n1(u, v) - 0.55) * 3) * (0.4 + 0.6 * clamp(1 - v * 1.4));
  return [lerp(96 * k, 140, r), lerp(116 * k, 84, r), lerp(128 * k, 52, r)]; }); };
GERA.asfalto = () => { const n1 = fbm(51, 16, 3); return pixels(256, (u, v) => { const k = 0.75 + n1(u, v) * 0.35 + rnd(u * 911 + v * 5711) * 0.12; return [52 * k, 54 * k, 58 * k]; }); };
GERA.pedra = () => geraTerra(0x8c8880, 61, 40, [0.6, 1.25]);

function uvs(me, esc, frente) {   // UV pela posicao no mundo; a face do corte (normal z) pode ter um mapa proprio
  const g = me.geometry, p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, v = new T3.Vector3();
  me.updateMatrixWorld();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(me.matrixWorld);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (az > 0.5 && frente) uv.setXY(i, ...frente(v)); else if (ay > 0.5) uv.setXY(i, v.x / esc, v.z / esc); else if (ax > 0.5) uv.setXY(i, v.z / esc, v.y / esc); else uv.setXY(i, v.x / esc, v.y / esc);
  }
  uv.needsUpdate = true; return me;
}
function geoPrisma(pts, za, zb) {
  const s = new T3.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const g = new T3.ExtrudeGeometry(s, { depth: zb - za, bevelEnabled: false, steps: 1 }); g.translate(0, 0, za); g.computeVertexNormals(); return g;
}
function prisma(pts, za, zb, m, esc = 2.2, frente) {
  const me = new T3.Mesh(geoPrisma(pts, za, zb), m); me.castShadow = me.receiveShadow = true; scene.add(me); return uvs(me, esc, frente);
}
function refaz(me, pts, za, zb, esc, frente) { me.geometry.dispose(); me.geometry = geoPrisma(pts, za, zb); return uvs(me, esc, frente); }

// perfil do fundo no meio do rio: a erosao cava uma bacia em volta do pilar
function cava(x, d) { const a = Math.abs(x), g = Math.exp(-Math.pow((a - 1.9) / 0.85, 2)), g0 = Math.exp(-Math.pow((XM - 1.9) / 0.85, 2)); return d * Math.max(0, (g - g0) / (1 - g0)); }
function perfilMeio(d, x0 = -XM, x1 = XM) { const pts = []; for (let i = 0; i <= 34; i++) { const xx = lerp(x1, x0, i / 34); pts.push([xx, BED - cava(xx, d)]); } return pts; }
function ptsLodo(d) {
  return [[X0, RT], [X1, RT], [X1, MT], [4 + (MT - BED) / 2, MT], [4, BED], ...perfilMeio(d), [-4, BED], [-4 - (MT - BED) / 2, MT], [X0, MT]];
}
function ptsAguaMeio(d) { const xw = 4 + (WS - BED) / 2; return [[-xw, WS], [-4, BED], ...perfilMeio(d).reverse(), [4, BED], [xw, WS]].reverse(); }

function aguaFrente() {  // face do corte da agua: clara em cima, funda embaixo, com reflexos de luz (caustica)
  const n1 = fbm(71, 6), n2 = fbm(77, 12, 3);
  const cv = pixels(512, (u, v) => {
    const prof = v, ca = Math.pow(clamp(1 - Math.abs(n1(u, v * 0.5) - n2(u, v * 0.5)) * 3), 12) * clamp((prof - 0.55) * 2.2);
    return [lerp(14, 70, prof) + 80 * ca, lerp(52, 150, prof) + 70 * ca, lerp(78, 190, prof) + 50 * ca];
  });
  const tx = new T3.CanvasTexture(cv); tx.colorSpace = T3.SRGBColorSpace; tx.wrapS = T3.RepeatWrapping; tx.wrapT = T3.ClampToEdgeWrapping; return tx;
}
const frenteAgua = v => [v.x / 6, (v.y - (BED - 1.6)) / (WS - BED + 1.6)];

function carro(cor) {
  const g = grupo();
  const pint = mat(cor, { roughness: 0.3, metalness: 0.35 }), vid = mat(0x1d2a38, { roughness: 0.08, metalness: 0.6 });
  box(1.9, 0.42, 0.95, pint, 0, 0.42, 0, g); box(1.05, 0.36, 0.86, pint, -0.15, 0.8, 0, g);
  box(1.0, 0.3, 0.88, vid, -0.15, 0.8, 0, g).scale.set(1.02, 0.85, 1.01);
  for (const [px, pz] of [[-0.62, 0.45], [0.62, 0.45], [-0.62, -0.45], [0.62, -0.45]]) { const r = cyl(0.21, 0.21, 0.16, mat(0x161616, { roughness: 0.8 }), 18, g); r.rotation.x = Math.PI / 2; r.position.set(px, 0.21, pz); }
  box(0.04, 0.1, 0.22, mat(0xfff4c0, { emissive: 0xfff0b0, emissiveIntensity: 0.6 }), 0.96, 0.48, 0.3, g); box(0.04, 0.1, 0.22, mat(0xfff4c0, { emissive: 0xfff0b0, emissiveIntensity: 0.6 }), 0.96, 0.48, -0.3, g);
  return g;
}
function pessoa(cor, parent) {
  const g = grupo(parent);
  const corpo = new T3.Mesh(new T3.CapsuleGeometry(0.13, 0.42, 6, 10), mat(cor, { roughness: 0.6 })); corpo.position.y = 0.62; corpo.castShadow = true; g.add(corpo);
  for (const s of [-1, 1]) { const p = new T3.Mesh(new T3.CapsuleGeometry(0.055, 0.32, 4, 8), mat(0x2a3446)); p.position.set(0, 0.2, s * 0.07); p.castShadow = true; g.add(p); }
  const cab = new T3.Mesh(new T3.SphereGeometry(0.11, 14, 10), mat(0xc79a78, { roughness: 0.7 })); cab.position.y = 1.05; g.add(cab);
  const cap = new T3.Mesh(new T3.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffc81e, { roughness: 0.4 })); cap.position.y = 1.08; g.add(cap);
  return g;
}

function monta() {
  // ---------- ceu, campos, morros e arvores ao longe ----------
  const ceu = new T3.Mesh(new T3.SphereGeometry(220, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new T3.MeshBasicMaterial({ map: textura('ceu', GERA.ceu).tx, side: T3.BackSide, fog: false }));
  ceu.material.map.repeat.set(3, 1); scene.add(ceu);
  scene.fog = new T3.Fog(0xcfdfea, 45, 190);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, far: 90 }); sun.shadow.camera.updateProjectionMatrix();
  const grama = tmat('grama', { relevo: 1 });
  for (const s of [-1, 1]) { const pl = new T3.Mesh(new T3.PlaneGeometry(300, 260), grama); pl.rotation.x = -Math.PI / 2; pl.position.set(s * (150 + 6), -0.001, ZF + 130 - 130); pl.receiveShadow = true; scene.add(pl); uvMundo(pl, 3); }
  const morro = tmat('grama', { relevo: 1, color: 0xb6c7a0 });
  for (let i = 0; i < 9; i++) { const m = new T3.Mesh(new T3.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), morro); m.scale.set(30 + rnd(i) * 30, 8 + rnd(i * 3) * 10, 20); m.position.set(lerp(-120, 120, i / 8) + rnd(i * 7) * 20, 0, -150 - rnd(i * 5) * 30); scene.add(m); uvMundo(m, 8); }
  for (let i = 0; i < 46; i++) {
    const s = i % 2 ? 1 : -1, px = s * (7.5 + rnd(i * 3.3) * 9), pz = lerp(-4, -70, rnd(i * 1.7));
    if (Math.abs(px) < 12 && pz > -8) continue;
    arvore(px, pz, 1.0 + rnd(i * 2.2) * 0.7);
  }
  for (const [px, pz, sc] of [[-12.5, -2.5, 1.5], [13, -3, 1.6], [-16, -6, 1.3], [16.5, -7, 1.4]]) arvore(px, pz, sc);
  // agua ao longe (o rio continua ate a nevoa)
  const longe = new T3.Mesh(new T3.PlaneGeometry(12, 120), new T3.MeshStandardMaterial({ color: 0x4f8db5, roughness: 0.1, metalness: 0.1 })); longe.rotation.x = -Math.PI / 2; longe.position.set(0, WS - 0.01, ZF - 50); scene.add(longe);

  // ---------- terreno em corte ----------
  const terra = tmat('terra'), terra2 = tmat('terra2'), rocha = tmat('rocha', { relevo: 4 }), lama = tmat('lama', { relevo: 2, roughness: 0.6 });
  solid(X0, X1, BOT, RT, ZF, Z1, rocha, 2.4);
  const yT = -0.15, xT = 4 + (yT - BED) / 2, x1m = 4 + (-1.0 - BED) / 2, xMT = 4 + (MT - BED) / 2;
  for (const s of [-1, 1]) {
    const f = pts => s < 0 ? pts.map(([a, b]) => [-a, b]).reverse() : pts;
    prisma(f([[xT + 0.075, 0], [X1, 0], [X1, -1.0], [x1m, -1.0]]), ZF, Z1, terra, 2.2);
    prisma(f([[x1m, -1.0], [X1, -1.0], [X1, MT], [xMT, MT]]), ZF, Z1, terra2, 2.2);
    uvMundo(box(X1 - 6, 0.16, Z1 - ZF, grama, s * (6 + (X1 - 6) / 2), -0.08 + 0.001, (ZF + Z1) / 2), 3);
  }
  W3.lodoFundo = prisma(ptsLodo(0), ZF, ZS, lama, 2.2);
  W3.lodo = prisma(ptsLodo(0), ZS, Z1, lama, 2.2); W3.lodoD = 0;
  // pedrinhas e juncos na margem
  const pm = [mat(0x8d8a84), mat(0x6f6a64), mat(0xa29d94)], junco = mat(0x6f8a3a, { roughness: 0.8 });
  for (let i = 0; i < 140; i++) {
    const s = i % 2 ? 1 : -1, a = lerp(4.3, 6.1, rnd(i * 4.1)), pz = lerp(ZF * 0.25, Z1 - 0.2, rnd(i * 2.9)), y = leito(a);
    const m = new T3.Mesh(new T3.DodecahedronGeometry(0.06 + rnd(i * 6.6) * 0.12), pm[i % 3]); m.position.set(s * a, y + 0.03, pz); m.rotation.set(i, i * 2, 0); m.castShadow = true; scene.add(m);
  }
  for (let i = 0; i < 160; i++) {
    const s = i % 2 ? 1 : -1, a = lerp(5.1, 6.4, rnd(i * 7.7)), pz = lerp(-40, Z1 - 0.15, rnd(i * 3.1)), y = leito(a), hh = 0.35 + rnd(i * 5.3) * 0.5;
    const m = new T3.Mesh(new T3.ConeGeometry(0.025, hh, 4), junco); m.position.set(s * a, y + hh / 2, pz); m.rotation.z = (rnd(i) - 0.5) * 0.4; scene.add(m);
  }

  // ---------- agua ----------
  const fluxo = textura('agua', GERA.agua).tx; fluxo.repeat.set(1, 1);
  const mA = new T3.MeshStandardMaterial({ map: aguaFrente(), roughness: 0.2, transparent: true, opacity: 0.8, depthWrite: false });
  const mS = new T3.MeshStandardMaterial({ map: fluxo, color: 0xa8d4ee, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.86, depthWrite: false });
  W3.mA = mA; W3.mS = mS;
  const ZW = Z1 + 0.03, xWS = 4 + (WS - BED) / 2;
  const agua = (pts, za, zb) => { const me = new T3.Mesh(geoPrisma(pts, za, zb), [mA, mS]); me.renderOrder = 2; scene.add(me); return uvs(me, 3, frenteAgua); };
  W3.aguaE = agua([[-xWS, WS], [-4, BED], [-XM, BED], [-XM, WS]].reverse(), ZF, ZW);
  W3.aguaD = agua([[XM, WS], [XM, BED], [4, BED], [xWS, WS]].reverse(), ZF, ZW);
  W3.aguaM = agua(ptsAguaMeio(0), ZF, ZW); W3.aguaMd = 0;
  W3.aguaTras = agua([[-XM, WS], [-XM, BED], [XM, BED], [XM, WS]].reverse(), ZF, ZS);
  W3.aguaInE = agua([[-XM, WS], [-XM, BED], [-XC, BED], [-XC, WS]].reverse(), ZS, ZW);
  W3.aguaInD = agua([[XC, WS], [XC, BED], [XM, BED], [XM, WS]].reverse(), ZS, ZW);
  W3.aguaIn = agua([[-XC, WS], [-XC, BED], [XC, BED], [XC, WS]].reverse(), ZS, ZW); W3.aguaInL = WS;
  // folhas boiando, levadas pela correnteza
  const fm = mat(0x7a8b3a, { roughness: 0.7 }), fm2 = mat(0xa0742e, { roughness: 0.7 });
  W3.folhas = [...Array(26)].map((_, i) => { const m = new T3.Mesh(new T3.CircleGeometry(0.09 + rnd(i) * 0.06, 6), i % 3 ? fm : fm2); m.rotation.x = -Math.PI / 2; m.scale.y = 0.55; scene.add(m); return m; });

  // ---------- estrada nas margens, encontros e cancela ----------
  const asf = tmat('asfalto', { relevo: 0.6, roughness: 0.85 }), conc = tmat('concreto', { relevo: 1.2 }), faixa = mat(0xf2c62b, { roughness: 0.6 }), branco = mat(0xf4f4f0, { roughness: 0.6 });
  for (const s of [-1, 1]) {
    uvMundo(box(X1 - 6.0, 0.06, Z1 - ZD0, asf, s * (6 + (X1 - 6) / 2), 0.0, (ZD0 + Z1) / 2), 2);
    for (let k = 0; k < 6; k++) box(0.9, 0.012, 0.1, faixa, s * (7.2 + k * 1.8), 0.036, (ZD0 + Z1) / 2);
    uvMundo(box(1.1, 1.9, Z1 - ZD0 + 0.2, conc, s * 6.15, -0.95, (ZD0 + Z1) / 2 + 0.006), 1.6);
  }
  W3.cancela = grupo();
  for (const s of [-1, 1]) {
    const cg = grupo(W3.cancela); cg.position.set(s * 6.9, 0, (ZD0 + Z1) / 2);
    for (const dz of [-1.1, 1.1]) box(0.08, 0.75, 0.08, branco, 0, 0.4, dz, cg);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const c2 = cv.getContext('2d');
    for (let i = 0; i < 8; i++) { c2.fillStyle = i % 2 ? '#f4f4f0' : '#e2342b'; c2.beginPath(); c2.moveTo(i * 32, 0); c2.lineTo(i * 32 + 32, 0); c2.lineTo(i * 32 + 16, 32); c2.lineTo(i * 32 - 16, 32); c2.fill(); }
    const tx = new T3.CanvasTexture(cv); tx.colorSpace = T3.SRGBColorSpace;
    box(0.06, 0.24, 2.5, mat(0xffffff, { map: tx, roughness: 0.5 }), 0, 0.68, 0, cg).rotation.y = 0;
  }
  W3.carro = carro(0x2c6fd6); W3.carro.position.set(-9, 0.03, Z1 - 0.75);

  // ---------- caminhao-bomba de concreto ----------
  W3.cam = grupo(); W3.cam.position.set(-11.2, 0, Z1 - 4.4);
  box(4.2, 0.35, 1.5, mat(0x30343a), 0, 0.6, 0, W3.cam);
  box(1.2, 1.3, 1.5, mat(0xf0b21a, { roughness: 0.4, metalness: 0.2 }), 1.9, 1.3, 0, W3.cam);
  box(0.05, 0.55, 1.2, mat(0x9fc6e6, { roughness: 0.05, metalness: 0.3 }), 2.52, 1.55, 0, W3.cam);
  box(2.6, 0.7, 1.3, mat(0xe8e8e2, { roughness: 0.5 }), -0.6, 1.1, 0, W3.cam);
  for (const px of [-1.4, -0.4, 1.8]) for (const pz of [-0.72, 0.72]) { const r = cyl(0.34, 0.34, 0.26, mat(0x161616, { roughness: 0.8 }), 20, W3.cam); r.rotation.x = Math.PI / 2; r.position.set(px, 0.34, pz); }
  const amarelo = mat(0xf0b21a, { roughness: 0.4, metalness: 0.25 });
  W3.lanca = new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3([new T3.Vector3(-0.6, 1.5, 0), new T3.Vector3(3.5, 6.0, -0.4), new T3.Vector3(8.5, 6.4, 2.2), new T3.Vector3(11.2, 3.6, 3.2)]), 40, 0.16, 10), amarelo);
  W3.lanca.castShadow = true; W3.cam.add(W3.lanca);
  W3.mangueira = cyl(0.12, 0.12, 1.2, mat(0x1e1e1e), 12, W3.cam); W3.mangueira.position.set(11.2, 3.0, 3.2);
  const cinza = mat(0x9c9a94, { roughness: 0.75 });
  W3.jato = cyl(0.11, 0.14, 1, cinza, 12); W3.jato.renderOrder = 1;
  W3.monte = new T3.Mesh(new T3.ConeGeometry(1.3, 1.0, 28), tmat('concreto', { color: 0xaaa69c, relevo: 2 })); W3.monte.castShadow = true; scene.add(W3.monte);
  W3.nuvem = new T3.InstancedMesh(new T3.IcosahedronGeometry(0.3, 1), new T3.MeshStandardMaterial({ color: 0xc4beb0, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false }), 220); W3.nuvem.renderOrder = 3; scene.add(W3.nuvem);
  W3.anel = new T3.Mesh(new T3.RingGeometry(0.5, 0.62, 32), new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })); W3.anel.rotation.x = -Math.PI / 2; scene.add(W3.anel);

  // ---------- ensecadeira: estacas-prancha de aco ----------
  const chapa = tmat('chapa', { relevo: 3, roughness: 0.5, metalness: 0.1 });
  const hP = 6.8, yP = (0.5 - 6.3) / 2;
  W3.paredes = [
    uvMundo(box(0.18, hP, Z1 + 0.015 - ZS, chapa, -XC, yP, (ZS + Z1 + 0.015) / 2), 1.4),
    uvMundo(box(2 * XC + 0.18, hP, 0.18, chapa, 0, yP, ZS + 0.09), 1.4),
    uvMundo(box(0.18, hP, Z1 + 0.015 - ZS, chapa, XC, yP, (ZS + Z1 + 0.015) / 2), 1.4),
  ];
  W3.paredes.forEach(p => p.userData.y = yP);
  W3.martelo = grupo(); box(0.5, 0.55, 0.7, mat(0xe8a417, { roughness: 0.4, metalness: 0.3 }), 0, 0.28, 0, W3.martelo); box(0.12, 0.25, 0.3, mat(0x333333), 0, -0.1, 0, W3.martelo);
  W3.bomba = grupo(); box(0.55, 0.45, 0.6, mat(0x2d7fd2, { roughness: 0.4, metalness: 0.3 }), 0, 0.22, 0, W3.bomba); W3.bomba.position.set(-XC, 0.5, Z1 - 1.1);
  W3.tuboB = new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3([new T3.Vector3(-1.4, BED + 0.15, Z1 - 1.1), new T3.Vector3(-1.5, -0.5, Z1 - 1.1), new T3.Vector3(-2.0, 0.75, Z1 - 1.1), new T3.Vector3(-XC, 0.75, Z1 - 1.1)]), 40, 0.07, 8), mat(0x222222));
  W3.tuboS = new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3([new T3.Vector3(-XC, 0.75, Z1 - 1.1), new T3.Vector3(-2.9, 0.85, Z1 - 1.1), new T3.Vector3(-3.15, 0.55, Z1 - 1.1)]), 20, 0.08, 8), mat(0x222222));
  scene.add(W3.tuboB); scene.add(W3.tuboS);
  W3.esguicho = new T3.InstancedMesh(new T3.SphereGeometry(0.07, 8, 6), new T3.MeshStandardMaterial({ color: 0xbfe2f5, roughness: 0.1, transparent: true, opacity: 0.85 }), 60); scene.add(W3.esguicho);
  W3.escada = grupo(); const em = mat(0x8a8f96, { metalness: 0.6, roughness: 0.4 });
  for (const dz of [-0.25, 0.25]) box(0.05, 4.6, 0.05, em, 0, 0, dz, W3.escada);
  for (let i = 0; i < 12; i++) box(0.04, 0.04, 0.5, em, 0, -2.2 + i * 0.4, 0, W3.escada);
  W3.escada.position.set(XC - 0.2, BED + 2.2, Z1 - 2.6); W3.escada.rotation.z = -0.08;
  W3.poca = new T3.Mesh(new T3.CircleGeometry(1, 28), mat(0x5d8aa6, { roughness: 0.05, metalness: 0.2 })); W3.poca.rotation.x = -Math.PI / 2; W3.poca.scale.set(0.9, 0.5, 1); W3.poca.position.set(1.2, BED + 0.012, Z1 - 2.3); scene.add(W3.poca);
  W3.peoes = [[-1.3, Z1 - 1.0, 0xff6d1f], [0.2, Z1 - 1.7, 0xff6d1f], [1.2, Z1 - 0.8, 0xe4572e]].map(([px, pz, c], i) => { const p = pessoa(c); p.position.set(px, BED, pz); p.rotation.y = i * 1.3; return p; });

  // ---------- pilar 1: sapata direto no lodo (afunda) ----------
  const cz = Z1 - 1.2, ZP = Z1 + 0.006;
  W3.pilarA = grupo(); W3.pilarA.position.set(0, BED, 0);
  W3.pA = [uvMundo(box(3.6, 0.6, ZP - (Z1 - 2.4), conc, 0, 0.3, (ZP + Z1 - 2.4) / 2, W3.pilarA), 1.6),
    uvMundo(box(1.5, -1.05 - (BED + 0.6), ZP - (Z1 - 2.1), conc, 0, 0.6 + (-1.05 - BED - 0.6) / 2, (ZP + Z1 - 2.1) / 2, W3.pilarA), 1.6),
    uvMundo(box(3.4, 0.4, ZP - (Z1 - 2.7), conc, 0, -1.05 - BED + 0.2, (ZP + Z1 - 2.7) / 2, W3.pilarA), 1.6)];
  // ---------- pilar 2: estacas ate a rocha + bloco ----------
  const aco = mat(0x8a96a2, { metalness: 0.2, roughness: 0.4 });
  W3.estacas = [-1.35, -0.45, 0.45, 1.35].map(px => { const e = box(0.36, 3.9, 0.36, aco, px, 0, Z1 - 0.17); e.userData.y = (-4.3 + -8.2) / 2; return e; });
  W3.ponta = new T3.Mesh(new T3.PlaneGeometry(4, 0.05), new T3.MeshBasicMaterial({ color: 0xffe36a, transparent: true, opacity: 0.0 })); W3.ponta.position.set(0, RT, Z1 + 0.04); scene.add(W3.ponta);
  W3.bloco = uvMundo(box(3.8, 1.0, ZP - (Z1 - 2.4), conc, 0, -4.1, (ZP + Z1 - 2.4) / 2), 1.6);
  W3.coluna = uvMundo(box(1.5, -1.05 - (-3.6), ZP - (Z1 - 2.1), conc, 0, (-1.05 - 3.6) / 2, (ZP + Z1 - 2.1) / 2), 1.6);
  W3.capitel = uvMundo(box(3.4, 0.4, ZP - (Z1 - 2.7), conc, 0, -0.85, (ZP + Z1 - 2.7) / 2), 1.6);
  W3.colY = W3.coluna.position.y; W3.colH = -1.05 + 3.6;
  // ---------- tabuleiro: dois vaos articulados nos encontros (para poder ceder junto com o pilar) ----------
  W3.vaos = [-1, 1].map(s => {
    const g = grupo(); g.position.set(s * 6, 0, 0);
    const L = 6 - 0.03, cx = -s * L / 2;
    uvMundo(box(L, 0.32, Z1 - ZD0, conc, cx, -0.16, (ZD0 + Z1) / 2, g), 1.6);
    uvMundo(box(L, 0.05, Z1 - ZD0 - 0.3, asf, cx, 0.01, (ZD0 + Z1) / 2, g), 2);
    for (const dz of [ZD0 + 0.5, Z1 - 0.5]) box(L, 0.34, 0.22, conc, cx, -0.49, dz, g);
    for (let k = 0; k < 3; k++) box(0.9, 0.012, 0.1, faixa, -s * (0.9 + k * 1.8), 0.042, (ZD0 + Z1) / 2, g);
    for (const dz of [ZD0 + 0.08, Z1 - 0.08]) {
      box(L, 0.07, 0.07, branco, cx, 0.62, dz, g);
      for (let k = 0; k <= 10; k++) box(0.06, 0.6, 0.06, branco, -s * k * L / 10, 0.32, dz, g);
    }
    return g;
  });
  // ---------- erosao: redemoinho de sedimento; enrocamento ----------
  W3.redemo = new T3.InstancedMesh(new T3.SphereGeometry(0.05, 6, 5), mat(0x8a7558, { roughness: 0.9 }), 120); scene.add(W3.redemo);
  const rm = tmat('pedra', { relevo: 4, color: 0xd8d4cc });
  W3.pedras = [];
  for (let i = 0; i < 150 && W3.pedras.length < 110; i++) {
    const px = lerp(-XM + 0.2, XM - 0.2, rnd(i * 3.7)), pz = lerp(ZS + 0.25, Z1 - 0.1, Math.pow(rnd(i * 5.3), 0.35)), r = 0.2 + rnd(i * 2.2) * 0.22;
    if (Math.abs(px) < 1.9 + r * 0.6 && pz > Z1 - 2.4 - r) continue;
    const m = new T3.Mesh(new T3.DodecahedronGeometry(r, 0), rm); m.scale.y = 0.75; m.rotation.set(i, i * 1.7, i * 0.3); m.castShadow = m.receiveShadow = true; scene.add(m);
    m.userData = { px, pz, py: BED + r * 0.5 + rnd(i * 9.1) * 0.25, k0: rnd(i * 4.4) * 0.55 }; W3.pedras.push(m);
  }
  // fantasma do pilar (onde ele vai ficar)
  W3.fantasma = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(1.5, 3.0, 2.1)), new T3.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  W3.fantasma.position.set(0, BED + 1.5 - 0.0 + 0.0, Z1 - 1.05); scene.add(W3.fantasma);
}

const ETAPAS = ['rio', 'despejo', 'lavado', 'ensecadeira', 'seco', 'afunda', 'estacas', 'remove', 'erosao', 'riprap', 'final'];
function estado(s, k) {
  const at = (i, f) => s < i ? 0 : s > i ? 1 : ease(f(k));
  const dur = (a, b, f) => s < a || s > b ? 0 : f();
  return {
    s, k,
    fantasma: s === 0 ? ease((k - 0.45) * 3) : 0,
    jato: s === 1 ? ease(k * 4 - 0.4) : s === 2 ? 1 - ease((k - 0.55) * 4) : 0,
    monte: s === 1 ? ease(k * 1.8 - 0.35) : s === 2 ? 1 - ease(k * 1.4 - 0.1) : 0,
    nuvem: s === 2 ? ease(k * 4) * (1 - ease((k - 0.88) * 8)) : 0,
    turva: s === 2 ? ease(k * 2) : s === 3 ? 1 - ease(k * 2) : 0,
    caminhao: s <= 2 ? 1 : s === 3 ? 1 - ease(k * 3) : 0,
    parede: [0, 1, 2].map(i => s < 3 ? 0 : s === 3 ? ease((k - i * 0.12) * 3.5) : s < 7 ? 1 : s === 7 ? 1 - ease((k - 0.55) * 2.4) : 0),
    nivel: s < 3 ? WS : s === 3 ? lerp(WS, BED + 0.6, ease((k - 0.48) * 1.9)) : s === 4 ? lerp(BED + 0.6, BED + 0.02, ease(k * 2)) : s < 7 ? BED + 0.02 : s === 7 ? lerp(BED + 0.02, WS, ease((k - 0.05) * 2.2)) : WS,
    esguicho: (s === 3 && k > 0.48) || (s === 4 && k < 0.55) ? 1 : 0,
    bomba: s === 3 ? ease((k - 0.38) * 6) : s === 4 ? 1 - ease((k - 0.7) * 5) : 0,
    peoes: s === 4 ? ease(k * 3 - 0.6) : s === 5 ? 1 - ease(k * 6) : 0,
    pilarA: s === 5 ? ease(k * 3) : s === 6 ? 1 : 0,
    vaoA: s === 5 ? ease((k - 0.22) * 5) : 0,
    afunda: s === 5 ? ease((k - 0.45) * 1.9) : s === 6 ? 1 : 0,
    saiA: s === 6 ? ease(k * 7) : 0,
    estaca: [0, 1, 2, 3].map(i => s < 6 ? 0 : s === 6 ? ease((k - 0.12 - i * 0.1) * 4.5) : 1),
    bloco: at(6, k => (k - 0.62) * 6), coluna: at(6, k => (k - 0.7) * 4.5), vaoB: at(6, k => (k - 0.84) * 7),
    cancela: s < 6 ? 1 : s === 6 ? 1 - ease((k - 0.85) * 6) : 0,
    erosao: s === 8 ? ease(k * 1.5 - 0.1) : s === 9 ? 1 : 0,
    redemo: s === 8 ? ease(k * 3) : s === 9 ? 1 - ease(k * 3) : 0,
    rip: s < 9 ? 0 : s === 9 ? k : 1,
    carro: s === 0 ? lerp(-18, -8.6, ease(k * 1.4)) : s < 10 ? -8.6 : lerp(-8.6, 19, ease((k - 0.08) * 1.15)),
  };
}

function atualiza(t, ctx) {
  const S = estado(Math.max(0, ETAPAS.indexOf(ctx.p.etapa)), ctx.lt); W3.S = S;
  // correnteza: a textura da superficie corre para a camera; folhas boiando
  W3.mS.map.offset.set(0, -t * 0.22);
  W3.folhas.forEach((f, i) => { const u = (t * 0.035 + rnd(i * 3.1)) % 1; f.position.set(lerp(-4.8, 4.8, rnd(i * 7.7)) + Math.sin(t * 0.7 + i) * 0.15, WS + 0.012, lerp(-60, Z1 - 0.1, u)); f.rotation.z = t * 0.3 + i; });
  W3.mA.color.set(0xffffff).lerp(new T3.Color(0xc9b99a), S.turva * 0.55);
  // agua: um volume so, ou dividido quando a ensecadeira esta seca
  const d = 1.5 * S.erosao * (1 - clamp(S.rip * 1.4)), divide = S.s >= 3 && S.s <= 7 && S.nivel < WS - 0.01;
  if (Math.abs(d - W3.lodoD) > 0.004) { refaz(W3.lodo, ptsLodo(d), ZS, Z1, 2.2); W3.lodoD = d; }
  if (Math.abs(d - W3.aguaMd) > 0.004) { refaz(W3.aguaM, ptsAguaMeio(d), ZF, Z1 + 0.03, 3, frenteAgua); W3.aguaMd = d; }
  W3.aguaM.visible = !divide; W3.aguaE.visible = W3.aguaD.visible = divide; W3.aguaTras.visible = W3.aguaInE.visible = W3.aguaInD.visible = divide; W3.aguaIn.visible = divide && S.nivel > BED + 0.06;
  if (divide && Math.abs(S.nivel - W3.aguaInL) > 0.004) {
    const L = Math.max(BED + 0.06, S.nivel);
    refaz(W3.aguaIn, [[-XC, L], [-XC, BED], [XC, BED], [XC, L]].reverse(), ZS, Z1 + 0.03, 3, frenteAgua); W3.aguaInL = S.nivel;
  }
  // fantasma
  W3.fantasma.material.opacity = S.fantasma * (0.55 + 0.35 * Math.sin(t * 6));
  W3.fantasma.visible = S.fantasma > 0.01;
  // caminhao-bomba, jato de concreto e o monte que a correnteza leva
  W3.cam.visible = S.caminhao > 0; W3.cam.position.x = -11.2 - (1 - S.caminhao) * 12;
  const cz = Z1 - 1.2, topoJ = 2.4, baseJ = BED + S.monte * 0.9;
  W3.jato.visible = S.jato > 0.02; W3.jato.scale.set(1, Math.max(0.01, (topoJ - baseJ) * S.jato), 1); W3.jato.position.set(0, topoJ - (topoJ - baseJ) * S.jato / 2, cz);
  W3.anel.visible = S.jato > 0.6; { const u = (t * 1.6) % 1; W3.anel.scale.setScalar(0.4 + u * 2.4); W3.anel.material.opacity = 0.7 * (1 - u); W3.anel.position.set(0, WS + 0.02, cz); }
  W3.monte.visible = S.monte > 0.02; W3.monte.scale.set(S.monte * (1 + S.nuvem * 0.25), Math.max(0.01, S.monte), S.monte); W3.monte.position.set(0.15 * S.nuvem, BED + 0.5 * S.monte, cz);
  { const m4 = new T3.Matrix4(), q = new T3.Quaternion(), e = new T3.Vector3(); let n = 0;
    if (S.nuvem > 0.01) for (let i = 0; i < 220; i++) {
      const u = (t * 0.32 + rnd(i * 1.37)) % 1, z = cz + u * 4.2, sc = (0.6 + u * 3.2) * S.nuvem * (1 - Math.pow(u, 3));
      if (z > Z1 - 0.1) continue;
      e.set(lerp(-0.8, 0.8, rnd(i * 2.3)) + u * lerp(-0.5, 3.2, rnd(i * 4.1)) + Math.sin(t * 2 + i) * 0.1, BED + 0.4 + u * lerp(0.2, 2.0, rnd(i * 7.9)), z);
      m4.compose(e, q, new T3.Vector3(sc, sc, sc)); W3.nuvem.setMatrixAt(n++, m4);
    }
    W3.nuvem.count = n; W3.nuvem.instanceMatrix.needsUpdate = true; }
  // ensecadeira: as paredes descem vibrando; bomba e esguicho
  let ativa = -1;
  W3.paredes.forEach((p, i) => { const v = S.parede[i]; p.visible = v > 0.001; p.position.y = p.userData.y + (1 - v) * 7.5; if (v > 0.02 && v < 0.98) ativa = i; });
  W3.martelo.visible = ativa >= 0 && S.s === 3;
  if (ativa >= 0) { const p = W3.paredes[ativa]; W3.martelo.position.set(p.position.x, p.position.y + 3.4 + 0.04 * Math.sin(t * 90), p.position.z); }
  W3.bomba.visible = W3.tuboB.visible = W3.tuboS.visible = S.bomba > 0.02; W3.bomba.scale.setScalar(Math.max(0.01, back(S.bomba)));
  { const m4 = new T3.Matrix4(); let n = 0;
    if (S.esguicho) for (let i = 0; i < 60; i++) { const u = (t * 1.3 + i / 60) % 1, tt = u * 0.7; m4.makeTranslation(-3.15 - 1.4 * tt + Math.sin(i) * 0.04, 0.55 - 4.9 * tt * tt + 0.6 * tt, Z1 - 1.1 + Math.cos(i * 3) * 0.06); if (0.55 - 4.9 * tt * tt + 0.6 * tt > WS) W3.esguicho.setMatrixAt(n++, m4); }
    W3.esguicho.count = n; W3.esguicho.instanceMatrix.needsUpdate = true; }
  const seco = S.s >= 4 && S.s <= 6;
  W3.escada.visible = seco || (S.s === 3 && S.k > 0.9) || (S.s === 7 && S.k < 0.5);
  W3.poca.visible = seco && S.s !== 6;
  W3.peoes.forEach((p, i) => { const v = back(S.peoes * 1.4 - i * 0.2); p.visible = v > 0.01; p.scale.setScalar(Math.max(0.01, v)); p.rotation.y = i * 1.3 + Math.sin(t * 1.5 + i) * 0.4; });
  // pilar 1 (afunda e inclina), pilar 2 (estacas + bloco + coluna)
  const afunda = 1.05 * S.afunda;
  W3.pilarA.visible = S.pilarA > 0.01 && S.saiA < 0.99;
  W3.pilarA.scale.set(1, Math.max(0.01, S.pilarA), 1); W3.pilarA.position.y = BED - afunda + S.saiA * 9; W3.pilarA.rotation.z = -0.05 * S.afunda * (1 - S.saiA);
  W3.estacas.forEach((e, i) => { const v = S.estaca[i]; e.visible = v > 0.001; e.position.y = e.userData.y + (1 - v) * 4.6; });
  W3.ponta.material.opacity = S.s === 6 ? 0.9 * ease((S.k - 0.5) * 5) * (1 - ease((S.k - 0.8) * 5)) : 0;
  W3.martelo.visible ||= S.s === 6 && S.estaca.some(v => v > 0.02 && v < 0.98);
  if (S.s === 6) { const i = S.estaca.findIndex(v => v > 0.02 && v < 0.98); if (i >= 0) { const e = W3.estacas[i]; W3.martelo.position.set(e.position.x, e.position.y + 1.95 + 0.25 * Math.abs(Math.sin(t * 11)), e.position.z - 0.15); } }
  W3.bloco.visible = S.bloco > 0.01; W3.bloco.scale.y = Math.max(0.01, S.bloco); W3.bloco.position.y = -4.6 + 0.5 * S.bloco;
  W3.coluna.visible = W3.capitel.visible = S.coluna > 0.01; W3.coluna.scale.y = Math.max(0.01, S.coluna); W3.coluna.position.y = -3.6 + W3.colH * S.coluna / 2;
  W3.capitel.position.y = -0.85 + (1 - S.coluna) * 3;
  // tabuleiro: cede com o pilar 1; depois desce no lugar sobre o pilar 2
  const usaA = S.s === 5 || (S.s === 6 && S.saiA < 0.99), vao = usaA ? S.vaoA || (S.s === 6 ? 1 : 0) : S.vaoB;
  W3.vaos.forEach((g, i) => {
    const s = i ? 1 : -1; g.visible = vao > 0.01 && !(S.s === 6 && S.saiA >= 0.99 && S.vaoB < 0.01);
    g.position.y = (1 - vao) * 3 + (usaA ? S.saiA * 9 : 0);
    g.rotation.z = usaA ? s * Math.atan(afunda * (1 - S.saiA) / 6) : 0;
  });
  W3.cancela.visible = S.cancela > 0.01; W3.cancela.position.y = (1 - S.cancela) * -1.2;
  W3.carro.position.x = S.carro;
  // erosao: sedimento girando nos dois lados da base; enrocamento caindo
  { const m4 = new T3.Matrix4(); let n = 0;
    if (S.redemo > 0.01) for (let i = 0; i < 120; i++) {
      const lado = i % 2 ? 1 : -1, a = t * (3.2 + rnd(i) * 1.5) * lado + rnd(i * 3.3) * 6.28, r = 0.25 + rnd(i * 5.1) * 0.55;
      const cx = lado * 2.25, cy = BED - 0.55 * S.erosao + 0.25;
      if (rnd(i * 7.7) > S.redemo) continue;
      m4.makeTranslation(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, Z1 - 0.15 - rnd(i * 9.9) * 1.6); W3.redemo.setMatrixAt(n++, m4);
    }
    W3.redemo.count = n; W3.redemo.instanceMatrix.needsUpdate = true; }
  W3.pedras.forEach(m => {
    const u = m.userData, v = clamp((S.rip - u.k0) / 0.35); m.visible = v > 0;
    const yy = u.py - 1.5 * S.erosao * 0 ; m.position.set(u.px, lerp(1.2, yy, ease(v)), u.pz);
  });
}

const CAM = {
  rio: { x: 0, y: -1.2, d: 21, a: 0.32, h: 6.5 }, despejo: { x: -1.6, y: -0.6, d: 17, a: 0.22, h: 3.2 },
  lavado: { x: 0.6, y: -2.7, d: 11, a: 0.12, h: 1.4 }, ensecadeira: { x: 0, y: -2.2, d: 14.5, a: -0.18, h: 3.4 },
  seco: { x: 0, y: -2.9, d: 10, a: 0.1, h: 2.6 }, afunda: { x: 0, y: -3.4, d: 14, a: 0.05, h: 1.2 },
  estacas: { x: 0, y: -4.8, d: 13.5, a: 0, h: 0.6 }, remove: { x: 0, y: -2.3, d: 14.5, a: -0.14, h: 2.6 },
  erosao: { x: 0, y: -4.4, d: 12.5, a: 0.06, h: 0.9 }, riprap: { x: 0, y: -3.8, d: 12, a: 0.04, h: 1.8 },
  final: { x: 0, y: -1.4, d: 20, a: 0.34, h: 5 },
};
function camera(t, ctx) { cameraPadrao(t, ctx, { x: 0, y: -3, d: 12, a: 0, h: 1.5, zFoco: Z1 }, p => CAM[p.etapa] || {}); }

function overlay(t, ctx) {
  const S = W3.S, p = ctx.p, k = ctx.lt;
  const rot = (px, py, pz, txt, s, cor = 'rgba(255,255,255,0.93)', fg = COL.ink, tam = 34) => { const [a, b] = proj(px, py, pz); pill(a, b, txt, cor, fg, tam, back(s)); };
  // rotulo grande da etapa: vermelho no problema (depois da buzina), verde na solucao (depois do piririm)
  const ev = tipo => { const e = ST.eventos.find(e => e.tipo === tipo && e.t >= ctx.t0 - 0.3 && e.t < ctx.t1); return e ? clamp((t - e.t) * 3) : clamp((k - 0.55) * 3); };
  if (p.ruim) pill(W / 2, H * 0.2, p.ruim, COL.red, '#fff', 58, back(ev('erro')));
  if (p.bom) pill(W / 2, H * 0.2, p.bom, COL.green, '#fff', 58, back(ev('certo')));
  if (S.s === 0) { rot(0, WS + 1.9, Z1 - 1.2, 'PILLAR GOES HERE', clamp((k - 0.5) * 4)); }
  if (S.s === 2) rot(1.2, BED + 0.9, Z1, 'WET CEMENT', clamp((k - 0.2) * 4) * (1 - clamp((k - 0.9) * 8)));
  if (S.s === 4) rot(0, BED + 1.6, Z1, 'DRY RIVERBED', clamp((k - 0.35) * 4));
  if (S.s === 5) rot(-2.6, -5.4, Z1, 'SOFT MUD', clamp((k - 0.5) * 4), 'rgba(255,255,255,0.93)', COL.ink, 32);
  if (S.s === 6) { rot(0, -6.2, Z1, 'STEEL PILES', clamp((k - 0.3) * 4) * (1 - clamp((k - 0.62) * 6)), 'rgba(255,255,255,0.93)', COL.ink, 32); rot(-2.4, RT - 0.9, Z1, 'BEDROCK', clamp((k - 0.4) * 4), 'rgba(255,255,255,0.93)', COL.ink, 32); }
  if (S.s === 9) rot(1.9, BED + 1.1, Z1, 'HEAVY ROCK', clamp((k - 0.45) * 4), 'rgba(255,255,255,0.93)', COL.ink, 32);
}
MUNDO = { monta, atualiza, camera, overlay };
})();
