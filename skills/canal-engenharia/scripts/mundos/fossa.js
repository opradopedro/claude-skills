// Mundo "fossa": quintal com sobrado ao fundo e o terreno em corte; buraco -> fossa septica com filtro.
// Etapas (p.etapa de cada cena): buraco, vaza, concreto, cheia, camadas, dreno, bacteria, caminhao, final.
(() => {
const X0 = -14, X1 = 14, Z0 = -3, Z1 = 2.5;
const HOLE = { x0: -1.6, x1: 1.6, y0: -3.0, z0: -1.8 };
const WELL = { x0: 5.0, x1: 5.6 };
const WT = -4.8, ROCK = -5.8, BOT = -9;
const W3 = {};

function monta() {
  quintal();
  const grass = tmat('grama', { relevo: 1 }), top = tmat('terra'), sub = tmat('terra2'), clay = tmat('argila'), rock = tmat('rocha', { relevo: 4 });
  const water = new T3.MeshStandardMaterial({ map: textura('agua', GERA.agua).tx, roughness: 0.15, transparent: true, opacity: 0.88 });
  const camadas = [[-0.18, 0, grass], [-1.6, -0.18, top], [-3.4, -1.6, sub], [WT, -3.4, clay], [ROCK, WT, water], [BOT, ROCK, rock]];
  const furos = [[HOLE.x0, HOLE.x1, HOLE.y0, HOLE.z0], [WELL.x0, WELL.x1, WT + 0.2, 1.9]];
  for (const [ya, yb, m] of camadas) {
    const cortes = new Set([ya, yb]);
    for (const f of furos) for (const v of [f[2], 0]) if (v > ya && v < yb) cortes.add(v);
    const ys = [...cortes].sort((a, b) => a - b);
    for (let i = 0; i + 1 < ys.length; i++) {
      const y0 = ys[i], y1 = ys[i + 1], mid = (y0 + y1) / 2;
      const ativos = furos.filter(f => mid > f[2] && mid < 0.01).sort((a, b) => a[0] - b[0]);
      let cx = X0;
      for (const f of ativos) { solid(cx, f[0], y0, y1, Z0, Z1, m, 2.2); solid(f[0], f[1], y0, y1, Z0, f[3], m, 2.2); cx = f[1]; }
      solid(cx, X1, y0, y1, Z0, Z1, m, 2.2);
    }
  }
  // tufos de grama na borda do corte
  const tufo = tmat('folhas', { semRelevo: true });
  for (let i = 0; i < 90; i++) {
    const px = lerp(X0, X1, rnd(i * 2.7)); if (px > HOLE.x0 - 0.1 && px < HOLE.x1 + 0.1) continue;
    const m = new T3.Mesh(new T3.ConeGeometry(0.06, 0.18 + rnd(i) * 0.12, 4), tufo); m.position.set(px, 0.08, Z1 - 0.05 - rnd(i * 3) * 0.2); scene.add(m);
  }
  // poco: mureta de tijolo, telhadinho e balde
  const poco = grupo(); poco.position.set((WELL.x0 + WELL.x1) / 2, 0, 1.3);
  cyl(0.62, 0.62, 0.6, tmat('rocha', { relevo: 3 }), 14, poco).position.y = 0.3;
  const mad = tmat('madeira', { relevo: 1 });
  box(0.1, 1.4, 0.1, mad, -0.5, 0.95, 0, poco); box(0.1, 1.4, 0.1, mad, 0.5, 0.95, 0, poco);
  const tet = new T3.Mesh(new T3.ConeGeometry(1.0, 0.7, 4), new T3.MeshStandardMaterial({ map: textura('telhado', GERA.telhado).tx })); tet.position.y = 1.95; tet.rotation.y = Math.PI / 4; tet.castShadow = true; poco.add(tet);
  W3.wellWater = solid(WELL.x0, WELL.x1, WT, WT + 1.0, 1.9, Z1 - 0.01, mat(0x3f9fe3, { roughness: 0.15 }));
  solid(WELL.x0, WELL.x1, WT + 1.0, 0, 1.9, 1.95, mat(0x221c18));
  for (const s of [-1, 1]) solid(s < 0 ? WELL.x0 - 0.08 : WELL.x1, s < 0 ? WELL.x0 : WELL.x1 + 0.08, WT + 0.2, 0, 1.9, Z1, tmat('concreto'), 1.5);

  // terra que sai do buraco e monte ao lado
  W3.terra = solid(HOLE.x0, HOLE.x1, HOLE.y0, 0, HOLE.z0, Z1 - 0.01, top, 2.2);
  W3.monte = new T3.Mesh(new T3.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), tmat('terra', { relevo: 5 })); W3.monte.position.set(3.0, 0, -0.6); W3.monte.castShadow = true; scene.add(W3.monte);
  // concreto
  const conc = tmat('concreto', { relevo: 1.5 }), w = 0.2;
  W3.concreto = grupo();
  const cb = (...a) => uvMundo(box(...a, W3.concreto), 1.6);
  cb(w, -HOLE.y0, Z1 - HOLE.z0, conc, HOLE.x0 + w / 2, HOLE.y0 / 2, (HOLE.z0 + Z1) / 2);
  cb(w, -HOLE.y0, Z1 - HOLE.z0, conc, HOLE.x1 - w / 2, HOLE.y0 / 2, (HOLE.z0 + Z1) / 2);
  cb(HOLE.x1 - HOLE.x0, w, Z1 - HOLE.z0, conc, (HOLE.x0 + HOLE.x1) / 2, HOLE.y0 + w / 2, (HOLE.z0 + Z1) / 2);
  cb(HOLE.x1 - HOLE.x0, -HOLE.y0, w, conc, (HOLE.x0 + HOLE.x1) / 2, HOLE.y0 / 2, HOLE.z0 + w / 2);
  W3.tampa = grupo();
  uvMundo(box(HOLE.x1 - HOLE.x0 + 0.3, 0.2, Z1 - HOLE.z0 + 0.05, conc, 0, 0.1, 0, W3.tampa), 1.6);
  cyl(0.42, 0.42, 0.1, mat(0x4a4d52, { metalness: 0.6, roughness: 0.45 }), 24, W3.tampa).position.set(-0.4, 0.25, 0);
  W3.tampa.position.set((HOLE.x0 + HOLE.x1) / 2, 0, (HOLE.z0 + Z1) / 2 + 0.02);
  // conteudo
  const ix0 = HOLE.x0 + w, ix1 = HOLE.x1 - w, iz0 = HOLE.z0 + w;
  W3.in = { x0: ix0, x1: ix1, y0: HOLE.y0 + w, z0: iz0 };
  const liq = (cor, o) => mat(cor, { roughness: 0.22, ...o });
  W3.esgoto = solid(ix0, ix1, 0, 1, iz0, Z1 - 0.02, liq(0x5e3f22));
  W3.lodo = solid(ix0, ix1, 0, 1, iz0, Z1 - 0.02, mat(0x3e2a1a, { roughness: 0.9 }));
  W3.agua = solid(ix0, ix1, 0, 1, iz0, Z1 - 0.02, liq(0x8aa88c, { transparent: true, opacity: 0.85 }));
  W3.gordura = solid(ix0, ix1, 0, 1, iz0, Z1 - 0.02, liq(0xd2b45a));
  for (const m of [W3.esgoto, W3.lodo, W3.agua, W3.gordura]) { m.geometry.translate(0, -m.position.y + 0.5, 0); m.position.y = 0; }
  W3.parede = uvMundo(box(0.16, 1, Z1 - iz0, conc, lerp(ix0, ix1, 0.62), 0, (iz0 + Z1) / 2), 1.6);
  W3.parede2 = uvMundo(box(0.16, 1, Z1 - iz0, conc, lerp(ix0, ix1, 0.62), 0, (iz0 + Z1) / 2), 1.6);
  // canos (o de entrada e translucido para ver o coco passando)
  const tubo = (pts, r, m) => {
    const curva = new T3.CurvePath(); for (let i = 1; i < pts.length; i++) curva.add(new T3.LineCurve3(new T3.Vector3(...pts[i - 1]), new T3.Vector3(...pts[i])));
    const me = new T3.Mesh(new T3.TubeGeometry(curva, 120, r, 14, false), m); me.castShadow = true; scene.add(me); return { me, curva };
  };
  W3.canoIn = tubo([[-6.5, -0.75, Z1 - 0.14], [HOLE.x0 + 0.12, -0.75, Z1 - 0.14]], 0.17, mat(0xf2f4f5, { roughness: 0.25, transparent: true, opacity: 0.5, depthWrite: false }));
  W3.canoOut = tubo([[HOLE.x1 - 0.12, -1.0, Z1 - 0.14], [2.4, -1.0, Z1 - 0.14], [4.6, -1.0, Z1 - 0.14]], 0.14, mat(0xf2f4f5, { roughness: 0.3 }));
  W3.brita = grupo();
  const bm = [mat(0xc9c2b6), mat(0x9b9387), mat(0xe0dad0), mat(0xb0a898)];
  for (let i = 0; i < 160; i++) {
    const me = new T3.Mesh(new T3.DodecahedronGeometry(0.07 + rnd(i) * 0.06), bm[i % 4]); me.rotation.set(i, i * 2, i * 3); me.castShadow = true;
    me.position.set(lerp(2.35, 4.65, rnd(i * 2.3)), lerp(-1.4, -0.6, rnd(i * 6.1)), Z1 - 0.02 - rnd(i * 9) * 0.25); W3.brita.add(me);
  }
  // gotas, bolhas, cocos, respingos e bacterias
  const gm = mat(0x8aa88c, { roughness: 0.15 }), sm = mat(0x5e3f22, { roughness: 0.25 });
  W3.gotas = [...Array(18)].map(() => { const m = new T3.Mesh(new T3.SphereGeometry(0.06, 10, 8), gm); scene.add(m); return m; });
  W3.bolas = [...Array(6)].map(() => { const m = new T3.Mesh(new T3.SphereGeometry(0.1, 10, 8), sm); scene.add(m); return m; });
  W3.bolas2 = [...Array(5)].map(() => { const m = new T3.Mesh(new T3.SphereGeometry(0.07, 10, 8), gm); scene.add(m); return m; });
  const marrom = mat(0x6e4222, { roughness: 0.45 });
  const coco = () => {
    const g = grupo();
    for (const [r, y] of [[0.13, 0], [0.1, 0.1], [0.07, 0.18]]) { const p = new T3.Mesh(new T3.SphereGeometry(r, 14, 10), marrom); p.scale.y = 0.75; p.position.y = y; p.castShadow = true; g.add(p); }
    const pt = new T3.Mesh(new T3.ConeGeometry(0.045, 0.09, 10), marrom); pt.position.y = 0.25; g.add(pt); return g;
  };
  W3.cocos = [...Array(30)].map(coco);
  W3.boiando = [...Array(7)].map(() => { const g = coco(); g.scale.setScalar(1.3); return g; });
  W3.respingos = new T3.InstancedMesh(new T3.SphereGeometry(0.045, 8, 6), sm, 30 * 7); scene.add(W3.respingos);
  W3.vaz = [...Array(22)].map(() => { const m = new T3.Mesh(new T3.SphereGeometry(0.055, 8, 6), sm); scene.add(m); return m; });
  W3.bact = [...Array(16)].map((_, i) => {
    const g = grupo(); const corpo = new T3.Mesh(new T3.CapsuleGeometry(0.06, 0.15, 6, 10), mat(0x86d860, { roughness: 0.35 })); corpo.rotation.z = Math.PI / 2; g.add(corpo);
    g.userData = { px: lerp(2.5, 4.5, rnd(i * 1.7)), py: lerp(-1.7, -3.6, rnd(i * 8.1)) }; return g;
  });
  // mancha do vazamento na face do corte
  const mc = document.createElement('canvas'); mc.width = mc.height = 256; const mx = mc.getContext('2d');
  const rg = mx.createRadialGradient(128, 128, 5, 128, 128, 128); rg.addColorStop(0, 'rgba(40,26,10,0.9)'); rg.addColorStop(0.6, 'rgba(50,32,12,0.6)'); rg.addColorStop(1, 'rgba(50,32,12,0)');
  mx.fillStyle = rg; mx.fillRect(0, 0, 256, 256);
  const mtx = new T3.CanvasTexture(mc); mtx.colorSpace = T3.SRGBColorSpace;
  W3.mancha = new T3.Mesh(new T3.PlaneGeometry(1, 1), new T3.MeshBasicMaterial({ map: mtx, transparent: true, depthWrite: false }));
  W3.mancha.position.set((HOLE.x0 + HOLE.x1) / 2, HOLE.y0, Z1 + 0.02); scene.add(W3.mancha);
  W3.poca = new T3.Mesh(new T3.CylinderGeometry(1, 1, 0.05, 32), mat(0x553820, { roughness: 0.15 })); W3.poca.position.set(0, 0.03, 0.5); W3.poca.receiveShadow = true; scene.add(W3.poca);
  // caminhao limpa-fossa
  W3.truck = grupo();
  box(3.0, 0.3, 1.4, mat(0x2b3036), 0, 0.55, 0, W3.truck);
  const tq = cyl(0.72, 0.72, 2.3, mat(0xe9edf0, { roughness: 0.25, metalness: 0.5 }), 28, W3.truck); tq.rotation.z = Math.PI / 2; tq.position.set(-0.35, 1.35, 0);
  box(1.0, 1.25, 1.35, mat(0xc62f26, { roughness: 0.35, metalness: 0.2 }), 1.35, 1.2, 0, W3.truck);
  box(0.05, 0.5, 1.1, mat(0x9fc6e6, { roughness: 0.05, metalness: 0.3 }), 1.86, 1.45, 0, W3.truck);
  for (const [px, pz] of [[-0.9, 0.7], [1.2, 0.7], [-0.9, -0.7], [1.2, -0.7]]) { const r = cyl(0.33, 0.33, 0.24, mat(0x1c1c1c, { roughness: 0.8 }), 20, W3.truck); r.rotation.x = Math.PI / 2; r.position.set(px, 0.33, pz); }
  W3.truck.position.set(16, 0, 0.3);
  W3.mang = new T3.Mesh(new T3.TubeGeometry(new T3.QuadraticBezierCurve3(new T3.Vector3(), new T3.Vector3(), new T3.Vector3()), 20, 0.08, 8), mat(0x1e1e1e)); scene.add(W3.mang);
}

const ETAPAS = ['buraco', 'vaza', 'concreto', 'cheia', 'camadas', 'dreno', 'bacteria', 'caminhao', 'final'];
function estado(s, k) {
  const at = (i, f) => s < i ? 0 : s > i ? 1 : ease(f(k));
  return {
    s, k,
    dig: at(0, k => k * 3.2),
    pipeIn: at(0, k => k * 3 - 0.4),
    plume: s === 1 ? ease(k * 1.5) : s === 2 ? 1 - ease(k * 2.5) : 0,
    well: s === 1 ? ease((k - 0.25) * 2.2) : s === 2 ? 1 - ease(k * 2) : 0,
    concrete: at(2, k => k * 2.5),
    fill: s === 0 ? 0.24 * ease((k - 0.55) * 2.2) : s === 1 ? lerp(0.24, 0.12, ease(k * 1.5)) : s === 2 ? 0.12 : s === 3 ? 0.12 + 0.88 * ease(k * 1.3 - 0.1) : 0.88,
    overflow: s === 3 ? ease((k - 0.62) * 4) : s === 4 ? 1 - ease(k * 3) : 0,
    stink: s === 1 ? 0.5 * ease(k * 2) : s === 3 ? ease((k - 0.4) * 2) : s === 4 ? 1 - ease(k * 3) : 0,
    layers: at(4, k => k * 2.2),
    baffle: at(4, k => k * 3),
    outlet: at(4, k => k * 2.5 - 1.2),
    labels: s === 4 ? k : 0,
    drain: at(5, k => k * 2.5),
    drops: s < 5 ? 0 : s === 5 ? ease(k * 3 - 1.3) : 1,
    cleanDrops: at(6, k => k * 2),
    bact: s === 6 ? ease(k * 2) : s > 6 ? 0.7 : 0,
    truck: at(7, k => k * 2.2),
    hose: at(7, k => k * 3 - 1.4),
    sludge: s < 7 ? 0.3 : s === 7 ? lerp(0.3, 0.06, ease(k * 2 - 0.9)) : 0.06,
  };
}

// cocos: entram pelo cano translucido, caem no buraco, espirram e afundam (tudo em funcao de t)
const RITMO = { buraco: [0.5, 0.75], vaza: [0, 1.5], concreto: [0.3, 1.6], cheia: [0, 0.42] };
function lancamentos() {
  if (W3.lanc) return W3.lanc;
  const L = [];
  ST.cenas.forEach((c, i) => {
    const r = RITMO[(c.p || {}).etapa]; if (!r) return;
    const t1 = i + 1 < ST.cenas.length ? ST.cenas[i + 1].t0 : ST.dur;
    for (let ts = lerp(c.t0, t1, r[0]); ts < t1 - 0.6; ts += r[1]) L.push(ts);
  });
  return (W3.lanc = L);
}
function cocos(t, S, topo) {
  const curva = W3.canoIn.curva, tc = curva.getLength() / 4.5;
  const fim = curva.getPointAt(1), m4 = new T3.Matrix4(); let nr = 0;
  W3.cocos.forEach(g => g.visible = false);
  lancamentos().forEach((ts, i) => {
    const g = W3.cocos[i % W3.cocos.length], age = t - ts;
    if (age < 0) return;
    if (age < tc) { const p = curva.getPointAt(age / tc); g.visible = true; g.position.set(p.x, p.y - 0.08, p.z); g.rotation.set(0, 0, age * 6); g.scale.setScalar(1.1); return; }
    const vx = 1.1, g9 = 9.8, a = age - tc, alvo = Math.min(topo, fim.y - 0.05);
    const tq = Math.sqrt(2 * Math.max(0, fim.y - alvo) / g9), zz = fim.z - 0.15 - rnd(i * 3.7) * 0.5;
    if (a < tq) { g.visible = true; g.position.set(fim.x + vx * a, fim.y - 0.5 * g9 * a * a, lerp(fim.z, zz, a / Math.max(tq, 0.01))); g.rotation.set(a * 5, 0, a * 7 + i); g.scale.setScalar(1.6); return; }
    const b = a - tq, px = fim.x + vx * tq;
    if (b < 0.7) { g.visible = true; g.position.set(px, alvo - 0.25 * b, zz); g.rotation.set(0.4, i, 0.2); g.scale.setScalar(Math.max(0.01, 1.6 * (1 - b / 0.7))); }
    if (b < 0.45) for (let j = 0; j < 7; j++) {
      const an = rnd(i * 7 + j) * Math.PI * 2, v = 0.9 + rnd(i * 3 + j) * 0.8;
      m4.makeTranslation(px + Math.cos(an) * v * 0.6 * b, alvo + 2.4 * b - 6 * b * b, zz + Math.sin(an) * v * 0.6 * b); W3.respingos.setMatrixAt(nr++, m4);
    }
  });
  W3.respingos.count = nr; W3.respingos.instanceMatrix.needsUpdate = true;
  const inn = W3.in, x0 = S.concrete > 0 ? inn.x0 : HOLE.x0, x1 = S.concrete > 0 ? inn.x1 : HOLE.x1;
  W3.boiando.forEach((g, i) => {
    g.visible = S.layers < 0.5 && S.fill > 0.08;
    g.position.set(lerp(x0 + 0.3, x1 - 0.3, rnd(i * 5.1)) + Math.sin(t * 0.6 + i) * 0.08, topo - 0.06 + Math.sin(t * 2 + i) * 0.03, lerp(Z1 - 1.3, Z1 - 0.35, rnd(i * 2.7)));
    g.rotation.set(Math.PI / 2 * 0.8, i, Math.sin(t + i) * 0.3);
  });
  W3.vaz.forEach((m, i) => {
    const u = (t * 0.35 + rnd(i * 4.3)) % 1, alvoX = i % 3 === 0 ? (WELL.x0 + WELL.x1) / 2 : lerp(HOLE.x0 - 1.8, HOLE.x1 + 2.5, rnd(i * 9.1));
    m.visible = S.plume > 0.15; m.scale.setScalar(S.plume);
    m.position.set(lerp(lerp(HOLE.x0, HOLE.x1, rnd(i * 1.9)), alvoX, ease(u)), lerp(HOLE.y0, WT + 0.1, u), Z1 + 0.03);
  });
}
function atualiza(t, ctx) {
  const S = estado(Math.max(0, ETAPAS.indexOf(ctx.p.etapa)), ctx.lt); W3.S = S;
  const hy = HOLE.y0, inn = W3.in, h = -inn.y0;
  W3.terra.scale.y = Math.max(0.001, 1 - S.dig); W3.terra.position.y = hy + (-hy) * (1 - S.dig) / 2; W3.terra.visible = S.dig < 1;
  W3.monte.scale.set(1.3 * S.dig, 0.7 * S.dig * (1 - S.concrete * 0.9) + 0.001, 1.1 * S.dig); W3.monte.visible = S.dig > 0.02 && S.concrete < 1;
  W3.concreto.visible = S.concrete > 0; W3.concreto.scale.set(1, Math.max(0.01, S.concrete), 1);
  W3.tampa.visible = S.concrete > 0.3; W3.tampa.position.y = lerp(3, 0, ease((S.concrete - 0.3) / 0.7));
  const base = S.concrete > 0 ? inn.y0 : hy, topo = base + (0 - base) * S.fill; W3.topo = topo;
  const setH = (m, y0, y1) => { m.visible = y1 - y0 > 0.01; m.position.y = y0; m.scale.y = Math.max(0.001, y1 - y0); };
  const sl = base + h * S.sludge, sc = topo - 0.22;
  setH(W3.esgoto, base, topo); W3.esgoto.visible = S.layers < 1 && topo > base + 0.01;
  W3.esgoto.scale.x = S.concrete > 0 ? 1 : 1.12;
  for (const m of [W3.lodo, W3.agua, W3.gordura]) { m.material.transparent = true; m.material.opacity = S.layers * (m === W3.agua ? 0.85 : 1); }
  setH(W3.lodo, base, sl); setH(W3.agua, sl, sc); setH(W3.gordura, sc, topo);
  for (const m of [W3.lodo, W3.agua, W3.gordura]) m.visible = S.layers > 0.01;
  const pb = lerp(base, 0, 0.42), pt = lerp(base, 0, 0.6);
  W3.parede.visible = W3.parede2.visible = S.baffle > 0;
  W3.parede.scale.y = Math.max(0.01, (0 - pt) * S.baffle); W3.parede.position.y = pt + (0 - pt) * S.baffle / 2;
  W3.parede2.scale.y = Math.max(0.01, (pb - base) * S.baffle); W3.parede2.position.y = base + (pb - base) * S.baffle / 2;
  W3.canoIn.me.geometry.setDrawRange(0, Math.floor(W3.canoIn.me.geometry.index.count * S.pipeIn / 6) * 6);
  W3.canoOut.me.geometry.setDrawRange(0, Math.floor(W3.canoOut.me.geometry.index.count * S.outlet / 6) * 6);
  W3.bolas.forEach((b, i) => { b.visible = S.s >= 4; const p = W3.canoIn.curva.getPointAt((t * 0.3 + i / 6) % 1); b.position.set(p.x, p.y - 0.06, p.z); });
  W3.bolas2.forEach((b, i) => { b.visible = S.outlet >= 1; const p = W3.canoOut.curva.getPointAt((t * 0.4 + i / 5) % 1); b.position.set(p.x, p.y, p.z + 0.12); });
  W3.brita.visible = S.drain > 0; W3.brita.position.y = (1 - S.drain) * 2.5;
  const gc = new T3.Color(0x8aa88c).lerp(new T3.Color(0x3fa4f0), S.cleanDrops);
  W3.gotas.forEach((g, i) => {
    const u = (t * 0.45 + rnd(i * 3.3)) % 1; g.visible = S.drops > 0.05;
    g.material.color.copy(gc); g.position.set(2.5 + (i % 9) * 0.24 + Math.sin(u * 8 + i) * 0.05, lerp(-1.3, WT + 0.05, u), Z1 + 0.02);
    g.scale.setScalar(S.drops * (u < 0.92 ? 1 : (1 - u) * 12)); g.scale.y *= 1.4;
  });
  W3.bact.forEach((b, i) => {
    const k = back(S.bact * 1.3 - rnd(i) * 0.3); b.visible = k > 0.01; b.scale.setScalar(Math.max(0.001, k));
    b.position.set(b.userData.px + Math.sin(t * 2 + i) * 0.06, b.userData.py + Math.cos(t * 1.7 + i) * 0.06, Z1 + 0.06); b.rotation.z = Math.sin(t * 3 + i) * 0.4 + i;
  });
  W3.mancha.visible = S.plume > 0; W3.mancha.scale.set(1 + 12 * S.plume, 1 + 6 * S.plume, 1);
  W3.wellWater.material.color.set(0x3f9fe3).lerp(new T3.Color(0x5e3f22), S.well);
  W3.poca.visible = S.overflow > 0; W3.poca.scale.set(2.6 * S.overflow + 0.01, 1, 1.7 * S.overflow + 0.01);
  W3.truck.visible = S.truck > 0; W3.truck.position.x = lerp(16, 2.2, S.truck);
  W3.mang.visible = S.hose > 0;
  if (S.hose > 0) {
    const a = new T3.Vector3(W3.truck.position.x - 1.5, 1.2, 0.3), b = new T3.Vector3(lerp(a.x, -0.4, S.hose), lerp(1.2, 0.3, S.hose), lerp(0.3, 0.35, S.hose));
    W3.mang.geometry.dispose(); W3.mang.geometry = new T3.TubeGeometry(new T3.QuadraticBezierCurve3(a, new T3.Vector3((a.x + b.x) / 2, 1.9, 0.3), b), 20, 0.08, 8);
  }
  cocos(t, S, topo);
}

const CAM = { buraco: { x: -0.8 }, vaza: { x: 2.0, y: -2.2, d: 14 }, cheia: { y: -0.9 }, camadas: { d: 8.5, y: -1.5 },
  dreno: { x: 2.4, d: 11 }, bacteria: { x: 3.0, y: -2.2, d: 10 }, caminhao: { x: 1.2, y: -0.4, d: 12.5 }, final: { d: 13, y: -1.5 } };
function camera(t, ctx) { cameraPadrao(t, ctx, { x: 0, y: -1.5, d: 10.5, a: 0, h: 1.9, zFoco: Z1 }, p => CAM[p.etapa] || {}); }

function overlay(t, ctx) {
  const S = W3.S;
  if (S.stink > 0) {
    const [cx, cy] = proj(0, 0.4, 0.8);
    x.save(); x.lineWidth = 9; x.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const u = (t * 0.6 + i / 4) % 1, bx = cx + (i - 1.5) * 80;
      x.strokeStyle = `rgba(150,200,70,${S.stink * (1 - u) * 0.8})`; x.beginPath();
      for (let j = 0; j <= 12; j++) x.lineTo(bx + Math.sin(j * 0.9 + t * 4 + i) * 16, cy - u * 220 - j * 12);
      x.stroke();
    }
    x.restore();
  }
  if (S.labels > 0) {
    const inn = W3.in, h = -inn.y0, base = inn.y0, sl = base + h * S.sludge, cxx = (inn.x0 + inn.x1) / 2 - 0.55, topo = W3.topo;
    [['Grease', topo - 0.11], ['Liquid', (sl + topo - 0.22) / 2], ['Solids', (base + sl) / 2]].forEach(([txt, y], i) => {
      const [px, py] = proj(cxx, y, Z1); pill(px, py, txt, 'rgba(255,255,255,0.92)', COL.ink, 34, back((S.labels - 0.3 - i * 0.12) * 5));
    });
  }
}
MUNDO = { monta, atualiza, camera, overlay };
})();
