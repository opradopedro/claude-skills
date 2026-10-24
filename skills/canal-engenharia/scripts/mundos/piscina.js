// Mundo "piscina": quintal com sobrado ao fundo e o terreno em corte, com camadas e lencol freatico.
// A piscina tem fundo inclinado (raso a esquerda, fundo a direita) e e cortada em z = Z1, entao a face do corte
// mostra a casca de concreto, a agua e o solo em volta. O casco e um grupo: pode boiar quando o lencol sobe.
// Etapas: quintal, buraco, vaza, concreto, verde, filtro, flutua, boia, valvula, final.
(() => {
const X0 = -16, X1 = 16, Z0 = -14, Z1 = 2.5, BOT = -13;
const XI = 2.5, T = 0.22, XO = XI + T;               // meia largura interna e externa
const ZB = -3.6, ZBo = ZB - T;                        // parede do fundo (interna e externa)
const WT0 = -3.1, WTA = -0.55;                       // lencol freatico normal e depois de uma semana de chuva
const NIV = -0.18;                                   // nivel da agua cheia
const CAMADAS = [[-0.16, 0, 'grama'], [-1.0, -0.16, 'terra'], [-2.05, -1.0, 'terra2'], [-3.5, -2.05, 'argila'], [-4.7, -3.5, 'cascalho'], [BOT, -4.7, 'rocha']];
const W3 = {};

// fundo: raso (-1.1) ate x = -0.7, rampa ate o fundo (-2.0) em x = 1.0
const fundoI = x => x <= -0.7 ? -1.1 : x >= 1.0 ? -2.0 : lerp(-1.1, -2.0, ease((x + 0.7) / 1.7));
const fundoO = x => fundoI(clamp((x + XI) / (2 * XI)) * 2 * XI - XI) - T;
const XS = (a, b, n) => [...Array(n + 1)].map((_, i) => lerp(a, b, i / n));

GERA.reboco = () => { const n1 = fbm(81, 8), n2 = fbm(83, 48, 2); return pixels(256, (u, v) => { const k = 0.9 + n1(u, v) * 0.12 + n2(u, v) * 0.05; return [226 * k, 236 * k, 240 * k]; }); };
GERA.azulejo = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d');
  cx.fillStyle = '#e9eef0'; cx.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    const k = 0.8 + rnd(i * 13 + j * 7) * 0.35, g = cx.createLinearGradient(i * 32, j * 32, i * 32 + 32, j * 32 + 32);
    g.addColorStop(0, `rgb(${40 * k},${110 * k},${170 * k})`); g.addColorStop(1, `rgb(${24 * k},${76 * k},${138 * k})`);
    cx.fillStyle = g; cx.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29);
    cx.fillStyle = 'rgba(255,255,255,0.22)'; cx.fillRect(i * 32 + 3, j * 32 + 3, 12, 4);
  }
  return cv;
};
GERA.pedraBorda = () => geraTerra(0xd9cdb4, 91, 30, [0.86, 1.1]);
GERA.sacoAreia = () => geraTerra(0xd8c08a, 93, 300, [0.8, 1.15]);

function uvs(me, esc, frente) {
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
function prisma(pts, za, zb, m, esc = 2.2, frente, parent = scene) {
  const me = new T3.Mesh(geoPrisma(pts, za, zb), m); me.castShadow = me.receiveShadow = true; parent.add(me); return uvs(me, esc, frente);
}
function refaz(me, pts, za, zb, esc, frente) { me.geometry.dispose(); me.geometry = geoPrisma(pts, za, zb); return uvs(me, esc, frente); }

// regiao entre o fundo f(x) e o nivel L, de x0 a x1 (agua, terra do buraco); null se vazia
function entre(f, x0, x1, L) {
  const xs = XS(x0, x1, 48).filter(xx => f(xx) < L - 0.01);
  if (xs.length < 2) return null;
  return [...xs.map(xx => [xx, f(xx)]), [xs[xs.length - 1], L], [xs[0], L]].reverse();
}
// faixa de solo [ya, yb] com o recorte do buraco (paredes verticais em +-XO); pode virar dois pedacos
function faixa(ya, yb) {
  const topo = [[X0, yb], [-XO, yb], ...XS(-XO, XO, 40).map(xx => [xx, Math.max(ya, Math.min(yb, fundoO(xx)))]), [XO, yb], [X1, yb]];
  const runs = []; let cur = null;
  for (const [xx, y] of topo) {
    if (y > ya + 0.005) { if (!cur) runs.push(cur = []); cur.push([xx, y]); } else { if (cur && cur.length) cur.push([xx, ya]); cur = null; }
  }
  return runs.filter(r => r.length > 1).map(r => [[r[0][0], ya], ...r, [r[r.length - 1][0], ya]].reverse());
}

function aguaFrente() {
  const n1 = fbm(71, 6), n2 = fbm(77, 12, 3);
  const cv = pixels(512, (u, v) => {
    const ca = Math.pow(clamp(1 - Math.abs(n1(u, v * 0.5) - n2(u, v * 0.5)) * 3), 12) * clamp((v - 0.45) * 2);
    return [lerp(40, 150, v) + 70 * ca, lerp(120, 215, v) + 40 * ca, lerp(170, 235, v) + 20 * ca];
  });
  const tx = new T3.CanvasTexture(cv); tx.colorSpace = T3.SRGBColorSpace; tx.wrapS = T3.RepeatWrapping; tx.wrapT = T3.ClampToEdgeWrapping; return tx;
}
const frenteAgua = v => [v.x / 5, (v.y + 2.3) / 2.3];

function filtroFace() {   // corte do filtro de areia: agua, areia fina, areia grossa, cascalho, coletores
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const cx = cv.getContext('2d');
  const g = cx.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, '#7fb4d6'); g.addColorStop(1, '#5d97c0'); cx.fillStyle = g; cx.fillRect(0, 0, 256, 120);
  const cam = [[120, 330, [216, 196, 150], 1.2], [330, 420, [190, 168, 128], 2.5], [420, 512, [150, 146, 140], 6]];
  for (const [a, b, cor, r] of cam) {
    cx.fillStyle = `rgb(${cor})`; cx.fillRect(0, a, 256, b - a);
    for (let i = 0; i < (b - a) * 22 / r; i++) { const k = 0.7 + rnd(i * 3.1 + a) * 0.6; cx.fillStyle = `rgb(${cor.map(c => c * k)})`; cx.beginPath(); cx.arc(rnd(i * 1.7 + a) * 256, a + rnd(i * 5.3 + a) * (b - a), r * (0.6 + rnd(i) * 0.8), 0, 7); cx.fill(); }
  }
  cx.fillStyle = '#e8e4da'; for (let i = 0; i < 5; i++) { cx.fillRect(24 + i * 46, 440, 26, 50); cx.fillStyle = '#222'; for (let j = 0; j < 4; j++) cx.fillRect(28 + i * 46, 448 + j * 11, 18, 3); cx.fillStyle = '#e8e4da'; }
  const tx = new T3.CanvasTexture(cv); tx.colorSpace = T3.SRGBColorSpace; return tx;
}

function tubo(pts, r, m, parent = scene) {
  const curva = new T3.CurvePath(); for (let i = 1; i < pts.length; i++) curva.add(new T3.LineCurve3(new T3.Vector3(...pts[i - 1]), new T3.Vector3(...pts[i])));
  const me = new T3.Mesh(new T3.TubeGeometry(curva, 160, r, 12, false), m); me.castShadow = true; parent.add(me); return { me, curva };
}

function monta() {
  quintal({ zCasa: -26, arvores: [[-10, -25, 1.3], [10, -25.5, 1.5], [-13, -28, 1.1], [13.5, -29, 1.2], [-15, -12, 1.4], [15.5, -10, 1.3]] });
  W3.ceu = scene.children.find(o => o.material && o.material.side === T3.BackSide);
  W3.fogCor = scene.fog.color.clone();
  gl.localClippingEnabled = true;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 }); sun.shadow.camera.updateProjectionMatrix();

  // ---------- terreno em corte: camadas com o recorte do buraco ----------
  for (const [ya, yb, nome] of CAMADAS) {
    const m = tmat(nome, nome === 'grama' ? { relevo: 1 } : nome === 'rocha' ? { relevo: 4 } : {});
    solid(X0, X1, ya, yb, Z0, ZBo, m, 2.2);
    for (const pts of faixa(ya, yb)) prisma(pts, ZBo, Z1, m, 2.2);
  }
  // capim na borda do corte e do buraco
  const tufo = tmat('folhas', { semRelevo: true });
  for (let i = 0; i < 150; i++) {
    const px = lerp(X0 + 1, X1 - 1, rnd(i * 2.7)); if (Math.abs(px) < XO + 0.7) continue;
    const m = new T3.Mesh(new T3.ConeGeometry(0.05, 0.16 + rnd(i) * 0.14, 4), tufo); m.position.set(px, 0.07, Z1 - 0.04 - rnd(i * 3) * 0.3); m.rotation.z = (rnd(i * 5) - 0.5) * 0.5; scene.add(m);
  }
  // lencol freatico: veu azul na face do corte, refeito quando o nivel muda
  W3.lencolM = new T3.MeshBasicMaterial({ color: 0x2d8fe0, transparent: true, opacity: 0.42, depthWrite: false });
  W3.lencol = new T3.Mesh(new T3.BufferGeometry(), W3.lencolM); W3.lencol.position.z = Z1 + 0.012; W3.lencol.renderOrder = 3; scene.add(W3.lencol);
  W3.lencolLinha = new T3.Mesh(new T3.PlaneGeometry(X1 - X0, 0.035), new T3.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.9, depthWrite: false })); W3.lencolLinha.position.z = Z1 + 0.014; W3.lencolLinha.renderOrder = 4; scene.add(W3.lencolLinha);
  W3.lencolKey = '';
  W3.bolhasL = new T3.InstancedMesh(new T3.SphereGeometry(0.035, 8, 6), new T3.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.85 }), 140); W3.bolhasL.renderOrder = 5; scene.add(W3.bolhasL);

  // ---------- escavacao: terra que sai do buraco, monte ao lado, mancha de umidade ----------
  const terraM = tmat('terra');
  W3.terra = prisma(entre(fundoO, -XO, XO, 0), ZBo, Z1 - 0.004, terraM, 2.2); W3.terraD = 0;
  W3.monte = new T3.Mesh(new T3.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), tmat('terra', { relevo: 5 })); W3.monte.position.set(-5.6, 0, -2.2); W3.monte.castShadow = W3.monte.receiveShadow = true; scene.add(W3.monte);
  const mc = document.createElement('canvas'); mc.width = mc.height = 256; const mx = mc.getContext('2d');
  const rg = mx.createRadialGradient(128, 70, 10, 128, 110, 140); rg.addColorStop(0, 'rgba(28,20,12,0.85)'); rg.addColorStop(0.6, 'rgba(34,24,14,0.55)'); rg.addColorStop(1, 'rgba(34,24,14,0)');
  mx.fillStyle = rg; mx.fillRect(0, 0, 256, 256);
  const mtx = new T3.CanvasTexture(mc); mtx.colorSpace = T3.SRGBColorSpace;
  W3.mancha = new T3.Mesh(new T3.PlaneGeometry(1, 1), new T3.MeshBasicMaterial({ map: mtx, transparent: true, depthWrite: false })); W3.mancha.position.set(0.3, -1.9, Z1 + 0.008); W3.mancha.renderOrder = 2; scene.add(W3.mancha);
  W3.gotasSolo = new T3.InstancedMesh(new T3.SphereGeometry(0.045, 8, 6), mat(0x6f8fa8, { roughness: 0.15 }), 40); scene.add(W3.gotasSolo);

  // ---------- agua (uma malha so; o perfil muda: buraco de terra ou casca de concreto) ----------
  W3.mA = new T3.MeshStandardMaterial({ map: aguaFrente(), roughness: 0.15, transparent: true, opacity: 0.8, depthWrite: false });
  const ag = textura('agua', GERA.agua).tx;
  W3.mS = new T3.MeshStandardMaterial({ map: ag, color: 0xbfe6f5, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.88, depthWrite: false });
  W3.pool = grupo();
  W3.agua = new T3.Mesh(new T3.BufferGeometry(), [W3.mA, W3.mS]); W3.agua.renderOrder = 2; W3.aguaKey = '';
  W3.agua.visible = false; scene.add(W3.agua);

  // ---------- ferragem (vergalhoes) ----------
  const aco = mat(0x7a4a2c, { roughness: 0.55, metalness: 0.5 });
  W3.ferro = grupo(W3.pool); W3.ferros = [];
  const meio = x => fundoI(clamp(x, -XI, XI)) - T / 2, xm = XI + T / 2;
  const perfilM = [[-xm, -0.1], ...XS(-xm, xm, 24).map(xx => [xx, meio(xx)]), [xm, -0.1]];
  for (let i = 0; i <= 8; i++) {
    const z = lerp(ZB - T / 2, Z1 - 0.12, i / 8);
    W3.ferros.push(tubo(perfilM.map(([a, b]) => [a, b, z]), 0.022, aco, W3.ferro).me);
  }
  for (const [a, b] of perfilM.filter((_, i) => i % 3 === 0)) W3.ferros.push(tubo([[a, b, ZB - T / 2], [a, b, Z1 - 0.12]], 0.02, aco, W3.ferro).me);
  for (let i = 0; i < 5; i++) { const y = lerp(-0.1, -1.0, i / 4); W3.ferros.push(tubo([[-xm, y, ZB - T / 2], [xm, y, ZB - T / 2]], 0.02, aco, W3.ferro).me); }

  // ---------- casca de concreto (aparece "projetada" da esquerda para a direita: plano de corte) ----------
  W3.clip = new T3.Plane(new T3.Vector3(-1, 0, 0), 10);
  const conc = tmat('concreto', { relevo: 1.4, clippingPlanes: [W3.clip] }), reb = tmat('reboco', { relevo: 0.5, roughness: 0.6, clippingPlanes: [W3.clip] });
  const inner = [[-XI, 0], ...XS(-XI, XI, 40).map(xx => [xx, fundoI(xx)]), [XI, 0]];
  const outer = [[-XO, 0], ...XS(-XO, XO, 40).map(xx => [xx, fundoO(xx)]), [XO, 0]];
  W3.casca = prisma([...outer, ...inner.slice().reverse()].reverse(), ZB, Z1 + 0.022, [conc, reb], 1.6, null, W3.pool);
  W3.fundoP = prisma(outer.slice().reverse(), ZBo, ZB, [reb, reb], 1.6, null, W3.pool);
  // faixa de azulejo na linha d'agua e borda de pedra
  const az = tmat('azulejo', { relevo: 0.4, roughness: 0.35, clippingPlanes: [W3.clip] });
  const azFace = (me, esc) => uvs(me, esc);
  azFace(box(0.012, 0.3, Z1 - ZB, az, -XI + 0.006, -0.15, (ZB + Z1) / 2, W3.pool), 0.6);
  azFace(box(0.012, 0.3, Z1 - ZB, az, XI - 0.006, -0.15, (ZB + Z1) / 2, W3.pool), 0.6);
  azFace(box(2 * XI, 0.3, 0.012, az, 0, -0.15, ZB + 0.006, W3.pool), 0.6);
  const pb = tmat('pedraBorda', { relevo: 1.5, roughness: 0.8, clippingPlanes: [W3.clip] });
  W3.borda = [
    uvMundo(box(0.55, 0.1, Z1 - ZBo + 0.35, pb, -XO + 0.05, 0.05, (ZBo - 0.35 + Z1) / 2 + 0.003, W3.pool), 1.2),
    uvMundo(box(0.55, 0.1, Z1 - ZBo + 0.35, pb, XO - 0.05, 0.05, (ZBo - 0.35 + Z1) / 2 + 0.003, W3.pool), 1.2),
    uvMundo(box(2 * XO + 0.5, 0.1, 0.55, pb, 0, 0.05, ZB - 0.05, W3.pool), 1.2),
  ];
  // linhas pretas de raia no fundo
  const preto = mat(0x1d3550, { roughness: 0.4, clippingPlanes: [W3.clip] });
  for (const zz of [ZB + 1.6, ZB + 3.4]) for (let i = 0; i < 30; i++) {
    const xa = lerp(-XI + 0.25, XI - 0.25, i / 30), xb = lerp(-XI + 0.25, XI - 0.25, (i + 1) / 30);
    const yy = (fundoI(xa) + fundoI(xb)) / 2 + 0.008, me = box(xb - xa + 0.01, 0.01, 0.22, preto, (xa + xb) / 2, yy, zz, W3.pool);
    me.rotation.z = Math.atan2(fundoI(xb) - fundoI(xa), xb - xa); me.castShadow = false;
  }
  // escada de inox
  W3.escada = grupo(W3.pool); const inox = mat(0xdfe5ea, { roughness: 0.15, metalness: 0.9 });
  for (const dz of [-0.28, 0.28]) {
    const c = new T3.CatmullRomCurve3([new T3.Vector3(-XI - 0.35, 0.05, dz), new T3.Vector3(-XI - 0.25, 0.75, dz), new T3.Vector3(-XI + 0.05, 0.8, dz), new T3.Vector3(-XI + 0.2, 0.3, dz), new T3.Vector3(-XI + 0.18, -0.9, dz)]);
    const me = new T3.Mesh(new T3.TubeGeometry(c, 40, 0.035, 10), inox); me.castShadow = true; W3.escada.add(me);
  }
  for (let i = 0; i < 3; i++) box(0.1, 0.03, 0.56, inox, -XI + 0.2, -0.25 - i * 0.28, 0, W3.escada);
  W3.escada.position.z = -1.6;
  // valvula de alivio no ponto mais fundo e o colchao de brita embaixo
  W3.valvula = grupo(W3.pool); W3.valvula.position.set(1.8, fundoI(1.8), Z1 - 0.9);
  cyl(0.28, 0.28, 0.06, mat(0xd1a54a, { roughness: 0.3, metalness: 0.85 }), 24, W3.valvula).position.y = 0.025;
  cyl(0.19, 0.19, 0.03, mat(0x50565d, { roughness: 0.4, metalness: 0.7 }), 24, W3.valvula).position.y = 0.06;
  for (let i = 0; i < 6; i++) box(0.02, 0.012, 0.22, mat(0x222222), -0.1 + i * 0.04, 0.075, 0, W3.valvula);
  cyl(0.06, 0.06, T + 0.2, mat(0xd1a54a, { roughness: 0.3, metalness: 0.85 }), 14, W3.valvula).position.y = -(T + 0.2) / 2;
  W3.brilho = new T3.Mesh(new T3.RingGeometry(0.34, 0.48, 40), new T3.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0, depthWrite: false, side: T3.DoubleSide }));
  W3.brilho.rotation.x = -Math.PI / 2; W3.brilho.position.y = 0.09; W3.valvula.add(W3.brilho);
  W3.brita = grupo(W3.pool); const bm = [mat(0xc9c2b6), mat(0x9b9387), mat(0xe0dad0)];
  for (let i = 0; i < 70; i++) { const me = new T3.Mesh(new T3.DodecahedronGeometry(0.05 + rnd(i * 1.3) * 0.05), bm[i % 3]); me.position.set(1.8 + (rnd(i * 2.1) - 0.5) * 1.3, fundoO(1.8) - 0.05 - rnd(i * 3.3) * 0.28, Z1 - 0.03 - rnd(i * 4.4) * 0.12); me.rotation.set(i, i * 2, 0); W3.brita.add(me); }
  W3.jatoV = new T3.InstancedMesh(new T3.SphereGeometry(0.05, 8, 6), new T3.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, transparent: true, opacity: 0.9 }), 70); W3.jatoV.renderOrder = 3; scene.add(W3.jatoV);

  // ---------- mangueira de jardim ----------
  const verdeM = mat(0x3c9a3a, { roughness: 0.5 });
  W3.mang = grupo();
  { const c = new T3.CatmullRomCurve3([new T3.Vector3(-8.5, 0.05, -3), new T3.Vector3(-6.5, 0.05, -1.0), new T3.Vector3(-4.2, 0.05, 0.4), new T3.Vector3(-3.2, 0.3, 0.6), new T3.Vector3(-2.6, 0.55, 0.65)]);
    const me = new T3.Mesh(new T3.TubeGeometry(c, 60, 0.05, 8), verdeM); me.castShadow = true; W3.mang.add(me); }
  { const r = cyl(0.05, 0.035, 0.25, mat(0xe0b030, { metalness: 0.6, roughness: 0.3 }), 10, W3.mang); r.position.set(-2.45, 0.5, 0.65); r.rotation.z = -1.0; }
  W3.jato = cyl(0.035, 0.07, 1, new T3.MeshStandardMaterial({ color: 0x8fcaf0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.6, depthWrite: false }), 10); W3.jato.renderOrder = 3;

  // ---------- projetor de concreto ----------
  W3.bico = grupo(); cyl(0.07, 0.1, 0.6, mat(0x4a4e55, { metalness: 0.6, roughness: 0.4 }), 12, W3.bico).rotation.z = 0.9;
  W3.spray = new T3.InstancedMesh(new T3.SphereGeometry(0.06, 6, 5), mat(0xa6a39b, { roughness: 0.9 }), 90); scene.add(W3.spray);

  // ---------- sujeira: algas, folhas, chlorine ----------
  W3.algas = new T3.InstancedMesh(new T3.IcosahedronGeometry(0.05, 0), new T3.MeshStandardMaterial({ color: 0x3f6d1c, roughness: 0.8, transparent: true, opacity: 0.9 }), 160); W3.algas.renderOrder = 3; scene.add(W3.algas);
  W3.folhasA = [...Array(14)].map((_, i) => { const m = new T3.Mesh(new T3.CircleGeometry(0.1 + rnd(i) * 0.05, 6), mat(i % 3 ? 0x6b7a2a : 0x9a6a2a, { roughness: 0.7 })); m.rotation.x = -Math.PI / 2; m.scale.y = 0.55; W3.pool.add(m); return m; });
  W3.cloro = grupo(W3.pool);
  { const d = new T3.Mesh(new T3.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf4f6f8, { roughness: 0.3 })); W3.cloro.add(d); cyl(0.17, 0.17, 0.06, mat(0x2d7fd2, { roughness: 0.3 }), 20, W3.cloro).position.y = -0.02; }
  W3.cloroP = new T3.InstancedMesh(new T3.SphereGeometry(0.025, 6, 5), new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }), 60); W3.cloroP.renderOrder = 4; scene.add(W3.cloroP);

  // ---------- casa de maquinas: bomba e filtro de areia em corte, canos enterrados ----------
  W3.maq = grupo(); W3.maq.position.set(0, 0, 0);
  const azul = mat(0x2d6fc2, { roughness: 0.35, metalness: 0.3 }), preto2 = mat(0x2a2d31, { roughness: 0.5 }), pvc = mat(0xf0f2f2, { roughness: 0.3 });
  uvMundo(box(2.6, 0.12, 1.5, tmat('concreto'), 5.0, 0.06, Z1 - 0.85, W3.maq), 1.6);
  W3.bomba = grupo(W3.maq); W3.bomba.position.set(4.1, 0.12, Z1 - 0.55);
  { const mt = cyl(0.17, 0.17, 0.5, azul, 20, W3.bomba); mt.rotation.z = Math.PI / 2; mt.position.set(0.32, 0.22, 0);
    for (let i = 0; i < 8; i++) { const a = cyl(0.175, 0.175, 0.02, mat(0x24589a), 20, W3.bomba); a.rotation.z = Math.PI / 2; a.position.set(0.12 + i * 0.05, 0.22, 0); }
    const vo = cyl(0.2, 0.2, 0.18, preto2, 20, W3.bomba); vo.rotation.z = Math.PI / 2; vo.position.set(-0.03, 0.22, 0);
    const ce = cyl(0.13, 0.13, 0.3, new T3.MeshStandardMaterial({ color: 0xd8f0ff, roughness: 0.05, transparent: true, opacity: 0.5 }), 18, W3.bomba); ce.position.set(-0.3, 0.27, 0);
    box(0.7, 0.06, 0.32, preto2, 0.1, 0.03, 0, W3.bomba); }
  W3.filtro = grupo(W3.maq); W3.filtro.position.set(5.75, 0.12, Z1 - 0.75);
  { const r = 0.5, h = 1.2, casco = mat(0x3a6fb0, { roughness: 0.4, metalness: 0.2, side: T3.DoubleSide });
    const lado = new T3.Mesh(new T3.CylinderGeometry(r, r, h, 32, 1, true, Math.PI / 2, Math.PI), casco); lado.position.y = h / 2 + 0.1; lado.castShadow = true; W3.filtro.add(lado);
    const domo = new T3.Mesh(new T3.SphereGeometry(r, 32, 12, Math.PI / 2, Math.PI, 0, Math.PI / 2), casco); domo.position.y = h + 0.1; W3.filtro.add(domo);
    const face = new T3.Mesh(new T3.PlaneGeometry(2 * r * 0.98, h), new T3.MeshStandardMaterial({ map: filtroFace(), roughness: 0.85 })); face.position.set(0, h / 2 + 0.1, 0.001); W3.filtro.add(face);
    for (const s of [-1, 1]) box(0.03, h, 0.04, mat(0x24589a), s * r * 0.99, h / 2 + 0.1, 0, W3.filtro);
    cyl(r * 0.7, r * 0.8, 0.12, preto2, 24, W3.filtro).position.y = 0.06;
    const man = cyl(0.07, 0.07, 0.05, mat(0xeeeeee, { metalness: 0.5, roughness: 0.2 }), 16, W3.filtro); man.rotation.x = Math.PI / 2; man.position.set(0.18, h + 0.42, 0.05);
    W3.filtroH = h; W3.filtroR = r; }
  W3.gotasF = new T3.InstancedMesh(new T3.SphereGeometry(0.03, 6, 5), new T3.MeshBasicMaterial({ color: 0x6d8f2a }), 50); W3.gotasF.renderOrder = 4; scene.add(W3.gotasF);
  // caminho da agua: escumadeira -> cano enterrado -> bomba -> filtro -> retorno na parede
  const zc = Z1 - 0.1;
  W3.skimmer = box(0.3, 0.22, 0.4, mat(0xf4f4f0, { roughness: 0.4 }), XI + 0.05, -0.14, Z1 - 0.35, W3.maq);
  W3.cSuc = tubo([[XI + 0.1, -0.3, zc], [3.6, -0.3, zc], [3.6, 0.34, zc], [3.75, 0.34, Z1 - 0.55]], 0.08, pvc, W3.maq);
  W3.cLig = tubo([[4.45, 0.34, Z1 - 0.55], [5.0, 0.34, Z1 - 0.55], [5.0, 1.5, Z1 - 0.75], [5.6, 1.5, Z1 - 0.75]], 0.07, pvc, W3.maq);
  W3.cRet = tubo([[5.75, 0.2, Z1 - 0.22], [5.75, -0.85, zc], [XO + 0.02, -0.85, zc]], 0.08, pvc, W3.maq);
  W3.bocal = cyl(0.07, 0.09, 0.1, mat(0xe8e8e8, { roughness: 0.3 }), 12, W3.maq); W3.bocal.rotation.z = Math.PI / 2; W3.bocal.position.set(XI - 0.03, -0.85, zc);
  W3.fluxo = new T3.InstancedMesh(new T3.SphereGeometry(0.045, 8, 6), new T3.MeshBasicMaterial({ color: 0xffffff }), 90); W3.fluxo.renderOrder = 4; scene.add(W3.fluxo);
  W3.corFluxo = [...Array(90)].map(() => new T3.Color());

  // ---------- chuva e pedacos de terra ----------
  W3.chuva = new T3.InstancedMesh(new T3.CylinderGeometry(0.012, 0.012, 0.5, 4), new T3.MeshBasicMaterial({ color: 0xc9d8e6, transparent: true, opacity: 0.55, depthWrite: false }), 700); W3.chuva.renderOrder = 6; scene.add(W3.chuva);
  W3.poca = [...Array(5)].map((_, i) => { const m = new T3.Mesh(new T3.CircleGeometry(1, 24), mat(0x7b8d9e, { roughness: 0.05, metalness: 0.3 })); m.rotation.x = -Math.PI / 2; m.position.set([-6.5, -4.4, 4.2, 7.5, -9][i], 0.012, [-1.2, -4.5, -3.5, -0.8, -6][i]); m.scale.set(0.9 + rnd(i) * 0.6, 0.5 + rnd(i * 3) * 0.3, 1); scene.add(m); return m; });
  W3.torroes = [...Array(16)].map((_, i) => { const m = new T3.Mesh(new T3.DodecahedronGeometry(0.1 + rnd(i * 2) * 0.1), tmat('terra')); m.castShadow = true; scene.add(m); return m; });

  // ---------- fim: guarda-sol, espreguicadeiras, boia ----------
  W3.lazer = grupo();
  { const g = grupo(W3.lazer); g.position.set(4.6, 0, -2.0);
    cyl(0.03, 0.03, 2.4, mat(0xf4f4f0), 8, g).position.y = 1.2;
    const lona = new T3.Mesh(new T3.ConeGeometry(1.5, 0.5, 12), mat(0xe8463a, { roughness: 0.7, side: T3.DoubleSide })); lona.position.y = 2.3; lona.castShadow = true; g.add(lona);
    const lona2 = new T3.Mesh(new T3.ConeGeometry(1.51, 0.5, 12, 1, true, 0, Math.PI / 6), mat(0xf4f4f0, { roughness: 0.7, side: T3.DoubleSide })); lona2.position.y = 2.3; g.add(lona2);
    for (const dx of [-0.9, 0.9]) {
      const e = grupo(W3.lazer); e.position.set(4.6 + dx, 0, -0.6);
      box(0.6, 0.06, 1.6, mat(0xf4f4f0, { roughness: 0.5 }), 0, 0.32, 0, e); const enc = box(0.6, 0.06, 0.7, mat(0xf4f4f0, { roughness: 0.5 }), 0, 0.55, -0.95, e); enc.rotation.x = 0.7;
      box(0.62, 0.02, 1.0, mat(0x2a8fd0, { roughness: 0.6 }), 0, 0.37, 0.2, e);
      for (const [px, pz] of [[-0.26, 0.7], [0.26, 0.7], [-0.26, -0.7], [0.26, -0.7]]) box(0.04, 0.3, 0.04, mat(0xb0b6bb, { metalness: 0.6 }), px, 0.15, pz, e);
    } }
  { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c2 = cv.getContext('2d'); const cs = ['#f4f4f0', '#e8463a', '#f4f4f0', '#2a8fd0', '#f4f4f0', '#f2c62b'];
    cs.forEach((c, i) => { c2.fillStyle = c; c2.fillRect(i * 256 / 6, 0, 256 / 6 + 1, 128); });
    const tx = new T3.CanvasTexture(cv); tx.colorSpace = T3.SRGBColorSpace;
    W3.bola = new T3.Mesh(new T3.SphereGeometry(0.22, 24, 16), mat(0xffffff, { map: tx, roughness: 0.35 })); W3.bola.castShadow = true; W3.pool.add(W3.bola); }

  // fantasma da piscina (onde ela vai ficar)
  W3.fantasma = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(2 * XO, 1.6, Z1 - ZBo)), new T3.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  W3.fantasma.position.set(0, -0.8, (ZBo + Z1) / 2); scene.add(W3.fantasma);
}

const ETAPAS = ['quintal', 'buraco', 'vaza', 'concreto', 'verde', 'filtro', 'flutua', 'boia', 'valvula', 'final'];
function estado(s, k) {
  const at = (i, f) => s < i ? 0 : s > i ? 1 : ease(f(k));
  const fundoMin = -XI;  // so para legibilidade
  return {
    s, k,
    fantasma: s === 0 ? ease((k - 0.3) * 3) : 0,
    cava: at(1, k => k * 2.6),
    monte: s < 1 ? 0 : s === 1 ? ease(k * 2.6) : s === 3 ? 1 - ease(k * 3) : s > 3 ? 0 : 1,
    // agua no buraco de terra (perfil externo): enche com a mangueira e some no solo
    nivelB: s === 1 ? lerp(-2.3, -0.2, ease((k - 0.45) * 2)) : s === 2 ? lerp(-0.2, -2.3, ease((k - 0.1) * 1.5)) : -9,
    jato: s === 1 ? ease((k - 0.38) * 8) * (1 - ease((k - 0.95) * 20)) : s === 3 ? ease((k - 0.74) * 8) : s === 9 ? 1 - ease((k - 0.4) * 6) : 0,
    mangueira: s === 1 || s === 2 || s === 3 || (s === 9 && k < 0.5),
    mancha: s === 2 ? ease(k * 1.4) : s === 3 ? 1 - ease(k * 3) : 0,
    ferro: s < 3 ? 0 : s === 3 ? clamp(k / 0.3) : 1,
    casca: s < 3 ? 0 : s === 3 ? ease((k - 0.3) / 0.42) : 1,
    // agua na piscina (perfil interno, no grupo que pode boiar)
    nivelP: s === 3 ? lerp(-2.1, NIV, ease((k - 0.76) * 4.5)) : s === 4 || s === 5 ? NIV : s === 6 ? lerp(NIV, -2.1, ease(k * 3.2)) : s === 7 ? -9 : s === 8 ? lerp(-2.1, WTA, ease((k - 0.42) * 2)) : s === 9 ? lerp(WTA, NIV, ease(k * 2.2)) : -9,
    verde: s === 4 ? ease(k * 1.8) : s === 5 ? 1 - ease((k - 0.35) * 1.8) : 0,
    maq: at(5, k => k * 3.5), canos: at(5, k => k * 3 - 0.35), fluxo: s === 5 ? ease((k - 0.25) * 4) : 0,
    cloro: s === 5 ? ease((k - 0.62) * 5) : s >= 5 && s !== 6 && s !== 7 ? 1 : 0,
    chuva: s === 6 ? ease((k - 0.2) * 4) : s === 7 ? 1 : s === 8 ? 1 - ease((k - 0.55) * 3) : 0,
    lencol: s < 6 ? WT0 : s === 6 ? lerp(WT0, WTA, ease((k - 0.32) * 2.2)) : s < 9 ? WTA : lerp(WTA, WT0, ease((k - 0.15) * 2)),
    sobe: s === 6 ? ease((k - 0.66) * 3.2) : s === 7 ? 1 : s === 8 ? 1 - ease(k * 3.4) : 0,
    valv: s === 8 ? ease((k - 0.22) * 5) : s === 9 ? 1 : 0,
    jatoV: s === 8 ? ease((k - 0.42) * 6) * (1 - ease((k - 0.95) * 20)) : 0,
    lazer: s === 9 ? ease((k - 0.25) * 3) : 0,
    escada: s >= 4 ? 1 : s === 3 ? ease((k - 0.8) * 6) : 0,
    seco: fundoMin,
  };
}

function setLencol(L, lift) {
  const key = L.toFixed(3) + '|' + lift.toFixed(3);
  if (key === W3.lencolKey) return; W3.lencolKey = key;
  // retangulo ate o nivel L menos o interior da piscina (o casco opaco fica na frente de qualquer jeito)
  const topo = [[X0, L], [-XI, L]];
  for (const xx of XS(-XI, XI, 40)) topo.push([xx, Math.min(L, fundoI(xx) + lift)]);
  topo.push([XI, L], [X1, L]);
  const s = new T3.Shape(); s.moveTo(X0, BOT);
  s.lineTo(X1, BOT); for (let i = topo.length - 1; i >= 0; i--) s.lineTo(topo[i][0], topo[i][1]); s.closePath();
  W3.lencol.geometry.dispose(); W3.lencol.geometry = new T3.ShapeGeometry(s);
  W3.lencolLinha.position.set(0, L, Z1 + 0.014);
}
function setAgua(perfil, L, lift) {
  const key = perfil + L.toFixed(3) + lift.toFixed(3);
  if (key === W3.aguaKey) return; W3.aguaKey = key;
  const f = perfil === 'o' ? fundoO : fundoI, xa = perfil === 'o' ? XO : XI, pts = entre(f, -xa + 0.002, xa - 0.002, L);
  W3.agua.visible = !!pts; if (!pts) return;
  refaz(W3.agua, pts.map(([a, b]) => [a, b + lift]), perfil === 'o' ? ZBo + 0.01 : ZB + 0.01, Z1 + 0.026, 3, frenteAgua);
}

function atualiza(t, ctx) {
  const S = estado(Math.max(0, ETAPAS.indexOf(ctx.p.etapa)), ctx.lt); W3.S = S;
  const lift = 1.05 * S.sobe; W3.lift = lift;
  W3.pool.position.y = lift; W3.pool.rotation.z = -0.035 * S.sobe; W3.pool.position.x = 0.15 * S.sobe;
  // escavacao
  // escavacao: a terra restante fica entre o fundo e um nivel que desce de 0 ate o fundo
  const d = -2.5 * S.cava, cut = entre(fundoO, -XO + 0.003, XO - 0.003, d);
  if (Math.abs(d - W3.terraD) > 0.004 && cut) refaz(W3.terra, cut, ZBo + 0.004, Z1 - 0.004, 2.2);
  W3.terraD = d; W3.terra.visible = !!cut;
  W3.monte.visible = S.monte > 0.02; W3.monte.scale.set(2.0 * S.monte + 0.01, 1.1 * S.monte + 0.01, 1.6 * S.monte + 0.01);
  W3.fantasma.visible = S.fantasma > 0.01; W3.fantasma.material.opacity = S.fantasma * (0.55 + 0.35 * Math.sin(t * 6));
  // ferragem e casca projetada
  W3.ferro.visible = S.ferro > 0 && S.casca < 1;
  W3.ferros.forEach((m, i) => { m.visible = S.ferro * W3.ferros.length > i; });
  const xClip = lerp(-XO - 0.6, XO + 0.6, S.casca); W3.clip.constant = S.casca >= 1 ? 99 : xClip;
  const temCasca = S.casca > 0;
  W3.casca.visible = W3.fundoP.visible = temCasca; W3.borda.forEach(b => b.visible = temCasca);
  W3.bico.visible = S.s === 3 && S.casca > 0 && S.casca < 1;
  { const m4 = new T3.Matrix4(); let n = 0;
    if (W3.bico.visible) {
      const yb = fundoI(clamp(xClip, -XI, XI)) + 1.2; W3.bico.position.set(xClip - 0.3, yb, Z1 - 0.9 + Math.sin(t * 7) * 0.4);
      for (let i = 0; i < 90; i++) { const u = (t * 2.5 + i / 90) % 1; m4.makeTranslation(W3.bico.position.x + 0.2 + u * 0.4 + Math.sin(i) * 0.08 * u, yb - u * (1.1 + rnd(i) * 0.25), W3.bico.position.z + (rnd(i * 3) - 0.5) * 0.5 * u); W3.spray.setMatrixAt(n++, m4); }
    }
    W3.spray.count = n; W3.spray.instanceMatrix.needsUpdate = true; }
  // agua: buraco de terra (perfil externo) ou piscina (perfil interno, sobe junto)
  if (S.s <= 2) { setAgua('o', S.nivelB, 0); }
  else { setAgua('i', S.nivelP, 0); }
  W3.agua.position.y = S.s <= 2 ? 0 : lift; W3.agua.rotation.z = W3.pool.rotation.z; W3.agua.position.x = W3.pool.position.x;
  const lama = S.s <= 2 ? 1 : 0, cA = new T3.Color(0xffffff).lerp(new T3.Color(0xa08a5e), lama * 0.85).lerp(new T3.Color(0x6f9a3a), S.verde * 0.9);
  W3.mA.color.copy(cA); W3.mS.color.set(0xbfe6f5).lerp(new T3.Color(0x8a7650), lama * 0.85).lerp(new T3.Color(0x5f8a2a), S.verde);
  W3.mA.opacity = 0.8 + 0.15 * Math.max(lama, S.verde);
  W3.mS.map.offset.set(t * 0.02, t * 0.013);
  // mangueira e jato
  W3.mang.visible = S.mangueira;
  const topoAgua = S.s <= 2 ? S.nivelB : S.nivelP + lift, yb = Math.max(topoAgua, S.s <= 2 ? -2.3 : -1.1);
  W3.jato.visible = S.jato > 0.02 && W3.mang.visible;
  { const y0 = 0.42, x0 = -2.3, len = Math.max(0.05, (y0 - yb)) * S.jato; W3.jato.scale.set(1, len, 1); W3.jato.position.set(x0 + 0.35, y0 - len / 2, 0.65); W3.jato.rotation.z = 0.25; }
  // vazamento: mancha escura e gotas descendo no solo
  W3.mancha.visible = S.mancha > 0.01; W3.mancha.scale.set(6.5 + 6 * S.mancha, 1.5 + 4.2 * S.mancha, 1); W3.mancha.position.y = -1.5 - 1.6 * S.mancha; W3.mancha.material.opacity = 0.75 * S.mancha;
  { const m4 = new T3.Matrix4(); let n = 0;
    if (S.mancha > 0.05 && S.s === 2) for (let i = 0; i < 40; i++) { const u = (t * 0.5 + rnd(i * 3.3)) % 1, px = lerp(-XO - 1.5, XO + 1.5, rnd(i * 7.1)), py0 = Math.abs(px) < XO ? fundoO(px) : -0.6 - rnd(i) * 1.2;
      m4.makeTranslation(px + Math.sin(u * 6 + i) * 0.1, py0 - u * 2.2, Z1 + 0.03); W3.gotasSolo.setMatrixAt(n++, m4); }
    W3.gotasSolo.count = n; W3.gotasSolo.instanceMatrix.needsUpdate = true; }
  // escada, valvula, boia
  W3.escada.visible = S.escada > 0.01; W3.escada.scale.setScalar(Math.max(0.01, back(S.escada)));
  W3.valvula.visible = S.valv > 0.01; W3.valvula.scale.setScalar(Math.max(0.01, back(S.valv)));
  W3.brilho.material.opacity = S.s === 8 ? (0.75 + 0.25 * Math.sin(t * 7)) * S.valv : 0;
  W3.brita.visible = S.valv > 0.01;
  W3.bola.visible = S.s === 9 && S.nivelP > -0.5;
  W3.bola.position.set(-0.8 + Math.sin(t * 0.5) * 0.4, S.nivelP + 0.12 + Math.sin(t * 2) * 0.02, Z1 - 1.8); W3.bola.rotation.set(t * 0.4, t * 0.3, 0);
  // jato de agua subterranea entrando pela valvula
  { const m4 = new T3.Matrix4(); let n = 0;
    if (S.jatoV > 0.01) { const v = W3.valvula.position, topo = Math.max(v.y + 0.3, S.nivelP);
      for (let i = 0; i < 70; i++) { const u = (t * 1.4 + i / 70) % 1, a = rnd(i * 2.3) * 6.28, rr = u * 0.35 * rnd(i * 5.1);
        m4.makeTranslation(v.x + Math.cos(a) * rr, lerp(v.y - 0.5, topo, u), v.z + Math.sin(a) * rr * 0.6 + 0.3); W3.jatoV.setMatrixAt(n++, m4); } }
    W3.jatoV.count = n; W3.jatoV.instanceMatrix.needsUpdate = true; }
  // algas e folhas
  { const m4 = new T3.Matrix4(); let n = 0;
    if (S.verde > 0.02) for (let i = 0; i < 160; i++) { if (rnd(i * 9.3) > S.verde) continue;
      const px = lerp(-XI + 0.15, XI - 0.15, rnd(i * 1.1)), py = lerp(fundoI(px) + 0.06, S.nivelP - 0.05, rnd(i * 2.2)), sc = 0.6 + rnd(i * 3.3) * 1.2;
      m4.compose(new T3.Vector3(px + Math.sin(t * 0.7 + i) * 0.05, py + Math.sin(t + i * 2) * 0.03, Z1 - 0.05 - rnd(i * 4.4) * 0.4), new T3.Quaternion().setFromEuler(new T3.Euler(i, t * 0.3 + i, 0)), new T3.Vector3(sc, sc, sc)); W3.algas.setMatrixAt(n++, m4); }
    W3.algas.count = n; W3.algas.instanceMatrix.needsUpdate = true; }
  W3.folhasA.forEach((f, i) => { f.visible = S.verde > 0.3 && S.nivelP > -0.5; f.position.set(lerp(-XI + 0.3, XI - 0.3, rnd(i * 5.5)) + Math.sin(t * 0.4 + i) * 0.1, S.nivelP + 0.01, lerp(ZB + 0.4, Z1 - 0.2, rnd(i * 3.7))); f.rotation.z = t * 0.2 + i; });
  // casa de maquinas
  W3.maq.visible = S.maq > 0.01;
  W3.bomba.scale.setScalar(Math.max(0.01, back(S.maq))); W3.filtro.scale.setScalar(Math.max(0.01, back(S.maq * 1.2 - 0.2)));
  for (const c of [W3.cSuc, W3.cLig, W3.cRet]) c.me.geometry.setDrawRange(0, Math.floor(c.me.geometry.index.count * S.canos / 6) * 6);
  { const m4 = new T3.Matrix4(); let n = 0;
    if (S.fluxo > 0.01) {
      const limpo = new T3.Color(0x7fd0ff), sujo = new T3.Color(0x6b8f2a);
      const ponto = (c, u, cor) => { const p = c.curva.getPointAt(u); m4.makeTranslation(p.x, p.y, p.z + 0.09); W3.fluxo.setMatrixAt(n, m4); W3.fluxo.setColorAt(n, cor); n++; };
      for (let i = 0; i < 26; i++) ponto(W3.cSuc, (t * 0.35 + i / 26) % 1, sujo);
      for (let i = 0; i < 14; i++) ponto(W3.cLig, (t * 0.45 + i / 14) % 1, sujo);
      for (let i = 0; i < 26; i++) ponto(W3.cRet, (t * 0.35 + i / 26) % 1, limpo);
      if (W3.fluxo.instanceColor) W3.fluxo.instanceColor.needsUpdate = true;
    }
    W3.fluxo.count = n; W3.fluxo.instanceMatrix.needsUpdate = true; }
  { const m4 = new T3.Matrix4(); let n = 0;
    if (S.fluxo > 0.01) { const f = W3.filtro.position, h = W3.filtroH;
      for (let i = 0; i < 50; i++) { const u = (t * 0.25 + i / 50) % 1; m4.makeTranslation(f.x + (rnd(i * 3.1) - 0.5) * 0.8, f.y + 0.1 + h - u * h * 0.95, f.z + 0.02); W3.gotasF.setMatrixAt(n++, m4); }
      W3.gotasF.material.color.set(0x6b8f2a).lerp(new T3.Color(0x7fd0ff), 0); }
    W3.gotasF.count = n; W3.gotasF.instanceMatrix.needsUpdate = true; }
  W3.cloro.visible = S.cloro > 0.01 && S.nivelP > -1.0; W3.cloro.scale.setScalar(Math.max(0.01, back(S.cloro)));
  W3.cloro.position.set(1.2 + Math.sin(t * 0.5) * 0.3, S.nivelP + 0.02 + Math.sin(t * 2.2) * 0.015, Z1 - 1.2);
  { const m4 = new T3.Matrix4(); let n = 0;
    if (W3.cloro.visible && S.s === 5) for (let i = 0; i < 60; i++) { const u = (t * 0.4 + i / 60) % 1, a = rnd(i) * 6.28, r = u * 1.4;
      m4.makeTranslation(W3.cloro.position.x + Math.cos(a) * r, S.nivelP - 0.1 - u * 0.6 * rnd(i * 2), W3.cloro.position.z + Math.sin(a) * r * 0.4 + 0.3); W3.cloroP.setMatrixAt(n++, m4); }
    W3.cloroP.count = n; W3.cloroP.instanceMatrix.needsUpdate = true; }
  // tempo: chuva escurece o ceu e o sol
  const ch = S.chuva;
  sun.intensity = lerp(2.8, 0.9, ch); hemi.intensity = lerp(1.05, 0.75, ch); fillL.intensity = lerp(0.55, 0.35, ch);
  if (W3.ceu) W3.ceu.material.color.set(0xffffff).lerp(new T3.Color(0x7d8894), ch);
  scene.fog.color.copy(W3.fogCor).lerp(new T3.Color(0x9aa4ae), ch);
  { const m4 = new T3.Matrix4(); let n = 0;
    if (ch > 0.01) for (let i = 0; i < 700; i++) { if (rnd(i * 4.7) > ch) continue; const u = (t * 1.6 + rnd(i * 1.3)) % 1;
      m4.makeTranslation(lerp(-11, 11, rnd(i * 2.9)), lerp(9, -0.2, u), lerp(-10, Z1 + 1.5, rnd(i * 6.1))); W3.chuva.setMatrixAt(n++, m4); }
    W3.chuva.count = n; W3.chuva.instanceMatrix.needsUpdate = true; }
  W3.poca.forEach(p => { p.visible = ch > 0.3; });
  // lencol freatico e bolhas subindo no solo
  setLencol(S.lencol, lift);
  W3.lencolM.opacity = 0.32 + 0.14 * clamp((S.lencol - WT0) / (WTA - WT0));
  { const m4 = new T3.Matrix4(); let n = 0, L = S.lencol;
    for (let i = 0; i < 140; i++) { const px = lerp(X0 + 1, X1 - 1, rnd(i * 3.7)), u = (t * 0.3 + rnd(i * 1.9)) % 1, py = lerp(-6.5, L - 0.08, u);
      if (S.s >= 6 && S.s <= 8 && Math.abs(px) < XO + 0.1 && py > fundoO(px) - 0.05 + 0) { if (py < fundoO(px) + lift - 0.05) { m4.makeTranslation(px, py, Z1 + 0.03); W3.bolhasL.setMatrixAt(n++, m4); } continue; }
      if (Math.abs(px) < XO && py > fundoO(px)) continue;
      m4.makeTranslation(px, py, Z1 + 0.03); W3.bolhasL.setMatrixAt(n++, m4); }
    W3.bolhasL.count = n; W3.bolhasL.instanceMatrix.needsUpdate = true; }
  // torroes que saltam quando a piscina sobe
  W3.torroes.forEach((m, i) => { const s = i % 2 ? 1 : -1, v = S.s === 6 ? clamp((S.k - 0.68) * 4) : S.s === 7 ? 1 : 0;
    m.visible = v > 0 && v < 1 || (S.s === 7);
    const a = v, px = s * (XO + 0.2 + rnd(i * 2.2) * 0.9) + s * a * 0.6, pz = lerp(ZBo, Z1 - 0.2, rnd(i * 5.5));
    m.position.set(px, Math.max(0.08, 0.1 + 1.6 * a - 2.2 * a * a), pz); m.rotation.set(i + a * 4, i * 2, 0); });
  // lazer
  W3.lazer.visible = S.lazer > 0.01; W3.lazer.scale.setScalar(Math.max(0.01, back(S.lazer))); W3.lazer.position.set(4.6 * (1 - Math.max(0.01, back(S.lazer))), 0, -2.0 * (1 - Math.max(0.01, back(S.lazer))));
}

const CAM = {
  quintal: { x: 0, y: 0.6, d: 19, a: 0.26, h: 5.0 }, buraco: { x: -0.6, y: -0.7, d: 12.5, a: 0.14, h: 2.8 },
  vaza: { x: 0, y: -1.2, d: 12.5, a: 0.06, h: 1.8 }, concreto: { x: 0, y: -1.0, d: 11.5, a: -0.16, h: 2.6 },
  verde: { x: 0.2, y: -0.7, d: 10.5, a: 0.16, h: 3.0 }, filtro: { x: 3.1, y: -0.4, d: 12.5, a: -0.12, h: 2.0 },
  flutua: { x: 0, y: -0.9, d: 14.5, a: 0.2, h: 2.4 }, boia: { x: 0, y: -0.9, d: 13, a: 0.04, h: 1.4 },
  valvula: { x: 1.3, y: -1.5, d: 8.0, a: -0.12, h: 3.4 }, final: { x: 0.6, y: 0.2, d: 16.5, a: -0.24, h: 4.6 },
};
function camera(t, ctx) { cameraPadrao(t, ctx, { x: 0, y: -1, d: 12, a: 0, h: 2, zFoco: Z1 }, p => CAM[p.etapa] || {}); }

function overlay(t, ctx) {
  const S = W3.S, p = ctx.p, k = ctx.lt;
  const rot = (px, py, pz, txt, s, cor = 'rgba(255,255,255,0.93)', fg = COL.ink, tam = 34) => { const [a, b] = proj(px, py, pz); pill(a, b, txt, cor, fg, tam, back(s)); };
  const ev = tipo => { const e = ST.eventos.find(e => e.tipo === tipo && e.t >= ctx.t0 - 0.3 && e.t < ctx.t1); return e ? clamp((t - e.t) * 3) : clamp((k - 0.55) * 3); };
  if (p.ruim) pill(W / 2, H * 0.2, p.ruim, COL.red, '#fff', 58, back(ev('erro')));
  if (p.bom) pill(W / 2, H * 0.2, p.bom, COL.green, '#fff', 58, back(ev('certo')));
  if (S.s === 0) { rot(0, 1.0, (ZBo + Z1) / 2, 'POOL GOES HERE', clamp((k - 0.45) * 4)); pill(W / 2, H * 0.2, '100°F', COL.red, '#fff', 64, back(clamp((k - 0.15) * 4))); }
  if (S.s === 3) { rot(-1.6, -0.9, Z1, 'STEEL REBAR', clamp(k * 5) * (1 - clamp((k - 0.4) * 6)), 'rgba(255,255,255,0.93)', COL.ink, 32); rot(0.2, -2.8, Z1, 'SPRAYED CONCRETE', clamp((k - 0.4) * 5) * (1 - clamp((k - 0.74) * 6)), 'rgba(255,255,255,0.93)', COL.ink, 32); }
  if (S.s === 5) { const a = clamp((k - 0.15) * 4); rot(4.1, 0.95, Z1 - 0.55, 'PUMP', a, 'rgba(255,255,255,0.93)', COL.ink, 30); rot(5.75, 2.1, Z1 - 0.75, 'SAND FILTER', clamp((k - 0.3) * 4), 'rgba(255,255,255,0.93)', COL.ink, 30); }
  if (S.s === 6 || S.s === 7) rot(-2.0, S.lencol - 0.75, Z1, 'GROUNDWATER', S.s === 7 ? 1 : clamp((k - 0.4) * 4), 'rgba(45,143,224,0.95)', '#fff', 34);
  if (S.s === 7) {
    // setas de empuxo embaixo do casco
    for (let i = 0; i < 3; i++) {
      const px = lerp(-1.6, 1.6, i / 2), [a, b] = proj(px + W3.pool.position.x, fundoO(px) + W3.lift - 0.35, Z1), bob = Math.sin(t * 5 + i) * 10, s = back(clamp((k - 0.1 - i * 0.08) * 4));
      if (s <= 0.01) continue;
      x.save(); x.translate(a, b + bob); x.scale(s, s); x.fillStyle = '#ffd23a'; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 6;
      x.beginPath(); x.moveTo(0, -70); x.lineTo(42, -18); x.lineTo(16, -18); x.lineTo(16, 50); x.lineTo(-16, 50); x.lineTo(-16, -18); x.lineTo(-42, -18); x.closePath(); x.stroke(); x.fill(); x.restore();
    }
    rot(0, 1.6 + W3.lift, (ZBo + Z1) / 2, 'EMPTY = LIGHT', clamp((k - 0.45) * 4), 'rgba(255,255,255,0.93)', COL.ink, 36);
  }
  if (S.s === 8) rot(1.8, fundoI(1.8) + 0.75, Z1 - 0.9, 'RELIEF VALVE', clamp((k - 0.3) * 4), 'rgba(255,255,255,0.93)', COL.ink, 32);
}
MUNDO = { monta, atualiza, camera, overlay };
})();
