// Mundo "arcondicionado": como o ar-condicionado split esfria o quarto (tira o calor e joga fora).
// Tres lugares na mesma cena: a casa em corte com o quintal (x=0), a unidade de dentro aberta (x=60) e a de fora aberta (x=120).
// Etapas: casa, calor, interna, sopra, pinga, tubo, compressor, externa, volta, final.
(() => {
const LOCAL = { casa: new T3.Vector3(0, 0, 0), interna: new T3.Vector3(60, 0, 0), externa: new T3.Vector3(120, 0, 0) };
const ETAPA_LOCAL = { casa: 'casa', calor: 'casa', interna: 'interna', sopra: 'interna', pinga: 'interna', tubo: 'casa', compressor: 'externa', externa: 'externa', volta: 'casa', final: 'casa' };
const W3 = {};
const QUENTE = new T3.Color(0xff4a1a), FRIO = new T3.Color(0x3aa8ff);
const PAREDE_X = 6;                                  // parede externa da casa (o quintal fica em x > 6)
const IU = new T3.Vector3(0.5, 4.7, -4.45);          // unidade interna na parede do fundo
const OU = new T3.Vector3(8.6, 0, -3.3);            // unidade externa no quintal

const vidro = (cor, op) => new T3.MeshStandardMaterial({ color: cor, roughness: 0.15, metalness: 0.1, transparent: true, opacity: op, depthWrite: false });
let GLOW = null;
function pontos(n, cor, tam) {
  if (!GLOW) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c2 = cv.getContext('2d'), g = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c2.fillStyle = g; c2.fillRect(0, 0, 64, 64); GLOW = new T3.CanvasTexture(cv);
  }
  const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new T3.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return new T3.Points(geo, new T3.PointsMaterial({ color: cor, vertexColors: true, size: tam, map: GLOW, transparent: true, depthWrite: false, blending: T3.AdditiveBlending }));
}
function contorno(geo, cor, op, parent) {
  const l = new T3.LineSegments(new T3.EdgesGeometry(geo, 25), new T3.LineBasicMaterial({ color: cor, transparent: true, opacity: op })); parent.add(l); return l;
}
function arredondado(w, h, d, r, m) {
  const s = new T3.Shape();
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const geo = new T3.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }); geo.translate(0, 0, -d / 2);
  const me = new T3.Mesh(geo, m); me.castShadow = me.receiveShadow = true; return me;
}
// serpentina com aletas: um bloco de chapinhas finas atravessado por tubos em U
function serpentina(w, h, d, corTubo, parent, nAletas = 60) {
  const g = grupo(parent);
  const aleta = new T3.InstancedMesh(new T3.BoxGeometry(0.015, h, d), mat(0xd9dee4, { metalness: 0.6, roughness: 0.35 }), nAletas);
  const m4 = new T3.Matrix4();
  for (let i = 0; i < nAletas; i++) { m4.makeTranslation(-w / 2 + i * w / (nAletas - 1), 0, 0); aleta.setMatrixAt(i, m4); }
  g.add(aleta);
  const tm = mat(corTubo, { metalness: 0.5, roughness: 0.3, emissive: corTubo, emissiveIntensity: 0.25 });
  for (let j = 0; j < 4; j++) { const c = cyl(0.06, 0.06, w + 0.3, tm, 14, g); c.rotation.z = Math.PI / 2; c.position.set(0, -h / 2 + 0.15 + j * (h - 0.3) / 3, 0); }
  g.userData.tuboMat = tm; return g;
}
function helice(n, r, m) {
  const g = new T3.Group();
  for (let i = 0; i < n; i++) { const p = new T3.Mesh(new T3.BoxGeometry(r, 0.05, r * 0.38), m); p.position.x = r / 2; const piv = new T3.Group(); piv.rotation.y = i / n * Math.PI * 2; p.rotation.x = 0.35; piv.add(p); g.add(piv); }
  g.add(new T3.Mesh(new T3.CylinderGeometry(r * 0.16, r * 0.16, 0.2, 20), m));
  return g;
}

function monta() {
  scene.add(sun.target);
  // ================= casa em corte + quintal =================
  quintal({ zFundo: 60, zCasa: -34, xCasa: 16, escalaCasa: 1.1, arvores: [[14, -12, 1.4], [22, -9, 1.6], [26, -16, 1.3], [-12, -14, 1.5]] });
  const piso = tmat('madeira', { color: 0xb88c62, relevo: 1 }), pintura = tmat('concreto', { color: 0xf3e6d2, relevo: 0.5 });
  uvMundo(box(12.4, 0.3, 10.4, piso, 0, 0.15, 0), 2.2);
  uvMundo(box(12.4, 6.4, 0.3, pintura, 0, 3.2, -5.05), 3);                         // fundo
  uvMundo(box(0.3, 6.4, 10.4, pintura, -6.05, 3.2, 0), 3);                         // esquerda
  // parede de fora com o furo dos canos; o lado de fora tem reboco
  // (em corte: so a mureta, para ver a unidade de fora; a casa de boneca mostra a espessura da parede)
  uvMundo(box(0.4, 0.9, 10.4, tmat('concreto', { color: 0xe9dcc7, relevo: 0.8 }), PAREDE_X + 0.1, 0.45, 0), 3);
  uvMundo(box(0.4, 6.4, 1.2, tmat('concreto', { color: 0xe9dcc7, relevo: 0.8 }), PAREDE_X + 0.1, 3.2, -4.5), 3);
  box(13, 0.3, 10.8, mat(0xf5f1ea), 0.2, 6.55, 0).visible = false;
  // janela com sol na parede esquerda
  box(0.32, 2.4, 3.2, new T3.MeshBasicMaterial({ color: 0xbfe2ff }), -6.0, 3.6, -0.5);
  box(0.36, 0.12, 3.4, mat(0xffffff), -6.0, 4.85, -0.5); box(0.36, 0.12, 3.4, mat(0xffffff), -6.0, 2.35, -0.5);
  // moveis: sofa, tapete, mesinha, planta, quadro
  const tecido = mat(0x3f6f8f, { roughness: 0.95 });
  box(5.2, 0.9, 2.0, tecido, -1.0, 0.75, -3.6); box(5.2, 1.4, 0.5, tecido, -1.0, 1.6, -4.45);
  for (const s of [-1, 1]) box(0.5, 1.2, 2.0, tecido, -1.0 + s * 2.7, 0.9, -3.6);
  for (let i = 0; i < 3; i++) box(1.4, 0.5, 0.35, mat([0xf2c14e, 0xe76f51, 0xf4f1de][i], { roughness: 0.9 }), -2.6 + i * 1.6, 1.45, -4.05);
  const tapete = new T3.Mesh(new T3.CircleGeometry(2.6, 48), mat(0xc9a27e, { roughness: 1 })); tapete.rotation.x = -Math.PI / 2; tapete.position.set(-0.8, 0.31, -0.6); tapete.receiveShadow = true; scene.add(tapete);
  box(1.8, 0.1, 1.0, tmat('madeira', { color: 0x6b4a2e }), -0.8, 0.95, -0.6); for (const [dx, dz] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) box(0.08, 0.6, 0.08, mat(0x3a2a1c), -0.8 + dx, 0.6, -0.6 + dz);
  const vaso = cyl(0.45, 0.35, 0.9, mat(0xb5653e)); vaso.position.set(4.8, 0.75, -4.2);
  for (let i = 0; i < 6; i++) { const f = new T3.Mesh(new T3.IcosahedronGeometry(0.5 + rnd(i) * 0.3, 1), tmat('folhas', { relevo: 3 })); f.position.set(4.8 + (rnd(i * 3) - 0.5), 1.7 + rnd(i * 7) * 1.1, -4.2 + (rnd(i * 5) - 0.5) * 0.8); f.castShadow = true; scene.add(f); }
  box(2.2, 1.4, 0.06, mat(0xe9c46a), -2.6, 4.4, -4.88); box(1.9, 1.1, 0.07, mat(0x2a9d8f), -2.6, 4.4, -4.86);
  // unidade interna
  W3.iu = arredondado(3.4, 1.0, 0.75, 0.25, mat(0xf7f7f5, { roughness: 0.35 })); W3.iu.position.copy(IU); scene.add(W3.iu);
  W3.aleta = box(3.0, 0.08, 0.3, mat(0xe2e2df), IU.x, IU.y - 0.48, IU.z + 0.35); W3.led = box(0.12, 0.05, 0.02, new T3.MeshBasicMaterial({ color: 0x5ad1ff }), IU.x + 1.35, IU.y - 0.2, IU.z + 0.4);
  // unidade externa no quintal, numa base de concreto
  uvMundo(box(3.4, 0.25, 1.8, tmat('concreto', { relevo: 1 }), OU.x, 0.12, OU.z), 2);
  W3.ou = grupo(); W3.ou.position.set(OU.x, 0.25, OU.z);
  box(3.0, 2.2, 1.2, mat(0xe8e9e6, { roughness: 0.45, metalness: 0.2 }), 0, 1.1, 0, W3.ou);
  const grade = new T3.Mesh(new T3.RingGeometry(0.2, 0.85, 40, 3), new T3.MeshStandardMaterial({ color: 0x2a2d33, wireframe: true })); grade.position.set(-0.45, 1.1, 0.61); W3.ou.add(grade);
  const boca = new T3.Mesh(new T3.CircleGeometry(0.85, 40), mat(0x1a1c20)); boca.position.set(-0.45, 1.1, 0.605); W3.ou.add(boca);
  W3.heliceCasa = helice(3, 0.75, mat(0x3a3e46, { roughness: 0.5 })); W3.heliceCasa.rotation.x = Math.PI / 2; W3.heliceCasa.position.set(-0.45, 1.1, 0.58); W3.ou.add(W3.heliceCasa);
  for (let i = 0; i < 8; i++) box(0.9, 0.04, 0.02, mat(0x9aa0a8), 1.0, 0.4 + i * 0.2, 0.61, W3.ou);
  // os dois canos: saem da interna, correm pela parede, atravessam e descem ate a externa
  const caminho = dz => [new T3.Vector3(IU.x + 1.75, IU.y - 0.1 + dz, IU.z), new T3.Vector3(PAREDE_X - 0.3, IU.y - 0.1 + dz, IU.z), new T3.Vector3(PAREDE_X + 0.6, IU.y - 0.1 + dz, IU.z + 0.1),
    new T3.Vector3(PAREDE_X + 0.75, 3.0 + dz, IU.z + 0.2), new T3.Vector3(PAREDE_X + 0.8, 1.6 + dz, OU.z + 0.2), new T3.Vector3(OU.x - 1.55, 1.3 + dz, OU.z)];
  W3.canoQuente = new T3.CatmullRomCurve3(caminho(0.12)); W3.canoFrio = new T3.CatmullRomCurve3(caminho(-0.12));
  const isol = mat(0x2c2f35, { roughness: 0.8 });
  scene.add(new T3.Mesh(new T3.TubeGeometry(W3.canoQuente, 120, 0.09, 10), isol));
  W3.canoFrioMat = mat(0xb87333, { metalness: 0.6, roughness: 0.3 });
  scene.add(new T3.Mesh(new T3.TubeGeometry(W3.canoFrio, 120, 0.05, 10), W3.canoFrioMat));
  W3.fluxo = pontos(70, 0xffffff, 0.32); scene.add(W3.fluxo);
  W3.calorSala = pontos(80, 0xffffff, 0.45); scene.add(W3.calorSala);
  W3.ventoFora = pontos(70, 0xffffff, 0.6); scene.add(W3.ventoFora);
  W3.luzSala = new T3.PointLight(0xffd7a6, 10, 18, 1.3); W3.luzSala.position.set(0, 5.6, 0); scene.add(W3.luzSala);
  W3.frioSala = new T3.PointLight(0x7cc4ff, 0, 14, 1.3); W3.frioSala.position.set(IU.x, IU.y - 1.5, IU.z + 2); scene.add(W3.frioSala);

  // ================= unidade interna aberta =================
  const A = LOCAL.interna;
  uvMundo(box(40, 0.2, 30, tmat('madeira', { color: 0xb88c62, relevo: 1 }), A.x, 0.1, 10), 2.2);
  const paredeA = new T3.Mesh(new T3.PlaneGeometry(80, 40), mat(0xe9dcc6, { roughness: 0.95 })); paredeA.position.set(A.x, 10, -1.6); paredeA.receiveShadow = true; scene.add(paredeA);
  W3.casca = arredondado(7.2, 2.4, 1.8, 0.5, vidro(0xf2f6fa, 0.26)); W3.casca.position.set(A.x, 4.2, -0.6); scene.add(W3.casca); contorno(W3.casca.geometry, 0xffffff, 0.55, W3.casca);
  W3.coilI = serpentina(6.4, 1.6, 0.35, 0x3aa8ff, scene); W3.coilI.position.set(A.x, 4.55, -0.85); W3.coilI.rotation.x = -0.35;
  W3.ventI = grupo(); W3.ventI.position.set(A.x, 3.75, -0.35);
  for (let i = 0; i < 16; i++) { const p = box(6.2, 0.04, 0.22, mat(0x9aa4b0, { roughness: 0.5 }), 0, 0, 0, W3.ventI); const ang = i / 16 * Math.PI * 2; p.position.set(0, Math.cos(ang) * 0.32, Math.sin(ang) * 0.32); p.rotation.x = ang + 0.5; }
  W3.bandeja = box(6.6, 0.12, 0.6, mat(0x7d8792, { roughness: 0.6 }), A.x, 3.55, -0.95);
  W3.dreno = new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3([new T3.Vector3(A.x + 3.3, 3.5, -0.95), new T3.Vector3(A.x + 3.9, 3.2, -0.95), new T3.Vector3(A.x + 4.2, 1.6, -0.9), new T3.Vector3(A.x + 4.4, 0, -0.9)]), 40, 0.08, 10), mat(0xe9eef2, { roughness: 0.5 })); scene.add(W3.dreno);
  W3.arI = pontos(160, 0xffffff, 0.34); scene.add(W3.arI);
  W3.gotas = [...Array(26)].map(() => { const g = new T3.Mesh(new T3.SphereGeometry(0.11, 14, 10), new T3.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9 })); g.scale.y = 1.4; scene.add(g); return g; });
  W3.luzI = new T3.PointLight(0x7cc4ff, 0, 10, 1.3); W3.luzI.position.set(A.x, 3.2, 1.6); scene.add(W3.luzI);

  // ================= unidade externa aberta =================
  const B = LOCAL.externa;
  const gram = new T3.Mesh(new T3.CircleGeometry(16, 48), tmat('grama', { relevo: 1 })); gram.rotation.x = -Math.PI / 2; gram.position.set(B.x, 0, 0); gram.receiveShadow = true; uvMundo(gram, 3); scene.add(gram);
  uvMundo(box(7.6, 0.35, 4.2, tmat('concreto', { relevo: 1 }), B.x, 0.17, 0), 2);
  W3.cascaE = new T3.Mesh(new T3.BoxGeometry(7, 4.8, 3), vidro(0xe8ecf0, 0.14)); W3.cascaE.position.set(B.x, 2.75, 0); scene.add(W3.cascaE); contorno(W3.cascaE.geometry, 0xffffff, 0.6, W3.cascaE);
  W3.coilE = serpentina(6.4, 4.2, 0.4, 0xff6a2a, scene, 80); W3.coilE.position.set(B.x, 2.75, -1.2);
  W3.comp = grupo(); W3.comp.position.set(B.x + 2.2, 0.35, 0.3);
  W3.compMat = mat(0x23262c, { roughness: 0.35, metalness: 0.5 });
  cyl(0.6, 0.62, 1.4, W3.compMat, 28, W3.comp).position.y = 0.7;
  const dom = new T3.Mesh(new T3.SphereGeometry(0.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), W3.compMat); dom.position.y = 1.4; W3.comp.add(dom);
  W3.heliceE = helice(3, 1.6, mat(0x3a3e46, { roughness: 0.45 })); W3.heliceE.rotation.x = Math.PI / 2; W3.heliceE.position.set(B.x - 1.0, 2.75, 0.9); scene.add(W3.heliceE);
  W3.motor = cyl(0.35, 0.35, 0.5, mat(0x555a62), 20); W3.motor.rotation.x = Math.PI / 2; W3.motor.position.set(B.x - 1.0, 2.75, 0.5);
  W3.arE = pontos(140, 0xffffff, 0.7); scene.add(W3.arE);
  W3.luzComp = new T3.PointLight(0xff5a2a, 0, 6, 1.4); W3.luzComp.position.set(B.x + 2.2, 1.6, 1.2); scene.add(W3.luzComp);
}

function pintar(pts, i, cor) { pts.geometry.attributes.color.setXYZ(i, cor.r, cor.g, cor.b); }
function atualiza(t, ctx) {
  const et = ctx.p.etapa, k = ctx.lt, lugar = ETAPA_LOCAL[et], centro = LOCAL[lugar];
  sun.position.set(centro.x - 12, 18, centro.z + 12); sun.target.position.set(centro.x + 2, 1.5, 0);
  scene.background = new T3.Color(lugar === 'interna' ? 0xe8dcc8 : 0x9cc6ea);
  // ---- casa ----
  const ligado = et !== 'casa' || k > 0.4;
  W3.aleta.rotation.x = ligado ? 0.6 : 0; W3.led.material.color.set(ligado ? 0x5ad1ff : 0x333333);
  W3.heliceCasa.rotation.y = ligado ? t * 14 : 0;
  const esfriou = ['tubo', 'volta', 'final'].includes(et) ? 1 : et === 'calor' ? ease(k) * 0.6 : 0;
  W3.frioSala.intensity = 6 * esfriou;
  // fluxo nos canos: vermelho saindo (quente) e azul voltando (frio)
  const fl = W3.fluxo, nf = fl.geometry.attributes.position.count, mostraFluxo = ['calor', 'tubo', 'volta'].includes(et);
  fl.visible = mostraFluxo;
  for (let i = 0; i < nf; i++) {
    const vai = i % 2 === 0, u = ((i / nf) + t * 0.18) % 1, p = (vai ? W3.canoQuente : W3.canoFrio).getPointAt(vai ? u : 1 - u);
    fl.geometry.attributes.position.setXYZ(i, p.x, p.y, p.z);
    pintar(fl, i, vai ? QUENTE : (et === 'volta' ? FRIO : FRIO.clone().multiplyScalar(0.7)));
  }
  fl.geometry.attributes.position.needsUpdate = fl.geometry.attributes.color.needsUpdate = true;
  // calor da sala: particulas vermelhas que sao puxadas para a unidade interna
  const cs = W3.calorSala, nc = cs.geometry.attributes.position.count, puxa = et === 'calor' ? ease(k * 1.5) : 0;
  cs.visible = et === 'casa' || et === 'calor';
  for (let i = 0; i < nc; i++) {
    const bx = (rnd(i) - 0.5) * 10.5, by = 0.8 + rnd(i * 3) * 4.6, bz = -4 + rnd(i * 7) * 8, vida = (t * 0.5 + rnd(i * 11)) % 1;
    const ox = bx + Math.sin(t * 0.8 + i) * 0.3, oy = by + Math.sin(t * 0.6 + i * 2) * 0.2;
    const f = puxa * ease(vida);
    cs.geometry.attributes.position.setXYZ(i, lerp(ox, IU.x + (rnd(i * 5) - 0.5) * 3, f), lerp(oy, IU.y + 0.4, f), lerp(bz, IU.z, f));
    pintar(cs, i, QUENTE.clone().multiplyScalar(0.55 + 0.45 * Math.sin(t * 3 + i)));
  }
  cs.geometry.attributes.position.needsUpdate = cs.geometry.attributes.color.needsUpdate = true;
  // vento quente saindo da externa no quintal
  const vf = W3.ventoFora, nv = vf.geometry.attributes.position.count; vf.visible = ['calor', 'tubo', 'volta', 'final'].includes(et);
  for (let i = 0; i < nv; i++) {
    const vida = (t * 0.6 + rnd(i * 9)) % 1, a = rnd(i) * Math.PI * 2, r = rnd(i * 2) * 0.7;
    vf.geometry.attributes.position.setXYZ(i, OU.x - 0.45 + Math.cos(a) * r * (1 + vida), 1.35 + Math.sin(a) * r * (1 + vida) + vida * 0.8, OU.z + 0.7 + vida * 4.5);
    pintar(vf, i, QUENTE.clone().multiplyScalar(0.7 * Math.sin(vida * Math.PI)));
  }
  vf.geometry.attributes.position.needsUpdate = vf.geometry.attributes.color.needsUpdate = true;
  // ---- unidade interna ----
  const A = LOCAL.interna;
  W3.ventI.rotation.x = -t * 9;
  const ar = W3.arI, na = ar.geometry.attributes.position.count, interna = lugar === 'interna';
  ar.visible = interna && et !== 'pinga';
  for (let i = 0; i < na; i++) {
    const vida = (t * 0.42 + rnd(i * 13)) % 1, xx = A.x + (rnd(i) - 0.5) * 6.4;
    // entra por cima (quente), atravessa a serpentina, desce pelo ventilador e sai pela frente (frio)
    let p;
    if (vida < 0.35) { const f = vida / 0.35; p = [xx, lerp(6.4, 4.9, f), lerp(-0.4, -0.85, f)]; }
    else if (vida < 0.6) { const f = (vida - 0.35) / 0.25; p = [xx, lerp(4.9, 3.75, f), lerp(-0.85, -0.35, f)]; }
    else { const f = (vida - 0.6) / 0.4; p = [xx, lerp(3.75, 2.2, f), lerp(-0.35, 3.0, f)]; }
    ar.geometry.attributes.position.setXYZ(i, ...p);
    const frio = clamp((vida - 0.32) * 5);
    pintar(ar, i, QUENTE.clone().lerp(FRIO, et === 'interna' ? frio * clamp(k * 3) : frio).multiplyScalar(et === 'pinga' ? 0.45 : 1));
  }
  ar.geometry.attributes.position.needsUpdate = ar.geometry.attributes.color.needsUpdate = true;
  W3.luzI.intensity = et === 'sopra' ? 8 : interna ? 4 : 0;
  W3.coilI.userData.tuboMat.emissiveIntensity = 0.3 + 0.25 * Math.sin(t * 5);
  W3.gotas.forEach((g, i) => {
    g.visible = et === 'pinga';
    const vida = (t * 0.55 + rnd(i * 7)) % 1, xx = A.x + (rnd(i) - 0.5) * 6;
    // a gota se forma na aleta (cresce), escorre e cai na bandeja
    const forma = clamp(vida / 0.4), cai = clamp((vida - 0.4) / 0.6);
    g.position.set(xx, lerp(4.0, 3.62, cai * cai), -0.9 + rnd(i * 3) * 0.12);
    g.scale.set(0.4 + forma * 0.6, (0.4 + forma * 0.6) * 1.4, 0.4 + forma * 0.6);
  });
  // ---- unidade externa ----
  W3.heliceE.rotation.y = t * (et === 'externa' ? 16 : 10);
  W3.comp.position.x = LOCAL.externa.x + 2.2 + (et === 'compressor' ? Math.sin(t * 70) * 0.012 : 0);
  W3.compMat.emissive = new T3.Color(et === 'compressor' ? 0x5a1206 : 0x1a0402);
  W3.luzComp.intensity = et === 'compressor' ? 6 + 3 * Math.sin(t * 4) : 2;
  W3.coilE.userData.tuboMat.emissiveIntensity = et === 'compressor' || et === 'externa' ? 0.5 + 0.3 * Math.sin(t * 5) : 0.25;
  const ae = W3.arE, ne = ae.geometry.attributes.position.count; ae.visible = lugar === 'externa';
  for (let i = 0; i < ne; i++) {
    const vida = (t * (et === 'externa' ? 0.7 : 0.35) + rnd(i * 5)) % 1, a = rnd(i * 3) * Math.PI * 2, r = 0.3 + rnd(i * 2) * 1.5;
    ae.geometry.attributes.position.setXYZ(i, LOCAL.externa.x - 1.0 + Math.cos(a + vida) * r * (1 + vida * 0.8), 2.75 + Math.sin(a + vida) * r * (1 + vida * 0.6) + vida, -1.0 + vida * 8);
    pintar(ae, i, QUENTE.clone().multiplyScalar(0.8 * Math.sin(vida * Math.PI)));
  }
  ae.geometry.attributes.position.needsUpdate = ae.geometry.attributes.color.needsUpdate = true;
}

const CAM = {
  casa: { x: 4.0, y: 2.6, d: 26, h: 8.5, a: 0.22 }, calor: { x: 4.2, y: 2.6, d: 26, h: 9.5, a: 0.3 },
  interna: { x: 0, y: 4.0, d: 15, h: 1.2, a: 0.18 }, sopra: { x: 0, y: 3.4, d: 13, h: -0.6, a: -0.22 }, pinga: { x: 1.2, y: 3.9, d: 5.6, h: 0.3, a: 0.35 },
  tubo: { x: 6.3, y: 2.8, d: 13, h: 3.0, a: 0.75 }, compressor: { x: 1.4, y: 1.6, d: 9.0, h: 2.2, a: 0.55 }, externa: { x: -0.5, y: 2.6, d: 14, h: 1.0, a: -0.15 },
  volta: { x: 4.2, y: 2.6, d: 25, h: 8.5, a: 0.36 }, final: { x: 4.0, y: 2.6, d: 25, h: 8, a: 0.16 },
};
function camera(t, ctx) {
  const cfg = j => { const e = (ST.cenas[j].p || {}).etapa; return { ...CAM[e], c: LOCAL[ETAPA_LOCAL[e]] }; };
  const cur = cfg(ctx.i), prev = cfg(Math.max(0, ctx.i - 1)), corte = prev.c !== cur.c;
  const k = corte ? 1 : ease((t - ctx.t0) / 1.4), L = (a, b) => lerp(a, b, k);
  const d = L(prev.d, cur.d) * (1 - 0.06 * ctx.lt), a = L(prev.a, cur.a) + ctx.lt * 0.06, h = L(prev.h, cur.h), y = L(prev.y, cur.y), ox = L(prev.x, cur.x);
  const zoom = corte ? 1 + 0.6 * Math.max(0, 1 - (t - ctx.t0) / 0.35) : 1;
  const cx = cur.c.x + ox;
  cam.position.set(cx + Math.sin(a) * d * zoom, y + h * zoom, cur.c.z + Math.cos(a) * d * zoom);
  cam.lookAt(cx, y, cur.c.z); cam.updateMatrixWorld();
  W3.flash = corte && ctx.i > 0 ? Math.max(0, 1 - (t - ctx.t0) / 0.3) : 0;
}
function overlay(t, ctx) {
  if (W3.flash > 0) { x.fillStyle = `rgba(255,255,255,${0.7 * W3.flash})`; x.fillRect(0, 0, W, H); }
  const et = ctx.p.etapa, s = back((t - ctx.t0) * 3), s2 = back((t - ctx.t0) * 3 - 0.6), branco = 'rgba(255,255,255,0.92)';
  if (et === 'casa') { const e = E.since(t, 'erro'); if (e >= 0) pill(W / 2, 300, 'Cold air from outside?  ✗', COL.red, '#fff', 42, back(e * 3)); }
  if (et === 'calor') pill(W / 2, 300, 'Heat goes OUT', COL.red, '#fff', 46, s);
  if (et === 'interna') { pill(W / 2, 300, 'Freezing coil', '#3aa8ff', '#fff', 44, s); }
  if (et === 'sopra') pill(W / 2, 300, 'Cool air back in', '#3aa8ff', '#fff', 44, s);
  if (et === 'pinga') pill(W / 2, 300, 'Condensation', branco, COL.ink, 44, s);
  if (et === 'tubo') pill(W / 2, 300, 'Refrigerant pipes', branco, COL.ink, 44, s);
  if (et === 'compressor') { const B = LOCAL.externa, [px, py] = proj(B.x + 2.2, 2.3, 0.3); pill(px, py - 70, 'Compressor', branco, COL.ink, 40, s); pill(W / 2, 300, 'Hotter than summer', COL.red, '#fff', 42, s2); }
  if (et === 'externa') pill(W / 2, 300, 'Heat blown away', COL.red, '#fff', 44, s);
  if (et === 'volta') pill(W / 2, 300, 'Same trick as your fridge', COL.yellow, COL.ink, 40, s);
}
MUNDO = { monta, atualiza, camera, overlay };
})();
