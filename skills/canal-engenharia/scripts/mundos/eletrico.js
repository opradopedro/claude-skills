// Mundo "eletrico": o que move um carro eletrico. Bateria (milhares de celulas), inversor (DC vira AC trifasico),
// motor com campo magnetico girante que arrasta o rotor, uma engrenagem fixa de ~9:1 e a frenagem regenerativa.
// Tres lugares na mesma cena: a rua com o carro (x=0), a bateria aberta com o inversor (x=60) e o motor em corte com a engrenagem (x=120).
// Etapas: capo, bateria, dc, inversor, bobinas, campo, rotor, engrenagem, regen, final.
(() => {
const LOCAL = { rua: new T3.Vector3(0, 0, 0), pack: new T3.Vector3(60, 0, 0), motor: new T3.Vector3(120, 0, 0), engr: new T3.Vector3(120, 0, 0) };
const ETAPA_LOCAL = { capo: 'rua', bateria: 'rua', dc: 'pack', inversor: 'pack', bobinas: 'motor', campo: 'motor', rotor: 'motor', engrenagem: 'engr', regen: 'rua', final: 'rua' };
const FASE = [new T3.Color(0xff5a3a), new T3.Color(0xffd23a), new T3.Color(0x3aa8ff)];
const FASE_CSS = ['#ff5a3a', '#ffd23a', '#3aa8ff'];
const AMARELO = new T3.Color(0xffd23a), VERDE = new T3.Color(0x37e07a);
const W3 = {};
const RODA = 0.34, ENTRE = 1.45;                     // raio da roda e meia distancia entre eixos
const M = new T3.Vector3(120, 2.5, 0);               // centro do motor em corte
const PIN = new T3.Vector3(128.2, 3.1, 0.6), MOD = 0.05, NP = 8, NG = 72;   // engrenagem: pinhao de 8 dentes, coroa de 72 (9:1)
const COROA = new T3.Vector3(PIN.x + MOD * (NP + NG) / 2, PIN.y, PIN.z);

let GLOW = null;
function pontos(n, cor, tam) {
  if (!GLOW) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c2 = cv.getContext('2d'), g = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c2.fillStyle = g; c2.fillRect(0, 0, 64, 64); GLOW = new T3.CanvasTexture(cv);
  }
  const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new T3.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  const p = new T3.Points(geo, new T3.PointsMaterial({ color: cor, vertexColors: true, size: tam, map: GLOW, transparent: true, depthWrite: false, blending: T3.AdditiveBlending }));
  p.frustumCulled = false; scene.add(p); return p;
}
function pinta(pts, i, cor, k = 1) { pts.geometry.attributes.color.setXYZ(i, cor.r * k, cor.g * k, cor.b * k); }
function poe(pts, i, p) { pts.geometry.attributes.position.setXYZ(i, p.x, p.y, p.z); }
function pronto(pts) { pts.geometry.attributes.position.needsUpdate = pts.geometry.attributes.color.needsUpdate = true; }
const metal = (cor, o = {}) => new T3.MeshStandardMaterial({ color: cor, metalness: 0.85, roughness: 0.32, ...o });
function tubo(pts, r, m, seg = 80) { const c = new T3.CatmullRomCurve3(pts); const me = new T3.Mesh(new T3.TubeGeometry(c, seg, r, 12), m); me.castShadow = true; scene.add(me); return c; }
function extrude(shape, depth, m, bevel = 0) {
  const geo = new T3.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 24 });
  geo.translate(0, 0, -depth / 2);
  const me = new T3.Mesh(geo, m); me.castShadow = me.receiveShadow = true; return me;
}
// engrenagem de dentes retos: raio primitivo m*N/2, cabeca +m, pe -1.25m; furos de alivio na coroa
function engrenagem(N, m, depth, mt, furos = 0) {
  const R = m * N / 2, Ra = R + m, Rd = R - 1.25 * m, p = Math.PI * 2 / N, s = new T3.Shape();
  for (let i = 0; i < N; i++) {
    const a = i * p, pts = [[a, Rd], [a + 0.2 * p, Ra], [a + 0.45 * p, Ra], [a + 0.65 * p, Rd]];
    pts.forEach(([ang, r], j) => { const X = Math.cos(ang) * r, Y = Math.sin(ang) * r; (i === 0 && j === 0) ? s.moveTo(X, Y) : s.lineTo(X, Y); });
  }
  s.closePath();
  const eixo = new T3.Path(); eixo.absarc(0, 0, Math.min(R * 0.25, 0.09), 0, Math.PI * 2, true); s.holes.push(eixo);
  for (let i = 0; i < furos; i++) { const h = new T3.Path(), a = i / furos * Math.PI * 2; h.absarc(Math.cos(a) * R * 0.58, Math.sin(a) * R * 0.58, R * 0.2, 0, Math.PI * 2, true); s.holes.push(h); }
  return extrude(s, depth, mt, 0.012);
}
// caixa de cantos arredondados (bobina, unidade)
function arredondado(w, h, d, r, m) {
  const s = new T3.Shape();
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return extrude(s, d, m, 0.03);
}

// ---------------- carro ----------------
function roda(parent, px, pz) {
  const g = grupo(parent); g.position.set(px, RODA, pz);
  const pneu = new T3.Mesh(new T3.TorusGeometry(RODA - 0.08, 0.085, 16, 40), mat(0x17181a, { roughness: 0.9 })); pneu.scale.z = 1.4; pneu.castShadow = true; g.add(pneu);
  const lado = Math.sign(pz);
  const aro = cyl(RODA - 0.1, RODA - 0.1, 0.2, metal(0xc9ccd1, { roughness: 0.25 }), 32, g); aro.rotation.x = Math.PI / 2;
  const miolo = cyl(0.07, 0.07, 0.24, metal(0x2b2e33), 16, g); miolo.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) { const r = box(0.05, RODA - 0.14, 0.03, metal(0x3a3e44, { roughness: 0.4 }), 0, 0, lado * 0.105, g); const piv = grupo(g); piv.rotation.z = i / 5 * Math.PI * 2; piv.add(r); r.position.y = (RODA - 0.14) / 2; }
  const disco = cyl(0.2, 0.2, 0.03, metal(0x8a8f96, { roughness: 0.5 }), 24, g); disco.rotation.x = Math.PI / 2; disco.position.z = -lado * 0.03;
  return g;
}
function carro() {
  const car = grupo(); W3.car = car;
  W3.tinta = new T3.MeshPhysicalMaterial({ color: 0xb3122a, metalness: 0.45, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 1 });
  // lateral com os arcos das rodas (frente em +x); a parte de cima do capo e uma tampa separada que abre
  const s = new T3.Shape();
  s.moveTo(-2.32, 0.3); s.lineTo(-ENTRE - 0.43, 0.3); s.absarc(-ENTRE, RODA, 0.43, Math.PI, 0, true); s.lineTo(ENTRE - 0.43, 0.3);
  s.absarc(ENTRE, RODA, 0.43, Math.PI, 0, true); s.lineTo(2.3, 0.3); s.quadraticCurveTo(2.42, 0.36, 2.4, 0.55); s.lineTo(2.34, 0.62);
  s.lineTo(1.08, 0.62); s.lineTo(1.04, 0.98); s.lineTo(-1.74, 1.0); s.quadraticCurveTo(-2.2, 1.0, -2.36, 0.93); s.quadraticCurveTo(-2.42, 0.6, -2.32, 0.3);
  W3.corpo = extrude(s, 1.7, W3.tinta, 0.06); car.add(W3.corpo);
  // capo (gira na base do para-brisa)
  const c = new T3.Shape(); c.moveTo(0.02, -0.36); c.lineTo(1.3, -0.36); c.quadraticCurveTo(1.36, -0.32, 1.3, -0.24); c.quadraticCurveTo(0.7, -0.1, 0, 0); c.closePath();
  W3.capo = grupo(car); W3.capo.position.set(1.04, 0.98, 0);
  W3.capo.add(extrude(c, 1.7, W3.tinta, 0.05));
  // porta-malas da frente, vazio (so aparece com o capo aberto)
  W3.frunk = grupo(car);
  box(1.12, 0.02, 1.5, mat(0x1b1d21, { roughness: 0.95 }), 1.68, 0.64, 0, W3.frunk);
  for (const z of [-0.76, 0.76]) box(1.12, 0.12, 0.03, mat(0x26292e), 1.68, 0.69, z, W3.frunk);
  box(0.03, 0.12, 1.5, mat(0x26292e), 1.13, 0.69, 0, W3.frunk); box(0.03, 0.12, 1.5, mat(0x26292e), 2.24, 0.69, 0, W3.frunk);
  box(0.36, 0.22, 0.26, mat(0xcdb892, { roughness: 1 }), 1.9, 0.76, 0.35, W3.frunk);
  // cabine de vidro e teto
  const v = new T3.Shape(); v.moveTo(-1.74, 0.99); v.quadraticCurveTo(-1.2, 1.32, -0.85, 1.4); v.lineTo(0.25, 1.43); v.quadraticCurveTo(0.7, 1.32, 1.06, 0.97); v.closePath();
  W3.vidroMat = new T3.MeshPhysicalMaterial({ color: 0x0f171d, metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.9 });
  W3.vidro = extrude(v, 1.42, W3.vidroMat, 0.04); car.add(W3.vidro);
  // farois, lanterna, macaneta, retrovisor, para-choques
  const luzBranca = new T3.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf4ff, emissiveIntensity: 1.2 });
  for (const z of [-0.62, 0.62]) { const f = box(0.06, 0.05, 0.36, luzBranca, 2.36, 0.62, z, car); f.rotation.z = -0.5; }
  box(0.05, 0.05, 1.5, new T3.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 1.1 }), -2.39, 0.86, 0, car);
  for (const z of [-0.91, 0.91]) { box(0.16, 0.03, 0.02, metal(0xd8dadd), -0.2, 0.86, z, car); box(0.18, 0.08, 0.12, W3.tinta, 0.95, 1.02, z * 1.04, car); box(3.0, 0.012, 0.01, mat(0x3a0a12), -0.25, 0.62, z * 1.002, car); }
  box(0.8, 0.012, 0.01, mat(0x3a0a12), -0.25, 0.8, 0.912, car).rotation.z = Math.PI / 2;
  box(4.4, 0.08, 1.72, mat(0x141518, { roughness: 0.8 }), 0, 0.27, 0, car);
  W3.rodas = [[-ENTRE, -0.8], [-ENTRE, 0.8], [ENTRE, -0.8], [ENTRE, 0.8]].map(([px, pz]) => roda(car, px, pz));
  // por dentro (aparece no raio-x): bandeja de baterias com milhares de celulas, motor traseiro, inversor e cabos laranja
  W3.bandejaMat = mat(0x2a2d33, { roughness: 0.6, metalness: 0.4, transparent: true, opacity: 1 });
  box(2.7, 0.1, 1.46, W3.bandejaMat, -0.05, 0.2, 0, car);
  const nx = 56, nz = 26, celula = new T3.CylinderGeometry(0.02, 0.02, 0.09, 8);
  W3.celMat = new T3.MeshStandardMaterial({ color: 0x9fb4c8, metalness: 0.7, roughness: 0.3, emissive: 0x1a6cff, emissiveIntensity: 0 });
  W3.celulas = new T3.InstancedMesh(celula, W3.celMat, nx * nz); const m4 = new T3.Matrix4(); let n = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { m4.makeTranslation(-1.33 + i * 0.047 + (j % 2) * 0.023, 0.28, -0.6 + j * 0.047); W3.celulas.setMatrixAt(n++, m4); }
  car.add(W3.celulas);
  W3.motorCar = cyl(0.15, 0.15, 0.44, metal(0xaeb3ba), 20, car); W3.motorCar.rotation.x = Math.PI / 2; W3.motorCar.position.set(-ENTRE + 0.05, RODA + 0.02, 0);
  W3.invCar = box(0.36, 0.14, 0.32, metal(0x5a6068, { roughness: 0.45 }), -ENTRE + 0.05, RODA + 0.24, 0, car);
  for (const z of [-0.5, 0.5]) { const e = cyl(0.025, 0.025, 0.6, metal(0x8a8f96), 8, car); e.rotation.x = Math.PI / 2; e.position.set(-ENTRE, RODA, z * 0.9); }
  const laranja = mat(0xff7a1a, { roughness: 0.5, emissive: 0xff5a00, emissiveIntensity: 0.25 });
  W3.caboCar = [-0.12, 0.12].map(dz => { const cc = new T3.CatmullRomCurve3([new T3.Vector3(-1.3, 0.27, dz), new T3.Vector3(-1.38, 0.34, dz), new T3.Vector3(-ENTRE + 0.05, RODA + 0.3, dz * 0.6)]); const me = new T3.Mesh(new T3.TubeGeometry(cc, 30, 0.022, 8), laranja); car.add(me); return cc; });
  W3.fluxoCar = pontos(60, 0xffffff, 0.13);
  W3.dentro = [W3.motorCar, W3.invCar];
  return car;
}

// ---------------- bancada da bateria + inversor ----------------
function bancada(o, comMesa = true) {
  const chao = new T3.Mesh(new T3.CircleGeometry(30, 48), tmat('concreto', { color: 0x9a9890, relevo: 0.6 })); chao.rotation.x = -Math.PI / 2; chao.position.set(o.x, 0.012, o.z); chao.receiveShadow = true; uvMundo(chao, 3); scene.add(chao);
  const fundo = new T3.Mesh(new T3.PlaneGeometry(80, 40), mat(0x2b323c, { roughness: 1 })); fundo.position.set(o.x, 12, o.z - 9); scene.add(fundo);
  if (!comMesa) return;
  const mesa = box(14, 0.12, 6, tmat('madeira', { color: 0x7d5a3c, relevo: 1 }), o.x + 2, 1.0, o.z - 0.4); uvMundo(mesa, 2);
  for (const [dx, dz] of [[-4.6, -2.6], [8.6, -2.6], [-4.6, 1.8], [8.6, 1.8]]) box(0.14, 1.0, 0.14, metal(0x3a3e44), o.x + dx, 0.5, o.z + dz);
}
function bateriaAberta() {
  const B = LOCAL.pack; bancada(B);
  const y0 = 1.06;
  uvMundo(box(4.4, 0.18, 2.7, metal(0x3b4048, { roughness: 0.5 }), B.x, y0 + 0.09, 0), 2);
  for (const z of [-1.38, 1.38]) box(4.4, 0.6, 0.06, metal(0x4a5059, { roughness: 0.45 }), B.x, y0 + 0.4, z);
  for (const dx of [-2.22, 2.22]) box(0.06, 0.6, 2.7, metal(0x4a5059, { roughness: 0.45 }), B.x + dx, y0 + 0.4, 0);
  const nx = 19, nz = 11, geo = new T3.CylinderGeometry(0.105, 0.105, 0.6, 20);
  const lado = new T3.MeshStandardMaterial({ color: 0x2f6fa8, roughness: 0.35, metalness: 0.3 }), topo = new T3.MeshStandardMaterial({ color: 0xd6dade, metalness: 0.9, roughness: 0.25, emissive: 0xffc23a, emissiveIntensity: 0 });
  W3.celTopo = topo;
  W3.celulasB = new T3.InstancedMesh(geo, [lado, topo, topo], nx * nz); W3.celulasB.castShadow = W3.celulasB.receiveShadow = true;
  const m4 = new T3.Matrix4(); let n = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { m4.makeTranslation(B.x - 2.0 + i * 0.218 + (j % 2) * 0.109, y0 + 0.48, -1.15 + j * 0.23); W3.celulasB.setMatrixAt(n++, m4); }
  scene.add(W3.celulasB);
  // barramentos de aluminio por cima, ligando as fileiras
  for (let j = 0; j < nz; j += 2) box(4.25, 0.025, 0.1, metal(0xc4c9cf, { roughness: 0.3 }), B.x - 0.0, y0 + 0.8, -1.15 + j * 0.23 + 0.11);
  box(0.12, 0.05, 2.6, metal(0xb87333, { roughness: 0.3 }), B.x + 2.1, y0 + 0.82, 0);
  // terminais + e -
  W3.termP = new T3.Vector3(B.x + 2.25, y0 + 0.85, -0.6); W3.termN = new T3.Vector3(B.x + 2.25, y0 + 0.85, 0.6);
  const vermelho = mat(0xd8202a, { roughness: 0.4 }), preto = mat(0x1a1a1c, { roughness: 0.4 });
  cyl(0.11, 0.11, 0.16, vermelho, 16).position.copy(W3.termP); cyl(0.11, 0.11, 0.16, preto, 16).position.copy(W3.termN);
  // inversor: caixa de aluminio com tampa de vidro, placa verde e seis transistores
  const I = new T3.Vector3(B.x + 4.6, y0 + 0.1, 0); W3.inv = I;
  uvMundo(box(1.9, 0.16, 1.6, metal(0x8d949c, { roughness: 0.4 }), I.x, I.y + 0.08, I.z), 2);
  for (const z of [-0.78, 0.78]) box(1.9, 0.5, 0.04, metal(0x9aa1a9, { roughness: 0.35 }), I.x, I.y + 0.36, I.z + z);
  for (const dx of [-0.93, 0.93]) box(0.04, 0.5, 1.6, metal(0x9aa1a9, { roughness: 0.35 }), I.x + dx, I.y + 0.36, I.z);
  for (let i = 0; i < 9; i++) box(1.8, 0.06, 0.04, metal(0x7a818a), I.x, I.y + 0.13, I.z - 0.7 + i * 0.175);
  box(1.7, 0.04, 1.4, mat(0x1f7a46, { roughness: 0.6 }), I.x, I.y + 0.2, I.z);
  for (let i = 0; i < 40; i++) box(0.3 + rnd(i) * 0.5, 0.005, 0.012, mat(0xd8b45a, { metalness: 0.8, roughness: 0.3 }), I.x - 0.6 + rnd(i * 3) * 1.2, I.y + 0.225, I.z - 0.6 + rnd(i * 7) * 1.2);
  W3.chips = [];
  for (let k = 0; k < 6; k++) {
    const cm = new T3.MeshStandardMaterial({ color: 0x15171a, roughness: 0.4, emissive: FASE[k % 3], emissiveIntensity: 0 });
    W3.chips.push(box(0.34, 0.08, 0.28, cm, I.x - 0.45 + (k % 3) * 0.45, I.y + 0.26, I.z + (k < 3 ? -0.32 : 0.32)));
  }
  box(0.3, 0.06, 0.2, mat(0x101114), I.x + 0.55, I.y + 0.25, I.z + 0.55);
  W3.tampa = box(1.9, 0.03, 1.6, new T3.MeshPhysicalMaterial({ color: 0xdfeaf2, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }), I.x, I.y + 0.62, I.z);
  // cabos: dois da bateria para o inversor (DC) e tres do inversor para o motor (AC)
  const laranja = mat(0xff7a1a, { roughness: 0.45 });
  W3.caboP = tubo([W3.termP, new T3.Vector3(B.x + 2.8, y0 + 1.1, -0.6), new T3.Vector3(I.x - 1.3, I.y + 0.6, -0.4), new T3.Vector3(I.x - 0.95, I.y + 0.36, -0.35)], 0.06, laranja);
  W3.caboN = tubo([W3.termN, new T3.Vector3(B.x + 2.8, y0 + 1.1, 0.6), new T3.Vector3(I.x - 1.3, I.y + 0.6, 0.4), new T3.Vector3(I.x - 0.95, I.y + 0.36, 0.35)], 0.06, laranja);
  W3.fases = [-0.45, 0, 0.45].map((dz, k) => tubo([new T3.Vector3(I.x + 0.95, I.y + 0.36, dz), new T3.Vector3(I.x + 1.6, I.y + 0.45, dz * 1.3), new T3.Vector3(I.x + 2.6, I.y + 0.1, dz * 1.8 - 0.6), new T3.Vector3(I.x + 4.5, I.y - 0.0, dz * 2.2 - 1.6)], 0.045, laranja));
  W3.anel = W3.fases.map((c, k) => { const a = new T3.Mesh(new T3.TorusGeometry(0.06, 0.02, 8, 16), mat(FASE[k], { emissive: FASE[k], emissiveIntensity: 0.6 })); const p = c.getPointAt(0.12); a.position.copy(p); a.lookAt(c.getPointAt(0.14)); scene.add(a); return a; });
  W3.fluxoDC = pontos(90, 0xffffff, 0.2);
  W3.fluxoAC = pontos(90, 0xffffff, 0.18);
  W3.luzPack = new T3.PointLight(0xffd7a0, 6, 14, 1.4); W3.luzPack.position.set(B.x + 1, 4.5, 3); scene.add(W3.luzPack);
  W3.luzInv = new T3.PointLight(0xffc23a, 0, 4, 1.6); W3.luzInv.position.set(I.x, I.y + 1.0, I.z + 0.4); scene.add(W3.luzInv);
}

// ---------------- motor em corte + engrenagem ----------------
function motorAberto() {
  const C = LOCAL.motor; bancada(C, false);
  const R0 = 2.0, Ry = 1.5, Rt = 1.08, dz = 1.5, NT = 6;
  W3.motor = grupo(); W3.motor.position.copy(M);
  // carcaca de aluminio: disco do fundo, meia casca de baixo com aletas e pes
  const alu = metal(0xb9bec4, { roughness: 0.42, metalness: 0.75 });
  const disco = cyl(2.25, 2.25, 0.16, alu, 64, W3.motor); disco.rotation.x = Math.PI / 2; disco.position.z = -0.95;
  const casca = new T3.Mesh(new T3.CylinderGeometry(2.25, 2.25, 1.9, 64, 1, true, Math.PI / 2, Math.PI), new T3.MeshStandardMaterial({ color: 0xb9bec4, metalness: 0.75, roughness: 0.42, side: T3.DoubleSide }));
  casca.rotation.x = Math.PI / 2; casca.castShadow = casca.receiveShadow = true; W3.motor.add(casca);
  for (const s of [-1, 1]) box(0.5, 0.4, 1.6, alu, s * 1.4, -2.2, 0, W3.motor);
  box(3.6, 0.1, 1.9, metal(0x5c636c), 0, -2.42, 0, W3.motor);
  // estator: chapas de aco com seis dentes para dentro
  const sh = new T3.Shape(); sh.absarc(0, 0, R0, 0, Math.PI * 2, false);
  const furo = new T3.Path(), p = Math.PI * 2 / NT, w = 0.26;
  for (let k = 0; k < NT; k++) {
    const a = k * p, tt = 0.24, dy = Math.asin(w / Ry), dsh = Math.asin(w / (Rt + 0.12));
    const pts = [[a - tt, Rt], [a + tt, Rt], [a + tt, Rt + 0.1], [a + dsh, Rt + 0.13], [a + dy, Ry], [a + p - dy, Ry], [a + p - dsh, Rt + 0.13], [a + p - tt, Rt + 0.1]];
    pts.forEach(([ang, r], j) => { const X = Math.cos(ang) * r, Y = Math.sin(ang) * r; (k === 0 && j === 0) ? furo.moveTo(X, Y) : furo.lineTo(X, Y); });
  }
  furo.closePath(); sh.holes.push(furo);
  W3.estator = extrude(sh, dz, metal(0x8a929b, { roughness: 0.36, metalness: 0.8 })); W3.motor.add(W3.estator);
  for (let i = 0; i < 14; i++) { const l = new T3.Mesh(new T3.RingGeometry(R0 - 0.005, R0 + 0.004, 64), mat(0x4a5058)); l.position.z = -dz / 2 + (i + 0.5) * dz / 14; W3.motor.add(l); }
  // bobinas de cobre em volta de cada dente; fases U V W U V W
  W3.bobinas = [];
  for (let k = 0; k < NT; k++) {
    const g = grupo(W3.motor); g.rotation.z = k * p;
    const cm = tmat('cobre', { relevo: 1.5, roughness: 0.35, metalness: 0.6, emissive: FASE[k % 3], emissiveIntensity: 0 });
    const b = arredondado(Ry - Rt - 0.14, w * 2 + 0.24, dz + 0.42, 0.08, cm); b.position.x = (Ry + Rt + 0.12) / 2; g.add(b);
    W3.bobinas.push({ k, ang: k * p, m: cm, g });
  }
  // rotor: cilindro de aco com dois imas (norte vermelho, sul azul) e eixo
  W3.rotor = grupo(W3.motor);
  cyl(0.98, 0.98, dz + 0.1, metal(0x50565e, { roughness: 0.4 }), 48, W3.rotor).rotation.x = Math.PI / 2;
  const imaN = new T3.MeshStandardMaterial({ color: 0xe0352b, roughness: 0.35, metalness: 0.3, emissive: 0x9a1a10, emissiveIntensity: 0.3 }), imaS = new T3.MeshStandardMaterial({ color: 0x2b6fe0, roughness: 0.35, metalness: 0.3, emissive: 0x103a9a, emissiveIntensity: 0.3 });
  for (const [m, a0] of [[imaN, 0], [imaS, Math.PI]]) {
    const ima = new T3.Mesh(new T3.CylinderGeometry(1.0, 1.0, dz + 0.12, 32, 1, false, a0 - 0.9 + Math.PI / 2, 1.8), m); ima.rotation.x = Math.PI / 2; ima.castShadow = true; W3.rotor.add(ima);
  }
  const eixo = cyl(0.17, 0.17, 4.2, metal(0xdfe3e7, { roughness: 0.2 }), 24, W3.rotor); eixo.rotation.x = Math.PI / 2; eixo.position.z = 0.8;
  W3.rotorZ = 0;
  // borrao de velocidade na frente do rotor (aparece quando gira rapido)
  W3.borrao = new T3.Mesh(new T3.CircleGeometry(1.0, 48), new T3.MeshBasicMaterial({ color: 0xbbc4d0, transparent: true, opacity: 0, depthWrite: false })); W3.borrao.position.z = dz / 2 + 0.08; W3.rotor.add(W3.borrao);
  // seta do campo magnetico girante
  W3.seta = grupo(W3.motor); W3.seta.position.z = dz / 2 + 0.35;
  const sm = new T3.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffc800, emissiveIntensity: 1.4, transparent: true, opacity: 1 });
  W3.setaMat = sm;
  const haste = cyl(0.07, 0.07, 1.5, sm, 12, W3.seta); haste.rotation.z = -Math.PI / 2; haste.position.x = 0.05;
  const ponta = new T3.Mesh(new T3.ConeGeometry(0.2, 0.42, 16), sm); ponta.rotation.z = -Math.PI / 2; ponta.position.x = 0.98; W3.seta.add(ponta);
  const rabo = new T3.Mesh(new T3.SphereGeometry(0.14, 16, 10), sm); rabo.position.x = -0.72; W3.seta.add(rabo);
  W3.luzMotor = new T3.PointLight(0xffe0b0, 9, 16, 1.3); W3.luzMotor.position.set(M.x + 2, M.y + 3.5, 5); scene.add(W3.luzMotor);
  W3.luzCampo = new T3.PointLight(0xffd23a, 0, 5, 1.5); scene.add(W3.luzCampo);
  // caixa de reducao: pinhao no eixo de um motor menor, coroa ligada a roda
  const aco = metal(0xc2c7cd, { roughness: 0.28, metalness: 0.9 });
  W3.pinhao = engrenagem(NP, MOD, 0.3, metal(0xe2c27a, { roughness: 0.3 })); W3.pinhao.position.copy(PIN); scene.add(W3.pinhao);
  W3.coroa = engrenagem(NG, MOD, 0.24, aco, 6); W3.coroa.position.copy(COROA); scene.add(W3.coroa);
  const mp = cyl(0.55, 0.55, 1.5, alu, 32); mp.rotation.x = Math.PI / 2; mp.position.set(PIN.x, PIN.y, PIN.z - 1.0);
  const ep = cyl(0.06, 0.06, 0.9, aco, 12); ep.rotation.x = Math.PI / 2; ep.position.set(PIN.x, PIN.y, PIN.z - 0.35);
  W3.rodaG = grupo(); W3.rodaG.position.set(COROA.x, COROA.y, COROA.z - 1.2);
  const pneu = new T3.Mesh(new T3.TorusGeometry(2.3, 0.48, 20, 64), mat(0x1b1c1f, { roughness: 0.92 })); pneu.scale.z = 1.2; pneu.castShadow = true; W3.rodaG.add(pneu);
  const aro = cyl(1.9, 1.9, 0.5, metal(0xa9aeb5, { roughness: 0.3 }), 48, W3.rodaG); aro.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) { const piv = grupo(W3.rodaG); piv.rotation.z = i / 5 * Math.PI * 2; box(0.26, 1.7, 0.1, metal(0x3a3e44), 0, 0.95, 0.3, piv); }
  const ec = cyl(0.09, 0.09, 1.3, aco, 12); ec.rotation.x = Math.PI / 2; ec.position.set(COROA.x, COROA.y, COROA.z - 0.6);
  box(0.4, PIN.y - 0.5, 0.4, metal(0x3a3e44), COROA.x, 1.06 + (PIN.y - 1.06) / 2 - 0.25, COROA.z - 1.2).visible = false;
}

function monta() {
  scene.add(sun.target);
  quintal({ zFundo: -6, zCasa: -24, xCasa: 3, escalaCasa: 1.15, arvores: [[-8, -16, 1.4], [12, -15, 1.6], [16, -21, 1.3], [-14, -20, 1.5]] });
  reflexos(0.75);
  // rua: asfalto, faixa tracejada, meio-fio e calcada
  const asf = new T3.Mesh(new T3.PlaneGeometry(90, 7), tmat('asfalto', { relevo: 1.2, roughness: 0.95 })); asf.rotation.x = -Math.PI / 2; asf.position.set(0, 0.012, 0.6); asf.receiveShadow = true; uvMundo(asf, 3); scene.add(asf);
  for (let i = -10; i < 10; i++) box(1.6, 0.01, 0.14, mat(0xf2f0e6, { roughness: 0.7 }), i * 3.4, 0.02, 2.75);
  uvMundo(box(90, 0.16, 0.3, tmat('concreto', { relevo: 1 }), 0, 0.08, -3.05), 2);
  uvMundo(box(90, 0.14, 2.4, tmat('concreto', { color: 0xd8d2c6, relevo: 0.8 }), 0, 0.07, -4.4), 2);
  for (let i = -12; i < 12; i++) box(0.02, 0.005, 2.4, mat(0x9a948a), i * 1.6, 0.145, -4.4);
  // lado de ca da rua: calcada e gramado ate a camera (sem isso o chao acaba e aparece o vazio)
  uvMundo(box(90, 0.16, 0.3, tmat('concreto', { relevo: 1 }), 0, 0.08, 4.25), 2);
  uvMundo(box(90, 0.14, 2.2, tmat('concreto', { color: 0xd8d2c6, relevo: 0.8 }), 0, 0.07, 5.5), 2);
  const perto = new T3.Mesh(new T3.PlaneGeometry(200, 80), tmat('grama', { relevo: 1 })); perto.rotation.x = -Math.PI / 2; perto.position.set(0, 0.005, 46); perto.receiveShadow = true; uvMundo(perto, 3); scene.add(perto);
  carro();
  bateriaAberta();
  motorAberto();
}

// angulo do campo girante: continuo nas etapas do motor; no "rotor" acelera
function campo(t, ctx) {
  const et = ctx.p.etapa;
  if (et === 'rotor') { const tau = t - ctx.t0; return 2.2 * ctx.t0 + 2.2 * tau + 1.4 * tau * tau; }
  return 2.2 * t;
}
function atualiza(t, ctx) {
  const et = ctx.p.etapa, k = ctx.lt, lugar = ETAPA_LOCAL[et], centro = LOCAL[lugar];
  sun.position.set(centro.x - 10, 18, centro.z + 14); sun.target.position.set(centro.x + 1, 1, 0);
  scene.background = null;
  // ---- carro ----
  const tau = t - ctx.t0;
  let carX = 0;
  if (et === 'regen') carX = -4.5 + 7.5 * (1 - Math.pow(1 - k, 2));
  if (et === 'final') carX = 3;
  W3.car.position.x = carX; W3.carX = carX;
  const rodaAng = et === 'regen' || et === 'final' ? -(carX + 4.5) / RODA : 0;
  W3.rodas.forEach(r => r.rotation.z = rodaAng);
  const capo = et === 'capo' ? ease((k - 0.12) / 0.3) : et === 'bateria' ? 1 - ease(k * 3) : 0;
  W3.capo.rotation.z = capo * 0.95; W3.frunk.visible = capo > 0.02;
  const xray = et === 'bateria' ? ease((k - 0.15) / 0.3) : et === 'regen' ? ease(k * 3) * 0.9 : 0;
  W3.tinta.opacity = 1 - 0.88 * xray; W3.tinta.depthWrite = xray < 0.05; W3.corpo.castShadow = xray < 0.5;
  W3.vidroMat.opacity = 0.9 - 0.72 * xray; W3.vidroMat.depthWrite = xray < 0.05;
  const brilho = et === 'bateria' ? xray * (1.6 + 0.8 * Math.sin(t * 5)) : et === 'regen' ? xray * 2.0 : 0;
  W3.celMat.emissive.set(et === 'regen' ? 0x22d066 : 0x1a6cff); W3.celMat.emissiveIntensity = brilho;
  // fluxo no carro: na regeneracao a energia volta do motor para a bateria (verde)
  const fc = W3.fluxoCar, nfc = fc.geometry.attributes.position.count; fc.visible = et === 'regen' && xray > 0.3;
  for (let i = 0; i < nfc; i++) {
    const c = W3.caboCar[i % 2], u = ((i / nfc) + t * 0.5) % 1, p = c.getPointAt(1 - u).clone(); p.x += carX;
    poe(fc, i, p); pinta(fc, i, VERDE, Math.sin(u * Math.PI));
  }
  pronto(fc);
  // ---- bateria + inversor ----
  const naBancada = lugar === 'pack';
  const onda = (i, j) => 0.5 + 0.5 * Math.sin(t * 4 - i * 0.5 - j * 0.2);
  W3.celTopo.emissiveIntensity = naBancada ? (et === 'dc' ? 0.25 + 0.2 * Math.sin(t * 4) : 0.15) : 0;
  const fd = W3.fluxoDC, nd = fd.geometry.attributes.position.count; fd.visible = naBancada;
  for (let i = 0; i < nd; i++) {
    // corrente continua: sempre no mesmo sentido, sai pelo + e volta pelo -
    const vai = i % 2 === 0, u = ((i / nd) + t * 0.35) % 1, c = vai ? W3.caboP : W3.caboN;
    const p = c.getPointAt(vai ? u : 1 - u); poe(fd, i, p); pinta(fd, i, AMARELO, (vai ? 1 : 0.55) * (et === 'dc' ? 1 : 0.6));
  }
  pronto(fd);
  const fa = W3.fluxoAC, na = fa.geometry.attributes.position.count, ac = et === 'inversor'; fa.visible = naBancada && ac;
  const w = ac ? 7.5 : 0;
  for (let i = 0; i < na; i++) {
    // corrente alternada: cada fase vai e volta, defasada 120 graus da outra
    const f = i % 3, base = (Math.floor(i / 3) / (na / 3)) * 0.8 + 0.1, u = clamp(base + 0.07 * Math.sin(w * t - f * 2.094));
    const p = W3.fases[f].getPointAt(u); poe(fa, i, p); pinta(fa, i, FASE[f], 0.5 + 0.5 * Math.max(0, Math.sin(w * t - f * 2.094)));
  }
  pronto(fa);
  W3.chips.forEach((c, j) => { const f = j % 3, alto = j < 3, s = Math.sin(7.5 * t - f * 2.094); c.material.emissiveIntensity = ac ? (alto ? (s > 0 ? 1.6 : 0.05) : (s < 0 ? 1.6 : 0.05)) : 0; });
  W3.luzInv.intensity = ac ? 3 + 2 * Math.abs(Math.sin(t * 15)) : 0;
  // ---- motor ----
  const noMotor = lugar === 'motor', th = campo(t, ctx);
  const ligado = noMotor ? 1 : 0;
  W3.bobinas.forEach(b => {
    const i = Math.cos(b.ang - th), mag = Math.abs(i);
    b.m.emissiveIntensity = ligado * Math.pow(mag, 2.2) * 0.95;
  });
  const lv = new T3.Vector3(Math.cos(th) * 1.3, Math.sin(th) * 1.3, 1.4).add(M); W3.luzCampo.position.copy(lv); W3.luzCampo.intensity = noMotor ? 4 : 0;
  // o rotor entra no estator na etapa "campo" e segue a seta com um pequeno atraso
  const entra = et === 'bobinas' ? 0 : et === 'campo' ? ease(k / 0.3) : 1;
  W3.rotor.visible = entra > 0.001;
  W3.rotor.position.z = (1 - entra) * 5.5;
  const rapido = et === 'rotor' ? clamp(tau / 2.5) : 0;
  // angulo visivel do rotor: acima de ~7 rad/s o olho (e os 30 qps) nao acompanha; o borrao assume
  const ver = et === 'rotor' ? 2.2 * ctx.t0 + 2.2 * tau + Math.min(1.4 * tau * tau, 2.4 * tau) : th;
  W3.rotor.rotation.z = (et === 'bobinas' ? 0 : ver - 0.35);
  W3.borrao.material.opacity = 0.55 * rapido;
  W3.seta.rotation.z = th;
  W3.setaMat.opacity = et === 'bobinas' ? 1 : et === 'campo' ? 1 - 0.55 * ease(k / 0.4) : 0.35 * (1 - rapido);
  W3.seta.visible = W3.setaMat.opacity > 0.02;
  // reducao 9:1: pinhao gira 9 voltas para a coroa (e a roda) girar uma
  const ger = et === 'engrenagem' ? tau : 0, phiP = ger * Math.PI * 2 * 1.1;
  W3.pinhao.rotation.z = phiP - 0.325 * (Math.PI * 2 / NP);
  W3.coroa.rotation.z = -phiP * NP / NG + Math.PI - 0.825 * (Math.PI * 2 / NG);
  W3.rodaG.rotation.z = -phiP * NP / NG;
  W3.voltasP = phiP / (Math.PI * 2); W3.voltasR = W3.voltasP * NP / NG;
}

const CAM = {
  capo: { x: 1.4, y: 0.75, d: 6.6, h: 2.6, a: 0.95 }, bateria: { x: -0.1, y: 0.35, d: 7.2, h: 2.0, a: 0.5 },
  dc: { x: 2.6, y: 1.2, d: 15.5, h: 6.5, a: 0.05 }, inversor: { x: 5.0, y: 1.3, d: 6.0, h: 3.2, a: 0.28 },
  bobinas: { x: 0, y: 2.5, d: 12.5, h: 0.6, a: 0.3 }, campo: { x: 0, y: 2.5, d: 11, h: 0.3, a: 0.12 }, rotor: { x: 0, y: 2.5, d: 10.5, h: 0.2, a: -0.08 },
  engrenagem: { x: 9.7, y: 3.0, d: 14, h: 0.6, a: 0.08 },
  regen: { x: 0, y: 0.55, d: 10.5, h: 2.4, a: 0.42, segue: true }, final: { x: -0.2, y: 0.8, d: 11.5, h: 2.8, a: 0.7, segue: true },
};
function camera(t, ctx) {
  const cfg = j => { const e = (ST.cenas[j].p || {}).etapa; return { ...CAM[e], c: LOCAL[ETAPA_LOCAL[e]] }; };
  const cur = cfg(ctx.i), prev = cfg(Math.max(0, ctx.i - 1)), corte = prev.c !== cur.c;
  const k = corte ? 1 : ease((t - ctx.t0) / 1.4), L = (a, b) => lerp(a, b, k);
  const d = L(prev.d, cur.d) * (1 - 0.06 * ctx.lt), a = L(prev.a, cur.a) + ctx.lt * 0.07, h = L(prev.h, cur.h), y = L(prev.y, cur.y);
  const ox = L(prev.x + (prev.segue ? W3.carX : 0), cur.x + (cur.segue ? W3.carX : 0));
  const zoom = corte ? 1 + 0.5 * Math.max(0, 1 - (t - ctx.t0) / 0.35) : 1;
  const cx = cur.c.x + ox;
  cam.position.set(cx + Math.sin(a) * d * zoom, y + h * zoom, cur.c.z + Math.cos(a) * d * zoom);
  cam.lookAt(cx, y, cur.c.z); cam.updateMatrixWorld();
  W3.flash = corte && ctx.i > 0 ? Math.max(0, 1 - (t - ctx.t0) / 0.3) : 0;
}

// grafico de corrente no canto de baixo: linha reta (DC) ou tres senoides (AC)
function grafico(t, tipo, s) {
  if (s <= 0.01) return;
  const gw = 820, gh = 250, gx = (W - gw) / 2, gy = 1490;
  x.save(); x.globalAlpha = clamp(s);
  x.fillStyle = 'rgba(16,20,28,0.78)'; rr(gx, gy, gw, gh, 28); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 2; x.beginPath(); x.moveTo(gx + 40, gy + gh / 2 + 10); x.lineTo(gx + gw - 30, gy + gh / 2 + 10); x.stroke();
  x.font = `800 34px ${FONT}`; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
  x.fillText(tipo === 'dc' ? 'DC  ·  one way' : 'AC  ·  back and forth', gx + 40, gy + 38);
  x.lineWidth = 7; x.lineCap = 'round';
  const x0 = gx + 40, x1 = gx + gw - 30, mid = gy + gh / 2 + 10, amp = 70;
  if (tipo === 'dc') {
    x.strokeStyle = '#ffd23a'; x.beginPath(); x.moveTo(x0, mid - amp * 0.8); x.lineTo(x0 + (x1 - x0) * clamp(s), mid - amp * 0.8); x.stroke();
  } else {
    for (let f = 0; f < 3; f++) {
      x.strokeStyle = FASE_CSS[f]; x.beginPath();
      for (let i = 0; i <= 120; i++) { const u = i / 120, px = x0 + (x1 - x0) * u, py = mid - amp * Math.sin(u * Math.PI * 6 - t * 5 - f * 2.094); i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    }
  }
  x.restore();
}
function overlay(t, ctx) {
  if (W3.flash > 0) { x.fillStyle = `rgba(255,255,255,${0.7 * W3.flash})`; x.fillRect(0, 0, W, H); }
  const et = ctx.p.etapa, s = back((t - ctx.t0) * 3), s2 = back((t - ctx.t0) * 3 - 0.6), branco = 'rgba(255,255,255,0.92)';
  if (et === 'capo') { const e = E.since(t, 'erro'); if (e >= 0) pill(W / 2, 300, 'No engine?!', COL.red, '#fff', 46, back(e * 3)); }
  if (et === 'bateria') { pill(W / 2, 300, 'Battery under the floor', '#1a6cff', '#fff', 42, s); const [px, py] = proj(-0.1, 0.25, 0.9); pill(px, py + 110, '4,416 cells', COL.yellow, COL.ink, 40, s2); }
  if (et === 'dc') { const [px, py] = proj(W3.termP.x, W3.termP.y + 0.4, W3.termP.z); pill(W / 2, 300, 'Direct current', COL.yellow, COL.ink, 44, s); grafico(t, 'dc', clamp((t - ctx.t0) * 1.5)); }
  if (et === 'inversor') { const [px, py] = proj(W3.inv.x, W3.inv.y + 0.9, W3.inv.z); pill(px, py - 40, 'Inverter', branco, COL.ink, 42, s); grafico(t, 'ac', clamp((t - ctx.t0) * 1.5)); }
  if (et === 'bobinas') {
    pill(W / 2, 300, '3 sets of coils', '#b87333', '#fff', 44, s);
    W3.bobinas.slice(0, 3).forEach(b => { const a = b.ang, [px, py] = proj(M.x + Math.cos(a) * 1.3, M.y + Math.sin(a) * 1.3, 1.0); pill(px, py, 'UVW'[b.k], FASE_CSS[b.k], b.k === 1 ? COL.ink : '#fff', 34, s2); });
  }
  if (et === 'campo') pill(W / 2, 300, 'Spinning magnetic field', COL.yellow, COL.ink, 40, s);
  if (et === 'rotor') {
    const tau = t - ctx.t0, rpm = Math.round(15000 * ease(tau / 2.8) / 100) * 100;
    pill(W / 2, 300, 'No gearbox', COL.red, '#fff', 44, s);
    pill(W / 2, 1560, rpm.toLocaleString('en-US') + ' RPM', 'rgba(16,20,28,0.85)', '#fff', 54, s2);
  }
  if (et === 'engrenagem') {
    pill(W / 2, 300, '9 : 1', COL.yellow, COL.ink, 56, s);
    const [qx, qy] = proj(PIN.x, PIN.y - 0.45, PIN.z); pill(Math.max(250, qx), qy + 40, `Motor: ${W3.voltasP.toFixed(1)} turns`, 'rgba(226,194,122,0.95)', COL.ink, 40, s2);
    pill(W / 2, 1590, `Wheel: ${W3.voltasR.toFixed(2)} turns`, 'rgba(16,20,28,0.85)', '#fff', 40, s2);
  }
  if (et === 'regen') pill(W / 2, 300, 'Braking = charging', COL.green, '#fff', 44, s);
}
MUNDO = { monta, atualiza, camera, overlay };
})();
