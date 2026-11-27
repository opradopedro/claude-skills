/* Rabiscos à mão: círculos, setas, sublinhados e notas que parecem feitos de caneta.
 *
 * Uso:
 *   Rabiscos.desenhar(elemento, [ ...marcas ], { semente: 7 })
 *
 * O elemento recebe uma camada <svg class="rabiscos"> por cima do conteúdo.
 * Se o elemento tiver uma <img>, as coordenadas x/y/w/h das marcas são em pixels
 * da imagem original (do jeito que o OCR ou um editor de imagem mostram), e o
 * script converte para o tamanho exibido. Sem imagem, as coordenadas são em px CSS.
 * Espessura e tamanho de letra são sempre em px CSS (o que você vê na tela).
 *
 * Alvo de uma marca (onde ela fica):
 *   { x, y, w, h }          retângulo (em px da imagem ou CSS, ver acima)
 *   { seletor: "#id" }      um elemento dentro do container (funciona mesmo com rotate)
 *   [x, y]                  um ponto (só para setas e notas)
 *
 * Marcas:
 *   { tipo: "circulo",     alvo, folga?: 14 }
 *   { tipo: "sublinhado",  alvo }
 *   { tipo: "seta",        de, para, curva?: 0.5, ponta?: true }   de/para = ponto ou alvo
 *   { tipo: "nota",        texto, em, tamanho?: 42, rotacao?: -3, alinhar?: "start" }
 *   { tipo: "visto",       alvo }          (✓ feito à mão)
 *   { tipo: "xis",         alvo }
 *   { tipo: "riscado",     alvo }          (risco por cima, como quem corrige)
 *   { tipo: "marcatexto",  alvo }          (marca-texto amarelo atrás do texto)
 * Opções comuns a todas: cor ("azul" | "vermelho" | "preto" | "verde" | "#hex"),
 *   espessura (px), passadas (1 ou 2: 2 parece caneta passada duas vezes), semente.
 */
(function (global) {
  "use strict";

  var CORES = {
    azul: "#2340B5", // caneta esferográfica azul
    vermelho: "#C4122F", // caneta vermelha de correção
    preto: "#1E201C",
    verde: "#1F7A3A",
    amarelo: "#FFD400", // marca-texto
  };
  var NS = "http://www.w3.org/2000/svg";

  // ---------- aleatório com semente (o mesmo desenho sempre sai igual) ----------
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ---------- curva suave passando pelos pontos (Catmull-Rom para Bézier) ----------
  function suave(pts) {
    if (pts.length < 2) return "";
    var d = "M" + f(pts[0][0]) + " " + f(pts[0][1]);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += " C" + f(c1x) + " " + f(c1y) + " " + f(c2x) + " " + f(c2y) + " " + f(p2[0]) + " " + f(p2[1]);
    }
    return d;
  }
  function f(n) { return (Math.round(n * 10) / 10).toString(); }

  // Ruído de baixa frequência: a mão treme devagar, não em zigue-zague.
  function tremor(r, amp) {
    var a = [r() * 6.28, r() * 6.28, r() * 6.28], k = [1 + r(), 2 + r() * 2, 3 + r() * 3];
    return function (t) {
      return amp * (0.6 * Math.sin(k[0] * t * 6.28 + a[0]) + 0.3 * Math.sin(k[1] * t * 6.28 + a[1]) + 0.1 * Math.sin(k[2] * t * 6.28 + a[2]));
    };
  }

  // ---------- formas ----------
  // Círculo à mão: começa fora do lugar, dá a volta e passa um pouco do ponto inicial.
  function circulo(cx, cy, rx, ry, r) {
    var a0 = -2.3 + r() * 0.7, volta = Math.PI * 2 + 0.35 + r() * 0.35, n = 28;
    var tr = tremor(r, 0.06), inclina = (r() - 0.5) * 0.12, pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, a = a0 + volta * t;
      var k = 1 + tr(t) + (t > 0.85 ? (t - 0.85) * 0.5 : 0); // espirala um pouco no fim
      var x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      pts.push([cx + x * Math.cos(inclina) - y * Math.sin(inclina), cy + x * Math.sin(inclina) + y * Math.cos(inclina)]);
    }
    return suave(pts);
  }

  function ondulado(x1, y, x2, r, amp) {
    var n = Math.max(4, Math.round((x2 - x1) / 28)), tr = tremor(r, amp), pts = [], sobe = (r() - 0.5) * 6;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      pts.push([x1 + (x2 - x1) * t, y + tr(t) + sobe * t]);
    }
    return suave(pts);
  }

  function seta(x1, y1, x2, y2, curva, ponta, r) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    var mx = (x1 + x2) / 2 - dy * curva * 0.35, my = (y1 + y2) / 2 + dx * curva * 0.35;
    var pts = [], n = 10, tr = tremor(r, Math.min(3, len * 0.012));
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      var x = u * u * x1 + 2 * u * t * mx + t * t * x2, y = u * u * y1 + 2 * u * t * my + t * t * y2;
      var nx = -dy / len, ny = dx / len, w = tr(t) * Math.sin(Math.PI * t);
      pts.push([x + nx * w, y + ny * w]);
    }
    var d = suave(pts);
    if (ponta) {
      var ang = Math.atan2(y2 - pts[n - 2][1], x2 - pts[n - 2][0]);
      var L = Math.max(12, Math.min(24, len * 0.18)), a1 = 0.42 + r() * 0.1, a2 = 0.5 + r() * 0.12;
      d += " M" + f(x2 - L * Math.cos(ang - a1)) + " " + f(y2 - L * Math.sin(ang - a1)) + " L" + f(x2) + " " + f(y2);
      d += " L" + f(x2 - L * 0.85 * Math.cos(ang + a2)) + " " + f(y2 - L * 0.85 * Math.sin(ang + a2));
    }
    return d;
  }

  function visto(b, r) {
    var s = Math.min(b.w, b.h) || 30, x = b.x + b.w / 2 - s / 2, y = b.y + b.h / 2;
    return suave([[x, y], [x + s * 0.22, y + s * (0.28 + r() * 0.06)], [x + s * 0.35, y + s * 0.38], [x + s * 0.62, y - s * 0.12], [x + s * (1 + r() * 0.1), y - s * 0.55]]);
  }

  function xis(b, r) {
    var j = function () { return (r() - 0.5) * 0.12 * b.w; };
    return suave([[b.x + j(), b.y + j()], [b.x + b.w / 2, b.y + b.h / 2 + j()], [b.x + b.w + j(), b.y + b.h + j()]]) + " " +
      suave([[b.x + b.w + j(), b.y + j()], [b.x + b.w / 2 + j(), b.y + b.h / 2], [b.x + j(), b.y + b.h + j()]]);
  }

  // ---------- posição dos alvos ----------
  function posicaoRelativa(el, container) {
    var x = 0, y = 0, e = el;
    while (e && e !== container) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    if (e !== container) { // container não é offsetParent: cai para getBoundingClientRect
      var a = el.getBoundingClientRect(), c = container.getBoundingClientRect();
      return { x: a.left - c.left, y: a.top - c.top, w: a.width, h: a.height };
    }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }

  function caixa(alvo, ctx) {
    if (!alvo) return null;
    if (Array.isArray(alvo)) return { x: alvo[0] * ctx.s, y: alvo[1] * ctx.s, w: 0, h: 0, ponto: true };
    if (alvo.seletor) {
      var el = ctx.container.querySelector(alvo.seletor);
      if (!el) { console.warn("Rabiscos: não achei", alvo.seletor); return null; }
      return posicaoRelativa(el, ctx.container);
    }
    return { x: alvo.x * ctx.s, y: alvo.y * ctx.s, w: (alvo.w || 0) * ctx.s, h: (alvo.h || 0) * ctx.s };
  }

  // Ponto de ancoragem de um alvo para setas: o ponto da borda mais próximo do outro lado.
  function ancora(b, outro) {
    if (b.ponto || (!b.w && !b.h)) return [b.x, b.y];
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = outro[0] - cx, dy = outro[1] - cy;
    var sx = b.w / 2 / Math.abs(dx || 1e-6), sy = b.h / 2 / Math.abs(dy || 1e-6), s = Math.min(sx, sy) * 1.15;
    return [cx + dx * s, cy + dy * s];
  }
  function centro(b) { return [b.x + (b.w || 0) / 2, b.y + (b.h || 0) / 2]; }

  // ---------- desenho ----------
  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function traco(svg, d, m, cor, r) {
    var esp = m.espessura || 3.4, passadas = m.passadas || 1;
    for (var p = 0; p < passadas; p++) {
      var g = el("path", {
        d: d, fill: "none", stroke: cor, "stroke-width": p ? esp * 0.75 : esp,
        "stroke-linecap": "round", "stroke-linejoin": "round", opacity: p ? 0.55 : 0.92,
      });
      if (p) g.setAttribute("transform", "translate(" + f((r() - 0.5) * 2.4) + " " + f((r() - 0.5) * 2.4) + ")");
      svg.appendChild(g);
    }
  }

  function desenhar(container, marcas, opcoes) {
    opcoes = opcoes || {};
    if (getComputedStyle(container).position === "static") container.style.position = "relative";
    var img = container.querySelector("img");
    var s = opcoes.escala || (img && img.naturalWidth ? container.offsetWidth / img.naturalWidth : 1);
    var ctx = { container: container, s: s };
    var antigo = container.querySelector(":scope > svg.rabiscos");
    if (antigo) antigo.remove();
    var svg = el("svg", { class: "rabiscos", width: container.offsetWidth, height: container.offsetHeight });

    marcas.forEach(function (m, i) {
      var cor = CORES[m.cor] || m.cor || CORES.azul;
      var r = rng((m.semente || opcoes.semente || 7) * 7919 + i * 104729);
      var b, d;
      switch (m.tipo) {
        case "circulo":
          b = caixa(m.alvo, ctx); if (!b) return;
          var folga = m.folga == null ? 14 : m.folga;
          d = circulo(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 + folga * 1.5, b.h / 2 + folga, r);
          traco(svg, d, m, cor, r); break;
        case "sublinhado":
          b = caixa(m.alvo, ctx); if (!b) return;
          d = ondulado(b.x - 4, b.y + b.h + 5, b.x + b.w + 6, r, m.amplitude || 2.6);
          traco(svg, d, m, cor, r); break;
        case "riscado":
          b = caixa(m.alvo, ctx); if (!b) return;
          d = ondulado(b.x - 6, b.y + b.h * 0.55, b.x + b.w + 6, r, 1.6);
          traco(svg, d, m, cor, r); break;
        case "visto":
          b = caixa(m.alvo, ctx); if (!b) return;
          traco(svg, visto(b, r), m, cor, r); break;
        case "xis":
          b = caixa(m.alvo, ctx); if (!b) return;
          traco(svg, xis(b, r), m, cor, r); break;
        case "marcatexto":
          b = caixa(m.alvo, ctx); if (!b) return;
          var hl = el("path", {
            d: ondulado(b.x - 6, b.y + b.h * 0.55, b.x + b.w + 8, r, 1.2), fill: "none",
            stroke: CORES[m.cor] || m.cor || CORES.amarelo, "stroke-width": m.espessura || b.h * 0.85,
            "stroke-linecap": "butt", opacity: 0.5, style: "mix-blend-mode:multiply",
          });
          svg.insertBefore(hl, svg.firstChild); break;
        case "seta":
          var A = caixa(m.de, ctx), Z = caixa(m.para, ctx); if (!A || !Z) return;
          var pa = ancora(A, centro(Z)), pz = ancora(Z, centro(A));
          d = seta(pa[0], pa[1], pz[0], pz[1], m.curva == null ? 0.5 : m.curva, m.ponta !== false, r);
          traco(svg, d, m, cor, r); break;
        case "nota":
          b = caixa(m.em, ctx); if (!b) return;
          var x = b.x + (m.dx || 0), y = b.y + (m.dy || 0), tam = m.tamanho || 42, rot = m.rotacao == null ? -3 : m.rotacao;
          var t = el("text", {
            class: "nota", x: f(x), y: f(y), fill: cor, "font-size": tam, "text-anchor": m.alinhar || "start",
            transform: "rotate(" + rot + " " + f(x) + " " + f(y) + ")",
          });
          String(m.texto).split("\n").forEach(function (linha, j) {
            var ts = el("tspan", { x: f(x + j * (r() - 0.5) * 6), dy: j ? f(tam * 0.98) : "0" });
            ts.textContent = linha; t.appendChild(ts);
          });
          svg.appendChild(t); break;
        default:
          console.warn("Rabiscos: tipo desconhecido", m.tipo);
      }
    });
    container.appendChild(svg);
    return svg;
  }

  // Desenha em todos os elementos com data-rabiscos='[...]' (JSON) depois das fontes carregarem.
  function desenharTodos(raiz) {
    var alvos = (raiz || document).querySelectorAll("[data-rabiscos]");
    var pronto = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var imgs = Array.prototype.map.call((raiz || document).querySelectorAll("img"), function (im) {
      return im.complete ? Promise.resolve() : new Promise(function (ok) { im.onload = im.onerror = ok; });
    });
    return Promise.all([pronto].concat(imgs)).then(function () {
      alvos.forEach(function (e) { desenhar(e, JSON.parse(e.getAttribute("data-rabiscos"))); });
    });
  }

  global.Rabiscos = { desenhar: desenhar, desenharTodos: desenharTodos, cores: CORES };
})(typeof window !== "undefined" ? window : this);
