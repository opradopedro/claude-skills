#!/usr/bin/env python3
"""Identidade visual do canal: foto de perfil (800x800) e banner (2560x1440), no mesmo traco dos videos.

Uso: python3 marca.py pasta_saida   (precisa de pillow)
A API do YouTube nao troca a foto de perfil: o Pedro sobe os dois arquivos no YouTube Studio
(Personalizacao > Branding). Area segura do banner (aparece em todo aparelho): 1546x423 no centro.
"""
import base64, os, sys
from playwright.sync_api import sync_playwright

ENGINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "engine.html")

FUNDO = """(W, H, cx, cy, r) => {
  window.relogio = (cx, cy, tam) => {
    x.save(); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `700 ${tam}px "DejaVu Sans Mono", monospace`;
    x.fillStyle = 'rgba(255,40,40,0.07)'; x.fillText('8:88', cx, cy);
    x.shadowColor = 'rgba(255,30,30,0.9)'; x.shadowBlur = tam * 0.18; x.fillStyle = '#ff2a2a';
    x.fillText('3:33', cx, cy); x.shadowBlur = tam * 0.5; x.fillText('3:33', cx, cy);
    x.restore();
  };
  c.width = W; c.height = H;
  x.fillStyle = '#050405'; x.fillRect(0, 0, W, H);
  const v = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  v.addColorStop(0, 'rgba(120,20,22,0.55)'); v.addColorStop(0.45, 'rgba(40,8,10,0.35)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 900; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
}"""

PERFIL = FUNDO.replace("(W, H, cx, cy, r) => {", "() => { const W = 800, H = 800, cx = 400, cy = 420, r = 430;") \
    .rstrip("}") + """
  // a "hora muerta": 3:33 em relogio digital vermelho, legivel ate no icone pequeno
  relogio(400, 390, 250);
  x.font = '800 64px "DejaVu Sans", sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(236,230,234,0.9)';
  x.fillText('HORA MUERTA', 400, 575);
  return c.toDataURL('image/png').split(',')[1];
}"""

BANNER = FUNDO.replace("(W, H, cx, cy, r) => {", "() => { const W = 2560, H = 1440, cx = 1280, cy = 720, r = 1100;") \
    .rstrip("}") + """
  relogio(620, 770, 190);
  x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  x.font = '900 150px "DejaVu Sans", sans-serif';
  x.lineWidth = 22; x.lineJoin = 'round'; x.strokeStyle = '#000';
  x.strokeText('HORA', 960, 700); x.fillStyle = '#f2ece6'; x.fillText('HORA', 960, 700);
  x.strokeText('MUERTA', 960, 850); x.fillStyle = '#e0262b'; x.fillText('MUERTA', 960, 850);
  x.font = '600 46px "DejaVu Sans", sans-serif'; x.fillStyle = 'rgba(236,230,234,0.85)';
  x.fillText('Historias de terror · Nueva historia cada día', 966, 920);
  return c.toDataURL('image/png').split(',')[1];
}"""


def main(saida):
    os.makedirs(saida, exist_ok=True)
    with sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception:  # playwright do pip mais novo que o Chromium da maquina: usa o instalado
            b = p.chromium.launch(executable_path=os.environ.get("HM_CHROMIUM", "/opt/pw-browsers/chromium"))
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        pg.goto("file://" + ENGINE)
        for nome, js in (("perfil.png", PERFIL), ("banner.png", BANNER)):
            dados = base64.b64decode(pg.evaluate(js))
            # o canvas do motor tem transparencia: achata em fundo preto
            from PIL import Image
            import io
            im = Image.open(io.BytesIO(dados)).convert("RGBA")
            fundo = Image.new("RGBA", im.size, (5, 4, 5, 255)); fundo.alpha_composite(im)
            fundo.convert("RGB").save(os.path.join(saida, nome))
            print("ok", os.path.join(saida, nome))
        b.close()


if __name__ == "__main__":
    main(sys.argv[1])
