#!/usr/bin/env python3
"""Renderiza o video (sem audio) quadro a quadro: engine.html no Chromium (Playwright) -> FFmpeg.

Uso: python3 render.py historia.json tempos.json video.mp4 [--teste 1.5,10,22]
--teste salva JPGs nesses segundos (ao lado do video) em vez de renderizar tudo: use para conferir cenas.
1080x1920, 30 fps. Um Short de 45 s leva poucos minutos numa maquina comum.
"""
import argparse, base64, json, os, subprocess, sys
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import carregar, resolver

ENGINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "engine.html")
GRAB = "t => { render(t); return document.getElementById('c').toDataURL('image/jpeg', 0.9).split(',')[1]; }"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("historia"); ap.add_argument("tempos"); ap.add_argument("video")
    ap.add_argument("--teste"); ap.add_argument("--fps", type=int, default=30)
    a = ap.parse_args()
    estado = resolver(carregar(a.historia), json.load(open(a.tempos)))
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        pg.goto("file://" + ENGINE)
        pg.evaluate("h => setup(h)", estado)
        if a.teste:
            base = os.path.splitext(a.video)[0]
            for t in [float(v) for v in a.teste.split(",")]:
                open(f"{base}_{t:05.1f}.jpg", "wb").write(base64.b64decode(pg.evaluate(GRAB, t)))
        else:
            n = int(estado["dur"] * a.fps)
            ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(a.fps),
                                   "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
                                   "-preset", "medium", a.video], stdin=subprocess.PIPE)
            for i in range(n):
                ff.stdin.write(base64.b64decode(pg.evaluate(GRAB, i / a.fps)))
            ff.stdin.close(); ff.wait()
        b.close()
    print("ok", a.video)


if __name__ == "__main__":
    main()
