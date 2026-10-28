// Mundo "tunel": rio em corte transversal (margens com cidade, agua, lodo, argila, rocha) e um tunel que cruza
// por baixo dele, da margem esquerda para a direita. O corte fica em z = Z1 e passa pelo EIXO do tunel, entao o
// tunel aparece como meio cilindro: as camadas de solo sao extrudadas ao longo de x com um entalhe semicircular.
// Etapas: rio, cava, inunda, escudo, vaza, ar, bends, tbm, juntas, gaxeta, final.
(() => {
const X0 = -40, X1 = 40, Z1 = 2.0, ZF = -240;
const WS = -1.2, BED = -4.2, MUD = -6.6, ROCK = -11, BOT = -17;   // agua, leito, fim do lodo, fim da argila, fundo
const RB0 = 4.5, RB1 = 7.0;                                       // meia largura do leito e do topo da margem
const YC = -7.4, R = 1.5, RI = 1.2, RW = 0.5, GAP = 0.05;         // eixo, raio do furo, raio interno do anel, passo
const XS0 = -10.4, XS1 = -8.8, ZP = 2.4;                          // poco de acesso na margem esquerda
const XBK = -6.4;                                                 // antepara da camara de ar comprimido
const W3 = {};
const margem = y => RB0 + (RB1 - RB0) * (y - BED) / (0 - BED);   // x da margem (lado direito) na altura y

GERA.lama = () => geraTerra(0x7d6a52, 12, 70, [0.76, 1.12]);
GERA.pedra = () => geraTerra(0x8c8880, 61, 40, [0.6, 1.25]);
GERA.tijolo = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d');
  cx.fillStyle = '#d9cfc0'; cx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 16; r++) for (let i = -1; i < 9; i++) {
    const k = 0.75 + rnd(r * 17 + i * 3) * 0.4, px = i * 32 + (r % 2) * 16;
    cx.fillStyle = `rgb(${150 * k},${70 * k},${48 * k})`; cx.fillRect(px + 1.5, r * 16 + 1.5, 29, 13);
  }
  return cv;
};
GERA.janelas = () => {   // fachada de predio: grade de janelas, algumas acesas
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const cx = cv.getContext('2d');
  cx.fillStyle = '#c9c3b8'; cx.fillRect(0, 0, 256, 512);
  for (let r = 0; r < 16; r++) for (let i = 0; i < 6; i++) {
    const k = rnd(r * 13 + i * 7);
    cx.fillStyle = k > 0.82 ? '#f3d98a' : `rgb(${70 + k * 50},${100 + k * 50},${130 + k * 40})`; cx.fillRect(10 + i * 41, 10 + r * 31, 28, 20);
  }
  return cv;
};

// ---------------- geometria ----------------
function uvs(me, esc) {   // UV pela posicao no mundo, por orientacao da face
  const g = me.geometry, p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, v = new T3.Vector3();
  me.updateMatrixWorld();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(me.matrixWorld);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (az > 0.5) uv.setXY(i, v.x / esc, v.y / esc); else if (ay > 0.5) uv.setXY(i, v.x / esc, v.z / esc); else if (ax > 0.5) uv.setXY(i, v.z / esc, v.y / esc); else uv.setXY(i, (v.x + v.z) / esc, v.y / esc);
  }
  uv.needsUpdate = true; return me;
}
function forma(pts) { const s = new T3.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }
// prisma extrudado em z a partir de um perfil (x, y)
function geoZ(pts, za, zb) { const g = new T3.ExtrudeGeometry(forma(pts), { depth: zb - za, bevelEnabled: false }); g.translate(0, 0, za); g.computeVertexNormals(); return g; }
// prisma extrudado em x a partir de um perfil (z, y): forma em (u = -z, v = y), gira +90 graus em y
function geoX(pts, x0, x1) {
  const g = new T3.ExtrudeGeometry(forma(pts.map(([z, y]) => [-z, y])), { depth: x1 - x0, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, x0); g.rotateY(Math.PI / 2); g.computeVertexNormals(); return g;
}
function malha(g, m, esc = 2.2, parent = scene) { const me = new T3.Mesh(g, m); me.castShadow = me.receiveShadow = true; parent.add(me); return esc ? uvs(me, esc) : me; }
// limite direito (z) de uma camada na altura y: o tunel (meio disco) ou o poco (retangulo) entram pelo corte
const ENTALHE = {
  cheio: () => Z1,
  tubo: y => Math.abs(y - YC) < R ? Z1 - Math.sqrt(R * R - (y - YC) * (y - YC)) : Z1,
  poco: y => y >= YC - R ? Z1 - ZP : Z1,
};
function perfilCamada(y0, y1, tipo) {
  const f = ENTALHE[tipo], ys = new Set([y0, y1]);
  for (let i = 0; i <= 48; i++) ys.add(lerp(y0, y1, i / 48));
  for (const b of [YC - R, YC + R]) if (b > y0 && b < y1) { ys.add(b - 1e-4); ys.add(b + 1e-4); }
  const lista = [...ys].sort((a, b) => a - b);
  return [[ZF, y0], ...lista.map(y => [f(y), y]), [ZF, y1]];
}
function meioAnel(ro, ri, n = 28) {   // meio anel no plano (z, y), atras do corte
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = Math.PI * i / n; pts.push([Z1 - ro * Math.sin(a), YC + ro * Math.cos(a)]); }
  for (let i = n; i >= 0; i--) { const a = Math.PI * i / n; pts.push([Z1 - ri * Math.sin(a), YC + ri * Math.cos(a)]); }
  return pts;
}
function meioDisco(r, n = 28) { const pts = []; for (let i = 0; i <= n; i++) { const a = Math.PI * i / n; pts.push([Z1 - r * Math.sin(a), YC + r * Math.cos(a)]); } return pts; }
function segmentoAgua(L, r = R) {   // agua dentro do meio cilindro ate o nivel L
  const top = Math.min(L, YC + r), pts = [];
  for (let i = 0; i <= 24; i++) { const y = lerp(YC - r, top, i / 24), dz = Math.sqrt(Math.max(0, r * r - (y - YC) * (y - YC))); pts.push([Z1 - dz, y]); }
  pts.push([Z1 + 0.02, top], [Z1 + 0.02, YC - r]); return pts;
}
function aguaFrente() {
  const n1 = fbm(71, 6), n2 = fbm(77, 12, 3);
  const cv = pixels(512, (u, v) => {
    const ca = Math.pow(clamp(1 - Math.abs(n1(u, v * 0.5) - n2(u, v * 0.5)) * 3), 12) * clamp((v - 0.55) * 2.2);
    return [lerp(14, 70, v) + 80 * ca, lerp(52, 150, v) + 70 * ca, lerp(78, 190, v) + 50 * ca];
  });
  const tx = new T3.CanvasTexture(cv); tx.colorSpace = T3.SRGBColorSpace; tx.wrapS = T3.RepeatWrapping; tx.wrapT = T3.ClampToEdgeWrapping; return tx;
}
function uvAgua(me) {   // frente da agua: degradê do claro (superficie) ao fundo
  const g = me.geometry, p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 6, (p.getY(i) - (BED - 1.6)) / (WS - BED + 1.6));
  uv.needsUpdate = true; return me;
}
function pessoa(cor, parent) {
  const g = grupo(parent);
  const corpo = new T3.Mesh(new T3.CapsuleGeometry(0.11, 0.34, 6, 10), mat(cor, { roughness: 0.6 })); corpo.position.y = 0.52; corpo.castShadow = true; g.add(corpo);
  for (const s of [-1, 1]) { const p = new T3.Mesh(new T3.CapsuleGeometry(0.045, 0.26, 4, 8), mat(0x2a3446)); p.position.set(0, 0.17, s * 0.06); p.castShadow = true; g.add(p); }
  const cab = new T3.Mesh(new T3.SphereGeometry(0.09, 14, 10), mat(0xc79a78, { roughness: 0.7 })); cab.position.y = 0.88; g.add(cab);
  const cap = new T3.Mesh(new T3.SphereGeometry(0.105, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffc81e, { roughness: 0.4 })); cap.position.y = 0.9; g.add(cap);
  const pa = new T3.Mesh(new T3.BoxGeometry(0.05, 0.5, 0.05), mat(0x7a5a3a)); pa.position.set(0.16, 0.55, 0); pa.rotation.z = -0.6; g.add(pa);
  g.userData = { corpo, pa }; return g;
}
function carro(cor) {
  const g = grupo();
  const pint = mat(cor, { roughness: 0.3, metalness: 0.35 }), vid = mat(0x1d2a38, { roughness: 0.08, metalness: 0.6 });
  box(1.9, 0.42, 0.95, pint, 0, 0.42, 0, g); box(1.05, 0.36, 0.86, pint, -0.15, 0.8, 0, g);
  box(1.0, 0.3, 0.88, vid, -0.15, 0.8, 0, g).scale.set(1.02, 0.85, 1.01);
  for (const [px, pz] of [[-0.62, 0.45], [0.62, 0.45], [-0.62, -0.45], [0.62, -0.45]]) { const r = cyl(0.21, 0.21, 0.16, mat(0x161616, { roughness: 0.8 }), 18, g); r.rotation.x = Math.PI / 2; r.position.set(px, 0.21, pz); }
  for (const dz of [0.3, -0.3]) box(0.04, 0.1, 0.22, mat(0xfff4c0, { emissive: 0xfff0b0, emissiveIntensity: 1.2 }), 0.96, 0.48, dz, g);
  g.scale.setScalar(0.42); return g;
}
function navio() {
  const g = grupo();
  const casco = new T3.Shape(); casco.moveTo(-1.1, 0); casco.lineTo(1.1, 0); casco.lineTo(1.1, 3.0); casco.quadraticCurveTo(1.0, 4.2, 0, 4.9); casco.quadraticCurveTo(-1.0, 4.2, -1.1, 3.0); casco.closePath();
  const ext = (h, y, m) => { const ge = new T3.ExtrudeGeometry(casco, { depth: h, bevelEnabled: false }); ge.rotateX(-Math.PI / 2); ge.translate(0, y, 0.6); const me = new T3.Mesh(ge, m); me.castShadow = true; g.add(me); return me; };
  ext(0.55, -0.55, mat(0x8e2a22, { roughness: 0.6 })); ext(0.5, 0.0, mat(0x1f2a36, { roughness: 0.5 }));
  ext(0.04, 0.5, mat(0x6b6f74, { roughness: 0.7 })).scale.set(0.96, 1, 0.98);
  box(1.9, 1.0, 0.9, mat(0xf2f2ee, { roughness: 0.5 }), 0, 1.0, 0.0, g); box(1.9, 0.18, 0.95, mat(0x2a3a4a, { roughness: 0.1, metalness: 0.4 }), 0, 1.3, 0.0, g);
  box(0.3, 0.6, 0.3, mat(0xc0392b), 0.4, 1.8, -0.1, g);
  const cores = [0xc0392b, 0x2e86c1, 0xf39c12, 0x27ae60, 0x8e44ad, 0xd35400, 0x16a085];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) for (let l = 0; l < 2; l++) {
    if (i === 5 && j !== 1) continue;
    box(0.6, 0.38, 0.62, mat(cores[(i * 3 + j * 5 + l) % 7], { roughness: 0.7 }), -0.66 + j * 0.66, 0.73 + l * 0.4, -1.0 - i * 0.66, g);
  }
  g.rotation.y = Math.PI; return g;   // proa para +z (vem na direcao da camera)
}

function monta() {
  gl.localClippingEnabled = true;
  W3.corte = new T3.Plane(new T3.Vector3(0, 0, -1), Z1 + 0.005);
  // ---------- ceu, campos ao longe ----------
  const ceu = new T3.Mesh(new T3.SphereGeometry(220, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new T3.MeshBasicMaterial({ map: textura('ceu', GERA.ceu).tx, side: T3.BackSide, fog: false }));
  ceu.material.map.repeat.set(3, 1); scene.add(ceu);
  scene.fog = new T3.Fog(0xcfdfea, 50, 200);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, far: 100 }); sun.shadow.camera.updateProjectionMatrix();
  sun.position.set(-12, 20, 16);
  const grama = tmat('grama', { relevo: 1 });
  for (const s of [-1, 1]) { const pl = new T3.Mesh(new T3.PlaneGeometry(300, 300), grama); pl.rotation.x = -Math.PI / 2; pl.position.set(s * (150 + RB1), -0.001, ZF - 30); pl.receiveShadow = true; scene.add(pl); uvMundo(pl, 3); }
  const longe = new T3.Mesh(new T3.PlaneGeometry(2 * margem(WS), 200), new T3.MeshStandardMaterial({ color: 0x4f8db5, roughness: 0.1, metalness: 0.1 })); longe.rotation.x = -Math.PI / 2; longe.position.set(0, WS - 0.01, ZF - 99); scene.add(longe);
  // cidade nas duas margens
  const jan = textura('janelas', GERA.janelas).tx;
  for (let i = 0; i < 34; i++) {
    const s = i % 2 ? 1 : -1, w = 2.5 + rnd(i * 3.1) * 3, h = 4 + Math.pow(rnd(i * 5.7), 1.6) * 16, d = 2.5 + rnd(i * 2.3) * 3;
    const px = s * (RB1 + 3 + rnd(i * 7.7) * 22), pz = -12 - rnd(i * 4.4) * 60;
    const tx = jan.clone(); tx.needsUpdate = true; tx.repeat.set(w / 3, h / 6);
    const m = new T3.MeshStandardMaterial({ map: tx, roughness: 0.6, color: [0xffffff, 0xe8ddd0, 0xd5dde6, 0xf0e2c8][i % 4] });
    box(w, h, d, m, px, h / 2, pz);
  }
  for (let i = 0; i < 26; i++) { const s = i % 2 ? 1 : -1; arvore(s * (RB1 + 1 + rnd(i * 3.3) * 2.2), -3 - rnd(i * 1.7) * 9, 0.8 + rnd(i * 2.2) * 0.4); }

  // ---------- terreno em corte ----------
  const terra = tmat('terra'), terra2 = tmat('terra2'), lama = tmat('lama', { relevo: 2, roughness: 0.6 }), argila = tmat('argila', { relevo: 2 }), rocha = tmat('rocha', { relevo: 4 });
  W3.mLama = lama; W3.mArgila = argila;
  malha(geoX([[ZF, BOT], [Z1, BOT], [Z1, ROCK], [ZF, ROCK]], X0, X1), rocha, 2.4);
  // camadas das margens (planas, com o poco na esquerda) e os taludes (extrudados em z)
  W3.camadasPoco = [];
  for (const [y0, y1, m] of [[-1.4, 0, terra], [BED, -1.4, terra2]]) {
    malha(geoX(perfilCamada(y0, y1, 'cheio'), X0, XS0), m);
    W3.camadasPoco.push({ me: malha(geoX(perfilCamada(y0, y1, 'cheio'), XS0, XS1), m), y0, y1 });
    malha(geoX(perfilCamada(y0, y1, 'cheio'), XS1, -RB1), m);
    malha(geoX(perfilCamada(y0, y1, 'cheio'), RB1, X1), m);
  }
  for (const s of [-1, 1]) {
    const f = pts => s < 0 ? pts.map(([a, b]) => [-a, b]).reverse() : pts;
    malha(geoZ(f([[margem(-1.4), -1.4], [RB1, -1.4], [RB1, 0]]), ZF, Z1), terra);
    malha(geoZ(f([[RB0, BED], [RB1, BED], [RB1, -1.4], [margem(-1.4), -1.4]]), ZF, Z1), terra2);
    for (const [a, b] of s < 0 ? [[X0, XS0], [XS1, -RB1]] : [[RB1, X1]]) uvMundo(box(b - a, 0.12, Z1 - ZF, grama, (a + b) / 2, -0.06 + 0.002, (ZF + Z1) / 2), 3);
  }
  uvMundo(box(XS1 - XS0, 0.12, Z1 - ZP - ZF, grama, (XS0 + XS1) / 2, -0.058, (ZF + Z1 - ZP) / 2), 3);
  W3.gramaPoco = uvMundo(box(XS1 - XS0, 0.12, ZP, grama, (XS0 + XS1) / 2, -0.058, Z1 - ZP / 2), 3);
  // camadas que o tunel atravessa: refeitas quando a frente de escavacao anda
  W3.camadas = [[MUD, BED, lama], [ROCK, MUD, argila]].map(([y0, y1, m]) => ({
    y0, y1, m, a: malha(geoX(perfilCamada(y0, y1, 'cheio'), X0, XS0), m),
    p: malha(geoX(perfilCamada(y0, y1, 'cheio'), XS0, XS1), m),
    t: malha(geoX(perfilCamada(y0, y1, 'cheio'), XS1, XS1 + 0.01), m),
    c: malha(geoX(perfilCamada(y0, y1, 'cheio'), XS1 + 0.01, X1), m),
  }));
  W3.xf = null; W3.pocoAberto = null;
  // pedras e juncos no leito
  const pm = [mat(0x8d8a84), mat(0x6f6a64), mat(0xa29d94)], junco = mat(0x6f8a3a, { roughness: 0.8 });
  for (let i = 0; i < 160; i++) {
    const s = i % 2 ? 1 : -1, a = lerp(0, RB0 + 1.2, rnd(i * 4.1)), pz = lerp(-30, Z1 - 0.2, rnd(i * 2.9)), y = a < RB0 ? BED : BED + (a - RB0) * (-BED) / (RB1 - RB0);
    const m = new T3.Mesh(new T3.DodecahedronGeometry(0.06 + rnd(i * 6.6) * 0.14), pm[i % 3]); m.position.set(s * a, y + 0.03, pz); m.rotation.set(i, i * 2, 0); m.castShadow = true; scene.add(m);
  }
  for (let i = 0; i < 120; i++) {
    const s = i % 2 ? 1 : -1, a = lerp(margem(-0.9), RB1 - 0.1, rnd(i * 7.7)), pz = lerp(-40, Z1 - 0.15, rnd(i * 3.1)), hh = 0.35 + rnd(i * 5.3) * 0.5;
    const m = new T3.Mesh(new T3.ConeGeometry(0.025, hh, 4), junco); m.position.set(s * a, -(RB1 - a) * (-BED) / (RB1 - RB0) + hh / 2, pz); m.rotation.z = (rnd(i) - 0.5) * 0.4; scene.add(m);
  }

  // ---------- rio ----------
  const fluxo = textura('agua', GERA.agua).tx;
  W3.mA = new T3.MeshStandardMaterial({ map: aguaFrente(), roughness: 0.2, transparent: true, opacity: 0.8, depthWrite: false });
  W3.mS = new T3.MeshStandardMaterial({ map: fluxo, color: 0xa8d4ee, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.86, depthWrite: false });
  { const xw = margem(WS); const me = new T3.Mesh(geoZ([[-xw, WS], [-RB0, BED], [RB0, BED], [xw, WS]].reverse(), ZF, Z1 + 0.03), [W3.mA, W3.mS]); me.renderOrder = 2; scene.add(me); uvs(me, 3); uvAgua(me); }
  W3.navio = navio(); W3.navio.scale.setScalar(1.25); W3.navio.position.set(1.4, WS, -20);
  W3.anel = new T3.Mesh(new T3.RingGeometry(0.5, 0.62, 32), new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })); W3.anel.rotation.x = -Math.PI / 2; scene.add(W3.anel);
  W3.anel2 = W3.anel.clone(); W3.anel2.material = W3.anel.material.clone(); scene.add(W3.anel2);
  // contorno tracejado do futuro tunel
  { const pts = [[XS1, YC + R], [RB1 + 2, YC + R], [RB1 + 2, YC - R], [XS1, YC - R], [XS1, YC + R]].map(([a, b]) => new T3.Vector3(a, b, Z1 + 0.04));
    const l = new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineDashedMaterial({ color: 0xffe36a, dashSize: 0.35, gapSize: 0.22, transparent: true, opacity: 0, depthTest: false }));
    l.computeLineDistances(); l.renderOrder = 9; scene.add(l); W3.contorno = l; }

  // ---------- poco: paredes, cavalete com balde, compressor ----------
  const conc = tmat('concreto', { relevo: 1.2 }), madeira = tmat('madeira', { relevo: 1 }), aco = mat(0x8a96a2, { metalness: 0.4, roughness: 0.45 });
  W3.poco = grupo();
  uvMundo(box(XS1 - XS0, -(YC - R), 0.15, conc, (XS0 + XS1) / 2, (YC - R) / 2, Z1 - ZP + 0.075, W3.poco), 1.6);
  uvMundo(box(0.15, -(YC - R), ZP, conc, XS0 + 0.075, (YC - R) / 2, Z1 - ZP / 2, W3.poco), 1.6);
  uvMundo(box(0.15, -(YC + R), ZP, conc, XS1 - 0.075, (YC + R) / 2, Z1 - ZP / 2, W3.poco), 1.6);
  for (let i = 0; i < 18; i++) box(0.04, 0.04, 0.5, aco, XS0 + 0.2, -0.3 - i * 0.42, Z1 - ZP + 0.3, W3.poco);
  for (const dz of [0.05, 0.55]) box(0.05, -(YC - R) + 0.5, 0.05, aco, XS0 + 0.2, (YC - R) / 2 + 0.25, Z1 - ZP + dz, W3.poco);
  for (const s of [-1, 1]) { const p = box(0.12, 3.2, 0.12, madeira, (XS0 + XS1) / 2 + s * 1.0, 1.45, Z1 - ZP / 2, W3.poco); p.rotation.z = s * 0.3; }
  box(2.2, 0.14, 0.14, madeira, (XS0 + XS1) / 2, 2.9, Z1 - ZP / 2, W3.poco);
  W3.corda = box(0.025, 1, 0.025, mat(0x3a3028), (XS0 + XS1) / 2, 0, Z1 - ZP / 2, W3.poco);
  W3.balde = grupo(W3.poco); cyl(0.26, 0.2, 0.4, mat(0x6b6f74, { metalness: 0.5, roughness: 0.5 }), 14, W3.balde); cyl(0.24, 0.24, 0.05, lama, 14, W3.balde).position.y = 0.18;
  W3.monte = new T3.Mesh(new T3.ConeGeometry(1.0, 0.7, 20), lama); W3.monte.position.set(XS0 - 1.6, 0.35, Z1 - 1.2); W3.monte.castShadow = true; W3.poco.add(W3.monte);
  W3.compressor = grupo(); W3.compressor.position.set(XS0 - 1.8, 0, Z1 - 1.0);
  box(1.4, 0.8, 0.8, mat(0x2d7fd2, { roughness: 0.4, metalness: 0.3 }), 0, 0.5, 0, W3.compressor);
  cyl(0.3, 0.3, 1.3, mat(0xd8dde2, { metalness: 0.5, roughness: 0.3 }), 16, W3.compressor).rotation.z = Math.PI / 2;
  W3.compressor.children[1].position.set(0, 1.15, 0);
  for (const [px, pz] of [[-0.5, 0.35], [0.5, 0.35], [-0.5, -0.35], [0.5, -0.35]]) { const r = cyl(0.16, 0.16, 0.1, mat(0x161616), 14, W3.compressor); r.rotation.x = Math.PI / 2; r.position.set(px, 0.16, pz); }
  W3.mangueira = new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3([[XS0 - 1.1, 0.6, Z1 - 1.0], [XS0 + 0.3, 0.4, Z1 - 1.6], [XS0 + 0.35, -3, Z1 - 1.9], [XS0 + 0.35, YC + 0.3, Z1 - 1.9], [XS1 + 0.5, YC + 0.9, Z1 - 1.0], [XBK, YC + 0.9, Z1 - 0.95]].map(v => new T3.Vector3(...v))), 80, 0.07, 8), mat(0x222222, { roughness: 0.6 }));
  scene.add(W3.mangueira);

  // ---------- dentro do tunel ----------
  // piso de tabuas e trilhos (era antiga), carrinho de terra
  W3.piso = grupo();
  const yP = YC - R + 0.28, zP = Math.sqrt(R * R - (R - 0.28) * (R - 0.28));
  W3.tabuas = box(1, 0.06, zP, madeira, 0, yP, Z1 - zP / 2, W3.piso); W3.tabuas.userData.base = true;
  W3.trilhos = [Z1 - 0.25, Z1 - 0.62].map(z => box(1, 0.05, 0.05, aco, 0, yP + 0.05, z, W3.piso));
  W3.carrinho = grupo(); box(0.7, 0.32, 0.5, mat(0x5b6168, { metalness: 0.5, roughness: 0.5 }), 0, 0.28, 0, W3.carrinho); box(0.62, 0.08, 0.42, lama, 0, 0.45, 0, W3.carrinho);
  for (const dx of [-0.22, 0.22]) for (const dz of [-0.19, 0.19]) { const r = cyl(0.07, 0.07, 0.05, mat(0x222222), 10, W3.carrinho); r.rotation.x = Math.PI / 2; r.position.set(dx, 0.08, dz); }
  W3.carrinho.position.set(0, yP + 0.03, Z1 - 0.44);
  W3.peoes = [0xff6d1f, 0xe4572e, 0xff8c1a].map(c => pessoa(c));
  W3.luz = new T3.PointLight(0xffd59a, 5, 7, 1.2); scene.add(W3.luz);
  W3.lampadas = [...Array(8)].map(() => { const m = new T3.Mesh(new T3.SphereGeometry(0.06, 8, 6), mat(0xfff2c0, { emissive: 0xffe08a, emissiveIntensity: 2 })); scene.add(m); return m; });
  // desabamento e agua invadindo
  W3.bolo = grupo(); for (let i = 0; i < 9; i++) { const m = new T3.Mesh(new T3.DodecahedronGeometry(0.25 + rnd(i * 2) * 0.3, 0), lama); m.position.set((rnd(i * 3) - 0.5) * 0.8, (rnd(i * 5) - 0.5) * 0.6, -(rnd(i * 7)) * 0.9); m.castShadow = true; W3.bolo.add(m); }
  W3.mAt = new T3.MeshStandardMaterial({ map: W3.mA.map, roughness: 0.15, transparent: true, opacity: 0.82, depthWrite: false });
  W3.aguaTun = new T3.Mesh(geoX(segmentoAgua(YC - R + 0.01), XS1, XS1 + 0.1), [W3.mAt, W3.mS]); W3.aguaTun.renderOrder = 3; scene.add(W3.aguaTun); W3.aguaKey = '';
  W3.aguaPoco = box(XS1 - XS0 - 0.3, 1, ZP - 0.15, [W3.mS, W3.mS, W3.mS, W3.mS, W3.mAt, W3.mAt], (XS0 + XS1) / 2, 0, Z1 - (ZP - 0.15) / 2 + 0.01); W3.aguaPoco.renderOrder = 3; W3.aguaPoco.castShadow = false;
  W3.gotas = new T3.InstancedMesh(new T3.SphereGeometry(0.045, 8, 6), new T3.MeshStandardMaterial({ color: 0xbfe2f5, roughness: 0.1, transparent: true, opacity: 0.9 }), 260); W3.gotas.frustumCulled = false; W3.gotas.renderOrder = 4; scene.add(W3.gotas);

  // aneis do revestimento (ferro fundido na era do escudo, concreto na era da tuneladora) e borrachas
  const gAnel = geoX(meioAnel(R - 0.01, RI, 48), 0, RW - GAP);
  W3.mFerro = mat(0x4a4f57, { metalness: 0.55, roughness: 0.45 }); W3.mConc = tmat('concreto', { relevo: 0.8, color: 0xdedbd2 });
  W3.aneis = [];
  for (let x0 = XS1; x0 < X1; x0 += RW) { const me = new T3.Mesh(gAnel, W3.mFerro); me.position.x = x0; me.castShadow = me.receiveShadow = true; scene.add(me); uvs(me, 1.4); me.userData.x0 = x0; W3.aneis.push(me); }
  const gBor = geoX(meioAnel(R - 0.06, RI - 0.012), 0, GAP + 0.01);
  W3.borrachas = W3.aneis.map(a => { const me = new T3.Mesh(gBor, mat(0x111214, { roughness: 0.85 })); me.position.x = a.userData.x0 + RW - GAP - 0.005; scene.add(me); return me; });
  // flanges dos aneis de ferro (nervuras na face interna)
  W3.nervuras = W3.aneis.map(a => { const me = new T3.Mesh(geoX(meioAnel(RI + 0.02, RI - 0.06), 0, 0.06), W3.mFerro); me.position.x = a.userData.x0 + 0.02; scene.add(me); return me; });

  // escudo de Brunel/Greathead: casca de aco, celas com operarios, macacos
  W3.escudo = grupo();
  const mAco = mat(0x7d8790, { metalness: 0.6, roughness: 0.38 });
  malha(geoX(meioAnel(R + 0.05, R - 0.1, 56), -1.6, 0), mAco, 0, W3.escudo);
  malha(geoX(meioAnel(R + 0.09, R - 0.12), -0.12, 0.02), mat(0x5a636b, { metalness: 0.7, roughness: 0.3 }), 0, W3.escudo);
  for (const yy of [YC - 0.5, YC + 0.5]) { const dz = Math.sqrt(R * R - (yy - YC) * (yy - YC)); box(1.3, 0.06, dz, mAco, -0.65, yy, Z1 - dz / 2, W3.escudo); }
  box(1.3, 2 * R - 0.2, 0.06, mAco, -0.65, YC, Z1 - 0.95, W3.escudo);
  for (let i = 0; i < 7; i++) { const yy = YC - 1.2 + i * 0.4, dz = Math.sqrt(Math.max(0, R * R - (yy - YC) * (yy - YC))); if (dz > 0.1) box(0.05, 0.3, dz - 0.05, madeira, -0.03, yy, Z1 - dz / 2, W3.escudo); }
  W3.macacos = [YC - 0.9, YC + 0.9].map(yy => { const g = grupo(W3.escudo); const c = cyl(0.08, 0.08, 1, mat(0xb8c0c8, { metalness: 0.8, roughness: 0.25 }), 10, g); c.rotation.z = Math.PI / 2; g.position.set(-1.6, yy, Z1 - 0.9); return g; });
  // antepara com eclusa de ar (camara de ar comprimido)
  W3.antepara = grupo();
  { const me = malha(geoX(meioDisco(R - 0.02), XBK - 0.3, XBK), tmat('tijolo', { relevo: 1 }), 1.2, W3.antepara); }
  W3.eclusa = cyl(0.42, 0.42, 1.6, mat(0x6d7780, { metalness: 0.6, roughness: 0.4 }), 20, W3.antepara); W3.eclusa.rotation.z = Math.PI / 2; W3.eclusa.position.set(XBK - 0.15, YC - 0.65, Z1 - 0.95);
  for (const dx of [-0.95, 0.65]) { const p = cyl(0.36, 0.36, 0.06, mat(0x3a4148, { metalness: 0.7, roughness: 0.3 }), 20, W3.antepara); p.rotation.z = Math.PI / 2; p.position.set(XBK - 0.15 + dx, YC - 0.65, Z1 - 0.95); }
  W3.ar = new T3.Mesh(geoX(meioDisco(RI - 0.01), 0, 1), new T3.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.0, depthWrite: false, side: T3.DoubleSide })); W3.ar.renderOrder = 5; scene.add(W3.ar);
  W3.bolhas = new T3.InstancedMesh(new T3.SphereGeometry(0.05, 8, 6), new T3.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.75 }), 200); W3.bolhas.frustumCulled = false; W3.bolhas.renderOrder = 6; scene.add(W3.bolhas);

  // tuneladora (TBM): roda de corte (cortada pelo plano), camara de lama, rosca, eretor e reboques
  W3.tbm = grupo();
  const amarelo = mat(0xe8a417, { roughness: 0.42, metalness: 0.35 }), escuro = mat(0x2f3439, { metalness: 0.6, roughness: 0.4 });
  malha(geoX(meioAnel(R + 0.05, R - 0.12, 64), -2.6, -0.24), amarelo, 0, W3.tbm);
  W3.roda = grupo(W3.tbm); W3.roda.position.set(-0.12, YC, Z1);
  { const cl = { clippingPlanes: [W3.corte], side: T3.DoubleSide };
    const d = cyl(R - 0.04, R - 0.04, 0.22, mat(0x59616a, { metalness: 0.6, roughness: 0.35, ...cl }), 40, W3.roda); d.rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, sp = new T3.Mesh(new T3.BoxGeometry(0.14, R * 2 - 0.15, 0.22), mat(0xe8a417, { roughness: 0.42, metalness: 0.35, ...cl })); sp.rotation.x = a; sp.position.x = 0.13; W3.roda.add(sp); }
    for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 0.25 + (i / 26) * (R - 0.35), c = new T3.Mesh(new T3.CylinderGeometry(0.07, 0.07, 0.05, 14), mat(0xc9d0d6, { metalness: 0.9, roughness: 0.2, ...cl })); c.position.set(0.15, Math.cos(a) * r, Math.sin(a) * r); W3.roda.add(c); }
    const cubo = new T3.Mesh(new T3.SphereGeometry(0.3, 18, 12), mat(0xe8a417, { roughness: 0.42, metalness: 0.35, ...cl })); cubo.position.x = 0.12; W3.roda.add(cubo);
    W3.roda.traverse(o => { o.castShadow = false; }); }
  W3.camara = malha(geoX(meioDisco(R - 0.12), -0.85, -0.24), mat(0x6e5236, { roughness: 0.95 }), 0, W3.tbm); W3.camara.position.z = -0.06;
  malha(geoX(meioDisco(R - 0.12), -0.95, -0.85), escuro, 0, W3.tbm);
  W3.rosca = new T3.Mesh(new T3.CylinderGeometry(0.16, 0.16, 2.0, 16), mat(0x6c7680, { metalness: 0.6, roughness: 0.35 })); W3.rosca.rotation.z = Math.PI / 2 - 0.3; W3.rosca.position.set(-1.85, YC - 0.75, Z1 - 0.7); W3.tbm.add(W3.rosca);
  W3.eretor = grupo(W3.tbm); W3.eretor.position.set(-2.35, YC, Z1);
  { const braco = box(0.12, RI - 0.25, 0.12, escuro, 0, -(RI - 0.25) / 2, 0, W3.eretor); braco.position.z = 0;
    const segPts = []; for (let i = 0; i <= 8; i++) { const a = -0.45 + 0.9 * i / 8; segPts.push([-RI * Math.sin(a), -RI * Math.cos(a)]); } for (let i = 8; i >= 0; i--) { const a = -0.45 + 0.9 * i / 8; segPts.push([-(R - 0.02) * Math.sin(a), -(R - 0.02) * Math.cos(a)]); }
    const g = new T3.ExtrudeGeometry(forma(segPts.map(([z, y]) => [-z, y])), { depth: RW - GAP, bevelEnabled: false }); g.translate(0, 0, -(RW - GAP) / 2); g.rotateY(Math.PI / 2); g.computeVertexNormals();
    const seg = new T3.Mesh(g, W3.mConc); seg.castShadow = true; W3.eretor.add(seg); uvs(seg, 1.4); }
  W3.eretor.children.forEach(c => c.material = Array.isArray(c.material) ? c.material : c.material);
  for (let i = 0; i < 2; i++) {
    const x0 = -3.0 - i * 1.9;
    box(1.7, 0.08, 0.95, escuro, x0, YC - 0.55, Z1 - 0.5, W3.tbm);
    for (const dx of [-0.75, 0.75]) box(0.08, 1.0, 0.08, escuro, x0 + dx, YC - 0.05, Z1 - 0.95, W3.tbm);
    box(0.7, 0.5, 0.5, i ? mat(0x2d7fd2, { roughness: 0.4, metalness: 0.3 }) : mat(0xd9dde1, { roughness: 0.5 }), x0 + 0.3, YC - 0.25, Z1 - 0.62, W3.tbm);
  }
  W3.esteira = box(4.2, 0.05, 0.32, mat(0x1a1a1a), -4.3, YC + 0.35, Z1 - 0.62, W3.tbm);
  W3.entulho = new T3.InstancedMesh(new T3.DodecahedronGeometry(0.07, 0), lama, 60); W3.entulho.frustumCulled = false; scene.add(W3.entulho);
  W3.lamaP = new T3.InstancedMesh(new T3.SphereGeometry(0.06, 6, 5), mat(0x8a6a48), 90); W3.lamaP.frustumCulled = false; scene.add(W3.lamaP);

  // estrada final dentro do tunel, luminarias e carros
  W3.estrada = grupo();
  const yE = YC - 0.72, zE = Math.sqrt(RI * RI - 0.72 * 0.72);
  uvMundo(box(X1 - XS1, 0.12, zE, tmat('asfalto', { relevo: 0.5 }), (XS1 + X1) / 2, yE, Z1 - zE / 2, W3.estrada), 2);
  for (let i = 0; i < 40; i++) box(0.6, 0.012, 0.05, mat(0xf2c62b), XS1 + 1 + i * 1.3, yE + 0.066, Z1 - 0.03, W3.estrada);
  W3.luzesT = []; for (let i = 0; i < 60; i++) { const m = box(0.25, 0.04, 0.08, mat(0xfff2d0, { emissive: 0xfff0c8, emissiveIntensity: 2.2 }), XS1 + 0.5 + i * 0.85, YC + 0.75, Z1 - Math.sqrt(RI * RI - 0.75 * 0.75) + 0.06, W3.estrada); m.castShadow = false; }
  W3.carros = [0x2c6fd6, 0xd63c2c, 0xf2f2f2, 0x2f2f33, 0x2fa35a].map(c => { const g = carro(c); g.position.set(0, yE + 0.06, Z1 - zE * 0.55); return g; });
}

const ETAPAS = ['rio', 'cava', 'inunda', 'escudo', 'vaza', 'ar', 'bends', 'tbm', 'juntas', 'gaxeta', 'final'];
function estado(s, k) {
  const xf = s === 0 ? XS1 : s === 1 ? lerp(XS1 + 0.3, -3, ease(k * 1.15)) : s === 2 ? -3 : s === 3 ? lerp(-3, -1.0, ease((k - 0.2) * 1.4)) : s === 4 ? -1.0
    : s === 5 ? lerp(-1.0, 0.8, ease((k - 0.15) * 1.3)) : s === 6 ? 0.8 : s === 7 ? lerp(0.8, 4.6, ease((k - 0.05) * 1.2)) : s < 10 ? 8.2 : X1;
  return {
    s, k, xf,
    poco: s >= 1,
    contorno: s === 0 ? ease((k - 0.35) * 4) : 0,
    nivel: s === 2 ? lerp(YC - R, WS - 0.05, ease((k - 0.42) * 1.7)) : s === 3 ? lerp(WS - 0.05, YC - R, ease(k * 4)) : s === 4 ? YC - R + 0.18 * ease((k - 0.3) * 2) : s === 5 ? lerp(YC - R + 0.18, YC - R, ease(k * 3)) : YC - R,
    desaba: s === 2 ? clamp((k - 0.3) * 3) : 0,
    jato: s === 2 ? ease((k - 0.38) * 6) * (1 - ease((k - 0.92) * 10)) : 0,
    redemoinho: s === 2 ? ease((k - 0.35) * 4) : 0,
    escudo: s >= 3 && s <= 6,
    anelEra: s >= 7 ? 'conc' : 'ferro',
    aneisAte: s < 3 ? -99 : s >= 10 ? X1 + 1 : xf - (s >= 7 ? 2.35 : 1.15),
    pop: s === 3 ? k : 1,
    vaza: s === 4 ? ease((k - 0.1) * 3) : s === 5 ? 1 - ease((k - 0.35) * 3) : 0,
    ar: s === 5 ? ease((k - 0.25) * 3) : s === 6 ? 1 : 0,
    antepara: s === 5 ? ease(k * 5) : s === 6 ? 1 : 0,
    bends: s === 6 ? k : 0,
    tbm: s >= 7 && s <= 9,
    pressao: s === 7 ? ease((k - 0.4) * 3) : s === 8 || s === 9 ? 0.5 : 0,
    juntas: s === 8 ? ease((k - 0.15) * 3) : s === 9 ? 1 - ease((k - 0.3) * 5) : 0,
    gaxeta: s === 9 ? ease((k - 0.2) * 2.5) : s === 10 ? 1 : 0,
    estrada: s === 10 ? ease(k * 3) : 0,
    peoes: s >= 1 && s <= 6,
    carrinho: s === 1 || s === 3 || s === 4 || s === 5,
  };
}

function refazCamadas(xf, poco) {
  const xe = Math.max(XS1 + 0.01, Math.min(X1 - 0.01, xf));
  for (const c of W3.camadas) {
    for (const [me, pts, a, b] of [[c.p, perfilCamada(c.y0, c.y1, poco ? 'poco' : 'cheio'), XS0, XS1], [c.t, perfilCamada(c.y0, c.y1, poco ? 'tubo' : 'cheio'), XS1, xe], [c.c, perfilCamada(c.y0, c.y1, 'cheio'), xe, X1]]) {
      me.geometry.dispose(); me.geometry = geoX(pts, a, b); uvs(me, 2.2);
    }
  }
  if (W3.pocoAberto !== poco) for (const c of W3.camadasPoco) { c.me.geometry.dispose(); c.me.geometry = geoX(perfilCamada(c.y0, c.y1, poco ? 'poco' : 'cheio'), XS0, XS1); uvs(c.me, 2.2); }
  W3.xf = xf; W3.pocoAberto = poco;
}

function atualiza(t, ctx) {
  const S = estado(Math.max(0, ETAPAS.indexOf(ctx.p.etapa)), ctx.lt); W3.S = S;
  W3.mS.map.offset.set(0, -t * 0.22);
  if (W3.xf === null || Math.abs(S.xf - W3.xf) > 0.003 || W3.pocoAberto !== S.poco) refazCamadas(S.xf, S.poco);
  const xt = Math.min(S.xf, X1);   // fim do tunel escavado
  // navio subindo o rio e redemoinho em cima do desabamento
  W3.navio.position.z = -26 + t * 0.42; W3.navio.position.y = WS + Math.sin(t * 1.3) * 0.03; W3.navio.rotation.z = Math.sin(t * 0.9) * 0.012;
  [W3.anel, W3.anel2].forEach((a, i) => { a.visible = S.redemoinho > 0.01; const u = (t * 1.2 + i * 0.5) % 1; a.scale.setScalar((0.5 + u * 2.6) * S.redemoinho); a.material.opacity = 0.75 * (1 - u) * S.redemoinho; a.position.set(-3, WS + 0.02, Z1 - 0.9); });
  W3.contorno.visible = false;
  // poco e equipamentos de superficie
  W3.poco.visible = S.poco; W3.gramaPoco.visible = !S.poco; W3.monte.scale.setScalar(Math.max(0.01, S.s === 1 ? 0.4 + 0.6 * S.k : 1));
  const by = S.s === 1 ? lerp(YC - R + 0.5, 1.6, (Math.sin(t * 1.4) * 0.5 + 0.5)) : 1.6;
  W3.balde.position.set((XS0 + XS1) / 2, by, Z1 - ZP / 2); W3.corda.scale.y = Math.max(0.01, 2.85 - by - 0.2); W3.corda.position.y = (2.85 + by + 0.2) / 2;
  W3.compressor.visible = W3.mangueira.visible = S.ar > 0.01 || S.s === 6;
  // piso de tabuas, trilhos e carrinho (era antiga)
  const antigo = S.s >= 1 && S.s <= 6;
  W3.piso.visible = antigo; const Lp = xt - XS0 - 0.4;
  [W3.tabuas, ...W3.trilhos].forEach(m => { m.scale.x = Math.max(0.01, Lp); m.position.x = XS0 + 0.2 + Lp / 2; });
  W3.carrinho.visible = S.carrinho && xt > XS1 + 1.5;
  { const u = (Math.sin(t * 0.8) * 0.5 + 0.5); W3.carrinho.position.x = lerp(XS1 + 0.2, xt - 1.9, u); }
  // operarios: cavando na frente (era antiga); no bends saem pela eclusa e caem
  W3.peoes.forEach((p, i) => {
    p.visible = S.peoes && xt > XS1 + 0.8;
    const yb = S.s >= 3 ? YC - R + 0.31 : YC - R + 0.28;
    let px = xt - 0.45 - i * 0.55, py = yb, pz = Z1 - 0.35 - (i % 2) * 0.45, rz = 0;
    if (S.s === 2) px = lerp(px, XS1 + 0.3 + i * 0.4, ease((S.k - 0.45) * 3)) ;
    if (S.escudo && i === 1) { py = YC - 0.47; pz = Z1 - 0.55; }
    if (S.s === 6) {
      px = XBK - 0.9 - i * 0.62 - ease(S.k * 1.5) * 0.5; py = yb; pz = Z1 - 0.35 - (i % 2) * 0.35;
      rz = ease((S.k - 0.42 - i * 0.08) * 4) * (Math.PI / 2 - 0.2) * (i === 2 ? 0.25 : 1);
    }
    p.position.set(px, py, pz); p.rotation.set(0, Math.PI / 2, rz);
    p.userData.pa.rotation.z = -0.6 + Math.sin(t * 6 + i * 2) * 0.35 * (S.s === 6 ? 0 : 1);
    const ver = S.s === 6 ? ease((S.k - 0.4) * 4) * (0.5 + 0.5 * Math.sin(t * 9)) : 0;
    p.userData.corpo.material.emissive = new T3.Color(0xff1a1a); p.userData.corpo.material.emissiveIntensity = ver * 1.6;
  });
  W3.luz.position.set(xt - 0.9, YC + 0.7, Z1 - 0.4); W3.luz.intensity = antigo || S.tbm ? 5 : 0;
  W3.lampadas.forEach((m, i) => { const px = xt - 0.6 - i * 1.6; m.visible = antigo && px > XS1; m.position.set(px, YC + R - 0.32 - (S.s >= 3 ? 0.25 : 0), Z1 - 0.7); });
  // desabamento: bolo de lama cai do teto na frente e a agua entra
  W3.bolo.visible = S.desaba > 0; W3.bolo.position.set(-3 - 0.4, lerp(YC + R + 0.2, YC - R + 0.45, ease(S.desaba * 1.6)), Z1 - 0.2);
  // agua dentro do tunel e no poco
  const L = S.nivel, chave = `${L.toFixed(3)}_${xt.toFixed(3)}`;
  W3.aguaTun.visible = L > YC - R + 0.02 && xt > XS1 + 0.05;
  if (W3.aguaTun.visible && chave !== W3.aguaKey) { W3.aguaTun.geometry.dispose(); W3.aguaTun.geometry = geoX(segmentoAgua(L, R - 0.02), XS1 - 0.08, xt - 0.02); uvs(W3.aguaTun, 3); uvAgua(W3.aguaTun); W3.aguaKey = chave; }
  W3.aguaPoco.visible = S.poco && L > YC - R + 0.05; { const hh = Math.max(0.01, L - (YC - R)); W3.aguaPoco.scale.y = hh; W3.aguaPoco.position.y = YC - R + hh / 2; }
  // gotas: jato do desabamento, vazamento na frente, pingos nas juntas
  { const m4 = new T3.Matrix4(); let n = 0;
    const put = (px, py, pz) => { if (n < 260) { m4.makeTranslation(px, py, pz); W3.gotas.setMatrixAt(n++, m4); } };
    if (S.jato > 0.01) for (let i = 0; i < 150; i++) { const u = (t * 1.8 + rnd(i * 1.3)) % 1, tt = u * 0.55; if (rnd(i * 7.1) > S.jato) continue; const y = YC + R - 0.1 - 9 * tt * tt; if (y < L) continue; put(-3.2 - 0.6 * u * rnd(i * 2.2) + (rnd(i * 3.3) - 0.5) * 0.25, y, Z1 - 0.15 - rnd(i * 4.4) * 0.8); }
    if (S.vaza > 0.01) for (let i = 0; i < 90; i++) {
      if (rnd(i * 5.1) > S.vaza) continue;
      const u = (t * 1.1 + rnd(i * 1.7)) % 1, y0 = YC + lerp(-0.2, 1.2, rnd(i * 2.9)), dz = Math.sqrt(Math.max(0.01, R * R - (y0 - YC) * (y0 - YC))) * rnd(i * 3.7), y = y0 - 5 * u * u * 0.6;
      if (y < YC - R + 0.3) continue; put(xt - 0.03 - u * 0.25, y, Z1 - 0.05 - dz * 0.9);
    }
    if (S.juntas > 0.01) for (const a of W3.aneis) {
      const xj = a.userData.x0 + RW - GAP / 2; if (xj > S.aneisAte || xj < -3) continue;
      for (let j = 0; j < 3; j++) { const i = Math.round(a.userData.x0 * 10) + j * 17, u = (t * 0.9 + rnd(i * 1.9)) % 1, ang = 0.25 + j * 0.35;
        if (rnd(i * 6.1) > S.juntas) continue;
        const z0 = Z1 - RI * Math.sin(ang), y0 = YC + RI * Math.cos(ang) - 0.04, y = y0 - 4 * u * u; if (y < YC - 0.6) continue; put(xj, y, z0 + 0.04); }
    }
    W3.gotas.count = n; W3.gotas.instanceMatrix.needsUpdate = true; }
  // aneis: aparecem atras do escudo / da tuneladora
  const corA = S.anelEra === 'conc' ? W3.mConc : W3.mFerro;
  W3.aneis.forEach((a, i) => {
    const x1 = a.userData.x0 + RW; let v = x1 <= S.aneisAte ? 1 : 0;
    if (S.s === 3 && a.userData.x0 < -3) v = back(clamp(S.k * 5 - i * 0.06));
    a.visible = v > 0.01; a.scale.set(1, 1, 1); a.material = corA;
    if (v < 1 && v > 0.01) { a.scale.set(1, v, v); a.position.set(a.userData.x0, YC * (1 - v), Z1 * (1 - v)); } else a.position.set(a.userData.x0, 0, 0);
    W3.nervuras[i].visible = a.visible && S.anelEra === 'ferro'; W3.nervuras[i].scale.copy(a.scale); W3.nervuras[i].position.y = a.position.y; W3.nervuras[i].position.z = a.position.z;
    const b = W3.borrachas[i]; b.visible = a.visible && S.gaxeta > 0.01 && S.anelEra === 'conc'; b.scale.set(1, 1, 1); b.position.z = 0;
    if (b.visible) { const g = S.gaxeta; b.scale.set(lerp(2.2, 1, ease(g)), 1, 1); b.material.emissive = new T3.Color(0x2fcf6a); b.material.emissiveIntensity = S.s === 9 ? 0.6 * (1 - ease((S.k - 0.75) * 4)) * ease(g) : 0; }
  });
  // escudo
  W3.escudo.visible = S.escudo; W3.escudo.position.x = xt;
  W3.macacos.forEach((g, i) => { const ext = 0.25 + 0.2 * Math.sin(t * 2 + i); g.children[0].scale.y = ext; g.children[0].position.x = -ext / 2; });
  // camara de ar comprimido
  W3.antepara.visible = S.antepara > 0.01; W3.antepara.scale.set(1, 1, 1); W3.antepara.position.y = (1 - S.antepara) * -0.0;
  W3.ar.visible = S.ar > 0.01; W3.ar.material.opacity = 0.2 * S.ar * (0.85 + 0.15 * Math.sin(t * 3)); W3.ar.scale.x = Math.max(0.01, xt - XBK - (S.escudo ? 0.1 : 0)); W3.ar.position.x = XBK;
  { const m4 = new T3.Matrix4(), sc = new T3.Vector3(), q = new T3.Quaternion(), e = new T3.Vector3(); let n = 0;
    if (S.ar > 0.01) for (let i = 0; i < 120; i++) { const u = (t * 0.5 + rnd(i * 1.9)) % 1, a = rnd(i * 3.1) * Math.PI, r = Math.sqrt(rnd(i * 5.3)) * (RI - 0.15);
      e.set(lerp(XBK + 0.1, xt - 0.2, u), YC + Math.cos(a) * r, Z1 - Math.sin(a) * r); const s2 = S.ar * (1 - Math.abs(u - 0.5) * 1.6); sc.setScalar(Math.max(0.01, s2)); m4.compose(e, q, sc); W3.bolhas.setMatrixAt(n++, m4); }
    if (S.bends > 0.3) W3.peoes.forEach((p, j) => { for (let i = 0; i < 18; i++) { const u = (t * 0.7 + rnd(i * 2.1 + j)) % 1; e.set(p.position.x + (rnd(i * 4.4) - 0.5) * 0.4, p.position.y + 0.3 + u * 0.9, p.position.z + (rnd(i * 6.6) - 0.5) * 0.3); sc.setScalar(1.1 * (1 - u) * ease((S.bends - 0.4) * 4)); m4.compose(e, q, sc); if (n < 200) W3.bolhas.setMatrixAt(n++, m4); } });
    W3.bolhas.count = n; W3.bolhas.instanceMatrix.needsUpdate = true; }
  // tuneladora: roda gira, eretor monta segmentos, lama circula na camara, entulho na esteira
  W3.tbm.visible = S.tbm; W3.tbm.position.x = xt;
  W3.roda.rotation.x = t * (S.s === 7 ? 1.6 : 0.5);
  W3.eretor.rotation.x = (Math.sin(t * 1.3) * 0.5 + 0.5) * 2.5;
  { const m4 = new T3.Matrix4(); let n = 0, n2 = 0;
    if (S.tbm) {
      for (let i = 0; i < 60; i++) { const u = (t * 0.45 + i / 60) % 1; m4.makeTranslation(xt - 2.3 - u * 4.1, YC + 0.42, Z1 - 0.62 + (rnd(i * 3.3) - 0.5) * 0.2); W3.entulho.setMatrixAt(n++, m4); }
      for (let i = 0; i < 90; i++) { const a = t * (0.9 + rnd(i) * 0.6) + rnd(i * 2.7) * 6.28, r = 0.25 + rnd(i * 4.1) * (R - 0.45); m4.makeTranslation(xt - 0.3 - rnd(i * 5.5) * 0.5, YC + Math.cos(a) * r, Z1 - 0.03); W3.lamaP.setMatrixAt(n2++, m4); }
    }
    W3.entulho.count = n; W3.entulho.instanceMatrix.needsUpdate = true; W3.lamaP.count = n2; W3.lamaP.instanceMatrix.needsUpdate = true; }
  // estrada final com carros
  W3.estrada.visible = S.s === 10; W3.estrada.position.y = (1 - S.estrada) * -0.6;
  W3.carros.forEach((c, i) => { c.visible = S.s === 10 && S.estrada > 0.6; const u = (t * 0.09 + i / 5) % 1; c.position.x = lerp(-14, 14, u); });
}

const CAM = {
  rio: { x: 0, y: -4.2, d: 29, a: 0.18, h: 6.0 },
  cava: { x: -6.2, y: -5.2, d: 15, a: 0.1, h: 2.4 },
  inunda: { x: -4.6, y: -4.6, d: 16, a: -0.05, h: 2.2 },
  escudo: { x: -2.4, y: -7.0, d: 8.6, a: -0.32, h: 0.8 },
  vaza: { x: -1.6, y: -7.0, d: 7.4, a: -0.42, h: 0.5 },
  ar: { x: -3.0, y: -6.6, d: 12, a: -0.12, h: 1.0 },
  bends: { x: -7.4, y: -7.3, d: 7.6, a: 0.1, h: 0.5 },
  tbm: { x: 2.2, y: -7.0, d: 9.6, a: -0.18, h: 0.8 },
  juntas: { x: -0.4, y: -7.0, d: 5.6, a: 0.12, h: 0.1 },
  gaxeta: { x: -0.4, y: -7.0, d: 5.6, a: 0.12, h: 0.1 },
  final: { x: 0, y: -4.4, d: 27, a: 0.16, h: 5.0 },
};
function camera(t, ctx) { cameraPadrao(t, ctx, { x: 0, y: -5, d: 14, a: 0, h: 1.5, zFoco: Z1 }, p => CAM[p.etapa] || {}); }

function seta(x0, y0, x1, y1, cor, s = 1, larg = 14) {
  if (s <= 0.01) return;
  const ang = Math.atan2(y1 - y0, x1 - x0), Lx = Math.hypot(x1 - x0, y1 - y0) * s;
  x.save(); x.translate(x0, y0); x.rotate(ang); x.fillStyle = cor; x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(0, -larg / 2); x.lineTo(Lx - 34, -larg / 2); x.lineTo(Lx - 34, -larg * 1.8); x.lineTo(Lx, 0); x.lineTo(Lx - 34, larg * 1.8); x.lineTo(Lx - 34, larg / 2); x.lineTo(0, larg / 2); x.closePath();
  x.stroke(); x.fill(); x.restore();
}
function overlay(t, ctx) {
  const S = W3.S, p = ctx.p, k = ctx.lt, xt = Math.min(S.xf, X1);
  const rot = (px, py, pz, txt, s, cor = 'rgba(255,255,255,0.93)', fg = COL.ink, tam = 34) => { const [a, b] = proj(px, py, pz); pill(a, b, txt, cor, fg, tam, back(s)); };
  const ev = tipo => { const e = ST.eventos.find(e => e.tipo === tipo && e.t >= ctx.t0 - 0.3 && e.t < ctx.t1); return e ? clamp((t - e.t) * 3) : clamp((k - 0.55) * 3); };
  if (p.ruim) pill(W / 2, H * 0.15, p.ruim, COL.red, '#fff', 58, back(ev('erro')));
  if (p.bom) pill(W / 2, H * 0.15, p.bom, COL.green, '#fff', 58, back(ev('certo')));
  if (S.s === 0) {
    const s = ease((k - 0.35) * 4), [a, b] = proj(XS1, YC + R, Z1), [c, d] = proj(RB1 + 2, YC - R, Z1);
    if (s > 0.01) { x.save(); x.globalAlpha = s; x.setLineDash([26, 16]); x.lineDashOffset = -t * 60; x.lineWidth = 8; x.strokeStyle = COL.yellow; x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 8; x.strokeRect(a, b, c - a, d - b); x.restore(); }
    rot(0, YC, Z1, 'TUNNEL GOES HERE', clamp((k - 0.45) * 4), COL.yellow); rot(1.4, WS + 3.0, W3.navio.position.z, 'SHIPS', clamp((k - 0.2) * 4));
  }
  if (S.s === 1) rot(XS0 + 0.7, 1.4, Z1, 'ACCESS SHAFT', clamp((k - 0.15) * 4));
  if (S.s === 2) { rot(-4.4, (BED + YC + R) / 2, Z1, 'SOFT MUD', clamp((k - 0.15) * 4) * (1 - clamp((k - 0.8) * 6))); }
  if (S.s === 4) {
    const s = ease((k - 0.15) * 3);
    for (let i = 0; i < 3; i++) { const [a, b] = proj(xt - 0.5 + i * 0.5, YC + R + 1.05, Z1); const [c, d] = proj(xt - 0.5 + i * 0.5, YC + R + 0.1, Z1); seta(a, b, c, d, '#4fb3ff', s); }
    rot(xt - 1.75, YC + R + 0.6, Z1, 'WATER PRESSURE', clamp((k - 0.3) * 4), '#4fb3ff', '#fff', 32);
  }
  if (S.s === 5 || S.s === 6) {
    const s = S.s === 5 ? ease((k - 0.45) * 3) : 0;
    if (s > 0) { const [a, b] = proj(xt - 1.4, YC + 0.3, Z1 - 0.3), [c, d] = proj(xt - 0.1, YC + 0.3, Z1 - 0.3); seta(a, b, c, d, '#ffffff', s, 16); }
    if (S.s === 5) rot(XBK - 0.15, YC + R + 0.45, Z1, 'AIRLOCK', clamp((k - 0.3) * 4));
    rot((XBK + xt) / 2 + 0.3, YC - R - 0.45, Z1, 'AIR PUSHES BACK', S.s === 5 ? clamp((k - 0.5) * 4) : 1 - clamp(k * 5), 'rgba(255,255,255,0.93)', COL.ink, 30);
    if (S.s === 6) rot(XBK - 1.5, YC + R + 0.55, Z1, 'GAS BUBBLES IN THE BLOOD', clamp((k - 0.45) * 4), 'rgba(255,255,255,0.93)', COL.ink, 34);
  }
  if (S.s === 7) {
    const s = S.pressao;
    for (let i = 0; i < 3; i++) { const yy = YC - 0.8 + i * 0.8, [a, b] = proj(xt - 0.6, yy, Z1), [c, d] = proj(xt + 0.55, yy, Z1); seta(a, b, c, d, '#c98a4a', s); }
    rot(xt - 0.6, YC + R + 0.5, Z1, 'PRESSURIZED MUD', clamp((k - 0.45) * 4), '#c98a4a', '#fff', 32);
    rot(xt + 0.75, YC - 0.3, Z1, 'CUTTER HEAD', clamp((k - 0.2) * 4) * (1 - clamp((k - 0.45) * 5)), 'rgba(255,255,255,0.93)', COL.ink, 30);
  }
  const xj = XS1 + 17 * RW - GAP / 2;
  if (S.s === 8) { rot(xj, YC + R + 0.75, Z1, 'GAP', clamp((k - 0.35) * 4)); const [a, b] = proj(xj, YC + R + 0.55, Z1), [c, d] = proj(xj, YC + R + 0.05, Z1); seta(a, b, c, d, '#ffffff', clamp((k - 0.4) * 4), 10); }
  if (S.s === 9) { rot(xj, YC + R + 0.75, Z1, 'RUBBER GASKET', clamp((k - 0.35) * 4), '#1d2430', '#fff', 32); const [a, b] = proj(xj, YC + R + 0.55, Z1), [c, d] = proj(xj, YC + R + 0.05, Z1); seta(a, b, c, d, '#2fcf6a', clamp((k - 0.4) * 4), 10); }
}
MUNDO = { monta, atualiza, camera, overlay };
})();
