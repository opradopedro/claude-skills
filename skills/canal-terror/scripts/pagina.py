#!/usr/bin/env python3
"""Monta os dados da pagina de revisao "Videos do Hora Muerta" (itens.json + videos).

Uso: python3 pagina.py --videos /mnt/project-files/canal-terror/videos --saida /tmp/pagina

Le os roteiros de stories/ e, para cada codigo, o que houver em --videos: HMxxx.mp4, HMxxx.jpg e
HMxxx.json ({codigo, titulo, url, publishAt, motor_voz}, gravado pela rotina depois do upload).
Escreve --saida/itens.json e copia os videos para --saida/v/. Depois publique a pagina com o
Artifact tool (mesmo url, files = {"itens.json": ..., "v/HMxxx.mp4": ..., "v/HMxxx.jpg": ...}).
"""
import argparse, glob, json, os, shutil, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import carregar

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--videos", default="/mnt/project-files/canal-terror/videos")
    ap.add_argument("--saida", required=True)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.saida, "v"), exist_ok=True)
    itens = []
    for f in sorted(glob.glob(os.path.join(RAIZ, "stories", "*.json"))):
        h = carregar(f)
        c = h["codigo"]
        it = {"codigo": c, "serie": h.get("serie", c), "serie_titulo": h.get("serie_titulo", h["titulo"]),
              "parte": h.get("parte", 1), "partes": h.get("partes", 1), "formato": h.get("formato", ""),
              "titulo": h["titulo"], "roteiro": [l["texto"] for l in h["lineas"]], "estado": "roteiro"}
        meta = os.path.join(a.videos, c + ".json")
        if os.path.exists(meta):
            m = json.load(open(meta))
            it.update({k: m[k] for k in ("titulo", "url", "publishAt", "motor_voz") if m.get(k)})
            it["estado"] = "agendado"
        src = os.path.join(a.videos, c + ".jpg")
        if os.path.exists(src):
            shutil.copy(src, os.path.join(a.saida, "v", c + ".jpg")); it["capa"] = f"v/{c}.jpg"
        src = os.path.join(a.videos, c + ".mp4")
        if os.path.exists(src):
            # a pagina aceita no maximo 15 MB por arquivo: copia em 720p
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-vf", "scale=720:-2", "-c:v", "libx264",
                            "-crf", "28", "-preset", "veryfast", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart",
                            os.path.join(a.saida, "v", c + ".mp4")], check=True)
            it["video"] = f"v/{c}.mp4"
        if it.get("video") and it["estado"] == "roteiro":
            it["estado"] = "pronto"
        itens.append(it)
    json.dump({"itens": itens}, open(os.path.join(a.saida, "itens.json"), "w"), ensure_ascii=False, indent=1)
    print(len(itens), "itens,", sum(1 for i in itens if i.get("video")), "com video")


if __name__ == "__main__":
    main()
