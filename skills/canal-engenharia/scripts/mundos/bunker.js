// Mundo "bunker": quintal com sobrado ao fundo e o terreno em corte (camadas), com uma vala larga reaterrada.
// O corte frontal fica em z = Z1: vemos o container ou o tubo de aco corrugado por dentro, a terra por cima,
// a poeira radioativa caindo e os raios gama (desenhados na camada 2D) atravessando ou parando na terra.
// Etapas: quintal, container, esmaga, tubo, radiacao, terra, reta, curva, ar, ventila, final.
(() => {
const X0 = -16, X1 = 16, Z0 = -14, Z1 = 2.5, ZB = -5.0, BOT = -13;
const HX = 4.3, HB = -4.3;                            // vala: x de -HX a HX, fundo em HB
const CX = 1.22, CY0 = -3.2, CY1 = -0.62;             // container: meia largura, piso e teto
const R = 1.7, TY = -2.1;                             // tubo: raio e centro (topo em -0.4)
const PISO = -3.2;                                    // piso de madeira dentro do tubo
const MH = 0.95, MW = 4.6;                            // monte de terra: altura e meia largura
const SX = 0.95, SR = 0.42;                           // escotilha reta: x e raio
const BX = -3.35, BW = 0.45, BY0 = PISO, BY1 = -2.2;  // entrada com curva: poco em BX e tunel no nivel do piso
const CAMADAS = [[-0.16, 0, 'grama'], [-1.0, -0.16, 'terra'], [-2.1, -1.0, 'terra2'], [-3.4, -2.1, 'argila'], [-4.8, -3.4, 'cascalho'], [BOT, -4.8, 'rocha']];
const W3 = {};
const XS = (a, b, n) => [...Array(n + 1)].map((_, i) => lerp(a, b, i / n));
const monteY = (x, h) => Math.abs(x) >= MW ? 0 : h * Math.pow(Math.cos(Math.PI / 2 * x / MW), 2);

GERA.reaterro = () => geraTerra(0x7a5434, 41, 260, [0.6, 1.3]);
GERA.corrugado = () => {   // chapa de container: nervuras verticais
  return pixels(256, (u, v) => { const n = Math.sin(u * Math.PI * 2 * 8), k = 0.78 + 0.22 * Math.sign(n) * Math.pow(Math.abs(n), 0.4) + rnd(u * 711 + v * 3313) * 0.05; return [196 * k, 82 * k, 40 * k]; });
};
GERA.galv = () => {        // aco galvanizado: manchas cristalinas (spangle) e ondas
  const n1 = fbm(51, 16, 3);
  return pixels(256, (u, v) => { const o = 0.82 + 0.18 * Math.sin(v * Math.PI * 2 * 10), k = o * (0.86 + n1(u, v) * 0.22); return [190 * k, 198 * k, 204 * k]; });
};
GERA.tabua = () => geraMadeira(0xb07b4a, 61);

function uvs(me, esc) {
  const g = me.geometry, p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, v = new T3.Vector3();
  me.updateMatrixWorld();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(me.matrixWorld);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, v.x / esc, v.z / esc); else if (ax > 0.5) uv.setXY(i, v.z / esc, v.y / esc); else uv.setXY(i, v.x / esc, v.y / esc);
  }
  uv.needsUpdate = true; return me;
}
// tira pontos repetidos em sequencia: o ExtrudeGeometry gera NaN com eles
const limpa = pts => pts.filter((q, i) => { const r = pts[(i + pts.length - 1) % pts.length]; return Math.hypot(q[0] - r[0], q[1] - r[1]) > 1e-4; });
function forma(pts, furos = []) {
  pts = limpa(pts); furos = furos.map(limpa);
  const s = new T3.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  for (const f of furos) { const h = new T3.Path(); h.moveTo(f[0][0], f[0][1]); for (let i = 1; i < f.length; i++) h.lineTo(f[i][0], f[i][1]); h.closePath(); s.holes.push(h); }
  return s;
}
function prisma(s, za, zb, m, esc = 2.2, parent = scene) {
  const g = new T3.ExtrudeGeometry(s, { depth: zb - za, bevelEnabled: false, curveSegments: 48 }); g.translate(0, 0, za); g.computeVertexNormals();
  const me = new T3.Mesh(g, m); me.castShadow = me.receiveShadow = true; parent.add(me); return uvs(me, esc);
}
function refaz(me, s, za = ZB, zb = Z1 + 0.004, esc = 2.2) {
  me.geometry.dispose(); const g = new T3.ExtrudeGeometry(s, { depth: zb - za, bevelEnabled: false, curveSegments: 48 }); g.translate(0, 0, za); g.computeVertexNormals();
  me.geometry = g; return uvs(me, esc);
}
const circ = (cx, cy, r, n = 64) => [...Array(n)].map((_, i) => { const a = i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
function tubo(pts, r, m, parent = scene) {
  const curva = new T3.CurvePath(); for (let i = 1; i < pts.length; i++) curva.add(new T3.LineCurve3(new T3.Vector3(...pts[i - 1]), new T3.Vector3(...pts[i])));
  const me = new T3.Mesh(new T3.TubeGeometry(curva, 120, r, 12, false), m); me.castShadow = true; parent.add(me); return { me, curva };
}
// pessoa simples (manequim de documentario, sem rosto)
function pessoa(cor, sentada, parent) {
  const g = grupo(parent), pele = mat(0xd9a07a, { roughness: 0.7 }), roupa = mat(cor, { roughness: 0.8 }), calca = mat(0x3a4250, { roughness: 0.8 });
  const corpo = new T3.Mesh(new T3.CapsuleGeometry(0.17, 0.42, 6, 12), roupa); corpo.position.y = sentada ? 0.78 : 1.12; corpo.castShadow = true; g.add(corpo);
  const cab = new T3.Mesh(new T3.SphereGeometry(0.14, 16, 12), pele); cab.position.y = sentada ? 1.2 : 1.55; cab.castShadow = true; g.add(cab);
  const cabelo = new T3.Mesh(new T3.SphereGeometry(0.145, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(0x3a2a1e)); cabelo.position.copy(cab.position); cabelo.position.y += 0.01; g.add(cabelo);
  for (const s of [-1, 1]) {
    const br = new T3.Mesh(new T3.CapsuleGeometry(0.055, 0.42, 4, 8), roupa); br.position.set(s * 0.22, (sentada ? 0.74 : 1.08), 0); br.rotation.z = s * 0.12; br.castShadow = true; g.add(br);
    const pe = new T3.Mesh(new T3.CapsuleGeometry(0.07, sentada ? 0.32 : 0.62, 4, 8), calca); pe.castShadow = true; g.add(pe);
    if (sentada) { pe.rotation.x = Math.PI / 2; pe.position.set(s * 0.09, 0.5, 0.22); const p2 = new T3.Mesh(new T3.CapsuleGeometry(0.065, 0.3, 4, 8), calca); p2.position.set(s * 0.09, 0.25, 0.42); g.add(p2); }
    else pe.position.set(s * 0.09, 0.42, 0);
  }
  return g;
}

function monta() {
  quintal({ zFundo: ZB - 0.01, zCasa: -27, arvores: [[-10, -26, 1.3], [10, -26.5, 1.5], [-13, -29, 1.1], [13.5, -30, 1.2], [-15, -12, 1.4], [15.5, -10, 1.3]] });
  W3.ceu = scene.children.find(o => o.material && o.material.side === T3.BackSide);
  W3.fogCor = scene.fog.color.clone();
  gl.localClippingEnabled = true;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 }); sun.shadow.camera.updateProjectionMatrix();

  // ---------- terreno em corte com a vala (x de -HX a HX, de ZB ate o corte) ----------
  for (const [ya, yb, nome] of CAMADAS) {
    const m = tmat(nome, nome === 'grama' ? { relevo: 1 } : nome === 'rocha' ? { relevo: 4 } : {});
    solid(X0, X1, ya, yb, Z0, ZB, m, 2.2);
    if (ya < HB) { solid(X0, X1, ya, Math.min(yb, HB), ZB, Z1, m, 2.2); }
    if (yb > HB) { solid(X0, -HX, Math.max(ya, HB), yb, ZB, Z1, m, 2.2); solid(HX, X1, Math.max(ya, HB), yb, ZB, Z1, m, 2.2); }
  }
  // capim na borda do corte
  const tufo = tmat('folhas', { semRelevo: true });
  for (let i = 0; i < 150; i++) {
    const px = lerp(X0 + 1, X1 - 1, rnd(i * 2.7)); if (Math.abs(px) < HX + 0.3) continue;
    const m = new T3.Mesh(new T3.ConeGeometry(0.05, 0.16 + rnd(i) * 0.14, 4), tufo); m.position.set(px, 0.07, Z1 - 0.04 - rnd(i * 3) * 0.3); m.rotation.z = (rnd(i * 5) - 0.5) * 0.5; scene.add(m);
  }
  // terra original dentro da vala (some quando cava) e monte de terra ao lado
  W3.terraM = tmat('terra');
  W3.vala = [];
  for (const [ya, yb, nome] of CAMADAS) { if (yb <= HB) continue; const me = solid(-HX, HX, Math.max(ya, HB), yb, ZB, Z1 - 0.002, tmat(nome, nome === 'grama' ? { relevo: 1 } : {}), 2.2); me.userData.y = [Math.max(ya, HB), yb]; W3.vala.push(me); }
  W3.monteLado = new T3.Mesh(new T3.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), tmat('terra', { relevo: 5 })); W3.monteLado.position.set(-8.2, 0, -2.5); W3.monteLado.castShadow = W3.monteLado.receiveShadow = true; scene.add(W3.monteLado);

  // ---------- reaterro (refeito conforme o que esta enterrado) ----------
  W3.reM = tmat('reaterro', { relevo: 3 });
  W3.reat = prisma(forma([[-HX, HB], [HX, HB], [HX, 0], [-HX, 0]]), ZB, Z1 + 0.004, W3.reM); W3.reatKey = '';
  // monte por cima (camada de 3 pes): frente de terra, topo de terra fresca
  W3.monte = prisma(forma([[-MW, 0], ...XS(-MW, MW, 60).map(x => [x, monteY(x, MH)]), [MW, 0]].reverse()), ZB - 0.6, Z1 + 0.004, [W3.reM, W3.monteTopo = tmat('terra2', { relevo: 4 })]);
  W3.gramaM = tmat('grama', { relevo: 1 });
  W3.monteKey = '';
  // faixas de meia espessura (cada uma corta a radiacao pela metade)
  W3.faixas = [...Array(10)].map(() => { const me = new T3.Mesh(new T3.BufferGeometry(), new T3.LineBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0 })); me.position.z = Z1 + 0.02; me.renderOrder = 6; scene.add(me); return me; });

  // ---------- container (paineis em fatias para poder amassar) ----------
  W3.cont = grupo(); const cm = tmat('corrugado', { relevo: 1.5, roughness: 0.55, metalness: 0.35 }), cmi = mat(0x8d5a3e, { roughness: 0.8 });
  const L = Z1 - ZB - 0.3, zc = (ZB + 0.15 + Z1) / 2;
  W3.teto = [...Array(16)].map((_, i) => { const w = 2 * CX / 16; return box(w + 0.01, 0.07, L, cm, -CX + w * (i + 0.5), CY1, zc, W3.cont); });
  W3.paredes = [-1, 1].map(s => [...Array(10)].map((_, i) => { const h = (CY1 - CY0) / 10; return box(0.07, h + 0.01, L, cm, s * CX, CY0 + h * (i + 0.5), zc, W3.cont); }));
  box(2 * CX, 0.12, L, mat(0x6b5a48, { roughness: 0.9 }), 0, CY0 - 0.06, zc, W3.cont);
  uvMundo(box(2 * CX, CY1 - CY0, 0.07, cm, 0, (CY0 + CY1) / 2, ZB + 0.15, W3.cont), 1.2);
  for (const sx of [-1, 1]) for (const sy of [CY0, CY1]) box(0.16, 0.16, L + 0.02, mat(0x8a3a1c, { roughness: 0.5, metalness: 0.4 }), sx * CX, sy, zc, W3.cont);
  for (const sx of [-1, 1]) box(0.16, CY1 - CY0, 0.16, mat(0x8a3a1c, { roughness: 0.5, metalness: 0.4 }), sx * CX, (CY0 + CY1) / 2, Z1 - 0.1, W3.cont);
  // carga dentro do container: galoes e caixas
  for (let i = 0; i < 4; i++) { const g = cyl(0.2, 0.2, 0.6, mat(0x2d6fc2, { roughness: 0.4 }), 16, W3.cont); g.position.set(-0.85 + i * 0.42, CY0 + 0.3, Z1 - 2.4 - (i % 2) * 0.5); }
  for (let i = 0; i < 3; i++) uvMundo(box(0.55, 0.4, 0.45, mat(0xb8915e), 0.6, CY0 + 0.2 + i * 0.41, Z1 - 3.2, W3.cont), 1);
  W3.contLuz = new T3.PointLight(0xffd59a, 0, 6, 1.6); W3.contLuz.position.set(0, CY1 - 0.4, Z1 - 1.5); W3.cont.add(W3.contLuz);
  W3.poeira = new T3.InstancedMesh(new T3.SphereGeometry(0.05, 6, 5), new T3.MeshBasicMaterial({ color: 0xb59a78, transparent: true, opacity: 0.75, depthWrite: false }), 90); W3.poeira.renderOrder = 5; scene.add(W3.poeira);
  W3.contVoo = 0;

  // ---------- tubo de aco corrugado ----------
  W3.tubo = grupo();
  { const g = new T3.CylinderGeometry(R, R, Z1 - ZB, 72, 180, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 + 0.018 * Math.sin(y * Math.PI * 2 / 0.32); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    g.computeVertexNormals(); g.rotateX(Math.PI / 2);
    const me = new T3.Mesh(g, tmat('galv', { semRelevo: true, roughness: 0.38, metalness: 0.75, side: T3.DoubleSide })); me.position.set(0, TY, (ZB + Z1) / 2); me.castShadow = me.receiveShadow = true; W3.tubo.add(me);
    { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 6); } }
  const borda = new T3.Mesh(new T3.RingGeometry(R - 0.04, R + 0.07, 72), mat(0xe2e7ea, { roughness: 0.3, metalness: 0.8, side: T3.DoubleSide })); borda.position.set(0, TY, Z1 + 0.006); W3.tubo.add(borda);
  { const fundo = new T3.Mesh(new T3.CircleGeometry(R, 64), tmat('concreto', { relevo: 1 })); fundo.position.set(0, TY, ZB + 0.05); W3.tubo.add(fundo); uvMundo(fundo, 1.6); }
  // piso de tabuas, beliche, prateleira com latas, galoes, lampada
  const hw = Math.sqrt(R * R - (PISO - TY) ** 2);
  uvMundo(box(2 * hw - 0.05, 0.08, Z1 - ZB - 0.1, tmat('tabua', { relevo: 1 }), 0, PISO - 0.04, (ZB + Z1) / 2, W3.tubo), 1.5);
  const ferro = mat(0x4a5058, { roughness: 0.4, metalness: 0.7 }), colchao = mat(0x6e7f63, { roughness: 0.9 });
  W3.beliche = grupo(W3.tubo); W3.beliche.position.set(-0.78, PISO, Z1 - 2.6);
  for (const yy of [0.35, 1.25]) { box(0.8, 0.05, 1.9, ferro, 0, yy, 0, W3.beliche); box(0.72, 0.12, 1.8, colchao, 0, yy + 0.08, 0, W3.beliche); }
  for (const [px, pz] of [[-0.38, -0.92], [0.38, -0.92], [-0.38, 0.92], [0.38, 0.92]]) box(0.05, 1.45, 0.05, ferro, px, 0.72, pz, W3.beliche);
  W3.estante = grupo(W3.tubo); W3.estante.position.set(0.95, PISO, Z1 - 3.4);
  const lata = [mat(0xc9302c, { roughness: 0.4, metalness: 0.5 }), mat(0xe0b33a, { roughness: 0.4, metalness: 0.5 }), mat(0x3f7f4a, { roughness: 0.4, metalness: 0.5 })];
  for (let j = 0; j < 4; j++) { box(0.42, 0.04, 1.2, mat(0x8a6a48), 0, 0.2 + j * 0.45, 0, W3.estante); for (let i = 0; i < 5; i++) cyl(0.06, 0.06, 0.14, lata[(i + j) % 3], 12, W3.estante).position.set(0, 0.29 + j * 0.45, -0.45 + i * 0.22); }
  for (let i = 0; i < 2; i++) cyl(0.22, 0.22, 0.75, mat(0x2d6fc2, { roughness: 0.35 }), 18, W3.tubo).position.set(0.55 + i * 0.46, PISO + 0.38, Z1 - 1.0);
  W3.lamp = new T3.Mesh(new T3.SphereGeometry(0.08, 12, 8), new T3.MeshBasicMaterial({ color: 0xffe2a8 })); W3.lamp.position.set(0, TY + R - 0.35, Z1 - 1.6); W3.tubo.add(W3.lamp);
  W3.luz = new T3.PointLight(0xffd59a, 0, 7, 1.4); W3.luz.position.copy(W3.lamp.position); W3.luz.position.y -= 0.15; W3.tubo.add(W3.luz);
  W3.p1 = pessoa(0x7a8f9a, false, W3.tubo); W3.p1.position.set(0.15, PISO, Z1 - 1.5); W3.p1.rotation.y = -0.4;
  W3.p2 = pessoa(0xa86a4a, true, W3.tubo); W3.p2.position.set(-0.78, PISO + 0.43, Z1 - 1.25); W3.p2.rotation.y = 0.25; W3.p2.scale.setScalar(0.92);
  // bafo: neblina quente dentro do tubo
  W3.bafo = new T3.InstancedMesh(new T3.SphereGeometry(0.07, 8, 6), new T3.MeshBasicMaterial({ color: 0xe8e0d0, transparent: true, opacity: 0.16, depthWrite: false }), 140); W3.bafo.renderOrder = 5; scene.add(W3.bafo);
  W3.calor = new T3.Mesh(new T3.CircleGeometry(R - 0.05, 64), new T3.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0, depthWrite: false })); W3.calor.position.set(0, TY, Z1 + 0.01); W3.calor.renderOrder = 4; scene.add(W3.calor);

  // ---------- entradas (no corte: poco escuro com paredes de aco e escada) ----------
  const fundoEsc = (w, h) => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const cx = cv.getContext('2d'); const g = cx.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, '#1b1d20'); g.addColorStop(0.5, '#3a3d42'); g.addColorStop(1, '#1b1d20'); cx.fillStyle = g; cx.fillRect(0, 0, 64, 256); const tx = new T3.CanvasTexture(cv); tx.colorSpace = T3.SRGBColorSpace; return new T3.MeshBasicMaterial({ map: tx }); };
  const parede = mat(0xb9c0c5, { roughness: 0.35, metalness: 0.7 }), degrau = mat(0xd5d9dc, { roughness: 0.3, metalness: 0.8 }), tampa = mat(0x56606a, { roughness: 0.4, metalness: 0.6 });
  // reta: do topo do tubo ate acima do monte
  W3.reta = grupo(); const yTopoT = TY + Math.sqrt(R * R - SX * SX), ySaida = monteY(SX, MH) + 0.35;
  { const h = ySaida - yTopoT + 0.1, me = new T3.Mesh(new T3.PlaneGeometry(2 * SR, h), fundoEsc()); me.position.set(SX, (ySaida + yTopoT) / 2, Z1 + 0.012); me.renderOrder = 2; W3.reta.add(me);
    for (const s of [-1, 1]) box(0.07, h, 0.25, parede, SX + s * SR, (ySaida + yTopoT) / 2, Z1 - 0.08, W3.reta);
    for (let y = yTopoT + 0.15; y < ySaida - 0.05; y += 0.28) { const d = cyl(0.025, 0.025, 2 * SR - 0.1, degrau, 8, W3.reta); d.rotation.z = Math.PI / 2; d.position.set(SX, y, Z1 + 0.03); }
    const t2 = box(2 * SR + 0.3, 0.08, 1.0, tampa, SX - 0.05, ySaida + 0.04, Z1 - 0.45, W3.reta); t2.rotation.z = -0.9; t2.position.x -= 0.35; t2.position.y += 0.3; }
  // curva: poco em BX ate o nivel do piso e tunel de concreto ate a parede do tubo
  W3.curva = grupo(); const ySaidaB = monteY(BX, MH) + 0.35, xTubo = -Math.sqrt(R * R - ((BY0 + BY1) / 2 - TY) ** 2);
  { const h = ySaidaB - BY0, me = new T3.Mesh(new T3.PlaneGeometry(2 * BW, h), fundoEsc()); me.position.set(BX, (ySaidaB + BY0) / 2, Z1 + 0.012); me.renderOrder = 2; W3.curva.add(me);
    const tw = xTubo - (BX + BW) + 0.1, tn = new T3.Mesh(new T3.PlaneGeometry(tw, BY1 - BY0), fundoEsc()); tn.position.set(BX + BW + tw / 2 - 0.05, (BY0 + BY1) / 2, Z1 + 0.012); tn.renderOrder = 2; W3.curva.add(tn);
    const conc = tmat('concreto', { relevo: 1.2 });
    uvMundo(box(0.14, h + 0.14, 0.3, conc, BX - BW, (ySaidaB + BY0) / 2 - 0.07, Z1 - 0.1, W3.curva), 1.2);
    uvMundo(box(0.14, ySaidaB - BY1, 0.3, conc, BX + BW, (ySaidaB + BY1) / 2, Z1 - 0.1, W3.curva), 1.2);
    uvMundo(box(xTubo - BX + BW + 0.1, 0.14, 0.3, conc, (BX - BW + xTubo) / 2 + 0.05, BY0 - 0.07, Z1 - 0.1, W3.curva), 1.2);
    uvMundo(box(xTubo - BX - BW + 0.05, 0.14, 0.3, conc, (BX + BW + xTubo) / 2, BY1 + 0.07, Z1 - 0.1, W3.curva), 1.2);
    for (let y = BY1 + 0.25; y < ySaidaB - 0.05; y += 0.28) { const d = cyl(0.025, 0.025, 2 * BW - 0.1, degrau, 8, W3.curva); d.rotation.z = Math.PI / 2; d.position.set(BX, y, Z1 + 0.03); }
    const t2 = box(2 * BW + 0.3, 0.08, 1.0, tampa, BX, ySaidaB + 0.04, Z1 - 0.45, W3.curva); t2.rotation.z = 0.9; t2.position.x += 0.35; t2.position.y += 0.3;
    W3.batida = new T3.Mesh(new T3.CircleGeometry(0.26, 32), new T3.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0, depthWrite: false })); W3.batida.position.set(BX, BY0 + 0.25, Z1 + 0.03); W3.batida.renderOrder = 7; W3.curva.add(W3.batida);
    W3.xTubo = xTubo; }

  // ---------- ventilacao: entrada com filtro, saida, bomba de manivela ----------
  W3.vent = grupo(); const pvc = mat(0xe9ecee, { roughness: 0.3 }), azul = mat(0x2d6fc2, { roughness: 0.35, metalness: 0.3 });
  const xi = 2.15, xo = -1.95, zv = Z1 - 0.02;
  W3.cIn = tubo([[xi, monteY(xi, MH) + 0.9, zv], [xi, -1.0, zv], [1.05, -1.0, zv], [1.05, TY + 0.95, zv]], 0.1, pvc, W3.vent);
  W3.cOut = tubo([[-0.6, TY + 1.05, zv], [-0.6, -0.75, zv], [xo, -0.75, zv], [xo, monteY(xo, MH) + 0.9, zv]], 0.1, pvc, W3.vent);
  for (const xx of [xi, xo]) { const ch = new T3.Mesh(new T3.SphereGeometry(0.26, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8c949b, { roughness: 0.35, metalness: 0.7 })); ch.rotation.x = Math.PI; ch.position.set(xx, monteY(xx, MH) + 1.0, zv); W3.vent.add(ch); }
  { const f = box(0.32, 0.4, 0.32, azul, xi, monteY(xi, MH) + 0.45, zv, W3.vent); f.name = 'filtro'; }
  W3.bomba = grupo(W3.vent); W3.bomba.position.set(1.05, TY + 0.75, zv);
  box(0.42, 0.34, 0.3, azul, 0, 0, 0, W3.bomba);
  W3.roda = grupo(W3.bomba); W3.roda.position.set(0, 0, 0.2);
  { const r = new T3.Mesh(new T3.TorusGeometry(0.17, 0.02, 8, 24), mat(0xdfe5ea, { metalness: 0.8, roughness: 0.25 })); W3.roda.add(r);
    for (let i = 0; i < 3; i++) { const e = box(0.32, 0.02, 0.02, mat(0xdfe5ea, { metalness: 0.8 }), 0, 0, 0, W3.roda); e.rotation.z = i * Math.PI / 3; }
    const m = cyl(0.025, 0.025, 0.14, mat(0x2a2d31), 8, W3.roda); m.rotation.x = Math.PI / 2; m.position.set(0.17, 0, 0.07); }
  W3.ar = new T3.InstancedMesh(new T3.SphereGeometry(0.05, 8, 6), new T3.MeshBasicMaterial({ color: 0xffffff }), 80); W3.ar.renderOrder = 6; scene.add(W3.ar);

  // ---------- fallout: poeira radioativa caindo e pousando ----------
  W3.fall = new T3.InstancedMesh(new T3.SphereGeometry(0.045, 8, 6), new T3.MeshBasicMaterial({ color: 0xd8ff4a }), 420); W3.fall.renderOrder = 6; scene.add(W3.fall);
  W3.chao = new T3.InstancedMesh(new T3.SphereGeometry(0.05, 8, 6), new T3.MeshBasicMaterial({ color: 0xd8ff4a }), 160); W3.chao.renderOrder = 6; scene.add(W3.chao);

  // fantasma do bunker (onde ele vai ficar)
  W3.fantasma = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(2 * CX, CY1 - CY0, Z1 - ZB - 0.3)), new T3.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  W3.fantasma.position.set(0, (CY0 + CY1) / 2, (ZB + Z1) / 2); scene.add(W3.fantasma);
}

const ETAPAS = ['quintal', 'container', 'esmaga', 'tubo', 'radiacao', 'terra', 'reta', 'curva', 'ar', 'ventila', 'final'];
function estado(s, k) {
  const at = (i, f) => s < i ? 0 : s > i ? 1 : ease(f(k));
  return {
    s, k,
    fantasma: s === 0 ? ease((k - 0.3) * 3) : 0,
    cava: at(1, k => k * 3.2),
    desce: s === 1 ? ease((k - 0.25) * 2.6) : s > 1 ? 1 : 0,
    enche: s === 1 ? ease((k - 0.6) * 3.2) : s === 3 ? ease((k - 0.45) * 3) : s >= 1 ? 1 : 0,
    esmaga: s === 2 ? ease((k - 0.55) * 3.2) : 0,
    cont: s >= 1 && s <= 2 || (s === 3 && k < 0.3),
    tubo: s < 3 ? 0 : s === 3 ? ease((k - 0.25) * 3) : 1,
    monte: at(5, k => (k - 0.08) * 2.2),
    fallout: s === 4 ? ease((k - 0.05) * 3) : s >= 5 && s <= 7 ? 1 : s === 8 ? 1 - ease(k * 2) : 0,
    raios: s === 4 ? ease((k - 0.2) * 3) : s === 5 ? 1 : s === 6 ? ease((k - 0.3) * 3) : s === 7 ? 1 : 0,
    reta: s === 6 ? ease(k * 4) : s === 7 ? 1 - ease(k * 3.5) : 0,
    curva: s === 7 ? ease((k - 0.15) * 3.5) : s > 7 ? 1 : 0,
    gente: s >= 3 ? 1 : 0,
    calor: s === 8 ? ease((k - 0.1) * 2) : s === 9 ? 1 - ease((k - 0.35) * 2.5) : 0,
    vent: at(9, k => (k - 0.05) * 3),
    fluxo: s === 9 ? ease((k - 0.3) * 4) : s === 10 ? 1 : 0,
    escuro: s === 4 ? ease(k * 2) : s >= 5 && s <= 8 ? 1 : s === 9 ? 1 - ease((k - 0.5) * 2) : 0,
  };
}

// contorno do container amassado: teto cede no meio, paredes estufam para dentro
const sagTeto = (x, e) => -0.95 * e * Math.pow(Math.max(0, 1 - (x / CX) ** 2), 0.8);
const bojo = (y, e) => 0.28 * e * Math.sin(clamp((y - CY0) / (CY1 - CY0)) * Math.PI);
function contorno(e) {
  const pts = [];
  for (const y of XS(CY0, CY1, 12)) pts.push([-CX + bojo(y, e), y]);
  for (const x of XS(-CX, CX, 24)) pts.push([x, CY1 + sagTeto(x, e)]);
  for (const y of XS(CY1, CY0, 12)) pts.push([CX - bojo(y, e), y]);
  return pts;
}
function setReaterro(S) {
  // o reaterro existe a partir do container; com o tubo vira um furo redondo
  const furo = S.s >= 3 && S.tubo > 0.5 ? circ(0, TY, R + 0.05) : contorno(S.esmaga);
  const nivel = lerp(HB, 0, S.enche), afunda = x => Math.abs(x) < CX * 1.6 ? -0.55 * S.esmaga * Math.pow(Math.max(0, 1 - (x / (CX * 1.6)) ** 2), 1.2) : 0;
  const key = (S.s >= 3 && S.tubo > 0.5 ? 't' : 'c' + S.esmaga.toFixed(3)) + nivel.toFixed(3);
  if (key === W3.reatKey) return; W3.reatKey = key;
  W3.reat.visible = nivel > HB + 0.02; if (!W3.reat.visible) return;
  const topo = XS(-HX, HX, 60).map(x => [x, nivel + (nivel > -0.01 ? afunda(x) : 0)]);
  // abaixo do topo do objeto o furo entra; acima, so a terra
  const temFuro = nivel > (S.s >= 3 && S.tubo > 0.5 ? TY - R : CY0) + 0.05;
  if (!temFuro) { refaz(W3.reat, forma([[-HX, HB], [HX, HB], ...topo.slice().reverse()])); return; }
  if (nivel < (S.s >= 3 && S.tubo > 0.5 ? TY + R : CY1) - 0.02) {  // ainda enchendo: so os lados e o fundo, em volta do objeto
    const lado = S.s >= 3 && S.tubo > 0.5 ? circ(0, TY, R + 0.05, 96).filter(([, y]) => y <= nivel) : contorno(S.esmaga).filter(([, y]) => y <= nivel);
    const pts = [[-HX, HB], [HX, HB], [HX, nivel]];
    const dir = lado.filter(([x]) => x > 0).sort((a, b) => b[1] - a[1]), esq = lado.filter(([x]) => x <= 0).sort((a, b) => a[1] - b[1]);
    if (S.s >= 3 && S.tubo > 0.5) {
      const ang = Math.asin(clamp((nivel - TY) / (R + 0.05)));
      const arco = XS(ang, -Math.PI - ang, 60).map(a => [Math.cos(a) * (R + 0.05), TY + Math.sin(a) * (R + 0.05)]);
      pts.push(...arco);
    } else {
      pts.push([CX - bojo(nivel, S.esmaga), nivel], [CX, CY0], [-CX, CY0], [-CX + bojo(nivel, S.esmaga), nivel]);
    }
    pts.push([-HX, nivel]);
    refaz(W3.reat, forma(pts.reverse()));
    return;
  }
  refaz(W3.reat, forma([[-HX, HB], [HX, HB], ...topo.slice().reverse()].reverse(), [furo.slice().reverse()]));
}
function setFaixas(S) {
  const on = S.s === 5 && S.k > 0.5 ? clamp((S.k - 0.5) * 3) : 0;
  W3.faixas.forEach((f, i) => {
    f.visible = on > 0.01; if (!f.visible) return;
    f.material.opacity = 0.75 * clamp(on * 10 - i);
    if (f.userData.ok) return;
    const pts = XS(-1.6, 1.6, 40).map(x => { const yb = TY + Math.sqrt(Math.max(0, R * R - x * x)), yt = monteY(x, MH); return new T3.Vector3(x, lerp(yt, yb, (i + 1) / 10.5), 0); });
    f.geometry.dispose(); f.geometry = new T3.BufferGeometry().setFromPoints(pts); f.userData.ok = true;
  });
}
const superficie = (x, S) => monteY(x, MH * S.monte);

function atualiza(t, ctx) {
  const S = estado(Math.max(0, ETAPAS.indexOf(ctx.p.etapa)), ctx.lt); W3.S = S;
  // vala sendo cavada: as camadas da vala baixam ate sumir
  const fundo = lerp(0, HB, S.cava);
  for (const me of W3.vala) { const [ya, yb] = me.userData.y, top = Math.min(yb, fundo); me.visible = top > ya + 0.01 && S.s < 2; if (me.visible) { me.scale.y = (top - ya) / (yb - ya); me.position.y = (ya + top) / 2; } }
  W3.monteLado.visible = S.cava > 0.02 && S.enche < 0.98 || (S.s === 1 && S.k < 0.9);
  const mm = S.s >= 1 ? S.cava * (1 - S.enche * 0.9) : 0; W3.monteLado.scale.set(2.6 * mm + 0.01, 1.4 * mm + 0.01, 2.0 * mm + 0.01);
  W3.fantasma.visible = S.fantasma > 0.01; W3.fantasma.material.opacity = S.fantasma * (0.55 + 0.35 * Math.sin(t * 6));
  // container desce do alto e depois e amassado
  W3.cont.visible = S.cont;
  W3.cont.position.y = lerp(5.5, 0, S.desce) + (S.s === 3 ? ease(ctx.lt / 0.25) * 9 : 0);
  W3.cont.rotation.z = (1 - S.desce) * 0.06 * Math.sin(t * 2);
  W3.teto.forEach(b => { b.position.y = CY1 + sagTeto(b.position.x, S.esmaga); const dx = 0.08, a = (sagTeto(b.position.x + dx, S.esmaga) - sagTeto(b.position.x - dx, S.esmaga)) / (2 * dx); b.rotation.z = Math.atan(a); });
  W3.paredes.forEach((col, j) => { const s = j ? 1 : -1; col.forEach(b => { b.position.x = s * (CX - bojo(b.position.y, S.esmaga)); }); });
  W3.contLuz.intensity = S.s === 1 || S.s === 2 ? 2.5 * S.desce : 0;
  // poeira no esmagamento
  { const m4 = new T3.Matrix4(); let n = 0;
    if (S.s === 2 && S.esmaga > 0.05) for (let i = 0; i < 90; i++) { const u = clamp(S.esmaga * 1.3 - rnd(i) * 0.3), a = rnd(i * 3.3) * 6.28, r = u * (0.6 + rnd(i * 5) * 1.6);
      m4.makeTranslation(Math.cos(a) * r * 1.2, CY1 - 0.3 + Math.sin(a) * r * 0.5 - u * 0.6, Z1 - 0.2 - rnd(i * 7) * 1.5); W3.poeira.setMatrixAt(n++, m4); }
    W3.poeira.count = n; W3.poeira.instanceMatrix.needsUpdate = true; }
  // tubo entra no lugar
  W3.tubo.visible = S.tubo > 0.01; W3.tubo.position.y = (1 - S.tubo) * 3.8;
  W3.luz.intensity = S.s >= 3 ? 3.2 * S.tubo * (S.s === 8 ? 0.85 + 0.15 * Math.sin(t * 9) : 1) : 0;
  W3.p1.visible = W3.p2.visible = S.gente > 0 && S.tubo > 0.9;
  W3.p1.rotation.z = S.s === 8 ? Math.sin(t * 1.5) * 0.03 : 0;
  setReaterro(S);
  W3.monte.visible = S.monte > 0.01; W3.monte.scale.y = Math.max(0.01, S.monte);
  W3.monte.material[1] = S.s === 10 && S.k > 0.25 ? W3.gramaM : W3.monteTopo;
  // entradas
  W3.reta.visible = S.reta > 0.01; W3.reta.scale.set(1, 1, 1); W3.reta.position.y = (1 - S.reta) * 0.0; W3.reta.children.forEach(c => { if (c.material && 'opacity' in c.material) { c.material.transparent = true; c.material.opacity = S.reta; } });
  W3.curva.visible = S.curva > 0.01; W3.curva.children.forEach(c => { if (c !== W3.batida && c.material && 'opacity' in c.material) { c.material.transparent = S.curva < 1; c.material.opacity = S.curva; } });
  W3.batida.material.opacity = S.s === 7 && S.k > 0.4 ? (0.55 + 0.35 * Math.sin(t * 14)) * clamp((S.k - 0.4) * 4) : 0;
  // calor e ar parado
  W3.calor.material.opacity = 0.28 * S.calor;
  { const m4 = new T3.Matrix4(); let n = 0;
    if (S.calor > 0.02) for (let i = 0; i < 140; i++) { if (rnd(i * 4.1) > S.calor) continue; const a = rnd(i * 1.7) * 6.28, r = Math.sqrt(rnd(i * 2.3)) * (R - 0.3), sc = 0.7 + rnd(i * 6) * 1.4;
      m4.compose(new T3.Vector3(Math.cos(a) * r + Math.sin(t * 0.6 + i) * 0.08, TY + Math.sin(a) * r * 0.8 + Math.sin(t * 0.8 + i * 2) * 0.06, Z1 - 0.3 - rnd(i * 9) * 1.5), new T3.Quaternion(), new T3.Vector3(sc, sc, sc)); W3.bafo.setMatrixAt(n++, m4); }
    W3.bafo.count = n; W3.bafo.instanceMatrix.needsUpdate = true; }
  // ventilacao
  W3.vent.visible = S.vent > 0.01;
  for (const c of [W3.cIn, W3.cOut]) c.me.geometry.setDrawRange(0, Math.floor(c.me.geometry.index.count * clamp(S.vent * 1.2) / 6) * 6);
  W3.bomba.scale.setScalar(Math.max(0.01, back(clamp(S.vent * 1.5 - 0.5))));
  W3.vent.children.forEach(c => { if (c.geometry && c.geometry.type === 'SphereGeometry' || c.name === 'filtro') c.scale.setScalar(Math.max(0.01, back(clamp(S.vent * 1.5 - 0.5)))); });
  W3.roda.rotation.z = -t * 4 * S.fluxo;
  { const m4 = new T3.Matrix4(); let n = 0;
    if (S.fluxo > 0.01) { const ponto = (c, u) => { const p = c.curva.getPointAt(u); m4.makeTranslation(p.x, p.y, p.z + 0.11); W3.ar.setMatrixAt(n, m4); W3.ar.setColorAt(n, c === W3.cIn ? new T3.Color(0x8fe0ff) : new T3.Color(0xb8aa98)); n++; };
      for (let i = 0; i < 40; i++) ponto(W3.cIn, (t * 0.3 + i / 40) % 1);
      for (let i = 0; i < 40; i++) ponto(W3.cOut, (t * 0.3 + i / 40) % 1);
      if (W3.ar.instanceColor) W3.ar.instanceColor.needsUpdate = true; }
    W3.ar.count = n; W3.ar.instanceMatrix.needsUpdate = true; }
  // fallout caindo e pousado
  { const m4 = new T3.Matrix4(); let n = 0, c = 0;
    if (S.fallout > 0.01) for (let i = 0; i < 420; i++) { if (rnd(i * 4.7) > S.fallout) continue; const u = (t * 0.35 + rnd(i * 1.3)) % 1, px = lerp(-9, 9, rnd(i * 2.9)), pz = lerp(-8, Z1 - 0.1, rnd(i * 6.1));
      m4.makeTranslation(px + Math.sin(t + i) * 0.2, lerp(9, superficie(px, S) + 0.05, u), pz); W3.fall.setMatrixAt(n++, m4); }
    W3.fall.count = n; W3.fall.instanceMatrix.needsUpdate = true;
    if (S.fallout > 0.01) for (let i = 0; i < 160; i++) { if (rnd(i * 8.3) > S.fallout) continue; const px = lerp(-8, 8, rnd(i * 3.9)), pz = lerp(-6, Z1 - 0.05, Math.sqrt(rnd(i * 5.7)));
      m4.makeTranslation(px, superficie(px, S) + 0.03, pz); W3.chao.setMatrixAt(c++, m4); }
    W3.chao.count = c; W3.chao.instanceMatrix.needsUpdate = true;
    W3.fall.material.color.setHSL(0.2, 1, 0.55 + 0.1 * Math.sin(t * 8)); W3.chao.material.color.copy(W3.fall.material.color); }
  // ceu de poeira: escurece e amarela
  const ch = S.escuro;
  sun.intensity = lerp(2.8, 1.1, ch); hemi.intensity = lerp(1.05, 0.7, ch); fillL.intensity = lerp(0.55, 0.35, ch);
  sun.color.set(0xfff0d8).lerp(new T3.Color(0xffc98a), ch);
  if (W3.ceu) W3.ceu.material.color.set(0xffffff).lerp(new T3.Color(0x9c8f78), ch);
  scene.fog.color.copy(W3.fogCor).lerp(new T3.Color(0xb3a588), ch);
}

const CAM = {
  quintal: { x: 0, y: 0.6, d: 19, a: 0.26, h: 5.0 }, container: { x: 0, y: -1.2, d: 13.5, a: 0.14, h: 2.6 },
  esmaga: { x: 0, y: -1.6, d: 10.5, a: 0.05, h: 1.4 }, tubo: { x: 0, y: -1.6, d: 11.5, a: -0.12, h: 1.8 },
  radiacao: { x: 0, y: -0.8, d: 13.5, a: 0.1, h: 2.4 }, terra: { x: 0, y: -0.9, d: 12.5, a: -0.06, h: 1.8 },
  reta: { x: 0.6, y: -1.0, d: 11.0, a: 0.1, h: 2.2 }, curva: { x: -1.6, y: -1.3, d: 11.5, a: -0.1, h: 1.8 },
  ar: { x: 0, y: -1.9, d: 9.6, a: 0.08, h: 1.1 }, ventila: { x: 0.2, y: -0.8, d: 12.5, a: -0.1, h: 2.2 },
  final: { x: 0, y: 0.0, d: 17.5, a: -0.24, h: 4.6 },
};
function camera(t, ctx) { cameraPadrao(t, ctx, { x: 0, y: -1, d: 12, a: 0, h: 2, zFoco: Z1 }, p => CAM[p.etapa] || {}); }

// raio gama: linha amarela com pulso correndo e brilho; a = opacidade (pode cair ao longo do caminho)
function raio(a, b, t, i, alfaFim = 1, alfa = 1) {
  if (alfa <= 0.01) return;
  const [x0, y0] = a, [x1, y1] = b, n = 14;
  x.save(); x.lineCap = 'round';
  for (let j = 0; j < n; j++) {
    const u0 = j / n, u1 = (j + 1) / n, al = alfa * lerp(1, alfaFim, u0);
    x.strokeStyle = `rgba(255,236,80,${0.85 * al})`; x.lineWidth = 5; x.shadowColor = 'rgba(255,230,60,0.9)'; x.shadowBlur = 14;
    x.beginPath(); x.moveTo(lerp(x0, x1, u0), lerp(y0, y1, u0)); x.lineTo(lerp(x0, x1, u1), lerp(y0, y1, u1)); x.stroke();
  }
  const u = (t * 1.6 + rnd(i * 3.7)) % 1, al = alfa * lerp(1, alfaFim, u);
  x.fillStyle = `rgba(255,255,220,${al})`; x.beginPath(); x.arc(lerp(x0, x1, u), lerp(y0, y1, u), 9, 0, 7); x.fill();
  x.restore();
}
function seta(cx, cy, ang, s, cor = '#ffd23a') {
  if (s <= 0.01) return;
  x.save(); x.translate(cx, cy); x.rotate(ang); x.scale(s, s); x.fillStyle = cor; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(0, 60); x.lineTo(40, 12); x.lineTo(15, 12); x.lineTo(15, -50); x.lineTo(-15, -50); x.lineTo(-15, 12); x.lineTo(-40, 12); x.closePath(); x.stroke(); x.fill(); x.restore();
}

function overlay(t, ctx) {
  const S = W3.S, p = ctx.p, k = ctx.lt;
  const rot = (px, py, pz, txt, s, cor = 'rgba(255,255,255,0.93)', fg = COL.ink, tam = 34) => { const [a, b] = proj(px, py, pz); pill(a, b, txt, cor, fg, tam, back(s)); };
  const ev = tipo => { const e = ST.eventos.find(e => e.tipo === tipo && e.t >= ctx.t0 - 0.3 && e.t < ctx.t1); return e ? clamp((t - e.t) * 3) : clamp((k - 0.55) * 3); };
  // raios gama
  if (S.raios > 0.01) {
    const alvo = [[0.15, -1.9], [-0.7, -2.2], [0.5, -2.6], [-0.2, -1.5], [0.9, -2.0]];
    if (S.s === 4 || S.s === 5) {
      for (let i = 0; i < 9; i++) {
        const sx = lerp(-2.6, 2.6, rnd(i * 5.1)), [ex, ey] = alvo[i % alvo.length];
        const y0 = superficie(sx, S) + 0.05;
        if (S.s === 4) raio(proj(sx, y0, Z1), proj(ex, ey, Z1), t, i, 1, S.raios * clamp(k * 3 - i * 0.12));
        else {  // com a terra grossa: o raio enfraquece a cada faixa e morre antes do teto
          const ang = Math.atan2(ey - y0, ex - sx), yt = TY + Math.sqrt(Math.max(0, R * R - ((sx + ex) / 2) ** 2)), fim = [lerp(sx, ex, clamp((y0 - yt) / (y0 - ey))), yt];
          raio(proj(sx, y0, Z1), proj(fim[0], fim[1] + 0.05, Z1), t, i, 0.02, 1);
        }
      }
    }
    if (S.s === 6) for (let i = 0; i < 4; i++) { const sx = SX - SR * 0.6 + i * SR * 0.4; raio(proj(sx, monteY(SX, MH) + 1.8, Z1), proj(sx, PISO + 0.1, Z1), t, i, 1, S.raios * S.reta); }
    if (S.s === 7) for (let i = 0; i < 4; i++) { const sx = BX - BW * 0.6 + i * BW * 0.4; raio(proj(sx, monteY(BX, MH) + 1.8, Z1), proj(sx, BY0 + 0.15, Z1), t, i, 1, clamp((k - 0.25) * 4) * S.curva); }
  }
  if (p.ruim) pill(W / 2, H * 0.2, p.ruim, COL.red, '#fff', 58, back(ev('erro')));
  if (p.bom) pill(W / 2, H * 0.2, p.bom, COL.green, '#fff', 58, back(ev('certo')));
  if (S.s === 0) rot(0, 1.0, (ZB + Z1) / 2, 'BUNKER GOES HERE', clamp((k - 0.45) * 4));
  if (S.s === 1) rot(0, CY1 + 0.55 + W3.cont.position.y, Z1, 'SHIPPING CONTAINER', clamp((k - 0.3) * 4) * (1 - clamp((k - 0.85) * 6)), 'rgba(255,255,255,0.93)', COL.ink, 32);
  if (S.s === 2) {
    for (let i = 0; i < 3; i++) { const px = lerp(-0.8, 0.8, i / 2), [a, b] = proj(px, 0.7, Z1), bob = Math.sin(t * 6 + i) * 10; seta(a, b + bob, 0, back(clamp((k - 0.1 - i * 0.07) * 4)) * 0.9); }
    for (const s of [-1, 1]) { const [a, b] = proj(s * (CX + 0.9), (CY0 + CY1) / 2, Z1); seta(a, b, s * Math.PI / 2, back(clamp((k - 0.35) * 4)) * 0.75); }
    rot(CX, CY0 - 0.35, Z1, 'STRONG CORNERS ONLY', clamp((k - 0.2) * 4) * (1 - clamp((k - 0.6) * 5)), 'rgba(255,255,255,0.93)', COL.ink, 30);
  }
  if (S.s === 3 && S.tubo > 0.9) {
    // a carga escorre pelo arco
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const a0 = Math.PI / 2 - s * (0.25 + i * 0.42), px = Math.cos(a0) * (R + 0.45), py = TY + Math.sin(a0) * (R + 0.45), [qa, qb] = proj(px, py, Z1);
      seta(qa, qb, a0 - Math.PI / 2 + (s > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI, back(clamp((k - 0.45 - i * 0.08) * 4)) * 0.55);
    }
    rot(0, TY - R - 0.45, Z1, 'CORRUGATED STEEL', clamp((k - 0.5) * 4), 'rgba(255,255,255,0.93)', COL.ink, 30);
  }
  if (S.s === 4) rot(-1.7, 1.25, Z1, 'FALLOUT', clamp((k - 0.15) * 4), 'rgba(200,255,60,0.95)', COL.ink, 34);
  if (S.s === 5) {
    // faixas de meia espessura: cada linha corta a radiacao pela metade
    const on = clamp((k - 0.5) * 3);
    for (let i = 0; i < 10 && on > 0; i++) {
      const al = 0.8 * clamp(on * 10 - i); if (al <= 0) break;
      x.save(); x.strokeStyle = `rgba(255,243,160,${al})`; x.lineWidth = 3; x.setLineDash([14, 10]); x.beginPath();
      XS(-1.55, 1.55, 30).forEach((px, j) => { const yb = TY + Math.sqrt(Math.max(0, R * R - px * px)), yt = monteY(px, MH), [a, b] = proj(px, lerp(yt, yb, (i + 1) / 10.5), Z1); j ? x.lineTo(a, b) : x.moveTo(a, b); });
      x.stroke(); x.restore();
    }
    rot(1.75, -0.25, Z1, '½ EVERY 3.5 IN', on, 'rgba(255,243,160,0.95)', COL.ink, 30);
    rot(-1.9, monteY(-1.9, MH) + 0.5, Z1, '3 FEET', clamp((k - 0.2) * 4), 'rgba(255,255,255,0.93)', COL.ink, 34);
  }
  if (S.s === 8) { rot(1.25, TY + 0.9, Z1, '95°F', clamp((k - 0.2) * 4), COL.red, '#fff', 36); rot(-0.9, TY + 0.6, Z1, 'CO₂', clamp((k - 0.35) * 4), 'rgba(255,255,255,0.93)', COL.ink, 34); }
  if (S.s === 9) { rot(1.8, monteY(2.15, MH) + 1.5, Z1, 'AIR IN', clamp((k - 0.35) * 4), 'rgba(143,224,255,0.95)', COL.ink, 30); rot(-1.55, monteY(-1.95, MH) + 1.5, Z1, 'AIR OUT', clamp((k - 0.45) * 4), 'rgba(255,255,255,0.93)', COL.ink, 30); rot(1.05, TY + 0.25, Z1, 'HAND PUMP', clamp((k - 0.25) * 4), 'rgba(255,255,255,0.93)', COL.ink, 28); }
}
MUNDO = { monta, atualiza, camera, overlay };
})();
