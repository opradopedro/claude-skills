#!/usr/bin/env python3
"""Capa (thumbnail) dos Reels e Shorts, sem custo.

1. Escolhe o quadro mais nitido do video (entre 15% e 60% da duracao) e escreve o texto da capa
   grande no meio, por cima da faixa da legenda (y 760 a 1260, dentro do recorte 3:4 da grade do perfil).
2. Salva capas/<video>.jpg (1080x1920, < 2 MB: serve para o thumbnails.set do YouTube).
3. Com --embutir, grava a capa nos 3 primeiros quadros do mp4 (0,1 s). O Instagram usa o quadro 0 como
   capa quando a publicacao nao manda cover_url/thumb_offset (caso do vidiq_instagram_publish_reel).

Texto: o campo "capa" do item no agenda.json (2 a 5 palavras); sem ele, a primeira linha da legenda.
Quadro: "capa_t" do item (segundo com rosto ou cena forte); sem ele, o mais nitido.
Uso: python3 pipeline/capa.py radar_vXX.mp4 [--texto "TEXTO DA CAPA"] [--t SEGUNDO] [--embutir]
"""
import argparse, json, os, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTE = os.path.join(RAIZ, "assets/fonts/Anton.ttf")
W, H, CX = 1080, 1920, 540
YELLOW, WHITE = (255, 221, 0), (255, 255, 255)
SAIDA_VIDEO = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-maxrate", "14M", "-bufsize", "28M",
               "-profile:v", "high", "-level", "4.2", "-pix_fmt", "yuv420p", "-r", "30"]


def duracao(mp4):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4],
                                capture_output=True, text=True, check=True).stdout)


def quadro(mp4, t):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", mp4, "-frames:v", "1", "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-"], capture_output=True, check=True).stdout
    return Image.frombytes("RGB", (W, H), raw)


def nitidez(img):
    # variancia do laplaciano so na parte de cima (y 170 a 760), que fica a vista acima do texto;
    # a faixa da legenda queimada tem muita borda e engana, e o chao (grama, asfalto) tambem
    g = np.asarray(img.convert("L").resize((270, 480)), dtype=np.float32)[42:190]
    lap = g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return float(lap.var()) * (0.4 + min(g.mean(), 110) / 110)  # quadro escuro perde ponto


def melhor_quadro(mp4, t=None):
    if t is not None:
        return quadro(mp4, t)
    d = duracao(mp4)
    cands = [quadro(mp4, d * (0.15 + 0.45 * i / 9)) for i in range(10)]
    return max(cands, key=nitidez)


def item(arquivo):
    try:
        posts = json.load(open(os.path.join(RAIZ, "agenda.json"), encoding="utf-8"))["posts"]
    except OSError:
        posts = []
    return next((x for x in posts if x.get("arquivo") == arquivo), {})


def texto_padrao(arquivo):
    p = item(arquivo)
    if p.get("capa"):
        return p["capa"]
    t = (p.get("legenda") or os.path.splitext(arquivo)[0].split("_", 2)[-1].replace("_", " ")).split("\n")[0]
    t = re.sub(r"[^\w\s$%,.!?'-]", "", t).strip()
    t = re.sub(r"^(GTA 6|GTA VI)[:,]?\s*", "", t, flags=re.I)
    return " ".join(t.split()[:7])


def quebrar(d, texto, tam):
    f = ImageFont.truetype(FONTE, tam)
    linhas, cur = [], ""
    for w in texto.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= 960:
            cur = t
        else:
            linhas.append(cur); cur = w
    linhas.append(cur)
    if len(linhas) > 3 and tam > 90:
        return quebrar(d, texto, tam - 10)
    return linhas, f


def montar_capa(fundo, texto):
    img = fundo.filter(ImageFilter.UnsharpMask(2, 60, 2)).convert("RGBA")
    # a faixa da legenda queimada (y 880 a 1240) vira borrao forte, e por cima uma sombra com degrade
    borrado = img.filter(ImageFilter.GaussianBlur(40))
    m = np.clip(1.6 - np.abs(np.arange(H) - 1060) / 150, 0, 1)[:, None] * 255  # borda suave, sem retangulo
    img.paste(borrado, (0, 0), Image.fromarray(np.repeat(m, W, axis=1).astype(np.uint8), "L"))
    a = np.zeros((H, 1), dtype=np.float32)
    y = np.arange(H)
    a[:, 0] = np.clip(1.25 - np.abs(y - 1060) / 380, 0, 1) ** 0.6 * 225
    sombra = Image.fromarray(np.repeat(a, W, axis=1).astype(np.uint8), "L")
    img.paste(Image.new("RGBA", (W, H), (0, 0, 0, 255)), (0, 0), sombra)
    d = ImageDraw.Draw(img)
    # selo no topo
    sf = ImageFont.truetype(FONTE, 64)
    selo = "GTA 6"
    sw = d.textlength(selo, font=sf)
    d.rounded_rectangle((CX - sw / 2 - 28, 640, CX + sw / 2 + 28, 740), 18, fill=YELLOW)
    d.text((CX - sw / 2, 648), selo, font=sf, fill=(0, 0, 0))
    linhas, f = quebrar(d, texto.upper(), 175)
    alt = f.size + 14
    y0 = 1080 - len(linhas) * alt // 2
    for i, ln in enumerate(linhas):
        cor = YELLOW if i == len(linhas) - 1 and len(linhas) > 1 else WHITE
        d.text((CX - d.textlength(ln, font=f) / 2, y0 + i * alt), ln, font=f, fill=cor,
               stroke_width=10, stroke_fill="black")
    return img.convert("RGB")


def embutir(mp4, capa_jpg):
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False, dir=os.path.dirname(os.path.abspath(mp4))).name
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-loop", "1", "-i", capa_jpg, "-filter_complex",
                    "[1:v]scale=1080:1920,format=yuv420p[c];[0:v][c]overlay=0:0:enable='lt(n,3)':shortest=1[v]",
                    "-map", "[v]", "-map", "0:a?", *SAIDA_VIDEO, "-c:a", "copy", "-movflags", "+faststart", tmp],
                   check=True)
    os.replace(tmp, mp4)


def gerar(mp4, texto=None, embutir_video=False, t=None):
    nome = os.path.basename(mp4)
    rel = os.path.relpath(os.path.abspath(mp4), RAIZ)
    texto = texto or texto_padrao(rel)
    t = item(rel).get("capa_t") if t is None else t
    os.makedirs(os.path.join(RAIZ, "capas"), exist_ok=True)
    jpg = os.path.join(RAIZ, "capas", os.path.splitext(nome)[0] + ".jpg")
    montar_capa(melhor_quadro(mp4, t), texto).save(jpg, quality=90)
    if embutir_video:
        embutir(mp4, jpg)
    return jpg


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mp4")
    ap.add_argument("--texto")
    ap.add_argument("--t", type=float, help="segundo do quadro de fundo (padrao: o mais nitido)")
    ap.add_argument("--embutir", action="store_true")
    a = ap.parse_args()
    print(gerar(a.mp4, a.texto, a.embutir, a.t))
