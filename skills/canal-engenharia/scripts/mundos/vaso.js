// Mundo "vaso": banheiro com um vaso sanitario de caixa acoplada, visto de lado. Um plano de corte varre o vaso e
// mostra a secao: a bacia, o sifao em S escondido na louca (sobe ate a crista e desce ate o esgoto), a caixa com
// a comporta de borracha (flapper), a boia e a valvula de entrada. A agua da caixa, da bacia e do sifao e calculada
// a cada quadro a partir da etapa (sem estado), e particulas mostram o caminho da agua.
// Unidade: 1 = 10 cm. x = frente (+) e fundo (-) do vaso, y = altura, z = largura (o corte fica em z = 0).
// Etapas: pergunta, mito, cano, descarga, enche, sifao, ar, boia, selo, balde.
(() => {
const W3 = {};
const XS = (a, b, n) => [...Array(n + 1)].map((_, i) => lerp(a, b, i / n));
const R = 0.25;                                  // raio interno do sifao
const L0 = 2.47;                                 // nivel da agua parada na bacia (fundo interno da crista)
const TQ = { x0: -2.85, x1: -0.75, y0: 4.5, y1: 8.6, z: 2.05, cheio: 7.4, vazio: 4.75 };
const FLAP = [-1.55, -0.35];                     // x e z da comporta
const BOIA = [-2.35, -0.9];                      // x e z da valvula de entrada
const PAREDE = -3.0;

// ---------- perfis ----------
const OUTER = [[-2.3, 0], [1.7, 0], [1.85, 1.2], [2.35, 2.4], [2.95, 3.45], [3.18, 4.0], [3.15, 4.32], [-0.6, 4.32], [-0.75, 4.5], [-2.3, 4.5]];
const FRENTE = [[0.62, 1.29], [0.95, 1.38], [1.55, 1.78], [2.15, 2.45], [2.55, 3.25], [2.72, 4.05], [2.75, 4.32]];   // parede da frente da bacia (do fundo para a borda)
const FUNDO = [[-0.35, 4.32], [-0.33, 4.05], [-0.22, 3.35], [0.02, 2.6], [0.24, 2.05], [0.4, 1.7]];                  // parede de tras (da borda para o fundo)
const CEN = new T3.CatmullRomCurve3([[0.52, 1.5], [0.08, 1.16], [-0.42, 1.24], [-0.78, 1.72], [-0.96, 2.36], [-1.17, 2.72], [-1.46, 2.6], [-1.66, 2.05], [-1.75, 1.2], [-1.76, 0.0],
  [-1.76, -1.0], [-1.95, -1.55], [-2.6, -1.72], [-3.6, -1.78]].map(([a, b]) => new T3.Vector3(a, b, 0)), false, 'catmullrom', 0.5);
const NS = 140, PTS = CEN.getSpacedPoints(NS);
let I_PISO = 0; for (let i = 0; i < PTS.length; i++) if (PTS[i].y > 0.0) I_PISO = i;
let I_CRISTA = 0; for (let i = 0; i < I_PISO; i++) if (PTS[i].y > PTS[I_CRISTA].y) I_CRISTA = i;
const F_CRISTA = I_CRISTA / NS, F_PISO = I_PISO / NS;
let F_PARADO = 0; for (let i = 0; i < I_CRISTA; i++) if (PTS[i].y <= L0 + 0.02) F_PARADO = i / NS;
function lados(n0, n1, r) {   // bordas esquerda e direita do cano entre os indices n0 e n1
  const E = [], D = [];
  for (let i = n0; i <= n1; i++) {
    const a = PTS[Math.max(0, i - 1)], b = PTS[Math.min(PTS.length - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
    E.push([PTS[i].x + nx * r, PTS[i].y + ny * r]); D.push([PTS[i].x - nx * r, PTS[i].y - ny * r]);
  }
  return [E, D];
}
const [ESQ, DIR] = lados(0, I_PISO, R);
// as bordas terminam exatamente no piso
const noPiso = arr => { const q = arr.slice(); q[q.length - 1] = [q[q.length - 1][0], 0]; return q; };
const PECA_FRENTE = [[2.75, 4.32], [3.15, 4.32], [3.18, 4.0], [2.95, 3.45], [2.35, 2.4], [1.85, 1.2], [1.7, 0], ...noPiso(ESQ).reverse(), ...FRENTE.slice(0, -1)];
const PECA_FUNDO = [...FUNDO, ...noPiso(DIR), [-2.3, 0], [-2.3, 4.5], [-0.75, 4.5], [-0.6, 4.32]];
const BACIA = [...FUNDO.slice(1), DIR[0], ESQ[0], ...FRENTE.slice(0, -1)];   // cavidade da bacia (para a agua)

const limpa = pts => pts.filter((q, i) => { const r = pts[(i + pts.length - 1) % pts.length]; return Math.hypot(q[0] - r[0], q[1] - r[1]) > 1e-4; });
function forma(pts) { pts = limpa(pts); const s = new T3.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }
function cortaY(pts, L) {   // Sutherland-Hodgman: parte do poligono abaixo de y = L
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ia = a[1] <= L, ib = b[1] <= L;
    if (ia) out.push(a);
    if (ia !== ib) { const u = (L - a[1]) / (b[1] - a[1]); out.push([lerp(a[0], b[0], u), L]); }
  }
  return out;
}

GERA.piso = () => {   // porcelanato cinza claro com rejunte
  const n1 = fbm(71, 4);
  const cv = pixels(512, (u, v) => { const k = 0.86 + n1(u, v) * 0.16 + rnd(u * 517 + v * 3301) * 0.03; return [204 * k, 200 * k, 194 * k]; });
  const cx = cv.getContext('2d'); cx.fillStyle = 'rgba(90,86,80,0.55)';
  for (let i = 0; i <= 2; i++) { cx.fillRect(i * 256 - 2, 0, 4, 512); cx.fillRect(0, i * 256 - 2, 512, 4); }
  return cv;
};
GERA.azulejo = () => {   // azulejo metro branco
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d');
  cx.fillStyle = '#b8bcbf'; cx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) for (let i = -1; i < 5; i++) {
    const px = i * 64 + (r % 2) * 32, py = r * 32, k = 0.95 + rnd(r * 9 + i) * 0.05;
    const g = cx.createLinearGradient(0, py, 0, py + 32); g.addColorStop(0, `rgb(${250 * k},${251 * k},${250 * k})`); g.addColorStop(1, `rgb(${232 * k},${236 * k},${238 * k})`);
    cx.fillStyle = g; cx.beginPath(); cx.roundRect(px + 1.5, py + 1.5, 61, 29, 3); cx.fill();
  }
  return cv;
};
GERA.secao = () => {   // louca cortada: creme fosco com granulado e hachura fina (leitura de desenho tecnico)
  const n1 = fbm(81, 16, 3);
  const cv = pixels(256, (u, v) => { const k = 0.9 + n1(u, v) * 0.08 + rnd(u * 917 + v * 7331) * 0.04; return [246 * k, 236 * k, 214 * k]; });
  const cx = cv.getContext('2d'); cx.strokeStyle = 'rgba(150,130,100,0.22)'; cx.lineWidth = 2;
  for (let i = -256; i < 512; i += 22) { cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i + 256, 256); cx.stroke(); }
  return cv;
};

function prisma(s, za, zb, m, parent = scene) {
  const g = new T3.ExtrudeGeometry(s, { depth: zb - za, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, za); g.computeVertexNormals();
  const me = new T3.Mesh(g, m); me.castShadow = me.receiveShadow = true; parent.add(me); return me;
}
function cabo(m, r, parent = scene) { const me = new T3.Mesh(new T3.CylinderGeometry(r, r, 1, 8), m); parent.add(me); return me; }
const Yv = new T3.Vector3(0, 1, 0);
function estica(me, a, b) { const A = new T3.Vector3(...a), B = new T3.Vector3(...b), d = B.clone().sub(A), L = Math.max(1e-3, d.length()); me.position.copy(A).addScaledVector(d, 0.5); me.quaternion.setFromUnitVectors(Yv, d.normalize()); me.scale.set(1, L, 1); }

function monta() {
  gl.localClippingEnabled = true;
  scene.background = new T3.Color(0xdfe6ea);
  reflexos(0.35);
  gl.toneMappingExposure = 0.92; hemi.color.set(0xfff3e4); hemi.groundColor.set(0x8a7f74); hemi.intensity = 0.75;
  const spot = new T3.SpotLight(0xfff1dc, 60, 40, 0.7, 0.6, 1.2); spot.position.set(4, 13, 9); spot.target.position.set(0, 3, 0); scene.add(spot, spot.target);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 12, bottom: -4 }); sun.shadow.camera.updateProjectionMatrix();
  sun.position.set(6, 16, 14); sun.intensity = 2.2; hemi.intensity = 1.0;
  W3.corte = new T3.Plane(new T3.Vector3(0, 0, -1), 3);   // mostra so z <= constante

  // ---------- banheiro: piso cortado (laje com o tubo de esgoto), parede de azulejo atras e ao fundo ----------
  const piso = tmat('piso', { relevo: 0.4, roughness: 0.35 });
  solid(-12, 12, -0.25, 0, -8, 0, piso, 5);
  solid(-12, 12, -2.6, -0.25, -8, 0, tmat('concreto', { relevo: 1 }), 2);
  solid(-12, 12, -0.25, 0, 0, 4, piso, 5);
  W3.lajeFrente = solid(-12, 12, -2.6, -0.25, 0, 4, tmat('concreto', { relevo: 1 }), 2);
  const az = tmat('azulejo', { relevo: 0.5, roughness: 0.3 });
  solid(PAREDE - 0.3, PAREDE, -0.25, 12, -8, 4, az, 2.4);
  solid(-12, 12, -0.25, 12, -8.3, -8, az, 2.4);
  box(0.3, 0.6, 12, mat(0xf4f2ee, { roughness: 0.5 }), PAREDE + 0.15, 0.3, -2);
  // toalha e papel na parede
  const papel = cyl(0.42, 0.42, 0.9, mat(0xfafafa, { roughness: 0.9 }), 24); papel.rotation.x = Math.PI / 2; papel.position.set(PAREDE + 0.75, 5.2, -3.6);
  box(0.2, 0.08, 1.3, mat(0xc9ced2, { metalness: 0.9, roughness: 0.2 }), PAREDE + 0.2, 5.75, -3.6);
  box(0.08, 3.2, 2.0, mat(0x5f8fa8, { roughness: 0.95 }), -12 + 0.5, 0, 0).visible = false;
  // tubo de esgoto no corte da laje
  W3.esgoto = new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3(PTS.slice(I_PISO)), 60, R + 0.1, 20, false), mat(0x8b9097, { roughness: 0.5, metalness: 0.2, side: T3.DoubleSide, clippingPlanes: [new T3.Plane(new T3.Vector3(0, 0, -1), 0)] }));
  scene.add(W3.esgoto);
  // furo escuro no corte da laje por onde passa o tubo
  { const ptsE = lados(I_PISO, NS, R + 0.1); const s = forma([...ptsE[0], ...ptsE[1].reverse()]); const me = new T3.Mesh(new T3.ShapeGeometry(s), new T3.MeshBasicMaterial({ color: 0x3a3e44 })); me.position.z = 0.012; scene.add(me); W3.furoLaje = me; }

  // ---------- louca: corpo inteiro (cortado pelo plano) e as duas pecas da secao ----------
  const louca = mat(0xfbfbf8, { roughness: 0.16, metalness: 0.0, clippingPlanes: [W3.corte], side: T3.DoubleSide });
  W3.louca = louca;
  { const g = new T3.ExtrudeGeometry(forma(OUTER), { depth: 3.2, bevelEnabled: true, bevelSize: 0.22, bevelThickness: 0.22, bevelSegments: 4, curveSegments: 24 }); g.translate(0, 0, -1.6); g.computeVertexNormals();
    W3.corpo = new T3.Mesh(g, louca); W3.corpo.castShadow = W3.corpo.receiveShadow = true; scene.add(W3.corpo); }
  const sec = tmat('secao', { relevo: 0.3, roughness: 0.6 });
  W3.secao = [PECA_FRENTE, PECA_FUNDO].map(p => { const me = new T3.Mesh(new T3.ShapeGeometry(forma(p)), sec); me.position.z = 0.004; me.receiveShadow = true; scene.add(me); uvMundo(me, 1.6); return me; });
  // fundo escuro atras dos canais (parede interna do outro lado do cano)
  W3.dentro = [BACIA, [...ESQ, ...DIR.slice().reverse()]].map((p, i) => { const me = new T3.Mesh(new T3.ShapeGeometry(forma(p)), mat(i ? 0x7f868d : 0xe9e7e2, { roughness: i ? 0.6 : 0.25 })); me.position.z = i ? -0.55 : -1.25; scene.add(me); return me; });
  // contorno do sifao (destaque)
  W3.contorno = [ESQ, DIR].map(p => { const g = new T3.BufferGeometry().setFromPoints(p.map(([a, b]) => new T3.Vector3(a, b, 0.03))); const l = new T3.Line(g, new T3.LineBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0, depthTest: false })); l.renderOrder = 9; scene.add(l); return l; });

  // ---------- caixa acoplada ----------
  const caixa = mat(0xfbfbf8, { roughness: 0.16, clippingPlanes: [W3.corte], side: T3.DoubleSide });
  W3.caixa = grupo();
  const ex = 0.14;
  box(TQ.x1 - TQ.x0, ex, 2 * TQ.z, caixa, (TQ.x0 + TQ.x1) / 2, TQ.y0 + ex / 2, 0, W3.caixa);
  box(ex, TQ.y1 - TQ.y0, 2 * TQ.z, caixa, TQ.x0 + ex / 2, (TQ.y0 + TQ.y1) / 2, 0, W3.caixa);
  box(ex, TQ.y1 - TQ.y0, 2 * TQ.z, caixa, TQ.x1 - ex / 2, (TQ.y0 + TQ.y1) / 2, 0, W3.caixa);
  box(TQ.x1 - TQ.x0, TQ.y1 - TQ.y0, ex, caixa, (TQ.x0 + TQ.x1) / 2, (TQ.y0 + TQ.y1) / 2, -TQ.z + ex / 2, W3.caixa);
  W3.caixaFrente = box(TQ.x1 - TQ.x0, TQ.y1 - TQ.y0, ex, caixa, (TQ.x0 + TQ.x1) / 2, (TQ.y0 + TQ.y1) / 2, TQ.z - ex / 2, W3.caixa);
  W3.tampa = box(TQ.x1 - TQ.x0 + 0.16, 0.24, 2 * TQ.z + 0.16, caixa, (TQ.x0 + TQ.x1) / 2, TQ.y1 + 0.12, 0, W3.caixa);
  // secao das paredes da caixa no corte
  for (const [a, b, c, d] of [[TQ.x0, TQ.x0 + ex, TQ.y0, TQ.y1], [TQ.x1 - ex, TQ.x1, TQ.y0, TQ.y1], [TQ.x0, TQ.x1, TQ.y0, TQ.y0 + ex], [TQ.x0 - 0.08, TQ.x1 + 0.08, TQ.y1, TQ.y1 + 0.24]]) {
    const me = new T3.Mesh(new T3.PlaneGeometry(b - a, d - c), sec); me.position.set((a + b) / 2, (c + d) / 2, 0.004); W3.caixa.add(me); me.userData.sec = true; }
  // alavanca da descarga (na frente da caixa, lado esquerdo) e haste interna
  const cromo = mat(0xdfe5ea, { metalness: 0.95, roughness: 0.15 });
  W3.alavanca = grupo(); W3.alavanca.position.set(TQ.x1 + 0.02, 8.0, -0.9);
  { const h = box(0.1, 0.12, 0.7, cromo, 0.05, 0, -0.3, W3.alavanca); const b = cyl(0.13, 0.13, 0.12, cromo, 20, W3.alavanca); b.rotation.z = Math.PI / 2; b.position.x = 0.05; }
  W3.haste = box(1.0, 0.07, 0.07, mat(0x30343a), 0, 0, 0); W3.corrente = cabo(mat(0x9aa0a6, { metalness: 0.8, roughness: 0.3 }), 0.025);
  // valvula de descarga: assento, comporta (flapper) e ladrao
  const borracha = mat(0xd23a2a, { roughness: 0.7 }), plast = mat(0x2a2d31, { roughness: 0.5 }), branco = mat(0xe8e8e4, { roughness: 0.4 });
  { const s = cyl(0.55, 0.62, 0.22, plast, 32); s.position.set(FLAP[0], TQ.y0 + 0.24, FLAP[1]); }
  W3.flap = grupo(); W3.flap.position.set(FLAP[0] + 0.62, TQ.y0 + 0.4, FLAP[1]);
  { const d = cyl(0.62, 0.55, 0.16, borracha, 32, W3.flap); d.position.set(-0.62, 0, 0); const o = new T3.Mesh(new T3.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), borracha); o.rotation.x = Math.PI; o.position.set(-0.62, -0.04, 0); W3.flap.add(o); }
  { const l = cyl(0.16, 0.16, 3.0, branco, 20); l.position.set(FLAP[0] + 0.85, TQ.y0 + 1.75, FLAP[1] - 0.5); W3.ladraoTopo = [FLAP[0] + 0.85, TQ.y0 + 3.25, FLAP[1] - 0.5]; }
  // valvula de entrada com boia (copo que sobe e desce no tubo)
  { const t = cyl(0.14, 0.14, 3.0, plast, 16); t.position.set(BOIA[0], TQ.y0 + 1.6, BOIA[1]); const c = cyl(0.36, 0.36, 0.5, plast, 24); c.position.set(BOIA[0], TQ.y0 + 3.2, BOIA[1]); }
  W3.boia = cyl(0.36, 0.36, 0.55, mat(0x2d6fc2, { roughness: 0.4 }), 24); W3.boia.position.set(BOIA[0], 6.5, BOIA[1]);
  W3.mangueira = new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3([[BOIA[0] + 0.2, TQ.y0 + 3.2, BOIA[1]], [BOIA[0] + 0.7, TQ.y0 + 3.6, BOIA[1] + 0.1], [W3.ladraoTopo[0] - 0.2, W3.ladraoTopo[1] + 0.3, W3.ladraoTopo[2]], [W3.ladraoTopo[0], W3.ladraoTopo[1] - 0.05, W3.ladraoTopo[2]]].map(p => new T3.Vector3(...p))), 30, 0.05, 8, false), mat(0x1d1f22, { roughness: 0.6 }));
  scene.add(W3.mangueira);
  // agua da caixa
  const aguaM = new T3.MeshStandardMaterial({ color: 0x4aa3df, transparent: true, opacity: 0.55, roughness: 0.08, metalness: 0.1, clippingPlanes: [W3.corte], side: T3.DoubleSide, depthWrite: false });
  W3.aguaCaixa = box(TQ.x1 - TQ.x0 - 2 * ex, 1, 2 * TQ.z - 2 * ex, aguaM, (TQ.x0 + TQ.x1) / 2, 6, 0); W3.aguaCaixa.castShadow = false; W3.aguaCaixa.renderOrder = 3;
  // assento e tampa do vaso (giram na dobradica)
  W3.assento = grupo(); W3.assento.position.set(-0.45, 4.42, 0);
  { const anel = new T3.Shape(); anel.absellipse(1.75, 0, 1.95, 1.55, 0, Math.PI * 2); const furo = new T3.Path(); furo.absellipse(1.75, 0, 1.3, 0.98, 0, Math.PI * 2, true); anel.holes.push(furo);
    const g = new T3.ExtrudeGeometry(anel, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 40 }); g.rotateX(Math.PI / 2); g.translate(0, 0.12, 0);
    const a = new T3.Mesh(g, mat(0xfbfbf8, { roughness: 0.25, clippingPlanes: [W3.corte], side: T3.DoubleSide })); a.castShadow = true; W3.assento.add(a); }
  W3.tampaVaso = grupo(); W3.tampaVaso.position.set(-0.45, 4.6, 0);
  { const s = new T3.Shape(); s.absellipse(1.75, 0, 1.98, 1.58, 0, Math.PI * 2);
    const g = new T3.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 40 }); g.rotateX(Math.PI / 2); g.translate(0, 0.1, 0);
    const a = new T3.Mesh(g, mat(0xfbfbf8, { roughness: 0.2, clippingPlanes: [W3.corte], side: T3.DoubleSide })); a.castShadow = true; W3.tampaVaso.add(a); }

  // ---------- agua: bacia (prisma refeito), sifao (tubo com faixa), particulas ----------
  W3.aguaM = new T3.MeshStandardMaterial({ color: 0x2b8ce0, transparent: true, opacity: 0.8, roughness: 0.05, metalness: 0.1, depthWrite: false, side: T3.DoubleSide });
  W3.aguaBacia = new T3.Mesh(new T3.BufferGeometry(), W3.aguaM); W3.aguaBacia.renderOrder = 4; scene.add(W3.aguaBacia); W3.baciaKey = '';
  W3.superficie = new T3.Mesh(new T3.PlaneGeometry(1, 1), new T3.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.7, depthWrite: false })); W3.superficie.renderOrder = 5; scene.add(W3.superficie);
  // agua no sifao: faixa 2D no plano do corte entre as bordas internas (a e b = fracao ao longo do cano)
  W3.aguaCano = new T3.Mesh(new T3.BufferGeometry(), new T3.MeshBasicMaterial({ color: 0x2b8ce0, transparent: true, opacity: 0.9, depthWrite: false, side: T3.DoubleSide })); W3.aguaCano.position.z = 0.02; W3.aguaCano.renderOrder = 6; scene.add(W3.aguaCano); W3.canoKey = '';
  W3.gotas = new T3.InstancedMesh(new T3.SphereGeometry(0.06, 8, 6), new T3.MeshBasicMaterial({ color: 0xd8f1ff, transparent: true, opacity: 0.95, depthTest: false }), 400); W3.gotas.renderOrder = 8; scene.add(W3.gotas);
  W3.bolhas = new T3.InstancedMesh(new T3.SphereGeometry(0.11, 12, 8), new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }), 60); W3.bolhas.renderOrder = 9; scene.add(W3.bolhas);
  W3.gas = new T3.InstancedMesh(new T3.SphereGeometry(0.2, 12, 8), new T3.MeshBasicMaterial({ color: 0x8fcf3a, transparent: true, opacity: 0.4, depthWrite: false, depthTest: false }), 50); W3.gas.renderOrder = 7; scene.add(W3.gas);
  // balde
  W3.balde = grupo(); W3.balde.position.set(3.4, 7.2, -0.2);
  { const g = new T3.CylinderGeometry(0.8, 0.62, 1.3, 32, 1, true); const b = new T3.Mesh(g, mat(0x2d6fc2, { roughness: 0.45, side: T3.DoubleSide })); b.castShadow = true; W3.balde.add(b);
    const f = new T3.Mesh(new T3.CircleGeometry(0.62, 32), mat(0x2d6fc2)); f.rotation.x = -Math.PI / 2; f.position.y = -0.64; W3.balde.add(f);
    const al = new T3.Mesh(new T3.TorusGeometry(0.8, 0.03, 6, 24, Math.PI), cromo); al.position.y = 0.6; W3.balde.add(al); }
  // caminhos da agua (para as particulas)
  const C3 = pts => new T3.CatmullRomCurve3(pts.map(([a, b, c = 0.02]) => new T3.Vector3(a, b, c)));
  W3.caminhoJato = C3([[FLAP[0], TQ.y0 + 0.2], [-1.3, 4.0], [-0.85, 3.4], [-0.5, 2.7], [-0.1, 2.0], [0.3, 1.55], [0.6, 1.45]]);
  W3.caminhoBordaT = C3([[-0.3, 4.05], [-0.22, 3.4], [0.02, 2.65], [0.3, 2.0]]);
  W3.caminhoBordaF = C3([[2.72, 4.05], [2.55, 3.25], [2.15, 2.45], [1.6, 1.8]]);
  W3.caminhoCano = new T3.CatmullRomCurve3(PTS.map(p => new T3.Vector3(p.x, p.y, 0.03)));
  W3.caminhoBalde = C3([[2.75, 6.75], [2.55, 5.4], [2.0, 3.8], [1.6, 2.6]]);
}

const ETAPAS = ['pergunta', 'mito', 'cano', 'descarga', 'enche', 'sifao', 'ar', 'boia', 'selo', 'balde'];
function estado(s, k, t) {
  const E = { s, k };
  E.corte = s < 2 ? 0 : s === 2 ? ease((k - 0.05) / 0.45) : 1;
  E.tampa = s < 2 ? 0 : s === 2 ? ease((k - 0.1) / 0.4) : 1;          // tampa do vaso aberta
  E.alav = s === 3 ? (k < 0.35 ? ease((k - 0.1) / 0.12) : 1 - ease((k - 0.5) / 0.2)) : 0;
  // nivel da caixa
  E.caixa = s < 3 ? TQ.cheio : s === 3 ? lerp(TQ.cheio, TQ.vazio, ease((k - 0.2) / 0.6)) : s < 7 ? TQ.vazio : s === 7 ? lerp(TQ.vazio, TQ.cheio, ease((k - 0.15) / 0.75)) : TQ.cheio;
  E.flap = s === 3 ? (k < 0.82 ? ease((k - 0.18) / 0.12) : 1 - ease((k - 0.82) / 0.12)) : 0;
  E.fluxo = s === 3 ? clamp((k - 0.22) * 6) * (1 - clamp((k - 0.85) * 8)) : s === 4 ? 1 - ease((k - 0.5) / 0.4) : 0;
  // nivel da bacia
  const B_MAX = 3.25, B_MIN = 1.42;
  E.bacia = s < 3 ? L0 : s === 3 ? lerp(L0, B_MAX - 0.15, ease((k - 0.3) / 0.6)) : s === 4 ? lerp(B_MAX - 0.15, B_MAX, ease(k)) :
    s === 5 ? lerp(B_MAX, B_MIN, ease((k - 0.1) / 0.8)) : s === 6 ? B_MIN : s === 7 ? lerp(B_MIN, L0 - 0.3, ease((k - 0.2) / 0.8)) : s === 8 ? lerp(L0 - 0.3, L0, ease(k / 0.4)) :
    k < 0.35 ? lerp(L0, B_MAX, ease((k - 0.08) / 0.27)) : lerp(B_MAX, B_MIN + 0.4, ease((k - 0.4) / 0.5));
  // agua no cano: [a, b] em fracao do comprimento
  E.a = 0; E.b = F_PARADO;
  if (s === 3) E.b = lerp(F_PARADO, F_CRISTA - 0.01, ease((k - 0.35) / 0.6));
  if (s === 4) E.b = lerp(F_CRISTA - 0.01, 1, ease((k - 0.05) / 0.85));
  if (s === 5) E.b = 1;
  if (s === 6) { E.a = ease(k / 0.85); E.b = 1; }
  if (s === 7) { E.a = 0; E.b = lerp(0.12, F_PARADO - 0.03, ease((k - 0.2) / 0.8)); }
  if (s === 8) E.b = F_PARADO;
  if (s === 9) { E.b = k < 0.3 ? F_PARADO : lerp(F_CRISTA, 1, ease((k - 0.3) / 0.2)); }
  E.sifao = s === 5 ? clamp(k * 4) : s === 6 ? 1 - clamp(k * 1.3) : s === 9 ? clamp((k - 0.45) * 4) : 0;
  E.bolhas = s === 6 ? clamp(k * 3) * (1 - clamp((k - 0.85) * 6)) : 0;
  E.enchendo = s === 7 ? clamp((k - 0.1) * 5) * (1 - clamp((k - 0.88) * 8)) : 0;
  E.gas = s === 8 ? clamp((k - 0.15) * 3) : 0;
  E.balde = s === 9 ? 1 : 0; E.despeja = s === 9 ? clamp((k - 0.05) / 0.12) * (1 - clamp((k - 0.42) / 0.1)) : 0;
  E.contorno = s === 2 ? clamp((k - 0.5) * 3) : s === 4 ? 0.6 : 0;
  return E;
}

function setBacia(L) {
  const key = L.toFixed(3); if (key === W3.baciaKey) return; W3.baciaKey = key;
  const p = cortaY(BACIA, L); W3.aguaBacia.visible = p.length > 2;
  if (!W3.aguaBacia.visible) return;
  W3.aguaBacia.geometry.dispose();
  const g = new T3.ExtrudeGeometry(forma(p), { depth: 1.3, bevelEnabled: false }); g.translate(0, 0, -1.3 + 0.015); g.computeVertexNormals(); W3.aguaBacia.geometry = g;
  const xs = p.filter(q => Math.abs(q[1] - L) < 1e-6).map(q => q[0]);
  if (xs.length >= 2) { const a = Math.min(...xs), b = Math.max(...xs); W3.superficie.visible = true; W3.superficie.scale.set(b - a, 2.4, 1); W3.superficie.rotation.x = -Math.PI / 2; W3.superficie.position.set((a + b) / 2, L + 0.005, -1.2 + 1.2 * 0); W3.superficie.position.z = -1.2 / 1; W3.superficie.scale.y = 2.4; W3.superficie.position.z = 0.015 - 1.2; }
  else W3.superficie.visible = false;
}
function setCano(a, b) {
  const key = a.toFixed(3) + b.toFixed(3); if (key === W3.canoKey) return; W3.canoKey = key;
  const i0 = Math.round(a * NS), i1 = Math.round(b * NS); W3.aguaCano.visible = i1 - i0 >= 2;
  if (!W3.aguaCano.visible) return;
  const [E, D] = lados(i0, i1, R - 0.01);
  W3.aguaCano.geometry.dispose(); W3.aguaCano.geometry = new T3.ShapeGeometry(forma([...E, ...D.reverse()]));
}

function atualiza(t, ctx) {
  const s = Math.max(0, ETAPAS.indexOf(ctx.p.etapa)), k = ctx.lt, S = estado(s, k, t); W3.S = S;
  // plano de corte: varre de z = +2.4 ate 0
  W3.corte.constant = lerp(2.6, 0, S.corte);
  const cortado = S.corte > 0.98;
  W3.secao.forEach(m => m.visible = cortado); W3.dentro.forEach(m => m.visible = cortado);
  W3.caixa.children.forEach(m => { if (m.userData.sec) m.visible = cortado; });
  W3.furoLaje.visible = cortado; W3.lajeFrente.visible = !cortado; W3.esgoto.visible = cortado;
  W3.tampa.visible = !cortado || true;
  // tampa do vaso abre para tras
  W3.tampaVaso.rotation.z = S.tampa * 1.62;
  // alavanca, haste e corrente
  W3.alavanca.rotation.z = -0.5 * S.alav;
  const ponta = [TQ.x1 - 1.05, 8.0 + 0.45 * S.alav, -0.9]; estica(W3.haste, [TQ.x1, 8.0, -0.9], ponta); W3.haste.scale.set(1, 1, 1);
  W3.haste.position.set((TQ.x1 + ponta[0]) / 2, (8.0 + ponta[1]) / 2, -0.9); W3.haste.rotation.set(0, 0, Math.atan2(ponta[1] - 8.0, ponta[0] - TQ.x1));
  W3.flap.rotation.z = -1.25 * S.flap;
  const flapPt = new T3.Vector3(-0.62, 0.1, 0).applyEuler(W3.flap.rotation).add(W3.flap.position);
  estica(W3.corrente, [ponta[0], ponta[1], -0.9], [flapPt.x, flapPt.y, FLAP[1]]);
  // agua da caixa e boia
  const nv = S.caixa; W3.aguaCaixa.scale.y = Math.max(0.01, nv - TQ.y0 - 0.14); W3.aguaCaixa.position.y = TQ.y0 + 0.14 + (nv - TQ.y0 - 0.14) / 2;
  W3.boia.position.y = Math.max(TQ.y0 + 0.9, nv - 0.15);
  // bacia e cano
  setBacia(S.bacia); setCano(S.a, S.b);
  W3.contorno.forEach(l => l.material.opacity = S.contorno * (0.75 + 0.25 * Math.sin(t * 8)));
  // balde
  W3.balde.visible = S.balde > 0; W3.balde.rotation.z = 1.25 * ease(clamp((k - 0.02) / 0.1)) * (1 - ease(clamp((k - 0.5) / 0.15)));
  // particulas
  const m4 = new T3.Matrix4(); let n = 0;
  const poe = (c, u, dz = 0, sc = 1) => { const p = c.getPointAt(clamp(u)); m4.compose(new T3.Vector3(p.x, p.y, p.z + dz), new T3.Quaternion(), new T3.Vector3(sc, sc, sc)); W3.gotas.setMatrixAt(n++, m4); };
  if (S.fluxo > 0.02) {
    for (let i = 0; i < 70; i++) if (rnd(i * 3.1) < S.fluxo) poe(W3.caminhoJato, (t * 1.1 + i / 70) % 1);
    for (let i = 0; i < 40; i++) if (rnd(i * 5.3) < S.fluxo) poe(W3.caminhoBordaT, (t * 1.3 + i / 40) % 1, -0.3 - rnd(i) * 0.6);
    for (let i = 0; i < 40; i++) if (rnd(i * 7.7) < S.fluxo) poe(W3.caminhoBordaF, (t * 1.3 + i / 40) % 1, -0.3 - rnd(i * 2) * 0.6);
  }
  if (S.sifao > 0.02) for (let i = 0; i < 110; i++) { const u = (t * 0.55 + i / 110) % 1; if (u < S.a || u > S.b || rnd(i * 9.1) > S.sifao) continue; poe(W3.caminhoCano, u, 0.01, 1.2); }
  if (S.enchendo > 0.02) {   // jato da valvula de entrada e agua descendo pelo ladrao para a bacia
    for (let i = 0; i < 40; i++) { const u = (t * 2 + i / 40) % 1, a = rnd(i) * 6.28; m4.makeTranslation(BOIA[0] + Math.cos(a) * u * 0.6, TQ.y0 + 3.4 - u * u * 1.5, BOIA[1] + Math.sin(a) * u * 0.4); W3.gotas.setMatrixAt(n++, m4); }
    for (let i = 0; i < 40; i++) if (rnd(i * 2.2) < S.enchendo) poe(W3.caminhoJato, (t * 0.8 + i / 40) % 1);
  }
  if (S.despeja > 0.02) for (let i = 0; i < 60; i++) poe(W3.caminhoBalde, (t * 1.6 + i / 60) % 1, (rnd(i) - 0.5) * 0.5, 1.6);
  W3.gotas.count = n; W3.gotas.instanceMatrix.needsUpdate = true;
  // bolhas de ar entrando no cano (o gorgolejo)
  { let c = 0; if (S.bolhas > 0.02) for (let i = 0; i < 30; i++) { const u = clamp(Math.min(S.a, F_PISO) * rnd(i * 4.4) + Math.sin(t * 9 + i) * 0.01); const p = W3.caminhoCano.getPointAt(u), sc = (0.6 + rnd(i * 2) * 0.9) * S.bolhas;
      m4.compose(new T3.Vector3(p.x + Math.sin(t * 7 + i) * 0.08, p.y + Math.cos(t * 6 + i) * 0.08, 0.05), new T3.Quaternion(), new T3.Vector3(sc, sc, sc)); W3.bolhas.setMatrixAt(c++, m4); }
    W3.bolhas.count = c; W3.bolhas.instanceMatrix.needsUpdate = true; }
  // gas do esgoto sobe pelo ramo de descida e para na agua
  { let c = 0; if (S.gas > 0.02) for (let i = 0; i < 40; i++) { const u = lerp(1, F_CRISTA + 0.02, ((t * 0.25 + rnd(i * 3.7)) % 1)), p = W3.caminhoCano.getPointAt(u), sc = (0.6 + rnd(i) * 0.8) * S.gas;
      m4.compose(new T3.Vector3(p.x + (rnd(i * 5) - 0.5) * 0.25, p.y + (rnd(i * 7) - 0.5) * 0.2, 0.06), new T3.Quaternion(), new T3.Vector3(sc, sc, sc)); W3.gas.setMatrixAt(c++, m4); }
    W3.gas.count = c; W3.gas.instanceMatrix.needsUpdate = true; }
}

const CAM = {
  pergunta: { x: 0.6, y: 4.2, d: 21, a: 0.62, h: 3.2 },
  mito: { x: 0.3, y: 3.6, d: 18, a: 0.4, h: 2.0 },
  cano: { x: 0.0, y: 3.4, d: 16.5, a: 0.12, h: 0.8 },
  descarga: { x: -0.8, y: 4.4, d: 17.5, a: 0.06, h: 0.6 },
  enche: { x: -0.4, y: 2.0, d: 12, a: 0.05, h: 0.3 },
  sifao: { x: -0.2, y: 1.8, d: 13.5, a: -0.06, h: 0.3 },
  ar: { x: -0.5, y: 1.9, d: 11, a: 0.08, h: 0.2 },
  boia: { x: -1.3, y: 6.0, d: 14.5, a: 0.1, h: 0.5 },
  selo: { x: -0.8, y: 1.4, d: 13, a: -0.05, h: 0.3 },
  balde: { x: 0.8, y: 4.0, d: 18.5, a: 0.18, h: 1.0 },
};
function camera(t, ctx) { cameraPadrao(t, ctx, { x: 0, y: 3.5, d: 16, a: 0, h: 1, zFoco: 0 }, p => CAM[p.etapa] || {}); }

function seta(cx, cy, ang, s, cor = '#ffd23a') {
  if (s <= 0.01) return;
  x.save(); x.translate(cx, cy); x.rotate(ang); x.scale(s, s); x.fillStyle = cor; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(0, 60); x.lineTo(40, 12); x.lineTo(15, 12); x.lineTo(15, -50); x.lineTo(-15, -50); x.lineTo(-15, 12); x.lineTo(-40, 12); x.closePath(); x.stroke(); x.fill(); x.restore();
}
function overlay(t, ctx) {
  const S = W3.S, p = ctx.p, k = ctx.lt;
  const rot = (px, py, pz, txt, s, cor = 'rgba(255,255,255,0.93)', fg = COL.ink, tam = 34) => { const [a, b] = proj(px, py, pz); pill(a, b, txt, cor, fg, tam, back(s)); };
  const ev = tipo => { const e = ST.eventos.find(e => e.tipo === tipo && e.t >= ctx.t0 - 0.3 && e.t < ctx.t1); return e ? clamp((t - e.t) * 3) : clamp((k - 0.55) * 3); };
  if (p.ruim) pill(W / 2, H * 0.16, p.ruim, COL.red, '#fff', 58, back(ev('erro')));
  if (p.bom) pill(W / 2, H * 0.16, p.bom, COL.green, '#fff', 58, back(ev('certo')));
  if (S.s === 0) { rot(-1.8, 9.6, 0, 'NO PUMP', clamp((k - 0.3) * 4), COL.red, '#fff', 40); rot(1.4, 5.5, 0.8, 'NO MOTOR', clamp((k - 0.45) * 4), COL.red, '#fff', 40); }
  if (S.s === 1) {   // mito: a seta "empurra para baixo" com um X
    const [a, b] = proj(1.4, 5.9, 0.6), g = back(clamp((k - 0.05) * 4)); seta(a, b, 0, 2.0 * g, 'rgba(255,255,255,0.95)');
    if (k > 0.3) { const r = 105 * back(clamp((k - 0.3) * 4)); x.save(); x.strokeStyle = COL.red; x.lineWidth = 18; x.lineCap = 'round'; x.beginPath(); x.moveTo(a - r, b - r); x.lineTo(a + r, b + r); x.moveTo(a + r, b - r); x.lineTo(a - r, b + r); x.stroke(); x.restore(); }
  }
  if (S.s === 2) { rot(-1.25, 3.25, 0, 'UP...', clamp((k - 0.55) * 4), 'rgba(255,210,58,0.96)'); rot(-2.55, 1.2, 0, '...THEN DOWN', clamp((k - 0.7) * 4), 'rgba(255,210,58,0.96)'); }
  if (S.s === 3) {
    rot(FLAP[0] + 0.2, TQ.y0 + 1.25, 0, 'RUBBER FLAP', clamp((k - 0.2) * 4) * (1 - clamp((k - 0.62) * 5)), 'rgba(255,255,255,0.93)', COL.ink, 32);
    rot(-1.8, TQ.y1 + 0.9, 0, '~3 SECONDS', clamp((k - 0.45) * 4), 'rgba(255,210,58,0.96)', COL.ink, 38);
  }
  if (S.s === 4) rot(-1.17, 3.35, 0, 'OVER THE TOP', clamp((k - 0.35) * 4), 'rgba(255,210,58,0.96)', COL.ink, 34);
  if (S.s === 5) { const [a, b] = proj(-2.35, 1.0, 0); seta(a, b, 0, back(clamp((k - 0.15) * 4)) * 0.9, '#ffffff'); rot(-2.3, 2.2, 0, 'GRAVITY', clamp((k - 0.2) * 4)); rot(1.3, 3.4, 0, 'SUCKED OUT', clamp((k - 0.45) * 4), 'rgba(255,255,255,0.93)', COL.ink, 32); }
  if (S.s === 6) rot(-0.5, 3.2, 0, 'GURGLE!', clamp((k - 0.35) * 4), 'rgba(255,255,255,0.95)', COL.ink, 46);
  if (S.s === 7) { rot(BOIA[0], W3.boia.position.y + 0.8, 0, 'FLOAT', clamp((k - 0.1) * 4), 'rgba(143,200,255,0.96)'); rot(BOIA[0] + 0.3, TQ.y0 + 4.05, 0, 'VALVE', clamp((k - 0.3) * 4) * (1 - clamp((k - 0.85) * 6))); }
  if (S.s === 8) { rot(-2.6, 0.6, 0, 'SEWER GAS', clamp((k - 0.2) * 4), 'rgba(170,230,90,0.96)', COL.ink, 32); rot(0.4, 0.75, 0, 'WATER PLUG', clamp((k - 0.4) * 4), 'rgba(143,200,255,0.96)', COL.ink, 32); }
  if (S.s === 9) rot(3.6, 8.6, 0, 'NO TANK NEEDED', clamp((k - 0.5) * 4), 'rgba(255,210,58,0.96)', COL.ink, 36);
}
MUNDO = { monta, atualiza, camera, overlay };
})();
