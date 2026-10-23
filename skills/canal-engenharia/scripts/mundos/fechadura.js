// Mundo "fechadura": como a chave abre a fechadura (cilindro de pinos). Dois lugares na mesma cena:
// a porta de madeira (x=0) e a fechadura em raio X, com o eixo do tambor ao longo de x (x=60).
// Etapas: porta, plug, pinos, errada, chave, linha, gira, abre, final.
(() => {
const LOCAL = { porta: new T3.Vector3(0, 0, 0), trava: new T3.Vector3(60, 0, 0) };
const ETAPA_LOCAL = { porta: 'porta', plug: 'trava', pinos: 'trava', errada: 'trava', chave: 'trava', linha: 'trava', gira: 'trava', abre: 'porta', final: 'porta' };
const W3 = {};
// tambor: raio 1, linha de corte em y=1; cinco pinos; altura do corte certo de cada pino (topo da lamina sob o pino)
const PX = [-2.8, -1.4, 0, 1.4, 2.8], CERTA = [0.2, -0.3, 0.35, -0.15, 0.1], ERRADA = [-0.25, 0.3, -0.2, 0.4, -0.35];
const LINHA = 1.0, PISO = -0.7, TOPO_LAMINA = 0.5, MOLA_TOPO = 3.7, DRIVER = 1.1;
const LPINO = CERTA.map(h => LINHA - h);  // pino de baixo do tamanho exato para o corte certo

function perfil(u, hs) {  // topo da lamina na posicao u (eixo da chave): cortes em V e ponta chanfrada
  let y = TOPO_LAMINA;
  hs.forEach((h, i) => { y = Math.min(y, h + Math.abs(u - PX[i]) * 1.3); });
  if (u > 3.4) y = Math.min(y, TOPO_LAMINA - (u - 3.4) * 1.9);
  return y;
}
function chave(hs, m) {
  const g = new T3.Group(), s = new T3.Shape();
  s.moveTo(-4.6, -0.9); s.lineTo(-4.2, -0.9); s.lineTo(-4.2, PISO); s.lineTo(3.7, PISO); s.lineTo(3.95, -0.45);
  for (let u = 3.95; u >= -4.2; u -= 0.05) s.lineTo(u, perfil(u, hs));
  s.lineTo(-4.2, 0.85); s.lineTo(-4.6, 0.85); s.lineTo(-4.6, -0.9);
  const ext = { depth: 0.28, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 };
  const lam = new T3.ExtrudeGeometry(s, ext); lam.translate(0, 0, -0.14);
  const cab = new T3.Shape(); cab.absarc(-6.0, 0, 1.45, 0, Math.PI * 2);
  const furo = new T3.Path(); furo.absarc(-6.8, 0, 0.42, 0, Math.PI * 2, true); cab.holes.push(furo);
  const cg = new T3.ExtrudeGeometry(cab, { ...ext, depth: 0.34, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 }); cg.translate(0, 0, -0.17);
  for (const geo of [lam, cg]) { const me = new T3.Mesh(geo, m); me.castShadow = me.receiveShadow = true; g.add(me); }
  return g;
}
class Helice extends T3.Curve {
  getPoint(t, alvo = new T3.Vector3()) { return alvo.set(0.17 * Math.cos(t * Math.PI * 16), t, 0.17 * Math.sin(t * Math.PI * 16)); }
}
const vidro = (cor, op) => new T3.MeshStandardMaterial({ color: cor, roughness: 0.25, metalness: 0.2, transparent: true, opacity: op, depthWrite: false });
function contorno(geo, cor, op, parent) {
  const l = new T3.LineSegments(new T3.EdgesGeometry(geo, 25), new T3.LineBasicMaterial({ color: cor, transparent: true, opacity: op }));
  parent.add(l); return l;
}

function monta() {
  scene.add(sun.target);
  const latao = mat(0xc9a03e, { roughness: 0.32, metalness: 0.45 }), aco = mat(0xb9c0c8, { roughness: 0.28, metalness: 0.5 });
  const cobre = mat(0xc47a3c, { roughness: 0.3, metalness: 0.45 });
  // ---- porta ----
  const P = LOCAL.porta;
  const parede = tmat('concreto', { color: 0xf3e9da, relevo: 0.8 });
  uvMundo(box(14, 16, 0.5, parede, P.x - 8.9, 8, -0.25), 3); uvMundo(box(14, 16, 0.5, parede, P.x + 9.0, 8, -0.25), 3);
  uvMundo(box(4, 8.4, 0.5, parede, P.x, 7.6 + 4.2, -0.25), 3);
  uvMundo(box(30, 0.3, 14, tmat('madeira', { relevo: 1.2 }), P.x, -0.15, 3), 2.5);
  const batente = mat(0xf4f1ea, { roughness: 0.6 });
  box(0.3, 7.9, 0.7, batente, P.x - 2.05, 3.95, 0); box(4.4, 0.3, 0.7, batente, P.x, 7.75, 0);
  // batente direito em dois pedacos: o vao mostra a lingueta entrando nele
  box(0.4, 3.45, 0.7, batente, P.x + 2.1, 1.72, 0); box(0.4, 4.1, 0.7, batente, P.x + 2.1, 5.65, 0);
  box(0.4, 0.15, 0.7, mat(0x2a2522), P.x + 2.1, 3.52, 0);
  W3.dobra = grupo(); W3.dobra.position.set(P.x - 1.85, 0, 0);
  const folha = uvMundo(box(3.7, 7.55, 0.2, tmat('madeira', { color: 0xb07a4a, relevo: 1.5 }), 1.85, 3.78, 0, W3.dobra), 2);
  [[1.85, 5.6], [1.85, 2.1]].forEach(([px, py]) => box(2.7, 2.6, 0.06, tmat('madeira', { color: 0xa06c3e }), px, py, 0.12, W3.dobra));
  const roseta = cyl(0.3, 0.3, 0.08, latao, 32, W3.dobra); roseta.rotation.x = Math.PI / 2; roseta.position.set(3.2, 4.1, 0.14);
  box(0.06, 0.2, 0.02, mat(0x111111), 3.2, 4.06, 0.19, W3.dobra);
  const mac = new T3.Mesh(new T3.SphereGeometry(0.26, 24, 16), latao); mac.position.set(3.2, 3.2, 0.42); mac.castShadow = true; W3.dobra.add(mac);
  cyl(0.08, 0.08, 0.3, latao, 12, W3.dobra).rotation.x = Math.PI / 2; W3.dobra.children.at(-1).position.set(3.2, 3.2, 0.2);
  W3.lingueta = box(0.7, 0.16, 0.1, aco, 3.9, 3.6, 0, W3.dobra);
  W3.chavePorta = grupo(W3.dobra);
  const cp = chave(CERTA, aco); cp.scale.setScalar(0.12); cp.rotation.y = Math.PI / 2; W3.chavePorta.add(cp);
  // comodo iluminado atras da porta
  const luz = new T3.Mesh(new T3.PlaneGeometry(20, 16), new T3.MeshBasicMaterial({ color: 0xffe0a6 })); luz.position.set(P.x, 6, -6); scene.add(luz);
  W3.luzComodo = new T3.PointLight(0xffd59a, 0, 30, 1.5); W3.luzComodo.position.set(P.x, 4, -2); scene.add(W3.luzComodo);
  // ---- fechadura em raio X ----
  const T = LOCAL.trava;
  W3.carcaca = box(7.8, 5.4, 3, vidro(0xd8b45a, 0.12), T.x, 1.2, 0); W3.carcaca.castShadow = false;
  contorno(W3.carcaca.geometry, 0xf0d58a, 0.55, W3.carcaca);
  PX.forEach(px => { const cam_ = new T3.Mesh(new T3.CylinderGeometry(0.27, 0.27, 2.75, 20, 1, true), vidro(0x2a2d36, 0.35)); cam_.position.set(T.x + px, 2.4, 0); scene.add(cam_); });
  W3.giro = grupo(); W3.giro.position.copy(T);
  W3.plugMat = vidro(0xe2bd5c, 0.3);
  const plug = new T3.Mesh(new T3.CylinderGeometry(1, 1, 7.6, 48), W3.plugMat); plug.rotation.z = Math.PI / 2; W3.giro.add(plug);
  contorno(plug.geometry, 0xffe39a, 0.8, plug);
  box(0.02, 1.5, 0.34, mat(0x0c0d10), -3.81, -0.05, 0, W3.giro);  // fenda da chave na face do tambor
  W3.pinosBaixo = LPINO.map((L, i) => { const p = cyl(0.22, 0.22, L, cobre, 20, W3.giro); p.userData.L = L; return p; });
  W3.drivers = PX.map(() => cyl(0.22, 0.22, DRIVER, aco, 20));
  const mg = new T3.TubeGeometry(new Helice(), 200, 0.035, 6, false);
  W3.molas = PX.map(() => { const m = new T3.Mesh(mg, mat(0x8a929c, { metalness: 0.6, roughness: 0.35 })); scene.add(m); return m; });
  W3.chaveCerta = chave(CERTA, aco); W3.giro.add(W3.chaveCerta);
  W3.chaveErrada = chave(ERRADA, mat(0xb98b3a, { roughness: 0.35, metalness: 0.45 })); W3.giro.add(W3.chaveErrada);
  W3.linhaMat = new T3.MeshBasicMaterial({ color: 0xff4b3e, transparent: true, opacity: 0.5, depthWrite: false, side: T3.DoubleSide });
  W3.linha = new T3.Mesh(new T3.PlaneGeometry(7.9, 2.6), W3.linhaMat); W3.linha.rotation.x = -Math.PI / 2; W3.linha.position.set(T.x, LINHA, 0); scene.add(W3.linha);
  W3.linhaBorda = new T3.Mesh(new T3.BoxGeometry(7.9, 0.035, 0.035), new T3.MeshBasicMaterial({ color: 0xff4b3e })); W3.linhaBorda.position.set(T.x, LINHA, 1.3); scene.add(W3.linhaBorda);
  const chao = new T3.Mesh(new T3.CircleGeometry(14, 48), mat(0x1c1f27, { roughness: 0.9 })); chao.rotation.x = -Math.PI / 2; chao.position.set(T.x, -1.6, 0); chao.receiveShadow = true; scene.add(chao);
}

// pinos apoiados na chave: base do pino de baixo = topo da lamina sob ele (ou o piso do canal sem chave)
function apoio(i, hs, kx) {
  if (!hs) return PISO;
  const u = PX[i] - kx;
  return u < -4.2 || u > 3.95 ? PISO : Math.max(PISO, perfil(u, hs));
}
function atualiza(t, ctx) {
  const et = ctx.p.etapa, k = ctx.lt, lugar = ETAPA_LOCAL[et], centro = LOCAL[lugar];
  sun.position.set(centro.x - 9, 16, centro.z + 16); sun.target.position.copy(centro);
  scene.background = new T3.Color(lugar === 'porta' ? 0xcdbba3 : 0x12151c);
  hemi.intensity = lugar === 'porta' ? 1.05 : 0.8;
  // ---- fechadura ----
  let hs = null, kx = -12, errada = false, giro = 0, queda = 1;
  if (et === 'pinos') queda = back(k * 2.2);
  if (et === 'errada') { hs = ERRADA; errada = true; kx = lerp(-10, 0, ease(k * 2)); giro = k > 0.7 ? Math.sin((k - 0.7) * 70) * 0.06 * clamp((1 - k) * 4) : 0; }
  if (et === 'chave') { hs = CERTA; kx = lerp(-10, 0, ease(k * 1.5)); }
  if (et === 'linha') { hs = CERTA; kx = 0; }
  if (et === 'gira') { hs = CERTA; kx = 0; giro = ease(k * 1.6 - 0.2) * 1.3; }
  W3.chaveCerta.visible = !!hs && !errada; W3.chaveErrada.visible = errada;
  (errada ? W3.chaveErrada : W3.chaveCerta).position.x = kx;
  W3.giro.rotation.x = giro;
  const T = LOCAL.trava;
  PX.forEach((px, i) => {
    const base = apoio(i, hs, kx), L = LPINO[i], topoBaixo = base + L;
    const sobe = (1 - queda) * 1.2;  // na etapa pinos as molas empurram tudo para baixo
    W3.pinosBaixo[i].position.set(px, base + L / 2 + sobe, 0);
    const presoNoPlug = giro > 0.02 && !errada;
    const yd = presoNoPlug ? LINHA + DRIVER / 2 : topoBaixo + DRIVER / 2 + sobe;
    W3.drivers[i].position.set(T.x + px, yd, 0);
    const m = W3.molas[i], b = yd + DRIVER / 2; m.position.set(T.x + px, b, 0); m.scale.y = Math.max(0.3, MOLA_TOPO - b);
  });
  const verde = et === 'linha' || et === 'gira';
  W3.linha.visible = W3.linhaBorda.visible = ['pinos', 'errada', 'linha', 'gira'].includes(et);
  const cor = verde ? 0x2fcf6a : 0xff4b3e; W3.linhaMat.color.set(cor); W3.linhaBorda.material.color.set(cor);
  W3.linhaMat.opacity = (verde ? 0.35 : 0.22) + 0.12 * Math.sin(t * 6);
  W3.plugMat.opacity = et === 'plug' ? 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(t * 5)) : 0.3;
  W3.plugMat.emissive = new T3.Color(et === 'plug' ? 0x6a4a10 : 0x000000);
  // ---- porta ----
  let z = 4.5, vira = 0, lg = 3.9, abre = 0;
  if (et === 'porta') z = lerp(4.5, -0.37, ease(k * 1.4));
  if (et === 'abre') { z = -0.37; vira = ease(k * 2.6) * Math.PI / 2; lg = lerp(3.9, 3.25, ease((k - 0.3) * 6)); abre = ease((k - 0.5) * 2.2) * 1.35; }
  if (et === 'final') { z = -0.37; vira = Math.PI / 2; lg = 3.25; abre = 1.35 + k * 0.1; }
  W3.chavePorta.position.set(3.2, 4.06, z); W3.chavePorta.rotation.z = vira;
  W3.lingueta.position.x = lg; W3.dobra.rotation.y = abre;
  W3.luzComodo.intensity = 40 * clamp(abre);
}

// camera: [alvo relativo ao lugar, distancia, altura, angulo]; troca de lugar = corte seco com zoom
const CAM = {
  porta: { y: 3.9, d: 9.5, h: 0.2, a: 0.12 }, plug: { y: 0.6, d: 17, h: 2.4, a: 0.4 }, pinos: { y: 1.4, d: 19, h: 0.8, a: 0.14 },
  errada: { y: 0.9, d: 19.5, h: 1.2, a: 0.22 }, chave: { y: 0.9, d: 19.5, h: 1.2, a: -0.18 }, linha: { y: 1.0, d: 9.5, h: 0.5, a: 0.06 },
  gira: { y: 0.5, d: 14, h: 2.6, a: 1.0 }, abre: { y: 3.8, d: 10, h: 0.4, a: 0.45 }, final: { y: 3.8, d: 8.5, h: 0.2, a: 0.08 },
};
function camera(t, ctx) {
  const cfg = j => { const e = (ST.cenas[j].p || {}).etapa; return { ...CAM[e], c: LOCAL[ETAPA_LOCAL[e]] }; };
  const cur = cfg(ctx.i), prev = cfg(Math.max(0, ctx.i - 1)), corte = prev.c !== cur.c;
  const k = corte ? 1 : ease((t - ctx.t0) / 1.4), L = (a, b) => lerp(a, b, k);
  const d = L(prev.d, cur.d) * (1 - 0.05 * ctx.lt), a = L(prev.a, cur.a) + ctx.lt * 0.06, h = L(prev.h, cur.h), y = L(prev.y, cur.y);
  const zoom = corte ? 1 + 0.6 * Math.max(0, 1 - (t - ctx.t0) / 0.35) : 1;
  cam.position.set(cur.c.x + Math.sin(a) * d * zoom, y + h * zoom, cur.c.z + Math.cos(a) * d * zoom);
  cam.lookAt(cur.c.x, y, cur.c.z); cam.updateMatrixWorld();
  W3.flash = corte && ctx.i > 0 ? Math.max(0, 1 - (t - ctx.t0) / 0.3) : 0;
}
function overlay(t, ctx) {
  if (W3.flash > 0) { x.fillStyle = `rgba(255,255,255,${0.7 * W3.flash})`; x.fillRect(0, 0, W, H); }
  const et = ctx.p.etapa, s = back((t - ctx.t0) * 3), T = LOCAL.trava;
  const branco = 'rgba(255,255,255,0.92)';
  if (et === 'plug') { const [px, py] = proj(T.x, -1.5, 1); pill(px, py + 40, 'Plug', branco, COL.ink, 40, s); }
  if (et === 'pinos') {
    const [ax, ay] = proj(T.x, 3.6, 0); pill(ax, ay - 70, 'Springs', branco, COL.ink, 38, s);
    const [bx, by] = proj(T.x + 3.6, 0.3, 0); pill(Math.min(W - 110, bx + 20), by, 'Pins', branco, COL.ink, 38, back((t - ctx.t0) * 3 - 0.5));
  }
  if (et === 'errada') pill(W / 2, 300, 'Wrong key', COL.red, '#fff', 42, s);
  if (et === 'chave') pill(W / 2, 300, 'Right key', COL.green, '#fff', 42, s);
  if (et === 'linha') { const [px, py] = proj(T.x, LINHA, 1.3); pill(W / 2, Math.max(260, py - 260), 'Shear line', COL.green, '#fff', 42, s); }
}
MUNDO = { monta, atualiza, camera, overlay };
})();
