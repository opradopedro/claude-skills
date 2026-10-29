#!/usr/bin/env python3
"""Miniatura do Short: o quadro do gancho (o susto) + 2 a 4 palavras grandes + selo da parte.

Uso: python3 capa.py historia.json tempos.json capa.jpg
Texto = campo "capa" do roteiro (ex. "TARDÓ UN SEGUNDO"); sem ele, o titulo ate o emoji.
1080x1920 JPG (< 2 MB, limite do YouTube). O yt_upload.py envia com thumbnails.set.
"""
import base64, json, os, re, sys
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import carregar, resolver

ENGINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "engine.html")

DESENHA = """([t, texto, selo]) => {
  window.__semLegenda = true;  // a capa nunca leva a legenda do video por baixo do titulo
  render(t);
  const calmo = typeof CALMO === 'function' && CALMO();
  const cor1 = calmo ? '#f2c66d' : '#e0262b', fonte = calmo ? 'Georgia, "Times New Roman", serif' : '"DejaVu Sans", Impact, sans-serif';
  const c = document.getElementById('c'), g = c.getContext('2d'), W = c.width, H = c.height;
  const sombra = g.createLinearGradient(0, H * 0.55, 0, H);
  sombra.addColorStop(0, 'rgba(0,0,0,0)'); sombra.addColorStop(1, 'rgba(0,0,0,0.92)');
  g.fillStyle = sombra; g.fillRect(0, H * 0.55, W, H * 0.45);
  // quebra em linhas que cabem em 90% da largura
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  let tam = 170, linhas;
  do {
    g.font = `900 ${tam}px ${fonte}`;
    linhas = []; let atual = '';
    for (const p of texto.split(' ')) {
      const teste = atual ? atual + ' ' + p : p;
      if (g.measureText(teste).width > W * 0.9 && atual) { linhas.push(atual); atual = p; } else atual = teste;
    }
    linhas.push(atual); tam -= 10;
  } while ((linhas.length > 3 || linhas.some(l => g.measureText(l).width > W * 0.92)) && tam > 80);
  const alt = tam * 1.12, y0 = H * 0.80 - (linhas.length - 1) * alt / 2;
  linhas.forEach((l, i) => {
    const y = y0 + i * alt;
    g.lineJoin = 'round'; g.lineWidth = tam * 0.16; g.strokeStyle = '#000'; g.strokeText(l, W / 2, y);
    g.fillStyle = i === linhas.length - 1 ? cor1 : '#f2ece6'; g.fillText(l, W / 2, y);
  });
  if (selo) {
    g.font = `800 64px ${fonte}`;
    const w = g.measureText(selo).width + 60;
    g.fillStyle = calmo ? '#7a5520' : '#e0262b'; g.fillRect((W - w) / 2, 150, w, 96);
    g.fillStyle = '#fff'; g.fillText(selo, W / 2, 222);
  }
  return c.toDataURL('image/jpeg', 0.88).split(',')[1];
}"""


def texto_capa(h):
    if h.get("capa"):
        return h["capa"].upper()
    t = re.split(r"[^\w\s¿?¡!.,áéíóúñüÁÉÍÓÚÑÜ]", h["titulo"])[0]
    return " ".join(t.upper().split()[:5])


def main(historia, tempos, saida):
    h = carregar(historia)
    estado = resolver(h, json.load(open(tempos)))
    t = 0.3 if estado.get("gancho") else 2.0
    selo = f"{os.environ.get('CAPA_SELO', 'PARTE')} {h['parte']}" if h.get("partes", 1) > 1 else ""
    with sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception:  # playwright do pip mais novo que o Chromium da maquina: usa o instalado
            b = p.chromium.launch(executable_path=os.environ.get("HM_CHROMIUM", "/opt/pw-browsers/chromium"))
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        pg.goto("file://" + ENGINE)
        pg.evaluate("h => setup(h)", estado)
        open(saida, "wb").write(base64.b64decode(pg.evaluate(DESENHA, [t, texto_capa(h), selo])))
        b.close()
    print("ok", saida)


if __name__ == "__main__":
    main(*sys.argv[1:4])
