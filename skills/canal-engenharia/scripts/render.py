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

ENGINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.environ.get("YB_ENGINE", "engine3d.html"))
GRAB = "t => { render(t); return document.getElementById('c').toDataURL('image/jpeg', 0.9).split(',')[1]; }"


def three():
    """Three.js 0.170 embrulhado numa funcao (o build cjs declara nomes globais como clamp): vendor/three.js."""
    d = os.path.join(os.path.dirname(ENGINE), "vendor"); alvo = os.path.join(d, "three.js")
    if os.path.exists(alvo):
        return
    os.makedirs(d, exist_ok=True)
    cjs = os.path.join(d, "three.cjs")
    if not os.path.exists(cjs):
        subprocess.run(["curl", "-sSL", "-o", cjs, "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.cjs"], check=True)
    src = open(cjs, encoding="utf-8").read()
    open(alvo, "w", encoding="utf-8").write("(function(){var module={exports:{}},exports=module.exports;\n" + src + "\nwindow.T3=module.exports;})();\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("historia"); ap.add_argument("tempos"); ap.add_argument("video")
    ap.add_argument("--teste"); ap.add_argument("--fps", type=int, default=30)
    a = ap.parse_args()
    three()
    estado = resolver(carregar(a.historia), json.load(open(a.tempos)))
    with sync_playwright() as p:
        try:
            b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        except Exception:  # playwright do pip mais novo que o Chromium da maquina: usa o instalado
            b = p.chromium.launch(executable_path=os.environ.get("HM_CHROMIUM", "/opt/pw-browsers/chromium"), args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        pg.on("console", lambda m: print("js:", m.text, file=sys.stderr)); pg.on("pageerror", lambda e: print("js erro:", e, file=sys.stderr))
        pg.goto("file://" + ENGINE)
        pg.evaluate("h => setup(h)", estado)
        if os.environ.get("YB_SEM_LEGENDA"):  # quadros limpos para capa, perfil e banner
            pg.evaluate("() => { ST.semLegenda = true; }")
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
